# News Push

> 基于 Claude Code 的 RSS 新闻简报技能，一键生成每日情报摘要。

## 功能

- **每日简报** — 自动抓取 RSS 订阅源，AI 生成中文摘要，按领域分类呈现
- **动态领域分类** — AI 根据当日内容自动归类（科技、金融、安全、社会等），不固定分类
- **重要事实 & 关键观点** — 区分事实与观点，附来源标注和重要性评分
- **双格式输出** — Markdown + 精美 HTML，本地直接打开，无需服务器
- **内置 160+ 订阅源** — 涵盖科技、安全、商业、独立博客等优质信息源
- **个性化关注** — 用自然语言设定关注重点，AI 自动调整摘要权重，重点内容带下划线标记
- **订阅管理** — 随时添加、删除、查看 RSS 订阅源
- **零依赖** — 仅使用 Node.js 内置模块，无需安装任何 npm 包

## 安装

### 前置条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 已安装并登录
- Node.js 18+

### 安装步骤

将本项目克隆到 Claude Code 的 skills 目录下：

```bash
# 进入 Claude Code 的 skills 目录（如不存在会自动创建）
mkdir -p ~/.claude/skills

# 克隆项目
git clone https://github.com/web3a8/news-push-skills.git ~/.claude/skills/news-push
```

安装完成后，在 Claude Code 中直接使用 `/news-push` 即可启动。

### 个性化关注配置（可选）

复制示例配置并按需修改：

```bash
cp data/focus.example.yaml data/focus.yaml
```

或直接用自然语言描述你的关注点（需要安装 [news-push-focus](https://github.com/web3a8/news-push-skills) 技能）：

```
/news-push-focus 我更关注AI和安全的新闻，如果有产品大版本升级请提示我
```

## 使用方法

### 生成简报（Markdown）

在 Claude Code 中输入：

```
/news-push
```

## 输出示例

生成的 HTML 简报包含以下板块：

| 板块 | 说明 |
|------|------|
| 今日速览 | 按领域分类的当日要点摘要，重点内容带下划线标记 |
| 原始订阅信息流 | 按时间排列的全部文章列表 |

## 项目结构

```
news-push/
├── SKILL.md              # 技能定义文件
├── feeds.opml            # RSS 订阅源（160+）
├── scripts/              # 处理脚本
└── output/               # 生成的简报文件
    ├── latest.html       # HTML 简报
    └── latest.md         # Markdown 简报
```

## 许可证

MIT
