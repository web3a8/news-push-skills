"""Base fetcher module."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional
from urllib.parse import urlparse


class SourceType(Enum):
    """News source type."""

    RSS = "rss"
    API = "api"
    SCRAPER = "scraper"


@dataclass
class NewsItem:
    """Represents a single news item.

    Attributes:
        title: News article title
        url: URL to the full article
        description: Short description or summary
        author: Article author
        published_at: Publication datetime
        source_url: URL of the source (RSS feed, API endpoint, etc.)
    """

    title: str
    url: str
    description: str = ""
    author: str = ""
    published_at: Optional[datetime] = None
    source_url: str = ""


@dataclass
class FetchResult:
    """Result of a fetch operation.

    Attributes:
        items: List of fetched news items
        source: Source URL or identifier
        source_type: Type of source
        fetched_at: Timestamp of fetch
        error: Error message if fetch failed
    """

    items: List[NewsItem]
    source: str
    source_type: SourceType
    fetched_at: datetime
    error: Optional[str] = None


class BaseFetcher(ABC):
    """Base class for news fetchers.

    Provides common functionality for all fetcher implementations.
    """

    def __init__(self, source: str):
        """Initialize fetcher.

        Args:
            source: Source URL or identifier
        """
        self.source = source
        self.validate_url()

    @abstractmethod
    def fetch(self) -> FetchResult:
        """Fetch news from source.

        Returns:
            FetchResult containing items and metadata
        """
        pass

    def validate_url(self) -> None:
        """Validate source URL.

        Raises:
            ValueError: If URL is invalid
        """
        try:
            result = urlparse(self.source)
            if not all([result.scheme, result.netloc]):
                raise ValueError(f"Invalid URL: {self.source}")
        except Exception as e:
            raise ValueError(f"Invalid URL: {self.source}") from e
