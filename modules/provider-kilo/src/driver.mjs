import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import {
  assertSecureEndpointUrl,
  fetchJson,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import { createKiloNativeExecutor } from "./native-transport.mjs";

const PROVIDER_ID = "kilo";
const DEFAULT_CATALOG_URL = "https://api.kilo.ai/api/gateway/models";

export const BUILTIN_KILO_FREE_MODELS = Object.freeze([
  {
    id: "kilo-auto/free",
    name: "Auto Free (Kilo)",
    contextWindow: 256000,
    maxTokens: 32768,
    free: true,
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL (Free)",
    contextWindow: 1000000,
    maxTokens: 131072,
    inputModalities: ["text", "image", "video"],
    free: true,
  },
  {
    id: "reflection/beam-free",
    name: "Reflection Beam 1.0 (Free)",
    contextWindow: 1048576,
    maxTokens: 131072,
    free: true,
  },
  {
    id: "inclusionai/ling-3.1-flash-1019-free",
    name: "inclusionAI Ling 3.1 Flash (Free)",
    contextWindow: 1000000,
    maxTokens: 262144,
    free: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra (Free)",
    contextWindow: 1000000,
    maxTokens: 131072,
    free: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning (Free)",
    contextWindow: 1000000,
    maxTokens: 131072,
    free: true,
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint (Free)",
    contextWindow: 262144,
    maxTokens: 65536,
    free: true,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside Laguna S 2.1 (Free)",
    contextWindow: 262144,
    maxTokens: 65536,
    free: true,
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Models Router",
    contextWindow: 200000,
    maxTokens: 32768,
    free: true,
  },
  {
    id: "stealth/glyph-cluster",
    name: "Stealth Glyph Cluster (Free)",
    contextWindow: 256000,
    maxTokens: 32768,
    free: true,
  },
]);

export function parseKiloCatalog(data) {
  const items = Array.isArray(data?.data) ? data.data : [];
  if (!items.length) {
    return { models: [...BUILTIN_KILO_FREE_MODELS] };
  }

  const result = [];
  const seen = new Set();
  const builtinMap = new Map(BUILTIN_KILO_FREE_MODELS.map((m) => [m.id, m]));

  for (const item of items) {
    if (!item?.isFree) continue;
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const builtin = builtinMap.get(id);
    const name = stringValue(item?.name) ?? builtin?.name ?? id;
    const contextWindow = Number.isInteger(item?.context_length)
      ? item.context_length
      : builtin?.contextWindow ?? 256000;
    const maxTokens = Number.isInteger(item?.top_provider?.max_completion_tokens)
      ? item.top_provider.max_completion_tokens
      : builtin?.maxTokens ?? 32768;

    result.push({
      id,
      name,
      contextWindow,
      maxTokens,
      free: true,
    });
  }

  if (result.length === 0) {
    return { models: [...BUILTIN_KILO_FREE_MODELS] };
  }

  return { models: result };
}

export function createKiloCatalogLoader({
  url = DEFAULT_CATALOG_URL,
  fetchImpl = fetch,
  cacheTtlMs = 300_000,
} = {}) {
  let cached = null;
  let cachedAt = 0;

  return async function kiloCatalogLoader({ force = false } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }

    try {
      assertSecureEndpointUrl(url, { providerId: PROVIDER_ID });
      const data = await fetchJson(url, {
        headers: { Accept: "application/json" },
        fetchImpl,
        timeoutMs: 10_000,
      });

      const parsed = parseKiloCatalog(data);
      if (parsed.models.length > 0) {
        cached = parsed;
        cachedAt = now;
        return cached;
      }
    } catch {
      // network fallback to built-in models
    }

    cached = { models: [...BUILTIN_KILO_FREE_MODELS] };
    cachedAt = now;
    return cached;
  };
}

export function summarizeKiloCandidate(candidate) {
  return candidate?.displayName ?? candidate?.email ?? candidate?.accountId ?? "Kilo Free Tier";
}

export class KiloDriver {
  #catalogLoader;
  #requestExecutor;

  constructor(options = {}) {
    this.#catalogLoader = options.catalogLoader ?? createKiloCatalogLoader(options);
    this.#requestExecutor = options.requestExecutor ?? createKiloNativeExecutor(options);
  }

  async catalog(account, context = {}) {
    return this.#catalogLoader({ force: Boolean(context.force) });
  }

  async getCatalog(context = {}) {
    return this.#catalogLoader({ force: Boolean(context?.force) });
  }

  async discover() {
    return {
      candidates: [
        {
          candidateId: "kilo-free",
          accountId: "kilo-free",
          displayName: "Kilo Free Tier",
          email: "free@kilo.ai",
          subscription: {
            plan: "Free Frontier Router",
            status: "active",
          },
          quota: {
            remaining: 100,
            limit: 100,
            unit: "requests",
            updatedAt: new Date().toISOString(),
          },
          source: "kilo_free_tier",
          health: {
            status: "healthy",
          },
        },
      ],
      source: "kilo_free_tier",
      diagnostics: [],
    };
  }

  async importAccount(candidate, context = {}) {
    const accountId = candidate?.accountId || "kilo-free";
    const ref = createCredentialRef(PROVIDER_ID, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "kilo_free",
        access: "free-tier",
      }).catch(() => {});
    }

    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || "Kilo Free Tier",
      email: candidate?.email || "free@kilo.ai",
      auth: {
        kind: "kilo_free",
        credentialRef: ref,
      },
      subscription: {
        plan: candidate?.subscription?.plan || "Free Frontier Router",
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
    return this.discover().then((res) => (Array.isArray(res?.candidates) ? res.candidates[0] : null));
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

  async invoke(envelope) {
    return this.#requestExecutor(envelope);
  }
}

export function createKiloDriver(options = {}) {
  return new KiloDriver(options);
}
