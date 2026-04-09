#!/usr/bin/env node
/**
 * write-analysis.mjs — Safely write analysis.json from a JS object module or raw JSON.
 *
 * Preferred:
 *   node scripts/write-analysis.mjs --from-module ./.news-push/data/analysis-source.mjs
 *
 * Alternatives:
 *   node scripts/write-analysis.mjs --from-json ./draft-analysis.json
 *   cat analysis.json | node scripts/write-analysis.mjs --stdin
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRuntimePaths } from "../lib/runtime-paths.mjs";
import { loadAnalysisModule, parseAnalysisText, writeAnalysisJson } from "../lib/analysis-json.mjs";

function parseArgs(argv) {
  const opts = {
    workspace: process.cwd(),
    fromModule: "",
    fromJson: "",
    fromStdin: false,
    output: "",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--workspace":
        opts.workspace = argv[++i] || opts.workspace;
        break;
      case "--from-module":
        opts.fromModule = argv[++i] || "";
        break;
      case "--from-json":
        opts.fromJson = argv[++i] || "";
        break;
      case "--stdin":
        opts.fromStdin = true;
        break;
      case "--output":
        opts.output = argv[++i] || "";
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        break;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage:
  node scripts/write-analysis.mjs --from-module <analysis-source.mjs> [--workspace PATH]
  node scripts/write-analysis.mjs --from-json <draft-analysis.json> [--workspace PATH]
  cat analysis.json | node scripts/write-analysis.mjs --stdin [--workspace PATH]

Notes:
  - Prefer --from-module so the analysis is authored as a JS object, then serialized with JSON.stringify.
  - Output defaults to <workspace>/.news-push/data/analysis.json
`);
}

async function loadSource(opts) {
  if (opts.fromModule) {
    return loadAnalysisModule(resolve(opts.fromModule));
  }
  if (opts.fromJson) {
    return parseAnalysisText(readFileSync(resolve(opts.fromJson), "utf-8"), resolve(opts.fromJson));
  }
  if (opts.fromStdin) {
    return parseAnalysisText(readFileSync(0, "utf-8"), "<stdin>");
  }
  throw new Error("请提供 --from-module、--from-json 或 --stdin 其中之一");
}

async function main() {
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

  const analysis = await loadSource(opts);
  const outputPath = opts.output ? resolve(opts.output) : paths.analysisPath;
  writeAnalysisJson(outputPath, analysis);
  console.log(`✓ analysis.json 已安全写入: ${outputPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
