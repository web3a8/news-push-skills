"""pytest 配置"""

import pytest
import tempfile
import os

from news_push.storage.database import DatabaseManager


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
    manager = DatabaseManager(temp_db)
    manager.create_tables()
    yield manager