# News Push Web UI Design

**Date:** 2025-03-27
**Author:** Claude Sonnet 4.6
**Status:** Approved

## Overview

为 news-push skill 添加基于 Web 的管理界面，提供可视化的新闻源配置和文章阅读功能。

**目标：**
- 替代部分 CLI 功能，提供更友好的图形界面
- 支持新闻源管理（CRUD）
- 提供简洁的文章列表阅读体验
- 保持轻量级，易于部署和维护

## Requirements

### Functional Requirements

**FR1: 新闻源管理**
- 添加新闻源（支持 RSS/API/自定义 URL）
- 查看新闻源列表
- 编辑新闻源配置
- 删除新闻源
- 自动检测新闻源类型

**FR2: 文章阅读**
- 查看文章列表（标题、摘要、来源、时间）
- 分页显示（每页 20 条）
- 按来源筛选文章
- 查看文章详情
- 打开原文链接

**FR3: 系统设置**
- 查看 SMTP 配置
- 更新 SMTP 配置（加密存储）
- 查看 AI 配置
- 更新 AI 配置（加密存储）

**FR4: 统计信息**
- 显示新闻源总数
- 显示今日文章数
- 显示历史文章总数

### Non-Functional Requirements

**NFR1: 技术栈**
- 后端：Flask 3.0+
- 前端：Jinja2 模板 + 原生 JavaScript
- 样式：自定义 CSS（保持简洁）
- 数据库：复用现有 SQLite + SQLAlchemy

**NFR2: 部署**
- 本地运行：localhost:5000（默认）
- CLI 集成：`news-push web` 命令启动
- 可选：自定义端口和主机
- 单用户应用，无需认证

**NFR3: 性能**
- 页面响应时间 < 500ms
- 支持分页，避免一次加载过多数据
- 数据库查询优化

**NFR4: 安全**
- 敏感信息加密存储（SMTP 密码、API 密钥）
- 输入验证防止 XSS
- CSRF 防护（表单 token）
- 默认仅监听 localhost

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户浏览器                           │
│                  http://localhost:5000                  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP 请求
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Flask Web 应用                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Sources  │  │ Articles │  │Settings  │  │  Home  │  │
│  │  蓝图    │  │  蓝图    │  │  蓝图    │  │  蓝图  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
└───────┼─────────────┼─────────────┼────────────┼────────┘
        │             │             │            │
        └─────────────┴─────────────┴────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  共享 Storage 层  │
                    │  DatabaseManager │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  SQLite 数据库   │
                    └─────────────────┘
```

### 模块划分

**Web 模块（`news_push/web/`）**
- `app.py` - Flask 应用工厂
- `routes/` - 路由模块（蓝图）
- `templates/` - Jinja2 模板
- `static/` - CSS/JS 静态资源

**CLI 集成（`news_push/cli/web.py`）**
- 新增 `web` 命令
- 支持参数：`--port`, `--host`, `--debug`

**Storage 层（复用现有）**
- `DatabaseManager` - 数据库操作
- `SecureStorage` - 加密存储
- Models - 数据模型

## Routes Design

### 基础路由

| 方法 | 路径 | 功能 | 模板 |
|------|------|------|------|
| GET | `/` | 首页（统计信息） | `index.html` |
| GET | `/sources` | 新闻源列表 | `sources/list.html` |
| GET | `/sources/add` | 添加新闻源表单 | `sources/form.html` |
| POST | `/sources/add` | 提交添加 | - |
| GET | `/sources/<id>/edit` | 编辑新闻源 | `sources/edit.html` |
| POST | `/sources/<id>/edit` | 提交编辑 | - |
| POST | `/sources/<id>/delete` | 删除新闻源 | - |
| GET | `/articles` | 文章列表 | `articles/list.html` |
| GET | `/articles/<id>` | 文章详情 | `articles/detail.html` |
| GET | `/settings` | 系统设置 | `settings/form.html` |
| POST | `/settings` | 保存设置 | - |

### 文章列表查询参数

- `?source_id=<id>` - 按来源筛选
- `?page=<n>` - 分页（默认 1）

## Page Layouts

### 基础布局

```
┌─────────────────────────────────────────┐
│  Header: Logo + 导航菜单                  │
├─────────────────────────────────────────┤
│                                         │
│  Main Content (动态内容)                 │
│                                         │
├─────────────────────────────────────────┤
│  Footer: © 2025 News Push                │
└─────────────────────────────────────────┘
```

### 导航菜单

```
🏠 首页  |  📰 文章  |  📡 新闻源  |  ⚙️ 设置
```

### 首页内容

- 欢迎信息
- 统计卡片（3 列）：
  - 新闻源数量
  - 今日文章数
  - 总文章数
- 快速操作按钮：
  - [添加新闻源]
  - [刷新文章]

### 文章列表页

**左侧边栏（可选）：**
- 筛选器：按来源筛选
- [全部] [来源A] [来源B] ...

**主列表：**
- 每条文章显示：
  - 标题
  - 摘要（截取 100 字）
  - 来源标签
  - 时间戳
  - [打开原文] 按钮
- 分页导航

### 文章详情页

- 标题（h1）
- 元信息：来源 | 时间
- 摘要/内容
- 大按钮：[打开原文 ↗]

### 新闻源列表页

- 表格显示：
  - 名称
  - 类型（RSS/API/自定义）
  - URL
  - 更新频率
  - 操作（编辑 | 删除）
- [添加新闻源] 按钮

## Database Integration

### 复用现有 Storage 层

```python
from news_push.storage.database import DatabaseManager

db = DatabaseManager()

# 获取所有新闻源
sources = db.get_sources()

# 创建新闻源
db.create_source(name, url, source_type, update_interval)

# 更新新闻源
db.update_source(source_id, **kwargs)

# 删除新闻源
db.delete_source(source_id)

# 获取文章（分页）
articles = db.get_articles(limit=20, offset=0, source_id=None)

# 获取用户配置
user = db.get_user(user_id=1)
```

### 需要新增的方法

**注意：** 以下方法需要在 `DatabaseManager` 中新增（当前不存在）

**DatabaseManager 扩展：**

```python
from typing import List, Optional
from sqlalchemy import func, desc
from datetime import date

def get_articles(self, limit: int = 20, offset: int = 0,
                 source_id: Optional[int] = None) -> List[Article]:
    """
    获取文章列表，支持分页和筛选

    Args:
        limit: 每页数量
        offset: 偏移量
        source_id: 来源ID筛选（可选）

    Returns:
        文章列表
    """
    session = self.get_session()
    query = session.query(Article)

    if source_id:
        query = query.filter(Article.source_id == source_id)

    articles = query.order_by(desc(Article.published_at))\
                    .offset(offset)\
                    .limit(limit)\
                    .all()
    session.close()
    return articles

def get_statistics(self) -> dict:
    """
    获取统计信息

    Returns:
        包含 sources_count, today_articles, total_articles 的字典
    """
    session = self.get_session()

    stats = {
        "sources_count": session.query(Source).count(),
        "today_articles": session.query(Article)
            .filter(func.date(Article.fetched_at) == date.today())
            .count(),
        "total_articles": session.query(Article).count(),
    }
    session.close()
    return stats
```

## Security

### 输入验证

- URL 格式验证（正则表达式）
- 必填字段检查
- 使用 WTForms 或手动验证

### 敏感数据保护

- 复用 `SecureStorage` 加密机制
- SMTP 密码、API 密钥加密存储
- .env 文件不提交到 Git

### 访问控制

- 默认监听 `127.0.0.1`（仅本地访问）
- 外部访问需用户明确指定 `--host 0.0.0.0`
- 未来可选：简单密码保护

### CSRF 防护

- 使用 Flask-WTF 的 CSRF token
- 所有 POST 请求验证 token

## File Structure

```
news_push/
├── web/                           # 新增 Web 模块
│   ├── __init__.py               # Flask app 工厂
│   ├── routes/                   # 路由蓝图
│   │   ├── __init__.py
│   │   ├── sources.py            # 新闻源路由
│   │   ├── articles.py           # 文章路由
│   │   ├── settings.py           # 设置路由
│   │   └── home.py               # 首页路由
│   ├── templates/                # Jinja2 模板
│   │   ├── base.html             # 基础模板
│   │   ├── index.html            # 首页
│   │   ├── sources/              # 新闻源模板
│   │   │   ├── list.html
│   │   │   ├── form.html
│   │   │   └── edit.html
│   │   ├── articles/             # 文章模板
│   │   │   ├── list.html
│   │   │   └── detail.html
│   │   └── settings/             # 设置模板
│   │       └── form.html
│   └── static/                   # 静态资源
│       ├── css/
│       │   └── style.css         # 主样式
│       └── js/
│           └── main.js           # 前端交互
├── cli/
│   └── web.py                    # 新增：CLI web 命令
├── storage/                      # 复用现有
│   ├── database.py               # 扩展方法
│   └── security.py               # 复用加密
└── main.py                       # 注册 web 命令
```

## Dependencies

**新增依赖：**
```txt
Flask>=3.0.0
WTForms>=3.1.0              # 表单验证（可选）
Flask-WTF>=1.2.0            # CSRF 防护（可选）
```

## Error Handling

### 表单验证错误

- 字段级错误提示
- 高亮错误字段
- 友好的错误消息

### 数据库错误

- 捕获唯一性冲突（重复 URL）
- 捕获连接错误
- 显示通用错误页面（不暴露敏感信息）

### HTTP 错误页面

- 404：自定义页面 + 返回首页链接
- 500：错误信息 + 联系支持

### 用户反馈

- 成功操作：绿色 flash 消息
- 错误信息：红色 flash 消息
- 加载状态：按钮禁用 + "处理中..."

## Testing Strategy

### 单元测试

- 路由测试：验证 HTTP 响应状态码
- 表单验证测试：测试输入验证逻辑
- 数据库交互测试：使用内存数据库

### 集成测试

- 完整 CRUD 流程测试
- 分页功能测试
- 筛选功能测试

### 手动测试清单

- [ ] 启动 Web 服务
- [ ] 访问首页，查看统计信息
- [ ] 添加新闻源，验证列表显示
- [ ] 编辑新闻源，验证更新成功
- [ ] 删除新闻源，验证确认删除
- [ ] 查看文章列表，测试分页
- [ ] 按来源筛选文章
- [ ] 查看文章详情，点击原文链接
- [ ] 修改系统设置，验证加密存储

## CLI Integration

### 命令接口

```bash
# 启动 Web 服务
news-push web

# 可选参数
news-push web --port 5000      # 自定义端口
news-push web --host 0.0.0.0   # 允许外部访问
news-push web --debug          # 开发模式（自动重载）
```

### 实现示例

```python
# news_push/cli/web.py
import click
from news_push.web.app import create_app

@click.command()
@click.option('--port', default=5000, help='端口号')
@click.option('--host', default='127.0.0.1', help='主机地址')
@click.option('--debug', is_flag=True, help='调试模式')
def web_command(port, host, debug):
    """启动 Web 管理界面"""
    app = create_app()
    url = f"http://{host}:{port}"
    click.echo(f"🚀 Web UI 启动成功: {url}")
    click.echo("按 Ctrl+C 停止服务")
    app.run(host=host, port=port, debug=debug)
```

## Development Phases

### Phase 1: 基础框架
- [ ] 创建 Flask 应用结构
- [ ] 实现基础模板（base.html）和导航
- [ ] 实现首页（统计信息）
- [ ] CLI 集成（`news-push web` 命令）

### Phase 2: 新闻源管理
- [ ] 新闻源列表页
- [ ] 添加新闻源表单
- [ ] 编辑新闻源功能
- [ ] 删除新闻源功能（带确认）
- [ ] 表单验证

### Phase 3: 文章阅读
- [ ] 文章列表页（分页）
- [ ] 按来源筛选功能
- [ ] 文章详情页
- [ ] 打开原文链接

### Phase 4: 系统设置
- [ ] 设置表单
- [ ] 保存配置（复用加密）
- [ ] 显示当前配置

### Phase 5: 测试和优化
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] UI 样式优化
- [ ] 性能优化
- [ ] 更新 README 文档

## Future Enhancements (Out of Scope)

- [ ] 多用户支持和认证
- [ ] 过滤规则管理（Web UI）
- [ ] 标记已读/未读功能
- [ ] 收藏功能
- [ ] 手动触发抓取（Web UI）
- [ ] Cron 任务管理（Web UI）
- [ ] 更多主题/自定义样式
- [ ] 移动端响应式设计
- [ ] Docker 部署支持

## Success Criteria

- [ ] 可以通过 `news-push web` 启动 Web 服务
- [ ] 可以通过 Web 界面管理新闻源（CRUD）
- [ ] 可以通过 Web 界面浏览文章列表
- [ ] 可以筛选和分页查看文章
- [ ] 可以通过 Web 界面修改系统设置
- [ ] 所有敏感信息正确加密存储
- [ ] 测试覆盖率 > 70%
- [ ] README 更新完成
