import { homedir } from "node:os";

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

const PROVIDER_ID = "grok";
const DEFAULT_ENDPOINT = "https://api.x.ai/v1/chat/completions";

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
      blocks.push({ type: "text", text: `[Tool Result ${part.toolCallId ?? part.id ?? ""}]\n${textFromContent(part.content ?? part.output ?? part.result ?? part.text)}` });
      continue;
    }
    const call = toolCallPart(part);
    if (call) {
      blocks.push({ type: "text", text: `[Tool Call ${call.name ?? call.function?.name ?? "tool"}] ${JSON.stringify(parseToolArguments(call.arguments ?? call.input ?? call.function?.arguments))}` });
      continue;
    }
    const text = textFromContent(part);
    if (text) blocks.push({ type: "text", text });
  }
  return blocks;
}

async function buildGrokMessages(request, attachments) {
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
    const calls = (Array.isArray(message?.content) ? message.content : [message?.content])
      .map(toolCallPart)
      .filter(Boolean)
      .map((call, index) => ({
        id: firstString(call.id, call.toolCallId, call.tool_call_id, `tool-${index}`),
        type: "function",
        function: {
          name: firstString(call.name, call.function?.name, "tool"),
          arguments: typeof (call.arguments ?? call.function?.arguments) === "string"
            ? (call.arguments ?? call.function.arguments)
            : JSON.stringify(call.arguments ?? call.input ?? call.function?.arguments ?? {}),
        },
      }));
    const messageValue = {
      role,
      content: content.length === 0 ? "" : content.length === 1 && content[0].type === "text" ? content[0].text : content,
    };
    if (role === "assistant" && calls.length > 0) messageValue.tool_calls = calls;
    result.push(messageValue);
  }
  if (!result.some((message) => message.role === "user")) result.push({ role: "user", content: "Continue the conversation." });
  return result;
}

function buildGrokTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const result = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool?.name ?? tool?.function?.name ?? "tool",
      ...(tool?.description ? { description: String(tool.description) } : {}),
      parameters: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" },
    },
  }));
  return result.length > 0 ? result : undefined;
}

export async function buildGrokRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildGrokMessages(request, context.attachments),
    stream: true,
    stream_options: { include_usage: true },
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const maxTokens = request.maxTokens ?? request.modelContext?.maxTokens;
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
  if (request.reasoningEffort && request.purpose !== "compaction") body.reasoning_effort = request.reasoningEffort;
  const tools = buildGrokTools(request.tools);
  if (tools) body.tools = tools;
  return body;
}

async function* streamGrokResponse(response) {
  let text = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  const tools = new Map();
  // A canonical termination event is required before the stream may report
  // success: either the SSE [DONE] terminator or a valid finish_reason.
  // Without this check a network truncation would be masked as a "stop".
  let terminated = false;
  yield { type: "block-start", index: textIndex, blockType: "text" };

  for await (const event of readSseEvents(response)) {
    if (event?.done) {
      terminated = true;
      continue;
    }
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.error) {
      throw nativeProviderError(PROVIDER_ID, payload.error.message ?? "xAI returned an error", {
        status: payload.error.code ?? payload.error.status,
        body: payload.error,
      });
    }
    usage = normalizeUsage(payload.usage) ?? usage;
    const choice = payload.choices?.[0];
    if (!choice) continue;
    stop = choice.finish_reason ?? stop;
    if (typeof choice.finish_reason === "string" && choice.finish_reason.trim()) terminated = true;
    const delta = choice.delta ?? {};
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
    const reasoningDelta = delta.reasoning_content ?? delta.reasoningContent;
    if (reasoningDelta) {
      if (textOpen) {
        yield { type: "block-end", index: textIndex, block: { type: "text", text } };
        textOpen = false;
      }
      if (!reasoning) {
        reasoning = { index: nextIndex++, text: "" };
        yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
      }
      const value = String(reasoningDelta);
      reasoning.text += value;
      yield { type: "reasoning-delta", index: reasoning.index, text: value };
    }
    for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const key = Number(call.index ?? tools.size);
      if (!tools.has(key)) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text } };
          textOpen = false;
        }
        const state = {
          index: nextIndex++,
          id: firstString(call.id, `tool-${key}`),
          name: firstString(call.function?.name, call.name, "tool"),
          arguments: "",
        };
        tools.set(key, state);
        yield { type: "block-start", index: state.index, blockType: "tool-call" };
      }
      const state = tools.get(key);
      const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
      if (call.id) state.id = call.id;
      if (call.function?.name) state.name = call.function.name;
      state.arguments += argumentDelta;
      if (argumentDelta) {
        yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
      }
    }
  }
  if (!terminated) {
    // Neither [DONE] nor a finish_reason arrived: the connection was cut
    // before the model finished. Fail as a protocol error instead of closing
    // the generator with a synthetic "stop" success.
    throw nativeProviderError(
      PROVIDER_ID,
      "xAI stream ended without a finish_reason or [DONE] terminator; the response may be truncated",
      { code: "GROK_TRUNCATED_STREAM" },
    );
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text } };
  for (const state of tools.values()) {
    yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}

export function createGrokNativeExecutor({
  endpoint = process.env.DOCKYARD_GROK_ENDPOINT || DEFAULT_ENDPOINT,
  env = process.env,
  timeoutMs = 300_000,
  fetchImpl = fetch,
  userAgent = process.env.DOCKYARD_GROK_USER_AGENT,
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  const executor = async ({ request = {}, credential, context = {} } = {}) => {
    const effectiveEnv = { ...env, ...(context.env ?? {}) };
    const token = firstString(credential?.access, effectiveEnv.XAI_API_KEY, effectiveEnv.GROK_API_KEY);
    if (!token) {
      const error = nativeProviderError(PROVIDER_ID, "Grok OAuth token is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "text/event-stream",
    };
    const configuredUserAgent = userAgent ?? effectiveEnv.DOCKYARD_GROK_USER_AGENT;
    if (configuredUserAgent) headers["user-agent"] = configuredUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(await buildGrokRequest(request, context)),
      signal: context.signal,
    }, { providerId: PROVIDER_ID, timeoutMs, fetchImpl });
    return streamGrokResponse(response);
  };
  executor.nativeTransport = "xai-chat-completions";
  return executor;
}

export const grokNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID,
  endpoint: DEFAULT_ENDPOINT,
});
