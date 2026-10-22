import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";
import {
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

const PROVIDER_ID = "opencode";
const DEFAULT_ENDPOINT = "https://opencode.ai/inference/openai/v1/chat/completions";

export function findOpencodeCliPath() {
  const appSupportCliDir = join(homedir(), "Library/Application Support/ai.opencode.desktop/cli");
  if (existsSync(appSupportCliDir)) {
    try {
      const entries = readdirSync(appSupportCliDir);
      for (const entry of entries) {
        const candidate = join(appSupportCliDir, entry, "opencode-cli");
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }
  return null;
}

function contentPartText(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (part.type === "reasoning" || part.type === "thinking") return "";
  if (part.type === "tool-call" || part.type === "function-call" || part.type === "tooluse") {
    const name = part.name ?? part.function?.name ?? "tool";
    return `[Tool Call: ${name}]`;
  }
  if (part.type === "tool-result" || part.type === "tool_result") {
    const text = textFromContent(part.content ?? part.output ?? part.result ?? part.text);
    const trimmed = text.length > 8192 ? `${text.slice(0, 8192)}... [truncated]` : text;
    return `[Tool Result ${part.toolCallId ?? part.id ?? ""}]:\n${trimmed}`;
  }
  return textFromContent(part);
}

function promptFromRequest(request) {
  if (typeof request.prompt === "string" && request.prompt.trim()) {
    return request.prompt;
  }
  const messages = Array.isArray(request.messages) ? request.messages : [];
  if (messages.length === 1 && !request.system) {
    const msg = messages[0];
    const text = typeof msg?.content === "string"
      ? msg.content
      : Array.isArray(msg?.content)
        ? msg.content.map(contentPartText).filter(Boolean).join("\n")
        : contentPartText(msg?.content);
    if (text) return text;
  }
  const parts = [];
  if (typeof request.system === "string" && request.system.trim()) {
    parts.push(`[System instructions: ${request.system.trim()}]`);
  }
  for (const msg of messages) {
    const role = msg?.role === "assistant" ? "Assistant" : msg?.role === "system" ? "System" : "User";
    const text = typeof msg?.content === "string"
      ? msg.content
      : Array.isArray(msg?.content)
        ? msg.content.map(contentPartText).filter(Boolean).join("\n")
        : contentPartText(msg?.content);
    if (text) {
      parts.push(`${role}: ${text}`);
    }
  }
  if (parts.length > 0) return parts.join("\n\n");
  return typeof request.prompt === "string" ? request.prompt : "";
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

function toolCallPart(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "functioncall" || type === "tooluse" ? part : null;
}

async function openAiContent(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID, "image attachment could not be resolved");
      blocks.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({
        type: "text",
        text: `[Tool Result ${part.toolCallId ?? part.id ?? ""}]\n${textFromContent(part.content ?? part.output ?? part.result ?? part.text)}`,
      });
      continue;
    }
    const call = toolCallPart(part);
    if (call) {
      blocks.push({
        type: "text",
        text: `[Tool Call ${call.name ?? call.function?.name ?? "tool"}] ${JSON.stringify(parseToolArguments(call.arguments ?? call.input ?? call.function?.arguments))}`,
      });
      continue;
    }
    const text = textFromContent(part);
    if (text) blocks.push({ type: "text", text });
  }
  return blocks;
}

export async function buildOpencodeMessages(request, attachments) {
  const result = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    result.push({ role: "system", content: request.system });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "tool" : "user";
    if (role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: firstString(message.toolCallId, message.tool_call_id, message.id, "tool-result"),
        content: textFromContent(message.content ?? message.text ?? message.output ?? message.result),
      });
      continue;
    }
    const content = await openAiContent(message?.content ?? message?.text, attachments);
    result.push({
      role,
      content: content.length === 1 && content[0]?.type === "text" ? content[0].text : content,
    });
  }
  return result;
}

const OPENCODE_SERVER_START_TIMEOUT_MS = 15_000;
const OPENCODE_SERVER_READY_PATTERN = /server listening on (http:\/\/127\.0\.0\.1:\d+)/i;

let serverChild = null;
let serverUrl = null;
let serverPassword = null;
let serverStarting = null;

function opencodeServerAuth(password) {
  return `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;
}

function abortSignalError(signal) {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function opencodeDebug(...args) {
  if (process.env.OPENCODE_TRANSPORT_DEBUG) {
    console.error("[opencode-transport]", ...args);
  }
}

async function startOpencodeServer(cliPath) {
  opencodeDebug("starting local server", cliPath);
  const password = randomBytes(24).toString("base64url");
  const child = spawn(cliPath, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, OPENCODE_PASSWORD: password },
  });
  let diagnostics = "";
  child.stderr?.on("data", (chunk) => {
    diagnostics = `${diagnostics}${String(chunk)}`.slice(-4000);
  });
  let url;
  try {
    url = await new Promise((resolve, reject) => {
      let buffer = "";
      let timer = null;
      let settled = false;
      const settle = (error, value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        child.stdout?.off?.("data", onStdout);
        child.off?.("exit", onExit);
        child.off?.("error", onError);
        if (error) reject(error);
        else resolve(value);
      };
      const onStdout = (chunk) => {
        buffer += String(chunk);
        const match = buffer.match(OPENCODE_SERVER_READY_PATTERN);
        if (match) settle(null, match[1]);
      };
      const onExit = (code, exitSignal) => {
        settle(
          new Error(
            `OpenCode 本地服务提前退出 (code ${code ?? "null"}, signal ${exitSignal ?? "null"})${diagnostics ? `: ${diagnostics.trim()}` : ""}`,
          ),
        );
      };
      const onError = (error) => settle(error);
      timer = setTimeout(() => {
        settle(new Error(`OpenCode 本地服务启动超时${diagnostics ? `: ${diagnostics.trim()}` : ""}`));
      }, OPENCODE_SERVER_START_TIMEOUT_MS);
      child.stdout?.on("data", onStdout);
      child.once("exit", onExit);
      child.once("error", onError);
    });
  } catch (error) {
    // A server that never became ready must not linger in the background.
    try {
      child.kill();
    } catch {}
    throw error;
  }
  // Keep draining both pipes so the child never blocks on a full buffer.
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  // A long-lived server must not keep a one-shot DSH process alive by itself;
  // the exit hook below still terminates it when the parent goes away.
  child.unref?.();
  child.stdout?.unref?.();
  child.stderr?.unref?.();
  const info = { child, url, password };
  opencodeDebug("local server ready", url);
  child.once("exit", () => {
    if (serverChild === child) {
      serverChild = null;
      serverUrl = null;
      serverPassword = null;
    }
  });
  process.once("exit", () => {
    try {
      child.kill();
    } catch {}
  });
  return info;
}

async function ensureOpencodeServer(cliPath) {
  if (serverUrl && serverChild && serverChild.exitCode === null) {
    return { child: serverChild, url: serverUrl, password: serverPassword };
  }
  if (serverStarting) return serverStarting;
  serverStarting = startOpencodeServer(cliPath)
    .then((info) => {
      serverChild = info.child;
      serverUrl = info.url;
      serverPassword = info.password;
      serverStarting = null;
      return info;
    })
    .catch((error) => {
      serverStarting = null;
      throw error;
    });
  return serverStarting;
}

async function opencodeServerRequest(server, method, path, body, { signal, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${server.url}${path}`, {
      method,
      headers: {
        Authorization: opencodeServerAuth(server.password),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw abortSignalError(signal);
    throw error;
  }
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw nativeProviderError(
      PROVIDER_ID,
      `OpenCode 本地服务请求失败 (${method} ${path}): ${response.status}${details ? ` ${details.slice(0, 500)}` : ""}`,
    );
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function openOpencodeEventStream(server, sessionId, { signal, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${server.url}/api/event`, {
      headers: {
        Authorization: opencodeServerAuth(server.password),
        Accept: "text/event-stream",
      },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw abortSignalError(signal);
    throw error;
  }
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw nativeProviderError(
      PROVIDER_ID,
      `OpenCode 事件流连接失败: ${response.status}${details ? ` ${details.slice(0, 300)}` : ""}`,
    );
  }
  if (!response.body?.getReader) {
    throw nativeProviderError(PROVIDER_ID, "OpenCode 事件流不可读取");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let closed = false;
  return {
    async next() {
      while (!closed) {
        let boundary = buffer.indexOf("\n\n");
        while (boundary === -1) {
          const { value, done } = await reader.read();
          if (done) {
            closed = true;
            return { done: true };
          }
          buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replace(/\r\n/g, "\n");
          boundary = buffer.indexOf("\n\n");
        }
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("data:")) data += `${data ? "\n" : ""}${line.slice(5).trim()}`;
        }
        if (!data) continue;
        let event;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event?.data?.sessionID !== sessionId) continue;
        return { done: false, value: event };
      }
      return { done: true };
    },
    async close() {
      closed = true;
      try {
        await reader.cancel();
      } catch {}
    },
  };
}

function opencodeServerModel(request) {
  const raw = typeof request?.model === "string" ? request.model.trim() : "";
  if (!raw) return null;
  const [baseRaw, embeddedVariant] = raw.split("#");
  const base = baseRaw.startsWith("opencode/") ? baseRaw.slice("opencode/".length) : baseRaw;
  if (!base) return null;
  if (request?.purpose === "compaction") {
    return { providerID: PROVIDER_ID, id: base };
  }
  const effort = request.reasoningEffort ?? request.reasoning_effort ?? embeddedVariant;
  const variant = typeof effort === "string" && effort && effort !== "medium" ? effort : null;
  return { providerID: PROVIDER_ID, id: base, ...(variant ? { variant } : {}) };
}

function opencodeUsageFromTokens(tokens) {
  const input = Number(tokens?.input ?? 0);
  const output = Number(tokens?.output ?? 0);
  return {
    prompt_tokens: Number.isFinite(input) ? input : 0,
    completion_tokens: Number.isFinite(output) ? output : 0,
    total_tokens: (Number.isFinite(input) ? input : 0) + (Number.isFinite(output) ? output : 0),
  };
}

function opencodeEventMessage(data) {
  const value = data?.error ?? data?.message ?? data?.reason;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const nested = value.message ?? value.error ?? value.reason;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

function isPermissionRequestEvent(type, data, sessionId) {
  if (typeof type !== "string" || !type.includes("permission")) return false;
  if (data?.sessionID !== sessionId) return false;
  return type.includes("request") || type.endsWith(".updated") || type.endsWith(".asked");
}

async function* runViaOpencodeServer({ server, request, signal, fetchImpl }) {
  const prompt = promptFromRequest(request);
  const model = opencodeServerModel(request);
  const controller = new AbortController();
  let sessionId = null;
  let stream = null;
  let aborted = false;
  const pendingReplies = new Set();

  const onAbort = () => {
    aborted = true;
    controller.abort();
    if (sessionId) {
      void opencodeServerRequest(server, "POST", `/api/session/${sessionId}/interrupt`, undefined, { fetchImpl }).catch(() => {});
    }
  };
  if (signal) {
    if (signal.aborted) throw abortSignalError(signal);
    signal.addEventListener("abort", onAbort, { once: true });
  }

  let text = "";
  let textIndex = 0;
  let textOpen = false;
  let nextIndex = 1;
  let reasoning = null;
  let rawUsage = null;
  let stop = "stop";

  try {
    const created = await opencodeServerRequest(
      server,
      "POST",
      "/api/session",
      {
        ...(model ? { model } : {}),
        location: { directory: process.cwd() },
      },
      { signal: controller.signal, fetchImpl },
    );
    sessionId = created?.data?.id ?? created?.id ?? null;
    if (!sessionId) {
      throw nativeProviderError(PROVIDER_ID, "OpenCode 会话创建失败：响应中没有会话 ID");
    }
    opencodeDebug("session created", sessionId);

    stream = await openOpencodeEventStream(server, sessionId, { signal: controller.signal, fetchImpl });
    opencodeDebug("event stream connected");
    await opencodeServerRequest(
      server,
      "POST",
      `/api/session/${sessionId}/prompt`,
      { text: prompt },
      { signal: controller.signal, fetchImpl },
    );
    opencodeDebug("prompt submitted");

    let finished = false;
    while (!finished) {
      let next;
      try {
        next = await stream.next();
      } catch (error) {
        if (controller.signal.aborted) break;
        throw error;
      }
      if (next.done) break;
      const event = next.value;
      const type = event.type;
      const data = event.data ?? {};
      if (type && !type.endsWith(".delta")) opencodeDebug("event", type);

      if (type === "session.reasoning.delta" && typeof data.delta === "string" && data.delta) {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text } };
          textOpen = false;
        }
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        reasoning.text += data.delta;
        yield { type: "reasoning-delta", index: reasoning.index, text: data.delta };
      } else if (type === "session.text.delta" && typeof data.delta === "string" && data.delta) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text += data.delta;
        yield { type: "text-delta", index: textIndex, text: data.delta };
      } else if (type === "session.usage.updated" && data.tokens) {
        rawUsage = opencodeUsageFromTokens(data.tokens);
      } else if (type === "session.step.ended") {
        if (typeof data.finish === "string" && data.finish) stop = data.finish;
        if (data.tokens) rawUsage = opencodeUsageFromTokens(data.tokens);
      } else if (type === "session.execution.succeeded") {
        finished = true;
      } else if (type === "session.execution.failed" || type === "session.execution.error") {
        throw nativeProviderError(PROVIDER_ID, opencodeEventMessage(data) || "OpenCode 执行失败");
      } else if (isPermissionRequestEvent(type, data, sessionId)) {
        const requestId = data.id ?? data.requestID;
        if (requestId) {
          pendingReplies.add(
            opencodeServerRequest(
              server,
              "POST",
              `/api/session/${sessionId}/permission/${requestId}/reply`,
              { decision: "always" },
              { fetchImpl },
            ).catch(() => {}),
          );
        }
      }
    }
  } finally {
    if (stream) await stream.close();
    if (sessionId) {
      await opencodeServerRequest(server, "DELETE", `/api/session/${sessionId}`, undefined, { fetchImpl }).catch(() => {});
    }
    signal?.removeEventListener?.("abort", onAbort);
    if (pendingReplies.size > 0) await Promise.allSettled([...pendingReplies]);
  }

  if (reasoning) {
    yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  }
  if (textOpen) {
    yield { type: "block-end", index: textIndex, block: { type: "text", text } };
  }
  if (rawUsage) {
    yield { type: "usage", usage: normalizeUsage(rawUsage) };
  }
  yield {
    type: "finish",
    reason: aborted ? { kind: "stop" } : finishReason(stop),
    ...(rawUsage ? { usage: normalizeUsage(rawUsage) } : {}),
  };
}

export function createOpencodeNativeExecutor({
  endpoint = DEFAULT_ENDPOINT,
  apiKey = null,
  fetchImpl = fetch,
  timeoutMs = 60_000,
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });

  return async function* opencodeNativeExecutor(envelope = {}) {
    const { request, attachments, credential, signal } = envelope;
    const token = apiKey
      ?? (credential?.access && credential.access !== "free-tier" ? credential.access : null)
      ?? credential?.apiKey
      ?? credential?.token
      ?? process.env.OPENCODE_API_KEY
      ?? null;

    const cliPath = !token ? findOpencodeCliPath() : null;
    if (cliPath) {
      let server = null;
      try {
        server = await ensureOpencodeServer(cliPath);
      } catch {
        server = null;
      }
      if (server) {
        let emitted = false;
        try {
          for await (const event of runViaOpencodeServer({ server, request, signal, fetchImpl })) {
            emitted = true;
            yield event;
          }
          return;
        } catch (error) {
          // Fall back to the CLI transport only when the server path failed
          // before it produced anything (otherwise we would duplicate output).
          if (emitted || signal?.aborted) throw error;
        }
      }
    }
    if (cliPath) {
      const baseModel = request.model?.startsWith("opencode/")
        ? request.model
        : `opencode/${request.model}`;
      const effort = request.purpose === "compaction"
        ? null
        : (request.reasoningEffort ?? request.reasoning_effort);
      const model = effort && effort !== "medium" ? `${baseModel}#${effort}` : baseModel;
      const prompt = promptFromRequest(request);
      const child = spawn(cliPath, ["run", "--model", model, "--thinking", "--format", "json", prompt], {
        signal,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      const rl = readline.createInterface({ input: child.stdout });
      let text = "";
      let textIndex = 0;
      let textOpen = false;
      let nextIndex = 1;
      let reasoning = null;
      let rawUsage = null;
      let stderrOutput = "";
      child.stderr?.on?.("data", (chunk) => {
        stderrOutput += String(chunk);
      });

      for await (const line of rl) {
        if (!line.trim()) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (parsed.type === "reasoning" && parsed.part?.text) {
          if (textOpen) {
            yield { type: "block-end", index: textIndex, block: { type: "text", text } };
            textOpen = false;
          }
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          const chunk = parsed.part.text;
          reasoning.text += chunk;
          yield { type: "reasoning-delta", index: reasoning.index, text: chunk };
        } else if (parsed.type === "text" && parsed.part?.text) {
          if (reasoning) {
            yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
            reasoning = null;
          }
          if (!textOpen) {
            textIndex = nextIndex++;
            text = "";
            textOpen = true;
            yield { type: "block-start", index: textIndex, blockType: "text" };
          }
          const chunk = parsed.part.text;
          text += chunk;
          yield { type: "text-delta", index: textIndex, text: chunk };
        } else if (parsed.type === "step_finish" && parsed.part?.tokens) {
          rawUsage = {
            prompt_tokens: parsed.part.tokens.input ?? 0,
            completion_tokens: parsed.part.tokens.output ?? 0,
            total_tokens: (parsed.part.tokens.input ?? 0) + (parsed.part.tokens.output ?? 0),
          };
        } else if (parsed.type === "error") {
          throw nativeProviderError(PROVIDER_ID, parsed.error?.message || "OpenCode CLI execution error");
        }
      }

      if (!text && stderrOutput.trim()) {
        throw nativeProviderError(PROVIDER_ID, stderrOutput.trim());
      }
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
      }
      if (textOpen) {
        yield { type: "block-end", index: textIndex, block: { type: "text", text } };
      }
      if (rawUsage) {
        yield {
          type: "usage",
          usage: normalizeUsage(rawUsage),
        };
      }
      yield {
        type: "finish",
        reason: { kind: "stop" },
        ...(rawUsage ? { usage: normalizeUsage(rawUsage) } : {}),
      };
      return;
    }

    if (!token) {
      throw nativeProviderError(PROVIDER_ID, "未检测到本地 OpenCode CLI 客户端，且未配置 OPENCODE_API_KEY");
    }

    const messages = await buildOpencodeMessages(request, attachments);
    const body = {
      model: request.model,
      messages,
      stream: true,
      ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
      ...(typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}),
      ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
    };

    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
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

    let text = "";
    let textIndex = 0;
    let textOpen = false;
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";

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
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text } };
          textOpen = false;
        }
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        reasoning.text += reasoningDelta;
        yield { type: "reasoning-delta", index: reasoning.index, text: reasoningDelta };
      }

      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text += content;
        yield { type: "text-delta", index: textIndex, text: content };
      }

      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }

    if (reasoning) {
      yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
    }
    if (textOpen) {
      yield { type: "block-end", index: textIndex, block: { type: "text", text } };
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
