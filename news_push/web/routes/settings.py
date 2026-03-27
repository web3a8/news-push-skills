"""系统设置路由"""

from flask import Blueprint

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings", methods=["GET", "POST"])
def settings():
    """系统设置"""
    return "系统设置 - 待实现"
