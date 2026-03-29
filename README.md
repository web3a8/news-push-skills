# News Push

> Claude Code Skill — 将 RSS 订阅源转化为每日本地新闻简报，零外部依赖。

## 功能特性

- **每日简报** — 自动抓取 RSS 订阅源，AI 生成中文摘要，按领域分类呈现
- **动态领域分类** — AI 根据当日内容自动归类（AI、科技、金融、社会等），不固定分类
- **重要事实 & 关键观点** — 区分事实与观点，附来源标注和重要性评分
- **英文标题翻译** — 自动将英文文章标题翻译为中文，方便快速扫描
- **双格式输出** — Markdown + 精美 HTML，本地直接查看
- **Web UI** — 内置本地 HTTP 服务，浏览器查看报告 + 管理订阅源
- **按来源分组** — 原始信息流按来源分组，侧边栏快速导航
- **个性化关注** — 用自然语言设定关注重点，AI 自动调整摘要权重，重点内容带下划线标记
- **订阅管理** — Web 界面或命令行添加、删除、测试 RSS 订阅源
- **零依赖** — 仅使用 Node.js 内置模块，无需安装任何 npm 包

## 前置条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 已安装并登录
- Node.js 18+

## 安装

将本项目克隆到 Claude Code 的 skills 目录下：

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/web3a8/news-push.git ~/.claude/skills/news-push
```

安装完成后，在 Claude Code 中输入 `/news-push` 即可启动。

### 个性化关注配置（可选）

复制示例配置并按需修改：

```bash
cp data/focus.example.yaml data/focus.yaml
```

或搭配 [news-push-focus](https://github.com/web3a8/news-push-focus) 技能，用自然语言设定关注点：

```
/news-push-focus 我更关注AI和安全的新闻，如果有产品大版本升级请提示我
```

## 使用方法

### 生成简报

```
/news-push
```

默认生成 Markdown 报告，输出到 `output/latest.md`。

### 生成 HTML 报告

```
/news-push html
```

生成 HTML 报告并自动在浏览器中打开。

### 同时生成两种格式

```
/news-push both
```

### Web UI 模式

```bash
# 启动本地服务（默认端口 7789）
node ~/.claude/skills/news-push/scripts/server.mjs

# 直接打开配置页
node ~/.claude/skills/news-push/scripts/server.mjs /config
```

- 内容展示页：`http://127.0.0.1:7789/`
- 配置管理页：`http://127.0.0.1:7789/config`

内容页右上角的齿轮 icon 可直接跳转到配置页（新标签页打开）。

### 管理订阅源

```bash
# 列出所有订阅源
node scripts/manage-opml.mjs list

# 添加订阅源
node scripts/manage-opml.mjs add "Feed Name" "https://example.com/feed.xml"

# 删除订阅源
node scripts/manage-opml.mjs remove "Feed Name"
```

也可通过 Web UI 的配置页管理。

## 输出报告结构

| 板块 | 说明 |
|------|------|
| 今日速览 | AI 生成的当日全局摘要 + 按领域分类的要点（关注内容带下划线标记） |
| 重要事实 | 最多 6 条经过验证的重要事件，附来源和评分 |
| 关键观点 | 最多 6 条值得关注的观点和分析 |
| 原始订阅信息流 | 按来源分组的全部文章，侧边栏导航 |

## 项目结构

```
news-push/
├── SKILL.md                 # Claude Code 技能定义
├── README.md                # 项目文档
├── LICENSE                  # MIT 许可证
├── .gitignore
├── feeds.opml               # RSS 订阅源（内置 10 个示例源）
├── scripts/
│   ├── sync-feeds.mjs       # RSS 抓取
│   ├── preprocess-articles.mjs  # 文章预处理 & 去噪
│   ├── gen-briefing.mjs     # 简报组装
│   ├── render-html.mjs      # HTML 渲染
│   ├── render-md.mjs        # Markdown 渲染
│   ├── server.mjs           # 本地 Web 服务
│   ├── manage-opml.mjs      # 订阅源命令行管理
│   └── validate-pipeline.mjs    # 管道验证
├── data/
│   ├── focus.example.yaml   # 个性化关注配置示例
│   └── .gitkeep
└── output/                  # 生成的报告（已 gitignore）
    ├── latest.html
    ├── latest.md
    └── archive/             # 历史快照
```

## 配置说明

### feeds.opml

RSS 订阅源使用标准 OPML 格式。安装后自带 10 个示例源，可根据需要增减。推荐通过 Web UI 或命令行工具管理。

### focus.yaml（可选）

个性化关注配置，控制 AI 分析时的权重偏好：

```yaml
# 领域关注度（1-10，5 为默认）
domains:
  ai: 9
  security: 8
  finance: 5

# 提权关键词
keywords_boost:
  - OpenAI
  - Anthropic

# 降权关键词
keywords_ignore:
  - 汽车评测

# 编辑指令
extra_instruction: "重点关注 AI 领域，重大产品升级加标注"

# 用户原始意图（保留供参考）
user_note: "我更关注AI的新闻"
updated_at: "2026-03-29T10:00:00Z"
```

## 技术特点

- **Claude 即 AI 引擎** — 无需调用外部 AI API，由 Claude Code 自身生成分析
- **零 npm 依赖** — 全部脚本仅使用 Node.js 内置模块
- **CLI 优先** — 核心功能通过命令行完成，Web UI 为可选增强
- **数据本地化** — 所有数据、报告均保存在本地

## 许可证

MIT
