# 新闻推送 Skill

自动获取新闻热点并推送到邮箱的 Claude Code Skill。

## 功能特性

- ✅ 支持多种新闻源：RSS/Atom、新闻 API（NewsAPI、GNews）、网页爬虫
- ✅ 个性化内容过滤：关键词、分类、正则表达式
- ✅ AI 摘要生成：支持 Claude、OpenAI，或使用规则引擎
- ✅ 精美的 HTML 邮件模板：多种主题可选
- ✅ 自动去重：基于 URL 和标题
- ✅ 灵活的定时任务：支持 cron 调度

## 快速开始

### 1. 初始化配置

```bash
/news init
```

交互式配置：
- 邮箱和 SMTP 信息
- AI 配置（可选）
- 加密密钥生成

### 2. 添加新闻源

```bash
/news source add
```

支持三种类型：
- **RSS** - 标准 RSS/Atom 订阅源
- **API** - NewsAPI、GNews 等
- **爬虫** - 自定义网页爬取规则

### 3. 添加过滤规则（可选）

```bash
/news filter add
```

### 4. 测试抓取

```bash
/news send test
```

### 5. 安装定时任务

```bash
/news cron install
```

## 命令参考

### 初始化
```bash
/news init              # 初始化配置
```

### 新闻源管理
```bash
/news source add        # 添加新闻源
/news source list       # 列出所有新闻源
/news source remove <name>  # 删除新闻源
/news source test <name>    # 测试新闻源
```

### 过滤规则管理
```bash
/news filter add        # 添加过滤规则
/news filter list       # 列出所有过滤规则
/news filter remove <id>    # 删除过滤规则
```

### 发送相关
```bash
/news send test         # 测试抓取（不发送）
/news send now          # 立即发送
/news send preview      # 预览邮件
```

### Cron 任务管理
```bash
/news cron install      # 安装定时任务
/news cron uninstall    # 卸载定时任务
/news cron show         # 显示当前任务
```

## 新闻源配置示例

### RSS 源
```
名称: Python官网
类型: rss
URL: https://www.python.org/blog/feed/
```

### NewsAPI
```
名称: 科技新闻
类型: api
URL: https://newsapi.org/v2/top-headlines
API Key: your_api_key
数据源: tech
```

### 网页爬虫
```
名称: 示例网站
类型: scraper
URL: https://example.com
文章选择器: .article
标题选择器: h2
最大文章数: 20
```

## 过滤规则示例

### 关键词排除
```
类型: keyword
规则: 广告
动作: exclude
```

### 分类包含
```
类型: category
规则: Python
动作: include
```

### 正则表达式
```
类型: regex
规则: \d+\.\d+  # 匹配版本号
动作: include
```

## 配置文件

### .env
```bash
# 加密密钥（自动生成）
NEWS_PUSH_ENCRYPTION_KEY=xxx

# 数据库路径
NEWS_PUSH_DB_PATH=~/.news_push/db.sqlite

# 日志级别
NEWS_PUSH_LOG_LEVEL=INFO
```

### 数据库
- 位置: `~/.news_push/db.sqlite`
- 保留策略:
  - 文章: 7 天
  - 发送历史: 30 天

## 故障排查

### 邮件发送失败
1. 检查 SMTP 配置是否正确
2. 确认 SMTP 密码或应用专用密码
3. 检查网络连接

### 抓取失败
1. 使用 `/news source test <name>` 测试单个新闻源
2. 检查 URL 是否可访问
3. 查看日志: `~/.news_push/logs/`

### Cron 任务不执行
1. 检查 cron 表达式是否正确
2. 确认 Python 路径: `/usr/bin/python3`
3. 查看日志: `/tmp/news_push.log`

## 技术栈

- Python 3.10+
- SQLAlchemy - 数据库 ORM
- Feedparser - RSS 解析
- BeautifulSoup4 - HTML 解析
- Jinja2 - 模板引擎
- Anthropic SDK - Claude API
- Click - CLI 框架
- Loguru - 日志

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！