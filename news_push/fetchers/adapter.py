"""Fetch adapter to bridge different fetcher interfaces"""

import requests
import json
from loguru import logger
from typing import List, Optional
from datetime import datetime
from dataclasses import dataclass


@dataclass
class FetchResult:
    """单篇文章抓取结果"""
    title: str
    url: str
    content: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    source_name: Optional[str] = None
    summary: Optional[str] = None


class SimpleFetcher:
    """简化的新闻抓取器，支持RSS、API和自定义格式"""

    def __init__(self, name: str, url: str, config: dict = None):
        """
        初始化抓取器

        Args:
            name: 新闻源名称
            url: 新闻源URL
            config: 额外配置
        """
        self.name = name
        self.url = url
        self.config = config or {}

    def fetch(self) -> List[FetchResult]:
        """
        抓取新闻

        Returns:
            文章列表
        """
        # 尝试自动检测类型
        if self.config.get("api_type") == "zhihu_hotlist":
            return self._fetch_zhihu_hotlist()
        elif "rss" in self.url.lower() or "feed" in self.url.lower():
            return self._fetch_rss()
        else:
            return self._fetch_generic_api()

    def _fetch_zhihu_hotlist(self) -> List[FetchResult]:
        """抓取知乎热榜"""
        try:
            response = requests.get(self.url, timeout=10)
            response.raise_for_status()

            data = response.json()
            articles = []

            if 'data' in data:
                for item in data['data'][:20]:  # 限制20条
                    target = item.get('target', {})

                    # 标题在title_area.text中
                    title_area = target.get('title_area', {})
                    title = title_area.get('text', '无标题')

                    # URL在link.url中
                    link = target.get('link', {})
                    url = link.get('url', '')

                    # 摘要在excerpt_area.text中
                    excerpt_area = target.get('excerpt_area', {})
                    content = excerpt_area.get('text', '')

                    # 热度信息
                    metrics_area = target.get('metrics_area', {})
                    hot_value = ''
                    if metrics_area:
                        text = metrics_area.get('text', '')
                        if text:
                            hot_value = text.strip()

                    if not title or not url:
                        continue

                    # 组合内容
                    if hot_value:
                        content = f"🔥 {hot_value}\n\n{content}"

                    article = FetchResult(
                        title=title,
                        url=url,
                        content=content[:500],  # 限制内容长度
                        source_name=self.name,
                        published_at=datetime.now()
                    )
                    articles.append(article)

            logger.info(f"知乎热榜抓取成功: {len(articles)} 篇文章")
            return articles

        except Exception as e:
            logger.error(f"知乎热榜抓取失败: {e}")
            return []

    def _fetch_rss(self) -> List[FetchResult]:
        """抓取RSS源"""
        try:
            import feedparser

            feed = feedparser.parse(self.url)
            articles = []

            for entry in feed.entries[:20]:
                title = entry.get("title", "无标题")
                url = entry.get("link", "")
                content = entry.get("description", entry.get("summary", ""))

                # 解析发布时间
                published_at = None
                if "published_parsed" in entry and entry.published_parsed:
                    published_at = datetime(*entry.published_parsed[:6])
                elif "updated_parsed" in entry and entry.updated_parsed:
                    published_at = datetime(*entry.updated_parsed[:6])

                article = FetchResult(
                    title=title,
                    url=url,
                    content=content,
                    source_name=self.name,
                    published_at=published_at or datetime.now()
                )
                articles.append(article)

            logger.info(f"RSS抓取成功: {len(articles)} 篇文章")
            return articles

        except Exception as e:
            logger.error(f"RSS抓取失败: {e}")
            return []

    def _fetch_generic_api(self) -> List[FetchResult]:
        """抓取通用API"""
        try:
            headers = {"User-Agent": "News-Push-Skill/1.0"}
            response = requests.get(self.url, headers=headers, timeout=10)
            response.raise_for_status()

            # 尝试解析JSON
            try:
                data = response.json()
                articles = []

                # 处理不同的API格式
                if isinstance(data, dict):
                    items = data.get("articles", data.get("items", data.get("data", [])))
                elif isinstance(data, list):
                    items = data
                else:
                    items = []

                for item in items[:20]:
                    title = item.get("title", item.get("name", "无标题"))
                    url = item.get("url", item.get("link", item.get("web_url", "")))
                    content = item.get("description", item.get("content", item.get("summary", "")))

                    if url:
                        article = FetchResult(
                            title=title,
                            url=url,
                            content=content,
                            source_name=self.name,
                            published_at=datetime.now()
                        )
                        articles.append(article)

                logger.info(f"API抓取成功: {len(articles)} 篇文章")
                return articles

            except Exception as e:
                logger.warning(f"JSON解析失败，尝试HTML解析: {e}")
                return self._fetch_html(response.text)

        except Exception as e:
            logger.error(f"API抓取失败: {e}")
            return []

    def _fetch_html(self, html: str) -> List[FetchResult]:
        """解析HTML页面"""
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "html.parser")
            articles = []

            # 简单的提取规则
            for link in soup.find_all("a", href=True)[:20]:
                url = link.get("href")
                if not url or url.startswith("#"):
                    continue

                title = link.get_text(strip=True)
                if len(title) < 10:  # 跳过太短的标题
                    continue

                article = FetchResult(
                    title=title,
                    url=url,
                    content="",
                    source_name=self.name,
                    published_at=datetime.now()
                )
                articles.append(article)

            logger.info(f"HTML抓取成功: {len(articles)} 篇文章")
            return articles

        except Exception as e:
            logger.error(f"HTML解析失败: {e}")
            return []
