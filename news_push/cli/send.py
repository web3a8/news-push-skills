"""发送相关命令"""

import click
from rich.console import Console
from rich.panel import Panel

from news_push.storage.database import DatabaseManager
from news_push.core.pipeline import PipelineOrchestrator

console = Console()


@click.group()
def send_commands():
    """发送相关命令"""
    pass


@send_commands.command("test")
def test_send():
    """测试抓取（不发送邮件）"""
    console.print(Panel.fit("[bold cyan]测试抓取[/bold cyan]"))

    db = DatabaseManager()
    user_email = _get_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    orchestrator = PipelineOrchestrator(db)
    result = orchestrator.run(user_email, dry_run=True)

    if result.get("success"):
        console.print(f"[green]✅ 测试成功！抓取了 {result['articles_count']} 篇文章[/green]")
    else:
        console.print(f"[red]✗ 测试失败: {result.get('error')}[/red]")


@send_commands.command("now")
def send_now():
    """立即抓取并发送邮件"""
    console.print(Panel.fit("[bold cyan]立即发送[/bold cyan]"))

    db = DatabaseManager()
    user_email = _get_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    orchestrator = PipelineOrchestrator(db)
    result = orchestrator.run(user_email, dry_run=False)

    if result.get("success"):
        console.print(f"[green]✅ 发送成功！发送了 {result['articles_count']} 篇文章[/green]")
    else:
        console.print(f"[red]✗ 发送失败: {result.get('error')}[/red]")


@send_commands.command("preview")
def preview_email():
    """预览邮件内容"""
    console.print("[yellow]预览邮件功能开发中...[/yellow]")


def _get_user_email(db: DatabaseManager) -> str | None:
    """获取用户邮箱"""
    session = db.get_session()
    try:
        from news_push.storage.models import User
        user = session.query(User).first()
        return user.email if user else None
    finally:
        session.close()
