# 新闻推送 Skill

## 概述

新闻推送系统是一个自动化工具，可以定期获取RSS/Atom新闻源，应用过滤规则，并通过邮件发送定制化的新闻摘要到您的邮箱。

## 主要功能

- **新闻源管理**: 支持RSS、Atom、JSON Feed等多种新闻源格式
- **智能过滤**: 支持关键词、正则表达式、AI分类等多种过滤方式
- **邮件推送**: 自动生成HTML邮件，支持模板定制
- **定时任务**: 灵活的cron定时任务配置
- **加密存储**: 敏感信息（密码、API密钥）加密存储

## 安装

```bash
cd .claude/skills/news-push
pip install -e .
```

## 快速开始

### 1. 初始化配置

```bash
news-push init
```

该命令会：
- 生成加密密钥
- 创建配置文件 `.env`
- 配置邮箱服务（SMTP）
- 配置AI服务（可选）
- 创建数据库和用户

### 2. 添加新闻源

```bash
news-push source add
```

支持添加RSS、Atom、JSON Feed等格式的新闻源。

### 3. 添加过滤器

```bash
news-push filter add
```

支持关键词、正则表达式、AI分类等过滤方式。

### 4. 手动发送测试

```bash
news-push send run
```

立即执行一次新闻获取和发送。

### 5. 设置定时任务

```bash
news-push cron setup
```

配置自动定时推送任务。

## 命令参考

### 全局选项

```bash
news-push --version    # 显示版本信息
news-push --help       # 显示帮助信息
```

### init - 初始化

```bash
news-push init
```

### source - 新闻源管理

```bash
news-push source add              # 添加新闻源
news-push source list             # 列出所有新闻源
news-push source update <id>      # 更新新闻源
news-push source remove <id>      # 删除新闻源
news-push source test <id>        # 测试新闻源连接
```

### filter - 过滤器管理

```bash
news-push filter add              # 添加过滤器
news-push filter list             # 列出所有过滤器
news-push filter update <id>      # 更新过滤器
news-push filter remove <id>      # 删除过滤器
news-push filter test <id>        # 测试过滤器规则
```

### send - 发送管理

```bash
news-push send run                # 立即执行新闻推送
news-push send preview            # 预览即将发送的内容
news-push send history [--limit N] # 查看发送历史
news-push send test               # 发送测试邮件
```

### cron - 定时任务

```bash
news-push cron setup              # 设置定时任务
news-push cron list               # 列出定时任务
news-push cron status             # 查看定时任务状态
news-push cron remove             # 移除定时任务
```

## 配置文件

### .env 配置项

```bash
# 加密密钥（自动生成）
NEWS_PUSH_ENCRYPTION_KEY=your_encryption_key_here

# 数据库路径
NEWS_PUSH_DB_PATH=news_push.db

# 日志级别
LOG_LEVEL=INFO
```

## 数据库结构

- **users**: 用户配置（邮箱、SMTP、AI配置）
- **sources**: 新闻源配置（URL、类型、抓取间隔）
- **filters**: 过滤器规则（类型、规则、动作）
- **articles**: 抓取的文章（标题、内容、URL）
- **sent_history**: 发送历史记录

## 安全说明

- 所有敏感信息（SMTP密码、API密钥）都使用Fernet加密存储
- 加密密钥保存在 `.env` 文件中，请妥善保管
- 建议定期备份数据库和配置文件

## 开发状态

**当前版本**: 0.1.0

**已实现**:
- [x] 数据模型和数据库层
- [x] 加密存储
- [x] CLI框架和初始化命令

**开发中**:
- [ ] 新闻源抓取模块
- [ ] 过滤器引擎
- [ ] 邮件发送模块
- [ ] 定时任务管理
- [ ] AI分类和摘要

## 依赖

- SQLAlchemy 2.0+
- Click 8.1+
- Rich 13.7+
- cryptography 41.0+
- feedparser 6.0+
- requests 2.31+
- beautifulsoup4 4.12+
- playwright 1.40+
- jinja2 3.1+

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
