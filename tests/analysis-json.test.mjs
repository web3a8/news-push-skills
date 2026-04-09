import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const NODE = process.execPath;
const WRITE_ANALYSIS = resolve(PROJECT_ROOT, "scripts", "write-analysis.mjs");
const VALIDATE_ANALYSIS = resolve(PROJECT_ROOT, "scripts", "validate-analysis.mjs");

function createWorkspace() {
  return mkdtempSync(join(tmpdir(), "news-push-analysis-"));
}

function runtimeRoot(workspace) {
  return join(workspace, ".news-push");
}

function analysisPath(workspace) {
  return join(runtimeRoot(workspace), "data", "analysis.json");
}

function runNode(scriptPath, args, options = {}) {
  return execFileSync(NODE, [scriptPath, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    ...options,
  });
}

test("write-analysis serializes a JS object module and preserves embedded quotes", async () => {
  const workspace = createWorkspace();

  try {
    mkdirSync(join(runtimeRoot(workspace), "data"), { recursive: true });
    const sourcePath = join(runtimeRoot(workspace), "data", "analysis-source.mjs");
    writeFileSync(sourcePath, `export default {
  global_brief: "测试摘要",
  domain_briefs: {
    finance: "国际能源运输继续承压"
  },
  highlight_facts: [
    {
      title: "霍尔木兹海峡局势反复",
      summary: \`伊朗据称将收取加密货币"过路费"且限量放行。\`,
      domain: "finance",
      score: 8.8
    }
  ],
  highlight_opinions: [],
  title_translations: {}
};
`, "utf-8");

    const output = runNode(WRITE_ANALYSIS, ["--workspace", workspace, "--from-module", sourcePath]);
    assert.match(output, /analysis\.json 已安全写入/);

    const written = JSON.parse(readFileSync(analysisPath(workspace), "utf-8"));
    assert.equal(written.highlight_facts[0].summary, '伊朗据称将收取加密货币"过路费"且限量放行。');

    const validation = runNode(VALIDATE_ANALYSIS, ["--workspace", workspace]);
    assert.match(validation, /analysis\.json 校验通过/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("validate-analysis auto-repairs unescaped quotes and rewrites a valid file", () => {
  const workspace = createWorkspace();

  try {
    mkdirSync(join(runtimeRoot(workspace), "data"), { recursive: true });
    writeFileSync(analysisPath(workspace), `{
  "global_brief": "测试摘要",
  "domain_briefs": {
    "finance": "国际能源运输继续承压"
  },
  "highlight_facts": [
    {
      "title": "霍尔木兹海峡局势反复",
      "summary": "伊朗据称将收取加密货币"过路费"且限量放行。",
      "domain": "finance",
      "score": 8.8
    }
  ],
  "highlight_opinions": [],
  "title_translations": {}
}
`, "utf-8");

    const output = runNode(VALIDATE_ANALYSIS, ["--workspace", workspace]);
    assert.match(output, /analysis\.json 已自动修复/);
    assert.match(output, /检测到未转义双引号，已自动转义/);

    const repaired = JSON.parse(readFileSync(analysisPath(workspace), "utf-8"));
    assert.equal(repaired.highlight_facts[0].summary, '伊朗据称将收取加密货币"过路费"且限量放行。');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("validate-analysis drops malformed highlight items instead of failing the whole file", () => {
  const workspace = createWorkspace();

  try {
    mkdirSync(join(runtimeRoot(workspace), "data"), { recursive: true });
    writeFileSync(analysisPath(workspace), JSON.stringify({
      global_brief: "测试摘要",
      domain_briefs: {
        finance: "国际能源运输继续承压",
      },
      highlight_facts: [
        {
          title: "保留的事实",
          summary: "这条信息结构完整，应该保留下来。",
          domain: "finance",
          score: 8.8,
        },
        {
          title: "需要被丢弃的事实",
          summary: "",
          domain: "finance",
          score: 5.4,
        },
      ],
      highlight_opinions: [],
      title_translations: {},
    }, null, 2), "utf-8");

    const output = runNode(VALIDATE_ANALYSIS, ["--workspace", workspace]);
    assert.match(output, /analysis\.json 已自动修复/);
    assert.match(output, /自动丢弃坏条目: 1/);

    const repaired = JSON.parse(readFileSync(analysisPath(workspace), "utf-8"));
    assert.equal(repaired.highlight_facts.length, 1);
    assert.equal(repaired.highlight_facts[0].title, "保留的事实");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
