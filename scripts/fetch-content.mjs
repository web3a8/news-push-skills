#!/usr/bin/env node
/**
 * fetch-content.mjs — Deep fetch article content for richer AI analysis.
 *
 * Reads articles.json, fetches full HTML for articles with thin descriptions,
 * strips noise, truncates to ~3000 chars, and adds a `content` field.
 *
 * Usage:
 *   node scripts/fetch-content.mjs              # auto-select thin-desc articles
 *   node scripts/fetch-content.mjs --limit 20   # limit to top 20 by recency
 *   node scripts/fetch-content.mjs --all        # fetch content for all articles
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const DEFAULT_IN = PATHS.articlesPath;

const MAX_CONTENT_LEN = 3000;
const DEFAULT_CONCURRENCY = 8;

// ---------------------------------------------------------------------------
// HTML cleaning (same pattern as preprocess-articles.mjs)
// ---------------------------------------------------------------------------

function stripNoise(html) {
  if (!html) return "";
  return html
    .replace(/<(?:script|style|nav|footer|header|aside|iframe|nosvg|svg)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || "";
  const cut = text.lastIndexOf(" ", maxLen - 1);
  const pos = cut > maxLen * 0.6 ? cut : maxLen;
  return text.slice(0, pos) + "...";
}

// ---------------------------------------------------------------------------
// Fetch & clean
// ---------------------------------------------------------------------------

async function fetchContent(url, timeoutMs = 10000) {
  if (!url || !url.startsWith("http")) return "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!resp.ok) return "";
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("text/") && !ct.includes("html")) return "";

    const html = await resp.text();
    return truncate(stripNoise(html), MAX_CONTENT_LEN);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Article selection
// ---------------------------------------------------------------------------

function selectArticles(articles, maxCount) {
  return articles
    .filter((a) => {
      // Skip if already has content
      if (a.content && a.content.length > 100) return false;
      // Must have a valid link
      if (!a.link || !a.link.startsWith("http")) return false;
      return true;
    })
    .slice(0, maxCount);
}

// ---------------------------------------------------------------------------
// Concurrent enrichment
// ---------------------------------------------------------------------------

async function enrichArticles(articles, concurrency = DEFAULT_CONCURRENCY) {
  const queue = [...articles];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const article = queue.shift();
      if (!article) break;
      const content = await fetchContent(article.link);
      if (content) {
        article.content = content;
      }
      done++;
      if (done % 5 === 0 || done === articles.length) {
        process.stdout.write(`\r  深度抓取: ${done}/${articles.length} 篇   `);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, articles.length) },
    () => worker()
  );
  await Promise.all(workers);
  process.stdout.write("\r" + " ".repeat(50) + "\r");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const fetchAll = args.includes("--all");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) || 20 : 20;
  // Custom input path: first arg that looks like a file path (not a flag, not a number)
  const inPath = args.find((a) => !a.startsWith("--") && isNaN(Number(a)) && !a.match(/^\d+$/)) || DEFAULT_IN;

  const articles = JSON.parse(readFileSync(inPath, "utf-8"));
  const candidates = fetchAll
    ? articles.filter((a) => a.link?.startsWith("http"))
    : selectArticles(articles, limit);

  if (candidates.length === 0) {
    console.log("✓ 无需深度抓取（所有文章已有内容或无有效链接）");
    return;
  }

  console.log(`  选定 ${candidates.length} 篇文章进行深度抓取...`);
  await enrichArticles(candidates);

  const enriched = candidates.filter((a) => a.content).length;
  writeFileSync(inPath, JSON.stringify(articles, null, 2), "utf-8");
  console.log(`✓ 深度抓取完成: ${enriched}/${candidates.length} 篇成功`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
