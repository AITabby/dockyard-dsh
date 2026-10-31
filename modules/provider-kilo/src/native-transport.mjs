import {
  fetchNativeResponse,
  finishReason,
  nativeProviderError,
  normalizeUsage,
  readSseEvents,
  resolveImageData,
  textFromContent,
  validateNativeEndpoint,
} from "../../../packages/providers/src/native-transport.mjs";

function firstString(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}

const PROVIDER_ID = "kilo";
export const DEFAULT_KILO_ENDPOINT = "https://ai-gateway.kilo.ai/api/v1/chat/completions";

function contentPartText(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.content === "string") return part.content;
  return "";
}

async function openAiContent(content, attachments = []) {
  if (typeof content === "string") {
    if (!attachments?.length) return content;
    const parts = [{ type: "text", text: content }];
    for (const attachment of attachments) {
      const data = await resolveImageData(attachment);
      if (data) parts.push(data);
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
        } else if (part.type === "image" || part.type === "image_url") {
          parts.push(part);
        } else {
          const text = contentPartText(part);
          if (text) parts.push({ type: "text", text });
        }
      }
    }
    for (const attachment of attachments) {
      const data = await resolveImageData(attachment);
      if (data) parts.push(data);
    }
    return parts;
  }

  return "";
}

export async function buildKiloMessages(request = {}, attachments = []) {
  const result = [];
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];

  for (const message of rawMessages) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "system" ? "system" : "user";
    const content = await openAiContent(message?.content ?? message?.text, attachments);
    result.push({
      role,
      content: Array.isArray(content) && content.length === 1 && content[0]?.type === "text" ? content[0].text : content,
    });
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

export function createKiloNativeExecutor({
  endpoint = DEFAULT_KILO_ENDPOINT,
  apiKey = null,
  fetchImpl = fetch,
  timeoutMs = 120_000,
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });

  return async function* kiloNativeExecutor(envelope = {}) {
    const req = (envelope && typeof envelope === "object" && "request" in envelope)
      ? (envelope.request ?? {})
      : (envelope ?? {});
    const attachments = envelope?.attachments ?? req?.attachments;
    const credential = envelope?.credential ?? req?.credential;
    const signal = envelope?.signal ?? req?.signal;

    const token = apiKey
      ?? (credential?.apiKey && credential.apiKey !== "free-tier" ? credential.apiKey : null)
      ?? (credential?.token && credential.token !== "free-tier" ? credential.token : null)
      ?? (credential?.accessToken && credential.accessToken !== "free-tier" ? credential.accessToken : null)
      ?? process.env.KILO_API_KEY
      ?? null;

    const messages = await buildKiloMessages(req, attachments);

    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const rawEffort = req.reasoningEffort ?? req.reasoning_effort;
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

    const body = {
      model: req.model ?? "kilo-auto/free",
      messages,
      stream: true,
      ...(typeof req.temperature === "number" ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === "number" ? { max_tokens: req.maxTokens } : {}),
      ...(reasoningEffort && reasoningEffort !== "none"
        ? { reasoning_effort: reasoningEffort, reasoning: { effort: reasoningEffort } }
        : {}),
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
      // If a specific third-party model (e.g. recursive/flint-v1.0:free) fails with 503/502/504/404,
      // failover to kilo-auto/free so the user's conversation succeeds instead of crashing
      if (body.model !== "kilo-auto/free" && (err?.status === 503 || err?.status === 502 || err?.status === 504 || err?.status === 404)) {
        const fallbackBody = { ...body, model: "kilo-auto/free" };
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
      const reasoningDelta = extractReasoningDelta(delta);
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
