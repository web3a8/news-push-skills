import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ANALYSIS_META = Symbol("analysisMeta");

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function parsePosition(errorMessage) {
  const detailed = errorMessage.match(/position\s+(\d+)\s+\(line\s+(\d+)\s+column\s+(\d+)\)/i);
  if (detailed) {
    return {
      offset: Number(detailed[1]),
      line: Number(detailed[2]),
      column: Number(detailed[3]),
    };
  }

  const offsetOnly = errorMessage.match(/position\s+(\d+)/i);
  if (!offsetOnly) return null;
  return {
    offset: Number(offsetOnly[1]),
    line: null,
    column: null,
  };
}

function computeLineColumn(text, offset) {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, safeOffset);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function renderContext(text, lineNumber, columnNumber) {
  if (!lineNumber || !columnNumber) return "";
  const lines = text.split("\n");
  const start = Math.max(1, lineNumber - 1);
  const end = Math.min(lines.length, lineNumber + 1);
  const snippet = [];

  for (let line = start; line <= end; line++) {
    const label = String(line).padStart(4, " ");
    snippet.push(`${label} | ${lines[line - 1]}`);
    if (line === lineNumber) {
      snippet.push(`     | ${" ".repeat(Math.max(0, columnNumber - 1))}^`);
    }
  }

  return snippet.join("\n");
}

function parseErrorLocation(text, errorMessage) {
  const position = parsePosition(errorMessage || "");
  const fallback = position?.offset != null ? computeLineColumn(text, position.offset) : { line: null, column: null };
  return {
    offset: position?.offset ?? null,
    line: position?.line ?? fallback.line,
    column: position?.column ?? fallback.column,
  };
}

export function buildJsonParseError(pathname, text, error) {
  const { line, column } = parseErrorLocation(text, error?.message || "");
  const where = line && column ? `第 ${line} 行，第 ${column} 列` : pathname;
  const context = renderContext(text, line, column);
  const hint = "提示：不要手写拼接 JSON 字符串，优先生成 JS 对象后用 JSON.stringify 写入。";
  const details = [
    `analysis.json 解析失败：${where}`,
    error?.message || String(error),
    context,
    hint,
  ].filter(Boolean);
  return new Error(details.join("\n\n"));
}

function buildMeta(meta = {}) {
  return {
    repaired: false,
    droppedLines: 0,
    droppedItems: 0,
    warnings: [],
    ...meta,
  };
}

function attachMeta(analysis, meta) {
  Object.defineProperty(analysis, ANALYSIS_META, {
    value: buildMeta(meta),
    enumerable: false,
    configurable: true,
  });
  return analysis;
}

export function getAnalysisMeta(analysis) {
  return buildMeta(analysis?.[ANALYSIS_META]);
}

function nextSignificantChar(text, startIndex) {
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (!/\s/.test(ch)) {
      return ch;
    }
  }
  return "";
}

function escapeInnerQuotes(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  let changed = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inString) {
      if (ch === "\"") {
        inString = true;
      }
      out += ch;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === "\"") {
      const next = nextSignificantChar(text, i + 1);
      if (next && !",:]}".includes(next)) {
        out += "\\\"";
        changed = true;
        continue;
      }
      out += ch;
      inString = false;
      continue;
    }

    out += ch;
  }

  return { text: out, changed };
}

function cleanupDanglingCommas(text) {
  return text
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{\[])\s*,/g, "$1");
}

function dropLine(text, lineNumber) {
  const lines = text.split("\n");
  if (!lineNumber || lineNumber < 1 || lineNumber > lines.length) {
    return text;
  }
  lines.splice(lineNumber - 1, 1);
  return lines.join("\n");
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

function recoverJson(text) {
  let workingText = text;
  let repaired = false;
  let droppedLines = 0;
  const warnings = [];

  const escaped = escapeInnerQuotes(workingText);
  if (escaped.changed) {
    workingText = escaped.text;
    repaired = true;
    warnings.push("检测到未转义双引号，已自动转义。");
  }

  let parsed = tryParseJson(workingText);
  if (parsed.ok) {
    return { parsed: parsed.value, repairedText: workingText, repaired, droppedLines, warnings };
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const location = parseErrorLocation(workingText, parsed.error?.message || "");
    if (!location.line) break;

    const nextText = cleanupDanglingCommas(dropLine(workingText, location.line));
    if (nextText === workingText) break;

    workingText = nextText;
    repaired = true;
    droppedLines++;
    warnings.push(`第 ${location.line} 行附近存在不可修复片段，已自动丢弃该行内容。`);

    const retriedEscape = escapeInnerQuotes(workingText);
    if (retriedEscape.changed) {
      workingText = retriedEscape.text;
    }

    parsed = tryParseJson(workingText);
    if (parsed.ok) {
      return { parsed: parsed.value, repairedText: workingText, repaired, droppedLines, warnings };
    }
  }

  warnings.push("analysis.json 仍有残留异常，已降级为空分析结果。");
  return {
    parsed: {},
    repairedText: JSON.stringify({}, null, 2),
    repaired: true,
    droppedLines,
    warnings,
  };
}

function normalizeStringMap(value, fieldName, warnings) {
  if (value == null) return {};
  if (!isPlainObject(value)) {
    warnings.push(`${fieldName} 不是对象，已自动忽略。`);
    return {};
  }

  const entries = {};
  for (const [key, itemValue] of Object.entries(value)) {
    if (itemValue == null || itemValue === "") {
      warnings.push(`${fieldName}.${key} 为空，已自动忽略。`);
      continue;
    }
    entries[String(key)] = typeof itemValue === "string" ? itemValue : String(itemValue);
  }
  return entries;
}

function normalizeScore(value, fieldName, warnings) {
  if (value == null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    warnings.push(`${fieldName} 不是有效数字，已回退为 0。`);
    return 0;
  }
  return Math.max(0, Math.min(10, num));
}

function normalizeHighlightItems(value, fieldName, warnings) {
  if (value == null) return { items: [], droppedCount: 0 };
  if (!Array.isArray(value)) {
    warnings.push(`${fieldName} 不是数组，已自动忽略。`);
    return { items: [], droppedCount: 0 };
  }

  const items = [];
  let droppedCount = 0;

  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    if (!isPlainObject(item)) {
      droppedCount++;
      warnings.push(`${fieldName}[${index}] 不是对象，已自动丢弃。`);
      continue;
    }

    const title = item.title == null ? "" : String(item.title);
    const summary = item.summary == null ? "" : String(item.summary);
    if (!title.trim()) {
      droppedCount++;
      warnings.push(`${fieldName}[${index}].title 为空，已自动丢弃。`);
      continue;
    }
    if (!summary.trim()) {
      droppedCount++;
      warnings.push(`${fieldName}[${index}].summary 为空，已自动丢弃。`);
      continue;
    }

    items.push({
      title,
      summary,
      domain: item.domain == null || item.domain === "" ? "general" : String(item.domain),
      score: normalizeScore(item.score, `${fieldName}[${index}].score`, warnings),
    });
  }

  return {
    items: items.slice(0, 6),
    droppedCount,
  };
}

function normalizeAnalysisResult(input) {
  const warnings = [];
  const source = isPlainObject(input) ? input : {};
  if (!isPlainObject(input)) {
    warnings.push(`analysis 顶层不是对象，已降级为空结果。`);
  }

  const facts = normalizeHighlightItems(source.highlight_facts, "highlight_facts", warnings);
  const opinions = normalizeHighlightItems(source.highlight_opinions, "highlight_opinions", warnings);

  return {
    analysis: {
      global_brief: source.global_brief == null ? "" : String(source.global_brief),
      domain_briefs: normalizeStringMap(source.domain_briefs, "domain_briefs", warnings),
      highlight_facts: facts.items,
      highlight_opinions: opinions.items,
      title_translations: normalizeStringMap(source.title_translations, "title_translations", warnings),
    },
    warnings,
    droppedItems: facts.droppedCount + opinions.droppedCount,
  };
}

export function normalizeAnalysisObject(input) {
  return normalizeAnalysisResult(input).analysis;
}

export function parseAnalysisText(text, pathname = "analysis.json") {
  const recovered = recoverJson(text);
  const normalized = normalizeAnalysisResult(recovered.parsed);
  return attachMeta(normalized.analysis, {
    repaired: recovered.repaired || normalized.warnings.length > 0,
    droppedLines: recovered.droppedLines,
    droppedItems: normalized.droppedItems,
    warnings: [...recovered.warnings, ...normalized.warnings],
  });
}

export function loadAndValidateAnalysis(pathname, options = {}) {
  const text = readFileSync(pathname, "utf-8");
  const analysis = parseAnalysisText(text, pathname);
  const meta = getAnalysisMeta(analysis);

  if (options.persistRepair && (meta.repaired || meta.droppedLines > 0 || meta.droppedItems > 0)) {
    writeAnalysisJson(pathname, analysis);
  }

  return analysis;
}

export async function loadAnalysisModule(modulePath) {
  const fullPath = resolve(modulePath);
  const moduleUrl = `${pathToFileURL(fullPath).href}?ts=${Date.now()}`;
  const loaded = await import(moduleUrl);
  const analysis = loaded.default ?? loaded.analysis ?? loaded;
  return normalizeAnalysisObject(analysis);
}

export function writeAnalysisJson(pathname, analysis) {
  const normalized = normalizeAnalysisObject(analysis);
  mkdirSync(dirname(pathname), { recursive: true });
  const tempPath = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, JSON.stringify(normalized, null, 2), "utf-8");
  renameSync(tempPath, pathname);
  return normalized;
}
