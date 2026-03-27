"""RSS fetcher module."""

from datetime import datetime
from typing import List

import feedparser
from loguru import logger

from news_push.fetchers.base import BaseFetcher, FetchResult, NewsItem, SourceType


class RSSFetcher(BaseFetcher):
    """Fetch news from RSS feeds.

    Uses feedparser to parse RSS/Atom feeds.
    """

    def fetch(self) -> FetchResult:
        """Fetch news from RSS feed.

        Returns:
            FetchResult containing items and metadata

        Raises:
            Exception: If feed cannot be fetched or parsed
        """
        logger.info(f"Starting RSS fetch from {self.source}")
        try:
            feed = feedparser.parse(self.source)

            if feed.bozo:  # feedparser flag for parsing errors
                # Try to get more specific error
                error = getattr(feed, "bozo_exception", "Unknown parsing error")
                logger.error(f"Failed to parse RSS feed {self.source}: {error}")
                return FetchResult(
                    items=[],
                    source=self.source,
                    source_type=SourceType.RSS,
                    fetched_at=datetime.now(),
                    error=str(error),
                )

            items: List[NewsItem] = []
            for entry in feed.entries:
                # Extract basic fields
                title = entry.get("title", "No title")
                url = entry.get("link", "")

                # Extract description/content
                description = ""
                if "description" in entry:
                    description = entry.description
                elif "summary" in entry:
                    description = entry.summary
                elif "content" in entry:
                    content_list = entry.content
                    if content_list and isinstance(content_list, list):
                        description = content_list[0].get("value", "")

                # Extract published date
                published_at = None
                if "published_parsed" in entry and entry.published_parsed:
                    published_at = datetime(*entry.published_parsed[:6])
                elif "updated_parsed" in entry and entry.updated_parsed:
                    published_at = datetime(*entry.updated_parsed[:6])

                # Extract author
                author = ""
                if "author" in entry:
                    author = entry.author
                elif "author_detail" in entry:
                    author = entry.author_detail.get("name", "")

                item = NewsItem(
                    title=title,
                    url=url,
                    description=description,
                    author=author,
                    published_at=published_at,
                    source_url=self.source,
                )
                items.append(item)

            logger.success(f"Successfully fetched {len(items)} items from RSS feed {self.source}")
            return FetchResult(
                items=items,
                source=self.source,
                source_type=SourceType.RSS,
                fetched_at=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Error fetching RSS feed {self.source}: {e}")
            return FetchResult(
                items=[],
                source=self.source,
                source_type=SourceType.RSS,
                fetched_at=datetime.now(),
                error=str(e),
            )
