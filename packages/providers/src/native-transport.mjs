/**
 * Small provider-neutral helpers for native streaming transports.
 *
 * The provider modules still own request/response translation. This file only
 * handles the boring wire concerns that are shared by SSE based APIs:
 * bounded fetches, SSE framing, usage normalization, and safe provider
 * errors. Keeping this separate makes it possible to test each adapter with a
 * fake fetch implementation without starting a provider CLI.
 */

function numericStatus(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/**
 * Validate an endpoint before an OAuth/API credential is attached to it.
 * Provider integrations may opt into a custom HTTPS origin, but plaintext
 * HTTP is only safe for an explicitly local development service.
 */
export function validateNativeEndpoint(value, { providerId = "provider" } = {}) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${providerId} endpoint is required`);
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${providerId} endpoint is invalid`);
  }
  if (url.username || url.password) {
    throw new Error(`${providerId} endpoint must not include embedded credentials`);
  }
  if (url.hash) {
    throw new Error(`${providerId} endpoint must not include a URL fragment`);
  }
  const localHttp = url.protocol === "http:" && isLoopbackHostname(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error(`${providerId} endpoint must use HTTPS; HTTP is only allowed for loopback development`);
  }
  return url.toString();
}

function diagnosticText(value) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function errorDetails(value) {
  if (value === undefined || value === null) return {};
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text) return {};
    try {
      return errorDetails(JSON.parse(value));
    } catch {
      return { message: text };
    }
  }
  if (typeof value !== "object") return { message: String(value) };

  const nested = value.error;
  const nestedObject = nested && typeof nested === "object" ? nested : null;
  const message = [
    nestedObject?.message,
    typeof nested === "string" ? nested : null,
    value.message,
    nestedObject?.status,
    value.status,
  ].find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
  const code = [
    nestedObject?.code,
    value.code,
    nestedObject?.status,
    value.status,
  ].find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
  const status = [nestedObject?.status, value.status]
    .find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
  return {
    ...(message ? { message: String(message).replace(/\s+/g, " ").trim().slice(0, 500) } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function boundedErrorBody(value, limit = 4096) {
  if (typeof value === "string") return value.slice(0, limit);
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= limit ? value : `${serialized.slice(0, limit)}…`;
  } catch {
    return String(value ?? "").slice(0, limit);
  }
}

function isAuthenticationFailure(message, body, { status = null, code = null } = {}) {
  const text = `${diagnosticText(message)} ${diagnosticText(body)}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  // Provider APIs also use the word "token" for input-token budgets. Those
  // validation failures must never eject an otherwise valid account.
  if (/\b(?:token|tokens)\s+(?:count|limit|length|budget)\b|\b(?:max|input|output)_?tokens?\b/.test(text)) return false;
  const normalizedCode = String(code ?? body?.error?.code ?? body?.code ?? "").toLowerCase();
  if (/invalid[_ -]?grant|invalid[_ -]?token|token[_ -]?expired|unauthorized|authentication[_ -]?failed/.test(normalizedCode)) return true;
  if (Number(status) === 401) return true;
  if (Number(status) === 403 && /(?:access token|oauth|credential|api key|authentication|unauthorized)/.test(text)) return true;
  return [
    /access token.{0,80}(?:could not be validated|invalid|expired|revok|not valid|unauthor)/,
    /(?:invalid|expired|revok|unauthor|not valid).{0,80}(?:access token|oauth token|refresh token|credential|api key)/,
    /\b(?:unauthorized|authentication failed|login required)\b/,
    /\b(?:credentials?|api keys?)\b.{0,50}\b(?:invalid|expired|missing|unavailable|not valid)\b/,
  ].some((pattern) => pattern.test(text));
}

export function nativeProviderError(providerId, message, { status, body, code } = {}) {
  const bodyDetails = errorDetails(body);
  const messageDetails = errorDetails(message);
  const resolvedMessage = messageDetails.message ?? bodyDetails.message ?? (message ? String(message) : null);
  const resolvedCode = code ?? messageDetails.code ?? bodyDetails.code;
  const upstreamStatus = messageDetails.status ?? bodyDetails.status;
  const statusCode = numericStatus(status);
  const codeText = String(upstreamStatus ?? resolvedCode ?? "").toUpperCase();
  const exhaustionText = `${resolvedMessage ?? ""} ${diagnosticText(body)} ${diagnosticText(upstreamStatus)} ${diagnosticText(resolvedCode)}`
    .toLowerCase();
  const quotaExhausted = codeText === "RESOURCE_EXHAUSTED"
    || /\bresources?\b[\s\S]{0,80}\bexhausted\b/.test(exhaustionText)
    || /\bquota\b[\s\S]{0,80}\b(?:exhausted|depleted|exceeded)\b/.test(exhaustionText)
    || /\bcapacity\b[\s\S]{0,80}\bexhausted\b/.test(exhaustionText);
  const rateLimited = statusCode === 429
    || numericStatus(resolvedCode) === 429
    || numericStatus(upstreamStatus) === 429
    || codeText === "RESOURCE_EXHAUSTED"
    || codeText === "RATE_LIMITED"
    || quotaExhausted;
  const displayMessage = quotaExhausted
    ? "额度或上游资源已耗尽，请刷新额度、切换账号或稍后重试"
    : rateLimited
      ? "请求频率受限，请切换账号或稍后重试"
    : resolvedMessage;
  const error = new Error(`${providerId ?? "provider"} native request failed${displayMessage ? `: ${displayMessage}` : ""}`);
  error.providerId = providerId ?? null;
  if (status !== undefined && status !== null) error.status = status;
  if (resolvedCode !== undefined && resolvedCode !== null) {
    error.code = resolvedCode;
    error.upstreamCode = resolvedCode;
  }
  if (resolvedMessage) error.upstreamMessage = resolvedMessage;
  if (upstreamStatus !== undefined && upstreamStatus !== null) error.upstreamStatus = upstreamStatus;
  // Providers do not agree on where to put auth failures: some return HTTP
  // 401, while others return HTTP 403 or a JSON code such as "unauthorized"
  // with a human message. An explicit token validation failure is an unusable
  // OAuth credential, so the account pool must stop selecting it.
  error.authExpired = isAuthenticationFailure(resolvedMessage, body, {
    status: statusCode,
    code: resolvedCode ?? upstreamStatus,
  });
  error.authForbidden = !error.authExpired && statusCode === 403;
  error.quotaExhausted = quotaExhausted;
  error.rateLimited = rateLimited;
  if (body !== undefined) error.body = boundedErrorBody(body);
  return error;
}

const nativeResponseControls = new WeakMap();
const MAX_SSE_EVENT_BYTES = 4 * 1024 * 1024;
const MAX_ERROR_BODY_BYTES = 64 * 1024;

async function readBoundedResponseText(response, limit = MAX_ERROR_BODY_BYTES) {
  const reader = response?.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let text = "";
    let total = 0;
    try {
      while (total < limit) {
        const next = await reader.read();
        if (next.done) break;
        const bytes = next.value instanceof Uint8Array ? next.value : Uint8Array.from(next.value ?? []);
        const accepted = bytes.slice(0, limit - total);
        total += accepted.byteLength;
        text += decoder.decode(accepted, { stream: total < limit });
        if (accepted.byteLength < bytes.byteLength) {
          await reader.cancel?.();
          break;
        }
      }
      return `${text}${decoder.decode()}`;
    } finally {
      reader.releaseLock?.();
    }
  }
  if (response?.body && typeof response.body[Symbol.asyncIterator] === "function") {
    const decoder = new TextDecoder();
    let text = "";
    let total = 0;
    for await (const chunk of response.body) {
      const bytes = chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk ?? []);
      const accepted = bytes.slice(0, limit - total);
      total += accepted.byteLength;
      text += decoder.decode(accepted, { stream: total < limit });
      if (accepted.byteLength < bytes.byteLength) break;
    }
    return `${text}${decoder.decode()}`;
  }
  const raw = typeof response?.text === "function" ? await response.text() : "";
  return String(raw ?? "").slice(0, limit);
}

export async function fetchNativeResponse(url, init = {}, {
  providerId,
  timeoutMs = 300_000,
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  let cleaned = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const upstreamSignal = init.signal;
  const abort = () => controller.abort(upstreamSignal?.reason);
  const timeoutError = nativeProviderError(providerId, "request timed out");
  timeoutError.code = "ETIMEDOUT";
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", abort);
  };
  const control = { providerId, cleanup, get timedOut() { return timedOut; }, timeoutError };
  let handedOff = false;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) abort();
    else upstreamSignal.addEventListener("abort", abort, { once: true });
  }
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (response.ok === false || (response.status !== undefined && response.status >= 400)) {
      let body = null;
      try {
        body = await readBoundedResponseText(response);
      } catch {
        // Preserve the HTTP status when a mock or a broken upstream has no
        // readable error body.
      }
      const details = errorDetails(body);
      throw nativeProviderError(providerId, details.message, {
        status: response.status,
        body,
        code: details.code,
      });
    }
    nativeResponseControls.set(response, control);
    handedOff = true;
    return response;
  } catch (error) {
    if (error?.name === "AbortError" && timedOut && !error.providerId) {
      throw timeoutError;
    }
    throw error;
  } finally {
    if (!handedOff) cleanup();
  }
}

export function cleanupNativeResponse(response) {
  const control = nativeResponseControls.get(response);
  control?.cleanup();
  nativeResponseControls.delete(response);
}

async function* responseChunks(response) {
  const body = response?.body;
  if (!body) return;
  if (typeof body[Symbol.asyncIterator] === "function") {
    try {
      for await (const chunk of body) yield chunk;
    } finally {
      // When the consumer breaks or throws, the generator is resumed with a
      // return at this suspension point and the finally runs. Actively cancel
      // so the underlying connection stops downloading instead of draining.
      try {
        await body.cancel?.();
      } catch {
        // The stream may already be torn down; nothing left to release.
      }
    }
    return;
  }
  const reader = body.getReader?.();
  if (!reader) return;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    // Cancel on every exit path: after a normal DONE it merely confirms the
    // stream is closed; after an early break/throw it interrupts the
    // underlying connection instead of leaving it downloading in background.
    try {
      await reader.cancel?.();
    } catch {
      // The stream may already be closed; mocks without cancel() are skipped.
    }
    reader.releaseLock?.();
  }
}

function parseSseEvent(lines) {
  let event = "message";
  const data = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  const raw = data.join("\n");
  if (raw.trim() === "[DONE]") return { event, data: null, done: true };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    // Corrupted payloads must surface as protocol errors; degrading them to
    // plain strings silently drops provider events.
    return { event, data: raw, raw, parseError: error };
  }
  return { event, data: parsed, raw };
}

/** Build a stable protocol error for an SSE payload that is not valid JSON. */
function sseProtocolError(providerId, event, raw, cause) {
  const snippet = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const error = new Error(
    `${providerId ?? "provider"} SSE data payload is not valid JSON`
      + `${event ? ` (event: ${event})` : ""}${snippet ? `: ${snippet}` : ""}`
      + `${cause?.message ? ` [${cause.message}]` : ""}`,
  );
  error.code = "SSE_PROTOCOL_ERROR";
  error.providerId = providerId ?? null;
  if (event) error.sseEvent = event;
  if (cause !== undefined) error.cause = cause;
  return error;
}

/**
 * Yield parsed Server-Sent Events from a fetch Response.
 *
 * Framing scans incrementally for CR, LF, and CRLF line terminators, so a
 * single large network chunk containing many small events is never mistaken
 * for one oversized event: the byte budget only accumulates for the event
 * that is still buffered and resets at every event boundary.
 */
export async function* readSseEvents(response) {
  const control = nativeResponseControls.get(response);
  const decoder = new TextDecoder();
  let pendingLine = "";
  let lines = [];
  // Bytes buffered for the not-yet-dispatched SSE event (complete lines,
  // their separators, and the partial trailing line).
  let eventBytes = 0;
  // Set when the previous chunk ended with CR; a leading LF in the next
  // chunk belongs to that CRLF pair instead of an empty line.
  let trailingCarriageReturn = false;
  const oversizeError = () => nativeProviderError(
    control?.providerId,
    "SSE event exceeded the maximum allowed size",
  );
  const scanChunk = (rawText) => {
    let text = rawText;
    if (trailingCarriageReturn) {
      trailingCarriageReturn = false;
      if (text.startsWith("\n")) text = text.slice(1);
    }
    const completeLines = [];
    eventBytes -= pendingLine.length;
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character !== "\n" && character !== "\r") continue;
      let end = index;
      if (character === "\r") {
        if (text[index + 1] === "\n") index += 1; // CRLF is one terminator.
        else trailingCarriageReturn = true; // A lone CR may pair with an LF in the next chunk.
      }
      completeLines.push(pendingLine + text.slice(start, end));
      pendingLine = "";
      start = index + 1;
    }
    pendingLine += text.slice(start);
    eventBytes += pendingLine.length;
    return completeLines;
  };
  const drainLines = (completeLines, { final = false } = {}) => {
    const events = [];
    const ingest = (line) => {
      if (line !== "") {
        eventBytes += line.length + (lines.length > 0 ? 1 : 0);
        lines.push(line);
        if (eventBytes > MAX_SSE_EVENT_BYTES) throw oversizeError();
        return;
      }
      const parsed = parseSseEvent(lines);
      lines = [];
      eventBytes = pendingLine.length;
      if (!parsed) return;
      if (parsed.parseError) {
        throw sseProtocolError(control?.providerId, parsed.event, parsed.raw, parsed.parseError);
      }
      events.push(parsed);
    };
    for (const line of completeLines) ingest(line);
    if (final && pendingLine) {
      const line = pendingLine;
      pendingLine = "";
      eventBytes = 0;
      ingest(line);
    }
    return events;
  };
  try {
    for await (const chunk of responseChunks(response)) {
      const batch = drainLines(scanChunk(decoder.decode(chunk, { stream: true })));
      for (const parsed of batch) {
        yield parsed;
        if (parsed.done) return;
      }
    }
    const finalBatch = drainLines(scanChunk(decoder.decode()), { final: true });
    for (const parsed of finalBatch) {
      yield parsed;
      if (parsed.done) return;
    }
  } catch (error) {
    if (control?.timedOut && !error?.providerId) throw control.timeoutError;
    throw error;
  } finally {
    control?.cleanup();
    nativeResponseControls.delete(response);
  }
}

export function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const inputTokens = Number(value.input_tokens
    ?? value.inputTokens
    ?? value.prompt_tokens
    ?? value.promptTokens
    ?? value.promptTokenCount);
  const outputTokens = Number(value.output_tokens
    ?? value.outputTokens
    ?? value.completion_tokens
    ?? value.completionTokens
    ?? value.candidatesTokenCount);
  const totalTokens = Number(value.total_tokens ?? value.totalTokens ?? value.totalTokenCount);
  const cacheReadTokens = Number(value.cache_read_input_tokens
    ?? value.cacheReadInputTokens
    ?? value.cachedContentTokenCount);
  const cacheWriteTokens = Number(value.cache_creation_input_tokens ?? value.cacheCreationInputTokens);
  const result = {};
  if (Number.isFinite(inputTokens)) result.inputTokens = inputTokens;
  if (Number.isFinite(outputTokens)) result.outputTokens = outputTokens;
  if (Number.isFinite(totalTokens)) result.totalTokens = totalTokens;
  if (Number.isFinite(cacheReadTokens)) result.cacheReadTokens = cacheReadTokens;
  if (Number.isFinite(cacheWriteTokens)) result.cacheWriteTokens = cacheWriteTokens;
  return Object.keys(result).length > 0 ? result : null;
}

export function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => textFromContent(part)).filter(Boolean).join("");
  if (!content || typeof content !== "object") return "";
  if (content.type === "image" || content.type === "reasoning" || content.type === "thinking") return "";
  if (content.type === "tool-result" || content.type === "tool_result") {
    return textFromContent(content.content ?? content.output ?? content.result ?? content.text);
  }
  return content.text ?? content.value ?? content.content ?? content.delta ?? "";
}

export function parseToolArguments(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function base64FromBytes(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return Buffer.from(value).toString("base64");
  return null;
}

export function dataUrlParts(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) return null;
  const mediaType = match[1] || "application/octet-stream";
  const encoded = match[0].includes(";base64,")
    ? match[2]
    : (() => {
      try {
        return Buffer.from(decodeURIComponent(match[2]), "utf8").toString("base64");
      } catch {
        // A malformed percent-encoding in a data URL must not abort the whole
        // request; treat the payload as opaque utf8 text instead.
        return Buffer.from(match[2], "utf8").toString("base64");
      }
    })();
  return { mediaType, data: encoded };
}

export async function resolveImageData(content, attachments) {
  const direct = content?.data ?? content?.base64 ?? content?.source?.data;
  const directData = base64FromBytes(direct);
  if (directData) {
    return {
      mediaType: content.mediaType ?? content.mimeType ?? content.source?.media_type ?? "application/octet-stream",
      data: directData,
    };
  }
  const dataUrl = dataUrlParts(content?.url ?? content?.source?.url);
  if (dataUrl) return dataUrl;
  const reference = content?.attachment ?? content?.ref ?? content?.source;
  if (!reference || !attachments?.readImage) return null;
  const image = await attachments.readImage(reference);
  const data = base64FromBytes(image?.data ?? image?.bytes ?? image?.base64);
  if (!data) return null;
  return {
    mediaType: content.mediaType ?? content.mimeType ?? image?.ref?.mediaType ?? image?.mediaType ?? "application/octet-stream",
    data,
  };
}

export function finishReason(value, fallback = "stop") {
  const reason = String(value ?? fallback).toLowerCase();
  if (reason.includes("tool") || reason === "function_call" || reason === "tool_use") {
    return { kind: "tool-calls" };
  }
  if (reason.includes("length") || reason.includes("max")) return { kind: "length" };
  if (reason.includes("error") || reason.includes("cancel")) return { kind: "error" };
  return { kind: "stop" };
}
