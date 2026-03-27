"""文章阅读路由"""

from flask import Blueprint

articles_bp = Blueprint("articles", __name__)


@articles_bp.route("/articles")
def list_articles():
    """文章列表"""
    return "文章列表 - 待实现"


@articles_bp.route("/articles/<int:article_id>")
def article_detail(article_id):
    """文章详情"""
    return f"文章详情 {article_id} - 待实现"
