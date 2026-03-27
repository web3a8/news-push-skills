"""新闻推送 CLI - 主入口"""

import click
from rich.console import Console

from news_push.cli.init import init_command
from news_push.cli import source_commands, filter_commands, send_commands, cron_commands
from news_push.cli.web import web_command  # 新增

console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="news-push")
@click.pass_context
def cli(ctx):
    """新闻推送系统 - 自动获取新闻热点并推送到邮箱

    \b
    使用示例:
      news-push init              初始化配置
      news-push source add        添加新闻源
      news-push filter add        添加过滤器
      news-push send run          立即发送
      news-push cron setup        设置定时任务
      news-push web               启动 Web UI

    \b
    获取帮助:
      news-push --help            查看所有命令
      news-push source --help     查看source子命令
    """
    ctx.ensure_object(dict)


# 添加init命令
cli.add_command(init_command, name="init")

# 添加命令组
cli.add_command(source_commands, name="source")
cli.add_command(filter_commands, name="filter")
cli.add_command(send_commands, name="send")
cli.add_command(cron_commands, name="cron")

# 添加web命令
cli.add_command(web_command, name="web")  # 新增


if __name__ == "__main__":
    cli()
