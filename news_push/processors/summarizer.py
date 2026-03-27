"""摘要生成处理器"""

import re
from loguru import logger
from typing import List, Optional

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from news_push.fetchers.base import FetchResult


class SummarizerProcessor:
    """摘要生成处理器"""

    def __init__(self, provider: str = "rule", api_key: Optional[str] = None, model: Optional[str] = None):
        """
        初始化摘要生成器

        Args:
            provider: AI 提供商（claude, openai, rule）
            api_key: API Key
            model: 模型名称
        """
        self.provider = provider
        self.api_key = api_key
        self.model = model

        if provider == "claude" and api_key and ANTHROPIC_AVAILABLE:
            self.client = Anthropic(api_key=api_key)
        else:
            self.client = None

        logger.info(f"摘要生成器初始化: provider={provider}")

    def summarize(self, articles: List[FetchResult]) -> List[FetchResult]:
        """
        为文章生成摘要

        Args:
            articles: 文章列表

        Returns:
            带摘要的文章列表
        """
        if not articles:
            return articles

        for article in articles:
            try:
                if self.provider == "claude" and self.client:
                    article.summary = self._summarize_with_claude(article)
                else:
                    article.summary = self._summarize_with_rules(article)
            except Exception as e:
                logger.warning(f"生成摘要失败: {article.title} - {e}")
                article.summary = self._summarize_with_rules(article)

        return articles

    def _summarize_with_claude(self, article: FetchResult) -> str:
        """使用 Claude 生成摘要"""
        prompt = f"""请为以下新闻文章生成简洁的摘要（不超过 100 字）：

标题: {article.title}
内容: {article.content or article.url}

摘要:"""

        try:
            message = self.client.messages.create(
                model=self.model or "claude-3-sonnet-20240229",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text.strip()
        except Exception as e:
            logger.error(f"Claude API 调用失败: {e}")
            raise

    def _summarize_with_rules(self, article: FetchResult) -> str:
        """使用规则引擎生成摘要"""
        # 如果有内容，提取前两句
        if article.content:
            # 移除 HTML 标签
            text = re.sub(r'<[^>]+>', '', article.content)
            # 分割句子
            sentences = re.split(r'[。！？.!?]', text)
            sentences = [s.strip() for s in sentences if s.strip()]
            # 返回前两句
            if sentences:
                summary = '。'.join(sentences[:2])
                if summary and not summary.endswith('。'):
                    summary += '。'
                return summary[:200]  # 限制长度

        # 如果没有内容，返回标题
        return article.title[:100]
