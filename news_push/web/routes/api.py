"""API 路由"""

from flask import Blueprint, jsonify, request
from news_push.storage.database import DatabaseManager

api_bp = Blueprint("api", __name__)


@api_bp.route("/api/sources", methods=["GET"])
def get_sources():
    """获取所有新闻源（JSON API）"""
    db = DatabaseManager()
    sources = db.get_sources()

    return jsonify([{
        "id": s.id,
        "name": s.name,
        "url": s.url,
        "type": s.type,
        "update_interval": s.fetch_interval,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None
    } for s in sources])


@api_bp.route("/api/sources", methods=["POST"])
def create_source():
    """创建新闻源（JSON API）"""
    data = request.get_json()

    name = data.get("name", "").strip()
    url = data.get("url", "").strip()
    source_type = data.get("source_type", "rss")
    update_interval = data.get("update_interval", 60)

    # 验证
    if not name:
        return jsonify({"error": "名称不能为空"}), 400
    if not url:
        return jsonify({"error": "URL 不能为空"}), 400

    try:
        update_interval = int(update_interval)
        if update_interval < 1:
            return jsonify({"error": "更新频率必须大于 0"}), 400
    except ValueError:
        return jsonify({"error": "更新频率必须是数字"}), 400

    # 保存到数据库
    db = DatabaseManager()
    try:
        source = db.create_source(
            name=name,
            url=url,
            source_type=source_type,
            update_interval=update_interval
        )

        # 立即抓取一次
        try:
            from news_push.fetchers.adapter import SimpleFetcher

            fetcher = SimpleFetcher(name=name, url=url)
            articles = fetcher.fetch()

            saved_count = 0
            for article in articles:
                created = db.create_article(
                    source_id=source.id,
                    title=article.title,
                    url=article.url,
                    content=article.content,
                    summary=article.summary,
                    author=article.author,
                    published_at=article.published_at
                )
                if created:
                    saved_count += 1

            return jsonify({
                "success": True,
                "message": f"新闻源 '{name}' 添加成功，已抓取 {saved_count} 篇文章",
                "source": {
                    "id": source.id,
                    "name": source.name,
                    "url": source.url,
                    "type": source.type
                }
            })
        except Exception as fetch_error:
            return jsonify({
                "success": True,
                "message": f"新闻源 '{name}' 添加成功，但抓取失败",
                "source": {
                    "id": source.id,
                    "name": source.name,
                    "url": source.url,
                    "type": source.type
                }
            })
    except Exception as e:
        return jsonify({"error": f"添加失败：{str(e)}"}), 500


@api_bp.route("/api/sources/<int:source_id>", methods=["DELETE"])
def delete_source(source_id):
    """删除新闻源（JSON API）"""
    db = DatabaseManager()
    try:
        db.delete_source(source_id)
        return jsonify({"success": True, "message": "新闻源已删除"})
    except Exception as e:
        return jsonify({"error": f"删除失败：{str(e)}"}), 500
