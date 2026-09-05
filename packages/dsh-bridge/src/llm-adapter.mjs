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
      return {
        provider: providerId,
        id: model.id,
        name: typeof model.name === "string" && model.name.length > 0 ? model.name : model.id,
        description: modelDescription(model),
        ...(Array.isArray(model.inputModalities) ? { inputModalities: [...model.inputModalities] } : {}),
        ...(Number.isInteger(model.contextWindow) ? { context: { contextWindow: model.contextWindow } } : {}),
        ...(Number.isInteger(model.maxTokens) ? { defaultMaxTokens: model.maxTokens } : {}),
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

/**
 * dsh-llm-pi-ai currently leaves a Codex WebSocket close with code 1006 as
 * PI_AI_ERROR. That bypasses dsh-llm-retry, whose default policy retries
 * TRANSPORT failures at the durable agent-step boundary. Normalize only this
 * transport signature here; the bridge must not retry inside a live stream,
 * because doing so could duplicate already-emitted tool calls.
 */
function normalizeTransportFailure(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error"
    ? chunk.reason.failure
    : null;
  if (!failure || failure.code === "TRANSPORT") return chunk;
  if (!/\bWebSocket closed\s+1006\b/i.test(String(failure.message ?? ""))) return chunk;
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

const RETRYABLE_THROWN_FAILURE_CODES = new Set([
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

  const catalogGenerations = new Map();

  function bumpCatalogGeneration(provider) {
    const next = (catalogGenerations.get(provider) ?? 0) + 1;
    catalogGenerations.set(provider, next);
    return next;
  }

  async function providerCatalog(provider, signal, { force = false } = {}) {
    // The catalog is provider-scoped shared state. Binding the single
    // in-flight fetch to the FIRST caller's AbortSignal meant one cancelled
    // request killed the catalog for everyone else while later callers'
    // signals were silently ignored. Fetch without a caller signal instead;
    // each caller races its own signal against the shared result.
    if (force) {
      catalogCache.delete(provider);
      catalogPromises.delete(provider);
    }
    let promise = catalogPromises.get(provider);
    if (!promise) {
      const generation = force ? bumpCatalogGeneration(provider) : (catalogGenerations.get(provider) ?? 0);
      promise = Promise.resolve()
        .then(() => runtime.getCatalog(provider, force ? { force: true } : {}))
        .then((catalog) => {
          if ((catalogGenerations.get(provider) ?? 0) === generation) {
            catalogCache.set(provider, { value: catalog, fetchedAt: Date.now() });
          }
          return catalog;
        })
        .finally(() => {
          if (catalogPromises.get(provider) === promise) catalogPromises.delete(provider);
        });
      catalogPromises.set(provider, promise);
    }
    return raceCallerSignal(promise, signal);
  }

  function invalidateCatalog(providerId = null) {
    if (providerId) {
      bumpCatalogGeneration(providerId);
      catalogCache.delete(providerId);
      catalogPromises.delete(providerId);
      return;
    }
    for (const provider of owned) bumpCatalogGeneration(provider);
    catalogCache.clear();
    catalogPromises.clear();
  }

  async function refreshCatalog(providerId = null) {
    const ids = providerId ? [providerId] : [...owned];
    const catalogs = [];
    for (const id of ids) {
      catalogs.push({
        providerId: id,
        catalog: await providerCatalog(id, undefined, { force: true }),
      });
    }
    return catalogs;
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
    const catalog = cachedProviderCatalog(provider);
    if (!catalog) {
      warmProviderCatalog(provider);
      return { provider, id: model, name: model };
    }
    return providerCatalogModels(provider, catalog).find((entry) => entry.id === model)
      ?? { provider, id: model, name: model };
  }

  return {
    providerInfo(provider) {
      const manifest = manifestFor(runtime, provider);
      return { id: provider, name: manifest?.displayName ?? provider };
    },

    providerRetryPolicy() {
      return undefined;
    },

    invalidateCatalog,
    refreshCatalog,

    async listModels(provider, signal) {
      await ensureRuntimeReady();
      if (!providerHasConnectedAccount(runtime, provider)) return [];
      const catalog = await providerCatalog(provider, signal);
      return providerCatalogModels(provider, catalog);
    },

    async resolveModel(provider, model, signal) {
      await ensureRuntimeReady();
      if (!providerHasConnectedAccount(runtime, provider)) return { provider, id: model, name: model };
      const catalog = await providerCatalog(provider, signal);
      return providerCatalogModels(provider, catalog).find((entry) => entry.id === model)
        ?? { provider, id: model, name: model };
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
        : options;
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
        if (!emittedChunk) {
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
  };
}
