"""首页路由"""

from flask import Blueprint, render_template, request

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    """首页 - 显示统计信息和文章列表"""
    from news_push.storage.database import DatabaseManager

    db = DatabaseManager()

    # 获取统计信息
    stats = db.get_statistics()

    # 获取文章列表（分页）
    page = int(request.args.get("page", 1))
    per_page = 10
    offset = (page - 1) * per_page

    # 获取筛选的新闻源
    source_id = request.args.get("source_id", type=int)

    articles = db.get_articles(limit=per_page, offset=offset, source_id=source_id)

    # 获取所有新闻源用于筛选
    sources = db.get_sources()

    return render_template(
        "index.html",
        stats=stats,
        articles=articles,
        sources=sources,
        page=page,
        current_source_id=source_id
    )
