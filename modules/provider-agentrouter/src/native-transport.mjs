import {
  fetchNativeResponse,
  finishReason,
  guardEmptyCompletion,
  nativeProviderError,
  normalizeUsage,
  readSseEvents,
  resolveImageData,
  sanitizeToolCallId,
  textFromContent,
  validateNativeEndpoint,
} from "../../../packages/providers/src/native-transport.mjs";

const PROVIDER_ID = "agentrouter";

export const DEFAULT_AGENTROUTER_ENDPOINT = "https://agentrouter.org/v1/chat/completions";
export const DEFAULT_AGENTROUTER_MODELS_ENDPOINT = "https://agentrouter.org/v1/models";

/** GPT-6-class models on this service answer only through the Responses API. */
export const DEFAULT_AGENTROUTER_RESPONSES_ENDPOINT = "https://agentrouter.org/v1/responses";

/**
 * AgentRouter only answers clients on an allow-list, and it decides that from
 * the User-Agent: `curl`, `python-requests` and DSH's own client all get
 * "unauthorized client detected" before the key is even looked at, while a
 * Cline/opencode/Kilo user agent is let through to the key check. The value is
 * configurable so a changed policy can be followed without a release.
 */
export const DEFAULT_AGENTROUTER_USER_AGENT = "Cline/3.2.0";

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
    if (toolCallPart(part)) continue;
    const text = textFromContent(part);
    if (text) blocks.push({ type: "text", text });
  }
  return blocks;
}

export async function buildAgentRouterMessages(request, attachments) {
  const result = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    result.push({ role: "system", content: request.system });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "tool" : "user";
    if (role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: sanitizeToolCallId(firstString(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        content: textFromContent(message.content ?? message.text ?? message.output ?? message.result),
      });
      continue;
    }
    const content = await openAiContent(message?.content ?? message?.text, attachments);
    const calls = (Array.isArray(message?.content) ? message.content : [message?.content])
      .map(toolCallPart)
      .filter(Boolean)
      .map((call, index) => ({
        id: sanitizeToolCallId(firstString(call.id, call.toolCallId, call.tool_call_id, `tool-${index}`)),
        type: "function",
        function: {
          name: firstString(call.name, call.function?.name, "tool"),
          arguments: typeof (call.arguments ?? call.function?.arguments) === "string"
            ? (call.arguments ?? call.function.arguments)
            : JSON.stringify(call.arguments ?? call.input ?? call.function?.arguments ?? {}),
        },
      }));
    const value = {
      role,
      content: content.length === 0 ? "" : content.length === 1 && content[0].type === "text" ? content[0].text : content,
    };
    if (role === "assistant" && calls.length > 0) value.tool_calls = calls;
    result.push(value);
  }
  if (!result.some((message) => message.role === "user")) result.push({ role: "user", content: "Continue the conversation." });
  return result;
}

function buildAgentRouterTools(tools) {
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

export async function buildAgentRouterRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildAgentRouterMessages(request, context.attachments),
    stream: true,
    stream_options: { include_usage: true },
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const maxTokens = request.maxTokens ?? request.modelContext?.maxTokens;
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
  const tools = buildAgentRouterTools(request.tools);
  if (tools) body.tools = tools;
  return body;
}

async function* streamAgentRouterResponse(response) {
  let text = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  const tools = new Map();
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
      throw nativeProviderError(PROVIDER_ID, payload.error.message ?? "AgentRouter returned an error", {
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
    throw nativeProviderError(
      PROVIDER_ID,
      "AgentRouter 流在没有 finish_reason 或 [DONE] 的情况下结束，响应可能被截断",
      { code: "AGENTROUTER_TRUNCATED_STREAM" },
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

/** Map a reasoning effort onto the values the Responses API accepts. */
function responsesEffort(raw) {
  const value = String(raw ?? "").toLowerCase();
  if (!value) return null;
  if (value === "minimal" || value === "low") return "low";
  if (value === "medium") return "medium";
  // xhigh/max are DSH's names for "as much as possible".
  if (value === "high" || value === "xhigh" || value === "max") return "high";
  return null;
}

/** Convert DSH messages into Responses API input items. */
export async function buildAgentRouterResponsesInput(request, attachments) {
  const items = [];
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role;
    if (role === "tool") {
      items.push({
        type: "function_call_output",
        call_id: sanitizeToolCallId(firstString(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        output: textFromContent(message.content ?? message.text ?? message.output ?? message.result),
      });
      continue;
    }
    const calls = (Array.isArray(message?.content) ? message.content : [message?.content])
      .map(toolCallPart)
      .filter(Boolean)
      .map((call, index) => ({
        type: "function_call",
        call_id: sanitizeToolCallId(firstString(call.id, call.toolCallId, call.tool_call_id, `tool-${index}`)),
        name: firstString(call.name, call.function?.name, "tool"),
        arguments: typeof (call.arguments ?? call.function?.arguments) === "string"
          ? (call.arguments ?? call.function.arguments)
          : JSON.stringify(call.arguments ?? call.input ?? call.function?.arguments ?? {}),
      }));
    items.push(...calls);
    const content = await openAiContent(message?.content ?? message?.text, attachments);
    if (content.length > 0) {
      const mapped = content.map((part) => (part.type === "image_url"
        ? { type: "input_image", image_url: part.image_url.url }
        : { type: role === "assistant" ? "output_text" : "input_text", text: part.text }));
      items.push({ role: role === "assistant" ? "assistant" : "user", content: mapped });
    }
  }
  return items;
}

export async function buildAgentRouterResponsesRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    input: await buildAgentRouterResponsesInput(request, context.attachments),
    stream: true,
  };
  if (typeof request.system === "string" && request.system.length > 0) body.instructions = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const maxTokens = request.maxTokens ?? request.modelContext?.maxTokens;
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_output_tokens = maxTokens;
  const effort = responsesEffort(request.reasoningEffort ?? request.reasoning_effort);
  if (effort) body.reasoning = { effort };
  const tools = buildAgentRouterTools(request.tools);
  if (tools) {
    body.tools = tools.map((tool) => ({
      type: "function",
      name: tool.function.name,
      ...(tool.function.description ? { description: tool.function.description } : {}),
      parameters: tool.function.parameters,
    }));
  }
  return body;
}

async function* streamAgentRouterResponses(response) {
  let text = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  let terminated = false;
  const tools = new Map();
  yield { type: "block-start", index: textIndex, blockType: "text" };

  const ensureReasoning = function* (delta) {
    if (textOpen) {
      yield { type: "block-end", index: textIndex, block: { type: "text", text } };
      textOpen = false;
    }
    if (!reasoning) {
      reasoning = { index: nextIndex++, text: "" };
      yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
    }
    reasoning.text += delta;
    yield { type: "reasoning-delta", index: reasoning.index, text: delta };
  };

  for await (const event of readSseEvents(response)) {
    if (event?.done) {
      terminated = true;
      continue;
    }
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    const type = typeof payload.type === "string" ? payload.type : (event.event ?? "");
    if (type === "response.error" || type === "response.failed" || payload.error) {
      const detail = payload.error?.message ?? payload.response?.error?.message ?? "AgentRouter returned an error";
      throw nativeProviderError(PROVIDER_ID, detail, { body: payload });
    }
    if (payload.response?.usage) usage = normalizeUsage(payload.response.usage) ?? usage;
    if (payload.usage) usage = normalizeUsage(payload.usage) ?? usage;

    if (type === "response.output_text.delta" && typeof payload.delta === "string" && payload.delta) {
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
      text += payload.delta;
      yield { type: "text-delta", index: textIndex, text: payload.delta };
      continue;
    }
    if ((type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta")
      && typeof payload.delta === "string" && payload.delta) {
      yield* ensureReasoning(payload.delta);
      continue;
    }
    if (type === "response.output_item.added" && payload.item?.type === "function_call") {
      const item = payload.item;
      const key = firstString(item.call_id, item.id, `tool-${tools.size}`);
      const state = { index: nextIndex++, id: key, name: firstString(item.name, "tool"), arguments: "" };
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (textOpen) {
        yield { type: "block-end", index: textIndex, block: { type: "text", text } };
        textOpen = false;
      }
      tools.set(key, state);
      yield { type: "block-start", index: state.index, blockType: "tool-call" };
      continue;
    }
    if (type === "response.function_call_arguments.delta") {
      const state = tools.get(payload.item_id) ?? [...tools.values()].at(-1);
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      if (state && delta) {
        state.arguments += delta;
        yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: delta };
      }
      continue;
    }
    if (type === "response.completed" || type === "response.done") {
      terminated = true;
      stop = tools.size > 0 ? "tool_calls" : "stop";
      continue;
    }
  }

  if (!terminated) {
    throw nativeProviderError(
      PROVIDER_ID,
      "AgentRouter（Responses）流在没有完成事件的情况下结束，响应可能被截断",
      { code: "AGENTROUTER_TRUNCATED_STREAM" },
    );
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text } };
  for (const state of tools.values()) {
    yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: tools.size > 0 ? { kind: "tool-calls" } : finishReason(stop) };
}

export function createAgentRouterNativeExecutor({
  endpoint = process.env.DOCKYARD_AGENTROUTER_ENDPOINT || DEFAULT_AGENTROUTER_ENDPOINT,
  responsesEndpoint = process.env.DOCKYARD_AGENTROUTER_RESPONSES_ENDPOINT || DEFAULT_AGENTROUTER_RESPONSES_ENDPOINT,
  env = process.env,
  timeoutMs = 300_000,
  fetchImpl = fetch,
  userAgent = process.env.DOCKYARD_AGENTROUTER_USER_AGENT || DEFAULT_AGENTROUTER_USER_AGENT,
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  const safeResponses = validateNativeEndpoint(responsesEndpoint, { providerId: PROVIDER_ID });

  const send = async (url, body, token, signal) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "text/event-stream",
        // Without an allow-listed client string the endpoint rejects the request
        // before it ever checks the key.
        "user-agent": userAgent,
      },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    });
    return response;
  };

  const executor = async ({ request = {}, credential, context = {} } = {}) => {
    const token = firstString(credential?.apiKey, credential?.access, env.AGENTROUTER_API_KEY);
    if (!token) {
      const error = nativeProviderError(PROVIDER_ID, "AgentRouter API Key 未配置，请在面板中粘贴 sk- 开头的 Key");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    const chatResponse = await send(safeEndpoint, await buildAgentRouterRequest(request, context), token, context.signal);
    if (chatResponse.ok) return streamAgentRouterResponse(chatResponse);

    // GPT-6-class models refuse chat-completions outright and name the API they
    // want; follow that instead of surfacing a dead end to the user.
    const detail = await chatResponse.text().catch(() => "");
    if (/\/v1\/responses/u.test(detail) || /does not support/iu.test(detail)) {
      const responsesResponse = await send(safeResponses, await buildAgentRouterResponsesRequest(request, context), token, context.signal);
      if (responsesResponse.ok) return streamAgentRouterResponses(responsesResponse);
      const responsesDetail = await responsesResponse.text().catch(() => "");
      throw nativeProviderError(PROVIDER_ID, `AgentRouter 拒绝了请求（${responsesResponse.status}）：${responsesDetail.slice(0, 200)}`, {
        status: responsesResponse.status,
      });
    }
    throw nativeProviderError(PROVIDER_ID, `AgentRouter 拒绝了请求（${chatResponse.status}）：${detail.slice(0, 200)}`, {
      status: chatResponse.status,
    });
  };
  executor.nativeTransport = "agentrouter-openai-completions";
  return guardEmptyCompletion(executor, { providerId: PROVIDER_ID });
}

export const agentRouterNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID,
  endpoint: DEFAULT_AGENTROUTER_ENDPOINT,
  modelsEndpoint: DEFAULT_AGENTROUTER_MODELS_ENDPOINT,
  responsesEndpoint: DEFAULT_AGENTROUTER_RESPONSES_ENDPOINT,
  userAgent: DEFAULT_AGENTROUTER_USER_AGENT,
});
