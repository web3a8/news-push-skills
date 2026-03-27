"""路由蓝图包"""

from news_push.web.routes.home import home_bp
from news_push.web.routes.sources import sources_bp
from news_push.web.routes.articles import articles_bp
from news_push.web.routes.settings import settings_bp
from news_push.web.routes.api import api_bp

__all__ = ["home_bp", "sources_bp", "articles_bp", "settings_bp", "api_bp"]
