# 新闻推送 Skill

自动获取新闻热点并推送到邮箱的 Claude Code Skill。

## 功能特性

- ✅ **多种新闻源**：RSS/Atom feeds、通用 API、网页爬虫
- ✅ **智能去重**：基于 URL 和内容的自动去重
- ✅ **内容过滤**：关键词、分类、正则表达式过滤
- ✅ **AI 摘要**：支持 Claude/OpenAI API，或规则引擎
- ✅ **精美邮件**：响应式 HTML 模板，可自定义主题
- ✅ **加密存储**：敏感信息（密码、API 密钥）加密保存
- ✅ **定时推送**：Cron 任务自动调度

## 快速开始

### 1. 安装

```bash
cd .claude/skills/news-push
pip install -e .
```

### 2. 初始化配置

```bash
news-push init
```

交互式配置：
- 邮箱和 SMTP 信息
- AI 配置（可选）
- 自动生成加密密钥

### 3. 添加新闻源

```bash
news-push source add
```

支持多种类型：
- **RSS** - 标准 RSS/Atom 订阅源（自动检测）
- **API** - RESTful API（JSON 格式）
- **自定义** - 如知乎热榜等特殊格式

示例：
```bash
news-push source add https://www.python.org/blog/feed/
news-push source add https://www.zhihu.com/api/v3/feed/topstory/hot-list-web
```

### 4. 测试发送

```bash
news-push send test
```

### 5. 查看新闻源

```bash
news-push source list
```

## 命令参考

### 初始化
```bash
news-push init              # 初始化配置
```

### 新闻源管理
```bash
news-push source add        # 添加新闻源
news-push source list       # 列出所有新闻源
news-push source update <id>    # 更新新闻源
news-push source remove <id>    # 删除新闻源
```

### 过滤规则管理
```bash
news-push filter add        # 添加过滤规则
news-push filter list       # 列出所有过滤规则
news-push filter update <id>    # 更新过滤规则
news-push filter remove <id>    # 删除过滤规则
```

### 发送相关
```bash
news-push send run          # 立即执行推送
news-push send test         # 测试抓取（不发送）
news-push send preview      # 预览邮件内容
```

### Cron 任务管理（开发中）
```bash
news-push cron setup        # 设置定时任务
news-push cron list         # 列出定时任务
news-push cron status       # 查看任务状态
```

## 支持的新闻源格式

### RSS/Atom 源
自动检测标准 RSS/Atom 格式：
```bash
news-push source add https://www.python.org/blog/feed/
news-push source add https://planet.python.org/rss20.xml
```

### 知乎热榜
内置知乎热榜 API 支持：
```bash
news-push source add https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20
```

### JSON API
通用 JSON API（自动解析 articles/items/data 字段）：
```bash
news-push source add https://api.example.com/news
```

## 配置文件

### .env
```bash
# 加密密钥（自动生成，请妥善保管）
NEWS_PUSH_ENCRYPTION_KEY=your_base64_encoded_key_here

# 数据库路径（默认 ~/.news_push/news.db）
NEWS_PUSH_DB_PATH=~/.news_push/news.db

# 日志级别（DEBUG/INFO/WARNING/ERROR）
LOG_LEVEL=INFO
```

## 数据库结构

使用 SQLite 存储，包含以下表：

- **users** - 用户配置（邮箱、SMTP、AI 设置）
- **sources** - 新闻源配置
- **filters** - 过滤规则
- **articles** - 抓取的文章
- **sent_history** - 发送历史

默认位置：`~/.news_push/news.db`

## 安全说明

- 所有敏感信息使用 Fernet 对称加密存储
- 加密密钥保存在 `.env` 文件中，请勿泄露
- 建议定期备份数据库和 `.env` 文件

## 开发状态

**当前版本：0.1.0**

### ✅ 已实现
- [x] 数据模型和数据库层
- [x] 加密存储（Fernet）
- [x] CLI 框架和初始化命令
- [x] 新闻抓取模块（RSS/Atom、通用 API、知乎热榜）
- [x] 去重处理器（URL 和标题）
- [x] 邮件发送模块（SMTP）
- [x] HTML 邮件模板
- [x] 完整的管道编排器
- [x] 单元测试

### 🚧 开发中
- [ ] 过滤器 CLI 命令
- [ ] Cron 任务管理
- [ ] AI 摘要功能集成

### 📋 计划中
- [ ] 更多邮件主题
- [ ] Webhook 支持
- [ ] Telegram/微信推送

## 故障排查

### 邮件发送失败
1. 检查 SMTP 配置是否正确
2. 确认 SMTP 密码或应用专用密码
3. 检查网络连接和防火墙

### 抓取失败
1. 使用 `news-push source list` 查看新闻源状态
2. 确认 URL 是否可访问
3. 查看日志文件（如果已配置）

### 加密密钥丢失
- 如丢失 `NEWS_PUSH_ENCRYPTION_KEY`，需要：
  1. 备份数据库（如需保留历史数据）
  2. 重新运行 `news-push init` 生成新密钥
  3. 重新配置用户和新闻源

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.9+ |
| 数据库 | SQLite + SQLAlchemy 2.0 |
| CLI | Click 8.1 + Rich 13.7 |
| 日志 | Loguru 0.7 |
| 加密 | cryptography 41.0 |
| 模板 | Jinja2 3.1 |
| 抓取 | feedparser, requests, BeautifulSoup4 |

## 项目结构

```
news_push/
├── cli/           # CLI 命令
├── core/          # 核心编排器
├── fetchers/      # 新闻抓取器
├── processors/    # 处理器（去重、过滤、摘要）
├── senders/       # 发送器（邮件）
├── storage/       # 数据库层
└── templates/     # 邮件模板
```

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 致谢

感谢所有为这个项目做出贡献的开发者！

---

如有问题或建议，欢迎提交 [Issue](https://github.com/yourusername/news-push-skill/issues)
