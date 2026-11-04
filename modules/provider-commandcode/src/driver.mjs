import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  createAccountRecord,
  createQuotaSnapshot,
} from "../../../packages/core/src/contracts.mjs";
import {
  resolveContextWindowFromModel,
  resolveMaxTokensFromModel,
  resolveReasoningFromModel,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  DEFAULT_COMMANDCODE_CREDITS_ENDPOINT,
  DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  DEFAULT_COMMANDCODE_MODELS_ENDPOINT,
  DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT,
  DEFAULT_COMMANDCODE_WHOAMI_ENDPOINT,
  createCommandCodeNativeExecutor,
  extractCommandCodeAuth,
  findCommandCodeAuthFilePath,
} from "./native-transport.mjs";

const PROVIDER_ID = "commandcode";

function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const BUILTIN_COMMANDCODE_MODELS = Object.freeze([
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash (Command Code)",
    contextWindow: 1000000,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
    // The live provider catalog reports ["text","image"] for this model, and a
    // direct request proves the gateway forwards image parts to it (verified
    // 2026-11-04: image token delta was +195 and the model read a red/green/blue
    // test chart correctly). The builtin fallback must not be more restrictive
    // than the catalog, or images are silently dropped whenever the live
    // catalog is unavailable or stale.
    inputModalities: ["text", "image"],
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro (Command Code)",
    contextWindow: 1000000,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "high", name: "High", default: true },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
    inputModalities: ["text"],
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5 (Command Code)",
    contextWindow: 1000000,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
    inputModalities: ["text", "image"],
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (Command Code)",
    contextWindow: 1000000,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "max", name: "Max" },
      ],
      defaultEffort: "high",
    },
    inputModalities: ["text", "image"],
  },
  {
    id: "xai/grok-4.7",
    name: "Grok 4.7 (Command Code)",
    contextWindow: 500000,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
    inputModalities: ["text", "image"],
  },
  {
    id: "meta/muse-spark-1.2",
    name: "Muse Spark 1.2 (Command Code)",
    contextWindow: 1048576,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
    inputModalities: ["text", "image"],
  },
  {
    id: "mistral/mistral-large-4",
    name: "Mistral Large 4 (Command Code)",
    contextWindow: 524288,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
      ],
      defaultEffort: "high",
    },
    inputModalities: ["text", "image"],
  },
]);

export function summarizeCommandCodeCandidate(candidate) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate?.candidateId ?? "commandcode-default",
    accountId: candidate?.accountId ?? "commandcode-default",
    displayName: candidate?.displayName ?? "Command Code",
    email: candidate?.email ?? "user@commandcode.ai",
    source: candidate?.source ?? "commandcode_auth",
    subscription: { ...candidate?.subscription },
    quota: { ...candidate?.quota },
  };
}

function findLocalCommandCodeCatalogFile() {
  const dir = join(homedir(), ".commandcode", "cache", "model-catalog", "v1");
  if (existsSync(dir)) {
    try {
      const files = readdirSync(dir).filter((f) => f.startsWith("catalog-") && f.endsWith(".json"));
      if (files.length > 0) {
        return join(dir, files[0]);
      }
    } catch {}
  }

  const devJson = join(homedir(), ".commandcode", "cache", "models-dev.json");
  if (existsSync(devJson)) return devJson;

  return null;
}

const KNOWN_RETIRED_COMMANDCODE_MODELS = new Set([
  "poolside/laguna-s-2.1-free",
]);

export function parseCommandCodeCatalog(data) {
  let rawModels = [];
  if (Array.isArray(data?.data)) {
    rawModels = data.data;
  } else if (Array.isArray(data?.models)) {
    rawModels = data.models;
  } else if (data?.data && typeof data.data === "object") {
    // models-dev.json structure: { data: { "model-oracle-ai": { models: { ... } } } }
    for (const providerGroup of Object.values(data.data)) {
      if (providerGroup?.models && typeof providerGroup.models === "object") {
        for (const [mId, mObj] of Object.entries(providerGroup.models)) {
          rawModels.push({ id: mId, ...mObj });
        }
      }
    }
  }

  if (!rawModels || rawModels.length === 0) {
    return { models: [...BUILTIN_COMMANDCODE_MODELS] };
  }

  const models = [];
  const seen = new Set();

  for (const item of rawModels) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    if (item?.hidden === true || item?.deprecated === true || item?.disabled === true || KNOWN_RETIRED_COMMANDCODE_MODELS.has(id)) {
      continue;
    }
    seen.add(id);

    const isFree = Boolean(
      (item?.display?.badge === "free" || (item?.pricing && item.pricing.inputCost === 0 && item.pricing.outputCost === 0) || id.endsWith(":free"))
      && !(item?.pricing && (item.pricing.inputCost > 0 || item.pricing.outputCost > 0))
    );

    const baseName = stringValue(item?.display?.label)
      || stringValue(item?.name)
      || stringValue(item?.display?.name)
      || id;
    const name = baseName.toLowerCase().includes("command code")
      ? baseName
      : `${baseName} (Command Code)`;

    const contextWindow = Number.isInteger(item?.context_length)
      ? item.context_length
      : resolveContextWindowFromModel(item, 131072);

    const maxTokens = Number.isInteger(item?.maxOutputTokens)
      ? Math.min(item.maxOutputTokens, 32768)
      : resolveMaxTokensFromModel(item, 16384);

    let reasoning = null;
    if (Array.isArray(item?.reasoningEfforts) && item.reasoningEfforts.length > 0) {
      const efforts = item.reasoningEfforts
        .filter((e) => e && e !== "off" && e !== "none")
        .map((e) => ({ id: e, name: capitalize(e), default: e === "high" }));
      if (efforts.length > 0) {
        reasoning = {
          efforts,
          defaultEffort: efforts.find((e) => e.default)?.id || efforts[0].id,
        };
      }
    } else {
      reasoning = resolveReasoningFromModel(item);
    }

    const inputModalities = Array.isArray(item?.inputModalities)
      ? item.inputModalities
      : (Array.isArray(item?.modalities?.input) ? item.modalities.input : ["text"]);

    models.push({
      id,
      name,
      contextWindow,
      maxTokens,
      inputModalities,
      free: isFree,
      ...(item?.display?.description ? { description: item.display.description } : {}),
      ...(reasoning ? { reasoning } : {}),
    });
  }

  // Ensure builtin models are included if missing
  for (const builtin of BUILTIN_COMMANDCODE_MODELS) {
    if (!seen.has(builtin.id)) {
      models.unshift(builtin);
      seen.add(builtin.id);
    }
  }

  return { models };
}

export function createCommandCodeCatalogLoader({
  modelsUrl = DEFAULT_COMMANDCODE_MODELS_ENDPOINT,
  cacheTtlMs = 60_000,
  fetchImpl = fetch,
} = {}) {
  let cached = null;
  let cachedAt = 0;

  return async function commandCodeCatalogLoader({ force = false, credential = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }

    const auth = credential || extractCommandCodeAuth();
    if (auth?.apiKey && typeof fetchImpl === "function") {
      try {
        const res = await fetchImpl(modelsUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${auth.apiKey}`,
            "User-Agent": "command-code/1.88.1",
            "x-command-code-version": "1.88.1",
            "x-cli-environment": "production",
          },
        });
        if (res.ok) {
          const json = await res.json();
          cached = parseCommandCodeCatalog(json);
          cachedAt = Date.now();
          return cached;
        }
      } catch {}
    }

    const localCatalog = findLocalCommandCodeCatalogFile();
    if (localCatalog) {
      try {
        const raw = readFileSync(localCatalog, "utf8");
        const json = JSON.parse(raw);
        cached = parseCommandCodeCatalog(json);
        cachedAt = Date.now();
        return cached;
      } catch {}
    }

    cached = { models: [...BUILTIN_COMMANDCODE_MODELS] };
    cachedAt = Date.now();
    return cached;
  };
}

export function formatCommandCodePlan(planId) {
  if (!planId) return "Command Code Subscription";
  if (planId.includes("go")) return "Command Code Go Plan";
  if (planId.includes("goat")) return "Command Code GOAT Plan";
  if (planId.includes("pro")) return "Command Code Pro Plan";
  if (planId.includes("max")) return "Command Code Max Plan";
  return `Command Code (${planId})`;
}

export class CommandCodeDriver {
  constructor({
    endpoint = DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 180_000,
  } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createCommandCodeCatalogLoader({ fetchImpl });
    this.requestExecutor = requestExecutor ?? createCommandCodeNativeExecutor({
      endpoint,
      fetchImpl,
      timeoutMs,
    });
  }

  async discover() {
    const auth = extractCommandCodeAuth();
    if (!auth || !auth.apiKey) {
      return {
        candidates: [],
        source: "commandcode_auth",
        diagnostics: ["未在 ~/.commandcode/auth.json 检测到登录态，可在面板中配置 API Key。"],
      };
    }

    let whoamiData = null;
    let creditsData = null;
    let subData = null;

    try {
      const headers = {
        Authorization: `Bearer ${auth.apiKey}`,
        "User-Agent": "command-code/1.88.1",
        "x-command-code-version": "1.88.1",
        "x-cli-environment": "production",
      };

      const [whoamiRes, creditsRes, subRes] = await Promise.all([
        this.fetchImpl(DEFAULT_COMMANDCODE_WHOAMI_ENDPOINT, { headers }).catch(() => null),
        this.fetchImpl(DEFAULT_COMMANDCODE_CREDITS_ENDPOINT, { headers }).catch(() => null),
        this.fetchImpl(DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT, { headers }).catch(() => null),
      ]);

      if (whoamiRes?.ok) whoamiData = await whoamiRes.json().catch(() => null);
      if (creditsRes?.ok) creditsData = await creditsRes.json().catch(() => null);
      if (subRes?.ok) subData = await subRes.json().catch(() => null);
    } catch {}

    const userId = whoamiData?.user?.id || auth.userId || "commandcode-user";
    const userName = whoamiData?.user?.name || whoamiData?.user?.userName || auth.userName || "Command Code User";
    const email = whoamiData?.user?.email || "user@commandcode.ai";
    const displayName = `${userName} (${email})`;

    const planId = subData?.data?.planId;
    const planName = formatCommandCodePlan(planId);
    const subStatus = subData?.data?.status || "active";
    const currentPeriodEnd = subData?.data?.currentPeriodEnd || null;

    const remainingCredits = typeof creditsData?.credits?.monthlyCredits === "number"
      ? creditsData.credits.monthlyCredits
      : 10;

    const windows = [];
    if (creditsData?.windowLimits?.fiveHour) {
      const fh = creditsData.windowLimits.fiveHour;
      windows.push({
        id: "commandcode:5h",
        name: "5 小时窗口额度",
        remaining: Math.max(0, (fh.cap ?? 3) - (fh.used ?? 0)),
        limit: fh.cap ?? 3,
        unit: "credits",
        resetAt: fh.resetAt ? new Date(fh.resetAt).toISOString() : null,
      });
    }
    if (creditsData?.windowLimits?.weekly) {
      const wk = creditsData.windowLimits.weekly;
      windows.push({
        id: "commandcode:weekly",
        name: "周度额度",
        remaining: Math.max(0, (wk.cap ?? 6) - (wk.used ?? 0)),
        limit: wk.cap ?? 6,
        unit: "credits",
        resetAt: wk.resetAt ? new Date(wk.resetAt).toISOString() : null,
      });
    }

    return {
      candidates: [
        {
          candidateId: userId,
          accountId: userId,
          displayName,
          email,
          subscription: {
            plan: planName,
            status: subStatus,
            expiresAt: currentPeriodEnd,
          },
          quota: {
            remaining: remainingCredits,
            limit: 10,
            unit: "credits",
            resetAt: currentPeriodEnd,
            updatedAt: new Date().toISOString(),
            windows,
          },
          source: "commandcode_auth",
          health: {
            status: "healthy",
          },
        },
      ],
      source: "commandcode_auth",
      diagnostics: [],
    };
  }

  async importAccount(candidate, context = {}) {
    const auth = extractCommandCodeAuth();
    const accountId = candidate?.accountId || auth?.userId || "commandcode-default";
    const ref = createCredentialRef(PROVIDER_ID, accountId);

    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "commandcode_auth",
        apiKey: auth?.apiKey || candidate?.apiKey || "",
        userId: accountId,
        userName: candidate?.displayName || auth?.userName || null,
        email: candidate?.email || null,
      }).catch(() => {});
    }

    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID,
      displayName: candidate?.displayName || "Command Code User",
      email: candidate?.email || "user@commandcode.ai",
      auth: {
        kind: "commandcode_auth",
        credentialRef: ref,
      },
      subscription: {
        plan: candidate?.subscription?.plan || "Command Code Subscription",
        status: candidate?.subscription?.status || "active",
        expiresAt: candidate?.subscription?.expiresAt || null,
      },
      quota: createQuotaSnapshot(candidate?.quota || {
        remaining: 10,
        limit: 10,
        unit: "credits",
      }),
      health: {
        status: "healthy",
      },
    });
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
      const auth = extractCommandCodeAuth();
      apiKey = auth?.apiKey;
    }

    if (!apiKey) {
      return {
        health: { status: "auth_expired" },
      };
    }

    try {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "command-code/1.88.1",
        "x-command-code-version": "1.88.1",
        "x-cli-environment": "production",
      };

      const [creditsRes, subRes] = await Promise.all([
        this.fetchImpl(DEFAULT_COMMANDCODE_CREDITS_ENDPOINT, { headers }).catch(() => null),
        this.fetchImpl(DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT, { headers }).catch(() => null),
      ]);

      const creditsData = creditsRes?.ok ? await creditsRes.json().catch(() => null) : null;
      const subData = subRes?.ok ? await subRes.json().catch(() => null) : null;

      const remainingCredits = typeof creditsData?.credits?.monthlyCredits === "number"
        ? creditsData.credits.monthlyCredits
        : (account.quota?.remaining ?? 10);

      const windows = [];
      if (creditsData?.windowLimits?.fiveHour) {
        const fh = creditsData.windowLimits.fiveHour;
        windows.push({
          id: "commandcode:5h",
          name: "5 小时窗口额度",
          remaining: Math.max(0, (fh.cap ?? 3) - (fh.used ?? 0)),
          limit: fh.cap ?? 3,
          unit: "credits",
          resetAt: fh.resetAt ? new Date(fh.resetAt).toISOString() : null,
        });
      }
      if (creditsData?.windowLimits?.weekly) {
        const wk = creditsData.windowLimits.weekly;
        windows.push({
          id: "commandcode:weekly",
          name: "周度额度",
          remaining: Math.max(0, (wk.cap ?? 6) - (wk.used ?? 0)),
          limit: wk.cap ?? 6,
          unit: "credits",
          resetAt: wk.resetAt ? new Date(wk.resetAt).toISOString() : null,
        });
      }

      const planId = subData?.data?.planId;
      const planName = planId ? formatCommandCodePlan(planId) : account.subscription?.plan;
      const subStatus = subData?.data?.status || account.subscription?.status || "active";
      const currentPeriodEnd = subData?.data?.currentPeriodEnd || account.subscription?.expiresAt || null;

      return {
        subscription: {
          ...account.subscription,
          plan: planName,
          status: subStatus,
          expiresAt: currentPeriodEnd,
        },
        quota: createQuotaSnapshot({
          remaining: remainingCredits,
          limit: account.quota?.limit ?? 10,
          unit: "credits",
          resetAt: currentPeriodEnd,
          updatedAt: new Date().toISOString(),
          windows,
        }),
        health: {
          status: "healthy",
          lastCheckedAt: new Date().toISOString(),
        },
      };
    } catch {
      return {
        health: { status: "degraded", lastCheckedAt: new Date().toISOString() },
      };
    }
  }

  async getCatalog(context = {}) {
    let credential = null;
    if (context.secretStore && context.accounts?.[0]?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(context.accounts[0].auth.credentialRef);
      } catch {}
    }
    return this.catalogLoader({ force: Boolean(context.force), credential });
  }

  async invoke(request, invocation, context = {}) {
    let output = "";
    for await (const chunk of this.stream(request, invocation, context)) {
      if (chunk.type === "text-delta" && chunk.text) {
        output += chunk.text;
      }
    }
    return { output };
  }

  async* stream(request, invocation, context = {}) {
    let credential = null;
    if (context.secretStore && invocation?.account?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(invocation.account.auth.credentialRef);
      } catch {}
    }

    yield* this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? null,
      sessionId: context.sessionId ?? request.sessionId ?? null,
      // DSH passes the durable attachment service on the provider context; the
      // transport needs it to turn opaque image references into real bytes.
      attachments: context.attachments ?? invocation?.attachments ?? null,
    });
  }
}

export function createCommandCodeDriver(options = {}) {
  return new CommandCodeDriver(options);
}
