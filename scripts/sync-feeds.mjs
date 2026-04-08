#!/usr/bin/env node
/**
 * sync-feeds.mjs — Fetch RSS/Atom feeds from OPML and output articles as JSON.
 *
 * Usage:
 *   node scripts/sync-feeds.mjs            # reads feeds.opml from skill root
 *   node scripts/sync-feeds.mjs out.json   # custom output path
 *
 * Zero external dependencies. Uses only Node.js built-in fetch + regex XML parsing.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const DEFAULT_OPML = PATHS.feedsPath;
const DEFAULT_OUT = PATHS.articlesPath;

// ---------------------------------------------------------------------------
// OPML parsing
// ---------------------------------------------------------------------------

/**
 * Extract feed URLs from an OPML file.
 * @param {string} xml — OPML XML content
 * @returns {Array<{name: string, url: string}>}
 */
function parseOpml(xml) {
  const feeds = [];
  const seen = new Set();
  // Extract all <outline ... /> elements with xmlUrl
  const outlineRe = /<outline\b[^>]*?\/?>/gi;
  let om;
  while ((om = outlineRe.exec(xml)) !== null) {
    const tag = om[0];
    const urlMatch = tag.match(/xmlUrl\s*=\s*["']([^"']+)["']/i);
    if (!urlMatch) continue;
    const url = urlMatch[1].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    // Try text= first, then title=
    const nameMatch = tag.match(/\btext\s*=\s*["']([^"']*)["']/i)
      || tag.match(/\btitle\s*=\s*["']([^"']*)["']/i);
    const name = nameMatch ? nameMatch[1].trim() : url;
    feeds.push({ name, url });
  }
  return feeds;
}

// ---------------------------------------------------------------------------
// RSS / Atom parsing
// ---------------------------------------------------------------------------

/**
 * Extract text content of the first XML tag matching `tagName`.
 */
function getTag(xml, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = xml.match(re);
  if (m) return unescape(m[1].trim());
  // self-closing or attribute-only form
  const attrRe = new RegExp(`<${tagName}[^>]*?href=["']([^"']+)["']`, "i");
  const am = xml.match(attrRe);
  return am ? am[1] : "";
}

/**
 * Minimal HTML entity unescape.
 */
function unescape(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/**
 * Parse RSS 2.0 <item> elements from feed XML.
 */
function parseRssItems(xml) {
  const items = [];
  const re = /<item[\s>]?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: getTag(block, "title"),
      link: getTag(block, "link"),
      description: getTag(block, "description"),
      pubDate: getTag(block, "pubDate"),
    });
  }
  return items;
}

/**
 * Parse Atom <entry> elements from feed XML.
 */
function parseAtomEntries(xml) {
  const entries = [];
  const re = /<entry[\s>]?>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    // Atom uses <link href="..." rel="alternate" />
    let link = "";
    const linkRe = /<link[^>]*?rel=["']alternate["'][^>]*?href=["']([^"']+)["']/i;
    const linkRe2 = /<link[^>]*?href=["']([^"']+)["'][^>]*?rel=["']alternate["']/i;
    const linkRe3 = /<link[^>]*?href=["']([^"']+)["'][^>]*?>/i;
    const lm = block.match(linkRe) || block.match(linkRe2) || block.match(linkRe3);
    if (lm) link = lm[1];

    entries.push({
      title: getTag(block, "title"),
      link,
      description: getTag(block, "summary") || getTag(block, "content"),
      pubDate: getTag(block, "published") || getTag(block, "updated"),
    });
  }
  return entries;
}

/**
 * Parse a feed (RSS or Atom) and return normalized articles.
 */
function parseFeed(xml) {
  if (/<entry[\s>]/i.test(xml)) {
    return parseAtomEntries(xml);
  }
  return parseRssItems(xml);
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a single feed URL, return parsed articles or empty array on error.
 */
async function fetchFeed(name, url, timeoutMs = 15000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "news-push/1.0 (RSS reader)" },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.error(`  [WARN] ${name} — HTTP ${resp.status}`);
      return [];
    }
    const xml = await resp.text();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const articles = parseFeed(xml)
      .filter((a) => {
        if (!a.pubDate) return true;
        const ts = new Date(a.pubDate).getTime();
        return ts > 0 && ts >= cutoff;
      });
    return articles.map((a) => ({
      ...a,
      source_name: name,
      source_url: url,
      fetched_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.error(`  [WARN] ${name} — ${err.message}`);
    return [];
  }
}

/**
 * Draw a single-line progress bar that overwrites itself.
 * @param {number} done — completed feeds
 * @param {number} total — total feeds
 * @param {string} current — name of the feed currently being fetched
 * @param {number} articleCount — articles collected so far
 */
function drawProgress(done, total, current, articleCount) {
  const cols = 30;
  const filled = Math.round((done / total) * cols);
  const bar = "█".repeat(filled) + "░".repeat(cols - filled);
  const pct = Math.round((done / total) * 100);
  const name = current.length > 28 ? current.slice(0, 25) + "..." : current;
  process.stdout.write(
    `\r  [${done}/${total}] ${bar} ${pct}% │ ${articleCount} articles │ ${name}   `
  );
}

/**
 * Fetch feeds with bounded concurrency and a live progress bar.
 */
async function fetchAll(feeds, concurrency = 15) {
  const results = [];
  const queue = [...feeds];
  let done = 0;
  const total = feeds.length;

  // Print initial empty bar
  drawProgress(0, total, "starting...", 0);

  async function worker() {
    while (queue.length > 0) {
      const feed = queue.shift();
      if (!feed) break;
      drawProgress(done, total, feed.name, results.length);
      const articles = await fetchFeed(feed.name, feed.url);
      results.push(...articles);
      done++;
      drawProgress(done, total, feed.name, results.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, feeds.length) }, () => worker());
  await Promise.all(workers);

  // Final line — clear the progress bar
  process.stdout.write("\r" + " ".repeat(90) + "\r");
  return results;
}

// ---------------------------------------------------------------------------
// Dedup & sort
// ---------------------------------------------------------------------------

function dedupAndSort(articles) {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours ago
  const seen = new Set();
  const unique = [];
  for (const a of articles) {
    // Skip articles older than 24 hours
    if (a.pubDate) {
      const ts = new Date(a.pubDate).getTime();
      if (ts > 0 && ts < cutoff) continue;
    }
    const key = a.link || `${a.source_name}:${a.title}`;
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }
  // Sort by pubDate descending (most recent first)
  unique.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });
  return unique;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opmlPath = DEFAULT_OPML;
  const outPath = process.argv[2] || DEFAULT_OUT;

  const opmlXml = readFileSync(opmlPath, "utf-8");
  const feeds = parseOpml(opmlXml);

  const raw = await fetchAll(feeds);
  const articles = dedupAndSort(raw);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(articles, null, 2), "utf-8");
  console.log(`✓ 已获取 ${articles.length} 篇文章 (来自 ${feeds.length} 个源)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
