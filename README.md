# News Push Skill

A skill for fetching, filtering, and pushing news to various channels.

## Features

- Fetch news from RSS feeds, Twitter, and webhooks
- Filter articles based on keywords, categories, and authors
- Push news to WeChat, email, and other channels
- Secure storage with encryption for sensitive data
- Scheduled fetching with cron support

## Installation

```bash
pip install -e .
```

## Development

```bash
pip install -e ".[dev]"
pytest tests/ -v
```

## Configuration

Copy `.env.example` to `.env` and configure your environment variables.

## License

MIT
