"""
Setup configuration for news-push-skill.
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="news-push-skill",
    version="0.1.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="A skill for fetching, filtering, and pushing news to various channels",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/news-push-skill",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.9",
    install_requires=[
        "sqlalchemy>=2.0.0",
        "alembic>=1.12.0",
        "feedparser>=6.0.10",
        "requests>=2.31.0",
        "beautifulsoup4>=4.12.0",
        "playwright>=1.40.0",
        "jinja2>=3.1.2",
        "premailer>=3.10.0",
        "anthropic>=0.18.0",
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "python-dotenv>=1.0.0",
        "click>=8.1.0",
        "rich>=13.7.0",
        "loguru>=0.7.2",
        "croniter>=2.0.0",
        "cryptography>=41.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.12.0",
            "ruff>=0.1.0",
            "mypy>=1.7.0",
            "pytest-mock>=3.12.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "news-push=news_push.main:cli",
        ],
    },
)
