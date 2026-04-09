#!/usr/bin/env node
/**
 * gen-briefing.mjs — Assemble briefing.json from AI analysis + articles-slim.json.
 *
 * Reads:
 *   data/analysis.json   (AI-generated analysis: global_brief, domain_briefs, highlight_facts, highlight_opinions)
 *   data/articles-slim.json  (preprocessed articles with full metadata)
 *
 * Outputs:
 *   data/briefing.json   (complete briefing ready for render scripts)
 *
 * Usage:
 *   node scripts/gen-briefing.mjs
 *
 * Zero external dependencies.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";
import { loadAndValidateAnalysis } from "../lib/analysis-json.mjs";

const PATHS = getRuntimePaths();
const ANALYSIS_PATH = PATHS.analysisPath;
const SLIM_PATH = PATHS.slimArticlesPath;
const BRIEFING_PATH = PATHS.briefingPath;

function main() {
  // Read AI analysis
  const analysis = loadAndValidateAnalysis(ANALYSIS_PATH, { persistRepair: true });

  // Read slim articles for coverage stats
  let slim = [];
  try {
    slim = JSON.parse(readFileSync(SLIM_PATH, "utf-8"));
  } catch { /* no slim file */ }

  // Compute coverage
  const sources = new Set(slim.map((a) => a.source).filter(Boolean));

  const briefing = {
    created_at: new Date().toISOString(),
    global_brief: analysis.global_brief || "",
    domain_briefs: analysis.domain_briefs || {},
    highlight_facts: analysis.highlight_facts || [],
    highlight_opinions: analysis.highlight_opinions || [],
    coverage: {
      sources_count: sources.size,
      articles_count: slim.length,
    },
    model_meta: {
      provider: "claude",
      model: "claude",
    },
  };

  // Merge title translations into slim articles
  const translations = analysis.title_translations || {};
  if (Object.keys(translations).length > 0 && slim.length > 0) {
    for (const a of slim) {
      if (translations[a.title]) {
        a.title_cn = translations[a.title];
      }
    }
    writeFileSync(SLIM_PATH, JSON.stringify(slim, null, 2), "utf-8");
  }

  writeFileSync(BRIEFING_PATH, JSON.stringify(briefing, null, 2), "utf-8");
  console.log(`✓ Briefing 已生成: ${sources.size} 个源 · ${slim.length} 篇文章`);
}

main();
