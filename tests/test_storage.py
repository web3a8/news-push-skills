"""测试存储层 - 数据库和加密"""

import os
import tempfile
import pytest
from news_push.storage.security import SecureStorage
from news_push.storage.database import DatabaseManager
from news_push.storage.models import User, Source, Filter, Article, SentHistory


@pytest.fixture
def temp_db():
    """临时数据库fixture"""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.fixture
def db_manager(temp_db):
    """数据库管理器fixture"""
    # 设置测试用加密密钥
    original_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
    test_key = SecureStorage.generate_key()
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = test_key

    manager = DatabaseManager(temp_db)
    manager.create_tables()
    yield manager
    # 清理：删除所有数据
    session = manager.get_session()
    session.query(SentHistory).delete()
    session.query(Article).delete()
    session.query(Filter).delete()
    session.query(Source).delete()
    session.query(User).delete()
    session.commit()
    session.close()

    # 恢复原始环境变量
    if original_key is not None:
        os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
    else:
        os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)


def test_secure_storage_encrypt_decrypt():
    """测试加密解密功能"""
    # 设置临时环境变量
    original_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
    test_key = SecureStorage.generate_key()
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = test_key

    try:
        secure_storage = SecureStorage()
        plaintext = "sensitive_password_123"

        # 加密
        encrypted = secure_storage.encrypt(plaintext)
        assert encrypted != plaintext
        assert len(encrypted) > 0

        # 解密
        decrypted = secure_storage.decrypt(encrypted)
        assert decrypted == plaintext
    finally:
        # 恢复原始环境变量
        if original_key is not None:
            os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
        else:
            os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)


def test_secure_storage_empty_string():
    """测试空字符串加密解密"""
    # 设置临时环境变量
    original_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
    test_key = SecureStorage.generate_key()
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = test_key

    try:
        secure_storage = SecureStorage()

        # 加密空字符串
        encrypted = secure_storage.encrypt("")
        assert encrypted == ""

        # 解密空字符串
        decrypted = secure_storage.decrypt("")
        assert decrypted == ""
    finally:
        # 恢复原始环境变量
        if original_key is not None:
            os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
        else:
            os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)


def test_database_create_user(db_manager: DatabaseManager):
    """测试创建用户"""
    user = db_manager.create_user(
        email="test@example.com",
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_username="user@gmail.com",
        smtp_password="password123",
        smtp_use_tls=True,
        ai_provider="openai",
        ai_api_key="sk-test",
        ai_model="gpt-4"
    )

    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.smtp_host == "smtp.gmail.com"
    assert user.smtp_port == 587
    assert user.smtp_username == "user@gmail.com"
    assert user.smtp_password != "password123"  # 应该被加密
    assert user.smtp_use_tls is True
    assert user.ai_provider == "openai"
    assert user.ai_api_key != "sk-test"  # 应该被加密
    assert user.ai_model == "gpt-4"


def test_database_duplicate_user(db_manager: DatabaseManager):
    """测试重复用户邮箱"""
    # 创建第一个用户
    db_manager.create_user(
        email="duplicate@example.com",
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_username="user1@gmail.com",
        smtp_password="password1"
    )

    # 尝试创建相同邮箱的用户，应该失败
    with pytest.raises(Exception):  # SQLAlchemy会抛出IntegrityError
        db_manager.create_user(
            email="duplicate@example.com",
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_username="user2@gmail.com",
            smtp_password="password2"
        )


def test_database_get_user(db_manager: DatabaseManager):
    """测试获取用户"""
    # 创建用户
    created_user = db_manager.create_user(
        email="gettest@example.com",
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_username="getuser@gmail.com",
        smtp_password="getpass"
    )

    # 获取用户
    retrieved_user = db_manager.get_user("gettest@example.com")

    assert retrieved_user is not None
    assert retrieved_user.id == created_user.id
    assert retrieved_user.email == "gettest@example.com"
    assert retrieved_user.smtp_username == "getuser@gmail.com"


def test_database_get_nonexistent_user(db_manager: DatabaseManager):
    """测试获取不存在的用户"""
    user = db_manager.get_user("nonexistent@example.com")
    assert user is None


def test_get_articles_with_pagination():
    """测试获取文章列表（分页）"""
    from datetime import datetime, timedelta

    # 设置加密密钥
    original_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
    test_key = SecureStorage.generate_key()
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = test_key

    try:
        db = DatabaseManager(":memory:")
        db.create_tables()

        # 创建测试数据（直接使用session）
        session = db.get_session()

        user = User(
            email="test@example.com",
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_username="user",
            smtp_password="encrypted_pass"
        )
        session.add(user)
        session.flush()  # Flush to get user.id

        source = Source(
            user_id=user.id,
            name="Test Source",
            url="https://example.com/feed",
            type="rss",
            fetch_interval=60
        )
        session.add(source)
        session.commit()

        # 创建 25 篇文章，使用不同的时间戳以确保排序稳定
        base_time = datetime.now()
        for i in range(25):
            # 每篇文章时间递减，确保有明确的时间顺序
            article = Article(
                url=f"https://example.com/article-{i}",
                title=f"Article {i}",
                content=f"Content {i}",
                source_id=source.id,
                fetched_at=base_time - timedelta(seconds=i)
            )
            session.add(article)
        session.commit()
        session.close()

        # 测试分页
        articles_page1 = db.get_articles(limit=20, offset=0)
        assert len(articles_page1) == 20

        articles_page2 = db.get_articles(limit=20, offset=20)
        assert len(articles_page2) == 5

        # 测试排序（按时间倒序）- 更严格的验证
        # 验证每个连续的文章都是按时间倒序排列的
        for i in range(len(articles_page1) - 1):
            assert articles_page1[i].fetched_at >= articles_page1[i + 1].fetched_at, \
                f"Article {i} ({articles_page1[i].fetched_at}) should be >= Article {i+1} ({articles_page1[i+1].fetched_at})"

        # 验证第二页也是按时间倒序
        for i in range(len(articles_page2) - 1):
            assert articles_page2[i].fetched_at >= articles_page2[i + 1].fetched_at, \
                f"Page2 Article {i} should be >= Article {i+1}"

        # 验证跨页排序：第一页最后一篇文章应该比第二页第一篇文章晚
        assert articles_page1[-1].fetched_at >= articles_page2[0].fetched_at, \
            "Last article of page1 should be >= first article of page2"
    finally:
        # 恢复原始环境变量
        if original_key is not None:
            os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
        else:
            os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)


def test_get_articles_with_source_filter():
    """测试按来源筛选文章"""
    from datetime import datetime

    # 设置加密密钥
    original_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
    test_key = SecureStorage.generate_key()
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = test_key

    try:
        db = DatabaseManager(":memory:")
        db.create_tables()

        # 创建测试数据（直接使用session）
        session = db.get_session()

        user = User(
            email="test@example.com",
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_username="user",
            smtp_password="encrypted_pass"
        )
        session.add(user)
        session.flush()  # Flush to get user.id

        # 创建两个新闻源
        source1 = Source(
            user_id=user.id,
            name="Source 1",
            url="https://example.com/feed1",
            type="rss",
            fetch_interval=60
        )

        source2 = Source(
            user_id=user.id,
            name="Source 2",
            url="https://example.com/feed2",
            type="rss",
            fetch_interval=60
        )
        session.add(source1)
        session.add(source2)
        session.commit()

        # 保存 source ID，因为关闭 session 后无法访问
        source1_id = source1.id
        source2_id = source2.id

        # 为每个源创建文章
        for i in range(5):
            article = Article(
                url=f"https://example.com/source1-article-{i}",
                title=f"Source1 Article {i}",
                content=f"Content {i}",
                source_id=source1_id,
                fetched_at=datetime.now()
            )
            session.add(article)

        for i in range(3):
            article = Article(
                url=f"https://example.com/source2-article-{i}",
                title=f"Source2 Article {i}",
                content=f"Content {i}",
                source_id=source2_id,
                fetched_at=datetime.now()
            )
            session.add(article)

        session.commit()
        session.close()

        # 测试筛选 source1
        articles_source1 = db.get_articles(source_id=source1_id)
        assert len(articles_source1) == 5, f"Expected 5 articles from source1, got {len(articles_source1)}"
        for article in articles_source1:
            assert article.source_id == source1_id, \
                f"Article {article.url} has source_id {article.source_id}, expected {source1_id}"

        # 测试筛选 source2
        articles_source2 = db.get_articles(source_id=source2_id)
        assert len(articles_source2) == 3, f"Expected 3 articles from source2, got {len(articles_source2)}"
        for article in articles_source2:
            assert article.source_id == source2_id, \
                f"Article {article.url} has source_id {article.source_id}, expected {source2_id}"

        # 测试不筛选时返回所有文章
        all_articles = db.get_articles()
        assert len(all_articles) == 8, f"Expected 8 total articles, got {len(all_articles)}"

    finally:
        # 恢复原始环境变量
        if original_key is not None:
            os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
        else:
            os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)


def test_get_statistics():
    """测试获取统计信息"""
    from datetime import datetime, date

    # 设置加密密钥
    original_key = os.environ.get("NEWS_PUSH_ENCRYPTION_KEY")
    test_key = SecureStorage.generate_key()
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = test_key

    try:
        db = DatabaseManager(":memory:")
        db.create_tables()

        # 创建测试数据
        session = db.get_session()

        user = User(
            email="test@example.com",
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_username="user",
            smtp_password="encrypted_pass"
        )
        session.add(user)
        session.flush()  # Flush to get user.id

        source = Source(
            user_id=user.id,
            name="Test Source",
            url="https://example.com/feed",
            type="rss",
            fetch_interval=60
        )
        session.add(source)
        session.commit()

        # 创建今日文章
        article = Article(
            url="https://example.com/article-today",
            title="Today Article",
            content="Content",
            source_id=source.id,
            fetched_at=datetime.now()
        )
        session.add(article)
        session.commit()
        session.close()

        # 获取统计
        stats = db.get_statistics()

        assert stats["sources_count"] == 1
        assert stats["today_articles"] == 1
        assert stats["total_articles"] == 1
    finally:
        # 恢复原始环境变量
        if original_key is not None:
            os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
        else:
            os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)
