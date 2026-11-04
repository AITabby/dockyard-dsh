import os from "node:os";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  ACCOUNT_HEALTH,
  DockyardError,
  ValidationError,
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/index.mjs";
import {
  OPENROUTER_AGENTIC_HEADERS,
  OPENROUTER_CREDITS_ENDPOINT,
  OPENROUTER_KEY_ENDPOINT,
  buildOpenRouterFreeCatalogFromRaw,
  createOpenRouterFreeNativeExecutor,
  discoverLocalOpenRouterKeys,
  extractOpenRouterFreeAuth,
  fetchLiveOpenRouterFreeModels,
  hashApiKeyFingerprint,
  maskApiKey,
} from "./native-transport.mjs";

const PROVIDER_ID = "openrouter-free";
const OPENROUTER_KEYS_PAGE = "https://openrouter.ai/settings/keys";

async function readSecret(secretStore, ref) {
  if (!secretStore || !ref) return null;
  try {
    if (typeof secretStore.read === "function") return await secretStore.read(ref);
    if (typeof secretStore.get === "function") return await secretStore.get(ref);
  } catch {
    // ignore read failure
  }
  return null;
}

async function writeSecret(secretStore, ref, value) {
  if (!secretStore || !ref) return;
  if (typeof secretStore.write === "function") {
    await secretStore.write(ref, value);
    return;
  }
  if (typeof secretStore.put === "function") {
    await secretStore.put(ref, value);
  }
}

export function parseOpenRouterFreeCatalog(data) {
  const raw = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return buildOpenRouterFreeCatalogFromRaw(raw);
}

export function createOpenRouterFreeCatalogLoader({
  fetchImpl = globalThis.fetch,
  homeDir = os.homedir(),
  env = process.env,
} = {}) {
  return async function loadOpenRouterFreeCatalog(context = {}) {
    const localAuth = extractOpenRouterFreeAuth({ homeDir, env });
    const apiKey = context?.credential?.apiKey ?? context?.secret?.apiKey ?? localAuth?.apiKey ?? null;
    const models = await fetchLiveOpenRouterFreeModels({
      fetchImpl,
      apiKey,
      forceRefresh: Boolean(context?.force),
    });
    return {
      providerId: PROVIDER_ID,
      source: "openrouter_live_free_catalog",
      fetchedAt: new Date().toISOString(),
      models,
    };
  };
}

async function fetchOpenRouterAccountQuota(apiKey, fetchImpl = globalThis.fetch, now = new Date()) {
  const nowIso = now.toISOString();
  if (typeof fetchImpl !== "function" || !apiKey) {
    return {
      plan: "OpenRouter Free Router",
      quota: createQuotaSnapshot({
        remaining: null,
        limit: null,
        unit: "USD",
        resetAt: null,
        updatedAt: nowIso,
        source: "openrouter_free_key",
        windows: [],
      }, now),
      quotaDiagnostic: "OpenRouter Free Key 已就绪 · 实时同步常驻免费、隐秘与限时免费模型",
    };
  }

  let totalCredits = null;
  let totalUsage = null;
  let isFreeTier = null;
  let keyLabel = null;
  let keyLimit = null;
  let keyLimitRemaining = null;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    ...OPENROUTER_AGENTIC_HEADERS,
  };

  const [creditsRes, keyRes] = await Promise.allSettled([
    fetchImpl(OPENROUTER_CREDITS_ENDPOINT, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    }),
    fetchImpl(OPENROUTER_KEY_ENDPOINT, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    }),
  ]);

  if (keyRes.status === "fulfilled") {
    if (keyRes.value.status === 401 || keyRes.value.status === 403) {
      const err = new Error(`OpenRouter API Key 无效 (${keyRes.value.status})`);
      err.status = keyRes.value.status;
      throw err;
    }
    if (keyRes.value.ok) {
      const body = await keyRes.value.json().catch(() => ({}));
      const data = body?.data ?? body ?? {};
      if (typeof data.is_free_tier === "boolean") isFreeTier = data.is_free_tier;
      if (typeof data.label === "string" && data.label.trim()) keyLabel = data.label.trim();
      if (typeof data.limit === "number" && Number.isFinite(data.limit)) keyLimit = data.limit;
      if (typeof data.limit_remaining === "number" && Number.isFinite(data.limit_remaining)) {
        keyLimitRemaining = data.limit_remaining;
      }
    }
  }

  if (creditsRes.status === "fulfilled") {
    if (creditsRes.value.status === 401 || creditsRes.value.status === 403) {
      const err = new Error(`OpenRouter API Key 无效 (${creditsRes.value.status})`);
      err.status = creditsRes.value.status;
      throw err;
    }
    if (creditsRes.value.ok) {
      const body = await creditsRes.value.json().catch(() => ({}));
      const data = body?.data ?? body ?? {};
      if (typeof data.total_credits === "number" && Number.isFinite(data.total_credits)) {
        totalCredits = data.total_credits;
      }
      if (typeof data.total_usage === "number" && Number.isFinite(data.total_usage)) {
        totalUsage = data.total_usage;
      }
    }
  }

  const rawRemaining = totalCredits !== null && totalUsage !== null
    ? Math.max(0, Number((totalCredits - totalUsage).toFixed(4)))
    : keyLimitRemaining;
  const limitCredits = totalCredits !== null && totalCredits > 0 ? Number(totalCredits.toFixed(4)) : keyLimit;

  // IMPORTANT: On OpenRouter Free, a $0 credit balance is completely normal for free-tier users
  // and must NEVER report `remaining: 0` (which DockyardRuntime treats as `quota_exhausted`).
  const hasPositiveBalance = typeof rawRemaining === "number" && rawRemaining > 0;
  const effectiveRemaining = hasPositiveBalance ? rawRemaining : null;

  const windows = [];
  if (hasPositiveBalance) {
    windows.push({
      id: "credits",
      name: "OpenRouter Credits (免费/隐秘模型不扣费)",
      remaining: rawRemaining,
      limit: limitCredits !== null && limitCredits > 0 ? limitCredits : null,
      unit: "USD",
      resetAt: null,
      updatedAt: nowIso,
      source: "openrouter_credits_api",
    });
  }

  const plan = isFreeTier === false || hasPositiveBalance
    ? "OpenRouter Key (高并发免费额度)"
    : "OpenRouter Free Key (0 扣费无限畅享)";

  return {
    plan,
    keyLabel,
    quota: createQuotaSnapshot({
      remaining: effectiveRemaining,
      limit: hasPositiveBalance ? limitCredits : null,
      unit: "USD",
      resetAt: null,
      updatedAt: nowIso,
      source: "openrouter_credits_api",
      windows,
    }, now),
    quotaDiagnostic: hasPositiveBalance
      ? `账户余额 $${rawRemaining.toFixed(2)} · 调用免费/隐秘限免模型完全 0 扣费`
      : "已绑定 OpenRouter API Key · 免费模型、隐秘模型与限时免费模型全部 0 扣费可用",
  };
}

export class OpenRouterFreeDriver {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.homeDir = options.homeDir ?? os.homedir();
    this.env = options.env ?? process.env;
    this.catalogLoader = options.catalogLoader ?? createOpenRouterFreeCatalogLoader({
      fetchImpl: this.fetchImpl,
      homeDir: this.homeDir,
      env: this.env,
    });
    this.requestExecutor = options.requestExecutor ?? createOpenRouterFreeNativeExecutor({
      fetchImpl: this.fetchImpl,
      homeDir: this.homeDir,
      env: this.env,
    });
  }

  async discover() {
    const keys = discoverLocalOpenRouterKeys({ homeDir: this.homeDir, env: this.env });
    if (keys.length === 0) {
      return {
        source: "openrouter_local_credentials",
        candidates: [],
        diagnostics: ["未在本机环境变量或 DSH Credentials 中发现 OPENROUTER_API_KEY；可直接在上方粘贴 API Key 添加。"],
      };
    }

    const candidates = keys.map((item) => {
      const accountId = `openrouter-free-${item.fingerprint}`;
      return {
        candidateId: `openrouter-free:${accountId}`,
        accountId,
        providerId: PROVIDER_ID,
        displayName: item.label,
        email: item.maskedKey,
        status: "available",
        source: item.source,
        apiKey: item.apiKey,
        fingerprint: item.fingerprint,
        resources: {
          authSource: item.source,
          identitySource: "openrouter_api_key",
          identityLabel: item.maskedKey,
          sessionFingerprint: item.fingerprint,
          identityNote: `OpenRouter API Key (${item.maskedKey}) · 自动同步实时免费与隐秘限免模型`,
          quotaUrl: OPENROUTER_KEYS_PAGE,
        },
      };
    });

    return {
      source: "openrouter_local_credentials",
      candidates,
      diagnostics: [],
    };
  }

  async importAccount(candidate, context = {}) {
    if (!candidate?.accountId) {
      throw new ValidationError("OpenRouter Free candidate accountId is required");
    }
    const localAuth = extractOpenRouterFreeAuth({ homeDir: this.homeDir, env: this.env });
    const apiKey = candidate.apiKey ?? localAuth?.apiKey;
    if (!apiKey) {
      throw new ValidationError("OpenRouter API Key is required to import account");
    }

    const fingerprint = candidate.fingerprint ?? hashApiKeyFingerprint(apiKey);
    const masked = maskApiKey(apiKey);
    const credentialRef = createCredentialRef(PROVIDER_ID, candidate.accountId);
    await writeSecret(context.secretStore, credentialRef, {
      type: "openrouter_free_auth",
      providerId: PROVIDER_ID,
      accountId: candidate.accountId,
      apiKey,
      label: candidate.displayName ?? `OpenRouter Key (${masked})`,
      source: candidate.source ?? "manual_api_key",
      updatedAt: new Date().toISOString(),
    });

    const now = context.now instanceof Date ? context.now : new Date();
    let quotaInfo;
    try {
      quotaInfo = await fetchOpenRouterAccountQuota(apiKey, this.fetchImpl, now);
    } catch {
      quotaInfo = {
        plan: "OpenRouter Free Key (0 扣费无限畅享)",
        quota: createQuotaSnapshot({
          remaining: null,
          limit: null,
          unit: "USD",
          resetAt: null,
          updatedAt: now.toISOString(),
          source: "openrouter_free_key",
          windows: [],
        }, now),
        quotaDiagnostic: "OpenRouter API Key 已接入 · 自动同步实时免费与隐秘限免模型",
      };
    }

    return createAccountRecord({
      providerId: PROVIDER_ID,
      accountId: candidate.accountId,
      displayName: candidate.displayName || quotaInfo.keyLabel || `OpenRouter Key (${masked})`,
      email: candidate.email || masked,
      credentialRef,
      auth: {
        kind: "api_key",
        credentialRef,
        scopes: ["chat", "models", "credits"],
      },
      subscription: {
        plan: quotaInfo.plan,
        status: "active",
      },
      quota: quotaInfo.quota,
      refresh: {
        refreshable: true,
        lastRefreshedAt: now.toISOString(),
      },
      resources: {
        ...(candidate.resources ?? {}),
        authSource: candidate.source ?? "manual_api_key",
        identitySource: "openrouter_api_key",
        identityLabel: masked,
        sessionFingerprint: fingerprint,
        identityNote: `OpenRouter API Key (${masked}) · 实时免费、隐秘与限时免费模型`,
        quotaDiagnostic: quotaInfo.quotaDiagnostic,
        quotaUrl: OPENROUTER_KEYS_PAGE,
      },
      health: {
        status: ACCOUNT_HEALTH.HEALTHY,
      },
    }, now);
  }

  async importSource(source, context = {}) {
    const rawKey = typeof source === "string"
      ? source
      : (source?.apiKey ?? source?.key ?? source?.token ?? source?.content ?? "");
    const apiKey = String(rawKey ?? "").trim();
    if (!apiKey) {
      throw new ValidationError("请输入有效的 OpenRouter API Key（例如 sk-or-v1-...）");
    }

    const customLabel = typeof source === "object" && typeof source?.label === "string"
      ? source.label.trim()
      : "";
    const fingerprint = hashApiKeyFingerprint(apiKey);
    const masked = maskApiKey(apiKey);
    const accountId = `openrouter-free-${fingerprint}`;

    const account = await this.importAccount({
      candidateId: `openrouter-free:${accountId}`,
      accountId,
      providerId: PROVIDER_ID,
      displayName: customLabel || `OpenRouter Key (${masked})`,
      email: masked,
      source: "manual_api_key",
      apiKey,
      fingerprint,
    }, context);

    return [account];
  }

  async getActiveSession(context = {}) {
    const discovered = await this.discover(context);
    if (!discovered.candidates?.length) return null;
    const accounts = [];
    for (const candidate of discovered.candidates) {
      accounts.push(await this.importAccount(candidate, context));
    }
    return {
      status: "completed",
      providerId: PROVIDER_ID,
      instructions: "已自动导入本机 OpenRouter API Key。",
      accounts,
    };
  }

  async startAuthorization(context = {}) {
    const active = await this.getActiveSession(context);
    if (active) return active;
    return {
      status: "opened",
      providerId: PROVIDER_ID,
      authorizationUrl: OPENROUTER_KEYS_PAGE,
      instructions: "请在下方直接粘贴您的 OpenRouter API Key（sk-or-v1-...），或在打开的 OpenRouter 页面创建新 Key 后粘贴添加。",
    };
  }

  async refreshAccount(account, context = {}) {
    const stored = await readSecret(context.secretStore, account?.auth?.credentialRef);
    const localAuth = extractOpenRouterFreeAuth({ homeDir: this.homeDir, env: this.env });
    const apiKey = stored?.apiKey ?? localAuth?.apiKey;
    if (!apiKey) {
      return {
        account: {
          ...account,
          health: {
            status: ACCOUNT_HEALTH.EXPIRED,
            lastError: "未找到对应的 OpenRouter API Key，请在上方重新粘贴添加。",
          },
        },
      };
    }

    // Force-refresh live free/stealth/limited-free models whenever the account is refreshed
    await fetchLiveOpenRouterFreeModels({
      fetchImpl: this.fetchImpl,
      apiKey,
      forceRefresh: true,
    }).catch(() => {});

    const now = context.now instanceof Date ? context.now : new Date();
    try {
      const quotaInfo = await fetchOpenRouterAccountQuota(apiKey, this.fetchImpl, now);
      return {
        account: {
          ...account,
          subscription: {
            plan: quotaInfo.plan,
            status: "active",
          },
          quota: quotaInfo.quota,
          refresh: {
            ...account.refresh,
            refreshable: true,
            lastRefreshedAt: now.toISOString(),
          },
          resources: {
            ...(account.resources ?? {}),
            quotaDiagnostic: quotaInfo.quotaDiagnostic,
            quotaUrl: OPENROUTER_KEYS_PAGE,
          },
          health: {
            status: ACCOUNT_HEALTH.HEALTHY,
            lastError: null,
          },
        },
      };
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        return {
          account: {
            ...account,
            health: {
              status: ACCOUNT_HEALTH.EXPIRED,
              lastError: err.message,
            },
          },
        };
      }
      return {
        account: {
          ...account,
          refresh: {
            ...account.refresh,
            refreshable: true,
            lastRefreshedAt: now.toISOString(),
          },
          health: {
            status: ACCOUNT_HEALTH.HEALTHY,
            lastError: null,
          },
        },
      };
    }
  }

  async getQuota(account, context = {}) {
    const refreshed = await this.refreshAccount(account, context);
    return refreshed.account.quota;
  }

  async getCatalog(context = {}) {
    let credential = null;
    if (context?.secretStore && context?.accounts?.[0]?.auth?.credentialRef) {
      credential = await readSecret(context.secretStore, context.accounts[0].auth.credentialRef);
    }
    return this.catalogLoader({
      ...context,
      force: Boolean(context?.force),
      credential,
    });
  }

  async invoke(request, invocation, context = {}) {
    return this.stream(request, invocation, context);
  }

  async stream(request, invocation, context = {}) {
    if (typeof this.requestExecutor !== "function") {
      throw new DockyardError("provider_execution_error", "OpenRouter Free requestExecutor is not configured", {
        retryable: false,
      });
    }
    const credential = await readSecret(context.secretStore, invocation?.account?.auth?.credentialRef);
    return this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? request?.signal ?? null,
    });
  }
}

export function createOpenRouterFreeDriver(options = {}) {
  return new OpenRouterFreeDriver(options);
}
