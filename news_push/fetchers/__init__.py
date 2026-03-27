"""News fetchers module."""

from .base import BaseFetcher, FetchResult, SourceType
from .rss import RSSFetcher
from .api import APIFetcher
from .scraper import ScraperFetcher

__all__ = [
    "BaseFetcher",
    "FetchResult",
    "SourceType",
    "RSSFetcher",
    "APIFetcher",
    "ScraperFetcher",
]
