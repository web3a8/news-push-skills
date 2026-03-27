"""模板渲染器"""

import os
from jinja2 import Environment, FileSystemLoader, select_autoescape
from loguru import logger
from typing import List, Optional


class TemplateRenderer:
    """邮件模板渲染器"""

    def __init__(self, theme: str = "default", template_dir: Optional[str] = None):
        """
        初始化模板渲染器

        Args:
            theme: 邮件主题名称
            template_dir: 模板目录路径
        """
        if template_dir is None:
            # 默认模板目录
            current_dir = os.path.dirname(os.path.abspath(__file__))
            template_dir = os.path.join(
                os.path.dirname(current_dir),
                "templates",
                "newsletter"
            )

        self.theme = theme
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )

        logger.info(f"模板渲染器初始化: theme={theme}, dir={template_dir}")

    def render(self, articles: List[dict], title: str = "新闻推送", **kwargs) -> str:
        """
        渲染邮件模板

        Args:
            articles: 文章列表
            title: 邮件标题
            **kwargs: 额外的模板变量

        Returns:
            渲染后的HTML内容
        """
        try:
            template = self.env.get_template(f"{self.theme}.html")
            html_content = template.render(
                articles=articles,
                title=title,
                **kwargs
            )
            return html_content
        except Exception as e:
            logger.error(f"模板渲染失败: {e}")
            # 返回简单的备用HTML
            return self._render_simple(articles, title)

    def _render_simple(self, articles: List[dict], title: str) -> str:
        """简单的备用渲染"""
        html_parts = [
            "<!DOCTYPE html>",
            "<html><head>",
            f"<title>{title}</title>",
            "<meta charset='utf-8'>",
            "<style>",
            "body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }",
            ".article { border-bottom: 1px solid #eee; padding: 15px 0; }",
            ".article h3 { margin: 0 0 10px 0; color: #333; }",
            ".article a { color: #0066cc; text-decoration: none; }",
            ".summary { color: #666; font-size: 14px; }",
            "</style>",
            "</head><body>",
            f"<h1>{title}</h1>",
        ]

        for article in articles:
            html_parts.append(f"<div class='article'>")
            html_parts.append(f"<h3><a href='{article.get('url', '#')}'>{article.get('title', '无标题')}</a></h3>")
            if article.get('summary'):
                html_parts.append(f"<p class='summary'>{article['summary']}</p>")
            html_parts.append(f"</div>")

        html_parts.extend([
            "</body></html>"
        ])

        return "\n".join(html_parts)

    @staticmethod
    def get_available_themes() -> List[str]:
        """获取可用的主题列表"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        template_dir = os.path.join(
            os.path.dirname(current_dir),
            "templates",
            "newsletter"
        )

        if not os.path.exists(template_dir):
            return ["default"]

        themes = []
        for file in os.listdir(template_dir):
            if file.endswith(".html"):
                themes.append(file[:-5])

        return themes if themes else ["default"]
