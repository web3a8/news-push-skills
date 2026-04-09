#!/usr/bin/env node
/**
 * validate-analysis.mjs — Parse and validate analysis.json with friendly errors.
 */

import { resolve } from "node:path";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";
import { getAnalysisMeta, loadAndValidateAnalysis } from "../lib/analysis-json.mjs";

function parseArgs(argv) {
  const opts = {
    workspace: process.cwd(),
    input: "",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--workspace":
        opts.workspace = argv[++i] || opts.workspace;
        break;
      case "--input":
        opts.input = argv[++i] || "";
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        if (!opts.input) {
          opts.input = arg;
        }
        break;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage:
  node scripts/validate-analysis.mjs [analysis.json path]
  node scripts/validate-analysis.mjs --workspace "$PWD"
`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const previousRoot = process.env.NEWS_PUSH_RUNTIME_ROOT;
  process.env.NEWS_PUSH_RUNTIME_ROOT = resolve(opts.workspace, ".news-push");
  const paths = getRuntimePaths();
  if (previousRoot == null) {
    delete process.env.NEWS_PUSH_RUNTIME_ROOT;
  } else {
    process.env.NEWS_PUSH_RUNTIME_ROOT = previousRoot;
  }

  const inputPath = opts.input ? resolve(opts.input) : paths.analysisPath;
  const analysis = loadAndValidateAnalysis(inputPath, { persistRepair: true });
  const meta = getAnalysisMeta(analysis);

  if (meta.repaired || meta.droppedLines > 0 || meta.droppedItems > 0) {
    console.log(`✓ analysis.json 已自动修复: ${inputPath}`);
    if (meta.droppedLines > 0) {
      console.log(`  - 自动移除异常行: ${meta.droppedLines}`);
    }
    if (meta.droppedItems > 0) {
      console.log(`  - 自动丢弃坏条目: ${meta.droppedItems}`);
    }
    for (const warning of meta.warnings.slice(0, 5)) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log(`✓ analysis.json 校验通过: ${inputPath}`);
  }
  console.log(`  - domain briefs: ${Object.keys(analysis.domain_briefs).length}`);
  console.log(`  - facts: ${analysis.highlight_facts.length}`);
  console.log(`  - opinions: ${analysis.highlight_opinions.length}`);
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
