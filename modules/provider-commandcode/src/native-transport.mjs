import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DsmlStreamFilter,
  guardEmptyCompletion,
  cleanupNativeResponse,
  fetchNativeResponse,
  finishReason,
  nativeProviderError,
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

const PROVIDER_ID = "commandcode";
export const DEFAULT_COMMANDCODE_API_URL = "https://api.commandcode.ai";
export const DEFAULT_COMMANDCODE_GENERATE_ENDPOINT = "https://api.commandcode.ai/alpha/generate";
export const DEFAULT_COMMANDCODE_WHOAMI_ENDPOINT = "https://api.commandcode.ai/alpha/whoami";
export const DEFAULT_COMMANDCODE_CREDITS_ENDPOINT = "https://api.commandcode.ai/alpha/billing/credits";
export const DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT = "https://api.commandcode.ai/alpha/billing/subscriptions";
export const DEFAULT_COMMANDCODE_MODELS_ENDPOINT = "https://api.commandcode.ai/provider/v1/models?view=client";

let cachedAuth = null;
let cachedAuthMtime = 0;

export function findCommandCodeAuthFilePath() {
  if (process.env.COMMAND_CODE_AUTH_PATH && existsSync(process.env.COMMAND_CODE_AUTH_PATH)) {
    return process.env.COMMAND_CODE_AUTH_PATH;
  }
  const candidate = join(homedir(), ".commandcode", "auth.json");
  if (existsSync(candidate)) return candidate;
  return null;
}

export function extractCommandCodeAuth({ force = false } = {}) {
  const envKey = firstString(process.env.COMMAND_CODE_API_KEY, process.env.COMMANDCODE_API_KEY);
  if (envKey) {
    return {
      apiKey: envKey,
      userId: process.env.COMMAND_CODE_USER_ID || "env-user",
      userName: process.env.COMMAND_CODE_USER_NAME || "API Key User",
      source: "env",
    };
  }

  const authPath = findCommandCodeAuthFilePath();
  if (!authPath) return null;

  try {
    const raw = readFileSync(authPath, "utf8");
    const json = JSON.parse(raw);
    if (!json?.apiKey) return null;
    return {
      apiKey: json.apiKey,
      userId: json.userId || null,
      userName: json.userName || null,
      keyName: json.keyName || null,
      authenticatedAt: json.authenticatedAt || null,
      source: "local_auth_json",
    };
  } catch {
    return null;
  }
}

export function toWireTools(tools = []) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  return tools.map((tool) => {
    const fn = tool.function || tool;
    const name = fn.name || tool.name;
    const description = fn.description || tool.description || "";
    const inputSchema = fn.parameters || fn.input_schema || tool.input_schema || tool.parameters || { type: "object", properties: {} };
    return {
      name,
      description,
      input_schema: inputSchema,
    };
  });
}

export function isLikelyReasoningModel(modelId = "") {
  const m = String(modelId || "").toLowerCase();
  return (
    m.includes("beam") ||
    m.includes("r1") ||
    m.includes("reason") ||
    m.includes("reflection") ||
    m.includes("deepseek-r") ||
    m.includes("qwq") ||
    m.includes("qvq") ||
    m.includes("deepseek-reasoner")
  );
}

export async function buildCommandCodeMessages(request = {}, attachments = null) {
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  let systemPrompt = "";
  const wireMessages = [];
  const toolNameById = new Map();
  const needsReasoningPadding = isLikelyReasoningModel(request.model) || Boolean(request.reasoning?.effort);

  for (const msg of rawMessages) {
    if (!msg) continue;
    const role = msg.role;
    if (role === "system") {
      const text = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      if (text) {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${text}` : text;
      }
      continue;
    }

    if (role === "assistant") {
      let reasoningContent = firstString(
        msg.reasoning_content,
        msg.reasoning,
        msg.thought,
        msg.thinking,
      );
      if (Array.isArray(msg.content)) {
        const content = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            content.push({ type: "text", text: block.text });
          } else if (block.type === "reasoning" || block.type === "thinking") {
            const rText = block.text || block.thinking || "";
            if (rText) {
              content.push({ type: "reasoning", text: rText });
              if (!reasoningContent) reasoningContent = rText;
            }
          } else if (block.type === "tool_use" || block.type === "tool-call") {
            const rawId = block.id || block.toolCallId || `call_${randomUUID().slice(0, 8)}`;
            const toolCallId = sanitizeToolCallId(rawId);
            const toolName = block.name || block.toolName || "tool";
            toolNameById.set(toolCallId, toolName);

            const rawInput = block.arguments ?? block.input ?? block.args ?? {};
            let input = rawInput;
            if (typeof rawInput === "string") {
              try {
                input = JSON.parse(rawInput);
              } catch {
                input = { raw: rawInput };
              }
            }

            content.push({
              type: "tool-call",
              toolCallId,
              toolName,
              input: input && typeof input === "object" ? input : {},
            });
          }
        }
        const asstMsg = {
          role: "assistant",
          content: content.length > 0 ? content : [{ type: "text", text: "" }],
        };
        if (reasoningContent) {
          asstMsg.reasoning_content = reasoningContent;
        } else if (needsReasoningPadding) {
          asstMsg.reasoning_content = "";
        }
        wireMessages.push(asstMsg);
      } else {
        const text = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
        const asstMsg = { role: "assistant", content: text || "" };
        if (reasoningContent) {
          asstMsg.reasoning_content = reasoningContent;
        } else if (needsReasoningPadding) {
          asstMsg.reasoning_content = "";
        }
        wireMessages.push(asstMsg);
      }
      continue;
    }

    if (role === "tool") {
      const rawId = msg.tool_call_id || msg.toolCallId;
      const toolCallId = sanitizeToolCallId(rawId || "unknown");
      const toolName = msg.name || msg.toolName || (toolCallId ? toolNameById.get(toolCallId) : null) || "unknown";
      const text = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      wireMessages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: toolCallId || "unknown",
            toolName,
            output: { type: "text", value: text || "" },
          },
        ],
      });
      continue;
    }

    // User message
    if (Array.isArray(msg.content)) {
      const parts = [];
      for (const block of msg.content) {
        if (block.type === "text" && block.text) {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          // DSH hands us an opaque attachment reference; resolve it through the
          // durable attachment service so the gateway receives real image bytes.
          const resolved = await resolveImageData(block, attachments);
          if (!resolved) {
            throw nativeProviderError(
              PROVIDER_ID,
              "图片附件无法读取：缺少 DSH 附件服务或附件已失效，请重新粘贴图片",
            );
          }
          parts.push({
            type: "image",
            image: `data:${resolved.mediaType || "image/png"};base64,${resolved.data}`,
            mimeType: resolved.mediaType || "image/png",
          });
        }
      }
      wireMessages.push({ role: "user", content: parts.length > 0 ? parts : [{ type: "text", text: "" }] });
    } else {
      const text = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      wireMessages.push({ role: "user", content: text || "" });
    }
  }

  if (request.system && typeof request.system === "string") {
    systemPrompt = systemPrompt ? `${request.system}\n\n${systemPrompt}` : request.system;
  }

  return { systemPrompt, wireMessages };
}

async function* readNdjsonLines(response, { signal, timeoutMs, providerId } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        const err = new Error("Request aborted");
        err.name = "AbortError";
        throw err;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          try {
            yield JSON.parse(line);
          } catch {}
        }
        newline = buffer.indexOf("\n");
      }
    }
    const last = buffer.trim();
    if (last) {
      try {
        yield JSON.parse(last);
      } catch {}
    }
  } finally {
    reader.releaseLock();
    cleanupNativeResponse(response);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function toWireUuid(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (UUID_REGEX.test(trimmed)) return trimmed;
    const stripped = trimmed.replace(/^(?:session|dsh|thread)[-_:]+/i, "");
    if (UUID_REGEX.test(stripped)) return stripped;
  }
  return null;
}

export function deriveConversationSessionId(request, explicitSessionId) {
  const direct = toWireUuid(explicitSessionId) || toWireUuid(request?.sessionId);
  if (direct) return direct;

  const firstMsg = request?.messages?.[0];
  const seed = firstMsg
    ? (typeof firstMsg.content === "string" ? firstMsg.content : JSON.stringify(firstMsg.content || ""))
    : "default-dsh-session";
  const hash = createHash("sha256").update(seed.slice(0, 500)).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function createCommandCodeNativeExecutor({
  endpoint = DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 180_000,
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint, "COMMANDCODE_ENDPOINT", {
    defaultEndpoint: DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  });

  async function* commandCodeNativeExecutor({
    request = {},
    account = null,
    credential = null,
    signal = null,
    sessionId: explicitSessionId = null,
    attachments = null,
  } = {}) {
    const auth = credential || account?.auth || extractCommandCodeAuth();
    const apiKey = auth?.apiKey || auth?.access || auth?.token;

    if (!apiKey) {
      const err = new Error("Command Code API Key 未配置，请先运行 cmd login 或在面板中设置 API Key。");
      err.code = "AUTH_REQUIRED";
      err.providerId = PROVIDER_ID;
      throw err;
    }

    const sessionId = deriveConversationSessionId(request, explicitSessionId);
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "command-code/1.88.1",
      "x-command-code-version": "1.88.1",
      "x-cli-environment": "production",
      "x-session-id": sessionId,
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    };

    const { systemPrompt, wireMessages } = await buildCommandCodeMessages(request, attachments);
    const wireTools = toWireTools(request.tools);

    const today = new Date().toISOString().split("T")[0];
    const threadId = toWireUuid(sessionId);
    let attemptMessages = wireMessages;
    let retriedReasoning = false;

    while (true) {
      const body = {
        config: {
          workingDir: process.cwd(),
          date: today,
          environment: process.platform,
          structure: [],
          isGitRepo: false,
          currentBranch: "main",
          mainBranch: "main",
          gitStatus: "",
          recentCommits: [],
        },
        memory: null,
        taste: null,
        skills: null,
        permissionMode: "standard",
        ...(threadId ? { threadId } : {}),
        params: {
          model: request.model || "deepseek/deepseek-v4.1-flash",
          messages: attemptMessages,
          ...(wireTools ? { tools: wireTools } : {}),
          ...(systemPrompt ? { system: systemPrompt } : {}),
          stream: true,
          ...(typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}),
          ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
          ...(request.reasoning?.effort ? { reasoning_effort: request.reasoning.effort } : {}),
        },
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
      } catch (fetchErr) {
        if (/fetch failed/i.test(fetchErr?.message) && !signal?.aborted) {
          await new Promise((r) => setTimeout(r, 600));
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
        } else {
          throw fetchErr;
        }
      }

      const streamEvents = [];
      let nextIndex = 1;
      let reasoning = null;
      let rawUsage = null;
      let stop = "stop";
      let yieldedAny = false;
      let shouldRetryReasoning = false;
      const activeTools = new Map();

    const textFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "text" }),
      onTextDelta: (index, text) => streamEvents.push({ type: "text-delta", index, text }),
      onTextBlockEnd: (index, text) => streamEvents.push({ type: "block-end", index, block: { type: "text", text } }),
    });

    for await (const event of readNdjsonLines(response, { signal, timeoutMs, providerId: PROVIDER_ID })) {
      if (!event || typeof event !== "object") continue;

      if (event.type === "error") {
        const errObj = event.error || {};
        const msg = errObj.message || "Command Code upstream stream error";
        const status = errObj.statusCode || 500;
        if (!yieldedAny && !retriedReasoning && /reasoning_content/i.test(msg)) {
          shouldRetryReasoning = true;
          break;
        }
        throw nativeProviderError(PROVIDER_ID, msg, {
          status,
          code: errObj.type || "server_error",
        });
      }

      if (event.type === "reasoning-start") {
        textFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        continue;
      }

      if (event.type === "reasoning-delta") {
        const text = event.text ?? "";
        if (text) {
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          reasoning.text += text;
          yield { type: "reasoning-delta", index: reasoning.index, text };
        }
        continue;
      }

      if (event.type === "reasoning-end") {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        continue;
      }

      if (event.type === "text-delta") {
        const text = event.text ?? "";
        if (text) {
          if (reasoning) {
            yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
            reasoning = null;
          }
          textFilter.push(text, () => nextIndex++);
          while (streamEvents.length > 0) yield streamEvents.shift();
        }
        continue;
      }

      if (event.type === "tool-input-start") {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        textFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();

        const toolId = event.id || `call_${activeTools.size}_${randomUUID().slice(0, 8)}`;
        const state = {
          index: nextIndex++,
          id: toolId,
          name: event.toolName || "tool",
          arguments: "",
        };
        activeTools.set(toolId, state);
        yield { type: "block-start", index: state.index, blockType: "tool-call" };
        continue;
      }

      if (event.type === "tool-input-delta") {
        const toolId = event.id;
        const state = activeTools.get(toolId);
        const delta = event.delta ?? "";
        if (state && delta) {
          state.arguments += delta;
          yield {
            type: "tool-call-delta",
            index: state.index,
            id: state.id,
            name: state.name,
            argumentsDelta: delta,
          };
        }
        continue;
      }

      if (event.type === "tool-call") {
        const toolId = event.toolCallId || event.id;
        const existing = activeTools.get(toolId);
        if (!existing) {
          if (reasoning) {
            yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
            reasoning = null;
          }
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();

          const argsStr = typeof event.input === "string" ? event.input : JSON.stringify(event.input ?? {});
          const state = {
            index: nextIndex++,
            id: toolId || `call_${randomUUID().slice(0, 8)}`,
            name: event.toolName || "tool",
            arguments: argsStr,
          };
          yield { type: "block-start", index: state.index, blockType: "tool-call" };
          yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argsStr };
          yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: argsStr } };
        } else {
          yield {
            type: "block-end",
            index: existing.index,
            block: { type: "tool-call", id: existing.id, name: existing.name, arguments: existing.arguments },
          };
          activeTools.delete(toolId);
        }
        continue;
      }

      if (event.type === "finish" || event.type === "finish-step") {
        if (event.totalUsage) rawUsage = event.totalUsage;
        else if (event.usage) rawUsage = event.usage;
        if (event.finishReason) {
          stop = event.finishReason === "tool-calls" ? "tool_calls" : event.finishReason;
        }
        if (event.type === "finish-step" && rawUsage) {
          const stepUsage = normalizeUsage(rawUsage);
          if (stepUsage) {
            yield {
              type: "usage",
              usage: stepUsage,
            };
          }
        }
      }
    }

      if (shouldRetryReasoning) {
        retriedReasoning = true;
        attemptMessages = attemptMessages.map((m) => {
          if (m.role === "assistant" && typeof m.reasoning_content !== "string") {
            return { ...m, reasoning_content: "" };
          }
          return m;
        });
        continue;
      }

      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }

      textFilter.closeText();
      while (streamEvents.length > 0) yield streamEvents.shift();

      for (const [, state] of activeTools) {
        yield {
          type: "block-end",
          index: state.index,
          block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments },
        };
      }

      if (activeTools.size > 0 && (!stop || stop === "stop")) {
        stop = "tool_calls";
      }

      const finalUsage = normalizeUsage(rawUsage);
      if (finalUsage) {
        yield {
          type: "usage",
          usage: finalUsage,
        };
      }

      yield {
        type: "finish",
        reason: finishReason(stop),
        ...(finalUsage ? { usage: finalUsage } : {}),
      };
      break;
    }
  };
  return guardEmptyCompletion(commandCodeNativeExecutor, { providerId: PROVIDER_ID });
}
