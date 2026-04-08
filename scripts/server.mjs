#!/usr/bin/env node
/**
 * server.mjs — Local HTTP server for News Push content display and config UI.
 *
 * Usage:
 *   node scripts/server.mjs              → Start server, open content page
 *   node scripts/server.mjs /config      → Start server, open config page
 *
 * Zero external dependencies.
 */

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { exec } from "node:child_process";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const OPML_PATH = PATHS.feedsPath;
const OUTPUT_DIR = PATHS.outputDir;
const FOCUS_PATH = PATHS.focusPath;
const DEFAULT_PORT = 7789;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// ---------------------------------------------------------------------------
// OPML helpers
// ---------------------------------------------------------------------------

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  for (const f of feeds) {
    lines.push(`    <outline text="${escapeXml(f.name)}" xmlUrl="${escapeXml(f.url)}"/>`);
  }
  lines.push("  </body>");
  lines.push("</opml>");
  writeFileSync(OPML_PATH, lines.join("\n") + "\n", "utf-8");
}

function addFeed(name, url) {
  const feeds = parseFeeds();
  if (feeds.some((f) => f.url === url)) return false;
  feeds.push({ name, url });
  writeFeedsOpml(feeds);
  return true;
}

function removeFeed(name) {
  const feeds = parseFeeds();
  const filtered = feeds.filter((f) => f.name !== name);
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
// Config page HTML
// ---------------------------------------------------------------------------

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

      /* Forms */
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
      input:focus {
        border-color: var(--accent);
      }
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
      .btn-primary {
        background: var(--accent);
        color: #fff;
      }
      .btn-primary:hover { opacity: 0.85; }
      .btn-sm {
        padding: 5px 14px;
        font-size: 0.82rem;
        border-radius: 8px;
      }
      .btn-test {
        background: #e8e0d4;
        color: var(--ink);
      }
      .btn-test:hover { background: #dcd2c4; }
      .btn-delete {
        background: transparent;
        color: var(--danger);
        border: 1px solid var(--danger);
      }
      .btn-delete:hover { background: var(--danger); color: #fff; }

      /* Search */
      .search-row {
        margin-bottom: 16px;
      }
      .search-row input {
        width: 100%;
      }

      /* Feed list */
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

      /* Focus */
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

      /* Toast */
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
          <a href="/" class="back-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            返回报告
          </a>
        </div>
      </section>

      <section>
        <h2>个性化偏好</h2>
        <textarea id="focus-input" placeholder="用自然语言描述你关注的重点，例如：&#10;&#10;我更关注AI和安全领域的新闻，如果有OpenAI或Anthropic的产品升级请重点提示我。不太关心汽车和体育。"></textarea>
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
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
      }

      function showToast(msg, type) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.className = "toast " + type + " show";
        setTimeout(() => { t.className = "toast"; }, 2500);
      }

      function renderFeeds(filter) {
        filter = (filter || "").toLowerCase();
        const list = document.getElementById("feed-list");
        const filtered = filter
          ? feeds.filter(f => f.name.toLowerCase().includes(filter) || f.url.toLowerCase().includes(filter))
          : feeds;

        document.getElementById("feed-count").textContent = "(" + feeds.length + ")";

        if (filtered.length === 0) {
          list.innerHTML = '<div class="empty-state">' + (feeds.length === 0 ? "暂无订阅源" : "没有匹配的订阅源") + "</div>";
          return;
        }

        list.innerHTML = filtered.map(f => {
          return '<div class="feed-card" data-name="' + escapeHtml(f.name) + '">' +
            '<div class="feed-info">' +
              '<span class="feed-name">' + escapeHtml(f.name) + '</span>' +
              '<span class="feed-url" title="' + escapeHtml(f.url) + '">' + escapeHtml(f.url) + '</span>' +
              '<div class="test-result"></div>' +
            '</div>' +
            '<div class="feed-actions">' +
              '<button class="btn-sm btn-test" data-url="' + escapeHtml(f.url) + '">测试</button>' +
              '<button class="btn-sm btn-delete" data-name="' + escapeHtml(f.name) + '">删除</button>' +
            '</div>' +
          '</div>';
        }).join("");
      }

      async function loadFeeds() {
        const resp = await fetch("/api/feeds");
        feeds = await resp.json();
        renderFeeds(document.getElementById("search-input").value);
      }

      // Add
      document.getElementById("add-form").addEventListener("submit", async function(e) {
        e.preventDefault();
        const name = document.getElementById("feed-name").value.trim();
        const url = document.getElementById("feed-url").value.trim();
        if (!name || !url) return;

        const resp = await fetch("/api/feeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, url: url })
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

      // Delete & Test (event delegation)
      document.getElementById("feed-list").addEventListener("click", async function(e) {
        var btn = e.target;
        if (btn.classList.contains("btn-delete")) {
          var name = btn.dataset.name;
          if (!confirm('确定删除 "' + name + '" 吗？')) return;
          var resp = await fetch("/api/feeds/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name })
          });
          var result = await resp.json();
          if (result.ok) {
            showToast("已删除: " + name, "success");
            await loadFeeds();
          } else {
            showToast(result.error || "删除失败", "error");
          }
        }

        if (btn.classList.contains("btn-test")) {
          var url = btn.dataset.url;
          var card = btn.closest(".feed-card");
          var resultEl = card.querySelector(".test-result");
          resultEl.textContent = "测试中...";
          resultEl.className = "test-result testing";

          try {
            var resp = await fetch("/api/feeds/test", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: url })
            });
            var result = await resp.json();
            if (result.ok) {
              resultEl.textContent = "\\u2713 有效 (" + result.itemCount + " 篇文章)";
              resultEl.className = "test-result success";
            } else {
              resultEl.textContent = "\\u2717 " + result.error;
              resultEl.className = "test-result error";
            }
          } catch (err) {
            resultEl.textContent = "\\u2717 请求失败";
            resultEl.className = "test-result error";
          }
        }
      });

      // Search
      document.getElementById("search-input").addEventListener("input", function(e) {
        renderFeeds(e.target.value);
      });

      // Load
      loadFeeds();

      // Focus: load
      async function loadFocus() {
        try {
          const resp = await fetch("/api/focus");
          const data = await resp.json();
          document.getElementById("focus-input").value = data.preference || "";
        } catch (e) { /* ignore */ }
      }

      // Focus: save
      document.getElementById("focus-save").addEventListener("click", async function() {
        const preference = document.getElementById("focus-input").value.trim();
        try {
          const resp = await fetch("/api/focus", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preference: preference })
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
        } catch (e) {
          showToast("保存失败", "error");
        }
      });

      loadFocus();
    </script>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Favicon
  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Content page
  if (pathname === "/" || pathname === "/index.html") {
    const htmlPath = resolve(OUTPUT_DIR, "latest.html");
    if (existsSync(htmlPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(readFileSync(htmlPath, "utf-8"));
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>暂无报告</h1><p>请先运行 news-push 生成报告。</p>");
    }
    return;
  }

  // Config page
  if (pathname === "/config") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(configPageHtml());
    return;
  }

  // API: List feeds
  if (pathname === "/api/feeds" && req.method === "GET") {
    jsonResponse(res, parseFeeds());
    return;
  }

  // API: Add feed
  if (pathname === "/api/feeds" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
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

  // API: Delete feed
  if (pathname === "/api/feeds/delete" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
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

  // API: Test feed
  if (pathname === "/api/feeds/test" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    if (!body.url) {
      jsonResponse(res, { ok: false, error: "地址不能为空" }, 400);
      return;
    }
    const result = await testFeed(body.url);
    jsonResponse(res, result);
    return;
  }

  // API: Read focus
  if (pathname === "/api/focus" && req.method === "GET") {
    jsonResponse(res, readFocus());
    return;
  }

  // API: Save focus
  if (pathname === "/api/focus" && req.method === "PUT") {
    const body = JSON.parse(await readBody(req));
    const preference = (body.preference || "").trim();
    if (!preference) {
      writeFileSync(FOCUS_PATH, "", "utf-8");
      jsonResponse(res, { ok: true, preference: "", updated_at: "" });
      return;
    }
    const result = writeFocus(preference);
    jsonResponse(res, { ok: true, ...result });
    return;
  }

  // Static files from output/
  const staticPath = resolve(OUTPUT_DIR, pathname.slice(1));
  if (staticPath.startsWith(OUTPUT_DIR) && existsSync(staticPath)) {
    const ext = extname(staticPath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(readFileSync(staticPath));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
}

// ---------------------------------------------------------------------------
// Server start
// ---------------------------------------------------------------------------

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`);
}

function startServer(port, page) {
  const server = createServer(handleRequest);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`  端口 ${port} 已占用，尝试 ${port + 1}...`);
      startServer(port + 1, page);
    } else {
      console.error("Server error:", err);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const addr = `http://127.0.0.1:${port}${page}`;
    console.log(`\n  News Push 服务已启动: ${addr}`);
    console.log(`  按 Ctrl+C 停止\n`);
    openBrowser(addr);
  });
}

const page = process.argv[2] || "/";
startServer(DEFAULT_PORT, page);
