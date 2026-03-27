"""Web UI CLI 命令"""

import click
from dotenv import load_dotenv


@click.command()
@click.option("--port", default=5000, help="端口号", type=int)
@click.option("--host", default="127.0.0.1", help="主机地址")
@click.option("--debug", is_flag=True, help="调试模式")
def web_command(port, host, debug):
    """启动 Web 管理界面"""
    # 自动加载 .env 文件
    load_dotenv()

    from news_push.web import create_app

    app = create_app()
    url = f"http://{host}:{port}"

    click.echo(f"🚀 Web UI 启动成功: {url}")
    click.echo("按 Ctrl+C 停止服务")

    app.run(host=host, port=port, debug=debug)
