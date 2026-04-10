import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(__dirname, "..");

function envPath(name) {
  const value = process.env[name];
  return value ? resolve(value) : "";
}

export function getRuntimePaths() {
  const runtimeRoot = envPath("NEWS_PUSH_RUNTIME_ROOT") || PACKAGE_ROOT;
  const dataDir = resolve(runtimeRoot, "data");
  const outputDir = resolve(runtimeRoot, "output");

  return {
    packageRoot: PACKAGE_ROOT,
    runtimeRoot,
    dataDir,
    outputDir,
    jobsDir: resolve(runtimeRoot, "jobs"),
    currentJobPath: resolve(runtimeRoot, "current-job.json"),
    archiveDir: resolve(outputDir, "archive"),
    uiStatePath: resolve(runtimeRoot, "ui-state.json"),
    serverStatePath: resolve(runtimeRoot, "server-state.json"),
    feedsPath: envPath("NEWS_PUSH_FEEDS_PATH") || resolve(runtimeRoot, "feeds.opml"),
    focusPath: envPath("NEWS_PUSH_FOCUS_PATH") || resolve(dataDir, "focus.yaml"),
    envPath: envPath("NEWS_PUSH_ENV_PATH") || resolve(runtimeRoot, ".env"),
    profilesDir: resolve(PACKAGE_ROOT, "profiles"),
    articlesPath: resolve(dataDir, "articles.json"),
    filteredArticlesPath: resolve(dataDir, "articles-filtered.json"),
    slimArticlesPath: resolve(dataDir, "articles-slim.json"),
    titlesPath: resolve(dataDir, "articles-titles.txt"),
    analysisPath: resolve(dataDir, "analysis.json"),
    briefingPath: resolve(dataDir, "briefing.json"),
    latestMdPath: resolve(outputDir, "latest.md"),
    latestHtmlPath: resolve(outputDir, "latest.html"),
  };
}

export function resolveJobPaths(paths, jobId) {
  const resolvedJobId = String(jobId || "").trim();
  if (!resolvedJobId) {
    return {
      ...paths,
      jobId: "",
      jobRoot: paths.runtimeRoot,
      jobDataDir: paths.dataDir,
      jobOutputDir: paths.outputDir,
      jobArchiveDir: paths.archiveDir,
      jobUiStatePath: paths.uiStatePath,
      jobArticlesPath: paths.articlesPath,
      jobFilteredArticlesPath: paths.filteredArticlesPath,
      jobSlimArticlesPath: paths.slimArticlesPath,
      jobTitlesPath: paths.titlesPath,
      jobAnalysisPath: paths.analysisPath,
      jobBriefingPath: paths.briefingPath,
      jobLatestMdPath: paths.latestMdPath,
      jobLatestHtmlPath: paths.latestHtmlPath,
    };
  }

  const jobRoot = resolve(paths.jobsDir, resolvedJobId);
  const jobDataDir = resolve(jobRoot, "data");
  const jobOutputDir = resolve(jobRoot, "output");

  return {
    ...paths,
    jobId: resolvedJobId,
    jobRoot,
    jobDataDir,
    jobOutputDir,
    jobArchiveDir: resolve(jobOutputDir, "archive"),
    jobUiStatePath: resolve(jobRoot, "ui-state.json"),
    jobArticlesPath: resolve(jobDataDir, "articles.json"),
    jobFilteredArticlesPath: resolve(jobDataDir, "articles-filtered.json"),
    jobSlimArticlesPath: resolve(jobDataDir, "articles-slim.json"),
    jobTitlesPath: resolve(jobDataDir, "articles-titles.txt"),
    jobAnalysisPath: resolve(jobDataDir, "analysis.json"),
    jobBriefingPath: resolve(jobDataDir, "briefing.json"),
    jobLatestMdPath: resolve(jobOutputDir, "latest.md"),
    jobLatestHtmlPath: resolve(jobOutputDir, "latest.html"),
  };
}

export function readCurrentJob(paths) {
  if (!existsSync(paths.currentJobPath)) return "";
  try {
    const parsed = JSON.parse(readFileSync(paths.currentJobPath, "utf-8"));
    return typeof parsed?.jobId === "string" ? parsed.jobId.trim() : "";
  } catch {
    return "";
  }
}

export function writeCurrentJob(paths, jobId) {
  const next = {
    jobId: String(jobId || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(paths.currentJobPath, JSON.stringify(next, null, 2), "utf-8");
  return next.jobId;
}

export function ensureRuntimeWorkspace() {
  const paths = getRuntimePaths();

  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.archiveDir, { recursive: true });
  mkdirSync(paths.jobsDir, { recursive: true });

  if (paths.runtimeRoot !== PACKAGE_ROOT && !existsSync(paths.feedsPath)) {
    copyFileSync(resolve(PACKAGE_ROOT, "feeds.opml"), paths.feedsPath);
  }

  return paths;
}
