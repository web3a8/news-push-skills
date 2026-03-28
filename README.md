# News Push

一个轻量、CLI-first 的本地新闻情报 skill，基于 RSS 订阅。

## Features

- **零外部依赖** — 仅使用 Node.js 内置模块，无 npm 包 flask 緻加
- **AI 驱动** — Claude 作为 AI 引擎，无需外部 AI API
- **动态分类** — AI 根据文章内容自动选择领域
- **双格式输出** — Markdown + 静态 HTML
- **OPML 管理** — 内置订阅源管理

- **CLI-first** — 无 web server，所有文件本地可直接打开

## Architecture

```
SKILL.md (this file) → Claude reads and executes
    ↓
scripts/sync-feeds.mjs         → Fetch RSS → data/articles.json
    ↓
scripts/preprocess-articles.mjs → Strip HTML, truncate, filter noise
    ↓                              → data/articles-slim.json ( full metadata, for render)
    ↓                              → data/articles-titles.txt ( one title per line, for AI)
    ↓
Claude reads articles-titles.txt → Generates analysis JSON
    ↓
Write analysis JSON to data/analysis.json
    ↓
scripts/gen-briefing.mjs   → assemble briefing.json from analysis + slim
    ↓
scripts/render-html.mjs  → Briefing JSON → HTML
scripts/render-md.mjs   → Briefing JSON → Markdown
scripts/manage-opml.mjs  → Manage RSS subscriptions ( add/list/remove )
scripts/validate-pipeline.mjs → Validate pipeline integrity
```

## File Locations

- `feeds.opml` — RSS subscription source-of-truth
- `data/sample-briefing.json` — Sample briefing for for development)
- `output/latest.html` — Generated HTML report
- `output/latest.md` — generated Markdown report
- `output/archive/` — timestamped snapshots

## Usage

### Generate report (Markdown)

```bash
node scripts/sync-feeds.mjs
node scripts/preprocess-articles.mjs
# Claude reads data/articles-titles.txt and generates analysis
# Write analysis to data/analysis.json
node scripts/gen-briefing.mjs
node scripts/render-md.mjs data/briefing.json
```

### Generate report (HTML)

```bash
node scripts/sync-feeds.mjs
node scripts/preprocess-articles.mjs
# Claude reads data/articles-titles.txt -> generates analysis
node scripts/render-html.mjs data/briefing.json
open output/latest.html
```

### Both formats

```bash
node scripts/sync-feeds.mjs
node scripts/preprocess-articles.mjs
# Claude reads data/articles-titles.txt -> generates analysis
node scripts/render-html.mjs data/briefing.json
node scripts/render-md.mjs data/briefing.json
open output/latest.html
```

### Manage subscriptions

```bash
node scripts/manage-opml.mjs list
node scripts/manage-opml.mjs add "Feed Name" "https://example.com/feed.xml"
node scripts/manage-opml.mjs remove "Feed Name"
```

## Design principles

- CLI-first, all output to local files
- Zero external dependencies (Node.js built-in only)
- No web server required
- AI 驱动 via Claude, not external APIs

## License

MIT
