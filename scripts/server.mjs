#!/usr/bin/env node
/**
 * server.mjs — Local HTTP workspace for News Push.
 *
 * Usage:
 *   node scripts/server.mjs
 *   node scripts/server.mjs --page /config
 *   node scripts/server.mjs --port 7789 --no-open
 */

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, extname } from "node:path";
import { exec } from "node:child_process";
import { ensureRuntimeWorkspace, readCurrentJob, resolveJobPaths } from "../lib/runtime-paths.mjs";
import { readUiState } from "../lib/ui-state.mjs";
import { NEWS_PUSH_VERSION } from "../lib/version.mjs";

const PATHS = ensureRuntimeWorkspace();
const OPML_PATH = PATHS.feedsPath;
const OUTPUT_DIR = PATHS.outputDir;
const FOCUS_PATH = PATHS.focusPath;
const DEFAULT_PORT = 7789;

if (PATHS.runtimeRoot === PATHS.packageRoot && process.env.NEWS_PUSH_ALLOW_PACKAGE_ROOT !== "1") {
  console.error("请通过 news-push serve --workspace \"$PWD\" 或 bin/news-push --workspace \"$PWD\" 启动本地工作台，不要直接运行 scripts/server.mjs。");
  process.exit(1);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function parseArgs(argv) {
  const opts = {
    port: DEFAULT_PORT,
    page: "/",
    openBrowser: process.env.NEWS_PUSH_DISABLE_BROWSER !== "1",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--port":
        opts.port = Number(argv[++i] || opts.port) || opts.port;
        break;
      case "--page":
        opts.page = argv[++i] || opts.page;
        break;
      case "--no-open":
        opts.openBrowser = false;
        break;
      default:
        if (arg.startsWith("/")) {
          opts.page = arg;
        }
        break;
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function readJson(pathname, fallback) {
  if (!existsSync(pathname)) return fallback;
  try {
    return JSON.parse(readFileSync(pathname, "utf-8"));
  } catch {
    return fallback;
  }
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function formatDisplayTime(value) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function readPreviewArticles(paths = PATHS, limit = 120) {
  const slimPath = paths.jobSlimArticlesPath || paths.slimArticlesPath;
  const articlesPath = paths.jobArticlesPath || paths.articlesPath;
  const sourcePath = existsSync(slimPath) ? slimPath : articlesPath;
  const raw = readJson(sourcePath, []);
  const articles = Array.isArray(raw) ? raw : [];

  const normalized = articles.map((article, index) => {
    const publishedAt = article.published_at || article.pubDate || article.isoDate || article.date || article.fetched_at || "";
    const source = article.feed_title || article.source || article.feed || article.site_name || "未知信源";
    const excerpt = stripHtml(
      article.summary || article.description || article.content_text || article.content || article.excerpt || "",
    );
    const sortTs = Number.isNaN(Date.parse(publishedAt)) ? 0 : Date.parse(publishedAt);

    return {
      key: `${source}-${index}`,
      title: article.title || "未命名文章",
      link: article.link || "",
      source,
      publishedAt,
      displayTime: formatDisplayTime(publishedAt),
      excerpt: truncate(excerpt, 180),
      sortTs,
    };
  });

  normalized.sort((a, b) => b.sortTs - a.sortTs);

  return {
    total: normalized.length,
    sourceCount: new Set(normalized.map((item) => item.source)).size,
    truncated: normalized.length > limit,
    items: normalized.slice(0, limit),
  };
}

function readServerState() {
  return readJson(PATHS.serverStatePath, null);
}

function writeServerState(port) {
  const state = {
    pid: process.pid,
    port,
    url: `http://127.0.0.1:${port}/`,
    runtimeRoot: PATHS.runtimeRoot,
    serverVersion: NEWS_PUSH_VERSION,
    supportsJobRoutes: true,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(PATHS.serverStatePath, JSON.stringify(state, null, 2), "utf-8");
  return state;
}

function clearServerState() {
  try {
    if (existsSync(PATHS.serverStatePath)) {
      unlinkSync(PATHS.serverStatePath);
    }
  } catch {
    // Best effort cleanup.
  }
}

function currentJobId() {
  return readCurrentJob(PATHS) || "";
}

function getJobPaths(jobId) {
  return resolveJobPaths(PATHS, jobId);
}

function readDashboardState(paths = PATHS) {
  return readUiState({
    uiStatePath: paths.jobUiStatePath || paths.uiStatePath,
    latestHtmlPath: paths.jobLatestHtmlPath || paths.latestHtmlPath,
  });
}

function shouldServeFinalReport(state, paths = PATHS) {
  const htmlPath = paths.jobLatestHtmlPath || paths.latestHtmlPath;
  return (state.phase === "completed" || state.phase === "idle") && existsSync(htmlPath);
}

// ---------------------------------------------------------------------------
// OPML helpers
// ---------------------------------------------------------------------------

function parseFeeds() {
  if (!existsSync(OPML_PATH)) return [];
  const xml = readFileSync(OPML_PATH, "utf-8");
  const feeds = [];
  const re = /<outline\s+([^>]+)>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const attrs = match[1];
    const textMatch = attrs.match(/text="([^"]*)"/);
    const urlMatch = attrs.match(/xmlUrl="([^"]*)"/);
    if (textMatch && urlMatch) {
      feeds.push({ name: textMatch[1], url: urlMatch[1] });
    }
  }
  return feeds;
}

function writeFeedsOpml(feeds) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="1.0">',
    "  <head>",
    "    <title>News Push Feeds</title>",
    "  </head>",
    "  <body>",
  ];
  for (const feed of feeds) {
    lines.push(`    <outline text="${escapeXml(feed.name)}" xmlUrl="${escapeXml(feed.url)}"/>`);
  }
  lines.push("  </body>");
  lines.push("</opml>");
  writeFileSync(OPML_PATH, lines.join("\n") + "\n", "utf-8");
}

function addFeed(name, url) {
  const feeds = parseFeeds();
  if (feeds.some((feed) => feed.url === url)) return false;
  feeds.push({ name, url });
  writeFeedsOpml(feeds);
  return true;
}

function removeFeed(name) {
  const feeds = parseFeeds();
  const filtered = feeds.filter((feed) => feed.name !== name);
  if (filtered.length === feeds.length) return false;
  writeFeedsOpml(filtered);
  return true;
}

// ---------------------------------------------------------------------------
// Focus helpers
// ---------------------------------------------------------------------------

function readFocus() {
  if (!existsSync(FOCUS_PATH)) return { preference: "", updated_at: "" };
  const text = readFileSync(FOCUS_PATH, "utf-8");
  const prefMatch = text.match(/^preference:\s*["']?(.+?)["']?\s*$/m);
  const dateMatch = text.match(/^updated_at:\s*["']?(.+?)["']?\s*$/m);
  return {
    preference: prefMatch ? prefMatch[1] : "",
    updated_at: dateMatch ? dateMatch[1] : "",
  };
}

function writeFocus(preference) {
  const updated_at = new Date().toISOString();
  const yaml = `preference: "${preference.replace(/"/g, '\\"')}"\nupdated_at: "${updated_at}"\n`;
  writeFileSync(FOCUS_PATH, yaml, "utf-8");
  return { preference, updated_at };
}

// ---------------------------------------------------------------------------
// Feed tester
// ---------------------------------------------------------------------------

async function testFeed(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "news-push/1.0 (RSS reader)" },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }

    const text = await resp.text();
    const isFeed = text.includes("<rss") || text.includes("<feed") || text.includes("<channel");
    if (!isFeed) {
      return { ok: false, error: "Response is not a valid RSS/Atom feed" };
    }

    const itemCount = (text.match(/<item[\s>]/g) || []).length || (text.match(/<entry[\s>]/g) || []).length;
    return { ok: true, itemCount };
  } catch (err) {
    return { ok: false, error: err.message || "Fetch failed" };
  }
}

// ---------------------------------------------------------------------------
// Dynamic HTML
// ---------------------------------------------------------------------------

function pendingPageHtml(paths, jobId) {
  const state = readDashboardState(paths);
  const preview = readPreviewArticles(paths);
  const jobReportHref = jobId ? `/jobs/${encodeURIComponent(jobId)}/report` : "/report";
  const stateApiUrl = jobId ? `/api/jobs/${encodeURIComponent(jobId)}/state` : "/api/state";
  const reloadUrl = jobId ? `/jobs/${encodeURIComponent(jobId)}/report?ts=${Date.now()}` : `/?ts=${Date.now()}`;
  const phaseLabels = {
    preparing: "正在整理原始信息流",
    waiting_for_ai: "AI 正在进行总结和提炼",
    finalizing: "正在生成最终页面",
    failed: "本次运行失败",
  };
  const phaseLabel = phaseLabels[state.phase] || "准备中";
  const statusText = state.statusText || "你可以先浏览原始信息流，AI 完成后本页会自动刷新为最终简报。";
  const statusTone = state.phase === "failed" ? "danger" : state.phase === "finalizing" ? "warm" : "live";
  const updatedAt = formatDisplayTime(state.updatedAt);
  const previewCards = preview.items.length
    ? preview.items.map((item) => {
      const title = escapeHtml(item.title);
      const source = escapeHtml(item.source);
      const excerpt = escapeHtml(item.excerpt || "暂无摘要");
      const time = escapeHtml(item.displayTime);
      const href = item.link ? ` href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer"` : "";
      return `<article class="story-card">
        <div class="story-meta">
          <span class="story-source">${source}</span>
          <span class="story-time">${time}</span>
        </div>
        <h3><a${href}>${title}</a></h3>
        <p>${excerpt}</p>
      </article>`;
    }).join("")
    : `<div class="empty-state">原始信息流还没有准备好，请稍后刷新。</div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>News Push 工作台</title>
    <style>
      :root {
        --paper: #f9f4ea;
        --paper-strong: #fffaf0;
        --ink: #1b1711;
        --muted: #6f6252;
        --line: rgba(74, 55, 36, 0.16);
        --accent: #8d5d33;
        --accent-soft: rgba(141, 93, 51, 0.12);
        --accent-live: #1e7c62;
        --danger: #b94c42;
        --shadow: 0 18px 40px rgba(69, 50, 31, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        font-family: "Iowan Old Style", "Palatino Linotype", "Songti SC", serif;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.65), transparent 35%),
          linear-gradient(180deg, #fbf6ed 0%, #f2eadb 45%, #ece2d1 100%);
      }
      a { color: inherit; }
      .shell {
        width: min(1240px, calc(100vw - 32px));
        margin: 24px auto 48px;
      }
      .hero {
        position: sticky;
        top: 16px;
        z-index: 10;
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(0, 1fr) auto;
        padding: 22px 24px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: rgba(255, 250, 240, 0.86);
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }
      .hero-main h1 {
        margin: 0 0 10px;
        font-size: clamp(1.8rem, 3.2vw, 2.6rem);
      }
      .hero-main p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .hero-actions {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .hero-actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 112px;
        padding: 10px 18px;
        border-radius: 999px;
        border: 1px solid var(--line);
        text-decoration: none;
        background: var(--paper-strong);
        transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      }
      .hero-actions a:hover {
        transform: translateY(-1px);
        border-color: rgba(141, 93, 51, 0.38);
        background: #fff7eb;
      }
      .status-card {
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(0, 1fr) auto;
        margin-top: 18px;
        padding: 22px 24px;
        border-radius: 28px;
        border: 1px solid var(--line);
        background: rgba(255, 250, 240, 0.92);
        box-shadow: var(--shadow);
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.88rem;
        letter-spacing: 0.02em;
      }
      .status-pill[data-tone="live"] { background: rgba(30, 124, 98, 0.12); color: var(--accent-live); }
      .status-pill[data-tone="warm"] { background: rgba(141, 93, 51, 0.12); color: var(--accent); }
      .status-pill[data-tone="danger"] { background: rgba(185, 76, 66, 0.12); color: var(--danger); }
      .status-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 0 0 currentColor;
        animation: pulse 1.8s infinite;
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0,0,0,0.18); }
        70% { box-shadow: 0 0 0 12px rgba(0,0,0,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
      }
      .status-copy h2 {
        margin: 12px 0 8px;
        font-size: clamp(1.35rem, 2.4vw, 1.8rem);
      }
      .status-copy p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(120px, 1fr));
        gap: 12px;
        min-width: 380px;
      }
      .metric {
        padding: 16px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.12));
      }
      .metric-label {
        color: var(--muted);
        font-size: 0.82rem;
      }
      .metric strong {
        display: block;
        margin-top: 8px;
        font-size: 1.45rem;
      }
      .error-panel {
        margin-top: 18px;
        padding: 16px 18px;
        border-radius: 20px;
        border: 1px solid rgba(185, 76, 66, 0.22);
        background: rgba(185, 76, 66, 0.08);
        color: #6f251f;
        line-height: 1.6;
      }
      .stream-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        margin: 28px 0 14px;
      }
      .stream-header h2 {
        margin: 0;
        font-size: clamp(1.2rem, 2.2vw, 1.55rem);
      }
      .stream-header p {
        margin: 0;
        color: var(--muted);
      }
      .story-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 14px;
      }
      .story-card {
        padding: 18px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255, 251, 243, 0.9);
        box-shadow: 0 10px 24px rgba(67, 50, 31, 0.08);
      }
      .story-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 0.82rem;
        color: var(--muted);
      }
      .story-source {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(141, 93, 51, 0.1);
        color: var(--accent);
      }
      .story-card h3 {
        margin: 0 0 10px;
        font-size: 1.05rem;
        line-height: 1.45;
      }
      .story-card h3 a {
        text-decoration: none;
      }
      .story-card h3 a:hover {
        color: var(--accent);
      }
      .story-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
        font-size: 0.94rem;
      }
      .empty-state {
        padding: 28px;
        border-radius: 24px;
        border: 1px dashed var(--line);
        background: rgba(255,255,255,0.45);
        text-align: center;
        color: var(--muted);
      }
      .footer-note {
        margin-top: 16px;
        color: var(--muted);
        font-size: 0.9rem;
      }
      @media (max-width: 920px) {
        .hero,
        .status-card {
          grid-template-columns: 1fr;
        }
        .hero-actions,
        .metrics {
          min-width: 0;
        }
        .metrics {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 640px) {
        .shell {
          width: min(100vw - 20px, 100%);
          margin: 14px auto 32px;
        }
        .hero,
        .status-card {
          padding: 18px;
          border-radius: 22px;
        }
        .hero-actions {
          flex-wrap: wrap;
        }
        .hero-actions a {
          min-width: 0;
          flex: 1;
        }
        .metrics {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="hero-main">
          <h1>News Push 工作台</h1>
          <p>原始信息流已经准备好了。你可以先浏览订阅内容，AI 总结完成后，本页会自动切换到最终简报。</p>
        </div>
        <div class="hero-actions">
          <a href="/config">管理信源</a>
          ${existsSync(paths.jobLatestHtmlPath || paths.latestHtmlPath) ? `<a href="${jobReportHref}" target="_blank" rel="noreferrer">上一份简报</a>` : ""}
        </div>
      </section>

      <section class="status-card">
        <div class="status-copy">
          <span class="status-pill" id="status-pill" data-tone="${statusTone}">
            <span class="status-dot"></span>
            <span id="status-label">${escapeHtml(phaseLabel)}</span>
          </span>
          <h2 id="status-title">${escapeHtml(statusText)}</h2>
          <p id="status-subtitle">浏览器会每隔几秒检查一次任务状态；一旦 AI 完成提炼，本页会自动刷新到最终 HTML 报告。</p>
          ${state.phase === "failed" && state.lastError
            ? `<div class="error-panel" id="error-panel">${escapeHtml(state.lastError)}</div>`
            : '<div class="error-panel" id="error-panel" hidden></div>'}
        </div>
        <div class="metrics">
          <div class="metric">
            <span class="metric-label">原始文章</span>
            <strong id="metric-articles">${escapeHtml(state.articleCount || preview.total)}</strong>
          </div>
          <div class="metric">
            <span class="metric-label">覆盖信源</span>
            <strong id="metric-sources">${escapeHtml(state.sourceCount || preview.sourceCount)}</strong>
          </div>
          <div class="metric">
            <span class="metric-label">最近更新</span>
            <strong id="metric-updated">${escapeHtml(updatedAt)}</strong>
          </div>
        </div>
      </section>

      <section>
        <div class="stream-header">
          <div>
            <h2>原始信息流</h2>
            <p>先读原始标题和摘要，AI 完成后再查看结构化结果。</p>
          </div>
          <p>${preview.total ? `当前展示 ${Math.min(preview.total, preview.items.length)} / ${preview.total} 篇` : "等待内容进入工作台"}</p>
        </div>
        <div class="story-grid">${previewCards}</div>
        ${preview.truncated ? '<p class="footer-note">为保证浏览速度，工作台仅展示最新 120 条原始内容。</p>' : ""}
      </section>
    </main>

    <script>
      const phaseMap = {
        preparing: { label: "正在整理原始信息流", tone: "warm" },
        waiting_for_ai: { label: "AI 正在进行总结和提炼", tone: "live" },
        finalizing: { label: "正在生成最终页面", tone: "warm" },
        failed: { label: "本次运行失败", tone: "danger" }
      };

      function formatTime(value) {
        if (!value) return "时间未知";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "时间未知";
        return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      }

      function applyState(data) {
        const mapped = phaseMap[data.phase] || phaseMap.waiting_for_ai;
        const pill = document.getElementById("status-pill");
        const label = document.getElementById("status-label");
        const title = document.getElementById("status-title");
        const errorPanel = document.getElementById("error-panel");

        pill.dataset.tone = mapped.tone;
        label.textContent = mapped.label;
        title.textContent = data.statusText || "AI 正在处理，请稍候。";
        document.getElementById("metric-articles").textContent = data.articleCount || 0;
        document.getElementById("metric-sources").textContent = data.sourceCount || 0;
        document.getElementById("metric-updated").textContent = formatTime(data.updatedAt);

        if (data.phase === "failed" && data.lastError) {
          errorPanel.hidden = false;
          errorPanel.textContent = data.lastError;
        } else {
          errorPanel.hidden = true;
          errorPanel.textContent = "";
        }
      }

      async function pollState() {
        try {
          const resp = await fetch("${stateApiUrl}", { cache: "no-store" });
          const data = await resp.json();
          applyState(data);

          if (data.phase === "completed" && data.hasLatestHtml) {
            window.location.replace("${reloadUrl}");
            return;
          }
        } catch {
          // Keep the current page state and try again.
        }
        setTimeout(pollState, 4000);
      }

      setTimeout(pollState, 2500);
    </script>
  </body>
</html>`;
}

function configPageHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>News Push 配置</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1e8;
        --paper: #fffdf8;
        --ink: #1d1b18;
        --muted: #6b6258;
        --line: #ddd2c4;
        --accent: #8b5e3c;
        --danger: #b44a3f;
        --success: #4a7c59;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Songti SC", serif;
        background: radial-gradient(circle at top, #fff8ec 0%, var(--bg) 55%, #efe8da 100%);
        color: var(--ink);
      }
      main {
        width: min(720px, calc(100vw - 32px));
        margin: 32px auto 64px;
      }
      section {
        background: rgba(255, 253, 248, 0.92);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 20px 40px rgba(71, 54, 35, 0.08);
      }
      h1, h2, h3 { margin: 0 0 12px; }
      h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); }
      h2 { font-size: 1.3rem; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
      .header-section {
        background: none;
        border: 0;
        box-shadow: none;
        margin-bottom: 0;
      }
      .header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
      }
      .meta { color: var(--muted); font-size: 0.95rem; margin: 6px 0 0; }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 16px;
        border-radius: 999px;
        border: 1px solid var(--line);
        color: var(--muted);
        text-decoration: none;
        font-size: 0.88rem;
        transition: all 0.2s;
        flex-shrink: 0;
        margin-top: 8px;
      }
      .back-link:hover {
        background: rgba(139, 94, 60, 0.08);
        color: var(--accent);
        border-color: var(--accent);
        text-decoration: none;
      }
      .form-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      input[type="text"],
      input[type="url"] {
        flex: 1;
        min-width: 160px;
        padding: 10px 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        font-family: inherit;
        font-size: 0.95rem;
        background: #fffdf8;
        color: var(--ink);
        outline: none;
        transition: border-color 0.2s;
      }
      input:focus { border-color: var(--accent); }
      button {
        padding: 10px 20px;
        border: none;
        border-radius: 12px;
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-primary { background: var(--accent); color: #fff; }
      .btn-primary:hover { opacity: 0.85; }
      .btn-sm {
        padding: 5px 14px;
        font-size: 0.82rem;
        border-radius: 8px;
      }
      .btn-test { background: #e8e0d4; color: var(--ink); }
      .btn-test:hover { background: #dcd2c4; }
      .btn-delete {
        background: transparent;
        color: var(--danger);
        border: 1px solid var(--danger);
      }
      .btn-delete:hover { background: var(--danger); color: #fff; }
      .search-row { margin-bottom: 16px; }
      .search-row input { width: 100%; }
      .feed-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border: 1px solid var(--line);
        border-radius: 14px;
        margin-bottom: 8px;
        background: #fffaf2;
        transition: background 0.2s;
        gap: 12px;
      }
      .feed-card:hover { background: #fff5e8; }
      .feed-info {
        flex: 1;
        min-width: 0;
      }
      .feed-name {
        display: block;
        font-weight: 600;
        font-size: 0.95rem;
        margin-bottom: 2px;
      }
      .feed-url {
        display: block;
        color: var(--muted);
        font-size: 0.82rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .feed-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }
      .test-result {
        font-size: 0.82rem;
        margin-top: 4px;
        padding: 0;
      }
      .test-result.testing { color: var(--muted); }
      .test-result.success { color: var(--success); }
      .test-result.error { color: var(--danger); }
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--muted);
      }
      textarea {
        width: 100%;
        min-height: 120px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        font-family: inherit;
        font-size: 0.95rem;
        background: #fffdf8;
        color: var(--ink);
        outline: none;
        resize: vertical;
        line-height: 1.6;
        transition: border-color 0.2s;
      }
      textarea:focus { border-color: var(--accent); }
      textarea::placeholder { color: var(--muted); opacity: 0.7; }
      .focus-hint {
        color: var(--muted);
        font-size: 0.85rem;
        margin: 8px 0 0;
        line-height: 1.5;
      }
      .focus-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
      }
      .focus-saved {
        font-size: 0.85rem;
        color: var(--success);
        opacity: 0;
        transition: opacity 0.3s;
      }
      .focus-saved.show { opacity: 1; }
      .toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 24px;
        border-radius: 12px;
        font-size: 0.9rem;
        color: #fff;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
      }
      .toast.show { opacity: 1; }
      .toast.success { background: var(--success); }
      .toast.error { background: var(--danger); }
    </style>
  </head>
  <body>
    <main>
      <section class="header-section">
        <div class="header-row">
          <div>
            <h1>News Push 配置</h1>
            <p class="meta">管理 RSS 订阅源 · 个性化偏好</p>
          </div>
          <a href="/" class="back-link">返回工作台</a>
        </div>
      </section>

      <section>
        <h2>个性化偏好</h2>
        <textarea id="focus-input" placeholder="用自然语言描述你关注的重点，例如：&#10;&#10;我更关注 AI 和安全领域的新闻，如果有 OpenAI 或 Anthropic 的产品升级请重点提示我。不太关心汽车和体育。"></textarea>
        <p class="focus-hint">AI 引擎会在生成简报时自动理解你的偏好。留空则使用默认权重。</p>
        <div class="focus-actions">
          <button type="button" id="focus-save" class="btn-primary">保存偏好</button>
          <span id="focus-saved" class="focus-saved"></span>
        </div>
      </section>

      <section>
        <h2>添加订阅源</h2>
        <form id="add-form" class="form-row">
          <input type="text" id="feed-name" placeholder="名称，如：Hacker News" required>
          <input type="url" id="feed-url" placeholder="RSS 地址" required>
          <button type="submit" class="btn-primary">添加</button>
        </form>
      </section>

      <section>
        <h2>当前订阅源 <span id="feed-count"></span></h2>
        <div class="search-row">
          <input type="text" id="search-input" placeholder="搜索名称或地址...">
        </div>
        <div id="feed-list"></div>
      </section>
    </main>

    <div id="toast" class="toast"></div>

    <script>
      let feeds = [];

      function escapeHtml(s) {
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
      }

      function showToast(msg, type) {
        const toast = document.getElementById("toast");
        toast.textContent = msg;
        toast.className = "toast " + type + " show";
        setTimeout(() => { toast.className = "toast"; }, 2500);
      }

      function renderFeeds(filter) {
        filter = (filter || "").toLowerCase();
        const list = document.getElementById("feed-list");
        const filtered = filter
          ? feeds.filter((feed) => feed.name.toLowerCase().includes(filter) || feed.url.toLowerCase().includes(filter))
          : feeds;

        document.getElementById("feed-count").textContent = "(" + feeds.length + ")";

        if (filtered.length === 0) {
          list.innerHTML = '<div class="empty-state">' + (feeds.length === 0 ? "暂无订阅源" : "没有匹配的订阅源") + "</div>";
          return;
        }

        list.innerHTML = filtered.map((feed) => {
          return '<div class="feed-card">' +
            '<div class="feed-info">' +
              '<span class="feed-name">' + escapeHtml(feed.name) + '</span>' +
              '<span class="feed-url" title="' + escapeHtml(feed.url) + '">' + escapeHtml(feed.url) + '</span>' +
              '<div class="test-result"></div>' +
            '</div>' +
            '<div class="feed-actions">' +
              '<button class="btn-sm btn-test" data-url="' + escapeHtml(feed.url) + '">测试</button>' +
              '<button class="btn-sm btn-delete" data-name="' + escapeHtml(feed.name) + '">删除</button>' +
            '</div>' +
          '</div>';
        }).join("");
      }

      async function loadFeeds() {
        const resp = await fetch("/api/feeds");
        feeds = await resp.json();
        renderFeeds(document.getElementById("search-input").value);
      }

      document.getElementById("add-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = document.getElementById("feed-name").value.trim();
        const url = document.getElementById("feed-url").value.trim();
        if (!name || !url) return;

        const resp = await fetch("/api/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, url })
        });
        const result = await resp.json();
        if (result.ok) {
          document.getElementById("feed-name").value = "";
          document.getElementById("feed-url").value = "";
          showToast("已添加: " + name, "success");
          await loadFeeds();
        } else {
          showToast(result.error || "添加失败", "error");
        }
      });

      document.getElementById("feed-list").addEventListener("click", async (event) => {
        const btn = event.target;
        if (btn.classList.contains("btn-delete")) {
          const name = btn.dataset.name;
          if (!confirm('确定删除 "' + name + '" 吗？')) return;
          const resp = await fetch("/api/feeds/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
          });
          const result = await resp.json();
          if (result.ok) {
            showToast("已删除: " + name, "success");
            await loadFeeds();
          } else {
            showToast(result.error || "删除失败", "error");
          }
        }

        if (btn.classList.contains("btn-test")) {
          const url = btn.dataset.url;
          const card = btn.closest(".feed-card");
          const resultEl = card.querySelector(".test-result");
          resultEl.textContent = "测试中...";
          resultEl.className = "test-result testing";

          try {
            const resp = await fetch("/api/feeds/test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url })
            });
            const result = await resp.json();
            if (result.ok) {
              resultEl.textContent = "\\u2713 有效 (" + result.itemCount + " 篇文章)";
              resultEl.className = "test-result success";
            } else {
              resultEl.textContent = "\\u2717 " + result.error;
              resultEl.className = "test-result error";
            }
          } catch {
            resultEl.textContent = "\\u2717 请求失败";
            resultEl.className = "test-result error";
          }
        }
      });

      document.getElementById("search-input").addEventListener("input", (event) => {
        renderFeeds(event.target.value);
      });

      async function loadFocus() {
        try {
          const resp = await fetch("/api/focus");
          const data = await resp.json();
          document.getElementById("focus-input").value = data.preference || "";
        } catch {
          // Ignore load failures.
        }
      }

      document.getElementById("focus-save").addEventListener("click", async () => {
        const preference = document.getElementById("focus-input").value.trim();
        try {
          const resp = await fetch("/api/focus", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preference })
          });
          const result = await resp.json();
          if (result.ok) {
            const saved = document.getElementById("focus-saved");
            saved.textContent = "\\u2713 已保存，下次生成简报时生效";
            saved.className = "focus-saved show";
            setTimeout(() => { saved.className = "focus-saved"; }, 3000);
          } else {
            showToast("保存失败", "error");
          }
        } catch {
          showToast("保存失败", "error");
        }
      });

      loadFeeds();
      loadFocus();
    </script>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function serveLatestReport(res, paths = PATHS) {
  const htmlPath = paths.jobLatestHtmlPath || paths.latestHtmlPath;
  if (!existsSync(htmlPath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Report not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(readFileSync(htmlPath, "utf-8"));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const jobPageMatch = pathname.match(/^\/jobs\/([^/]+)\/?$/);
  const jobReportMatch = pathname.match(/^\/jobs\/([^/]+)\/report$/);
  const jobStateMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/state$/);

  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    const activeJobId = currentJobId();
    if (activeJobId) {
      res.writeHead(302, {
        Location: `/jobs/${encodeURIComponent(activeJobId)}`,
        "Cache-Control": "no-store",
      });
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(pendingPageHtml(PATHS, ""));
    return;
  }

  if (jobPageMatch) {
    const jobId = decodeURIComponent(jobPageMatch[1]);
    const jobPaths = getJobPaths(jobId);
    const state = readDashboardState(jobPaths);
    if (shouldServeFinalReport(state, jobPaths)) {
      serveLatestReport(res, jobPaths);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(pendingPageHtml(jobPaths, jobId));
    return;
  }

  if (jobReportMatch) {
    const jobId = decodeURIComponent(jobReportMatch[1]);
    serveLatestReport(res, getJobPaths(jobId));
    return;
  }

  if (pathname === "/report") {
    const activeJobId = currentJobId();
    if (activeJobId) {
      serveLatestReport(res, getJobPaths(activeJobId));
      return;
    }
    serveLatestReport(res, PATHS);
    return;
  }

  if (pathname === "/config") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(configPageHtml());
    return;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    const activeJobId = currentJobId();
    jsonResponse(res, {
      ok: true,
      pid: process.pid,
      runtimeRoot: PATHS.runtimeRoot,
      serverVersion: NEWS_PUSH_VERSION,
      supportsJobRoutes: true,
      activeJobId,
    });
    return;
  }

  if (jobStateMatch && req.method === "GET") {
    const jobId = decodeURIComponent(jobStateMatch[1]);
    jsonResponse(res, readDashboardState(getJobPaths(jobId)));
    return;
  }

  if (pathname === "/api/state" && req.method === "GET") {
    const activeJobId = currentJobId();
    jsonResponse(res, activeJobId ? readDashboardState(getJobPaths(activeJobId)) : readDashboardState(PATHS));
    return;
  }

  if (pathname === "/api/feeds" && req.method === "GET") {
    jsonResponse(res, parseFeeds());
    return;
  }

  if (pathname === "/api/feeds" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    if (!body.name || !body.url) {
      jsonResponse(res, { ok: false, error: "名称和地址不能为空" }, 400);
      return;
    }
    const ok = addFeed(body.name, body.url);
    if (!ok) {
      jsonResponse(res, { ok: false, error: "该地址已存在" }, 409);
      return;
    }
    jsonResponse(res, { ok: true });
    return;
  }

  if (pathname === "/api/feeds/delete" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    if (!body.name) {
      jsonResponse(res, { ok: false, error: "名称不能为空" }, 400);
      return;
    }
    const ok = removeFeed(body.name);
    if (!ok) {
      jsonResponse(res, { ok: false, error: "未找到该订阅源" }, 404);
      return;
    }
    jsonResponse(res, { ok: true });
    return;
  }

  if (pathname === "/api/feeds/test" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    if (!body.url) {
      jsonResponse(res, { ok: false, error: "地址不能为空" }, 400);
      return;
    }
    jsonResponse(res, await testFeed(body.url));
    return;
  }

  if (pathname === "/api/focus" && req.method === "GET") {
    jsonResponse(res, readFocus());
    return;
  }

  if (pathname === "/api/focus" && req.method === "PUT") {
    const body = JSON.parse(await readBody(req) || "{}");
    const preference = (body.preference || "").trim();
    if (!preference) {
      writeFileSync(FOCUS_PATH, "", "utf-8");
      jsonResponse(res, { ok: true, preference: "", updated_at: "" });
      return;
    }
    jsonResponse(res, { ok: true, ...writeFocus(preference) });
    return;
  }

  const staticPath = resolve(OUTPUT_DIR, pathname.slice(1));
  if (staticPath.startsWith(OUTPUT_DIR) && existsSync(staticPath)) {
    const ext = extname(staticPath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(readFileSync(staticPath));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

function openBrowser(url) {
  if (process.env.NEWS_PUSH_DISABLE_BROWSER === "1") return;
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`);
}

function startServer(port, page, shouldOpen) {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error?.stack || String(error));
    });
  });

  const cleanup = () => clearServerState();
  process.on("exit", cleanup);
  process.on("SIGTERM", () => {
    cleanup();
    server.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    cleanup();
    server.close(() => process.exit(0));
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`News Push 工作台端口 ${port} 已被占用，当前不会继续递增新端口启动。`);
      process.exitCode = 1;
      return;
    }
    console.error("Server error:", error);
  });

  server.listen(port, "127.0.0.1", () => {
    const state = writeServerState(port);
    const pageUrl = new URL(page.replace(/^\/*/, ""), state.url).toString();
    console.log(`\nNews Push 工作台已启动: ${pageUrl}`);
    if (shouldOpen) {
      openBrowser(pageUrl);
    }
  });
}

const options = parseArgs(process.argv.slice(2));
startServer(options.port, options.page, options.openBrowser);
