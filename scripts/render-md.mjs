#!/usr/bin/env node
/**
 * render-md.mjs — Render a briefing JSON into Markdown.
 *
 * Usage:
 *   node scripts/render-md.mjs data/briefing.json
 *   cat data/briefing.json | node scripts/render-md.mjs -
 *
 * Outputs: output/latest.md + output/archive/{timestamp}.md
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const DEFAULT_OUT_DIR = PATHS.outputDir;
const SLIM_PATH = PATHS.slimArticlesPath;

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

function stripUpgradeTag(text) {
  return (text || "").replace(/【focus_on】/g, "").trim();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderMd(briefing) {
  const DOMAIN_LABELS = {
    ai: "AI", finance: "财经", politics: "政治", tech: "科技",
    society: "社会", health: "健康", entertainment: "娱乐",
    sports: "体育", science: "科学", security: "安全", general: "综合",
  };

  // Dynamic domain order: use keys from domain_briefs, skip "general"
  const DOMAIN_ORDER = Object.keys(briefing.domain_briefs || {}).filter(d => d !== "general");

  const coverage = briefing.coverage || {};
  const meta = briefing.model_meta || {};
  const createdAt = formatTimestamp(briefing.created_at);

  const lines = [];

  // Header
  lines.push("# News Push\n");
  lines.push(`> 生成时间：${createdAt} · 处理文章：${coverage.articles_count || 0}\n`);

  // Global brief
  lines.push("## 今日最重要几件事\n");
  lines.push(`${stripUpgradeTag(briefing.global_brief || "本期暂无高信号更新。")}\n`);

  // Domain briefs
  lines.push("## 分栏简报\n");
  for (const domain of DOMAIN_ORDER) {
    const label = DOMAIN_LABELS[domain] || domain;
    const text = stripUpgradeTag((briefing.domain_briefs || {})[domain] || "本期暂无高信号更新。");
    lines.push(`### ${label}\n`);
    lines.push(`${text}\n`);
  }

  // Highlight facts
  lines.push("## 重要事实\n");
  const facts = briefing.highlight_facts || [];
  if (facts.length === 0) {
    lines.push("本期暂无内容。\n");
  } else {
    for (const fact of facts) {
      const domain = DOMAIN_LABELS[fact.domain] || "综合";
      lines.push(`### ${stripUpgradeTag(fact.title || "未命名条目")}\n`);
      lines.push(`- 领域：${domain}`);
      lines.push(`- 分数：${Number(fact.score || 0).toFixed(2)}\n`);
      lines.push(`${(fact.summary || "").trim()}\n`);
    }
  }

  // Highlight opinions
  lines.push("## 关键观点\n");
  const opinions = briefing.highlight_opinions || [];
  if (opinions.length === 0) {
    lines.push("本期暂无内容。\n");
  } else {
    for (const op of opinions) {
      const domain = DOMAIN_LABELS[op.domain] || "综合";
      lines.push(`### ${stripUpgradeTag(op.title || "未命名条目")}\n`);
      lines.push(`- 领域：${domain}`);
      lines.push(`- 分数：${Number(op.score || 0).toFixed(2)}\n`);
      lines.push(`${(op.summary || "").trim()}\n`);
    }
  }

  // Raw articles — from articles-slim.json
  lines.push("## 原始订阅信息流\n");
  let rawArticles = [];
  try {
    if (existsSync(SLIM_PATH)) {
      rawArticles = JSON.parse(readFileSync(SLIM_PATH, "utf-8"));
    }
  } catch { /* fall through */ }
  if (rawArticles.length === 0) {
    lines.push("暂无文章。\n");
  } else {
    for (const a of rawArticles) {
      const pubDate = formatTimestamp(a.date);
      const displayTitle = a.title_cn || a.title;
      lines.push(`### [${displayTitle}](${a.link})\n`);
      lines.push(`${a.source || "未知来源"} · ${pubDate}\n`);
      if (a.title_cn) {
        lines.push(`<small>${a.title}</small>\n`);
      }
      if (a.desc) {
        const clipped = a.desc.length > 220 ? a.desc.slice(0, 219).trim() + "…" : a.desc;
        if (clipped) lines.push(`> ${clipped}\n`);
      }
    }
  }

  // Footer
  const engine = `${meta.provider || "claude"} / ${meta.model || "claude"}`;
  lines.push("---\n");
  lines.push(`_快照引擎：${engine}_\n`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node render-md.mjs <briefing.json>");
    console.error("       cat briefing.json | node render-md.mjs -");
    process.exit(1);
  }

  let jsonStr;
  if (inputPath === "-") {
    jsonStr = readFileSync(0, "utf-8");
  } else {
    jsonStr = readFileSync(resolve(inputPath), "utf-8");
  }

  const briefing = JSON.parse(jsonStr);
  const md = renderMd(briefing);

  const outDir = DEFAULT_OUT_DIR;
  const archiveDir = resolve(outDir, "archive");
  mkdirSync(archiveDir, { recursive: true });

  const latestPath = resolve(outDir, "latest.md");
  writeFileSync(latestPath, md, "utf-8");

  const ts = fileTimestamp(briefing.created_at);
  const archivePath = resolve(archiveDir, `${ts}-snapshot.md`);
  writeFileSync(archivePath, md, "utf-8");

  console.log(`✓ Markdown 已生成: ${latestPath}`);
}

main();
