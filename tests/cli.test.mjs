import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const CLI_BIN = resolve(PROJECT_ROOT, "bin", "news-push");
const NODE = process.execPath;

function runCli(args, options = {}) {
  return execFileSync(NODE, [CLI_BIN, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    env: {
      ...process.env,
      NEWS_PUSH_DISABLE_BROWSER: "1",
      ...(options.env || {}),
    },
    ...options,
  });
}

function createWorkspace() {
  return mkdtempSync(join(tmpdir(), "news-push-test-"));
}

function runtimeRoot(workspace) {
  return join(workspace, ".news-push");
}

function writeRuntimeFeed(workspace, feedUrl) {
  const root = runtimeRoot(workspace);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "feeds.opml"), `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Test Feeds</title></head>
  <body>
    <outline text="Fixture Feed" xmlUrl="${feedUrl}"/>
  </body>
</opml>
`, "utf-8");
}

function createFeedUrl() {
  const now = new Date().toUTCString();
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Feed</title>
    <item>
      <title>Local Test Headline</title>
      <link>https://example.com/article</link>
      <description>Local description for prepare stage.</description>
      <pubDate>${now}</pubDate>
    </item>
  </channel>
</rss>`;
  return `data:text/xml;charset=utf-8,${encodeURIComponent(rssXml)}`;
}

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, "utf-8"));
}
test("default invocation prepares waiting state, then flips to final report", () => {
  const workspace = createWorkspace();
  let paths;

  try {
    writeRuntimeFeed(workspace, createFeedUrl());
    const testEnv = { NEWS_PUSH_DISABLE_WORKSPACE_SERVER: "1" };

    const firstRun = runCli(["--workspace", workspace, "--format", "both", "--skip-extras", "--skip-content"], { env: testEnv });
    assert.match(firstRun, /欢迎使用 News Push/);
    assert.match(firstRun, /首次执行本脚本，可能需要您手动确认几次授权。/);
    assert.match(firstRun, /Prepare 阶段完成/);
    assert.match(firstRun, /工作台: http:\/\/127\.0\.0\.1:/);
    assert.match(firstRun, /版本: v2026\.04\.08/);

    paths = JSON.parse(runCli(["paths", "--workspace", workspace]));
    assert.equal(existsSync(paths.titlesPath), true);
    assert.equal(existsSync(paths.uiStatePath), true);
    assert.equal(existsSync(paths.serverStatePath), false);

    const waitingState = readJson(paths.uiStatePath);
    assert.equal(waitingState.phase, "waiting_for_ai");
    assert.equal(waitingState.articleCount, 1);

    writeFileSync(paths.analysisPath, JSON.stringify({
      global_brief: "本地测试摘要",
      domain_briefs: { tech: "本地测试领域摘要" },
      highlight_facts: [
        { title: "本地测试事实", summary: "本地测试事实摘要", domain: "tech", score: 8.5 },
      ],
      highlight_opinions: [
        { title: "本地测试观点", summary: "本地测试观点摘要", domain: "tech", score: 7.2 },
      ],
      title_translations: {
        "Local Test Headline": "本地测试标题",
      },
    }, null, 2), "utf-8");

    const secondRun = runCli(["--workspace", workspace, "--format", "both", "--skip-extras", "--skip-content"], { env: testEnv });
    assert.match(secondRun, /Finalize 阶段完成/);
    assert.match(secondRun, /版本: v2026\.04\.08/);

    const completedState = readJson(paths.uiStatePath);
    assert.equal(completedState.phase, "completed");
    assert.equal(existsSync(paths.latestMdPath), true);
    assert.equal(existsSync(paths.latestHtmlPath), true);
    const completedHtml = readFileSync(paths.latestHtmlPath, "utf-8");
    assert.match(completedHtml, /本地测试标题/);

    const thirdRun = runCli(["--workspace", workspace, "--format", "both", "--skip-extras", "--skip-content"], { env: testEnv });
    assert.match(thirdRun, /Prepare 阶段完成/);
    assert.doesNotMatch(thirdRun, /Finalize 阶段完成/);
    assert.equal(existsSync(paths.analysisPath), false);

    const restartedState = readJson(paths.uiStatePath);
    assert.equal(restartedState.phase, "waiting_for_ai");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("feeds subcommands operate on workspace-scoped feeds.opml", () => {
  const workspace = createWorkspace();

  try {
    runCli(["paths", "--workspace", workspace]);

    const initial = runCli(["feeds", "list", "--workspace", workspace]);
    assert.match(initial, /共 160 个订阅源/);

    runCli(["feeds", "add", "Example Feed", "https://example.com/feed.xml", "--workspace", workspace]);
    const afterAdd = runCli(["feeds", "list", "--workspace", workspace]);
    assert.match(afterAdd, /Example Feed/);

    runCli(["feeds", "remove", "Example Feed", "--workspace", workspace]);
    const afterRemove = runCli(["feeds", "list", "--workspace", workspace]);
    assert.doesNotMatch(afterRemove, /Example Feed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("paths command remains machine-readable json without banner noise", () => {
  const workspace = createWorkspace();

  try {
    const raw = runCli(["paths", "--workspace", workspace]);
    assert.doesNotMatch(raw, /欢迎使用 News Push/);
    assert.doesNotMatch(raw, /版本:/);

    const parsed = JSON.parse(raw);
    assert.equal(parsed.runtimeRoot, join(workspace, ".news-push"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
