#!/usr/bin/env node
/**
 * preprocess-articles.mjs — Slim down articles.json for AI consumption.
 *
 * Reads data/articles.json, strips HTML, truncates descriptions,
 * filters noise, outputs data/articles-slim.json.
 *
 * Usage:
 *   node scripts/preprocess-articles.mjs
 *   node scripts/preprocess-articles.mjs data/articles.json data/articles-slim.json
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const DEFAULT_IN = resolve(SKILL_ROOT, "data", "articles.json");
const DEFAULT_OUT = resolve(SKILL_ROOT, "data", "articles-slim.json");

// ---------------------------------------------------------------------------
// HTML stripping & text cleanup
// ---------------------------------------------------------------------------

/**
 * Strip all HTML tags and decode common entities.
 */
function stripHtml(html) {
  if (!html) return "";
  return html
    // Remove <pre>, <code>, <script>, <style> blocks entirely
    .replace(/<(?:pre|code|script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Remove all HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate text to maxLen chars, breaking at word boundary.
 */
function truncate(text, maxLen = 150) {
  if (!text || text.length <= maxLen) return text || "";
  // Find the last space before maxLen
  const cut = text.lastIndexOf(" ", maxLen - 1);
  return (cut > maxLen * 0.6 ? cut : maxLen) < text.length
    ? text.slice(0, cut > maxLen * 0.6 ? cut : maxLen) + "..."
    : text;
}

// ---------------------------------------------------------------------------
// Noise filters
// ---------------------------------------------------------------------------

/** Patterns that indicate noise (commit messages, trivial posts). */
const NOISE_PATTERNS = [
  // Git commit messages from repo feeds
  /^(?:fix|feat|refactor|test|docs|chore|ci|build|style|perf)\b\(?[a-z_-]*\)?:/,
  // Single-line code snippets or trivial commits
  /^(?:Tests?|Matrix|Pi)\s*:/,
  // Bare commit hash links with no meaningful description
  /^<pre style/,
];

/** Sources whose undated articles are almost certainly stale noise. */
const STALE_UNDATED_SOURCES = new Set([
  "A List Apart",
  "Vercel Blog",
]);

/** Keywords indicating promotional / deal content (not news). */
const PROMO_KEYWORDS = [
  "promo code",
  "discount code",
  "coupon",
  "deals:",
  "best deals",
  "save on",
  "is $.*off",
  "under $\\d+",
  "spring sale",
  "black friday",
  "prime day",
];

/**
 * Check if an article is noise that should be filtered out.
 */
function isNoise(article) {
  const title = (article.title || "").trim();
  const desc = (article.description || "").trim();
  const date = (article.pubDate || "").trim().toLowerCase();
  const source = (article.source_name || "").trim();

  // No title at all
  if (!title) return true;

  // Match noise patterns
  for (const pat of NOISE_PATTERNS) {
    if (pat.test(title)) return true;
  }

  // Filter stale/undated articles from known-noise sources
  if (STALE_UNDATED_SOURCES.has(source) && (!date || date === "null")) return true;

  // Filter promotional / deal content
  const lowerTitle = title.toLowerCase();
  const lowerDesc = desc.toLowerCase();
  for (const kw of PROMO_KEYWORDS) {
    if (new RegExp(kw, "i").test(lowerTitle) || new RegExp(kw, "i").test(lowerDesc)) return true;
  }

  // Very short description after stripping HTML (< 20 chars) and short title
  const cleanDesc = stripHtml(desc);
  if (cleanDesc.length < 20 && title.length < 15) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Process raw articles into slim + tiny formats.
 * slim: full metadata (for render scripts)
 * tiny: title + desc only (for AI consumption)
 */
function processArticles(raw) {
  const slim = [];
  let filtered = 0;

  for (const a of raw) {
    if (isNoise(a)) {
      filtered++;
      continue;
    }

    const desc = truncate(stripHtml(a.description), 150);

    slim.push({
      title: a.title,
      link: a.link,
      desc,
      date: a.pubDate || "",
      source: a.source_name || "",
    });
  }

  const titles = slim.map((a) => a.title);

  return { articles: slim, titles, filtered };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const inPath = process.argv[2] || DEFAULT_IN;
  const outPath = process.argv[3] || DEFAULT_OUT;

  const raw = JSON.parse(readFileSync(inPath, "utf-8"));

  const { articles: slim, titles, filtered } = processArticles(raw);

  // Write slim (full metadata, for render scripts)
  const slimJson = JSON.stringify(slim, null, 2);
  writeFileSync(outPath, slimJson, "utf-8");

  // Write titles (plain text, one per line, for AI)
  const titlesOutPath = resolve(dirname(outPath), "articles-titles.txt");
  writeFileSync(titlesOutPath, titles.join("\n"), "utf-8");

  const filteredMsg = filtered > 0 ? `，过滤 ${filtered} 篇噪音` : "";
  console.log(`✓ 预处理完成: ${slim.length} 篇有效文章${filteredMsg}`);
}

main();
