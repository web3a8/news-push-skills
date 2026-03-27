"""去重处理器"""

from loguru import logger
from typing import List, Set
from hashlib import md5

from news_push.fetchers.base import FetchResult


class DeduplicationProcessor:
    """去重处理器"""

    def __init__(self):
        self.seen_urls: Set[str] = set()
        self.seen_titles: Set[str] = set()

    def dedup_by_url(self, articles: List[FetchResult]) -> List[FetchResult]:
        """
        按 URL 去重

        Args:
            articles: 文章列表

        Returns:
            去重后的文章列表
        """
        unique_articles = []
        for article in articles:
            url_hash = self._hash_url(article.url)
            if url_hash not in self.seen_urls:
                self.seen_urls.add(url_hash)
                unique_articles.append(article)

        removed = len(articles) - len(unique_articles)
        if removed > 0:
            logger.info(f"按 URL 去重: 移除 {removed} 篇重复文章")

        return unique_articles

    def dedup_by_title(self, articles: List[FetchResult]) -> List[FetchResult]:
        """
        按标题去重

        Args:
            articles: 文章列表

        Returns:
            去重后的文章列表
        """
        unique_articles = []
        for article in articles:
            title_hash = self._hash_title(article.title)
            if title_hash not in self.seen_titles:
                self.seen_titles.add(title_hash)
                unique_articles.append(article)

        removed = len(articles) - len(unique_articles)
        if removed > 0:
            logger.info(f"按标题去重: 移除 {removed} 篇重复文章")

        return unique_articles

    def dedup(self, articles: List[FetchResult]) -> List[FetchResult]:
        """
        综合去重（URL + 标题）

        Args:
            articles: 文章列表

        Returns:
            去重后的文章列表
        """
        # 先按 URL 去重，再按标题去重
        articles = self.dedup_by_url(articles)
        articles = self.dedup_by_title(articles)
        return articles

    def reset(self):
        """重置已记录的数据"""
        self.seen_urls.clear()
        self.seen_titles.clear()
        logger.debug("去重记录已重置")

    @staticmethod
    def _hash_url(url: str) -> str:
        """URL 哈希"""
        return md5(url.encode()).hexdigest()

    @staticmethod
    def _hash_title(title: str) -> str:
        """标题哈希（忽略大小写和空格）"""
        normalized = title.lower().strip()
        return md5(normalized.encode()).hexdigest()
