#!/usr/bin/env node
/**
 * sync-extras.mjs — Fetch articles from non-RSS sources and merge into articles.json.
 *
 * Sources: Weibo Hot Search, GitHub Trending, HuggingFace Papers,
 *          WallStreetCN, V2EX Hot Topics.
 *
 * Usage:
 *   node scripts/sync-extras.mjs                     # merge into data/articles.json
 *   node scripts/sync-extras.mjs --sources weibo,github  # only specified sources
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const ARTICLES_PATH = PATHS.articlesPath;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const now = new Date();

// ---------------------------------------------------------------------------
// Weibo Hot Search
// ---------------------------------------------------------------------------

async function fetchWeiboHot(timeoutMs = 15000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch("https://weibo.com/ajax/side/hotSearch", {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA, Referer: "https://weibo.com/" },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const items = json?.data?.realtime || [];
    return items.slice(0, 20).map((item) => {
      const title = item.note || item.word || "";
      return {
        title,
        link: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}&Refer=top`,
        description: `热度: ${item.num || 0}`,
        pubDate: now.toUTCString(),
        source_name: "微博热搜",
        source_url: "https://weibo.com",
        fetched_at: now.toISOString(),
      };
    });
  } catch (err) {
    console.error(`  [WARN] 微博热搜 — ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// GitHub Trending
// ---------------------------------------------------------------------------

async function fetchGitHubTrending(timeoutMs = 15000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch("https://github.com/trending", {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();

    // Parse <article> blocks
    const articleRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    const articles = [];
    let am;

    while ((am = articleRe.exec(html)) !== null && articles.length < 25) {
      const block = am[1];

      // Extract repo link from h2 > a
      const h2LinkRe = /<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>/i;
      const linkMatch = block.match(h2LinkRe);
      if (!linkMatch) continue;
      const repoPath = linkMatch[1];

      // Extract repo name from path
      const parts = repoPath.replace(/^\//, "").split("/");
      const owner = parts[0] || "";
      const repo = parts[1] || "";
      if (!owner || !repo) continue;

      // Extract description from <p> after </h2>
      const descRe = /<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i;
      const descMatch = block.match(descRe);
      const desc = descMatch
        ? descMatch[1].replace(/<[^>]+>/g, "").trim()
        : "";

      articles.push({
        title: `${owner}/${repo}${desc ? " — " + desc.slice(0, 120) : ""}`,
        link: `https://github.com${repoPath}`,
        description: desc || `${owner}/${repo}`,
        pubDate: now.toISOString().slice(0, 10),
        source_name: "GitHub Trending",
        source_url: "https://github.com/trending",
        fetched_at: now.toISOString(),
      });
    }
    return articles;
  } catch (err) {
    console.error(`  [WARN] GitHub Trending — ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// HuggingFace Daily Papers
// ---------------------------------------------------------------------------

async function fetchHFPapers(timeoutMs = 30000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch("https://huggingface.co/api/daily_papers", {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const items = Array.isArray(json) ? json : [];

    return items.slice(0, 15).map((paper) => {
      const id = paper.paper?.id || paper.id || "";
      const title = paper.paper?.title || paper.title || "";
      const summary = paper.paper?.summary || paper.summary || "";
      const upvotes = paper.paper?.upvotes ?? paper.upvotes ?? 0;
      const pubDate = paper.publishedAt || paper.paper?.publishedAt || "";

      // Extract GitHub link from authors or summary
      const ghMatch = summary.match(/github\.com\/[^\s)"'<>]+/i);
      const ghLink = ghMatch ? ghMatch[0] : "";

      let desc = summary.slice(0, 300);
      if (upvotes) desc += ` | Upvotes: +${upvotes}`;
      if (ghLink) desc += ` | GitHub: ${ghLink}`;

      return {
        title,
        link: id ? `https://huggingface.co/papers/${id}` : "",
        description: desc,
        pubDate: pubDate ? new Date(pubDate).toUTCString() : now.toUTCString(),
        source_name: "HuggingFace Papers",
        source_url: "https://huggingface.co/papers",
        fetched_at: now.toISOString(),
      };
    }).filter((a) => a.link);
  } catch (err) {
    console.error(`  [WARN] HuggingFace Papers — ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// WallStreetCN
// ---------------------------------------------------------------------------

async function fetchWallStreetCN(timeoutMs = 15000) {
  try {
    const url =
      "https://api-one.wallstcn.com/apiv1/content/information-flow?channel=global-channel&accept=article&limit=25";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const items = json?.data?.items || [];

    return items.slice(0, 25).map((item) => {
      const r = item.resource || {};
      const title = r.title || r.content_short || "";
      const link = r.uri || "";
      const ts = r.display_time ? new Date(r.display_time * 1000) : now;

      return {
        title,
        link,
        description: r.content_short || "",
        pubDate: ts.toUTCString(),
        source_name: "华尔街见闻",
        source_url: "https://wallstreetcn.com",
        fetched_at: now.toISOString(),
      };
    }).filter((a) => a.title && a.link);
  } catch (err) {
    console.error(`  [WARN] 华尔街见闻 — ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// V2EX Hot Topics
// ---------------------------------------------------------------------------

async function fetchV2EXHot(timeoutMs = 20000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch("https://www.v2ex.com/api/topics/hot.json", {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const items = await resp.json();

    return items.slice(0, 15).map((topic) => ({
      title: topic.title || "",
      link: topic.url || "",
      description: `${topic.replies || 0} 回复 | ${topic.member?.username || ""}`,
      pubDate: topic.created
        ? new Date(topic.created * 1000).toUTCString()
        : now.toUTCString(),
      source_name: "V2EX",
      source_url: "https://www.v2ex.com",
      fetched_at: now.toISOString(),
    })).filter((a) => a.title);
  } catch (err) {
    console.error(`  [WARN] V2EX Hot — ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dedup (same logic as sync-feeds.mjs)
// ---------------------------------------------------------------------------

function dedup(articles) {
  const seen = new Set();
  return articles.filter((a) => {
    const key = a.link || `${a.source_name}:${a.title}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ALL_SOURCES = {
  weibo: { name: "微博热搜", fn: fetchWeiboHot },
  github: { name: "GitHub Trending", fn: fetchGitHubTrending },
  huggingface: { name: "HuggingFace Papers", fn: fetchHFPapers },
  wallstreetcn: { name: "华尔街见闻", fn: fetchWallStreetCN },
  v2ex: { name: "V2EX 热门", fn: fetchV2EXHot },
};

async function main() {
  // Parse --sources flag
  let selectedSources = Object.keys(ALL_SOURCES);
  const sourcesIdx = process.argv.indexOf("--sources");
  if (sourcesIdx !== -1 && process.argv[sourcesIdx + 1]) {
    selectedSources = process.argv[sourcesIdx + 1]
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => ALL_SOURCES[s]);
  }

  const tasks = selectedSources.map((key) => {
    const src = ALL_SOURCES[key];
    return src.fn().then((articles) => {
      console.log(`  ✓ ${src.name}: ${articles.length} 条`);
      return articles;
    });
  });

  const results = await Promise.allSettled(tasks);
  let extras = [];
  for (const r of results) {
    if (r.status === "fulfilled") extras.push(...r.value);
  }

  // Merge with existing articles
  let existing = [];
  if (existsSync(ARTICLES_PATH)) {
    try {
      existing = JSON.parse(readFileSync(ARTICLES_PATH, "utf-8"));
    } catch {}
  }

  const merged = dedup([...extras, ...existing]);

  // Sort by pubDate descending
  merged.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  writeFileSync(ARTICLES_PATH, JSON.stringify(merged, null, 2), "utf-8");
  console.log(
    `✓ 补充源完成: 新增 ${extras.length} 条，合并后共 ${merged.length} 条`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
