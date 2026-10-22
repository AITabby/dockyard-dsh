import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import {
  cleanupNativeResponse,
  fetchNativeResponse,
  finishReason,
  nativeProviderError,
  normalizeUsage,
  parseToolArguments,
  readSseEvents,
  resolveImageData,
  textFromContent,
  validateNativeEndpoint,
} from "../../../packages/providers/src/native-transport.mjs";
import {
  addSecondsIso,
  decodeJwtPayload,
  isoFromEpoch,
} from "../../../packages/providers/src/provider-utils.mjs";

const PROVIDER_ID = "antigravity";
const DEFAULT_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";
const DEFAULT_QUOTA_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary";
const DEFAULT_PROJECT_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const MACOS_SECURITY_BIN = "/usr/bin/security";
const AGY_KEYCHAIN_SERVICE = "gemini";
const AGY_KEYCHAIN_ACCOUNT = "antigravity";
const AGY_KEYCHAIN_VALUE_PREFIX = "go-keyring-base64:";
const ANTIGRAVITY_INFO_PATHS = [
  "/Applications/Antigravity.app/Contents/Info.plist",
  join(homedir(), "Applications/Antigravity.app/Contents/Info.plist"),
];

function normalizeAntigravityClientVersion(value) {
  const version = String(value ?? "").trim();
  return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}

function detectAntigravityUserAgent() {
  for (const infoPath of ANTIGRAVITY_INFO_PATHS) {
    try {
      const version = normalizeAntigravityClientVersion(execFileSync(
        "/usr/libexec/PlistBuddy",
        ["-c", "Print :CFBundleShortVersionString", infoPath],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ));
      if (version) return `antigravity/hub/${version} ${process.platform}/${process.arch}`;
    } catch {
      // CodexSplit omits User-Agent when the desktop bundle is unavailable.
    }
  }
  return null;
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

const THOUGHT_SIGNATURE_CACHE_LIMIT = 4096;
const thoughtSignaturesByToolId = new Map();

function rememberThoughtSignature(id, signature) {
  if (typeof id !== "string" || id.length === 0) return;
  if (typeof signature !== "string" || signature.length === 0) return;
  if (thoughtSignaturesByToolId.has(id)) thoughtSignaturesByToolId.delete(id);
  thoughtSignaturesByToolId.set(id, signature);
  if (thoughtSignaturesByToolId.size > THOUGHT_SIGNATURE_CACHE_LIMIT) {
    const oldest = thoughtSignaturesByToolId.keys().next().value;
    thoughtSignaturesByToolId.delete(oldest);
  }
}

function thoughtSignatureFrom(value) {
  if (!value || typeof value !== "object") return null;
  return firstString(
    value.thoughtSignature,
    value.thought_signature,
    value.providerMetadata?.thoughtSignature,
    value.providerMetadata?.thought_signature,
    value.providerMetadata?.google?.thoughtSignature,
    value.providerMetadata?.google?.thought_signature,
    value.providerMetadata?.antigravity?.thoughtSignature,
    value.providerMetadata?.antigravity?.thought_signature,
    value.function?.thoughtSignature,
    value.function?.thought_signature,
    value.functionCall?.thoughtSignature,
    value.functionCall?.thought_signature,
    value.function_call?.thoughtSignature,
    value.function_call?.thought_signature,
  );
}

function thoughtSignatureForToolPart(part) {
  return thoughtSignatureFrom(part)
    ?? thoughtSignaturesByToolId.get(part?.id)
    ?? thoughtSignaturesByToolId.get(part?.toolCallId)
    ?? null;
}

function partTypeKey(part) {
  return String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
}

function isToolCallPart(part) {
  if (!part || typeof part !== "object") return false;
  if (part.functionCall || part.function_call) return true;
  const type = partTypeKey(part);
  return type === "toolcall" || type === "functioncall";
}

function isToolResultPart(part) {
  if (!part || typeof part !== "object") return false;
  if (part.functionResponse || part.function_response) return true;
  const type = partTypeKey(part);
  return type === "toolresult" || type === "functionresponse";
}

function toolCallIdOf(part) {
  return firstString(part?.id, part?.toolCallId, part?.tool_call_id, part?.functionCall?.id);
}

function toolCallNameOf(part) {
  return firstString(
    part?.name,
    part?.toolName,
    part?.function?.name,
    part?.functionCall?.name,
    part?.function_call?.name,
    part?.functionResponse?.name,
    part?.function_response?.name,
  ) ?? "tool";
}

function toolCallArgsOf(part) {
  return parseToolArguments(
    part?.arguments
      ?? part?.input
      ?? part?.function?.arguments
      ?? part?.functionCall?.args
      ?? part?.functionCall?.arguments
      ?? part?.function_call?.args
      ?? part?.function_call?.arguments,
  );
}

function toolCallText(name, args) {
  const serialized = typeof args === "string" ? args : JSON.stringify(args ?? {});
  return `[tool call: ${name}] ${serialized}`;
}

function toolResultText(part) {
  const name = toolCallNameOf(part);
  if (part?.functionResponse || part?.function_response) {
    const response = part.functionResponse?.response ?? part.function_response?.response;
    const content = response?.content ?? response ?? part?.content ?? part?.output ?? part?.result ?? part?.text;
    return `[tool result: ${name}] ${textFromContent(content)}`;
  }
  return `[tool result: ${name}] ${textFromContent(part?.content ?? part?.output ?? part?.result ?? part?.text)}`;
}

function messageContentValues(message) {
  const parts = [];
  if (Array.isArray(message?.content)) {
    parts.push(...message.content);
  } else if (Array.isArray(message?.parts)) {
    parts.push(...message.parts);
  } else if (message?.content != null && message.content !== "") {
    parts.push(message.content);
  } else if (message?.text != null && message.text !== "") {
    parts.push(message.text);
  }
  if (Array.isArray(message?.tool_calls)) {
    parts.push(...message.tool_calls.map((call) => ({
      type: "tool-call",
      id: call?.id,
      name: call?.function?.name ?? call?.name,
      arguments: call?.function?.arguments ?? call?.arguments,
      thoughtSignature: call?.thoughtSignature ?? call?.thought_signature,
      thought_signature: call?.thought_signature ?? call?.thoughtSignature,
    })));
  }
  return parts.length > 0 ? parts : (message != null ? [message] : []);
}

function collectSignedToolCallIds(messages) {
  const signed = new Set();
  for (const message of Array.isArray(messages) ? messages : []) {
    for (const part of messageContentValues(message)) {
      if (!isToolCallPart(part)) continue;
      const signature = thoughtSignatureForToolPart(part);
      if (!signature) continue;
      const id = toolCallIdOf(part);
      if (id) {
        rememberThoughtSignature(id, signature);
        signed.add(id);
      }
    }
  }
  return signed;
}

function emailFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const direct = firstString(value.email, value.userEmail, value.email_address, value.account?.email);
  if (direct) return direct;
  const idToken = firstString(value.id_token, value.idToken);
  if (idToken) {
    try {
      const payload = decodeJwtPayload(idToken);
      const fromClaims = firstString(payload?.email);
      if (fromClaims) return fromClaims;
    } catch {
      // A malformed id_token must not fail the whole token read.
    }
  }
  for (const child of Object.values(value)) {
    const email = emailFromObject(child, depth + 1);
    if (email) return email;
  }
  return null;
}

function tokenFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const direct = firstString(value.access_token, value.accessToken);
  if (direct) return direct;
  for (const child of Object.values(value)) {
    const token = tokenFromObject(child, depth + 1);
    if (token) return token;
  }
  return null;
}

function oauthRecordFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const token = firstString(value.access_token, value.accessToken);
  if (token) {
    const expiresAt = isoFromEpoch(
      value.expires_at
      ?? value.expiresAt
      ?? value.expiry_date
      ?? value.expiryDate
      ?? value.expiry,
    ) ?? addSecondsIso(value.expires_in ?? value.expiresIn);
    return {
      token,
      refreshToken: firstString(value.refresh_token, value.refreshToken),
      ...(expiresAt ? { expiresAt } : {}),
    };
  }
  for (const child of Object.values(value)) {
    const record = oauthRecordFromObject(child, depth + 1);
    if (record) return record;
  }
  return null;
}

function readOfficialTokenFile(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const record = oauthRecordFromObject(parsed);
    return record
      ? {
        ...record,
        kind: "oauth",
        email: emailFromObject(parsed),
      }
      : null;
  } catch {
    return null;
  }
}

/** Read only the OAuth token file from an explicitly selected profile. */
export function readAntigravityTokenFile({ env = process.env, home = homedir() } = {}) {
  return readOfficialTokenFile(
    env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE
      || join(home, ".gemini", "antigravity-cli", "antigravity-oauth-token"),
  );
}

/**
 * Decode the value written by agy's Go keyring adapter. Keep this parser
 * separate from the macOS lookup so the storage format can be covered without
 * touching a user's Keychain in tests.
 */
export function parseAntigravityKeychainValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const encoded = raw.startsWith(AGY_KEYCHAIN_VALUE_PREFIX)
    ? raw.slice(AGY_KEYCHAIN_VALUE_PREFIX.length)
    : null;
  const decoded = encoded
    ? Buffer.from(encoded, "base64").toString("utf8")
    : raw;
  try {
    const parsed = JSON.parse(decoded);
    const record = oauthRecordFromObject(parsed);
    return record
      ? {
        ...record,
        kind: "oauth",
        source: "antigravity_keychain",
        email: emailFromObject(parsed),
      }
      : null;
  } catch {
    return null;
  }
}

let cachedKeychainToken = null;
let lastKeychainReadTime = 0;
const KEYCHAIN_CACHE_TTL_MS = 60_000; // Cache Keychain result for 1 minute to avoid synchronous IPC lag

/** Read agy's current macOS Keychain session without displaying its secret. */
export function readAntigravityKeychainToken({ home = homedir() } = {}) {
  if (process.platform !== "darwin") return null;
  const now = Date.now();
  if (cachedKeychainToken && now - lastKeychainReadTime < KEYCHAIN_CACHE_TTL_MS) {
    return cachedKeychainToken;
  }
  try {
    const keychainPath = join(home, "Library", "Keychains", "login.keychain-db");
    const value = execFileSync(MACOS_SECURITY_BIN, [
      "find-generic-password",
      "-s",
      AGY_KEYCHAIN_SERVICE,
      "-a",
      AGY_KEYCHAIN_ACCOUNT,
      "-w",
      keychainPath,
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
      maxBuffer: 1_048_576,
    });
    const parsed = parseAntigravityKeychainValue(value);
    if (parsed) {
      cachedKeychainToken = parsed;
      lastKeychainReadTime = now;
    }
    return parsed;
  } catch {
    // A locked or unavailable Keychain must fall through to the official file
    // and eventually produce the normal "authorize again" diagnostic.
    return null;
  }
}

/** Resolve Antigravity's local OAuth token without spawning `agy -p`. */
export function resolveAntigravityAccessToken({ credential, env = process.env, home = homedir() } = {}) {
  const stored = firstString(credential?.access, credential?.token);
  if (stored) {
    return { token: stored, kind: "oauth", email: emailFromObject(credential) };
  }
  const fromCredentialObject = tokenFromObject(credential);
  if (fromCredentialObject) {
    return { token: fromCredentialObject, kind: "oauth", email: emailFromObject(credential) };
  }
  const fromEnv = firstString(env.DOCKYARD_ANTIGRAVITY_ACCESS_TOKEN, env.GEMINI_ACCESS_TOKEN);
  if (fromEnv) return { token: fromEnv, kind: "oauth" };
  // agy stores its rotated OAuth session in the user's login Keychain. Read
  // that fixed provider-owned item before falling back to the legacy file so a
  // fresh keyring token is not shadowed by an expired file copy. Explicit DSH
  // token paths remain isolated and never trigger a Keychain lookup.
  if (!env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE) {
    const fromKeychain = readAntigravityKeychainToken({ home });
    if (fromKeychain?.token) return fromKeychain;
  }
  return readAntigravityTokenFile({ env, home });
}

function projectIdFromLoadCodeAssist(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const key of ["cloudaicompanionProject", "cloudaicompanion_project", "projectId", "project_id", "project"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === "object") {
      const nested = firstString(candidate.id, candidate.projectId, candidate.project_id, candidate.name);
      if (nested) return nested.trim();
    }
  }
  for (const child of Object.values(value)) {
    const nested = projectIdFromLoadCodeAssist(child, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/** Resolve the Code Assist project for the selected OAuth session. */
export function createAntigravityProjectResolver({
  endpoint = process.env.DOCKYARD_ANTIGRAVITY_PROJECT_ENDPOINT || DEFAULT_PROJECT_ENDPOINT,
  env = process.env,
  home = homedir(),
  timeoutMs = 20_000,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  project = undefined,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent(),
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  const configuredProject = typeof project === "string" && project.trim() ? project.trim() : null;
  const cache = new Map();
  return async ({ credential = null, account = null, context = {} } = {}) => {
    if (configuredProject) return configuredProject;
    const cacheKey = account?.accountId ?? context.accountId ?? "default";
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const auth = await tokenResolver({
      credential,
      env: { ...env, ...(context.env ?? {}) },
      home,
    });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      accept: "application/json",
    };
    if (userAgent) headers["user-agent"] = userAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      signal: context.signal,
    }, { providerId: PROVIDER_ID, timeoutMs, fetchImpl });
    let raw;
    try {
      raw = typeof response.json === "function"
        ? await response.json()
        : JSON.parse(await response.text());
    } finally {
      cleanupNativeResponse(response);
    }
    const resolved = projectIdFromLoadCodeAssist(raw);
    if (!resolved) {
      throw nativeProviderError(PROVIDER_ID, "Antigravity did not return a Code Assist project for the selected account", { body: raw });
    }
    cache.set(cacheKey, resolved);
    return resolved;
  };
}

async function geminiParts(content, attachments, { signedToolCallIds = new Set(), requireThoughtSignatures = false } = {}) {
  const values = Array.isArray(content) ? content : [content];
  const parts = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) parts.push({ text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID, "image attachment could not be resolved");
      parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
      continue;
    }
    if (isToolResultPart(part)) {
      const callName = toolCallNameOf(part);
      const callId = toolCallIdOf(part);
      const keepFunctionResponse = !requireThoughtSignatures || Boolean(callId && signedToolCallIds.has(callId));
      if (keepFunctionResponse) {
        parts.push({
          functionResponse: {
            name: callName,
            response: {
              name: callName,
              content: textFromContent(part.content ?? part.output ?? part.result ?? part.text),
            },
          },
        });
      } else {
        parts.push({ text: toolResultText(part) });
      }
      continue;
    }
    if (isToolCallPart(part)) {
      const name = toolCallNameOf(part);
      const args = toolCallArgsOf(part);
      const signature = thoughtSignatureForToolPart(part);
      const callId = toolCallIdOf(part);
      if (signature) {
        if (callId) {
          rememberThoughtSignature(callId, signature);
          signedToolCallIds.add(callId);
        }
        parts.push({
          functionCall: {
            name,
            args,
          },
          thoughtSignature: signature,
          thought_signature: signature,
        });
      } else if (requireThoughtSignatures) {
        parts.push({ text: toolCallText(name, args) });
      } else {
        parts.push({ functionCall: { name, args } });
      }
      continue;
    }
    const extracted = textFromContent(part);
    if (extracted) parts.push({ text: extracted });
  }
  return parts;
}

function modelRequiresThoughtSignatures(model) {
  const id = String(model ?? "").toLowerCase();
  if (id === "gemini-2.5-flash") return false;
  return true;
}

const DEFAULT_SLIDING_WINDOW_MESSAGES = 40;
const SLIDING_WINDOW_QUANTUM = 20;

function resolveMaxMessages(request) {
  const envLimit = Number.parseInt(process.env.DOCKYARD_ANTIGRAVITY_MAX_MESSAGES ?? "", 10);
  if (Number.isSafeInteger(envLimit) && envLimit > 0) return envLimit;
  if (Number.isSafeInteger(request?.maxMessages) && request.maxMessages > 0) return request.maxMessages;
  const contextWindow = request?.modelContext?.contextWindow;
  if (Number.isSafeInteger(contextWindow) && contextWindow >= 500_000) {
    return 500;
  }
  return DEFAULT_SLIDING_WINDOW_MESSAGES;
}

function compactMessagesForContext(messages, { maxMessages = DEFAULT_SLIDING_WINDOW_MESSAGES, quantum = SLIDING_WINDOW_QUANTUM } = {}) {
  if (!Array.isArray(messages) || messages.length <= maxMessages) return messages;

  const initialIndex = messages.findIndex((m) => m?.role === "user" || m?.role === "system");
  const prefix = initialIndex >= 0 ? [messages[initialIndex]] : [];

  // Quantize the window count so the cut position does not advance on every turn.
  // Stepping in blocks of `quantum` messages freezes the prefix across turns,
  // keeping Gemini prefix cache hit rate above 90%+.
  const rawWindowCount = Math.max(10, maxMessages - prefix.length - 1);
  const excess = messages.length - maxMessages;
  const quantOffset = excess > 0 ? Math.floor(excess / quantum) * quantum : 0;
  const windowCount = Math.max(10, rawWindowCount + (excess - quantOffset));
  const recent = messages.slice(-windowCount);

  const startIndex = messages.length - windowCount;
  if (startIndex > 0) {
    const firstRecent = recent[0];
    const isToolResult = firstRecent?.role === "tool"
      || (Array.isArray(firstRecent?.content) && firstRecent.content.some(isToolResultPart));
    if (isToolResult && messages[startIndex - 1]) {
      recent.unshift(messages[startIndex - 1]);
    }
  }

  const compactedCount = messages.length - prefix.length - recent.length;
  if (compactedCount <= 0) return messages;

  // IMPORTANT FOR GEMINI PROMPT CACHE:
  // The milestone text MUST be static. Dynamic variables (e.g. message count)
  // in Message 1 break prefix matching for all subsequent tokens.
  const milestone = {
    role: "user",
    content: "[System Note: Context sliding window active. Intermediate messages were compacted to maintain low latency and prevent token exhaustion. Initial requirements and recent active turns are preserved.]",
  };

  return [...prefix, milestone, ...recent];
}

function sanitizeContentsForThoughtSignatures(contents, requireThoughtSignatures) {
  if (!requireThoughtSignatures || !Array.isArray(contents)) return contents;

  // Identify unsigned function calls
  const unsignedCallNames = new Set();
  for (const content of contents) {
    for (const part of content?.parts ?? []) {
      const rawCall = part?.functionCall ?? part?.function_call;
      if (rawCall && !thoughtSignatureFrom(part)) {
        unsignedCallNames.add(rawCall.name);
      }
    }
  }

  if (unsignedCallNames.size === 0) {
    return contents.map((content) => ({
      ...content,
      parts: (content?.parts ?? []).map((part) => {
        const rawCall = part?.functionCall ?? part?.function_call;
        if (rawCall) {
          const signature = thoughtSignatureFrom(part);
          const {
            thoughtSignature: _ignoredTs1,
            thought_signature: _ignoredTs2,
            ...cleanedCall
          } = rawCall;
          const callKey = part.functionCall ? "functionCall" : "function_call";
          if (signature) {
            return {
              ...part,
              thoughtSignature: signature,
              thought_signature: signature,
              [callKey]: cleanedCall,
            };
          }
          return {
            ...part,
            [callKey]: cleanedCall,
          };
        }
        return part;
      }),
    }));
  }

  // Surgical sanitization: convert only the unsigned calls and their matching responses to text,
  // keeping previously signed calls native with signatures to preserve prefix cache continuity.
  return contents.map((content) => ({
    ...content,
    parts: (content?.parts ?? []).map((part) => {
      const rawCall = part?.functionCall ?? part?.function_call;
      if (rawCall) {
        const signature = thoughtSignatureFrom(part);
        if (!signature) {
          return { text: toolCallText(rawCall.name, rawCall.args ?? rawCall.arguments) };
        }
        const {
          thoughtSignature: _ignoredTs1,
          thought_signature: _ignoredTs2,
          ...cleanedCall
        } = rawCall;
        const callKey = part.functionCall ? "functionCall" : "function_call";
        return {
          ...part,
          thoughtSignature: signature,
          thought_signature: signature,
          [callKey]: cleanedCall,
        };
      }
      const resp = part?.functionResponse ?? part?.function_response;
      if (resp) {
        const name = resp.name ?? "tool";
        if (unsignedCallNames.has(name)) {
          const result = resp.response?.content ?? resp.response ?? "";
          return { text: `[tool result: ${name}] ${typeof result === "string" ? result : JSON.stringify(result)}` };
        }
      }
      return part;
    }),
  }));
}

async function buildGeminiContents(request, attachments) {
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  const maxMessages = resolveMaxMessages(request);
  const messages = compactMessagesForContext(rawMessages, { maxMessages });
  const signedToolCallIds = collectSignedToolCallIds(messages);
  const requireThoughtSignatures = modelRequiresThoughtSignatures(request.model);
  const contents = [];
  for (const message of messages) {
    const parts = await geminiParts(messageContentValues(message), attachments, {
      signedToolCallIds,
      requireThoughtSignatures,
    });
    if (parts.length === 0) continue;
    contents.push({
      role: message?.role === "assistant" ? "model" : "user",
      parts,
    });
  }
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Continue the conversation." }] });
  return sanitizeContentsForThoughtSignatures(contents, requireThoughtSignatures);
}

function sanitizeSchema(value) {
  if (Array.isArray(value)) return value.map(sanitizeSchema);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (["$schema", "additionalProperties", "strict"].includes(key)) continue;
    result[key] = sanitizeSchema(child);
  }
  return result;
}

function buildGeminiTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const declarations = tools.map((tool) => ({
    name: tool?.name ?? tool?.function?.name ?? "tool",
    ...(tool?.description ? { description: String(tool.description) } : {}),
    parameters: sanitizeSchema(tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }),
  }));
  declarations.sort((a, b) => a.name.localeCompare(b.name));
  return declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;
}

export function resolveAntigravityThinkingConfig(request = {}) {
  if (request.thinkingConfig && typeof request.thinkingConfig === "object") {
    return {
      includeThoughts: true,
      ...request.thinkingConfig,
    };
  }

  const effort = String(
    request.reasoningEffort
      ?? request.reasoning_effort
      ?? (typeof request.thinking === "string" ? request.thinking : null)
      ?? ""
  ).toLowerCase().trim();

  if (request.purpose === "compaction" || effort === "none" || effort === "off" || request.thinking === false) {
    return {
      includeThoughts: false,
      thinkingBudget: 0,
    };
  }

  if (effort === "low") {
    return {
      includeThoughts: true,
      thinkingBudget: 1024,
    };
  }

  if (effort === "medium") {
    return {
      includeThoughts: true,
      thinkingBudget: 8192,
    };
  }

  if (effort === "high") {
    return {
      includeThoughts: true,
      thinkingBudget: -1,
    };
  }

  if (Number.isInteger(request.thinkingBudget)) {
    return {
      includeThoughts: request.thinkingBudget > 0,
      thinkingBudget: request.thinkingBudget,
    };
  }

  const modelName = String(request.model ?? "").toLowerCase();
  if (modelName.endsWith("-low")) {
    return {
      includeThoughts: true,
      thinkingBudget: 1024,
    };
  }
  if (modelName.endsWith("-medium")) {
    return {
      includeThoughts: true,
      thinkingBudget: 8192,
    };
  }
  if (modelName.endsWith("-high")) {
    return {
      includeThoughts: true,
      thinkingBudget: -1,
    };
  }

  return {
    includeThoughts: true,
  };
}

export async function buildAntigravityRequest(request = {}, context = {}) {
  const nativeRequest = {
    contents: await buildGeminiContents(request, context.attachments),
  };
  const tools = buildGeminiTools(request.tools);
  if (tools) {
    nativeRequest.tools = tools;
    const toolRule = "IMPORTANT: You MUST invoke tools using native function calls. NEVER output '[tool call: ...]' or pseudo-code text.";
    const existingSystem = typeof request.system === "string" && request.system.length > 0 ? `${request.system}\n\n` : "";
    nativeRequest.systemInstruction = { parts: [{ text: `${existingSystem}${toolRule}` }] };
  } else if (typeof request.system === "string" && request.system.length > 0) {
    nativeRequest.systemInstruction = { parts: [{ text: request.system }] };
  }
  nativeRequest.generationConfig = {
    temperature: request.temperature ?? 0.7,
    maxOutputTokens: Number.isInteger(request.maxTokens) && request.maxTokens > 0
      ? request.maxTokens
      : (Number.isInteger(request.modelContext?.maxTokens) && request.modelContext.maxTokens > 0
        ? request.modelContext.maxTokens
        : 65536),
    ...(Array.isArray(request.responseModalities)
      ? { responseModalities: request.responseModalities }
      : request.modalities
        ? { responseModalities: request.modalities }
        : {}),
  };
  const thinkingConfig = resolveAntigravityThinkingConfig(request);
  if (thinkingConfig) {
    nativeRequest.generationConfig.thinkingConfig = thinkingConfig;
  }
  return nativeRequest;
}

function responsePayload(value) {
  if (!value || typeof value !== "object") return null;
  return value.response && typeof value.response === "object" ? value.response : value;
}

/**
 * Google error frames classify failures with gRPC status strings instead of
 * numeric HTTP codes. Normalize the string form so the same account-pool
 * markers used by nativeProviderError can be applied to open SSE streams.
 */
function googleErrorStatusText(error) {
  const raw = firstString(
    typeof error?.status === "string" ? error.status : null,
    typeof error?.code === "string" ? error.code : null,
  );
  return String(raw ?? "").trim().toUpperCase();
}

function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "png";
}

function saveInlineImageToArtifacts(inlineData, workingDir = process.cwd()) {
  try {
    const mediaType = inlineData?.mimeType ?? inlineData?.mediaType ?? "image/png";
    const base64Data = inlineData?.data;
    if (!base64Data || typeof base64Data !== "string") return null;
    const ext = extensionFromMimeType(mediaType);
    const artifactsDir = join(workingDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    const filename = `imagen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join(artifactsDir, filename);
    writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    return `/artifacts/${filename}`;
  } catch {
    return null;
  }
}

function parseTextToolCall(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:^|\n)\s*\[(?:tool call|Tool Call):\s*([a-zA-Z0-9_.:-]+)\]\s*([\s\S]*)$/i);
  if (!match) return null;
  const leadingText = value.slice(0, match.index).trim();
  let name = match[1];
  if (name.startsWith("default_api:")) {
    name = name.slice("default_api:".length);
  }
  if (name === "run_command") {
    name = "bash";
  }
  let argumentsValue = match[2].trim();
  if (argumentsValue.startsWith("{") && argumentsValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(argumentsValue);
      if (name === "bash" && !parsed.command && parsed.CommandLine) {
        parsed.command = parsed.CommandLine;
      }
      argumentsValue = JSON.stringify(parsed);
    } catch {
      argumentsValue = JSON.stringify({ input: argumentsValue });
    }
  } else if (argumentsValue) {
    argumentsValue = JSON.stringify({ input: argumentsValue });
  } else {
    argumentsValue = "{}";
  }
  return { name, argumentsValue, leadingText };
}

function isPotentialTextToolCall(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[")) {
    const prefix = "[tool call:";
    const lower = trimmed.toLowerCase();
    if (prefix.startsWith(lower) || lower.startsWith(prefix)) return true;
  }
  return /\[(?:tool call|Tool Call):/i.test(text);
}

async function* streamAntigravityResponse(response, context) {
  let text = "";
  let textIndex = 0;
  let textOpen = false;
  let textStarted = false;
  let textBuffered = false;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  let pendingThoughtSignature = null;

  for await (const event of readSseEvents(response)) {
    const payload = responsePayload(event.data);
    if (!payload) continue;
    if (payload.error) {
      const upstreamError = payload.error;
      const error = nativeProviderError(PROVIDER_ID, upstreamError.message ?? "Antigravity returned an error", {
        status: upstreamError.code,
        body: upstreamError,
      });
      const statusText = googleErrorStatusText(upstreamError);
      if (statusText === "UNAUTHENTICATED" || statusText === "NOTAUTHENTICATED") {
        error.authExpired = true;
      } else if (statusText === "PERMISSION_DENIED") {
        error.authForbidden = true;
      } else if (statusText === "RESOURCE_EXHAUSTED") {
        error.quotaExhausted = true;
        error.rateLimited = true;
      }
      throw error;
    }
    usage = normalizeUsage(payload.usageMetadata ?? payload.usage) ?? usage;
    const candidate = payload.candidates?.[0] ?? payload.candidate ?? payload;
    stop = candidate.finishReason ?? stop;
    for (const part of candidate.content?.parts ?? candidate.parts ?? []) {
      if (part?.text) {
        if (part.thought === true || part.thoughtSignature || part.thought_signature) {
          const thoughtPartSignature = thoughtSignatureFrom(part);
          if (thoughtPartSignature) pendingThoughtSignature = thoughtPartSignature;
          if (textOpen) {
            if (textBuffered) {
              yield { type: "block-start", index: textIndex, blockType: "text" };
              yield { type: "text-delta", index: textIndex, text };
              textBuffered = false;
            }
            yield { type: "block-end", index: textIndex, block: { type: "text", text } };
            textOpen = false;
          }
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          reasoning.text += part.text;
          yield { type: "reasoning-delta", index: reasoning.index, text: part.text };
          continue;
        }
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text = "";
          textOpen = true;
          textStarted = false;
          textBuffered = false;
        }
        text += part.text;
        if (!textStarted && isPotentialTextToolCall(text)) {
          textBuffered = true;
        } else {
          if (!textStarted) {
            yield { type: "block-start", index: textIndex, blockType: "text" };
            textStarted = true;
            textBuffered = false;
            yield { type: "text-delta", index: textIndex, text };
          } else {
            yield { type: "text-delta", index: textIndex, text: part.text };
          }
        }
        continue;
      }
      const inlineData = part?.inlineData ?? part?.inline_data;
      if (inlineData?.data) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text = "";
          textOpen = true;
          textStarted = true;
          textBuffered = false;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        } else if (textBuffered) {
          yield { type: "block-start", index: textIndex, blockType: "text" };
          yield { type: "text-delta", index: textIndex, text };
          textStarted = true;
          textBuffered = false;
        }
        const savedPath = saveInlineImageToArtifacts(inlineData, context?.cwd ?? process.cwd());
        const mediaType = inlineData?.mimeType ?? inlineData?.mediaType ?? "image/png";
        const imageMarkdown = savedPath
          ? `\n\n![Generated Image](${savedPath})\n\n*(Image saved to \`${savedPath}\`)*\n\n`
          : `\n\n![Generated Image](data:${mediaType};base64,${inlineData.data})\n\n`;
        text += imageMarkdown;
        yield { type: "text-delta", index: textIndex, text: imageMarkdown };
        continue;
      }
      const partSignature = thoughtSignatureFrom(part);
      if (partSignature) pendingThoughtSignature = partSignature;
      const call = part?.functionCall ?? part?.function_call;
      if (!call) continue;
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (textOpen) {
        const textTool = parseTextToolCall(text);
        if (textTool) {
          if (!textStarted) {
            if (textTool.leadingText) {
              yield { type: "block-start", index: textIndex, blockType: "text" };
              yield { type: "text-delta", index: textIndex, text: textTool.leadingText };
              yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText } };
            }
          } else {
            yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText || text } };
          }
          const toolIndex = nextIndex++;
          const toolId = firstString(textTool.name, `tool-${toolIndex}`);
          const toolBlock = { type: "tool-call", id: toolId, name: textTool.name, arguments: textTool.argumentsValue };
          yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
          yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: textTool.name, argumentsDelta: textTool.argumentsValue };
          yield { type: "block-end", index: toolIndex, block: toolBlock };
        } else {
          if (textBuffered) {
            yield { type: "block-start", index: textIndex, blockType: "text" };
            yield { type: "text-delta", index: textIndex, text };
          }
          yield { type: "block-end", index: textIndex, block: { type: "text", text } };
        }
        textOpen = false;
        textStarted = false;
        textBuffered = false;
      }
      const index = nextIndex++;
      const name = firstString(call.name, "tool");
      const id = firstString(call.id, `${name}-${index}`);
      const argumentsValue = JSON.stringify(call.args ?? call.arguments ?? {});
      const thoughtSignature = thoughtSignatureFrom(part) ?? thoughtSignatureFrom(call) ?? pendingThoughtSignature;
      pendingThoughtSignature = null;
      if (thoughtSignature) rememberThoughtSignature(id, thoughtSignature);
      const block = { type: "tool-call", id, name, arguments: argumentsValue };
      if (thoughtSignature) {
        block.thoughtSignature = thoughtSignature;
        block.thought_signature = thoughtSignature;
      }
      yield { type: "block-start", index, blockType: "tool-call" };
      yield { type: "tool-call-delta", index, id, name, argumentsDelta: argumentsValue };
      yield { type: "block-end", index, block };
      stop = "tool_calls";
    }
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) {
    const textTool = parseTextToolCall(text);
    if (textTool) {
      if (!textStarted) {
        if (textTool.leadingText) {
          yield { type: "block-start", index: textIndex, blockType: "text" };
          yield { type: "text-delta", index: textIndex, text: textTool.leadingText };
          yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText } };
        }
      } else {
        yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText || text } };
      }
      const toolIndex = nextIndex++;
      const toolId = firstString(textTool.name, `tool-${toolIndex}`);
      const toolBlock = { type: "tool-call", id: toolId, name: textTool.name, arguments: textTool.argumentsValue };
      yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
      yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: textTool.name, argumentsDelta: textTool.argumentsValue };
      yield { type: "block-end", index: toolIndex, block: toolBlock };
      stop = "tool_calls";
    } else {
      if (textBuffered) {
        yield { type: "block-start", index: textIndex, blockType: "text" };
        yield { type: "text-delta", index: textIndex, text };
      }
      yield { type: "block-end", index: textIndex, block: { type: "text", text } };
    }
  } else if (stop !== "tool_calls") {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "block-end", index: 0, block: { type: "text", text: "" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}

export function createAntigravityNativeExecutor({
  endpoint = process.env.DOCKYARD_ANTIGRAVITY_ENDPOINT || DEFAULT_ENDPOINT,
  // Never fabricate an upstream project: when neither configuration nor a
  // resolver yields the account's Code Assist project, the request fails with
  // a clear diagnostic instead of sending a guessed envelope value.
  project = process.env.DOCKYARD_ANTIGRAVITY_PROJECT || null,
  env = process.env,
  timeoutMs = 300_000,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  projectResolver = null,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent(),
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    if (context.secretStore) {
      const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
      if (ref) credential = await context.secretStore.read(ref);
    }
    
    // Resolve auth token, code assist project, and request body concurrently to eliminate waterfall latency
    const authPromise = tokenResolver({ credential, env: { ...env, ...(context.env ?? {}) }, home: homedir() });
    const projectPromise = typeof projectResolver === "function"
      ? projectResolver({ credential, account: invocation?.account, context })
      : Promise.resolve(project);
    const nativeRequestPromise = buildAntigravityRequest(request, context);

    const [auth, resolvedProject, nativeRequest] = await Promise.all([
      authPromise,
      projectPromise,
      nativeRequestPromise,
    ]);

    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    if (!resolvedProject) {
      // Explicit degraded path: no fabricated project is ever sent upstream.
      const error = nativeProviderError(
        PROVIDER_ID,
        "Antigravity Code Assist project is unavailable for the selected account; "
          + "set DOCKYARD_ANTIGRAVITY_PROJECT or reauthorize so loadCodeAssist can resolve it",
      );
      error.degraded = true;
      throw error;
    }
    const body = {
      project: resolvedProject,
      model: request.model,
      request: nativeRequest,
    };
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
    };
    const resolvedUserAgent = userAgent ?? context.env?.DOCKYARD_ANTIGRAVITY_USER_AGENT ?? detectAntigravityUserAgent();
    if (resolvedUserAgent) headers["user-agent"] = resolvedUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: context.signal,
    }, { providerId: PROVIDER_ID, timeoutMs, fetchImpl });
    return streamAntigravityResponse(response, context);
  };
  executor.nativeTransport = "gemini-stream-generate-content";
  return executor;
}

/**
 * Read the same first-party quota summary used by `agy /quota`, without
 * starting a new CLI process. The response is intentionally returned raw;
 * the provider driver owns the live quota schema and can keep it dynamic.
 */
export function createAntigravityNativeQuotaReader({
  endpoint = process.env.DOCKYARD_ANTIGRAVITY_QUOTA_ENDPOINT || DEFAULT_QUOTA_ENDPOINT,
  env = process.env,
  home = homedir(),
  timeoutMs = 20_000,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  project = env.DOCKYARD_ANTIGRAVITY_PROJECT,
  projectResolver = null,
  userAgent = env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent(),
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  return async ({ credential = null, account = null, context = {} } = {}) => {
    const auth = await tokenResolver({
      credential,
      env: { ...env, ...(context.env ?? {}) },
      home,
    });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    const resolvedProject = typeof projectResolver === "function"
      ? await projectResolver({ credential, account, context })
      : project;
    const body = resolvedProject ? { project: resolvedProject } : {};
    const resolvedUserAgent = userAgent ?? context.env?.DOCKYARD_ANTIGRAVITY_USER_AGENT ?? detectAntigravityUserAgent();
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      accept: "application/json",
    };
    if (resolvedUserAgent) headers["user-agent"] = resolvedUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: context.signal,
    }, { providerId: PROVIDER_ID, timeoutMs, fetchImpl });
    let raw;
    try {
      raw = typeof response.json === "function"
        ? await response.json()
        : JSON.parse(await response.text());
    } finally {
      cleanupNativeResponse(response);
    }
    if (!raw || typeof raw !== "object") {
      throw nativeProviderError(PROVIDER_ID, "quota summary response was not an object");
    }
    return raw;
  };
}

export const antigravityNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID,
  endpoint: DEFAULT_ENDPOINT,
  quotaEndpoint: DEFAULT_QUOTA_ENDPOINT,
});
