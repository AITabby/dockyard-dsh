import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import {
  assertSecureEndpointUrl,
  fetchJson,
  resolveReasoningFromModel,
  stripVendorPrefix,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  createOpencodeNativeExecutor,
  findOpencodeCliPath,
  queryInstalledOpencodeCliModelIds,
} from "./native-transport.mjs";

const PROVIDER_ID = "opencode";
const DEFAULT_CATALOG_URL = "https://opencode.ai/zen/v1/models";
const DEFAULT_ENDPOINT = "https://opencode.ai/inference/openai/v1/chat/completions";

/** A model is free when the Zen rotation serves it at no cost; the id says so. */
export function isOpencodeFreeModelId(id) {
  const value = String(id ?? "");
  return value.includes("-free") || value.includes(":free") || value === "big-pickle"
    || value === "free" || value.endsWith("/free");
}

export const BUILTIN_OPENCODE_FREE_MODELS = Object.freeze([
  {
    id: "big-pickle",
    name: "Big Pickle (Free)",
    free: true,
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "medium",
    },
  },
  {
    id: "beam-free",
    name: "Beam (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "mimo-v2.6-flash-free",
    name: "MIMO v2.6 Flash (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "medium",
    },
  },
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text", "image"],
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "nemotron-3-ultra-free",
    name: "Nemotron 3 Ultra (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "medium",
    },
  },
  {
    id: "jev-1.13-free",
    name: "JEV 1.13 (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "longcat-2.5-preview-free",
    name: "Longcat 2.5 Preview (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "flint-40b-free",
    name: "Flint 40B (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek v4.1 Flash (Free)",
    contextWindow: 200000,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High" },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "glm-5.3-flash-free",
    name: "GLM 5.3 Flash (Free)",
    contextWindow: 204800,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High" },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "minimax-m3.1-flash-free",
    name: "MiniMax M3.1 Flash (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "medium",
    },
  },
  {
    id: "qwen3.6-plus-free",
    name: "Qwen 3.6 Plus (Free)",
    contextWindow: 262144,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "medium",
    },
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    contextWindow: 1000000,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "medium",
    },
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    contextWindow: 1048576,
    maxTokens: 16384,
  },
].map((model) => ({ ...model, free: true })));

export function summarizeOpencodeCandidate(candidate) {
  return candidate?.displayName ?? candidate?.email ?? candidate?.accountId ?? "OpenCode Free";
}

function findOpencodeRegistryModel(id, registry) {
  if (!id || !Array.isArray(registry) || registry.length === 0) return null;
  const exact = registry.find((m) => m.id === id);
  if (exact) return exact;

  const cleanId = id.replace(/-free$/, "");
  const cleanMatch = registry.find((m) => m.id === cleanId);
  if (cleanMatch) return cleanMatch;

  if (id.startsWith("deepseek-v4")) {
    return registry.find((m) => m.id === "deepseek-v4-flash-free" || m.id === "deepseek-v4-flash");
  }
  if (id.startsWith("claude-sonnet") || id.startsWith("claude-opus") || id.startsWith("claude-fable") || id.startsWith("claude-haiku")) {
    const family = id.split("-").slice(0, 2).join("-");
    return registry.find((m) => m.id.startsWith(family) && m.thinkingLevelMap);
  }
  if (id.startsWith("glm-5")) {
    return registry.find((m) => m.id === "glm-5.2" || (m.id.startsWith("glm-5") && m.thinkingLevelMap));
  }
  if (id.startsWith("gemini-")) {
    return registry.find((m) => m.provider === "opencode" && m.id.startsWith("gemini-") && m.thinkingLevelMap);
  }
  if (id.startsWith("grok-")) {
    return registry.find((m) => m.id === "grok-4.5" || (m.id.startsWith("grok-") && m.thinkingLevelMap));
  }
  if (id.startsWith("gpt-5") || id.startsWith("gpt-6")) {
    return registry.find((m) => m.provider === "opencode" && m.id.startsWith("gpt-5") && m.thinkingLevelMap);
  }
  if (id.startsWith("qwen")) {
    return registry.find((m) => m.provider === "opencode" && m.id.startsWith("qwen"));
  }
  if (id.startsWith("minimax")) {
    return registry.find((m) => m.provider === "opencode" && m.id.startsWith("minimax"));
  }
  return null;
}

/**
 * Reasoning variants the Zen server actually accepts, verified against the live
 * endpoint. Registry-derived guesses broke whole turns with "Variant
 * unavailable", so any model listed here uses exactly this list — an empty list
 * means the model takes no variant at all and gets no tier selector.
 */
export const OPENCODE_VERIFIED_VARIANTS = Object.freeze({
  "big-pickle": [],
  "mimo-v2.6-flash-free": [],
  "deepseek-v4.1-flash-free": ["high", "max"],
  "glm-5.3-flash-free": ["high", "max"],
  "minimax-m3.1-flash-free": ["low", "high"],
});

export const EFFORT_LABELS = Object.freeze({
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  max: "Max",
  xhigh: "Extra High",
});

function reasoningFromZenCapabilities(capabilities) {
  const reasoning = capabilities?.reasoning;
  if (!reasoning?.supported) return null;
  const ids = Array.isArray(reasoning.effort)
    ? reasoning.effort.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  // "toggle" means the tier can be turned off entirely, which is an effort the
  // picker has to offer ("None" in the OpenCode app).
  if (ids.length === 0 && reasoning.toggle === true) ids.push("none");
  if (ids.length === 0) return null;
  return {
    efforts: ids.map((id) => ({ id, name: EFFORT_LABELS[id] ?? id })),
  };
}

export function withVerifiedVariants(models) {
  return models.map((model) => {
    // The Zen payload states the accepted tiers; the hand-verified table only
    // covers CLI-only listings that carry no capabilities block.
    if (model.reasoning?.efforts?.length) return model;
    if (!Object.hasOwn(OPENCODE_VERIFIED_VARIANTS, model.id)) return model;
    const variants = OPENCODE_VERIFIED_VARIANTS[model.id];
    if (variants.length === 0) {
      const { reasoning: _drop, ...rest } = model;
      return rest;
    }
    const efforts = variants.map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
    return { ...model, reasoning: { efforts, defaultEffort: variants.at(-1) } };
  });
}

export function parseOpencodeCatalog(data, { registry = [], installedIds = null } = {}) {
  const models = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  if (!models.length) {
    if (Array.isArray(installedIds) && installedIds.length > 0) {
      const builtinMap = new Map(BUILTIN_OPENCODE_FREE_MODELS.map((m) => [m.id, m]));
      const installedModels = installedIds.map((id) => {
        const builtin = builtinMap.get(id);
        if (builtin) return builtin;
        // The CLI installs paid Zen models too. Labelling all of them "(Free)"
        // painted the whole directory as free and auto-selected it.
        return {
          id,
          name: stripVendorPrefix(id).replace(/^openrouter\//, ""),
          contextWindow: 131072,
          maxTokens: 8192,
          ...(isOpencodeFreeModelId(id) ? { free: true } : {}),
        };
      });
      return { models: withVerifiedVariants(installedModels) };
    }
    return { models: withVerifiedVariants([...BUILTIN_OPENCODE_FREE_MODELS]) };
  }

  const builtinMap = new Map(BUILTIN_OPENCODE_FREE_MODELS.map((m) => [m.id, m]));
  const result = [];
  const seen = new Set();
  for (const item of models) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const regModel = findOpencodeRegistryModel(id, registry);
    const builtin = builtinMap.get(id);
    // The Zen API prices every model; zero input price is the authoritative
    // "free" signal. Id rules stay as the fallback for CLI-only listings.
    const inputPrice = item?.cost?.text?.input?.price;
    const isFree = typeof inputPrice === "number" ? inputPrice === 0 : isOpencodeFreeModelId(id);
    const name = stripVendorPrefix(stringValue(item?.name) ?? regModel?.name ?? builtin?.name ?? id).replace(/^openrouter\//, "");
    const contextWindow = Number.isInteger(item?.limit?.context)
      ? item.limit.context
      : Number.isInteger(item?.contextWindow)
        ? item.contextWindow
      : Number.isInteger(regModel?.contextWindow)
        ? regModel.contextWindow
        : builtin?.contextWindow ?? 131072;
    const maxTokens = Number.isInteger(item?.limit?.output)
      ? Math.min(item.limit.output, 16384)
      : Number.isInteger(item?.maxTokens)
        ? Math.min(item.maxTokens, 16384)
      : Number.isInteger(regModel?.maxTokens)
        ? Math.min(regModel.maxTokens, 16384)
        : builtin?.maxTokens ?? 8192;

    const reasoning = reasoningFromZenCapabilities(item?.capabilities)
      ?? (item?.reasoning
        ? resolveReasoningFromModel(item)
        : regModel
          ? resolveReasoningFromModel(regModel)
          : builtin?.reasoning);

    const inputModalities = Array.isArray(item?.modalities?.input)
      ? [...new Set(item.modalities.input
        .filter((value) => typeof value === "string")
        .map((value) => (value.startsWith("image/") ? "image" : value)))]
      : null;
    result.push({
      id,
      name,
      contextWindow,
      maxTokens,
      ...(inputModalities && inputModalities.length > 0 ? { inputModalities } : {}),
      // Publish the free tier so a spent account can still serve these models.
      ...(isFree ? { free: true } : {}),
      ...(reasoning ? { reasoning } : {}),
    });
  }

  return { models: withVerifiedVariants(result.length > 0 ? result : [...BUILTIN_OPENCODE_FREE_MODELS]) };
}

/**
 * The free Zen rotation can only serve the models it gives away. Showing the
 * other 340 paid entries bloats the picker and invites requests that must fail,
 * so they stay hidden unless DOCKYARD_OPENCODE_ALL_MODELS=1.
 */
export function freeTierCatalog(catalog) {
  if (String(process.env.DOCKYARD_OPENCODE_ALL_MODELS ?? "") === "1") return catalog;
  const models = Array.isArray(catalog?.models) ? catalog.models : [];
  const free = models.filter((model) => model?.free === true);
  return { ...catalog, models: free.length > 0 ? free : models };
}

export function createOpencodeCatalogLoader({
  catalogUrl = DEFAULT_CATALOG_URL,
  fetchImpl = fetch,
  timeoutMs = 8_000,
  cacheTtlMs = 60_000,
  registryLoader = null,
} = {}) {
  const validatedUrl = assertSecureEndpointUrl(catalogUrl, "OPENCODE_CATALOG_URL");
  let cached = null;
  let cachedAt = 0;
  let pending = null;

  return async function opencodeCatalogLoader({ force = false } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;

    pending = (async () => {
      const registry = typeof registryLoader === "function" ? await registryLoader().catch(() => []) : [];
      const cliPath = findOpencodeCliPath();
      const installedIds = cliPath ? await queryInstalledOpencodeCliModelIds(cliPath) : null;
      try {
        // fetchJson answers { body, response }; options belong in its third
        // argument. Treating the wrapper as the payload silently fell back to
        // the 15 builtin models on every platform without a desktop CLI.
        const { body } = await fetchJson(
          validatedUrl,
          { headers: { Accept: "application/json" } },
          { fetchImpl, timeoutMs },
        );
        cached = freeTierCatalog(parseOpencodeCatalog(body, { registry, installedIds }));
      } catch {
        cached = freeTierCatalog(parseOpencodeCatalog(null, { registry, installedIds }));
      }
      cachedAt = Date.now();
      return cached;
    })().finally(() => {
      pending = null;
    });

    return pending;
  };
}

export class OpencodeDriver {
  constructor({
    endpoint = DEFAULT_ENDPOINT,
    catalogUrl = DEFAULT_CATALOG_URL,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 30_000,
    registryLoader = null,
  } = {}) {
    this.endpoint = endpoint;
    this.catalogUrl = catalogUrl;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createOpencodeCatalogLoader({
      catalogUrl,
      fetchImpl,
      timeoutMs: 8_000,
      registryLoader,
    });
    this.requestExecutor = requestExecutor ?? createOpencodeNativeExecutor({
      endpoint,
      fetchImpl,
      timeoutMs,
    });
  }

  async discover() {
    return {
      candidates: [
        {
          candidateId: "opencode-free",
          accountId: "opencode-free",
          displayName: "OpenCode Free",
          email: "zen@opencode.ai",
          subscription: {
            plan: "Zen Free Rotation",
            status: "active",
          },
          quota: {
            remaining: 100,
            limit: 100,
            unit: "requests",
            updatedAt: new Date().toISOString(),
          },
          source: "opencode_free_tier",
          health: {
            status: "healthy",
          },
        },
      ],
      source: "opencode_free_tier",
      diagnostics: [],
    };
  }

  async importAccount(candidate, context = {}) {
    const accountId = candidate?.accountId || "opencode-free";
    const ref = createCredentialRef(PROVIDER_ID, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "opencode_free",
        access: "free-tier",
      }).catch(() => {});
    }

    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || "OpenCode Free",
      email: candidate?.email || "zen@opencode.ai",
      auth: {
        kind: "opencode_free",
        credentialRef: ref,
      },
      subscription: {
        plan: candidate?.subscription?.plan || "Zen Free Rotation",
        status: "active",
      },
      quota: createQuotaSnapshot(candidate?.quota || {
        remaining: 100,
        limit: 100,
        unit: "requests",
      }),
      health: {
        status: "healthy",
      },
    });
  }

  async getActiveSession() {
    return this.discover().then((res) => (Array.isArray(res?.candidates) ? res.candidates[0] : (Array.isArray(res) ? res[0] : null)));
  }

  async refreshAccount(account) {
    return {
      quota: createQuotaSnapshot({
        remaining: 100,
        limit: 100,
        unit: "requests",
        updatedAt: new Date().toISOString(),
      }),
      health: {
        status: "healthy",
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }

  async getQuota() {
    return createQuotaSnapshot({
      remaining: 100,
      limit: 100,
      unit: "requests",
      updatedAt: new Date().toISOString(),
    });
  }

  async getCatalog(context = {}) {
    return this.catalogLoader({ force: Boolean(context.force) });
  }

  async invoke(request, invocation, context = {}) {
    const executor = context.requestExecutor ?? this.requestExecutor;
    let credential = null;
    if (context.secretStore && invocation?.auth?.credentialRef) {
      credential = await context.secretStore.read(invocation.auth.credentialRef).catch(() => null);
    }
    if (!credential) {
      credential = invocation?.auth ?? { access: "free-tier" };
    }
    return executor({
      request,
      invocation,
      context,
      attachments: context.attachments ?? invocation?.attachments,
      credential,
      signal: context.signal ?? invocation?.signal,
    });
  }

  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
}

export function createOpencodeDriver(options = {}) {
  return new OpencodeDriver(options);
}
