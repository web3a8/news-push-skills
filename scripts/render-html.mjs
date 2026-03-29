#!/usr/bin/env node
/**
 * render-html.mjs — Render a briefing JSON into a static HTML page.
 *
 * Usage:
 *   node scripts/render-html.mjs data/briefing.json
 *   cat data/briefing.json | node scripts/render-html.mjs -
 *
 * Outputs: output/latest.html + output/archive/{timestamp}.html
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const DEFAULT_OUT_DIR = resolve(SKILL_ROOT, "output");
const SLIM_PATH = resolve(SKILL_ROOT, "data", "articles-slim.json");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(text, limit = 220) {
  if (!text || text.length <= limit) return text || "";
  return text.slice(0, limit - 1).trim() + "…";
}

function stripUpgradeTag(text) {
  return (text || "").replace(/【focus_on】/g, "").trim();
}

function applyUpgradeUnderline(text) {
  if (!text) return "";
  // Replace 【focus_on】text-up-to-semicolon with underlined span
  return text.replace(/【focus_on】([^；]+)/g, '<span class="upgrade-tag">$1</span>');
}

function formatTimestamp(value) {
  if (!value) return "未知";
  try {
    const d = new Date(value);
    return d.toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  } catch {
    return String(value);
  }
}

function fileTimestamp(value) {
  if (!value) {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }
  try {
    return new Date(value).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  } catch {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderHtml(briefing) {
  const DOMAIN_LABELS = {
    ai: "AI", finance: "财经", politics: "政治", tech: "科技",
    society: "社会", health: "健康", entertainment: "娱乐",
    sports: "体育", science: "科学", security: "安全", general: "综合",
  };

  // Dynamic domain order: use keys from domain_briefs, skip "general"
  const DOMAIN_ORDER = Object.keys(briefing.domain_briefs || {}).filter(d => d !== "general");

  const coverage = briefing.coverage || {};
  const createdAt = formatTimestamp(briefing.created_at);

  const domainColumns = DOMAIN_ORDER.map((domain) => {
    const label = DOMAIN_LABELS[domain] || domain;
    const rawBrief = (briefing.domain_briefs || {})[domain] || "";
    const briefText = applyUpgradeUnderline(escapeHtml(rawBrief));
    return `
          <div class="domain-col">
            <h3>${label}</h3>
            ${briefText ? `<p class="domain-brief">${briefText}</p>` : ""}
          </div>`;
  }).join("");

  // Raw feed items — from articles-slim.json
  let rawArticles = [];
  try {
    if (existsSync(SLIM_PATH)) {
      rawArticles = JSON.parse(readFileSync(SLIM_PATH, "utf-8"));
    }
  } catch { /* fall through */ }
  const feedItems = rawArticles
    .map((a) => {
      const sourceName = escapeHtml(a.source || "未知来源");
      const pubDate = formatTimestamp(a.date);
      const summary = clip(a.desc || "", 220);
      return `
            <article class="feed-item">
              <h3><a href="${escapeHtml(a.link)}" target="_blank" rel="noreferrer">${escapeHtml(a.title)}</a></h3>
              <p class="meta">${sourceName} · ${pubDate}</p>
              ${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ""}
            </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>News Push Snapshot</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1e8;
        --paper: #fffdf8;
        --ink: #1d1b18;
        --muted: #6b6258;
        --line: #ddd2c4;
        --accent: #8b5e3c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Songti SC", serif;
        background: radial-gradient(circle at top, #fff8ec 0%, var(--bg) 55%, #efe8da 100%);
        color: var(--ink);
      }
      main {
        width: min(1080px, calc(100vw - 32px));
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
      h1 { font-size: clamp(2rem, 4vw, 3.2rem); }
      h2 { font-size: 1.4rem; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
      h3 { font-size: 1.1rem; }
      p, li { line-height: 1.7; }
      .meta {
        color: var(--muted);
        font-size: 0.95rem;
        margin: 6px 0 0;
      }
      .header-section {
        background: none;
        border: 0;
        box-shadow: none;
        margin-bottom: 0;
      }

      /* Domain grid */
      .domain-grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      .domain-col {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
        background: #fffaf2;
      }
      .domain-col h3 {
        display: inline-block;
        margin-bottom: 10px;
        padding: 4px 14px;
        border-radius: 999px;
        background: #f2e2d1;
        color: #6a4429;
        font-size: 0.88rem;
      }
      .domain-brief {
        font-size: 1rem;
        color: var(--ink);
        margin: 0;
        line-height: 1.75;
      }

      /* Feed items */
      .feed-item + .feed-item {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .upgrade-tag {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: 3px;
        text-decoration-thickness: 2px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="header-section">
        <h1>News Push</h1>
        <p class="meta">生成时间：${escapeHtml(createdAt)} · 覆盖源数：${coverage.sources_count || 0} · 处理文章：${coverage.articles_count || 0}</p>
      </section>
      <section>
        <h2>今日速览</h2>
        <div class="domain-grid">
          ${domainColumns}
        </div>
      </section>
      <section>
        <h2>原始订阅信息流</h2>
        ${feedItems || '<p>暂无文章。</p>'}
      </section>
    </main>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node render-html.mjs <briefing.json>");
    console.error("       cat briefing.json | node render-html.mjs -");
    process.exit(1);
  }

  let jsonStr;
  if (inputPath === "-") {
    // Read from stdin (not easily done sync, so read from file is preferred)
    jsonStr = readFileSync(0, "utf-8");
  } else {
    jsonStr = readFileSync(resolve(inputPath), "utf-8");
  }

  const briefing = JSON.parse(jsonStr);
  const html = renderHtml(briefing);

  const outDir = DEFAULT_OUT_DIR;
  const archiveDir = resolve(outDir, "archive");
  mkdirSync(archiveDir, { recursive: true });

  const latestPath = resolve(outDir, "latest.html");
  writeFileSync(latestPath, html, "utf-8");

  const ts = fileTimestamp(briefing.created_at);
  const archivePath = resolve(archiveDir, `${ts}-snapshot.html`);
  writeFileSync(archivePath, html, "utf-8");

  console.log(`✓ HTML 已生成: ${latestPath}`);
}

main();
