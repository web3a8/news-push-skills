#!/usr/bin/env node
/**
 * manage-opml.mjs — Manage RSS subscriptions in feeds.opml.
 *
 * Usage:
 *   node scripts/manage-opml.mjs list
 *   node scripts/manage-opml.mjs add "Feed Name" "https://example.com/feed.xml"
 *   node scripts/manage-opml.mjs remove "Feed Name"
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const OPML_PATH = resolve(SKILL_ROOT, "feeds.opml");

// ---------------------------------------------------------------------------
// OPML parsing helpers
// ---------------------------------------------------------------------------

function parseFeeds(xml) {
  const feeds = [];
  const seen = new Set();
  const re = /<outline\b[^>]*?\/?>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const tag = m[0];
    const urlMatch = tag.match(/xmlUrl\s*=\s*["']([^"']+)["']/i);
    if (!urlMatch) continue;
    const url = urlMatch[1].trim();
    if (seen.has(url)) continue;
    seen.add(url);
    const nameMatch = tag.match(/\btext\s*=\s*["']([^"']*)["']/i)
      || tag.match(/\btitle\s*=\s*["']([^"']*)["']/i);
    const name = nameMatch ? nameMatch[1].trim() : url;
    feeds.push({ name, url, tag });
  }
  return feeds;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function listFeeds() {
  const xml = readFileSync(OPML_PATH, "utf-8");
  const feeds = parseFeeds(xml);
  if (feeds.length === 0) {
    console.log("暂无订阅源。");
    return;
  }
  console.log(`共 ${feeds.length} 个订阅源：\n`);
  for (let i = 0; i < feeds.length; i++) {
    console.log(`  ${i + 1}. ${feeds[i].name}`);
    console.log(`     ${feeds[i].url}\n`);
  }
}

function addFeed(name, url) {
  if (!name || !url) {
    console.error("用法: node manage-opml.mjs add \"名称\" \"URL\"");
    process.exit(1);
  }

  const xml = readFileSync(OPML_PATH, "utf-8");
  const feeds = parseFeeds(xml);

  // Check for duplicate URL
  if (feeds.some((f) => f.url === url)) {
    console.error(`URL 已存在: ${url}`);
    process.exit(1);
  }

  // Check for duplicate name
  if (feeds.some((f) => f.name === name)) {
    console.error(`名称已存在: ${name}`);
    process.exit(1);
  }

  // Build new outline tag
  const escapedName = name.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const escapedUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const newOutline = `    <outline text="${escapedName}" title="${escapedName}" type="rss" xmlUrl="${escapedUrl}" />\n`;

  // Insert before </body>
  const updated = xml.replace("</body>", `${newOutline}  </body>`);
  writeFileSync(OPML_PATH, updated, "utf-8");

  console.log(`已添加: ${name} (${url})`);
}

function removeFeed(name) {
  if (!name) {
    console.error("用法: node manage-opml.mjs remove \"名称\"");
    process.exit(1);
  }

  const xml = readFileSync(OPML_PATH, "utf-8");
  const feeds = parseFeeds(xml);

  const target = feeds.find(
    (f) => f.name.toLowerCase() === name.toLowerCase()
  );
  if (!target) {
    console.error(`未找到: ${name}`);
    process.exit(1);
  }

  // Remove the matching outline line
  const lines = xml.split("\n");
  const filtered = lines.filter(
    (line) => !line.includes(`xmlUrl="${target.url.replace(/&/g, "&amp;")}"`)
  );

  if (filtered.length === lines.length) {
    console.error(`未找到匹配的行: ${name}`);
    process.exit(1);
  }

  writeFileSync(OPML_PATH, filtered.join("\n"), "utf-8");
  console.log(`已删除: ${target.name} (${target.url})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const command = process.argv[2];

  switch (command) {
    case "list":
      listFeeds();
      break;
    case "add":
      addFeed(process.argv[3], process.argv[4]);
      break;
    case "remove":
      removeFeed(process.argv[3]);
      break;
    default:
      console.log("用法:");
      console.log("  node scripts/manage-opml.mjs list");
      console.log('  node scripts/manage-opml.mjs add "名称" "URL"');
      console.log('  node scripts/manage-opml.mjs remove "名称"');
      process.exit(command ? 1 : 0);
  }
}

main();
