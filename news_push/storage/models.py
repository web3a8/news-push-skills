"""
Database models for news push skill.

Uses SQLAlchemy ORM with SQLite backend.
"""

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

Base = declarative_base()


class User(Base):
    """User configuration table."""

    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    wechat_webhook = Column(Text, nullable=True)  # Encrypted
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sources = relationship("Source", back_populates="user", cascade="all, delete-orphan")
    filters = relationship("Filter", back_populates="user", cascade="all, delete-orphan")
    sent_history = relationship("SentHistory", back_populates="user", cascade="all, delete-orphan")


class Source(Base):
    """News source configuration table."""

    __tablename__ = 'sources'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # 'rss', 'twitter', 'webhook'
    url = Column(Text, nullable=True)  # Encrypted
    config = Column(Text, nullable=True)  # JSON encrypted
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sources")


class Filter(Base):
    """Filter rules table."""

    __tablename__ = 'filters'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # 'keyword', 'category', 'author'
    rule = Column(Text, nullable=False)  # JSON: keywords list, category name, etc.
    action = Column(String(20), nullable=False)  # 'include' or 'exclude'
    priority = Column(Integer, nullable=False, default=0)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="filters")


class Article(Base):
    """Articles table."""

    __tablename__ = 'articles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey('sources.id'), nullable=True)
    title = Column(String(500), nullable=False)
    url = Column(Text, nullable=False, unique=True)
    content = Column(Text, nullable=True)  # Encrypted
    author = Column(String(200), nullable=True)
    published_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    hash = Column(String(64), nullable=True)  # For deduplication

    # Relationships
    source = relationship("Source")


class SentHistory(Base):
    """Sent history table."""

    __tablename__ = 'sent_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    article_id = Column(Integer, ForeignKey('articles.id'), nullable=False)
    channel = Column(String(50), nullable=False)  # 'wechat', 'email', etc.
    sent_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    status = Column(String(20), nullable=False)  # 'success', 'failed'
    error_message = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sent_history")
    article = relationship("Article")
