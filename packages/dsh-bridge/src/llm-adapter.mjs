import { ValidationError } from "../../core/src/errors.mjs";

function effortName(id) {
  return String(id)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function modelCapacityText(value) {
  if (!Number.isInteger(value) || value <= 0) return null;
  return `${new Intl.NumberFormat().format(value)} tokens`;
}

function modelDescription(model) {
  const details = [];
  if (typeof model.description === "string" && model.description.length > 0) {
    details.push(model.description);
  }
  const context = modelCapacityText(model.contextWindow);
  details.push(context ? `上下文 ${context}` : "上下文未由 provider 返回");
  const output = modelCapacityText(model.maxTokens);
  if (output) details.push(`输出上限 ${output}`);
  return details.join(" · ");
}

/**
 * Keep the DSH-facing reasoning contract small and lossless. Provider modules
 * own the source-specific discovery; this bridge only filters malformed data
 * before handing it to DSH's model directory.
 */
export function normalizeDshReasoning(reasoning) {
  if (!reasoning || !Array.isArray(reasoning.efforts)) return undefined;
  const efforts = [];
  const seen = new Set();
  for (const effort of reasoning.efforts) {
    if (!effort || typeof effort.id !== "string" || effort.id.length === 0 || seen.has(effort.id)) continue;
    const name = typeof effort.name === "string" && effort.name.length > 0
      ? effort.name
      : effortName(effort.id);
    const normalized = {
      id: effort.id,
      name,
      ...(typeof effort.description === "string" ? { description: effort.description } : {}),
    };
    efforts.push(normalized);
    seen.add(effort.id);
  }
  if (efforts.length === 0) return undefined;
  const defaultEffort = typeof reasoning.defaultEffort === "string"
    && seen.has(reasoning.defaultEffort)
    ? reasoning.defaultEffort
    : undefined;
  return {
    efforts,
    ...(defaultEffort === undefined ? {} : { defaultEffort }),
  };
}

function providerCatalogModels(providerId, catalog) {
  if (!Array.isArray(catalog?.models)) return [];
  const seen = new Set();
  return catalog.models
    .filter((model) => {
      if (!model || typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    })
    .map((model) => {
      const reasoning = normalizeDshReasoning(model.reasoning);
      const contextWindow = Number.isInteger(model.contextWindow) && model.contextWindow > 0
        ? model.contextWindow
        : undefined;
      // DSH reserves defaultMaxTokens from the context window (messageBudget = contextWindow - defaultMaxTokens).
      // If defaultMaxTokens is too large, it starves the conversation budget and breaks compaction
      // with TargetPressureConfigError. Bound defaultMaxTokens to at most 20% of contextWindow (or 16384).
      let defaultMaxTokens = undefined;
      if (Number.isInteger(model.maxTokens) && model.maxTokens > 0) {
        const cap = contextWindow ? Math.max(1024, Math.min(16384, Math.floor(contextWindow * 0.2))) : 16384;
        defaultMaxTokens = Math.min(model.maxTokens, cap);
      } else if (contextWindow) {
        defaultMaxTokens = Math.min(8192, Math.floor(contextWindow * 0.2));
      }
      return {
        provider: providerId,
        id: model.id,
        name: typeof model.name === "string" && model.name.length > 0 ? model.name : model.id,
        description: modelDescription(model),
        ...(Array.isArray(model.inputModalities) ? { inputModalities: [...model.inputModalities] } : {}),
        ...(contextWindow ? { context: { contextWindow } } : {}),
        ...(defaultMaxTokens !== undefined ? { defaultMaxTokens } : {}),
        ...(reasoning ? { reasoning } : {}),
      };
    });
}

function manifestFor(runtime, providerId) {
  return runtime.listProviderManifests?.().find((manifest) => manifest.id === providerId) ?? null;
}

/**
 * Dockyard owns provider discovery for all modules, but a discovered catalog
 * is not the same thing as an imported account. Keep the model directory
 * scoped to providers that have an account in Dockyard's pool; otherwise a
 * local CLI/model registry would make every optional provider look enabled.
 * Test doubles that do not expose a snapshot retain the old catalog behavior.
 */
function providerHasConnectedAccount(runtime, providerId) {
  if (providerId === "opencode") return true;
  if (typeof runtime.snapshot !== "function") return true;
  const snapshot = runtime.snapshot();
  if (!Array.isArray(snapshot?.providers)) return true;
  const provider = snapshot.providers.find((entry) => entry?.providerId === providerId);
  return Array.isArray(provider?.accounts) && provider.accounts.length > 0;
}

function requestHasImage(value) {
  if (Array.isArray(value)) return value.some((item) => requestHasImage(item));
  if (!value || typeof value !== "object") return false;
  if (value.type === "image") return true;
  return Object.values(value).some((item) => requestHasImage(item));
}

function requestHasImageInCurrentTurn(request = {}) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  if (messages.length > 0) {
    const current = messages.at(-1)?.role === "user"
      ? messages.at(-1)
      : [...messages].reverse().find((message) => message?.role === "user") ?? messages.at(-1);
    return requestHasImage(current?.content ?? current?.text);
  }
  return requestHasImage(request.input);
}

function unsupportedContentError(message) {
  const error = new ValidationError(message);
  error.code = "UNSUPPORTED_CONTENT";
  return error;
}

const CONTEXT_OVERFLOW_PATTERNS = [
  /context[\s_-](?:length|window)[\s_-](?:exceed|overflow|limit)/i,
  /maximum context length/i,
  /max context window/i,
  /too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?(?:model(?:'s)?\s+)?context/i,
  /(?:input|prompt|request|messages?)\b.{0,40}(?:exceed|overflow|is\s+larger\s+than)\b.{0,40}\b(?:model(?:'s)?\s+)?context/i,
];

export function isContextOverflowError(errorOrMessage) {
  if (!errorOrMessage) return false;
  if (typeof errorOrMessage === "string") {
    return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(errorOrMessage));
  }
  const code = String(errorOrMessage.code ?? errorOrMessage.upstreamCode ?? "");
  if (/CONTEXT_WINDOW_EXCEEDED|CONTEXT_LENGTH_EXCEEDED/i.test(code)) return true;
  const message = String(errorOrMessage.message ?? errorOrMessage.reason ?? "");
  return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Normalize provider failures (WebSocket closed 1006 -> TRANSPORT, context overflow -> CONTEXT_WINDOW_EXCEEDED).
 * Context overflow mapping allows DSH's compaction service to intercept the error and perform
 * automatic overflow compaction and turn retry.
 */
function normalizeTransportFailure(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error"
    ? chunk.reason.failure
    : null;
  if (!failure) return chunk;
  if (failure.code !== "TRANSPORT" && /\bWebSocket closed\s+1006\b/i.test(String(failure.message ?? ""))) {
    return {
      ...chunk,
      reason: {
        ...chunk.reason,
        failure: {
          ...failure,
          code: "TRANSPORT",
        },
      },
    };
  }
  if (failure.code !== "CONTEXT_WINDOW_EXCEEDED" && isContextOverflowError(failure)) {
    return {
      ...chunk,
      reason: {
        ...chunk.reason,
        failure: {
          ...failure,
          code: "CONTEXT_WINDOW_EXCEEDED",
        },
      },
    };
  }
  return chunk;
}

const RETRYABLE_THROWN_FAILURE_CODES = new Set([
  "CONTEXT_WINDOW_EXCEEDED",
  "EMPTY_RESPONSE",
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT",
]);

/**
 * dsh-route can throw a provider failure after buffering a stream instead of
 * yielding its terminal finish chunk. That raw throw happens outside
 * dsh-agent-loop's finish-error path, so dsh-llm-retry cannot see it. Convert
 * only a known retryable/no-output failure into a finish chunk; DSH will then
 * perform the bounded retry at the durable agent-step boundary.
 */
function retryFinishFromThrownError(error) {
  let code = error?.code;
  if (code === "EMPTY_STREAM_OUTPUT" && error?.emptyOutput === true) {
    code = "EMPTY_RESPONSE";
  } else if (code === "PI_AI_ERROR" && /\bWebSocket closed\s+1006\b/i.test(String(error.message ?? ""))) {
    code = "TRANSPORT";
  } else if (isContextOverflowError(error)) {
    code = "CONTEXT_WINDOW_EXCEEDED";
  }
  if (!RETRYABLE_THROWN_FAILURE_CODES.has(code)) return null;
  return {
    type: "finish",
    reason: {
      kind: "error",
      failure: {
        code,
        message: String(error.message ?? "Provider stream ended without substantive output"),
        ...(Number.isInteger(error.status) ? { status: error.status } : {}),
        ...(typeof error.providerRetryAfterMs === "number" && Number.isFinite(error.providerRetryAfterMs)
          ? { providerRetryAfterMs: error.providerRetryAfterMs }
          : {}),
      },
    },
  };
}

export function resolveFallbackModelMetadata(provider, model) {
  const id = String(model ?? "").toLowerCase();
  let contextWindow = 131072;
  let maxTokens = 8192;
  if (id.includes("gemini")) {
    contextWindow = 1048576;
    maxTokens = 16384;
  } else if (id.includes("claude-sonnet-4") || id.includes("claude-4")) {
    contextWindow = 1000000;
    maxTokens = 16384;
  } else if (id.includes("claude")) {
    contextWindow = 200000;
    maxTokens = 8192;
  } else if (id.includes("grok-4")) {
    contextWindow = 256000;
    maxTokens = 8192;
  } else if (id.includes("qwen")) {
    contextWindow = 262144;
    maxTokens = 8192;
  } else if (id.includes("glm-5")) {
    contextWindow = 204800;
    maxTokens = 8192;
  } else if (id.includes("deepseek-v4") || id.includes("deepseek-v3") || id.includes("deepseek-r1")) {
    contextWindow = 200000;
    maxTokens = 8192;
  } else if (id.includes("gpt-") || id.includes("codex-") || provider === "openai-codex") {
    contextWindow = 200000;
    maxTokens = 8192;
  }
  return {
    provider,
    id: model,
    name: model,
    context: { contextWindow },
    defaultMaxTokens: maxTokens,
  };
}

/**
 * Adapt Dockyard's provider-neutral routes to the DSH LLM seam.
 *
 * This object intentionally does not import DSH at module load time. DSH owns
 * the concrete LlmAdapter class and only requires this contract at runtime;
 * keeping the bridge structural lets the local page and unit tests run without
 * installing DSH into Dockyard's own workspace.
 */
export function createDockyardLlmAdapter({ runtime, providerIds, attachmentsResolver = null } = {}) {
  if (!runtime) throw new ValidationError("Dockyard runtime is required");
  const owned = [...(providerIds ?? runtime.listProviderIds?.() ?? [])];
  if (owned.length === 0) throw new ValidationError("At least one Dockyard provider is required");
  const catalogPromises = new Map();
  const catalogCache = new Map();
  const STREAM_CATALOG_REFRESH_MS = 60_000;

  async function ensureRuntimeReady() {
    if (typeof runtime.init === "function") await runtime.init();
  }

  function abortedCallerError(signal) {
    const error = new Error("This model lookup was aborted");
    error.name = "AbortError";
    if (signal?.reason !== undefined) error.cause = signal.reason;
    return error;
  }

  /**
   * Await a shared promise under the caller's own signal: an abort fails only
   * this caller, never the shared work other callers are still awaiting.
   */
  function raceCallerSignal(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortedCallerError(signal));
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(abortedCallerError(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      );
    });
  }

  async function providerCatalog(provider, signal, { force = false } = {}) {
    if (!force) {
      const cached = cachedProviderCatalog(provider);
      if (cached) return cached;
    }
    let promise = catalogPromises.get(provider);
    if (!promise) {
      promise = Promise.resolve()
        .then(() => runtime.getCatalog(provider, { force }))
        .then((catalog) => {
          catalogCache.set(provider, { value: catalog, fetchedAt: Date.now() });
          return catalog;
        })
        .finally(() => {
          if (catalogPromises.get(provider) === promise) catalogPromises.delete(provider);
        });
      catalogPromises.set(provider, promise);
    }
    return raceCallerSignal(promise, signal);
  }

  function cachedProviderCatalog(provider) {
    const entry = catalogCache.get(provider);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt >= STREAM_CATALOG_REFRESH_MS && !catalogPromises.has(provider)) {
      // Refresh metadata opportunistically, but never put model generation
      // behind a provider's CLI/remote catalog endpoint.
      void providerCatalog(provider).catch(() => {});
    }
    return entry.value;
  }

  function warmProviderCatalog(provider) {
    if (!catalogCache.has(provider) && !catalogPromises.has(provider)) {
      // A cold catalog is advisory for generation. The selected model is
      // already known by DSH, so discovery can finish after the request starts.
      void providerCatalog(provider).catch(() => {});
    }
  }

  function fastResolveModel(provider, model) {
    const fallback = resolveFallbackModelMetadata(provider, model);
    const catalog = cachedProviderCatalog(provider);
    if (!catalog) {
      warmProviderCatalog(provider);
      return fallback;
    }
    return providerCatalogModels(provider, catalog).find((entry) => entry.id === model) ?? fallback;
  }

  return {
    providerInfo(provider) {
      const manifest = manifestFor(runtime, provider);
      return { id: provider, name: manifest?.displayName ?? provider };
    },

    providerRetryPolicy() {
      return undefined;
    },

    imageRequestPricing(_provider, _model) {
      return undefined;
    },

    imageRequestTarget(_provider, _model, image) {
      return {
        width: image?.width ?? 0,
        height: image?.height ?? 0,
        maxBytes: image?.bytes ?? 0,
      };
    },

    async listModels(provider, signal) {
      await ensureRuntimeReady();
      if (!providerHasConnectedAccount(runtime, provider)) return [];
      const catalog = await providerCatalog(provider, signal);
      const allModels = providerCatalogModels(provider, catalog);
      const enabled = runtime.getModelSelection?.(provider);
      if (Array.isArray(enabled)) {
        const set = new Set(enabled);
        return allModels.filter((entry) => set.has(entry.id));
      }
      return allModels;
    },

    async resolveModel(provider, model, signal) {
      await ensureRuntimeReady();
      const fallback = resolveFallbackModelMetadata(provider, model);
      if (!providerHasConnectedAccount(runtime, provider)) return fallback;
      const cached = cachedProviderCatalog(provider);
      if (cached) {
        return providerCatalogModels(provider, cached).find((entry) => entry.id === model) ?? fallback;
      }
      const catalog = await providerCatalog(provider, signal);
      return providerCatalogModels(provider, catalog).find((entry) => entry.id === model) ?? fallback;
    },

    async prepareCall(provider, model, signal) {
      return {
        // DSH may call prepareCall immediately before generation. Do not make
        // that path wait for a cold provider catalog; listModels/resolveModel
        // remain the explicit, authoritative discovery APIs.
        model: fastResolveModel(provider, model),
        stream: (options = {}) => this.stream(
          signal && options.signal === undefined ? { ...options, signal } : options,
        ),
      };
    },

    async *stream(options) {
      await ensureRuntimeReady();
      if (!providerHasConnectedAccount(runtime, options.provider)) {
        throw new ValidationError(`Provider ${options.provider} has no connected Dockyard account`);
      }
      // The model picker has already selected an id. Catalog discovery is
      // useful for metadata and validation, but it must not delay the first
      // provider request on a cold start or after a catalog TTL expires.
      const catalog = cachedProviderCatalog(options.provider);
      if (!catalog) warmProviderCatalog(options.provider);
      const model = catalog
        ? providerCatalogModels(options.provider, catalog).find((entry) => entry.id === options.model)
        : null;
      if (requestHasImageInCurrentTurn(options) && Array.isArray(model?.inputModalities)
        && !model.inputModalities.includes("image")) {
        throw unsupportedContentError(
          `模型 ${model.name ?? model.id} 的实时 provider catalog 未声明图片输入能力`,
        );
      }
      const request = model
        ? {
            ...options,
            ...(model.context ? { modelContext: { ...model.context } } : {}),
            ...(model.defaultMaxTokens !== undefined
              ? { modelContext: { ...(model.context ?? {}), maxTokens: model.defaultMaxTokens } }
              : {}),
          }
        : { ...options };
      if (options.purpose === "compaction") {
        // Strip heavy reasoning effort during compaction so summarization runs swiftly
        // without timing out or spending minutes in chain-of-thought exploration.
        delete request.reasoningEffort;
        delete request.reasoning_effort;
      }
      const attachments = typeof attachmentsResolver === "function"
        ? attachmentsResolver()
        : undefined;
      const stream = await runtime.stream(options.provider, request, {
        accountId: options.accountId,
        requestId: options.requestId,
        sessionId: options.sessionId,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(attachments ? { attachments } : {}),
      });
      let emittedChunk = false;
      try {
        for await (const chunk of stream) {
          emittedChunk = true;
          yield normalizeTransportFailure(chunk);
        }
      } catch (error) {
        // dsh-route buffers structural chunks before yielding them, so its
        // EMPTY_STREAM_OUTPUT marker reaches this boundary with no output
        // already committed. If another provider throws the same marker after
        // forwarding a chunk, rethrow it to avoid replaying tool side effects.
        if (!emittedChunk || isContextOverflowError(error)) {
          const retryFinish = retryFinishFromThrownError(error);
          if (retryFinish) {
            yield retryFinish;
            return;
          }
        }
        throw error;
      }
    },

    providers() {
      return [...owned];
    },

    invalidateCatalog(provider) {
      if (provider) {
        catalogCache.delete(provider);
        catalogPromises.delete(provider);
      } else {
        catalogCache.clear();
        catalogPromises.clear();
      }
    },
  };
}
