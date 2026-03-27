"""过滤规则管理命令"""

import click
from rich.console import Console
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.panel import Panel

from news_push.storage.database import DatabaseManager

console = Console()


@click.group()
def filter_commands():
    """过滤规则管理命令"""
    pass


@filter_commands.command("add")
def add_filter():
    """添加过滤规则"""
    console.print(Panel.fit("[bold cyan]添加过滤规则[/bold cyan]"))

    db = DatabaseManager()
    user_email = _get_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    user = db.get_user(user_email)
    if not user:
        console.print("[red]✗ 用户不存在[/red]")
        return

    # 交互式输入
    name = Prompt.ask("规则名称", console=console)
    filter_type = Prompt.ask(
        "规则类型",
        choices=["keyword", "category", "regex"],
        default="keyword",
        console=console
    )
    rule = Prompt.ask("规则内容", console=console)
    action = Prompt.ask(
        "动作",
        choices=["include", "exclude"],
        default="exclude",
        console=console
    )

    # 保存到数据库
    session = db.get_session()
    try:
        from news_push.storage.models import Filter

        f = Filter(
            user_id=user.id,
            name=name,
            type=filter_type,
            rule=rule,
            action=action,
        )
        session.add(f)
        session.commit()

        console.print(f"[green]✅ 过滤规则添加成功: {name}[/green]")
    except Exception as e:
        session.rollback()
        console.print(f"[red]✗ 添加失败: {e}[/red]")
    finally:
        session.close()


@filter_commands.command("list")
def list_filters():
    """列出所有过滤规则"""
    db = DatabaseManager()
    user_email = _get_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    user = db.get_user(user_email)
    if not user:
        console.print("[red]✗ 用户不存在[/red]")
        return

    session = db.get_session()
    try:
        from news_push.storage.models import Filter

        filters = session.query(Filter).filter(Filter.user_id == user.id).all()

        if not filters:
            console.print("[yellow]没有配置过滤规则[/yellow]")
            return

        table = Table(title="过滤规则列表")
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("类型", style="yellow")
        table.add_column("规则", style="blue")
        table.add_column("动作", style="white")

        for f in filters:
            table.add_row(
                str(f.id),
                f.name,
                f.type,
                f.rule[:30] + "..." if len(f.rule) > 30 else f.rule,
                "✅ 包含" if f.action == "include" else "❌ 排除",
            )

        console.print(table)
    finally:
        session.close()


@filter_commands.command("remove")
@click.argument("id", type=int)
def remove_filter(id):
    """删除过滤规则"""
    db = DatabaseManager()
    user_email = _get_user_email(db)
    if not user_email:
        console.print("[red]✗ 请先运行 /news init 初始化配置[/red]")
        return

    user = db.get_user(user_email)
    if not user:
        console.print("[red]✗ 用户不存在[/red]")
        return

    session = db.get_session()
    try:
        from news_push.storage.models import Filter

        f = session.query(Filter).filter(
            Filter.user_id == user.id,
            Filter.id == id
        ).first()

        if not f:
            console.print(f"[red]✗ 过滤规则不存在: ID={id}[/red]")
            return

        if not Confirm.ask(f"确认删除过滤规则 '{f.name}'？", console=console):
            console.print("[yellow]已取消[/yellow]")
            return

        session.delete(f)
        session.commit()

        console.print(f"[green]✅ 过滤规则已删除: {f.name}[/green]")
    except Exception as e:
        session.rollback()
        console.print(f"[red]✗ 删除失败: {e}[/red]")
    finally:
        session.close()


def _get_user_email(db: DatabaseManager) -> str | None:
    """获取用户邮箱"""
    session = db.get_session()
    try:
        from news_push.storage.models import User
        user = session.query(User).first()
        return user.email if user else None
    finally:
        session.close()
