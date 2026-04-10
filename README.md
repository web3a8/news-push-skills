# News Push

把 RSS 订阅源变成一份本地新闻简报的 Claude Code skill。

它会从内置的160+个新闻源抓取内容，然后在浏览器中展示给你；

同时，AI 的总结和提炼也在进行，完成后页面会自动刷新。

使用很简单，只需要记住 `/news-push` 就够了。

## 给人看的

### 这东西能干嘛

- 抓取 RSS 订阅源
- 按照原始信息流展示出来，不要挨个去别的网站看新闻了，一站式服务
- AI 再把内容整理成中文简报，分重点、事实、观点
- 同时产出 Markdown 和 HTML
- 可以在本地页面里管理订阅源和关注偏好

### 它的优点

- 上手轻，默认就用 `/news-push`
- 本地优先，数据和报告都在你自己电脑上
- 不会复用上一轮旧新闻，每次都是新抓取、新分析
- 页面不是傻等，先看原始流，再等 AI 补结果
- 不用装一堆依赖，Node.js 就能跑

### 最常用的用法

在 Claude Code 里直接输入：

```text
/news-push
```

如果你更习惯命令行，也可以这样：

```bash
~/.claude/skills/news-push/bin/news-push --workspace "$PWD"
```

第一次运行会先抓新闻，并打开本地页面。  
AI 分析写好后，再执行同一个命令一次，就会生成最终简报。

常见输出在这里：

```text
./.news-push/output/latest.md
./.news-push/output/latest.html
```

### 安装，尽量简单来

```bash
mkdir -p ~/.claude/skills
git clone git@github.com:web3a8/news-push-skills.git ~/.claude/skills/news-push
```

需要的前置条件也很简单：

- Claude Code 已安装并登录
- Node.js 18+

### 小提醒

- 第一次跑，Claude Code 可能会让你点几次授权，这是正常的
- 真正生效的是当前工作区里的 `./.news-push/`，不是 skill 安装目录
- 如果页面没立刻变成最终简报，通常是还在等 AI 分析，不是卡死了

## 给 Agent 看的

### 入口和运行方式

- 默认入口是 `bin/news-push`
- 无子命令时，等价于 `run`
- 推荐调用方式：

```bash
~/.claude/skills/news-push/bin/news-push --workspace "$PWD"
```

- `html`、`both`、`serve`、`feeds`、`paths` 都是可选子命令
- 不要直接把用户引导到内部脚本，尤其不要直接让用户裸跑 `scripts/server.mjs`

### 运行时目录

运行数据统一写到当前工作区：

```text
{workspace}/.news-push/
```

关键文件：

| 路径 | 用途 |
|---|---|
| `{workspace}/.news-push/feeds.opml` | 当前工作区实际使用的订阅源 |
| `{workspace}/.news-push/data/articles.json` | 原始抓取结果 |
| `{workspace}/.news-push/data/articles-titles.txt` | 给 AI 用的标题清单 |
| `{workspace}/.news-push/data/analysis.json` | AI 分析结果 |
| `{workspace}/.news-push/data/focus.yaml` | 用户关注偏好 |
| `{workspace}/.news-push/output/latest.md` | 最终 Markdown |
| `{workspace}/.news-push/output/latest.html` | 最终 HTML |
| `{workspace}/.news-push/ui-state.json` | 当前运行状态 |
| `{workspace}/.news-push/server-state.json` | 本地 server 元数据 |
| `{workspace}/.news-push/current-job.json` | 当前激活 job |
| `{workspace}/.news-push/jobs/<jobId>/...` | 每轮任务的快照 |

原则只有一个：

- 代码放 skill 目录
- 变化数据放 `./.news-push`
- 不要再把运行产物写回 `~/.claude/skills/news-push`

### 流程模型

这是一个两阶段流程：

1. `prepare`
   - 抓 RSS
   - 同步补充源
   - 可选 profile 过滤
   - 可选正文抓取
   - 生成 `articles-titles.txt`
   - 写 `ui-state.json = waiting_for_ai`
   - 启动或复用本地工作台

2. `finalize`
   - 读取 `analysis.json`
   - 生成 `briefing.json`
   - 渲染 `latest.md` / `latest.html`
   - 写 `ui-state.json = completed`
   - 同步当前 job 快照

重要约束：

- 已完成的旧分析不会被下一轮直接复用
- 只有当前状态是 `waiting_for_ai` 或 `finalizing` 时，第二次同命令调用才会进入 finalize
- 一轮任务对应一个 `jobId`

### 本地工作台和 job 路由

本地工作台是 HTTP 服务，不再只依赖根路径 `/` 猜状态。

关键路由：

| 路由 | 作用 |
|---|---|
| `/jobs/<jobId>` | 当前 job 的页面入口 |
| `/jobs/<jobId>/report` | 当前 job 的最终 HTML |
| `/api/jobs/<jobId>/state` | 当前 job 的状态 |
| `/api/health` | server 健康检查 |
| `/config` | 本地配置页 |

现在的复用策略是：

- CLI 先读 `server-state.json`
- 再请求 `/api/health`
- 只有下面 3 件事都对得上，才允许复用已有 server：
  - `runtimeRoot` 一致
  - `serverVersion` 一致
  - 如果要打开 `/jobs/...`，必须声明 `supportsJobRoutes: true`

不满足就视为旧进程，直接重启，不再复用。

### JSON 写入约束

不要手搓 JSON 字符串。

推荐做法：

1. 先产出 JS 对象
2. 用 `scripts/write-analysis.mjs` 统一写入
3. 必要时用 `scripts/validate-analysis.mjs` 校验或修复

推荐命令：

```bash
node ~/.claude/skills/news-push/scripts/write-analysis.mjs \
  --workspace "$PWD" \
  --from-module "$PWD/.news-push/data/analysis-source.mjs"
```

这样能避免引号、转义和坏 JSON 把整条流程卡住。

### 信息源结构

当前信息源是两层：

| 层级 | 数量 | 位置 |
|---|---:|---|
| RSS / Atom 订阅源 | 160 | `feeds.opml` |
| 非 RSS 补充源 | 5 | `scripts/sync-extras.mjs` |

完整 RSS 列表直接看 [feeds.opml](./feeds.opml)。

### 关键脚本

| 文件 | 作用 |
|---|---|
| [bin/news-push](./bin/news-push) | 稳定 CLI 入口 |
| [cli/main.mjs](./cli/main.mjs) | 命令分发、prepare/finalize、server 复用 |
| [scripts/sync-feeds.mjs](./scripts/sync-feeds.mjs) | RSS 抓取 |
| [scripts/sync-extras.mjs](./scripts/sync-extras.mjs) | 补充热点源 |
| [scripts/preprocess-articles.mjs](./scripts/preprocess-articles.mjs) | 文章预处理 |
| [scripts/gen-briefing.mjs](./scripts/gen-briefing.mjs) | 组装 briefing |
| [scripts/render-md.mjs](./scripts/render-md.mjs) | 渲染 Markdown |
| [scripts/render-html.mjs](./scripts/render-html.mjs) | 渲染 HTML |
| [scripts/server.mjs](./scripts/server.mjs) | 本地 HTTP 工作台 |
| [scripts/manage-opml.mjs](./scripts/manage-opml.mjs) | 订阅源管理 |

## License

MIT
