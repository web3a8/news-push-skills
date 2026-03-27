# 贡献指南

感谢你有兴趣为新闻推送 Skill 做出贡献！

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议：

1. 在 Issues 中搜索是否已有相关问题
2. 如果没有，创建新 Issue，包含：
   - 清晰的标题
   - 详细的问题描述
   - 复现步骤（针对 bug）
   - 预期行为 vs 实际行为
   - 环境信息（Python 版本、操作系统等）

### 提交代码

1. **Fork 项目**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   git clone https://github.com/yourusername/news-push-skill.git
   cd news-push-skill
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **开发环境设置**
   ```bash
   # 安装依赖
   pip install -e .
   pip install -e ".[dev]"

   # 运行测试
   pytest

   # 代码格式化
   black news_push/
   ruff check news_push/
   ```

4. **提交代码**
   ```bash
   git add .
   git commit -m "type: description"
   # type 可以是: feat, fix, docs, style, refactor, test, chore
   ```

5. **推送到 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写 PR 模板
   - 等待 code review

## 代码规范

### Python 代码风格

- 遵循 PEP 8
- 使用 Black 进行代码格式化
- 使用 Ruff 进行 linting
- 添加类型注解（使用 mypy 检查）
- 编写单元测试（测试覆盖率 > 80%）
- 添加文档字符串（Google 风格）

### 提交信息格式

使用 Conventional Commits 格式：

```
type(scope): description

[optional body]

[optional footer]
```

类型：
- `feat`: 新功能
- `fix`: bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具链相关

示例：
```
feat(fetchers): add support for Reddit RSS feeds

Fixes #123
```

## 开发指南

### 项目结构

```
news_push/
├── cli/           # CLI 命令
├── core/          # 核心编排器
├── fetchers/      # 新闻抓取器
├── processors/    # 处理器（去重、过滤、摘要）
├── senders/       # 发送器（邮件等）
├── storage/       # 数据库层
└── templates/     # 模板文件
```

### 添加新的新闻源

1. 在 `fetchers/` 目录创建新的抓取器类
2. 继承 `BaseFetcher` 或实现 `fetch()` 方法
3. 返回 `List[FetchResult]`
4. 在 `adapter.py` 中添加支持
5. 编写测试用例

### 添加新的处理器

1. 在 `processors/` 目录创建处理器类
2. 实现处理逻辑
3. 在 `pipeline.py` 中集成
4. 编写测试用例

### 添加新的发送渠道

1. 在 `senders/` 目录创建发送器类
2. 实现 `send()` 方法
3. 在 `cli/` 中添加相关命令
4. 编写测试用例

## 测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_fetchers.py

# 查看覆盖率
pytest --cov=news_push --cov-report=html

# 运行特定测试
pytest -k "test_rss_fetcher"
```

## 发布流程

维护者发布新版本时：

1. 更新 `setup.py` 中的版本号
2. 更新 `CHANGELOG.md`
3. 创建 git tag
4. 构建并发布到 PyPI
```bash
python -m build
twine upload dist/*
```

## 行为准则

- 尊重所有贡献者
- 欢迎不同观点和建设性讨论
- 专注于项目本身，保持专业性
- 协作解决问题，而不是指责

## 获取帮助

- 查看 [文档](README.md)
- 搜索 [Issues](../../issues)
- 提问时使用 `question` 标签

---

再次感谢你的贡献！
