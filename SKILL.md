---
name: news-push
description: Generate a local news intelligence report from RSS subscriptions. Use when the user wants `/news-push`, Markdown output, static HTML output, RSS subscription management in OPML, or a lightweight CLI-first news workflow without any web server.
---

IRON LAW: Do not introduce or rely on a web server. `news-push` must stay CLI-first and produce local files the user can open directly. Zero external dependencies — all scripts use only Node.js built-in modules.

# News Push

## Purpose

Turn RSS subscriptions into a lightweight local briefing with:
- `简报` — global brief + domain briefs (dynamically classified)
- `重要事实` — source-attributed facts
- `关键观点` — key opinions
- `原始订阅信息流` — raw feed articles

**You (Claude) ARE the AI engine.** You generate the briefing JSON using your own capabilities. The scripts only handle data fetching and rendering — no external AI API calls.

## Architecture

```
SKILL.md (this file) → Claude reads and executes
    ↓
scripts/sync-feeds.mjs         → Fetch RSS → data/articles.json
    ↓
scripts/preprocess-articles.mjs → Strip HTML, truncate, filter noise
    ↓                              → data/articles-slim.json (full metadata, for render)
    ↓                              → data/articles-titles.txt (one title per line, for AI)
    ↓
Claude reads articles-titles.txt → Generates analysis JSON (analysis-only)
    ↓
gen-briefing script assembles   → analysis + slim → data/briefing.json
    ↓
scripts/render-html.mjs  → briefing JSON + articles-slim.json → output/latest.html
scripts/render-md.mjs    → briefing JSON + articles-slim.json → output/latest.md
scripts/manage-opml.mjs  → Manage RSS subscriptions (add/list/remove)
```

## File Locations

- `{baseDir}/feeds.opml` — RSS subscription source-of-truth
- `{baseDir}/data/articles.json` — fetched article cache
- `{baseDir}/output/latest.html` — generated HTML report
- `{baseDir}/output/latest.md` — generated Markdown report
- `{baseDir}/output/archive/` — timestamped snapshots

## Workflow

### Default: `/news-push` (Markdown output)

1. Run `node {baseDir}/scripts/sync-feeds.mjs` to fetch RSS articles into `data/articles.json`
2. Run `node {baseDir}/scripts/preprocess-articles.mjs` to generate `data/articles-slim.json` + `data/articles-titles.txt`
3. Read `{baseDir}/data/articles-titles.txt` (one title per line, minimal tokens)
4. **If `{baseDir}/data/focus.yaml` exists**, read it and apply the user's focus preferences during analysis (see Focus Integration below)
5. Generate an **analysis JSON** using your own AI capabilities (see schema below)
6. Write the analysis JSON to `{baseDir}/data/analysis.json` (use temp .mjs with `JSON.stringify`)
7. Run the gen-briefing script to assemble `{baseDir}/data/briefing.json` from analysis + slim
8. Run `node {baseDir}/scripts/render-md.mjs {baseDir}/data/briefing.json`
9. Show the user the output path

### HTML output

Same as above, but step 5 uses: `node {baseDir}/scripts/render-html.mjs {baseDir}/data/briefing.json`, then run `open {baseDir}/output/latest.html` to open in browser.

### Both formats

Run both render scripts after generating the briefing JSON. After rendering, run `open {baseDir}/output/latest.html` to open the HTML report in browser.

### Manage subscriptions

- List: `node {baseDir}/scripts/manage-opml.mjs list`
- Add: `node {baseDir}/scripts/manage-opml.mjs add "Feed Name" "https://example.com/feed.xml"`
- Remove: `node {baseDir}/scripts/manage-opml.mjs remove "Feed Name"`

## Analysis JSON Schema (AI output)

The AI reads `articles-titles.txt` (one title per line) and generates an analysis JSON with **only the analytical content**. Metadata (raw_articles, coverage, timestamps) is assembled by the gen-briefing script.

```json
{
  "global_brief": "1-3 sentence summary of the most important developments",
  "domain_briefs": {
    "<domain_key>": "domain summary (1-2 sentences)",
    "...": "2-5 domains, dynamically chosen based on actual content"
  },
  "highlight_facts": [
    {
      "title": "Concise fact title",
      "summary": "Fact with inline source attribution, e.g. 「OpenAI released o3 (OpenAI Blog, The Verge)」",
      "domain": "<domain_key>",
      "score": 9.0
    }
  ],
  "highlight_opinions": [
    {
      "title": "Opinion title",
      "summary": "Opinion summary with attribution",
      "domain": "<domain_key>",
      "score": 7.0
    }
  ]
}
```

### Domain Classification Rules

Domain keys are **dynamic** — you decide the domains based on actual article content. Use English keys, render scripts will map to Chinese labels.

Common domain keys (not exhaustive, add as needed): `ai`, `finance`, `politics`, `tech`, `society`, `health`, `entertainment`, `sports`, `science`, `security`.

Rules:
1. Choose **2-5 domains** that best cover the current batch of articles. Skip domains with no significant content.
2. Use **lowercase English** keys (e.g. `ai`, not `AI`).
3. Every fact/opinion must have a `domain` matching one of the domain_briefs keys, or `general`.

### Generation Rules

1. **Distinguish facts from opinions.** Facts = verifiable events. Opinions = analysis/commentary.

### Focus Integration

If `{baseDir}/data/focus.yaml` exists, read it before generating analysis. Apply these rules:

- **domains 权重**: When selecting highlight items, prefer articles in high-weight domains (e.g. `ai: 9` means AI articles should appear more often and score higher). Low-weight domains (1-3) should only appear if the event is extremely significant.
- **keywords_boost**: Articles whose titles match these keywords should be prioritized — include them in highlights even if they wouldn't otherwise make the top 6.
- **keywords_ignore**: Articles whose titles match these keywords should be deprioritized — only include if truly groundbreaking.
- **extra_instruction**: Apply this as an additional editorial bias when choosing which items to highlight.
- If focus.yaml does NOT exist, proceed with neutral/default weighting — no bias.

**Focus tagging**: When an item in `domain_briefs` matches the user's focus.yaml priorities (boosted keywords, high-weight domains, extra_instruction topics), prepend `【focus_on】` before the relevant text. For example: `【focus_on】Anthropic Claude 新模型曝光；普通新闻...`. Use **only** the fixed tag `【focus_on】` — no other tag names. The render scripts apply underline styling to text following this exact tag and strip the tag itself from output.

2. **Merge facts** about the same event into one entry. **Do not merge opinions.**
3. **Inline source attribution** in summaries: `「fact（Source A, Source B）」` — you only see titles (no source names), so infer from content context (e.g. "IT之家", "Ars Technica", "TechCrunch").
4. **Be conservative.** If something cannot be confirmed, mark it as 「仍待确认」.
5. **Max 6 items** each for `highlight_facts` and `highlight_opinions`.
6. **Score** each item 1-10 based on importance and reliability.
7. **Output JSON only**, no Markdown wrapping.
8. **No metadata** — raw_articles, coverage, timestamps are assembled by the gen-briefing script, not by you.

## Guardrails

- Confirm before deleting subscriptions
- Keep generated artifacts local and directly openable
- Facts stay conservative and source-attributed
- Keep the raw feed visible in time order
- No web server, no Flask, no live routes

## Anti-Patterns

- Calling external AI APIs (you ARE the AI)
- Reintroducing any web server dependency
- Asking the user to type long flag-heavy commands
- Hiding the raw feed behind summaries only
- Writing output only to stdout without saving a durable file
- Introducing npm dependencies
