"""数据模型定义"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Index
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    smtp_host = Column(String(255), nullable=False)
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String(255), nullable=False)
    smtp_password = Column(String(255), nullable=False)  # encrypted
    smtp_use_tls = Column(Boolean, default=True)
    ai_provider = Column(String(50), nullable=True)
    ai_api_key = Column(String(255), nullable=True)  # encrypted
    ai_model = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    sources = relationship("Source", back_populates="user", cascade="all, delete-orphan")
    filters = relationship("Filter", back_populates="user", cascade="all, delete-orphan")
    sent_history = relationship("SentHistory", back_populates="user", cascade="all, delete-orphan")


class Source(Base):
    """新闻源表"""
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # rss, atom, json_feed
    url = Column(String(512), nullable=False)
    fetch_interval = Column(Integer, default=3600)  # seconds
    is_active = Column(Boolean, default=True)
    last_fetched_at = Column(DateTime, nullable=True)
    fetch_config = Column(Text, nullable=True)  # JSON config for custom fetchers
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sources")
    articles = relationship("Article", back_populates="source", cascade="all, delete-orphan")


class Filter(Base):
    """过滤器表"""
    __tablename__ = "filters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # keyword, regex, ai_classification
    rule = Column(Text, nullable=False)  # JSON or regex pattern
    action = Column(String(50), nullable=False)  # include, exclude, prioritize
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="filters")


class Article(Base):
    """文章表"""
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    title = Column(String(512), nullable=False)
    url = Column(String(1024), unique=True, nullable=False)
    content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    author = Column(String(255), nullable=True)
    published_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    source = relationship("Source", back_populates="articles")
    sent_history = relationship("SentHistory", back_populates="article")


class SentHistory(Base):
    """发送历史表"""
    __tablename__ = "sent_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    email_subject = Column(String(512), nullable=False)

    # Relationships
    user = relationship("User", back_populates="sent_history")
    article = relationship("Article", back_populates="sent_history")
