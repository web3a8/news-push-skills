"""Flask Web 应用模块"""

from flask import Flask


def nl2br(text):
    """将换行符转换为 <br> 标签"""
    if text:
        return text.replace("\n", "<br>")
    return ""


def create_app():
    """
    Flask 应用工厂函数

    Returns:
        Flask 应用实例
    """
    app = Flask(__name__)

    # 配置
    app.config["SECRET_KEY"] = "dev-secret-key-change-in-production"
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max

    # 注册自定义过滤器
    app.jinja_env.filters["nl2br"] = nl2br

    # 注册蓝图
    from news_push.web.routes import home_bp, sources_bp, articles_bp, settings_bp
    app.register_blueprint(home_bp)
    app.register_blueprint(sources_bp)
    app.register_blueprint(articles_bp)
    app.register_blueprint(settings_bp)

    return app
