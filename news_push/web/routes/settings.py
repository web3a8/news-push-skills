"""系统设置路由"""

from flask import Blueprint, render_template, request, flash, redirect, url_for

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings", methods=["GET", "POST"])
def settings():
    """系统设置"""
    from news_push.storage.database import DatabaseManager

    db = DatabaseManager()
    # 获取第一个用户（单用户应用）
    users = db.get_session().query(db.User).all()

    if not users:
        flash("用户不存在，请先运行初始化", "error")
        return redirect(url_for("home.index"))

    user = users[0]

    if request.method == "POST":
        # 获取表单数据
        email = request.form.get("email", "").strip()
        smtp_host = request.form.get("smtp_host", "").strip()
        smtp_port = request.form.get("smtp_port", "587")
        smtp_username = request.form.get("smtp_username", "").strip()
        smtp_password = request.form.get("smtp_password", "").strip()

        # 验证
        if not email:
            flash("邮箱不能为空", "error")
            return render_template("settings/form.html", user=user)

        if not smtp_host:
            flash("SMTP 主机不能为空", "error")
            return render_template("settings/form.html", user=user)

        try:
            smtp_port = int(smtp_port)
            if smtp_port < 1 or smtp_port > 65535:
                flash("SMTP 端口必须在 1-65535 之间", "error")
                return render_template("settings/form.html", user=user)
        except ValueError:
            flash("SMTP 端口必须是数字", "error")
            return render_template("settings/form.html", user=user)

        # 更新配置（密码加密存储）
        try:
            if smtp_password:
                user.email = email
                user.smtp_host = smtp_host
                user.smtp_port = smtp_port
                user.smtp_username = smtp_username
                user.smtp_password = db.secure.encrypt(smtp_password)
            else:
                user.email = email
                user.smtp_host = smtp_host
                user.smtp_port = smtp_port
                user.smtp_username = smtp_username

            session = db.get_session()
            session.commit()
            session.close()

            flash("设置保存成功", "success")
            # 重新获取用户信息
            user = db.get_session().query(db.User).first()
        except Exception as e:
            db.get_session().rollback()
            flash(f"保存失败：{str(e)}", "error")

    return render_template("settings/form.html", user=user)
