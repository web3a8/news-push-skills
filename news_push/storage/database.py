"""数据库管理 - 连接和会话管理"""

import os
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from news_push.storage.models import Base, User, Source, Filter, Article, SentHistory
from news_push.storage.security import SecureStorage


class DatabaseManager:
    """数据库管理器"""

    def __init__(self, db_path: str | None = None):
        """
        初始化数据库管理器

        Args:
            db_path: 数据库文件路径。如果为None，使用环境变量NEWS_PUSH_DB_PATH或默认值
        """
        if db_path is None:
            db_path = os.getenv("NEWS_PUSH_DB_PATH", "news_push.db")

        # 确保目录存在
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)

        self.engine = create_engine(f"sqlite:///{db_path}")
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def create_tables(self):
        """创建所有表"""
        Base.metadata.create_all(bind=self.engine)

    def get_session(self) -> Session:
        """
        获取数据库会话

        Returns:
            SQLAlchemy Session对象
        """
        return self.SessionLocal()

    def create_user(
        self,
        email: str,
        smtp_host: str,
        smtp_port: int,
        smtp_username: str,
        smtp_password: str,
        smtp_use_tls: bool = True,
        ai_provider: Optional[str] = None,
        ai_api_key: Optional[str] = None,
        ai_model: Optional[str] = None
    ) -> User:
        """
        创建新用户

        Args:
            email: 用户邮箱（唯一标识）
            smtp_host: SMTP服务器地址
            smtp_port: SMTP端口
            smtp_username: SMTP用户名
            smtp_password: SMTP密码（会加密存储）
            smtp_use_tls: 是否使用TLS
            ai_provider: AI服务提供商
            ai_api_key: AI API密钥（会加密存储）
            ai_model: AI模型名称

        Returns:
            创建的User对象
        """
        secure_storage = SecureStorage()

        user = User(
            email=email,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_username=smtp_username,
            smtp_password=secure_storage.encrypt(smtp_password),
            smtp_use_tls=smtp_use_tls,
            ai_provider=ai_provider,
            ai_api_key=secure_storage.encrypt(ai_api_key) if ai_api_key else None,
            ai_model=ai_model
        )

        session = self.get_session()
        try:
            session.add(user)
            session.commit()
            session.refresh(user)
            return user
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_user(self, email: str) -> Optional[User]:
        """
        根据邮箱获取用户

        Args:
            email: 用户邮箱

        Returns:
            User对象或None
        """
        session = self.get_session()
        try:
            return session.query(User).filter(User.email == email).first()
        finally:
            session.close()

    def cleanup_old_articles(self, days: int = 7):
        """
        清理旧文章

        Args:
            days: 保留天数，默认7天
        """
        session = self.get_session()
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            session.query(Article).filter(
                Article.fetched_at < cutoff_date
            ).delete()
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def cleanup_old_sent_history(self, days: int = 30):
        """
        清理旧的发送历史

        Args:
            days: 保留天数，默认30天
        """
        session = self.get_session()
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            session.query(SentHistory).filter(
                SentHistory.sent_at < cutoff_date
            ).delete()
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
