import { createHash } from "node:crypto";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createBalanceSnapshot,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import { ValidationError } from "../../../packages/core/src/errors.mjs";
import {
  assertSecureEndpointUrl,
  fetchJson,
  resolveContextWindowFromModel,
  resolveMaxTokensFromModel,
  resolveReasoningFromModel,
  stripVendorPrefix,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  DEFAULT_HERMES_CHAT_ENDPOINT,
  DEFAULT_HERMES_MODELS_ENDPOINT,
  createHermesNativeExecutor,
  extractHermesAuth,
} from "./native-transport.mjs";

const PROVIDER_ID = "hermes";

/** Stable per-key identifier so pasting the same key twice reuses one account. */
function fingerprintApiKey(apiKey) {
  return createHash("sha256").update(String(apiKey)).digest("hex").slice(0, 16);
}

/** Display form of a key: never echo the whole secret back into the UI. */
function maskApiKey(apiKey) {
  const value = String(apiKey ?? "");
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export const BUILTIN_HERMES_MODELS = Object.freeze([
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "reflection/beam-1.0-501b-a23b:free",
    name: "Beam 1.0 501B A23B (Free)",
    contextWindow: 262144,
    maxTokens: 131072,
    inputModalities: ["text"],
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium", default: true },
        { id: "high", name: "High" },
        { id: "xhigh", name: "Extra High" },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "medium",
    },
    free: true,
  },
  {
    id: "ornith/ornith-1.5-122b:free",
    name: "Ornith 1.5 122B (Free)",
    contextWindow: 262144,
    maxTokens: 262144,
    inputModalities: ["text", "image"],
    free: true,
  },
  {
    id: "stepfun/step-3.7-flash:free",
    name: "Step 3.7 Flash (Free)",
    contextWindow: 262144,
    maxTokens: 32768,
    inputModalities: ["text"],
    free: true,
  },
  {
    id: "openai/gpt-6.1-terra-pro",
    name: "GPT-6.1 Terra Pro",
    contextWindow: 1000000,
    maxTokens: 65536,
    inputModalities: ["text", "image"],
  },
  {
    id: "anthropic/claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    contextWindow: 1000000,
    maxTokens: 65536,
    inputModalities: ["text", "image"],
  },
  {
    id: "z-ai/glm-5.3",
    name: "GLM 5.3",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text"],
  },
  {
    id: "particle-ai/particle-1",
    name: "Particle-1",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text", "image"],
  },
]);

export function parseHermesCatalog(data) {
  const payload = (data && typeof data === "object" && "body" in data) ? data.body : data;
  const items = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload) ? payload : []);
  if (!items.length) {
    return { models: [...BUILTIN_HERMES_MODELS] };
  }

  const result = [];
  const seen = new Set();
  const builtinMap = new Map(BUILTIN_HERMES_MODELS.map((m) => [m.id, m]));

  for (const item of items) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    // Skip embeddings-only models for LLM chat catalog
    if (Array.isArray(item?.endpoints) && !item.endpoints.some((e) => e.includes("chat") || e.includes("completions") || e.includes("messages"))) {
      if (item.architecture?.modality === "text->embeddings" || item.architecture?.output_modalities?.includes("embeddings")) {
        continue;
      }
    }

    const builtin = builtinMap.get(id);
    const name = stripVendorPrefix(stringValue(item?.name) ?? builtin?.name ?? id);

    const contextWindow = resolveContextWindowFromModel(item, builtin?.contextWindow ?? 262144);
    const maxTokens = resolveMaxTokensFromModel(item, builtin?.maxTokens ?? 32768);

    const inputModalities = Array.isArray(item?.architecture?.input_modalities)
      ? [...item.architecture.input_modalities]
      : (builtin?.inputModalities ? [...builtin.inputModalities] : ["text"]);

    let reasoning = null;
    if (Array.isArray(item?.reasoning?.supported_efforts) && item.reasoning.supported_efforts.length > 0) {
      const efforts = item.reasoning.supported_efforts.map((lvl) => ({
        id: lvl,
        name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
        ...(lvl === (item.reasoning.default_effort ?? "high") ? { default: true } : {}),
      }));
      reasoning = {
        efforts,
        defaultEffort: item.reasoning.default_effort ?? "high",
      };
    } else {
      reasoning = resolveReasoningFromModel(item) ?? builtin?.reasoning;
    }

    const isFree = id.endsWith(":free")
      || item?.isFree === true
      || (item?.pricing?.prompt === "0.0000000000" && item?.pricing?.completion === "0.0000000000");

    result.push({
      id,
      name,
      contextWindow,
      maxTokens,
      inputModalities,
      ...(reasoning ? { reasoning } : {}),
      ...(isFree ? { free: true } : {}),
    });
  }

  if (result.length === 0) {
    return { models: [...BUILTIN_HERMES_MODELS] };
  }

  return { models: result };
}

export function createHermesCatalogLoader({
  modelsUrl = DEFAULT_HERMES_MODELS_ENDPOINT,
  fetchImpl = fetch,
  cacheTtlMs = 300_000,
} = {}) {
  let cached = null;
  let cachedAt = 0;

  return async function hermesCatalogLoader({ force = false, credential = null, accounts = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }

    let token = credential?.apiKey;
    if (!token && Array.isArray(accounts) && accounts.length > 0) {
      token = accounts[0]?.auth?.apiKey;
    }
    if (!token) {
      const auth = extractHermesAuth();
      token = auth?.accounts?.[0]?.apiKey;
    }

    try {
      assertSecureEndpointUrl(modelsUrl, { providerId: PROVIDER_ID });
      const headers = {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const data = await fetchJson(modelsUrl, {
        headers,
        fetchImpl,
        timeoutMs: 15_000,
      });

      const parsed = parseHermesCatalog(data);
      if (parsed.models.length > 0) {
        cached = parsed;
        cachedAt = now;
        return cached;
      }
    } catch {
      // network fallback to built-in models
    }

    cached = { models: [...BUILTIN_HERMES_MODELS] };
    cachedAt = now;
    return cached;
  };
}

export function summarizeHermesCandidate(candidate) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate?.candidateId ?? "hermes-default",
    displayName: candidate?.displayName ?? "Hermes Account",
    email: candidate?.email ?? null,
    plan: candidate?.subscription?.plan ?? "Nous Portal 按量账户",
    quota: candidate?.quota ?? null,
  };
}

export class HermesDriver {
  constructor({
    endpoint = DEFAULT_HERMES_CHAT_ENDPOINT,
    modelsUrl = DEFAULT_HERMES_MODELS_ENDPOINT,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 180_000,
  } = {}) {
    this.endpoint = endpoint;
    this.modelsUrl = modelsUrl;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createHermesCatalogLoader({ modelsUrl, fetchImpl });
    this.requestExecutor = requestExecutor ?? createHermesNativeExecutor({
      endpoint,
      fetchImpl,
      timeoutMs,
    });
  }

  async discover() {
    const auth = extractHermesAuth();
    if (!auth || !Array.isArray(auth.accounts) || auth.accounts.length === 0) {
      return {
        candidates: [],
        source: "hermes_auth",
        diagnostics: ["未在 ~/.hermes/auth.json 检测到可用 Key，可在面板中配置 API Key。"],
      };
    }

    const candidates = auth.accounts.map((acc, index) => {
      // Pay-as-you-go money: real when the auth file says so, unknown otherwise.
      const amount = typeof acc.balance === "number" && Number.isFinite(acc.balance) ? acc.balance : null;
      return {
        candidateId: acc.accountId || `hermes-acc-${index + 1}`,
        accountId: acc.accountId || `hermes-acc-${index + 1}`,
        displayName: acc.displayName || `Hermes Account ${index + 1}`,
        email: acc.email || null,
        apiKey: acc.apiKey,
        subscription: {
          plan: amount === null ? "Nous Portal" : `Nous Portal (本地记录 $${amount.toFixed(2)})`,
        },
        // A balance is not a quota window: it has no cap to divide by and never
        // resets, so reporting one produced a meaningless 100% bar.
        balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
        // Kept as an empty snapshot so every candidate has the same shape; a
        // balance provider has no windows to report.
        quota: createQuotaSnapshot({}),
        resources: {
          quotaSource: "nous_portal_billing",
          quotaAvailable: true,
          quotaDiagnostic: "按量充值余额；以 Portal 控制台为准",
          quotaUrl: "https://portal.nousresearch.com",
        },
        source: "hermes_auth",
        health: {
          status: "healthy",
        },
      };
    });

    return {
      candidates,
      source: "hermes_auth",
      diagnostics: [],
    };
  }

  async importAccount(candidate, context = {}) {
    const manual = candidate?.source === "manual_api_key";
    const accountId = candidate?.accountId
      || (manual ? `hermes-${fingerprintApiKey(candidate?.apiKey)}` : null)
      || "hermes-default";
    const ref = createCredentialRef(PROVIDER_ID, accountId);

    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "hermes_auth",
        apiKey: candidate?.apiKey || "",
        userId: accountId,
        displayName: candidate?.displayName || "Hermes User",
        email: candidate?.email || null,
      }).catch(() => {});
    }

    const amount = typeof candidate?.balance?.amount === "number" && Number.isFinite(candidate.balance.amount)
      ? candidate.balance.amount
      : null;

    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || "Hermes Account",
      email: candidate?.email || null,
      auth: {
        kind: "hermes_auth",
        credentialRef: ref,
      },
      subscription: {
        plan: candidate?.subscription?.plan || (amount === null ? "Nous Portal" : `Nous Portal ($${amount.toFixed(2)} 不限时)`),
      },
      balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
      resources: {
        quotaSource: "nous_portal_billing",
        quotaAvailable: true,
        quotaDiagnostic: "按量充值余额；以 Portal 控制台为准",
        quotaUrl: "https://portal.nousresearch.com",
      },
      health: {
        status: "healthy",
      },
    });
  }


  /**
   * Import a manually entered API Key. Hermes authenticates with static keys
   * (~/.hermes/auth.json, ~/.nous/auth.json or an environment variable), never
   * OAuth, so this is the panel's account entry point without the official CLI.
   */
  async importSource(source, context = {}) {
    const rawKey = typeof source === "string"
      ? source
      : (source?.apiKey ?? source?.key ?? source?.token ?? "");
    const apiKey = String(rawKey ?? "").trim();
    if (!apiKey) throw new ValidationError("请输入有效的 Hermes / Nous API Key");
    const label = typeof source === "object" && typeof source?.label === "string"
      ? source.label.trim()
      : "";
    const masked = maskApiKey(apiKey);
    return [await this.importAccount({
      apiKey,
      source: "manual_api_key",
      displayName: label || `Hermes Key (${masked})`,
      email: masked,
    }, context)];
  }

  async getActiveSession() {
    return this.discover().then((res) => (Array.isArray(res?.candidates) ? res.candidates[0] : null));
  }

  async refreshAccount(account, context = {}) {
    let apiKey = null;
    if (context.secretStore && account?.auth?.credentialRef) {
      try {
        const secret = await context.secretStore.read(account.auth.credentialRef);
        apiKey = secret?.apiKey;
      } catch {}
    }
    if (!apiKey) {
      const auth = extractHermesAuth();
      const match = auth?.accounts?.find((a) => a.accountId === account?.accountId);
      apiKey = match?.apiKey || auth?.accounts?.[0]?.apiKey;
    }

    if (!apiKey) {
      return {
        health: { status: "auth_expired" },
      };
    }

    // Re-read the auth file: it is the only place a balance lives, and it may
    // have been topped up since the account was imported.
    const authNow = extractHermesAuth();
    const authMatch = Array.isArray(authNow?.accounts)
      ? authNow.accounts.find((entry) => entry?.accountId === account?.accountId)
      : null;
    const amount = typeof authMatch?.balance === "number" && Number.isFinite(authMatch.balance)
      ? authMatch.balance
      : (typeof account?.balance?.amount === "number" && Number.isFinite(account.balance.amount)
        ? account.balance.amount
        : null);

    return {
      health: { status: "healthy" },
      // An empty quota snapshot keeps the shape stable and tells the runtime this
      // refresh already answered the quota question; the money travels beside it.
      quota: createQuotaSnapshot({}),
      balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
      resources: {
        quotaSource: "nous_portal_billing",
        quotaAvailable: true,
        quotaDiagnostic: "按量充值余额；以 Portal 控制台为准",
        quotaUrl: "https://portal.nousresearch.com",
      },
    };
  }

  /**
   * Quota for a balance provider: there is no window to report, only what is
   * left to spend. The auth file is re-read so a top-up shows up without
   * re-importing the account.
   */
  async getQuota(account, context = {}) {
    const auth = extractHermesAuth();
    const match = Array.isArray(auth?.accounts)
      ? auth.accounts.find((entry) => entry?.accountId === account?.accountId)
      : null;
    const amount = typeof match?.balance === "number" && Number.isFinite(match.balance)
      ? match.balance
      : (typeof account?.balance?.amount === "number" ? account.balance.amount : null);
    return {
      quota: createQuotaSnapshot({}),
      balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
      resources: {
        quotaSource: "nous_portal_billing",
        quotaDiagnostic: "按量充值余额；以 Portal 控制台为准",
        quotaUrl: "https://portal.nousresearch.com",
      },
    };
  }

  async getCatalog(context = {}) {
    let credential = null;
    if (context.secretStore && context.accounts?.[0]?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(context.accounts[0].auth.credentialRef);
      } catch {}
    }
    return this.catalogLoader({
      force: Boolean(context?.force),
      credential,
      accounts: context?.accounts ?? null,
    });
  }

  async invoke(request, invocation, context = {}) {
    return this.stream(request, invocation, context);
  }

  async stream(request, invocation, context = {}) {
    let credential = null;
    if (context.secretStore && invocation?.account?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(invocation.account.auth.credentialRef);
      } catch {}
    }
    return this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? null,
      // Images reach the provider as opaque attachment references; without the
      // durable attachment service the transport silently drops them.
      attachments: context.attachments ?? invocation?.attachments ?? null,
    });
  }
}

export function createHermesDriver(options = {}) {
  return new HermesDriver(options);
}
