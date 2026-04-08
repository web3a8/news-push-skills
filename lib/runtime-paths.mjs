import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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
    archiveDir: resolve(outputDir, "archive"),
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

export function ensureRuntimeWorkspace() {
  const paths = getRuntimePaths();

  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.archiveDir, { recursive: true });

  if (paths.runtimeRoot !== PACKAGE_ROOT && !existsSync(paths.feedsPath)) {
    copyFileSync(resolve(PACKAGE_ROOT, "feeds.opml"), paths.feedsPath);
  }

  return paths;
}
