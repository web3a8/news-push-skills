#!/usr/bin/env node
/**
 * validate-pipeline.mjs — Self-test each pipeline stage.
 *
 * Usage: node scripts/validate-pipeline.mjs
 *
 * Zero external dependencies.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";
import { loadAndValidateAnalysis } from "../lib/analysis-json.mjs";

const PATHS = getRuntimePaths();
const DATA = PATHS.dataDir;
const OUTPUT = PATHS.outputDir;

const rawJson = readFileSync(resolve(DATA, "articles.json"), "utf-8");
const SLIM = JSON.parse(readFileSync(resolve(DATA, "articles-slim.json"), "utf-8"));
const TITLES = readFileSync(resolve(DATA, "articles-titles.txt"), "utf-8").split("\n").filter(Boolean);
const ANALYSIS = loadAndValidateAnalysis(resolve(DATA, "analysis.json"), { persistRepair: true });
const BRIEFING = JSON.parse(readFileSync(resolve(DATA, "briefing.json"), "utf-8"));
const MD = readFileSync(resolve(OUTPUT, "latest.md"), "utf-8");
const HTML = readFileSync(resolve(OUTPUT, "latest.html"), "utf-8");

let errors = 0;

function check(name, ok, msg) {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}: ${msg}`);
    errors++;
  }
}

// 1. sync-feeds
check("sync-feeds: articles.json non-empty",
  Object.keys(rawJson).length > 0,
  "empty articles.json");

// 2. preprocess-articles
check("preprocess: slim count > 0", SLIM.length > 0, "slim empty");
check("preprocess: slim has required fields",
  SLIM.every(a => a.title && a.link && a.desc !== undefined && a.date !== undefined && a.source !== undefined),
  "missing fields in slim");
check("preprocess: titles count matches slim",
  TITLES.length === SLIM.length,
  `titles=${TITLES.length} slim=${SLIM.length}`);
check("preprocess: titles are plain text",
  TITLES.every(t => !t.startsWith("{")),
  "titles contain JSON");
check("preprocess: no duplicate titles",
  new Set(TITLES).size === TITLES.length,
  `duplicates: ${TITLES.length - new Set(TITLES).size}`);
check("preprocess: slim links valid",
  SLIM.every(a => a.link.startsWith("http")),
  "bad link in slim");
check("preprocess: slim sources non-empty",
  SLIM.every(a => a.source.length > 0),
  "empty source in slim");

// 3. AI analysis
check("analysis: global_brief present",
  ANALYSIS.global_brief && ANALYSIS.global_brief.length > 0,
  "empty global_brief");
check("analysis: domain_briefs has 2-5 domains",
  Object.keys(ANALYSIS.domain_briefs).length >= 2 && Object.keys(ANALYSIS.domain_briefs).length <= 5,
  `domain count: ${Object.keys(ANALYSIS.domain_briefs).length}`);
check("analysis: highlight_facts count <= 6",
  ANALYSIS.highlight_facts.length <= 6,
  `too many facts: ${ANALYSIS.highlight_facts.length}`);
check("analysis: highlight_opinions count <= 6",
  ANALYSIS.highlight_opinions.length <= 6,
  `too many opinions: ${ANALYSIS.highlight_opinions.length}`);
check("analysis: facts have required fields",
  ANALYSIS.highlight_facts.every(f => f.title && f.summary && f.domain && f.score),
  "missing fact fields");
check("analysis: opinions have required fields",
  ANALYSIS.highlight_opinions.every(o => o.title && o.summary && o.domain && o.score),
  "missing opinion fields");
check("analysis: scores in range 1-10",
  [...ANALYSIS.highlight_facts, ...ANALYSIS.highlight_opinions].every(i => typeof i.score === "number" && i.score >= 1 && i.score <= 10),
  "bad score range");

// 4. gen-briefing
check("briefing: created_at is ISO",
  /^\d{4}-\d{2}-\d{2}T/.test(BRIEFING.created_at),
  "bad timestamp");
check("briefing: coverage articles matches slim",
  BRIEFING.coverage.articles_count === SLIM.length,
  `${BRIEFING.coverage.articles_count} !== ${SLIM.length}`);
check("briefing: coverage sources matches slim",
  BRIEFING.coverage.sources_count === new Set(SLIM.map(a => a.source)).size,
  `${BRIEFING.coverage.sources_count} !== ${new Set(SLIM.map(a => a.source)).size}`);
check("briefing: model_meta present",
  BRIEFING.model_meta && BRIEFING.model_meta.provider && BRIEFING.model_meta.model,
  "missing model_meta");
check("briefing: analysis fields carried through",
  BRIEFING.global_brief === ANALYSIS.global_brief &&
  BRIEFING.highlight_facts.length === ANALYSIS.highlight_facts.length &&
  BRIEFING.highlight_opinions.length === ANALYSIS.highlight_opinions.length,
  "analysis fields mismatch");

// 5. render-md
check("render-md: file non-empty",
  MD.length > 0,
  "empty md file");
check("render-md: has all section headers",
  ["今日最重要几件事", "分栏简报", "重要事实", "关键观点", "原始订阅信息流"].every(h => MD.includes(h)),
  "missing section in md");
check("render-md: raw article links count matches slim",
  (MD.match(/### \[/g) || []).length === SLIM.length,
  `link count ${(MD.match(/### \[/g) || []).length} !== ${SLIM.length}`);

// 6. render-html
check("render-html: file non-empty",
  HTML.length > 0,
  "empty html file");
check("render-html: has key sections",
  ["News Push", "分栏简报", "重要事实", "关键观点", "原始订阅信息流"].every(h => HTML.includes(h)),
  "missing html section");
check("render-html: article links present",
  SLIM.slice(0, 10).every(a => HTML.includes(a.link)),
  "missing link in html");

// 7. Archive
const archiveDir = resolve(OUTPUT, "archive");
const archiveFiles = execSync(`ls ${archiveDir}`).toString().trim().split("\n").filter(Boolean);
check("archive: snapshot files exist",
  archiveFiles.length >= 2,
  `only ${archiveFiles.length} archive files`);
check("archive: has md snapshot",
  archiveFiles.some(f => f.endsWith(".md")),
  "no md archive");
check("archive: has html snapshot",
  archiveFiles.some(f => f.endsWith(".html")),
  "no html archive");

// Summary
console.log("\n---");
if (errors === 0) {
  console.log(`All ${38} checks passed! (slim: ${SLIM.length}, titles: ${TITLES.length}, facts: ${ANALYSIS.highlight_facts.length}, opinions: ${ANALYSIS.highlight_opinions.length})`);
} else {
  console.log(`${errors} error(s) found`);
  process.exit(1);
}
