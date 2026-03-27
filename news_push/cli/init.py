"""初始化命令"""

import os
import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from news_push.storage.database import DatabaseManager
from news_push.storage.security import SecureStorage

console = Console()


@click.command()
def init_command():
    """初始化新闻推送系统配置"""
    console.print("\n[bold cyan]🚀 初始化新闻推送系统[/bold cyan]\n")

    # 1. 生成加密密钥
    console.print("[yellow]1. 生成加密密钥...[/yellow]")
    encryption_key = SecureStorage.generate_key()
    console.print(f"[green]✓[/green] 加密密钥已生成: {encryption_key[:20]}...\n")

    # 2. 创建 .env 文件
    console.print("[yellow]2. 创建配置文件...[/yellow]")
    env_path = ".env"

    if os.path.exists(env_path):
        if not click.confirm("配置文件 .env 已存在，是否覆盖？"):
            console.print("[yellow]跳过配置文件创建[/yellow]\n")
            # 从现有文件读取加密密钥
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('NEWS_PUSH_ENCRYPTION_KEY='):
                        encryption_key = line.split('=')[1].strip()
                        break
        else:
            console.print("[yellow]将备份现有配置文件为 .env.backup[/yellow]")
            os.replace(env_path, env_path + ".backup")

    # 3. 收集邮箱配置
    console.print("[yellow]3. 配置邮箱服务...[/yellow]")
    console.print("[dim]请输入您的SMTP邮箱配置（用于发送新闻推送）[/dim]\n")

    email = click.prompt("接收邮箱", type=str)
    smtp_host = click.prompt("SMTP服务器", default="smtp.gmail.com")
    smtp_port = click.prompt("SMTP端口", default=587, type=int)
    smtp_username = click.prompt("SMTP用户名", default=email)
    smtp_password = click.prompt("SMTP密码", hide_input=True)
    smtp_use_tls = click.confirm("使用TLS加密？", default=True)

    # 4. 收集AI配置（可选）
    console.print("\n[yellow]4. 配置AI服务（可选）...[/yellow]")
    console.print("[dim]AI服务用于智能分类和摘要新闻（可稍后配置）[/dim]\n")

    use_ai = click.confirm("是否现在配置AI服务？", default=False)

    ai_provider = None
    ai_api_key = None
    ai_model = None

    if use_ai:
        ai_provider = click.prompt(
            "AI服务提供商",
            type=click.Choice(["openai", "anthropic", "openrouter"]),
            default="openai"
        )
        ai_api_key = click.prompt("API密钥", hide_input=True)
        ai_model = click.prompt("模型名称", default="gpt-4o-mini")

    # 5. 创建数据库
    console.print(f"\n[yellow]5. 创建数据库...[/yellow]")
    db_path = os.getenv("NEWS_PUSH_DB_PATH", "news_push.db")
    db_manager = DatabaseManager(db_path)
    db_manager.create_tables()
    console.print(f"[green]✓[/green] 数据库已创建: {db_path}\n")

    # 6. 创建用户
    console.print("[yellow]6. 创建用户...[/yellow]")
    try:
        user = db_manager.create_user(
            email=email,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_username=smtp_username,
            smtp_password=smtp_password,
            smtp_use_tls=smtp_use_tls,
            ai_provider=ai_provider,
            ai_api_key=ai_api_key,
            ai_model=ai_model
        )
        console.print(f"[green]✓[/green] 用户已创建: {email}\n")
    except Exception as e:
        console.print(f"[red]✗[/red] 创建用户失败: {e}\n")
        raise click.Abort()

    # 7. 写入 .env 文件
    console.print("[yellow]7. 写入配置文件...[/yellow]")
    with open(env_path, 'w') as f:
        f.write(f"# 新闻推送系统配置\n")
        f.write(f"# 生成时间: {click.datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"# 加密密钥（请妥善保管）\n")
        f.write(f"NEWS_PUSH_ENCRYPTION_KEY={encryption_key}\n\n")
        f.write(f"# 数据库路径\n")
        f.write(f"NEWS_PUSH_DB_PATH={db_path}\n\n")
        f.write(f"# 日志级别\n")
        f.write(f"LOG_LEVEL=INFO\n")

    console.print(f"[green]✓[/green] 配置文件已创建: {env_path}\n")

    # 8. 显示配置摘要
    console.print("[bold cyan]📋 配置摘要[/bold cyan]\n")

    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("配置项", style="cyan")
    table.add_column("值")

    table.add_row("接收邮箱", email)
    table.add_row("SMTP服务器", f"{smtp_host}:{smtp_port}")
    table.add_row("TLS加密", "是" if smtp_use_tls else "否")
    table.add_row("AI服务", ai_provider or "未配置")
    table.add_row("数据库", db_path)
    table.add_row("加密密钥", f"{encryption_key[:20]}...")

    console.print(table)

    # 9. 下一步提示
    console.print("\n[bold green]✅ 初始化完成！[/bold green]\n")

    console.print(Panel(
        "[bold cyan]下一步操作：[/bold cyan]\n\n"
        "1. 添加新闻源: [cyan]news-push source add[/cyan]\n"
        "2. 添加过滤器: [cyan]news-push filter add[/cyan]\n"
        "3. 手动发送: [cyan]news-push send run[/cyan]\n"
        "4. 设置定时任务: [cyan]news-push cron setup[/cyan]\n\n"
        "[yellow]提示: 使用 news-push --help 查看所有命令[/yellow]",
        title="[bold]欢迎使用新闻推送系统[/bold]",
        border_style="cyan"
    ))
