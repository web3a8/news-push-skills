#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PACKAGE_ROOT } from "../lib/runtime-paths.mjs";
import { NEWS_PUSH_VERSION } from "../lib/version.mjs";

const SCRIPTS_DIR = resolve(PACKAGE_ROOT, "scripts");

function printHelp() {
  console.log(`News Push CLI ${NEWS_PUSH_VERSION}

Usage:
  news-push [--workspace PATH] [--format md|html|both] [--profile NAME]
  news-push html [--workspace PATH] [--profile NAME]
  news-push both [--workspace PATH] [--profile NAME]
  news-push prepare [--workspace PATH] [--profile NAME] [--skip-extras] [--skip-content]
  news-push finalize [--workspace PATH] [--format md|html|both]
  news-push feeds list [--workspace PATH]
  news-push feeds add "Feed Name" "https://example.com/feed.xml" [--workspace PATH]
  news-push feeds remove "Feed Name" [--workspace PATH]
  news-push paths [--workspace PATH]

Notes:
  - Runtime data is stored in <workspace>/.news-push by default.
  - Running 'news-push' with no subcommand starts the default two-phase flow.
  - The first run prepares articles and titles for AI analysis.
  - After analysis.json is written, run the same command again to render the report.
`);
}

function shouldPrintSessionShell(command) {
  return command !== "paths";
}

function printGreeting() {
  console.log("欢迎使用 News Push");
}

function printVersionFooter() {
  console.log(`版本: ${NEWS_PUSH_VERSION}`);
}

function parseArgs(argv) {
  const opts = {
    workspace: process.cwd(),
    format: "md",
    profile: "",
    skipExtras: false,
    skipContent: false,
    allContent: false,
    contentLimit: 20,
    extraSources: "",
    sendEmail: false,
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--workspace":
        opts.workspace = argv[++i] || opts.workspace;
        break;
      case "--format":
        opts.format = argv[++i] || opts.format;
        break;
      case "--profile":
        opts.profile = argv[++i] || "";
        break;
      case "--skip-extras":
        opts.skipExtras = true;
        break;
      case "--skip-content":
        opts.skipContent = true;
        break;
      case "--all-content":
        opts.allContent = true;
        break;
      case "--content-limit":
        opts.contentLimit = Number(argv[++i] || opts.contentLimit) || opts.contentLimit;
        break;
      case "--sources":
        opts.extraSources = argv[++i] || "";
        break;
      case "--email":
        opts.sendEmail = true;
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        positionals.push(arg);
        break;
    }
  }

  return { opts, positionals };
}

function normalizeFormat(format) {
  return ["md", "html", "both"].includes(format) ? format : "md";
}

function getRuntimePaths(workspace) {
  const workspaceRoot = resolve(workspace);
  const runtimeRoot = resolve(workspaceRoot, ".news-push");
  const dataDir = resolve(runtimeRoot, "data");
  const outputDir = resolve(runtimeRoot, "output");

  return {
    workspaceRoot,
    runtimeRoot,
    dataDir,
    outputDir,
    archiveDir: resolve(outputDir, "archive"),
    feedsPath: resolve(runtimeRoot, "feeds.opml"),
    articlesPath: resolve(dataDir, "articles.json"),
    filteredArticlesPath: resolve(dataDir, "articles-filtered.json"),
    slimArticlesPath: resolve(dataDir, "articles-slim.json"),
    titlesPath: resolve(dataDir, "articles-titles.txt"),
    analysisPath: resolve(dataDir, "analysis.json"),
    briefingPath: resolve(dataDir, "briefing.json"),
    latestMdPath: resolve(outputDir, "latest.md"),
    latestHtmlPath: resolve(outputDir, "latest.html"),
    envPath: resolve(runtimeRoot, ".env"),
  };
}

function ensureRuntime(paths) {
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.archiveDir, { recursive: true });

  if (!existsSync(paths.feedsPath)) {
    copyFileSync(resolve(PACKAGE_ROOT, "feeds.opml"), paths.feedsPath);
  }
}

function makeChildEnv(paths) {
  return {
    ...process.env,
    NEWS_PUSH_RUNTIME_ROOT: paths.runtimeRoot,
  };
}

function runScript(scriptName, scriptArgs, paths) {
  const result = spawnSync(process.execPath, [resolve(SCRIPTS_DIR, scriptName), ...scriptArgs], {
    stdio: "inherit",
    env: makeChildEnv(paths),
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with status ${result.status ?? "unknown"}`);
  }
}

function analysisIsFresh(paths) {
  if (!existsSync(paths.titlesPath) || !existsSync(paths.analysisPath)) return false;
  return statSync(paths.analysisPath).mtimeMs >= statSync(paths.titlesPath).mtimeMs;
}

function preparePipeline(paths, opts) {
  ensureRuntime(paths);

  runScript("sync-feeds.mjs", [], paths);

  if (!opts.skipExtras) {
    const extrasArgs = opts.extraSources ? ["--sources", opts.extraSources] : [];
    runScript("sync-extras.mjs", extrasArgs, paths);
  }

  let articleInput = paths.articlesPath;
  if (opts.profile) {
    runScript("apply-profile.mjs", ["--profile", opts.profile], paths);
    articleInput = paths.filteredArticlesPath;
  }

  if (!opts.skipContent) {
    const fetchArgs = [articleInput];
    if (opts.allContent) {
      fetchArgs.push("--all");
    } else {
      fetchArgs.push("--limit", String(opts.contentLimit));
    }
    runScript("fetch-content.mjs", fetchArgs, paths);
  }

  runScript("preprocess-articles.mjs", [articleInput, paths.slimArticlesPath], paths);

  console.log("");
  console.log(`✓ Prepare 阶段完成`);
  console.log(`  - 标题清单: ${paths.titlesPath}`);
  console.log(`  - 分析写入: ${paths.analysisPath}`);
}

function finalizePipeline(paths, opts) {
  ensureRuntime(paths);

  if (!existsSync(paths.analysisPath)) {
    throw new Error(`缺少 analysis.json: ${paths.analysisPath}`);
  }

  runScript("gen-briefing.mjs", [], paths);

  const format = normalizeFormat(opts.format);
  if (format === "md" || format === "both") {
    runScript("render-md.mjs", [paths.briefingPath], paths);
  }
  if (format === "html" || format === "both") {
    runScript("render-html.mjs", [paths.briefingPath], paths);
  }
  if (opts.sendEmail) {
    runScript("send-email.mjs", [], paths);
  }

  console.log("");
  console.log(`✓ Finalize 阶段完成`);
  if (format === "md" || format === "both") {
    console.log(`  - Markdown: ${paths.latestMdPath}`);
  }
  if (format === "html" || format === "both") {
    console.log(`  - HTML: ${paths.latestHtmlPath}`);
  }
}

function runCommand(paths, opts) {
  if (analysisIsFresh(paths)) {
    finalizePipeline(paths, opts);
    return;
  }

  preparePipeline(paths, opts);
  console.log("");
  console.log("下一步：让 Claude 读取 articles-titles.txt 生成 analysis.json，然后再次执行同一个 run 命令。");
}

function feedsCommand(paths, args) {
  ensureRuntime(paths);

  const [subcommand, ...rest] = args;
  switch (subcommand) {
    case "list":
      runScript("manage-opml.mjs", ["list"], paths);
      return;
    case "add":
      runScript("manage-opml.mjs", ["add", rest[0] || "", rest[1] || ""], paths);
      return;
    case "remove":
      runScript("manage-opml.mjs", ["remove", rest[0] || ""], paths);
      return;
    default:
      throw new Error("feeds 子命令仅支持 list / add / remove");
  }
}

function printPaths(paths) {
  console.log(JSON.stringify(paths, null, 2));
}

function main() {
  const { opts, positionals } = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    printVersionFooter();
    return;
  }

  const command = positionals[0] || "run";
  const paths = getRuntimePaths(opts.workspace);
  const showSessionShell = shouldPrintSessionShell(command);

  if (showSessionShell) {
    printGreeting();
  }

  try {
    switch (command) {
      case "run":
        runCommand(paths, opts);
        return;
      case "prepare":
        preparePipeline(paths, opts);
        return;
      case "finalize":
        finalizePipeline(paths, opts);
        return;
      case "html":
        runCommand(paths, { ...opts, format: "html" });
        return;
      case "both":
        runCommand(paths, { ...opts, format: "both" });
        return;
      case "feeds":
        feedsCommand(paths, positionals.slice(1));
        return;
      case "paths":
        ensureRuntime(paths);
        printPaths(paths);
        return;
      default:
        printHelp();
        process.exit(1);
    }
  } finally {
    if (showSessionShell) {
      printVersionFooter();
    }
  }
}

main();
