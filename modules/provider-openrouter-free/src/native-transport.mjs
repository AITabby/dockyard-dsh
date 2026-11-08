import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto, { randomUUID } from "node:crypto";
import { DockyardError } from "../../../packages/core/src/index.mjs";
import {
  DsmlStreamFilter,
  finishReason,
  guardEmptyCompletion,
  normalizeUsage,
  parseDsmlCalls,
  readSseEvents,
  resolveImageData,
  sanitizeToolCallId,
  stripDsmlCalls,
  textFromContent,
} from "../../../packages/providers/src/native-transport.mjs";
import { stripVendorPrefix } from "../../../packages/providers/src/provider-utils.mjs";

export const OPENROUTER_API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
export const OPENROUTER_CREDITS_ENDPOINT = "https://openrouter.ai/api/v1/credits";
export const OPENROUTER_KEY_ENDPOINT = "https://openrouter.ai/api/v1/key";

export const OPENROUTER_AGENTIC_HEADERS = Object.freeze({
  "HTTP-Referer": "https://opencode.ai",
  "X-Title": "OpenCode",
});

export const OPENROUTER_FREE_ROUTER_ID = "openrouter/free";

export const PRIORITIZED_FREE_MODELS = [
  "stealth/crouton-alpha",
  "thinkingmachines/inkling:free",
  "thinkingmachines/inkling-small:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "dots-studio/dots-3-note-preview:free",
  "recursive/flint-v1.0:free",
  "liquid/lfm-2.5-2.6b:free",
];

const MODEL_COOLDOWN_MS = 2 * 60 * 1000;
const failedFreeModels = new Map();

let cachedLiveModels = null;
let cachedLiveModelsAt = 0;
const LIVE_MODELS_CACHE_TTL_MS = 10 * 1000;

function createOpenRouterExecutionError(message, details = {}) {
  const err = new DockyardError("provider_execution_error", message, details);
  if (details.status) err.status = details.status;
  if (details.code) err.code = details.code;
  if (details.accountStatus === "expired") err.authExpired = true;
  if (details.status === 429) err.rateLimited = true;
  return err;
}

export function estimateOpenRouterRequestTokens(request = {}) {
  let chars = 0;
  const sysText = request.system ?? request.systemPrompt ?? request.instructions;
  if (typeof sysText === "string") chars += sysText.length;
  const messages = Array.isArray(request.messages) ? request.messages : [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (typeof msg.content === "string") {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === "string") chars += block.length;
        else if (typeof block?.text === "string") chars += block.text.length;
        else if (typeof block?.thinking === "string") chars += block.thinking.length;
        else if (typeof block?.arguments === "string") chars += block.arguments.length;
      }
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (typeof tc?.function?.arguments === "string") chars += tc.function.arguments.length;
      }
    }
  }
  if (Array.isArray(request.tools)) {
    for (const tool of request.tools) {
      chars += JSON.stringify(tool ?? {}).length;
    }
  }
  // Rough conservative estimate (~3.5 chars per token + 512 overhead)
  return Math.ceil(chars / 3.5) + 512;
}

function isOpenRouterContextOverflowBody(status, errBody = "") {
  if (status !== 400 && status !== 413 && status !== 422) return false;
  return /context[\s_-]*(?:length|window)|maximum context|tokens.*exceed|too\s+(?:long|large)\s+for|prompt is too long|input is too long/i.test(String(errBody));
}

export function clearOpenRouterFreeCache() {
  cachedLiveModels = null;
  cachedLiveModelsAt = 0;
  failedFreeModels.clear();
}

export function markOpenRouterModelCooldown(modelId, nowMs = Date.now()) {
  if (!modelId || modelId === OPENROUTER_FREE_ROUTER_ID) return;
  failedFreeModels.set(modelId, nowMs);
}

export function isOpenRouterModelCoolingDown(modelId, nowMs = Date.now()) {
  const failedAt = failedFreeModels.get(modelId);
  if (!failedAt) return false;
  if (nowMs - failedAt >= MODEL_COOLDOWN_MS) {
    failedFreeModels.delete(modelId);
    return false;
  }
  return true;
}

export function hashApiKeyFingerprint(apiKey) {
  return crypto.createHash("sha256").update(String(apiKey ?? "")).digest("hex").slice(0, 12);
}

export function maskApiKey(apiKey) {
  const trimmed = String(apiKey ?? "").trim();
  if (trimmed.length <= 12) return "sk-or-***";
  return `${trimmed.slice(0, 9)}…${trimmed.slice(-4)}`;
}

function stripYamlQuotes(raw) {
  const val = String(raw ?? "").trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

function parseDshCredentialsYaml(rawText) {
  const entries = [];
  if (typeof rawText !== "string" || !rawText.trim()) return entries;
  const lines = rawText.split(/\r?\n/);
  let currentRef = null;
  let currentValue = null;
  for (const line of lines) {
    const inlineMatch = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*(\S.+?)\s*$/);
    if (inlineMatch) {
      if (currentRef && currentValue) {
        entries.push({ ref: currentRef, apiKey: currentValue });
      }
      currentRef = null;
      currentValue = null;
      entries.push({ ref: inlineMatch[1], apiKey: stripYamlQuotes(inlineMatch[2]) });
      continue;
    }
    const refMatch = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*$/);
    if (refMatch) {
      if (currentRef && currentValue) {
        entries.push({ ref: currentRef, apiKey: currentValue });
      }
      currentRef = refMatch[1];
      currentValue = null;
      continue;
    }
    if (currentRef) {
      const valMatch = line.match(/^\s{4}value:\s*(.+?)\s*$/);
      if (valMatch) {
        currentValue = stripYamlQuotes(valMatch[1]);
      }
    }
  }
  if (currentRef && currentValue) {
    entries.push({ ref: currentRef, apiKey: currentValue });
  }

  const results = [];
  for (const entry of entries) {
    if (
      (entry.ref === "OPENROUTER_API_KEY"
        || entry.ref.startsWith("OPENROUTER_DOCKYARD_")
        || entry.ref.startsWith("OPENROUTER_FREE_"))
      && entry.apiKey.startsWith("sk-or-")
    ) {
      results.push(entry);
      continue;
    }
    if (entry.ref.startsWith("DOCKYARD_DSH_") && entry.apiKey.startsWith("{")) {
      try {
        const parsed = JSON.parse(entry.apiKey);
        if (parsed?.providerId === "openrouter-free" && typeof parsed?.apiKey === "string" && parsed.apiKey.startsWith("sk-or-")) {
          results.push({ ref: entry.ref, apiKey: parsed.apiKey, label: parsed.label });
        }
      } catch {
        // ignore non-json
      }
    }
  }
  return results;
}

export function discoverLocalOpenRouterKeys({ homeDir = os.homedir(), env = process.env } = {}) {
  const discovered = [];
  const seenKeys = new Set();

  const addCandidate = (apiKey, source, label) => {
    const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmed) return;
    const fp = hashApiKeyFingerprint(trimmed);
    if (seenKeys.has(fp)) return;
    seenKeys.add(fp);
    discovered.push({
      apiKey: trimmed,
      fingerprint: fp,
      maskedKey: maskApiKey(trimmed),
      source,
      label: label || `OpenRouter Key (${maskApiKey(trimmed)})`,
    });
  };

  if (env?.OPENROUTER_FREE_API_KEY) {
    addCandidate(env.OPENROUTER_FREE_API_KEY, "env:OPENROUTER_FREE_API_KEY", "Env OPENROUTER_FREE_API_KEY");
  }
  if (env?.OPENROUTER_API_KEY) {
    addCandidate(env.OPENROUTER_API_KEY, "env:OPENROUTER_API_KEY", "Env OPENROUTER_API_KEY");
  }

  try {
    const credPath = path.join(homeDir, ".dsh", ".credentials.yaml");
    if (fs.existsSync(credPath)) {
      const raw = fs.readFileSync(credPath, "utf8");
      const parsed = parseDshCredentialsYaml(raw);
      for (const item of parsed) {
        addCandidate(
          item.apiKey,
          `dsh_credentials:${item.ref}`,
          item.label || `OpenRouter Key (${maskApiKey(item.apiKey)})`,
        );
      }
    }
  } catch {
    // ignore read errors
  }

  return discovered;
}

export function extractOpenRouterFreeAuth({ homeDir = os.homedir(), env = process.env } = {}) {
  const keys = discoverLocalOpenRouterKeys({ homeDir, env });
  return keys[0] ?? null;
}

export function classifyOpenRouterFreeKind(item) {
  const id = String(item?.id ?? "").trim();
  const lowerId = id.toLowerCase();
  const desc = String(item?.description ?? "").toLowerCase();
  if (id === OPENROUTER_FREE_ROUTER_ID) return "router";
  if (
    lowerId.startsWith("stealth/")
    || lowerId.includes("stealth")
    || lowerId.includes("cloak")
    || (!lowerId.endsWith(":free") && (lowerId.includes("-alpha") || desc.includes("stealth") || desc.includes("cloaked")))
  ) {
    return "stealth";
  }
  if (!lowerId.endsWith(":free")) {
    return "limited_free";
  }
  return "free";
}

export function isUsableOpenRouterFreeModel(item) {
  if (!item || typeof item.id !== "string") return false;
  const id = item.id.trim();
  if (!id) return false;
  if (id === OPENROUTER_FREE_ROUTER_ID) return true;

  const lowerId = id.toLowerCase();
  if (
    lowerId.includes("content-safety")
    || lowerId.includes("llama-guard")
    || lowerId.includes("prompt-guard")
    || lowerId.startsWith("google/lyria")
    || lowerId.startsWith("openrouter/auto")
    || lowerId.startsWith("openrouter/bodybuilder")
    || lowerId.startsWith("openrouter/fusion")
    || lowerId.startsWith("openrouter/pareto")
  ) {
    return false;
  }

  const isFreeSuffix = lowerId.endsWith(":free");
  const promptPrice = item.pricing?.prompt;
  const completionPrice = item.pricing?.completion;
  const requestPrice = item.pricing?.request;
  const isZeroPriced = promptPrice !== undefined
    && completionPrice !== undefined
    && Number(promptPrice) === 0
    && Number(completionPrice) === 0
    && (requestPrice === undefined || Number(requestPrice) === 0);

  if (!isFreeSuffix && !isZeroPriced) return false;

  const outputModalities = item.architecture?.output_modalities;
  if (Array.isArray(outputModalities)) {
    if (outputModalities.length > 0 && !outputModalities.includes("text")) {
      return false;
    }
    if (outputModalities.includes("audio") && !isFreeSuffix) {
      return false;
    }
  }

  const supportedParams = item.supported_parameters;
  if (Array.isArray(supportedParams) && supportedParams.length === 0) {
    return false;
  }

  return true;
}

export function normalizeOpenRouterFreeModelEntry(item) {
  const id = String(item.id).trim();
  const kind = classifyOpenRouterFreeKind(item);
  const isRouter = kind === "router";
  const rawName = String(item.name || id)
    .replace(/\s*\(free\)\s*$/i, "")
    .replace(/\s*\[free\]\s*$/i, "")
    .trim();

  const name = isRouter ? "Free Models Router" : stripVendorPrefix(rawName);

  const rawContextLength = Number(item.top_provider?.context_length || item.context_length);
  const contextWindow = rawContextLength > 0
    ? rawContextLength
    : (isRouter ? 200000 : 131072);
  const rawMaxCompletion = Number(item.top_provider?.max_completion_tokens);
  const maxTokens = rawMaxCompletion > 0
    ? rawMaxCompletion
    : (isRouter ? 32768 : Math.min(contextWindow, 16384));
  const inputModalities = ["text"];
  if (isRouter || item.architecture?.input_modalities?.includes("image")) {
    inputModalities.push("image");
  }
  const supportedParams = Array.isArray(item.supported_parameters) ? item.supported_parameters : [];
  const supportsTools = isRouter || supportedParams.length === 0 || supportedParams.includes("tools");
  const supportsReasoning = isRouter || supportedParams.includes("reasoning") || supportedParams.includes("include_reasoning");
  const created = Number(item.created) || 0;

  return {
    id,
    name,
    free: true,
    freeKind: kind,
    created,
    contextWindow,
    maxTokens,
    inputModalities,
    supportsTools,
    supportsReasoning,
    ...(supportsReasoning
      ? {
          reasoning: {
            defaultEffort: "medium",
            efforts: [
              { id: "low", name: "Low" },
              { id: "medium", name: "Medium" },
              { id: "high", name: "High" },
              { id: "xhigh", name: "Extra High" },
            ],
          },
        }
      : {}),
  };
}

export function buildOpenRouterFreeCatalogFromRaw(rawModels = []) {
  const entriesById = new Map();

  entriesById.set(OPENROUTER_FREE_ROUTER_ID, normalizeOpenRouterFreeModelEntry({
    id: OPENROUTER_FREE_ROUTER_ID,
    name: "Free Models Router",
    context_length: 200000,
    top_provider: { context_length: 200000, max_completion_tokens: 32768 },
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
    supported_parameters: ["tools", "reasoning", "include_reasoning", "max_tokens", "temperature"],
  }));

  const rawArray = Array.isArray(rawModels) ? rawModels : [];
  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    if (!isUsableOpenRouterFreeModel(item)) continue;
    const normalized = normalizeOpenRouterFreeModelEntry({
      ...item,
      // Preserve OpenRouter's natural newest-first ordering when `created` is equal or missing
      created: Number(item.created) || (1_000_000 - i),
    });
    entriesById.set(normalized.id, normalized);
  }

  const routerEntry = entriesById.get(OPENROUTER_FREE_ROUTER_ID);
  const specificEntries = [...entriesById.values()].filter((m) => m.id !== OPENROUTER_FREE_ROUTER_ID);

  // Sort order:
  // 1. Stealth & limited-time free models first (so users immediately spot newly launched stealth/promo models!)
  // 2. Then by newest `created` timestamp descending (OpenRouter's live dynamic order)
  const kindRank = (m) => (m.freeKind === "stealth" ? 0 : m.freeKind === "limited_free" ? 1 : 2);
  specificEntries.sort((a, b) => {
    const rA = kindRank(a);
    const rB = kindRank(b);
    if (rA !== rB) return rA - rB;
    if (b.created !== a.created) return b.created - a.created;
    return a.id.localeCompare(b.id);
  });

  return [routerEntry, ...specificEntries];
}

export async function fetchLiveOpenRouterFreeModels({
  fetchImpl = globalThis.fetch,
  apiKey = null,
  forceRefresh = false,
} = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedLiveModels && now - cachedLiveModelsAt < LIVE_MODELS_CACHE_TTL_MS) {
    return cachedLiveModels;
  }

  if (typeof fetchImpl !== "function") {
    return cachedLiveModels ?? buildOpenRouterFreeCatalogFromRaw(
      PRIORITIZED_FREE_MODELS.map((id, idx) => ({
        id,
        name: id,
        created: 1_000_000 - idx,
        pricing: { prompt: "0", completion: "0" },
      })),
    );
  }

  try {
    const headers = {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...OPENROUTER_AGENTIC_HEADERS,
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
    const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const payload = await response.json();
      const rawData = Array.isArray(payload?.data) ? payload.data : [];
      const catalog = buildOpenRouterFreeCatalogFromRaw(rawData);
      if (catalog.length > 1) {
        cachedLiveModels = catalog;
        cachedLiveModelsAt = Date.now();
        return catalog;
      }
    }
  } catch {
    // fallback to cached or default prioritized list
  }

  return cachedLiveModels ?? buildOpenRouterFreeCatalogFromRaw(
    PRIORITIZED_FREE_MODELS.map((id, idx) => ({
      id,
      name: id,
      created: 1_000_000 - idx,
      pricing: { prompt: "0", completion: "0" },
    })),
  );
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return textFromContent(content);
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block?.type === "text") return block.text ?? "";
      if (block?.type === "tool-result" || block?.type === "tool_result") {
        return textFromContent(block.content ?? block.output ?? block.result ?? block.text);
      }
      return textFromContent(block);
    })
    .filter(Boolean)
    .join("\n");
}

function isToolCallBlock(block) {
  if (!block || typeof block !== "object") return false;
  const type = String(block.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "tooluse" || type === "functioncall" || Boolean(block.functionCall);
}

function isToolResultBlock(block) {
  if (!block || typeof block !== "object") return false;
  const type = String(block.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolresult";
}

function extractNormalizedToolCall(block, fallbackIndex = 1) {
  const fnObj = block.function ?? block.functionCall ?? null;
  const rawId = block.id ?? block.toolCallId ?? block.tool_call_id ?? fnObj?.id ?? `call_${fallbackIndex}`;
  const rawName = block.name ?? block.toolName ?? block.tool_name ?? fnObj?.name ?? "tool";
  const rawArgs = block.arguments ?? block.input ?? block.args ?? fnObj?.arguments ?? fnObj?.args ?? {};
  return {
    id: sanitizeToolCallId(String(rawId)),
    type: "function",
    function: {
      name: String(rawName),
      arguments: typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? {}),
    },
  };
}

export async function normalizeMessages(request = {}, { includeReasoningContent = false, attachments = null } = {}) {
  const out = [];
  const sysText = request.system ?? request.systemPrompt ?? request.instructions;
  if (typeof sysText === "string" && sysText.trim()) {
    out.push({ role: "system", content: sysText.trim() });
  }
  const messages = Array.isArray(request.messages) ? request.messages : [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const role = msg.role === "developer" ? "system" : (msg.role ?? "user");
    if (role === "tool" || role === "toolResult" || role === "tool_result") {
      if (Array.isArray(msg.content) && msg.content.some(isToolResultBlock)) {
        for (const block of msg.content) {
          if (!isToolResultBlock(block)) continue;
          const toolCallId = sanitizeToolCallId(
            block.toolCallId ?? block.tool_call_id ?? block.id ?? msg.tool_call_id ?? msg.toolCallId ?? msg.id ?? "call_1",
          );
          const resultText = typeof block.content === "string"
            ? block.content
            : textFromContent(block.content ?? block.output ?? block.result ?? block.text);
          out.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: resultText || "",
          });
        }
        continue;
      }
      const toolCallId = sanitizeToolCallId(msg.tool_call_id ?? msg.toolCallId ?? msg.id ?? "call_1");
      const rawContent = msg.content ?? msg.output ?? msg.result ?? msg.text;
      out.push({
        role: "tool",
        tool_call_id: toolCallId,
        content: typeof rawContent === "string" ? rawContent : contentToText(rawContent),
      });
      continue;
    }
    if (role === "assistant" && Array.isArray(msg.content)) {
      const textParts = [];
      const thinkingParts = [];
      const toolCalls = [];
      for (const block of msg.content) {
        if (typeof block === "string") {
          textParts.push(block);
        } else if (block?.type === "text" && block.text) {
          textParts.push(block.text);
        } else if ((block?.type === "thinking" || block?.type === "reasoning") && (block.thinking ?? block.text)) {
          thinkingParts.push(block.thinking ?? block.text);
        } else if (isToolCallBlock(block)) {
          toolCalls.push(extractNormalizedToolCall(block, toolCalls.length + 1));
        }
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const normalizedTc = extractNormalizedToolCall(tc, toolCalls.length + 1);
          if (!toolCalls.some((existing) => existing.id === normalizedTc.id)) {
            toolCalls.push(normalizedTc);
          }
        }
      }
      const joinedText = textParts.join("\n").replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "").trim();
      const entry = {
        role: "assistant",
        content: joinedText || (toolCalls.length > 0 ? null : ""),
      };
      const existingReasoning = msg.reasoning_content ?? msg.reasoning ?? (thinkingParts.length > 0 ? thinkingParts.join("\n") : undefined);
      if (existingReasoning !== undefined) {
        entry.reasoning_content = existingReasoning;
      } else if (includeReasoningContent) {
        entry.reasoning_content = " ";
      }
      if (toolCalls.length > 0) entry.tool_calls = toolCalls;
      out.push(entry);
      continue;
    }
    if (role === "user" && Array.isArray(msg.content)) {
      const toolResults = msg.content.filter(isToolResultBlock);
      const nonToolBlocks = msg.content.filter((b) => !isToolResultBlock(b));
      for (const block of toolResults) {
        const toolCallId = sanitizeToolCallId(block.toolCallId ?? block.tool_call_id ?? block.id ?? "call_1");
        const resultText = typeof block.content === "string"
          ? block.content
          : textFromContent(block.content ?? block.output ?? block.result ?? block.text);
        out.push({
          role: "tool",
          tool_call_id: toolCallId,
          content: resultText || "",
        });
      }
      if (nonToolBlocks.length === 0 && toolResults.length > 0) {
        continue;
      }
      const parts = [];
      for (const block of nonToolBlocks) {
        if (typeof block === "string") {
          parts.push({ type: "text", text: block });
        } else if (block?.type === "text" && block.text) {
          parts.push({ type: "text", text: block.text });
        } else if (block?.type === "image") {
          let url = block.url ?? (block.data ? `data:${block.mimeType ?? "image/png"};base64,${block.data}` : null);
          if (!url && block.attachment) {
            // DSH hands over an opaque attachment reference; resolve real bytes
            // instead of silently dropping the image.
            const resolved = await resolveImageData(block, attachments);
            if (resolved) {
              url = `data:${resolved.mediaType || "image/png"};base64,${resolved.data}`;
            } else {
              throw new Error("图片附件无法读取：缺少 DSH 附件服务或附件已失效，请重新粘贴图片");
            }
          }
          if (url) parts.push({ type: "image_url", image_url: { url } });
        } else if (block?.type === "image_url" && block.image_url) {
          parts.push({ type: "image_url", image_url: block.image_url });
        }
      }
      if (parts.some((p) => p.type === "image_url")) {
        out.push({ role: "user", content: parts });
        continue;
      }
      const textOnly = parts.map((p) => p.text).filter(Boolean).join("\n");
      out.push({ role: "user", content: textOnly });
      continue;
    }
    const rawText = typeof msg.content === "string" ? msg.content : contentToText(msg.content);
    const cleanedText = role === "assistant"
      ? rawText.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "").trim()
      : rawText;
    const entry = {
      role,
      content: cleanedText,
    };
    if (role === "assistant") {
      if (msg.reasoning_content !== undefined) {
        entry.reasoning_content = msg.reasoning_content;
      } else if (includeReasoningContent) {
        entry.reasoning_content = " ";
      }
    }
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      entry.tool_calls = msg.tool_calls.map((tc, idx) => extractNormalizedToolCall(tc, idx + 1));
      if (!entry.content) entry.content = null;
    }
    out.push(entry);
  }

  // Ensure every `role: "tool"` message has a corresponding `tool_calls` entry
  // in the preceding `assistant` message so OpenRouter's template renderer never
  // flattens orphaned tool outputs into the assistant's text continuation.
  let lastAssistant = null;
  for (let i = 0; i < out.length; i++) {
    const item = out[i];
    if (item.role === "assistant") {
      lastAssistant = item;
    } else if (item.role === "tool") {
      const tcId = item.tool_call_id || "call_1";
      if (!lastAssistant) {
        lastAssistant = {
          role: "assistant",
          content: null,
          ...(includeReasoningContent ? { reasoning_content: " " } : {}),
          tool_calls: [{
            id: tcId,
            type: "function",
            function: { name: "tool", arguments: "{}" },
          }],
        };
        out.splice(i, 0, lastAssistant);
        i += 1;
      } else {
        if (!Array.isArray(lastAssistant.tool_calls)) {
          lastAssistant.tool_calls = [];
          if (!lastAssistant.content) lastAssistant.content = null;
        }
        if (!lastAssistant.tool_calls.some((tc) => tc.id === tcId)) {
          lastAssistant.tool_calls.push({
            id: tcId,
            type: "function",
            function: { name: "tool", arguments: "{}" },
          });
        }
      }
    } else if (item.role === "user") {
      lastAssistant = null;
    }
  }

  return out;
}

function normalizeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return tools.map((tool) => {
    if (tool?.type === "function" && tool.function) return tool;
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.parameters ?? tool.inputSchema ?? { type: "object", properties: {} },
      },
    };
  });
}

function requestHasImages(messages = []) {
  return messages.some((m) => (
    Array.isArray(m?.content) && m.content.some((part) => part?.type === "image" || part?.type === "image_url")
  ));
}

function normalizeReasoningParam(request = {}) {
  const rawEffort = request.reasoningEffort ?? request.reasoning?.effort ?? null;
  if (!rawEffort || rawEffort === "none" || rawEffort === "off" || rawEffort === "default") {
    return undefined;
  }
  const validEfforts = new Set(["minimal", "low", "medium", "high", "xhigh", "max"]);
  const normalized = String(rawEffort).toLowerCase().trim();
  if (validEfforts.has(normalized)) {
    return { effort: normalized };
  }
  return undefined;
}

function extractReasoningDelta(delta = {}) {
  if (typeof delta.reasoning_content === "string" && delta.reasoning_content) return delta.reasoning_content;
  if (typeof delta.reasoning === "string" && delta.reasoning) return delta.reasoning;
  if (Array.isArray(delta.reasoning_details)) {
    for (const detail of delta.reasoning_details) {
      if (typeof detail?.text === "string" && detail.text) return detail.text;
      if (typeof detail?.summary === "string" && detail.summary) return detail.summary;
    }
  }
  return "";
}

export function selectOpenRouterFreeCandidateQueue({
  requestedModel,
  liveCatalog = [],
  hasTools = false,
  hasImages = false,
  estimatedTokens = 0,
  noFallback = false,
  nowMs = Date.now(),
} = {}) {
  const rawModel = String(requestedModel || OPENROUTER_FREE_ROUTER_ID).replace(/^openrouter-free\//, "");
  const isRouter = rawModel === OPENROUTER_FREE_ROUTER_ID || rawModel === "free";

  if (!isRouter && noFallback) {
    return [rawModel];
  }

  const catalogEntries = liveCatalog.filter((entry) => entry.id && entry.id !== OPENROUTER_FREE_ROUTER_ID);
  const entryMap = new Map(catalogEntries.map((entry) => [entry.id, entry]));

  const orderedIds = [];
  const seen = new Set();
  const pushCandidate = (id) => {
    if (!id || seen.has(id)) return;
    if (isOpenRouterModelCoolingDown(id, nowMs)) return;
    seen.add(id);
    orderedIds.push(id);
  };

  if (!isRouter) {
    pushCandidate(rawModel);
  }

  const compatiblePool = [];
  const contextFallbackPool = [];
  const secondaryPool = [];

  const allKnownIds = [
    ...PRIORITIZED_FREE_MODELS.filter((id) => entryMap.size === 0 || entryMap.has(id)),
    ...catalogEntries.map((e) => e.id),
  ];

  // Reserve at least 4096 tokens for generation when matching candidate context window
  const requiredContextWindow = estimatedTokens > 0 ? estimatedTokens + 4096 : 0;

  for (const id of allKnownIds) {
    const meta = entryMap.get(id);
    const toolsOk = !hasTools || !meta || meta.supportsTools !== false;
    const imagesOk = !hasImages || !meta || (Array.isArray(meta.inputModalities) && meta.inputModalities.includes("image"));
    const contextOk = !requiredContextWindow || !meta?.contextWindow || meta.contextWindow >= requiredContextWindow;
    if (toolsOk && imagesOk && contextOk) {
      compatiblePool.push(id);
    } else if (toolsOk && imagesOk) {
      contextFallbackPool.push(id);
    } else {
      secondaryPool.push(id);
    }
  }

  // If the context is smaller than some models, sort contextFallbackPool by largest contextWindow first
  contextFallbackPool.sort((a, b) => {
    const ctxA = entryMap.get(a)?.contextWindow || 0;
    const ctxB = entryMap.get(b)?.contextWindow || 0;
    return ctxB - ctxA;
  });

  for (const id of compatiblePool) pushCandidate(id);
  for (const id of contextFallbackPool) pushCandidate(id);
  for (const id of secondaryPool) pushCandidate(id);

  if (!seen.has(OPENROUTER_FREE_ROUTER_ID)) {
    orderedIds.push(OPENROUTER_FREE_ROUTER_ID);
  }

  if (orderedIds.length === 0) {
    return [isRouter ? OPENROUTER_FREE_ROUTER_ID : rawModel];
  }

  return orderedIds;
}

export function createOpenRouterFreeNativeExecutor({
  fetchImpl = globalThis.fetch,
  homeDir = os.homedir(),
  env = process.env,
  timeoutMs = 120_000,
} = {}) {
  const executeOpenRouterFreeStream = async function*(input = {}, maybeInvocation = {}, maybeContext = {}) {
    // Support both calling conventions:
    // 1) driver.stream: executor({ request, account, credential, signal })
    // 2) direct invocation: executor(request, invocation, context)
    const isWrappedInput = input && typeof input === "object" && ("request" in input || "credential" in input);
    const request = isWrappedInput ? (input.request ?? {}) : (input ?? {});
    const secret = isWrappedInput
      ? (input.credential ?? input.secret ?? null)
      : (maybeInvocation?.secret ?? maybeInvocation?.credential ?? maybeContext?.secret ?? null);
    const signal = (isWrappedInput ? input.signal : null) ?? request.signal ?? maybeContext?.signal ?? null;
    const attachments = (isWrappedInput ? input.attachments : null)
      ?? maybeInvocation?.attachments
      ?? maybeContext?.attachments
      ?? null;

    const localAuth = extractOpenRouterFreeAuth({ homeDir, env });
    const apiKey = secret?.apiKey ?? secret?.accessToken ?? secret?.token ?? localAuth?.apiKey;
    if (!apiKey) {
      throw createOpenRouterExecutionError(
        "未找到 OpenRouter API Key。请在 Dockyard 的 OpenRouter Free 订阅弹窗中粘贴您的 API Key（或扫描本机已配置的 OPENROUTER_API_KEY）。",
        { retryable: false, accountStatus: "expired" },
      );
    }

    const rawModel = String(request.model || OPENROUTER_FREE_ROUTER_ID).replace(/^openrouter-free\//, "");
    const isRouterRequest = rawModel === OPENROUTER_FREE_ROUTER_ID || rawModel === "free";
    const noFallback = Boolean(request.noFallback || request.probe);
    const tools = normalizeTools(request.tools);
    const hasTools = Boolean(tools && tools.length > 0);
    const hasImages = requestHasImages(request.messages);

    const liveCatalog = await fetchLiveOpenRouterFreeModels({ fetchImpl, apiKey });
    const estimatedTokens = estimateOpenRouterRequestTokens(request);
    const candidateQueue = selectOpenRouterFreeCandidateQueue({
      requestedModel: rawModel,
      liveCatalog,
      hasTools,
      hasImages,
      estimatedTokens,
      noFallback: noFallback && !isRouterRequest,
    });

    const reasoningParam = normalizeReasoningParam(request);

    const normalizedCache = new Map();
    const normalizedMessagesFor = async (includeReasoningContent) => {
      const key = includeReasoningContent ? "1" : "0";
      if (!normalizedCache.has(key)) {
        normalizedCache.set(key, await normalizeMessages(request, { includeReasoningContent, attachments }));
      }
      return normalizedCache.get(key);
    };
    const buildBodyForModels = async (modelsSlice, { includeReasoningContent = false } = {}) => {
      const primaryModel = modelsSlice[0];
      const fallbackModels = modelsSlice.slice(1, 3);
      return {
        model: primaryModel,
        ...(fallbackModels.length > 0 ? { models: [primaryModel, ...fallbackModels] } : {}),
        messages: await normalizedMessagesFor(includeReasoningContent),
        stream: true,
        ...(tools ? { tools } : {}),
        ...(reasoningParam ? { reasoning: reasoningParam } : {}),
        ...(typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}),
        ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      };
    };

    const doFetch = async (bodyObj) => {
      let lastNetworkErr = null;
      const maxNetworkAttempts = 2;
      for (let attempt = 1; attempt <= maxNetworkAttempts; attempt++) {
        try {
          return await fetchImpl(OPENROUTER_API_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              Accept: "text/event-stream, application/json",
              ...OPENROUTER_AGENTIC_HEADERS,
            },
            body: JSON.stringify(bodyObj),
            ...(signal ? { signal } : {}),
          });
        } catch (err) {
          lastNetworkErr = err;
          if (signal?.aborted || attempt >= maxNetworkAttempts) {
            throw createOpenRouterExecutionError(
              `OpenRouter Free network request failed: ${err?.message || String(err)}`,
              { retryable: true, cause: err },
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        }
      }
      throw lastNetworkErr;
    };

    const batches = [];
    if (noFallback && !isRouterRequest) {
      batches.push([rawModel]);
    } else {
      for (let i = 0; i < candidateQueue.length && batches.length < 6; i += 1) {
        const slice = isRouterRequest
          ? candidateQueue.slice(i, i + 3)
          : [candidateQueue[i]];
        batches.push(slice);
      }
    }

    let lastStatus = 500;
    let lastErrBody = "Unknown OpenRouter error";
    let sawContextOverflow = false;
    let includeReasoningContent = false;
    let response = null;

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      let candidateRes = await doFetch(await buildBodyForModels(batch, { includeReasoningContent }));

      if (!candidateRes.ok) {
        const errBody = await candidateRes.text().catch(() => "");
        if (candidateRes.status === 400 && errBody.includes("reasoning_content") && !includeReasoningContent) {
          includeReasoningContent = true;
          candidateRes = await doFetch(await buildBodyForModels(batch, { includeReasoningContent: true }));
        } else {
          lastStatus = candidateRes.status;
          lastErrBody = errBody || `HTTP ${candidateRes.status}`;
          if (isOpenRouterContextOverflowBody(candidateRes.status, errBody)) {
            sawContextOverflow = true;
          }
          if (candidateRes.status === 401) {
            throw createOpenRouterExecutionError(
              `OpenRouter API Key 无效或已过期 (${candidateRes.status}): ${lastErrBody.slice(0, 300)}`,
              { status: candidateRes.status, retryable: false, accountStatus: "expired" },
            );
          }
          markOpenRouterModelCooldown(batch[0]);
          continue;
        }
      }

      if (!candidateRes.ok) {
        const errBody = await candidateRes.text().catch(() => "");
        lastStatus = candidateRes.status;
        lastErrBody = errBody || `HTTP ${candidateRes.status}`;
        if (isOpenRouterContextOverflowBody(candidateRes.status, errBody)) {
          sawContextOverflow = true;
        }
        markOpenRouterModelCooldown(batch[0]);
        continue;
      }

      response = candidateRes;
      break;
    }

    if (!response) {
      throw createOpenRouterExecutionError(
        `OpenRouter Free request failed (${lastStatus}): ${String(lastErrBody).slice(0, 300)}`,
        {
          status: lastStatus,
          ...(sawContextOverflow ? { code: "CONTEXT_WINDOW_EXCEEDED" } : {}),
          retryable: sawContextOverflow || lastStatus === 429 || lastStatus >= 500,
        },
      );
    }

    const streamEvents = [];
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";
    let probeYielded = false;
    let substantiveYielded = false;
    const activeTools = new Map();
    let inThinkTag = false;
    let thinkPending = "";

    const pushReasoningChunk = (text) => {
      if (!text) return;
      substantiveYielded = true;
      textFilter.closeText();
      if (!reasoning) {
        reasoning = { index: nextIndex++, text: "" };
        streamEvents.push({ type: "block-start", index: reasoning.index, blockType: "reasoning" });
      }
      reasoning.text += text;
      streamEvents.push({ type: "reasoning-delta", index: reasoning.index, text });
    };

    const reasoningDsmlCalls = [];
    const closeReasoningBlock = () => {
      if (!reasoning) return;
      if (typeof reasoning.text === "string" && reasoning.text.includes("DSML")) {
        const calls = parseDsmlCalls(reasoning.text);
        if (calls?.length > 0) {
          reasoningDsmlCalls.push(...calls);
          reasoning.text = stripDsmlCalls(reasoning.text);
        }
      }
      streamEvents.push({ type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } });
      reasoning = null;
    };

    const pushContentChunk = (rawChunk) => {
      if (!rawChunk) return;
      let buf = thinkPending + rawChunk;
      thinkPending = "";

      while (buf.length > 0) {
        if (inThinkTag) {
          const closeMatch = buf.match(/<\/think(?:ing)?>/i);
          if (closeMatch) {
            const thoughtPart = buf.slice(0, closeMatch.index);
            if (thoughtPart) pushReasoningChunk(thoughtPart);
            closeReasoningBlock();
            inThinkTag = false;
            buf = buf.slice(closeMatch.index + closeMatch[0].length);
            continue;
          }
          const partialClose = buf.match(/<\/(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i);
          if (partialClose) {
            const safeThought = buf.slice(0, partialClose.index);
            if (safeThought) pushReasoningChunk(safeThought);
            thinkPending = partialClose[0];
          } else {
            pushReasoningChunk(buf);
          }
          break;
        } else {
          const openMatch = buf.match(/<think(?:ing)?>/i);
          if (openMatch) {
            const beforeText = buf.slice(0, openMatch.index);
            if (beforeText) {
              closeReasoningBlock();
              textFilter.push(beforeText, () => nextIndex++);
            }
            inThinkTag = true;
            buf = buf.slice(openMatch.index + openMatch[0].length);
            continue;
          }
          const partialOpen = buf.match(/<(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i);
          if (partialOpen) {
            const safeText = buf.slice(0, partialOpen.index);
            if (safeText) {
              closeReasoningBlock();
              textFilter.push(safeText, () => nextIndex++);
            }
            thinkPending = partialOpen[0];
          } else {
            closeReasoningBlock();
            textFilter.push(buf, () => nextIndex++);
          }
          break;
        }
      }
    };

    const textFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "text" }),
      onTextDelta: (index, text) => streamEvents.push({ type: "text-delta", index, text }),
      onTextBlockEnd: (index, text) => streamEvents.push({ type: "block-end", index, block: { type: "text", text } }),
    });

    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: "openrouter-free" })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;

      if (parsed.error && !substantiveYielded) {
        const errMsg = parsed.error?.message || JSON.stringify(parsed.error);
        const errCode = Number(parsed.error?.code) || 502;
        throw createOpenRouterExecutionError(
          `OpenRouter Free stream error (${errCode}): ${errMsg}`,
          { status: errCode, retryable: errCode === 429 || errCode >= 500 },
        );
      }

      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;

      if (request.probe && !probeYielded) {
        probeYielded = true;
        substantiveYielded = true;
        yield { type: "text-delta", index: 0, text: " " };
        yield { type: "finish", reason: finishReason("stop") };
        return;
      }

      const delta = choice.delta ?? choice.message ?? {};
      const reasoningDelta = extractReasoningDelta(delta);
      if (reasoningDelta) {
        pushReasoningChunk(reasoningDelta);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }

      for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
        substantiveYielded = true;
        const key = Number(call.index ?? activeTools.size);
        if (!activeTools.has(key)) {
          closeReasoningBlock();
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();
          const state = {
            index: nextIndex++,
            id: sanitizeToolCallId(call.id || `call_${key}_${randomUUID().slice(0, 8)}`),
            name: call.function?.name || call.name || "tool",
            arguments: "",
          };
          activeTools.set(key, state);
          yield { type: "block-start", index: state.index, blockType: "tool-call" };
        }
        const state = activeTools.get(key);
        const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
        if (call.id) state.id = sanitizeToolCallId(call.id);
        if (call.function?.name) state.name = call.function.name;
        state.arguments += argumentDelta;
        if (argumentDelta) {
          yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
        }
      }

      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        substantiveYielded = true;
        pushContentChunk(content);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }

      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }

    if (thinkPending) {
      if (inThinkTag) pushReasoningChunk(thinkPending);
      else {
        closeReasoningBlock();
        textFilter.push(thinkPending, () => nextIndex++);
      }
      thinkPending = "";
    }
    closeReasoningBlock();

    const dsmlResult = textFilter.flush(() => nextIndex++);
    while (streamEvents.length > 0) yield streamEvents.shift();

    const allDsmlCalls = [
      ...reasoningDsmlCalls,
      ...(dsmlResult?.toolCalls || []),
    ];

    if (activeTools.size > 0) {
      for (const state of activeTools.values()) {
        yield {
          type: "block-end",
          index: state.index,
          block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" },
        };
      }
      stop = "tool_calls";
    } else if (allDsmlCalls.length > 0) {
      for (const dsml of allDsmlCalls) {
        substantiveYielded = true;
        const toolIndex = nextIndex++;
        const toolId = `call_${randomUUID().slice(0, 8)}`;
        yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
        yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: dsml.name, argumentsDelta: dsml.arguments };
        yield {
          type: "block-end",
          index: toolIndex,
          block: { type: "tool-call", id: toolId, name: dsml.name, arguments: dsml.arguments },
        };
      }
      stop = "tool_calls";
    }

    if (rawUsage) {
      yield {
        type: "usage",
        usage: normalizeUsage(rawUsage),
      };
    }
    yield {
      type: "finish",
      reason: finishReason(stop),
      ...(rawUsage ? { usage: normalizeUsage(rawUsage) } : {}),
    };
  };
  return guardEmptyCompletion(executeOpenRouterFreeStream, { providerId: "openrouter-free" });
}
