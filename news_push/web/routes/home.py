"""首页路由"""

from flask import Blueprint, render_template

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    """首页 - 显示统计信息"""
    from news_push.storage.database import DatabaseManager

    db = DatabaseManager()
    stats = db.get_statistics()

    return render_template("index.html", stats=stats)
