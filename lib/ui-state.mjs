import { existsSync, readFileSync, writeFileSync } from "node:fs";

function timestamp() {
  return new Date().toISOString();
}

function baseState(paths) {
  return {
    phase: "idle",
    statusText: "",
    articleCount: 0,
    sourceCount: 0,
    format: "md",
    profile: "",
    jobId: "",
    lastError: "",
    hasLatestHtml: existsSync(paths.latestHtmlPath),
    updatedAt: timestamp(),
  };
}

export function readUiState(paths) {
  if (!existsSync(paths.uiStatePath)) {
    return baseState(paths);
  }

  try {
    const parsed = JSON.parse(readFileSync(paths.uiStatePath, "utf-8"));
    return {
      ...baseState(paths),
      ...parsed,
      hasLatestHtml: existsSync(paths.latestHtmlPath),
    };
  } catch {
    return baseState(paths);
  }
}

export function writeUiState(paths, patch = {}) {
  const next = {
    ...readUiState(paths),
    ...patch,
    hasLatestHtml: existsSync(paths.latestHtmlPath),
    updatedAt: timestamp(),
  };
  writeFileSync(paths.uiStatePath, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
