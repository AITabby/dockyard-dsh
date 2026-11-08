import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildOpenAiTools,
  DsmlStreamFilter,
  fetchNativeResponse,
  finishReason,
  guardEmptyCompletion,
  normalizeUsage,
  readSseEvents,
  resolveImageData,
  sanitizeToolCallId,
  textFromContent,
  validateNativeEndpoint,
} from "../../../packages/providers/src/native-transport.mjs";

function firstString(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}

const PROVIDER_ID = "hermes";
export const DEFAULT_HERMES_API_URL = "https://inference-api.nousresearch.com";
export const DEFAULT_HERMES_CHAT_ENDPOINT = "https://inference-api.nousresearch.com/v1/chat/completions";
export const DEFAULT_HERMES_MODELS_ENDPOINT = "https://inference-api.nousresearch.com/v1/models";

let cachedAuth = null;
let cachedAuthMtime = 0;

export function findHermesAuthFilePath() {
  if (process.env.HERMES_AUTH_PATH && existsSync(process.env.HERMES_AUTH_PATH)) {
    return process.env.HERMES_AUTH_PATH;
  }
  const hermesPath = join(homedir(), ".hermes", "auth.json");
  if (existsSync(hermesPath)) return hermesPath;
  const nousPath = join(homedir(), ".nous", "auth.json");
  if (existsSync(nousPath)) return nousPath;
  return null;
}

export function extractHermesAuth({ force = false } = {}) {
  const envKeys = [
    process.env.HERMES_API_KEY,
    process.env.NOUS_API_KEY,
    process.env.HERMES_API_KEY_1,
    process.env.HERMES_API_KEY_2,
  ].filter(Boolean);

  const authFile = findHermesAuthFilePath();
  if (authFile) {
    try {
      const stats = statSync(authFile);
      if (force || !cachedAuth || stats.mtimeMs !== cachedAuthMtime) {
        const raw = readFileSync(authFile, "utf8");
        const parsed = JSON.parse(raw);
        cachedAuth = parsed;
        cachedAuthMtime = stats.mtimeMs;
      }

      if (Array.isArray(cachedAuth?.accounts) && cachedAuth.accounts.length > 0) {
        return {
          accounts: cachedAuth.accounts.map((acc, idx) => ({
            accountId: acc.accountId || acc.id || `hermes-acc-${idx + 1}`,
            displayName: acc.displayName || acc.name || `Hermes Account ${idx + 1}`,
            apiKey: acc.apiKey || acc.key || "",
            balance: typeof acc.balance === "number" ? acc.balance : null,
            email: acc.email || null,
          })),
        };
      }

      if (cachedAuth?.apiKey || cachedAuth?.access || cachedAuth?.token) {
        const key = cachedAuth.apiKey || cachedAuth.access || cachedAuth.token;
        return {
          accounts: [
            {
              accountId: cachedAuth.accountId || cachedAuth.userId || "hermes-default",
              displayName: cachedAuth.displayName || cachedAuth.name || "Hermes User",
              apiKey: key,
              balance: typeof cachedAuth.balance === "number" ? cachedAuth.balance : null,
              email: cachedAuth.email || null,
            },
          ],
        };
      }
    } catch {}
  }

  if (envKeys.length > 0) {
    return {
      accounts: envKeys.map((key, idx) => ({
        accountId: `hermes-env-${idx + 1}`,
        displayName: `Hermes Env Key ${idx + 1}`,
        apiKey: key,
        balance: null,
        email: null,
      })),
    };
  }

  return null;
}

function contentPartText(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.content === "string") return part.content;
  return "";
}

async function openAiContent(content, attachments = null) {
  if (typeof content === "string") {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return content;
    }
    const parts = [{ type: "text", text: content }];
    for (const attachment of attachments) {
      const data = await resolveImageData(attachment, attachments);
      if (data) {
        parts.push({
          type: "image_url",
          image_url: { url: `data:${data.mediaType};base64,${data.data}` },
        });
      }
    }
    return parts;
  }

  if (Array.isArray(content)) {
    const parts = [];
    for (const part of content) {
      if (typeof part === "string") {
        parts.push({ type: "text", text: part });
      } else if (part && typeof part === "object") {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push(part);
        } else if (part.type === "image") {
          const image = await resolveImageData(part, attachments);
          if (image) {
            parts.push({
              type: "image_url",
              image_url: { url: `data:${image.mediaType};base64,${image.data}` },
            });
          }
        } else if (part.type === "image_url") {
          parts.push(part);
        } else {
          const text = contentPartText(part);
          if (text) parts.push({ type: "text", text });
        }
      }
    }
    if (Array.isArray(attachments)) {
      for (const attachment of attachments) {
        const data = await resolveImageData(attachment, attachments);
        if (data) {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${data.mediaType};base64,${data.data}` },
          });
        }
      }
    }
    return parts;
  }

  return "";
}

export async function buildHermesMessages(request = {}, attachments = null) {
  const result = [];
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];

  for (const message of rawMessages) {
    if (message?.role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: sanitizeToolCallId(firstString(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        content: typeof message.content === "string" ? message.content : textFromContent(message.content ?? message.text ?? message.output ?? message.result),
      });
      continue;
    }

    const role = message?.role === "assistant" ? "assistant" : message?.role === "system" ? "system" : "user";
    const content = await openAiContent(message?.content ?? message?.text, attachments);

    const calls = [];
    if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part?.type === "tool-call" || part?.type === "tool_call") {
          calls.push({
            id: sanitizeToolCallId(firstString(part.id, part.toolCallId, `call_${calls.length}`)),
            type: "function",
            function: {
              name: firstString(part.name, part.function?.name, "tool"),
              arguments: typeof (part.arguments ?? part.function?.arguments) === "string"
                ? (part.arguments ?? part.function?.arguments)
                : JSON.stringify(part.arguments ?? part.input ?? {}),
            },
          });
        }
      }
    }
    if (Array.isArray(message?.tool_calls)) {
      for (const tc of message.tool_calls) {
        calls.push({
          id: sanitizeToolCallId(firstString(tc.id, tc.toolCallId, `call_${calls.length}`)),
          type: "function",
          function: {
            name: firstString(tc.name, tc.function?.name, "tool"),
            arguments: typeof (tc.arguments ?? tc.function?.arguments) === "string"
              ? (tc.arguments ?? tc.function?.arguments)
              : JSON.stringify(tc.arguments ?? tc.input ?? {}),
          },
        });
      }
    }

    if (Array.isArray(content) && content.length === 0 && calls.length === 0) {
      // Nothing to say: an empty content array is rejected outright by the
      // strict models on this gateway ("content must not be an empty array").
      continue;
    }
    const msgObj = {
      role,
      content: Array.isArray(content) && content.length === 1 && content[0]?.type === "text"
        ? content[0].text
        : (Array.isArray(content) && content.length === 0 ? "" : content),
    };
    if (role === "assistant" && calls.length > 0) {
      msgObj.tool_calls = calls;
    }
    result.push(msgObj);
  }

  if (result.length === 0 && typeof request.prompt === "string" && request.prompt.trim()) {
    result.push({
      role: "user",
      content: request.prompt.trim(),
    });
  }

  return result;
}

function extractReasoningDelta(delta) {
  if (!delta || typeof delta !== "object") return null;
  const direct = firstString(delta.reasoning_content, delta.reasoning, delta.thought);
  if (direct) return direct;
  if (Array.isArray(delta.reasoning_details)) {
    for (const item of delta.reasoning_details) {
      if (item && item.type !== "reasoning.encrypted") {
        const text = firstString(item.text, item.content, item.summary);
        if (text) return text;
      }
    }
  }
  return null;
}

export function createHermesNativeExecutor({
  endpoint = DEFAULT_HERMES_CHAT_ENDPOINT,
  apiKey = null,
  fetchImpl = fetch,
  timeoutMs = 180_000,
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint, {
    providerId: PROVIDER_ID,
    defaultEndpoint: DEFAULT_HERMES_CHAT_ENDPOINT,
  });

  async function* runHermesAttempt(envelope = {}) {
    const req = (envelope && typeof envelope === "object" && "request" in envelope)
      ? (envelope.request ?? {})
      : (envelope ?? {});
    const attachments = envelope?.attachments ?? req?.attachments;
    const credential = envelope?.credential ?? req?.credential;
    const signal = envelope?.signal ?? req?.signal;

    let token = apiKey
      ?? (credential?.apiKey && credential.apiKey !== "free-tier" ? credential.apiKey : null)
      ?? (credential?.token && credential.token !== "free-tier" ? credential.token : null)
      ?? (credential?.accessToken && credential.accessToken !== "free-tier" ? credential.accessToken : null);

    if (!token) {
      const extracted = extractHermesAuth();
      if (extracted?.accounts?.length) {
        token = extracted.accounts[0].apiKey;
      }
    }

    if (!token) {
      const err = new Error("Hermes API Key 未配置，可在 ~/.hermes/auth.json 中配置或在面板中设置 API Key。");
      err.code = "AUTH_REQUIRED";
      err.providerId = PROVIDER_ID;
      throw err;
    }

    const messages = await buildHermesMessages(req, attachments);

    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const rawEffort = req.reasoningEffort ?? req.reasoning_effort ?? req.reasoning?.effort;
    let reasoningEffort = null;
    if (typeof rawEffort === "string" && rawEffort.length > 0) {
      const lower = rawEffort.toLowerCase();
      if (lower === "none" || lower === "off") {
        reasoningEffort = "none";
      } else if (lower === "minimal") {
        reasoningEffort = "low";
      } else {
        reasoningEffort = lower;
      }
    }

    const tools = buildOpenAiTools(req.tools);

    const body = {
      model: req.model ?? "deepseek/deepseek-v4.1-flash",
      messages,
      stream: true,
      tags: ["user=dockyard"],
      ...(typeof req.temperature === "number" ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === "number" ? { max_tokens: req.maxTokens } : {}),
      ...(reasoningEffort && reasoningEffort !== "none"
        ? { reasoning_effort: reasoningEffort }
        : {}),
      ...(tools ? { tools } : {}),
    };

    let response;
    try {
      response = await fetchNativeResponse(
        validatedEndpoint,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        },
        {
          providerId: PROVIDER_ID,
          timeoutMs,
          fetchImpl,
        },
      );
    } catch (err) {
      if (!req.probe && !req.noFallback && body.model !== "deepseek/deepseek-v4.1-flash" && (err?.status === 503 || err?.status === 502 || err?.status === 504 || err?.status === 404)) {
        const fallbackBody = { ...body, model: "deepseek/deepseek-v4.1-flash" };
        response = await fetchNativeResponse(
          validatedEndpoint,
          {
            method: "POST",
            headers,
            body: JSON.stringify(fallbackBody),
            signal,
          },
          {
            providerId: PROVIDER_ID,
            timeoutMs,
            fetchImpl,
          },
        );
      } else {
        throw err;
      }
    }

    const streamEvents = [];
    let nextIndex = 1;
    let rawUsage = null;
    let stop = "stop";
    let probeYielded = false;
    const activeTools = new Map();

    const reasoningFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "reasoning" }),
      onTextDelta: (index, text) => streamEvents.push({ type: "reasoning-delta", index, text }),
      onTextBlockEnd: (index, text) => streamEvents.push({ type: "block-end", index, block: { type: "reasoning", text } }),
    });

    const textFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "text" }),
      onTextDelta: (index, text) => streamEvents.push({ type: "text-delta", index, text }),
      onTextBlockEnd: (index, text) => streamEvents.push({ type: "block-end", index, block: { type: "text", text } }),
    });

    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: PROVIDER_ID })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;

      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;

      if (req.probe && !probeYielded) {
        probeYielded = true;
        yield { type: "text-delta", index: 0, text: " " };
      }

      const delta = choice.delta ?? {};
      const reasoningDelta = extractReasoningDelta(delta);
      if (reasoningDelta) {
        textFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();
        reasoningFilter.push(reasoningDelta, () => nextIndex++);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }

      for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
        const key = Number(call.index ?? activeTools.size);
        if (!activeTools.has(key)) {
          reasoningFilter.closeText();
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();
          const state = {
            index: nextIndex++,
            id: firstString(call.id, `call_${key}_${randomUUID().slice(0, 8)}`),
            name: firstString(call.function?.name, call.name, "tool"),
            arguments: "",
          };
          activeTools.set(key, state);
          yield { type: "block-start", index: state.index, blockType: "tool-call" };
        }
        const state = activeTools.get(key);
        const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
        if (call.id) state.id = call.id;
        if (call.function?.name) state.name = call.function.name;
        state.arguments += argumentDelta;
        if (argumentDelta) {
          yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
        }
      }

      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        reasoningFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();
        textFilter.push(content, () => nextIndex++);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }

      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }

    reasoningFilter.closeText();
    textFilter.closeText();
    const reasoningDsml = reasoningFilter.flush(() => nextIndex++);
    const textDsml = textFilter.flush(() => nextIndex++);
    while (streamEvents.length > 0) yield streamEvents.shift();

    const allDsmlCalls = [
      ...(reasoningDsml?.toolCalls || []),
      ...(textDsml?.toolCalls || []),
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

  return guardEmptyCompletion(runHermesAttempt, { providerId: PROVIDER_ID });
}
