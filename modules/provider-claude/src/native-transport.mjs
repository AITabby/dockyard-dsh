import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  guardEmptyCompletion,
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
import { addSecondsIso, isoFromEpoch } from "../../../packages/providers/src/provider-utils.mjs";

const PROVIDER_ID = "claude";
const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function oauthTokenFromJson(value) {
  const oauth = value?.claudeAiOauth ?? value?.oauth ?? value?.credentials ?? value;
  const token = firstString(oauth?.accessToken, oauth?.access_token, value?.accessToken, value?.access_token);
  return token ? { token, kind: "oauth" } : null;
}

function claudeOAuthCredentialFromJson(value) {
  const oauth = value?.claudeAiOauth ?? value?.oauth ?? value?.credentials ?? value;
  const access = firstString(oauth?.accessToken, oauth?.access_token, value?.accessToken, value?.access_token);
  if (!access) return null;
  const refresh = firstString(oauth?.refreshToken, oauth?.refresh_token, value?.refreshToken, value?.refresh_token);
  const expiresAt = isoFromEpoch(
    oauth?.expiresAt
      ?? oauth?.expires_at
      ?? oauth?.expiryDate
      ?? oauth?.expiry_date
      ?? value?.expiresAt
      ?? value?.expires_at,
  ) ?? addSecondsIso(oauth?.expiresIn ?? oauth?.expires_in ?? value?.expiresIn ?? value?.expires_in);
  return {
    type: "oauth",
    providerId: "claude",
    access,
    ...(refresh ? { refresh } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(Array.isArray(oauth?.scopes) ? { scopes: oauth.scopes.map(String) } : {}),
  };
}

/** Read Claude Code's persisted OAuth credential without exposing it in status output. */
export async function readClaudeOAuthCredential({ home = homedir() } = {}) {
  for (const path of [
    join(home, ".claude", ".credentials.json"),
    join(home, ".opencodex", "claude_desktop_auth.json"),
  ]) {
    const credential = claudeOAuthCredentialFromJson(await readJson(path));
    if (credential) return credential;
  }
  return null;
}

/**
 * Resolve the active Claude subscription token without invoking `claude -p`.
 *
 * When the request is bound to a selected subscription account
 * (`accountBound`), a missing token must surface as an auth error instead of
 * silently re-billing the request as an unrelated global credential.
 */
export async function resolveClaudeAccessToken({
  credential,
  env = process.env,
  home = homedir(),
  accountBound = false,
} = {}) {
  const stored = firstString(credential?.access, credential?.token);
  if (stored) return { token: stored, kind: credential?.type === "api_key" ? "apiKey" : "oauth" };
  // The fallbacks below are machine-global and belong to no account in
  // particular, so a bound subscription account must never inherit them.
  if (accountBound) return null;
  const apiKey = firstString(env.ANTHROPIC_API_KEY);
  if (apiKey) return { token: apiKey, kind: "apiKey" };
  const envToken = firstString(env.CLAUDE_CODE_OAUTH_TOKEN, env.ANTHROPIC_AUTH_TOKEN);
  if (envToken) return { token: envToken, kind: "oauth" };
  for (const path of [
    join(home, ".claude", ".credentials.json"),
    join(home, ".opencodex", "claude_desktop_auth.json"),
  ]) {
    const found = oauthTokenFromJson(await readJson(path));
    if (found) return found;
  }
  return null;
}

function toolCallPart(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "tooluse" || type === "functioncall"
    ? part
    : null;
}

async function anthropicContent(content, attachments) {
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
      blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({
        type: "tool_result",
        tool_use_id: firstString(part.toolCallId, part.tool_call_id, part.id, "tool-result"),
        content: textFromContent(part.content ?? part.output ?? part.result ?? part.text),
        ...(part.isError || part.is_error ? { is_error: true } : {}),
      });
      continue;
    }
    const tool = toolCallPart(part);
    if (tool) {
      blocks.push({
        type: "tool_use",
        id: firstString(tool.id, tool.toolCallId, tool.tool_call_id, `tool-${blocks.length}`),
        name: firstString(tool.name, tool.function?.name, "tool"),
        input: parseToolArguments(tool.arguments ?? tool.input ?? tool.function?.arguments),
      });
      continue;
    }
    const text = textFromContent(part);
    if (text) blocks.push({ type: "text", text });
  }
  return blocks;
}

async function buildAnthropicMessages(request, attachments) {
  const messages = [];
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "user" : "user";
    const content = await anthropicContent(message?.content ?? message?.text, attachments);
    if (role === "user" && message?.role === "tool" && content.length === 0) continue;
    if (content.length > 0) messages.push({ role, content: content.length === 1 && content[0].type === "text" ? content[0].text : content });
  }
  if (messages.length === 0) messages.push({ role: "user", content: "Continue the conversation." });
  return messages;
}

function buildAnthropicTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const result = tools.map((tool) => ({
    name: firstString(tool?.name, tool?.function?.name, "tool"),
    ...(tool?.description ? { description: String(tool.description) } : {}),
    input_schema: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" },
  }));
  return result.length > 0 ? result : undefined;
}

function thinkingBudget(request) {
  const value = request?.reasoningBudget ?? request?.thinkingBudget;
  if (Number.isInteger(value) && value > 0) return value;
  const effort = String(request?.reasoningEffort ?? "").toLowerCase();
  if (effort === "high" || effort === "xhigh") return 16_000;
  if (effort === "medium") return 8_000;
  if (effort === "low") return 4_000;
  return null;
}

function invalidRequestError(message) {
  const error = new Error(message);
  error.code = "INVALID_ARGUMENT";
  error.providerId = PROVIDER_ID;
  return error;
}

function resolveMaxTokens(request) {
  const value = Number.isInteger(request.maxTokens)
    ? request.maxTokens
    : Number.isInteger(request.modelContext?.maxTokens) ? request.modelContext.maxTokens : 4096;
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidRequestError(`Claude max_tokens must be a positive integer, received ${value}`);
  }
  return value;
}

export async function buildClaudeRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildAnthropicMessages(request, context.attachments),
    max_tokens: resolveMaxTokens(request),
    stream: true,
  };
  if (typeof request.system === "string" && request.system.length > 0) body.system = request.system;
  const tools = buildAnthropicTools(request.tools);
  if (tools) body.tools = tools;
  const budget = thinkingBudget(request);
  if (budget && body.max_tokens > budget) {
    // Anthropic rejects temperature on extended-thinking requests with a
    // stable 4xx, so a thinking budget excludes the parameter entirely.
    body.thinking = { type: "enabled", budget_tokens: budget };
  } else if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }
  return body;
}

function headersForToken(auth) {
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream",
    "anthropic-version": "2023-06-01",
  };
  if (auth.kind === "apiKey" || auth.token.startsWith("sk-ant-")) {
    headers["x-api-key"] = auth.token;
  } else {
    headers.authorization = `Bearer ${auth.token}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
    headers["anthropic-client-platform"] = "DESKTOP_APP";
    headers["anthropic-client-version"] = "1.0.0";
  }
  return headers;
}

function mergeUsage(previous, next) {
  return next ? { ...(previous ?? {}), ...next } : previous;
}

/**
 * Build the protocol error for a stream that ended without any terminal
 * message event. `protocolError` sits beside `authExpired`/`quotaExhausted`
 * so callers can tell truncation apart from auth or quota failures.
 */
function claudeStreamProtocolError() {
  const error = nativeProviderError(PROVIDER_ID, "SSE stream ended before message_stop; the response was truncated");
  error.code = "SSE_PROTOCOL_ERROR";
  error.protocolError = true;
  return error;
}

async function* streamClaudeResponse(response) {
  let text = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  // A properly opened message must be closed by a terminal event before the
  // stream may count as successful; `message_delta` already carries the
  // authoritative stop_reason/usage, while `message_stop` is the close frame.
  let messageOpened = false;
  let terminated = false;
  const tools = new Map();
  const reasoning = new Map();
  yield { type: "block-start", index: textIndex, blockType: "text" };

  for await (const event of readSseEvents(response)) {
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.type === "message_start") {
      messageOpened = true;
      usage = mergeUsage(usage, normalizeUsage(payload.message?.usage));
      continue;
    }
    if (payload.type === "content_block_start") {
      const block = payload.content_block ?? {};
      if (block.type === "tool_use" || block.type === "thinking" || block.type === "redacted_thinking") {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text } };
          textOpen = false;
        }
        const index = nextIndex++;
        if (block.type === "tool_use") {
          tools.set(payload.index, {
            index,
            id: firstString(block.id, `tool-${payload.index}`),
            name: firstString(block.name, "tool"),
            arguments: "",
          });
          yield { type: "block-start", index, blockType: "tool-call" };
        } else {
          reasoning.set(payload.index, { index, text: "" });
          yield { type: "block-start", index, blockType: "reasoning" };
        }
        continue;
      }
      if (block.type === "text" && !textOpen) {
        textIndex = nextIndex++;
        text = "";
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      continue;
    }
    if (payload.type === "content_block_delta") {
      const delta = payload.delta ?? {};
      if (delta.type === "text_delta" && delta.text) {
        if (!textOpen) {
          textIndex = nextIndex++;
          text = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text += delta.text;
        yield { type: "text-delta", index: textIndex, text: delta.text };
      } else if (delta.type === "thinking_delta" && delta.thinking) {
        let state = reasoning.get(payload.index);
        if (!state) {
          if (textOpen) {
            yield { type: "block-end", index: textIndex, block: { type: "text", text } };
            textOpen = false;
          }
          state = { index: nextIndex++, text: "" };
          reasoning.set(payload.index, state);
          yield { type: "block-start", index: state.index, blockType: "reasoning" };
        }
        state.text += delta.thinking;
        yield { type: "reasoning-delta", index: state.index, text: delta.thinking };
      } else if (delta.type === "input_json_delta" && tools.has(payload.index)) {
        const tool = tools.get(payload.index);
        tool.arguments += delta.partial_json ?? "";
        yield { type: "tool-call-delta", index: tool.index, id: tool.id, name: tool.name, argumentsDelta: delta.partial_json ?? "" };
      }
      continue;
    }
    if (payload.type === "content_block_stop") {
      const thought = reasoning.get(payload.index);
      if (thought) {
        yield { type: "block-end", index: thought.index, block: { type: "reasoning", text: thought.text } };
        reasoning.delete(payload.index);
      }
      const tool = tools.get(payload.index);
      if (tool) {
        yield {
          type: "block-end",
          index: tool.index,
          block: { type: "tool-call", id: tool.id, name: tool.name, arguments: tool.arguments || "{}" },
        };
        tools.delete(payload.index);
      }
      continue;
    }
    if (payload.type === "message_delta") {
      terminated = true;
      stop = payload.delta?.stop_reason ?? stop;
      usage = mergeUsage(usage, normalizeUsage(payload.usage));
      continue;
    }
    if (payload.type === "message_stop") {
      terminated = true;
      continue;
    }
    if (payload.type === "error") {
      throw nativeProviderError(PROVIDER_ID, payload.error?.message ?? "Anthropic returned an error", {
        status: payload.error?.status,
        body: payload.error,
      });
    }
  }

  // A network truncation ends the loop without any terminal event; reporting
  // finish(stop) here would dress an incomplete response up as a success.
  if (messageOpened && !terminated) throw claudeStreamProtocolError();

  for (const thought of reasoning.values()) {
    yield { type: "block-end", index: thought.index, block: { type: "reasoning", text: thought.text } };
  }
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text } };
  for (const tool of tools.values()) {
    yield {
      type: "block-end",
      index: tool.index,
      block: { type: "tool-call", id: tool.id, name: tool.name, arguments: tool.arguments || "{}" },
    };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}

export function createClaudeNativeExecutor({
  endpoint = process.env.DOCKYARD_CLAUDE_ENDPOINT || DEFAULT_ENDPOINT,
  env = process.env,
  home = homedir(),
  timeoutMs = 300_000,
  fetchImpl = fetch,
  tokenResolver = resolveClaudeAccessToken,
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
    // A pool-routed request is bound to one selected subscription identity:
    // without that account's own token it must fail loudly instead of being
    // re-billed as an unrelated global API key or environment credential.
    const accountBound = Boolean(ref || invocation?.account?.accountId);
    if (context.secretStore && ref) {
      credential = await context.secretStore.read(ref);
    }
    const auth = await tokenResolver({ credential, env: { ...env, ...(context.env ?? {}) }, home, accountBound });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID, accountBound
        ? "Claude subscription OAuth token is unavailable for the selected account; authorize Claude again"
        : "Claude OAuth token is unavailable; authorize Claude first");
      error.authExpired = true;
      throw error;
    }
    const body = await buildClaudeRequest(request, context);
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers: headersForToken(auth),
      body: JSON.stringify(body),
      signal: context.signal,
    }, { providerId: PROVIDER_ID, timeoutMs, fetchImpl });
    return streamClaudeResponse(response);
  };
  executor.nativeTransport = "anthropic-messages";
  return guardEmptyCompletion(executor, { providerId: PROVIDER_ID });
}

export const claudeNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID,
  endpoint: DEFAULT_ENDPOINT,
});
