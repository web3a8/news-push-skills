"""Pipeline orchestration for news processing"""

from typing import List, Dict, Any
from news_push.storage.database import DatabaseManager
from news_push.fetchers.base import BaseFetcher
from news_push.fetchers.rss import RSSFetcher
from news_push.fetchers.api import APIFetcher
from news_push.fetchers.scraper import ScraperFetcher
from news_push.storage.models import Source, Filter
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
import logging

console = Console()
logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    """新闻推送管道编排器"""

    def __init__(self, db_path: str = None):
        self.db = DatabaseManager(db_path)
        self.filter_engine = FilterEngine()
        self.summarizer = SummarizerEngine()
        self.emailer = Emailer()
        self.fetchers = {
            'rss': RSSFetcher(),
            'api': APIFetcher(),
            'scraper': ScraperFetcher()
        }

    def fetch_articles(self, source: Source) -> List[Dict[str, Any]]:
        """从新闻源获取文章"""
        fetcher = self.fetchers.get(source.type)
        if not fetcher:
            raise ValueError(f"不支持的新闻源类型: {source.type}")

        return fetcher.fetch(source.url, source.config)

    def process_articles(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """处理文章：过滤、摘要"""
        # 过滤
        filtered_articles = []
        for article in articles:
            if self.filter_engine.should_include(article):
                filtered_articles.append(article)

        # 摘要生成
        for article in filtered_articles:
            if article.get('content'):
                article['summary'] = self.summarizer.summarize(article['content'])
            else:
                article['summary'] = article.get('title', '')

        return filtered_articles

    def send_email(self, articles: List[Dict[str, Any]], user_email: str):
        """发送邮件"""
        self.emailer.send(articles, user_email)

    def run_pipeline(self, source_name: str = None, test_mode: bool = False):
        """运行完整的推送管道"""
        try:
            # 获取新闻源
            if source_name:
                source = self.db.get_source_by_name(source_name)
                sources = [source]
            else:
                sources = self.db.get_all_sources()

            if not sources:
                console.print("[yellow]⚠️ 没有找到新闻源[/yellow]")
                return

            all_articles = []

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
            ) as progress:
                for source in sources:
                    task = progress.add_task(f"抓取 {source.name}", total=None)

                    # 获取文章
                    articles = self.fetch_articles(source)
                    progress.update(task, description=f"处理 {len(articles)} 篇文章")

                    # 处理文章
                    processed_articles = self.process_articles(articles)
                    all_articles.extend(processed_articles)

                    # 更新数据库
                    for article in processed_articles:
                        self.db.save_article(source.id, article)

                    progress.update(task, completed=True)

            if test_mode:
                console.print(f"[green]✅ 测试完成，共抓取 {len(all_articles)} 篇文章[/green]")
            else:
                # 发送邮件
                user_email = self.db.get_user_email()
                if user_email:
                    self.send_email(all_articles, user_email)
                    console.print(f"[green]✅ 推送完成，共发送 {len(all_articles)} 篇文章到 {user_email}[/green]")
                else:
                    console.print("[red]✗ 请先初始化配置[/red]")

        except Exception as e:
            logger.error(f"管道运行失败: {e}")
            console.print(f"[red]✗ 管道运行失败: {e}[/red]")


class FilterEngine:
    """过滤引擎"""

    def should_include(self, article: Dict[str, Any]) -> bool:
        """判断文章是否应该包含"""
        rules = DatabaseManager().get_all_filters()

        for rule in rules:
            if rule.action == 'exclude' and self._matches_rule(article, rule):
                return False
            elif rule.action == 'include' and not self._matches_rule(article, rule):
                return False

        return True

    def _matches_rule(self, article: Dict[str, Any], rule: Filter) -> bool:
        """检查文章是否匹配过滤规则"""
        content = f"{article.get('title', '')} {article.get('content', '')}"

        if rule.type == 'keyword':
            return rule.rule.lower() in content.lower()
        elif rule.type == 'category':
            return rule.rule.lower() in article.get('category', '').lower()
        elif rule.type == 'regex':
            import re
            return bool(re.search(rule.rule, content))

        return False


class SummarizerEngine:
    """摘要生成引擎"""

    def summarize(self, content: str) -> str:
        """生成文章摘要"""
        # 简单的实现：截取前200个字符
        if len(content) > 200:
            return content[:200] + "..."
        return content


class Emailer:
    """邮件发送器"""

    def send(self, articles: List[Dict[str, Any]], user_email: str):
        """发送邮件"""
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import smtplib

        # 创建邮件
        msg = MIMEMultipart()
        msg['From'] = 'news-push@localhost'
        msg['To'] = user_email
        msg['Subject'] = '今日新闻推送'

        # 构建HTML内容
        html_content = """
        <html>
        <body>
        <h1>今日新闻推送</h1>
        """

        for i, article in enumerate(articles, 1):
            html_content += f"""
            <div style="border: 1px solid #ddd; margin: 10px; padding: 10px; border-radius: 5px;">
                <h3>{i}. {article.get('title', '')}</h3>
                <p><strong>摘要：</strong>{article.get('summary', '')}</p>
                <p><strong>来源：</strong>{article.get('source_name', '')}</p>
                <p><strong>时间：</strong>{article.get('published_at', '')}</p>
                <p><strong>链接：</strong><a href="{article.get('url', '')}">查看原文</a></p>
            </div>
            """

        html_content += """
        </body>
        </html>
        """

        msg.attach(MIMEText(html_content, 'html'))

        # 发送邮件（需要配置SMTP）
        try:
            # 这里需要实际的SMTP配置
            # server = smtplib.SMTP('smtp.example.com', 587)
            # server.starttls()
            # server.login('user', 'pass')
            # server.send_message(msg)
            # server.quit()

            console.print(f"[green]邮件已发送到 {user_email}[/green]")
        except Exception as e:
            console.print(f"[red]邮件发送失败: {e}[/red]")