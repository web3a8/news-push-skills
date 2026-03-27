"""Tests for news fetchers."""

import pytest
from datetime import datetime

from news_push.fetchers import (
    RSSFetcher,
    APIFetcher,
    ScraperFetcher,
    SourceType,
)
from news_push.fetchers.base import NewsItem


class TestRSSFetcher:
    """Tests for RSSFetcher."""

    def test_rss_fetcher_init(self):
        """Test RSSFetcher initialization."""
        fetcher = RSSFetcher("https://example.com/feed.xml")
        assert fetcher.source == "https://example.com/feed.xml"

    def test_rss_fetcher_validate_url(self):
        """Test RSSFetcher URL validation."""
        # Valid URL should not raise
        fetcher = RSSFetcher("https://example.com/feed.xml")
        assert fetcher.source == "https://example.com/feed.xml"

        # Invalid URL should raise ValueError
        with pytest.raises(ValueError):
            RSSFetcher("not-a-url")

    @pytest.mark.slow
    def test_rss_fetcher_fetch_real(self):
        """Test fetching from real RSS feed."""
        fetcher = RSSFetcher("https://www.reddit.com/r/python/.rss")
        result = fetcher.fetch()

        assert result.source == "https://www.reddit.com/r/python/.rss"
        assert result.source_type == SourceType.RSS
        assert result.fetched_at is not None
        assert isinstance(result.items, list)
        # Reddit RSS should have items
        assert len(result.items) > 0
        assert result.error is None

        # Check first item structure
        item = result.items[0]
        assert isinstance(item, NewsItem)
        assert item.title
        assert item.url
        assert item.source_url == "https://www.reddit.com/r/python/.rss"


class TestAPIFetcher:
    """Tests for APIFetcher."""

    def test_api_fetcher_init(self):
        """Test APIFetcher initialization."""
        fetcher = APIFetcher("Python", provider="newsapi", api_key="test-key")
        assert fetcher.source == "Python"
        assert fetcher.provider == "newsapi"
        assert fetcher.api_key == "test-key"

    def test_api_fetcher_no_api_key(self):
        """Test APIFetcher without API key raises ValueError."""
        with pytest.raises(ValueError, match="API key required"):
            APIFetcher("Python", provider="newsapi", api_key=None)

    @pytest.mark.slow
    def test_api_fetcher_fetch_real(self):
        """Test fetching from real API (requires API key)."""
        import os

        api_key = os.environ.get("NEWSAPI_KEY")
        if not api_key:
            pytest.skip("NEWSAPI_KEY environment variable not set")

        fetcher = APIFetcher("artificial intelligence", provider="newsapi", api_key=api_key)
        result = fetcher.fetch()

        assert result.source == "artificial intelligence"
        assert result.source_type == SourceType.API
        assert result.fetched_at is not None
        assert isinstance(result.items, list)
        assert result.error is None


class TestScraperFetcher:
    """Tests for ScraperFetcher."""

    def test_scraper_fetcher_init(self):
        """Test ScraperFetcher initialization."""
        fetcher = ScraperFetcher(
            source="https://example.com/news",
            item_selector="article",
            title_selector="h2",
            url_selector="a",
        )
        assert fetcher.source == "https://example.com/news"
        assert fetcher.item_selector == "article"
        assert fetcher.title_selector == "h2"
        assert fetcher.url_selector == "a"

    def test_scraper_fetcher_invalid_url(self):
        """Test ScraperFetcher with invalid URL."""
        with pytest.raises(ValueError):
            ScraperFetcher(
                source="not-a-url",
                item_selector="article",
                title_selector="h2",
                url_selector="a",
            )

    @pytest.mark.slow
    def test_scraper_fetcher_fetch_real(self):
        """Test fetching from real website."""
        # Using Hacker News as it has stable structure
        fetcher = ScraperFetcher(
            source="https://news.ycombinator.com/",
            item_selector="tr.athing",
            title_selector="span.titleline > a",
            url_selector="span.titleline > a",
            description_selector=None,
        )
        result = fetcher.fetch()

        assert result.source == "https://news.ycombinator.com/"
        assert result.source_type == SourceType.SCRAPER
        assert result.fetched_at is not None
        assert isinstance(result.items, list)
        # Hacker News should have items
        assert len(result.items) > 0
        assert result.error is None

        # Check first item structure
        item = result.items[0]
        assert isinstance(item, NewsItem)
        assert item.title
        assert item.url
        assert item.source_url == "https://news.ycombinator.com/"
