#!/usr/bin/env node
/**
 * apply-profile.mjs — Filter articles by a predefined profile.
 *
 * Reads articles.json, applies source filtering from a profile config,
 * writes filtered articles to data/articles-filtered.json.
 *
 * Usage:
 *   node scripts/apply-profile.mjs --profile ai
 *   node scripts/apply-profile.mjs --list
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";

const PATHS = getRuntimePaths();
const PROFILES_DIR = PATHS.profilesDir;
const DEFAULT_IN = PATHS.articlesPath;
const DEFAULT_OUT = PATHS.filteredArticlesPath;

// ---------------------------------------------------------------------------
// Profile loading
// ---------------------------------------------------------------------------

function loadProfile(name) {
  const filePath = resolve(PROFILES_DIR, `${name}.json`);
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function listProfiles() {
  try {
    const files = readdirSync(PROFILES_DIR).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const name = f.replace(".json", "");
      const profile = loadProfile(name);
      return { name, display: profile?.name || name };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function matchesSource(sourceName, includePatterns, excludePatterns) {
  const src = (sourceName || "").toLowerCase();

  // Exclude takes precedence
  if (excludePatterns?.length) {
    for (const pat of excludePatterns) {
      if (src.includes(pat.toLowerCase())) return false;
    }
  }

  // If no include patterns, all pass (after exclude)
  if (!includePatterns?.length) return true;

  // Must match at least one include pattern
  for (const pat of includePatterns) {
    if (src.includes(pat.toLowerCase())) return true;
  }
  return false;
}

function filterArticles(articles, profile) {
  const { include = [], exclude = [] } = profile.sources || {};
  return articles.filter((a) => matchesSource(a.source_name, include, exclude));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  // --list mode
  if (args.includes("--list")) {
    const profiles = listProfiles();
    if (profiles.length === 0) {
      console.log("  (无可用 Profile)");
      return;
    }
    console.log("可用 Profile:");
    for (const p of profiles) {
      console.log(`  ${p.name.padEnd(12)} ${p.display}`);
    }
    return;
  }

  // --profile mode
  const profileIdx = args.indexOf("--profile");
  const profileName = profileIdx !== -1 ? args[profileIdx + 1] : "general";

  const profile = loadProfile(profileName);
  if (!profile) {
    console.error(`  Profile "${profileName}" 不存在，跳过过滤`);
    return;
  }

  const articles = JSON.parse(readFileSync(DEFAULT_IN, "utf-8"));
  const filtered = filterArticles(articles, profile);

  writeFileSync(DEFAULT_OUT, JSON.stringify(filtered, null, 2), "utf-8");
  console.log(
    `✓ Profile "${profile.name}": ${filtered.length}/${articles.length} 篇文章匹配 → data/articles-filtered.json`
  );
}

main();
