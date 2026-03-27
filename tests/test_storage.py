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

        source = Source(
            user_id=user.id,
            name="Test Source",
            url="https://example.com/feed",
            type="rss",
            fetch_interval=60
        )
        session.add(source)
        session.commit()

        # 创建 25 篇文章
        for i in range(25):
            article = Article(
                url=f"https://example.com/article-{i}",
                title=f"Article {i}",
                content=f"Content {i}",
                source_id=source.id,
                fetched_at=datetime.now()
            )
            session.add(article)
        session.commit()
        session.close()

        # 测试分页
        articles_page1 = db.get_articles(limit=20, offset=0)
        assert len(articles_page1) == 20

        articles_page2 = db.get_articles(limit=20, offset=20)
        assert len(articles_page2) == 5

        # 测试排序（按时间倒序）
        assert articles_page1[0].fetched_at >= articles_page1[-1].fetched_at
    finally:
        # 恢复原始环境变量
        if original_key is not None:
            os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = original_key
        else:
            os.environ.pop("NEWS_PUSH_ENCRYPTION_KEY", None)
