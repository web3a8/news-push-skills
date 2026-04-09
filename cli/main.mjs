#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { PACKAGE_ROOT } from "../lib/runtime-paths.mjs";
import { NEWS_PUSH_VERSION } from "../lib/version.mjs";
import { readUiState, writeUiState } from "../lib/ui-state.mjs";

const SCRIPTS_DIR = resolve(PACKAGE_ROOT, "scripts");
const DEFAULT_SERVER_PORT = 7789;

function printHelp() {
  console.log(`News Push CLI ${NEWS_PUSH_VERSION}

Usage:
  news-push [--workspace PATH] [--format md|html|both] [--profile NAME]
  news-push html [--workspace PATH] [--profile NAME]
  news-push both [--workspace PATH] [--profile NAME]
  news-push prepare [--workspace PATH] [--profile NAME] [--skip-extras] [--skip-content]
  news-push finalize [--workspace PATH] [--format md|html|both]
  news-push serve [--workspace PATH] [--page /|/config] [--no-open]
  news-push feeds list [--workspace PATH]
  news-push feeds add "Feed Name" "https://example.com/feed.xml" [--workspace PATH]
  news-push feeds remove "Feed Name" [--workspace PATH]
  news-push paths [--workspace PATH]

Notes:
  - Runtime data is stored in <workspace>/.news-push by default.
  - Running 'news-push' prepares raw articles, opens the local browser workspace, then waits for AI analysis.
  - After analysis.json is safely written, run the same command again to render the final report and refresh the browser workspace.
  - Completed runs do not reuse previous analysis.json; each new run starts with a fresh prepare phase.
`);
}

function shouldPrintSessionShell(command) {
  return command !== "paths";
}

function printGreeting() {
  console.log("欢迎使用 News Push");
}

function shouldPrintWorkflowHint(command) {
  return ["run", "prepare", "finalize", "html", "both", "serve"].includes(command);
}

function printWorkflowHint() {
  console.log("首次执行本脚本，可能需要您手动确认几次授权。本脚本优先展示抓取到的内容，AI分析随后就来，请耐心等一会儿～");
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
    noOpen: false,
    page: "/",
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
      case "--no-open":
        opts.noOpen = true;
        break;
      case "--page":
        opts.page = argv[++i] || opts.page;
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
    uiStatePath: resolve(runtimeRoot, "ui-state.json"),
    serverStatePath: resolve(runtimeRoot, "server-state.json"),
    feedsPath: resolve(runtimeRoot, "feeds.opml"),
    filteredArticlesPath: resolve(dataDir, "articles-filtered.json"),
    articlesPath: resolve(dataDir, "articles.json"),
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

function shouldFinalizeCurrentRun(paths) {
  const state = readUiState(paths);
  if (!analysisIsFresh(paths)) return false;
  return state.phase === "waiting_for_ai" || state.phase === "finalizing";
}

function clearFileIfExists(pathname) {
  if (!existsSync(pathname)) return;
  rmSync(pathname, { force: true });
}

function clearServerStateFile(paths) {
  clearFileIfExists(paths.serverStatePath);
}

function invalidatePreviousAnalysis(paths) {
  clearFileIfExists(paths.analysisPath);
  clearFileIfExists(paths.briefingPath);
}

function createJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJson(pathname, fallback = null) {
  if (!existsSync(pathname)) return fallback;
  try {
    return JSON.parse(readFileSync(pathname, "utf-8"));
  } catch {
    return fallback;
  }
}

function summarizePreparedArticles(paths) {
  const sourcePath = existsSync(paths.slimArticlesPath) ? paths.slimArticlesPath : paths.articlesPath;
  const articles = readJson(sourcePath, []);
  if (!Array.isArray(articles)) {
    return { articleCount: 0, sourceCount: 0 };
  }

  const sources = new Set();
  for (const article of articles) {
    const sourceName = article.feed_title || article.source || article.feed || article.site_name || "未知信源";
    sources.add(sourceName);
  }

  return {
    articleCount: articles.length,
    sourceCount: sources.size,
  };
}

function openBrowser(url) {
  if (process.env.NEWS_PUSH_DISABLE_BROWSER === "1") return;

  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid, timeoutMs = 1500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await sleep(80);
  }
  return !isProcessAlive(pid);
}

async function stopStaleServer(paths, state) {
  if (!state?.pid) {
    clearServerStateFile(paths);
    return false;
  }
  if (state.runtimeRoot && state.runtimeRoot !== paths.runtimeRoot) {
    return false;
  }
  if (!isProcessAlive(state.pid)) {
    clearServerStateFile(paths);
    return false;
  }

  try {
    process.kill(state.pid, "SIGTERM");
    const exited = await waitForProcessExit(state.pid, 1800);
    if (!exited && isProcessAlive(state.pid)) {
      process.kill(state.pid, "SIGKILL");
      await waitForProcessExit(state.pid, 800);
    }
  } catch {
    // Best-effort stale process cleanup.
  }

  clearServerStateFile(paths);
  return true;
}

function readServerState(paths) {
  const state = readJson(paths.serverStatePath, null);
  if (!state || typeof state !== "object" || !state.url) return null;
  return state;
}

async function canReachServer(state, timeoutMs = 1200) {
  if (!state?.url) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const probeUrl = new URL("api/state", state.url).toString();
    const response = await fetch(probeUrl, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

async function loadLiveServerState(paths) {
  const state = readServerState(paths);
  if (!state) return null;
  if (state.runtimeRoot && state.runtimeRoot !== paths.runtimeRoot) {
    return null;
  }

  if (await canReachServer(state)) {
    return state;
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(paths, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await loadLiveServerState(paths);
    if (state?.url) {
      return state;
    }
    await sleep(100);
  }
  throw new Error("本地工作台启动超时");
}

async function ensureServer(paths, options = {}) {
  ensureRuntime(paths);

  const page = options.page || "/";
  if (process.env.NEWS_PUSH_DISABLE_WORKSPACE_SERVER === "1") {
    return `http://127.0.0.1:${DEFAULT_SERVER_PORT}${page === "/" ? "/" : page}`;
  }
  if (process.env.NEWS_PUSH_ASSUME_SERVER_RUNNING === "1") {
    const forcedState = readServerState(paths);
    if (!forcedState?.url) {
      throw new Error("NEWS_PUSH_ASSUME_SERVER_RUNNING=1 但未找到可用的 server-state.json");
    }
    const forcedBaseUrl = forcedState.url.endsWith("/") ? forcedState.url : `${forcedState.url}/`;
    const forcedUrl = new URL(page.replace(/^\/*/, ""), forcedBaseUrl).toString();
    if (options.open) {
      openBrowser(forcedUrl);
    }
    return forcedUrl;
  }

  let state = await loadLiveServerState(paths);
  if (!state) {
    await stopStaleServer(paths, readServerState(paths));
    const child = spawn(
      process.execPath,
      [resolve(SCRIPTS_DIR, "server.mjs"), "--port", String(DEFAULT_SERVER_PORT), "--no-open"],
      {
        env: makeChildEnv(paths),
        stdio: "ignore",
        detached: true,
      },
    );
    child.unref();
    state = await waitForServer(paths);
  }

  const baseUrl = state.url.endsWith("/") ? state.url : `${state.url}/`;
  const url = new URL(page.replace(/^\/*/, ""), baseUrl).toString();
  if (options.open) {
    openBrowser(url);
  }
  return url;
}

function updateWaitingState(paths, opts, jobId) {
  const summary = summarizePreparedArticles(paths);
  return writeUiState(paths, {
    phase: "waiting_for_ai",
    statusText: "AI 正在进行总结和提炼，请稍候。",
    articleCount: summary.articleCount,
    sourceCount: summary.sourceCount,
    format: normalizeFormat(opts.format),
    profile: opts.profile || "",
    jobId,
    lastError: "",
  });
}

async function preparePipeline(paths, opts, jobId = createJobId()) {
  ensureRuntime(paths);
  invalidatePreviousAnalysis(paths);

  writeUiState(paths, {
    phase: "preparing",
    statusText: "正在抓取订阅并整理原始信息流…",
    format: normalizeFormat(opts.format),
    profile: opts.profile || "",
    jobId,
    lastError: "",
  });

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

  const state = updateWaitingState(paths, opts, jobId);

  console.log("");
  console.log("✓ Prepare 阶段完成");
  console.log(`  - 标题清单: ${paths.titlesPath}`);
  console.log(`  - 分析写入: ${paths.analysisPath}`);
  console.log(`  - 原始文章: ${state.articleCount} 篇`);
  console.log(`  - 覆盖信源: ${state.sourceCount} 个`);

  return state;
}

async function finalizePipeline(paths, opts) {
  ensureRuntime(paths);

  const currentState = readUiState(paths);
  const format = normalizeFormat(opts.format);
  const shouldRenderMd = format === "md" || format === "both";
  const shouldRenderHtml = format === "html" || format === "both" || opts.dashboard !== false;

  writeUiState(paths, {
    phase: "finalizing",
    statusText: "AI 已完成，正在生成最终页面…",
    format,
    profile: opts.profile || currentState.profile || "",
    jobId: currentState.jobId || createJobId(),
    lastError: "",
  });

  if (!existsSync(paths.analysisPath)) {
    throw new Error(`缺少 analysis.json: ${paths.analysisPath}`);
  }

  runScript("gen-briefing.mjs", [], paths);

  if (shouldRenderMd) {
    runScript("render-md.mjs", [paths.briefingPath], paths);
  }
  if (shouldRenderHtml) {
    runScript("render-html.mjs", [paths.briefingPath], paths);
  }
  if (opts.sendEmail) {
    runScript("send-email.mjs", [], paths);
  }

  const summary = summarizePreparedArticles(paths);
  writeUiState(paths, {
    phase: "completed",
    statusText: "AI 总结已完成。",
    articleCount: summary.articleCount,
    sourceCount: summary.sourceCount,
    format,
    profile: opts.profile || currentState.profile || "",
    jobId: currentState.jobId || createJobId(),
    lastError: "",
  });

  console.log("");
  console.log("✓ Finalize 阶段完成");
  if (shouldRenderMd) {
    console.log(`  - Markdown: ${paths.latestMdPath}`);
  }
  if (shouldRenderHtml && format === "md") {
    console.log(`  - HTML 工作台: ${paths.latestHtmlPath}`);
  } else if (shouldRenderHtml) {
    console.log(`  - HTML: ${paths.latestHtmlPath}`);
  }
}

async function runCommand(paths, opts) {
  if (shouldFinalizeCurrentRun(paths)) {
    await ensureServer(paths, { open: false, page: "/" });
    await finalizePipeline(paths, { ...opts, dashboard: true });
    return;
  }

  const state = await preparePipeline(paths, opts, createJobId());
  const workspaceUrl = await ensureServer(paths, { open: !opts.noOpen, page: "/" });

  console.log("");
  console.log(`工作台: ${workspaceUrl}`);
  console.log(`提示: 已展示 ${state.articleCount} 篇原始内容，AI 总结完成后页面会自动刷新。`);
  console.log("");
  console.log("下一步：让 Claude 读取 articles-titles.txt，优先通过 scripts/write-analysis.mjs 安全写入 analysis.json，然后再次执行同一个 run 命令。");
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

async function serveCommand(paths, opts) {
  const url = await ensureServer(paths, { open: !opts.noOpen, page: opts.page || "/" });
  console.log(`本地工作台: ${url}`);
}

async function main() {
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
    if (shouldPrintWorkflowHint(command)) {
      printWorkflowHint();
    }
  }

  try {
    switch (command) {
      case "run":
        await runCommand(paths, opts);
        return;
      case "prepare":
        await preparePipeline(paths, opts);
        return;
      case "finalize":
        await finalizePipeline(paths, { ...opts, dashboard: true });
        return;
      case "serve":
        await serveCommand(paths, opts);
        return;
      case "html":
        await runCommand(paths, { ...opts, format: "html" });
        return;
      case "both":
        await runCommand(paths, { ...opts, format: "both" });
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
        process.exitCode = 1;
    }
  } catch (error) {
    if (command === "run" || command === "prepare" || command === "finalize" || command === "html" || command === "both") {
      try {
        writeUiState(paths, {
          phase: "failed",
          statusText: "本次运行失败，请返回终端查看错误信息。",
          lastError: error?.message || String(error),
        });
      } catch {
        // Ignore state write failures during error reporting.
      }
    }
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  } finally {
    if (showSessionShell) {
      printVersionFooter();
    }
  }
}

await main();
