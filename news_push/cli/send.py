"""发送命令"""

import click
from rich.console import Console

console = Console()


@click.group(name="send")
def send_commands():
    """发送新闻推送"""
    pass


@send_commands.command(name="run")
def send_run():
    """立即执行新闻推送"""
    console.print("[yellow]功能开发中...[/yellow]")
    console.print("[dim]此功能将在后续版本实现[/dim]\n")


@send_commands.command(name="preview")
def send_preview():
    """预览即将发送的内容"""
    console.print("[yellow]功能开发中...[/yellow]")
    console.print("[dim]此功能将在后续版本实现[/dim]\n")


@send_commands.command(name="history")
@click.option("--limit", default=10, help="显示条数")
def send_history(limit):
    """查看发送历史

    LIMIT: 显示条数，默认10条
    """
    console.print("[yellow]功能开发中...[/yellow]")
    console.print("[dim]此功能将在后续版本实现[/dim]\n")


@send_commands.command(name="test")
def send_test():
    """发送测试邮件"""
    console.print("[yellow]功能开发中...[/yellow]")
    console.print("[dim]此功能将在后续版本实现[/dim]\n")
