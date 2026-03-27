"""API fetcher module."""

from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urlencode

import requests
from loguru import logger

from news_push.fetchers.base import BaseFetcher, FetchResult, NewsItem, SourceType


class APIFetcher(BaseFetcher):
    """Fetch news from news APIs.

    Supports multiple news API providers:
    - NewsAPI: https://newsapi.org/
    - GNews: https://gnews.io/
    """

    def __init__(self, source: str, provider: str = "newsapi", api_key: Optional[str] = None):
        """Initialize API fetcher.

        Args:
            source: Search query or topic
            provider: API provider ('newsapi' or 'gnews')
            api_key: API key for the provider

        Raises:
            ValueError: If API key is not provided
        """
        # Don't call super().__init__() because APIFetcher uses a search query, not a URL
        # But we still need to set the source attribute
        super().__init__(source="https://api.example.com")  # Dummy URL for validation
        self.source = source
        self.provider = provider.lower()
        self.api_key = api_key

        if not self.api_key:
            raise ValueError(f"API key required for {self.provider}")

    def fetch(self) -> FetchResult:
        """Fetch news from API.

        Returns:
            FetchResult containing items and metadata
        """
        logger.info(f"Starting API fetch from {self.provider} for query: {self.source}")
        if self.provider == "newsapi":
            return self._fetch_newsapi()
        elif self.provider == "gnews":
            return self._fetch_gnews()
        else:
            logger.error(f"Unknown provider: {self.provider}")
            return FetchResult(
                items=[],
                source=self.source,
                source_type=SourceType.API,
                fetched_at=datetime.now(),
                error=f"Unknown provider: {self.provider}",
            )

    def _fetch_newsapi(self) -> FetchResult:
        """Fetch from NewsAPI.

        Returns:
            FetchResult with items or error
        """
        logger.info(f"Fetching from NewsAPI with query: {self.source}")
        base_url = "https://newsapi.org/v2/everything"
        params = {
            "q": self.source,
            "apiKey": self.api_key,
            "sortBy": "publishedAt",
            "language": "en",
        }

        try:
            response = requests.get(base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get("status") != "ok":
                error = data.get("message", "Unknown error")
                logger.error(f"NewsAPI error: {error}")
                return FetchResult(
                    items=[],
                    source=self.source,
                    source_type=SourceType.API,
                    fetched_at=datetime.now(),
                    error=error,
                )

            items: List[NewsItem] = []
            for article in data.get("articles", []):
                item = NewsItem(
                    title=article.get("title", ""),
                    url=article.get("url", ""),
                    description=article.get("description", ""),
                    author=article.get("author", ""),
                    published_at=self._parse_datetime(article.get("publishedAt")),
                    source_url=self.source,
                )
                items.append(item)

            logger.success(f"Successfully fetched {len(items)} items from NewsAPI")
            return FetchResult(
                items=items,
                source=self.source,
                source_type=SourceType.API,
                fetched_at=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Error fetching from NewsAPI: {e}")
            return FetchResult(
                items=[],
                source=self.source,
                source_type=SourceType.API,
                fetched_at=datetime.now(),
                error=str(e),
            )

    def _fetch_gnews(self) -> FetchResult:
        """Fetch from GNews API.

        Returns:
            FetchResult with items or error
        """
        logger.info(f"Fetching from GNews API with query: {self.source}")
        base_url = "https://gnews.io/api/v4/search"
        params = {
            "q": self.source,
            "token": self.api_key,
            "lang": "en",
        }

        try:
            response = requests.get(base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            items: List[NewsItem] = []
            for article in data.get("articles", []):
                item = NewsItem(
                    title=article.get("title", ""),
                    url=article.get("url", ""),
                    description=article.get("description", ""),
                    author=article.get("author", ""),
                    published_at=self._parse_datetime(article.get("publishedAt")),
                    source_url=self.source,
                )
                items.append(item)

            logger.success(f"Successfully fetched {len(items)} items from GNews API")
            return FetchResult(
                items=items,
                source=self.source,
                source_type=SourceType.API,
                fetched_at=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Error fetching from GNews API: {e}")
            return FetchResult(
                items=[],
                source=self.source,
                source_type=SourceType.API,
                fetched_at=datetime.now(),
                error=str(e),
            )

    def _parse_datetime(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse ISO 8601 datetime string.

        Args:
            date_str: ISO 8601 datetime string

        Returns:
            datetime object or None if parsing fails
        """
        if not date_str:
            return None

        try:
            # Remove timezone suffix for simplicity
            if date_str.endswith("Z"):
                date_str = date_str[:-1]
            return datetime.fromisoformat(date_str)
        except (ValueError, AttributeError):
            return None
