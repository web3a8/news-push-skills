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

## 信息源总览

当前项目共接入 **165 个信息源**，其中 **160 个 RSS / Atom 订阅源** 来自 [feeds.opml](./feeds.opml)，另有 **5 个非 RSS 补充源** 由 [sync-extras.mjs](./scripts/sync-extras.mjs) 动态抓取。

| 信息源层 | 数量 | 配置位置 | 覆盖范围 |
|---|---:|---|---|
| RSS / Atom 订阅 | 160 | `feeds.opml` | 官方博客、科技媒体、AI / 论文、安全资讯、中文站点、社区与独立博客 |
| 非 RSS 补充源 | 5 | `scripts/sync-extras.mjs` | 热榜、热门开源项目、论文日榜、财经快讯、社区热点 |
| 合计 | 165 | 混合采集 | 同时覆盖稳定订阅流与当日高热信号 |

### 非 RSS 补充源

| 来源 | 类型 | 抓取地址 | 说明 |
|---|---|---|---|
| 微博热搜 | 热榜 | `https://weibo.com/ajax/side/hotSearch` | 补充中文舆情与社会热点 |
| GitHub Trending | 热门项目 | `https://github.com/trending` | 补充当日高热仓库与开发工具动态 |
| HuggingFace Papers | 论文日榜 | `https://huggingface.co/api/daily_papers` | 补充 AI 论文、摘要与热度信号 |
| 华尔街见闻 | 财经快讯 | `https://api-one.wallstcn.com/apiv1/content/information-flow?...` | 补充中文金融与宏观市场动态 |
| V2EX 热门 | 社区热点 | `https://www.v2ex.com/api/topics/hot.json` | 补充技术社区热门讨论 |

<details>
<summary>查看全部 160 个 RSS / Atom 订阅源</summary>

| # | 来源 | 类型 | 地址 |
|---:|---|---|---|
| 001 | A List Apart | RSS/Atom | `https://alistapart.com/main/feed/` |
| 002 | AWS Blog | RSS/Atom | `https://aws.amazon.com/blogs/aws/feed/` |
| 003 | Ars Technica | RSS/Atom | `https://feeds.arstechnica.com/arstechnica/index` |
| 004 | ByteByteGo | RSS/Atom | `https://blog.bytebytego.com/feed` |
| 005 | CSS-Tricks | RSS/Atom | `https://css-tricks.com/feed/` |
| 006 | Chrome Developer Blog | RSS/Atom | `https://developer.chrome.com/blog/feed.xml` |
| 007 | Cloudflare Blog | RSS/Atom | `https://blog.cloudflare.com/rss/` |
| 008 | Codrops | RSS/Atom | `https://tympanus.net/codrops/feed/` |
| 009 | Dev.to | RSS/Atom | `https://dev.to/feed` |
| 010 | Fluent Reader Releases | RSS/Atom | `https://github.com/yang991178/fluent-reader/releases.atom` |
| 011 | FreeBuf | RSS/Atom | `https://www.freebuf.com/feed` |
| 012 | FreshRSS Releases | RSS/Atom | `https://github.com/FreshRSS/FreshRSS/releases.atom` |
| 013 | GitHub Blog | RSS/Atom | `https://github.blog/feed/` |
| 014 | Go Blog | RSS/Atom | `https://go.dev/blog/feed.atom` |
| 015 | Golang Weekly | RSS/Atom | `https://golangweekly.com/rss/` |
| 016 | Google AI Blog | RSS/Atom | `https://blog.google/technology/ai/rss/` |
| 017 | Google DeepMind | RSS/Atom | `https://deepmind.google/blog/rss.xml` |
| 018 | Hacker News AI | RSS/Atom | `https://hnrss.org/newest?q=AI` |
| 019 | Hacker News Ask | RSS/Atom | `https://hnrss.org/ask` |
| 020 | Hacker News LLM | RSS/Atom | `https://hnrss.org/newest?q=LLM` |
| 021 | Hacker News OpenClaw | RSS/Atom | `https://hnrss.org/newest?q=OpenClaw` |
| 022 | Hacker News Show | RSS/Atom | `https://hnrss.org/show` |
| 023 | Hacker News 最佳 | RSS/Atom | `https://hnrss.org/best` |
| 024 | Hacker News 首页 | RSS/Atom | `https://hnrss.org/frontpage` |
| 025 | Hugging Face 博客 | RSS/Atom | `https://huggingface.co/blog/feed.xml` |
| 026 | IT之家 | RSS/Atom | `https://www.ithome.com/rss/` |
| 027 | JavaScript Weekly | RSS/Atom | `https://javascriptweekly.com/rss/` |
| 028 | Kotlin Blog | RSS/Atom | `https://blog.jetbrains.com/kotlin/feed/` |
| 029 | Krebs on Security | RSS/Atom | `https://krebsonsecurity.com/feed/` |
| 030 | LinuxDo 最新话题 | RSS/Atom | `https://linux.do/latest.rss` |
| 031 | LinuxDo 热门话题 | RSS/Atom | `https://linux.do/top.rss` |
| 032 | MIT Technology Review | RSS/Atom | `https://www.technologyreview.com/feed/` |
| 033 | Meta Engineering | RSS/Atom | `https://engineering.fb.com/feed/` |
| 034 | Mozilla Hacks | RSS/Atom | `https://hacks.mozilla.org/feed/` |
| 035 | Nature | RSS/Atom | `https://www.nature.com/nature.rss` |
| 036 | NetNewsWire Releases | RSS/Atom | `https://github.com/Ranchero-Software/NetNewsWire/releases.atom` |
| 037 | Node.js Blog | RSS/Atom | `https://nodejs.org/en/feed/blog.xml` |
| 038 | OpenAI 博客 | RSS/Atom | `https://openai.com/news/rss.xml` |
| 039 | OpenClaw Commits | RSS/Atom | `https://github.com/openclaw/openclaw/commits/main.atom` |
| 040 | OpenClaw Releases | RSS/Atom | `https://github.com/openclaw/openclaw/releases.atom` |
| 041 | Product Hunt | RSS/Atom | `https://www.producthunt.com/feed` |
| 042 | Python Blog | RSS/Atom | `https://blog.python.org/feeds/posts/default` |
| 043 | RSSHub Radar Releases | RSS/Atom | `https://github.com/DIYgod/RSSHub-Radar/releases.atom` |
| 044 | React Blog | RSS/Atom | `https://react.dev/rss.xml` |
| 045 | Rust Blog | RSS/Atom | `https://blog.rust-lang.org/feed.xml` |
| 046 | Schneier on Security | RSS/Atom | `https://www.schneier.com/feed/` |
| 047 | Simon Willison's Blog | RSS/Atom | `https://simonwillison.net/atom/everything/` |
| 048 | Smashing Magazine | RSS/Atom | `https://www.smashingmagazine.com/feed/` |
| 049 | Spotify Engineering | RSS/Atom | `https://engineering.atspotify.com/feed/` |
| 050 | Stripe Blog | RSS/Atom | `https://stripe.com/blog/feed.rss` |
| 051 | Swift Blog | RSS/Atom | `https://www.swift.org/atom.xml` |
| 052 | Tailwind CSS Blog | RSS/Atom | `https://tailwindcss.com/feeds/feed.xml` |
| 053 | TechCrunch | RSS/Atom | `https://techcrunch.com/feed/` |
| 054 | The Hacker News | RSS/Atom | `https://feeds.feedburner.com/TheHackersNews` |
| 055 | The Verge | RSS/Atom | `https://www.theverge.com/rss/index.xml` |
| 056 | This Week in Rust | RSS/Atom | `https://this-week-in-rust.org/atom.xml` |
| 057 | TypeScript Blog | RSS/Atom | `https://devblogs.microsoft.com/typescript/feed/` |
| 058 | V2EX 技术 | RSS/Atom | `https://www.v2ex.com/feed/tab/tech.xml` |
| 059 | Vercel Blog | RSS/Atom | `https://vercel.com/atom` |
| 060 | Vue Blog | RSS/Atom | `https://blog.vuejs.org/feed.rss` |
| 061 | Wired | RSS/Atom | `https://www.wired.com/feed/rss` |
| 062 | arXiv AI | RSS/Atom | `https://rss.arxiv.org/rss/cs.AI` |
| 063 | arXiv NLP | RSS/Atom | `https://rss.arxiv.org/rss/cs.CL` |
| 064 | arXiv 机器学习 | RSS/Atom | `https://rss.arxiv.org/rss/cs.LG` |
| 065 | arXiv 计算机视觉 | RSS/Atom | `https://rss.arxiv.org/rss/cs.CV` |
| 066 | 安全客 | RSS/Atom | `https://api.anquanke.com/data/v1/rss` |
| 067 | 少数派 | RSS/Atom | `https://sspai.com/feed` |
| 068 | 效率火箭 | RSS/Atom | `https://rss.aishort.top/?type=xlrocket` |
| 069 | 爱范儿 | RSS/Atom | `https://rss.aishort.top/?type=AppSolution` |
| 070 | 阮一峰的网络日志 | RSS/Atom | `https://www.ruanyifeng.com/blog/atom.xml` |
| 071 | jeffgeerling.com | RSS/Atom | `https://www.jeffgeerling.com/blog.xml` |
| 072 | seangoedecke.com | RSS/Atom | `https://www.seangoedecke.com/rss.xml` |
| 073 | daringfireball.net | RSS/Atom | `https://daringfireball.net/feeds/main` |
| 074 | ericmigi.com | RSS/Atom | `https://ericmigi.com/rss.xml` |
| 075 | antirez.com | RSS/Atom | `http://antirez.com/rss` |
| 076 | idiallo.com | RSS/Atom | `https://idiallo.com/feed.rss` |
| 077 | maurycyz.com | RSS/Atom | `https://maurycyz.com/index.xml` |
| 078 | pluralistic.net | RSS/Atom | `https://pluralistic.net/feed/` |
| 079 | shkspr.mobi | RSS/Atom | `https://shkspr.mobi/blog/feed/` |
| 080 | lcamtuf.substack.com | RSS/Atom | `https://lcamtuf.substack.com/feed` |
| 081 | mitchellh.com | RSS/Atom | `https://mitchellh.com/feed.xml` |
| 082 | dynomight.net | RSS/Atom | `https://dynomight.net/feed.xml` |
| 083 | utcc.utoronto.ca/~cks | RSS/Atom | `https://utcc.utoronto.ca/~cks/space/blog/?atom` |
| 084 | xeiaso.net | RSS/Atom | `https://xeiaso.net/blog.rss` |
| 085 | devblogs.microsoft.com/oldnewthing | RSS/Atom | `https://devblogs.microsoft.com/oldnewthing/feed` |
| 086 | righto.com | RSS/Atom | `https://www.righto.com/feeds/posts/default` |
| 087 | lucumr.pocoo.org | RSS/Atom | `https://lucumr.pocoo.org/feed.atom` |
| 088 | skyfall.dev | RSS/Atom | `https://skyfall.dev/rss.xml` |
| 089 | garymarcus.substack.com | RSS/Atom | `https://garymarcus.substack.com/feed` |
| 090 | rachelbythebay.com | RSS/Atom | `https://rachelbythebay.com/w/atom.xml` |
| 091 | overreacted.io | RSS/Atom | `https://overreacted.io/rss.xml` |
| 092 | timsh.org | RSS/Atom | `https://timsh.org/rss/` |
| 093 | johndcook.com | RSS/Atom | `https://www.johndcook.com/blog/feed/` |
| 094 | gilesthomas.com | RSS/Atom | `https://gilesthomas.com/feed/rss.xml` |
| 095 | matklad.github.io | RSS/Atom | `https://matklad.github.io/feed.xml` |
| 096 | derekthompson.org | RSS/Atom | `https://www.theatlantic.com/feed/author/derek-thompson/` |
| 097 | evanhahn.com | RSS/Atom | `https://evanhahn.com/feed.xml` |
| 098 | terriblesoftware.org | RSS/Atom | `https://terriblesoftware.org/feed/` |
| 099 | rakhim.exotext.com | RSS/Atom | `https://rakhim.exotext.com/rss.xml` |
| 100 | joanwestenberg.com | RSS/Atom | `https://joanwestenberg.com/rss` |
| 101 | xania.org | RSS/Atom | `https://xania.org/feed` |
| 102 | micahflee.com | RSS/Atom | `https://micahflee.com/feed/` |
| 103 | nesbitt.io | RSS/Atom | `https://nesbitt.io/feed.xml` |
| 104 | construction-physics.com | RSS/Atom | `https://www.construction-physics.com/feed` |
| 105 | tedium.co | RSS/Atom | `https://feed.tedium.co/` |
| 106 | susam.net | RSS/Atom | `https://susam.net/feed.xml` |
| 107 | entropicthoughts.com | RSS/Atom | `https://entropicthoughts.com/feed.xml` |
| 108 | buttondown.com/hillelwayne | RSS/Atom | `https://buttondown.com/hillelwayne/rss` |
| 109 | dwarkesh.com | RSS/Atom | `https://www.dwarkeshpatel.com/feed` |
| 110 | borretti.me | RSS/Atom | `https://borretti.me/feed.xml` |
| 111 | wheresyoured.at | RSS/Atom | `https://www.wheresyoured.at/rss/` |
| 112 | jayd.ml | RSS/Atom | `https://jayd.ml/feed.xml` |
| 113 | minimaxir.com | RSS/Atom | `https://minimaxir.com/index.xml` |
| 114 | geohot.github.io | RSS/Atom | `https://geohot.github.io/blog/feed.xml` |
| 115 | paulgraham.com | RSS/Atom | `http://www.aaronsw.com/2002/feeds/pgessays.rss` |
| 116 | filfre.net | RSS/Atom | `https://www.filfre.net/feed/` |
| 117 | blog.jim-nielsen.com | RSS/Atom | `https://blog.jim-nielsen.com/feed.xml` |
| 118 | dfarq.homeip.net | RSS/Atom | `https://dfarq.homeip.net/feed/` |
| 119 | jyn.dev | RSS/Atom | `https://jyn.dev/atom.xml` |
| 120 | geoffreylitt.com | RSS/Atom | `https://www.geoffreylitt.com/feed.xml` |
| 121 | downtowndougbrown.com | RSS/Atom | `https://www.downtowndougbrown.com/feed/` |
| 122 | brutecat.com | RSS/Atom | `https://brutecat.com/rss.xml` |
| 123 | eli.thegreenplace.net | RSS/Atom | `https://eli.thegreenplace.net/feeds/all.atom.xml` |
| 124 | abortretry.fail | RSS/Atom | `https://www.abortretry.fail/feed` |
| 125 | fabiensanglard.net | RSS/Atom | `https://fabiensanglard.net/rss.xml` |
| 126 | oldvcr.blogspot.com | RSS/Atom | `https://oldvcr.blogspot.com/feeds/posts/default` |
| 127 | bogdanthegeek.github.io | RSS/Atom | `https://bogdanthegeek.github.io/blog/index.xml` |
| 128 | hugotunius.se | RSS/Atom | `https://hugotunius.se/feed.xml` |
| 129 | gwern.net | RSS/Atom | `https://gwern.substack.com/feed` |
| 130 | berthub.eu | RSS/Atom | `https://berthub.eu/articles/index.xml` |
| 131 | chadnauseam.com | RSS/Atom | `https://chadnauseam.com/rss.xml` |
| 132 | simone.org | RSS/Atom | `https://simone.org/feed/` |
| 133 | it-notes.dragas.net | RSS/Atom | `https://it-notes.dragas.net/feed/` |
| 134 | beej.us | RSS/Atom | `https://beej.us/blog/rss.xml` |
| 135 | hey.paris | RSS/Atom | `https://hey.paris/index.xml` |
| 136 | danielwirtz.com | RSS/Atom | `https://danielwirtz.com/rss.xml` |
| 137 | matduggan.com | RSS/Atom | `https://matduggan.com/rss/` |
| 138 | refactoringenglish.com | RSS/Atom | `https://refactoringenglish.com/index.xml` |
| 139 | worksonmymachine.substack.com | RSS/Atom | `https://worksonmymachine.substack.com/feed` |
| 140 | philiplaine.com | RSS/Atom | `https://philiplaine.com/index.xml` |
| 141 | steveblank.com | RSS/Atom | `https://steveblank.com/feed/` |
| 142 | bernsteinbear.com | RSS/Atom | `https://bernsteinbear.com/feed.xml` |
| 143 | danieldelaney.net | RSS/Atom | `https://danieldelaney.net/feed` |
| 144 | troyhunt.com | RSS/Atom | `https://www.troyhunt.com/rss/` |
| 145 | herman.bearblog.dev | RSS/Atom | `https://herman.bearblog.dev/feed/` |
| 146 | tomrenner.com | RSS/Atom | `https://tomrenner.com/index.xml` |
| 147 | blog.pixelmelt.dev | RSS/Atom | `https://blog.pixelmelt.dev/rss/` |
| 148 | martinalderson.com | RSS/Atom | `https://martinalderson.com/feed.xml` |
| 149 | danielchasehooper.com | RSS/Atom | `https://danielchasehooper.com/feed.xml` |
| 150 | chiark.greenend.org.uk/~sgtatham | RSS/Atom | `https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/feed.xml` |
| 151 | grantslatton.com | RSS/Atom | `https://grantslatton.com/rss.xml` |
| 152 | experimental-history.com | RSS/Atom | `https://www.experimental-history.com/feed` |
| 153 | anildash.com | RSS/Atom | `https://anildash.com/feed.xml` |
| 154 | aresluna.org | RSS/Atom | `https://aresluna.org/main.rss` |
| 155 | michael.stapelberg.ch | RSS/Atom | `https://michael.stapelberg.ch/feed.xml` |
| 156 | miguelgrinberg.com | RSS/Atom | `https://blog.miguelgrinberg.com/feed` |
| 157 | keygen.sh | RSS/Atom | `https://keygen.sh/blog/feed.xml` |
| 158 | mjg59.dreamwidth.org | RSS/Atom | `https://mjg59.dreamwidth.org/data/rss` |
| 159 | computer.rip | RSS/Atom | `https://computer.rip/rss.xml` |
| 160 | tedunangst.com | RSS/Atom | `https://www.tedunangst.com/flak/rss` |

</details>

## 前置条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 已安装并登录
- Node.js 18+

## 安装

将本项目克隆到 Claude Code 的 skills 目录下：

```bash
mkdir -p ~/.claude/skills
git clone git@github.com:web3a8/news-push-skills.git ~/.claude/skills/news-push
```

安装完成后，在 Claude Code 中输入 `/news-push` 即可启动。

### 稳定 CLI 入口

从当前版本开始，推荐通过稳定 CLI 入口执行，而不是手动一条条运行内部脚本：

```bash
~/.claude/skills/news-push/bin/news-push --workspace "$PWD"
```

这样做的好处是：

- 对 Claude Code 来说，命令形态更稳定，更容易复用授权
- 运行数据会写到当前工作区的 `.news-push/`，不会污染安装目录
- 你迁移仓库位置后，只要 `~/.claude/skills/news-push` 软链接还在，调用方式就不用变

### 本地开发时用软连接注册

如果你已经在别的目录维护这个仓库，推荐用软连接把它注册到 Claude Code 的 skills 目录：

```bash
ln -s "/path/to/news-push" ~/.claude/skills/news-push
```

这样你在原目录修改代码后，Claude Code 会直接读取最新版本，不需要重复复制文件。

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

### 推荐用法：两阶段默认命令

第一次运行：

```bash
~/.claude/skills/news-push/bin/news-push --workspace "$PWD"
```

这一步会完成抓取、补充源同步、可选 profile 过滤、正文抓取和预处理，并在当前目录生成：

```text
./.news-push/data/articles-titles.txt
./.news-push/data/analysis.json   # 等待 Claude 写入
```

Claude 读取 `articles-titles.txt` 生成分析 JSON 后，再执行同一个命令一次：

```bash
~/.claude/skills/news-push/bin/news-push --workspace "$PWD"
```

第二次运行会自动进入 finalize 阶段，输出报告到：

```text
./.news-push/output/latest.md
./.news-push/output/latest.html
```

### 生成 Markdown 简报

```
/news-push
```

在 skill 内部，推荐等价执行：

```bash
~/.claude/skills/news-push/bin/news-push --workspace "$PWD" --format md
```

默认生成 Markdown 报告，输出到 `./.news-push/output/latest.md`。

### 用自然语言触发

除了直接输入 `/news-push`，也可以用自然语言让 Claude 命中这个 skill。推荐在描述里明确提到 `RSS`、`订阅源`、`OPML`、`新闻简报` 这类关键词，例如：

- `根据我的 RSS 订阅生成今天的新闻简报`
- `把订阅源整理成一份本地 Markdown 新闻摘要`
- `生成一份按领域分类的新闻早报`
- `帮我把这个 RSS 加进 OPML，然后重新生成简报`
- `用本地订阅源输出一个 HTML 新闻报告`

如果只是说“看看今天有什么新闻”这类泛化请求，更可能走普通联网搜索，而不是这个 skill。

### 生成 HTML 报告

```
/news-push html
```

等价 CLI：

```bash
~/.claude/skills/news-push/bin/news-push html --workspace "$PWD"
```

生成 HTML 报告到 `./.news-push/output/latest.html`。

### 同时生成两种格式

```
/news-push both
```

等价 CLI：

```bash
~/.claude/skills/news-push/bin/news-push both --workspace "$PWD"
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
~/.claude/skills/news-push/bin/news-push feeds list --workspace "$PWD"

# 添加订阅源
~/.claude/skills/news-push/bin/news-push feeds add "Feed Name" "https://example.com/feed.xml" --workspace "$PWD"

# 删除订阅源
~/.claude/skills/news-push/bin/news-push feeds remove "Feed Name" --workspace "$PWD"
```

也可通过 Web UI 的配置页管理。

## 运行时目录

默认情况下，内置的 `feeds.opml` 只是模板。真正的运行时数据都会写到当前工作区的 `./.news-push/`：

| 路径 | 用途 |
|---|---|
| `./.news-push/feeds.opml` | 当前工作区实际使用的订阅源 |
| `./.news-push/data/articles.json` | 原始抓取结果 |
| `./.news-push/data/articles-titles.txt` | 提供给 Claude 的标题清单 |
| `./.news-push/data/analysis.json` | Claude 生成的分析 JSON |
| `./.news-push/output/latest.md` | Markdown 报告 |
| `./.news-push/output/latest.html` | HTML 报告 |

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
├── feeds.opml               # RSS 订阅源（内置 160+ 精选源）
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

个性化关注配置，用自然语言描述你的偏好：

```yaml
preference: "我更关注AI和安全领域的新闻，如果有OpenAI或Anthropic的产品升级请重点提示我"
updated_at: "2026-03-31T10:00:00Z"
```

AI 引擎会在生成简报时自动解读你的偏好，无需手动设置权重或关键词。也可通过 Web UI 配置页直接编辑。

## 技术特点

- **Claude 即 AI 引擎** — 无需调用外部 AI API，由 Claude Code 自身生成分析
- **零 npm 依赖** — 全部脚本仅使用 Node.js 内置模块
- **CLI 优先** — 核心功能通过命令行完成，Web UI 为可选增强
- **数据本地化** — 所有数据、报告均保存在本地

## 许可证

MIT
