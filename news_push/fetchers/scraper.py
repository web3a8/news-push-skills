"""Scraper fetcher module."""

from datetime import datetime
from typing import List, Optional

import requests
from bs4 import BeautifulSoup
from loguru import logger

from news_push.fetchers.base import BaseFetcher, FetchResult, NewsItem, SourceType


class ScraperFetcher(BaseFetcher):
    """Fetch news by scraping web pages.

    Uses CSS selectors to extract news items from HTML.
    """

    def __init__(
        self,
        source: str,
        item_selector: str,
        title_selector: str,
        url_selector: str,
        description_selector: Optional[str] = None,
        author_selector: Optional[str] = None,
        date_selector: Optional[str] = None,
    ):
        """Initialize scraper fetcher.

        Args:
            source: URL to scrape
            item_selector: CSS selector for news item containers
            title_selector: CSS selector for title (relative to item)
            url_selector: CSS selector for URL (relative to item)
            description_selector: CSS selector for description (optional)
            author_selector: CSS selector for author (optional)
            date_selector: CSS selector for date (optional)
        """
        super().__init__(source)
        self.item_selector = item_selector
        self.title_selector = title_selector
        self.url_selector = url_selector
        self.description_selector = description_selector
        self.author_selector = author_selector
        self.date_selector = date_selector

    def fetch(self) -> FetchResult:
        """Fetch news by scraping.

        Returns:
            FetchResult containing items and metadata
        """
        logger.info(f"Starting scraper fetch from {self.source}")
        try:
            response = requests.get(self.source, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "html.parser")
            item_elements = soup.select(self.item_selector)

            items: List[NewsItem] = []
            for element in item_elements:
                # Extract title
                title_elem = element.select_one(self.title_selector)
                title = title_elem.get_text(strip=True) if title_elem else "No title"

                # Extract URL
                url_elem = element.select_one(self.url_selector)
                url = ""
                if url_elem:
                    url = url_elem.get("href", "")
                    # Handle relative URLs
                    if url and not url.startswith("http"):
                        from urllib.parse import urljoin

                        url = urljoin(self.source, url)

                # Extract description
                description = ""
                if self.description_selector:
                    desc_elem = element.select_one(self.description_selector)
                    if desc_elem:
                        description = desc_elem.get_text(strip=True)

                # Extract author
                author = ""
                if self.author_selector:
                    author_elem = element.select_one(self.author_selector)
                    if author_elem:
                        author = author_elem.get_text(strip=True)

                # Extract date
                published_at = None
                if self.date_selector:
                    date_elem = element.select_one(self.date_selector)
                    if date_elem:
                        date_str = date_elem.get_text(strip=True)
                        published_at = self._parse_date(date_str)

                item = NewsItem(
                    title=title,
                    url=url,
                    description=description,
                    author=author,
                    published_at=published_at,
                    source_url=self.source,
                )
                items.append(item)

            logger.success(f"Successfully scraped {len(items)} items from {self.source}")
            return FetchResult(
                items=items,
                source=self.source,
                source_type=SourceType.SCRAPER,
                fetched_at=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Error scraping {self.source}: {e}")
            return FetchResult(
                items=[],
                source=self.source,
                source_type=SourceType.SCRAPER,
                fetched_at=datetime.now(),
                error=str(e),
            )

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string.

        This is a simple implementation. In production, you might want to use
        dateutil.parser or a more sophisticated parsing library.

        Args:
            date_str: Date string to parse

        Returns:
            datetime object or None if parsing fails
        """
        try:
            # Try common formats
            for fmt in [
                "%Y-%m-%d",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
                "%d %b %Y",
                "%B %d, %Y",
            ]:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
        except Exception:
            pass

        return None
