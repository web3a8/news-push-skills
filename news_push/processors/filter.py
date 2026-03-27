"""过滤处理器"""

import re
from loguru import logger
from typing import List

from news_push.fetchers.base import FetchResult
from news_push.storage.models import Filter as FilterModel


class FilterProcessor:
    """内容过滤处理器"""

    def __init__(self, filters: List[FilterModel]):
        """
        初始化过滤处理器

        Args:
            filters: 过滤规则列表
        """
        self.filters = [f for f in filters if f.is_active]
        logger.info(f"加载了 {len(self.filters)} 条过滤规则")

    def apply(self, articles: List[FetchResult]) -> List[FetchResult]:
        """
        应用所有过滤规则

        Args:
            articles: 文章列表

        Returns:
            过滤后的文章列表
        """
        if not self.filters:
            logger.debug("没有配置过滤规则")
            return articles

        filtered_articles = []

        for article in articles:
            # 默认包含文章，除非被排除
            include = True

            for filter_rule in self.filters:
                match = self._match_filter(article, filter_rule)

                # 如果是 include 规则且匹配，则包含
                if filter_rule.action == "include" and match:
                    include = True
                    break

                # 如果是 exclude 规则且匹配，则排除
                elif filter_rule.action == "exclude" and match:
                    include = False
                    break

            if include:
                filtered_articles.append(article)

        removed = len(articles) - len(filtered_articles)
        if removed > 0:
            logger.info(f"过滤规则应用完成: 移除 {removed} 篇文章，保留 {len(filtered_articles)} 篇")

        return filtered_articles

    def _match_filter(self, article: FetchResult, filter_rule: FilterModel) -> bool:
        """
        检查文章是否匹配过滤规则

        Args:
            article: 文章
            filter_rule: 过滤规则

        Returns:
            是否匹配
        """
        text = f"{article.title} {article.content or ''}".lower()

        if filter_rule.type == "keyword":
            # 关键词匹配
            return filter_rule.rule.lower() in text

        elif filter_rule.type == "category":
            # 分类匹配（检查 URL 或标题）
            return filter_rule.rule.lower() in text

        elif filter_rule.type == "regex":
            # 正则表达式匹配
            try:
                pattern = re.compile(filter_rule.rule, re.IGNORECASE)
                return bool(pattern.search(text))
            except re.error as e:
                logger.warning(f"无效的正则表达式: {filter_rule.rule} - {e}")
                return False

        return False
