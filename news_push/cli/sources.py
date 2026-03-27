"""新闻源管理命令"""

import click
import json
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
from click import group

from news_push.storage.database import DatabaseManager

console = Console()
source_commands = group()


@source_commands.command("add")
def add_source():
    """添加新闻源"""
    console.print(Panel.fit("[bold cyan]添加新闻源[/bold cyan]"))

    # 加载数据库
    db = DatabaseManager()
    user_email = _get_default_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    user = db.get_user(user_email)
    if not user:
        console.print("[red]✗ 用户不存在[/red]")
        return

    # 交互式输入
    console.print("\n[yellow]请输入新闻源信息[/yellow]")

    name = Prompt.ask("新闻源名称", console=console)
    source_type = Prompt.ask(
        "新闻源类型",
        choices=["rss", "api", "scraper"],
        default="rss",
        console=console
    )
    url = Prompt.ask("URL", console=console)

    # 额外配置
    config = {}
    if source_type == "api":
        api_key = Prompt.ask("API Key", password=True, console=console)
        config["api_key"] = api_key

        source = Prompt.ask("数据源（如 tech, general 等）", default="general", console=console)
        config["source"] = source

    elif source_type == "scraper":
        article_selector = Prompt.ask("文章选择器（CSS）", default="article", console=console)
        config["article_selector"] = article_selector

        title_selector = Prompt.ask("标题选择器（CSS）", default="h2", console=console)
        config["title_selector"] = title_selector

        max_articles = Prompt.ask("最大文章数", default="20", console=console)
        config["max_articles"] = int(max_articles)

    # 保存到数据库
    session = db.get_session()
    try:
        from news_push.storage.models import Source

        source = Source(
            user_id=user.id,
            name=name,
            type=source_type,
            url=url,
            fetch_config=json.dumps(config) if config else None,
        )
        session.add(source)
        session.commit()

        console.print(f"[green]✅ 新闻源添加成功: {name}[/green]")
    except Exception as e:
        session.rollback()
        console.print(f"[red]✗ 添加失败: {e}[/red]")
    finally:
        session.close()


@source_commands.command("list")
def list_sources():
    """列出所有新闻源"""
    db = DatabaseManager()
    user_email = _get_default_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    user = db.get_user(user_email)
    if not user:
        console.print("[red]✗ 用户不存在[/red]")
        return

    session = db.get_session()
    try:
        from news_push.storage.models import Source

        sources = session.query(Source).filter(Source.user_id == user.id).all()

        if not sources:
            console.print("[yellow]没有配置新闻源[/yellow]")
            return

        table = Table(title="新闻源列表")
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("类型", style="yellow")
        table.add_column("URL", style="blue")
        table.add_column("状态", style="white")

        for source in sources:
            status = "✅ 激活" if source.is_active else "❌ 停用"
            table.add_row(
                str(source.id),
                source.name,
                source.type,
                source.url[:50] + "..." if len(source.url) > 50 else source.url,
                status,
            )

        console.print(table)
    finally:
        session.close()


@source_commands.command("remove")
@click.argument("name")
def remove_source(name):
    """删除新闻源"""
    db = DatabaseManager()
    user_email = _get_default_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    user = db.get_user(user_email)
    if not user:
        console.print("[red]✗ 用户不存在[/red]")
        return

    session = db.get_session()
    try:
        from news_push.storage.models import Source

        source = session.query(Source).filter(
            Source.user_id == user.id,
            Source.name == name
        ).first()

        if not source:
            console.print(f"[red]✗ 新闻源不存在: {name}[/red]")
            return

        if not Confirm.ask(f"确认删除新闻源 '{name}'？", console=console):
            console.print("[yellow]已取消[/yellow]")
            return

        session.delete(source)
        session.commit()

        console.print(f"[green]✅ 新闻源已删除: {name}[/green]")
    except Exception as e:
        session.rollback()
        console.print(f"[red]✗ 删除失败: {e}[/red]")
    finally:
        session.close()


@source_commands.command("test")
@click.argument("name")
def test_source(name):
    """测试新闻源"""
    console.print(f"[yellow]测试新闻源: {name}[/yellow]")
    console.print("[yellow]功能开发中...[/yellow]")


def _get_default_user_email(db: DatabaseManager) -> str | None:
    """获取默认用户邮箱"""
    # 简化版：返回第一个用户
    session = db.get_session()
    try:
        from news_push.storage.models import User
        user = session.query(User).first()
        return user.email if user else None
    finally:
        session.close()
