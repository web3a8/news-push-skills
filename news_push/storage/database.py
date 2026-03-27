"""数据库管理器"""

import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError
from loguru import logger

from news_push.storage.models import Base, User, Source, Filter, Article, SentHistory
from news_push.storage.security import SecureStorage


class DatabaseManager:
    """数据库管理器"""

    def __init__(self, db_path: str | None = None):
        """
        初始化数据库管理器

        Args:
            db_path: 数据库文件路径，默认为 ~/.news_push/db.sqlite
        """
        if db_path is None:
            db_path = os.environ.get(
                "NEWS_PUSH_DB_PATH",
                os.path.expanduser("~/.news_push/db.sqlite")
            )

        # 确保目录存在
        db_path = Path(db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)

        # 创建数据库 URL
        self.db_url = f"sqlite:///{db_path}"

        # 创建引擎
        self.engine = create_engine(
            self.db_url,
            echo=False,
            connect_args={"check_same_thread": False}  # SQLite 特有
        )

        # 创建 Session 工厂
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )

        # 初始化加密存储
        self.secure = SecureStorage()

        logger.info(f"数据库初始化完成: {db_path}")

    def create_tables(self):
        """创建所有表"""
        Base.metadata.create_all(bind=self.engine)
        logger.info("数据库表创建完成")

    def get_session(self) -> Session:
        """获取数据库会话"""
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
        ai_model: Optional[str] = None,
    ) -> User:
        """
        创建用户

        Args:
            email: 用户邮箱
            smtp_host: SMTP 服务器
            smtp_port: SMTP 端口
            smtp_username: SMTP 用户名
            smtp_password: SMTP 密码（明文，会自动加密）
            smtp_use_tls: 是否使用 TLS
            ai_provider: AI 提供商
            ai_api_key: AI API Key（明文，会自动加密）
            ai_model: AI 模型

        Returns:
            创建的用户对象
        """
        session = self.get_session()
        try:
            # 检查邮箱是否已存在
            existing = session.query(User).filter(User.email == email).first()
            if existing:
                raise ValueError(f"邮箱 {email} 已存在")

            # 加密敏感信息
            encrypted_password = self.secure.encrypt(smtp_password)
            encrypted_api_key = self.secure.encrypt(ai_api_key) if ai_api_key else None

            user = User(
                email=email,
                smtp_host=smtp_host,
                smtp_port=smtp_port,
                smtp_username=smtp_username,
                smtp_password=encrypted_password,
                smtp_use_tls=smtp_use_tls,
                ai_provider=ai_provider,
                ai_api_key=encrypted_api_key,
                ai_model=ai_model,
            )

            session.add(user)
            session.commit()
            session.refresh(user)

            logger.info(f"用户创建成功: {email}")
            return user

        except IntegrityError as e:
            session.rollback()
            logger.error(f"创建用户失败: {e}")
            raise ValueError(f"邮箱 {email} 已存在")
        except Exception as e:
            session.rollback()
            logger.error(f"创建用户时出错: {e}")
            raise
        finally:
            session.close()

    def get_user(self, email: str) -> Optional[User]:
        """获取用户"""
        session = self.get_session()
        try:
            user = session.query(User).filter(User.email == email).first()
            return user
        finally:
            session.close()

    def cleanup_old_articles(self, days: int = 7):
        """
        清理旧文章

        Args:
            days: 保留天数
        """
        session = self.get_session()
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted = session.query(Article).filter(
                Article.fetched_at < cutoff_date
            ).delete()
            session.commit()
            logger.info(f"清理了 {deleted} 篇旧文章（超过 {days} 天）")
        except Exception as e:
            session.rollback()
            logger.error(f"清理旧文章失败: {e}")
            raise
        finally:
            session.close()

    def cleanup_old_sent_history(self, days: int = 30):
        """
        清理旧的发送历史

        Args:
            days: 保留天数
        """
        session = self.get_session()
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted = session.query(SentHistory).filter(
                SentHistory.sent_at < cutoff_date
            ).delete()
            session.commit()
            logger.info(f"清理了 {deleted} 条旧发送历史（超过 {days} 天）")
        except Exception as e:
            session.rollback()
            logger.error(f"清理旧发送历史失败: {e}")
            raise
        finally:
            session.close()
