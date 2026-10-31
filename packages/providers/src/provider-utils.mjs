import { readFile } from "node:fs/promises";

export async function readJsonFile(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function decodeJwtPayload(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function isoFromEpoch(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function addSecondsIso(seconds, now = new Date()) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return null;
  return new Date(now.getTime() + numeric * 1000).toISOString();
}

export function finiteNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function stringValue(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

const EXTENDED_THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"];

export function resolveContextWindowFromModel(model, fallback = 131072) {
  if (!model) return fallback;
  const values = [
    model.context_length,
    model.contextWindow,
    model.context_window,
    model.maxInputTokens,
    model.max_input_tokens,
    model.context?.contextWindow,
    model.metadata?.contextWindow,
  ];
  for (const v of values) {
    if (Number.isInteger(v) && v > 0) return v;
    const num = Number(v);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return fallback;
}

export function resolveMaxTokensFromModel(model, fallback = 16384) {
  if (!model) return fallback;
  const values = [
    model.top_provider?.max_completion_tokens,
    model.per_request_limits?.max_completion_tokens,
    model.max_completion_tokens,
    model.maxOutputTokens,
    model.max_output_tokens,
    model.maxTokens,
    model.max_tokens,
  ];
  for (const v of values) {
    if (Number.isInteger(v) && v > 0) return v;
    const num = Number(v);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return fallback;
}

export function resolveReasoningFromModel(model) {
  if (!model) return undefined;
  if (model.reasoning === false) return undefined;

  if (Array.isArray(model.reasoning?.efforts) && model.reasoning.efforts.length > 0) {
    return model.reasoning;
  }

  if (Array.isArray(model.supported_reasoning_levels) && model.supported_reasoning_levels.length > 0) {
    const efforts = model.supported_reasoning_levels.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl?.id;
      if (!id) return null;
      const name = (typeof lvl === "object" && lvl.name)
        ? lvl.name
        : id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id,
        name,
        ...(lvl?.description ? { description: lvl.description } : {}),
      };
    }).filter(Boolean);
    if (efforts.length > 0) {
      const defaultEffort = model.default_reasoning_level
        ?? (efforts.some((e) => e.id === "medium") ? "medium" : efforts[0]?.id);
      return { efforts, defaultEffort };
    }
  }

  if (Array.isArray(model.reasoning_efforts) && model.reasoning_efforts.length > 0) {
    const efforts = model.reasoning_efforts.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl?.id ?? lvl?.value;
      if (!id) return null;
      const name = (typeof lvl === "object" && (lvl.label ?? lvl.name))
        ? (lvl.label ?? lvl.name)
        : id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id,
        name,
        ...(lvl?.description ? { description: lvl.description } : {}),
      };
    }).filter(Boolean);
    if (efforts.length > 0) {
      const defaultEffort = model.default_parameters?.reasoning_effort
        ?? (efforts.some((e) => e.id === "medium") ? "medium" : efforts[0]?.id);
      return { efforts, defaultEffort };
    }
  }

  if (Array.isArray(model.supported_parameters) && model.supported_parameters.includes("reasoning_effort")) {
    const id = String(model.id ?? "").toLowerCase();
    const supportsMax = id.includes("ultra") || id.includes("o1") || id.includes("o3") || id.includes("deepseek-r1");
    const efforts = [
      { id: "low", name: "Low", description: "快速思考，保留基础推理" },
      { id: "medium", name: "Medium", description: "标准思考，平衡推理深度与响应速度" },
      { id: "high", name: "High", description: "深度思考，适合复杂逻辑与多步骤分析" },
      ...(supportsMax ? [{ id: "max", name: "Max", description: "极致思考，最高推演深度" }] : []),
    ];
    const defaultEffort = typeof model.default_parameters?.reasoning_effort === "string"
      ? model.default_parameters.reasoning_effort
      : "medium";
    return { efforts, defaultEffort };
  }

  if (model.thinkingLevelMap && typeof model.thinkingLevelMap === "object") {
    const supported = EXTENDED_THINKING_LEVELS.filter((level) => {
      const mapped = model.thinkingLevelMap[level];
      if (mapped === null) return false;
      if (level === "xhigh" || level === "max") return mapped !== undefined && mapped !== null;
      return true;
    });

    if (supported.length === 0) return undefined;

    const efforts = supported.map((id) => ({
      id,
      name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }));

    const defaultEffort = supported.includes("medium")
      ? "medium"
      : supported.includes("high")
        ? "high"
        : supported[0];

    return { efforts, defaultEffort };
  }

  if (model.reasoning === true) {
    const supported = ["minimal", "low", "medium", "high"];
    return {
      efforts: supported.map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) })),
      defaultEffort: "medium",
    };
  }

  return undefined;
}

export async function fetchJson(url, init = {}, { timeoutMs = 20_000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) controller.abort(externalSignal.reason);
  else externalSignal?.addEventListener?.("abort", abortFromCaller, { once: true });
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const error = new Error(`Provider request failed (${response.status})`);
      error.status = response.status;
      error.bodyKeys = body && typeof body === "object" ? Object.keys(body) : [];
      const upstreamError = body?.error;
      const upstreamCode = typeof upstreamError === "string"
        ? upstreamError
        : upstreamError && typeof upstreamError === "object"
          ? upstreamError.code ?? upstreamError.type
          : body?.error_code ?? body?.code;
      if (typeof upstreamCode === "string" && upstreamCode.length > 0) error.upstreamCode = upstreamCode;
      throw error;
    }
    return { body, response };
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", abortFromCaller);
  }
}

export function redactError(error) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const detail = error?.detail ? ` ${String(error.detail)}` : "";
  const code = error?.code !== undefined && error?.code !== null ? ` [code ${String(error.code)}]` : "";
  return `${message}${detail}${code}`
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/(access|refresh|id)[_-]?token["'=:\s]+[^,\s}]+/gi, "$1_token=[redacted]")
    // Vendor API key shapes: sk-…/sk-ant-…, xai-…, ghp_…, etc. Require a
    // dash/underscore prefix plus a long tail so normal words are not hit.
    .replace(/\b(?:sk|sk-ant|sk-proj|sk-svcacct|xai|agy|gsk|ghp|gho|ghu|github_pat|deepseek|pplx|nvapi|zai|glm)[-_][A-Za-z0-9_-]{12,}\b/gi, "[redacted]")
    .replace(/(api[_-]?key|client[_-]?secret|session[_-]?token|private[_-]?key)["'=:\s]+[^,\s}"']+/gi, "$1=[redacted]")
    .slice(0, 300);
}

export function recursiveQuotaWindows(value, { source, now = new Date(), prefix = "quota" } = {}) {
  const windows = [];

  function visit(node, path, label) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const usedPercent = finiteNumber(node.used_percent ?? node.usedPercent);
    const remainingFraction = finiteNumber(node.remaining_fraction ?? node.remainingFraction);
    const remainingValue = finiteNumber(node.remaining);
    const limitValue = finiteNumber(node.limit);
    const resetAt = isoFromEpoch(node.reset_at ?? node.resetAt)
      ?? addSecondsIso(node.reset_after_seconds ?? node.resetAfterSeconds, now);
    const hasQuotaShape = usedPercent !== null || remainingFraction !== null || remainingValue !== null || limitValue !== null;

    if (hasQuotaShape) {
      let remaining = remainingValue;
      let limit = limitValue;
      let unit = stringValue(node.unit);
      if (remaining === null && remainingFraction !== null) {
        remaining = remainingFraction;
        limit = limit ?? 1;
        unit = unit ?? "fraction";
      } else if (remaining === null && usedPercent !== null) {
        remaining = Math.max(0, 100 - usedPercent);
        limit = limit ?? 100;
        unit = unit ?? "percent";
      }
      windows.push({
        id: path || prefix,
        name: label || path || prefix,
        remaining,
        limit,
        unit,
        resetAt,
        source,
      });
    }

    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        visit(child, path ? `${path}.${key}` : key, key);
      }
    }
  }

  visit(value, "", prefix);
  const unique = new Map();
  for (const window of windows) unique.set(window.id, window);
  return [...unique.values()];
}

export function selectPrimaryQuotaWindow(windows) {
  if (!windows?.length) return {};
  const preferred = windows.find((window) => /primary|weekly|five.?hour|5h/i.test(`${window.id} ${window.name}`));
  return preferred ?? windows[0];
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLoopbackHostname(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return LOOPBACK_HOSTNAMES.has(bare);
}

/**
 * SECURITY.md contract: provider-native remote endpoints must use HTTPS.
 * Plain HTTP is only allowed for explicit loopback development endpoints.
 * Validate every remote URL that arrives from configuration/environment
 * before it is ever fetched — credentials must never travel to a URL an
 * attacker could downgrade.
 *
 * Returns the normalized URL string; throws on violations.
 */
export function assertSecureEndpointUrl(value, label = "endpoint") {
  const raw = String(value ?? "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http(s), got: ${url.protocol}`);
  }
  if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
    throw new Error(`${label} over plain http must target a loopback host, got: ${url.hostname}`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not embed credentials in the URL`);
  }
  if (url.hash) {
    url.hash = "";
  }
  return url.toString();
}
