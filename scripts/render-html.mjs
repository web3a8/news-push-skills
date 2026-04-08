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
import { resolve } from "node:path";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const DEFAULT_OUT_DIR = PATHS.outputDir;
const SLIM_PATH = PATHS.slimArticlesPath;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

const SOURCE_CATEGORY_DEFS = [
  { id: "all", label: "全部" },
  {
    id: "ai",
    label: "AI",
    patterns: [
      /arxiv/i,
      /hugging\s?face/i,
      /openai/i,
      /anthropic/i,
      /google ai/i,
      /机器学习/,
      /计算机视觉/,
      /nlp/i,
      /\bllm\b/i,
      /\bai\b/i,
      /deepmind/i,
    ],
  },
  {
    id: "finance",
    label: "财经",
    patterns: [
      /华尔街见闻/,
      /bloomberg/i,
      /cnbc/i,
      /financial times/i,
      /\bwsj\b/i,
      /经济/,
      /财经/,
      /market/i,
    ],
  },
  {
    id: "tech",
    label: "科技",
    patterns: [
      /techcrunch/i,
      /ars technica/i,
      /the verge/i,
      /mit technology review/i,
      /smashing magazine/i,
      /codrops/i,
      /verge/i,
      /少数派/,
    ],
  },
  {
    id: "developers",
    label: "开发者",
    patterns: [
      /github/i,
      /hacker news/i,
      /openclaw/i,
      /dev\.to/i,
      /this week in rust/i,
      /aws blog/i,
      /microsoft/i,
      /oldnewthing/i,
      /v2ex/i,
      /rust/i,
    ],
  },
  {
    id: "cn-news",
    label: "中文资讯",
    patterns: [
      /微博热搜/,
      /it之家/,
      /36kr/i,
      /腾讯/,
      /爱范儿/,
      /虎嗅/,
      /钛媒体/,
      /澎湃/,
    ],
  },
  {
    id: "longread",
    label: "长文",
    patterns: [
      /paulgraham/i,
      /chadnauseam/i,
      /schneier/i,
      /johndcook/i,
      /pluralistic/i,
      /idiallo/i,
      /terriblesoftware/i,
      /utcc\.utoronto/i,
      /dfarq/i,
      /wait but why/i,
      /james clear/i,
      /farnam/i,
      /dan koe/i,
      /scott young/i,
    ],
  },
  {
    id: "podcasts",
    label: "播客",
    patterns: [
      /podcast/i,
      /lex fridman/i,
      /latent space/i,
      /80000 hours/i,
      /80,?000 hours/i,
    ],
  },
];

function classifySource(sourceName) {
  const src = String(sourceName || "").trim();
  if (!src) return "tech";

  for (const def of SOURCE_CATEGORY_DEFS) {
    if (def.id === "all") continue;
    if ((def.patterns || []).some((pattern) => pattern.test(src))) {
      return def.id;
    }
  }

  return "tech";
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
  const globalBrief = applyUpgradeUnderline(escapeHtml(briefing.global_brief || "本期暂无高信号更新。"));

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

  const facts = (briefing.highlight_facts || []).map((fact) => {
    const domain = DOMAIN_LABELS[fact.domain] || "综合";
    return `
          <article class="signal-card">
            <p class="signal-meta">${domain} · ${Number(fact.score || 0).toFixed(2)}</p>
            <h3>${escapeHtml(stripUpgradeTag(fact.title || "未命名条目"))}</h3>
            <p>${escapeHtml((fact.summary || "").trim())}</p>
          </article>`;
  }).join("");

  const opinions = (briefing.highlight_opinions || []).map((opinion) => {
    const domain = DOMAIN_LABELS[opinion.domain] || "综合";
    return `
          <article class="signal-card">
            <p class="signal-meta">${domain} · ${Number(opinion.score || 0).toFixed(2)}</p>
            <h3>${escapeHtml(stripUpgradeTag(opinion.title || "未命名条目"))}</h3>
            <p>${escapeHtml((opinion.summary || "").trim())}</p>
          </article>`;
  }).join("");

  // Raw feed items — from articles-slim.json, grouped by source
  let rawArticles = [];
  try {
    if (existsSync(SLIM_PATH)) {
      rawArticles = JSON.parse(readFileSync(SLIM_PATH, "utf-8"));
    }
  } catch { /* fall through */ }

  // Group articles by source, sorted by count descending
  const sourceMap = new Map();
  for (const a of rawArticles) {
    const src = a.source || "未知来源";
    if (!sourceMap.has(src)) sourceMap.set(src, []);
    sourceMap.get(src).push(a);
  }
  const sourceEntries = [...sourceMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const categorizedEntries = new Map(SOURCE_CATEGORY_DEFS.map((def) => [def.id, []]));
  for (const entry of sourceEntries) {
    const [src] = entry;
    const categoryId = classifySource(src);
    categorizedEntries.get("all").push(entry);
    if (!categorizedEntries.has(categoryId)) categorizedEntries.set(categoryId, []);
    categorizedEntries.get(categoryId).push(entry);
  }

  const categoryTabs = SOURCE_CATEGORY_DEFS.map((def, index) => {
    const entries = categorizedEntries.get(def.id) || [];
    const sourceCount = entries.length;
    const articleCount = entries.reduce((sum, [, articles]) => sum + articles.length, 0);
    return `<button class="category-tab${index === 0 ? " active" : ""}" type="button" data-category="${def.id}" title="${def.label} · ${articleCount} 篇文章">${def.label}<span class="badge">${sourceCount}</span></button>`;
  }).join("\n");

  // Sidebar links
  const sidebarLinks = sourceEntries.map(([src, articles], i) => {
    const label = escapeHtml(src);
    const categoryId = classifySource(src);
    return `<a class="sidebar-link" data-target="src-${i}" data-category="${categoryId}" href="#src-${i}">${label}<span class="badge">${articles.length}</span></a>`;
  }).join("\n");

  // Grouped feed content
  const feedGroups = sourceEntries.map(([src, articles], i) => {
    const categoryId = classifySource(src);
    const items = articles.map((a) => {
      const pubDate = formatTimestamp(a.date);
      const summary = clip(a.desc || "", 220);
      const displayTitle = a.title_cn ? escapeHtml(a.title_cn) : escapeHtml(a.title);
      const titleAttr = a.title_cn ? ` title="${escapeHtml(a.title)}"` : "";
      return `
              <article class="feed-item">
                <h3><a href="${escapeAttr(a.link)}" target="_blank" rel="noreferrer"${titleAttr}>${displayTitle}</a></h3>
                <p class="meta">${pubDate}</p>
                ${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ""}
              </article>`;
    }).join("");
    return `
          <div class="source-group" id="src-${i}" data-category="${categoryId}">
            <h3 class="source-header">${escapeHtml(src)}<span class="badge">${articles.length}</span></h3>
            ${items}
          </div>`;
  }).join("");

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
      .header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
      }
      .settings-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        color: var(--muted);
        transition: background 0.2s, color 0.2s;
        flex-shrink: 0;
        margin-top: 4px;
      }
      .settings-link:hover {
        background: rgba(139, 94, 60, 0.08);
        color: var(--accent);
        text-decoration: none;
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
      .global-brief {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.85;
      }
      .signal-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .signal-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 18px;
        background: #fffaf2;
      }
      .signal-card h3 {
        margin-bottom: 8px;
      }
      .signal-card p {
        margin: 0;
      }
      .signal-meta {
        margin-bottom: 10px !important;
        color: var(--muted);
        font-size: 0.85rem;
      }

      /* Feed layout */
      .feed-layout {
        display: flex;
        gap: 20px;
        align-items: flex-start;
      }
      .feed-toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        position: sticky;
        top: 14px;
        z-index: 30;
        margin-bottom: 20px;
        padding: 14px 16px;
        border: 1px solid rgba(139, 94, 60, 0.14);
        border-radius: 20px;
        background: rgba(255, 250, 242, 0.9);
        backdrop-filter: blur(14px);
        box-shadow: 0 12px 30px rgba(71, 54, 35, 0.08);
      }
      .feed-toolbar-label {
        color: var(--muted);
        font-size: 0.82rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .category-nav {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 2px;
        -webkit-overflow-scrolling: touch;
      }
      .category-tab {
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: #fffaf2;
        color: var(--muted);
        font: inherit;
        font-size: 0.88rem;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.2s, color 0.2s, border-color 0.2s;
      }
      .category-tab:hover {
        color: var(--ink);
        border-color: rgba(139, 94, 60, 0.28);
      }
      .category-tab.active {
        background: #f2e2d1;
        color: #6a4429;
        border-color: rgba(139, 94, 60, 0.22);
        font-weight: 600;
        box-shadow: 0 8px 18px rgba(139, 94, 60, 0.12);
      }
      .feed-sidebar {
        width: 160px;
        position: sticky;
        top: 104px;
        flex-shrink: 0;
        align-self: flex-start;
        max-height: calc(100vh - 128px);
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        padding-right: 6px;
        scrollbar-width: thin;
      }
      .sidebar-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        margin-bottom: 4px;
        border-radius: 999px;
        font-size: 0.85rem;
        color: var(--muted);
        text-decoration: none;
        transition: background 0.2s, color 0.2s;
        cursor: pointer;
      }
      .sidebar-link:hover {
        background: rgba(139, 94, 60, 0.08);
        color: var(--ink);
        text-decoration: none;
      }
      .sidebar-link.active {
        background: #f2e2d1;
        color: #6a4429;
        font-weight: 600;
      }
      .feed-content {
        flex: 1;
        min-width: 0;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: rgba(107, 98, 88, 0.1);
        font-size: 0.75rem;
        color: var(--muted);
        margin-left: 6px;
      }
      .sidebar-link.active .badge {
        background: rgba(106, 68, 41, 0.15);
        color: #6a4429;
      }

      /* Source groups */
      .source-group {
        margin-bottom: 20px;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        background: #fffaf2;
        scroll-margin-top: 112px;
      }
      .source-group[hidden],
      .sidebar-link[hidden] {
        display: none !important;
      }
      .source-header {
        display: flex;
        align-items: center;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
        font-size: 1rem;
        color: var(--ink);
      }
      .source-header .badge {
        font-size: 0.7rem;
      }

      /* Feed items */
      .feed-item + .feed-item {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--line);
      }
      .feed-empty {
        margin: 0;
        color: var(--muted);
      }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .upgrade-tag {
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: 3px;
        text-decoration-thickness: 2px;
      }

      /* Mobile */
      @media (max-width: 768px) {
        .feed-toolbar {
          flex-direction: column;
          align-items: stretch;
          top: 8px;
          padding: 12px 12px 10px;
        }
        .feed-layout { flex-direction: column; }
        .feed-sidebar {
          position: static;
          width: 100%;
          max-height: none;
          display: flex;
          overflow-x: auto;
          gap: 6px;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
        }
        .sidebar-link {
          white-space: nowrap;
          flex-shrink: 0;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="header-section">
        <div class="header-row">
          <div>
            <h1>News Push</h1>
            <p class="meta">生成时间：${escapeHtml(createdAt)} · 处理文章：${coverage.articles_count || 0}</p>
          </div>
          <a href="/config" target="_blank" rel="noreferrer" class="settings-link" title="管理订阅源">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
        </div>
      </section>
      <section>
        <h2>今日最重要几件事</h2>
        <p class="global-brief">${globalBrief}</p>
      </section>
      <section>
        <h2>分栏简报</h2>
        <div class="domain-grid">
          ${domainColumns}
        </div>
      </section>
      <section>
        <h2>重要事实</h2>
        ${facts ? `<div class="signal-grid">${facts}</div>` : "<p>本期暂无内容。</p>"}
      </section>
      <section>
        <h2>关键观点</h2>
        ${opinions ? `<div class="signal-grid">${opinions}</div>` : "<p>本期暂无内容。</p>"}
      </section>
      <section>
        <h2>原始订阅信息流</h2>
        ${sourceEntries.length > 0 ? `
        <div class="feed-toolbar">
          <div class="feed-toolbar-label">按主题查看</div>
          <div class="category-nav" role="tablist" aria-label="信源分类">
            ${categoryTabs}
          </div>
        </div>
        <div class="feed-layout">
          <nav class="feed-sidebar">
            ${sidebarLinks}
          </nav>
          <div class="feed-content">
            ${feedGroups}
          </div>
        </div>
        <p class="feed-empty" hidden>当前分类下暂无信源。</p>` : '<p>暂无文章。</p>'}
      </section>
    </main>
  </body>
  <script>
    (function() {
      var categoryTabs = document.querySelectorAll('.category-tab');
      var links = document.querySelectorAll('.sidebar-link');
      var groups = document.querySelectorAll('.source-group');
      var emptyState = document.querySelector('.feed-empty');
      if (!links.length || !groups.length) return;

      var currentCategory = 'all';
      var observer;

      function visibleLinks() {
        return Array.from(links).filter(function(link) {
          return !link.hidden;
        });
      }

      function visibleGroups() {
        return Array.from(groups).filter(function(group) {
          return !group.hidden;
        });
      }

      function resetActiveLink() {
        links.forEach(function(link) { link.classList.remove('active'); });
      }

      function setActiveLink(link) {
        resetActiveLink();
        if (!link) return;
        link.classList.add('active');
        keepActiveLinkVisible(link);
      }

      function keepActiveLinkVisible(link) {
        var sidebar = document.querySelector('.feed-sidebar');
        if (!sidebar || window.innerWidth <= 768) return;

        var sidebarRect = sidebar.getBoundingClientRect();
        var linkRect = link.getBoundingClientRect();
        var padding = 8;

        if (linkRect.top < sidebarRect.top) {
          sidebar.scrollTop -= (sidebarRect.top - linkRect.top) + padding;
        } else if (linkRect.bottom > sidebarRect.bottom) {
          sidebar.scrollTop += (linkRect.bottom - sidebarRect.bottom) + padding;
        }
      }

      function bindObserver() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (!entry.isIntersecting || entry.target.hidden) return;
            var active = document.querySelector('.sidebar-link[data-target="' + entry.target.id + '"]');
            if (active && !active.hidden) setActiveLink(active);
          });
        }, { rootMargin: '-10% 0px -70% 0px' });

        visibleGroups().forEach(function(group) { observer.observe(group); });
      }

      function applyCategory(category) {
        currentCategory = category;

        categoryTabs.forEach(function(tab) {
          tab.classList.toggle('active', tab.getAttribute('data-category') === category);
        });

        links.forEach(function(link) {
          var match = category === 'all' || link.getAttribute('data-category') === category;
          link.hidden = !match;
        });

        groups.forEach(function(group) {
          var match = category === 'all' || group.getAttribute('data-category') === category;
          group.hidden = !match;
        });

        var firstVisibleLink = visibleLinks()[0];
        var firstVisibleGroup = visibleGroups()[0];

        if (emptyState) emptyState.hidden = !!firstVisibleGroup;
        setActiveLink(firstVisibleLink || null);
        bindObserver();

        if (firstVisibleGroup) {
          history.replaceState(null, '', '#' + firstVisibleGroup.id);
        } else {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }

      // Click handler
      links.forEach(function(link) {
        link.addEventListener('click', function(e) {
          if (this.hidden) return;
          e.preventDefault();
          var id = this.getAttribute('data-target');
          var target = document.getElementById(id);
          if (!target) return;
          setActiveLink(this);
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      categoryTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var category = this.getAttribute('data-category') || 'all';
          if (category === currentCategory) return;
          applyCategory(category);
        });
      });

      applyCategory('all');
    })();
  </script>
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
