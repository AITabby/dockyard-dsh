import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildOpenAiTools,
  DsmlStreamFilter,
  fetchNativeResponse,
  finishReason,
  nativeProviderError,
  normalizeUsage,
  parseDsmlCalls,
  readSseEvents,
  resolveImageData,
  sanitizeToolCallId,
  stripDsmlCalls,
  textFromContent,
  validateNativeEndpoint,
} from "../../../packages/providers/src/native-transport.mjs";

function firstString(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}

const PROVIDER_ID = "workbuddy";
export const DEFAULT_WORKBUDDY_ENDPOINT = "https://www.workbuddy.ai/v2/chat/completions";

let cachedSession = null;
let cachedSessionExpiry = 0;

export function findWorkbuddyElectronPath() {
  if (process.env.WORKBUDDY_ELECTRON_PATH && existsSync(process.env.WORKBUDDY_ELECTRON_PATH)) {
    return process.env.WORKBUDDY_ELECTRON_PATH;
  }
  const candidates = [
    "/Applications/WorkBuddy AI.app/Contents/MacOS/Electron",
    "/Applications/WorkBuddy.app/Contents/MacOS/Electron",
    join(homedir(), "Applications/WorkBuddy AI.app/Contents/MacOS/Electron"),
    join(homedir(), "Applications/WorkBuddy.app/Contents/MacOS/Electron"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function findWorkbuddyAuthFilePath() {
  if (process.env.WORKBUDDY_AUTH_FILE_PATH && existsSync(process.env.WORKBUDDY_AUTH_FILE_PATH)) {
    return process.env.WORKBUDDY_AUTH_FILE_PATH;
  }
  const candidate = join(
    homedir(),
    "Library/Application Support/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop-ai.info",
  );
  if (existsSync(candidate)) return candidate;
  return null;
}

export function findWorkbuddyConfigDir() {
  if (process.env.WORKBUDDY_CONFIG_DIR && existsSync(process.env.WORKBUDDY_CONFIG_DIR)) {
    return process.env.WORKBUDDY_CONFIG_DIR;
  }
  const candidates = [
    join(homedir(), ".workbuddy-ai"),
    join(homedir(), ".workbuddy"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function extractWorkbuddySession({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedSession && now < cachedSessionExpiry - 60_000) {
    return cachedSession;
  }

  const electronPath = findWorkbuddyElectronPath();
  const authPath = findWorkbuddyAuthFilePath();
  const configDir = findWorkbuddyConfigDir();

  if (!electronPath || !authPath || !configDir) {
    if (process.env.WORKBUDDY_ACCESS_TOKEN) {
      const fallback = {
        accessToken: process.env.WORKBUDDY_ACCESS_TOKEN,
        uid: process.env.WORKBUDDY_UID || "workbuddy-user",
        email: process.env.WORKBUDDY_EMAIL || "workbuddy@desktop.ai",
        nickname: "WorkBuddy User",
        expiresAt: now + 3600_000,
      };
      cachedSession = fallback;
      cachedSessionExpiry = fallback.expiresAt;
      return fallback;
    }
    return null;
  }

  const script = `
    const asarMain = "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar/main";
    const dist = require(asarMain + "/dist.js");
    const cp = require(asarMain + "/credential-protection.js");
    dist.s();
    cp.t();

    const b = process._linkedBinding("electron_browser_workbuddy_storage");
    const r = b.loggerGet();
    const i = dist.T(r);
    const configDir = ${JSON.stringify(configDir)};
    const o = dist.u({ keyblobPath: dist.l(configDir), protectorKey: i.symmetric.value });

    const bootstrap = {
      policy: "fields",
      symmetricKey: i.symmetric.value,
      userKey: o.value,
      developerPublicKey: i.developerPublicKey.value
    };
    cp._(bootstrap);

    const fs = require("fs");
    const authPath = ${JSON.stringify(authPath)};
    const content = fs.readFileSync(authPath, "utf8");
    const parsed = JSON.parse(content);
    const codec = cp.v({ purpose: "workbuddy-auth-session", resourceId: "auth/workbuddy-desktop-ai.info" });
    const fields = [
      { path: ["auth", "accessToken"] },
      { path: ["auth", "refreshToken"] },
      { path: ["account", "phoneNumber"] },
      { path: ["account", "departmentFullName"] },
      { path: ["account", "nickname"] },
      { path: ["account", "email"] }
    ];
    const decoded = codec.decode(parsed, fields);
    const result = {
      accessToken: decoded.value.auth?.accessToken || null,
      refreshToken: decoded.value.auth?.refreshToken || null,
      uid: parsed.account?.uid || null,
      nickname: decoded.value.account?.nickname || null,
      email: decoded.value.account?.email || parsed.account?.email || null,
      expiresAt: decoded.value.auth?.expiresAt || null
    };
    process.stdout.write(JSON.stringify(result));
  `;

  try {
    const stdout = execFileSync(
      electronPath,
      ["-e", script],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
        },
        timeout: 10_000,
      },
    );

    const parsed = JSON.parse(stdout.trim());
    if (parsed?.accessToken) {
      cachedSession = parsed;
      cachedSessionExpiry = parsed.expiresAt ? Number(parsed.expiresAt) : now + 3600_000;
      return parsed;
    }
  } catch (error) {
    if (process.env.WORKBUDDY_ACCESS_TOKEN) {
      const fallback = {
        accessToken: process.env.WORKBUDDY_ACCESS_TOKEN,
        uid: process.env.WORKBUDDY_UID || "workbuddy-user",
        email: process.env.WORKBUDDY_EMAIL || "workbuddy@desktop.ai",
        nickname: "WorkBuddy User",
        expiresAt: now + 3600_000,
      };
      cachedSession = fallback;
      cachedSessionExpiry = fallback.expiresAt;
      return fallback;
    }
  }

  return null;
}

export async function buildWorkbuddyMessages(request, attachments = []) {
  const messages = [];

  const rawMessages = Array.isArray(request?.messages) ? request.messages : [];
  const systemPrompt = request?.systemPrompt || request?.system;

  let hasSystemMessage = false;

  for (const message of rawMessages) {
    const role = message?.role ?? "user";
    if (role === "system") {
      hasSystemMessage = true;
      messages.push({
        role: "system",
        content: typeof message?.content === "string" ? message.content : textFromContent(message?.content),
      });
      continue;
    }

    if (role === "tool") {
      const content = typeof message?.content === "string" ? message.content : textFromContent(message?.content ?? message?.text ?? message?.output ?? message?.result);
      messages.push({
        role: "tool",
        tool_call_id: sanitizeToolCallId(firstString(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        content: content || "",
      });
      continue;
    }

    if (role === "user" || role === "assistant") {
      let content = "";
      const calls = [];
      if (typeof message?.content === "string") {
        content = message.content;
      } else if (Array.isArray(message?.content)) {
        const parts = [];
        for (const part of message.content) {
          if (part?.type === "text" && typeof part?.text === "string") {
            parts.push(part.text);
          } else if (part?.type === "tool-call" || part?.type === "tool_call") {
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
          } else if (typeof part === "string") {
            parts.push(part);
          }
        }
        content = parts.join("\n");
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

      const msgObj = { role, content };
      if (role === "assistant" && calls.length > 0) {
        msgObj.tool_calls = calls;
      }
      messages.push(msgObj);
      continue;
    }
  }

  // WorkBuddy strictly requires that the first message is a system message!
  if (!hasSystemMessage) {
    messages.unshift({
      role: "system",
      content: systemPrompt || "You are a helpful AI assistant.",
    });
  }

  return messages;
}

export function createWorkbuddyNativeExecutor({
  endpoint = DEFAULT_WORKBUDDY_ENDPOINT,
  accessToken = null,
  fetchImpl = fetch,
  timeoutMs = 120_000,
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });

  return async function* workbuddyNativeExecutor(envelope = {}) {
    const req = envelope?.request ?? envelope ?? {};
    const { attachments, credential, signal } = envelope;

    let token = accessToken
      ?? (credential?.accessToken && credential.accessToken !== "free-tier" ? credential.accessToken : null)
      ?? (credential?.access && credential.access !== "free-tier" ? credential.access : null)
      ?? credential?.apiKey
      ?? credential?.token
      ?? process.env.WORKBUDDY_ACCESS_TOKEN
      ?? null;

    let uid = credential?.uid ?? null;

    if (!token) {
      const session = extractWorkbuddySession();
      if (session?.accessToken) {
        token = session.accessToken;
        uid = session.uid;
      }
    }

    if (!token) {
      throw nativeProviderError(
        PROVIDER_ID,
        "未检测到本地 WorkBuddy 登录凭据，请先在 WorkBuddy 桌面端登录或设置 WORKBUDDY_ACCESS_TOKEN",
      );
    }

    const messages = await buildWorkbuddyMessages(req, attachments);
    const tools = buildOpenAiTools(req.tools);

    const convId = randomUUID();
    const reqId = randomUUID();
    const msgId = randomUUID();
    const traceId = randomBytes(16).toString("hex");
    const spanId = randomBytes(8).toString("hex");
    const parentSpanId = randomBytes(8).toString("hex");

    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-requested-with": "XMLHttpRequest",
      "x-codebuddy-request": "1",
      "X-Conversation-ID": convId,
      "X-Conversation-Request-ID": reqId,
      "X-Conversation-Message-ID": msgId,
      "X-Request-ID": reqId,
      "X-Agent-Intent": "craft",
      "X-Agent-Purpose": "conversation",
      "X-IDE-Type": "WorkBuddy",
      "X-IDE-Name": "WorkBuddy",
      "X-IDE-Version": "5.9.4",
      "X-Private-Data": "true",
      "X-Product": "SaaS",
      "User-Agent": "WorkBuddy/5.9.4 WorkBuddy/5.9.4",
      traceparent: `00-${traceId}-${spanId}-01`,
      b3: `${traceId}-${spanId}-1-${parentSpanId}`,
      "X-B3-TraceId": traceId,
      "X-B3-SpanId": spanId,
      "X-B3-Sampled": "1",
      "X-Trace-ID": traceId,
      ...(uid ? { "X-User-Id": uid } : {}),
    };

    const body = {
      model: req.model ?? "deepseek-v4.1-flash",
      messages,
      stream: true,
      ...(typeof req.temperature === "number" ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === "number" ? { max_tokens: req.maxTokens } : {}),
      ...(tools ? { tools } : {}),
    };

    const response = await fetchNativeResponse(
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

    const streamEvents = [];
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";
    const activeTools = new Map();

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

      const delta = choice.delta ?? {};
      const reasoningDelta = firstString(delta.reasoning_content, delta.reasoning, delta.thought);
      if (reasoningDelta) {
        textFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        reasoning.text += reasoningDelta;
        yield { type: "reasoning-delta", index: reasoning.index, text: reasoningDelta };
      }

      for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
        const key = Number(call.index ?? activeTools.size);
        if (!activeTools.has(key)) {
          if (reasoning) {
            yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
            reasoning = null;
          }
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
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        textFilter.push(content, () => nextIndex++);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }

      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }

    if (reasoning) {
      yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
      reasoning = null;
    }

    const dsmlResult = textFilter.flush(() => nextIndex++);
    while (streamEvents.length > 0) yield streamEvents.shift();

    if (activeTools.size > 0) {
      for (const state of activeTools.values()) {
        yield {
          type: "block-end",
          index: state.index,
          block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" },
        };
      }
      stop = "tool_calls";
    } else if (dsmlResult?.toolCalls?.length > 0) {
      for (const dsml of dsmlResult.toolCalls) {
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
}
