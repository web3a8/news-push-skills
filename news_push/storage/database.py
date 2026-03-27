"""
Database manager for news push skill.

Handles database connections, session management, and high-level operations.
"""

import os
from pathlib import Path
from typing import Optional, List
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError

from .models import Base, User, Source, Filter, Article, SentHistory
from .security import SecureStorage


class DatabaseManager:
    """Database manager with session management and encryption."""

    def __init__(self, db_path: str = None, encryption_key: str = None):
        """
        Initialize database manager.

        Args:
            db_path: Path to SQLite database file. If None, uses default path.
            encryption_key: Optional encryption key. If None, will read from environment
                          when needed for encryption operations.
        """
        if db_path is None:
            # Default to data directory in user's home
            data_dir = Path.home() / '.news-push-skill'
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / 'news_push.db')

        self.db_path = db_path
        self.encryption_key = encryption_key

        # Create engine
        self.engine = create_engine(f'sqlite:///{db_path}', echo=False)

        # Create tables
        Base.metadata.create_all(self.engine)

        # Create session factory
        self.SessionLocal = sessionmaker(bind=self.engine)

        # Lazy initialization of SecureStorage
        self._secure_storage = None

    @property
    def secure_storage(self) -> SecureStorage:
        """
        Get SecureStorage instance, initializing lazily.

        Returns:
            SecureStorage instance

        Raises:
            ValueError: If encryption key is not available
        """
        if self._secure_storage is None:
            key = self.encryption_key or os.environ.get('NEWS_PUSH_ENCRYPTION_KEY')
            if not key:
                raise ValueError(
                    "Encryption key required. Set NEWS_PUSH_ENCRYPTION_KEY environment variable "
                    "or pass encryption_key to DatabaseManager."
                )
            self._secure_storage = SecureStorage(key)
        return self._secure_storage

    def get_session(self) -> Session:
        """
        Get a new database session.

        Returns:
            SQLAlchemy session
        """
        return self.SessionLocal()

    def create_user(
        self,
        name: str,
        email: str,
        wechat_webhook: str = None,
        enabled: bool = True
    ) -> User:
        """
        Create a new user.

        Args:
            name: User's name
            email: User's email
            wechat_webhook: WeChat webhook URL (will be encrypted)
            enabled: Whether user is enabled

        Returns:
            Created User object

        Raises:
            IntegrityError: If user with same email already exists
        """
        session = self.get_session()
        try:
            # Encrypt webhook if provided
            encrypted_webhook = None
            if wechat_webhook:
                encrypted_webhook = self.secure_storage.encrypt(wechat_webhook)

            user = User(
                name=name,
                email=email,
                wechat_webhook=encrypted_webhook,
                enabled=enabled
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user
        except IntegrityError:
            session.rollback()
            raise
        finally:
            session.close()

    def get_user(self, user_id: int) -> Optional[User]:
        """
        Get user by ID.

        Args:
            user_id: User ID

        Returns:
            User object or None if not found
        """
        session = self.get_session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            return user
        finally:
            session.close()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email.

        Args:
            email: User email

        Returns:
            User object or None if not found
        """
        session = self.get_session()
        try:
            user = session.query(User).filter(User.email == email).first()
            return user
        finally:
            session.close()

    def list_users(self, enabled_only: bool = False) -> List[User]:
        """
        List all users.

        Args:
            enabled_only: If True, only return enabled users

        Returns:
            List of User objects
        """
        session = self.get_session()
        try:
            query = session.query(User)
            if enabled_only:
                query = query.filter(User.enabled == True)
            return query.all()
        finally:
            session.close()

    def create_source(
        self,
        user_id: int,
        name: str,
        type: str,
        url: str = None,
        config: dict = None,
        enabled: bool = True
    ) -> Source:
        """
        Create a new news source for a user.

        Args:
            user_id: User ID
            name: Source name
            type: Source type ('rss', 'twitter', 'webhook')
            url: Source URL (will be encrypted)
            config: Additional configuration as dict (will be encrypted as JSON)
            enabled: Whether source is enabled

        Returns:
            Created Source object

        Raises:
            IntegrityError: If user doesn't exist
        """
        session = self.get_session()
        try:
            # Encrypt url and config if provided
            encrypted_url = None
            encrypted_config = None
            if url:
                encrypted_url = self.secure_storage.encrypt(url)
            if config:
                encrypted_config = self.secure_storage.encrypt_dict(config)

            source = Source(
                user_id=user_id,
                name=name,
                type=type,
                url=encrypted_url,
                config=encrypted_config,
                enabled=enabled
            )
            session.add(source)
            session.commit()
            session.refresh(source)
            return source
        except IntegrityError:
            session.rollback()
            raise
        finally:
            session.close()

    def get_source(self, source_id: int) -> Optional[Source]:
        """
        Get source by ID.

        Args:
            source_id: Source ID

        Returns:
            Source object or None if not found
        """
        session = self.get_session()
        try:
            source = session.query(Source).filter(Source.id == source_id).first()
            return source
        finally:
            session.close()

    def list_sources(self, user_id: int, enabled_only: bool = False) -> List[Source]:
        """
        List sources for a user.

        Args:
            user_id: User ID
            enabled_only: If True, only return enabled sources

        Returns:
            List of Source objects
        """
        session = self.get_session()
        try:
            query = session.query(Source).filter(Source.user_id == user_id)
            if enabled_only:
                query = query.filter(Source.enabled == True)
            return query.all()
        finally:
            session.close()

    def create_filter(
        self,
        user_id: int,
        name: str,
        type: str,
        rule: dict,
        action: str,
        priority: int = 0,
        enabled: bool = True
    ) -> Filter:
        """
        Create a new filter for a user.

        Args:
            user_id: User ID
            name: Filter name
            type: Filter type ('keyword', 'category', 'author')
            rule: Filter rule as dict
            action: Filter action ('include' or 'exclude')
            priority: Filter priority (higher = first)
            enabled: Whether filter is enabled

        Returns:
            Created Filter object

        Raises:
            IntegrityError: If user doesn't exist
        """
        import json
        session = self.get_session()
        try:
            filter_rule = Filter(
                user_id=user_id,
                name=name,
                type=type,
                rule=json.dumps(rule),
                action=action,
                priority=priority,
                enabled=enabled
            )
            session.add(filter_rule)
            session.commit()
            session.refresh(filter_rule)
            return filter_rule
        except IntegrityError:
            session.rollback()
            raise
        finally:
            session.close()

    def create_article(
        self,
        title: str,
        url: str,
        source_id: int = None,
        content: str = None,
        author: str = None,
        published_at = None,
        hash: str = None
    ) -> Article:
        """
        Create a new article.

        Args:
            title: Article title
            url: Article URL
            source_id: Source ID (optional)
            content: Article content (will be encrypted)
            author: Article author
            published_at: Publication date
            hash: Article hash for deduplication

        Returns:
            Created Article object

        Raises:
            IntegrityError: If article with same URL already exists
        """
        session = self.get_session()
        try:
            # Encrypt content if provided
            encrypted_content = None
            if content:
                encrypted_content = self.secure_storage.encrypt(content)

            article = Article(
                source_id=source_id,
                title=title,
                url=url,
                content=encrypted_content,
                author=author,
                published_at=published_at,
                hash=hash
            )
            session.add(article)
            session.commit()
            session.refresh(article)
            return article
        except IntegrityError:
            session.rollback()
            raise
        finally:
            session.close()

    def get_article(self, article_id: int) -> Optional[Article]:
        """
        Get article by ID.

        Args:
            article_id: Article ID

        Returns:
            Article object or None if not found
        """
        session = self.get_session()
        try:
            article = session.query(Article).filter(Article.id == article_id).first()
            return article
        finally:
            session.close()

    def create_sent_history(
        self,
        user_id: int,
        article_id: int,
        channel: str,
        status: str,
        error_message: str = None
    ) -> SentHistory:
        """
        Create a sent history record.

        Args:
            user_id: User ID
            article_id: Article ID
            channel: Channel used ('wechat', 'email', etc.)
            status: Send status ('success', 'failed')
            error_message: Error message if failed

        Returns:
            Created SentHistory object

        Raises:
            IntegrityError: If user or article doesn't exist
        """
        session = self.get_session()
        try:
            sent_history = SentHistory(
                user_id=user_id,
                article_id=article_id,
                channel=channel,
                status=status,
                error_message=error_message
            )
            session.add(sent_history)
            session.commit()
            session.refresh(sent_history)
            return sent_history
        except IntegrityError:
            session.rollback()
            raise
        finally:
            session.close()

    def was_article_sent_to_user(self, user_id: int, article_id: int) -> bool:
        """
        Check if article was already sent to user.

        Args:
            user_id: User ID
            article_id: Article ID

        Returns:
            True if article was sent, False otherwise
        """
        session = self.get_session()
        try:
            count = session.query(SentHistory).filter(
                SentHistory.user_id == user_id,
                SentHistory.article_id == article_id,
                SentHistory.status == 'success'
            ).count()
            return count > 0
        finally:
            session.close()
