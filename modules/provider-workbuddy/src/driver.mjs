import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import { ValidationError } from "../../../packages/core/src/errors.mjs";
import {
  resolveContextWindowFromModel,
  resolveMaxTokensFromModel,
  resolveReasoningFromModel,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  DEFAULT_WORKBUDDY_ENDPOINT,
  createWorkbuddyNativeExecutor,
  extractWorkbuddySession,
  findWorkbuddyAuthFilePath,
  findWorkbuddyConfigDir,
  findWorkbuddyElectronPath,
} from "./native-transport.mjs";

const PROVIDER_ID = "workbuddy";

/** Stable per-token identifier so pasting the same token twice reuses one account. */
function fingerprintToken(token) {
  return createHash("sha256").update(String(token)).digest("hex").slice(0, 16);
}

/** Display form of an access token: never echo the whole secret back. */
function maskToken(token) {
  const value = String(token ?? "");
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * Read the official desktop session if it is available. WorkBuddy has no OAuth
 * and no user-facing API key: the plugin decrypts the access token the official
 * macOS app keeps in its own storage. A `WORKBUDDY_ACCESS_TOKEN` environment
 * variable is the only supported way to run it without that app.
 */
function workbuddySession() {
  try {
    return extractWorkbuddySession();
  } catch {
    return null;
  }
}

function envAccessToken() {
  const token = process.env.WORKBUDDY_ACCESS_TOKEN;
  return token && token.trim().length > 0 ? token.trim() : null;
}

export const BUILTIN_WORKBUDDY_FREE_MODELS = Object.freeze([
  {
    id: "hy4free",
    name: "Hy4",
    contextWindow: 1000000,
    maxTokens: 64000,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "hy4",
    name: "Hy4",
    contextWindow: 1000000,
    maxTokens: 64000,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek v4.1 Flash",
    contextWindow: 1000000,
    maxTokens: 128000,
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
    id: "hy3",
    name: "Hunyuan 3",
    contextWindow: 192000,
    maxTokens: 64000,
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
]);

export function summarizeWorkbuddyCandidate(candidate) {
  return candidate?.displayName ?? candidate?.email ?? candidate?.accountId ?? "WorkBuddy Free";
}

function findLocalWorkbuddySnapshot() {
  const configDir = findWorkbuddyConfigDir();
  let latestFile = null;
  let latestMtime = 0;

  if (configDir) {
    const storageDir = join(configDir, "storage");
    if (existsSync(storageDir)) {
      try {
        const userDirs = readdirSync(storageDir).filter((d) => d.startsWith("user-"));
        for (const userDir of userDirs) {
          const scopedDir = join(storageDir, userDir, "scoped");
          if (existsSync(scopedDir)) {
            const scopes = readdirSync(scopedDir);
            for (const scope of scopes) {
              const configFile = join(scopedDir, scope, "wb-product-config.json");
              if (existsSync(configFile)) {
                try {
                  const mtime = statSync(configFile).mtimeMs;
                  if (mtime > latestMtime) {
                    latestMtime = mtime;
                    latestFile = configFile;
                  }
                } catch {}
              }
            }
          }
        }
      } catch {}
    }
  }

  if (latestFile) return latestFile;

  const appAsarProductJson = "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar/cli/product.json";
  if (existsSync(appAsarProductJson)) return appAsarProductJson;

  const unpackedProductJson = "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar.unpacked/cli/product.json";
  if (existsSync(unpackedProductJson)) return unpackedProductJson;

  return null;
}

export function parseWorkbuddyCatalog(data) {
  let rawModels = [];
  if (data?.["product-config-snapshot"]?.data?.models) {
    rawModels = data["product-config-snapshot"].data.models;
  } else if (Array.isArray(data?.models)) {
    rawModels = data.models;
  } else if (Array.isArray(data?.data)) {
    rawModels = data.data;
  }

  if (!rawModels || rawModels.length === 0) {
    return { models: [...BUILTIN_WORKBUDDY_FREE_MODELS] };
  }

  const freeModels = [];
  const paidModels = [];
  const seen = new Set();

  for (const item of rawModels) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const credits = stringValue(item?.credits) ?? "";
    const isFree = credits === "x0.00" || credits === "x0.00 credits" || credits === "0.00x" || credits === "0" || item?.free === true || item?.isFree === true;

    const baseName = stringValue(item?.name) || stringValue(item?.title) || id;
    // A paid model keeps its credit cost; the free rotation needs no provider
    // suffix because the picker already groups models by provider.
    const name = credits && !isFree ? `${baseName} (${credits})` : baseName;
    const builtin = BUILTIN_WORKBUDDY_FREE_MODELS.find((m) => m.id === id);

    const contextWindow = resolveContextWindowFromModel(item, builtin?.contextWindow ?? 131072);
    const maxTokens = resolveMaxTokensFromModel(item, builtin?.maxTokens ?? 16384);
    const reasoning = resolveReasoningFromModel(item) ?? builtin?.reasoning;

    const modelRecord = {
      id,
      name,
      contextWindow,
      maxTokens,
      free: isFree,
      credits,
      ...(reasoning ? { reasoning } : {}),
    };

    if (isFree) {
      freeModels.push(modelRecord);
    } else {
      paidModels.push(modelRecord);
    }
  }

  return { models: [...freeModels, ...paidModels] };
}

export function createWorkbuddyCatalogLoader({
  cacheTtlMs = 60_000,
} = {}) {
  let cached = null;
  let cachedAt = 0;

  return async function workbuddyCatalogLoader({ force = false } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }

    const snapshotPath = findLocalWorkbuddySnapshot();
    if (snapshotPath) {
      try {
        const raw = readFileSync(snapshotPath, "utf8");
        const json = JSON.parse(raw);
        cached = parseWorkbuddyCatalog(json);
        cachedAt = Date.now();
        return cached;
      } catch {}
    }

    cached = { models: [...BUILTIN_WORKBUDDY_FREE_MODELS] };
    cachedAt = Date.now();
    return cached;
  };
}

export class WorkbuddyDriver {
  constructor({
    endpoint = DEFAULT_WORKBUDDY_ENDPOINT,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 120_000,
  } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createWorkbuddyCatalogLoader({ cacheTtlMs: 60_000 });
    this.requestExecutor = requestExecutor ?? createWorkbuddyNativeExecutor({
      endpoint,
      fetchImpl,
      timeoutMs,
    });
  }

  async discover() {
    const session = workbuddySession();
    const usable = Boolean(session?.accessToken) || Boolean(envAccessToken());

    const displayName = session?.nickname
      ? `WorkBuddy Free (${session.nickname})`
      : "WorkBuddy Free";
    const email = session?.email || (session?.nickname?.includes("@") ? session.nickname : "workbuddy@desktop.ai");

    return {
      candidates: [
        {
          candidateId: "workbuddy-free",
          accountId: "workbuddy-free",
          displayName,
          email,
          subscription: {
            plan: "WorkBuddy Free Rotation",
            status: usable ? "active" : "unknown",
          },
          // WorkBuddy publishes no quota, and this plugin does not invent one.
          quota: { source: "unknown" },
          source: "workbuddy_free_tier",
          health: {
            status: usable ? "healthy" : "auth_expired",
          },
        },
      ],
      source: "workbuddy_free_tier",
      diagnostics: usable
        ? []
        : ["未检测到 WorkBuddy 官方桌面端会话；请登录官方 WorkBuddy 桌面端，或在面板中填写 access token。"],
    };
  }

  async importAccount(candidate, context = {}) {
    const accountId = candidate?.accountId || "workbuddy-free";
    const ref = createCredentialRef(PROVIDER_ID, accountId);

    if (context.secretStore) {
      let session = null;
      try {
        session = extractWorkbuddySession();
      } catch {}

      await context.secretStore.write(ref, {
        type: "workbuddy_free",
        access: session?.accessToken || "free-tier",
        uid: session?.uid || null,
        email: session?.email || null,
      }).catch(() => {});
    }

    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || "WorkBuddy Free",
      email: candidate?.email || "workbuddy@desktop.ai",
      auth: {
        kind: "workbuddy_free",
        credentialRef: ref,
      },
      subscription: {
        plan: candidate?.subscription?.plan || "WorkBuddy Free Rotation",
        status: "active",
      },
      quota: createQuotaSnapshot(candidate?.quota ?? {}),
      health: {
        status: candidate?.health?.status ?? "healthy",
      },
    });
  }

  async getActiveSession() {
    return this.discover().then((res) => (Array.isArray(res?.candidates) ? res.candidates[0] : null));
  }

  /**
   * WorkBuddy has no authorization page: the account lives in the official
   * desktop client, and this plugin reads that session. Saying so is the whole
   * instruction — there is no key the user could paste in its place.
   */
  async authorizationInstructions() {
    const session = workbuddySession();
    if (session?.accessToken) {
      return "已检测到 WorkBuddy 官方桌面端会话，点「扫描本机登录态」即可添加该账号。";
    }
    return "WorkBuddy 使用官方桌面端的账号会话，没有 OAuth 授权页，也没有可填写的 API Key。"
      + "请先安装并登录 WorkBuddy 官方桌面端，然后点「扫描本机登录态」；"
      + "插件会读取该客户端的登录状态，不能凭空创建一个账号。"
      + "（无法安装桌面端的高级用法：在启动 DSH 的 shell 中设置 WORKBUDDY_ACCESS_TOKEN。）";
  }

  /** Resolve a usable token from the imported credential, the environment or the desktop app. */
  async #resolveAccessToken(account, context = {}) {
    if (context.secretStore && account?.auth?.credentialRef) {
      try {
        const secret = await context.secretStore.read(account.auth.credentialRef);
        const stored = stringValue(secret?.access);
        if (stored && stored !== "free-tier") return stored;
      } catch {}
    }
    const fromEnv = envAccessToken();
    if (fromEnv) return fromEnv;
    return workbuddySession()?.accessToken ?? null;
  }

  async refreshAccount(account, context = {}) {
    const token = await this.#resolveAccessToken(account, context);
    // No token means every request would fail; reporting "healthy" here would
    // be an invented result, which this plugin never reports.
    if (!token) return { health: { status: "auth_expired" } };
    return {
      health: {
        status: "healthy",
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }

  async getQuota() {
    // WorkBuddy exposes no quota surface; leave the numbers unknown.
    return createQuotaSnapshot({ source: "unknown" });
  }

  async getCatalog(context = {}) {
    return this.catalogLoader({ force: Boolean(context.force) });
  }

  async invoke(request, invocation, context = {}) {
    const envelope = (request && typeof request === "object" && ("request" in request || "credential" in request))
      ? request
      : null;
    const req = envelope?.request ?? request ?? {};
    const inv = envelope?.invocation ?? invocation ?? {};
    const ctx = envelope?.context ?? context ?? {};
    const executor = ctx.requestExecutor ?? this.requestExecutor;
    let credential = envelope?.credential ?? null;
    if (!credential && ctx.secretStore && inv?.auth?.credentialRef) {
      credential = await ctx.secretStore.read(inv.auth.credentialRef).catch(() => null);
    }
    if (!credential) {
      credential = inv?.auth ?? { access: "free-tier" };
    }
    return executor({
      request: req,
      invocation: inv,
      context: ctx,
      attachments: ctx.attachments ?? inv?.attachments,
      credential,
      signal: ctx.signal ?? inv?.signal,
    });
  }

  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
}

export function createWorkbuddyDriver(options = {}) {
  return new WorkbuddyDriver(options);
}
