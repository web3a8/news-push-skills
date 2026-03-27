"""
Tests for storage layer (models, security, database).

Run with: pytest tests/test_storage.py -v
"""

import os
import pytest
import tempfile
from pathlib import Path

from news_push.storage.security import SecureStorage
from news_push.storage.database import DatabaseManager


# Fixtures


@pytest.fixture
def temp_db():
    """Create a temporary database file."""
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    yield path
    # Cleanup
    try:
        os.unlink(path)
    except:
        pass


@pytest.fixture
def test_encryption_key():
    """Generate a test encryption key."""
    return "test-encryption-key-12345"


@pytest.fixture
def db_manager(temp_db, test_encryption_key):
    """Create a DatabaseManager with test database."""
    # Set environment variable for encryption
    os.environ['NEWS_PUSH_ENCRYPTION_KEY'] = test_encryption_key
    manager = DatabaseManager(db_path=temp_db, encryption_key=test_encryption_key)
    yield manager
    # Cleanup
    if 'NEWS_PUSH_ENCRYPTION_KEY' in os.environ:
        del os.environ['NEWS_PUSH_ENCRYPTION_KEY']


# Tests


def test_secure_storage_encrypt_decrypt(test_encryption_key):
    """Test encryption and decryption of a string."""
    storage = SecureStorage(test_encryption_key)
    plaintext = "This is a secret message"
    ciphertext = storage.encrypt(plaintext)
    decrypted = storage.decrypt(ciphertext)

    assert ciphertext != plaintext
    assert decrypted == plaintext


def test_secure_storage_empty_string(test_encryption_key):
    """Test encryption and decryption of empty string."""
    storage = SecureStorage(test_encryption_key)
    plaintext = ""
    ciphertext = storage.encrypt(plaintext)
    decrypted = storage.decrypt(ciphertext)

    assert ciphertext == ""
    assert decrypted == ""


def test_secure_storage_dict(test_encryption_key):
    """Test encryption and decryption of a dictionary."""
    storage = SecureStorage(test_encryption_key)
    data = {
        "api_key": "secret-key-123",
        "token": "abc123xyz",
        "config": {"option1": True, "option2": "value"}
    }
    ciphertext = storage.encrypt_dict(data)
    decrypted = storage.decrypt_dict(ciphertext)

    assert ciphertext != str(data)
    assert decrypted == data


def test_secure_storage_none_error(test_encryption_key):
    """Test that encrypting None raises ValueError."""
    storage = SecureStorage(test_encryption_key)

    with pytest.raises(ValueError, match="Cannot encrypt None value"):
        storage.encrypt(None)


def test_database_create_user(db_manager):
    """Test creating a new user."""
    user = db_manager.create_user(
        name="Test User",
        email="test@example.com",
        wechat_webhook="https://hooks.example.com/webhook",
        enabled=True
    )

    assert user is not None
    assert user.id is not None
    assert user.name == "Test User"
    assert user.email == "test@example.com"
    assert user.wechat_webhook is not None  # Should be encrypted
    assert user.enabled is True


def test_database_duplicate_user(db_manager):
    """Test that creating duplicate user raises IntegrityError."""
    from sqlalchemy.exc import IntegrityError

    # Create first user
    db_manager.create_user(
        name="Test User",
        email="test@example.com"
    )

    # Try to create duplicate
    with pytest.raises(IntegrityError):
        db_manager.create_user(
            name="Another User",
            email="test@example.com"  # Same email
        )


def test_database_get_user(db_manager):
    """Test retrieving a user by ID."""
    # Create user
    created = db_manager.create_user(
        name="Test User",
        email="test@example.com"
    )

    # Get user
    retrieved = db_manager.get_user(created.id)

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.name == "Test User"
    assert retrieved.email == "test@example.com"


def test_database_get_nonexistent_user(db_manager):
    """Test retrieving a non-existent user returns None."""
    user = db_manager.get_user(99999)
    assert user is None


def test_database_get_user_by_email(db_manager):
    """Test retrieving a user by email."""
    # Create user
    created = db_manager.create_user(
        name="Test User",
        email="test@example.com"
    )

    # Get user by email
    retrieved = db_manager.get_user_by_email("test@example.com")

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.email == "test@example.com"


def test_database_list_users(db_manager):
    """Test listing all users."""
    # Create multiple users
    db_manager.create_user(name="User 1", email="user1@example.com")
    db_manager.create_user(name="User 2", email="user2@example.com", enabled=False)
    db_manager.create_user(name="User 3", email="user3@example.com")

    # List all users
    all_users = db_manager.list_users()
    assert len(all_users) == 3

    # List only enabled users
    enabled_users = db_manager.list_users(enabled_only=True)
    assert len(enabled_users) == 2


def test_database_create_source(db_manager):
    """Test creating a news source."""
    # First create a user
    user = db_manager.create_user(
        name="Test User",
        email="test@example.com"
    )

    # Create source
    source = db_manager.create_source(
        user_id=user.id,
        name="Tech News",
        type="rss",
        url="https://example.com/feed.xml",
        config={"update_interval": 3600},
        enabled=True
    )

    assert source is not None
    assert source.id is not None
    assert source.name == "Tech News"
    assert source.type == "rss"
    assert source.url is not None  # Should be encrypted
    assert source.config is not None  # Should be encrypted


def test_database_list_sources(db_manager):
    """Test listing sources for a user."""
    # Create user
    user = db_manager.create_user(
        name="Test User",
        email="test@example.com"
    )

    # Create sources
    db_manager.create_source(user_id=user.id, name="Source 1", type="rss")
    db_manager.create_source(user_id=user.id, name="Source 2", type="twitter", enabled=False)
    db_manager.create_source(user_id=user.id, name="Source 3", type="webhook")

    # List all sources
    all_sources = db_manager.list_sources(user.id)
    assert len(all_sources) == 3

    # List only enabled sources
    enabled_sources = db_manager.list_sources(user.id, enabled_only=True)
    assert len(enabled_sources) == 2


def test_database_create_filter(db_manager):
    """Test creating a filter."""
    # Create user
    user = db_manager.create_user(
        name="Test User",
        email="test@example.com"
    )

    # Create filter
    filter_rule = db_manager.create_filter(
        user_id=user.id,
        name="Tech Keywords",
        type="keyword",
        rule={"keywords": ["AI", "machine learning", "Python"]},
        action="include",
        priority=10,
        enabled=True
    )

    assert filter_rule is not None
    assert filter_rule.id is not None
    assert filter_rule.name == "Tech Keywords"
    assert filter_rule.type == "keyword"
    assert filter_rule.action == "include"
    assert filter_rule.priority == 10


def test_database_create_article(db_manager):
    """Test creating an article."""
    # Create article
    article = db_manager.create_article(
        title="Test Article",
        url="https://example.com/article1",
        content="This is the article content",
        author="Test Author",
        hash="abc123"
    )

    assert article is not None
    assert article.id is not None
    assert article.title == "Test Article"
    assert article.url == "https://example.com/article1"
    assert article.content is not None  # Should be encrypted
    assert article.author == "Test Author"
    assert article.hash == "abc123"


def test_database_create_sent_history(db_manager):
    """Test creating sent history record."""
    # Create user and article
    user = db_manager.create_user(name="Test User", email="test@example.com")
    article = db_manager.create_article(
        title="Test Article",
        url="https://example.com/article1"
    )

    # Create sent history
    sent = db_manager.create_sent_history(
        user_id=user.id,
        article_id=article.id,
        channel="wechat",
        status="success"
    )

    assert sent is not None
    assert sent.id is not None
    assert sent.user_id == user.id
    assert sent.article_id == article.id
    assert sent.channel == "wechat"
    assert sent.status == "success"


def test_database_was_article_sent(db_manager):
    """Test checking if article was sent to user."""
    # Create user and article
    user = db_manager.create_user(name="Test User", email="test@example.com")
    article = db_manager.create_article(
        title="Test Article",
        url="https://example.com/article1"
    )

    # Check before sending
    assert not db_manager.was_article_sent_to_user(user.id, article.id)

    # Send article
    db_manager.create_sent_history(
        user_id=user.id,
        article_id=article.id,
        channel="wechat",
        status="success"
    )

    # Check after sending
    assert db_manager.was_article_sent_to_user(user.id, article.id)


def test_secure_storage_no_key_error():
    """Test that SecureStorage raises error when no key is provided."""
    # Remove environment variable if set
    if 'NEWS_PUSH_ENCRYPTION_KEY' in os.environ:
        del os.environ['NEWS_PUSH_ENCRYPTION_KEY']

    with pytest.raises(ValueError, match="Encryption password not provided"):
        SecureStorage()
