"""Cron 任务管理命令"""

import os
import click
from pathlib import Path
from rich.console import Console
from rich.panel import Panel

console = Console()


@click.group()
def cron_commands():
    """Cron 任务管理命令"""
    pass


@cron_commands.command("install")
@click.option("--schedule", default="0 9 * * *", help="Cron 表达式，默认为每天 9 点")
def install_cron(schedule):
    """
    安装 cron 任务

    示例:
        每天 9 点: 0 9 * * *
        每小时: 0 * * * *
        每 6 小时: 0 */6 * * *
    """
    console.print(Panel.fit("[bold cyan]安装 Cron 任务[/bold cyan]"))

    # 获取脚本路径
    script_path = Path(__file__).parent.parent.parent.parent / "main.py"
    if not script_path.exists():
        console.print(f"[red]✗ 找不到脚本: {script_path}[/red]")
        return

    # 获取用户邮箱
    from news_push.storage.database import DatabaseManager
    db = DatabaseManager()
    session = db.get_session()
    try:
        from news_push.storage.models import User
        user = session.query(User).first()
        if not user:
            console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
            return
        user_email = user.email
    finally:
        session.close()

    # 生成 cron 命令
    cron_cmd = f"{schedule} cd {Path.cwd()} && /usr/bin/python3 {script_path} send now >> /tmp/news_push.log 2>&1\n"

    # 写入临时文件
    temp_cron = Path("/tmp/news_push_cron")
    temp_cron.write_text(cron_cmd)

    console.print(f"\n[yellow]Cron 任务信息[/yellow]:")
    console.print(f"  调度: {schedule}")
    console.print(f"  用户: {user_email}")
    console.print(f"  脚本: {script_path}")
    console.print()
    console.print(f"[green]请手动添加以下内容到 crontab -e:[/green]")
    console.print(f"[cyan]{cron_cmd.strip()}[/cyan]")


@cron_commands.command("uninstall")
def uninstall_cron():
    """卸载 cron 任务"""
    console.print("[yellow]请使用 'crontab -e' 手动删除相关任务[/yellow]")


@cron_commands.command("show")
def show_cron():
    """显示当前的 cron 任务"""
    console.print("[yellow]使用 'crontab -l' 查看当前任务[/yellow]")
