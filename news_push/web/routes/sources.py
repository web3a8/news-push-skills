"""新闻源管理路由"""

import re
from flask import Blueprint, render_template, flash, redirect, url_for, request
from news_push.storage.database import DatabaseManager

sources_bp = Blueprint("sources", __name__)


@sources_bp.route("/sources")
def list_sources():
    """新闻源列表"""
    db = DatabaseManager()
    sources = db.get_sources()
    return render_template("sources/list.html", sources=sources)


@sources_bp.route("/sources/add", methods=["GET", "POST"])
def add_source():
    """添加新闻源"""
    if request.method == "POST":
        # 获取表单数据
        name = request.form.get("name", "").strip()
        url = request.form.get("url", "").strip()
        source_type = request.form.get("source_type", "rss")
        update_interval = request.form.get("update_interval", "60")

        # 验证
        if not name:
            flash("名称不能为空", "error")
            return render_template("sources/form.html", form_data=request.form)

        if not url:
            flash("URL 不能为空", "error")
            return render_template("sources/form.html", form_data=request.form)

        # URL 格式验证
        url_pattern = re.compile(
            r"^https?://"  # http:// or https://
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain
            r"localhost|"  # localhost
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # IP
            r"(?::\d+)?"  # optional port
            r"(?:/?|[/?]\S+)$", re.IGNORECASE
        )

        if not url_pattern.match(url):
            flash("URL 格式不正确", "error")
            return render_template("sources/form.html", form_data=request.form)

        try:
            update_interval = int(update_interval)
            if update_interval < 1:
                flash("更新频率必须大于 0", "error")
                return render_template("sources/form.html", form_data=request.form)
        except ValueError:
            flash("更新频率必须是数字", "error")
            return render_template("sources/form.html", form_data=request.form)

        # 保存到数据库
        db = DatabaseManager()
        try:
            db.create_source(
                name=name,
                url=url,
                source_type=source_type,
                update_interval=update_interval
            )
            flash(f"新闻源 '{name}' 添加成功", "success")
            return redirect(url_for("sources.list_sources"))
        except Exception as e:
            flash(f"添加失败：{str(e)}", "error")
            return render_template("sources/form.html", form_data=request.form)

    return render_template("sources/form.html")


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
