import { createHash } from "node:crypto";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import { createAccountRecord, createQuotaSnapshot } from "../../../packages/core/src/contracts.mjs";
import { ValidationError } from "../../../packages/core/src/errors.mjs";
import {
  assertSecureEndpointUrl,
  fetchJson,
  resolveContextWindowFromModel,
  resolveMaxTokensFromModel,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  DEFAULT_AGENTROUTER_MODELS_ENDPOINT,
  DEFAULT_AGENTROUTER_USER_AGENT,
  createAgentRouterNativeExecutor,
} from "./native-transport.mjs";

const PROVIDER_ID = "agentrouter";

/** The three reasoning levels exposed by the AgentRouter transport. */
const AGENTROUTER_REASONING = Object.freeze({
  efforts: [
    { id: "low", name: "Low" },
    { id: "medium", name: "Medium", default: true },
    { id: "high", name: "High" },
  ],
  defaultEffort: "medium",
});

/**
 * The current model list omits reasoning support. Recognize reasoning families
 * so a change like gpt-6.1-sol to gpt-6.2-sol does not hide the tier picker.
 * Requests using low/medium/high were accepted for both GPT-6.2 models.
 */
const AGENTROUTER_REASONING_FAMILY = /^(?:gpt-[5-9](?:[.-]|$)|o[1-9](?:[.-]|$))/iu;

function agentRouterReasoningFor(id, known) {
  if (known?.reasoning) return known.reasoning;
  return AGENTROUTER_REASONING_FAMILY.test(id) ? AGENTROUTER_REASONING : null;
}

// The live list omits context limits. AgentRouter accepted 400,011 input
// tokens on Sol and 401,011 on Astra (2026-11-27). Use a budget within both
// measurements, not an estimate of the maximum upstream context window.
const GPT_6_2_CONTEXT_FALLBACK = 400_000;

export const BUILTIN_AGENTROUTER_MODELS = Object.freeze([
  { id: "gpt-6.2-sol", name: "GPT-6.2 Sol", contextWindow: GPT_6_2_CONTEXT_FALLBACK, maxTokens: 32_768, inputModalities: ["text"], reasoning: AGENTROUTER_REASONING },
  { id: "gpt-6.2-astra", name: "GPT-6.2 Astra", contextWindow: GPT_6_2_CONTEXT_FALLBACK, maxTokens: 32_768, inputModalities: ["text"], reasoning: AGENTROUTER_REASONING },
]);

function fingerprintApiKey(apiKey) {
  return createHash("sha256").update(String(apiKey)).digest("hex").slice(0, 16);
}

function maskApiKey(apiKey) {
  const value = String(apiKey ?? "");
  if (value.length <= 10) return "****";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function parseAgentRouterCatalog(data) {
  const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const builtinById = new Map(BUILTIN_AGENTROUTER_MODELS.map((model) => [model.id, model]));
  const models = [];
  const seen = new Set();
  for (const item of list) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const known = builtinById.get(id) ?? null;
    const reasoning = agentRouterReasoningFor(id, known);
    models.push({
      id,
      name: typeof item?.name === "string" && item.name.length > 0 ? item.name : id,
      contextWindow: resolveContextWindowFromModel(item, known?.contextWindow ?? 128_000),
      maxTokens: resolveMaxTokensFromModel(item, known?.maxTokens ?? 32_768),
      inputModalities: ["text"],
      ...(reasoning ? { reasoning } : {}),
    });
  }
  return models.length > 0 ? { models, source: "agentrouter_live_catalog" } : null;
}

export function createAgentRouterCatalogLoader({
  modelsUrl = DEFAULT_AGENTROUTER_MODELS_ENDPOINT,
  fetchImpl = fetch,
  userAgent = DEFAULT_AGENTROUTER_USER_AGENT,
  cacheTtlMs = 300_000,
} = {}) {
  let cached = null;
  let cachedAt = 0;
  return async function agentRouterCatalogLoader({ force = false, credential = null, accounts = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;

    let token = credential?.apiKey ?? credential?.access ?? null;
    if (!token && Array.isArray(accounts) && accounts.length > 0) token = accounts[0]?.auth?.apiKey ?? null;

    if (token) {
      try {
        assertSecureEndpointUrl(modelsUrl, { providerId: PROVIDER_ID });
        const { body } = await fetchJson(
          modelsUrl,
          {
            headers: {
              Accept: "application/json",
              // The allow-list is enforced on the client string, even for reads.
              "user-agent": userAgent,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
          { fetchImpl, timeoutMs: 20_000 },
        );
        const parsed = parseAgentRouterCatalog(body);
        if (parsed) {
          cached = parsed;
          cachedAt = now;
          return cached;
        }
      } catch {
        // Fall back to the advertised models rather than reporting none.
      }
    }

    cached = {
      models: BUILTIN_AGENTROUTER_MODELS.map((model) => ({ ...model })),
      source: "agentrouter_builtin_catalog",
      ...(token ? {} : { diagnostics: ["尚未配置 API Key，以下为默认模型；添加账号后可读取实时目录"] }),
    };
    cachedAt = now;
    return cached;
  };
}

export function summarizeAgentRouterCandidate(candidate) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate?.candidateId ?? "agentrouter-default",
    displayName: candidate?.displayName ?? "AgentRouter",
    email: candidate?.email ?? null,
    plan: candidate?.subscription?.plan ?? "AgentRouter 余额账户",
    quota: candidate?.quota ?? null,
  };
}

export class AgentRouterDriver {
  constructor({
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    env = process.env,
    userAgent = env.DOCKYARD_AGENTROUTER_USER_AGENT || DEFAULT_AGENTROUTER_USER_AGENT,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.env = env;
    this.userAgent = userAgent;
    this.catalogLoader = catalogLoader ?? createAgentRouterCatalogLoader({ fetchImpl, userAgent });
    this.requestExecutor = requestExecutor ?? createAgentRouterNativeExecutor({ fetchImpl, env, userAgent });
  }

  async discover() {
    const envKey = typeof this.env.AGENTROUTER_API_KEY === "string" && this.env.AGENTROUTER_API_KEY.length > 0
      ? this.env.AGENTROUTER_API_KEY
      : null;
    if (!envKey) {
      return {
        source: "agentrouter_env",
        candidates: [],
        diagnostics: ["未在环境变量中发现 AGENTROUTER_API_KEY；可在面板中直接粘贴 AgentRouter 的 sk- Key。"],
      };
    }
    return {
      source: "agentrouter_env",
      candidates: [{
        candidateId: `agentrouter:${fingerprintApiKey(envKey)}`,
        accountId: `agentrouter-${fingerprintApiKey(envKey)}`,
        providerId: PROVIDER_ID,
        displayName: `AgentRouter Key (${maskApiKey(envKey)})`,
        apiKey: envKey,
        subscription: { plan: "AgentRouter 余额账户", status: "active" },
      }],
    };
  }

  async importAccount(candidate, context = {}) {
    const apiKey = String(candidate?.apiKey ?? "").trim();
    const accountId = candidate?.accountId || `agentrouter-${fingerprintApiKey(apiKey)}`;
    const ref = createCredentialRef(PROVIDER_ID, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "agentrouter_api_key",
        providerId: PROVIDER_ID,
        apiKey,
        displayName: candidate?.displayName || "AgentRouter",
      }).catch(() => {});
    }
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || `AgentRouter Key (${maskApiKey(apiKey)})`,
      email: candidate?.email ?? null,
      auth: { kind: "api_key", credentialRef: ref },
      subscription: { plan: "AgentRouter 余额账户", status: "active", expiresAt: null },
      resources: {
        quotaSource: "agentrouter_balance",
        quotaAvailable: false,
        quotaDiagnostic: "余额在 AgentRouter 控制台的「钱包」查看；接口未提供余额查询",
        quotaUrl: "https://agentrouter.org",
      },
      health: { status: "healthy" },
    });
  }

  async importSource(source, context = {}) {
    const raw = typeof source === "string" ? source : (source?.apiKey ?? source?.key ?? source?.token ?? "");
    const apiKey = String(raw ?? "").trim();
    if (!apiKey) throw new ValidationError("请输入 AgentRouter API Key");
    const label = typeof source === "object" && typeof source?.label === "string" ? source.label.trim() : "";
    return [await this.importAccount({
      apiKey,
      source: "manual_api_key",
      displayName: label || `AgentRouter Key (${maskApiKey(apiKey)})`,
      email: maskApiKey(apiKey),
    }, context)];
  }

  async refreshAccount(account, context = {}) {
    let apiKey = null;
    if (context.secretStore && account?.auth?.credentialRef) {
      try {
        const stored = await context.secretStore.read(account.auth.credentialRef);
        apiKey = stored?.apiKey ?? null;
      } catch {}
    }
    return {
      health: {
        status: apiKey || account?.auth?.credentialRef ? "healthy" : "expired",
        lastCheckedAt: new Date().toISOString(),
      },
      quota: await this.getQuota(account, context),
    };
  }

  async getQuota(account, context = {}) {
    return {
      quota: createQuotaSnapshot({}),
      resources: {
        quotaSource: "agentrouter_balance",
        quotaDiagnostic: "余额在 AgentRouter 控制台的「钱包」查看；接口未提供余额查询",
        quotaUrl: "https://agentrouter.org",
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
      attachments: context.attachments ?? invocation?.attachments ?? null,
    });
  }
}

export function createAgentRouterDriver(options = {}) {
  return new AgentRouterDriver(options);
}
