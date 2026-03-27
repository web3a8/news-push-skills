"""邮件发送器"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from loguru import logger
from typing import List, Optional

from news_push.fetchers.base import FetchResult
from news_push.senders.renderer import TemplateRenderer


class EmailSender:
    """邮件发送器"""

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_username: str,
        smtp_password: str,
        smtp_use_tls: bool = True
    ):
        """
        初始化邮件发送器

        Args:
            smtp_host: SMTP服务器地址
            smtp_port: SMTP端口
            smtp_username: SMTP用户名
            smtp_password: SMTP密码
            smtp_use_tls: 是否使用TLS
        """
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.smtp_use_tls = smtp_use_tls

        logger.info(f"邮件发送器初始化: {smtp_host}:{smtp_port}")

    def send(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: Optional[str] = None
    ) -> bool:
        """
        发送邮件

        Args:
            to_email: 收件人邮箱
            subject: 邮件主题
            html_content: HTML内容
            from_email: 发件人邮箱（默认使用smtp_username）

        Returns:
            是否发送成功
        """
        if from_email is None:
            from_email = self.smtp_username

        try:
            # 创建邮件
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = from_email
            msg['To'] = to_email

            # 添加HTML部分
            html_part = MIMEText(html_content, "html", "utf-8")
            msg.attach(html_part)

            # 连接 SMTP 服务器
            logger.info(f"连接 SMTP 服务器: {self.smtp_host}:{self.smtp_port}")
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()

                server.login(self.smtp_username, self.smtp_password)

                # 发送邮件
                server.send_message(msg)
                logger.info(f"邮件发送成功: {to_email}")

            return True

        except Exception as e:
            logger.error(f"邮件发送失败: {e}")
            return False

    def send_articles(
        self,
        to_email: str,
        articles: List[FetchResult],
        subject: str = "新闻推送",
        theme: str = "default",
    ) -> bool:
        """
        发送文章邮件

        Args:
            to_email: 收件人邮箱
            articles: 文章列表
            subject: 邮件主题
            theme: 邮件主题

        Returns:
            是否发送成功
        """
        if not articles:
            logger.warning("没有文章需要发送")
            return False

        # 渲染模板
        renderer = TemplateRenderer(theme=theme)

        # 将FetchResult转换为dict
        articles_dict = [
            {
                "title": a.title,
                "url": a.url,
                "content": a.content,
                "summary": a.summary,
                "author": a.author,
                "published_at": a.published_at,
                "source_name": a.source_name,
            }
            for a in articles
        ]

        html_content = renderer.render(articles_dict, title=subject)

        # 发送邮件
        return self.send(to_email, subject, html_content)
