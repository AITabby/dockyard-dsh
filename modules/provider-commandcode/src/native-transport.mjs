import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DsmlStreamFilter,
  cleanupNativeResponse,
  fetchNativeResponse,
  finishReason,
  nativeProviderError,
  normalizeUsage,
  readSseEvents,
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

export function buildCommandCodeMessages(request = {}) {
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  let systemPrompt = "";
  const wireMessages = [];

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
      if (Array.isArray(msg.content)) {
        const content = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            content.push({ type: "text", text: block.text });
          } else if (block.type === "tool_use" || block.type === "tool-call") {
            content.push({
              type: "tool-call",
              toolCallId: block.id || block.toolCallId || `call_${randomUUID().slice(0, 8)}`,
              toolName: block.name || block.toolName || "tool",
              input: block.input ?? block.args ?? {},
            });
          }
        }
        wireMessages.push({ role: "assistant", content: content.length > 0 ? content : [{ type: "text", text: "" }] });
      } else {
        const text = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
        wireMessages.push({ role: "assistant", content: text || "" });
      }
      continue;
    }

    if (role === "tool") {
      const toolCallId = msg.tool_call_id || msg.toolCallId;
      const text = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      wireMessages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: toolCallId || "unknown",
            toolName: msg.name || "unknown",
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
        } else if (block.type === "image" && block.image) {
          parts.push({
            type: "image",
            image: block.image.startsWith("data:") ? block.image : `data:${block.mimeType || "image/png"};base64,${block.image}`,
            mimeType: block.mimeType || "image/png",
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

export function createCommandCodeNativeExecutor({
  endpoint = DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 180_000,
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint, "COMMANDCODE_ENDPOINT", {
    defaultEndpoint: DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  });

  return async function* commandCodeNativeExecutor({
    request = {},
    account = null,
    credential = null,
    signal = null,
  } = {}) {
    const auth = credential || account?.auth || extractCommandCodeAuth();
    const apiKey = auth?.apiKey || auth?.access || auth?.token;

    if (!apiKey) {
      const err = new Error("Command Code API Key 未配置，请先运行 cmd login 或在面板中设置 API Key。");
      err.code = "AUTH_REQUIRED";
      err.providerId = PROVIDER_ID;
      throw err;
    }

    const sessionId = request.sessionId || `dsh-${randomUUID()}`;
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "command-code/1.88.1",
      "x-command-code-version": "1.88.1",
      "x-cli-environment": "production",
      "x-session-id": sessionId,
      Authorization: `Bearer ${apiKey}`,
    };

    const { systemPrompt, wireMessages } = buildCommandCodeMessages(request);
    const wireTools = toWireTools(request.tools);

    const body = {
      config: {
        workingDir: process.cwd(),
        date: new Date().toISOString(),
        environment: "production",
        structure: [],
        isGitRepo: false,
        currentBranch: "main",
        mainBranch: "main",
        gitStatus: "",
        recentCommits: [],
      },
      memory: "",
      taste: null,
      skills: null,
      permissionMode: "standard",
      params: {
        model: request.model || "deepseek/deepseek-v4.1-flash",
        messages: wireMessages,
        ...(wireTools ? { tools: wireTools } : {}),
        ...(systemPrompt ? { system: systemPrompt } : {}),
        stream: true,
        ...(typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}),
        ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
        ...(request.reasoning?.effort ? { reasoning_effort: request.reasoning.effort } : {}),
      },
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

    for await (const event of readNdjsonLines(response, { signal, timeoutMs, providerId: PROVIDER_ID })) {
      if (!event || typeof event !== "object") continue;

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
      }
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
  };
}
