---
name: news-push
description: Generate a local news briefing from RSS / OPML subscriptions. Use when the user asks to 根据 RSS、订阅源或 OPML 生成新闻简报、新闻早报、每日摘要、本地 Markdown/HTML 报告，管理 RSS 订阅，或运行一个带本地工作台的新闻工作流； prefer this skill for feed-based briefings, not generic web news search.
---

IRON LAW: Only use a **local** HTTP workspace bound to `127.0.0.1` when browser interaction is needed. No external web deployment, no remote API backend, and no third-party runtime dependencies — all scripts use only Node.js built-in modules.

# News Push

## Natural Language Triggers

Use this skill when the user asks for a briefing built from their feeds, subscriptions, or OPML, for example:

- “根据我的 RSS 订阅生成今天的新闻简报”
- “把订阅源整理成一份本地 Markdown 新闻摘要”
- “生成一份按领域分类的新闻早报”
- “帮我把这个 RSS 加进 OPML，然后重新生成简报”
- “用本地订阅源输出一个 HTML 新闻报告”

Do **not** prefer this skill when the user is asking for generic latest news from the web with no RSS / subscription / OPML context.

## Purpose

Turn RSS subscriptions into a lightweight local briefing with:
- `简报` — global brief + domain briefs (dynamically classified)
- `重要事实` — source-attributed facts
- `关键观点` — key opinions
- `原始订阅信息流` — raw feed articles

**You (Claude) ARE the AI engine.** You generate the briefing JSON using your own capabilities. The scripts only handle data fetching and rendering — no external AI API calls.

## Architecture

```
Claude runs a stable CLI entrypoint:
    ↓
bin/news-push --workspace "$PWD"
    ↓
cli/main.mjs
    ↓
prepare phase:
  scripts/sync-feeds.mjs
  scripts/sync-extras.mjs
  scripts/apply-profile.mjs (optional)
  scripts/fetch-content.mjs
  scripts/preprocess-articles.mjs
    ↓
workspace/.news-push/data/articles-titles.txt
workspace/.news-push/ui-state.json  (waiting_for_ai)
    ↓
cli/main.mjs ensures local workspace server
  scripts/server.mjs  → http://127.0.0.1:<port>/
    ↓
Browser shows raw feed + “AI 正在进行总结和提炼”
    ↓
Claude reads titles + generates analysis JSON
    ↓
workspace/.news-push/data/analysis.json
    ↓
bin/news-push --workspace "$PWD"   (same command, second pass)
    ↓
finalize phase:
  scripts/gen-briefing.mjs
  scripts/render-md.mjs / scripts/render-html.mjs
  scripts/send-email.mjs (optional)
  scripts/manage-opml.mjs (feeds subcommands)
    ↓
workspace/.news-push/ui-state.json  (completed)
    ↓
Browser auto-refreshes into final HTML briefing
```

## File Locations

- `{baseDir}/feeds.opml` — bundled default subscription template (read-only seed)
- `{workspace}/.news-push/feeds.opml` — user/workspace subscription source-of-truth
- `{workspace}/.news-push/data/articles.json` — fetched article cache
- `{workspace}/.news-push/data/articles-titles.txt` — one title per line for AI analysis
- `{workspace}/.news-push/data/analysis.json` — Claude-generated analysis JSON
- `{workspace}/.news-push/output/latest.html` — generated HTML report
- `{workspace}/.news-push/output/latest.md` — generated Markdown report
- `{workspace}/.news-push/output/archive/` — timestamped snapshots
- `{workspace}/.news-push/.env` — email sending config (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_TO)
- `{workspace}/.news-push/ui-state.json` — browser workspace state (`waiting_for_ai`, `completed`, `failed`)
- `{workspace}/.news-push/server-state.json` — local server metadata (pid, port, url)

## Authorization-Friendly Runtime

To reduce repeated permission prompts, prefer the stable CLI entrypoint instead of calling many scripts one by one.

- Always execute `bin/news-push` from the skill directory
- Always pass `--workspace "$PWD"` so runtime files stay in the user's current project
- Prefer calling the same default `news-push` command twice around the AI analysis step, rather than issuing a long chain of shell commands
- Let `news-push` itself start or reuse the local workspace server; do not manually launch many helper commands unless the user explicitly asks
- Do **not** write runtime artifacts back into the installed skill directory unless the user explicitly asks for that behavior

## Workflow

### Default: `/news-push` (browser workspace + local files)

1. Run `node {baseDir}/bin/news-push --workspace "$PWD"`
2. Let the CLI finish prepare, then open or reuse the local browser workspace at `http://127.0.0.1:<port>/`
3. The browser page should now show the raw feed plus a status banner such as “AI 正在进行总结和提炼”
4. Read `{workspace}/.news-push/data/articles-titles.txt`
5. **If `{workspace}/.news-push/data/focus.yaml` exists and has a `preference` field**, read it and apply the user's natural language preferences during analysis (see Focus Integration below)
6. Generate an **analysis object** using your own AI capabilities (see schema below)
7. Prefer writing that object through `node {baseDir}/scripts/write-analysis.mjs --workspace "$PWD" --from-module {workspace}/.news-push/data/analysis-source.mjs`
8. This helper must serialize with `JSON.stringify` and validate before writing `{workspace}/.news-push/data/analysis.json`; do **not** hand-write a raw JSON file if you can avoid it
9. Run the **same command again**: `node {baseDir}/bin/news-push --workspace "$PWD"`
10. The browser workspace will auto-refresh into the final HTML report; also mention the generated local file paths to the user

Important freshness rule:
- Once a run has completed, the next `/news-push` invocation must start a **new** prepare phase.
- Do **not** reuse a previous run's `analysis.json` just because it still exists on disk.
- The only time the same command should finalize is when the current workspace state is explicitly waiting for AI analysis from the **current** prepare phase.

Important stability rule:
- Prefer authoring analysis as a JS object module such as `{workspace}/.news-push/data/analysis-source.mjs`
- Then call `scripts/write-analysis.mjs` so the final file is always produced by `JSON.stringify`
- If validation fails, fix the source object/module and rerun the writer; do not manually patch the broken JSON text blindly

### HTML output

Same flow, but use `node {baseDir}/bin/news-push html --workspace "$PWD"`. The browser workspace still opens after prepare and refreshes after finalize; the final local artifact is `{workspace}/.news-push/output/latest.html`.

### Email output (auto-send)

If `.env` is configured with `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_TO`, the email sending step is appended automatically after rendering:

Run `node {baseDir}/bin/news-push finalize --workspace "$PWD" --format html --email`

If `.env` does not exist or lacks required variables, skip silently (no error, no prompt).

### Both formats

Use `node {baseDir}/bin/news-push both --workspace "$PWD"` before and after the analysis step.

### Local workspace server

- Manual start: `node {baseDir}/bin/news-push serve --workspace "$PWD"`
- Config page: `node {baseDir}/bin/news-push serve --workspace "$PWD" --page /config`
- Keep the server local-only on `127.0.0.1`

### Manage subscriptions

- List: `node {baseDir}/bin/news-push feeds list --workspace "$PWD"`
- Add: `node {baseDir}/bin/news-push feeds add "Feed Name" "https://example.com/feed.xml" --workspace "$PWD"`
- Remove: `node {baseDir}/bin/news-push feeds remove "Feed Name" --workspace "$PWD"`

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
  ],
  "title_translations": {
    "English Title Here": "这里是对应的中文翻译",
    "Another English Title": "另一个中文翻译"
  }
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
2. **Translate English titles.** Add a `title_translations` field mapping English article titles → Chinese. Skip titles already in Chinese. Keep translations concise (suitable for scanning, not literary translation). Example: `"From 300KB to 69KB per Token: How LLM Architectures Solve the KV Cache Problem" → "从 300KB 到 69KB：LLM 架构如何解决 KV 缓存问题"`.

### Focus Integration

If `{workspace}/.news-push/data/focus.yaml` exists and has a non-empty `preference` field, read it before generating analysis. The preference is a **natural language string** — interpret it holistically to decide which articles to prioritize, deprioritize, or highlight.

Apply these rules:

- Read the `preference` text and **infer** what domains, topics, and keywords the user cares about most.
- When selecting highlight items, **weight articles** that match the inferred priorities higher. Articles matching deprioritized topics should only appear if truly groundbreaking.
- When the user mentions specific companies, products, or events (e.g. "OpenAI", "Anthropic", "product launches"), treat those as **boost keywords**.
- When the user mentions topics they don't care about (e.g. "不太关心汽车"), treat those as **ignore keywords**.
- If focus.yaml does NOT exist or has an empty preference, proceed with neutral/default weighting — no bias.

**Focus tagging**: When an item in `domain_briefs` matches the user's inferred priorities from the preference text, prepend `【focus_on】` before the relevant text. For example: `【focus_on】Anthropic Claude 新模型曝光；普通新闻...`. Use **only** the fixed tag `【focus_on】` — no other tag names. The render scripts apply underline styling to text following this exact tag and strip the tag itself from output.

2. **Merge facts** about the same event into one entry. **Do not merge opinions.**
3. **Inline source attribution** in summaries: `「fact（Source A, Source B）」` — you only see titles (no source names), so infer from content context (e.g. "IT之家", "Ars Technica", "TechCrunch").
4. **Be conservative.** If something cannot be confirmed, mark it as 「仍待确认」.
5. **Max 6 items** each for `highlight_facts` and `highlight_opinions`.
6. **Score** each item 1-10 based on importance and reliability.
7. **Output JSON only**, no Markdown wrapping.
8. **No metadata** — raw_articles, coverage, timestamps are assembled by the gen-briefing script, not by you.

## Profiles

Select a profile to focus the briefing on specific domains:

```bash
node {baseDir}/bin/news-push prepare --workspace "$PWD" --profile ai
node {baseDir}/bin/news-push --workspace "$PWD" --profile ai
```

Available profiles in `{baseDir}/profiles/`:

| Profile | Focus | Non-RSS Extras |
|---|---|---|
| `general` | 综合早报 (全部源) | All extras enabled |
| `tech` | 科技早报 (HN, GitHub, Dev.to, PH) | GitHub Trending, HF Papers, V2EX |
| `ai` | AI 深度 (arXiv, HF, OpenAI, DeepMind) | GitHub Trending, HF Papers |
| `finance` | 财经早报 (华尔街见闻, 36Kr, 腾讯) | 微博热搜, 华尔街见闻 |
| `social` | 吃瓜早报 (微博, V2EX, 知乎) | 微博热搜, V2EX 热门 |

When a profile is active, the runtime workspace writes `{workspace}/.news-push/data/articles-filtered.json`. Subsequent pipeline steps use that file instead of `articles.json`.

## Guardrails

- Confirm before deleting subscriptions
- Keep generated artifacts local and directly openable
- Facts stay conservative and source-attributed
- Keep the raw feed visible in time order
- Only bind the workspace server to `127.0.0.1`
- Do not introduce any remote backend, hosted API, or external web deployment

## Anti-Patterns

- Calling external AI APIs (you ARE the AI)
- Exposing the local workspace server beyond localhost
- Asking the user to type long flag-heavy commands
- Hiding the raw feed behind summaries only
- Writing output only to stdout without saving a durable file
- Introducing npm dependencies
