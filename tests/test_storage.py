"""测试存储层"""

import pytest
import tempfile
import os
from pathlib import Path

from news_push.storage.database import DatabaseManager
from news_push.storage.models import User, Source
from news_push.storage.security import SecureStorage


@pytest.fixture
def temp_db():
    """临时数据库"""
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
        db_path = f.name
    yield db_path
    os.unlink(db_path)


@pytest.fixture
def db_manager(temp_db):
    """数据库管理器"""
    # 设置测试用的加密密钥
    os.environ["NEWS_PUSH_ENCRYPTION_KEY"] = SecureStorage.generate_key()
    manager = DatabaseManager(temp_db)
    manager.create_tables()
    yield manager
    # 清理环境变量
    if "NEWS_PUSH_ENCRYPTION_KEY" in os.environ:
        del os.environ["NEWS_PUSH_ENCRYPTION_KEY"]


def test_secure_storage_encrypt_decrypt():
    """测试加密解密"""
    # 生成测试密钥
    key = SecureStorage.generate_key()
    secure = SecureStorage(key)

    # 测试加密解密
    plaintext = "my_secret_password"
    encrypted = secure.encrypt(plaintext)
    decrypted = secure.decrypt(encrypted)

    assert encrypted != plaintext
    assert decrypted == plaintext


def test_secure_storage_empty_string():
    """测试空字符串"""
    key = SecureStorage.generate_key()
    secure = SecureStorage(key)

    assert secure.encrypt("") == ""
    assert secure.decrypt("") == ""


def test_database_create_user(db_manager: DatabaseManager):
    """测试创建用户"""
    user = db_manager.create_user(
        email="test@example.com",
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="user",
        smtp_password="pass",
    )

    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.smtp_host == "smtp.example.com"
    assert user.smtp_password != "pass"  # 应该被加密


def test_database_duplicate_user(db_manager: DatabaseManager):
    """测试重复用户"""
    db_manager.create_user(
        email="test@example.com",
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="user",
        smtp_password="pass",
    )

    with pytest.raises(ValueError):
        db_manager.create_user(
            email="test@example.com",
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_username="user",
            smtp_password="pass",
        )


def test_database_get_user(db_manager: DatabaseManager):
    """测试获取用户"""
    created = db_manager.create_user(
        email="test@example.com",
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="user",
        smtp_password="pass",
    )

    retrieved = db_manager.get_user("test@example.com")

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.email == "test@example.com"


def test_database_get_nonexistent_user(db_manager: DatabaseManager):
    """测试获取不存在的用户"""
    user = db_manager.get_user("nonexistent@example.com")
    assert user is None
