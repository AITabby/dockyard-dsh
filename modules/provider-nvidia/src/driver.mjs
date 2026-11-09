import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import { ValidationError } from "../../../packages/core/src/errors.mjs";
import {
  assertSecureEndpointUrl,
  fetchJson,
  resolveContextWindowFromModel,
  resolveMaxTokensFromModel,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  DEFAULT_NVIDIA_MODELS_ENDPOINT,
  createNvidiaNativeExecutor,
} from "./native-transport.mjs";

const PROVIDER_ID = "nvidia-nim";

/** NVIDIA hosts a free tier; usage is rate limited rather than metered. */
const NVIDIA_FREE_NOTE = "NVIDIA NIM 免费额度：按速率限制，不按金额计量";

/** Stable per-key identifier so pasting the same key twice reuses one account. */
function fingerprintApiKey(apiKey) {
  return createHash("sha256").update(String(apiKey)).digest("hex").slice(0, 16);
}

function maskApiKey(apiKey) {
  const value = String(apiKey ?? "");
  if (value.length <= 10) return "****";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function isNvidiaKey(value) {
  return typeof value === "string" && value.startsWith("nvapi-");
}

/**
 * NVIDIA's list carries no display name, and the `vendor/` prefix in an id like
 * `meta/llama-3.3-70b-instruct` names the model's origin rather than the
 * provider (which is NVIDIA, shown as the group header), so it stays.
 */
function modelLabel(id) {
  return id;
}

export function parseNvidiaCatalog(data) {
  const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  const models = [];
  const seen = new Set();
  for (const item of list) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({
      id,
      name: modelLabel(id),
      contextWindow: resolveContextWindowFromModel(item, 128_000),
      maxTokens: resolveMaxTokensFromModel(item, 16_384),
      inputModalities: ["text"],
      // Everything NVIDIA hosts here is on the free tier; the panel groups by
      // this flag, and a model that is not free would need its own pricing.
      free: true,
    });
  }
  return { models, source: "nvidia_live_catalog" };
}

export function createNvidiaCatalogLoader({
  modelsUrl = DEFAULT_NVIDIA_MODELS_ENDPOINT,
  fetchImpl = fetch,
  cacheTtlMs = 300_000,
} = {}) {
  let cached = null;
  let cachedAt = 0;

  return async function nvidiaCatalogLoader({ force = false, credential = null, accounts = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;

    let token = credential?.apiKey ?? credential?.access ?? null;
    if (!token && Array.isArray(accounts) && accounts.length > 0) token = accounts[0]?.auth?.apiKey ?? null;

    try {
      assertSecureEndpointUrl(modelsUrl, { providerId: PROVIDER_ID });
      const { body } = await fetchJson(
        modelsUrl,
        { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
        { fetchImpl, timeoutMs: 20_000 },
      );
      const parsed = parseNvidiaCatalog(body);
      if (parsed.models.length > 0) {
        cached = parsed;
        cachedAt = now;
        return cached;
      }
    } catch {
      // Fall through to the diagnostic below rather than pretending the
      // catalog is empty because of a network blip.
    }

    return {
      models: cached?.models ?? [],
      source: "nvidia_live_catalog",
      diagnostics: ["未能读取 NVIDIA 模型列表（https://integrate.api.nvidia.com/v1/models），稍后重试"],
    };
  };
}

/**
 * DSH keeps a plain `NVIDIA_API_KEY` entry for its own built-in provider. Reuse
 * it so the panel can show NVIDIA without asking for the key a second time; the
 * file is only read, never written.
 */
function discoverDshCredentialKey({ home = homedir() } = {}) {
  try {
    const path = join(home, ".dsh", ".credentials.yaml");
    if (!existsSync(path)) return null;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*NVIDIA_API_KEY:\s*(\S+)\s*$/u.exec(line);
      if (match) {
        const value = match[1].replace(/^["']|["']$/gu, "");
        if (isNvidiaKey(value)) return value;
      }
    }
  } catch {
    // A missing or unreadable credentials file simply means no fallback.
  }
  return null;
}

export function summarizeNvidiaCandidate(candidate) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate?.candidateId ?? "nvidia-default",
    displayName: candidate?.displayName ?? "NVIDIA NIM",
    email: candidate?.email ?? null,
    plan: candidate?.subscription?.plan ?? "NVIDIA NIM 免费",
    quota: candidate?.quota ?? null,
  };
}

export class NvidiaDriver {
  constructor({
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    env = process.env,
    home = homedir(),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.env = env;
    this.home = home;
    this.catalogLoader = catalogLoader ?? createNvidiaCatalogLoader({ fetchImpl });
    this.requestExecutor = requestExecutor ?? createNvidiaNativeExecutor({ fetchImpl, env });
  }

  /** NVIDIA has no OAuth: a key comes from build.nvidia.com, or the environment. */
  async discover() {
    const envKey = typeof this.env.NVIDIA_API_KEY === "string" && this.env.NVIDIA_API_KEY.length > 0
      ? this.env.NVIDIA_API_KEY
      : null;
    const key = envKey ?? discoverDshCredentialKey({ home: this.home });
    if (!key) {
      return {
        source: "nvidia_env",
        candidates: [],
        diagnostics: ["未发现 NVIDIA_API_KEY；可在面板中直接粘贴 build.nvidia.com 生成的 nvapi- Key。"],
      };
    }
    return {
      source: envKey ? "nvidia_env" : "dsh_credentials",
      candidates: [{
        candidateId: `nvidia:${fingerprintApiKey(key)}`,
        accountId: `nvidia-nim-${fingerprintApiKey(key)}`,
        providerId: PROVIDER_ID,
        displayName: `NVIDIA Key (${maskApiKey(key)})`,
        apiKey: key,
        subscription: { plan: "NVIDIA NIM 免费", status: "active" },
      }],
    };
  }

  async importAccount(candidate, context = {}) {
    const apiKey = String(candidate?.apiKey ?? "").trim();
    const accountId = candidate?.accountId || `nvidia-nim-${fingerprintApiKey(apiKey)}`;
    const ref = createCredentialRef(PROVIDER_ID, accountId);

    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "nvidia_api_key",
        providerId: PROVIDER_ID,
        apiKey,
        displayName: candidate?.displayName || "NVIDIA NIM",
      }).catch(() => {});
    }

    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || `NVIDIA Key (${maskApiKey(apiKey)})`,
      email: candidate?.email ?? null,
      auth: { kind: "api_key", credentialRef: ref },
      subscription: { plan: "NVIDIA NIM 免费", status: "active", expiresAt: null },
      resources: {
        quotaSource: "nvidia_free_tier",
        quotaAvailable: false,
        quotaDiagnostic: NVIDIA_FREE_NOTE,
        quotaUrl: "https://build.nvidia.com",
      },
      health: { status: "healthy" },
    });
  }

  async importSource(source, context = {}) {
    const raw = typeof source === "string" ? source : (source?.apiKey ?? source?.key ?? source?.token ?? "");
    const apiKey = String(raw ?? "").trim();
    if (!apiKey) throw new ValidationError("请输入 NVIDIA API Key（形如 nvapi-...）");
    if (!isNvidiaKey(apiKey)) throw new ValidationError("NVIDIA API Key 应以 nvapi- 开头，请到 build.nvidia.com 复制");
    const label = typeof source === "object" && typeof source?.label === "string" ? source.label.trim() : "";
    return [await this.importAccount({
      apiKey,
      source: "manual_api_key",
      displayName: label || `NVIDIA Key (${maskApiKey(apiKey)})`,
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
        // A missing key is the only unhealthy state we can observe locally;
        // rate limits surface as request errors on the first call.
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
        quotaSource: "nvidia_free_tier",
        quotaDiagnostic: NVIDIA_FREE_NOTE,
        quotaUrl: "https://build.nvidia.com",
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

export function createNvidiaDriver(options = {}) {
  return new NvidiaDriver(options);
}
