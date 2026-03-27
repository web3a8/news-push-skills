"""文章阅读路由"""

from flask import Blueprint, render_template, request

articles_bp = Blueprint("articles", __name__)


@articles_bp.route("/articles")
def list_articles():
    """文章列表"""
    page = request.args.get("page", 1, type=int)
    source_id = request.args.get("source_id", type=int)
    per_page = 20

    from news_push.storage.database import DatabaseManager

    db = DatabaseManager()

    # 获取筛选后的文章
    offset = (page - 1) * per_page
    articles = db.get_articles(limit=per_page, offset=offset, source_id=source_id)

    # 获取所有新闻源（用于筛选器）
    sources = db.get_sources()

    return render_template(
        "articles/list.html",
        articles=articles,
        sources=sources,
        current_source_id=source_id,
        page=page
    )


@articles_bp.route("/articles/<int:article_id>")
def article_detail(article_id):
    """文章详情"""
    from news_push.storage.database import DatabaseManager

    db = DatabaseManager()
    article = db.get_article_by_id(article_id)

    if not article:
        from flask import flash, redirect, url_for
        flash("文章不存在", "error")
        return redirect(url_for("articles.list_articles"))

    return render_template("articles/detail.html", article=article)
