import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import {
  assertSecureEndpointUrl,
  fetchJson,
  resolveReasoningFromModel,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import { createOpencodeNativeExecutor } from "./native-transport.mjs";

const PROVIDER_ID = "opencode";
const DEFAULT_CATALOG_URL = "https://opencode.ai/zen/v1/models";
const DEFAULT_ENDPOINT = "https://opencode.ai/inference/openai/v1/chat/completions";

export const BUILTIN_OPENCODE_FREE_MODELS = Object.freeze([
  {
    id: "big-pickle",
    name: "Big Pickle (Free)",
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
    name: "Claude Sonnet 4.6 (OpenCode)",
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
    name: "Gemini 3.8 Flash (OpenCode)",
    contextWindow: 1048576,
    maxTokens: 16384,
  },
]);

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

export function parseOpencodeCatalog(data, { registry = [] } = {}) {
  const models = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  if (!models.length) {
    return { models: [...BUILTIN_OPENCODE_FREE_MODELS] };
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
    const isFree = id.includes("-free") || id === "big-pickle";
    const name = stringValue(item?.name) ?? regModel?.name ?? builtin?.name ?? (isFree ? `${id} (Free)` : id);
    const contextWindow = Number.isInteger(item?.contextWindow)
      ? item.contextWindow
      : Number.isInteger(regModel?.contextWindow)
        ? regModel.contextWindow
        : builtin?.contextWindow ?? 131072;
    const maxTokens = Number.isInteger(item?.maxTokens)
      ? Math.min(item.maxTokens, 16384)
      : Number.isInteger(regModel?.maxTokens)
        ? Math.min(regModel.maxTokens, 16384)
        : builtin?.maxTokens ?? 8192;

    const reasoning = item?.reasoning
      ? resolveReasoningFromModel(item)
      : regModel
        ? resolveReasoningFromModel(regModel)
        : builtin?.reasoning;

    result.push({
      id,
      name,
      contextWindow,
      maxTokens,
      ...(reasoning ? { reasoning } : {}),
    });
  }

  return { models: result.length > 0 ? result : [...BUILTIN_OPENCODE_FREE_MODELS] };
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
      if (catalogUrl === DEFAULT_CATALOG_URL && fetchImpl === fetch) {
        cached = parseOpencodeCatalog(null, { registry });
        cachedAt = Date.now();
        return cached;
      }
      try {
        const data = await fetchJson(validatedUrl, {
          headers: { Accept: "application/json" },
          fetchImpl,
          timeoutMs,
        });
        cached = parseOpencodeCatalog(data, { registry });
      } catch {
        cached = parseOpencodeCatalog(null, { registry });
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
