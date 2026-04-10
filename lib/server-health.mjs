import { NEWS_PUSH_VERSION } from "./version.mjs";

export function normalizeBaseUrl(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

export function serverSupportsRequestedPage(health, page) {
  if (!page || page === "/") return true;
  if (page.startsWith("/jobs/")) {
    return health?.supportsJobRoutes === true;
  }
  return true;
}

export function isServerHealthCompatible(paths, health, page = "/") {
  if (!health || health.ok !== true) return false;
  if (health.runtimeRoot !== paths.runtimeRoot) return false;
  if (health.serverVersion !== NEWS_PUSH_VERSION) return false;
  if (!serverSupportsRequestedPage(health, page)) return false;
  return true;
}
