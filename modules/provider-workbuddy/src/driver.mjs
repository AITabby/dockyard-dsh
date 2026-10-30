import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import { stringValue } from "../../../packages/providers/src/provider-utils.mjs";
import {
  DEFAULT_WORKBUDDY_ENDPOINT,
  createWorkbuddyNativeExecutor,
  extractWorkbuddySession,
  findWorkbuddyAuthFilePath,
  findWorkbuddyConfigDir,
  findWorkbuddyElectronPath,
} from "./native-transport.mjs";

const PROVIDER_ID = "workbuddy";

export const BUILTIN_WORKBUDDY_FREE_MODELS = Object.freeze([
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek v4.1 Flash (WorkBuddy Free)",
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
    name: "Hunyuan 3 (WorkBuddy Free)",
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
                return configFile;
              }
            }
          }
        }
      } catch {}
    }
  }

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
    const isFree = credits === "x0.00" || credits === "x0.00 credits" || credits === "0" || item?.free === true || item?.isFree === true;

    const baseName = stringValue(item?.name) || stringValue(item?.title) || id;
    const name = isFree && !baseName.toLowerCase().includes("free") ? `${baseName} (WorkBuddy Free)` : baseName;

    const contextWindow = Number.isInteger(item?.maxInputTokens)
      ? item.maxInputTokens
      : Number.isInteger(item?.contextWindow)
        ? item.contextWindow
        : 131072;

    const maxTokens = Number.isInteger(item?.maxOutputTokens)
      ? item.maxOutputTokens
      : Number.isInteger(item?.maxTokens)
        ? item.maxTokens
        : 16384;

    const modelRecord = {
      id,
      name,
      contextWindow,
      maxTokens,
      free: isFree,
      credits,
      reasoning: {
        efforts: [
          { id: "minimal", name: "Minimal" },
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
        ],
        defaultEffort: "medium",
      },
    };

    if (isFree) {
      freeModels.push(modelRecord);
    } else {
      paidModels.push(modelRecord);
    }
  }

  // Ensure builtin free models are included if missing
  for (const builtin of BUILTIN_WORKBUDDY_FREE_MODELS) {
    if (!seen.has(builtin.id)) {
      freeModels.unshift(builtin);
      seen.add(builtin.id);
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
    const electronPath = findWorkbuddyElectronPath();
    const authPath = findWorkbuddyAuthFilePath();
    const hasEnvToken = Boolean(process.env.WORKBUDDY_ACCESS_TOKEN);

    if (!electronPath && !authPath && !hasEnvToken) {
      return {
        candidates: [],
        source: "workbuddy_free_tier",
        diagnostics: ["No WorkBuddy installation or session found on macOS"],
      };
    }

    let session = null;
    try {
      session = extractWorkbuddySession();
    } catch {}

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
            status: "active",
          },
          quota: {
            remaining: 100,
            limit: 100,
            unit: "requests",
            updatedAt: new Date().toISOString(),
          },
          source: "workbuddy_free_tier",
          health: {
            status: "healthy",
          },
        },
      ],
      source: "workbuddy_free_tier",
      diagnostics: [],
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

export function createWorkbuddyDriver(options = {}) {
  return new WorkbuddyDriver(options);
}
