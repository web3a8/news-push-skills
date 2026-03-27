"""新闻源管理路由"""

from flask import Blueprint

sources_bp = Blueprint("sources", __name__)


@sources_bp.route("/sources")
def list_sources():
    """新闻源列表"""
    return "新闻源列表 - 待实现"


@sources_bp.route("/sources/add", methods=["GET", "POST"])
def add_source():
    """添加新闻源"""
    return "添加新闻源 - 待实现"


@sources_bp.route("/sources/<int:source_id>/edit", methods=["GET", "POST"])
def edit_source(source_id):
    """编辑新闻源"""
    return f"编辑新闻源 {source_id} - 待实现"


@sources_bp.route("/sources/<int:source_id>/delete", methods=["POST"])
def delete_source(source_id):
    """删除新闻源"""
    return f"删除新闻源 {source_id} - 待实现"
