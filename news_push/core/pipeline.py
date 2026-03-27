"""新闻处理管道编排器"""

from loguru import logger
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from news_push.storage.database import DatabaseManager
from news_push.storage.models import User, Source, Filter, Article
from news_push.fetchers.base import FetchResult
from news_push.fetchers.adapter import SimpleFetcher
from news_push.processors.dedup import DeduplicationProcessor
from news_push.processors.filter import FilterProcessor
from news_push.processors.summarizer import SummarizerProcessor
from news_push.senders.email import EmailSender


class PipelineOrchestrator:
    """新闻处理管道编排器"""

    def __init__(self, db_manager: DatabaseManager):
        """
        初始化编排器

        Args:
            db_manager: 数据库管理器
        """
        self.db = db_manager
        self.dedup_processor = DeduplicationProcessor()

    def run(self, user_email: str, dry_run: bool = False) -> dict:
        """
        运行完整的新闻处理管道

        Args:
            user_email: 用户邮箱
            dry_run: 是否为测试运行（不发送邮件）

        Returns:
            运行结果统计
        """
        logger.info(f"开始运行管道: user={user_email}, dry_run={dry_run}")

        # 1. 获取用户配置
        user = self.db.get_user(user_email)
        if not user:
            logger.error(f"用户不存在: {user_email}")
            return {"success": False, "error": "用户不存在"}

        # 2. 获取新闻源
        session = self.db.get_session()
        try:
            sources = session.query(Source).filter(
                Source.user_id == user.id,
                Source.is_active == True
            ).all()
        finally:
            session.close()

        if not sources:
            logger.warning(f"没有配置新闻源: {user_email}")
            return {"success": False, "error": "没有配置新闻源"}

        logger.info(f"加载了 {len(sources)} 个新闻源")

        # 3. 并行抓取所有新闻源
        all_articles = self._fetch_all_sources(sources)

        if not all_articles:
            logger.warning("没有抓取到任何文章")
            return {"success": False, "error": "没有抓取到文章"}

        logger.info(f"共抓取 {len(all_articles)} 篇文章")

        # 4. 去重
        all_articles = self.dedup_processor.dedup(all_articles)
        logger.info(f"去重后剩余 {len(all_articles)} 篇文章")

        # 5. 过滤
        session = self.db.get_session()
        try:
            filters = session.query(Filter).filter(
                Filter.user_id == user.id,
                Filter.is_active == True
            ).all()
        finally:
            session.close()

        if filters:
            filter_processor = FilterProcessor(filters)
            all_articles = filter_processor.apply(all_articles)

        if not all_articles:
            logger.warning("过滤后没有剩余文章")
            return {"success": False, "error": "过滤后没有剩余文章"}

        # 6. 生成摘要
        if user.ai_provider and user.ai_api_key:
            summarizer = SummarizerProcessor(
                provider=user.ai_provider,
                api_key=self.db.secure.decrypt(user.ai_api_key),
                model=user.ai_model,
            )
        else:
            summarizer = SummarizerProcessor(provider="rule")

        all_articles = summarizer.summarize(all_articles)

        # 7. 保存到数据库
        self._save_articles(user.id, all_articles)

        # 8. 发送邮件（如果不是 dry run）
        if not dry_run:
            success = self._send_email(user, all_articles)
            if not success:
                return {"success": False, "error": "邮件发送失败"}

        logger.info(f"管道运行完成: 处理了 {len(all_articles)} 篇文章")

        return {
            "success": True,
            "articles_count": len(all_articles),
            "sources_count": len(sources),
        }

    def _fetch_all_sources(self, sources: List[Source]) -> List[FetchResult]:
        """并行抓取所有新闻源"""
        all_articles = []

        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_source = {
                executor.submit(self._fetch_source, source): source
                for source in sources
            }

            for future in as_completed(future_to_source):
                source = future_to_source[future]
                try:
                    articles = future.result()
                    all_articles.extend(articles)
                except Exception as e:
                    logger.error(f"抓取新闻源失败: {source.name} - {e}")

        return all_articles

    def _fetch_source(self, source: Source) -> List[FetchResult]:
        """抓取单个新闻源"""
        import json

        fetch_config = json.loads(source.fetch_config) if source.fetch_config else {}

        fetcher = SimpleFetcher(
            name=source.name,
            url=source.url,
            config=fetch_config
        )

        return fetcher.fetch()

    def _save_articles(self, user_id: int, articles: List[FetchResult]):
        """保存文章到数据库"""
        session = self.db.get_session()
        try:
            for article in articles:
                # 检查是否已存在
                existing = session.query(Article).filter(Article.url == article.url).first()
                if existing:
                    continue

                # 创建新文章
                db_article = Article(
                    source_id=1,  # TODO: 关联到正确的 source_id
                    title=article.title,
                    url=article.url,
                    content=article.content,
                    summary=article.summary,
                    author=article.author,
                    published_at=article.published_at,
                )
                session.add(db_article)

            session.commit()
            logger.info(f"保存了 {len(articles)} 篇文章到数据库")
        except Exception as e:
            session.rollback()
            logger.error(f"保存文章失败: {e}")
        finally:
            session.close()

    def _send_email(self, user: User, articles: List[FetchResult]) -> bool:
        """发送邮件"""
        sender = EmailSender(
            smtp_host=user.smtp_host,
            smtp_port=user.smtp_port,
            smtp_username=user.smtp_username,
            smtp_password=self.db.secure.decrypt(user.smtp_password),
            smtp_use_tls=user.smtp_use_tls,
        )

        return sender.send_articles(
            to_email=user.email,
            articles=articles,
            subject="新闻推送",
            theme="default",
        )
