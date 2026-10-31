var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// packages/dsh-plugin/src/dockyard-remote-host.mjs
var dockyard_remote_host_exports = {};
__export(dockyard_remote_host_exports, {
  DockyardRemoteService: () => DockyardRemoteService,
  publicAuthResult: () => publicAuthResult
});
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
function publicAuthResult(result) {
  if (!result || typeof result !== "object") return result;
  return {
    status: result.status,
    ...result.providerId ? { providerId: result.providerId } : {},
    ...result.sessionId ? { sessionId: result.sessionId } : {},
    ...result.authorizationUrl ? { authorizationUrl: result.authorizationUrl } : {},
    ...result.instructions ? { instructions: result.instructions } : {},
    ...result.browserOpened ? { browserOpened: true } : {},
    ...result.inputRequired ? { inputRequired: true } : {},
    ...result.authorizationCodeRequired ? { authorizationCodeRequired: true } : {},
    ...result.diagnostic ? { diagnostic: result.diagnostic } : {},
    ...Array.isArray(result.accounts) ? { accounts: result.accounts } : {}
  };
}
function envelope(result, snapshot) {
  return { result, snapshot };
}
function markRemoteMethods() {
  const target = Object.create(DockyardRemoteService.prototype);
  for (const name2 of [
    "snapshot",
    "refresh",
    "scan",
    "add",
    "login",
    "poll",
    "submitAuthorizationCode",
    "cancel",
    "setPolicy",
    "use",
    "removeAccount",
    "nativeKeyStatus",
    "nativeKeyRefresh",
    "nativeKeyRegister",
    "nativeKeyUnregister",
    "nativeKeySetPolicy",
    "getContextWindowOverride",
    "setContextWindowOverride",
    "getModelSelection",
    "setModelSelection"
  ]) {
    let initializer;
    Remote(name2)(void 0, {
      kind: "method",
      name: name2,
      static: false,
      private: false,
      addInitializer(callback) {
        initializer = callback;
      }
    });
    initializer?.call(target);
  }
}
var DockyardRemoteService;
var init_dockyard_remote_host = __esm({
  "packages/dsh-plugin/src/dockyard-remote-host.mjs"() {
    DockyardRemoteService = class extends TypertRemoteService {
      static inject = [];
      constructor(ctx, config = {}) {
        super(ctx, "dockyardRemote", { namespace: "dockyard" });
        if (!config.service) throw new Error("Dockyard remote service requires DockyardDshService");
        this.dockyard = config.service;
        this.nativeKeyPool = config.nativeKeyPool ?? null;
      }
      async snapshot() {
        return this.dockyard.snapshot();
      }
      async refresh(request = {}) {
        const providerId = request?.providerId ?? null;
        const result = await this.dockyard.refresh(providerId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async scan(request = {}) {
        const result = await this.dockyard.scan(request?.providerId ?? null);
        return envelope(result, await this.dockyard.snapshot());
      }
      async add(request = {}) {
        const result = await this.dockyard.add(request?.providerId ?? null, request?.candidateId ?? null);
        return envelope(result, await this.dockyard.snapshot());
      }
      async login(request) {
        const result = publicAuthResult(await this.dockyard.startAuthorization(request.providerId, { openBrowser: false }));
        return envelope(result, await this.dockyard.snapshot());
      }
      async poll(request) {
        const result = publicAuthResult(await this.dockyard.pollAuthorization(request.providerId, request.sessionId));
        return envelope(result, await this.dockyard.snapshot());
      }
      async submitAuthorizationCode(request) {
        const result = publicAuthResult(await this.dockyard.submitAuthorizationCode(
          request.providerId,
          request.sessionId,
          request.code
        ));
        return envelope(result, await this.dockyard.snapshot());
      }
      async cancel(request) {
        const result = publicAuthResult(await this.dockyard.cancelAuthorization(request.providerId, request.sessionId));
        return envelope(result, await this.dockyard.snapshot());
      }
      async setPolicy(request) {
        const result = await this.dockyard.setPolicy(request.providerId, request.policy, request.defaultAccountId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async use(request) {
        const result = await this.dockyard.setDefaultAccount(request.providerId, request.accountId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async removeAccount(request) {
        const result = await this.dockyard.removeAccount(request.providerId, request.accountId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async nativeKeyStatus(request = {}) {
        if (!this.nativeKeyPool) return { providerId: request.providerId, runtimeMode: "native-single-key", keys: [] };
        return this.nativeKeyPool.status(request.providerId);
      }
      async nativeKeyRefresh(request = {}) {
        if (!this.nativeKeyPool) return { providerId: request.providerId, runtimeMode: "native-single-key", keys: [] };
        return this.nativeKeyPool.refreshUsage(request.providerId);
      }
      async nativeKeyRegister(request = {}) {
        if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool \u5C1A\u672A\u6302\u8F7D");
        return this.nativeKeyPool.register(request.providerId, request.ref, request.label);
      }
      async nativeKeyUnregister(request = {}) {
        if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool \u5C1A\u672A\u6302\u8F7D");
        return this.nativeKeyPool.unregister(request.providerId, request.ref);
      }
      async nativeKeySetPolicy(request = {}) {
        if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool \u5C1A\u672A\u6302\u8F7D");
        return this.nativeKeyPool.setPolicy(request.providerId, request.policy);
      }
      async getContextWindowOverride(request = {}) {
        return this.dockyard.getContextWindowOverride(request);
      }
      async setContextWindowOverride(request = {}) {
        return this.dockyard.setContextWindowOverride(request, request.value);
      }
      async getModelSelection(request = {}) {
        return this.dockyard.getModelSelection(request.providerId);
      }
      async setModelSelection(request = {}) {
        return this.dockyard.setModelSelection(request.providerId, request.enabledModelIds);
      }
    };
    markRemoteMethods();
  }
});

// packages/dsh-plugin/src/index.mjs
import { existsSync as existsSync5, readFileSync as readFileSync4 } from "node:fs";
import { join as join15 } from "node:path";

// packages/core/src/errors.mjs
var DockyardError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DockyardError";
    this.code = code;
    this.details = details;
  }
};
var ValidationError = class extends DockyardError {
  constructor(message, details = {}) {
    super("validation_error", message, details);
    this.name = "ValidationError";
  }
};
var ModuleConflictError = class extends DockyardError {
  constructor(moduleId) {
    super("module_conflict", `Module is already registered: ${moduleId}`, { moduleId });
    this.name = "ModuleConflictError";
  }
};
var ModuleNotFoundError = class extends DockyardError {
  constructor(moduleId) {
    super("module_not_found", `Module is not registered: ${moduleId}`, { moduleId });
    this.name = "ModuleNotFoundError";
  }
};
var AccountSelectionError = class extends DockyardError {
  constructor(message, details = {}) {
    super("account_selection_error", message, details);
    this.name = "AccountSelectionError";
  }
};
var ProviderCapabilityError = class extends DockyardError {
  constructor(providerId, capability) {
    super(
      "provider_capability_unavailable",
      `Provider module ${providerId} does not have an active ${capability} driver`,
      { providerId, capability }
    );
    this.name = "ProviderCapabilityError";
  }
};

// packages/core/src/contracts.mjs
var ACCOUNT_HEALTH = Object.freeze({
  UNKNOWN: "unknown",
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  COOLDOWN: "cooldown",
  EXPIRED: "expired",
  EXHAUSTED: "exhausted"
});
var ACCOUNT_SELECTION_POLICY = Object.freeze({
  MANUAL: "manual",
  STICKY_SESSION: "sticky_session",
  ROUND_ROBIN: "round_robin",
  FAILOVER: "failover"
});
var PROVIDER_CAPABILITIES = Object.freeze([
  "oauth_discovery",
  "oauth_import",
  "oauth_authorization",
  "oauth_refresh",
  "quota",
  "catalog",
  "invoke",
  "stream"
]);
function isoOrNull(value, fieldName) {
  if (value === void 0 || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ISO timestamp for ${fieldName}`, { fieldName, value });
  }
  return date.toISOString();
}
function numberOrNull(value, fieldName) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`Expected a finite number for ${fieldName}`, { fieldName, value });
  }
  return value;
}
function stringOrNull(value) {
  return value === void 0 || value === null || value === "" ? null : String(value);
}
function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? structuredClone(value) : {};
}
function createQuotaWindow(input = {}, now = /* @__PURE__ */ new Date()) {
  return {
    id: stringOrNull(input.id),
    name: stringOrNull(input.name),
    remaining: numberOrNull(input.remaining, "quota.windows.remaining"),
    limit: numberOrNull(input.limit, "quota.windows.limit"),
    unit: stringOrNull(input.unit),
    resetAt: isoOrNull(input.resetAt, "quota.windows.resetAt"),
    updatedAt: isoOrNull(input.updatedAt, "quota.windows.updatedAt") ?? now.toISOString(),
    source: stringOrNull(input.source) ?? "unknown"
  };
}
function createQuotaSnapshot(input = {}, now = /* @__PURE__ */ new Date()) {
  return {
    remaining: numberOrNull(input.remaining, "quota.remaining"),
    limit: numberOrNull(input.limit, "quota.limit"),
    unit: stringOrNull(input.unit),
    resetAt: isoOrNull(input.resetAt, "quota.resetAt"),
    updatedAt: isoOrNull(input.updatedAt, "quota.updatedAt") ?? now.toISOString(),
    source: stringOrNull(input.source) ?? "unknown",
    windows: Array.isArray(input.windows) ? input.windows.map((window) => createQuotaWindow(window, now)) : []
  };
}
function createRefreshState(input = {}) {
  return {
    accessTokenExpiresAt: isoOrNull(input.accessTokenExpiresAt, "refresh.accessTokenExpiresAt"),
    nextRefreshAt: isoOrNull(input.nextRefreshAt, "refresh.nextRefreshAt"),
    lastRefreshedAt: isoOrNull(input.lastRefreshedAt, "refresh.lastRefreshedAt"),
    refreshable: input.refreshable === void 0 ? null : Boolean(input.refreshable)
  };
}
function createAccountRecord(input, now = /* @__PURE__ */ new Date()) {
  if (!input || typeof input !== "object") throw new ValidationError("Account input is required");
  if (!input.providerId) throw new ValidationError("Account providerId is required");
  if (!input.accountId) throw new ValidationError("Account accountId is required");
  const credentialRef = input.credentialRef ?? input.auth?.credentialRef;
  if (!credentialRef) throw new ValidationError("Account credentialRef is required");
  const health = input.health ?? {};
  const createdAt = isoOrNull(input.createdAt, "createdAt") ?? now.toISOString();
  const updatedAt2 = isoOrNull(input.updatedAt, "updatedAt") ?? now.toISOString();
  return {
    providerId: String(input.providerId),
    accountId: String(input.accountId),
    displayName: stringOrNull(input.displayName),
    email: stringOrNull(input.email),
    auth: {
      kind: stringOrNull(input.auth?.kind) ?? "oauth",
      credentialRef: String(credentialRef),
      scopes: Array.isArray(input.auth?.scopes) ? [...input.auth.scopes] : []
    },
    subscription: {
      plan: stringOrNull(input.subscription?.plan),
      status: stringOrNull(input.subscription?.status),
      expiresAt: isoOrNull(input.subscription?.expiresAt, "subscription.expiresAt")
    },
    quota: createQuotaSnapshot(input.quota ?? {}, now),
    refresh: createRefreshState(input.refresh ?? {}),
    resources: objectOrEmpty(input.resources),
    health: {
      status: health.status ?? ACCOUNT_HEALTH.UNKNOWN,
      lastCheckedAt: isoOrNull(health.lastCheckedAt, "health.lastCheckedAt"),
      cooldownUntil: isoOrNull(health.cooldownUntil, "health.cooldownUntil"),
      lastError: stringOrNull(health.lastError)
    },
    lastUsedAt: isoOrNull(input.lastUsedAt, "lastUsedAt"),
    createdAt,
    updatedAt: updatedAt2
  };
}
function accountSummary(account) {
  return {
    providerId: account.providerId,
    accountId: account.accountId,
    displayName: account.displayName,
    email: account.email,
    subscription: { ...account.subscription },
    quota: structuredClone(account.quota ?? {}),
    refresh: { ...account.refresh },
    resources: structuredClone(account.resources ?? {}),
    health: { ...account.health },
    lastUsedAt: account.lastUsedAt
  };
}
function accountStorageRecord(account) {
  return {
    ...accountSummary(account),
    auth: {
      kind: account.auth.kind,
      credentialRef: account.auth.credentialRef,
      scopes: [...account.auth.scopes]
    },
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

// packages/core/src/events.mjs
var EventBus = class {
  #handlers = /* @__PURE__ */ new Map();
  on(type, handler) {
    if (typeof type !== "string" || type.length === 0) {
      throw new TypeError("EventBus.on requires a non-empty event type");
    }
    if (typeof handler !== "function") {
      throw new TypeError("EventBus.on requires a handler function");
    }
    if (!this.#handlers.has(type)) this.#handlers.set(type, /* @__PURE__ */ new Set());
    this.#handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) {
    const handlers = this.#handlers.get(type);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) this.#handlers.delete(type);
  }
  async emit(type, payload) {
    const handlers = [...this.#handlers.get(type) ?? []];
    const errors = [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        errors.push(error);
      }
    }
    return { handled: handlers.length, errors };
  }
  clear() {
    this.#handlers.clear();
  }
};

// packages/core/src/module-runtime.mjs
var ModuleRuntime = class {
  #modules = /* @__PURE__ */ new Map();
  #services = /* @__PURE__ */ new Map();
  // Per-module lifecycle serialization. activate()/deactivate() are awaited,
  // so without ordering an unregister could remove a module mid-register and
  // let the still-running register mark it active again afterwards.
  #lifecycleQueues = /* @__PURE__ */ new Map();
  constructor({ events = new EventBus(), logger = console } = {}) {
    this.events = events;
    this.logger = logger;
  }
  #enqueueLifecycle(moduleId, task) {
    const previous = this.#lifecycleQueues.get(moduleId) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.#lifecycleQueues.set(moduleId, run.then(() => {
    }, () => {
    }));
    return run;
  }
  register(module) {
    const manifest = module?.manifest;
    if (!manifest?.id || !manifest.kind) {
      throw new ValidationError("A module manifest must contain id and kind");
    }
    return this.#enqueueLifecycle(manifest.id, async () => {
      if (this.#modules.has(manifest.id)) throw new ModuleConflictError(manifest.id);
      const record = { module, manifest: { ...manifest }, services: /* @__PURE__ */ new Set(), active: false };
      this.#modules.set(manifest.id, record);
      const context = this.#contextFor(record);
      try {
        if (typeof module.activate === "function") await module.activate(context);
        record.active = true;
        await this.events.emit("module/registered", { moduleId: manifest.id, manifest: { ...manifest } });
        return module;
      } catch (error) {
        this.#removeServices(record);
        this.#modules.delete(manifest.id);
        throw error;
      }
    });
  }
  unregister(moduleId) {
    return this.#enqueueLifecycle(moduleId, async () => {
      const record = this.#modules.get(moduleId);
      if (!record) throw new ModuleNotFoundError(moduleId);
      if (typeof record.module.deactivate === "function") {
        await record.module.deactivate(this.#contextFor(record));
      }
      this.#removeServices(record);
      this.#modules.delete(moduleId);
      await this.events.emit("module/unregistered", { moduleId });
    });
  }
  has(moduleId) {
    return this.#modules.has(moduleId);
  }
  get(moduleId) {
    const record = this.#modules.get(moduleId);
    if (!record) throw new ModuleNotFoundError(moduleId);
    return record.module;
  }
  list() {
    return [...this.#modules.values()].map(({ manifest, active }) => ({ ...manifest, active }));
  }
  registerService(name2, value, ownerId) {
    if (this.#services.has(name2)) {
      throw new ValidationError(`Service is already registered: ${name2}`, { name: name2 });
    }
    this.#services.set(name2, { value, ownerId });
    const record = this.#modules.get(ownerId);
    if (record) record.services.add(name2);
  }
  getService(name2) {
    const service = this.#services.get(name2);
    if (!service) throw new ValidationError(`Service is not registered: ${name2}`, { name: name2 });
    return service.value;
  }
  hasService(name2) {
    return this.#services.has(name2);
  }
  #contextFor(record) {
    return {
      moduleId: record.manifest.id,
      events: this.events,
      logger: this.logger,
      registerService: (name2, value) => this.registerService(name2, value, record.manifest.id),
      getService: (name2) => this.getService(name2),
      emit: (type, payload = {}) => this.events.emit(type, { ...payload, moduleId: record.manifest.id })
    };
  }
  #removeServices(record) {
    for (const name2 of record.services) this.#services.delete(name2);
    record.services.clear();
  }
};

// packages/core/src/provider-module.mjs
function missingDriver(providerId, capability) {
  return async () => {
    throw new ProviderCapabilityError(providerId, capability);
  };
}
function defineProviderModule({
  id,
  displayName,
  capabilities = [],
  driver = {}
}) {
  if (!id) throw new ValidationError("Provider module id is required");
  const module = {
    manifest: {
      id,
      kind: "provider",
      displayName: displayName ?? id,
      capabilities: [...capabilities],
      dataSource: "live_oauth"
    },
    async activate(context) {
      context.registerService(`provider:${id}`, module);
      await context.emit("provider/registered", { providerId: id });
    },
    async deactivate(context) {
      await context.emit("provider/unregistered", { providerId: id });
    },
    async discover(context) {
      return driver.discover ? driver.discover(context) : missingDriver(id, "oauth_discovery")(context);
    },
    async importAccount(candidate2, context) {
      return driver.importAccount ? driver.importAccount(candidate2, context) : missingDriver(id, "oauth_import")(candidate2, context);
    },
    async importSource(source, context) {
      return driver.importSource ? driver.importSource(source, context) : missingDriver(id, "oauth_source_import")(source, context);
    },
    // A provider may expose an already authenticated official CLI, desktop
    // client, browser, or OAuth-file session. Returning null keeps the normal
    // provider-owned authorization flow unchanged.
    async getActiveSession(context) {
      return typeof driver.getActiveSession === "function" ? driver.getActiveSession(context) : null;
    },
    async startAuthorization(context) {
      return driver.startAuthorization ? driver.startAuthorization(context) : missingDriver(id, "oauth_authorization")(context);
    },
    async pollAuthorization(sessionId, context) {
      return driver.pollAuthorization ? driver.pollAuthorization(sessionId, context) : missingDriver(id, "oauth_authorization")(sessionId, context);
    },
    async cancelAuthorization(sessionId, context) {
      return driver.cancelAuthorization ? driver.cancelAuthorization(sessionId, context) : missingDriver(id, "oauth_authorization")(sessionId, context);
    },
    async submitAuthorizationCode(sessionId, code, context) {
      return driver.submitAuthorizationCode ? driver.submitAuthorizationCode(sessionId, code, context) : missingDriver(id, "oauth_authorization")(sessionId, code, context);
    },
    async refreshAccount(account, context) {
      return driver.refreshAccount ? driver.refreshAccount(account, context) : missingDriver(id, "oauth_refresh")(account, context);
    },
    async getQuota(account, context) {
      return driver.getQuota ? driver.getQuota(account, context) : missingDriver(id, "quota")(account, context);
    },
    async getCatalog(context) {
      return driver.getCatalog ? driver.getCatalog(context) : missingDriver(id, "catalog")(context);
    },
    async invoke(request, invocation, context) {
      return driver.invoke ? driver.invoke(request, invocation, context) : missingDriver(id, "invoke")(request, invocation, context);
    },
    async stream(request, invocation, context) {
      if (driver.stream) return driver.stream(request, invocation, context);
      if (driver.invoke) return driver.invoke(request, invocation, context);
      return missingDriver(id, "stream")(request, invocation, context);
    }
  };
  return Object.freeze(module);
}

// packages/providers/src/provider-utils.mjs
import { readFile } from "node:fs/promises";
async function readJsonFile(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function decodeJwtPayload(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
function isoFromEpoch(value) {
  if (value === void 0 || value === null || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric < 1e10 ? numeric * 1e3 : numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function addSecondsIso(seconds, now = /* @__PURE__ */ new Date()) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return null;
  return new Date(now.getTime() + numeric * 1e3).toISOString();
}
function finiteNumber(value) {
  if (value === void 0 || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
function stringValue(value) {
  return value === void 0 || value === null || value === "" ? null : String(value);
}
var EXTENDED_THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"];
function resolveReasoningFromModel(model) {
  if (!model) return void 0;
  if (model.reasoning === false) return void 0;
  if (Array.isArray(model.reasoning?.efforts) && model.reasoning.efforts.length > 0) {
    return model.reasoning;
  }
  if (model.thinkingLevelMap && typeof model.thinkingLevelMap === "object") {
    const supported = EXTENDED_THINKING_LEVELS.filter((level) => {
      const mapped = model.thinkingLevelMap[level];
      if (mapped === null) return false;
      if (level === "xhigh" || level === "max") return mapped !== void 0 && mapped !== null;
      return true;
    });
    if (supported.length === 0) return void 0;
    const efforts = supported.map((id) => ({
      id,
      name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    }));
    const defaultEffort = supported.includes("medium") ? "medium" : supported.includes("high") ? "high" : supported[0];
    return { efforts, defaultEffort };
  }
  if (model.reasoning === true) {
    const supported = ["minimal", "low", "medium", "high"];
    return {
      efforts: supported.map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) })),
      defaultEffort: "medium"
    };
  }
  return void 0;
}
async function fetchJson(url, init = {}, { timeoutMs = 2e4, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) controller.abort(externalSignal.reason);
  else externalSignal?.addEventListener?.("abort", abortFromCaller, { once: true });
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text3 = await response.text();
    let body = null;
    try {
      body = text3 ? JSON.parse(text3) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const error = new Error(`Provider request failed (${response.status})`);
      error.status = response.status;
      error.bodyKeys = body && typeof body === "object" ? Object.keys(body) : [];
      const upstreamError = body?.error;
      const upstreamCode = typeof upstreamError === "string" ? upstreamError : upstreamError && typeof upstreamError === "object" ? upstreamError.code ?? upstreamError.type : body?.error_code ?? body?.code;
      if (typeof upstreamCode === "string" && upstreamCode.length > 0) error.upstreamCode = upstreamCode;
      throw error;
    }
    return { body, response };
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", abortFromCaller);
  }
}
function redactError(error) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const detail = error?.detail ? ` ${String(error.detail)}` : "";
  const code = error?.code !== void 0 && error?.code !== null ? ` [code ${String(error.code)}]` : "";
  return `${message}${detail}${code}`.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]").replace(/(access|refresh|id)[_-]?token["'=:\s]+[^,\s}]+/gi, "$1_token=[redacted]").replace(/\b(?:sk|sk-ant|sk-proj|sk-svcacct|xai|agy|gsk|ghp|gho|ghu|github_pat|deepseek|pplx|nvapi|zai|glm)[-_][A-Za-z0-9_-]{12,}\b/gi, "[redacted]").replace(/(api[_-]?key|client[_-]?secret|session[_-]?token|private[_-]?key)["'=:\s]+[^,\s}"']+/gi, "$1=[redacted]").slice(0, 300);
}
function recursiveQuotaWindows(value, { source, now = /* @__PURE__ */ new Date(), prefix = "quota" } = {}) {
  const windows = [];
  function visit(node, path, label) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const usedPercent = finiteNumber(node.used_percent ?? node.usedPercent);
    const remainingFraction = finiteNumber(node.remaining_fraction ?? node.remainingFraction);
    const remainingValue = finiteNumber(node.remaining);
    const limitValue = finiteNumber(node.limit);
    const resetAt = isoFromEpoch(node.reset_at ?? node.resetAt) ?? addSecondsIso(node.reset_after_seconds ?? node.resetAfterSeconds, now);
    const hasQuotaShape = usedPercent !== null || remainingFraction !== null || remainingValue !== null || limitValue !== null;
    if (hasQuotaShape) {
      let remaining = remainingValue;
      let limit = limitValue;
      let unit = stringValue(node.unit);
      if (remaining === null && remainingFraction !== null) {
        remaining = remainingFraction;
        limit = limit ?? 1;
        unit = unit ?? "fraction";
      } else if (remaining === null && usedPercent !== null) {
        remaining = Math.max(0, 100 - usedPercent);
        limit = limit ?? 100;
        unit = unit ?? "percent";
      }
      windows.push({
        id: path || prefix,
        name: label || path || prefix,
        remaining,
        limit,
        unit,
        resetAt,
        source
      });
    }
    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        visit(child, path ? `${path}.${key}` : key, key);
      }
    }
  }
  visit(value, "", prefix);
  const unique = /* @__PURE__ */ new Map();
  for (const window of windows) unique.set(window.id, window);
  return [...unique.values()];
}
function selectPrimaryQuotaWindow(windows) {
  if (!windows?.length) return {};
  const preferred = windows.find((window) => /primary|weekly|five.?hour|5h/i.test(`${window.id} ${window.name}`));
  return preferred ?? windows[0];
}
var LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isLoopbackHostname(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return LOOPBACK_HOSTNAMES.has(bare);
}
function assertSecureEndpointUrl(value, label = "endpoint") {
  const raw = String(value ?? "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http(s), got: ${url.protocol}`);
  }
  if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
    throw new Error(`${label} over plain http must target a loopback host, got: ${url.hostname}`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not embed credentials in the URL`);
  }
  if (url.hash) {
    url.hash = "";
  }
  return url.toString();
}

// packages/core/src/dsh-route.mjs
function selectionContext(context, excludedIds) {
  if (excludedIds.size === 0) return context;
  return { ...context, excludeAccountIds: [...excludedIds] };
}
function shouldFailover(error, accountPool, context) {
  return accountPool.policy === ACCOUNT_SELECTION_POLICY.FAILOVER && !context.accountId && (error?.rateLimited || error?.quotaExhausted || error?.authExpired || error?.emptyOutput);
}
function quotaResetAt(account) {
  const candidates = [
    account?.quota?.resetAt,
    ...Array.isArray(account?.quota?.windows) ? account.quota.windows.map((window) => window?.resetAt) : []
  ].filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()) && value.getTime() > Date.now()).sort((left, right) => left.getTime() - right.getTime());
  return candidates[0]?.toISOString() ?? null;
}
function failureStatus(error) {
  if (error?.authExpired) return "auth_expired";
  if (error?.quotaExhausted) return "quota_exhausted";
  if (error?.rateLimited) return "rate_limited";
  return "error";
}
function failureCooldown(error, account) {
  return error?.cooldownUntil ?? quotaResetAt(account);
}
function reportAccount(accountPool, accountId, result, { opToken } = {}) {
  try {
    const safeResult = result?.message ? { ...result, message: redactError(result.message) } : result;
    accountPool.report(accountId, safeResult, { opToken });
  } catch {
  }
}
function errorFromTerminalChunk(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error" ? chunk.reason.failure : null;
  if (!failure) return null;
  const error = new Error(String(failure.message ?? "Provider stream failed"));
  if (failure.code !== void 0) error.code = failure.code;
  if (failure.status !== void 0) error.status = failure.status;
  if (failure.upstreamCode !== void 0) error.upstreamCode = failure.upstreamCode;
  if (failure.authExpired) error.authExpired = true;
  if (failure.authForbidden) error.authForbidden = true;
  if (failure.rateLimited) error.rateLimited = true;
  if (failure.quotaExhausted) error.quotaExhausted = true;
  return error;
}
function hasSubstantiveStreamOutput(chunk) {
  if (!chunk || typeof chunk !== "object") return true;
  if (chunk.type === "block-start") return false;
  if (chunk.type === "block-end") {
    return Boolean(chunk.block?.text || chunk.block?.id || chunk.block?.arguments);
  }
  return !["usage", "finish"].includes(chunk.type);
}
function providerAccount(account, auth) {
  return {
    ...account,
    auth: {
      kind: auth.authKind,
      credentialRef: auth.credentialRef,
      scopes: [...auth.scopes]
    }
  };
}
function requestWithContextWindow(request, providerId, modelId, accountId, contextWindowOverrides) {
  if (!modelId || !contextWindowOverrides || typeof contextWindowOverrides.resolve !== "function") return request;
  const contextWindow = contextWindowOverrides.resolve(providerId, modelId, { accountId });
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) return request;
  return {
    ...request,
    modelContext: {
      ...request?.modelContext ?? {},
      contextWindow
    }
  };
}
function createProviderRoute({ providerModule, accountPool, contextWindowOverrides = null }) {
  if (!providerModule?.manifest?.id) throw new ValidationError("Provider module is required");
  if (!accountPool?.select || !accountPool?.resolve) throw new ValidationError("Account pool is required");
  if (accountPool.providerId !== providerModule.manifest.id) {
    throw new ValidationError("Provider module and account pool do not match", {
      providerId: providerModule.manifest.id,
      poolProviderId: accountPool.providerId
    });
  }
  return {
    providerId: providerModule.manifest.id,
    async invoke(request, context = {}) {
      const excludedIds = new Set(context.excludeAccountIds ?? []);
      let lastError = null;
      while (true) {
        let account;
        try {
          account = accountPool.select(selectionContext(context, excludedIds));
        } catch (selectionError) {
          throw lastError ?? selectionError;
        }
        excludedIds.add(account.accountId);
        const auth = accountPool.resolve(account.accountId);
        const selectedAccount = providerAccount(account, auth);
        const selectedRequest = requestWithContextWindow(
          request,
          providerModule.manifest.id,
          request?.model,
          account.accountId,
          contextWindowOverrides
        );
        try {
          const response = await providerModule.invoke(
            selectedRequest,
            { account: selectedAccount, auth },
            context
          );
          reportAccount(accountPool, account.accountId, {
            status: "success",
            quota: response?.quota,
            refresh: response?.refresh
          }, { opToken: account.opToken });
          return response;
        } catch (error) {
          reportAccount(accountPool, account.accountId, {
            status: failureStatus(error),
            cooldownUntil: failureCooldown(error, selectedAccount),
            message: error?.message
          }, { opToken: account.opToken });
          if (!shouldFailover(error, accountPool, context)) throw error;
          lastError = error;
        }
      }
    },
    stream(request, context = {}) {
      return (async function* streamWithHealth() {
        const excludedIds = new Set(context.excludeAccountIds ?? []);
        let lastError = null;
        while (true) {
          let account;
          try {
            account = accountPool.select(selectionContext(context, excludedIds));
          } catch (selectionError) {
            throw lastError ?? selectionError;
          }
          excludedIds.add(account.accountId);
          const auth = accountPool.resolve(account.accountId);
          const selectedAccount = providerAccount(account, auth);
          const selectedRequest = requestWithContextWindow(
            request,
            providerModule.manifest.id,
            request?.model,
            account.accountId,
            contextWindowOverrides
          );
          const pending = [];
          let hasOutput = false;
          try {
            const output = providerModule.stream(selectedRequest, { account: selectedAccount, auth }, context);
            for await (const chunk of await output) {
              if (!hasOutput && !hasSubstantiveStreamOutput(chunk)) {
                pending.push(chunk);
                continue;
              }
              if (!hasOutput) {
                hasOutput = true;
                for (const buffered of pending) yield buffered;
              }
              yield chunk;
            }
            if (!hasOutput) {
              const terminalError = pending.map(errorFromTerminalChunk).find(Boolean);
              const error = terminalError ?? new Error("Provider stream ended without substantive output");
              if (!terminalError) {
                error.code = "EMPTY_STREAM_OUTPUT";
                error.emptyOutput = true;
              }
              throw error;
            }
            reportAccount(accountPool, account.accountId, { status: "success" }, { opToken: account.opToken });
            return;
          } catch (error) {
            reportAccount(accountPool, account.accountId, {
              status: failureStatus(error),
              cooldownUntil: failureCooldown(error, selectedAccount),
              message: error?.message
            }, { opToken: account.opToken });
            if (!hasOutput && shouldFailover(error, accountPool, context)) {
              lastError = error;
              continue;
            }
            throw error;
          }
        }
      })();
    }
  };
}

// packages/account-pool/src/account-pool.mjs
function defaultClock() {
  return /* @__PURE__ */ new Date();
}
var STICKY_SESSION_TTL_MS = 30 * 60 * 1e3;
var MAX_STICKY_ASSIGNMENTS = 1e4;
var AccountPool = class {
  #accounts = /* @__PURE__ */ new Map();
  #sessionAssignments = /* @__PURE__ */ new Map();
  #cursor = 0;
  #defaultAccountId = null;
  // Monotonic operation sequencing: every select() hands out a token and only
  // the newest report per account may commit health/quota changes. This keeps
  // a late result from an older request (e.g. one that used pre-refresh
  // credentials) from flipping a newer auth_expired back to healthy.
  #operationSeq = 0;
  #reportedOpByAccount = /* @__PURE__ */ new Map();
  constructor({ providerId, policy = ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock = defaultClock } = {}) {
    if (!providerId) throw new ValidationError("AccountPool providerId is required");
    if (!Object.values(ACCOUNT_SELECTION_POLICY).includes(policy)) {
      throw new ValidationError(`Unknown account selection policy: ${policy}`, { policy });
    }
    this.providerId = providerId;
    this.policy = policy;
    this.clock = clock;
  }
  upsert(input, { resetHealth = false } = {}) {
    if (input.providerId && input.providerId !== this.providerId) {
      throw new ValidationError("Account provider does not match this pool", {
        expected: this.providerId,
        received: input.providerId
      });
    }
    const current = this.#accounts.get(input.accountId);
    const account = createAccountRecord(
      {
        ...current,
        ...input,
        credentialRef: input.credentialRef ?? current?.auth?.credentialRef,
        providerId: this.providerId,
        auth: { ...current?.auth, ...input.auth },
        subscription: { ...current?.subscription, ...input.subscription },
        quota: { ...current?.quota, ...input.quota },
        refresh: { ...current?.refresh, ...input.refresh },
        resources: { ...current?.resources, ...input.resources },
        health: resetHealth ? {
          ...input.health,
          status: input.health?.status === ACCOUNT_HEALTH.EXPIRED ? ACCOUNT_HEALTH.UNKNOWN : input.health?.status ?? ACCOUNT_HEALTH.UNKNOWN,
          cooldownUntil: null,
          lastError: null
        } : { ...current?.health, ...input.health },
        createdAt: current?.createdAt ?? input.createdAt
      },
      this.clock()
    );
    this.#accounts.set(account.accountId, account);
    this.#ensureSingleAccountDefault();
    return accountSummary(account);
  }
  remove(accountId) {
    this.#sessionAssignments.forEach((assignment, key) => {
      const assignedId = typeof assignment === "string" ? assignment : assignment?.accountId;
      if (assignedId === accountId) this.#sessionAssignments.delete(key);
    });
    const removed = this.#accounts.delete(accountId);
    if (removed) this.#reportedOpByAccount.delete(accountId);
    if (removed && this.#defaultAccountId === accountId) this.#defaultAccountId = null;
    this.#ensureSingleAccountDefault();
    return removed;
  }
  get(accountId) {
    const account = this.#accounts.get(accountId);
    return account ? accountSummary(account) : null;
  }
  list() {
    return [...this.#accounts.values()].map(accountSummary);
  }
  listForStorage() {
    return [...this.#accounts.values()].map(accountStorageRecord);
  }
  getDefaultAccountId() {
    return this.#defaultAccountId;
  }
  setPolicy(policy) {
    if (!Object.values(ACCOUNT_SELECTION_POLICY).includes(policy)) {
      throw new ValidationError(`Unknown account selection policy: ${policy}`, { policy });
    }
    this.policy = policy;
    this.#sessionAssignments.clear();
    this.#ensureSingleAccountDefault();
  }
  setDefaultAccount(accountId) {
    if (accountId !== null && !this.#accounts.has(accountId)) {
      throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    }
    this.#defaultAccountId = accountId;
  }
  select(context = {}) {
    const now = this.clock();
    this.#pruneSessionAssignments(now.getTime());
    const eligible = this.#eligibleAccounts(now);
    if (eligible.length === 0) {
      throw new AccountSelectionError(`No eligible accounts for provider ${this.providerId}`, {
        providerId: this.providerId
      });
    }
    const excludedIds = new Set(Array.isArray(context.excludeAccountIds) ? context.excludeAccountIds : []);
    const selectable = eligible.filter((candidate2) => !excludedIds.has(candidate2.accountId));
    if (selectable.length === 0) {
      throw new AccountSelectionError("No eligible account remains after selection exclusions", {
        providerId: this.providerId,
        excludeAccountIds: [...excludedIds]
      });
    }
    let account;
    if (this.policy === ACCOUNT_SELECTION_POLICY.MANUAL) {
      const requestedId = context.accountId ?? this.#defaultAccountId ?? (selectable.length === 1 ? selectable[0].accountId : null);
      if (!requestedId) throw new AccountSelectionError("Manual policy requires accountId");
      account = selectable.find((candidate2) => candidate2.accountId === requestedId);
      if (!account) throw new AccountSelectionError(`Account is not eligible: ${requestedId}`, { accountId: requestedId });
    } else {
      const sticky = this.policy === ACCOUNT_SELECTION_POLICY.STICKY_SESSION;
      const assignmentKey = sticky ? context.sessionId ?? context.requestId ?? null : null;
      const assignment = assignmentKey ? this.#sessionAssignments.get(assignmentKey) : null;
      const assignedId = typeof assignment === "string" ? assignment : assignment?.accountId;
      account = assignedId ? selectable.find((candidate2) => candidate2.accountId === assignedId) : null;
      if (!account) {
        account = this.policy === ACCOUNT_SELECTION_POLICY.FAILOVER ? selectable[0] : this.#next(selectable);
      }
      if (assignmentKey) {
        this.#sessionAssignments.delete(assignmentKey);
        this.#sessionAssignments.set(assignmentKey, {
          accountId: account.accountId,
          lastUsedAt: now.getTime()
        });
        this.#pruneSessionAssignments(now.getTime());
      }
    }
    const timestamp = now.toISOString();
    const updated = {
      ...account,
      lastUsedAt: timestamp,
      updatedAt: timestamp
    };
    this.#accounts.set(updated.accountId, updated);
    const summary = accountSummary(updated);
    return { ...summary, opToken: ++this.#operationSeq };
  }
  resolve(accountId) {
    const account = this.#accounts.get(accountId);
    if (!account) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return {
      providerId: account.providerId,
      accountId: account.accountId,
      credentialRef: account.auth.credentialRef,
      authKind: account.auth.kind,
      scopes: [...account.auth.scopes]
    };
  }
  updateQuota(accountId, input) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, {
      quota: createQuotaSnapshot({ ...current.quota, ...input }, this.clock())
    });
  }
  updateRefresh(accountId, input) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, {
      refresh: createRefreshState({ ...current.refresh, ...input })
    });
  }
  updateResources(accountId, input = {}) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, { resources: { ...current.resources, ...input } });
  }
  report(accountId, result = {}, { opToken } = {}) {
    const account = this.#accounts.get(accountId);
    if (!account) return null;
    if (opToken !== void 0) {
      const lastReported = this.#reportedOpByAccount.get(accountId) ?? 0;
      if (opToken <= lastReported) return accountSummary(account);
      this.#reportedOpByAccount.set(accountId, opToken);
    }
    const now = this.clock().toISOString();
    const patch = { updatedAt: now, health: { ...account.health, lastCheckedAt: now } };
    if (result.quota) patch.quota = createQuotaSnapshot({ ...account.quota, ...result.quota }, this.clock());
    if (result.refresh) patch.refresh = createRefreshState({ ...account.refresh, ...result.refresh });
    switch (result.status) {
      case "success":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.HEALTHY, cooldownUntil: null, lastError: null };
        break;
      case "rate_limited":
        patch.health = {
          ...patch.health,
          status: result.cooldownUntil ? ACCOUNT_HEALTH.COOLDOWN : ACCOUNT_HEALTH.DEGRADED,
          cooldownUntil: result.cooldownUntil ?? null,
          lastError: result.message ?? null
        };
        break;
      case "quota_exhausted":
        patch.health = {
          ...patch.health,
          status: ACCOUNT_HEALTH.EXHAUSTED,
          cooldownUntil: result.cooldownUntil ?? null,
          lastError: result.message ?? null
        };
        break;
      case "auth_expired":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.EXPIRED, lastError: result.message ?? null };
        break;
      case "error":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.DEGRADED, lastError: result.message ?? null };
        break;
      default:
        break;
    }
    return this.#patch(accountId, patch);
  }
  #patch(accountId, patch) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    const next = {
      ...current,
      ...patch,
      quota: patch.quota ? { ...current.quota, ...patch.quota } : current.quota,
      refresh: patch.refresh ? { ...current.refresh, ...patch.refresh } : current.refresh,
      resources: patch.resources ? { ...current.resources, ...patch.resources } : current.resources,
      health: patch.health ? { ...current.health, ...patch.health } : current.health
    };
    this.#accounts.set(accountId, next);
    return accountSummary(next);
  }
  #eligibleAccounts(now = this.clock()) {
    return [...this.#accounts.values()].filter((account) => {
      if (account.health.status === ACCOUNT_HEALTH.EXPIRED) return false;
      if (account.health.status === ACCOUNT_HEALTH.EXHAUSTED && !account.health.cooldownUntil) return false;
      if (!account.health.cooldownUntil) return true;
      return new Date(account.health.cooldownUntil).getTime() <= now.getTime();
    });
  }
  #pruneSessionAssignments(nowMs) {
    for (const [key, assignment] of this.#sessionAssignments) {
      const lastUsedAt = typeof assignment === "object" ? assignment.lastUsedAt : nowMs;
      if (nowMs - Number(lastUsedAt) > STICKY_SESSION_TTL_MS) this.#sessionAssignments.delete(key);
    }
    while (this.#sessionAssignments.size > MAX_STICKY_ASSIGNMENTS) {
      const oldest = this.#sessionAssignments.keys().next().value;
      if (oldest === void 0) break;
      this.#sessionAssignments.delete(oldest);
    }
  }
  #next(accounts) {
    const account = accounts[this.#cursor % accounts.length];
    this.#cursor = (this.#cursor + 1) % accounts.length;
    return account;
  }
  #ensureSingleAccountDefault() {
    if (this.policy !== ACCOUNT_SELECTION_POLICY.MANUAL || this.#defaultAccountId || this.#accounts.size !== 1) return;
    this.#defaultAccountId = this.#accounts.keys().next().value ?? null;
  }
};

// packages/dsh-bridge/src/llm-adapter.mjs
function effortName(id) {
  return String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
function modelCapacityText(value) {
  if (!Number.isInteger(value) || value <= 0) return null;
  return `${new Intl.NumberFormat().format(value)} tokens`;
}
function modelDescription(model) {
  const details = [];
  if (typeof model.description === "string" && model.description.length > 0) {
    details.push(model.description);
  }
  const context = modelCapacityText(model.contextWindow);
  details.push(context ? `\u4E0A\u4E0B\u6587 ${context}` : "\u4E0A\u4E0B\u6587\u672A\u7531 provider \u8FD4\u56DE");
  const output = modelCapacityText(model.maxTokens);
  if (output) details.push(`\u8F93\u51FA\u4E0A\u9650 ${output}`);
  return details.join(" \xB7 ");
}
function normalizeDshReasoning(reasoning) {
  if (!reasoning || !Array.isArray(reasoning.efforts)) return void 0;
  const efforts = [];
  const seen = /* @__PURE__ */ new Set();
  for (const effort of reasoning.efforts) {
    if (!effort || typeof effort.id !== "string" || effort.id.length === 0 || seen.has(effort.id)) continue;
    const name2 = typeof effort.name === "string" && effort.name.length > 0 ? effort.name : effortName(effort.id);
    const normalized = {
      id: effort.id,
      name: name2,
      ...typeof effort.description === "string" ? { description: effort.description } : {}
    };
    efforts.push(normalized);
    seen.add(effort.id);
  }
  if (efforts.length === 0) return void 0;
  const defaultEffort = typeof reasoning.defaultEffort === "string" && seen.has(reasoning.defaultEffort) ? reasoning.defaultEffort : void 0;
  return {
    efforts,
    ...defaultEffort === void 0 ? {} : { defaultEffort }
  };
}
function providerCatalogModels(providerId, catalog) {
  if (!Array.isArray(catalog?.models)) return [];
  const seen = /* @__PURE__ */ new Set();
  return catalog.models.filter((model) => {
    if (!model || typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  }).map((model) => {
    const reasoning = normalizeDshReasoning(model.reasoning);
    const contextWindow = Number.isInteger(model.contextWindow) && model.contextWindow > 0 ? model.contextWindow : void 0;
    let defaultMaxTokens = void 0;
    if (Number.isInteger(model.maxTokens) && model.maxTokens > 0) {
      const cap = contextWindow ? Math.max(1024, Math.min(16384, Math.floor(contextWindow * 0.2))) : 16384;
      defaultMaxTokens = Math.min(model.maxTokens, cap);
    } else if (contextWindow) {
      defaultMaxTokens = Math.min(8192, Math.floor(contextWindow * 0.2));
    }
    return {
      provider: providerId,
      id: model.id,
      name: typeof model.name === "string" && model.name.length > 0 ? model.name : model.id,
      description: modelDescription(model),
      ...Array.isArray(model.inputModalities) ? { inputModalities: [...model.inputModalities] } : {},
      ...contextWindow ? { context: { contextWindow } } : {},
      ...defaultMaxTokens !== void 0 ? { defaultMaxTokens } : {},
      ...reasoning ? { reasoning } : {}
    };
  });
}
function manifestFor(runtime, providerId) {
  return runtime.listProviderManifests?.().find((manifest) => manifest.id === providerId) ?? null;
}
function providerHasConnectedAccount(runtime, providerId) {
  if (providerId === "opencode" || providerId === "workbuddy" || providerId === "kilo") return true;
  if (typeof runtime.snapshot !== "function") return true;
  const snapshot = runtime.snapshot();
  if (!Array.isArray(snapshot?.providers)) return true;
  const provider = snapshot.providers.find((entry) => entry?.providerId === providerId);
  return Array.isArray(provider?.accounts) && provider.accounts.length > 0;
}
function requestHasImage(value) {
  if (Array.isArray(value)) return value.some((item) => requestHasImage(item));
  if (!value || typeof value !== "object") return false;
  if (value.type === "image") return true;
  return Object.values(value).some((item) => requestHasImage(item));
}
function requestHasImageInCurrentTurn(request = {}) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  if (messages.length > 0) {
    const current = messages.at(-1)?.role === "user" ? messages.at(-1) : [...messages].reverse().find((message) => message?.role === "user") ?? messages.at(-1);
    return requestHasImage(current?.content ?? current?.text);
  }
  return requestHasImage(request.input);
}
function unsupportedContentError(message) {
  const error = new ValidationError(message);
  error.code = "UNSUPPORTED_CONTENT";
  return error;
}
var CONTEXT_OVERFLOW_PATTERNS = [
  /context[\s_-](?:length|window)[\s_-](?:exceed|overflow|limit)/i,
  /maximum context length/i,
  /max context window/i,
  /too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?(?:model(?:'s)?\s+)?context/i,
  /(?:input|prompt|request|messages?)\b.{0,40}(?:exceed|overflow|is\s+larger\s+than)\b.{0,40}\b(?:model(?:'s)?\s+)?context/i
];
function isContextOverflowError(errorOrMessage) {
  if (!errorOrMessage) return false;
  if (typeof errorOrMessage === "string") {
    return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(errorOrMessage));
  }
  const code = String(errorOrMessage.code ?? errorOrMessage.upstreamCode ?? "");
  if (/CONTEXT_WINDOW_EXCEEDED|CONTEXT_LENGTH_EXCEEDED/i.test(code)) return true;
  const message = String(errorOrMessage.message ?? errorOrMessage.reason ?? "");
  return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message));
}
function normalizeTransportFailure(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error" ? chunk.reason.failure : null;
  if (!failure) return chunk;
  if (failure.code !== "TRANSPORT" && /\bWebSocket closed\s+1006\b/i.test(String(failure.message ?? ""))) {
    return {
      ...chunk,
      reason: {
        ...chunk.reason,
        failure: {
          ...failure,
          code: "TRANSPORT"
        }
      }
    };
  }
  if (failure.code !== "CONTEXT_WINDOW_EXCEEDED" && isContextOverflowError(failure)) {
    return {
      ...chunk,
      reason: {
        ...chunk.reason,
        failure: {
          ...failure,
          code: "CONTEXT_WINDOW_EXCEEDED"
        }
      }
    };
  }
  return chunk;
}
var RETRYABLE_THROWN_FAILURE_CODES = /* @__PURE__ */ new Set([
  "CONTEXT_WINDOW_EXCEEDED",
  "EMPTY_RESPONSE",
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT"
]);
function retryFinishFromThrownError(error) {
  let code = error?.code;
  if (code === "EMPTY_STREAM_OUTPUT" && error?.emptyOutput === true) {
    code = "EMPTY_RESPONSE";
  } else if (code === "PI_AI_ERROR" && /\bWebSocket closed\s+1006\b/i.test(String(error.message ?? ""))) {
    code = "TRANSPORT";
  } else if (isContextOverflowError(error)) {
    code = "CONTEXT_WINDOW_EXCEEDED";
  }
  if (!RETRYABLE_THROWN_FAILURE_CODES.has(code)) return null;
  return {
    type: "finish",
    reason: {
      kind: "error",
      failure: {
        code,
        message: String(error.message ?? "Provider stream ended without substantive output"),
        ...Number.isInteger(error.status) ? { status: error.status } : {},
        ...typeof error.providerRetryAfterMs === "number" && Number.isFinite(error.providerRetryAfterMs) ? { providerRetryAfterMs: error.providerRetryAfterMs } : {}
      }
    }
  };
}
function resolveFallbackModelMetadata(provider, model) {
  const id = String(model ?? "").toLowerCase();
  let contextWindow = 131072;
  let maxTokens = 8192;
  if (id.includes("gemini")) {
    contextWindow = 1048576;
    maxTokens = 16384;
  } else if (id.includes("claude-sonnet-4") || id.includes("claude-4")) {
    contextWindow = 1e6;
    maxTokens = 16384;
  } else if (id.includes("claude")) {
    contextWindow = 2e5;
    maxTokens = 8192;
  } else if (id.includes("grok-4")) {
    contextWindow = 256e3;
    maxTokens = 8192;
  } else if (id.includes("qwen")) {
    contextWindow = 262144;
    maxTokens = 8192;
  } else if (id.includes("glm-5")) {
    contextWindow = 204800;
    maxTokens = 8192;
  } else if (id.includes("deepseek-v4") || id.includes("deepseek-v3") || id.includes("deepseek-r1")) {
    contextWindow = 2e5;
    maxTokens = 8192;
  } else if (id.includes("gpt-") || id.includes("codex-") || provider === "openai-codex") {
    contextWindow = 2e5;
    maxTokens = 8192;
  }
  return {
    provider,
    id: model,
    name: model,
    context: { contextWindow },
    defaultMaxTokens: maxTokens
  };
}
function createDockyardLlmAdapter({ runtime, providerIds, attachmentsResolver = null } = {}) {
  if (!runtime) throw new ValidationError("Dockyard runtime is required");
  const owned = [...providerIds ?? runtime.listProviderIds?.() ?? []];
  if (owned.length === 0) throw new ValidationError("At least one Dockyard provider is required");
  const catalogPromises = /* @__PURE__ */ new Map();
  const catalogCache = /* @__PURE__ */ new Map();
  const STREAM_CATALOG_REFRESH_MS = 6e4;
  async function ensureRuntimeReady() {
    if (typeof runtime.init === "function") await runtime.init();
  }
  function abortedCallerError(signal) {
    const error = new Error("This model lookup was aborted");
    error.name = "AbortError";
    if (signal?.reason !== void 0) error.cause = signal.reason;
    return error;
  }
  function raceCallerSignal(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortedCallerError(signal));
    return new Promise((resolve2, reject) => {
      const onAbort = () => reject(abortedCallerError(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve2(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      );
    });
  }
  async function providerCatalog(provider, signal, { force = false } = {}) {
    if (!force) {
      const cached = cachedProviderCatalog(provider);
      if (cached) return cached;
    }
    let promise = catalogPromises.get(provider);
    if (!promise) {
      promise = Promise.resolve().then(() => runtime.getCatalog(provider, { force })).then((catalog) => {
        catalogCache.set(provider, { value: catalog, fetchedAt: Date.now() });
        return catalog;
      }).finally(() => {
        if (catalogPromises.get(provider) === promise) catalogPromises.delete(provider);
      });
      catalogPromises.set(provider, promise);
    }
    return raceCallerSignal(promise, signal);
  }
  function cachedProviderCatalog(provider) {
    const entry = catalogCache.get(provider);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt >= STREAM_CATALOG_REFRESH_MS && !catalogPromises.has(provider)) {
      void providerCatalog(provider).catch(() => {
      });
    }
    return entry.value;
  }
  function warmProviderCatalog(provider) {
    if (!catalogCache.has(provider) && !catalogPromises.has(provider)) {
      void providerCatalog(provider).catch(() => {
      });
    }
  }
  function fastResolveModel(provider, model) {
    const fallback = resolveFallbackModelMetadata(provider, model);
    const catalog = cachedProviderCatalog(provider);
    if (!catalog) {
      warmProviderCatalog(provider);
      return fallback;
    }
    return providerCatalogModels(provider, catalog).find((entry) => entry.id === model) ?? fallback;
  }
  return {
    providerInfo(provider) {
      const manifest = manifestFor(runtime, provider);
      return { id: provider, name: manifest?.displayName ?? provider };
    },
    providerRetryPolicy() {
      return void 0;
    },
    imageRequestPricing(_provider, _model) {
      return void 0;
    },
    imageRequestTarget(_provider, _model, image) {
      return {
        width: image?.width ?? 0,
        height: image?.height ?? 0,
        maxBytes: image?.bytes ?? 0
      };
    },
    async listModels(provider, signal) {
      await ensureRuntimeReady();
      if (!providerHasConnectedAccount(runtime, provider)) return [];
      const catalog = await providerCatalog(provider, signal);
      const allModels = providerCatalogModels(provider, catalog);
      const enabled = runtime.getModelSelection?.(provider);
      if (Array.isArray(enabled)) {
        const set = new Set(enabled);
        return allModels.filter((entry) => set.has(entry.id));
      }
      return allModels;
    },
    async resolveModel(provider, model, signal) {
      await ensureRuntimeReady();
      const fallback = resolveFallbackModelMetadata(provider, model);
      if (!providerHasConnectedAccount(runtime, provider)) return fallback;
      const cached = cachedProviderCatalog(provider);
      if (cached) {
        return providerCatalogModels(provider, cached).find((entry) => entry.id === model) ?? fallback;
      }
      const catalog = await providerCatalog(provider, signal);
      return providerCatalogModels(provider, catalog).find((entry) => entry.id === model) ?? fallback;
    },
    async prepareCall(provider, model, signal) {
      return {
        // DSH may call prepareCall immediately before generation. Do not make
        // that path wait for a cold provider catalog; listModels/resolveModel
        // remain the explicit, authoritative discovery APIs.
        model: fastResolveModel(provider, model),
        stream: (options = {}) => this.stream(
          signal && options.signal === void 0 ? { ...options, signal } : options
        )
      };
    },
    async *stream(options) {
      await ensureRuntimeReady();
      if (!providerHasConnectedAccount(runtime, options.provider)) {
        throw new ValidationError(`Provider ${options.provider} has no connected Dockyard account`);
      }
      const catalog = cachedProviderCatalog(options.provider);
      if (!catalog) warmProviderCatalog(options.provider);
      const model = catalog ? providerCatalogModels(options.provider, catalog).find((entry) => entry.id === options.model) : null;
      if (requestHasImageInCurrentTurn(options) && Array.isArray(model?.inputModalities) && !model.inputModalities.includes("image")) {
        throw unsupportedContentError(
          `\u6A21\u578B ${model.name ?? model.id} \u7684\u5B9E\u65F6 provider catalog \u672A\u58F0\u660E\u56FE\u7247\u8F93\u5165\u80FD\u529B`
        );
      }
      const request = model ? {
        ...options,
        ...model.context ? { modelContext: { ...model.context } } : {},
        ...model.defaultMaxTokens !== void 0 ? { modelContext: { ...model.context ?? {}, maxTokens: model.defaultMaxTokens } } : {}
      } : { ...options };
      if (options.purpose === "compaction") {
        request.purpose = "compaction";
        request.reasoningEffort = "minimal";
        request.reasoning_effort = "minimal";
        request.thinking = false;
      }
      const attachments = typeof attachmentsResolver === "function" ? attachmentsResolver() : void 0;
      const stream = await runtime.stream(options.provider, request, {
        accountId: options.accountId,
        requestId: options.requestId,
        sessionId: options.sessionId,
        ...options.signal ? { signal: options.signal } : {},
        ...attachments ? { attachments } : {}
      });
      let emittedChunk = false;
      try {
        for await (const chunk of stream) {
          emittedChunk = true;
          yield normalizeTransportFailure(chunk);
        }
      } catch (error) {
        if (!emittedChunk || isContextOverflowError(error)) {
          const retryFinish = retryFinishFromThrownError(error);
          if (retryFinish) {
            yield retryFinish;
            return;
          }
        }
        throw error;
      }
    },
    providers() {
      return [...owned];
    },
    invalidateCatalog(provider) {
      if (provider) {
        catalogCache.delete(provider);
        catalogPromises.delete(provider);
      } else {
        catalogCache.clear();
        catalogPromises.clear();
      }
    }
  };
}

// packages/dsh-bridge/src/index.mjs
var DshInjectionBridge = class {
  #routes = /* @__PURE__ */ new Map();
  constructor({ runtime, adapter = null, contextWindowOverrides = null } = {}) {
    if (!runtime) throw new ValidationError("DSH runtime is required");
    this.runtime = runtime;
    this.adapter = adapter;
    this.contextWindowOverrides = contextWindowOverrides;
  }
  async mountProvider(providerModule, accountPool) {
    const providerId = providerModule?.manifest?.id;
    if (!providerId) throw new ValidationError("Provider module is required");
    if (!this.runtime.has(providerId)) await this.runtime.register(providerModule);
    const previous = this.#routes.get(providerId) ?? null;
    const route = createProviderRoute({
      providerModule,
      accountPool,
      contextWindowOverrides: this.contextWindowOverrides
    });
    let adapterMounted = false;
    try {
      if (this.adapter?.registerProviderRoute) {
        await this.adapter.registerProviderRoute(route, providerModule.manifest);
        adapterMounted = true;
      }
      this.#routes.set(providerId, route);
      await this.runtime.events.emit("dsh/provider-mounted", {
        providerId,
        manifest: { ...providerModule.manifest }
      });
      return route;
    } catch (error) {
      if (this.#routes.get(providerId) === route) this.#routes.delete(providerId);
      if (adapterMounted && this.adapter?.unregisterProviderRoute) {
        await this.adapter.unregisterProviderRoute(providerId).catch(() => {
        });
        if (previous) {
          await this.adapter.registerProviderRoute(previous, providerModule.manifest).catch(() => {
          });
          this.#routes.set(providerId, previous);
        }
      }
      throw error;
    }
  }
  async unmountProvider(providerId) {
    const route = this.#routes.get(providerId);
    if (!route) return false;
    if (this.adapter?.unregisterProviderRoute) await this.adapter.unregisterProviderRoute(providerId);
    this.#routes.delete(providerId);
    await this.runtime.events.emit("dsh/provider-unmounted", { providerId });
    return true;
  }
  getRoute(providerId) {
    return this.#routes.get(providerId) ?? null;
  }
  listRoutes() {
    return [...this.#routes.keys()];
  }
};

// packages/vault/src/index.mjs
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var KEYCHAIN_SERVICE = "com.dockyard-dsh.credentials";
var SWIFT_BIN = "/usr/bin/swift";
var KEYCHAIN_HELPER = join(dirname(fileURLToPath(import.meta.url)), "macos-keychain-helper.swift");
function stableKey(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
function runKeychainHelper(request, { timeoutMs = 3e4 } = {}) {
  return new Promise((resolve2, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const child = spawn(SWIFT_BIN, [KEYCHAIN_HELPER], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    let exitError = "";
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => {
      exitError += chunk.toString();
    });
    child.on("error", (error) => finish(reject, error));
    child.on("close", (code) => {
      if (settled) return;
      if (code === 0) {
        try {
          finish(resolve2, JSON.parse(Buffer.concat(stdout).toString("utf8")));
        } catch {
          finish(reject, new Error("macOS Keychain helper returned invalid data"));
        }
        return;
      }
      const error = new Error("macOS Keychain operation failed");
      error.code = code;
      error.detail = exitError.replace(/\s+/g, " ").trim().slice(0, 300);
      finish(reject, error);
    });
    timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error("macOS Keychain operation timed out");
      error.code = "ETIMEDOUT";
      finish(reject, error);
    }, timeoutMs);
    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}
function createCredentialRef(providerId, accountId) {
  return `keychain://dockyard-dsh/${stableKey(`${providerId}:${accountId}`)}`;
}
var UnavailableSecretStore = class {
  constructor({ platform = process.platform } = {}) {
    this.platform = platform;
  }
  async read() {
    return null;
  }
  async write() {
    throw new Error(`Secure credential storage is unavailable on ${this.platform}; configure the host credential service`);
  }
  async delete() {
  }
};
var MacOSKeychainStore = class {
  constructor({ service = KEYCHAIN_SERVICE } = {}) {
    this.service = service;
  }
  async read(ref) {
    try {
      const output = await runKeychainHelper({ operation: "read", service: this.service, account: ref, value: null });
      return output.found ? JSON.parse(output.value) : null;
    } catch (error) {
      throw error;
    }
  }
  async write(ref, value) {
    await runKeychainHelper({
      operation: "write",
      service: this.service,
      account: ref,
      value: JSON.stringify(value)
    });
    return ref;
  }
  async delete(ref) {
    await runKeychainHelper({ operation: "delete", service: this.service, account: ref, value: null });
  }
};
function createDefaultSecretStore({ platform = process.platform } = {}) {
  if (platform !== "darwin") return new UnavailableSecretStore({ platform });
  return new MacOSKeychainStore();
}
var secretStoreConstants = Object.freeze({
  keychainService: KEYCHAIN_SERVICE
});

// packages/runtime/src/state-store.mjs
import { mkdir, open, readFile as readFile2, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname as dirname2, join as join2 } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
var LOCK_RETRY_MS = 25;
var LOCK_TIMEOUT_MS = 3e4;
var LOCK_STALE_MS = 12e4;
function delay(milliseconds) {
  return new Promise((resolve2) => setTimeout(resolve2, milliseconds));
}
function parseLockOwner(value) {
  const [pidText, token] = String(value ?? "").trim().split(/\s+/, 2);
  const pid = Number(pidText);
  return Number.isInteger(pid) && pid > 0 && token ? { pid, token } : null;
}
function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
async function removeLockIfOwned(lockPath, token) {
  try {
    const owner = parseLockOwner(await readFile2(lockPath, "utf8"));
    if (!owner && !token) {
      await rm(lockPath, { force: true });
      return true;
    }
    if (owner?.token !== token) return false;
    await rm(lockPath, { force: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
async function acquireFileLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  await mkdir(dirname2(filePath), { recursive: true, mode: 448 });
  while (true) {
    try {
      const handle = await open(lockPath, "wx", 384);
      const token = randomUUID();
      try {
        await handle.writeFile(`${process.pid} ${token}
`, "utf8");
      } catch (error) {
        await handle.close().catch(() => {
        });
        await removeLockIfOwned(lockPath, token).catch(() => {
        });
        throw error;
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await handle.close().catch(() => {
        });
        await removeLockIfOwned(lockPath, token).catch(() => {
        });
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const metadata = await stat(lockPath);
        if (Date.now() - metadata.mtimeMs > LOCK_STALE_MS) {
          const owner = parseLockOwner(await readFile2(lockPath, "utf8").catch(() => ""));
          if (!owner || !processIsAlive(owner.pid)) {
            await removeLockIfOwned(lockPath, owner?.token ?? "");
            continue;
          }
        }
      } catch (lockError) {
        if (lockError?.code !== "ENOENT") throw lockError;
        continue;
      }
      if (Date.now() >= deadline) {
        const timeout = new Error(`Timed out waiting for state file lock: ${filePath}`);
        timeout.code = "ELOCKTIMEOUT";
        throw timeout;
      }
      await delay(LOCK_RETRY_MS);
    }
  }
}
async function withFileLock(filePath, operation) {
  const release = await acquireFileLock(filePath);
  try {
    return await operation();
  } finally {
    await release();
  }
}
function defaultDockyardHome({ env = process.env, home = homedir() } = {}) {
  return env.DOCKYARD_DSH_HOME || join2(home, ".dockyard-dsh");
}
function defaultDockyardStatePath(options = {}) {
  return join2(defaultDockyardHome(options), "state.json");
}
function emptyState() {
  return {
    schema: 1,
    pools: {},
    updatedAt: null
  };
}
var JsonStateStore = class {
  constructor({ filePath, home, env } = {}) {
    this.filePath = filePath ?? defaultDockyardStatePath({ home, env });
  }
  async load() {
    return withFileLock(this.filePath, () => this.#loadUnlocked());
  }
  /**
   * Load without acquiring the file lock. Callers already holding the lock
   * (save/update) use this to avoid re-entrant lock acquisition.
   */
  async #loadUnlocked() {
    let raw;
    try {
      raw = await readFile2(this.filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return emptyState();
      throw error;
    }
    try {
      return this.#parse(raw);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      try {
        raw = await readFile2(this.filePath, "utf8");
        return this.#parse(raw);
      } catch (retryError) {
        if (retryError?.code === "ENOENT") return emptyState();
        if (!(retryError instanceof SyntaxError)) throw retryError;
      }
      const archivePath = `${this.filePath}.corrupted.${Date.now()}`;
      await rename(this.filePath, archivePath).catch(() => {
      });
      return emptyState();
    }
  }
  #parse(raw) {
    const parsed = JSON.parse(raw);
    return {
      ...emptyState(),
      ...parsed,
      pools: parsed?.pools && typeof parsed.pools === "object" ? parsed.pools : {}
    };
  }
  async save(state) {
    return withFileLock(this.filePath, async () => {
      const current = await this.#loadUnlocked();
      return this.#write({ ...current, ...state ?? {} });
    });
  }
  async update(mutator) {
    if (typeof mutator !== "function") throw new TypeError("State update mutator must be a function");
    return withFileLock(this.filePath, async () => {
      const current = await this.#loadUnlocked();
      const next = await mutator(current);
      return this.#write(next);
    });
  }
  async #write(state) {
    const next = {
      ...emptyState(),
      ...state,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await mkdir(dirname2(this.filePath), { recursive: true, mode: 448 });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    let committed = false;
    try {
      await writeFile(tempPath, `${JSON.stringify(next, null, 2)}
`, { mode: 384 });
      const handle = await open(tempPath, "r+");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tempPath, this.filePath);
      committed = true;
      try {
        const directory = await open(dirname2(this.filePath), "r");
        try {
          await directory.sync();
        } catch {
        } finally {
          await directory.close();
        }
      } catch {
      }
      return next;
    } finally {
      if (!committed) await rm(tempPath, { force: true }).catch(() => {
      });
    }
  }
};

// packages/runtime/src/context-window-overrides.mjs
var MAX_CONTEXT_WINDOW = Number.MAX_SAFE_INTEGER;
function text(value) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}
function normalizeContextWindow(value) {
  if (value === null || value === void 0 || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replaceAll(",", "").trim());
  if (!Number.isSafeInteger(numeric) || numeric <= 0 || numeric > MAX_CONTEXT_WINDOW) return null;
  return numeric;
}
function normalizedMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
function cleanModelMap(value) {
  const output = {};
  for (const [modelId, raw] of Object.entries(normalizedMap(value))) {
    const id = text(modelId);
    const contextWindow = normalizeContextWindow(raw);
    if (id && contextWindow !== null) output[id] = contextWindow;
  }
  return output;
}
function cleanNestedModelMap(value) {
  const output = {};
  for (const [scopeId, models] of Object.entries(normalizedMap(value))) {
    const id = text(scopeId);
    const cleaned = cleanModelMap(models);
    if (id && Object.keys(cleaned).length > 0) output[id] = cleaned;
  }
  return output;
}
function cleanProviderRecord(value) {
  return {
    models: cleanModelMap(value?.models),
    accounts: cleanNestedModelMap(value?.accounts),
    keys: cleanNestedModelMap(value?.keys)
  };
}
function cleanState(value) {
  const providers = {};
  for (const [providerId, record] of Object.entries(normalizedMap(value?.providers))) {
    const id = text(providerId);
    if (!id) continue;
    const cleaned = cleanProviderRecord(record);
    if (Object.values(cleaned).some((map) => Object.keys(map).length > 0)) providers[id] = cleaned;
  }
  return { schema: 1, providers };
}
function assertScope(scope = {}) {
  const providerId = text(scope.providerId);
  const modelId = text(scope.modelId);
  const accountId = text(scope.accountId);
  const keyRef = text(scope.keyRef);
  if (!providerId) throw new Error("\u4E0A\u4E0B\u6587\u8986\u76D6\u914D\u7F6E\u9700\u8981 providerId");
  if (!modelId) throw new Error("\u4E0A\u4E0B\u6587\u8986\u76D6\u914D\u7F6E\u9700\u8981 modelId");
  if (accountId && keyRef) throw new Error("\u4E0A\u4E0B\u6587\u8986\u76D6\u914D\u7F6E\u4E0D\u80FD\u540C\u65F6\u7ED1\u5B9A\u8D26\u53F7\u548C Key");
  return {
    providerId,
    modelId,
    ...accountId ? { accountId } : {},
    ...keyRef ? { keyRef } : {}
  };
}
function bucketFor(scope) {
  if (scope.keyRef) return ["keys", scope.keyRef];
  if (scope.accountId) return ["accounts", scope.accountId];
  return ["models", null];
}
function exactValue(state, scope) {
  const provider = state.providers?.[scope.providerId];
  if (!provider) return null;
  const [bucket, scopeId] = bucketFor(scope);
  const models = scopeId ? provider[bucket]?.[scopeId] : provider.models;
  return normalizeContextWindow(models?.[scope.modelId]);
}
function resolveValue(state, scope) {
  const provider = state.providers?.[scope.providerId];
  if (!provider) return null;
  if (scope.keyRef) {
    const keyValue = normalizeContextWindow(provider.keys?.[scope.keyRef]?.[scope.modelId]);
    if (keyValue !== null) return keyValue;
  }
  if (scope.accountId) {
    const accountValue = normalizeContextWindow(provider.accounts?.[scope.accountId]?.[scope.modelId]);
    if (accountValue !== null) return accountValue;
  }
  return normalizeContextWindow(provider.models?.[scope.modelId]);
}
function cloneState(value) {
  return structuredClone(cleanState(value));
}
function removeEmptyScopes(provider, bucket, scopeId) {
  if (bucket === "models") return;
  if (Object.keys(provider[bucket]?.[scopeId] ?? {}).length === 0) delete provider[bucket][scopeId];
}
function removeEmptyProvider(state, providerId) {
  const provider = state.providers?.[providerId];
  if (!provider) return;
  if (Object.values(provider).every((map) => Object.keys(map).length === 0)) delete state.providers[providerId];
}
var ContextWindowOverrideStore = class {
  stateStore;
  state = { schema: 1, providers: {} };
  readyPromise;
  constructor({ stateStore } = {}) {
    if (!stateStore || typeof stateStore.load !== "function" || typeof stateStore.update !== "function" && typeof stateStore.save !== "function") {
      throw new TypeError("Context window override store requires a state store");
    }
    this.stateStore = stateStore;
    this.readyPromise = this.load();
  }
  async load() {
    const snapshot = await this.stateStore.load();
    this.state = cleanState(snapshot?.contextWindowOverrides);
    return this;
  }
  async ready() {
    await this.readyPromise;
    return this;
  }
  describe(input) {
    const scope = assertScope(input);
    const override = exactValue(this.state, scope);
    const inherited = resolveValue(this.state, {
      providerId: scope.providerId,
      modelId: scope.modelId,
      ...scope.accountId ? { accountId: scope.accountId } : {},
      ...scope.keyRef ? { keyRef: scope.keyRef } : {}
    });
    return {
      ...scope,
      override,
      effectiveOverride: inherited,
      source: override !== null ? "custom" : inherited !== null ? "inherited" : "auto"
    };
  }
  resolve(providerId, modelId, scope = {}) {
    const normalized = assertScope({ providerId, modelId, ...scope });
    return resolveValue(this.state, normalized);
  }
  hasAny(providerId, modelId) {
    const normalizedProvider = text(providerId);
    const normalizedModel = text(modelId);
    if (!normalizedProvider || !normalizedModel) return false;
    const provider = this.state.providers?.[normalizedProvider];
    if (!provider) return false;
    if (normalizeContextWindow(provider.models?.[normalizedModel]) !== null) return true;
    return [provider.accounts, provider.keys].some((scopes) => Object.values(scopes ?? {}).some((models) => normalizeContextWindow(models?.[normalizedModel]) !== null));
  }
  async get(input) {
    await this.ready();
    return this.describe(input);
  }
  async set(input, value) {
    await this.ready();
    const scope = assertScope(input);
    const contextWindow = value === null || value === void 0 || value === "" ? null : normalizeContextWindow(value);
    if (value !== null && value !== void 0 && value !== "" && contextWindow === null) {
      throw new Error("\u4E0A\u4E0B\u6587\u4E0A\u9650\u5FC5\u987B\u662F\u6B63\u6574\u6570 token \u6570");
    }
    const mutate = (current) => {
      const next = {
        ...current,
        contextWindowOverrides: cloneState(current?.contextWindowOverrides)
      };
      const overrides = next.contextWindowOverrides;
      const provider = overrides.providers[scope.providerId] ?? {
        models: {},
        accounts: {},
        keys: {}
      };
      overrides.providers[scope.providerId] = provider;
      const [bucket, scopeId] = bucketFor(scope);
      const models = scopeId ? provider[bucket][scopeId] ??= {} : provider.models;
      if (contextWindow === null) delete models[scope.modelId];
      else models[scope.modelId] = contextWindow;
      removeEmptyScopes(provider, bucket, scopeId);
      removeEmptyProvider(overrides, scope.providerId);
      return { ...next, contextWindowOverrides: cleanState(overrides) };
    };
    const saved = typeof this.stateStore.update === "function" ? await this.stateStore.update(mutate) : await this.stateStore.save(mutate(await this.stateStore.load()));
    this.state = cleanState(saved?.contextWindowOverrides);
    return this.describe(scope);
  }
};

// packages/runtime/src/model-selection-store.mjs
function normalizedMap2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
function cleanState2(value) {
  const providers = {};
  for (const [providerId, record] of Object.entries(normalizedMap2(value?.providers))) {
    const id = typeof providerId === "string" ? providerId.trim() : null;
    if (!id) continue;
    if (Array.isArray(record?.enabled)) {
      const enabled = record.enabled.map((m) => typeof m === "string" ? m.trim() : "").filter(Boolean);
      providers[id] = { enabled, updatedAt: record.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString() };
    }
  }
  return { schema: 1, providers };
}
var ModelSelectionStore = class {
  stateStore;
  state = { schema: 1, providers: {} };
  readyPromise;
  constructor({ stateStore } = {}) {
    if (!stateStore || typeof stateStore.load !== "function" || typeof stateStore.update !== "function" && typeof stateStore.save !== "function") {
      throw new TypeError("ModelSelectionStore requires a state store");
    }
    this.stateStore = stateStore;
    this.readyPromise = this.load();
  }
  async load() {
    const snapshot = await this.stateStore.load();
    const raw = snapshot?.modelSelection;
    if (raw && typeof raw === "object") {
      this.state = cleanState2(raw);
    }
    return this.state;
  }
  async ready() {
    return this.readyPromise;
  }
  get(providerId) {
    if (!providerId) return null;
    const record = this.state.providers?.[providerId];
    if (!record || !Array.isArray(record.enabled)) return null;
    return [...record.enabled];
  }
  async set(providerId, enabledModelIds) {
    if (!providerId) throw new Error("providerId is required");
    await this.ready();
    const cleaned = Array.isArray(enabledModelIds) ? enabledModelIds.map((m) => typeof m === "string" ? m.trim() : "").filter(Boolean) : null;
    if (!this.state.providers) this.state.providers = {};
    if (cleaned === null) {
      delete this.state.providers[providerId];
    } else {
      this.state.providers[providerId] = {
        enabled: cleaned,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const saved = structuredClone(this.state);
    if (typeof this.stateStore.update === "function") {
      await this.stateStore.update((latest) => ({
        ...latest,
        modelSelection: saved
      }));
    } else {
      const latest = await this.stateStore.load();
      await this.stateStore.save({
        ...latest,
        modelSelection: saved
      });
    }
    return cleaned;
  }
  isModelEnabled(providerId, modelId) {
    const enabled = this.get(providerId);
    if (enabled === null) return true;
    return enabled.includes(modelId);
  }
  filterModels(providerId, models = []) {
    const enabled = this.get(providerId);
    if (enabled === null) return models;
    const set = new Set(enabled);
    return models.filter((model) => set.has(model.id));
  }
};

// modules/provider-codex/src/driver.mjs
import { createHash as createHash3 } from "node:crypto";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname3, join as join4 } from "node:path";

// packages/oauth/src/browser-oauth-authorizer.mjs
import { createHash as createHash2, randomBytes, randomUUID as randomUUID2 } from "node:crypto";
import { createServer } from "node:http";
var DEFAULT_TIMEOUT_MS = 10 * 60 * 1e3;
var DEFAULT_CALLBACK_PATH = "/oauth/callback";
function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}
function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const challenge = createHash2("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
function publicSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status,
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {},
    ...session.authorizationCodeRequired ? { authorizationCodeRequired: true } : {}
  };
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
var LOOPBACK_HOSTNAMES2 = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isLoopbackHostname2(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return LOOPBACK_HOSTNAMES2.has(bare);
}
function assertSafeCallbackHost(host) {
  const value = String(host ?? "").trim();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value.toLowerCase();
  if (!isLoopbackHostname2(bare)) {
    throw new Error(`OAuth callback host must be loopback (localhost / 127.0.0.1 / ::1), got: ${value || "<empty>"}`);
  }
}
function resolveLoopbackListenHost(host) {
  const bare = String(host ?? "").trim().toLowerCase();
  return bare === "::1" || bare === "[::1]" ? "::1" : "127.0.0.1";
}
function missingSession(sessionId, providerId, instructions) {
  return {
    sessionId,
    providerId,
    status: "missing",
    instructions,
    diagnostic: "OAuth \u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
  };
}
function extractCodeInput(input) {
  const text3 = String(input ?? "").trim();
  if (!text3) return { code: "", state: "" };
  try {
    const url = new URL(text3);
    return {
      code: url.searchParams.get("code") ?? "",
      state: url.searchParams.get("state") ?? "",
      error: url.searchParams.get("error") ?? ""
    };
  } catch {
    const [code, state] = text3.split("#", 2);
    return { code: code.trim(), state: state?.trim() ?? "" };
  }
}
function createBrowserOAuthAuthorizer({
  providerId,
  authorizationUrlBuilder,
  exchangeCode = null,
  pollSession = null,
  importCredentials,
  redirectUri,
  callbackPath = DEFAULT_CALLBACK_PATH,
  callbackHost = "localhost",
  callbackPort = null,
  instructions = "\u8BF7\u5728\u5B98\u65B9\u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\u3002",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  browserOpened = false,
  authorizationCodeRequired = false
} = {}) {
  if (!providerId) throw new Error("Browser OAuth authorizer requires providerId");
  if (typeof authorizationUrlBuilder !== "function") {
    throw new Error(`Browser OAuth authorizer requires an authorization URL builder for ${providerId}`);
  }
  if (typeof exchangeCode !== "function" && typeof pollSession !== "function") {
    throw new Error(`Browser OAuth authorizer requires a code exchange or session poller for ${providerId}`);
  }
  if (typeof importCredentials !== "function") {
    throw new Error(`Browser OAuth authorizer requires an import callback for ${providerId}`);
  }
  if (!redirectUri && callbackPort === null && typeof pollSession !== "function") {
    throw new Error(`Browser OAuth authorizer requires redirectUri or callbackPort for ${providerId}`);
  }
  assertSafeCallbackHost(callbackHost ?? "localhost");
  if (redirectUri) {
    let parsedRedirectUri = null;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch {
      throw new Error(`Browser OAuth authorizer has an invalid redirectUri for ${providerId}`);
    }
    if (parsedRedirectUri.protocol === "http:" && !isLoopbackHostname2(parsedRedirectUri.hostname)) {
      throw new Error(
        `Browser OAuth redirectUri over plain http must use a loopback host for ${providerId}, got: ${parsedRedirectUri.hostname}`
      );
    }
  }
  const sessions = /* @__PURE__ */ new Map();
  async function closeServer(session) {
    if (!session.server) return;
    const server = session.server;
    session.server = null;
    await new Promise((resolve2) => {
      server.close(() => resolve2());
      server.closeAllConnections?.();
    }).catch(() => {
    });
  }
  async function cleanup(session) {
    if (session.timer) clearTimeout(session.timer);
    await closeServer(session);
  }
  function responseHtml(res, title, message, statusCode = 200) {
    res.statusCode = statusCode;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><p>${escapeHtml(message)}</p><p>\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u5E76\u8FD4\u56DE Dockyard DSH\u3002</p>`);
  }
  async function handleCallback(session, req, res) {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    if (requestUrl.pathname !== session.callbackPath) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code") ?? "";
    const state = requestUrl.searchParams.get("state") ?? "";
    if (state !== session.state) {
      session.status = "failed";
      session.diagnostic = "OAuth state \u6821\u9A8C\u5931\u8D25";
      responseHtml(res, "\u6388\u6743\u672A\u5B8C\u6210", "\u5B89\u5168\u6821\u9A8C\u5931\u8D25\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u5E76\u91CD\u65B0\u5F00\u59CB\u6388\u6743\u3002", 400);
      await cleanup(session);
      return;
    }
    if (error) {
      session.callback = { error, state };
      responseHtml(res, "\u6388\u6743\u672A\u5B8C\u6210", "\u5B98\u65B9\u6388\u6743\u88AB\u62D2\u7EDD\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u3002");
      return;
    }
    if (!code) {
      session.callback = { error: "\u6388\u6743\u56DE\u8C03\u6CA1\u6709\u8FD4\u56DE code", state };
      responseHtml(res, "\u6388\u6743\u672A\u5B8C\u6210", "\u56DE\u8C03\u7F3A\u5C11\u6388\u6743\u7801\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u3002");
      return;
    }
    session.callback = { code, state };
    responseHtml(res, "\u6388\u6743\u6210\u529F", "\u5DF2\u6536\u5230\u6388\u6743\u56DE\u8C03\uFF0C\u6B63\u5728\u8FD4\u56DE Dockyard DSH\u3002");
  }
  async function openCallbackServer(session) {
    if (session.callbackPort === null || session.callbackPort === void 0) return;
    const server = createServer((req, res) => {
      void handleCallback(session, req, res).catch((error) => {
        session.callback = { error: redactError(error) };
        res.statusCode = 500;
        res.end("OAuth callback failed");
      });
    });
    session.server = server;
    await new Promise((resolve2, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve2();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen({ host: resolveLoopbackListenHost(callbackHost), port: session.callbackPort });
    });
    server.unref?.();
    const address = server.address();
    session.redirectUri = session.redirectUri ?? `http://${callbackHost}:${address.port}${callbackPath}`;
  }
  async function finalize(session, context = {}) {
    if (session.result) return session.result;
    if (session.cancelled || session.status === "cancelled") return publicSession(session);
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        const callback = session.callback;
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        if (!callback && !session.credentials) return publicSession(session);
        if (callback?.error) throw new Error(callback.error);
        const exchanged = session.credentials ?? await exchangeCode({
          code: callback.code,
          state: callback.state,
          codeVerifier: session.codeVerifier,
          redirectUri: session.redirectUri,
          context
        });
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        const accounts = await importCredentials(exchanged, context);
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          throw new Error("\u5B98\u65B9\u6388\u6743\u5B8C\u6210\uFF0C\u4F46 provider \u6CA1\u6709\u8FD4\u56DE\u53EF\u63A5\u5165\u7684\u8BA2\u9605\u8D26\u53F7");
        }
        session.status = "completed";
        session.result = {
          ...publicSession(session),
          accounts,
          diagnostic: null
        };
        return session.result;
      } catch (error) {
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession(session);
      } finally {
        await cleanup(session);
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const pkce = createPkce();
    const session = {
      sessionId: `${providerId}:browser:${randomUUID2()}`,
      providerId,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      browserOpened,
      authorizationCodeRequired,
      callbackPath,
      callbackPort,
      redirectUri,
      state: base64Url(randomBytes(24)),
      codeVerifier: pkce.verifier,
      callback: null,
      server: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      await openCallbackServer(session);
      session.nonce = base64Url(randomBytes(24));
      const built = await authorizationUrlBuilder({
        state: session.state,
        codeChallenge: pkce.challenge,
        redirectUri: session.redirectUri,
        nonce: session.nonce
      });
      session.authorizationUrl = typeof built === "string" ? built : built?.url;
      session.metadata = typeof built === "object" ? built.metadata ?? null : null;
      if (!session.authorizationUrl) throw new Error("\u5B98\u65B9 OAuth \u6CA1\u6709\u8FD4\u56DE\u6388\u6743\u9875\u9762\u5730\u5740");
      session.timer = setTimeout(() => {
        if (session.status !== "pending") return;
        session.status = "failed";
        session.diagnostic = "\u5B98\u65B9 OAuth \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002";
        session.cancelled = true;
        void cleanup(session).finally(() => sessions.delete(session.sessionId));
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.status = "failed";
      session.diagnostic = `\u65E0\u6CD5\u542F\u52A8\u5B98\u65B9\u6D4F\u89C8\u5668\u6388\u6743\uFF1A${redactError(error)}`;
      await cleanup(session);
    }
    return publicSession(session);
  }
  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missingSession(sessionId, providerId, instructions);
    if (session.status === "failed" || session.status === "completed") {
      const result2 = session.result ?? publicSession(session);
      sessions.delete(sessionId);
      return result2;
    }
    if (!session.callback && typeof pollSession === "function") {
      try {
        const credentials = await pollSession({ metadata: session.metadata, context });
        if (credentials) session.credentials = credentials;
      } catch (error) {
        session.diagnostic = redactError(error);
      }
    }
    if (!session.callback && !session.credentials) return publicSession(session);
    const result = await finalize(session, context);
    if (!["pending", "processing"].includes(result.status)) sessions.delete(sessionId);
    return result;
  }
  async function submitAuthorizationCode(sessionId, input, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missingSession(sessionId, providerId, instructions);
    const parsed = extractCodeInput(input);
    if (String(input ?? "").length > 8192) {
      session.diagnostic = "\u6388\u6743\u56DE\u8C03\u8F93\u5165\u8FC7\u957F\uFF0C\u8BF7\u7C98\u8D34\u5B98\u65B9\u8FD4\u56DE\u7684\u5B8C\u6574\u56DE\u8C03\u5730\u5740\u3002";
      return publicSession(session);
    }
    if (parsed.state !== session.state) {
      session.status = "failed";
      session.diagnostic = "OAuth state \u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u63D0\u4EA4\u5F53\u524D\u4F1A\u8BDD\u8FD4\u56DE\u7684\u56DE\u8C03\u5730\u5740\u3002";
      await cleanup(session);
      return publicSession(session);
    } else if (parsed.error) {
      session.callback = { error: parsed.error, state: parsed.state };
    } else if (!parsed.code) {
      session.diagnostic = "\u8BF7\u7C98\u8D34\u5305\u542B state \u7684\u5B8C\u6574\u56DE\u8C03\u5730\u5740\uFF0C\u6216\u4F7F\u7528 code#state \u683C\u5F0F\u3002";
      return publicSession(session);
    } else {
      session.callback = { code: parsed.code, state: parsed.state };
    }
    return finalize(session, context);
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    session.cancelled = true;
    session.status = "cancelled";
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, submitAuthorizationCode, cancel });
}
var browserOAuthAuthorizerConstants = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  defaultCallbackPath: DEFAULT_CALLBACK_PATH
});

// packages/oauth/src/cli-oauth-authorizer.mjs
import { randomUUID as randomUUID3 } from "node:crypto";
import { mkdir as mkdir2, mkdtemp, readFile as readFile3, rm as rm2 } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join3 } from "node:path";
import { spawn as spawn2 } from "node:child_process";

// packages/oauth/src/cli-url-sanitizer.mjs
var URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
var SENSITIVE_URL_QUERY_PARAMS = /* @__PURE__ */ new Set([
  "code",
  "error",
  "error_description",
  "error_uri",
  "error_code",
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "identy_token",
  "session_token",
  "sessiontoken",
  "secret",
  "jwt",
  "authcode",
  "authorization_code"
]);
function stripAnsiAndControl(value) {
  return String(value ?? "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\u0000-\u001f\u007f].*$/, "");
}
function trimTrailingPunctuation(value) {
  return value.replace(/[),.;]+$/, "");
}
function isLoopbackHostname3(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}
function carriesResponseParameters(url) {
  const scopes = [url.search];
  if (url.hash && url.hash.length > 1) scopes.push(url.hash.slice(1));
  for (const scope of scopes) {
    if (!scope) continue;
    for (const [key] of new URLSearchParams(scope)) {
      if (SENSITIVE_URL_QUERY_PARAMS.has(key.toLowerCase())) return true;
    }
  }
  return false;
}
function extractSafeAuthorizationUrl(text3) {
  const match = String(text3 ?? "").match(URL_PATTERN);
  if (!match?.[0]) return null;
  const raw = trimTrailingPunctuation(stripAnsiAndControl(match[0]));
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHostname3(url.hostname))) {
    return null;
  }
  if (carriesResponseParameters(url)) return null;
  if (url.hash) url.hash = "";
  return url.toString();
}

// packages/oauth/src/cli-oauth-authorizer.mjs
var DEFAULT_TIMEOUT_MS2 = 10 * 60 * 1e3;
var CHILD_STOP_GRACE_MS = 2e3;
function publicSession2(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {}
  };
}
function stopChild(session) {
  const child = session.child;
  if (!child || session.exitCode !== null) return Promise.resolve();
  return new Promise((resolve2) => {
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (session.exitCode === null) session.exitCode = -1;
      resolve2();
    };
    child.once("close", finish);
    if (session.exitCode !== null) {
      finish();
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
      }
      finish();
    }, CHILD_STOP_GRACE_MS);
    timer.unref?.();
  });
}
function createCliOAuthAuthorizer({
  providerId,
  cliPath,
  loginArgs,
  environmentKey,
  authFileName = "auth.json",
  environment = process.env,
  profilePrefix = `dockyard-${providerId ?? "provider"}-oauth-`,
  instructions = "\u8BF7\u5728\u5B98\u65B9\u6388\u6743\u9875\u9762\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
  timeoutMs = DEFAULT_TIMEOUT_MS2,
  importCredentials,
  profileDirectory = null,
  browserOpened = false
} = {}) {
  if (!providerId) throw new Error("CLI OAuth authorizer requires providerId");
  if (!cliPath) throw new Error(`CLI OAuth authorizer requires a ${providerId} CLI path`);
  if (!Array.isArray(loginArgs) || loginArgs.length === 0) {
    throw new Error(`CLI OAuth authorizer requires login arguments for ${providerId}`);
  }
  if (!environmentKey) throw new Error(`CLI OAuth authorizer requires an environment key for ${providerId}`);
  if (typeof importCredentials !== "function") {
    throw new Error(`CLI OAuth authorizer requires an import callback for ${providerId}`);
  }
  const sessions = /* @__PURE__ */ new Map();
  async function cleanup(session) {
    if (session.cleanupProfile && session.profileDir) {
      await rm2(session.profileDir, { recursive: true, force: true }).catch(() => {
      });
      session.profileDir = null;
    }
  }
  function captureOutput(session, chunk) {
    const text3 = String(chunk ?? "");
    session.output = `${session.output}${text3}`.slice(-32e3);
    if (!session.authorizationUrl) {
      session.authorizationUrl = extractSafeAuthorizationUrl(session.output);
    }
  }
  async function finalize(session, context) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        if (session.timedOut) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9 OAuth \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002";
          return publicSession2(session);
        }
        if (session.launchError) {
          session.status = "failed";
          session.diagnostic = `\u65E0\u6CD5\u542F\u52A8\u5B98\u65B9\u767B\u5F55\u547D\u4EE4\uFF1A${session.launchError}`;
          return publicSession2(session);
        }
        if (session.exitCode !== 0) {
          session.status = "failed";
          session.diagnostic = `\u5B98\u65B9 OAuth \u767B\u5F55\u672A\u5B8C\u6210\uFF08\u9000\u51FA\u7801 ${session.exitCode ?? "unknown"}\uFF09\u3002`;
          return publicSession2(session);
        }
        let raw;
        try {
          raw = JSON.parse(await readFile3(join3(session.profileDir, authFileName), "utf8"));
        } catch (error) {
          session.status = "failed";
          session.diagnostic = `\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\uFF0C\u4F46\u6CA1\u6709\u627E\u5230\u53EF\u8BFB\u53D6\u7684 OAuth \u72B6\u6001\uFF1A${redactError(error)}`;
          return publicSession2(session);
        }
        const accounts = await importCredentials(raw, context);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\uFF0C\u4F46 provider \u6CA1\u6709\u8FD4\u56DE\u53EF\u63A5\u5165\u7684\u8D26\u53F7\u3002";
          return publicSession2(session);
        }
        session.status = "completed";
        session.result = {
          ...publicSession2(session),
          accounts,
          diagnostic: null
        };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession2(session);
      } finally {
        await cleanup(session);
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const cleanupProfile = !profileDirectory;
    const profileDir = profileDirectory ?? await mkdtemp(join3(tmpdir(), profilePrefix));
    if (!cleanupProfile) await mkdir2(profileDir, { recursive: true });
    const session = {
      sessionId: `${providerId}:${randomUUID3()}`,
      providerId,
      profileDir,
      cleanupProfile,
      browserOpened,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exitCode: null,
      launchError: null,
      output: "",
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      const child = spawn2(cliPath, loginArgs, {
        env: { ...environment, [environmentKey]: profileDir },
        stdio: ["ignore", "pipe", "pipe"]
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => captureOutput(session, chunk));
      child.stderr?.on("data", (chunk) => captureOutput(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        void stopChild(session);
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicSession2(session);
  }
  async function poll(sessionId, context) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId,
        status: "missing",
        instructions,
        diagnostic: "OAuth \u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
      };
    }
    if (session.exitCode === null) return publicSession2(session);
    if (session.timer) clearTimeout(session.timer);
    const result = await finalize(session, context);
    if (result.status !== "pending" && result.status !== "processing") sessions.delete(sessionId);
    return result;
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    await stopChild(session);
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, cancel });
}
var cliOAuthAuthorizerConstants = Object.freeze({ defaultTimeoutMs: DEFAULT_TIMEOUT_MS2 });

// packages/providers/src/session-source.mjs
var OFFICIAL_SESSION_AUTH_KIND = "official_session";
var LEGACY_OFFICIAL_SESSION_AUTH_KINDS = Object.freeze(["official_cli_session"]);
var OFFICIAL_SESSION_SOURCE_KINDS = Object.freeze({
  CLI: "cli",
  DESKTOP_APP: "desktop_app",
  BROWSER: "browser",
  OAUTH_FILE: "oauth_file",
  OTHER: "other"
});
function isOfficialSessionAuthKind(value) {
  const kind = typeof value === "string" ? value : value?.kind;
  return kind === OFFICIAL_SESSION_AUTH_KIND || LEGACY_OFFICIAL_SESSION_AUTH_KINDS.includes(kind);
}
function normalizeOfficialSessionResult(value, {
  source = "official_session",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.OTHER
} = {}) {
  if (value === null || value === void 0) return null;
  if (typeof value === "string") return { output: value, source, sourceKind };
  if (typeof value !== "object") return null;
  let payload = typeof value.output === "string" ? value.output : "";
  if (!payload) {
    try {
      payload = JSON.stringify(value.status ?? value);
    } catch {
      payload = "";
    }
  }
  return {
    ...value,
    output: payload,
    source: value.source ?? source,
    sourceKind: value.sourceKind ?? sourceKind
  };
}
function officialSessionResources({
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.OTHER,
  authSource = null,
  extra = {}
} = {}) {
  return {
    accountScope: "active_official_session",
    sessionSource: sourceKind,
    ...authSource ? { authSource } : {},
    ...extra
  };
}

// modules/provider-codex/src/driver.mjs
var PROVIDER_ID = "openai-codex";
var AUTH_BASE_URL = "https://auth.openai.com";
var DEFAULT_AUTHORIZATION_URL = `${AUTH_BASE_URL}/oauth/authorize`;
var DEFAULT_TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
var DEFAULT_REDIRECT_URI = "http://localhost:1455/auth/callback";
var DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
var DEFAULT_CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";
var DEFAULT_CODEX_CLIENT_VERSION = "0.163.0";
var DEFAULT_CODEX_CATALOG_TTL_MS = 6e4;
var DEFAULT_USAGE_URLS = Object.freeze([
  "https://chatgpt.com/backend-api/wham/usage",
  "https://chatgpt.com/backend-api/codex/usage"
]);
var DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
var CREDENTIAL_SLOT = Symbol("dockyard-codex-credential");
function hash(value) {
  return createHash3("sha256").update(String(value)).digest("hex");
}
function codexHomePath({ env = process.env, home = homedir2(), codexHome, authFilePath } = {}) {
  if (codexHome) return codexHome;
  if (authFilePath) return dirname3(authFilePath);
  return env.CODEX_HOME || join4(home, ".codex");
}
function codexAuthPath({ env = process.env, home = homedir2(), authFilePath, codexHome } = {}) {
  if (authFilePath) return authFilePath;
  const baseHome = codexHomePath({ env, home, codexHome, authFilePath });
  return join4(baseHome, "auth.json");
}
function profileClaims(payload) {
  return payload?.["https://api.openai.com/profile"] ?? payload?.profile ?? {};
}
function authClaims(payload) {
  return payload?.["https://api.openai.com/auth"] ?? payload?.auth ?? {};
}
function normalizeTokens(raw) {
  const tokens = raw?.tokens ?? raw ?? {};
  const access2 = tokens.access_token ?? tokens.access;
  const refresh = tokens.refresh_token ?? tokens.refresh;
  const idToken = tokens.id_token ?? tokens.idToken ?? null;
  if (typeof access2 !== "string" || typeof refresh !== "string") return null;
  const accessPayload = decodeJwtPayload(access2) ?? {};
  const idPayload = decodeJwtPayload(idToken) ?? {};
  const auth = authClaims(accessPayload);
  const idAuth = authClaims(idPayload);
  const accountId = stringValue(
    tokens.account_id ?? tokens.accountId ?? auth.chatgpt_account_id ?? idAuth.chatgpt_account_id
  );
  if (!accountId) return null;
  const profile = { ...profileClaims(idPayload), ...profileClaims(accessPayload) };
  const expiresAt = isoFromEpoch(accessPayload.exp ?? idPayload.exp);
  return {
    access: access2,
    refresh,
    idToken,
    accountId,
    email: stringValue(tokens.email ?? profile.email),
    displayName: stringValue(tokens.name ?? profile.name),
    plan: stringValue(
      tokens.plan_type ?? auth.chatgpt_plan_type ?? idAuth.chatgpt_plan_type
    ),
    scopes: Array.isArray(tokens.scopes) ? tokens.scopes.map(String) : [],
    expiresAt,
    authFileLastRefresh: stringValue(raw?.last_refresh),
    accessPayload,
    idPayload
  };
}
function accountInput(tokens, credentialRef, now = /* @__PURE__ */ new Date(), { source = "official_codex_oauth" } = {}) {
  return {
    providerId: PROVIDER_ID,
    accountId: tokens.accountId,
    credentialRef,
    displayName: tokens.displayName,
    email: tokens.email,
    auth: {
      kind: "oauth",
      credentialRef,
      scopes: tokens.scopes
    },
    subscription: {
      plan: tokens.plan,
      status: null,
      expiresAt: null
    },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.authFileLastRefresh ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    resources: {
      sessionSource: source.includes("browser") ? OFFICIAL_SESSION_SOURCE_KINDS.BROWSER : OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE,
      authSource: source
    }
  };
}
function attachCredential(candidate2, tokens) {
  Object.defineProperty(candidate2, CREDENTIAL_SLOT, {
    value: tokens,
    enumerable: false,
    configurable: false
  });
  return candidate2;
}
function summarizeCodexCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function candidateFromTokens(tokens, { source, imported = false, now = /* @__PURE__ */ new Date() } = {}) {
  const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
  return attachCredential({
    candidateId: `codex:${hash(tokens.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId: tokens.accountId,
    displayName: tokens.displayName ?? tokens.email ?? tokens.accountId,
    email: tokens.email,
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.authFileLastRefresh ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    credentialRef,
    imported,
    status: "available"
  }, tokens);
}
function isExpiring(tokens, now, leewaySeconds) {
  if (!tokens.expiresAt) return true;
  return new Date(tokens.expiresAt).getTime() <= now.getTime() + leewaySeconds * 1e3;
}
function reasoningFromThinkingLevelMap(thinkingLevelMap) {
  if (!thinkingLevelMap || typeof thinkingLevelMap !== "object") return void 0;
  const efforts = Object.entries(thinkingLevelMap).filter(([id, providerValue]) => id !== "off" && typeof providerValue === "string" && providerValue.length > 0).map(([id, providerValue]) => ({
    id,
    name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    ...providerValue === id ? {} : { description: `provider value: ${providerValue}` }
  }));
  return efforts.length > 0 ? { efforts } : void 0;
}
function parseCodexReasoning(model) {
  if (Array.isArray(model?.supported_reasoning_levels) && model.supported_reasoning_levels.length > 0) {
    const efforts = model.supported_reasoning_levels.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl.effort;
      const name2 = id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
      const description = typeof lvl?.description === "string" ? lvl.description : void 0;
      return {
        id,
        name: name2,
        ...description ? { description } : {}
      };
    });
    const defaultEffort = typeof model.default_reasoning_level === "string" ? model.default_reasoning_level : void 0;
    return {
      efforts,
      ...defaultEffort && efforts.some((effort) => effort.id === defaultEffort) ? { defaultEffort } : {}
    };
  }
  return reasoningFromThinkingLevelMap(model?.thinkingLevelMap);
}
function codexModelToDshCatalog(model) {
  const id = model.slug ?? model.id;
  const name2 = model.display_name ?? model.name ?? id;
  const reasoning = parseCodexReasoning(model);
  const input = Array.isArray(model.input_modalities) ? model.input_modalities : Array.isArray(model.input) ? model.input : void 0;
  const contextWindow = Number.isInteger(model.context_window) ? model.context_window : Number.isInteger(model.contextWindow) ? model.contextWindow : void 0;
  const maxTokens = Number.isInteger(model.max_output_tokens) ? Math.min(model.max_output_tokens, 16384) : Number.isInteger(model.maxTokens) ? Math.min(model.maxTokens, 16384) : 8192;
  return {
    id,
    name: name2,
    ...input ? { inputModalities: [...input] } : {},
    ...contextWindow ? { contextWindow } : {},
    ...maxTokens ? { maxTokens } : {},
    ...reasoning ? { reasoning } : {}
  };
}
function parseCodexModelCatalog(raw) {
  const modelsList = Array.isArray(raw?.models) ? raw.models : Array.isArray(raw) ? raw : [];
  if (modelsList.length === 0) return [];
  const visible = modelsList.filter((m) => m?.visibility !== "hide");
  const candidates = visible.length > 0 ? visible : modelsList;
  const sorted = [...candidates].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  return sorted.map(codexModelToDshCatalog);
}
function createCodexCatalogLoader({
  env = process.env,
  home = homedir2(),
  codexHome,
  authFilePath,
  modelsCachePath,
  modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_CODEX_MODELS_URL,
  clientVersion = env.DOCKYARD_CODEX_CLIENT_VERSION || DEFAULT_CODEX_CLIENT_VERSION,
  fetchImpl = fetch,
  cacheTtlMs = Number(process.env.DOCKYARD_CODEX_CATALOG_TTL_MS) || DEFAULT_CODEX_CATALOG_TTL_MS,
  fallbackLoader = null
} = {}) {
  const resolvedHome = codexHomePath({ env, home, codexHome, authFilePath });
  const resolvedAuthPath = codexAuthPath({ env, home, authFilePath, codexHome: resolvedHome });
  const resolvedCachePath = modelsCachePath || join4(resolvedHome, "models_cache.json");
  let cached = null;
  let cachedAt = 0;
  let pending = null;
  return async function loadCatalog({ force = false, credential = null, signal = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;
    pending = (async () => {
      let discoveredModels = [];
      let source = "official_codex_models_api";
      let liveToken = credential?.access ?? null;
      let liveAccountId = credential?.accountId ?? null;
      if (!liveToken) {
        try {
          const authRaw = await readJsonFile(resolvedAuthPath);
          if (authRaw) {
            const tokens = normalizeTokens(authRaw);
            if (tokens?.access) {
              liveToken = tokens.access;
              liveAccountId = tokens.accountId;
            }
          }
        } catch {
        }
      }
      if (liveToken) {
        try {
          const url = new URL(modelsUrl);
          url.searchParams.set("client_version", clientVersion);
          const headers = {
            authorization: `Bearer ${liveToken}`,
            "user-agent": `Codex/${clientVersion}`,
            accept: "application/json"
          };
          if (liveAccountId) {
            headers["chatgpt-account-id"] = liveAccountId;
          }
          const res = await fetchImpl(url.href, {
            method: "GET",
            headers,
            ...signal ? { signal } : {}
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            discoveredModels = parseCodexModelCatalog(data);
            if (discoveredModels.length > 0) {
              source = "official_codex_models_api";
            }
          }
        } catch {
        }
      }
      if (discoveredModels.length === 0) {
        try {
          const cacheData = await readJsonFile(resolvedCachePath);
          if (cacheData) {
            discoveredModels = parseCodexModelCatalog(cacheData);
            if (discoveredModels.length > 0) {
              source = "official_codex_models_cache";
            }
          }
        } catch {
        }
      }
      if (discoveredModels.length === 0 && typeof fallbackLoader === "function") {
        try {
          const fallback = await fallbackLoader();
          if (Array.isArray(fallback?.models) && fallback.models.length > 0) {
            discoveredModels = fallback.models;
            source = fallback.source ?? "dsh_pi_ai_provider_catalog";
          }
        } catch {
        }
      }
      const result = {
        models: discoveredModels,
        source
      };
      if (discoveredModels.length > 0) {
        cached = result;
        cachedAt = Date.now();
      }
      return result;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
var CodexOAuthDriver = class {
  constructor({
    authFilePath,
    codexHome,
    modelsCachePath,
    env = process.env,
    home = homedir2(),
    tokenUrl = env.DOCKYARD_CODEX_TOKEN_URL || DEFAULT_TOKEN_URL,
    usageUrls = env.DOCKYARD_CODEX_USAGE_URL ? [env.DOCKYARD_CODEX_USAGE_URL] : [...DEFAULT_USAGE_URLS],
    modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_CODEX_MODELS_URL,
    clientVersion = env.DOCKYARD_CODEX_CLIENT_VERSION || DEFAULT_CODEX_CLIENT_VERSION,
    clientId = env.DOCKYARD_CODEX_CLIENT_ID || DEFAULT_CLIENT_ID,
    fetchImpl = fetch,
    requestExecutor = null,
    catalogLoader = null,
    refreshLeewaySeconds = 60,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CODEX_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_CODEX_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL,
    redirectUri = env.DOCKYARD_CODEX_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    browserCallbackPort = Number(env.DOCKYARD_CODEX_CALLBACK_PORT || 1455),
    cliPath = env.DOCKYARD_CODEX_CLI || "codex"
  } = {}) {
    this.authFilePath = codexAuthPath({ env, home, authFilePath, codexHome });
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CODEX_TOKEN_URL");
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CODEX_AUTHORIZATION_URL");
    this.usageUrls = usageUrls.map((url) => assertSecureEndpointUrl(url, "DOCKYARD_CODEX_USAGE_URL"));
    this.clientId = clientId;
    this.fetchImpl = fetchImpl;
    this.requestExecutor = requestExecutor;
    this.catalogLoader = catalogLoader ?? createCodexCatalogLoader({
      env,
      home,
      codexHome,
      authFilePath: this.authFilePath,
      modelsCachePath,
      modelsUrl,
      clientVersion,
      fetchImpl
    });
    this.refreshLeewaySeconds = refreshLeewaySeconds;
    this.cliAuthorizer = createCliOAuthAuthorizer({
      providerId: PROVIDER_ID,
      cliPath,
      loginArgs: ["login", "--device-auth"],
      environmentKey: "CODEX_HOME",
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Codex CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728\u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importCredentials: (raw, context) => this.#importOAuthState(raw, context)
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID,
      redirectUri,
      callbackPath: new URL(redirectUri).pathname,
      callbackHost: "localhost",
      callbackPort: browserCallbackPort,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Codex \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri: callback }) => {
        const url = new URL(authorizationUrl);
        url.search = new URLSearchParams({
          client_id: clientId,
          response_type: "code",
          redirect_uri: callback,
          scope: "openid email profile offline_access",
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          prompt: "login",
          id_token_add_organizations: "true",
          codex_cli_simplified_flow: "true"
        });
        return url.toString();
      },
      exchangeCode: async ({ code, codeVerifier, redirectUri: callback, context }) => {
        const response = await fetchJson(this.tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            redirect_uri: callback,
            code_verifier: codeVerifier
          }),
          ...context.signal ? { signal: context.signal } : {}
        }, { fetchImpl: this.fetchImpl });
        return response.body ?? {};
      },
      importCredentials: (raw, context) => this.#importOAuthState(raw, context, "official_codex_browser_oauth")
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const raw = await readJsonFile(this.authFilePath);
    if (!raw) {
      return {
        candidates: [],
        source: this.authFilePath,
        diagnostics: [`\u672A\u53D1\u73B0 Codex OAuth \u6587\u4EF6\uFF1A${this.authFilePath}`]
      };
    }
    const tokens = normalizeTokens(raw);
    if (!tokens) {
      return {
        candidates: [],
        source: this.authFilePath,
        diagnostics: ["Codex OAuth \u6587\u4EF6\u5B58\u5728\uFF0C\u4F46\u5B57\u6BB5\u4E0D\u5B8C\u6574\u6216\u65E0\u6CD5\u89E3\u6790\u8D26\u53F7\u8EAB\u4EFD"]
      };
    }
    const candidate2 = candidateFromTokens(tokens, { source: this.authFilePath, now });
    return {
      candidates: [candidate2],
      source: this.authFilePath,
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const tokens = candidate2?.[CREDENTIAL_SLOT];
    if (!tokens) throw new Error("Codex candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
    await context.secretStore.write(credentialRef, {
      type: "oauth",
      providerId: PROVIDER_ID,
      access: tokens.access,
      refresh: tokens.refresh,
      idToken: tokens.idToken,
      accountId: tokens.accountId,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes
    });
    return accountInput(tokens, credentialRef, context.now instanceof Date ? context.now : /* @__PURE__ */ new Date(), {
      source: candidate2.source
    });
  }
  async importSource(source, context = {}) {
    let raw;
    try {
      raw = typeof source?.content === "string" ? JSON.parse(source.content) : source?.content;
    } catch {
      throw new Error("Codex OAuth source is not valid JSON");
    }
    return this.#importOAuthState(raw, context, source?.fileName || "user_selected_oauth.json");
  }
  async #importOAuthState(raw, context = {}, source = "official_codex_oauth") {
    const tokens = normalizeTokens(raw);
    if (!tokens) throw new Error("Codex OAuth state does not contain a complete account token set");
    const candidate2 = candidateFromTokens(tokens, {
      source,
      now: context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()
    });
    return [await this.importAccount(candidate2, context)];
  }
  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      if (!discovered.candidates?.length) return null;
      const accounts = [];
      for (const candidate2 of discovered.candidates) {
        accounts.push(await this.importAccount(candidate2, context));
      }
      return {
        status: "completed",
        providerId: PROVIDER_ID,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Codex \u5B98\u65B9 OAuth \u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts,
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("\u5F53\u524D Codex \u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u624B\u52A8\u6388\u6743\u7801");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async #readCredential(account, context) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const stored = await context.secretStore.read(credentialRef);
    if (!stored?.access || !stored?.refresh) {
      const error = new Error("Codex credential is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    return {
      ...stored,
      accountId: stored.accountId ?? account.accountId,
      expiresAt: stored.expiresAt ?? account.refresh.accessTokenExpiresAt
    };
  }
  async #refreshCredential(credential, context) {
    const response = await fetchJson(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: this.clientId
      }),
      ...context.signal ? { signal: context.signal } : {}
    }, { fetchImpl: this.fetchImpl });
    const body = response.body ?? {};
    if (!body.access_token || !Number.isFinite(Number(body.expires_in))) {
      throw new Error("Codex OAuth refresh response is incomplete");
    }
    if (body.refresh_token !== void 0 && body.refresh_token !== null && typeof body.refresh_token !== "string") {
      throw new Error("Codex OAuth refresh response returned an invalid refresh token");
    }
    const payload = decodeJwtPayload(body.access_token) ?? {};
    const auth = authClaims(payload);
    const accountId = stringValue(auth.chatgpt_account_id) ?? credential.accountId;
    return {
      ...credential,
      type: "oauth",
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      idToken: body.id_token ?? credential.idToken ?? null,
      accountId,
      expiresAt: addSecondsIso(body.expires_in, context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()),
      lastRefreshedAt: (context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()).toISOString()
    };
  }
  async #liveCredential(account, context = {}, { force = false } = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    let credential = await this.#readCredential(account, context);
    if (credential.refresh && (force || isExpiring(credential, now, this.refreshLeewaySeconds))) {
      try {
        credential = await this.#refreshCredential(credential, context);
        await context.secretStore.write(account.auth?.credentialRef ?? account.credentialRef, credential);
      } catch (error) {
        const wrapped = new Error(`Codex OAuth refresh failed: ${redactError(error)}`);
        wrapped.authForbidden = error?.status === 403;
        wrapped.authExpired = error?.status === 401 || error?.status === 400 && ["invalid_grant", "invalid_token"].includes(String(error?.upstreamCode ?? "").toLowerCase());
        throw wrapped;
      }
    }
    return credential;
  }
  async refreshAccount(account, context = {}) {
    const credential = await this.#liveCredential(account, context, { force: Boolean(context.force) });
    return {
      refresh: {
        accessTokenExpiresAt: credential.expiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: credential.lastRefreshedAt ?? account.refresh.lastRefreshedAt,
        refreshable: Boolean(credential.refresh)
      }
    };
  }
  async getQuota(account, context = {}) {
    const credential = await this.#liveCredential(account, context);
    let lastError = null;
    let sawAuthExpired = false;
    let sawAuthForbidden = false;
    for (const url of this.usageUrls) {
      try {
        const response = await fetchJson(url, {
          headers: {
            authorization: `Bearer ${credential.access}`,
            "chatgpt-account-id": credential.accountId ?? account.accountId
          },
          ...context.signal ? { signal: context.signal } : {}
        }, { fetchImpl: this.fetchImpl });
        const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
        const windows = recursiveQuotaWindows(response.body, {
          source: "codex_usage",
          now,
          prefix: "rate_limit"
        });
        const primary = selectPrimaryQuotaWindow(windows);
        return {
          quota: {
            ...primary,
            windows,
            updatedAt: now.toISOString(),
            source: "codex_usage"
          },
          subscription: {
            plan: stringValue(response.body?.plan_type),
            status: stringValue(response.body?.subscription_status),
            expiresAt: null
          },
          identity: {
            accountId: stringValue(response.body?.account_id) ?? account.accountId,
            email: stringValue(response.body?.email) ?? account.email
          },
          refresh: {
            accessTokenExpiresAt: credential.expiresAt ?? account.refresh.accessTokenExpiresAt,
            lastRefreshedAt: credential.lastRefreshedAt ?? account.refresh.lastRefreshedAt,
            refreshable: Boolean(credential.refresh)
          }
        };
      } catch (error) {
        lastError = error;
        sawAuthExpired ||= error?.status === 401;
        sawAuthForbidden ||= error?.status === 403;
      }
    }
    const wrapped = new Error(sawAuthExpired ? "Codex OAuth credential rejected (401); reauthorization required" : `Codex quota request failed: ${redactError(lastError)}`);
    wrapped.rateLimited = lastError?.status === 429;
    wrapped.authExpired = sawAuthExpired;
    wrapped.authForbidden = !sawAuthExpired && sawAuthForbidden;
    throw wrapped;
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.accounts?.[0] && context.secretStore) {
      try {
        credential = await this.#liveCredential(context.accounts[0], context);
      } catch {
      }
    }
    if (this.catalogLoader) {
      try {
        const catalog = await this.catalogLoader({
          force: Boolean(context.force),
          credential,
          accounts: context.accounts
        });
        if (Array.isArray(catalog?.models) && catalog.models.length > 0) return catalog;
      } catch {
      }
    }
    return {
      models: [],
      source: "no_live_catalog_endpoint",
      diagnostic: "Codex model identifiers are accepted from the active DSH configuration; this module does not invent a model list."
    };
  }
  async invoke(request, invocation, context = {}) {
    const credential = await this.#liveCredential(invocation.account, context);
    const executor = context.requestExecutor ?? this.requestExecutor ?? nativeCodexExecutor;
    return executor({ request, invocation, credential, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createCodexPiAiExecutor({
  PiAiAdapter,
  createProvider,
  openAICodexResponsesApi,
  modelResolver = null
}) {
  if (!PiAiAdapter || !createProvider || !openAICodexResponsesApi) {
    throw new Error("Codex DSH transport dependencies are incomplete");
  }
  return async function executeCodex({ request, credential, context = {} }) {
    const modelId = String(request.model);
    const requestedEffort = typeof request.reasoningEffort === "string" ? request.reasoningEffort : void 0;
    const catalogModel2 = typeof modelResolver === "function" ? modelResolver(modelId) : null;
    const contextWindow = Number.isInteger(catalogModel2?.contextWindow) && catalogModel2.contextWindow > 0 ? catalogModel2.contextWindow : 272e3;
    const maxTokens = Number.isInteger(catalogModel2?.maxTokens) && catalogModel2.maxTokens > 0 ? Math.min(catalogModel2.maxTokens, 16384) : 16384;
    const thinkingLevelMap = catalogModel2?.thinkingLevelMap ?? {
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
      ultra: "ultra"
    };
    const model = {
      id: modelId,
      name: typeof catalogModel2?.name === "string" && catalogModel2.name.length > 0 ? catalogModel2.name : modelId,
      api: "openai-codex-responses",
      provider: PROVIDER_ID,
      baseUrl: DEFAULT_CODEX_BASE_URL,
      reasoning: typeof catalogModel2?.reasoning === "boolean" ? catalogModel2.reasoning : requestedEffort !== void 0,
      ...thinkingLevelMap ? { thinkingLevelMap: { ...thinkingLevelMap } } : {},
      input: Array.isArray(catalogModel2?.input) && catalogModel2.input.length > 0 ? [...catalogModel2.input] : Array.isArray(catalogModel2?.inputModalities) && catalogModel2.inputModalities.length > 0 ? [...catalogModel2.inputModalities] : ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow,
      maxTokens
    };
    const provider = createProvider({
      id: PROVIDER_ID,
      name: "OpenAI Codex",
      baseUrl: DEFAULT_CODEX_BASE_URL,
      auth: {
        apiKey: {
          name: "Dockyard DSH OAuth",
          resolve: ({ credential: supplied }) => ({
            auth: { apiKey: supplied?.key },
            source: "Dockyard DSH OAuth"
          })
        }
      },
      models: [model],
      api: openAICodexResponsesApi()
    });
    const profile = {
      provider: PROVIDER_ID,
      displayName: "OpenAI Codex",
      piProvider: provider,
      modelErrors: /* @__PURE__ */ new Map(),
      configuredMaxTokens: /* @__PURE__ */ new Map(),
      streamIdleTimeoutMs: 3e5
    };
    const adapter = new PiAiAdapter({
      profiles: () => /* @__PURE__ */ new Map([[PROVIDER_ID, profile]]),
      resolveApiKey: async () => credential.access,
      // DSH's durable attachment store is required for image input. Keep the
      // resolver lazy so text-only requests remain compatible with standalone
      // Codex driver callers and tests that do not mount attachments.
      resolveAttachments: () => context.attachments
    });
    return adapter.stream(request);
  };
}
async function nativeCodexExecutor(envelope2) {
  try {
    const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }] = await Promise.all([
      import("@deepseek-ai/dsh-llm-pi-ai"),
      import("@earendil-works/pi-ai"),
      import("@earendil-works/pi-ai/api/openai-codex-responses.lazy")
    ]);
    return createCodexPiAiExecutor({ PiAiAdapter, createProvider, openAICodexResponsesApi })(envelope2);
  } catch (error) {
    throw new Error(`Codex DSH transport dependencies are unavailable: ${redactError(error)}`);
  }
}
function createCodexDriver(options = {}) {
  return new CodexOAuthDriver(options);
}
var codexDriverConstants = Object.freeze({
  providerId: PROVIDER_ID,
  defaultUsageUrls: DEFAULT_USAGE_URLS,
  defaultBaseUrl: DEFAULT_CODEX_BASE_URL
});

// modules/provider-codex/src/index.mjs
function createCodexModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "openai-codex",
    displayName: "Codex",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-antigravity/src/driver.mjs
import { spawn as spawn4 } from "node:child_process";
import { createHash as createHash4, randomUUID as randomUUID4 } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir as mkdir3, mkdtemp as mkdtemp2, readFile as readFile4, rename as rename2, rm as rm3, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir4, tmpdir as tmpdir2 } from "node:os";
import { dirname as dirname4, join as join6 } from "node:path";

// packages/providers/src/cli-agent-transport.mjs
import { spawn as spawn3 } from "node:child_process";
var MAX_CLI_OUTPUT_BYTES = 4 * 1024 * 1024;
var PROCESS_GROUP_PLATFORM = process.platform !== "win32";
var KILL_GRACE_MS = 1e3;
function appendBounded(chunks, chunk, state) {
  const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ""));
  const remaining = MAX_CLI_OUTPUT_BYTES - state.total;
  if (remaining <= 0) return;
  const accepted = value.subarray(0, remaining);
  chunks.push(accepted);
  state.total += accepted.byteLength;
}
function boundedCliDetail(output, errorOutput) {
  return String(errorOutput || output || "").replace(/\s+/g, " ").trim().slice(0, 500);
}
function cliFailure(code, signal, output, errorOutput, providerId) {
  const error = new Error(`${providerId ?? "provider"} CLI failed (${signal ?? code})`);
  error.code = code;
  error.detail = String(errorOutput || output || "").replace(/\s+/g, " ").trim().slice(0, 500);
  return error;
}
function cliTimeoutError(providerId, output, errorOutput) {
  const error = new Error(`${providerId ?? "provider"} CLI request timed out`);
  error.code = "ETIMEDOUT";
  error.providerId = providerId ?? null;
  error.detail = boundedCliDetail(output, errorOutput);
  return error;
}
function cliAbortError(providerId, output, errorOutput) {
  const error = new Error(`${providerId ?? "provider"} CLI request aborted`);
  error.name = "AbortError";
  error.code = "ABORT_ERR";
  error.providerId = providerId ?? null;
  error.detail = boundedCliDetail(output, errorOutput);
  return error;
}
function killProcessTree(child, sig, { detached = PROCESS_GROUP_PLATFORM } = {}) {
  const pid = child?.pid;
  if (detached && Number.isFinite(pid)) {
    try {
      process.kill(-pid, sig);
    } catch (error) {
      if (error?.code !== "ESRCH") {
        try {
          child.kill(sig);
        } catch {
        }
      }
    }
  }
  try {
    child.kill(sig);
  } catch {
  }
}
function parseJsonOutput(output) {
  if (output && typeof output === "object") return output;
  try {
    return JSON.parse(String(output));
  } catch {
    for (const line of String(output ?? "").split(/\r?\n/).reverse()) {
      if (!line.trim()) continue;
      try {
        return JSON.parse(line);
      } catch {
      }
    }
    return null;
  }
}
function runCliCommand(command, args, {
  env = process.env,
  cwd,
  timeoutMs = 3e4,
  signal,
  providerId
} = {}) {
  return new Promise((resolve2, reject) => {
    const detached = PROCESS_GROUP_PLATFORM;
    const child = spawn3(command, args, {
      env,
      ...cwd ? { cwd } : {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached,
      ...signal ? { signal } : {}
    });
    const stdout = [];
    const stderr = [];
    const stdoutSize = { total: 0 };
    const stderrSize = { total: 0 };
    let timedOut = false;
    let abortRequested = Boolean(signal?.aborted);
    let settled = false;
    let terminationRequested = false;
    let forceTimer = null;
    let timer = null;
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      signal?.removeEventListener?.("abort", onAbort);
      settle(value);
    };
    const terminate = () => {
      if (terminationRequested) return;
      terminationRequested = true;
      killProcessTree(child, "SIGTERM", { detached });
      forceTimer = setTimeout(() => {
        killProcessTree(child, "SIGKILL", { detached });
      }, KILL_GRACE_MS);
      forceTimer.unref?.();
    };
    const onAbort = () => {
      abortRequested = true;
      terminate();
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on("data", (chunk) => appendBounded(stdout, chunk, stdoutSize));
    child.stderr.on("data", (chunk) => appendBounded(stderr, chunk, stderrSize));
    child.once("error", (error) => {
      if (error?.name === "AbortError" || abortRequested || signal?.aborted) {
        finish(reject, cliAbortError(
          providerId,
          Buffer.concat(stdout).toString("utf8"),
          Buffer.concat(stderr).toString("utf8")
        ));
        return;
      }
      finish(reject, error);
    });
    child.once("close", (code, closeSignal) => {
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8");
      if (timedOut) {
        finish(reject, cliTimeoutError(providerId, output, errorOutput));
        return;
      }
      if (abortRequested || signal?.aborted) {
        finish(reject, cliAbortError(providerId, output, errorOutput));
        return;
      }
      if (code === 0) {
        finish(resolve2, { output, errorOutput });
        return;
      }
      finish(reject, cliFailure(code, closeSignal, output, errorOutput, providerId));
    });
  });
}
var cliAgentTransportConstants = Object.freeze({
  defaultOutputFormat: "stream-json"
});

// modules/provider-antigravity/src/native-transport.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir as homedir3 } from "node:os";
import { join as join5 } from "node:path";
import { execFileSync } from "node:child_process";

// packages/providers/src/native-transport.mjs
function numericStatus(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function isLoopbackHostname4(hostname) {
  const normalized = String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
function validateNativeEndpoint(value, { providerId = "provider" } = {}) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${providerId} endpoint is required`);
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${providerId} endpoint is invalid`);
  }
  if (url.username || url.password) {
    throw new Error(`${providerId} endpoint must not include embedded credentials`);
  }
  if (url.hash) {
    throw new Error(`${providerId} endpoint must not include a URL fragment`);
  }
  const localHttp = url.protocol === "http:" && isLoopbackHostname4(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error(`${providerId} endpoint must use HTTPS; HTTP is only allowed for loopback development`);
  }
  return url.toString();
}
function diagnosticText(value) {
  if (typeof value === "string") return value;
  if (value === void 0 || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function errorDetails(value) {
  if (value === void 0 || value === null) return {};
  if (typeof value === "string") {
    const text3 = value.replace(/\s+/g, " ").trim();
    if (!text3) return {};
    try {
      return errorDetails(JSON.parse(value));
    } catch {
      return { message: text3 };
    }
  }
  if (typeof value !== "object") return { message: String(value) };
  const nested = value.error;
  const nestedObject = nested && typeof nested === "object" ? nested : null;
  const message = [
    nestedObject?.message,
    typeof nested === "string" ? nested : null,
    value.message,
    nestedObject?.status,
    value.status
  ].find((candidate2) => typeof candidate2 === "string" && candidate2.trim().length > 0);
  const code = [
    nestedObject?.code,
    value.code,
    nestedObject?.status,
    value.status
  ].find((candidate2) => candidate2 !== void 0 && candidate2 !== null && candidate2 !== "");
  const status = [nestedObject?.status, value.status].find((candidate2) => candidate2 !== void 0 && candidate2 !== null && candidate2 !== "");
  return {
    ...message ? { message: String(message).replace(/\s+/g, " ").trim().slice(0, 500) } : {},
    ...code !== void 0 ? { code } : {},
    ...status !== void 0 ? { status } : {}
  };
}
function boundedErrorBody(value, limit = 4096) {
  if (typeof value === "string") return value.slice(0, limit);
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= limit ? value : `${serialized.slice(0, limit)}\u2026`;
  } catch {
    return String(value ?? "").slice(0, limit);
  }
}
function isAuthenticationFailure(message, body, { status = null, code = null } = {}) {
  const text3 = `${diagnosticText(message)} ${diagnosticText(body)}`.toLowerCase().replace(/[_-]+/g, " ");
  if (/\b(?:token|tokens)\s+(?:count|limit|length|budget)\b|\b(?:max|input|output)_?tokens?\b/.test(text3)) return false;
  const normalizedCode = String(code ?? body?.error?.code ?? body?.code ?? "").toLowerCase();
  if (/invalid[_ -]?grant|invalid[_ -]?token|token[_ -]?expired|unauthorized|authentication[_ -]?failed/.test(normalizedCode)) return true;
  if (Number(status) === 401) return true;
  if (Number(status) === 403 && /(?:access token|oauth|credential|api key|authentication|unauthorized)/.test(text3)) return true;
  return [
    /access token.{0,80}(?:could not be validated|invalid|expired|revok|not valid|unauthor)/,
    /(?:invalid|expired|revok|unauthor|not valid).{0,80}(?:access token|oauth token|refresh token|credential|api key)/,
    /\b(?:unauthorized|authentication failed|login required)\b/,
    /\b(?:credentials?|api keys?)\b.{0,50}\b(?:invalid|expired|missing|unavailable|not valid)\b/
  ].some((pattern) => pattern.test(text3));
}
function nativeProviderError(providerId, message, { status, body, code } = {}) {
  const bodyDetails = errorDetails(body);
  const messageDetails = errorDetails(message);
  const resolvedMessage = messageDetails.message ?? bodyDetails.message ?? (message ? String(message) : null);
  const resolvedCode = code ?? messageDetails.code ?? bodyDetails.code;
  const upstreamStatus = messageDetails.status ?? bodyDetails.status;
  const statusCode = numericStatus(status);
  const codeText = String(upstreamStatus ?? resolvedCode ?? "").toUpperCase();
  const exhaustionText = `${resolvedMessage ?? ""} ${diagnosticText(body)} ${diagnosticText(upstreamStatus)} ${diagnosticText(resolvedCode)}`.toLowerCase();
  const quotaExhausted = codeText === "RESOURCE_EXHAUSTED" || /\bresources?\b[\s\S]{0,80}\bexhausted\b/.test(exhaustionText) || /\bquota\b[\s\S]{0,80}\b(?:exhausted|depleted|exceeded)\b/.test(exhaustionText) || /\busage limit\b[\s\S]{0,80}\breached\b/.test(exhaustionText) || /\bfree[\s\S]{0,40}limit reached\b/.test(exhaustionText) || /\bcapacity\b[\s\S]{0,80}\bexhausted\b/.test(exhaustionText);
  const rateLimited = statusCode === 429 || numericStatus(resolvedCode) === 429 || numericStatus(upstreamStatus) === 429 || codeText === "RESOURCE_EXHAUSTED" || codeText === "RATE_LIMITED" || quotaExhausted;
  const displayMessage = quotaExhausted ? "\u989D\u5EA6\u6216\u4E0A\u6E38\u8D44\u6E90\u5DF2\u8017\u5C3D\uFF0C\u8BF7\u5237\u65B0\u989D\u5EA6\u3001\u5207\u6362\u8D26\u53F7\u6216\u7A0D\u540E\u91CD\u8BD5" : rateLimited ? "\u8BF7\u6C42\u9891\u7387\u53D7\u9650\uFF0C\u8BF7\u5207\u6362\u8D26\u53F7\u6216\u7A0D\u540E\u91CD\u8BD5" : resolvedMessage;
  const error = new Error(`${providerId ?? "provider"} native request failed${displayMessage ? `: ${displayMessage}` : ""}`);
  error.providerId = providerId ?? null;
  if (status !== void 0 && status !== null) error.status = status;
  if (resolvedCode !== void 0 && resolvedCode !== null) {
    error.code = resolvedCode;
    error.upstreamCode = resolvedCode;
  }
  if (resolvedMessage) error.upstreamMessage = resolvedMessage;
  if (upstreamStatus !== void 0 && upstreamStatus !== null) error.upstreamStatus = upstreamStatus;
  error.authExpired = isAuthenticationFailure(resolvedMessage, body, {
    status: statusCode,
    code: resolvedCode ?? upstreamStatus
  });
  error.authForbidden = !error.authExpired && statusCode === 403;
  error.quotaExhausted = quotaExhausted;
  error.rateLimited = rateLimited;
  if (body !== void 0) error.body = boundedErrorBody(body);
  return error;
}
var nativeResponseControls = /* @__PURE__ */ new WeakMap();
var MAX_SSE_EVENT_BYTES = 4 * 1024 * 1024;
var MAX_ERROR_BODY_BYTES = 64 * 1024;
async function readBoundedResponseText(response, limit = MAX_ERROR_BODY_BYTES) {
  const reader = response?.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let text3 = "";
    let total = 0;
    try {
      while (total < limit) {
        const next = await reader.read();
        if (next.done) break;
        const bytes = next.value instanceof Uint8Array ? next.value : Uint8Array.from(next.value ?? []);
        const accepted = bytes.slice(0, limit - total);
        total += accepted.byteLength;
        text3 += decoder.decode(accepted, { stream: total < limit });
        if (accepted.byteLength < bytes.byteLength) {
          await reader.cancel?.();
          break;
        }
      }
      return `${text3}${decoder.decode()}`;
    } finally {
      reader.releaseLock?.();
    }
  }
  if (response?.body && typeof response.body[Symbol.asyncIterator] === "function") {
    const decoder = new TextDecoder();
    let text3 = "";
    let total = 0;
    for await (const chunk of response.body) {
      const bytes = chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk ?? []);
      const accepted = bytes.slice(0, limit - total);
      total += accepted.byteLength;
      text3 += decoder.decode(accepted, { stream: total < limit });
      if (accepted.byteLength < bytes.byteLength) break;
    }
    return `${text3}${decoder.decode()}`;
  }
  const raw = typeof response?.text === "function" ? await response.text() : "";
  return String(raw ?? "").slice(0, limit);
}
async function fetchNativeResponse(url, init = {}, {
  providerId,
  timeoutMs = 3e5,
  fetchImpl = fetch
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  let cleaned = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const upstreamSignal = init.signal;
  const abort = () => controller.abort(upstreamSignal?.reason);
  const timeoutError = nativeProviderError(providerId, "request timed out");
  timeoutError.code = "ETIMEDOUT";
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", abort);
  };
  const control = { providerId, cleanup, get timedOut() {
    return timedOut;
  }, timeoutError };
  let handedOff = false;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) abort();
    else upstreamSignal.addEventListener("abort", abort, { once: true });
  }
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (response.ok === false || response.status !== void 0 && response.status >= 400) {
      let body = null;
      try {
        body = await readBoundedResponseText(response);
      } catch {
      }
      const details = errorDetails(body);
      throw nativeProviderError(providerId, details.message, {
        status: response.status,
        body,
        code: details.code
      });
    }
    nativeResponseControls.set(response, control);
    handedOff = true;
    return response;
  } catch (error) {
    if (error?.name === "AbortError" && timedOut && !error.providerId) {
      throw timeoutError;
    }
    throw error;
  } finally {
    if (!handedOff) cleanup();
  }
}
function cleanupNativeResponse(response) {
  const control = nativeResponseControls.get(response);
  control?.cleanup();
  nativeResponseControls.delete(response);
}
async function* responseChunks(response) {
  const body = response?.body;
  if (!body) return;
  if (typeof body[Symbol.asyncIterator] === "function") {
    try {
      for await (const chunk of body) yield chunk;
    } finally {
      try {
        await body.cancel?.();
      } catch {
      }
    }
    return;
  }
  const reader = body.getReader?.();
  if (!reader) return;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    try {
      await reader.cancel?.();
    } catch {
    }
    reader.releaseLock?.();
  }
}
function parseSseEvent(lines) {
  let event = "message";
  const data = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  const raw = data.join("\n");
  if (raw.trim() === "[DONE]") return { event, data: null, done: true };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { event, data: raw, raw, parseError: error };
  }
  return { event, data: parsed, raw };
}
function sseProtocolError(providerId, event, raw, cause) {
  const snippet = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const error = new Error(
    `${providerId ?? "provider"} SSE data payload is not valid JSON${event ? ` (event: ${event})` : ""}${snippet ? `: ${snippet}` : ""}${cause?.message ? ` [${cause.message}]` : ""}`
  );
  error.code = "SSE_PROTOCOL_ERROR";
  error.providerId = providerId ?? null;
  if (event) error.sseEvent = event;
  if (cause !== void 0) error.cause = cause;
  return error;
}
async function* readSseEvents(response) {
  const control = nativeResponseControls.get(response);
  const decoder = new TextDecoder();
  let pendingLine = "";
  let lines = [];
  let eventBytes = 0;
  let trailingCarriageReturn = false;
  const oversizeError = () => nativeProviderError(
    control?.providerId,
    "SSE event exceeded the maximum allowed size"
  );
  const scanChunk = (rawText) => {
    let text3 = rawText;
    if (trailingCarriageReturn) {
      trailingCarriageReturn = false;
      if (text3.startsWith("\n")) text3 = text3.slice(1);
    }
    const completeLines = [];
    eventBytes -= pendingLine.length;
    let start = 0;
    for (let index = 0; index < text3.length; index += 1) {
      const character = text3[index];
      if (character !== "\n" && character !== "\r") continue;
      let end = index;
      if (character === "\r") {
        if (text3[index + 1] === "\n") index += 1;
        else trailingCarriageReturn = true;
      }
      completeLines.push(pendingLine + text3.slice(start, end));
      pendingLine = "";
      start = index + 1;
    }
    pendingLine += text3.slice(start);
    eventBytes += pendingLine.length;
    return completeLines;
  };
  const drainLines = (completeLines, { final = false } = {}) => {
    const events = [];
    const ingest = (line) => {
      if (line !== "") {
        eventBytes += line.length + (lines.length > 0 ? 1 : 0);
        lines.push(line);
        if (eventBytes > MAX_SSE_EVENT_BYTES) throw oversizeError();
        return;
      }
      const parsed = parseSseEvent(lines);
      lines = [];
      eventBytes = pendingLine.length;
      if (!parsed) return;
      if (parsed.parseError) {
        throw sseProtocolError(control?.providerId, parsed.event, parsed.raw, parsed.parseError);
      }
      events.push(parsed);
    };
    for (const line of completeLines) ingest(line);
    if (final && pendingLine) {
      const line = pendingLine;
      pendingLine = "";
      eventBytes = 0;
      ingest(line);
    }
    return events;
  };
  try {
    for await (const chunk of responseChunks(response)) {
      const batch = drainLines(scanChunk(decoder.decode(chunk, { stream: true })));
      for (const parsed of batch) {
        yield parsed;
        if (parsed.done) return;
      }
    }
    const finalBatch = drainLines(scanChunk(decoder.decode()), { final: true });
    for (const parsed of finalBatch) {
      yield parsed;
      if (parsed.done) return;
    }
  } catch (error) {
    if (control?.timedOut && !error?.providerId) throw control.timeoutError;
    throw error;
  } finally {
    control?.cleanup();
    nativeResponseControls.delete(response);
  }
}
function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const inputTokens = Number(value.input_tokens ?? value.inputTokens ?? value.prompt_tokens ?? value.promptTokens ?? value.promptTokenCount);
  const outputTokens = Number(value.output_tokens ?? value.outputTokens ?? value.completion_tokens ?? value.completionTokens ?? value.candidatesTokenCount);
  const totalTokens = Number(value.total_tokens ?? value.totalTokens ?? value.totalTokenCount);
  const cacheReadTokens = Number(value.cache_read_input_tokens ?? value.cacheReadInputTokens ?? value.cachedContentTokenCount);
  const cacheWriteTokens = Number(value.cache_creation_input_tokens ?? value.cacheCreationInputTokens);
  const result = {};
  if (Number.isFinite(inputTokens)) result.inputTokens = inputTokens;
  if (Number.isFinite(outputTokens)) result.outputTokens = outputTokens;
  if (Number.isFinite(totalTokens)) result.totalTokens = totalTokens;
  if (Number.isFinite(cacheReadTokens)) result.cacheReadTokens = cacheReadTokens;
  if (Number.isFinite(cacheWriteTokens)) result.cacheWriteTokens = cacheWriteTokens;
  return Object.keys(result).length > 0 ? result : null;
}
function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => textFromContent(part)).filter(Boolean).join("");
  if (!content || typeof content !== "object") return "";
  if (content.type === "image" || content.type === "reasoning" || content.type === "thinking") return "";
  if (content.type === "tool-result" || content.type === "tool_result") {
    return textFromContent(content.content ?? content.output ?? content.result ?? content.text);
  }
  return content.text ?? content.value ?? content.content ?? content.delta ?? "";
}
function parseToolArguments(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
function base64FromBytes(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return Buffer.from(value).toString("base64");
  return null;
}
function dataUrlParts(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) return null;
  const mediaType = match[1] || "application/octet-stream";
  const encoded = match[0].includes(";base64,") ? match[2] : (() => {
    try {
      return Buffer.from(decodeURIComponent(match[2]), "utf8").toString("base64");
    } catch {
      return Buffer.from(match[2], "utf8").toString("base64");
    }
  })();
  return { mediaType, data: encoded };
}
async function resolveImageData(content, attachments) {
  const direct = content?.data ?? content?.base64 ?? content?.source?.data;
  const directData = base64FromBytes(direct);
  if (directData) {
    return {
      mediaType: content.mediaType ?? content.mimeType ?? content.source?.media_type ?? "application/octet-stream",
      data: directData
    };
  }
  const dataUrl = dataUrlParts(content?.url ?? content?.source?.url);
  if (dataUrl) return dataUrl;
  const reference = content?.attachment ?? content?.ref ?? content?.source;
  if (!reference || !attachments?.readImage) return null;
  const image = await attachments.readImage(reference);
  const data = base64FromBytes(image?.data ?? image?.bytes ?? image?.base64);
  if (!data) return null;
  return {
    mediaType: content.mediaType ?? content.mimeType ?? image?.ref?.mediaType ?? image?.mediaType ?? "application/octet-stream",
    data
  };
}
function finishReason(value, fallback = "stop") {
  const reason = String(value ?? fallback).toLowerCase();
  if (reason.includes("tool") || reason === "function_call" || reason === "tool_use") {
    return { kind: "tool-calls" };
  }
  if (reason.includes("length") || reason.includes("max")) return { kind: "length" };
  if (reason.includes("error") || reason.includes("cancel")) return { kind: "error" };
  return { kind: "stop" };
}

// modules/provider-antigravity/src/native-transport.mjs
var PROVIDER_ID2 = "antigravity";
var DEFAULT_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";
var DEFAULT_QUOTA_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary";
var DEFAULT_PROJECT_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
var MACOS_SECURITY_BIN = "/usr/bin/security";
var AGY_KEYCHAIN_SERVICE = "gemini";
var AGY_KEYCHAIN_ACCOUNT = "antigravity";
var AGY_KEYCHAIN_VALUE_PREFIX = "go-keyring-base64:";
var ANTIGRAVITY_INFO_PATHS = [
  "/Applications/Antigravity.app/Contents/Info.plist",
  join5(homedir3(), "Applications/Antigravity.app/Contents/Info.plist")
];
function normalizeAntigravityClientVersion(value) {
  const version = String(value ?? "").trim();
  return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}
function detectAntigravityUserAgent() {
  for (const infoPath of ANTIGRAVITY_INFO_PATHS) {
    try {
      const version = normalizeAntigravityClientVersion(execFileSync(
        "/usr/libexec/PlistBuddy",
        ["-c", "Print :CFBundleShortVersionString", infoPath],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      ));
      if (version) return `antigravity/hub/${version} ${process.platform}/${process.arch}`;
    } catch {
    }
  }
  return null;
}
function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
var THOUGHT_SIGNATURE_CACHE_LIMIT = 4096;
var thoughtSignaturesByToolId = /* @__PURE__ */ new Map();
function rememberThoughtSignature(id, signature) {
  if (typeof id !== "string" || id.length === 0) return;
  if (typeof signature !== "string" || signature.length === 0) return;
  if (thoughtSignaturesByToolId.has(id)) thoughtSignaturesByToolId.delete(id);
  thoughtSignaturesByToolId.set(id, signature);
  if (thoughtSignaturesByToolId.size > THOUGHT_SIGNATURE_CACHE_LIMIT) {
    const oldest = thoughtSignaturesByToolId.keys().next().value;
    thoughtSignaturesByToolId.delete(oldest);
  }
}
function thoughtSignatureFrom(value) {
  if (!value || typeof value !== "object") return null;
  return firstString(
    value.thoughtSignature,
    value.thought_signature,
    value.providerMetadata?.thoughtSignature,
    value.providerMetadata?.thought_signature,
    value.providerMetadata?.google?.thoughtSignature,
    value.providerMetadata?.google?.thought_signature,
    value.providerMetadata?.antigravity?.thoughtSignature,
    value.providerMetadata?.antigravity?.thought_signature,
    value.function?.thoughtSignature,
    value.function?.thought_signature,
    value.functionCall?.thoughtSignature,
    value.functionCall?.thought_signature,
    value.function_call?.thoughtSignature,
    value.function_call?.thought_signature
  );
}
function thoughtSignatureForToolPart(part) {
  return thoughtSignatureFrom(part) ?? thoughtSignaturesByToolId.get(part?.id) ?? thoughtSignaturesByToolId.get(part?.toolCallId) ?? null;
}
function partTypeKey(part) {
  return String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
}
function isToolCallPart(part) {
  if (!part || typeof part !== "object") return false;
  if (part.functionCall || part.function_call) return true;
  const type = partTypeKey(part);
  return type === "toolcall" || type === "functioncall";
}
function isToolResultPart(part) {
  if (!part || typeof part !== "object") return false;
  if (part.functionResponse || part.function_response) return true;
  const type = partTypeKey(part);
  return type === "toolresult" || type === "functionresponse";
}
function toolCallIdOf(part) {
  return firstString(part?.id, part?.toolCallId, part?.tool_call_id, part?.functionCall?.id);
}
function toolCallNameOf(part) {
  return firstString(
    part?.name,
    part?.toolName,
    part?.function?.name,
    part?.functionCall?.name,
    part?.function_call?.name,
    part?.functionResponse?.name,
    part?.function_response?.name
  ) ?? "tool";
}
function toolCallArgsOf(part) {
  return parseToolArguments(
    part?.arguments ?? part?.input ?? part?.function?.arguments ?? part?.functionCall?.args ?? part?.functionCall?.arguments ?? part?.function_call?.args ?? part?.function_call?.arguments
  );
}
function toolCallText(name2, args) {
  const serialized = typeof args === "string" ? args : JSON.stringify(args ?? {});
  return `[tool call: ${name2}] ${serialized}`;
}
function toolResultText(part) {
  const name2 = toolCallNameOf(part);
  if (part?.functionResponse || part?.function_response) {
    const response = part.functionResponse?.response ?? part.function_response?.response;
    const content = response?.content ?? response ?? part?.content ?? part?.output ?? part?.result ?? part?.text;
    return `[tool result: ${name2}] ${textFromContent(content)}`;
  }
  return `[tool result: ${name2}] ${textFromContent(part?.content ?? part?.output ?? part?.result ?? part?.text)}`;
}
function messageContentValues(message) {
  const parts = [];
  if (Array.isArray(message?.content)) {
    parts.push(...message.content);
  } else if (Array.isArray(message?.parts)) {
    parts.push(...message.parts);
  } else if (message?.content != null && message.content !== "") {
    parts.push(message.content);
  } else if (message?.text != null && message.text !== "") {
    parts.push(message.text);
  }
  if (Array.isArray(message?.tool_calls)) {
    parts.push(...message.tool_calls.map((call) => ({
      type: "tool-call",
      id: call?.id,
      name: call?.function?.name ?? call?.name,
      arguments: call?.function?.arguments ?? call?.arguments,
      thoughtSignature: call?.thoughtSignature ?? call?.thought_signature,
      thought_signature: call?.thought_signature ?? call?.thoughtSignature
    })));
  }
  return parts.length > 0 ? parts : message != null ? [message] : [];
}
function collectSignedToolCallIds(messages) {
  const signed = /* @__PURE__ */ new Set();
  for (const message of Array.isArray(messages) ? messages : []) {
    for (const part of messageContentValues(message)) {
      if (!isToolCallPart(part)) continue;
      const signature = thoughtSignatureForToolPart(part);
      if (!signature) continue;
      const id = toolCallIdOf(part);
      if (id) {
        rememberThoughtSignature(id, signature);
        signed.add(id);
      }
    }
  }
  return signed;
}
function emailFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const direct = firstString(value.email, value.userEmail, value.email_address, value.account?.email);
  if (direct) return direct;
  const idToken = firstString(value.id_token, value.idToken);
  if (idToken) {
    try {
      const payload = decodeJwtPayload(idToken);
      const fromClaims = firstString(payload?.email);
      if (fromClaims) return fromClaims;
    } catch {
    }
  }
  for (const child of Object.values(value)) {
    const email = emailFromObject(child, depth + 1);
    if (email) return email;
  }
  return null;
}
function tokenFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const direct = firstString(value.access_token, value.accessToken);
  if (direct) return direct;
  for (const child of Object.values(value)) {
    const token = tokenFromObject(child, depth + 1);
    if (token) return token;
  }
  return null;
}
function oauthRecordFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const token = firstString(value.access_token, value.accessToken);
  if (token) {
    const expiresAt = isoFromEpoch(
      value.expires_at ?? value.expiresAt ?? value.expiry_date ?? value.expiryDate ?? value.expiry
    ) ?? addSecondsIso(value.expires_in ?? value.expiresIn);
    return {
      token,
      refreshToken: firstString(value.refresh_token, value.refreshToken),
      ...expiresAt ? { expiresAt } : {}
    };
  }
  for (const child of Object.values(value)) {
    const record = oauthRecordFromObject(child, depth + 1);
    if (record) return record;
  }
  return null;
}
function readOfficialTokenFile(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const record = oauthRecordFromObject(parsed);
    return record ? {
      ...record,
      kind: "oauth",
      email: emailFromObject(parsed)
    } : null;
  } catch {
    return null;
  }
}
function readAntigravityTokenFile({ env = process.env, home = homedir3() } = {}) {
  return readOfficialTokenFile(
    env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE || join5(home, ".gemini", "antigravity-cli", "antigravity-oauth-token")
  );
}
function parseAntigravityKeychainValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const encoded = raw.startsWith(AGY_KEYCHAIN_VALUE_PREFIX) ? raw.slice(AGY_KEYCHAIN_VALUE_PREFIX.length) : null;
  const decoded = encoded ? Buffer.from(encoded, "base64").toString("utf8") : raw;
  try {
    const parsed = JSON.parse(decoded);
    const record = oauthRecordFromObject(parsed);
    return record ? {
      ...record,
      kind: "oauth",
      source: "antigravity_keychain",
      email: emailFromObject(parsed)
    } : null;
  } catch {
    return null;
  }
}
var cachedKeychainToken = null;
var lastKeychainReadTime = 0;
var KEYCHAIN_CACHE_TTL_MS = 6e4;
function readAntigravityKeychainToken({ home = homedir3() } = {}) {
  if (process.platform !== "darwin") return null;
  const now = Date.now();
  if (cachedKeychainToken && now - lastKeychainReadTime < KEYCHAIN_CACHE_TTL_MS) {
    return cachedKeychainToken;
  }
  try {
    const keychainPath = join5(home, "Library", "Keychains", "login.keychain-db");
    const value = execFileSync(MACOS_SECURITY_BIN, [
      "find-generic-password",
      "-s",
      AGY_KEYCHAIN_SERVICE,
      "-a",
      AGY_KEYCHAIN_ACCOUNT,
      "-w",
      keychainPath
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2e3,
      maxBuffer: 1048576
    });
    const parsed = parseAntigravityKeychainValue(value);
    if (parsed) {
      cachedKeychainToken = parsed;
      lastKeychainReadTime = now;
    }
    return parsed;
  } catch {
    return null;
  }
}
function resolveAntigravityAccessToken({ credential, env = process.env, home = homedir3() } = {}) {
  const stored = firstString(credential?.access, credential?.token);
  if (stored) {
    return { token: stored, kind: "oauth", email: emailFromObject(credential) };
  }
  const fromCredentialObject = tokenFromObject(credential);
  if (fromCredentialObject) {
    return { token: fromCredentialObject, kind: "oauth", email: emailFromObject(credential) };
  }
  const fromEnv = firstString(env.DOCKYARD_ANTIGRAVITY_ACCESS_TOKEN, env.GEMINI_ACCESS_TOKEN);
  if (fromEnv) return { token: fromEnv, kind: "oauth" };
  if (!env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE) {
    const fromKeychain = readAntigravityKeychainToken({ home });
    if (fromKeychain?.token) return fromKeychain;
  }
  return readAntigravityTokenFile({ env, home });
}
function projectIdFromLoadCodeAssist(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const key of ["cloudaicompanionProject", "cloudaicompanion_project", "projectId", "project_id", "project"]) {
    const candidate2 = value[key];
    if (typeof candidate2 === "string" && candidate2.trim()) return candidate2.trim();
    if (candidate2 && typeof candidate2 === "object") {
      const nested = firstString(candidate2.id, candidate2.projectId, candidate2.project_id, candidate2.name);
      if (nested) return nested.trim();
    }
  }
  for (const child of Object.values(value)) {
    const nested = projectIdFromLoadCodeAssist(child, depth + 1);
    if (nested) return nested;
  }
  return null;
}
function createAntigravityProjectResolver({
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_PROJECT_ENDPOINT || DEFAULT_PROJECT_ENDPOINT,
  env = process.env,
  home = homedir3(),
  timeoutMs = 2e4,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  project = void 0,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  const configuredProject = typeof project === "string" && project.trim() ? project.trim() : null;
  const cache = /* @__PURE__ */ new Map();
  return async ({ credential = null, account = null, context = {} } = {}) => {
    if (configuredProject) return configuredProject;
    const cacheKey = account?.accountId ?? context.accountId ?? "default";
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const auth = await tokenResolver({
      credential,
      env: { ...env, ...context.env ?? {} },
      home
    });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID2, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      accept: "application/json"
    };
    if (userAgent) headers["user-agent"] = userAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      signal: context.signal
    }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
    let raw;
    try {
      raw = typeof response.json === "function" ? await response.json() : JSON.parse(await response.text());
    } finally {
      cleanupNativeResponse(response);
    }
    const resolved = projectIdFromLoadCodeAssist(raw);
    if (!resolved) {
      throw nativeProviderError(PROVIDER_ID2, "Antigravity did not return a Code Assist project for the selected account", { body: raw });
    }
    cache.set(cacheKey, resolved);
    return resolved;
  };
}
async function geminiParts(content, attachments, { signedToolCallIds = /* @__PURE__ */ new Set(), requireThoughtSignatures = false } = {}) {
  const values = Array.isArray(content) ? content : [content];
  const parts = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) parts.push({ text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID2, "image attachment could not be resolved");
      parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
      continue;
    }
    if (isToolResultPart(part)) {
      const callName = toolCallNameOf(part);
      const callId = toolCallIdOf(part);
      const keepFunctionResponse = !requireThoughtSignatures || Boolean(callId && signedToolCallIds.has(callId));
      if (keepFunctionResponse) {
        parts.push({
          functionResponse: {
            name: callName,
            response: {
              name: callName,
              content: textFromContent(part.content ?? part.output ?? part.result ?? part.text)
            }
          }
        });
      } else {
        parts.push({ text: toolResultText(part) });
      }
      continue;
    }
    if (isToolCallPart(part)) {
      const name2 = toolCallNameOf(part);
      const args = toolCallArgsOf(part);
      const signature = thoughtSignatureForToolPart(part);
      const callId = toolCallIdOf(part);
      if (signature) {
        if (callId) {
          rememberThoughtSignature(callId, signature);
          signedToolCallIds.add(callId);
        }
        parts.push({
          functionCall: {
            name: name2,
            args
          },
          thoughtSignature: signature,
          thought_signature: signature
        });
      } else if (requireThoughtSignatures) {
        parts.push({ text: toolCallText(name2, args) });
      } else {
        parts.push({ functionCall: { name: name2, args } });
      }
      continue;
    }
    const extracted = textFromContent(part);
    if (extracted) parts.push({ text: extracted });
  }
  return parts;
}
function modelRequiresThoughtSignatures(model) {
  const id = String(model ?? "").toLowerCase();
  if (id === "gemini-2.5-flash") return false;
  return true;
}
var DEFAULT_SLIDING_WINDOW_MESSAGES = 40;
var SLIDING_WINDOW_QUANTUM = 20;
function resolveMaxMessages(request) {
  const envLimit = Number.parseInt(process.env.DOCKYARD_ANTIGRAVITY_MAX_MESSAGES ?? "", 10);
  if (Number.isSafeInteger(envLimit) && envLimit > 0) return envLimit;
  if (Number.isSafeInteger(request?.maxMessages) && request.maxMessages > 0) return request.maxMessages;
  const contextWindow = request?.modelContext?.contextWindow;
  if (Number.isSafeInteger(contextWindow) && contextWindow >= 5e5) {
    return 500;
  }
  return DEFAULT_SLIDING_WINDOW_MESSAGES;
}
function compactMessagesForContext(messages, { maxMessages = DEFAULT_SLIDING_WINDOW_MESSAGES, quantum = SLIDING_WINDOW_QUANTUM } = {}) {
  if (!Array.isArray(messages) || messages.length <= maxMessages) return messages;
  const initialIndex = messages.findIndex((m) => m?.role === "user" || m?.role === "system");
  const prefix = initialIndex >= 0 ? [messages[initialIndex]] : [];
  const rawWindowCount = Math.max(10, maxMessages - prefix.length - 1);
  const excess = messages.length - maxMessages;
  const quantOffset = excess > 0 ? Math.floor(excess / quantum) * quantum : 0;
  const windowCount = Math.max(10, rawWindowCount + (excess - quantOffset));
  const recent = messages.slice(-windowCount);
  const startIndex = messages.length - windowCount;
  if (startIndex > 0) {
    const firstRecent = recent[0];
    const isToolResult = firstRecent?.role === "tool" || Array.isArray(firstRecent?.content) && firstRecent.content.some(isToolResultPart);
    if (isToolResult && messages[startIndex - 1]) {
      recent.unshift(messages[startIndex - 1]);
    }
  }
  const compactedCount = messages.length - prefix.length - recent.length;
  if (compactedCount <= 0) return messages;
  const milestone = {
    role: "user",
    content: "[System Note: Context sliding window active. Intermediate messages were compacted to maintain low latency and prevent token exhaustion. Initial requirements and recent active turns are preserved.]"
  };
  return [...prefix, milestone, ...recent];
}
function sanitizeContentsForThoughtSignatures(contents, requireThoughtSignatures) {
  if (!requireThoughtSignatures || !Array.isArray(contents)) return contents;
  const unsignedCallNames = /* @__PURE__ */ new Set();
  for (const content of contents) {
    for (const part of content?.parts ?? []) {
      const rawCall = part?.functionCall ?? part?.function_call;
      if (rawCall && !thoughtSignatureFrom(part)) {
        unsignedCallNames.add(rawCall.name);
      }
    }
  }
  if (unsignedCallNames.size === 0) {
    return contents.map((content) => ({
      ...content,
      parts: (content?.parts ?? []).map((part) => {
        const rawCall = part?.functionCall ?? part?.function_call;
        if (rawCall) {
          const signature = thoughtSignatureFrom(part);
          const {
            thoughtSignature: _ignoredTs1,
            thought_signature: _ignoredTs2,
            ...cleanedCall
          } = rawCall;
          const callKey = part.functionCall ? "functionCall" : "function_call";
          if (signature) {
            return {
              ...part,
              thoughtSignature: signature,
              thought_signature: signature,
              [callKey]: cleanedCall
            };
          }
          return {
            ...part,
            [callKey]: cleanedCall
          };
        }
        return part;
      })
    }));
  }
  return contents.map((content) => ({
    ...content,
    parts: (content?.parts ?? []).map((part) => {
      const rawCall = part?.functionCall ?? part?.function_call;
      if (rawCall) {
        const signature = thoughtSignatureFrom(part);
        if (!signature) {
          return { text: toolCallText(rawCall.name, rawCall.args ?? rawCall.arguments) };
        }
        const {
          thoughtSignature: _ignoredTs1,
          thought_signature: _ignoredTs2,
          ...cleanedCall
        } = rawCall;
        const callKey = part.functionCall ? "functionCall" : "function_call";
        return {
          ...part,
          thoughtSignature: signature,
          thought_signature: signature,
          [callKey]: cleanedCall
        };
      }
      const resp = part?.functionResponse ?? part?.function_response;
      if (resp) {
        const name2 = resp.name ?? "tool";
        if (unsignedCallNames.has(name2)) {
          const result = resp.response?.content ?? resp.response ?? "";
          return { text: `[tool result: ${name2}] ${typeof result === "string" ? result : JSON.stringify(result)}` };
        }
      }
      return part;
    })
  }));
}
async function buildGeminiContents(request, attachments) {
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  const maxMessages = resolveMaxMessages(request);
  const messages = compactMessagesForContext(rawMessages, { maxMessages });
  const signedToolCallIds = collectSignedToolCallIds(messages);
  const requireThoughtSignatures = modelRequiresThoughtSignatures(request.model);
  const contents = [];
  for (const message of messages) {
    const parts = await geminiParts(messageContentValues(message), attachments, {
      signedToolCallIds,
      requireThoughtSignatures
    });
    if (parts.length === 0) continue;
    contents.push({
      role: message?.role === "assistant" ? "model" : "user",
      parts
    });
  }
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Continue the conversation." }] });
  return sanitizeContentsForThoughtSignatures(contents, requireThoughtSignatures);
}
function sanitizeSchema(value) {
  if (Array.isArray(value)) return value.map(sanitizeSchema);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (["$schema", "additionalProperties", "strict"].includes(key)) continue;
    result[key] = sanitizeSchema(child);
  }
  return result;
}
function buildGeminiTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const declarations = tools.map((tool) => ({
    name: tool?.name ?? tool?.function?.name ?? "tool",
    ...tool?.description ? { description: String(tool.description) } : {},
    parameters: sanitizeSchema(tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" })
  }));
  declarations.sort((a, b) => a.name.localeCompare(b.name));
  return declarations.length > 0 ? [{ functionDeclarations: declarations }] : void 0;
}
function resolveAntigravityThinkingConfig(request = {}) {
  if (request.thinkingConfig && typeof request.thinkingConfig === "object") {
    return {
      includeThoughts: true,
      ...request.thinkingConfig
    };
  }
  const effort = String(
    request.reasoningEffort ?? request.reasoning_effort ?? (typeof request.thinking === "string" ? request.thinking : null) ?? ""
  ).toLowerCase().trim();
  if (request.purpose === "compaction" || effort === "none" || effort === "off" || request.thinking === false) {
    return {
      includeThoughts: false,
      thinkingBudget: 0
    };
  }
  if (effort === "low") {
    return {
      includeThoughts: true,
      thinkingBudget: 1024
    };
  }
  if (effort === "medium") {
    return {
      includeThoughts: true,
      thinkingBudget: 8192
    };
  }
  if (effort === "high") {
    return {
      includeThoughts: true,
      thinkingBudget: -1
    };
  }
  if (Number.isInteger(request.thinkingBudget)) {
    return {
      includeThoughts: request.thinkingBudget > 0,
      thinkingBudget: request.thinkingBudget
    };
  }
  const modelName = String(request.model ?? "").toLowerCase();
  if (modelName.endsWith("-low")) {
    return {
      includeThoughts: true,
      thinkingBudget: 1024
    };
  }
  if (modelName.endsWith("-medium")) {
    return {
      includeThoughts: true,
      thinkingBudget: 8192
    };
  }
  if (modelName.endsWith("-high")) {
    return {
      includeThoughts: true,
      thinkingBudget: -1
    };
  }
  return {
    includeThoughts: true
  };
}
async function buildAntigravityRequest(request = {}, context = {}) {
  const nativeRequest = {
    contents: await buildGeminiContents(request, context.attachments)
  };
  const tools = buildGeminiTools(request.tools);
  if (tools) {
    nativeRequest.tools = tools;
    const toolRule = "IMPORTANT: You MUST invoke tools using native function calls. NEVER output '[tool call: ...]' or pseudo-code text.";
    const existingSystem = typeof request.system === "string" && request.system.length > 0 ? `${request.system}

` : "";
    nativeRequest.systemInstruction = { parts: [{ text: `${existingSystem}${toolRule}` }] };
  } else if (typeof request.system === "string" && request.system.length > 0) {
    nativeRequest.systemInstruction = { parts: [{ text: request.system }] };
  }
  nativeRequest.generationConfig = {
    temperature: request.temperature ?? 0.7,
    maxOutputTokens: Number.isInteger(request.maxTokens) && request.maxTokens > 0 ? request.maxTokens : Number.isInteger(request.modelContext?.maxTokens) && request.modelContext.maxTokens > 0 ? request.modelContext.maxTokens : 65536,
    ...Array.isArray(request.responseModalities) ? { responseModalities: request.responseModalities } : request.modalities ? { responseModalities: request.modalities } : {}
  };
  const thinkingConfig = resolveAntigravityThinkingConfig(request);
  if (thinkingConfig) {
    nativeRequest.generationConfig.thinkingConfig = thinkingConfig;
  }
  return nativeRequest;
}
function responsePayload(value) {
  if (!value || typeof value !== "object") return null;
  return value.response && typeof value.response === "object" ? value.response : value;
}
function googleErrorStatusText(error) {
  const raw = firstString(
    typeof error?.status === "string" ? error.status : null,
    typeof error?.code === "string" ? error.code : null
  );
  return String(raw ?? "").trim().toUpperCase();
}
function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "png";
}
function saveInlineImageToArtifacts(inlineData, workingDir = process.cwd()) {
  try {
    const mediaType = inlineData?.mimeType ?? inlineData?.mediaType ?? "image/png";
    const base64Data = inlineData?.data;
    if (!base64Data || typeof base64Data !== "string") return null;
    const ext = extensionFromMimeType(mediaType);
    const artifactsDir = join5(workingDir, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    const filename = `imagen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join5(artifactsDir, filename);
    writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    return `/artifacts/${filename}`;
  } catch {
    return null;
  }
}
function parseTextToolCall(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:^|\n)\s*\[(?:tool call|Tool Call):\s*([a-zA-Z0-9_.:-]+)\]\s*([\s\S]*)$/i);
  if (!match) return null;
  const leadingText = value.slice(0, match.index).trim();
  let name2 = match[1];
  if (name2.startsWith("default_api:")) {
    name2 = name2.slice("default_api:".length);
  }
  if (name2 === "run_command") {
    name2 = "bash";
  }
  let argumentsValue = match[2].trim();
  if (argumentsValue.startsWith("{") && argumentsValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(argumentsValue);
      if (name2 === "bash" && !parsed.command && parsed.CommandLine) {
        parsed.command = parsed.CommandLine;
      }
      argumentsValue = JSON.stringify(parsed);
    } catch {
      argumentsValue = JSON.stringify({ input: argumentsValue });
    }
  } else if (argumentsValue) {
    argumentsValue = JSON.stringify({ input: argumentsValue });
  } else {
    argumentsValue = "{}";
  }
  return { name: name2, argumentsValue, leadingText };
}
function isPotentialTextToolCall(text3) {
  if (typeof text3 !== "string" || text3.length === 0) return false;
  const trimmed = text3.trimStart();
  if (trimmed.startsWith("[")) {
    const prefix = "[tool call:";
    const lower = trimmed.toLowerCase();
    if (prefix.startsWith(lower) || lower.startsWith(prefix)) return true;
  }
  return /\[(?:tool call|Tool Call):/i.test(text3);
}
async function* streamAntigravityResponse(response, context) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = false;
  let textStarted = false;
  let textBuffered = false;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  let pendingThoughtSignature = null;
  for await (const event of readSseEvents(response)) {
    const payload = responsePayload(event.data);
    if (!payload) continue;
    if (payload.error) {
      const upstreamError = payload.error;
      const error = nativeProviderError(PROVIDER_ID2, upstreamError.message ?? "Antigravity returned an error", {
        status: upstreamError.code,
        body: upstreamError
      });
      const statusText = googleErrorStatusText(upstreamError);
      if (statusText === "UNAUTHENTICATED" || statusText === "NOTAUTHENTICATED") {
        error.authExpired = true;
      } else if (statusText === "PERMISSION_DENIED") {
        error.authForbidden = true;
      } else if (statusText === "RESOURCE_EXHAUSTED") {
        error.quotaExhausted = true;
        error.rateLimited = true;
      }
      throw error;
    }
    usage = normalizeUsage(payload.usageMetadata ?? payload.usage) ?? usage;
    const candidate2 = payload.candidates?.[0] ?? payload.candidate ?? payload;
    stop = candidate2.finishReason ?? stop;
    for (const part of candidate2.content?.parts ?? candidate2.parts ?? []) {
      if (part?.text) {
        if (part.thought === true || part.thoughtSignature || part.thought_signature) {
          const thoughtPartSignature = thoughtSignatureFrom(part);
          if (thoughtPartSignature) pendingThoughtSignature = thoughtPartSignature;
          if (textOpen) {
            if (textBuffered) {
              yield { type: "block-start", index: textIndex, blockType: "text" };
              yield { type: "text-delta", index: textIndex, text: text3 };
              textBuffered = false;
            }
            yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
            textOpen = false;
          }
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          reasoning.text += part.text;
          yield { type: "reasoning-delta", index: reasoning.index, text: part.text };
          continue;
        }
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          textStarted = false;
          textBuffered = false;
        }
        text3 += part.text;
        if (!textStarted && isPotentialTextToolCall(text3)) {
          textBuffered = true;
        } else {
          if (!textStarted) {
            yield { type: "block-start", index: textIndex, blockType: "text" };
            textStarted = true;
            textBuffered = false;
            yield { type: "text-delta", index: textIndex, text: text3 };
          } else {
            yield { type: "text-delta", index: textIndex, text: part.text };
          }
        }
        continue;
      }
      const inlineData = part?.inlineData ?? part?.inline_data;
      if (inlineData?.data) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          textStarted = true;
          textBuffered = false;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        } else if (textBuffered) {
          yield { type: "block-start", index: textIndex, blockType: "text" };
          yield { type: "text-delta", index: textIndex, text: text3 };
          textStarted = true;
          textBuffered = false;
        }
        const savedPath = saveInlineImageToArtifacts(inlineData, context?.cwd ?? process.cwd());
        const mediaType = inlineData?.mimeType ?? inlineData?.mediaType ?? "image/png";
        const imageMarkdown = savedPath ? `

![Generated Image](${savedPath})

*(Image saved to \`${savedPath}\`)*

` : `

![Generated Image](data:${mediaType};base64,${inlineData.data})

`;
        text3 += imageMarkdown;
        yield { type: "text-delta", index: textIndex, text: imageMarkdown };
        continue;
      }
      const partSignature = thoughtSignatureFrom(part);
      if (partSignature) pendingThoughtSignature = partSignature;
      const call = part?.functionCall ?? part?.function_call;
      if (!call) continue;
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (textOpen) {
        const textTool = parseTextToolCall(text3);
        if (textTool) {
          if (!textStarted) {
            if (textTool.leadingText) {
              yield { type: "block-start", index: textIndex, blockType: "text" };
              yield { type: "text-delta", index: textIndex, text: textTool.leadingText };
              yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText } };
            }
          } else {
            yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText || text3 } };
          }
          const toolIndex = nextIndex++;
          const toolId = firstString(textTool.name, `tool-${toolIndex}`);
          const toolBlock = { type: "tool-call", id: toolId, name: textTool.name, arguments: textTool.argumentsValue };
          yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
          yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: textTool.name, argumentsDelta: textTool.argumentsValue };
          yield { type: "block-end", index: toolIndex, block: toolBlock };
        } else {
          if (textBuffered) {
            yield { type: "block-start", index: textIndex, blockType: "text" };
            yield { type: "text-delta", index: textIndex, text: text3 };
          }
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
        }
        textOpen = false;
        textStarted = false;
        textBuffered = false;
      }
      const index = nextIndex++;
      const name2 = firstString(call.name, "tool");
      const id = firstString(call.id, `${name2}-${index}`);
      const argumentsValue = JSON.stringify(call.args ?? call.arguments ?? {});
      const thoughtSignature = thoughtSignatureFrom(part) ?? thoughtSignatureFrom(call) ?? pendingThoughtSignature;
      pendingThoughtSignature = null;
      if (thoughtSignature) rememberThoughtSignature(id, thoughtSignature);
      const block = { type: "tool-call", id, name: name2, arguments: argumentsValue };
      if (thoughtSignature) {
        block.thoughtSignature = thoughtSignature;
        block.thought_signature = thoughtSignature;
      }
      yield { type: "block-start", index, blockType: "tool-call" };
      yield { type: "tool-call-delta", index, id, name: name2, argumentsDelta: argumentsValue };
      yield { type: "block-end", index, block };
      stop = "tool_calls";
    }
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) {
    const textTool = parseTextToolCall(text3);
    if (textTool) {
      if (!textStarted) {
        if (textTool.leadingText) {
          yield { type: "block-start", index: textIndex, blockType: "text" };
          yield { type: "text-delta", index: textIndex, text: textTool.leadingText };
          yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText } };
        }
      } else {
        yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText || text3 } };
      }
      const toolIndex = nextIndex++;
      const toolId = firstString(textTool.name, `tool-${toolIndex}`);
      const toolBlock = { type: "tool-call", id: toolId, name: textTool.name, arguments: textTool.argumentsValue };
      yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
      yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: textTool.name, argumentsDelta: textTool.argumentsValue };
      yield { type: "block-end", index: toolIndex, block: toolBlock };
      stop = "tool_calls";
    } else {
      if (textBuffered) {
        yield { type: "block-start", index: textIndex, blockType: "text" };
        yield { type: "text-delta", index: textIndex, text: text3 };
      }
      yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
    }
  } else if (stop !== "tool_calls") {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "block-end", index: 0, block: { type: "text", text: "" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createAntigravityNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_ENDPOINT || DEFAULT_ENDPOINT,
  // Never fabricate an upstream project: when neither configuration nor a
  // resolver yields the account's Code Assist project, the request fails with
  // a clear diagnostic instead of sending a guessed envelope value.
  project = process.env.DOCKYARD_ANTIGRAVITY_PROJECT || null,
  env = process.env,
  timeoutMs = 3e5,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  projectResolver = null,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    if (context.secretStore) {
      const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
      if (ref) credential = await context.secretStore.read(ref);
    }
    const authPromise = tokenResolver({ credential, env: { ...env, ...context.env ?? {} }, home: homedir3() });
    const projectPromise = typeof projectResolver === "function" ? projectResolver({ credential, account: invocation?.account, context }) : Promise.resolve(project);
    const nativeRequestPromise = buildAntigravityRequest(request, context);
    const [auth, resolvedProject, nativeRequest] = await Promise.all([
      authPromise,
      projectPromise,
      nativeRequestPromise
    ]);
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID2, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    if (!resolvedProject) {
      const error = nativeProviderError(
        PROVIDER_ID2,
        "Antigravity Code Assist project is unavailable for the selected account; set DOCKYARD_ANTIGRAVITY_PROJECT or reauthorize so loadCodeAssist can resolve it"
      );
      error.degraded = true;
      throw error;
    }
    const body = {
      project: resolvedProject,
      model: request.model,
      request: nativeRequest
    };
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json"
    };
    const resolvedUserAgent = userAgent ?? context.env?.DOCKYARD_ANTIGRAVITY_USER_AGENT ?? detectAntigravityUserAgent();
    if (resolvedUserAgent) headers["user-agent"] = resolvedUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: context.signal
    }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
    return streamAntigravityResponse(response, context);
  };
  executor.nativeTransport = "gemini-stream-generate-content";
  return executor;
}
function createAntigravityNativeQuotaReader({
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_QUOTA_ENDPOINT || DEFAULT_QUOTA_ENDPOINT,
  env = process.env,
  home = homedir3(),
  timeoutMs = 2e4,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  project = env.DOCKYARD_ANTIGRAVITY_PROJECT,
  projectResolver = null,
  userAgent = env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  return async ({ credential = null, account = null, context = {} } = {}) => {
    const auth = await tokenResolver({
      credential,
      env: { ...env, ...context.env ?? {} },
      home
    });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID2, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    const resolvedProject = typeof projectResolver === "function" ? await projectResolver({ credential, account, context }) : project;
    const body = resolvedProject ? { project: resolvedProject } : {};
    const resolvedUserAgent = userAgent ?? context.env?.DOCKYARD_ANTIGRAVITY_USER_AGENT ?? detectAntigravityUserAgent();
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      accept: "application/json"
    };
    if (resolvedUserAgent) headers["user-agent"] = resolvedUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: context.signal
    }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
    let raw;
    try {
      raw = typeof response.json === "function" ? await response.json() : JSON.parse(await response.text());
    } finally {
      cleanupNativeResponse(response);
    }
    if (!raw || typeof raw !== "object") {
      throw nativeProviderError(PROVIDER_ID2, "quota summary response was not an object");
    }
    return raw;
  };
}
var antigravityNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID2,
  endpoint: DEFAULT_ENDPOINT,
  quotaEndpoint: DEFAULT_QUOTA_ENDPOINT
});

// modules/provider-antigravity/src/driver.mjs
var PROVIDER_ID3 = "antigravity";
var DEFAULT_CLI = "agy";
function resolveAgyCliPath(configured, { env = process.env, home = homedir4() } = {}) {
  const envPath = configured ?? env.DOCKYARD_ANTIGRAVITY_CLI;
  if (envPath && envPath !== "agy" && envPath !== DEFAULT_CLI) {
    return envPath;
  }
  const candidates = [
    join6(home, ".local", "bin", "agy"),
    join6(home, ".gemini", "antigravity", "bin", "agy"),
    "/usr/local/bin/agy",
    "/opt/homebrew/bin/agy",
    "/usr/bin/agy"
  ];
  for (const candidate2 of candidates) {
    if (existsSync(candidate2)) return candidate2;
  }
  return envPath || DEFAULT_CLI;
}
function augmentPathWithUserBins(env = process.env, home = homedir4()) {
  const extraPaths = [
    join6(home, ".local", "bin"),
    join6(home, ".gemini", "antigravity", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin"
  ];
  const currentPath = env?.PATH || "";
  const parts = currentPath.split(":");
  const toPrepend = extraPaths.filter((p) => existsSync(p) && !parts.includes(p));
  if (toPrepend.length === 0) return currentPath;
  return [...toPrepend, currentPath].filter(Boolean).join(":");
}
var DEFAULT_CATALOG_TTL_MS = 6e4;
var DEFAULT_AUTH_TIMEOUT_MS = 10 * 60 * 1e3;
var CREDENTIAL_SLOT2 = Symbol("dockyard-antigravity-session");
var ANTIGRAVITY_CREDENTIAL_REFRESH_MODES = Object.freeze({
  DSH_BROWSER_OAUTH: "dockyard_browser_oauth",
  AGY_SESSION: "agy_session"
});
var AGY_FILE_STORAGE_ENV = "GEMINI_FORCE_FILE_STORAGE";
var ANTIGRAVITY_BROWSER_CLIENT_ID = process.env.DOCKYARD_ANTIGRAVITY_CLIENT_ID || "";
var ANTIGRAVITY_BROWSER_CLIENT_SECRET = process.env.DOCKYARD_ANTIGRAVITY_CLIENT_SECRET || "";
var ANTIGRAVITY_BROWSER_AUTHORIZATION_URL = process.env.DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL || "https://accounts.google.com/o/oauth2/v2/auth";
var ANTIGRAVITY_BROWSER_TOKEN_URL = process.env.DOCKYARD_ANTIGRAVITY_TOKEN_URL || "https://oauth2.googleapis.com/token";
var ANTIGRAVITY_BROWSER_USERINFO_URL = process.env.DOCKYARD_ANTIGRAVITY_USERINFO_URL || "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
var ANTIGRAVITY_BROWSER_REDIRECT_URI = process.env.DOCKYARD_ANTIGRAVITY_REDIRECT_URI || "http://localhost:51121/oauth-callback";
var ANTIGRAVITY_BROWSER_SCOPES = process.env.DOCKYARD_ANTIGRAVITY_OAUTH_SCOPE || [
  // The same OAuth token is used both for userinfo and Google's Code Assist
  // endpoints. Keep the upstream API scope instead of authorizing a token
  // that can identify the user but cannot call streamGenerateContent.
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");
var OFFICIAL_ANTIGRAVITY_MODEL_METADATA = Object.freeze([
  Object.freeze({
    id: "gemini-3.8-flash",
    contextWindow: 1048576,
    maxTokens: 65536
  }),
  Object.freeze({
    id: "gemini-3.8-pro",
    contextWindow: 1048576,
    maxTokens: 65536
  }),
  Object.freeze({
    id: "gemini-3.7-flash",
    contextWindow: 1048576,
    maxTokens: 65536
  }),
  Object.freeze({
    id: "gemini-3.7-pro",
    contextWindow: 1048576,
    maxTokens: 65536
  })
]);
var ANTIGRAVITY_PTY_SCRIPT = String.raw`
import os
import pty
import select
import signal
import sys

command = sys.argv[1]
command_args = sys.argv[1:]
child_pid, pty_fd = pty.fork()
if child_pid == 0:
    os.execvpe(command, command_args, os.environ)

def terminate(_signum, _frame):
    try:
        os.kill(child_pid, signal.SIGTERM)
    except OSError:
        pass
    os._exit(143)

signal.signal(signal.SIGTERM, terminate)
signal.signal(signal.SIGINT, terminate)
stdin_open = True
exit_code = 1
try:
    while True:
        inputs = [pty_fd]
        if stdin_open:
            inputs.append(0)
        ready, _, _ = select.select(inputs, [], [], 0.25)
        if pty_fd in ready:
            try:
                data = os.read(pty_fd, 8192)
            except OSError:
                data = b""
            if not data:
                break
            os.write(1, data)
        if stdin_open and 0 in ready:
            data = os.read(0, 8192)
            if data:
                os.write(pty_fd, data)
            else:
                stdin_open = False
        waited_pid, status = os.waitpid(child_pid, os.WNOHANG)
        if waited_pid:
            exit_code = os.waitstatus_to_exitcode(status)
            break
finally:
    try:
        os.close(pty_fd)
    except OSError:
        pass
    try:
        os.kill(child_pid, signal.SIGTERM)
    except OSError:
        pass
sys.exit(exit_code)
`;
function hash2(value) {
  return createHash4("sha256").update(String(value)).digest("hex");
}
var EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
function normalizeEmail(value) {
  const email = String(value ?? "").trim();
  return email.match(EMAIL_PATTERN)?.[0] ?? null;
}
function findEmailField(value, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (/email/i.test(key)) {
      const direct = normalizeEmail(nested);
      if (direct) return direct;
    }
    const child = findEmailField(nested, depth + 1, seen);
    if (child) return child;
  }
  return null;
}
function extractAntigravityAccountEmail(...values) {
  for (const value of values) {
    const direct = normalizeEmail(
      value?.email ?? value?.account?.email ?? value?.user?.email ?? value?.identity?.email ?? value?.accountEmail ?? value?.userEmail ?? value?.email_address ?? value?.command?.data?.email ?? value?.command?.data?.email_address
    );
    if (direct) return direct;
    const nested = findEmailField(value);
    if (nested) return nested;
    const text3 = typeof value === "string" ? value : "";
    const explicit = text3.match(
      /(?:applyAuthResult:\s*)?email\s*=\s*([^\s,;]+)|authenticated\s+successfully\s+as\s+([^\s,;]+)/i
    );
    const matched = normalizeEmail(explicit?.[1] ?? explicit?.[2]);
    if (matched) return matched;
  }
  return null;
}
function sessionFingerprint(session) {
  const email = typeof session?.email === "string" && session.email.length > 0 ? session.email : null;
  const token = typeof session?.token === "string" && session.token.length > 0 ? session.token : null;
  if (email) return hash2(`antigravity-session:email:${email.toLowerCase()}`).slice(0, 10).toUpperCase();
  return token ? hash2(`antigravity-session:${token}`).slice(0, 10).toUpperCase() : null;
}
function activeSessionError(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}
function sameEmail(left, right) {
  const a = normalizeEmail(left)?.toLowerCase();
  const b = normalizeEmail(right)?.toLowerCase();
  return Boolean(a && b && a === b);
}
function tokenExpiresAt(tokens, now = /* @__PURE__ */ new Date()) {
  return isoFromEpoch(tokens?.expiresAt ?? tokens?.expires_at) ?? addSecondsIso(tokens?.expires_in ?? tokens?.expiresIn, now);
}
function tokenNeedsRefresh(credential, now, leewayMs = 6e4) {
  if (!credential?.refresh) return false;
  if (!credential.expiresAt) return true;
  const expiresAt = Date.parse(credential.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime() + leewayMs;
}
function officialAntigravityTokenPath(environment) {
  const home = environment?.HOME || homedir4();
  return environment?.DOCKYARD_ANTIGRAVITY_TOKEN_FILE || join6(home, ".gemini", "antigravity-cli", "antigravity-oauth-token");
}
function agyRefreshEnvironment(environment, tokenPath) {
  return {
    ...environment,
    DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath,
    [AGY_FILE_STORAGE_ENV]: "true",
    AGY_CLI_HIDE_ACCOUNT_INFO: "1"
  };
}
function credentialRefreshMode(account) {
  const explicit = account?.resources?.credentialRefreshMode;
  if (explicit) return explicit;
  return account?.resources?.sessionPersistence === "captured" ? ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION : null;
}
function cliFailure2(code, signal, output, errorOutput) {
  const error = new Error(`Antigravity CLI failed (${signal ?? code})`);
  error.code = code;
  const structured = parseJsonOutput2(output);
  const structuredDetail = structured?.error ?? structured?.response ?? structured?.result?.error ?? structured?.result?.response;
  error.detail = String(errorOutput || structuredDetail || "").replace(/\s+/g, " ").trim().slice(0, 300);
  return error;
}
function runCommand(command, args, {
  env = process.env,
  timeoutMs = 3e4,
  signal,
  includeAccountInfo = false
} = {}) {
  return new Promise((resolve2, reject) => {
    const childEnv = { ...env };
    if (includeAccountInfo) delete childEnv.AGY_CLI_HIDE_ACCOUNT_INFO;
    else childEnv.AGY_CLI_HIDE_ACCOUNT_INFO ??= "1";
    childEnv.PATH = augmentPathWithUserBins(childEnv, childEnv.HOME || homedir4());
    const resolvedCommand = command === DEFAULT_CLI || command === "agy" ? resolveAgyCliPath(command, { env: childEnv, home: childEnv.HOME || homedir4() }) : command;
    const child = spawn4(resolvedCommand, args, {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...signal ? { signal } : {}
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
      }
      killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }, 2e3);
      killTimer.unref?.();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code, closeSignal) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8");
      if (!timedOut && code === 0) {
        resolve2({ output, errorOutput });
        return;
      }
      const failure = cliFailure2(code, closeSignal, output, errorOutput);
      if (timedOut) failure.message = `Antigravity CLI timed out after ${timeoutMs}ms`;
      reject(failure);
    });
  });
}
function parseJsonOutput2(output) {
  try {
    return JSON.parse(output);
  } catch {
    for (const line of String(output).split(/\r?\n/).reverse()) {
      if (!line.trim()) continue;
      try {
        return JSON.parse(line);
      } catch {
      }
    }
    return null;
  }
}
function normalizeToken(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function modelTier(model) {
  const labelMatch = /\(([^()]+)\)\s*$/.exec(model.name ?? "");
  if (!labelMatch) return null;
  const idParts = model.id.split("-");
  const id = idParts.at(-1);
  const label = labelMatch[1].trim();
  if (!id || !label || normalizeToken(id) !== normalizeToken(label)) return null;
  return { id, name: label };
}
function parseAntigravityModelCatalog(output) {
  const rows = String(output).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^fetching available models/i.test(line)).map((line) => {
    const [id, ...nameParts] = line.split("	");
    return { id, name: nameParts.join("	") || id };
  }).filter((model) => model.id);
  const families = /* @__PURE__ */ new Map();
  for (const model of rows) {
    const tier = modelTier(model);
    if (!tier) continue;
    const familyId = model.id.slice(0, -(tier.id.length + 1));
    const family = families.get(familyId) ?? /* @__PURE__ */ new Map();
    family.set(tier.id, tier);
    families.set(familyId, family);
  }
  return rows.map((model) => {
    const tier = modelTier(model);
    if (!tier) return model;
    const familyId = model.id.slice(0, -(tier.id.length + 1));
    const family = families.get(familyId);
    if (!family || family.size < 2) return model;
    const efforts = [...family.values()];
    return {
      ...model,
      reasoning: {
        efforts: efforts.map((effort) => ({ id: effort.id, name: effort.name })),
        defaultEffort: tier.id
      }
    };
  });
}
function registryModels(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.models)) return value.models;
  return [];
}
function mergedAntigravityRegistry(registry, liveModelIds = []) {
  const byId = /* @__PURE__ */ new Map();
  for (const candidate2 of registryModels(registry)) {
    if (!candidate2 || typeof candidate2.id !== "string" || candidate2.id.length === 0) continue;
    const defined = Object.fromEntries(Object.entries(candidate2).filter(([, value]) => value !== void 0 && value !== null));
    byId.set(candidate2.id, { ...byId.get(candidate2.id) ?? {}, ...defined });
  }
  for (const official of OFFICIAL_ANTIGRAVITY_MODEL_METADATA) {
    const referenced = byId.has(official.id) || liveModelIds.some((id) => id === official.id || id.startsWith(`${official.id}-`));
    if (!referenced) continue;
    byId.set(official.id, { ...official, ...byId.get(official.id) ?? {} });
  }
  return [...byId.values()];
}
function catalogScopeKey(accounts) {
  const accountIds = (Array.isArray(accounts) ? accounts : []).map((account) => typeof account?.accountId === "string" ? account.accountId : "").filter(Boolean).sort();
  return accountIds.length > 0 ? `accounts:${hash2(accountIds.join("\n")).slice(0, 32)}` : "unscoped";
}
function defaultAntigravityCatalogCachePath({ env = process.env, home = homedir4() } = {}) {
  const dockyardHome = env.DOCKYARD_DSH_HOME || join6(home, ".dockyard-dsh");
  return join6(dockyardHome, "antigravity-catalog.json");
}
function persistableCatalog(value) {
  return {
    models: Array.isArray(value?.models) ? value.models : [],
    source: typeof value?.source === "string" ? value.source : "official_antigravity_cli"
  };
}
async function readAntigravityCatalogCache(filePath) {
  if (!filePath) return { schema: 1, entries: {} };
  try {
    const parsed = JSON.parse(await readFile4(filePath, "utf8"));
    return {
      schema: 1,
      entries: parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {}
    };
  } catch {
    return { schema: 1, entries: {} };
  }
}
async function writeAntigravityCatalogCache(filePath, cache) {
  if (!filePath) return;
  await mkdir3(dirname4(filePath), { recursive: true, mode: 448 });
  const entries = Object.entries(cache.entries ?? {}).slice(-8);
  const tempPath = `${filePath}.${randomUUID4()}.tmp`;
  try {
    await writeFile2(tempPath, JSON.stringify({ schema: 1, entries: Object.fromEntries(entries) }), {
      encoding: "utf8",
      mode: 384
    });
    await rename2(tempPath, filePath);
  } finally {
    await rm3(tempPath, { force: true }).catch(() => {
    });
  }
}
function registryMatch(model, registry) {
  const candidates = registryModels(registry).filter((candidate2) => candidate2 && typeof candidate2.id === "string" && candidate2.id.length > 0).filter((candidate2) => model.id === candidate2.id || model.id.startsWith(`${candidate2.id}-`)).sort((left, right) => right.id.length - left.id.length);
  const exact = candidates.find((candidate2) => candidate2.id === model.id);
  if (exact) return exact;
  const family = candidates[0];
  if (!family || !model.reasoning?.efforts?.length) return null;
  const suffix = model.id.slice(family.id.length + 1);
  return model.reasoning.efforts.some((effort) => normalizeToken(effort.id) === normalizeToken(suffix)) ? family : null;
}
function enrichAntigravityModelCatalog(models, registry) {
  return (Array.isArray(models) ? models : []).map((model) => {
    const match = registryMatch(model, registry);
    if (!match) return model;
    const contextWindow = finiteNumber(model.contextWindow ?? match.contextWindow ?? match.context_window ?? match.context_length);
    const maxTokens = finiteNumber(model.maxTokens ?? match.maxTokens ?? match.max_tokens ?? match.max_output_tokens);
    const inputModalities = Array.isArray(model.inputModalities) ? model.inputModalities : Array.isArray(match.input) ? match.input : void 0;
    return {
      ...model,
      ...Number.isInteger(contextWindow) ? { contextWindow } : {},
      ...Number.isInteger(maxTokens) ? { maxTokens } : {},
      ...inputModalities?.length ? { inputModalities: [...inputModalities] } : {}
    };
  });
}
function createAntigravityCatalogLoader({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  env = process.env,
  home = homedir4(),
  cacheFilePath = env.DOCKYARD_ANTIGRAVITY_CATALOG_CACHE ?? defaultAntigravityCatalogCachePath({ env, home }),
  timeoutMs = 3e4,
  cacheTtlMs = Number(process.env.DOCKYARD_ANTIGRAVITY_CATALOG_TTL_MS) || DEFAULT_CATALOG_TTL_MS,
  commandRunner = runCommand,
  registryLoader = null
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env, home });
  const cached = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const pendingRefreshes = /* @__PURE__ */ new Set();
  let persistentPromise = null;
  let persistentCache = null;
  let persistWrite = Promise.resolve();
  const loadPersistent = () => {
    persistentPromise ??= readAntigravityCatalogCache(cacheFilePath).then((value) => {
      persistentCache = value;
      return value;
    });
    return persistentPromise;
  };
  const persist = (scope, value) => {
    if (!cacheFilePath || !Array.isArray(value?.models) || value.models.length === 0) return Promise.resolve();
    persistWrite = persistWrite.then(async () => {
      const cache = await loadPersistent();
      cache.entries[scope] = {
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        value: persistableCatalog(value)
      };
      const scopes = Object.keys(cache.entries);
      if (scopes.length > 8) {
        for (const staleScope of scopes.slice(0, scopes.length - 8)) delete cache.entries[staleScope];
      }
      await writeAntigravityCatalogCache(cacheFilePath, cache);
    }).catch(() => {
    });
    return persistWrite;
  };
  const refresh = (scope) => {
    if (pending.has(scope)) return pending.get(scope);
    const promise = Promise.resolve(commandRunner(resolvedCliPath, ["models"], {
      env,
      timeoutMs
    })).then(async (result) => {
      let registry = [];
      if (typeof registryLoader === "function") {
        try {
          registry = await registryLoader();
        } catch {
        }
      }
      const liveModels = parseAntigravityModelCatalog(result.output);
      const models = enrichAntigravityModelCatalog(
        liveModels,
        mergedAntigravityRegistry(registry, liveModels.map((model) => model.id))
      );
      const enriched = models.some((model, index) => {
        const original = liveModels[index];
        return model.contextWindow !== original?.contextWindow || model.maxTokens !== original?.maxTokens;
      });
      const value = {
        models,
        source: enriched ? "official_antigravity_cli+model_registry" : "official_antigravity_cli"
      };
      cached.set(scope, { value, cachedAt: Date.now() });
      await persist(scope, value);
      return value;
    }).catch((error) => {
      const previous = cached.get(scope)?.value;
      if (previous?.models?.length) {
        return {
          ...previous,
          source: `${previous.source ?? "official_antigravity_cli"}_stale`,
          diagnostics: [redactError(error)]
        };
      }
      const unavailable = {
        models: [],
        source: error?.code === "ENOENT" ? "antigravity_cli_not_found" : "antigravity_cli_unavailable",
        diagnostics: [redactError(error)]
      };
      cached.set(scope, { value: unavailable, cachedAt: Date.now() });
      return unavailable;
    }).finally(() => {
      pending.delete(scope);
    });
    pendingRefreshes.add(promise);
    promise.finally(() => pendingRefreshes.delete(promise)).catch(() => {
    });
    pending.set(scope, promise);
    return promise;
  };
  const loadCatalog = async function loadCatalog2({ force = false, accounts = [] } = {}) {
    const scope = catalogScopeKey(accounts);
    let entry = cached.get(scope);
    if (!entry) {
      const persisted = await loadPersistent();
      const stored = persistentCache?.entries?.[scope] ?? persisted.entries?.[scope];
      if (stored?.value && Array.isArray(stored.value.models)) {
        entry = {
          value: {
            ...stored.value,
            source: `${stored.value.source ?? "official_antigravity_cli"}_persistent_cache`
          },
          cachedAt: 0
        };
        cached.set(scope, entry);
      }
    }
    const fresh = entry && entry.cachedAt > 0 && Date.now() - entry.cachedAt < cacheTtlMs;
    if (!force && fresh) return entry.value;
    if (!force && entry) {
      void refresh(scope).catch(() => {
      });
      return entry.value;
    }
    return refresh(scope);
  };
  loadCatalog.whenIdle = async () => {
    await Promise.allSettled([...pendingRefreshes]);
    await persistWrite.catch(() => {
    });
  };
  return loadCatalog;
}
function quotaGroups(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.groups)) return data.groups;
  if (Array.isArray(data.quota_groups)) return data.quota_groups;
  if (Array.isArray(data.quotaGroups)) return data.quotaGroups;
  return [];
}
function findQuotaData(value, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  if (quotaGroups(value).length > 0) return value;
  for (const key of ["command", "data", "response", "quota_summary", "quotaSummary", "result"]) {
    const found = findQuotaData(value[key], depth + 1, seen);
    if (found) return found;
  }
  return null;
}
function findCreditsData(value, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  if (Object.hasOwn(value, "remaining_credits") || Object.hasOwn(value, "remainingCredits")) return value;
  for (const child of Object.values(value)) {
    const found = findCreditsData(child, depth + 1, seen);
    if (found) return found;
  }
  return null;
}
function creditsFromData(data) {
  if (!data || typeof data !== "object") return null;
  const remaining = finiteNumber(data.remaining_credits ?? data.remainingCredits);
  const upgradeUri = stringValue(data.upgrade_uri ?? data.upgradeUri);
  if (remaining === null && upgradeUri === null) return null;
  return { remaining, upgradeUri };
}
function parseQuotaData(data, now = /* @__PURE__ */ new Date(), source = "antigravity_cli") {
  const windows = [];
  for (const group of quotaGroups(data)) {
    for (const bucket of group?.buckets ?? []) {
      const fraction = finiteNumber(bucket.remaining_fraction ?? bucket.remainingFraction);
      const percent = finiteNumber(bucket.remaining_percent ?? bucket.remainingPercent);
      const remaining = fraction ?? (percent === null ? null : percent / 100);
      windows.push({
        id: stringValue(bucket.id) ?? `${group.name ?? "group"}:${bucket.name ?? "window"}`,
        name: [group.name, bucket.name].filter(Boolean).join(" / ") || null,
        remaining,
        limit: remaining === null ? null : 1,
        unit: remaining === null ? null : "fraction",
        resetAt: isoFromEpoch(bucket.reset_time ?? bucket.resetTime),
        updatedAt: now.toISOString(),
        source
      });
    }
  }
  return windows;
}
function parseQuotaText(text3, now = /* @__PURE__ */ new Date(), source = "antigravity_cli") {
  const windows = [];
  for (const line of text3.split(/\r?\n/)) {
    const parts = line.split("	");
    if (parts.length < 3 || !/%$/.test(parts[2])) continue;
    const remaining = finiteNumber(parts[2].replace(/%$/, ""));
    if (remaining === null) continue;
    windows.push({
      id: `${parts[0]}:${parts[1]}`,
      name: `${parts[0]} / ${parts[1]}`,
      remaining,
      limit: 100,
      unit: "percent",
      resetAt: isoFromEpoch(parts[3]),
      updatedAt: now.toISOString(),
      source
    });
  }
  return windows;
}
function parseAntigravityNativeQuota(value, now = /* @__PURE__ */ new Date()) {
  const data = findQuotaData(value);
  let windows = parseQuotaData(data, now, "antigravity_native");
  if (windows.length === 0) {
    windows = recursiveQuotaWindows(value, { source: "antigravity_native", now, prefix: "antigravity" });
  }
  const credits = findCreditsData(value);
  return {
    windows,
    credits: credits ? {
      remaining: finiteNumber(credits.remaining_credits ?? credits.remainingCredits),
      upgradeUri: stringValue(credits.upgrade_uri ?? credits.upgradeUri)
    } : null
  };
}
function candidate(now, {
  email = null,
  session = null,
  existingAccounts = [],
  source = "official_antigravity_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  credentialRefreshMode: credentialRefreshMode2 = null
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  const capturedSession = normalizedEmail && session && !session.email ? { ...session, email: normalizedEmail } : session;
  const fingerprint = sessionFingerprint(capturedSession);
  const stableAccountId = normalizedEmail ? `antigravity:google:${hash2(`email:${normalizedEmail.toLowerCase()}`).slice(0, 20)}` : fingerprint ? `antigravity:session:${hash2(`fingerprint:${fingerprint}`).slice(0, 20)}` : "antigravity:active";
  const known = existingAccounts.find((account) => fingerprint && account?.resources?.sessionFingerprint === fingerprint || sameEmail(account?.email, normalizedEmail));
  const legacy = existingAccounts.find((account) => account?.accountId === "antigravity:active");
  const accountId = known?.accountId ?? (legacy && !legacy.resources?.sessionFingerprint && stableAccountId !== "antigravity:active" ? legacy.accountId : stableAccountId);
  const identityLabel = normalizedEmail ?? (fingerprint ? `Antigravity \u5B98\u65B9\u4F1A\u8BDD \xB7 ${fingerprint}` : "Antigravity \u5B98\u65B9\u5F53\u524D\u4F1A\u8BDD");
  const identitySource = normalizedEmail ? "official_cli_auth_status" : fingerprint ? "local_oauth_session_fingerprint" : "official_active_session";
  const credentialRef = createCredentialRef(PROVIDER_ID3, accountId);
  const value = {
    candidateId: `antigravity:${hash2(accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID3,
    source,
    accountId,
    displayName: identityLabel,
    email: normalizedEmail,
    subscription: { plan: null, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: capturedSession?.expiresAt ?? null,
      nextRefreshAt: null,
      lastRefreshedAt: capturedSession?.lastRefreshedAt ?? null,
      refreshable: capturedSession?.refreshToken ? true : null
    },
    imported: false,
    status: "available",
    diagnostic: null,
    credentialRef,
    resources: {
      ...officialSessionResources({ sourceKind, authSource: source }),
      ...credentialRefreshMode2 ? { credentialRefreshMode: credentialRefreshMode2 } : {},
      identitySource,
      identityLabel,
      ...fingerprint ? { sessionFingerprint: fingerprint } : {},
      identityNote: normalizedEmail ? "\u8D26\u53F7\u90AE\u7BB1\u6765\u81EA\u5B98\u65B9 Antigravity \u767B\u5F55\u6001" : fingerprint ? "\u5B98\u65B9\u767B\u5F55\u6001\u672A\u8FD4\u56DE\u90AE\u7BB1\uFF1B\u4F7F\u7528\u4F1A\u8BDD\u6307\u7EB9\u533A\u5206\u8D26\u53F7" : "\u5B98\u65B9\u53EA\u8FD4\u56DE\u5F53\u524D\u4F1A\u8BDD\uFF1B\u5207\u6362\u8D26\u53F7\u540E\u8BF7\u91CD\u65B0\u626B\u63CF",
      sessionPersistence: capturedSession?.token ? "captured" : "active"
    }
  };
  Object.defineProperty(value, CREDENTIAL_SLOT2, {
    value: {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID3,
      ...capturedSession?.token ? { access: capturedSession.token } : {},
      ...capturedSession?.refreshToken ? { refresh: capturedSession.refreshToken } : {},
      ...normalizedEmail ? { email: normalizedEmail } : {},
      ...capturedSession?.expiresAt ? { expiresAt: capturedSession.expiresAt } : {},
      ...capturedSession?.lastRefreshedAt ? { lastRefreshedAt: capturedSession.lastRefreshedAt } : {}
    },
    enumerable: false
  });
  return value;
}
function summarizeAntigravityCandidate(value) {
  return {
    providerId: PROVIDER_ID3,
    candidateId: value.candidateId,
    source: value.source,
    accountId: value.accountId,
    displayName: value.displayName,
    email: value.email,
    subscription: { ...value.subscription },
    refresh: { ...value.refresh },
    resources: { ...value.resources },
    imported: Boolean(value.imported),
    status: value.status ?? "available",
    diagnostic: value.diagnostic ?? null
  };
}
var ANTIGRAVITY_AUTH_URL_PATTERN = /https:\/\/accounts\.google\.com\/o\/oauth2\/(?:v2\/)?auth\?[^\s"'<>]+/i;
function cleanAntigravityAuthUrl(value) {
  return String(value ?? "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[),.;]+$/, "");
}
function publicAntigravityAuthSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: PROVIDER_ID3,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    ...session.browserOpened ? { browserOpened: true } : {},
    ...session.inputRequired ? { inputRequired: true } : {},
    diagnostic: session.diagnostic ?? null
  };
}
function createAntigravityOAuthAuthorizer({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  environment = process.env,
  home = homedir4(),
  timeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  prompt = "Reply with OK",
  spawnImpl = spawn4,
  tokenReader = readAntigravityTokenFile,
  usePty = process.platform === "darwin",
  ptyPythonPath = process.env.DOCKYARD_ANTIGRAVITY_PTY_PYTHON || "python3",
  instructions = "\u5DF2\u6253\u5F00 Google \u5B98\u65B9\u9A8C\u8BC1\u9875\uFF1B\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u9A8C\u8BC1\u540E\uFF0CDSH \u4F1A\u81EA\u52A8\u63A5\u5165\u3002"
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env: environment, home });
  if (!resolvedCliPath) throw new Error("Antigravity OAuth authorizer requires an agy CLI path");
  if (typeof spawnImpl !== "function") throw new Error("Antigravity OAuth authorizer requires a process spawner");
  if (typeof tokenReader !== "function") throw new Error("Antigravity OAuth authorizer requires a token reader");
  const sessions = /* @__PURE__ */ new Map();
  async function cleanup(session) {
    if (!session.profileDir) return;
    await rm3(session.profileDir, { recursive: true, force: true }).catch(() => {
    });
    session.profileDir = null;
  }
  function capture(session, chunk) {
    session.output = `${session.output}${String(chunk ?? "")}`.slice(-32e3);
    if (!session.authorizationUrl) {
      const match = session.output.match(ANTIGRAVITY_AUTH_URL_PATTERN);
      if (match?.[0]) session.authorizationUrl = cleanAntigravityAuthUrl(match[0]);
    }
    if (/authorization code|redirect URL/i.test(session.output)) session.inputRequired = true;
  }
  function readToken(session) {
    try {
      return tokenReader({ env: session.childEnv, home: session.profileDir });
    } catch {
      return null;
    }
  }
  async function finalize(session, context, credential = null) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        const auth = credential ?? readToken(session);
        if (!auth?.token) {
          if (session.exitCode === null) return publicAntigravityAuthSession(session);
          session.status = "failed";
          session.diagnostic = session.timedOut ? "Google \u9A8C\u8BC1\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002" : session.launchError ? `\u65E0\u6CD5\u542F\u52A8 agy \u5B98\u65B9\u9A8C\u8BC1\uFF1A${session.launchError}` : `agy \u5B98\u65B9\u9A8C\u8BC1\u672A\u5B8C\u6210\uFF08\u9000\u51FA\u7801 ${session.exitCode ?? "unknown"}\uFF09\u3002`;
          return publicAntigravityAuthSession(session);
        }
        if (session.child && session.exitCode === null) session.child.kill("SIGTERM");
        const account = candidate(context?.now instanceof Date ? context.now : /* @__PURE__ */ new Date(), {
          email: extractAntigravityAccountEmail(session.output),
          session: auth,
          existingAccounts: context?.accounts ?? [],
          // agy's isolated temporary profile is a browser OAuth session, not
          // the user's active local CLI session. Mark it accordingly so quota
          // refresh and request execution use the captured credential instead
          // of rejecting it as a session mismatch. Its refresh token belongs
          // to agy's own OAuth client, so DSH must not exchange it with an
          // unrelated/empty browser client.
          source: "official_antigravity_browser_oauth",
          sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
          credentialRefreshMode: ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION
        });
        session.status = "completed";
        session.result = {
          ...publicAntigravityAuthSession(session),
          status: "completed",
          accounts: [account],
          diagnostic: null
        };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicAntigravityAuthSession(session);
      } finally {
        if (session.status === "completed" || session.status === "failed") {
          if (session.timer) clearTimeout(session.timer);
          await cleanup(session);
        }
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const profileDir = await mkdtemp2(join6(tmpdir2(), "dockyard-antigravity-oauth-"));
    const tokenPath = join6(profileDir, ".gemini", "antigravity-cli", "antigravity-oauth-token");
    const childEnv = {
      ...environment,
      HOME: profileDir,
      XDG_CONFIG_HOME: join6(profileDir, ".config"),
      DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath
    };
    childEnv.PATH = augmentPathWithUserBins(childEnv, home);
    delete childEnv.AGY_CLI_HIDE_ACCOUNT_INFO;
    const session = {
      sessionId: `${PROVIDER_ID3}:${randomUUID4()}`,
      providerId: PROVIDER_ID3,
      profileDir,
      childEnv,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      // agy owns the official browser OAuth flow and opens this URL itself.
      // The DSH host must not open the captured URL a second time.
      browserOpened: true,
      exitCode: null,
      launchError: null,
      output: "",
      inputRequired: false,
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      const command = usePty ? ptyPythonPath : resolvedCliPath;
      const args = usePty ? ["-u", "-c", ANTIGRAVITY_PTY_SCRIPT, resolvedCliPath, "-p", prompt, "--output-format", "json"] : ["-p", prompt, "--output-format", "json"];
      const child = spawnImpl(command, args, {
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => capture(session, chunk));
      child.stderr?.on("data", (chunk) => capture(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicAntigravityAuthSession(session);
  }
  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId: PROVIDER_ID3,
        status: "missing",
        instructions,
        diagnostic: "\u9A8C\u8BC1\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
      };
    }
    if (session.result) return session.result;
    const credential = readToken(session);
    if (!credential?.token && session.exitCode === null) return publicAntigravityAuthSession(session);
    const result = await finalize(session, context, credential);
    if (!["pending", "processing"].includes(result.status)) sessions.delete(sessionId);
    return result;
  }
  async function submitAuthorizationCode(sessionId, value) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error("\u9A8C\u8BC1\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7");
    const code = String(value ?? "").trim();
    if (!code) throw new Error("\u8BF7\u8F93\u5165 Google \u9A8C\u8BC1\u7801\u6216\u56DE\u8C03\u5730\u5740");
    if (code.length > 4096 || /[\u0000-\u001f\u007f]/.test(code)) {
      throw new Error("Google \u9A8C\u8BC1\u7801\u6216\u56DE\u8C03\u5730\u5740\u683C\u5F0F\u65E0\u6548");
    }
    if (!session.child || session.exitCode !== null || !session.child.stdin?.writable) {
      throw new Error("agy \u9A8C\u8BC1\u8FDB\u7A0B\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7");
    }
    session.child.stdin.write(`${code}
`);
    session.inputRequired = false;
    session.status = "processing";
    session.instructions = "\u6388\u6743\u7801\u5DF2\u63D0\u4EA4\uFF0C\u6B63\u5728\u7B49\u5F85\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\u3002";
    return publicAntigravityAuthSession(session);
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId: PROVIDER_ID3, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    if (session.child && session.exitCode === null) session.child.kill("SIGTERM");
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId: PROVIDER_ID3, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, cancel, submitAuthorizationCode });
}
var AntigravityOfficialSessionDriver = class {
  constructor({
    cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
    env = process.env,
    home = homedir4(),
    cacheFilePath,
    timeoutMs = 3e4,
    commandRunner = runCommand,
    ptyPythonPath = process.env.DOCKYARD_ANTIGRAVITY_PTY_PYTHON || "python3",
    // Background refresh is a non-interactive `agy models` call. The PTY is
    // only needed for the browser bootstrap authorizer; wrapping this refresh
    // in a PTY makes agy report a false exit-code failure on macOS.
    usePtyForSessionRefresh = false,
    requestExecutor = null,
    catalogLoader = null,
    quotaReader = null,
    tokenResolver = resolveAntigravityAccessToken,
    identityFromOfficialCli = true,
    identityFromOfficialSession = identityFromOfficialCli,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_ANTIGRAVITY_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL || ANTIGRAVITY_BROWSER_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_ANTIGRAVITY_TOKEN_URL || ANTIGRAVITY_BROWSER_TOKEN_URL,
    userInfoUrl = env.DOCKYARD_ANTIGRAVITY_USERINFO_URL || ANTIGRAVITY_BROWSER_USERINFO_URL,
    clientId = env.DOCKYARD_ANTIGRAVITY_CLIENT_ID || ANTIGRAVITY_BROWSER_CLIENT_ID,
    clientSecret = env.DOCKYARD_ANTIGRAVITY_CLIENT_SECRET || ANTIGRAVITY_BROWSER_CLIENT_SECRET,
    oauthScope = env.DOCKYARD_ANTIGRAVITY_OAUTH_SCOPE || ANTIGRAVITY_BROWSER_SCOPES,
    redirectUri = env.DOCKYARD_ANTIGRAVITY_REDIRECT_URI || ANTIGRAVITY_BROWSER_REDIRECT_URI,
    fetchImpl = fetch,
    authorizationTimeoutMs = DEFAULT_AUTH_TIMEOUT_MS
  } = {}) {
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL");
    const resolvedCli = resolveAgyCliPath(cliPath, { env, home });
    this.cliPath = resolvedCli;
    this.env = env;
    this.home = home;
    this.timeoutMs = timeoutMs;
    this.commandRunner = commandRunner;
    this.ptyPythonPath = ptyPythonPath;
    this.usePtyForSessionRefresh = usePtyForSessionRefresh;
    this.fetchImpl = fetchImpl;
    this.browserTokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_ANTIGRAVITY_TOKEN_URL");
    this.browserUserInfoUrl = userInfoUrl ? assertSecureEndpointUrl(userInfoUrl, "DOCKYARD_ANTIGRAVITY_USERINFO_URL") : userInfoUrl;
    this.browserClientId = clientId;
    this.browserClientSecret = clientSecret;
    this.requestExecutor = requestExecutor;
    this.quotaReader = quotaReader;
    this.tokenResolver = tokenResolver;
    this.identityFromOfficialSession = identityFromOfficialSession;
    this.cliOAuthAuthorizer = createAntigravityOAuthAuthorizer({
      cliPath: resolvedCli,
      environment: env,
      home,
      timeoutMs: authorizationTimeoutMs
    });
    const browserOAuthConfigured = Boolean(clientId && clientSecret);
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth && browserOAuthConfigured ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID3,
      redirectUri,
      callbackPath: new URL(redirectUri).pathname,
      callbackHost: new URL(redirectUri).hostname,
      callbackPort: Number(new URL(redirectUri).port || 51121),
      instructions: "\u8BF7\u5728 Google \u5B98\u65B9\u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: ({ state, codeChallenge, redirectUri: callback }) => `${authorizationUrl}?${new URLSearchParams({
        access_type: "offline",
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "consent",
        redirect_uri: callback,
        response_type: "code",
        scope: oauthScope,
        state
      })}`,
      exchangeCode: async ({ code, codeVerifier, redirectUri: redirectUri2, context }) => {
        const response = await this.fetchImpl(tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri2
          }),
          ...context.signal ? { signal: context.signal } : {}
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.access_token) {
          throw new Error(`Antigravity Google token exchange failed (${response.status})`);
        }
        return body;
      },
      importCredentials: async (tokens, context) => {
        const access2 = tokens?.access_token ?? tokens?.accessToken;
        const refresh = tokens?.refresh_token ?? tokens?.refreshToken;
        if (!access2) throw new Error("Antigravity Google OAuth did not return an access token");
        let profile = null;
        try {
          const response = await this.fetchImpl(userInfoUrl, {
            headers: { authorization: `Bearer ${access2}` },
            ...context.signal ? { signal: context.signal } : {}
          });
          if (response.ok) profile = await response.json().catch(() => null);
        } catch {
        }
        const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
        const candidateValue = candidate(now, {
          email: profile?.email,
          session: {
            token: access2,
            refreshToken: refresh,
            expiresAt: tokenExpiresAt(tokens, now),
            lastRefreshedAt: now.toISOString()
          },
          existingAccounts: context.accounts ?? [],
          source: "official_antigravity_browser_oauth",
          sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
          credentialRefreshMode: ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.DSH_BROWSER_OAUTH
        });
        return [await this.importAccount(candidateValue, context)];
      }
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliOAuthAuthorizer;
    this.catalogLoader = catalogLoader ?? createAntigravityCatalogLoader({
      cliPath: resolvedCli,
      env,
      home,
      ...cacheFilePath !== void 0 ? { cacheFilePath } : {},
      timeoutMs,
      commandRunner
    });
  }
  async #slash(command, signal) {
    const result = await this.commandRunner(this.cliPath, ["-p", command, "--output-format", "json"], {
      env: this.env,
      timeoutMs: this.timeoutMs,
      includeAccountInfo: true,
      ...signal ? { signal } : {}
    });
    const parsed = parseJsonOutput2(result.output);
    return { ...result, parsed };
  }
  async #resolveSessionEmail(session, context = {}) {
    const direct = extractAntigravityAccountEmail(session);
    if (direct) return direct;
    if (!session?.token || typeof this.fetchImpl !== "function" || !this.browserUserInfoUrl) return null;
    try {
      const response = await this.fetchImpl(this.browserUserInfoUrl, {
        headers: { authorization: `Bearer ${session.token}` },
        ...context.signal ? { signal: context.signal } : {}
      });
      if (!response?.ok) return null;
      return extractAntigravityAccountEmail(await response.json().catch(() => null));
    } catch {
      return null;
    }
  }
  async #assertActiveSession(account, context = {}) {
    if (!isOfficialSessionAuthKind(account?.auth?.kind)) return;
    if (account.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return;
    const expectedFingerprint = account.resources?.sessionFingerprint;
    if (expectedFingerprint) {
      let current;
      try {
        current = await this.tokenResolver({ env: this.env });
      } catch {
        throw activeSessionError("Antigravity OAuth session is unavailable; authorize again");
      }
      if (!current?.token || sessionFingerprint(current) !== expectedFingerprint) {
        if (current?.token && context.allowSessionTokenRotation === true) return;
        const currentEmail = await this.#resolveSessionEmail(current, context);
        if (currentEmail && account.email && sameEmail(currentEmail, account.email)) return;
        throw activeSessionError(
          "Antigravity selected account is not the active local session; authorize it again",
          { mismatch: true }
        );
      }
      return;
    }
    if (account.accountId === "antigravity:active" && !account.email) return;
    let result;
    try {
      result = await this.#slash("/quota", context.signal);
    } catch {
      throw activeSessionError("Antigravity active session could not be verified; authorize again");
    }
    const email = extractAntigravityAccountEmail(result.parsed, result.output, result.errorOutput);
    if (account.email && email && sameEmail(account.email, email)) return;
    throw activeSessionError(
      "Antigravity selected account is not the active local session; authorize it again",
      { mismatch: true }
    );
  }
  async #refreshOfficialCredential(account, context = {}) {
    if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return null;
    if (typeof this.tokenResolver !== "function") return null;
    let current;
    try {
      current = await this.tokenResolver({ env: this.env });
    } catch (error) {
      const wrapped = activeSessionError(`Antigravity official session could not be read: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
    if (!current?.token) return null;
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const credential = {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID3,
      access: current.token,
      ...current.refreshToken ? { refresh: current.refreshToken } : {},
      ...current.expiresAt ? { expiresAt: current.expiresAt } : {}
    };
    const rotated = current.source === "antigravity_keychain" && Boolean(account?.resources?.sessionFingerprint) && sessionFingerprint(current) !== account.resources?.sessionFingerprint;
    if (!tokenNeedsRefresh(credential, now)) {
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (current.source === "antigravity_keychain" && credentialRef && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, credential);
      }
      return { session: current, credential, rotated };
    }
    if (!current.refreshToken) {
      throw activeSessionError("Antigravity official session has expired; authorize again");
    }
    const officialTokenPath = officialAntigravityTokenPath(this.env);
    const officialHome = this.env.HOME || homedir4();
    const childEnv = agyRefreshEnvironment(this.env, officialTokenPath);
    try {
      await mkdir3(dirname4(officialTokenPath), { recursive: true, mode: 448 });
      const refreshCommand = this.usePtyForSessionRefresh ? this.ptyPythonPath : this.cliPath;
      const refreshArgs = this.usePtyForSessionRefresh ? ["-u", "-c", ANTIGRAVITY_PTY_SCRIPT, this.cliPath, "models"] : ["models"];
      await this.commandRunner(refreshCommand, refreshArgs, {
        env: childEnv,
        timeoutMs: this.timeoutMs,
        signal: context.signal
      });
      let refreshed = null;
      try {
        refreshed = await this.tokenResolver({ env: this.env });
      } catch {
      }
      refreshed = refreshed?.token ? refreshed : readAntigravityTokenFile({ env: childEnv, home: officialHome });
      if (!refreshed?.token) throw new Error("agy did not persist a refreshed OAuth token");
      const nextCredential = {
        ...credential,
        access: refreshed.token,
        ...refreshed.refreshToken ? { refresh: refreshed.refreshToken } : {},
        ...refreshed.expiresAt ? { expiresAt: refreshed.expiresAt } : {},
        lastRefreshedAt: now.toISOString()
      };
      const expiry = nextCredential.expiresAt ? Date.parse(nextCredential.expiresAt) : Number.NaN;
      const expiryAdvanced = Number.isFinite(expiry) && expiry > now.getTime() + 6e4;
      if (nextCredential.access === credential.access && !expiryAdvanced) {
        throw new Error("agy did not advance the Antigravity OAuth token expiry");
      }
      await mkdir3(dirname4(officialTokenPath), { recursive: true, mode: 448 });
      const persistedPath = `${officialTokenPath}.${randomUUID4()}.tmp`;
      try {
        await writeFile2(persistedPath, JSON.stringify({
          auth_method: "consumer",
          token: {
            access_token: nextCredential.access,
            refresh_token: nextCredential.refresh,
            token_type: "Bearer",
            ...nextCredential.expiresAt ? { expiry: nextCredential.expiresAt } : {}
          }
        }), { encoding: "utf8", mode: 384 });
        await rename2(persistedPath, officialTokenPath);
      } finally {
        await rm3(persistedPath, { force: true }).catch(() => {
        });
      }
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (credentialRef && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, nextCredential);
      }
      return { session: refreshed, credential: nextCredential, rotated: true };
    } catch (error) {
      if (error?.authExpired) throw error;
      const wrapped = activeSessionError(`Antigravity official session refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }
  async #refreshAgyCredential(credential, context = {}) {
    if (!credential?.refresh) {
      throw activeSessionError("Antigravity agy session has no refresh token; authorize again");
    }
    const tokenPath = officialAntigravityTokenPath(this.env);
    const officialHome = this.env.HOME || homedir4();
    const childEnv = agyRefreshEnvironment(this.env, tokenPath);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    try {
      await mkdir3(dirname4(tokenPath), { recursive: true, mode: 448 });
      if (!readAntigravityTokenFile({ env: childEnv, home: officialHome })?.token) {
        await writeFile2(tokenPath, JSON.stringify({
          auth_method: "consumer",
          token: {
            access_token: credential.access,
            refresh_token: credential.refresh,
            token_type: "Bearer",
            ...credential.expiresAt ? { expiry: credential.expiresAt } : {}
          }
        }), { encoding: "utf8", mode: 384 });
      }
      await this.commandRunner(this.cliPath, ["models"], {
        env: childEnv,
        timeoutMs: this.timeoutMs,
        signal: context.signal
      });
      let refreshed = null;
      try {
        refreshed = await this.tokenResolver({ env: this.env });
      } catch {
      }
      refreshed = refreshed?.token ? refreshed : readAntigravityTokenFile({ env: childEnv, home: officialHome });
      if (!refreshed?.token) {
        throw new Error("agy did not persist a refreshed OAuth token");
      }
      const next = {
        ...credential,
        access: refreshed.token,
        ...refreshed.refreshToken ? { refresh: refreshed.refreshToken } : {},
        ...refreshed.expiresAt ? { expiresAt: refreshed.expiresAt } : {},
        lastRefreshedAt: now.toISOString()
      };
      const accessChanged = next.access !== credential.access;
      const expiry = next.expiresAt ? Date.parse(next.expiresAt) : Number.NaN;
      const expiryAdvanced = Number.isFinite(expiry) && expiry > now.getTime() + 6e4;
      if (!accessChanged && !expiryAdvanced) {
        throw new Error("agy did not advance the Antigravity OAuth token expiry");
      }
      return next;
    } catch (error) {
      if (error?.authExpired) throw error;
      const wrapped = activeSessionError(`Antigravity agy session refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }
  async #refreshBrowserCredential(account, context = {}) {
    if (account?.resources?.sessionSource !== OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return null;
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    if (!credentialRef || typeof context.secretStore?.read !== "function") {
      throw activeSessionError("Antigravity browser OAuth credential is unavailable; authorize again");
    }
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) {
      throw activeSessionError("Antigravity browser OAuth credential is missing; authorize again");
    }
    const refreshMode = credentialRefreshMode(account);
    const dshManagedRefresh = refreshMode !== ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION;
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    if (refreshMode === ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION) {
      if (!tokenNeedsRefresh(credential, now)) return credential;
      const updated2 = await this.#refreshAgyCredential(credential, context);
      await context.secretStore.write(credentialRef, updated2);
      return updated2;
    }
    if (!dshManagedRefresh || !this.browserClientId || !this.browserClientSecret) return credential;
    if (!tokenNeedsRefresh(credential, now)) return credential;
    if (!credential.refresh) {
      throw activeSessionError("Antigravity browser OAuth token expired; authorize again");
    }
    let response;
    try {
      response = await this.fetchImpl(this.browserTokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.browserClientId,
          client_secret: this.browserClientSecret,
          grant_type: "refresh_token",
          refresh_token: credential.refresh
        }),
        ...context.signal ? { signal: context.signal } : {}
      });
    } catch (error) {
      const wrapped = activeSessionError(`Antigravity Google OAuth refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      const error = activeSessionError("Antigravity Google OAuth refresh failed; authorize again");
      error.status = response.status;
      throw error;
    }
    const updated = {
      ...credential,
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      expiresAt: tokenExpiresAt(body, now) ?? credential.expiresAt ?? null,
      lastRefreshedAt: now.toISOString()
    };
    await context.secretStore.write(credentialRef, updated);
    return updated;
  }
  async #nativeQuota(account, context, now) {
    if (typeof this.quotaReader !== "function") return null;
    let credential = null;
    const credentialRef = account?.auth?.credentialRef;
    if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) {
      credential = await this.#refreshBrowserCredential(account, context);
    } else if (context.officialCredential) {
      credential = context.officialCredential;
    } else if (credentialRef && context.secretStore && typeof context.secretStore.read === "function") {
      credential = await context.secretStore.read(credentialRef);
    }
    const value = await this.quotaReader({ account, credential, context });
    const parsed = parseAntigravityNativeQuota(value, now);
    if (parsed.windows.length === 0 && !parsed.credits) return null;
    return parsed;
  }
  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    try {
      let session = null;
      try {
        session = typeof this.tokenResolver === "function" ? await this.tokenResolver({ env: this.env }) : null;
      } catch {
      }
      let windows = [];
      let source = "official_antigravity_cli";
      try {
        const native = await this.#nativeQuota(null, context, now);
        windows = native?.windows ?? [];
        if (windows.length > 0) source = "antigravity_native";
      } catch {
      }
      let result = null;
      let cliIdentityError = null;
      if (windows.length === 0 || this.identityFromOfficialSession) {
        try {
          result = await this.#slash("/quota", context.signal);
          const data = result.parsed?.command?.data;
          if (windows.length === 0) {
            windows = parseQuotaData(data, now);
            if (windows.length === 0) windows = parseQuotaText(result.parsed?.response ?? "", now);
          }
        } catch (error) {
          cliIdentityError = error;
          if (windows.length === 0) throw error;
        }
      }
      const email = extractAntigravityAccountEmail(
        result?.parsed,
        result?.output,
        result?.errorOutput
      ) ?? await this.#resolveSessionEmail(session, context);
      const found = candidate(now, {
        email,
        session,
        existingAccounts: context.accounts ?? [],
        source,
        sourceKind: source === "antigravity_native" ? session?.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE : OFFICIAL_SESSION_SOURCE_KINDS.CLI
      });
      found.status = windows.length ? "available" : "degraded";
      found.diagnostic = windows.length ? null : source === "antigravity_native" ? "\u5B98\u65B9\u4F1A\u8BDD\u5DF2\u8BFB\u53D6\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u7ED3\u6784\u5316 quota \u7A97\u53E3" : "\u5B98\u65B9 CLI \u5DF2\u542F\u52A8\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u7ED3\u6784\u5316 quota \u7A97\u53E3";
      return {
        candidates: [found],
        source,
        diagnostics: [
          ...result?.parsed?.status === "SUCCESS" || !result ? [] : ["Antigravity CLI \u8FD4\u56DE\u4E86\u975E\u6210\u529F\u72B6\u6001"],
          ...cliIdentityError && windows.length ? ["\u5B98\u65B9 CLI \u8D26\u53F7\u8EAB\u4EFD\u6682\u672A\u8FD4\u56DE\uFF1B\u5DF2\u4F7F\u7528\u672C\u5730\u4F1A\u8BDD\u6807\u8BC6"] : []
        ]
      };
    } catch (error) {
      return {
        candidates: [],
        source: "official_antigravity_cli",
        diagnostics: [`\u65E0\u6CD5\u8BFB\u53D6 Antigravity \u5B98\u65B9\u4F1A\u8BDD\uFF1A${redactError(error)}`]
      };
    }
  }
  async importAccount(value, context = {}) {
    const session = value?.[CREDENTIAL_SLOT2];
    if (!session) throw new Error("Antigravity candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(value.credentialRef, session);
    return {
      providerId: PROVIDER_ID3,
      accountId: value.accountId,
      credentialRef: value.credentialRef,
      displayName: value.displayName,
      email: value.email ?? null,
      auth: { kind: OFFICIAL_SESSION_AUTH_KIND, scopes: [] },
      subscription: { plan: null, status: null, expiresAt: null },
      refresh: {
        accessTokenExpiresAt: session.expiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: session.lastRefreshedAt ?? null,
        refreshable: session.refresh ? true : null
      },
      resources: {
        ...officialSessionResources({
          sourceKind: value.resources?.sessionSource ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
          authSource: value.source ?? "official_antigravity_cli_session"
        }),
        transport: "gemini_stream_generate_content_sse",
        quotaSource: value.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP ? "official_client_status" : value.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? "antigravity_browser_oauth" : "antigravity_cli_status",
        ...value.resources ?? {}
      }
    };
  }
  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      const candidateValue = discovered?.candidates?.[0];
      if (!candidateValue) return null;
      const account = await this.importAccount(candidateValue, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID3,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Antigravity \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts: [account],
        diagnostic: null
      };
    } catch (error) {
      return {
        status: "failed",
        providerId: PROVIDER_ID3,
        instructions: "\u672A\u80FD\u8BFB\u53D6 Antigravity \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u6216\u767B\u5F55\u3002",
        accounts: [],
        diagnostic: redactError(error)
      };
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliOAuthAuthorizer.begin(context);
    return started;
  }
  #authorizationAuthorizer(sessionId) {
    if (sessionId?.includes(":browser:")) return this.browserAuthorizer;
    return this.oauthAuthorizer === this.browserAuthorizer ? this.cliOAuthAuthorizer : this.oauthAuthorizer;
  }
  async pollAuthorization(sessionId, context = {}) {
    return this.#authorizationAuthorizer(sessionId).poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    return this.#authorizationAuthorizer(sessionId).submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    return this.#authorizationAuthorizer(sessionId).cancel(sessionId, context);
  }
  async refreshAccount(account, context = {}) {
    const browserCredential = await this.#refreshBrowserCredential(account, context);
    const officialCredential = await this.#refreshOfficialCredential(account, context);
    await this.#assertActiveSession(account, {
      ...context,
      ...officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}
    });
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    let session = officialCredential?.session ?? null;
    try {
      session = session ?? await this.tokenResolver({ env: this.env });
    } catch {
    }
    const sessionEmail = await this.#resolveSessionEmail(session, context);
    const fingerprint = sessionFingerprint(sessionEmail && session && !session.email ? { ...session, email: sessionEmail } : session);
    const fingerprintResources = fingerprint ? { sessionFingerprint: fingerprint } : {};
    const persistedRefreshMode = account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? credentialRefreshMode(account) ?? (!this.browserClientId || !this.browserClientSecret ? ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION : null) : null;
    const identityPatch = sessionEmail ? { email: sessionEmail } : {};
    let nativeError = null;
    try {
      const native = await this.#nativeQuota(account, {
        ...context,
        ...officialCredential?.credential ? { officialCredential: officialCredential.credential } : {}
      }, now);
      if (native) {
        const primary2 = selectPrimaryQuotaWindow(native.windows);
        return {
          ...identityPatch,
          quota: {
            ...primary2,
            windows: native.windows,
            updatedAt: now.toISOString(),
            source: "antigravity_native"
          },
          credits: native.credits,
          resources: {
            quotaSource: "antigravity_native",
            ...persistedRefreshMode ? { credentialRefreshMode: persistedRefreshMode } : {},
            ...fingerprintResources
          },
          refresh: {
            accessTokenExpiresAt: browserCredential?.expiresAt ?? officialCredential?.credential?.expiresAt ?? account.refresh?.accessTokenExpiresAt ?? null,
            nextRefreshAt: null,
            lastRefreshedAt: browserCredential?.lastRefreshedAt ?? account.refresh?.lastRefreshedAt ?? now.toISOString(),
            refreshable: browserCredential ? Boolean(browserCredential.refresh) : officialCredential?.credential ? Boolean(officialCredential.credential.refresh) : account.refresh?.refreshable ?? null
          }
        };
      }
    } catch (error) {
      nativeError = error;
    }
    if (typeof this.quotaReader === "function" && account?.auth?.credentialRef) {
      throw nativeError ?? new Error("Antigravity native quota did not return data for the selected account");
    }
    const [result, creditsResult] = await Promise.all([
      this.#slash("/quota", context.signal),
      this.#slash("/credits", context.signal).catch(() => null)
    ]);
    if (result.parsed?.status && result.parsed.status !== "SUCCESS") {
      throw new Error("Antigravity official quota command did not complete");
    }
    const windows = parseQuotaData(result.parsed?.command?.data, now);
    const fallbackWindows = windows.length ? windows : parseQuotaText(result.parsed?.response ?? "", now);
    const primary = selectPrimaryQuotaWindow(fallbackWindows);
    return {
      ...identityPatch,
      quota: {
        ...primary,
        windows: fallbackWindows,
        updatedAt: now.toISOString(),
        source: "antigravity_cli"
      },
      credits: creditsFromData(creditsResult?.parsed?.command?.data),
      resources: fingerprintResources,
      refresh: {
        accessTokenExpiresAt: null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: null
      }
    };
  }
  async getQuota(account, context = {}) {
    const browserCredential = await this.#refreshBrowserCredential(account, context);
    const officialCredential = await this.#refreshOfficialCredential(account, context);
    await this.#assertActiveSession(account, {
      ...context,
      ...officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}
    });
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    let nativeError = null;
    try {
      const native = await this.#nativeQuota(account, {
        ...context,
        ...browserCredential ? { browserCredential } : {},
        ...officialCredential?.credential ? { officialCredential: officialCredential.credential } : {}
      }, now);
      if (native) {
        const primary2 = selectPrimaryQuotaWindow(native.windows);
        return {
          quota: {
            ...primary2,
            windows: native.windows,
            updatedAt: now.toISOString(),
            source: "antigravity_native"
          },
          credits: native.credits,
          resources: { quotaSource: "antigravity_native" },
          refresh: {
            accessTokenExpiresAt: null,
            nextRefreshAt: null,
            lastRefreshedAt: now.toISOString(),
            refreshable: null
          }
        };
      }
    } catch (error) {
      nativeError = error;
    }
    if (typeof this.quotaReader === "function" && account?.auth?.credentialRef) {
      throw nativeError ?? new Error("Antigravity native quota did not return data for the selected account");
    }
    const [quotaResult, creditsResult] = await Promise.all([
      this.#slash("/quota", context.signal),
      this.#slash("/credits", context.signal).catch(() => null)
    ]);
    const data = quotaResult.parsed?.command?.data;
    const windows = parseQuotaData(data, now);
    const fallbackWindows = windows.length ? windows : parseQuotaText(quotaResult.parsed?.response ?? "", now);
    const credits = creditsFromData(creditsResult?.parsed?.command?.data);
    const primary = selectPrimaryQuotaWindow(fallbackWindows);
    return {
      quota: {
        ...primary,
        windows: fallbackWindows,
        updatedAt: now.toISOString(),
        source: "antigravity_cli"
      },
      credits,
      refresh: {
        accessTokenExpiresAt: null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: null
      }
    };
  }
  async getCatalog(context = {}) {
    return this.catalogLoader({
      force: Boolean(context.force),
      accounts: context.accounts
    });
  }
  async invoke(request, invocation, context = {}) {
    await this.#refreshBrowserCredential(invocation?.account, context);
    const officialCredential = await this.#refreshOfficialCredential(invocation?.account, context);
    await this.#assertActiveSession(invocation?.account, {
      ...context,
      ...officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}
    });
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") {
      throw new Error("Antigravity native invocation transport is not mounted");
    }
    return executor({ request, invocation, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createAntigravityDriver(options = {}) {
  return new AntigravityOfficialSessionDriver(options);
}
var antigravityDriverConstants = Object.freeze({ providerId: PROVIDER_ID3 });

// modules/provider-antigravity/src/index.mjs
function createAntigravityModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "antigravity",
    displayName: "Antigravity",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-grok/src/driver.mjs
import { createHash as createHash5 } from "node:crypto";
import { mkdtemp as mkdtemp3, readFile as readFile5, rm as rm4, writeFile as writeFile3 } from "node:fs/promises";
import { homedir as homedir5 } from "node:os";
import { tmpdir as tmpdir3 } from "node:os";
import { join as join7 } from "node:path";
var PROVIDER_ID4 = "grok";
var DEFAULT_AUTHORIZATION_URL2 = "https://auth.x.ai/oauth2/authorize";
var DEFAULT_TOKEN_URL2 = "https://auth.x.ai/oauth2/token";
var DEFAULT_USERINFO_URL = "https://auth.x.ai/oauth2/userinfo";
var DEFAULT_GROK_MODELS_URL = "https://cli-chat-proxy.grok.com/v1/models";
var DEFAULT_CLIENT_ID2 = "b1a00492-073a-47ea-816f-4c329264a828";
var DEFAULT_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write workspaces:read workspaces:write";
var DEFAULT_GROK_HOME = join7(homedir5(), ".grok");
var DEFAULT_CATALOG_TTL_MS2 = 6e4;
var DEFAULT_GROK_USAGE_URL = "https://grok.com/?_s=usage";
var DEFAULT_GROK_CREDITS_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
var DEFAULT_GROK_TOKEN_HEADER = "xai-grok-cli";
var DEFAULT_GROK_CLIENT_VERSION = "1.0.13";
var CREDENTIAL_SLOT3 = Symbol("dockyard-grok-credential");
function hash3(value) {
  return createHash5("sha256").update(String(value)).digest("hex");
}
function firstString2(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function grokTokenExpiresAt(value, payload = {}, now = /* @__PURE__ */ new Date()) {
  return isoFromEpoch(value?.expires_at ?? value?.expiresAt ?? payload.exp) ?? addSecondsIso(value?.expires_in ?? value?.expiresIn, now);
}
function grokTokenNeedsRefresh(credential, now = /* @__PURE__ */ new Date(), leewayMs = 6e4) {
  if (!credential?.refresh || !credential.expiresAt) return false;
  const expiresAt = Date.parse(credential.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime() + leewayMs;
}
function grokHomePath({ env = process.env, home = homedir5(), grokHome } = {}) {
  return grokHome ?? env.GROK_HOME ?? join7(home, ".grok");
}
function grokCommandEnvironment(env, grokHome) {
  return { ...env, GROK_HOME: grokHome };
}
function authRecords(raw) {
  if (!raw || typeof raw !== "object") return [];
  if (typeof raw.key === "string" || typeof raw.access_token === "string" || typeof raw.accessToken === "string") {
    return [{ scopeKey: "default", value: raw }];
  }
  return Object.entries(raw).filter(([, value]) => value && typeof value === "object").map(([scopeKey, value]) => ({ scopeKey, value }));
}
function grokPlanFromTier(tier) {
  if (typeof tier === "string" && tier.length > 0) return tier;
  if (tier === 3) return "Premium";
  if (tier === 4) return "Premium+";
  if (tier === 2) return "Basic";
  if (tier === 1) return "Free";
  if (tier === 5) return "Enterprise";
  return null;
}
function parseGrokAuth(raw) {
  return authRecords(raw).map(({ scopeKey, value }) => {
    const access2 = firstString2(value.key, value.access_token, value.accessToken);
    if (!access2) return null;
    const accessPayload = decodeJwtPayload(access2) ?? {};
    const idPayload = decodeJwtPayload(value.id_token ?? value.idToken) ?? {};
    const expiresAt = grokTokenExpiresAt(value, accessPayload);
    const accountId = firstString2(
      value.user_id,
      value.userId,
      value.principal_id,
      value.principalId,
      value.team_id,
      value.teamId,
      accessPayload.sub,
      accessPayload.user_id,
      accessPayload.userId,
      idPayload.sub
    ) ?? `${scopeKey}:${hash3(access2).slice(0, 20)}`;
    const email = firstString2(value.email, value.user_email, value.userEmail, idPayload.email, accessPayload.email);
    const displayName = firstString2(
      value.first_name,
      value.firstName,
      value.name,
      idPayload.preferred_username,
      idPayload.name,
      idPayload.nickname,
      accessPayload.name,
      email,
      accountId
    );
    const plan = firstString2(
      value.subscription_level,
      value.subscriptionLevel,
      value.subscription_tier,
      value.subscriptionTier,
      grokPlanFromTier(accessPayload.tier),
      grokPlanFromTier(idPayload.tier)
    );
    return {
      access: access2,
      refresh: firstString2(value.refresh_token, value.refreshToken),
      accountId,
      email,
      displayName,
      plan,
      expiresAt,
      createdAt: firstString2(value.create_time, value.createdAt),
      scopes: Array.isArray(value.scopes) ? value.scopes.map(String) : typeof value.scope === "string" ? value.scope.split(/\s+/).filter(Boolean) : [],
      issuer: firstString2(value.oidc_issuer, value.oidcIssuer, scopeKey.split("::")[0]),
      clientId: firstString2(value.oidc_client_id, value.oidcClientId),
      authMode: firstString2(value.auth_mode, value.authMode),
      scopeKey
    };
  }).filter(Boolean);
}
function accountInput2(tokens, credentialRef, now = /* @__PURE__ */ new Date(), { source = "official_grok_oauth" } = {}) {
  return {
    providerId: PROVIDER_ID4,
    accountId: tokens.accountId,
    credentialRef,
    displayName: tokens.displayName,
    email: tokens.email,
    auth: { kind: "oauth", scopes: tokens.scopes },
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.createdAt ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    resources: {
      transport: "xai_chat_completions_sse",
      accountScope: "oauth_account",
      sessionSource: source.includes("browser") ? OFFICIAL_SESSION_SOURCE_KINDS.BROWSER : OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE,
      authSource: source,
      quotaSource: source.includes("browser") ? "official_browser_session" : "official_grok_session",
      quotaUrl: DEFAULT_GROK_USAGE_URL
    }
  };
}
function attachCredential2(candidate2, tokens) {
  Object.defineProperty(candidate2, CREDENTIAL_SLOT3, {
    value: tokens,
    enumerable: false,
    configurable: false
  });
  return candidate2;
}
function candidateFromTokens2(tokens, { source, now = /* @__PURE__ */ new Date() } = {}) {
  const expired = tokens.expiresAt && new Date(tokens.expiresAt).getTime() <= now.getTime();
  return attachCredential2({
    candidateId: `grok:${hash3(tokens.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID4,
    source,
    accountId: tokens.accountId,
    displayName: tokens.displayName ?? tokens.email ?? tokens.accountId,
    email: tokens.email,
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.createdAt ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    credentialRef: createCredentialRef(PROVIDER_ID4, tokens.accountId),
    imported: false,
    status: expired ? "degraded" : "available",
    diagnostic: expired ? "Grok OAuth access token \u5DF2\u8FC7\u671F\uFF0C\u5BFC\u5165\u540E\u9700\u8981\u5B98\u65B9 OAuth \u5237\u65B0" : null
  }, tokens);
}
function summarizeGrokCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID4,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function cacheEntries(cache) {
  if (!cache || typeof cache !== "object") return [];
  const entries = cache.models ?? cache.data;
  if (!entries || typeof entries !== "object") return [];
  return Array.isArray(entries) ? entries.map((value) => [value?.id, value]).filter(([id]) => id) : Object.entries(entries);
}
function normalizeReasoning(info) {
  const raw = Array.isArray(info?.reasoning_efforts) ? info.reasoning_efforts : [];
  const efforts = raw.map((effort) => {
    const id = firstString2(effort?.id, effort?.value);
    if (!id) return null;
    return {
      id,
      name: firstString2(effort?.label, effort?.name, id),
      ...typeof effort?.description === "string" ? { description: effort.description } : {},
      ...effort?.default === true ? { default: true } : {}
    };
  }).filter(Boolean);
  if (!efforts.length) return void 0;
  const preferred = efforts.find((effort) => effort.default)?.id ?? firstString2(info?.reasoning_effort);
  return {
    efforts: efforts.map(({ default: _default, ...effort }) => effort),
    ...preferred && efforts.some((effort) => effort.id === preferred) ? { defaultEffort: preferred } : {}
  };
}
function parseGrokModelCatalog(output = "", cache = null) {
  const discovered = [...String(output).matchAll(/^\s*[*-]\s+(\S+)(?:\s+\(([^)]+)\))?/gm)].map((match) => ({ id: match[1], name: match[2] ?? match[1] }));
  const cached = new Map(cacheEntries(cache).map(([id, value]) => [id, value?.info ?? value ?? {}]));
  const ids = [.../* @__PURE__ */ new Set([...discovered.map((model) => model.id), ...cached.keys()])];
  return ids.map((id) => {
    const fromOutput = discovered.find((model2) => model2.id === id);
    const info = cached.get(id) ?? {};
    const outputName = fromOutput?.name === "default" ? null : fromOutput?.name;
    const model = { id, name: firstString2(info.name, info.model, outputName, id) };
    const reasoning = normalizeReasoning(info);
    if (reasoning) model.reasoning = reasoning;
    const contextWindow = finiteNumber(info.context_window ?? info.contextWindow);
    const maxTokens = finiteNumber(info.max_completion_tokens ?? info.maxTokens);
    if (Number.isInteger(contextWindow)) model.contextWindow = contextWindow;
    if (Number.isInteger(maxTokens)) model.maxTokens = Math.min(maxTokens, 16384);
    if (Array.isArray(info.input) && info.input.length > 0) model.inputModalities = [...info.input];
    return model;
  });
}
function finiteValue(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
function centValue(value) {
  return finiteValue(value?.val ?? value);
}
function periodLabel(periodType) {
  const value = String(periodType ?? "").toUpperCase();
  if (value.includes("WEEK")) return "\u5B98\u65B9\u5468\u989D\u5EA6\u5468\u671F";
  if (value.includes("MONTH")) return "\u5B98\u65B9\u6708\u989D\u5EA6\u5468\u671F";
  return "\u5B98\u65B9\u989D\u5EA6\u5468\u671F";
}
function parseGrokCreditsConfig(body, { now = /* @__PURE__ */ new Date() } = {}) {
  const config = body?.config && typeof body.config === "object" ? body.config : {};
  const updatedAt2 = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const usagePercent = finiteValue(config.creditUsagePercent);
  const monthlyLimit = centValue(config.monthlyLimit);
  const used = centValue(config.used);
  const currentPeriod = config.currentPeriod && typeof config.currentPeriod === "object" ? config.currentPeriod : {};
  const periodType = currentPeriod.type ?? config.periodType;
  const periodStart = currentPeriod.start ?? config.billingPeriodStart ?? null;
  const periodEnd = currentPeriod.end ?? config.billingPeriodEnd ?? null;
  let remaining = null;
  let limit = null;
  let unit = null;
  if (usagePercent !== null && usagePercent >= 0 && usagePercent <= 100) {
    remaining = Math.max(0, 100 - usagePercent);
    limit = 100;
    unit = "percent";
  } else if (monthlyLimit !== null && used !== null && monthlyLimit >= 0) {
    remaining = Math.max(0, monthlyLimit - used);
    limit = monthlyLimit;
    unit = "USD cents";
  }
  const windows = periodEnd || remaining !== null || limit !== null ? [{
    id: "grok.current_period",
    name: periodLabel(periodType),
    remaining,
    limit,
    unit,
    resetAt: periodEnd,
    updatedAt: updatedAt2,
    source: "official_grok_build_billing"
  }] : [];
  return {
    quota: {
      remaining,
      limit,
      unit,
      resetAt: periodEnd,
      windows,
      updatedAt: updatedAt2,
      source: "official_grok_build_billing"
    },
    subscription: {
      plan: typeof body?.subscriptionTier === "string" ? body.subscriptionTier : null,
      status: null,
      expiresAt: null
    },
    resources: {
      quotaSource: "official_grok_build_billing",
      quotaDiagnostic: windows.length === 0 ? "Grok \u5B98\u65B9 credits config \u672A\u8FD4\u56DE\u5F53\u524D\u989D\u5EA6\u5468\u671F\u6216\u5269\u4F59\u503C" : remaining === null ? "Grok \u5B98\u65B9\u5DF2\u8FD4\u56DE\u5F53\u524D\u989D\u5EA6\u5468\u671F\uFF0C\u4F46\u672A\u8FD4\u56DE\u5269\u4F59\u767E\u5206\u6BD4" : null,
      quotaPeriodType: periodType ?? null,
      quotaPeriodStart: periodStart,
      quotaUrl: DEFAULT_GROK_USAGE_URL
    }
  };
}
var DEFAULT_GROK_REASONING_EFFORTS = Object.freeze([
  { id: "low", name: "Low", description: "\u5FEB\u901F\u601D\u8003\uFF0C\u4FDD\u7559\u57FA\u7840\u63A8\u7406" },
  { id: "medium", name: "Medium", description: "\u6807\u51C6\u601D\u8003\uFF0C\u5E73\u8861\u63A8\u7406\u6DF1\u5EA6\u4E0E\u54CD\u5E94\u901F\u5EA6" },
  { id: "high", name: "High", description: "\u6DF1\u5EA6\u601D\u8003\uFF0C\u9002\u5408\u590D\u6742\u903B\u8F91\u4E0E\u591A\u6B65\u9AA4\u5206\u6790" }
]);
var BUILTIN_GROK_MODELS = Object.freeze([
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "xhigh", name: "Extra High", description: "Maximum reasoning for the hardest tasks." },
        { id: "high", name: "High", description: "Thorough reasoning and quality. Recommended.", default: true },
        { id: "medium", name: "Medium", description: "Strong quality with a faster turnaround." },
        { id: "low", name: "Low", description: "Fastest responses. Best for simple tasks." }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-4.7-build-fast",
    name: "Grok 4.7 Fast",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "xhigh", name: "Extra High", description: "Maximum reasoning for the hardest tasks." },
        { id: "high", name: "High", description: "Thorough reasoning and quality. Recommended.", default: true },
        { id: "medium", name: "Medium", description: "Strong quality with a faster turnaround." },
        { id: "low", name: "Low", description: "Fastest responses. Best for simple tasks." }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-4.6",
    name: "Grok 4.6",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "xhigh", name: "Extra High", description: "Highest effort and reasoning level" },
        { id: "high", name: "High", description: "Higher implementation quality with extensive reasoning", default: true },
        { id: "medium", name: "Medium", description: "Balanced effort with standard implementation and testing" },
        { id: "low", name: "Low", description: "Quick, fast implementations" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High", description: "Highest implementation quality with extensive reasoning", default: true },
        { id: "medium", name: "Medium", description: "Balanced effort with standard implementation and testing" },
        { id: "low", name: "Low", description: "Quick, fast implementations" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-build-0.1",
    name: "Grok Build 0.1",
    contextWindow: 131072,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "high", name: "High", description: "Deep thinking mode", default: true }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-3",
    name: "Grok 3",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [...DEFAULT_GROK_REASONING_EFFORTS],
      defaultEffort: "medium"
    },
    inputModalities: ["text"]
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [...DEFAULT_GROK_REASONING_EFFORTS],
      defaultEffort: "medium"
    },
    inputModalities: ["text"]
  },
  {
    id: "grok-2",
    name: "Grok 2",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text"]
  },
  {
    id: "grok-2-mini",
    name: "Grok 2 Mini",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text"]
  }
]);
function createGrokCatalogLoader({
  env = process.env,
  home = homedir5(),
  grokHome,
  cliPath = env.DOCKYARD_GROK_CLI || "grok",
  commandRunner = null,
  timeoutMs = 3e4,
  readJson: readJson3 = readJsonFile,
  cacheTtlMs = Number(process.env.DOCKYARD_GROK_CATALOG_TTL_MS) || DEFAULT_CATALOG_TTL_MS2,
  registryLoader = null,
  fetchImpl = fetch,
  modelsUrl = env.DOCKYARD_GROK_MODELS_URL || DEFAULT_GROK_MODELS_URL,
  tokenHeader = env.DOCKYARD_GROK_TOKEN_HEADER || DEFAULT_GROK_TOKEN_HEADER,
  clientVersion = env.DOCKYARD_GROK_CLIENT_VERSION || DEFAULT_GROK_CLIENT_VERSION
} = {}) {
  const resolvedHome = grokHomePath({ env, home, grokHome });
  let cached = null;
  let cachedAt = 0;
  let pending = null;
  return async function loadCatalog({ force = false, credential = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;
    pending = (async () => {
      const cache = await readJson3(join7(resolvedHome, "models_cache.json"));
      let discoveredModels = [];
      let source = "official_grok_cli";
      let cliError = null;
      if (credential?.access) {
        try {
          const res = await fetchImpl(modelsUrl, {
            method: "GET",
            headers: {
              authorization: `Bearer ${credential.access}`,
              "x-xai-token-auth": tokenHeader,
              "x-userid": credential.accountId,
              "x-grok-client-version": clientVersion,
              accept: "application/json"
            }
          });
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            discoveredModels = parseGrokModelCatalog("", json);
            if (discoveredModels.length > 0) {
              source = "official_grok_models_api";
            }
          }
        } catch (error) {
          cliError = error;
        }
      }
      if (discoveredModels.length === 0 && typeof commandRunner === "function") {
        try {
          const result = await commandRunner(cliPath, ["models"], {
            env,
            timeoutMs,
            providerId: PROVIDER_ID4
          });
          discoveredModels = parseGrokModelCatalog(result.output, cache);
        } catch (error) {
          cliError = error;
          discoveredModels = parseGrokModelCatalog("", cache);
          source = cache ? "official_grok_local_cache" : "official_grok_cli";
        }
      } else if (discoveredModels.length === 0) {
        discoveredModels = parseGrokModelCatalog("", cache);
        source = "official_grok_local_cache";
      }
      if (discoveredModels.length > 0) {
        let finalModels = discoveredModels;
        if (source === "official_grok_models_api") {
          const modelsMap2 = /* @__PURE__ */ new Map();
          for (const m of discoveredModels) modelsMap2.set(m.id, { ...m });
          for (const m of BUILTIN_GROK_MODELS) {
            if (!modelsMap2.has(m.id)) modelsMap2.set(m.id, { ...m });
          }
          finalModels = [...modelsMap2.values()];
        }
        cached = {
          models: finalModels,
          source,
          ...cliError ? { diagnostics: [`Grok \u5B98\u65B9\u6A21\u578B\u76EE\u5F55\u63D0\u793A\uFF1A${cliError.message}`] } : {}
        };
        cachedAt = Date.now();
        return cached;
      }
      const modelsMap = /* @__PURE__ */ new Map();
      for (const m of BUILTIN_GROK_MODELS) {
        modelsMap.set(m.id, { ...m });
      }
      if (typeof registryLoader === "function") {
        try {
          const registry = await registryLoader();
          for (const item of Array.isArray(registry) ? registry : []) {
            if (!item?.id) continue;
            if (item.provider === "xai" || String(item.id).startsWith("grok-")) {
              const previous = modelsMap.get(item.id);
              if (!previous) {
                const reasoning = resolveReasoningFromModel(item);
                modelsMap.set(item.id, {
                  id: item.id,
                  name: item.name ?? item.id,
                  ...Number.isInteger(item.contextWindow) ? { contextWindow: item.contextWindow } : {},
                  ...Number.isInteger(item.maxTokens) ? { maxTokens: Math.min(item.maxTokens, 16384) } : {},
                  ...Array.isArray(item.input) ? { inputModalities: [...item.input] } : {},
                  ...reasoning ? { reasoning } : {}
                });
              }
            }
          }
        } catch {
        }
      }
      const models = [...modelsMap.values()];
      cached = {
        models,
        source: discoveredModels.length > 0 ? source : "official_grok_builtin",
        ...cliError ? { diagnostics: [`Grok \u5B98\u65B9\u6A21\u578B\u76EE\u5F55\u63D0\u793A\uFF1A${cliError.message}`] } : {}
      };
      cachedAt = Date.now();
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
var GrokOAuthDriver = class {
  constructor({
    authFilePath,
    env = process.env,
    home = homedir5(),
    grokHome,
    catalogLoader = null,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_GROK_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_GROK_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL2,
    tokenUrl = env.DOCKYARD_GROK_TOKEN_URL || DEFAULT_TOKEN_URL2,
    userinfoUrl = env.DOCKYARD_GROK_USERINFO_URL || DEFAULT_USERINFO_URL,
    modelsUrl = env.DOCKYARD_GROK_MODELS_URL || DEFAULT_GROK_MODELS_URL,
    clientId = env.DOCKYARD_GROK_CLIENT_ID || DEFAULT_CLIENT_ID2,
    oauthScope = env.DOCKYARD_GROK_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE,
    cliPath = env.DOCKYARD_GROK_CLI || "grok",
    commandRunner = runCliCommand,
    requestExecutor = null,
    fetchImpl = fetch,
    creditsUrl = env.DOCKYARD_GROK_CREDITS_URL || DEFAULT_GROK_CREDITS_URL,
    tokenHeader = env.DOCKYARD_GROK_TOKEN_HEADER || DEFAULT_GROK_TOKEN_HEADER,
    clientVersion = env.DOCKYARD_GROK_CLIENT_VERSION || DEFAULT_GROK_CLIENT_VERSION,
    timeoutMs = 3e4,
    registryLoader = null
  } = {}) {
    this.env = env;
    this.grokHome = grokHomePath({ env, home, grokHome });
    this.authFilePath = authFilePath ?? join7(this.grokHome, "auth.json");
    this.cliPath = cliPath;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.creditsUrl = validateNativeEndpoint(creditsUrl, { providerId: PROVIDER_ID4 });
    this.modelsUrl = validateNativeEndpoint(modelsUrl, { providerId: PROVIDER_ID4 });
    this.tokenHeader = String(tokenHeader || DEFAULT_GROK_TOKEN_HEADER);
    this.clientVersion = String(clientVersion || DEFAULT_GROK_CLIENT_VERSION);
    this.timeoutMs = timeoutMs;
    this.authorizationUrl = assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_GROK_AUTHORIZATION_URL");
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_GROK_TOKEN_URL");
    this.userinfoUrl = assertSecureEndpointUrl(userinfoUrl, "DOCKYARD_GROK_USERINFO_URL");
    this.clientId = clientId;
    this.oauthScope = oauthScope;
    this.catalogLoader = catalogLoader ?? createGrokCatalogLoader({
      env,
      home,
      grokHome: this.grokHome,
      cliPath,
      commandRunner,
      timeoutMs,
      registryLoader,
      fetchImpl: this.fetchImpl,
      modelsUrl: this.modelsUrl,
      tokenHeader: this.tokenHeader,
      clientVersion: this.clientVersion
    });
    this.cliAuthorizer = createCliOAuthAuthorizer({
      providerId: PROVIDER_ID4,
      cliPath,
      loginArgs: ["login", "--oauth"],
      environmentKey: "GROK_HOME",
      environment: env,
      profileDirectory: this.grokHome,
      browserOpened: true,
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Grok CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728 auth.x.ai \u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importCredentials: (raw, context) => this.#importOAuthState(raw, context)
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID4,
      callbackPath: "/callback",
      callbackHost: "127.0.0.1",
      callbackPort: 0,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Grok \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri, nonce }) => {
        const url = new URL(authorizationUrl);
        url.search = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: oauthScope,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          nonce,
          referrer: "grok-build"
        });
        return url.toString();
      },
      exchangeCode: async ({ code, codeVerifier, redirectUri, context }) => {
        const response = await this.fetchImpl(`${tokenUrl}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
          }),
          ...context.signal ? { signal: context.signal } : {}
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(`Grok OAuth token exchange failed (${response.status})`);
          error.status = response.status;
          error.upstreamCode = body.error ?? body.error_code;
          throw error;
        }
        const access2 = firstString2(body.access_token, body.accessToken, body.key);
        if (access2) {
          try {
            const userinfoRes = await this.fetchImpl(this.userinfoUrl, {
              method: "GET",
              headers: { authorization: `Bearer ${access2}`, accept: "application/json" },
              ...context.signal ? { signal: context.signal } : {}
            });
            if (userinfoRes.ok) {
              const userinfo = await userinfoRes.json().catch(() => ({}));
              if (userinfo?.name) body.name = userinfo.name;
              if (userinfo?.email) body.email = userinfo.email;
              if (userinfo?.sub) body.user_id = userinfo.sub;
            }
          } catch {
          }
        }
        return {
          ...body,
          oidc_client_id: body.oidc_client_id ?? body.client_id ?? clientId,
          auth_mode: "oauth",
          scope: body.scope ?? oauthScope
        };
      },
      importCredentials: (raw, context) => this.#importOAuthState(raw, context, "official_grok_browser_oauth")
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const raw = await readJsonFile(this.authFilePath);
    if (!raw) {
      return { candidates: [], source: this.authFilePath, diagnostics: [`\u672A\u53D1\u73B0 Grok OAuth \u6587\u4EF6\uFF1A${this.authFilePath}`] };
    }
    const candidates = parseGrokAuth(raw).map((tokens) => candidateFromTokens2(tokens, { source: "official_grok_oauth", now }));
    return {
      candidates,
      source: "official_grok_oauth",
      diagnostics: candidates.length ? [] : ["Grok OAuth \u6587\u4EF6\u5B58\u5728\uFF0C\u4F46\u6CA1\u6709\u53EF\u8BC6\u522B\u7684 access token"]
    };
  }
  async importAccount(candidate2, context = {}) {
    const tokens = candidate2?.[CREDENTIAL_SLOT3];
    if (!tokens) throw new Error("Grok candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = createCredentialRef(PROVIDER_ID4, tokens.accountId);
    await context.secretStore.write(credentialRef, {
      type: "oauth",
      providerId: PROVIDER_ID4,
      access: tokens.access,
      refresh: tokens.refresh,
      accountId: tokens.accountId,
      email: tokens.email,
      displayName: tokens.displayName,
      expiresAt: tokens.expiresAt,
      issuer: tokens.issuer,
      clientId: tokens.clientId,
      scopes: tokens.scopes,
      scopeKey: tokens.scopeKey
    });
    return accountInput2(tokens, credentialRef, context.now instanceof Date ? context.now : /* @__PURE__ */ new Date(), {
      source: candidate2.source
    });
  }
  async importSource(source, context = {}) {
    let raw;
    try {
      raw = typeof source?.content === "string" ? JSON.parse(source.content) : source?.content;
    } catch {
      throw new Error("Grok OAuth source is not valid JSON");
    }
    return this.#importOAuthState(raw, context, source?.fileName || "user_selected_oauth.json");
  }
  async #importOAuthState(raw, context = {}, source = "official_grok_oauth") {
    const tokens = parseGrokAuth(raw);
    if (!tokens.length) throw new Error("Grok OAuth state does not contain a supported account token");
    const accounts = [];
    for (const value of tokens) {
      accounts.push(await this.importAccount(candidateFromTokens2(value, {
        source,
        now: context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()
      }), context));
    }
    return accounts;
  }
  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      if (!discovered.candidates?.length) return null;
      const accounts = [];
      for (const candidate2 of discovered.candidates) {
        accounts.push(await this.importAccount(candidate2, context));
      }
      return {
        status: "completed",
        providerId: PROVIDER_ID4,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Grok \u5B98\u65B9 OAuth \u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts,
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("\u5F53\u524D Grok \u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u624B\u52A8\u6388\u6743\u7801");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async #readCredential(account, context = {}) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) {
      const error = new Error("Grok OAuth credential is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    return { ...credential, accountId: credential.accountId ?? account.accountId };
  }
  async #refreshOAuthCredential(account, context = {}, { strict = false } = {}) {
    const credential = await this.#readCredential(account, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    if (!grokTokenNeedsRefresh(credential, now)) return credential;
    if (!credential.refresh) {
      if (!strict) return credential;
      const error = new Error("Grok OAuth access token expired; authorize again");
      error.authExpired = true;
      throw error;
    }
    let response;
    try {
      response = await this.fetchImpl(this.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          client_id: credential.clientId ?? this.clientId,
          grant_type: "refresh_token",
          refresh_token: credential.refresh
        }),
        ...context.signal ? { signal: context.signal } : {}
      });
    } catch (cause) {
      const error = new Error("Grok OAuth refresh failed; authorize again");
      error.authExpired = true;
      error.cause = cause;
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    const access2 = firstString2(body.access_token, body.accessToken, body.key);
    if (!response.ok || !access2) {
      const error = new Error("Grok OAuth refresh failed; authorize again");
      error.status = response.status;
      error.authExpired = response.status === 401 || response.status === 400;
      throw error;
    }
    const updated = {
      ...credential,
      access: access2,
      refresh: firstString2(body.refresh_token, body.refreshToken, credential.refresh),
      expiresAt: grokTokenExpiresAt(body, decodeJwtPayload(access2) ?? {}, now) ?? credential.expiresAt,
      lastRefreshedAt: now.toISOString()
    };
    await context.secretStore.write(account.auth?.credentialRef ?? account.credentialRef, updated);
    return updated;
  }
  async #prepareCredentialEnvironment(account, context = {}) {
    const credential = await this.#readCredential(account, context);
    const profileDir = await mkdtemp3(join7(tmpdir3(), "dockyard-grok-run-"));
    const authPath = join7(profileDir, "auth.json");
    const key = account.accountId ?? credential.accountId;
    const raw = {
      [key]: {
        key: credential.access,
        ...credential.refresh ? { refresh_token: credential.refresh } : {},
        user_id: credential.accountId ?? account.accountId,
        ...credential.email ?? account.email ? { email: credential.email ?? account.email } : {},
        ...account.subscription?.plan ? { subscription_level: account.subscription.plan } : {},
        ...credential.expiresAt ? { expires_at: credential.expiresAt } : {}
      }
    };
    await writeFile3(authPath, JSON.stringify(raw), { mode: 384 });
    return { profileDir, authPath, credential, env: grokCommandEnvironment(this.env, profileDir) };
  }
  async #finishCredentialEnvironment(prepared, account, context = {}) {
    try {
      const raw = JSON.parse(await readFile5(prepared.authPath, "utf8"));
      const updated = parseGrokAuth(raw).find((value) => value.accountId === (account.accountId ?? prepared.credential.accountId)) ?? parseGrokAuth(raw)[0];
      if (updated && context.secretStore) {
        const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
        await context.secretStore.write(credentialRef, {
          ...prepared.credential,
          access: updated.access,
          ...updated.refresh ? { refresh: updated.refresh } : {},
          ...updated.email ? { email: updated.email } : prepared.credential.email ? { email: prepared.credential.email } : {},
          ...updated.displayName ? { displayName: updated.displayName } : prepared.credential.displayName ? { displayName: prepared.credential.displayName } : {},
          ...updated.expiresAt ? { expiresAt: updated.expiresAt } : {},
          accountId: updated.accountId,
          lastRefreshedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return updated;
    } finally {
      await rm4(prepared.profileDir, { recursive: true, force: true }).catch(() => {
      });
    }
  }
  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_grok_browser_oauth" || account?.resources?.sessionSource === "browser" || !account?.resources?.cliProfile && Boolean(account?.refresh?.refreshable);
  }
  async refreshAccount(account, context = {}) {
    const credential = await this.#refreshOAuthCredential(account, context);
    const isBrowser = this.#isBrowserAccount(account);
    let updated = null;
    let commandError2 = null;
    if (!isBrowser) {
      const prepared = await this.#prepareCredentialEnvironment(account, context);
      try {
        await this.commandRunner(this.cliPath, ["models"], {
          env: prepared.env,
          timeoutMs: this.timeoutMs,
          providerId: PROVIDER_ID4
        });
      } catch (error) {
        if (error?.code !== "ENOENT" && !/ENOENT|not found/i.test(String(error?.message))) {
          error.authExpired = error.code === 401 || /auth|login|expired|credential|access token.{0,80}(?:valid|invalid|expired|revok)/i.test(String(error.message));
          commandError2 = error;
        }
      }
      let finishError = null;
      try {
        updated = await this.#finishCredentialEnvironment(prepared, account, context);
      } catch (error) {
        finishError = error;
      }
      if (commandError2) {
        if (finishError && !commandError2.cause) commandError2.cause = finishError;
        throw commandError2;
      }
      if (finishError) throw finishError;
    }
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const effective = updated ?? credential;
    const accessPayload = decodeJwtPayload(effective.access) ?? {};
    const plan = firstString2(
      effective.plan,
      grokPlanFromTier(accessPayload.tier),
      account.subscription?.plan
    );
    let email = firstString2(effective.email, account.email);
    let displayName = firstString2(effective.displayName, account.displayName);
    const isUuidOrMissingName = !displayName || displayName === account.accountId || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName);
    if ((!email || isUuidOrMissingName) && effective.access) {
      try {
        const userinfoRes = await this.fetchImpl(this.userinfoUrl, {
          method: "GET",
          headers: { authorization: `Bearer ${effective.access}`, accept: "application/json" },
          ...context.signal ? { signal: context.signal } : {}
        });
        if (userinfoRes?.ok) {
          const userinfo = await userinfoRes.json().catch(() => ({}));
          if (userinfo?.name) displayName = userinfo.name;
          if (userinfo?.email) email = userinfo.email;
          if (context.secretStore) {
            const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
            await context.secretStore.write(credentialRef, {
              ...effective,
              ...email ? { email } : {},
              ...displayName ? { displayName } : {},
              ...plan ? { plan } : {}
            });
          }
        }
      } catch {
      }
    }
    return {
      ...email ? { email } : {},
      ...displayName ? { displayName } : {},
      subscription: {
        ...account.subscription,
        ...plan ? { plan } : {}
      },
      refresh: {
        accessTokenExpiresAt: effective?.expiresAt ?? account.refresh?.accessTokenExpiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: Boolean(effective?.refresh ?? account.refresh?.refreshable)
      }
    };
  }
  async getQuota(account, context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const credential = await this.#refreshOAuthCredential(account, context, { strict: true });
    const accountId = credential.accountId ?? account.accountId;
    const response = await this.fetchImpl(this.creditsUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${credential.access}`,
        "x-xai-token-auth": this.tokenHeader,
        "x-userid": accountId,
        "x-grok-client-version": this.clientVersion
      },
      ...context.signal ? { signal: context.signal } : {}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Grok credits request failed (${response.status})`);
      error.status = response.status;
      error.quotaUnavailable = response.status === 401 || response.status === 403;
      throw error;
    }
    const parsed = parseGrokCreditsConfig(body, { now });
    const accessPayload = decodeJwtPayload(credential.access) ?? {};
    const plan = firstString2(
      parsed.subscription?.plan,
      grokPlanFromTier(accessPayload.tier),
      account.subscription?.plan
    );
    return {
      ...parsed,
      subscription: {
        ...account.subscription,
        ...plan ? { plan } : {}
      }
    };
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.accounts?.[0] && context.secretStore) {
      try {
        credential = await this.#readCredential(context.accounts[0], context);
      } catch {
      }
    }
    return this.catalogLoader({ force: Boolean(context.force), credential });
  }
  async invoke(request, invocation, context = {}) {
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Grok native invocation transport is not mounted");
    const account = invocation?.account;
    if (executor.nativeTransport === "xai-chat-completions") {
      const credential = account && context.secretStore ? await this.#refreshOAuthCredential(account, context, { strict: true }) : null;
      return executor({ request, invocation, credential, context });
    }
    if (!account || !context.secretStore) return executor({ request, invocation, context });
    const prepared = await this.#prepareCredentialEnvironment(account, context);
    let output;
    try {
      output = await executor({
        request,
        invocation,
        context: { ...context, env: prepared.env }
      });
    } catch (error) {
      try {
        await this.#finishCredentialEnvironment(prepared, account, context);
      } catch (finishError) {
        if (!error.cause) error.cause = finishError;
      }
      throw error;
    }
    return (async function* streamWithCleanup() {
      const driver = this;
      let streamError = null;
      try {
        for await (const chunk of output) yield chunk;
      } catch (error) {
        streamError = error;
        throw error;
      } finally {
        try {
          await driver.#finishCredentialEnvironment(prepared, account, context);
        } catch (finishError) {
          if (streamError) {
            if (!streamError.cause) streamError.cause = finishError;
          } else {
            throw finishError;
          }
        }
      }
    }).call(this);
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createGrokDriver(options = {}) {
  return new GrokOAuthDriver(options);
}
var grokDriverConstants = Object.freeze({ providerId: PROVIDER_ID4 });

// modules/provider-grok/src/native-transport.mjs
var PROVIDER_ID5 = "grok";
var DEFAULT_ENDPOINT2 = "https://api.x.ai/v1/chat/completions";
function firstString3(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function toolCallPart(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "functioncall" || type === "tooluse" ? part : null;
}
async function openAiContent(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID5, "image attachment could not be resolved");
      blocks.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({ type: "text", text: `[Tool Result ${part.toolCallId ?? part.id ?? ""}]
${textFromContent(part.content ?? part.output ?? part.result ?? part.text)}` });
      continue;
    }
    const call = toolCallPart(part);
    if (call) {
      blocks.push({ type: "text", text: `[Tool Call ${call.name ?? call.function?.name ?? "tool"}] ${JSON.stringify(parseToolArguments(call.arguments ?? call.input ?? call.function?.arguments))}` });
      continue;
    }
    const text3 = textFromContent(part);
    if (text3) blocks.push({ type: "text", text: text3 });
  }
  return blocks;
}
async function buildGrokMessages(request, attachments) {
  const result = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    result.push({ role: "system", content: request.system });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "tool" : "user";
    if (role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: firstString3(message.toolCallId, message.tool_call_id, message.id, "tool-result"),
        content: textFromContent(message.content ?? message.text ?? message.output ?? message.result)
      });
      continue;
    }
    const content = await openAiContent(message?.content ?? message?.text, attachments);
    const calls = (Array.isArray(message?.content) ? message.content : [message?.content]).map(toolCallPart).filter(Boolean).map((call, index) => ({
      id: firstString3(call.id, call.toolCallId, call.tool_call_id, `tool-${index}`),
      type: "function",
      function: {
        name: firstString3(call.name, call.function?.name, "tool"),
        arguments: typeof (call.arguments ?? call.function?.arguments) === "string" ? call.arguments ?? call.function.arguments : JSON.stringify(call.arguments ?? call.input ?? call.function?.arguments ?? {})
      }
    }));
    const messageValue = {
      role,
      content: content.length === 0 ? "" : content.length === 1 && content[0].type === "text" ? content[0].text : content
    };
    if (role === "assistant" && calls.length > 0) messageValue.tool_calls = calls;
    result.push(messageValue);
  }
  if (!result.some((message) => message.role === "user")) result.push({ role: "user", content: "Continue the conversation." });
  return result;
}
function buildGrokTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const result = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool?.name ?? tool?.function?.name ?? "tool",
      ...tool?.description ? { description: String(tool.description) } : {},
      parameters: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }
    }
  }));
  return result.length > 0 ? result : void 0;
}
async function buildGrokRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildGrokMessages(request, context.attachments),
    stream: true,
    stream_options: { include_usage: true }
  };
  if (request.temperature !== void 0) body.temperature = request.temperature;
  const maxTokens = request.maxTokens ?? request.modelContext?.maxTokens;
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
  if (request.reasoningEffort && request.purpose !== "compaction") body.reasoning_effort = request.reasoningEffort;
  const tools = buildGrokTools(request.tools);
  if (tools) body.tools = tools;
  return body;
}
async function* streamGrokResponse(response) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  const tools = /* @__PURE__ */ new Map();
  let terminated = false;
  yield { type: "block-start", index: textIndex, blockType: "text" };
  for await (const event of readSseEvents(response)) {
    if (event?.done) {
      terminated = true;
      continue;
    }
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.error) {
      throw nativeProviderError(PROVIDER_ID5, payload.error.message ?? "xAI returned an error", {
        status: payload.error.code ?? payload.error.status,
        body: payload.error
      });
    }
    usage = normalizeUsage(payload.usage) ?? usage;
    const choice = payload.choices?.[0];
    if (!choice) continue;
    stop = choice.finish_reason ?? stop;
    if (typeof choice.finish_reason === "string" && choice.finish_reason.trim()) terminated = true;
    const delta = choice.delta ?? {};
    const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
    if (content) {
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (!textOpen) {
        textIndex = nextIndex++;
        text3 = "";
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      text3 += content;
      yield { type: "text-delta", index: textIndex, text: content };
    }
    const reasoningDelta = delta.reasoning_content ?? delta.reasoningContent;
    if (reasoningDelta) {
      if (textOpen) {
        yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
        textOpen = false;
      }
      if (!reasoning) {
        reasoning = { index: nextIndex++, text: "" };
        yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
      }
      const value = String(reasoningDelta);
      reasoning.text += value;
      yield { type: "reasoning-delta", index: reasoning.index, text: value };
    }
    for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const key = Number(call.index ?? tools.size);
      if (!tools.has(key)) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        const state2 = {
          index: nextIndex++,
          id: firstString3(call.id, `tool-${key}`),
          name: firstString3(call.function?.name, call.name, "tool"),
          arguments: ""
        };
        tools.set(key, state2);
        yield { type: "block-start", index: state2.index, blockType: "tool-call" };
      }
      const state = tools.get(key);
      const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
      if (call.id) state.id = call.id;
      if (call.function?.name) state.name = call.function.name;
      state.arguments += argumentDelta;
      if (argumentDelta) {
        yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
      }
    }
  }
  if (!terminated) {
    throw nativeProviderError(
      PROVIDER_ID5,
      "xAI stream ended without a finish_reason or [DONE] terminator; the response may be truncated",
      { code: "GROK_TRUNCATED_STREAM" }
    );
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
  for (const state of tools.values()) {
    yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createGrokNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_GROK_ENDPOINT || DEFAULT_ENDPOINT2,
  env = process.env,
  timeoutMs = 3e5,
  fetchImpl = fetch,
  userAgent = process.env.DOCKYARD_GROK_USER_AGENT
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID5 });
  const executor = async ({ request = {}, credential, context = {} } = {}) => {
    const effectiveEnv = { ...env, ...context.env ?? {} };
    const token = firstString3(credential?.access, effectiveEnv.XAI_API_KEY, effectiveEnv.GROK_API_KEY);
    if (!token) {
      const error = nativeProviderError(PROVIDER_ID5, "Grok OAuth token is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "text/event-stream"
    };
    const configuredUserAgent = userAgent ?? effectiveEnv.DOCKYARD_GROK_USER_AGENT;
    if (configuredUserAgent) headers["user-agent"] = configuredUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(await buildGrokRequest(request, context)),
      signal: context.signal
    }, { providerId: PROVIDER_ID5, timeoutMs, fetchImpl });
    return streamGrokResponse(response);
  };
  executor.nativeTransport = "xai-chat-completions";
  return executor;
}
var grokNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID5,
  endpoint: DEFAULT_ENDPOINT2
});

// modules/provider-grok/src/index.mjs
function createGrokModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "grok",
    displayName: "Grok",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-claude/src/driver.mjs
import { createHash as createHash6 } from "node:crypto";
import { homedir as homedir7 } from "node:os";

// packages/oauth/src/cli-status-authorizer.mjs
import { randomUUID as randomUUID5 } from "node:crypto";
import { spawn as spawn5 } from "node:child_process";
var CHILD_STOP_GRACE_MS2 = 2e3;
function publicSession3(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {}
  };
}
function stopChild2(session) {
  const child = session.child;
  if (!child || session.exitCode !== null) return Promise.resolve();
  return new Promise((resolve2) => {
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (session.exitCode === null) session.exitCode = -1;
      resolve2();
    };
    child.once("close", finish);
    if (session.exitCode !== null) {
      finish();
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
      }
      finish();
    }, CHILD_STOP_GRACE_MS2);
    timer.unref?.();
  });
}
function createCliStatusAuthorizer({
  providerId,
  cliPath,
  loginArgs,
  environment = process.env,
  timeoutMs = 10 * 60 * 1e3,
  instructions = "\u8BF7\u5728\u5B98\u65B9\u6388\u6743\u9875\u9762\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
  browserOpened = false,
  importStatus
} = {}) {
  if (!providerId || !cliPath || !Array.isArray(loginArgs) || loginArgs.length === 0) {
    throw new Error(`Invalid CLI status authorizer configuration for ${providerId ?? "provider"}`);
  }
  if (typeof importStatus !== "function") throw new Error(`Missing status importer for ${providerId}`);
  const sessions = /* @__PURE__ */ new Map();
  function capture(session, chunk) {
    session.output = `${session.output}${String(chunk ?? "")}`.slice(-32e3);
    if (!session.authorizationUrl) {
      session.authorizationUrl = extractSafeAuthorizationUrl(session.output);
    }
  }
  async function finalize(session, context) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        if (session.timedOut) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9 OAuth \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002";
          return publicSession3(session);
        }
        if (session.launchError) {
          session.status = "failed";
          session.diagnostic = `\u65E0\u6CD5\u542F\u52A8\u5B98\u65B9\u767B\u5F55\u547D\u4EE4\uFF1A${session.launchError}`;
          return publicSession3(session);
        }
        if (session.exitCode !== 0) {
          session.status = "failed";
          session.diagnostic = `\u5B98\u65B9 OAuth \u767B\u5F55\u672A\u5B8C\u6210\uFF08\u9000\u51FA\u7801 ${session.exitCode ?? "unknown"}\uFF09\u3002`;
          return publicSession3(session);
        }
        const accounts = await importStatus(context);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\uFF0C\u4F46 provider status \u6CA1\u6709\u8FD4\u56DE\u53EF\u63A5\u5165\u7684\u8BA2\u9605\u8D26\u53F7\u3002";
          return publicSession3(session);
        }
        session.status = "completed";
        session.result = { ...publicSession3(session), accounts, diagnostic: null };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession3(session);
      } finally {
        if (session.timer) clearTimeout(session.timer);
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const session = {
      sessionId: `${providerId}:${randomUUID5()}`,
      providerId,
      browserOpened,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exitCode: null,
      launchError: null,
      output: "",
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      const child = spawn5(cliPath, loginArgs, {
        env: environment,
        stdio: ["ignore", "pipe", "pipe"]
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => capture(session, chunk));
      child.stderr?.on("data", (chunk) => capture(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        void stopChild2(session);
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicSession3(session);
  }
  async function poll(sessionId, context) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId,
        status: "missing",
        instructions,
        diagnostic: "OAuth \u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
      };
    }
    if (session.exitCode === null) return publicSession3(session);
    const result = await finalize(session, context);
    if (result.status !== "pending" && result.status !== "processing") sessions.delete(sessionId);
    return result;
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    await stopChild2(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, cancel });
}

// packages/oauth/src/official-session-authorizer.mjs
import { randomUUID as randomUUID6 } from "node:crypto";
var DEFAULT_TIMEOUT_MS3 = 10 * 60 * 1e3;
function publicSession4(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {}
  };
}
function createOfficialSessionAuthorizer({
  providerId,
  source = "official_client",
  instructions = "\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
  timeoutMs = DEFAULT_TIMEOUT_MS3,
  browserOpened = false,
  readSession,
  onCancel = null
} = {}) {
  if (!providerId) throw new Error("Official session authorizer requires providerId");
  if (typeof readSession !== "function") throw new Error(`Official session authorizer requires a reader for ${providerId}`);
  const sessions = /* @__PURE__ */ new Map();
  function missing(sessionId) {
    return {
      sessionId,
      providerId,
      status: "missing",
      instructions,
      diagnostic: "\u5B98\u65B9\u5BA2\u6237\u7AEF\u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u6388\u6743\u3002"
    };
  }
  async function begin() {
    const session = {
      sessionId: `${providerId}:official-session:${randomUUID6()}`,
      providerId,
      source,
      browserOpened,
      status: "pending",
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      diagnostic: null,
      result: null
    };
    sessions.set(session.sessionId, session);
    return publicSession4(session);
  }
  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missing(sessionId);
    if (session.result) return session.result;
    if (Date.now() - Date.parse(session.startedAt) >= timeoutMs) {
      session.status = "failed";
      session.diagnostic = "\u5B98\u65B9\u5BA2\u6237\u7AEF\u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u5B8C\u6210\u767B\u5F55\u540E\u91CD\u65B0\u5F00\u59CB\u6388\u6743\u3002";
      sessions.delete(sessionId);
      return publicSession4(session);
    }
    try {
      const value = await readSession(context);
      const accounts = Array.isArray(value) ? value : value?.accounts;
      if (Array.isArray(accounts) && accounts.length > 0) {
        session.status = "completed";
        session.result = {
          ...publicSession4(session),
          accounts,
          diagnostic: null
        };
        sessions.delete(sessionId);
        return session.result;
      }
      session.status = value?.status === "processing" ? "processing" : "pending";
      session.diagnostic = value?.diagnostic ?? null;
      return publicSession4(session);
    } catch (error) {
      session.status = "processing";
      session.diagnostic = redactError(error);
      return publicSession4(session);
    }
  }
  async function cancel(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missing(sessionId);
    try {
      await onCancel?.(context);
    } finally {
      sessions.delete(sessionId);
    }
    return { sessionId, providerId, status: "cancelled" };
  }
  async function submitAuthorizationCode(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return missing(sessionId);
    throw new Error("\u5F53\u524D\u5B98\u65B9\u5BA2\u6237\u7AEF\u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u9A8C\u8BC1\u7801");
  }
  return Object.freeze({ begin, poll, cancel, submitAuthorizationCode });
}
var officialSessionAuthorizerConstants = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS3
});

// modules/provider-claude/src/native-transport.mjs
import { readFile as readFile6 } from "node:fs/promises";
import { homedir as homedir6 } from "node:os";
import { join as join8 } from "node:path";
var PROVIDER_ID6 = "claude";
var DEFAULT_ENDPOINT3 = "https://api.anthropic.com/v1/messages";
function firstString4(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
async function readJson(path) {
  try {
    return JSON.parse(await readFile6(path, "utf8"));
  } catch {
    return null;
  }
}
function oauthTokenFromJson(value) {
  const oauth = value?.claudeAiOauth ?? value?.oauth ?? value?.credentials ?? value;
  const token = firstString4(oauth?.accessToken, oauth?.access_token, value?.accessToken, value?.access_token);
  return token ? { token, kind: "oauth" } : null;
}
function claudeOAuthCredentialFromJson(value) {
  const oauth = value?.claudeAiOauth ?? value?.oauth ?? value?.credentials ?? value;
  const access2 = firstString4(oauth?.accessToken, oauth?.access_token, value?.accessToken, value?.access_token);
  if (!access2) return null;
  const refresh = firstString4(oauth?.refreshToken, oauth?.refresh_token, value?.refreshToken, value?.refresh_token);
  const expiresAt = isoFromEpoch(
    oauth?.expiresAt ?? oauth?.expires_at ?? oauth?.expiryDate ?? oauth?.expiry_date ?? value?.expiresAt ?? value?.expires_at
  ) ?? addSecondsIso(oauth?.expiresIn ?? oauth?.expires_in ?? value?.expiresIn ?? value?.expires_in);
  return {
    type: "oauth",
    providerId: "claude",
    access: access2,
    ...refresh ? { refresh } : {},
    ...expiresAt ? { expiresAt } : {},
    ...Array.isArray(oauth?.scopes) ? { scopes: oauth.scopes.map(String) } : {}
  };
}
async function readClaudeOAuthCredential({ home = homedir6() } = {}) {
  for (const path of [
    join8(home, ".claude", ".credentials.json"),
    join8(home, ".opencodex", "claude_desktop_auth.json")
  ]) {
    const credential = claudeOAuthCredentialFromJson(await readJson(path));
    if (credential) return credential;
  }
  return null;
}
async function resolveClaudeAccessToken({
  credential,
  env = process.env,
  home = homedir6(),
  accountBound = false
} = {}) {
  const stored = firstString4(credential?.access, credential?.token);
  if (stored) return { token: stored, kind: credential?.type === "api_key" ? "apiKey" : "oauth" };
  if (accountBound) return null;
  const apiKey = firstString4(env.ANTHROPIC_API_KEY);
  if (apiKey) return { token: apiKey, kind: "apiKey" };
  const envToken = firstString4(env.CLAUDE_CODE_OAUTH_TOKEN, env.ANTHROPIC_AUTH_TOKEN);
  if (envToken) return { token: envToken, kind: "oauth" };
  for (const path of [
    join8(home, ".claude", ".credentials.json"),
    join8(home, ".opencodex", "claude_desktop_auth.json")
  ]) {
    const found = oauthTokenFromJson(await readJson(path));
    if (found) return found;
  }
  return null;
}
function toolCallPart2(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "tooluse" || type === "functioncall" ? part : null;
}
async function anthropicContent(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID6, "image attachment could not be resolved");
      blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({
        type: "tool_result",
        tool_use_id: firstString4(part.toolCallId, part.tool_call_id, part.id, "tool-result"),
        content: textFromContent(part.content ?? part.output ?? part.result ?? part.text),
        ...part.isError || part.is_error ? { is_error: true } : {}
      });
      continue;
    }
    const tool = toolCallPart2(part);
    if (tool) {
      blocks.push({
        type: "tool_use",
        id: firstString4(tool.id, tool.toolCallId, tool.tool_call_id, `tool-${blocks.length}`),
        name: firstString4(tool.name, tool.function?.name, "tool"),
        input: parseToolArguments(tool.arguments ?? tool.input ?? tool.function?.arguments)
      });
      continue;
    }
    const text3 = textFromContent(part);
    if (text3) blocks.push({ type: "text", text: text3 });
  }
  return blocks;
}
async function buildAnthropicMessages(request, attachments) {
  const messages = [];
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "user" : "user";
    const content = await anthropicContent(message?.content ?? message?.text, attachments);
    if (role === "user" && message?.role === "tool" && content.length === 0) continue;
    if (content.length > 0) messages.push({ role, content: content.length === 1 && content[0].type === "text" ? content[0].text : content });
  }
  if (messages.length === 0) messages.push({ role: "user", content: "Continue the conversation." });
  return messages;
}
function buildAnthropicTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const result = tools.map((tool) => ({
    name: firstString4(tool?.name, tool?.function?.name, "tool"),
    ...tool?.description ? { description: String(tool.description) } : {},
    input_schema: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }
  }));
  return result.length > 0 ? result : void 0;
}
function thinkingBudget(request) {
  const value = request?.reasoningBudget ?? request?.thinkingBudget;
  if (Number.isInteger(value) && value > 0) return value;
  const effort = String(request?.reasoningEffort ?? "").toLowerCase();
  if (effort === "high" || effort === "xhigh") return 16e3;
  if (effort === "medium") return 8e3;
  if (effort === "low") return 4e3;
  return null;
}
function invalidRequestError(message) {
  const error = new Error(message);
  error.code = "INVALID_ARGUMENT";
  error.providerId = PROVIDER_ID6;
  return error;
}
function resolveMaxTokens(request) {
  const value = Number.isInteger(request.maxTokens) ? request.maxTokens : Number.isInteger(request.modelContext?.maxTokens) ? request.modelContext.maxTokens : 4096;
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidRequestError(`Claude max_tokens must be a positive integer, received ${value}`);
  }
  return value;
}
async function buildClaudeRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildAnthropicMessages(request, context.attachments),
    max_tokens: resolveMaxTokens(request),
    stream: true
  };
  if (typeof request.system === "string" && request.system.length > 0) body.system = request.system;
  const tools = buildAnthropicTools(request.tools);
  if (tools) body.tools = tools;
  const budget = thinkingBudget(request);
  if (budget && body.max_tokens > budget) {
    body.thinking = { type: "enabled", budget_tokens: budget };
  } else if (request.temperature !== void 0) {
    body.temperature = request.temperature;
  }
  return body;
}
function headersForToken(auth) {
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream",
    "anthropic-version": "2023-06-01"
  };
  if (auth.kind === "apiKey" || auth.token.startsWith("sk-ant-")) {
    headers["x-api-key"] = auth.token;
  } else {
    headers.authorization = `Bearer ${auth.token}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
    headers["anthropic-client-platform"] = "DESKTOP_APP";
    headers["anthropic-client-version"] = "1.0.0";
  }
  return headers;
}
function mergeUsage(previous, next) {
  return next ? { ...previous ?? {}, ...next } : previous;
}
function claudeStreamProtocolError() {
  const error = nativeProviderError(PROVIDER_ID6, "SSE stream ended before message_stop; the response was truncated");
  error.code = "SSE_PROTOCOL_ERROR";
  error.protocolError = true;
  return error;
}
async function* streamClaudeResponse(response) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let messageOpened = false;
  let terminated = false;
  const tools = /* @__PURE__ */ new Map();
  const reasoning = /* @__PURE__ */ new Map();
  yield { type: "block-start", index: textIndex, blockType: "text" };
  for await (const event of readSseEvents(response)) {
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.type === "message_start") {
      messageOpened = true;
      usage = mergeUsage(usage, normalizeUsage(payload.message?.usage));
      continue;
    }
    if (payload.type === "content_block_start") {
      const block = payload.content_block ?? {};
      if (block.type === "tool_use" || block.type === "thinking" || block.type === "redacted_thinking") {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        const index = nextIndex++;
        if (block.type === "tool_use") {
          tools.set(payload.index, {
            index,
            id: firstString4(block.id, `tool-${payload.index}`),
            name: firstString4(block.name, "tool"),
            arguments: ""
          });
          yield { type: "block-start", index, blockType: "tool-call" };
        } else {
          reasoning.set(payload.index, { index, text: "" });
          yield { type: "block-start", index, blockType: "reasoning" };
        }
        continue;
      }
      if (block.type === "text" && !textOpen) {
        textIndex = nextIndex++;
        text3 = "";
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      continue;
    }
    if (payload.type === "content_block_delta") {
      const delta = payload.delta ?? {};
      if (delta.type === "text_delta" && delta.text) {
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text3 += delta.text;
        yield { type: "text-delta", index: textIndex, text: delta.text };
      } else if (delta.type === "thinking_delta" && delta.thinking) {
        let state = reasoning.get(payload.index);
        if (!state) {
          if (textOpen) {
            yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
            textOpen = false;
          }
          state = { index: nextIndex++, text: "" };
          reasoning.set(payload.index, state);
          yield { type: "block-start", index: state.index, blockType: "reasoning" };
        }
        state.text += delta.thinking;
        yield { type: "reasoning-delta", index: state.index, text: delta.thinking };
      } else if (delta.type === "input_json_delta" && tools.has(payload.index)) {
        const tool = tools.get(payload.index);
        tool.arguments += delta.partial_json ?? "";
        yield { type: "tool-call-delta", index: tool.index, id: tool.id, name: tool.name, argumentsDelta: delta.partial_json ?? "" };
      }
      continue;
    }
    if (payload.type === "content_block_stop") {
      const thought = reasoning.get(payload.index);
      if (thought) {
        yield { type: "block-end", index: thought.index, block: { type: "reasoning", text: thought.text } };
        reasoning.delete(payload.index);
      }
      const tool = tools.get(payload.index);
      if (tool) {
        yield {
          type: "block-end",
          index: tool.index,
          block: { type: "tool-call", id: tool.id, name: tool.name, arguments: tool.arguments || "{}" }
        };
        tools.delete(payload.index);
      }
      continue;
    }
    if (payload.type === "message_delta") {
      terminated = true;
      stop = payload.delta?.stop_reason ?? stop;
      usage = mergeUsage(usage, normalizeUsage(payload.usage));
      continue;
    }
    if (payload.type === "message_stop") {
      terminated = true;
      continue;
    }
    if (payload.type === "error") {
      throw nativeProviderError(PROVIDER_ID6, payload.error?.message ?? "Anthropic returned an error", {
        status: payload.error?.status,
        body: payload.error
      });
    }
  }
  if (messageOpened && !terminated) throw claudeStreamProtocolError();
  for (const thought of reasoning.values()) {
    yield { type: "block-end", index: thought.index, block: { type: "reasoning", text: thought.text } };
  }
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
  for (const tool of tools.values()) {
    yield {
      type: "block-end",
      index: tool.index,
      block: { type: "tool-call", id: tool.id, name: tool.name, arguments: tool.arguments || "{}" }
    };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createClaudeNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_CLAUDE_ENDPOINT || DEFAULT_ENDPOINT3,
  env = process.env,
  home = homedir6(),
  timeoutMs = 3e5,
  fetchImpl = fetch,
  tokenResolver = resolveClaudeAccessToken
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID6 });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
    const accountBound = Boolean(ref || invocation?.account?.accountId);
    if (context.secretStore && ref) {
      credential = await context.secretStore.read(ref);
    }
    const auth = await tokenResolver({ credential, env: { ...env, ...context.env ?? {} }, home, accountBound });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID6, accountBound ? "Claude subscription OAuth token is unavailable for the selected account; authorize Claude again" : "Claude OAuth token is unavailable; authorize Claude first");
      error.authExpired = true;
      throw error;
    }
    const body = await buildClaudeRequest(request, context);
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers: headersForToken(auth),
      body: JSON.stringify(body),
      signal: context.signal
    }, { providerId: PROVIDER_ID6, timeoutMs, fetchImpl });
    return streamClaudeResponse(response);
  };
  executor.nativeTransport = "anthropic-messages";
  return executor;
}
var claudeNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID6,
  endpoint: DEFAULT_ENDPOINT3
});

// modules/provider-claude/src/driver.mjs
var PROVIDER_ID7 = "claude";
var DEFAULT_BROWSER_AUTHORIZATION_URL = "https://claude.com/cai/oauth/authorize";
var DEFAULT_BROWSER_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
var DEFAULT_BROWSER_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
var DEFAULT_BROWSER_REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
var DEFAULT_BROWSER_SCOPE = "user:profile user:inference";
var CREDENTIAL_SLOT4 = Symbol("dockyard-claude-session");
function hash4(value) {
  return createHash6("sha256").update(String(value)).digest("hex");
}
function firstString5(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function statusObject(raw, output = "") {
  if (raw && typeof raw === "object") return raw;
  return parseJsonOutput(output) ?? {};
}
function statusLoggedIn(value, output = "") {
  if (typeof value.loggedIn === "boolean") return value.loggedIn;
  if (typeof value.authenticated === "boolean") return value.authenticated;
  return !/not logged in|logged out|unauthenticated/i.test(String(output));
}
function isApiKeyStatus(value) {
  const method = String(value.authMethod ?? value.auth_method ?? "").toLowerCase();
  const source = String(value.apiKeySource ?? value.api_key_source ?? "").toLowerCase();
  return method.includes("api_key") || method.includes("apikey") || source.length > 0;
}
function isSubscriptionStatus(value) {
  if (isApiKeyStatus(value)) return false;
  const method = String(value.authMethod ?? value.auth_method ?? "").toLowerCase();
  const provider = String(value.apiProvider ?? value.api_provider ?? "").toLowerCase();
  return method.includes("oauth") || method.includes("claude") || method.includes("subscription") || provider.includes("claude") || provider.includes("firstparty");
}
function statusIdentity(value) {
  const profile = value.profile ?? value.user ?? value.account ?? {};
  const email = firstString5(value.email, value.userEmail, profile.email, profile.userEmail);
  const accountId = firstString5(
    value.accountId,
    value.account_id,
    value.userId,
    value.user_id,
    profile.accountId,
    profile.id,
    email
  ) ?? "claude:active";
  const plan = firstString5(
    value.plan,
    value.planName,
    value.plan_type,
    value.subscriptionType,
    value.subscription?.plan,
    value.subscription?.name
  );
  const displayName = firstString5(value.name, profile.name, email, accountId);
  return { accountId, email, plan, displayName };
}
function parseClaudeAuthStatus(output) {
  const value = statusObject(null, output);
  const identity = statusIdentity(value);
  return {
    loggedIn: statusLoggedIn(value, output),
    authMethod: firstString5(value.authMethod, value.auth_method),
    apiProvider: firstString5(value.apiProvider, value.api_provider),
    apiKeySource: firstString5(value.apiKeySource, value.api_key_source),
    isApiKey: isApiKeyStatus(value),
    isSubscription: isSubscriptionStatus(value),
    ...identity,
    raw: value
  };
}
function activeSessionError2(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}
function candidateFromStatus(status, {
  source = "official_claude_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  imported = false,
  credential = null
} = {}) {
  const sourceCredential = credential ?? status.credential ?? null;
  const persistedCredential = sourceCredential?.access && sourceCredential?.refresh ? {
    ...sourceCredential,
    type: sourceCredential.type ?? "oauth",
    providerId: PROVIDER_ID7,
    accountId: sourceCredential.accountId ?? status.accountId
  } : null;
  const credentialRef = createCredentialRef(PROVIDER_ID7, status.accountId);
  const candidate2 = {
    candidateId: `claude:${hash4(status.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID7,
    source,
    accountId: status.accountId,
    displayName: status.displayName ?? status.accountId,
    email: status.email,
    subscription: { plan: status.plan, status: status.isSubscription ? "active" : null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: persistedCredential?.expiresAt ?? null,
      nextRefreshAt: null,
      lastRefreshedAt: persistedCredential?.lastRefreshedAt ?? null,
      refreshable: Boolean(persistedCredential?.refresh)
    },
    credentialRef,
    resources: officialSessionResources({ sourceKind, authSource: source }),
    imported,
    status: status.isSubscription ? "available" : "degraded",
    diagnostic: status.isApiKey ? "\u5F53\u524D Claude \u5B98\u65B9\u4F1A\u8BDD\u4F7F\u7528 API key\uFF0C\u4E0D\u662F Claude Pro/Max \u8BA2\u9605 OAuth" : status.isSubscription ? null : "Claude \u5B98\u65B9\u4F1A\u8BDD\u6CA1\u6709\u8FD4\u56DE\u53EF\u8BC6\u522B\u7684\u8BA2\u9605 OAuth \u72B6\u6001"
  };
  Object.defineProperty(candidate2, CREDENTIAL_SLOT4, {
    value: persistedCredential ?? {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID7,
      accountId: status.accountId,
      authMethod: status.authMethod,
      sourceKind
    },
    enumerable: false
  });
  return candidate2;
}
function browserTokenExpiry(raw, now = /* @__PURE__ */ new Date()) {
  if (typeof raw?.expires_at === "string") return raw.expires_at;
  const expiresIn = Number(raw?.expires_in);
  return Number.isFinite(expiresIn) ? new Date(now.getTime() + expiresIn * 1e3).toISOString() : null;
}
function candidateFromBrowserToken(raw, { source = "official_claude_browser_oauth", now = /* @__PURE__ */ new Date() } = {}) {
  const access2 = firstString5(raw?.access_token, raw?.accessToken);
  const refresh = firstString5(raw?.refresh_token, raw?.refreshToken);
  if (!access2 || !refresh) throw new Error("Claude browser OAuth response is missing access and refresh tokens");
  const account = raw.account ?? {};
  const organization = raw.organization ?? {};
  const email = firstString5(raw.email, account.email, account.email_address, account.emailAddress);
  const accountId = firstString5(raw.accountId, raw.account_id, account.uuid, account.id, email) ?? "claude:active";
  const candidate2 = candidateFromStatus({
    loggedIn: true,
    authMethod: "oauth",
    apiProvider: "firstParty",
    isApiKey: false,
    isSubscription: true,
    accountId,
    email,
    displayName: firstString5(raw.name, account.name, email, accountId),
    plan: firstString5(raw.plan, raw.plan_type, organization.name)
  }, {
    source,
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    credential: {
      type: "oauth",
      providerId: PROVIDER_ID7,
      accountId,
      access: access2,
      refresh,
      expiresAt: browserTokenExpiry(raw, now),
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
      clientId: raw.client_id ?? raw.clientId ?? null
    }
  });
  candidate2.refresh = {
    ...candidate2.refresh,
    accessTokenExpiresAt: browserTokenExpiry(raw, now),
    refreshable: true
  };
  return candidate2;
}
function summarizeClaudeCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID7,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function catalogModel(model) {
  const reasoning = model?.thinkingLevelMap && typeof model.thinkingLevelMap === "object" ? {
    efforts: Object.keys(model.thinkingLevelMap).filter((id) => id !== "off").map((id) => ({ id, name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()) }))
  } : model?.reasoning && typeof model.reasoning === "object" ? model.reasoning : void 0;
  return {
    id: model.id,
    name: model.name ?? model.id,
    ...Array.isArray(model.input) ? { inputModalities: [...model.input] } : {},
    ...Number.isInteger(model.contextWindow) ? { contextWindow: model.contextWindow } : {},
    ...Number.isInteger(model.maxTokens) ? { maxTokens: model.maxTokens } : {},
    ...reasoning ? { reasoning } : {}
  };
}
function createClaudeCatalogLoader({ registryLoader = null } = {}) {
  let cached = null;
  return async function loadCatalog({ force = false } = {}) {
    if (cached && !force) return cached;
    const registry = typeof registryLoader === "function" ? await registryLoader() : [];
    const modelsById = /* @__PURE__ */ new Map();
    for (const rawModel of Array.isArray(registry) ? registry : []) {
      if (!rawModel || rawModel.provider !== "anthropic" && rawModel.api !== "anthropic-messages") continue;
      const model = catalogModel(rawModel);
      if (typeof model.id !== "string" || model.id.length === 0) continue;
      const previous = modelsById.get(model.id);
      if (!previous) {
        modelsById.set(model.id, model);
        continue;
      }
      modelsById.set(model.id, {
        ...previous,
        ...previous.name === model.id && model.name !== model.id ? { name: model.name } : {},
        ...previous.inputModalities === void 0 && model.inputModalities !== void 0 ? { inputModalities: [...model.inputModalities] } : {},
        ...previous.contextWindow === void 0 && model.contextWindow !== void 0 ? { contextWindow: model.contextWindow } : {},
        ...previous.maxTokens === void 0 && model.maxTokens !== void 0 ? { maxTokens: model.maxTokens } : {},
        ...previous.reasoning === void 0 && model.reasoning !== void 0 ? { reasoning: model.reasoning } : {}
      });
    }
    const models = [...modelsById.values()];
    cached = {
      models,
      source: "dsh_live_provider_registry",
      ...models.length ? {} : { diagnostics: ["Claude \u5B98\u65B9\u6CA1\u6709\u516C\u5F00\u6A21\u578B\u76EE\u5F55\uFF0C\u4E14\u5F53\u524D DSH registry \u672A\u8FD4\u56DE Anthropic \u6A21\u578B"] }
    };
    return cached;
  };
}
var ClaudeSubscriptionDriver = class {
  constructor({
    cliPath = process.env.DOCKYARD_CLAUDE_CLI || "claude",
    env = process.env,
    commandRunner = runCliCommand,
    requestExecutor = null,
    catalogLoader = null,
    sessionReader = null,
    sessionSource = "official_claude_client",
    sessionSourceKind = OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CLAUDE_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_CLAUDE_AUTHORIZATION_URL || DEFAULT_BROWSER_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_CLAUDE_TOKEN_URL || DEFAULT_BROWSER_TOKEN_URL,
    clientId = env.DOCKYARD_CLAUDE_CLIENT_ID || DEFAULT_BROWSER_CLIENT_ID,
    redirectUri = env.DOCKYARD_CLAUDE_REDIRECT_URI || DEFAULT_BROWSER_REDIRECT_URI,
    oauthScope = env.DOCKYARD_CLAUDE_OAUTH_SCOPE || DEFAULT_BROWSER_SCOPE,
    home = homedir7(),
    fetchImpl = fetch
  } = {}) {
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CLAUDE_AUTHORIZATION_URL");
    this.cliPath = cliPath;
    this.env = env;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.home = home;
    this.browserTokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CLAUDE_TOKEN_URL");
    this.browserClientId = clientId;
    this.sessionReader = sessionReader;
    this.sessionSource = sessionSource;
    this.sessionSourceKind = sessionSourceKind;
    this.catalogLoader = catalogLoader ?? createClaudeCatalogLoader();
    this.clientSessionAuthorizer = typeof sessionReader === "function" ? createOfficialSessionAuthorizer({
      providerId: PROVIDER_ID7,
      source: sessionSource,
      instructions: "\u8BF7\u5728 Claude \u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      readSession: async (context = {}) => {
        const status = await this.#activeStatus(context.signal);
        const candidate2 = candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind
        });
        return { accounts: [await this.importAccount(candidate2, context)] };
      }
    }) : null;
    this.cliAuthorizer = createCliStatusAuthorizer({
      providerId: PROVIDER_ID7,
      cliPath,
      loginArgs: ["auth", "login", "--claudeai"],
      environment: env,
      browserOpened: true,
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Claude CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728 Claude \u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importStatus: async (context) => {
        const status = await this.#activeStatus();
        if (!status.loggedIn || !status.isSubscription) return [];
        return [await this.importAccount(candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind
        }), context)];
      }
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID7,
      redirectUri,
      callbackPort: 0,
      authorizationCodeRequired: true,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Claude \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF0C\u7136\u540E\u5C06\u9875\u9762\u8FD4\u56DE\u7684\u6388\u6743\u7801\u7C98\u8D34\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri: callback }) => {
        const url = new URL(authorizationUrl);
        url.search = new URLSearchParams({
          code: "true",
          client_id: clientId,
          response_type: "code",
          redirect_uri: callback,
          scope: oauthScope,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state
        });
        return url.toString();
      },
      exchangeCode: async ({ code, state, codeVerifier, redirectUri: callback, context }) => {
        const response = await this.fetchImpl(tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: code.includes("#") ? code.split("#", 1)[0] : code,
            redirect_uri: callback,
            client_id: clientId,
            code_verifier: codeVerifier,
            state
          }),
          ...context.signal ? { signal: context.signal } : {}
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(`Claude OAuth token exchange failed (${response.status})`);
          error.status = response.status;
          error.upstreamCode = body.error;
          throw error;
        }
        return body;
      },
      importCredentials: async (raw, context) => [await this.importAccount(candidateFromBrowserToken(raw, {
        source: "official_claude_browser_oauth",
        now: context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()
      }), context)]
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  #statusFromResult(result, defaults = {}) {
    const normalized = normalizeOfficialSessionResult(result, {
      source: defaults.source ?? "official_claude_cli",
      sourceKind: defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI
    });
    const status = parseClaudeAuthStatus(normalized?.output ?? "");
    return {
      ...status,
      source: normalized?.source ?? defaults.source ?? "official_claude_cli",
      sourceKind: normalized?.sourceKind ?? defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
      credential: normalized?.credential ?? null
    };
  }
  async #persistedOAuthCredential() {
    try {
      return await readClaudeOAuthCredential({ home: this.home });
    } catch {
      return null;
    }
  }
  async #readStatus(signal) {
    if (typeof this.sessionReader === "function") {
      try {
        const value = await this.sessionReader({ env: this.env, signal });
        const normalized2 = normalizeOfficialSessionResult(value, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind
        });
        if (normalized2) return {
          ...normalized2,
          credential: normalized2.credential ?? await this.#persistedOAuthCredential()
        };
      } catch {
      }
    }
    const result = await this.commandRunner(this.cliPath, ["auth", "status", "--json"], {
      env: this.env,
      providerId: PROVIDER_ID7,
      timeoutMs: 3e4,
      ...signal ? { signal } : {}
    });
    const normalized = normalizeOfficialSessionResult(result, {
      source: "official_claude_cli",
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.CLI
    });
    return normalized ? { ...normalized, credential: normalized.credential ?? await this.#persistedOAuthCredential() } : null;
  }
  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_claude_browser_oauth" || account?.refresh?.refreshable === true;
  }
  async #readBrowserCredential(account, context = {}) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) throw activeSessionError2("Claude browser OAuth credential is missing; authorize again");
    return { ...credential, credentialRef };
  }
  async #refreshBrowserCredential(account, context = {}) {
    const credential = await this.#readBrowserCredential(account, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const expiresAt = Date.parse(credential.expiresAt ?? "");
    if (!credential.refresh || Number.isFinite(expiresAt) && expiresAt - now.getTime() > 6e4) return credential;
    const response = await this.fetchImpl(this.browserTokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: credential.clientId ?? this.browserClientId
      }),
      ...context.signal ? { signal: context.signal } : {}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      const error = new Error(`Claude browser OAuth refresh failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const updated = {
      ...credential,
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      expiresAt: typeof body.expires_in === "number" ? new Date(now.getTime() + body.expires_in * 1e3).toISOString() : credential.expiresAt
    };
    await context.secretStore.write(credential.credentialRef, updated);
    return updated;
  }
  async #browserStatus(account, context = {}) {
    const credential = await this.#refreshBrowserCredential(account, context);
    return {
      loggedIn: true,
      authMethod: "oauth",
      apiProvider: "firstParty",
      isApiKey: false,
      isSubscription: true,
      accountId: account.accountId,
      email: account.email,
      displayName: account.displayName,
      plan: account.subscription?.plan ?? null,
      raw: {},
      source: "official_claude_browser_oauth",
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
      credential
    };
  }
  async #activeStatus(signal, account = null, context = {}) {
    if (this.#isBrowserAccount(account)) return this.#browserStatus(account, context);
    const result = await this.#readStatus(signal);
    const status = this.#statusFromResult(result, {
      source: this.sessionSource,
      sourceKind: this.sessionSourceKind
    });
    if (!status.loggedIn || status.isApiKey || !status.isSubscription) {
      throw activeSessionError2("Claude subscription OAuth is not the active official session; authorize again");
    }
    return status;
  }
  async #assertActiveSession(account, signal, context = {}) {
    const status = await this.#activeStatus(signal, account, context);
    if (account?.accountId !== status.accountId && account?.accountId !== "claude:active") {
      throw activeSessionError2(
        "Claude only exposes its active official session; select the active account or authorize it again",
        { mismatch: true }
      );
    }
    return status;
  }
  async discover() {
    try {
      const result = await this.#readStatus();
      const status = this.#statusFromResult(result, {
        source: this.sessionSource,
        sourceKind: this.sessionSourceKind
      });
      const source = status.source ?? "official_claude_cli";
      if (!status.loggedIn) {
        return { candidates: [], source, diagnostics: ["Claude \u5B98\u65B9\u4F1A\u8BDD\u5F53\u524D\u672A\u767B\u5F55"] };
      }
      if (status.isApiKey) {
        return { candidates: [], source, diagnostics: ["Claude \u5B98\u65B9\u4F1A\u8BDD\u5F53\u524D\u4F7F\u7528 API key\uFF1B\u8BF7\u4F7F\u7528\u8BA2\u9605 OAuth \u767B\u5F55"] };
      }
      if (!status.isSubscription) {
        return { candidates: [], source, diagnostics: ["Claude \u5B98\u65B9\u4F1A\u8BDD\u4E0D\u662F\u53EF\u8BC6\u522B\u7684\u8BA2\u9605 OAuth"] };
      }
      return {
        candidates: [candidateFromStatus(status, { source, sourceKind: status.sourceKind })],
        source,
        diagnostics: []
      };
    } catch (error) {
      return { candidates: [], source: this.sessionSource, diagnostics: [`\u65E0\u6CD5\u8BFB\u53D6 Claude \u5B98\u65B9\u4F1A\u8BDD\uFF1A${error.message}`] };
    }
  }
  async importAccount(candidate2, context = {}) {
    const session = candidate2?.[CREDENTIAL_SLOT4];
    if (!session) throw new Error("Claude candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(candidate2.credentialRef, session);
    return {
      providerId: PROVIDER_ID7,
      accountId: candidate2.accountId,
      credentialRef: candidate2.credentialRef,
      displayName: candidate2.displayName,
      email: candidate2.email,
      auth: { kind: OFFICIAL_SESSION_AUTH_KIND, scopes: [] },
      subscription: { ...candidate2.subscription },
      refresh: { ...candidate2.refresh },
      resources: {
        ...officialSessionResources({
          sourceKind: candidate2.resources?.sessionSource ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
          authSource: candidate2.source
        }),
        transport: "anthropic_messages_sse",
        quotaSource: candidate2.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP ? "official_client_status" : candidate2.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? "official_browser_status" : "official_cli_status"
      }
    };
  }
  async getActiveSession(context = {}) {
    try {
      const status = await this.#activeStatus(context.signal);
      const candidate2 = candidateFromStatus(status, {
        source: status.source,
        sourceKind: status.sourceKind
      });
      const account = await this.importAccount(candidate2, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID7,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Claude \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts: [account],
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("\u5F53\u524D Claude \u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u624B\u52A8\u6388\u6743\u7801");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async refreshAccount(account, context = {}) {
    if (this.#isBrowserAccount(account)) await this.#refreshBrowserCredential(account, context);
    const status = await this.#assertActiveSession(account, context.signal, context);
    return {
      identity: { email: status.email, displayName: status.displayName },
      subscription: { plan: status.plan, status: "active", expiresAt: null },
      refresh: {
        accessTokenExpiresAt: status.credential?.expiresAt ?? null,
        lastRefreshedAt: (context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()).toISOString(),
        refreshable: Boolean(status.credential?.refresh)
      }
    };
  }
  async getQuota(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const quotaSource = status.sourceKind === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP ? "official_client_status" : "claude_cli_status";
    const windows = recursiveQuotaWindows(status.raw, { source: quotaSource, now, prefix: "claude" });
    const primary = selectPrimaryQuotaWindow(windows);
    return {
      quota: {
        remaining: primary.remaining ?? null,
        limit: primary.limit ?? null,
        unit: primary.unit ?? null,
        resetAt: primary.resetAt ?? null,
        windows,
        updatedAt: now.toISOString(),
        source: quotaSource
      },
      subscription: { plan: status.plan, status: status.isSubscription ? "active" : null, expiresAt: null },
      resources: {
        quotaDiagnostic: windows.length ? null : "Claude \u5B98\u65B9\u4F1A\u8BDD\u72B6\u6001\u672A\u8FD4\u56DE\u5B9E\u65F6\u8BA2\u9605\u989D\u5EA6\uFF1BDockyard \u4E0D\u663E\u793A\u4F30\u7B97\u767E\u5206\u6BD4"
      }
    };
  }
  async getCatalog(context = {}) {
    return this.catalogLoader({ force: Boolean(context.force) });
  }
  async invoke(request, invocation, context = {}) {
    await this.#assertActiveSession(invocation?.account, context.signal, context);
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Claude native invocation transport is not mounted");
    return executor({ request, invocation, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createClaudeDriver(options = {}) {
  return new ClaudeSubscriptionDriver(options);
}
var claudeDriverConstants = Object.freeze({ providerId: PROVIDER_ID7 });

// modules/provider-claude/src/index.mjs
function createClaudeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "claude",
    displayName: "Claude",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-cursor/src/driver.mjs
import { createHash as createHash8, randomBytes as randomBytes3, randomUUID as randomUUID9 } from "node:crypto";
import { homedir as homedir9 } from "node:os";

// modules/provider-cursor/src/native-transport.mjs
import { execFileSync as execFileSync2 } from "node:child_process";
import * as http2 from "node:http2";
import { homedir as homedir8 } from "node:os";
import { join as join9 } from "node:path";
import { randomBytes as randomBytes2, randomUUID as randomUUID8 } from "node:crypto";

// modules/provider-cursor/src/native-protocol.mjs
import { createHash as createHash7, randomUUID as randomUUID7 } from "node:crypto";
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
function encodeVarint(value) {
  let current = BigInt(Math.max(0, Number(value) || 0));
  const result = [];
  while (current >= 0x80n) {
    result.push(Number(current & 0x7fn | 0x80n));
    current >>= 7n;
  }
  result.push(Number(current));
  return Uint8Array.from(result);
}
function fieldKey(field, wireType) {
  return encodeVarint(field << 3 | wireType);
}
function bytesField(field, value) {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value instanceof Uint8Array ? value : Uint8Array.from(value ?? []);
  return concatBytes([fieldKey(field, 2), encodeVarint(bytes.byteLength), bytes]);
}
function stringField(field, value) {
  return bytesField(field, textEncoder.encode(String(value ?? "")));
}
function varintField(field, value) {
  return concatBytes([fieldKey(field, 0), encodeVarint(value)]);
}
function frameConnectMessage(message, flags = 0) {
  const payload = message instanceof Uint8Array ? message : Uint8Array.from(message ?? []);
  const header = new Uint8Array(5);
  header[0] = flags & 255;
  new DataView(header.buffer).setUint32(1, payload.byteLength, false);
  return concatBytes([header, payload]);
}
function decodeProtoFields(bytes) {
  const value = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes ?? []);
  const fields = [];
  let offset = 0;
  while (offset < value.length) {
    const key = readVarint(value, offset);
    if (!key) break;
    offset = key.offset;
    const field = Number(key.value >> 3n);
    const wireType = Number(key.value & 7n);
    if (wireType === 0) {
      const parsed = readVarint(value, offset);
      if (!parsed) break;
      offset = parsed.offset;
      fields.push({ field, wireType, value: Number(parsed.value) });
      continue;
    }
    if (wireType === 1) {
      if (offset + 8 > value.length) break;
      fields.push({ field, wireType, value: value.slice(offset, offset + 8) });
      offset += 8;
      continue;
    }
    if (wireType === 2) {
      const length = readVarint(value, offset);
      if (!length) break;
      offset = length.offset;
      const end = offset + Number(length.value);
      if (end > value.length) break;
      fields.push({ field, wireType, value: value.slice(offset, end) });
      offset = end;
      continue;
    }
    if (wireType === 5) {
      if (offset + 4 > value.length) break;
      fields.push({ field, wireType, value: value.slice(offset, offset + 4) });
      offset += 4;
      continue;
    }
    break;
  }
  return fields;
}
function readVarint(bytes, start) {
  let offset = start;
  let value = 0n;
  let shift = 0n;
  while (offset < bytes.length && shift <= 63n) {
    const byte = bytes[offset++];
    value |= BigInt(byte & 127) << shift;
    if ((byte & 128) === 0) return { value, offset };
    shift += 7n;
  }
  return null;
}
function firstBytes(fields, field) {
  return fields.find((entry) => entry.field === field && entry.wireType === 2)?.value ?? null;
}
function firstString6(fields, field) {
  const bytes = firstBytes(fields, field);
  return bytes ? textDecoder.decode(bytes) : "";
}
function sha256(bytes) {
  return new Uint8Array(createHash7("sha256").update(bytes).digest());
}
function putBlob(store, value) {
  const bytes = value instanceof Uint8Array ? value : textEncoder.encode(String(value));
  const id = sha256(bytes);
  store.set(Buffer.from(id).toString("hex"), bytes);
  return id;
}
function jsonBlob(store, value) {
  return putBlob(store, textEncoder.encode(JSON.stringify(value)));
}
function isInlineBase64(value) {
  const compact = value.replace(/\s+/g, "");
  return compact.length > 0 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}
function normalizeText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(normalizeText).filter(Boolean).join("");
  if (!content || typeof content !== "object") return "";
  if (content.type === "image") {
    const mimeType = String(content.mimeType ?? content.mediaType ?? content.source?.media_type ?? "image/png");
    const raw = content.data ?? content.source?.data ?? content.source?.url ?? null;
    if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
      return `[Image ${mimeType}] data:${mimeType};base64,${Buffer.from(raw).toString("base64")}`;
    }
    if (typeof raw === "string" && raw.length > 0) {
      if (/^https?:\/\//i.test(raw)) return `[Image ${mimeType}] ${raw}`;
      if (raw.startsWith("data:")) return `[Image ${mimeType}] ${raw}`;
      if (!isInlineBase64(raw)) return "[image attachment without inline data]";
      return `[Image ${mimeType}] data:${mimeType};base64,${raw}`;
    }
    return "[image attachment without inline data]";
  }
  if (content.type === "tool-result" || content.type === "tool_result") {
    return `[Tool Result]
${normalizeText(content.content ?? content.output ?? content.result ?? content.text)}`;
  }
  if (content.type === "tool-call" || content.type === "tool_call") {
    return `[Tool Call ${content.name ?? "tool"}] ${content.arguments ?? "{}"}`;
  }
  return String(content.text ?? content.value ?? content.content ?? content.delta ?? "");
}
function normalizedMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    role: String(message?.role ?? "user"),
    content: normalizeText(message?.content ?? message?.text).trim()
  })).filter((message) => message.content.length > 0);
}
function encodeUserMessage(text3, messageId, mode = 1) {
  return concatBytes([stringField(1, text3), stringField(2, messageId), varintField(4, mode)]);
}
function encodeAssistantStep(text3) {
  const assistantMessage = stringField(1, text3);
  const conversationStep = bytesField(1, assistantMessage);
  return conversationStep;
}
function encodeConversationTurn(userMessageId, stepIds, requestId) {
  return concatBytes([
    bytesField(1, userMessageId),
    ...stepIds.map((id) => bytesField(2, id)),
    ...requestId ? [stringField(3, requestId)] : []
  ]);
}
function encodeConversationState(messages, blobStore, requestId) {
  const roots = [];
  const turns = [];
  const turnRecords = [];
  for (const message of messages) {
    if (message.role === "system") {
      roots.push(jsonBlob(blobStore, { role: "system", content: message.content }));
      continue;
    }
    if (message.role === "user") {
      const userMessage = { role: "user", content: [{ type: "text", text: message.content }] };
      roots.push(jsonBlob(blobStore, userMessage));
      turnRecords.push({ text: message.content, steps: [] });
      continue;
    }
    if (message.role === "assistant") {
      roots.push(jsonBlob(blobStore, { role: "assistant", content: [{ type: "text", text: message.content }] }));
      turnRecords.at(-1)?.steps.push(putBlob(blobStore, encodeAssistantStep(message.content)));
      continue;
    }
    const resultText = `[Tool Result]
${message.content}`;
    roots.push(jsonBlob(blobStore, { role: "user", content: [{ type: "text", text: resultText }] }));
    turnRecords.at(-1)?.steps.push(putBlob(blobStore, encodeAssistantStep(resultText)));
  }
  for (const record of turnRecords.slice(0, -1)) {
    const userMessageId = putBlob(blobStore, encodeUserMessage(record.text, randomUUID7()));
    const turn = encodeConversationTurn(userMessageId, record.steps, requestId);
    turns.push(putBlob(blobStore, turn));
  }
  return concatBytes([
    ...roots.map((id) => bytesField(1, id)),
    ...turns.map((id) => bytesField(8, id))
  ]);
}
function encodeRequestContext(timeZone = "UTC") {
  const env = stringField(10, timeZone);
  const requestContext = bytesField(4, env);
  return bytesField(2, requestContext);
}
function encodeModelDetails(model) {
  return concatBytes([
    stringField(1, model),
    stringField(3, model),
    stringField(4, model),
    stringField(5, model)
  ]);
}
function encodeMcpTools(tools) {
  const supported = (Array.isArray(tools) ? tools : []).map((tool) => {
    const name2 = String(tool?.name ?? tool?.function?.name ?? "").trim();
    if (!name2) return null;
    const fn = tool?.function ?? tool;
    const definition = concatBytes([
      stringField(1, name2),
      stringField(4, "opencodex-responses"),
      stringField(5, name2),
      stringField(2, fn?.description ?? "")
      // Cursor accepts a protobuf Value. A JSON string is intentionally not
      // sent here; unsupported schemas are omitted so the Agent turn does not
      // enter the heartbeat-only state caused by an invalid Value payload.
    ]);
    return bytesField(1, definition);
  }).filter(Boolean);
  return concatBytes(supported);
}
function encodeAgentRunRequest({
  messages,
  model,
  requestId = randomUUID7(),
  conversationId = requestId,
  tools = [],
  timeZone = "UTC"
} = {}) {
  const normalized = normalizedMessages(messages);
  const blobStore = /* @__PURE__ */ new Map();
  const latestUserIndex = normalized.map((message) => message.role).lastIndexOf("user");
  const latestUserText = latestUserIndex >= 0 ? normalized[latestUserIndex].content : normalized.at(-1)?.content ?? "Continue the conversation.";
  const priorConversation = latestUserIndex > 0 ? normalized.slice(0, latestUserIndex).filter((message) => message.role !== "system").map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`).join("\n\n") : "";
  const userText = priorConversation ? `Conversation history:
${priorConversation}

Current user message:
${latestUserText}` : latestUserText;
  const userMessage = encodeUserMessage(userText, requestId, 1);
  const userAction = concatBytes([
    bytesField(1, userMessage),
    encodeRequestContext(timeZone)
  ]);
  const action = bytesField(1, userAction);
  const run = concatBytes([
    bytesField(1, encodeConversationState(normalized, blobStore, requestId)),
    bytesField(2, action),
    bytesField(3, encodeModelDetails(String(model ?? ""))),
    bytesField(4, encodeMcpTools(tools)),
    stringField(5, conversationId)
  ]);
  const clientMessage = bytesField(1, run);
  return { frame: frameConnectMessage(clientMessage), blobs: blobStore, requestId, conversationId };
}
function encodeHeartbeat() {
  return frameConnectMessage(bytesField(7, new Uint8Array()));
}
function decodeConnectFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 5) {
    const flags = buffer[offset];
    const length = new DataView(buffer.buffer, buffer.byteOffset + offset + 1, 4).getUint32(0, false);
    if (buffer.length - offset - 5 < length) break;
    frames.push({ flags, payload: buffer.slice(offset + 5, offset + 5 + length) });
    offset += 5 + length;
  }
  return { frames, rest: buffer.slice(offset) };
}
function cursorFrameMetadata(message, flags = null) {
  const bytes = message instanceof Uint8Array ? message : Uint8Array.from(message ?? []);
  const fieldPaths = [];
  const visit = (value, prefix = [], depth = 0) => {
    if (depth > 4 || fieldPaths.length >= 64) return;
    for (const field of decodeProtoFields(value).slice(0, 32)) {
      const path = [...prefix, field.field].join(".");
      fieldPaths.push({ path, wireType: field.wireType, byteLength: field.value instanceof Uint8Array ? field.value.byteLength : null });
      if (field.wireType === 2) visit(field.value, [...prefix, field.field], depth + 1);
      if (fieldPaths.length >= 64) return;
    }
  };
  visit(bytes);
  return {
    ...Number.isInteger(flags) ? { flags } : {},
    payloadLength: bytes.byteLength,
    fieldPaths
  };
}
function decodeCursorConnectTrailer(payload) {
  const bytes = payload instanceof Uint8Array ? payload : Uint8Array.from(payload ?? []);
  const text3 = textDecoder.decode(bytes).trim();
  if (!text3) return null;
  if (text3.startsWith("{")) {
    let parsed = null;
    try {
      parsed = JSON.parse(text3);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object") {
      const error = parsed.error && typeof parsed.error === "object" ? parsed.error : null;
      const rawCode = error ? error.code : parsed.status ?? parsed.code;
      const label = rawCode === void 0 || rawCode === null || !String(rawCode).trim() ? null : grpcStatusLabel(rawCode);
      if (!label) {
        if (!error) return null;
        const fallbackMessage = typeof error.message === "string" && error.message.trim() ? error.message.trim().slice(0, 500) : "CURSOR_CONNECT_ERROR";
        return { code: "CURSOR_CONNECT_ERROR", message: fallbackMessage };
      }
      const messageSource = error?.message ?? parsed.message;
      return {
        code: label,
        message: typeof messageSource === "string" && messageSource.trim() ? messageSource.trim().slice(0, 500) : label
      };
    }
  }
  const status = decodeGoogleRpcStatus(bytes);
  if (status) {
    const code = grpcStatusLabel(status.code);
    return {
      code,
      message: status.message.trim() ? status.message.trim().slice(0, 500) : code
    };
  }
  return { code: "CURSOR_CONNECT_ERROR", message: text3.slice(0, 500) };
}
var GRPC_STATUS_NAMES = /* @__PURE__ */ new Map([
  [0, "OK"],
  [1, "CANCELLED"],
  [2, "UNKNOWN"],
  [3, "INVALID_ARGUMENT"],
  [4, "DEADLINE_EXCEEDED"],
  [5, "NOT_FOUND"],
  [6, "ALREADY_EXISTS"],
  [7, "PERMISSION_DENIED"],
  [8, "RESOURCE_EXHAUSTED"],
  [9, "FAILED_PRECONDITION"],
  [10, "ABORTED"],
  [11, "OUT_OF_RANGE"],
  [12, "UNIMPLEMENTED"],
  [13, "INTERNAL"],
  [14, "UNAVAILABLE"],
  [15, "DATA_LOSS"],
  [16, "UNAUTHENTICATED"]
]);
function grpcStatusLabel(value) {
  const text3 = String(value ?? "").trim();
  if (/^\d+$/.test(text3)) return GRPC_STATUS_NAMES.get(Number(text3)) ?? text3;
  return text3;
}
function cursorGrpcStatusFlags(code) {
  const label = grpcStatusLabel(code).toUpperCase();
  const flags = {};
  if (label === "UNAUTHENTICATED") flags.authExpired = true;
  else if (label === "PERMISSION_DENIED") flags.authForbidden = true;
  if (label === "RESOURCE_EXHAUSTED") flags.quotaExhausted = true;
  return flags;
}
function decodeGoogleRpcStatus(payload) {
  const bytes = payload instanceof Uint8Array ? payload : Uint8Array.from(payload ?? []);
  let offset = 0;
  let code = null;
  let message = "";
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset);
    if (!key) return null;
    offset = key.offset;
    const field = Number(key.value >> 3n);
    const wireType = Number(key.value & 7n);
    if (field === 1 && wireType === 0) {
      const value = readVarint(bytes, offset);
      if (!value) return null;
      const numeric = Number(BigInt.asIntN(32, value.value));
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > 16) return null;
      code = numeric;
      offset = value.offset;
      continue;
    }
    if ((field === 2 || field === 3) && wireType === 2) {
      const length = readVarint(bytes, offset);
      if (!length) return null;
      const end = length.offset + Number(length.value);
      if (end > bytes.length) return null;
      if (field === 2) message = textDecoder.decode(bytes.slice(length.offset, end));
      offset = end;
      continue;
    }
    return null;
  }
  if (code === null && message.length === 0) return null;
  return { code: code ?? 2, message };
}
function decodeCursorText(message) {
  try {
    const interaction = firstBytes(decodeProtoFields(message), 1);
    if (!interaction) return "";
    const update = firstBytes(decodeProtoFields(interaction), 1);
    if (!update) return "";
    return firstString6(decodeProtoFields(update), 1);
  } catch {
    return "";
  }
}
function cursorTurnComplete(message) {
  try {
    const interaction = firstBytes(decodeProtoFields(message), 1);
    if (!interaction) return false;
    return decodeProtoFields(interaction).some((field) => field.wireType === 2 && [14, 18, 19].includes(field.field));
  } catch {
    return false;
  }
}
function decodeKvRequest(message) {
  const kv = firstBytes(decodeProtoFields(message), 4);
  if (!kv) return null;
  const fields = decodeProtoFields(kv);
  const id = fields.find((field) => field.field === 1 && field.wireType === 0)?.value ?? 0;
  const getArgs = firstBytes(fields, 2);
  const setArgs = firstBytes(fields, 3);
  if (getArgs) return { id, kind: "get", blobId: firstBytes(decodeProtoFields(getArgs), 1) };
  if (setArgs) return { id, kind: "set" };
  return null;
}
function encodeKvResponse(request, blobs) {
  if (request.kind === "get") {
    const key = request.blobId ? Buffer.from(request.blobId).toString("hex") : "";
    const value = blobs.get(key) ?? new Uint8Array();
    const result = bytesField(1, value);
    return frameConnectMessage(bytesField(3, concatBytes([varintField(1, request.id), bytesField(2, result)])));
  }
  return frameConnectMessage(bytesField(3, concatBytes([varintField(1, request.id), bytesField(3, new Uint8Array())])));
}
function decodeCursorKvRequest(message) {
  return decodeKvRequest(message);
}
var CURSOR_TOOL_CALL_UPDATE_FIELDS = /* @__PURE__ */ new Map([
  [2, "tool_call_started"],
  [3, "tool_call_completed"],
  [7, "partial_tool_call"],
  [15, "tool_call_delta"]
]);
var CURSOR_TOOL_KINDS = /* @__PURE__ */ new Map([
  [1, "shell"],
  [3, "delete"],
  [4, "glob"],
  [5, "grep"],
  [8, "read"],
  [9, "update-todos"],
  [10, "read-todos"],
  [12, "edit"],
  [13, "ls"],
  [14, "read-lints"],
  [15, "mcp"],
  [16, "sem-search"],
  [17, "create-plan"],
  [18, "web-search"],
  [19, "task"],
  [20, "list-mcp-resources"],
  [21, "read-mcp-resource"],
  [22, "apply-agent-diff"],
  [23, "ask-question"],
  [24, "fetch"],
  [25, "switch-mode"],
  [26, "exa-search"],
  [27, "exa-fetch"],
  [28, "generate-image"],
  [29, "record-screen"],
  [30, "computer-use"],
  [31, "write-shell-stdin"],
  [32, "reflect"],
  [33, "setup-vm-environment"],
  [34, "truncated-tool-call"]
]);
function decodeCursorToolMessage(message) {
  try {
    const interaction = firstBytes(decodeProtoFields(message), 1);
    if (!interaction) return null;
    const updates = decodeProtoFields(interaction).filter((field) => field.wireType === 2 && CURSOR_TOOL_CALL_UPDATE_FIELDS.has(field.field));
    if (updates.length === 0) return null;
    let callId = "";
    let toolKind = null;
    for (const update of updates.slice(0, 8)) {
      const fields = decodeProtoFields(update.value);
      callId = callId || firstString6(fields, 1);
      const toolCall = firstBytes(fields, 2);
      const kindField = toolCall ? decodeProtoFields(toolCall).find((field) => CURSOR_TOOL_KINDS.has(field.field)) : null;
      if (kindField) toolKind = CURSOR_TOOL_KINDS.get(kindField.field);
    }
    return {
      updates: updates.map((update) => CURSOR_TOOL_CALL_UPDATE_FIELDS.get(update.field)),
      ...callId ? { callId } : {},
      ...toolKind ? { toolKind } : {}
    };
  } catch {
    return null;
  }
}
var cursorNativeProtocolConstants = Object.freeze({
  endpoint: "https://agent.api5.cursor.sh/agent.v1.AgentService/Run",
  providerIdentifier: "opencodex-responses"
});

// modules/provider-cursor/src/native-transport.mjs
var PROVIDER_ID8 = "cursor";
var DEFAULT_ENDPOINT4 = cursorNativeProtocolConstants.endpoint;
var DEFAULT_TOTAL_TIMEOUT_MS = 12e4;
var DEFAULT_IDLE_TIMEOUT_MS = 3e4;
var DEFAULT_CURSOR_CLIENT_VERSION = "cli-2025.09.17-agent-host";
var CURSOR_SESSION_KEYS = [
  "cursorAuth/accessToken",
  "cursorAuth/refreshToken",
  "cursorAuth/cachedEmail",
  "cursorAuth/stripeMembershipType"
];
function firstString7(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function createAsyncQueue() {
  const values = [];
  const waiters = [];
  let closed = false;
  let failure = null;
  return {
    push(value) {
      if (closed || failure) return;
      const waiter = waiters.shift();
      if (waiter) waiter.resolve({ value, done: false });
      else values.push(value);
    },
    close() {
      if (closed || failure) return;
      closed = true;
      while (waiters.length) waiters.shift().resolve({ value: void 0, done: true });
    },
    fail(error) {
      if (closed || failure) return;
      failure = error;
      while (waiters.length) waiters.shift().reject(error);
    },
    async next() {
      if (values.length) return { value: values.shift(), done: false };
      if (failure) throw failure;
      if (closed) return { value: void 0, done: true };
      return new Promise((resolve2, reject) => waiters.push({ resolve: resolve2, reject }));
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
function readCursorDesktopSession({
  credential,
  env = process.env,
  home = homedir8()
} = {}) {
  const stored = firstString7(credential?.access, credential?.token);
  if (stored) {
    return {
      token: stored,
      refreshToken: firstString7(credential?.refresh, credential?.refreshToken),
      expiresAt: firstString7(credential?.expiresAt, credential?.expires_at),
      email: firstString7(credential?.email),
      plan: firstString7(credential?.plan),
      kind: "oauth",
      source: "dockyard_credential"
    };
  }
  const fromEnv = firstString7(env.CURSOR_API_KEY, env.DOCKYARD_CURSOR_ACCESS_TOKEN);
  if (fromEnv) return { token: fromEnv, kind: "apiKey", source: "environment" };
  if (process.platform !== "darwin") return null;
  const dbPath = join9(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb");
  try {
    const quotedKeys = CURSOR_SESSION_KEYS.map((key) => `'${key}'`).join(",");
    const output = execFileSync2("sqlite3", ["-json", dbPath, `SELECT key, CAST(value AS TEXT) AS value FROM ItemTable WHERE key IN (${quotedKeys});`], {
      encoding: "utf8",
      timeout: 5e3,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const rows = JSON.parse(output || "[]");
    const valueFor = (key) => rows.find((row) => row.key === key)?.value;
    const access2 = valueFor("cursorAuth/accessToken");
    return access2 ? {
      token: access2,
      refreshToken: firstString7(valueFor("cursorAuth/refreshToken")),
      email: firstString7(valueFor("cursorAuth/cachedEmail")),
      plan: firstString7(valueFor("cursorAuth/stripeMembershipType")),
      kind: "oauth",
      source: "cursor_desktop_app"
    } : null;
  } catch {
    return null;
  }
}
function resolveCursorAccessToken(options = {}) {
  const session = readCursorDesktopSession(options);
  return session ? { token: session.token, kind: session.kind, ...session.expiresAt ? { expiresAt: session.expiresAt } : {} } : null;
}
function cursorHeaders(endpoint2, token, requestId, env) {
  const clientVersion = env.DOCKYARD_CURSOR_CLIENT_VERSION || DEFAULT_CURSOR_CLIENT_VERSION;
  const clientKey = randomBytes2(32).toString("hex");
  return {
    ":method": "POST",
    ":path": `${endpoint2.pathname}${endpoint2.search}`,
    ":scheme": "https",
    ":authority": endpoint2.host,
    authorization: `Bearer ${token}`,
    "content-type": "application/connect+proto",
    accept: "application/connect+proto",
    "connect-protocol-version": "1",
    "x-request-id": requestId,
    "x-cursor-client-version": clientVersion,
    "x-cursor-client-type": "cli",
    "x-cursor-client-key": clientKey,
    "x-cursor-streaming": "true"
  };
}
function cursorStatusError(status) {
  return nativeProviderError(PROVIDER_ID8, `Cursor AgentService returned HTTP ${status}`, { status });
}
function streamCursor({
  endpoint: endpoint2,
  token,
  request,
  context,
  http2Module = http2,
  timeoutMs = DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS
}) {
  return (async function* cursorStream() {
    const requestId = firstString7(request.requestId, context.requestId, randomUUID8());
    const conversationId = firstString7(request.sessionId, context.sessionId, requestId);
    const model = firstString7(request.model);
    if (!model) throw nativeProviderError(PROVIDER_ID8, "Cursor model is missing");
    const timeZone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        return "UTC";
      }
    })();
    const encoded = encodeAgentRunRequest({
      messages: request.messages,
      model,
      requestId,
      conversationId,
      // Cursor's AgentService uses its own native tool/exec protocol. Keep
      // this request on the text path until DSH's tool bridge answers those
      // bidirectional ExecServer messages; no CLI prompt is involved.
      tools: [],
      timeZone
    });
    const url = new URL(endpoint2);
    const session = http2Module.connect(url.origin);
    const queue = createAsyncQueue();
    let stream = null;
    let responseStatus = 0;
    let responseBuffer = new Uint8Array();
    const responseDiagnostics = [];
    const protocolError = (message, code) => {
      const error = nativeProviderError(PROVIDER_ID8, message, { code });
      if (responseDiagnostics.length > 0) error.cursorDiagnostics = responseDiagnostics.slice(0, 32);
      return error;
    };
    let completed = false;
    let cleaned = false;
    let heartbeat;
    let totalTimer;
    let idleTimer;
    const timeoutFailure = (message, code) => {
      const error = nativeProviderError(PROVIDER_ID8, message, { code });
      error.code = code;
      queue.fail(error);
      stream?.close(http2Module.constants?.NGHTTP2_CANCEL);
      session.close();
    };
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => timeoutFailure("Cursor AgentService response idle timeout", "ETIMEDOUT"), idleTimeoutMs);
      idleTimer.unref?.();
    };
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      clearTimeout(totalTimer);
      clearTimeout(idleTimer);
      context.signal?.removeEventListener?.("abort", onAbort);
      if (stream && !stream.destroyed && !stream.closed) stream.close();
      if (!session.closed && !session.destroyed) session.close();
    };
    const onAbort = () => {
      const error = nativeProviderError(PROVIDER_ID8, "Cursor request aborted");
      error.code = "ABORT_ERR";
      queue.fail(error);
      stream?.close(http2Module.constants?.NGHTTP2_CANCEL);
      session.close();
    };
    totalTimer = setTimeout(() => timeoutFailure("Cursor AgentService total request timeout", "ETIMEDOUT"), timeoutMs);
    totalTimer.unref?.();
    armIdleTimer();
    context.signal?.addEventListener?.("abort", onAbort, { once: true });
    if (context.signal?.aborted) onAbort();
    session.once("error", (error) => queue.fail(error));
    try {
      stream = session.request(cursorHeaders(url, token, requestId, context.env ?? process.env));
      stream.once("response", (headers) => {
        armIdleTimer();
        responseStatus = Number(headers[":status"] ?? 0);
        if (responseStatus >= 400) queue.fail(cursorStatusError(responseStatus));
      });
      stream.on("data", (chunk) => {
        armIdleTimer();
        const incoming = new Uint8Array(chunk);
        const merged = new Uint8Array(responseBuffer.byteLength + incoming.byteLength);
        merged.set(responseBuffer);
        merged.set(incoming, responseBuffer.byteLength);
        const decoded = decodeConnectFrames(merged);
        responseBuffer = decoded.rest;
        for (const frame of decoded.frames) {
          if ((frame.flags & 2) !== 0) {
            const trailer = decodeCursorConnectTrailer(frame.payload);
            if (trailer) {
              const error = nativeProviderError(PROVIDER_ID8, trailer.message, {
                code: trailer.code,
                body: { code: trailer.code, message: trailer.message }
              });
              Object.assign(error, cursorGrpcStatusFlags(trailer.code));
              queue.fail(error);
            } else {
              completed = true;
              queue.push({ type: "complete" });
            }
            continue;
          }
          if ((frame.flags & 1) !== 0) {
            responseDiagnostics.push(cursorFrameMetadata(frame.payload, frame.flags));
            queue.fail(protocolError("Cursor returned a compressed protobuf frame", "CURSOR_COMPRESSED_RESPONSE"));
            continue;
          }
          const kv = decodeCursorKvRequest(frame.payload);
          if (kv) {
            try {
              stream?.write(Buffer.from(encodeKvResponse(kv, encoded.blobs)));
            } catch (error) {
              queue.fail(error);
            }
            continue;
          }
          const toolCall = decodeCursorToolMessage(frame.payload);
          if (toolCall) {
            queue.fail(protocolError(
              `Cursor AgentService requested an unsupported native tool call${toolCall.toolKind ? ` (${toolCall.toolKind})` : ""}${toolCall.callId ? ` [${toolCall.callId}]` : ""}; DSH's Cursor transport does not execute server-side tools`,
              "CURSOR_UNSUPPORTED_TOOL_CALL"
            ));
            continue;
          }
          const text4 = decodeCursorText(frame.payload);
          const turnComplete = cursorTurnComplete(frame.payload);
          if (text4) queue.push({ type: "text", text: text4 });
          if (!text4) responseDiagnostics.push(cursorFrameMetadata(frame.payload, frame.flags));
          if (turnComplete) {
            completed = true;
            queue.push({ type: "complete" });
          }
        }
      });
      stream.once("end", () => {
        if (responseBuffer.byteLength > 0) {
          responseDiagnostics.push({
            payloadLength: responseBuffer.byteLength,
            incomplete: true
          });
          queue.fail(protocolError("Cursor AgentService returned an incomplete Connect frame", "CURSOR_INCOMPLETE_RESPONSE"));
        } else {
          queue.close();
        }
      });
      stream.once("error", (error) => queue.fail(error));
      stream.write(Buffer.from(encoded.frame));
      heartbeat = setInterval(() => {
        if (!stream || stream.destroyed || stream.closed) return;
        try {
          stream.write(Buffer.from(encodeHeartbeat()));
        } catch {
        }
      }, 5e3);
      let text3 = "";
      let failed = false;
      yield { type: "block-start", index: 0, blockType: "text" };
      try {
        for await (const item of queue) {
          if (item.type === "text") {
            text3 += item.text;
            yield { type: "text-delta", index: 0, text: item.text };
          } else if (item.type === "complete") {
            completed = true;
            break;
          }
        }
      } catch (error) {
        failed = true;
        if (error?.status === 401 || error?.status === 403) error.authExpired = error.status === 401;
        throw error;
      } finally {
        cleanup();
      }
      if (!failed) {
        if (!completed) {
          throw protocolError("Cursor AgentService ended before completing the turn", "CURSOR_INCOMPLETE_RESPONSE");
        }
        if (text3.trim().length === 0) {
          throw protocolError("Cursor AgentService completed without assistant text", "CURSOR_EMPTY_RESPONSE");
        }
        yield { type: "block-end", index: 0, block: { type: "text", text: text3 } };
        yield { type: "finish", reason: { kind: "stop" } };
      }
    } catch (error) {
      cleanup();
      throw error;
    }
  })();
}
function createCursorNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_CURSOR_ENDPOINT || DEFAULT_ENDPOINT4,
  env = process.env,
  home = homedir8(),
  tokenResolver = resolveCursorAccessToken,
  http2Module = http2,
  timeoutMs = Number(process.env.DOCKYARD_CURSOR_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs = Number(process.env.DOCKYARD_CURSOR_IDLE_TIMEOUT_MS) || DEFAULT_IDLE_TIMEOUT_MS
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID8 });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    if (context.secretStore) {
      const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
      if (ref) credential = await context.secretStore.read(ref);
    }
    const auth = await tokenResolver({ credential, env: { ...env, ...context.env ?? {} }, home });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID8, "Cursor OAuth token is unavailable; authorize Cursor first");
      error.authExpired = true;
      throw error;
    }
    if (auth.expiresAt) {
      const expiry = Date.parse(auth.expiresAt);
      if (Number.isFinite(expiry) && expiry <= Date.now()) {
        const error = nativeProviderError(PROVIDER_ID8, "Cursor OAuth access token expired; authorize Cursor again", {
          code: "CURSOR_TOKEN_EXPIRED"
        });
        error.authExpired = true;
        throw error;
      }
    }
    return streamCursor({
      endpoint: safeEndpoint,
      token: auth.token,
      request,
      context,
      http2Module,
      timeoutMs,
      idleTimeoutMs
    });
  };
  executor.nativeTransport = "cursor-connect-agent-service";
  return executor;
}
var cursorNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID8,
  endpoint: DEFAULT_ENDPOINT4,
  clientVersion: DEFAULT_CURSOR_CLIENT_VERSION,
  totalTimeoutMs: DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS
});

// modules/provider-cursor/src/driver.mjs
var PROVIDER_ID9 = "cursor";
var CREDENTIAL_SLOT5 = Symbol("dockyard-cursor-session");
function hash5(value) {
  return createHash8("sha256").update(String(value)).digest("hex");
}
function firstString8(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function normalizeTokenExpiry(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1e3;
    const date2 = new Date(millis);
    return Number.isNaN(date2.getTime()) ? null : date2.toISOString();
  }
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function cursorTokenExpiresAt(raw = {}, payload = {}) {
  const direct = normalizeTokenExpiry(raw.expiresAt ?? raw.expires_at);
  if (direct) return direct;
  const expiresIn = raw.expiresIn ?? raw.expires_in;
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1e3).toISOString();
  }
  return normalizeTokenExpiry(payload.exp);
}
function tokenIsExpired(value, now = Date.now()) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now;
}
function tokenNeedsRefresh2(value, now = Date.now(), leewayMs = 6e4) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now + leewayMs;
}
function statusObject2(output) {
  return parseJsonOutput(output) ?? {};
}
function statusValue(value, ...keys) {
  for (const key of keys) {
    const parts = key.split(".");
    let current = value;
    for (const part of parts) current = current?.[part];
    if (typeof current === "string" && current.length > 0) return current;
    if (typeof current === "number" || typeof current === "boolean") return current;
    if (Array.isArray(current)) return current;
    if (current && typeof current === "object") return current;
  }
  return null;
}
function parseTextEmail(output) {
  return String(output).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}
function parseCursorAuthStatus(output) {
  const raw = statusObject2(output);
  const email = firstString8(
    statusValue(raw, "email", "user.email", "account.email", "accountEmail"),
    parseTextEmail(output)
  );
  const explicitLoggedIn = statusValue(raw, "loggedIn", "authenticated", "isAuthenticated");
  const text3 = String(output);
  const loggedIn = typeof explicitLoggedIn === "boolean" ? explicitLoggedIn : !/not authenticated|not logged in|unauthenticated|please login/i.test(text3) && /authenticated|logged in|account|endpoint/i.test(text3);
  const accountId = firstString8(
    statusValue(raw, "accountId", "account_id", "userId", "user_id", "user.id", "account.id"),
    email,
    "cursor:active"
  );
  const plan = firstString8(
    statusValue(raw, "plan", "planName", "subscription.plan", "subscription.name", "tier", "subscriptionTier")
  );
  const displayName = firstString8(statusValue(raw, "name", "user.name", "account.name"), email, accountId);
  const models = [
    statusValue(raw, "models"),
    statusValue(raw, "availableModels"),
    statusValue(raw, "modelCatalog")
  ].find((value) => Array.isArray(value)) ?? [];
  return {
    loggedIn,
    accountId,
    email,
    plan,
    displayName,
    models,
    raw
  };
}
function activeSessionError3(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}
function candidateFromStatus2(status, {
  source = "official_cursor_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  imported = false,
  credential = null
} = {}) {
  const credentialRef = createCredentialRef(PROVIDER_ID9, status.accountId);
  const candidate2 = {
    candidateId: `cursor:${hash5(status.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID9,
    source,
    accountId: status.accountId,
    displayName: status.displayName ?? status.accountId,
    email: status.email,
    subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: null,
      nextRefreshAt: null,
      lastRefreshedAt: null,
      refreshable: false
    },
    credentialRef,
    resources: officialSessionResources({ sourceKind, authSource: source }),
    imported,
    status: status.loggedIn ? "available" : "degraded",
    diagnostic: status.loggedIn ? null : "Cursor \u5B98\u65B9\u4F1A\u8BDD\u5F53\u524D\u672A\u8FD4\u56DE\u5DF2\u767B\u5F55\u72B6\u6001"
  };
  Object.defineProperty(candidate2, CREDENTIAL_SLOT5, {
    value: credential ?? {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID9,
      accountId: status.accountId,
      sourceKind
    },
    enumerable: false
  });
  return candidate2;
}
async function resolveCursorBrowserEmail(raw, access2, {
  fetchImpl = null,
  apiBaseUrl = "https://api2.cursor.sh",
  home = homedir9(),
  signal
} = {}) {
  const payload = decodeJwtPayload(access2) ?? {};
  const direct = firstString8(
    raw?.email,
    raw?.user?.email,
    raw?.profile?.email,
    payload.email,
    payload.user_email,
    payload.email_address,
    payload["https://cursor.com/email"]
  );
  if (direct) return direct;
  try {
    const desktop = readCursorDesktopSession({ home });
    if (desktop?.email) return desktop.email;
  } catch {
  }
  if (typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, "")}/aiserver.v1.AuthService/GetEmail`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${access2}`
      },
      body: "{}",
      ...signal ? { signal } : {}
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({}));
    return firstString8(body?.email, body?.user?.email, body?.profile?.email);
  } catch {
    return null;
  }
}
async function candidateFromBrowserTokens(raw, options = {}) {
  const access2 = firstString8(raw?.accessToken, raw?.access_token);
  const refresh = firstString8(raw?.refreshToken, raw?.refresh_token);
  if (!access2 || !refresh) throw new Error("Cursor browser login did not return access and refresh tokens");
  const payload = decodeJwtPayload(access2) ?? {};
  const expiresAt = cursorTokenExpiresAt(raw, payload);
  const email = await resolveCursorBrowserEmail(raw, access2, options);
  const accountId = firstString8(raw.accountId, raw.account_id, raw.userId, raw.user_id, payload.sub, payload.user_id, email) ?? `cursor:${hash5(access2).slice(0, 20)}`;
  const candidate2 = candidateFromStatus2({
    loggedIn: true,
    accountId,
    email,
    plan: firstString8(raw.plan, raw.subscription?.plan, raw.membershipType, payload.plan),
    displayName: firstString8(raw.name, raw.user?.name, email, accountId)
  }, {
    source: "official_cursor_browser_oauth",
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    credential: {
      type: "oauth",
      providerId: PROVIDER_ID9,
      accountId,
      access: access2,
      refresh,
      ...expiresAt ? { expiresAt } : {},
      email,
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
    }
  });
  candidate2.refresh = {
    ...candidate2.refresh,
    accessTokenExpiresAt: expiresAt,
    refreshable: true
  };
  return candidate2;
}
function desktopSessionAccountId(session) {
  return session.email ? `cursor:${hash5(session.email.toLowerCase()).slice(0, 20)}` : "cursor:desktop";
}
function statusFromDesktopSession(session) {
  return {
    source: "cursor_desktop_app",
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    loggedIn: true,
    accountId: session.accountId,
    email: session.email,
    plan: session.plan,
    displayName: session.email ?? "Cursor desktop session",
    models: [],
    raw: {
      source: "cursor_desktop_app",
      loggedIn: true,
      email: session.email,
      plan: session.plan
    }
  };
}
function candidateFromDesktopSession(session) {
  const accountId = session.accountId ?? desktopSessionAccountId(session);
  const expiresAt = cursorTokenExpiresAt({}, decodeJwtPayload(session.token) ?? {});
  const candidate2 = {
    candidateId: `cursor:desktop:${hash5(accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID9,
    source: "cursor_desktop_app",
    accountId,
    displayName: session.email ?? "Cursor desktop session",
    email: session.email,
    subscription: { plan: session.plan, status: "active", expiresAt: null },
    refresh: {
      accessTokenExpiresAt: expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: null,
      refreshable: Boolean(session.refreshToken)
    },
    credentialRef: createCredentialRef(PROVIDER_ID9, accountId),
    imported: false,
    status: "available",
    diagnostic: null,
    resources: {
      ...officialSessionResources({
        sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
        authSource: "cursor_desktop_app"
      }),
      transport: "cursor_connect_agent_service",
      identitySource: "cursor_desktop_app",
      sessionPersistence: "captured",
      quotaSource: "cursor_desktop_app"
    }
  };
  Object.defineProperty(candidate2, CREDENTIAL_SLOT5, {
    value: {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID9,
      accountId,
      access: session.token,
      ...session.refreshToken ? { refresh: session.refreshToken } : {},
      ...expiresAt ? { expiresAt } : {}
    },
    enumerable: false
  });
  return candidate2;
}
function summarizeCursorCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID9,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function normalizeModel(value) {
  if (typeof value === "string") return { id: value, name: value };
  if (!value || typeof value !== "object") return null;
  const id = firstString8(value.id, value.model, value.modelId, value.name);
  if (!id) return null;
  const contextWindow = value.contextWindow ?? value.context_window ?? value.contextTokenLimit ?? value.context_token_limit;
  const maxTokens = value.maxTokens ?? value.max_tokens ?? value.maxOutputTokens ?? value.max_output_tokens;
  const inputModalities = value.input ?? value.inputModalities ?? value.input_modalities ?? (value.supportsImages || value.supports_images ? ["text", "image"] : null);
  return {
    id,
    name: firstString8(
      value.clientDisplayName,
      value.client_display_name,
      value.displayName,
      value.display_name,
      value.name,
      value.label,
      id
    ),
    ...Number.isInteger(contextWindow) ? { contextWindow } : {},
    ...Number.isInteger(maxTokens) ? { maxTokens } : {},
    ...Array.isArray(inputModalities) ? { inputModalities: [...inputModalities] } : {},
    ...value.reasoning ? { reasoning: value.reasoning } : {},
    ...value.supportsThinking || value.supports_thinking ? { reasoning: { supported: true } } : {}
  };
}
function browserCatalogAccount(accounts) {
  return (Array.isArray(accounts) ? accounts : []).find((entry) => entry?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER || entry?.resources?.authSource === "official_cursor_browser_oauth");
}
function createCursorCatalogLoader({
  cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
  env = process.env,
  commandRunner = runCliCommand,
  apiBaseUrl = process.env.CURSOR_API_BASE_URL || "https://api2.cursor.sh",
  fetchImpl = fetch
} = {}) {
  const cachedBuckets = /* @__PURE__ */ new Map();
  const pendingBuckets = /* @__PURE__ */ new Map();
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  function catalogBucketKey(accounts) {
    const account = browserCatalogAccount(accounts);
    const identity = account?.auth?.credentialRef ?? account?.credentialRef ?? account?.accountId;
    return identity ? String(identity) : "shared";
  }
  async function loadBrowserCatalog({ accounts, secretStore, signal }) {
    const account = browserCatalogAccount(accounts);
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    if (!account || !credentialRef || typeof secretStore?.read !== "function") return null;
    const credential = await secretStore.read(credentialRef);
    if (!credential?.access) return null;
    const response = await fetchImpl(`${normalizedApiBaseUrl}/aiserver.v1.AiService/AvailableModels`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${credential.access}`
      },
      body: JSON.stringify({
        isNightly: false,
        excludeMaxNamedModels: true,
        additionalModelNames: [],
        useModelParameters: true,
        useReactModelPicker: true
      }),
      ...signal ? { signal } : {}
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({}));
    const values = Array.isArray(body?.models) ? body.models : body?.modelNames ?? body?.model_names;
    const models = (Array.isArray(values) ? values : []).map(normalizeModel).filter(Boolean);
    if (models.length === 0) return null;
    return {
      models,
      source: "official_cursor_browser_oauth_api"
    };
  }
  return async function loadCatalog({ force = false, accounts = [], secretStore, signal } = {}) {
    const bucketKey = catalogBucketKey(accounts);
    const hasBrowserAccount = bucketKey !== "shared";
    const cached = cachedBuckets.get(bucketKey);
    if (!force && cached && (hasBrowserAccount ? cached.source === "official_cursor_browser_oauth_api" : cached.source !== "official_cursor_browser_oauth_api")) return cached;
    const pending = pendingBuckets.get(bucketKey);
    if (pending) return pending;
    const promise = (async () => {
      try {
        const browser = await loadBrowserCatalog({ accounts, secretStore, signal });
        if (browser) {
          cachedBuckets.set(bucketKey, browser);
          return browser;
        }
      } catch {
      }
      try {
        const result = await commandRunner(cliPath, ["status"], {
          env,
          providerId: PROVIDER_ID9,
          timeoutMs: 3e4,
          ...signal ? { signal } : {}
        });
        const status = parseCursorAuthStatus(result.output);
        const models = status.models.map(normalizeModel).filter(Boolean);
        const catalog = {
          models,
          source: "official_cursor_cli_status",
          ...models.length ? {} : { diagnostics: ["Cursor \u5B98\u65B9 status \u6CA1\u6709\u8FD4\u56DE\u6A21\u578B\u76EE\u5F55"] }
        };
        if (models.length) cachedBuckets.set(bucketKey, catalog);
        else cachedBuckets.delete(bucketKey);
        return catalog;
      } catch (error) {
        const desktop = readCursorDesktopSession({ env });
        const catalog = {
          models: [],
          source: error?.code === "ENOENT" ? desktop ? "cursor_desktop_app" : "cursor_cli_not_found" : "official_cursor_cli_status",
          diagnostics: [desktop ? "\u5DF2\u68C0\u6D4B\u5230 Cursor \u5B98\u65B9 OAuth\uFF1B\u5B98\u65B9\u6A21\u578B\u76EE\u5F55\u8BF7\u6C42\u672A\u8FD4\u56DE\u7ED3\u679C" : `\u65E0\u6CD5\u8BFB\u53D6 Cursor \u5B98\u65B9\u6A21\u578B\u76EE\u5F55\uFF1A${error.message}`]
        };
        cachedBuckets.delete(bucketKey);
        return catalog;
      }
    })().finally(() => {
      pendingBuckets.delete(bucketKey);
    });
    pendingBuckets.set(bucketKey, promise);
    return promise;
  };
}
var CursorSubscriptionDriver = class {
  constructor({
    cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
    env = process.env,
    home = homedir9(),
    commandRunner = runCliCommand,
    requestExecutor = null,
    catalogLoader = null,
    sessionReader = null,
    sessionSource = "official_cursor_client",
    sessionSourceKind = OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CURSOR_BROWSER_OAUTH !== "0",
    websiteUrl = env.CURSOR_WEBSITE_URL || "https://cursor.com",
    apiBaseUrl = env.CURSOR_API_BASE_URL || "https://api2.cursor.sh",
    refreshUrl = env.CURSOR_REFRESH_URL || `${apiBaseUrl}/auth/exchange_user_api_key`,
    fetchImpl = fetch
  } = {}) {
    this.cliPath = cliPath;
    this.env = env;
    this.home = home;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.websiteUrl = websiteUrl.replace(/\/+$/, "");
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    const refreshEndpoint = new URL(refreshUrl);
    if (refreshEndpoint.protocol !== "https:") {
      throw new Error("Cursor OAuth refresh endpoint must use HTTPS");
    }
    this.refreshUrl = refreshEndpoint.toString().replace(/\/$/, "");
    this.sessionReader = sessionReader;
    this.sessionSource = sessionSource;
    this.sessionSourceKind = sessionSourceKind;
    this.catalogLoader = catalogLoader ?? createCursorCatalogLoader({
      cliPath,
      env,
      commandRunner,
      apiBaseUrl: this.apiBaseUrl,
      fetchImpl: this.fetchImpl
    });
    this.clientSessionAuthorizer = createOfficialSessionAuthorizer({
      providerId: PROVIDER_ID9,
      source: sessionSource,
      instructions: "\u8BF7\u5728 Cursor \u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      readSession: async (context = {}) => {
        const status = this.sessionReader ? await this.#readStatus(context.signal) : (() => {
          const desktop2 = this.#readDesktopSession();
          return desktop2 ? statusFromDesktopSession(desktop2) : null;
        })();
        if (!status?.loggedIn) return { accounts: [] };
        const desktop = status.source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
        const candidate2 = desktop ? candidateFromDesktopSession(desktop) : candidateFromStatus2(status, { source: status.source, sourceKind: status.sourceKind });
        return { accounts: [await this.importAccount(candidate2, context)] };
      }
    });
    this.cliAuthorizer = createCliStatusAuthorizer({
      providerId: PROVIDER_ID9,
      cliPath,
      loginArgs: ["login"],
      environment: env,
      browserOpened: true,
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Cursor CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728 Cursor \u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importStatus: async (context) => {
        const status = await this.#readStatus();
        if (!status.loggedIn) return [];
        return [await this.importAccount(candidateFromStatus2(status, {
          source: status.source,
          sourceKind: status.sourceKind
        }), context)];
      }
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID9,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Cursor \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async () => {
        const verifier = randomBytes3(32).toString("base64url");
        const challenge = createHash8("sha256").update(verifier).digest("base64url");
        const uuid = randomUUID9();
        return {
          url: `${this.websiteUrl}/loginDeepControl?${new URLSearchParams({
            challenge,
            uuid,
            mode: "login",
            redirectTarget: "cli"
          })}`,
          metadata: { uuid, verifier }
        };
      },
      pollSession: async ({ metadata, context }) => {
        if (!metadata?.uuid || !metadata.verifier) return null;
        const response = await this.fetchImpl(`${this.apiBaseUrl}/auth/poll?${new URLSearchParams({
          uuid: metadata.uuid,
          verifier: metadata.verifier
        })}`, {
          headers: { "content-type": "application/json" },
          ...context.signal ? { signal: context.signal } : {}
        });
        if (response.status === 404) return null;
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Cursor browser OAuth polling failed (${response.status})`);
        return body?.accessToken && body?.refreshToken ? body : null;
      },
      importCredentials: async (raw, context) => [await this.importAccount(await candidateFromBrowserTokens(raw, {
        fetchImpl: this.fetchImpl,
        apiBaseUrl: this.apiBaseUrl,
        home: this.home,
        signal: context.signal
      }), context)]
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  #readDesktopSession() {
    const session = readCursorDesktopSession({ env: this.env, home: this.home });
    if (!session?.token || session.source !== "cursor_desktop_app") return null;
    return {
      ...session,
      accountId: desktopSessionAccountId(session)
    };
  }
  #statusFromResult(result, defaults = {}) {
    const normalized = normalizeOfficialSessionResult(result, {
      source: defaults.source ?? "official_cursor_cli",
      sourceKind: defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI
    });
    const status = parseCursorAuthStatus(normalized?.output ?? "");
    return {
      ...status,
      source: normalized?.source ?? defaults.source ?? "official_cursor_cli",
      sourceKind: normalized?.sourceKind ?? defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI
    };
  }
  async #readStatus(signal) {
    if (typeof this.sessionReader === "function") {
      try {
        const value = await this.sessionReader({ env: this.env, home: this.home, signal });
        const normalized = normalizeOfficialSessionResult(value, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind
        });
        if (normalized) return this.#statusFromResult(normalized, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind
        });
      } catch {
      }
    }
    try {
      const result = await this.commandRunner(this.cliPath, ["status"], {
        env: this.env,
        providerId: PROVIDER_ID9,
        timeoutMs: 3e4,
        ...signal ? { signal } : {}
      });
      const status = this.#statusFromResult(result, {
        source: "official_cursor_cli",
        sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.CLI
      });
      if (status.loggedIn) return status;
      const desktop = this.#readDesktopSession();
      return desktop ? statusFromDesktopSession(desktop) : status;
    } catch (error) {
      const desktop = this.#readDesktopSession();
      if (desktop) return statusFromDesktopSession(desktop);
      throw error;
    }
  }
  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_cursor_browser_oauth" || account?.refresh?.refreshable === true;
  }
  async #refreshBrowserCredential(account, context = {}) {
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    const credential = context.secretStore && credentialRef ? await context.secretStore.read(credentialRef) : null;
    if (!credential?.access) throw activeSessionError3("Cursor browser OAuth credential is missing; authorize again");
    const expiresAt = cursorTokenExpiresAt(credential, decodeJwtPayload(credential.access) ?? {});
    const now = context.now instanceof Date ? context.now.getTime() : Date.now();
    if (!tokenNeedsRefresh2(expiresAt, now)) return credential;
    if (!credential.refresh) throw activeSessionError3("Cursor browser OAuth token expired; authorize again");
    let response;
    try {
      response = await this.fetchImpl(this.refreshUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential.refresh}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: "{}",
        ...context.signal ? { signal: context.signal } : {}
      });
    } catch (error) {
      const wrapped = activeSessionError3("Cursor browser OAuth access token expired and refresh failed; authorize again");
      wrapped.cause = error;
      throw wrapped;
    }
    const body = await response.json().catch(() => ({}));
    const access2 = firstString8(body?.accessToken, body?.access_token);
    if (!response.ok || !access2) {
      const error = activeSessionError3("Cursor browser OAuth access token expired and refresh failed; authorize again");
      error.status = response.status;
      throw error;
    }
    const refresh = firstString8(body?.refreshToken, body?.refresh_token, credential.refresh);
    const refreshedExpiresAt = cursorTokenExpiresAt({
      expiresAt: body?.expiresAt ?? body?.expires_at,
      expiresIn: body?.expiresIn ?? body?.expires_in
    }, decodeJwtPayload(access2) ?? {});
    const updated = {
      ...credential,
      access: access2,
      refresh,
      ...refreshedExpiresAt ? { expiresAt: refreshedExpiresAt } : {},
      lastRefreshedAt: new Date(now).toISOString()
    };
    await context.secretStore.write(credentialRef, updated);
    return updated;
  }
  async #browserStatus(account, context = {}) {
    const credential = await this.#refreshBrowserCredential(account, context);
    const expiresAt = cursorTokenExpiresAt(credential, decodeJwtPayload(credential.access) ?? {});
    if (tokenIsExpired(expiresAt)) {
      throw activeSessionError3("Cursor browser OAuth access token expired; authorize again");
    }
    const email = account.email ?? await resolveCursorBrowserEmail({}, credential.access, {
      fetchImpl: this.fetchImpl,
      apiBaseUrl: this.apiBaseUrl,
      home: this.home,
      signal: context.signal
    });
    return {
      loggedIn: true,
      accountId: account.accountId,
      email,
      displayName: email ?? account.displayName,
      plan: account.subscription?.plan ?? null,
      credential,
      raw: {}
    };
  }
  async #assertActiveSession(account, signal, context = {}) {
    if (this.#isBrowserAccount(account)) return this.#browserStatus(account, context);
    const status = await this.#readStatus(signal);
    if (!status.loggedIn) throw activeSessionError3("Cursor OAuth session is not active; authorize again");
    if (account?.accountId !== status.accountId && account?.accountId !== "cursor:active") {
      throw activeSessionError3(
        "Cursor only exposes its active official session; authorize the selected account again",
        { mismatch: true }
      );
    }
    return status;
  }
  async discover() {
    try {
      const status = await this.#readStatus();
      const source = status.source ?? "official_cursor_cli";
      if (!status.loggedIn) return { candidates: [], source, diagnostics: ["Cursor \u5B98\u65B9\u73AF\u5883\u5F53\u524D\u672A\u767B\u5F55"] };
      const desktop = source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
      const candidate2 = desktop ? candidateFromDesktopSession(desktop) : candidateFromStatus2(status, { source, sourceKind: status.sourceKind });
      return { candidates: candidate2 ? [candidate2] : [], source, diagnostics: [] };
    } catch (error) {
      return { candidates: [], source: "official_cursor_cli", diagnostics: [`\u65E0\u6CD5\u8BFB\u53D6 Cursor \u5B98\u65B9\u767B\u5F55\u6001\uFF1A${error.message}`] };
    }
  }
  async importAccount(candidate2, context = {}) {
    const session = candidate2?.[CREDENTIAL_SLOT5];
    if (!session) throw new Error("Cursor candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(candidate2.credentialRef, session);
    return {
      providerId: PROVIDER_ID9,
      accountId: candidate2.accountId,
      credentialRef: candidate2.credentialRef,
      displayName: candidate2.displayName,
      email: candidate2.email,
      auth: {
        kind: OFFICIAL_SESSION_AUTH_KIND,
        scopes: []
      },
      subscription: { ...candidate2.subscription },
      refresh: { ...candidate2.refresh },
      resources: {
        ...officialSessionResources({
          sourceKind: candidate2.resources?.sessionSource ?? (candidate2.source === "cursor_desktop_app" ? OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP : OFFICIAL_SESSION_SOURCE_KINDS.CLI),
          authSource: candidate2.source
        }),
        transport: "cursor_agentservice_connect_proto",
        quotaSource: candidate2.resources?.quotaSource ?? "official_cursor_cli_status",
        ...candidate2.resources ?? {}
      }
    };
  }
  async getActiveSession(context = {}) {
    try {
      const status = await this.#readStatus(context.signal);
      if (!status.loggedIn) return null;
      const desktop = status.source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
      const candidate2 = desktop ? candidateFromDesktopSession(desktop) : candidateFromStatus2(status, {
        source: status.source,
        sourceKind: status.sourceKind
      });
      const account = await this.importAccount(candidate2, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID9,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Cursor \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts: [account],
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async refreshAccount(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    return {
      identity: { email: status.email, displayName: status.displayName },
      subscription: { plan: status.plan, status: "active", expiresAt: null },
      refresh: {
        accessTokenExpiresAt: this.#isBrowserAccount(account) ? cursorTokenExpiresAt(status.credential, decodeJwtPayload(status.credential?.access ?? "") ?? {}) : account.refresh?.accessTokenExpiresAt ?? null,
        lastRefreshedAt: (context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()).toISOString(),
        refreshable: this.#isBrowserAccount(account) ? Boolean(status.credential?.refresh) : false
      }
    };
  }
  async getQuota(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const quotaSource = this.#isBrowserAccount(account) ? "official_cursor_browser_oauth" : "cursor_cli_status";
    const windows = recursiveQuotaWindows(status.raw, { source: quotaSource, now, prefix: "cursor" });
    if (windows.length === 0) {
      return {
        quota: null,
        subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
        resources: {
          quotaSource,
          quotaAvailable: false,
          quotaDiagnostic: this.#isBrowserAccount(account) ? "Cursor \u5B98\u65B9\u6D4F\u89C8\u5668\u4F1A\u8BDD\u672A\u8FD4\u56DE\u4EFB\u4F55\u5B9E\u65F6\u989D\u5EA6\u7A97\u53E3\uFF1B\u989D\u5EA6\u6570\u636E\u6682\u4E0D\u53EF\u7528\uFF08degraded\uFF09\uFF0C\u8BF7\u4EE5 Cursor \u5B98\u65B9 Dashboard \u4E3A\u51C6" : "Cursor \u5B98\u65B9 CLI status \u672A\u8FD4\u56DE\u4EFB\u4F55\u5B9E\u65F6\u989D\u5EA6\u7A97\u53E3\uFF1B\u989D\u5EA6\u6570\u636E\u6682\u4E0D\u53EF\u7528\uFF08degraded\uFF09\uFF0C\u8BF7\u4EE5 Cursor \u5B98\u65B9 Dashboard \u4E3A\u51C6"
        }
      };
    }
    const primary = selectPrimaryQuotaWindow(windows);
    return {
      quota: {
        remaining: primary.remaining ?? null,
        limit: primary.limit ?? null,
        unit: primary.unit ?? null,
        resetAt: primary.resetAt ?? null,
        windows,
        updatedAt: now.toISOString(),
        source: quotaSource
      },
      subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
      resources: {
        quotaAvailable: true,
        quotaDiagnostic: null
      }
    };
  }
  async getCatalog(context = {}) {
    return this.catalogLoader({
      force: Boolean(context.force),
      accounts: context.accounts,
      secretStore: context.secretStore,
      signal: context.signal
    });
  }
  async invoke(request, invocation, context = {}) {
    await this.#assertActiveSession(invocation?.account, context.signal, context);
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Cursor native invocation transport is not mounted");
    return executor({ request, invocation, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createCursorDriver(options = {}) {
  return new CursorSubscriptionDriver(options);
}
var cursorDriverConstants = Object.freeze({ providerId: PROVIDER_ID9 });

// modules/provider-cursor/src/index.mjs
function createCursorModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "cursor",
    displayName: "Cursor",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-opencode/src/native-transport.mjs
import { execFileSync as execFileSync3, spawn as spawn6 } from "node:child_process";
import { randomBytes as randomBytes4 } from "node:crypto";
import { existsSync as existsSync2, readdirSync } from "node:fs";
import { homedir as homedir10 } from "node:os";
import { join as join10 } from "node:path";
import readline from "node:readline";
var PROVIDER_ID10 = "opencode";
var DEFAULT_ENDPOINT5 = "https://opencode.ai/inference/openai/v1/chat/completions";
function findOpencodeCliPath() {
  const appSupportCliDir = join10(homedir10(), "Library/Application Support/ai.opencode.desktop/cli");
  if (existsSync2(appSupportCliDir)) {
    try {
      const entries = readdirSync(appSupportCliDir);
      for (const entry of entries) {
        const candidate2 = join10(appSupportCliDir, entry, "opencode-cli");
        if (existsSync2(candidate2)) return candidate2;
      }
    } catch {
    }
  }
  return null;
}
function queryInstalledOpencodeCliModelIds(cliPath) {
  if (!cliPath || !existsSync2(cliPath)) return null;
  try {
    const stdout = execFileSync3(cliPath, ["models"], { encoding: "utf8", timeout: 5e3 });
    const ids = stdout.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.startsWith("opencode/") ? line.slice("opencode/".length) : line);
    if (ids.length > 0) return ids;
  } catch {
  }
  return null;
}
var DEFAULT_OPENCODE_MAX_MESSAGES = 40;
var OPENCODE_SLIDING_WINDOW_QUANTUM = 10;
function resolveOpencodeMaxMessages(request = {}) {
  const envLimit = Number.parseInt(process.env.DOCKYARD_OPENCODE_MAX_MESSAGES ?? "", 10);
  if (Number.isSafeInteger(envLimit) && envLimit > 0) return envLimit;
  if (Number.isSafeInteger(request?.maxMessages) && request.maxMessages > 0) return request.maxMessages;
  const contextWindow = request?.modelContext?.contextWindow ?? request?.contextWindow;
  if (Number.isSafeInteger(contextWindow) && contextWindow >= 5e5) {
    return 500;
  }
  return DEFAULT_OPENCODE_MAX_MESSAGES;
}
function compactMessagesForOpencode(messages, { maxMessages = DEFAULT_OPENCODE_MAX_MESSAGES, quantum = OPENCODE_SLIDING_WINDOW_QUANTUM } = {}) {
  if (!Array.isArray(messages) || messages.length <= maxMessages) return messages;
  const initialIndex = messages.findIndex((m) => m?.role === "user" || m?.role === "system");
  const prefix = initialIndex >= 0 ? [messages[initialIndex]] : [];
  const rawWindowCount = Math.max(10, maxMessages - prefix.length - 1);
  const excess = messages.length - maxMessages;
  const quantOffset = excess > 0 ? Math.floor(excess / quantum) * quantum : 0;
  const windowCount = Math.max(10, rawWindowCount + (excess - quantOffset));
  const recent = messages.slice(-windowCount);
  const startIndex = messages.length - windowCount;
  if (startIndex > 0) {
    const firstRecent = recent[0];
    const isToolResult = firstRecent?.role === "tool" || Array.isArray(firstRecent?.content) && firstRecent.content.some((part) => part?.type === "tool-result" || part?.type === "tool_result");
    if (isToolResult && messages[startIndex - 1]) {
      recent.unshift(messages[startIndex - 1]);
    }
  }
  const compactedCount = messages.length - prefix.length - recent.length;
  if (compactedCount <= 0) return messages;
  const milestone = {
    role: "user",
    content: "[System Note: Context sliding window active. Intermediate messages were compacted to maintain low latency and prevent token exhaustion. Initial requirements and recent active turns are preserved.]"
  };
  return [...prefix, milestone, ...recent];
}
function contentPartText(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (part.type === "reasoning" || part.type === "thinking") return "";
  if (part.type === "tool-call" || part.type === "function-call" || part.type === "tooluse") {
    const name2 = part.name ?? part.function?.name ?? "tool";
    return `[Tool Call: ${name2}]`;
  }
  if (part.type === "tool-result" || part.type === "tool_result") {
    const text3 = textFromContent(part.content ?? part.output ?? part.result ?? part.text);
    const trimmed = text3.length > 8192 ? `${text3.slice(0, 8192)}... [truncated]` : text3;
    return `[Tool Result ${part.toolCallId ?? part.id ?? ""}]:
${trimmed}`;
  }
  return textFromContent(part);
}
function promptFromRequest(request) {
  if (typeof request.prompt === "string" && request.prompt.trim()) {
    return request.prompt;
  }
  const isCompaction = request.purpose === "compaction";
  const defaultInstruction = isCompaction ? "You are an AI assistant summarizing the conversation. Reply directly with a concise text summary. Do not invoke tools or commands." : "You are an AI assistant. Reply directly to the user in text. Do not invoke tools or commands under any circumstances.";
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  const messages = isCompaction ? rawMessages : compactMessagesForOpencode(rawMessages, { maxMessages: resolveOpencodeMaxMessages(request) });
  const parts = [];
  const systemText = typeof request.system === "string" && request.system.trim() ? `${defaultInstruction}

${request.system.trim()}` : defaultInstruction;
  parts.push(`[System instructions: ${systemText}]`);
  for (const msg of messages) {
    const role = msg?.role === "assistant" ? "Assistant" : msg?.role === "system" ? "System" : "User";
    const text3 = typeof msg?.content === "string" ? msg.content : Array.isArray(msg?.content) ? msg.content.map(contentPartText).filter(Boolean).join("\n") : contentPartText(msg?.content);
    if (text3) {
      parts.push(`${role}: ${text3}`);
    }
  }
  if (parts.length > 0) return parts.join("\n\n");
  return typeof request.prompt === "string" ? request.prompt : "";
}
function firstString9(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function toolCallPart3(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "functioncall" || type === "tooluse" ? part : null;
}
async function openAiContent2(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID10, "image attachment could not be resolved");
      blocks.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({
        type: "text",
        text: `[Tool Result ${part.toolCallId ?? part.id ?? ""}]
${textFromContent(part.content ?? part.output ?? part.result ?? part.text)}`
      });
      continue;
    }
    const call = toolCallPart3(part);
    if (call) {
      blocks.push({
        type: "text",
        text: `[Tool Call ${call.name ?? call.function?.name ?? "tool"}] ${JSON.stringify(parseToolArguments(call.arguments ?? call.input ?? call.function?.arguments))}`
      });
      continue;
    }
    const text3 = textFromContent(part);
    if (text3) blocks.push({ type: "text", text: text3 });
  }
  return blocks;
}
async function buildOpencodeMessages(request, attachments) {
  const result = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    result.push({ role: "system", content: request.system });
  }
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  const messages = request.purpose === "compaction" ? rawMessages : compactMessagesForOpencode(rawMessages, { maxMessages: resolveOpencodeMaxMessages(request) });
  for (const message of messages) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "tool" : "user";
    if (role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: firstString9(message.toolCallId, message.tool_call_id, message.id, "tool-result"),
        content: textFromContent(message.content ?? message.text ?? message.output ?? message.result)
      });
      continue;
    }
    const content = await openAiContent2(message?.content ?? message?.text, attachments);
    result.push({
      role,
      content: content.length === 1 && content[0]?.type === "text" ? content[0].text : content
    });
  }
  return result;
}
var OPENCODE_SERVER_START_TIMEOUT_MS = 15e3;
var OPENCODE_SERVER_READY_PATTERN = /server listening on (http:\/\/127\.0\.0\.1:\d+)/i;
var serverChild = null;
var serverUrl = null;
var serverPassword = null;
var serverStarting = null;
function opencodeServerAuth(password) {
  return `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;
}
function abortSignalError(signal) {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}
function opencodeDebug(...args) {
  if (process.env.OPENCODE_TRANSPORT_DEBUG) {
    console.error("[opencode-transport]", ...args);
  }
}
async function startOpencodeServer(cliPath) {
  opencodeDebug("starting local server", cliPath);
  const password = randomBytes4(24).toString("base64url");
  const child = spawn6(cliPath, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, OPENCODE_PASSWORD: password }
  });
  let diagnostics = "";
  child.stderr?.on("data", (chunk) => {
    diagnostics = `${diagnostics}${String(chunk)}`.slice(-4e3);
  });
  let url;
  try {
    url = await new Promise((resolve2, reject) => {
      let buffer = "";
      let timer = null;
      let settled = false;
      const settle = (error, value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        child.stdout?.off?.("data", onStdout);
        child.off?.("exit", onExit);
        child.off?.("error", onError);
        if (error) reject(error);
        else resolve2(value);
      };
      const onStdout = (chunk) => {
        buffer += String(chunk);
        const match = buffer.match(OPENCODE_SERVER_READY_PATTERN);
        if (match) settle(null, match[1]);
      };
      const onExit = (code, exitSignal) => {
        settle(
          new Error(
            `OpenCode \u672C\u5730\u670D\u52A1\u63D0\u524D\u9000\u51FA (code ${code ?? "null"}, signal ${exitSignal ?? "null"})${diagnostics ? `: ${diagnostics.trim()}` : ""}`
          )
        );
      };
      const onError = (error) => settle(error);
      timer = setTimeout(() => {
        settle(new Error(`OpenCode \u672C\u5730\u670D\u52A1\u542F\u52A8\u8D85\u65F6${diagnostics ? `: ${diagnostics.trim()}` : ""}`));
      }, OPENCODE_SERVER_START_TIMEOUT_MS);
      child.stdout?.on("data", onStdout);
      child.once("exit", onExit);
      child.once("error", onError);
    });
  } catch (error) {
    try {
      child.kill();
    } catch {
    }
    throw error;
  }
  child.stdout?.on("data", () => {
  });
  child.stderr?.on("data", () => {
  });
  child.unref?.();
  child.stdout?.unref?.();
  child.stderr?.unref?.();
  const info = { child, url, password };
  opencodeDebug("local server ready", url);
  child.once("exit", () => {
    if (serverChild === child) {
      serverChild = null;
      serverUrl = null;
      serverPassword = null;
    }
  });
  process.once("exit", () => {
    try {
      child.kill();
    } catch {
    }
  });
  return info;
}
async function ensureOpencodeServer(cliPath) {
  if (serverUrl && serverChild && serverChild.exitCode === null) {
    return { child: serverChild, url: serverUrl, password: serverPassword };
  }
  if (serverStarting) return serverStarting;
  serverStarting = startOpencodeServer(cliPath).then((info) => {
    serverChild = info.child;
    serverUrl = info.url;
    serverPassword = info.password;
    serverStarting = null;
    return info;
  }).catch((error) => {
    serverStarting = null;
    throw error;
  });
  return serverStarting;
}
async function opencodeServerRequest(server, method, path, body, { signal, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${server.url}${path}`, {
      method,
      headers: {
        Authorization: opencodeServerAuth(server.password),
        ...body !== void 0 ? { "Content-Type": "application/json" } : {}
      },
      ...body !== void 0 ? { body: JSON.stringify(body) } : {},
      ...signal ? { signal } : {}
    });
  } catch (error) {
    if (signal?.aborted) throw abortSignalError(signal);
    throw error;
  }
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw nativeProviderError(
      PROVIDER_ID10,
      `OpenCode \u672C\u5730\u670D\u52A1\u8BF7\u6C42\u5931\u8D25 (${method} ${path}): ${response.status}${details ? ` ${details.slice(0, 500)}` : ""}`
    );
  }
  if (response.status === 204) return null;
  const text3 = await response.text();
  if (!text3) return null;
  try {
    return JSON.parse(text3);
  } catch {
    return null;
  }
}
async function openOpencodeEventStream(server, sessionId, { signal, fetchImpl = fetch, idleTimeoutMs = 6e4 } = {}) {
  let response;
  try {
    response = await fetchImpl(`${server.url}/api/event`, {
      headers: {
        Authorization: opencodeServerAuth(server.password),
        Accept: "text/event-stream"
      },
      ...signal ? { signal } : {}
    });
  } catch (error) {
    if (signal?.aborted) throw abortSignalError(signal);
    throw error;
  }
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw nativeProviderError(
      PROVIDER_ID10,
      `OpenCode \u4E8B\u4EF6\u6D41\u8FDE\u63A5\u5931\u8D25: ${response.status}${details ? ` ${details.slice(0, 300)}` : ""}`
    );
  }
  if (!response.body?.getReader) {
    throw nativeProviderError(PROVIDER_ID10, "OpenCode \u4E8B\u4EF6\u6D41\u4E0D\u53EF\u8BFB\u53D6");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let closed = false;
  async function readChunkWithTimeout() {
    if (!idleTimeoutMs || idleTimeoutMs <= 0) return reader.read();
    let timer = null;
    try {
      return await Promise.race([
        reader.read(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const err = nativeProviderError(PROVIDER_ID10, "OpenCode \u4E8B\u4EF6\u6D41\u54CD\u5E94\u8D85\u65F6", { code: "TIMEOUT" });
            reject(err);
          }, idleTimeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    async next() {
      while (!closed) {
        let boundary = buffer.indexOf("\n\n");
        while (boundary === -1) {
          const { value, done } = await readChunkWithTimeout();
          if (done) {
            closed = true;
            return { done: true };
          }
          buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replace(/\r\n/g, "\n");
          boundary = buffer.indexOf("\n\n");
        }
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("data:")) data += `${data ? "\n" : ""}${line.slice(5).trim()}`;
        }
        if (!data) continue;
        let event;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }
        if (event?.data?.sessionID !== sessionId) continue;
        return { done: false, value: event };
      }
      return { done: true };
    },
    async close() {
      closed = true;
      try {
        await reader.cancel();
      } catch {
      }
    }
  };
}
function opencodeServerModel(request) {
  const raw = typeof request?.model === "string" ? request.model.trim() : "";
  if (!raw) return null;
  const [baseRaw, embeddedVariant] = raw.split("#");
  const base = baseRaw.startsWith("opencode/") ? baseRaw.slice("opencode/".length) : baseRaw;
  if (!base) return null;
  if (request?.purpose === "compaction" || request?.thinking === false) {
    return { providerID: PROVIDER_ID10, id: base };
  }
  const effort = request.reasoningEffort ?? request.reasoning_effort ?? embeddedVariant;
  const variant = typeof effort === "string" && effort && effort !== "medium" ? effort : null;
  return { providerID: PROVIDER_ID10, id: base, ...variant ? { variant } : {} };
}
function opencodeUsageFromTokens(tokens) {
  const input = Number(tokens?.input ?? 0);
  const output = Number(tokens?.output ?? 0);
  return {
    prompt_tokens: Number.isFinite(input) ? input : 0,
    completion_tokens: Number.isFinite(output) ? output : 0,
    total_tokens: (Number.isFinite(input) ? input : 0) + (Number.isFinite(output) ? output : 0)
  };
}
function opencodeEventMessage(data) {
  const value = data?.error ?? data?.message ?? data?.reason;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const nested = value.message ?? value.error ?? value.reason;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}
function isPermissionRequestEvent(type, data, sessionId) {
  if (typeof type !== "string" || !type.includes("permission")) return false;
  if (data?.sessionID !== sessionId) return false;
  return type.includes("request") || type.endsWith(".updated") || type.endsWith(".asked");
}
async function* runViaOpencodeServer({ server, request, signal, fetchImpl, timeoutMs = 6e4 }) {
  const prompt = promptFromRequest(request);
  const model = opencodeServerModel(request);
  const controller = new AbortController();
  let sessionId = null;
  let stream = null;
  let aborted = false;
  const pendingReplies = /* @__PURE__ */ new Set();
  const isCompaction = request.purpose === "compaction";
  const onAbort = () => {
    aborted = true;
    controller.abort();
    if (sessionId) {
      void opencodeServerRequest(server, "POST", `/api/session/${sessionId}/interrupt`, void 0, { fetchImpl }).catch(() => {
      });
    }
  };
  if (signal) {
    if (signal.aborted) throw abortSignalError(signal);
    signal.addEventListener("abort", onAbort, { once: true });
  }
  let text3 = "";
  let textIndex = 0;
  let textOpen = false;
  let nextIndex = 1;
  let reasoning = null;
  let rawUsage = null;
  let stop = "stop";
  let stepCount = 0;
  try {
    const created = await opencodeServerRequest(
      server,
      "POST",
      "/api/session",
      {
        ...model ? { model } : {},
        location: { directory: process.cwd() }
      },
      { signal: controller.signal, fetchImpl }
    );
    sessionId = created?.data?.id ?? created?.id ?? null;
    if (!sessionId) {
      throw nativeProviderError(PROVIDER_ID10, "OpenCode \u4F1A\u8BDD\u521B\u5EFA\u5931\u8D25\uFF1A\u54CD\u5E94\u4E2D\u6CA1\u6709\u4F1A\u8BDD ID");
    }
    opencodeDebug("session created", sessionId);
    stream = await openOpencodeEventStream(server, sessionId, {
      signal: controller.signal,
      fetchImpl,
      idleTimeoutMs: timeoutMs
    });
    opencodeDebug("event stream connected");
    await opencodeServerRequest(
      server,
      "POST",
      `/api/session/${sessionId}/prompt`,
      { text: prompt },
      { signal: controller.signal, fetchImpl }
    );
    opencodeDebug("prompt submitted");
    let finished = false;
    while (!finished) {
      let next;
      try {
        next = await stream.next();
      } catch (error) {
        if (controller.signal.aborted || signal?.aborted) break;
        throw error;
      }
      if (next.done) {
        if (!finished && !text3 && !reasoning) {
          throw nativeProviderError(PROVIDER_ID10, "OpenCode \u4E8B\u4EF6\u6D41\u5F02\u5E38\u7ED3\u675F\uFF0C\u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9", { code: "EMPTY_RESPONSE" });
        }
        break;
      }
      const event = next.value;
      const type = event.type;
      const data = event.data ?? {};
      if (type && !type.endsWith(".delta")) opencodeDebug("event", type);
      if (type === "session.reasoning.delta" && typeof data.delta === "string" && data.delta) {
        if (!isCompaction) {
          if (textOpen) {
            yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
            textOpen = false;
          }
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          reasoning.text += data.delta;
          yield { type: "reasoning-delta", index: reasoning.index, text: data.delta };
        }
      } else if (type === "session.text.delta" && typeof data.delta === "string" && data.delta) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text3 += data.delta;
        yield { type: "text-delta", index: textIndex, text: data.delta };
      } else if (type === "session.usage.updated" && data.tokens) {
        rawUsage = opencodeUsageFromTokens(data.tokens);
      } else if (type === "session.step.ended") {
        stepCount++;
        if (typeof data.finish === "string" && data.finish) stop = data.finish;
        if (data.tokens) rawUsage = opencodeUsageFromTokens(data.tokens);
        if (isCompaction) {
          if (text3 || data.finish === "stop") {
            finished = true;
          }
        } else if (data.finish === "stop" && text3) {
          finished = true;
        } else if (stepCount >= 5 && text3) {
          finished = true;
        }
      } else if (type === "session.step.failed") {
        const msg = opencodeEventMessage(data) || "OpenCode \u6B65\u9AA4\u6267\u884C\u5931\u8D25";
        const status = data.error?.status ?? data.status;
        const code = data.error?.type ?? data.type;
        throw nativeProviderError(PROVIDER_ID10, msg, { status, code });
      } else if (type === "session.execution.succeeded") {
        finished = true;
      } else if (type === "session.execution.failed" || type === "session.execution.error" || type === "session.error") {
        const msg = opencodeEventMessage(data) || "OpenCode \u6267\u884C\u5931\u8D25";
        const status = data.error?.status ?? data.status;
        const code = data.error?.type ?? data.type;
        throw nativeProviderError(PROVIDER_ID10, msg, { status, code });
      } else if (type === "session.execution.interrupted") {
        aborted = true;
        finished = true;
      } else if (isPermissionRequestEvent(type, data, sessionId)) {
        const requestId = data.id ?? data.requestID;
        if (requestId) {
          pendingReplies.add(
            opencodeServerRequest(
              server,
              "POST",
              `/api/session/${sessionId}/permission/${requestId}/reply`,
              { decision: "deny" },
              { fetchImpl }
            ).catch(() => {
            })
          );
        }
      }
    }
  } finally {
    if (stream) await stream.close();
    if (sessionId) {
      await opencodeServerRequest(server, "DELETE", `/api/session/${sessionId}`, void 0, { fetchImpl }).catch(() => {
      });
    }
    signal?.removeEventListener?.("abort", onAbort);
    if (pendingReplies.size > 0) await Promise.allSettled([...pendingReplies]);
  }
  if (reasoning) {
    yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  }
  if (textOpen) {
    yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
  }
  if (rawUsage) {
    yield { type: "usage", usage: normalizeUsage(rawUsage) };
  }
  yield {
    type: "finish",
    reason: aborted ? { kind: "stop" } : finishReason(stop),
    ...rawUsage ? { usage: normalizeUsage(rawUsage) } : {}
  };
}
function createOpencodeNativeExecutor({
  endpoint: endpoint2 = DEFAULT_ENDPOINT5,
  apiKey = null,
  fetchImpl = fetch,
  timeoutMs = 6e4,
  cliPath = void 0
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID10 });
  return async function* opencodeNativeExecutor(envelope2 = {}) {
    const { request, attachments, credential, signal } = envelope2;
    const token = apiKey ?? (credential?.access && credential.access !== "free-tier" ? credential.access : null) ?? credential?.apiKey ?? credential?.token ?? process.env.OPENCODE_API_KEY ?? null;
    const resolvedCliPath = !token ? cliPath !== void 0 ? cliPath : findOpencodeCliPath() : null;
    if (resolvedCliPath) {
      let server = null;
      try {
        server = await ensureOpencodeServer(resolvedCliPath);
      } catch {
        server = null;
      }
      if (server) {
        let emitted = false;
        try {
          for await (const event of runViaOpencodeServer({ server, request, signal, fetchImpl, timeoutMs })) {
            emitted = true;
            yield event;
          }
          return;
        } catch (error) {
          if (emitted || signal?.aborted) throw error;
        }
      }
    }
    if (resolvedCliPath) {
      const baseModel = request.model?.startsWith("opencode/") ? request.model : `opencode/${request.model}`;
      const isCompaction = request.purpose === "compaction";
      const thinkingDisabled = isCompaction || request.thinking === false;
      const effort = thinkingDisabled ? null : request.reasoningEffort ?? request.reasoning_effort;
      const model = effort && effort !== "medium" ? `${baseModel}#${effort}` : baseModel;
      const prompt = promptFromRequest(request);
      const args = ["run", "--model", model];
      if (!thinkingDisabled) {
        args.push("--thinking");
      }
      args.push("--format", "json", prompt);
      const child = spawn6(resolvedCliPath, args, {
        signal,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env }
      });
      let timeoutTimer = null;
      let timedOut = false;
      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          try {
            child.kill("SIGTERM");
          } catch {
          }
        }, timeoutMs);
      }
      const rl = readline.createInterface({ input: child.stdout });
      let text4 = "";
      let textIndex2 = 0;
      let textOpen2 = false;
      let nextIndex2 = 1;
      let reasoning2 = null;
      let rawUsage2 = null;
      let stderrOutput = "";
      child.stderr?.on?.("data", (chunk) => {
        stderrOutput += String(chunk);
      });
      try {
        for await (const line of rl) {
          if (!line.trim()) continue;
          let parsed;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }
          if (parsed.type === "reasoning" && parsed.part?.text) {
            if (!isCompaction) {
              if (textOpen2) {
                yield { type: "block-end", index: textIndex2, block: { type: "text", text: text4 } };
                textOpen2 = false;
              }
              if (!reasoning2) {
                reasoning2 = { index: nextIndex2++, text: "" };
                yield { type: "block-start", index: reasoning2.index, blockType: "reasoning" };
              }
              const chunk = parsed.part.text;
              reasoning2.text += chunk;
              yield { type: "reasoning-delta", index: reasoning2.index, text: chunk };
            }
          } else if (parsed.type === "text" && parsed.part?.text) {
            if (reasoning2) {
              yield { type: "block-end", index: reasoning2.index, block: { type: "reasoning", text: reasoning2.text } };
              reasoning2 = null;
            }
            if (!textOpen2) {
              textIndex2 = nextIndex2++;
              text4 = "";
              textOpen2 = true;
              yield { type: "block-start", index: textIndex2, blockType: "text" };
            }
            const chunk = parsed.part.text;
            text4 += chunk;
            yield { type: "text-delta", index: textIndex2, text: chunk };
          } else if (parsed.type === "step_finish" && parsed.part?.tokens) {
            rawUsage2 = {
              prompt_tokens: parsed.part.tokens.input ?? 0,
              completion_tokens: parsed.part.tokens.output ?? 0,
              total_tokens: (parsed.part.tokens.input ?? 0) + (parsed.part.tokens.output ?? 0)
            };
            if (isCompaction) {
              break;
            }
          } else if (parsed.type === "error") {
            const msg = parsed.error?.message || "OpenCode CLI execution error";
            const status = parsed.error?.status;
            const code = parsed.error?.type;
            throw nativeProviderError(PROVIDER_ID10, msg, { status, code });
          }
        }
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        try {
          child.kill();
        } catch {
        }
      }
      if (timedOut) {
        throw nativeProviderError(PROVIDER_ID10, `OpenCode CLI \u6267\u884C\u8D85\u65F6 (${timeoutMs}ms)`, { code: "TIMEOUT" });
      }
      if (!text4 && !reasoning2) {
        if (stderrOutput.trim()) {
          throw nativeProviderError(PROVIDER_ID10, stderrOutput.trim());
        }
        throw nativeProviderError(PROVIDER_ID10, "OpenCode CLI \u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9", { code: "EMPTY_RESPONSE" });
      }
      if (reasoning2) {
        yield { type: "block-end", index: reasoning2.index, block: { type: "reasoning", text: reasoning2.text } };
      }
      if (textOpen2) {
        yield { type: "block-end", index: textIndex2, block: { type: "text", text: text4 } };
      }
      if (rawUsage2) {
        yield {
          type: "usage",
          usage: normalizeUsage(rawUsage2)
        };
      }
      yield {
        type: "finish",
        reason: { kind: "stop" },
        ...rawUsage2 ? { usage: normalizeUsage(rawUsage2) } : {}
      };
      return;
    }
    const isFreeTier = !token || token === "free-tier";
    let activeEndpoint = validatedEndpoint;
    let authHeader = token && token !== "free-tier" ? `Bearer ${token}` : "Bearer public";
    let extraHeaders = {};
    let tools = void 0;
    if (isFreeTier) {
      activeEndpoint = "https://opencode.ai/inference/v1/chat/completions";
      const ts = Date.now();
      const value = ~(BigInt(ts) * 0x1000n + 1n);
      let hex = "";
      for (let i = 0; i < 6; i++) hex += Number(value >> BigInt(40 - 8 * i) & 0xffn).toString(16).padStart(2, "0");
      const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      let rand = "";
      for (const b of randomBytes4(14)) rand += BASE62[b % 62];
      const session = `ses_${hex}${rand}`;
      extraHeaders = {
        "user-agent": "opencode/latest/2.0.26/cli",
        "x-opencode-client": "cli",
        "x-opencode-session": session,
        "x-opencode-session-id": session,
        "x-session-affinity": session,
        "x-session-id": session,
        "x-opencode-project": "global"
      };
      tools = [
        {
          type: "function",
          function: {
            name: "read",
            description: "Read the contents of a file or directory. Supports text files, images, and PDFs. Images and PDFs are presented directly to the model. Each text line is prefixed by its 1-based line number as <line>: <content>. The prefix is for reference and is not part of the file content. Directory entries are returned one per line. Use offset and limit to read large files or directories in sections. Prefer one larger read over many small slices, and use grep to find specific content in large files.",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string", description: "File or directory to read" },
                offset: { type: "integer", minimum: 0, description: "The line or directory entry to start reading from (1-based)" },
                limit: { type: "integer", minimum: 0, description: "The maximum number of lines or directory entries to read (defaults to and capped at 2000)" }
              },
              required: ["path"],
              additionalProperties: false
            }
          }
        },
        {
          type: "function",
          function: {
            name: "shell",
            description: "Execute a shell command and return its output. Commands run on Linux using bash. Quote file paths containing spaces or special characters. Prefer dedicated tools over shell commands when possible. When output is large, the full result is saved to a file and a truncated preview is returned. Rely on automatic truncation unless filtering the output is more useful. Commands accept an optional timeout, background commands have no timeout by default. Background commands return immediately, and you will be notified when they complete.",
            parameters: {
              type: "object",
              properties: {
                command: { type: "string", description: "Shell command string to execute" },
                workdir: { type: "string", description: "Working directory to execute the command in. Defaults to the current working directory. When possible, avoid changing directories in the command and set the working directory here instead." },
                timeout: { type: "integer", minimum: 0, description: "Timeout in milliseconds. Set to 0 to disable the timeout. Defaults to 120000 for foreground commands. Background commands have no timeout by default." },
                background: { type: "boolean", description: "Run the command in the background and return immediately (useful for dev servers and long-running builds). You do not need to use '&' at the end of the command when using this parameter. You will be notified when it completes. DO NOT poll for completion." }
              },
              required: ["command"],
              additionalProperties: false
            }
          }
        }
      ];
    }
    const messages = await buildOpencodeMessages(request, attachments);
    const body = {
      model: request.model,
      messages,
      stream: true,
      ...typeof request.temperature === "number" ? { temperature: request.temperature } : {},
      ...typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {},
      ...request.reasoningEffort && request.purpose !== "compaction" && request.thinking !== false ? { reasoning_effort: request.reasoningEffort } : {},
      ...tools ? { tools } : {}
    };
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: authHeader,
      ...extraHeaders
    };
    const response = await fetchNativeResponse(
      activeEndpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal
      },
      {
        providerId: PROVIDER_ID10,
        timeoutMs,
        fetchImpl
      }
    );
    let text3 = "";
    let textIndex = 0;
    let textOpen = false;
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";
    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: PROVIDER_ID10 })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;
      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;
      const delta = choice.delta ?? {};
      const reasoningDelta = firstString9(delta.reasoning_content, delta.reasoning, delta.thought);
      if (reasoningDelta) {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        reasoning.text += reasoningDelta;
        yield { type: "reasoning-delta", index: reasoning.index, text: reasoningDelta };
      }
      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text3 += content;
        yield { type: "text-delta", index: textIndex, text: content };
      }
      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }
    if (reasoning) {
      yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
    }
    if (textOpen) {
      yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
    }
    if (rawUsage) {
      yield {
        type: "usage",
        usage: normalizeUsage(rawUsage)
      };
    }
    yield {
      type: "finish",
      reason: finishReason(stop),
      ...rawUsage ? { usage: normalizeUsage(rawUsage) } : {}
    };
  };
}

// modules/provider-opencode/src/driver.mjs
var PROVIDER_ID11 = "opencode";
var DEFAULT_CATALOG_URL = "https://opencode.ai/zen/v1/models";
var DEFAULT_ENDPOINT6 = "https://opencode.ai/inference/openai/v1/chat/completions";
var BUILTIN_OPENCODE_FREE_MODELS = Object.freeze([
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
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "beam-free",
    name: "Beam (Free)",
    contextWindow: 131072,
    maxTokens: 8192
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
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text", "image"]
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning (Free)",
    contextWindow: 131072,
    maxTokens: 8192
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
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "jev-1.13-free",
    name: "JEV 1.13 (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "longcat-2.5-preview-free",
    name: "Longcat 2.5 Preview (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "flint-40b-free",
    name: "Flint 40B (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek v4.1 Flash (Free)",
    contextWindow: 2e5,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "glm-5.3-flash-free",
    name: "GLM 5.3 Flash (Free)",
    contextWindow: 204800,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    }
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
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
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
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (OpenCode)",
    contextWindow: 1e6,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (OpenCode)",
    contextWindow: 1048576,
    maxTokens: 16384
  }
]);
function summarizeOpencodeCandidate(candidate2) {
  return candidate2?.displayName ?? candidate2?.email ?? candidate2?.accountId ?? "OpenCode Free";
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
    return registry.find((m) => m.id === "glm-5.2" || m.id.startsWith("glm-5") && m.thinkingLevelMap);
  }
  if (id.startsWith("gemini-")) {
    return registry.find((m) => m.provider === "opencode" && m.id.startsWith("gemini-") && m.thinkingLevelMap);
  }
  if (id.startsWith("grok-")) {
    return registry.find((m) => m.id === "grok-4.5" || m.id.startsWith("grok-") && m.thinkingLevelMap);
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
function parseOpencodeCatalog(data, { registry = [], installedIds = null } = {}) {
  const models = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  if (!models.length) {
    if (Array.isArray(installedIds) && installedIds.length > 0) {
      const builtinMap2 = new Map(BUILTIN_OPENCODE_FREE_MODELS.map((m) => [m.id, m]));
      const installedModels = installedIds.map((id) => {
        const builtin = builtinMap2.get(id);
        if (builtin) return builtin;
        return {
          id,
          name: `${id} (Free)`,
          contextWindow: 131072,
          maxTokens: 8192
        };
      });
      return { models: installedModels };
    }
    return { models: [...BUILTIN_OPENCODE_FREE_MODELS] };
  }
  const builtinMap = new Map(BUILTIN_OPENCODE_FREE_MODELS.map((m) => [m.id, m]));
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of models) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const regModel = findOpencodeRegistryModel(id, registry);
    const builtin = builtinMap.get(id);
    const isFree = id.includes("-free") || id === "big-pickle";
    const name2 = stringValue(item?.name) ?? regModel?.name ?? builtin?.name ?? (isFree ? `${id} (Free)` : id);
    const contextWindow = Number.isInteger(item?.contextWindow) ? item.contextWindow : Number.isInteger(regModel?.contextWindow) ? regModel.contextWindow : builtin?.contextWindow ?? 131072;
    const maxTokens = Number.isInteger(item?.maxTokens) ? Math.min(item.maxTokens, 16384) : Number.isInteger(regModel?.maxTokens) ? Math.min(regModel.maxTokens, 16384) : builtin?.maxTokens ?? 8192;
    const reasoning = item?.reasoning ? resolveReasoningFromModel(item) : regModel ? resolveReasoningFromModel(regModel) : builtin?.reasoning;
    result.push({
      id,
      name: name2,
      contextWindow,
      maxTokens,
      ...reasoning ? { reasoning } : {}
    });
  }
  return { models: result.length > 0 ? result : [...BUILTIN_OPENCODE_FREE_MODELS] };
}
function createOpencodeCatalogLoader({
  catalogUrl = DEFAULT_CATALOG_URL,
  fetchImpl = fetch,
  timeoutMs = 8e3,
  cacheTtlMs = 6e4,
  registryLoader = null
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
      const installedIds = cliPath ? queryInstalledOpencodeCliModelIds(cliPath) : null;
      if (catalogUrl === DEFAULT_CATALOG_URL && fetchImpl === fetch) {
        cached = parseOpencodeCatalog(null, { registry, installedIds });
        cachedAt = Date.now();
        return cached;
      }
      try {
        const data = await fetchJson(validatedUrl, {
          headers: { Accept: "application/json" },
          fetchImpl,
          timeoutMs
        });
        cached = parseOpencodeCatalog(data, { registry, installedIds });
      } catch {
        cached = parseOpencodeCatalog(null, { registry, installedIds });
      }
      cachedAt = Date.now();
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
var OpencodeDriver = class {
  constructor({
    endpoint: endpoint2 = DEFAULT_ENDPOINT6,
    catalogUrl = DEFAULT_CATALOG_URL,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 3e4,
    registryLoader = null
  } = {}) {
    this.endpoint = endpoint2;
    this.catalogUrl = catalogUrl;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createOpencodeCatalogLoader({
      catalogUrl,
      fetchImpl,
      timeoutMs: 8e3,
      registryLoader
    });
    this.requestExecutor = requestExecutor ?? createOpencodeNativeExecutor({
      endpoint: endpoint2,
      fetchImpl,
      timeoutMs
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
            status: "active"
          },
          quota: {
            remaining: 100,
            limit: 100,
            unit: "requests",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          source: "opencode_free_tier",
          health: {
            status: "healthy"
          }
        }
      ],
      source: "opencode_free_tier",
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const accountId = candidate2?.accountId || "opencode-free";
    const ref = createCredentialRef(PROVIDER_ID11, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "opencode_free",
        access: "free-tier"
      }).catch(() => {
      });
    }
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID11,
      displayName: candidate2?.displayName || "OpenCode Free",
      email: candidate2?.email || "zen@opencode.ai",
      auth: {
        kind: "opencode_free",
        credentialRef: ref
      },
      subscription: {
        plan: candidate2?.subscription?.plan || "Zen Free Rotation",
        status: "active"
      },
      quota: createQuotaSnapshot(candidate2?.quota || {
        remaining: 100,
        limit: 100,
        unit: "requests"
      }),
      health: {
        status: "healthy"
      }
    });
  }
  async getActiveSession() {
    return this.discover().then((res) => Array.isArray(res?.candidates) ? res.candidates[0] : Array.isArray(res) ? res[0] : null);
  }
  async refreshAccount(account) {
    return {
      quota: createQuotaSnapshot({
        remaining: 100,
        limit: 100,
        unit: "requests",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }),
      health: {
        status: "healthy",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async getQuota() {
    return createQuotaSnapshot({
      remaining: 100,
      limit: 100,
      unit: "requests",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      signal: context.signal ?? invocation?.signal
    });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createOpencodeDriver(options = {}) {
  return new OpencodeDriver(options);
}

// modules/provider-opencode/src/index.mjs
function createOpencodeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "opencode",
    displayName: "OpenCode",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-workbuddy/src/driver.mjs
import { existsSync as existsSync4, readdirSync as readdirSync2, readFileSync as readFileSync3 } from "node:fs";
import { join as join12 } from "node:path";

// modules/provider-workbuddy/src/native-transport.mjs
import { execFileSync as execFileSync4 } from "node:child_process";
import { randomBytes as randomBytes5, randomUUID as randomUUID10 } from "node:crypto";
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "node:fs";
import { homedir as homedir11 } from "node:os";
import { join as join11 } from "node:path";
function firstString10(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}
var PROVIDER_ID12 = "workbuddy";
var DEFAULT_WORKBUDDY_ENDPOINT = "https://www.workbuddy.ai/v2/chat/completions";
var cachedSession = null;
var cachedSessionExpiry = 0;
function findWorkbuddyElectronPath() {
  if (process.env.WORKBUDDY_ELECTRON_PATH && existsSync3(process.env.WORKBUDDY_ELECTRON_PATH)) {
    return process.env.WORKBUDDY_ELECTRON_PATH;
  }
  const candidates = [
    "/Applications/WorkBuddy AI.app/Contents/MacOS/Electron",
    "/Applications/WorkBuddy.app/Contents/MacOS/Electron",
    join11(homedir11(), "Applications/WorkBuddy AI.app/Contents/MacOS/Electron"),
    join11(homedir11(), "Applications/WorkBuddy.app/Contents/MacOS/Electron")
  ];
  for (const candidate2 of candidates) {
    if (existsSync3(candidate2)) return candidate2;
  }
  return null;
}
function findWorkbuddyAuthFilePath() {
  if (process.env.WORKBUDDY_AUTH_FILE_PATH && existsSync3(process.env.WORKBUDDY_AUTH_FILE_PATH)) {
    return process.env.WORKBUDDY_AUTH_FILE_PATH;
  }
  const candidate2 = join11(
    homedir11(),
    "Library/Application Support/CodeBuddyExtension/Data/Public/auth/workbuddy-desktop-ai.info"
  );
  if (existsSync3(candidate2)) return candidate2;
  return null;
}
function findWorkbuddyConfigDir() {
  if (process.env.WORKBUDDY_CONFIG_DIR && existsSync3(process.env.WORKBUDDY_CONFIG_DIR)) {
    return process.env.WORKBUDDY_CONFIG_DIR;
  }
  const candidates = [
    join11(homedir11(), ".workbuddy-ai"),
    join11(homedir11(), ".workbuddy")
  ];
  for (const candidate2 of candidates) {
    if (existsSync3(candidate2)) return candidate2;
  }
  return null;
}
function extractWorkbuddySession({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedSession && now < cachedSessionExpiry - 6e4) {
    return cachedSession;
  }
  const electronPath = findWorkbuddyElectronPath();
  const authPath = findWorkbuddyAuthFilePath();
  const configDir = findWorkbuddyConfigDir();
  if (!electronPath || !authPath || !configDir) {
    if (process.env.WORKBUDDY_ACCESS_TOKEN) {
      const fallback = {
        accessToken: process.env.WORKBUDDY_ACCESS_TOKEN,
        uid: process.env.WORKBUDDY_UID || "workbuddy-user",
        email: process.env.WORKBUDDY_EMAIL || "workbuddy@desktop.ai",
        nickname: "WorkBuddy User",
        expiresAt: now + 36e5
      };
      cachedSession = fallback;
      cachedSessionExpiry = fallback.expiresAt;
      return fallback;
    }
    return null;
  }
  const script = `
    const asarMain = "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar/main";
    const dist = require(asarMain + "/dist.js");
    const cp = require(asarMain + "/credential-protection.js");
    dist.s();
    cp.t();

    const b = process._linkedBinding("electron_browser_workbuddy_storage");
    const r = b.loggerGet();
    const i = dist.T(r);
    const configDir = ${JSON.stringify(configDir)};
    const o = dist.u({ keyblobPath: dist.l(configDir), protectorKey: i.symmetric.value });

    const bootstrap = {
      policy: "fields",
      symmetricKey: i.symmetric.value,
      userKey: o.value,
      developerPublicKey: i.developerPublicKey.value
    };
    cp._(bootstrap);

    const fs = require("fs");
    const authPath = ${JSON.stringify(authPath)};
    const content = fs.readFileSync(authPath, "utf8");
    const parsed = JSON.parse(content);
    const codec = cp.v({ purpose: "workbuddy-auth-session", resourceId: "auth/workbuddy-desktop-ai.info" });
    const fields = [
      { path: ["auth", "accessToken"] },
      { path: ["auth", "refreshToken"] },
      { path: ["account", "phoneNumber"] },
      { path: ["account", "departmentFullName"] },
      { path: ["account", "nickname"] },
      { path: ["account", "email"] }
    ];
    const decoded = codec.decode(parsed, fields);
    const result = {
      accessToken: decoded.value.auth?.accessToken || null,
      refreshToken: decoded.value.auth?.refreshToken || null,
      uid: parsed.account?.uid || null,
      nickname: decoded.value.account?.nickname || null,
      email: decoded.value.account?.email || parsed.account?.email || null,
      expiresAt: decoded.value.auth?.expiresAt || null
    };
    process.stdout.write(JSON.stringify(result));
  `;
  try {
    const stdout = execFileSync4(
      electronPath,
      ["-e", script],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1"
        },
        timeout: 1e4
      }
    );
    const parsed = JSON.parse(stdout.trim());
    if (parsed?.accessToken) {
      cachedSession = parsed;
      cachedSessionExpiry = parsed.expiresAt ? Number(parsed.expiresAt) : now + 36e5;
      return parsed;
    }
  } catch (error) {
    if (process.env.WORKBUDDY_ACCESS_TOKEN) {
      const fallback = {
        accessToken: process.env.WORKBUDDY_ACCESS_TOKEN,
        uid: process.env.WORKBUDDY_UID || "workbuddy-user",
        email: process.env.WORKBUDDY_EMAIL || "workbuddy@desktop.ai",
        nickname: "WorkBuddy User",
        expiresAt: now + 36e5
      };
      cachedSession = fallback;
      cachedSessionExpiry = fallback.expiresAt;
      return fallback;
    }
  }
  return null;
}
async function buildWorkbuddyMessages(request, attachments = []) {
  const messages = [];
  const rawMessages = Array.isArray(request?.messages) ? request.messages : [];
  const systemPrompt = request?.systemPrompt || request?.system;
  let hasSystemMessage = false;
  for (const message of rawMessages) {
    const role = message?.role ?? "user";
    if (role === "system") {
      hasSystemMessage = true;
      messages.push({
        role: "system",
        content: typeof message?.content === "string" ? message.content : textFromContent(message?.content)
      });
      continue;
    }
    if (role === "user" || role === "assistant") {
      let content = "";
      if (typeof message?.content === "string") {
        content = message.content;
      } else if (Array.isArray(message?.content)) {
        const parts = [];
        for (const part of message.content) {
          if (part?.type === "text" && typeof part?.text === "string") {
            parts.push(part.text);
          } else if (part?.type === "image" && part?.image) {
          } else if (typeof part === "string") {
            parts.push(part);
          }
        }
        content = parts.join("\n");
      }
      messages.push({ role, content });
      continue;
    }
    if (role === "tool") {
      const content = typeof message?.content === "string" ? message.content : JSON.stringify(message?.content ?? "");
      messages.push({
        role: "user",
        content: `[Tool result for ${message.toolCallId ?? "tool"}]: ${content}`
      });
    }
  }
  if (!hasSystemMessage) {
    messages.unshift({
      role: "system",
      content: systemPrompt || "You are a helpful AI assistant."
    });
  }
  return messages;
}
function createWorkbuddyNativeExecutor({
  endpoint: endpoint2 = DEFAULT_WORKBUDDY_ENDPOINT,
  accessToken = null,
  fetchImpl = fetch,
  timeoutMs = 12e4
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID12 });
  return async function* workbuddyNativeExecutor(envelope2 = {}) {
    const { request, attachments, credential, signal } = envelope2;
    let token = accessToken ?? (credential?.accessToken && credential.accessToken !== "free-tier" ? credential.accessToken : null) ?? (credential?.access && credential.access !== "free-tier" ? credential.access : null) ?? credential?.apiKey ?? credential?.token ?? process.env.WORKBUDDY_ACCESS_TOKEN ?? null;
    let uid = credential?.uid ?? null;
    if (!token) {
      const session = extractWorkbuddySession();
      if (session?.accessToken) {
        token = session.accessToken;
        uid = session.uid;
      }
    }
    if (!token) {
      throw nativeProviderError(
        PROVIDER_ID12,
        "\u672A\u68C0\u6D4B\u5230\u672C\u5730 WorkBuddy \u767B\u5F55\u51ED\u636E\uFF0C\u8BF7\u5148\u5728 WorkBuddy \u684C\u9762\u7AEF\u767B\u5F55\u6216\u8BBE\u7F6E WORKBUDDY_ACCESS_TOKEN"
      );
    }
    const messages = await buildWorkbuddyMessages(request, attachments);
    const convId = randomUUID10();
    const reqId = randomUUID10();
    const msgId = randomUUID10();
    const traceId = randomBytes5(16).toString("hex");
    const spanId = randomBytes5(8).toString("hex");
    const parentSpanId = randomBytes5(8).toString("hex");
    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-requested-with": "XMLHttpRequest",
      "x-codebuddy-request": "1",
      "X-Conversation-ID": convId,
      "X-Conversation-Request-ID": reqId,
      "X-Conversation-Message-ID": msgId,
      "X-Request-ID": reqId,
      "X-Agent-Intent": "craft",
      "X-Agent-Purpose": "conversation",
      "X-IDE-Type": "WorkBuddy",
      "X-IDE-Name": "WorkBuddy",
      "X-IDE-Version": "5.9.4",
      "X-Private-Data": "true",
      "X-Product": "SaaS",
      "User-Agent": "WorkBuddy/5.9.4 WorkBuddy/5.9.4",
      traceparent: `00-${traceId}-${spanId}-01`,
      b3: `${traceId}-${spanId}-1-${parentSpanId}`,
      "X-B3-TraceId": traceId,
      "X-B3-SpanId": spanId,
      "X-B3-Sampled": "1",
      "X-Trace-ID": traceId,
      ...uid ? { "X-User-Id": uid } : {}
    };
    const body = {
      model: request.model ?? "deepseek-v4.1-flash",
      messages,
      stream: true,
      ...typeof request.temperature === "number" ? { temperature: request.temperature } : {},
      ...typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}
    };
    const response = await fetchNativeResponse(
      validatedEndpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal
      },
      {
        providerId: PROVIDER_ID12,
        timeoutMs,
        fetchImpl
      }
    );
    let text3 = "";
    let textIndex = 0;
    let textOpen = false;
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";
    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: PROVIDER_ID12 })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;
      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;
      const delta = choice.delta ?? {};
      const reasoningDelta = firstString10(delta.reasoning_content, delta.reasoning, delta.thought);
      if (reasoningDelta) {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        reasoning.text += reasoningDelta;
        yield { type: "reasoning-delta", index: reasoning.index, text: reasoningDelta };
      }
      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text3 += content;
        yield { type: "text-delta", index: textIndex, text: content };
      }
      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }
    if (reasoning) {
      yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
    }
    if (textOpen) {
      yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
    }
    if (rawUsage) {
      yield {
        type: "usage",
        usage: normalizeUsage(rawUsage)
      };
    }
    yield {
      type: "finish",
      reason: finishReason(stop),
      ...rawUsage ? { usage: normalizeUsage(rawUsage) } : {}
    };
  };
}

// modules/provider-workbuddy/src/driver.mjs
var PROVIDER_ID13 = "workbuddy";
var BUILTIN_WORKBUDDY_FREE_MODELS = Object.freeze([
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek v4.1 Flash (WorkBuddy Free)",
    contextWindow: 1e6,
    maxTokens: 128e3,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "hy3",
    name: "Hunyuan 3 (WorkBuddy Free)",
    contextWindow: 192e3,
    maxTokens: 64e3,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  }
]);
function summarizeWorkbuddyCandidate(candidate2) {
  return candidate2?.displayName ?? candidate2?.email ?? candidate2?.accountId ?? "WorkBuddy Free";
}
function findLocalWorkbuddySnapshot() {
  const configDir = findWorkbuddyConfigDir();
  if (configDir) {
    const storageDir = join12(configDir, "storage");
    if (existsSync4(storageDir)) {
      try {
        const userDirs = readdirSync2(storageDir).filter((d) => d.startsWith("user-"));
        for (const userDir of userDirs) {
          const scopedDir = join12(storageDir, userDir, "scoped");
          if (existsSync4(scopedDir)) {
            const scopes = readdirSync2(scopedDir);
            for (const scope of scopes) {
              const configFile = join12(scopedDir, scope, "wb-product-config.json");
              if (existsSync4(configFile)) {
                return configFile;
              }
            }
          }
        }
      } catch {
      }
    }
  }
  const appAsarProductJson = "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar/cli/product.json";
  if (existsSync4(appAsarProductJson)) return appAsarProductJson;
  const unpackedProductJson = "/Applications/WorkBuddy AI.app/Contents/Resources/app.asar.unpacked/cli/product.json";
  if (existsSync4(unpackedProductJson)) return unpackedProductJson;
  return null;
}
function parseWorkbuddyCatalog(data) {
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
  const seen = /* @__PURE__ */ new Set();
  for (const item of rawModels) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const credits = stringValue(item?.credits) ?? "";
    const isFree = credits === "x0.00" || credits === "x0.00 credits" || credits === "0" || item?.free === true || item?.isFree === true;
    const baseName = stringValue(item?.name) || stringValue(item?.title) || id;
    const name2 = isFree && !baseName.toLowerCase().includes("free") ? `${baseName} (WorkBuddy Free)` : baseName;
    const contextWindow = Number.isInteger(item?.maxInputTokens) ? item.maxInputTokens : Number.isInteger(item?.contextWindow) ? item.contextWindow : 131072;
    const maxTokens = Number.isInteger(item?.maxOutputTokens) ? item.maxOutputTokens : Number.isInteger(item?.maxTokens) ? item.maxTokens : 16384;
    const modelRecord = {
      id,
      name: name2,
      contextWindow,
      maxTokens,
      free: isFree,
      credits,
      reasoning: {
        efforts: [
          { id: "minimal", name: "Minimal" },
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" }
        ],
        defaultEffort: "medium"
      }
    };
    if (isFree) {
      freeModels.push(modelRecord);
    } else {
      paidModels.push(modelRecord);
    }
  }
  for (const builtin of BUILTIN_WORKBUDDY_FREE_MODELS) {
    if (!seen.has(builtin.id)) {
      freeModels.unshift(builtin);
      seen.add(builtin.id);
    }
  }
  return { models: [...freeModels, ...paidModels] };
}
function createWorkbuddyCatalogLoader({
  cacheTtlMs = 6e4
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
        const raw = readFileSync3(snapshotPath, "utf8");
        const json = JSON.parse(raw);
        cached = parseWorkbuddyCatalog(json);
        cachedAt = Date.now();
        return cached;
      } catch {
      }
    }
    cached = { models: [...BUILTIN_WORKBUDDY_FREE_MODELS] };
    cachedAt = Date.now();
    return cached;
  };
}
var WorkbuddyDriver = class {
  constructor({
    endpoint: endpoint2 = DEFAULT_WORKBUDDY_ENDPOINT,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 12e4
  } = {}) {
    this.endpoint = endpoint2;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createWorkbuddyCatalogLoader({ cacheTtlMs: 6e4 });
    this.requestExecutor = requestExecutor ?? createWorkbuddyNativeExecutor({
      endpoint: endpoint2,
      fetchImpl,
      timeoutMs
    });
  }
  async discover() {
    let session = null;
    try {
      session = extractWorkbuddySession();
    } catch {
    }
    const displayName = session?.nickname ? `WorkBuddy Free (${session.nickname})` : "WorkBuddy Free";
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
            status: "active"
          },
          quota: {
            remaining: 100,
            limit: 100,
            unit: "requests",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          source: "workbuddy_free_tier",
          health: {
            status: "healthy"
          }
        }
      ],
      source: "workbuddy_free_tier",
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const accountId = candidate2?.accountId || "workbuddy-free";
    const ref = createCredentialRef(PROVIDER_ID13, accountId);
    if (context.secretStore) {
      let session = null;
      try {
        session = extractWorkbuddySession();
      } catch {
      }
      await context.secretStore.write(ref, {
        type: "workbuddy_free",
        access: session?.accessToken || "free-tier",
        uid: session?.uid || null,
        email: session?.email || null
      }).catch(() => {
      });
    }
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID13,
      displayName: candidate2?.displayName || "WorkBuddy Free",
      email: candidate2?.email || "workbuddy@desktop.ai",
      auth: {
        kind: "workbuddy_free",
        credentialRef: ref
      },
      subscription: {
        plan: candidate2?.subscription?.plan || "WorkBuddy Free Rotation",
        status: "active"
      },
      quota: createQuotaSnapshot(candidate2?.quota || {
        remaining: 100,
        limit: 100,
        unit: "requests"
      }),
      health: {
        status: "healthy"
      }
    });
  }
  async getActiveSession() {
    return this.discover().then((res) => Array.isArray(res?.candidates) ? res.candidates[0] : null);
  }
  async refreshAccount(account) {
    return {
      quota: createQuotaSnapshot({
        remaining: 100,
        limit: 100,
        unit: "requests",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }),
      health: {
        status: "healthy",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async getQuota() {
    return createQuotaSnapshot({
      remaining: 100,
      limit: 100,
      unit: "requests",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      signal: context.signal ?? invocation?.signal
    });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createWorkbuddyDriver(options = {}) {
  return new WorkbuddyDriver(options);
}

// modules/provider-workbuddy/src/index.mjs
function createWorkbuddyModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "workbuddy",
    displayName: "WorkBuddy",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-kilo/src/native-transport.mjs
function firstString11(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}
var PROVIDER_ID14 = "kilo";
var DEFAULT_KILO_ENDPOINT = "https://ai-gateway.kilo.ai/api/v1/chat/completions";
function contentPartText2(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.content === "string") return part.content;
  return "";
}
async function openAiContent3(content, attachments = []) {
  if (typeof content === "string") {
    if (!attachments?.length) return content;
    const parts = [{ type: "text", text: content }];
    for (const attachment of attachments) {
      const data = await resolveImageData(attachment);
      if (data) parts.push(data);
    }
    return parts;
  }
  if (Array.isArray(content)) {
    const parts = [];
    for (const part of content) {
      if (typeof part === "string") {
        parts.push({ type: "text", text: part });
      } else if (part && typeof part === "object") {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push(part);
        } else if (part.type === "image" || part.type === "image_url") {
          parts.push(part);
        } else {
          const text3 = contentPartText2(part);
          if (text3) parts.push({ type: "text", text: text3 });
        }
      }
    }
    for (const attachment of attachments) {
      const data = await resolveImageData(attachment);
      if (data) parts.push(data);
    }
    return parts;
  }
  return "";
}
async function buildKiloMessages(request = {}, attachments = []) {
  const result = [];
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  for (const message of rawMessages) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "system" ? "system" : "user";
    const content = await openAiContent3(message?.content ?? message?.text, attachments);
    result.push({
      role,
      content: Array.isArray(content) && content.length === 1 && content[0]?.type === "text" ? content[0].text : content
    });
  }
  if (result.length === 0 && typeof request.prompt === "string" && request.prompt.trim()) {
    result.push({
      role: "user",
      content: request.prompt.trim()
    });
  }
  return result;
}
function createKiloNativeExecutor({
  endpoint: endpoint2 = DEFAULT_KILO_ENDPOINT,
  apiKey = null,
  fetchImpl = fetch,
  timeoutMs = 12e4
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID14 });
  return async function* kiloNativeExecutor(envelope2 = {}) {
    const { request, attachments, credential, signal } = envelope2;
    const token = apiKey ?? (credential?.apiKey && credential.apiKey !== "free-tier" ? credential.apiKey : null) ?? (credential?.token && credential.token !== "free-tier" ? credential.token : null) ?? (credential?.accessToken && credential.accessToken !== "free-tier" ? credential.accessToken : null) ?? process.env.KILO_API_KEY ?? null;
    const messages = await buildKiloMessages(request, attachments);
    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...token ? { Authorization: `Bearer ${token}` } : {}
    };
    const body = {
      model: request.model ?? "kilo-auto/free",
      messages,
      stream: true,
      ...typeof request.temperature === "number" ? { temperature: request.temperature } : {},
      ...typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {}
    };
    const response = await fetchNativeResponse(
      validatedEndpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal
      },
      {
        providerId: PROVIDER_ID14,
        timeoutMs,
        fetchImpl
      }
    );
    let text3 = "";
    let textIndex = 0;
    let textOpen = false;
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";
    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: PROVIDER_ID14 })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;
      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;
      const delta = choice.delta ?? {};
      const reasoningDelta = firstString11(delta.reasoning_content, delta.reasoning, delta.thought);
      if (reasoningDelta) {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        if (!reasoning) {
          reasoning = { index: nextIndex++, text: "" };
          yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
        }
        reasoning.text += reasoningDelta;
        yield { type: "reasoning-delta", index: reasoning.index, text: reasoningDelta };
      }
      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text3 += content;
        yield { type: "text-delta", index: textIndex, text: content };
      }
      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }
    if (reasoning) {
      yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
    }
    if (textOpen) {
      yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
    }
    if (rawUsage) {
      yield {
        type: "usage",
        usage: normalizeUsage(rawUsage)
      };
    }
    yield {
      type: "finish",
      reason: finishReason(stop),
      ...rawUsage ? { usage: normalizeUsage(rawUsage) } : {}
    };
  };
}

// modules/provider-kilo/src/driver.mjs
var PROVIDER_ID15 = "kilo";
var DEFAULT_CATALOG_URL2 = "https://api.kilo.ai/api/gateway/models";
var BUILTIN_KILO_FREE_MODELS = Object.freeze([
  {
    id: "kilo-auto/free",
    name: "Auto Free (Kilo)",
    contextWindow: 256e3,
    maxTokens: 32768,
    free: true
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL (Free)",
    contextWindow: 1e6,
    maxTokens: 131072,
    inputModalities: ["text", "image", "video"],
    free: true
  },
  {
    id: "reflection/beam-free",
    name: "Reflection Beam 1.0 (Free)",
    contextWindow: 1048576,
    maxTokens: 131072,
    free: true
  },
  {
    id: "inclusionai/ling-3.1-flash-1019-free",
    name: "inclusionAI Ling 3.1 Flash (Free)",
    contextWindow: 1e6,
    maxTokens: 262144,
    free: true
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra (Free)",
    contextWindow: 1e6,
    maxTokens: 131072,
    free: true
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning (Free)",
    contextWindow: 1e6,
    maxTokens: 131072,
    free: true
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint (Free)",
    contextWindow: 262144,
    maxTokens: 65536,
    free: true
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside Laguna S 2.1 (Free)",
    contextWindow: 262144,
    maxTokens: 65536,
    free: true
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Models Router",
    contextWindow: 2e5,
    maxTokens: 32768,
    free: true
  },
  {
    id: "stealth/glyph-cluster",
    name: "Stealth Glyph Cluster (Free)",
    contextWindow: 256e3,
    maxTokens: 32768,
    free: true
  }
]);
function parseKiloCatalog(data) {
  const items = Array.isArray(data?.data) ? data.data : [];
  if (!items.length) {
    return { models: [...BUILTIN_KILO_FREE_MODELS] };
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const builtinMap = new Map(BUILTIN_KILO_FREE_MODELS.map((m) => [m.id, m]));
  for (const item of items) {
    if (!item?.isFree) continue;
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const builtin = builtinMap.get(id);
    const name2 = stringValue(item?.name) ?? builtin?.name ?? id;
    const contextWindow = Number.isInteger(item?.context_length) ? item.context_length : builtin?.contextWindow ?? 256e3;
    const maxTokens = Number.isInteger(item?.top_provider?.max_completion_tokens) ? item.top_provider.max_completion_tokens : builtin?.maxTokens ?? 32768;
    result.push({
      id,
      name: name2,
      contextWindow,
      maxTokens,
      free: true
    });
  }
  if (result.length === 0) {
    return { models: [...BUILTIN_KILO_FREE_MODELS] };
  }
  return { models: result };
}
function createKiloCatalogLoader({
  url = DEFAULT_CATALOG_URL2,
  fetchImpl = fetch,
  cacheTtlMs = 3e5
} = {}) {
  let cached = null;
  let cachedAt = 0;
  return async function kiloCatalogLoader({ force = false } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }
    try {
      assertSecureEndpointUrl(url, { providerId: PROVIDER_ID15 });
      const data = await fetchJson(url, {
        headers: { Accept: "application/json" },
        fetchImpl,
        timeoutMs: 1e4
      });
      const parsed = parseKiloCatalog(data);
      if (parsed.models.length > 0) {
        cached = parsed;
        cachedAt = now;
        return cached;
      }
    } catch {
    }
    cached = { models: [...BUILTIN_KILO_FREE_MODELS] };
    cachedAt = now;
    return cached;
  };
}
function summarizeKiloCandidate(candidate2) {
  return candidate2?.displayName ?? candidate2?.email ?? candidate2?.accountId ?? "Kilo Free Tier";
}
var KiloDriver = class {
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
            status: "active"
          },
          quota: {
            remaining: 100,
            limit: 100,
            unit: "requests",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          source: "kilo_free_tier",
          health: {
            status: "healthy"
          }
        }
      ],
      source: "kilo_free_tier",
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const accountId = candidate2?.accountId || "kilo-free";
    const ref = createCredentialRef(PROVIDER_ID15, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "kilo_free",
        access: "free-tier"
      }).catch(() => {
      });
    }
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID15,
      displayName: candidate2?.displayName || "Kilo Free Tier",
      email: candidate2?.email || "free@kilo.ai",
      auth: {
        kind: "kilo_free",
        credentialRef: ref
      },
      subscription: {
        plan: candidate2?.subscription?.plan || "Free Frontier Router",
        status: "active"
      },
      quota: createQuotaSnapshot(candidate2?.quota || {
        remaining: 100,
        limit: 100,
        unit: "requests"
      }),
      health: {
        status: "healthy"
      }
    });
  }
  async getActiveSession() {
    return this.discover().then((res) => Array.isArray(res?.candidates) ? res.candidates[0] : null);
  }
  async refreshAccount(account) {
    return {
      quota: createQuotaSnapshot({
        remaining: 100,
        limit: 100,
        unit: "requests",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }),
      health: {
        status: "healthy",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async invoke(envelope2) {
    return this.#requestExecutor(envelope2);
  }
};
function createKiloDriver(options = {}) {
  return new KiloDriver(options);
}

// modules/provider-kilo/src/index.mjs
function createKiloModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "kilo",
    displayName: "Kilo Free",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// packages/runtime/src/dockyard-runtime.mjs
var candidateSummarizers = /* @__PURE__ */ new Map([
  ["openai-codex", summarizeCodexCandidate],
  ["antigravity", summarizeAntigravityCandidate],
  ["grok", summarizeGrokCandidate],
  ["claude", summarizeClaudeCandidate],
  ["cursor", summarizeCursorCandidate],
  ["opencode", summarizeOpencodeCandidate],
  ["workbuddy", summarizeWorkbuddyCandidate],
  ["kilo", summarizeKiloCandidate]
]);
var DEFAULT_REFRESH_TIMEOUT_MS = 3e4;
function numericOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function refreshTimeoutError(providerId, accountId, timeoutMs) {
  const error = new Error(`\u5237\u65B0 ${providerId}/${accountId} \u8D85\u65F6\uFF08${Math.ceil(timeoutMs / 1e3)} \u79D2\uFF09\uFF1B\u5DF2\u4FDD\u7559\u4E0A\u6B21\u989D\u5EA6`);
  error.code = "ETIMEDOUT";
  error.refreshTimeout = true;
  error.timeoutMs = timeoutMs;
  return error;
}
function reportPostRefreshHealth(pool, accountId, { allowExpiredRecovery = false } = {}) {
  const account = pool.get(accountId);
  if (!account || account.health?.status === ACCOUNT_HEALTH.EXPIRED && !allowExpiredRecovery) return;
  const remaining = account.quota?.remaining;
  if (typeof remaining === "number" && remaining <= 0) {
    pool.report(accountId, {
      status: "quota_exhausted",
      message: "\u5237\u65B0\u540E\u5B98\u65B9\u989D\u5EA6\u4ECD\u4E3A 0\uFF0C\u8BF7\u5207\u6362\u8D26\u53F7\u6216\u7A0D\u540E\u91CD\u8BD5"
    });
    return;
  }
  pool.report(accountId, { status: "success" });
}
function withRefreshTimeout(task, { providerId, accountId, timeoutMs }) {
  const controller = new AbortController();
  let timer = null;
  const operation = Promise.resolve().then(() => task(controller.signal));
  operation.catch(() => {
  });
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(refreshTimeoutError(providerId, accountId, timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([operation, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
function withRequestExecutor(providerId, driverOptions, requestExecutors = {}) {
  const executor = requestExecutors[providerId];
  return executor ? { ...driverOptions ?? {}, requestExecutor: executor } : driverOptions;
}
function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function providerStorageSnapshot(entry) {
  return {
    policy: entry.pool.policy,
    defaultAccountId: entry.pool.getDefaultAccountId(),
    accounts: entry.pool.listForStorage()
  };
}
function restorePoolSnapshot(pool, snapshot) {
  const desired = new Map((snapshot.accounts ?? []).map((account) => [account.accountId, account]));
  for (const account of pool.list()) {
    if (!desired.has(account.accountId)) pool.remove(account.accountId);
  }
  for (const account of desired.values()) {
    pool.upsert({ ...account, credentialRef: account.auth?.credentialRef }, { resetHealth: false });
  }
  pool.setPolicy(snapshot.policy);
  pool.setDefaultAccount(snapshot.defaultAccountId ?? null);
}
async function deleteUncommittedCredentials(secretStore, beforeRefs, accounts) {
  if (typeof secretStore?.delete !== "function") return;
  const refs = new Set(accounts.map((account) => account?.auth?.credentialRef ?? account?.credentialRef).filter(Boolean));
  for (const ref of refs) {
    if (!beforeRefs.has(ref)) await secretStore.delete(ref).catch(() => {
    });
  }
}
function mergeProviderStorage(latestInput, current, baseline = {}) {
  const latest = latestInput && typeof latestInput === "object" ? latestInput : {};
  const merged = { ...latest };
  if (current.policy !== baseline.policy) merged.policy = current.policy;
  if ((current.defaultAccountId ?? null) !== (baseline.defaultAccountId ?? null)) {
    merged.defaultAccountId = current.defaultAccountId ?? null;
  }
  const latestById = new Map((Array.isArray(latest.accounts) ? latest.accounts : []).filter((account) => account?.accountId).map((account) => [account.accountId, account]));
  const currentById = new Map((Array.isArray(current.accounts) ? current.accounts : []).filter((account) => account?.accountId).map((account) => [account.accountId, account]));
  const baselineById = new Map((Array.isArray(baseline.accounts) ? baseline.accounts : []).filter((account) => account?.accountId).map((account) => [account.accountId, account]));
  for (const [accountId, currentAccount] of currentById) {
    const baselineAccount = baselineById.get(accountId);
    const latestAccount = latestById.get(accountId);
    if (!baselineAccount) {
      latestById.set(accountId, structuredClone(currentAccount));
      continue;
    }
    if (!latestAccount) {
      continue;
    }
    if (jsonEqual(currentAccount, baselineAccount)) continue;
    const changedAccount = { ...latestAccount };
    for (const [key, value] of Object.entries(currentAccount)) {
      if (!jsonEqual(value, baselineAccount[key])) changedAccount[key] = structuredClone(value);
    }
    latestById.set(accountId, changedAccount);
  }
  for (const accountId of baselineById.keys()) {
    if (!currentById.has(accountId)) latestById.delete(accountId);
  }
  merged.accounts = [...latestById.values()];
  return merged;
}
function createDefaultProviderEntries(options = {}) {
  const requestExecutors = options.requestExecutors ?? {};
  const catalogLoaders = options.catalogLoaders ?? {};
  return [
    {
      module: createCodexModule({
        driver: options.codexDriver ?? createCodexDriver({
          ...withRequestExecutor("openai-codex", options.codex, requestExecutors),
          ...catalogLoaders["openai-codex"] ? { catalogLoader: catalogLoaders["openai-codex"] } : {}
        })
      }),
      driver: options.codexDriver
    },
    {
      module: createAntigravityModule({
        driver: options.antigravityDriver ?? createAntigravityDriver({
          ...withRequestExecutor("antigravity", options.antigravity, requestExecutors),
          ...catalogLoaders.antigravity ? { catalogLoader: catalogLoaders.antigravity } : {}
        })
      }),
      driver: options.antigravityDriver
    },
    {
      module: createGrokModule({
        driver: options.grokDriver ?? createGrokDriver({
          ...withRequestExecutor("grok", options.grok, requestExecutors),
          ...catalogLoaders.grok ? { catalogLoader: catalogLoaders.grok } : {}
        })
      }),
      driver: options.grokDriver
    },
    {
      module: createClaudeModule({
        driver: options.claudeDriver ?? createClaudeDriver({
          ...withRequestExecutor("claude", options.claude, requestExecutors),
          ...catalogLoaders.claude ? { catalogLoader: catalogLoaders.claude } : {}
        })
      }),
      driver: options.claudeDriver
    },
    {
      module: createCursorModule({
        driver: options.cursorDriver ?? createCursorDriver({
          ...withRequestExecutor("cursor", options.cursor, requestExecutors),
          ...catalogLoaders.cursor ? { catalogLoader: catalogLoaders.cursor } : {}
        })
      }),
      driver: options.cursorDriver
    },
    {
      module: createOpencodeModule({
        driver: options.opencodeDriver ?? createOpencodeDriver({
          ...withRequestExecutor("opencode", options.opencode, requestExecutors),
          ...catalogLoaders.opencode ? { catalogLoader: catalogLoaders.opencode } : {}
        })
      }),
      driver: options.opencodeDriver
    },
    {
      module: createWorkbuddyModule({
        driver: options.workbuddyDriver ?? createWorkbuddyDriver({
          ...withRequestExecutor("workbuddy", options.workbuddy, requestExecutors),
          ...catalogLoaders.workbuddy ? { catalogLoader: catalogLoaders.workbuddy } : {}
        })
      }),
      driver: options.workbuddyDriver
    },
    {
      module: createKiloModule({
        driver: options.kiloDriver ?? createKiloDriver({
          ...withRequestExecutor("kilo", options.kilo, requestExecutors),
          ...catalogLoaders.kilo ? { catalogLoader: catalogLoaders.kilo } : {}
        })
      }),
      driver: options.kiloDriver
    }
  ];
}
function providerContext(app, extra = {}) {
  return {
    secretStore: app.secretStore,
    now: /* @__PURE__ */ new Date(),
    ...extra
  };
}
function providerAccount2(pool, accountId) {
  const account = pool.get(accountId);
  if (!account) throw new Error(`Account does not exist: ${accountId}`);
  const auth = pool.resolve(accountId);
  return {
    ...account,
    auth: {
      kind: auth.authKind,
      credentialRef: auth.credentialRef,
      scopes: [...auth.scopes]
    }
  };
}
function providerErrorStatus(error) {
  if (error?.quotaUnavailable) return "error";
  if (error?.authExpired || error?.accountMismatch) return "auth_expired";
  if (error?.authForbidden) return "error";
  if (error?.quotaExhausted) return "quota_exhausted";
  if (error?.rateLimited) return "rate_limited";
  return "error";
}
var DockyardRuntime = class {
  #entries = /* @__PURE__ */ new Map();
  #candidates = /* @__PURE__ */ new Map();
  #refreshPromises = /* @__PURE__ */ new Map();
  #accountRefreshPromises = /* @__PURE__ */ new Map();
  #stateBaselines = /* @__PURE__ */ new Map();
  #saveQueue = Promise.resolve();
  // Per-provider import transactions. Import work is async (OAuth, network);
  // without serialization two concurrent imports could roll each other back
  // through stale pool snapshots.
  #providerImportQueues = /* @__PURE__ */ new Map();
  #initialized = false;
  #initPromise = null;
  constructor({
    providers = createDefaultProviderEntries(),
    runtime = new ModuleRuntime({ logger: { error() {
    }, warn() {
    }, info() {
    } } }),
    stateStore = new JsonStateStore(),
    secretStore = createDefaultSecretStore(),
    dshAdapter = null,
    refreshTimeoutMs = numericOption(process.env.DOCKYARD_DSH_REFRESH_TIMEOUT_MS, DEFAULT_REFRESH_TIMEOUT_MS)
  } = {}) {
    this.runtime = runtime;
    this.stateStore = stateStore;
    this.secretStore = secretStore;
    this.contextWindowOverrides = new ContextWindowOverrideStore({ stateStore });
    this.modelSelection = new ModelSelectionStore({ stateStore });
    this.bridge = new DshInjectionBridge({
      runtime,
      adapter: dshAdapter,
      contextWindowOverrides: this.contextWindowOverrides,
      modelSelection: this.modelSelection
    });
    this.providers = providers;
    this.refreshTimeoutMs = refreshTimeoutMs;
  }
  setSecretStore(secretStore) {
    if (!secretStore || typeof secretStore.read !== "function" || typeof secretStore.write !== "function") {
      throw new TypeError("Dockyard secret store requires read() and write() methods");
    }
    this.secretStore = secretStore;
    return this;
  }
  async init() {
    if (this.#initialized) return this;
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = (async () => {
      const state = await this.stateStore.load();
      await this.contextWindowOverrides.ready();
      await this.modelSelection.ready();
      const autoImported = /* @__PURE__ */ new Set();
      for (const entry of this.providers) {
        const providerId = entry.module.manifest.id;
        const stored = state.pools?.[providerId] ?? {};
        this.#stateBaselines.set(providerId, structuredClone({
          policy: stored.policy ?? ACCOUNT_SELECTION_POLICY.ROUND_ROBIN,
          defaultAccountId: stored.defaultAccountId ?? null,
          accounts: Array.isArray(stored.accounts) ? stored.accounts : []
        }));
        const pool = new AccountPool({
          providerId,
          policy: stored.policy ?? ACCOUNT_SELECTION_POLICY.ROUND_ROBIN
        });
        for (const account of Array.isArray(stored.accounts) ? stored.accounts : []) {
          if (account?.auth?.credentialRef) {
            pool.upsert({ ...account, credentialRef: account.auth.credentialRef });
          }
        }
        if (stored.defaultAccountId && pool.get(stored.defaultAccountId)) {
          pool.setDefaultAccount(stored.defaultAccountId);
        }
        const hasExpiredOfficialSession = pool.list().some((a) => a.resources?.accountScope === "active_official_session" && a.health?.status === ACCOUNT_HEALTH.EXPIRED);
        const hasNoEligible = pool.list().filter((a) => a.health?.status !== ACCOUNT_HEALTH.EXPIRED).length === 0;
        if ((providerId === "opencode" || providerId === "workbuddy" || providerId === "kilo") && pool.list().length === 0 || hasExpiredOfficialSession && hasNoEligible) {
          try {
            const discovery = await (entry.module?.discover?.(providerContext(this)) ?? entry.driver?.discover?.(providerContext(this)));
            const candidate2 = Array.isArray(discovery?.candidates) ? discovery.candidates[0] : Array.isArray(discovery) ? discovery[0] : null;
            if (candidate2 && candidate2.status !== "unavailable" && typeof entry.module?.importAccount === "function") {
              const account = await entry.module.importAccount(candidate2, providerContext(this));
              const obsoleteOfficial = pool.list().find((a) => a.resources?.accountScope === "active_official_session" && candidate2.resources?.accountScope === "active_official_session" && a.accountId !== account.accountId);
              if (obsoleteOfficial) {
                pool.remove(obsoleteOfficial.accountId);
              }
              pool.upsert(account, { resetHealth: true });
              pool.setDefaultAccount(account.accountId);
              autoImported.add(providerId);
            }
          } catch {
          }
        }
        this.#entries.set(providerId, { ...entry, pool });
        if (!this.runtime.has(providerId)) await this.runtime.register(entry.module);
        await this.bridge.mountProvider(entry.module, pool);
      }
      if (this.#entries.get("opencode")?.pool?.list()?.length > 0) {
        autoImported.add("opencode");
      }
      if (this.#entries.get("workbuddy")?.pool?.list()?.length > 0) {
        autoImported.add("workbuddy");
      }
      if (this.#entries.get("kilo")?.pool?.list()?.length > 0) {
        autoImported.add("kilo");
      }
      if (autoImported.size > 0) {
        await this.#saveState([...autoImported]).catch(() => {
        });
      }
      this.#initialized = true;
      return this;
    })();
    try {
      return await this.#initPromise;
    } finally {
      this.#initPromise = null;
    }
  }
  #entry(providerId) {
    const entry = this.#entries.get(providerId);
    if (!entry) throw new Error(`Unknown Dockyard provider: ${providerId}`);
    return entry;
  }
  listProviderManifests() {
    return this.providers.map(({ module }) => ({ ...module.manifest }));
  }
  listProviderIds() {
    return this.providers.map(({ module }) => module.manifest.id);
  }
  async scan(providerId = null) {
    await this.init();
    const entries = providerId ? [[providerId, this.#entry(providerId)]] : [...this.#entries];
    const providers = [];
    const changedProviderIds = /* @__PURE__ */ new Set();
    for (const [currentProviderId, entry] of entries) {
      let result;
      try {
        result = await entry.module.discover(providerContext(this, {
          accounts: entry.pool.list()
        }));
      } catch (error) {
        result = { candidates: [], source: "provider", diagnostics: [redactError(error)] };
      }
      const rawCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
      this.#candidates.set(currentProviderId, new Map(rawCandidates.map((candidate2) => [candidate2.candidateId, candidate2])));
      for (const candidate2 of rawCandidates) {
        const existing = entry.pool.get(candidate2.accountId);
        const candidateIdentity = candidate2.resources ?? {};
        const existingIdentity = existing?.resources ?? {};
        if (!existing) {
          const obsoleteOfficial = entry.pool.list().find((a) => a.resources?.accountScope === "active_official_session" && candidate2.resources?.accountScope === "active_official_session" && a.accountId !== candidate2.accountId && a.health?.status === ACCOUNT_HEALTH.EXPIRED);
          if (obsoleteOfficial && typeof entry.module.importAccount === "function") {
            try {
              const imported = await entry.module.importAccount(candidate2, providerContext(this));
              entry.pool.remove(obsoleteOfficial.accountId);
              entry.pool.upsert(imported, { resetHealth: true });
              if (entry.pool.getDefaultAccountId() === obsoleteOfficial.accountId) {
                entry.pool.setDefaultAccount(imported.accountId);
              }
              changedProviderIds.add(currentProviderId);
            } catch {
            }
          }
          continue;
        }
        const identityChanged = candidate2.email !== existing.email || candidate2.displayName !== existing.displayName || candidateIdentity.identitySource !== existingIdentity.identitySource || candidateIdentity.identityLabel !== existingIdentity.identityLabel || candidateIdentity.sessionFingerprint !== existingIdentity.sessionFingerprint || candidateIdentity.identityNote !== existingIdentity.identityNote || candidateIdentity.sessionPersistence !== existingIdentity.sessionPersistence;
        if (identityChanged) {
          entry.pool.upsert({
            accountId: candidate2.accountId,
            ...candidate2.email !== void 0 ? { email: candidate2.email } : {},
            ...candidate2.displayName !== void 0 ? { displayName: candidate2.displayName } : {},
            ...candidate2.resources ? { resources: candidate2.resources } : {}
          });
          changedProviderIds.add(currentProviderId);
        }
        const fingerprintChanged = candidate2.resources?.sessionPersistence === "captured" && candidate2.resources.sessionFingerprint && candidate2.resources.sessionFingerprint !== existing.resources?.sessionFingerprint;
        if (fingerprintChanged && typeof entry.module.importAccount === "function") {
          try {
            const captured = await entry.module.importAccount(candidate2, providerContext(this));
            entry.pool.upsert(captured, { resetHealth: true });
            changedProviderIds.add(currentProviderId);
          } catch {
          }
        }
        const shouldRepairGrokCredential = currentProviderId === "grok" && typeof entry.module.importAccount === "function" && (candidate2.email && !existing.email || candidate2.source && candidate2.source !== existingIdentity.authSource);
        if (shouldRepairGrokCredential) {
          try {
            const repaired = await entry.module.importAccount(candidate2, providerContext(this));
            entry.pool.upsert(repaired, { resetHealth: true });
            changedProviderIds.add(currentProviderId);
          } catch {
          }
        }
      }
      const summarize = candidateSummarizers.get(currentProviderId) ?? ((candidate2) => ({ ...candidate2 }));
      const candidates = rawCandidates.map((candidate2) => ({
        ...summarize(candidate2),
        imported: Boolean(entry.pool.get(candidate2.accountId))
      }));
      providers.push({
        providerId: currentProviderId,
        manifest: { ...entry.module.manifest },
        policy: entry.pool.policy,
        accounts: entry.pool.list(),
        candidates,
        source: result?.source ?? "unknown",
        diagnostics: result?.diagnostics ?? []
      });
    }
    if (changedProviderIds.size > 0) await this.#saveState(changedProviderIds);
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      providers,
      routes: this.bridge.listRoutes()
    };
  }
  async importCandidate(providerId, candidateId) {
    await this.init();
    const entry = this.#entry(providerId);
    const candidate2 = this.#candidates.get(providerId)?.get(candidateId);
    if (!candidate2) throw new Error("Candidate is missing; scan local OAuth states again");
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let rawAccount;
      try {
        rawAccount = await entry.module.importAccount(candidate2, providerContext(this));
        entry.pool.upsert(rawAccount, { resetHealth: true });
        await this.#saveState([providerId]);
      } catch (error) {
        restorePoolSnapshot(entry.pool, before);
        await deleteUncommittedCredentials(this.secretStore, beforeRefs, rawAccount ? [rawAccount] : []);
        throw error;
      }
      return {
        account: entry.pool.get(rawAccount.accountId),
        diagnostics: [],
        needsRefresh: true
      };
    });
  }
  async importSource(providerId, source) {
    await this.init();
    const entry = this.#entry(providerId);
    if (typeof entry.module.importSource !== "function") {
      throw new Error(`Provider ${providerId} does not support OAuth source import`);
    }
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let rawAccounts = [];
      try {
        const imported = await entry.module.importSource(source, providerContext(this));
        rawAccounts = Array.isArray(imported) ? imported : Array.isArray(imported?.accounts) ? imported.accounts : [imported];
        const importable = rawAccounts.filter((account) => account?.accountId);
        if (importable.length === 0) throw new Error("OAuth source did not contain an importable account");
        for (const account of importable) entry.pool.upsert(account, { resetHealth: true });
        await this.#saveState([providerId]);
        return {
          accounts: importable.map((account) => entry.pool.get(account.accountId)),
          diagnostics: []
        };
      } catch (error) {
        restorePoolSnapshot(entry.pool, before);
        await deleteUncommittedCredentials(this.secretStore, beforeRefs, rawAccounts);
        throw error;
      }
    });
  }
  async startAuthorization(providerId) {
    await this.init();
    const entry = this.#entry(providerId);
    const context = providerContext(this, {
      accounts: entry.pool.list()
    });
    const result = await entry.module.startAuthorization(context);
    return this.#persistAuthorizationResult(entry, providerId, result);
  }
  async pollAuthorization(providerId, sessionId) {
    await this.init();
    const entry = this.#entry(providerId);
    const result = await entry.module.pollAuthorization(sessionId, providerContext(this, {
      accounts: entry.pool.list()
    }));
    return this.#persistAuthorizationResult(entry, providerId, result);
  }
  async cancelAuthorization(providerId, sessionId) {
    await this.init();
    return this.#entry(providerId).module.cancelAuthorization(sessionId, providerContext(this));
  }
  async submitAuthorizationCode(providerId, sessionId, code) {
    await this.init();
    const entry = this.#entry(providerId);
    return entry.module.submitAuthorizationCode(sessionId, code, providerContext(this, {
      accounts: entry.pool.list()
    }));
  }
  async refreshAccount(providerId, accountId, { force = false, tolerateFailure = false } = {}) {
    await this.init();
    const key = `${providerId}\0${accountId}\0${force ? "force" : "auto"}\0${tolerateFailure ? "lenient" : "strict"}`;
    const existing = this.#accountRefreshPromises.get(key);
    if (existing) return existing;
    const promise = (async () => {
      try {
        return await withRefreshTimeout(
          (signal) => this.#refreshAccountNow(providerId, accountId, { force, tolerateFailure, signal }),
          { providerId, accountId, timeoutMs: this.refreshTimeoutMs }
        );
      } catch (error) {
        if (!error?.refreshTimeout || !tolerateFailure) throw error;
        await this.init();
        const entry = this.#entry(providerId);
        if (entry.pool.get(accountId)) {
          entry.pool.report(accountId, { status: "error", message: error.message });
          await this.#saveState([providerId]);
        }
        return { account: entry.pool.get(accountId), diagnostics: [error.message] };
      }
    })();
    this.#accountRefreshPromises.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.#accountRefreshPromises.get(key) === promise) this.#accountRefreshPromises.delete(key);
    }
  }
  async #refreshAccountNow(providerId, accountId, { force = false, tolerateFailure = false, signal } = {}) {
    await this.init();
    const entry = this.#entry(providerId);
    providerAccount2(entry.pool, accountId);
    const diagnostics = [];
    let authorizationFailure = null;
    let refresh = null;
    try {
      refresh = await entry.module.refreshAccount(
        providerAccount2(entry.pool, accountId),
        providerContext(this, { force, signal })
      );
      if (signal?.aborted) throw signal.reason ?? refreshTimeoutError(providerId, accountId, this.refreshTimeoutMs);
      this.#applyPatch(entry.pool, accountId, refresh);
    } catch (error) {
      if (signal?.aborted) throw error;
      authorizationFailure = error;
      diagnostics.push(`\u5237\u65B0 OAuth \u72B6\u6001\u5931\u8D25\uFF1A${redactError(error)}`);
      entry.pool.report(accountId, {
        status: providerErrorStatus(error),
        message: diagnostics.at(-1)
      });
      if (!tolerateFailure) await this.#saveState([providerId]);
      if (!tolerateFailure) throw error;
    }
    if (authorizationFailure?.authExpired || authorizationFailure?.authForbidden) {
      await this.#saveState([providerId]);
      return { account: entry.pool.get(accountId), diagnostics };
    }
    try {
      if (refresh && Object.hasOwn(refresh, "quota")) {
        reportPostRefreshHealth(entry.pool, accountId, {
          allowExpiredRecovery: refresh.resources?.quotaSource === "antigravity_native"
        });
        await this.#saveState([providerId]);
        return { account: entry.pool.get(accountId), diagnostics };
      }
      const quota = await entry.module.getQuota(
        providerAccount2(entry.pool, accountId),
        providerContext(this, { signal })
      );
      if (signal?.aborted) throw signal.reason ?? refreshTimeoutError(providerId, accountId, this.refreshTimeoutMs);
      this.#applyPatch(entry.pool, accountId, quota);
      reportPostRefreshHealth(entry.pool, accountId, {
        allowExpiredRecovery: quota.resources?.quotaSource === "antigravity_native"
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      diagnostics.push(`\u5237\u65B0\u5B9E\u65F6\u989D\u5EA6\u5931\u8D25\uFF1A${redactError(error)}`);
      entry.pool.report(accountId, {
        status: providerErrorStatus(error),
        message: diagnostics.at(-1)
      });
      if (!tolerateFailure) await this.#saveState([providerId]);
      if (!tolerateFailure) throw error;
    }
    await this.#saveState([providerId]);
    return { account: entry.pool.get(accountId), diagnostics };
  }
  async refreshAll(providerId = null) {
    await this.init();
    if (!providerId) {
      const batches = await Promise.all([...this.#entries].map(([id]) => this.refreshAll(id)));
      return batches.flat();
    }
    this.#entry(providerId);
    const existing = this.#refreshPromises.get(providerId);
    if (existing) return existing;
    const promise = (async () => {
      const entry = this.#entry(providerId);
      const results = await Promise.all(entry.pool.list().map(async (account) => {
        try {
          return await this.refreshAccount(providerId, account.accountId, { tolerateFailure: true });
        } catch (error) {
          return { account: entry.pool.get(account.accountId), diagnostics: [redactError(error)] };
        }
      }));
      return results;
    })();
    this.#refreshPromises.set(providerId, promise);
    try {
      return await promise;
    } finally {
      if (this.#refreshPromises.get(providerId) === promise) this.#refreshPromises.delete(providerId);
    }
  }
  async setPolicy(providerId, policy, defaultAccountId = void 0) {
    await this.init();
    const pool = this.#entry(providerId).pool;
    pool.setPolicy(policy);
    if (defaultAccountId !== void 0) pool.setDefaultAccount(defaultAccountId);
    await this.#saveState([providerId]);
    return { providerId, policy: pool.policy, defaultAccountId: pool.getDefaultAccountId() };
  }
  async setDefaultAccount(providerId, accountId) {
    await this.init();
    const pool = this.#entry(providerId).pool;
    pool.setDefaultAccount(accountId);
    await this.#saveState([providerId]);
    return { providerId, defaultAccountId: pool.getDefaultAccountId() };
  }
  async removeAccount(providerId, accountId) {
    await this.init();
    const entry = this.#entry(providerId);
    const credential = entry.pool.resolve(accountId);
    if (!entry.pool.remove(accountId)) {
      throw new Error(`Account does not exist: ${accountId}`);
    }
    await this.#saveState([providerId]);
    const diagnostics = [];
    if (credential.credentialRef && typeof this.secretStore?.delete === "function") {
      try {
        await this.secretStore.delete(credential.credentialRef);
      } catch (error) {
        diagnostics.push(`\u6E05\u7406\u672C\u673A Keychain \u5F15\u7528\u5931\u8D25\uFF1A${redactError(error)}`);
      }
    }
    return {
      providerId,
      accountId,
      removed: true,
      defaultAccountId: entry.pool.getDefaultAccountId(),
      diagnostics
    };
  }
  async getContextWindowOverride(input) {
    await this.init();
    return this.contextWindowOverrides.get(input);
  }
  async setContextWindowOverride(input, value) {
    await this.init();
    return this.contextWindowOverrides.set(input, value);
  }
  getModelSelection(providerId) {
    return this.modelSelection.get(providerId);
  }
  async setModelSelection(providerId, enabledModelIds) {
    await this.init();
    return this.modelSelection.set(providerId, enabledModelIds);
  }
  async getCatalog(providerId, context = {}) {
    await this.init();
    const entry = this.#entry(providerId);
    const accounts = entry.pool.list().map((account) => providerAccount2(entry.pool, account.accountId));
    return entry.module.getCatalog(providerContext(this, { ...context, accounts }));
  }
  async invoke(providerId, request, context = {}) {
    await this.init();
    const route = this.bridge.getRoute(providerId);
    if (!route) throw new Error(`Unknown Dockyard provider route: ${providerId}`);
    try {
      return await route.invoke(request, providerContext(this, context));
    } finally {
      await this.#saveState([providerId]).catch(() => {
      });
    }
  }
  async stream(providerId, request, context = {}) {
    await this.init();
    const route = this.bridge.getRoute(providerId);
    if (!route) throw new Error(`Unknown Dockyard provider route: ${providerId}`);
    const output = route.stream(request, providerContext(this, context));
    const runtime = this;
    return (async function* streamWithPersistedHealth() {
      try {
        for await (const chunk of await output) yield chunk;
      } finally {
        try {
          await runtime.#saveState([providerId]);
        } catch {
        }
      }
    })();
  }
  snapshot() {
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      providers: [...this.#entries].map(([providerId, entry]) => ({
        providerId,
        manifest: { ...entry.module.manifest },
        policy: entry.pool.policy,
        defaultAccountId: entry.pool.getDefaultAccountId(),
        accounts: entry.pool.list()
      })),
      routes: this.bridge.listRoutes()
    };
  }
  #applyPatch(pool, accountId, patch = {}) {
    if (!patch || typeof patch !== "object") return;
    const input = { accountId };
    for (const key of ["email", "displayName", "subscription", "quota", "refresh", "resources"]) {
      if (patch[key] !== void 0) input[key] = patch[key];
    }
    if (patch.identity?.email !== void 0) input.email = patch.identity.email;
    if (patch.identity?.displayName !== void 0) input.displayName = patch.identity.displayName;
    if (patch.credits !== void 0) input.resources = { credits: patch.credits };
    pool.upsert(input);
  }
  async #persistAuthorizationResult(entry, providerId, result) {
    if (result?.status !== "completed") return result;
    const rawAccounts = Array.isArray(result.accounts) ? result.accounts : result.account ? [result.account] : [];
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let accounts = [];
      try {
        accounts = await this.#storeImportedAccounts(entry, rawAccounts);
        await this.#saveState([providerId]);
      } catch (error) {
        restorePoolSnapshot(entry.pool, before);
        await deleteUncommittedCredentials(this.secretStore, beforeRefs, rawAccounts.filter((value) => value?.accountId));
        throw error;
      }
      return { ...result, accounts };
    });
  }
  /**
   * Serialize per-provider import transactions (candidate/source imports and
   * completed OAuth authorizations). Each task takes its pool snapshot inside
   * the critical section, so a failure rolls back against the newest state
   * instead of resurrecting stale snapshots over concurrent successes.
   */
  #enqueueProviderImport(providerId, task) {
    const previous = this.#providerImportQueues.get(providerId) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.#providerImportQueues.set(providerId, run.then(() => {
    }, () => {
    }));
    return run;
  }
  async #storeImportedAccounts(entry, rawAccounts) {
    const accounts = [];
    for (const account of rawAccounts.filter((value) => value?.accountId)) {
      const alreadyImported = Boolean(
        account?.auth?.credentialRef || account?.auth?.kind && account?.credentialRef && !account?.candidateId
      );
      const imported = alreadyImported || typeof entry.module.importAccount !== "function" ? account : await entry.module.importAccount(account, providerContext(this));
      entry.pool.upsert(imported, { resetHealth: true });
      accounts.push(entry.pool.get(imported.accountId));
    }
    return accounts;
  }
  async #saveState(changedProviderIds = null) {
    const write = async () => {
      const changed = changedProviderIds === null ? new Set(this.#entries.keys()) : new Set(changedProviderIds);
      const merge = (latest) => {
        const pools = {
          ...latest?.pools && typeof latest.pools === "object" ? latest.pools : {}
        };
        for (const [providerId, entry] of this.#entries) {
          if (!changed.has(providerId) && Object.hasOwn(pools, providerId)) continue;
          const current = providerStorageSnapshot(entry);
          pools[providerId] = mergeProviderStorage(
            pools[providerId],
            current,
            this.#stateBaselines.get(providerId)
          );
        }
        return { ...latest, pools };
      };
      if (typeof this.stateStore.update === "function") {
        await this.stateStore.update(merge);
      } else {
        const latest = await this.stateStore.load();
        await this.stateStore.save(merge(latest));
      }
      for (const providerId of changed) {
        const entry = this.#entries.get(providerId);
        if (entry) this.#stateBaselines.set(providerId, structuredClone(providerStorageSnapshot(entry)));
      }
    };
    const queued = this.#saveQueue.then(write, write);
    this.#saveQueue = queued.catch(() => {
    });
    await queued;
  }
};

// packages/dsh-plugin/src/codex-transport.mjs
import { access, readFile as readFile7 } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname as dirname5, join as join13, resolve } from "node:path";
import { pathToFileURL } from "node:url";
var activeCodexModels = /* @__PURE__ */ new Map();
function recordCodexModels(models) {
  if (Array.isArray(models)) {
    for (const m of models) {
      if (m?.id) activeCodexModels.set(m.id, m);
    }
  }
}
var DSH_LLM_PI_AI = "@deepseek-ai/dsh-llm-pi-ai";
var PI_AI = "@earendil-works/pi-ai";
var PI_AI_CODEX_API = "@earendil-works/pi-ai/api/openai-codex-responses.lazy";
var PI_AI_CODEX_PROVIDER = "@earendil-works/pi-ai/providers/openai-codex";
var PI_AI_BUILTIN_PROVIDERS = "@earendil-works/pi-ai/providers/all";
async function importBareDependencies() {
  const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }, { openaiCodexProvider }, builtinProviders2] = await Promise.all([
    import(DSH_LLM_PI_AI),
    import(PI_AI),
    import(PI_AI_CODEX_API),
    import(PI_AI_CODEX_PROVIDER),
    import(PI_AI_BUILTIN_PROVIDERS)
  ]);
  return { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider, builtinProviders: builtinProviders2 };
}
function exportTarget(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  for (const condition of ["import", "node", "default"]) {
    const target = exportTarget(value[condition]);
    if (target) return target;
  }
  return null;
}
async function isFile(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function findPackageRoot(startDirectory, packageName) {
  const packageParts = packageName.split("/");
  let current = resolve(startDirectory);
  while (true) {
    const candidate2 = join13(current, "node_modules", ...packageParts);
    if (await isFile(join13(candidate2, "package.json"))) return candidate2;
    const parent = dirname5(current);
    if (parent === current) return null;
    current = parent;
  }
}
async function packageImportUrl(packageRoot, subpath = null) {
  const packageJson = JSON.parse(await readFile7(join13(packageRoot, "package.json"), "utf8"));
  const exports = packageJson.exports;
  let target = null;
  if (!subpath) {
    target = exportTarget(exports?.["."] ?? exports) ?? packageJson.module ?? packageJson.main;
  } else {
    const key = `./${subpath}`;
    target = exportTarget(exports?.[key]);
    if (!target && exports && typeof exports === "object") {
      for (const [pattern, value] of Object.entries(exports)) {
        if (!pattern.includes("*")) continue;
        const prefix = pattern.slice(0, pattern.indexOf("*"));
        const suffix = pattern.slice(pattern.indexOf("*") + 1);
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        target = exportTarget(value)?.replace("*", key.slice(prefix.length, key.length - suffix.length));
        break;
      }
    }
  }
  if (typeof target !== "string") {
    throw new Error(`Cannot resolve ${subpath ?? "."} from ${packageRoot}`);
  }
  return pathToFileURL(join13(packageRoot, target)).href;
}
async function importFromDshInstall(moduleAnchor) {
  const anchor = moduleAnchor ?? process.env.DOCKYARD_DSH_CLI_PATH ?? process.argv[1] ?? import.meta.url;
  const dshRequire = createRequire(anchor);
  const dshLlmPath = dshRequire.resolve(DSH_LLM_PI_AI);
  const dshPackageRoot = dirname5(dirname5(dshLlmPath));
  const piRoot = await findPackageRoot(dshPackageRoot, PI_AI);
  if (!piRoot) throw new Error(`Cannot find ${PI_AI} beside ${DSH_LLM_PI_AI}`);
  const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }, { openaiCodexProvider }, builtinProviders2] = await Promise.all([
    import(pathToFileURL(dshLlmPath).href),
    import(await packageImportUrl(piRoot)),
    import(await packageImportUrl(piRoot, "api/openai-codex-responses.lazy")),
    import(await packageImportUrl(piRoot, "providers/openai-codex")),
    import(await packageImportUrl(piRoot, "providers/all"))
  ]);
  return { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider, builtinProviders: builtinProviders2 };
}
async function loadExecutor(moduleAnchor) {
  let dependencies;
  try {
    dependencies = await importBareDependencies();
  } catch {
    dependencies = await importFromDshInstall(moduleAnchor);
  }
  const { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider } = dependencies;
  const models = openaiCodexProvider().getModels();
  const modelById = new Map(models.map((model) => [model.id, model]));
  return createCodexPiAiExecutor({
    PiAiAdapter,
    createProvider,
    openAICodexResponsesApi,
    modelResolver: (modelId) => modelById.get(modelId) ?? activeCodexModels.get(modelId) ?? null
  });
}
async function loadDependencies(moduleAnchor) {
  try {
    return await importBareDependencies();
  } catch {
    return importFromDshInstall(moduleAnchor);
  }
}
function createCodexDshRequestExecutor({ moduleAnchor = null } = {}) {
  let executorPromise;
  return (envelope2) => {
    executorPromise ??= loadExecutor(moduleAnchor);
    return executorPromise.then((executor) => executor(envelope2));
  };
}
function createPiAiModelRegistryLoader({ moduleAnchor = null } = {}) {
  let registryPromise;
  return async () => {
    registryPromise ??= loadDependencies(moduleAnchor).then(({ builtinProviders: builtinProviders2 }) => {
      if (typeof builtinProviders2?.getBuiltinModels !== "function" || typeof builtinProviders2?.getBuiltinProviders !== "function") return [];
      return builtinProviders2.getBuiltinProviders().flatMap((provider) => builtinProviders2.getBuiltinModels(provider));
    });
    return registryPromise;
  };
}
function createCodexDshCatalogLoader({ moduleAnchor = null, ...options } = {}) {
  let dependenciesPromise;
  const fallbackLoader = async () => {
    dependenciesPromise ??= loadDependencies(moduleAnchor);
    const { openaiCodexProvider } = await dependenciesPromise;
    const models = openaiCodexProvider().getModels();
    return {
      models: models.map(codexModelToDshCatalog),
      source: "dsh_pi_ai_provider_catalog"
    };
  };
  const loader = createCodexCatalogLoader({
    fallbackLoader,
    ...options
  });
  return async (context = {}) => {
    const result = await loader(context);
    recordCodexModels(result?.models);
    return result;
  };
}

// packages/dsh-plugin/src/dockyard-service.mjs
import { spawn as spawn7 } from "node:child_process";
var DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1e3;
var AUTH_POLL_INTERVAL_MS = 750;
var AUTH_URL_WAIT_MS = 2e3;
var POLICY_ALIASES = /* @__PURE__ */ new Map([
  ["manual", ACCOUNT_SELECTION_POLICY.MANUAL],
  ["sticky", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["sticky-session", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["sticky_session", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["round-robin", ACCOUNT_SELECTION_POLICY.ROUND_ROBIN],
  ["round_robin", ACCOUNT_SELECTION_POLICY.ROUND_ROBIN],
  ["failover", ACCOUNT_SELECTION_POLICY.FAILOVER]
]);
function sleep(milliseconds) {
  return new Promise((resolve2) => setTimeout(resolve2, milliseconds));
}
function numericOption2(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function providerName(manifest) {
  return manifest?.displayName ?? manifest?.id ?? "provider";
}
function displayNumber(value, unit = "") {
  if (value === null || value === void 0) return "\u672A\u77E5";
  return `${value}${unit ? ` ${unit}` : ""}`;
}
function displayTime(value) {
  return value ? new Date(value).toLocaleString() : "\u672A\u77E5";
}
function displayQuota(quota) {
  if (!quota) return "\u989D\u5EA6\uFF1A\u672A\u77E5";
  const topLevel = quota.limit === null || quota.limit === void 0 ? displayNumber(quota.remaining, quota.unit) : `${displayNumber(quota.remaining)} / ${displayNumber(quota.limit)}${quota.unit ? ` ${quota.unit}` : ""}`;
  const windows = Array.isArray(quota.windows) ? quota.windows.map((window) => {
    const label = window.name ?? window.id ?? "window";
    const value = window.limit === null || window.limit === void 0 ? displayNumber(window.remaining, window.unit) : `${displayNumber(window.remaining)} / ${displayNumber(window.limit)}${window.unit ? ` ${window.unit}` : ""}`;
    return `${label}: ${value}\uFF0C\u91CD\u7F6E ${displayTime(window.resetAt)}`;
  }) : [];
  return [
    `\u989D\u5EA6\uFF1A${topLevel}`,
    ...windows,
    `\u989D\u5EA6\u66F4\u65B0\u65F6\u95F4\uFF1A${displayTime(quota.updatedAt)}`
  ].join("\uFF1B");
}
function displayAccount(account) {
  const identity = account.email ?? account.displayName ?? account.accountId;
  const plan = account.subscription?.plan ?? "\u8BA2\u9605\u672A\u77E5";
  const health = account.health?.status ?? "unknown";
  const lastChecked = account.health?.lastCheckedAt ?? account.quota?.updatedAt;
  const oauthState = health === "expired" ? "OAuth \u6388\u6743\uFF1A\u9700\u91CD\u65B0\u6388\u6743" : `OAuth token \u6709\u6548\u81F3\uFF1A${displayTime(account.refresh?.accessTokenExpiresAt)}`;
  return [
    `${identity} (${account.accountId})`,
    `\u72B6\u6001\uFF1A${health}`,
    `\u5957\u9910\uFF1A${plan}`,
    `\u8BA2\u9605\u5230\u671F\uFF1A${displayTime(account.subscription?.expiresAt)}`,
    displayQuota(account.quota),
    `\u989D\u5EA6\u68C0\u67E5\uFF1A${displayTime(lastChecked)}`,
    oauthState,
    `OAuth \u4E0B\u6B21\u5237\u65B0\uFF1A${displayTime(account.refresh?.nextRefreshAt)}`
  ].join("\uFF1B");
}
function manifestFor2(runtime, input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) return null;
  const manifests = runtime.listProviderManifests?.() ?? [];
  return manifests.find((manifest) => String(manifest.id).toLowerCase() === value) ?? manifests.find((manifest) => String(manifest.displayName ?? "").toLowerCase() === value) ?? manifests.find((manifest) => String(manifest.id).toLowerCase().endsWith(`-${value}`)) ?? null;
}
function providerIdFor(runtime, input) {
  return manifestFor2(runtime, input)?.id ?? null;
}
function commandTokens(rawInput) {
  return String(rawInput ?? "").trim().split(/\s+/).filter(Boolean);
}
function commandSuccess(text3) {
  return { kind: "success", text: text3 };
}
function commandError(text3) {
  return { kind: "error", text: text3 };
}
function openDefaultBrowser(url) {
  if (process.platform !== "darwin" || !url) return;
  try {
    const child = spawn7("open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
  }
}
var DockyardDshService = class {
  #refreshTimer = null;
  #refreshPromises = /* @__PURE__ */ new Map();
  #started = false;
  #disposed = false;
  #authSessions = /* @__PURE__ */ new Map();
  #authOpened = /* @__PURE__ */ new Set();
  #authStartPromises = /* @__PURE__ */ new Map();
  constructor({
    runtime,
    refreshIntervalMs = numericOption2(process.env.DOCKYARD_DSH_REFRESH_INTERVAL_MS, DEFAULT_REFRESH_INTERVAL_MS),
    autoRefresh = true,
    openBrowser = openDefaultBrowser,
    logger = console,
    notifyAdaptersUpdated = null
  } = {}) {
    if (!runtime) throw new Error("Dockyard DSH service requires a runtime");
    this.runtime = runtime;
    this.refreshIntervalMs = refreshIntervalMs;
    this.autoRefresh = autoRefresh;
    this.openBrowser = openBrowser;
    this.logger = logger;
    this.notifyAdaptersUpdated = notifyAdaptersUpdated;
    this.ready = runtime.init();
  }
  async start() {
    await this.ready;
    if (this.#started || this.#disposed) return this;
    this.#started = true;
    if (this.autoRefresh) {
      this.#refreshTimer = setInterval(() => {
        void this.refresh().catch((error) => this.#warn("scheduled quota refresh failed", error));
      }, this.refreshIntervalMs);
      this.#refreshTimer.unref?.();
    }
    return this;
  }
  async dispose() {
    this.#disposed = true;
    if (this.#refreshTimer) clearInterval(this.#refreshTimer);
    this.#refreshTimer = null;
    this.#refreshPromises.clear();
    this.#authStartPromises.clear();
    for (const { providerId, sessionId, timer } of this.#authSessions.values()) {
      if (timer) clearTimeout(timer);
      await this.runtime.cancelAuthorization(providerId, sessionId).catch(() => {
      });
    }
    this.#authSessions.clear();
    this.#authOpened.clear();
  }
  async snapshot() {
    await this.ready;
    return this.runtime.snapshot();
  }
  async scan(providerInput = null) {
    await this.ready;
    const providerId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
    if (providerInput && !providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const result = await this.runtime.scan(providerId);
    if (!providerInput) return result;
    return {
      ...result,
      providers: result.providers.filter((provider) => provider.providerId === providerId)
    };
  }
  async add(providerInput = null, candidateId = null) {
    const scan = await this.scan(providerInput);
    const imports = [];
    const diagnostics = [];
    for (const provider of scan.providers) {
      const candidates = provider.candidates.filter((candidate2) => !candidate2.imported);
      const selected = candidateId ? candidates.filter((candidate2) => candidate2.candidateId === candidateId) : candidates;
      if (candidateId && selected.length === 0) continue;
      for (const candidate2 of selected) {
        try {
          const imported = await this.runtime.importCandidate(provider.providerId, candidate2.candidateId);
          let refreshed = imported.account;
          try {
            refreshed = (await this.runtime.refreshAccount(provider.providerId, imported.account.accountId, {
              tolerateFailure: true
            })).account;
          } catch (error) {
            diagnostics.push(`${providerName(provider.manifest)} ${candidate2.candidateId} \u5237\u65B0\u5931\u8D25\uFF1A${redactError(error)}`);
          }
          imports.push(refreshed);
        } catch (error) {
          diagnostics.push(`${providerName(provider.manifest)} ${candidate2.candidateId} \u6DFB\u52A0\u5931\u8D25\uFF1A${redactError(error)}`);
        }
      }
    }
    if (candidateId && imports.length === 0 && diagnostics.length === 0) {
      throw new Error(`\u6CA1\u6709\u627E\u5230\u672A\u6DFB\u52A0\u7684 OAuth \u5019\u9009\uFF1A${candidateId}`);
    }
    return { accounts: imports, diagnostics, scan };
  }
  async refresh(providerInput = null) {
    await this.ready;
    const providerId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
    if (providerInput && !providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const refreshKey = providerId ?? "*";
    const existing = this.#refreshPromises.get(refreshKey);
    if (existing) return existing;
    const promise = this.runtime.refreshAll(providerId).finally(() => {
      if (this.#refreshPromises.get(refreshKey) === promise) this.#refreshPromises.delete(refreshKey);
    });
    this.#refreshPromises.set(refreshKey, promise);
    return promise;
  }
  async catalog(providerInput) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    return { providerId, manifest: manifestFor2(this.runtime, providerInput), catalog: await this.runtime.getCatalog(providerId) };
  }
  async setPolicy(providerInput, policyInput, defaultAccountId = void 0) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const policy = POLICY_ALIASES.get(String(policyInput ?? "").toLowerCase());
    if (!policy) throw new Error(`\u672A\u77E5\u8D26\u53F7\u7B56\u7565\uFF1A${policyInput}\uFF1B\u53EF\u7528\u503C\uFF1A${[...new Set(POLICY_ALIASES.values())].join(", ")}`);
    return this.runtime.setPolicy(providerId, policy, defaultAccountId);
  }
  async setDefaultAccount(providerInput, accountId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    return this.runtime.setDefaultAccount(providerId, accountId);
  }
  async removeAccount(providerInput, accountId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    if (!accountId) throw new Error("\u79FB\u9664\u8D26\u53F7\u9700\u8981 accountId");
    return this.runtime.removeAccount(providerId, accountId);
  }
  async getContextWindowOverride(input) {
    await this.ready;
    return this.runtime.getContextWindowOverride(input);
  }
  async setContextWindowOverride(input, value) {
    await this.ready;
    return this.runtime.setContextWindowOverride(input, value);
  }
  async getModelSelection(providerId) {
    await this.ready;
    const catalog = await this.runtime.getCatalog(providerId).catch(() => ({ models: [] }));
    const enabledModelIds = this.runtime.getModelSelection(providerId);
    return {
      providerId,
      models: catalog?.models ?? [],
      enabledModelIds
    };
  }
  async setModelSelection(providerId, enabledModelIds) {
    await this.ready;
    const saved = await this.runtime.setModelSelection(providerId, enabledModelIds);
    try {
      this.notifyAdaptersUpdated?.();
    } catch {
    }
    return {
      providerId,
      enabledModelIds: saved,
      saved: true
    };
  }
  async startAuthorization(providerInput, { openBrowser = true } = {}) {
    await this.ready;
    const manifest = manifestFor2(this.runtime, providerInput);
    if (!manifest) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    if (!manifest.capabilities?.includes("oauth_authorization")) {
      return {
        status: "unsupported",
        providerId: manifest.id,
        instructions: `${providerName(manifest)} \u6CA1\u6709\u72EC\u7ACB\u7684\u5B98\u65B9\u6388\u6743\u5165\u53E3\uFF1B\u8BF7\u5148\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u6216\u5B98\u65B9\u73AF\u5883\u767B\u5F55/\u5207\u6362\u8D26\u53F7\uFF0C\u7136\u540E\u626B\u63CF\u672C\u673A\u767B\u5F55\u6001\uFF0C\u518D\u6DFB\u52A0\u5019\u9009\u3002`
      };
    }
    const existingStart = this.#authStartPromises.get(manifest.id);
    if (existingStart) return existingStart;
    const startPromise = this.#startAuthorization(manifest, { openBrowser });
    const trackedStart = startPromise.finally(() => {
      if (this.#authStartPromises.get(manifest.id) === trackedStart) {
        this.#authStartPromises.delete(manifest.id);
      }
    });
    this.#authStartPromises.set(manifest.id, trackedStart);
    return trackedStart;
  }
  async #startAuthorization(manifest, { openBrowser = true } = {}) {
    const existing = this.#activeAuthSession(manifest.id);
    if (existing) {
      let current;
      try {
        current = await this.pollAuthorization(manifest.id, existing.sessionId);
      } catch (error) {
        current = {
          status: "processing",
          providerId: manifest.id,
          sessionId: existing.sessionId,
          ...existing.authorizationUrl ? { authorizationUrl: existing.authorizationUrl } : {},
          diagnostic: `\u5DF2\u6709\u767B\u5F55\u9A8C\u8BC1\u8FDB\u884C\u4E2D\uFF0C\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u6700\u65B0\u72B6\u6001\uFF1A${redactError(error)}`
        };
      }
      if (current?.status === "completed") return current;
      if (current && ["pending", "processing"].includes(current.status)) {
        this.#scheduleAuthorization(manifest.id, existing.sessionId);
        return {
          ...current,
          instructions: current.instructions ?? "\u5DF2\u6709\u767B\u5F55\u9A8C\u8BC1\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u4F7F\u7528\u5F53\u524D Google \u9875\u9762\uFF1B\u4E0D\u4F1A\u91CD\u590D\u6253\u5F00\u767B\u5F55\u9875\u3002"
        };
      }
    }
    const started = await this.runtime.startAuthorization(manifest.id);
    this.#authSessions.set(started.sessionId, {
      providerId: manifest.id,
      sessionId: started.sessionId,
      status: started.status,
      authorizationUrl: started.authorizationUrl ?? null,
      openBrowser
    });
    const result = await this.#waitForAuthorizationUrl(manifest.id, started, openBrowser);
    const tracked = this.#authSessions.get(started.sessionId);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null
    });
    if (result.status === "pending" || result.status === "processing") this.#scheduleAuthorization(manifest.id, started.sessionId);
    else if (result.status === "completed") {
      this.#authSessions.delete(started.sessionId);
      await this.refresh(manifest.id).catch((error) => this.#warn("post-login quota refresh failed", error));
    }
    return result;
  }
  async pollAuthorization(providerId, sessionId) {
    const tracked = this.#authSessions.get(sessionId);
    const result = await this.runtime.pollAuthorization(providerId, sessionId);
    this.#openAuthorizationUrl(result, tracked?.openBrowser ?? true);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null
    });
    if (result.status === "completed") {
      this.#authSessions.delete(sessionId);
      await this.refresh(providerId).catch((error) => this.#warn("post-login quota refresh failed", error));
    } else if (!["pending", "processing"].includes(result.status)) {
      this.#authSessions.delete(sessionId);
    }
    return result;
  }
  async cancelAuthorization(providerInput, sessionId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput) ?? String(providerInput);
    const tracked = this.#authSessions.get(sessionId);
    if (tracked?.timer) clearTimeout(tracked.timer);
    const result = await this.runtime.cancelAuthorization(providerId, sessionId);
    this.#authSessions.delete(sessionId);
    this.#authOpened.delete(sessionId);
    return result;
  }
  async submitAuthorizationCode(providerInput, sessionId, code) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput) ?? String(providerInput);
    const tracked = this.#authSessions.get(sessionId);
    const result = await this.runtime.submitAuthorizationCode(providerId, sessionId, code);
    this.#openAuthorizationUrl(result, tracked?.openBrowser ?? true);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null
    });
    if (result.status === "pending" || result.status === "processing") this.#scheduleAuthorization(providerId, sessionId);
    else if (result.status === "completed") {
      this.#authSessions.delete(sessionId);
      await this.refresh(providerId).catch((error) => this.#warn("post-login quota refresh failed", error));
    } else if (result.status !== "pending" && result.status !== "processing") {
      this.#authSessions.delete(sessionId);
    }
    return result;
  }
  helpText() {
    const providers = (this.runtime.listProviderManifests?.() ?? []).map((manifest) => `${manifest.id} (${providerName(manifest)})`);
    return [
      "Dockyard DSH \u539F\u751F\u547D\u4EE4\uFF1A",
      "/dockyard status                         \u67E5\u770B\u8D26\u53F7\u3001\u5B9E\u65F6\u989D\u5EA6\u548C\u5237\u65B0\u65F6\u95F4",
      "/dockyard scan [provider]                \u626B\u63CF\u672C\u673A\u5B98\u65B9\u767B\u5F55\u6001",
      "/dockyard add [provider] [candidateId]   \u6DFB\u52A0\u626B\u63CF\u5230\u7684 OAuth \u8D26\u53F7",
      "/dockyard login <provider>               \u542F\u52A8 provider \u5B98\u65B9\u6388\u6743\u6D41\u7A0B\u5E76\u767B\u5F55",
      "/dockyard refresh [provider]             \u5F3A\u5236\u8BFB\u53D6\u5B9E\u65F6\u989D\u5EA6",
      "/dockyard models <provider>              \u8BFB\u53D6 provider \u5B9E\u65F6\u6A21\u578B/\u6863\u4F4D",
      "/dockyard policy <provider> <policy>     \u8BBE\u7F6E manual/sticky_session/round_robin/failover",
      "/dockyard use <provider> <accountId>      \u624B\u52A8\u6307\u5B9A\u8D26\u53F7",
      "/dockyard remove <provider> <accountId>   \u4ECE\u8D26\u53F7\u6C60\u79FB\u9664\u8D26\u53F7\u5E76\u6E05\u7406\u672C\u673A Keychain \u5F15\u7528",
      "/dockyard cancel <provider> <sessionId>  \u53D6\u6D88 OAuth \u767B\u5F55",
      `\u5F53\u524D providers\uFF1A${providers.length ? providers.join("\u3001") : "\u6682\u65E0"}`
    ].join("\n");
  }
  #openAuthorizationUrl(result, openBrowser = true) {
    if (!openBrowser || !result?.authorizationUrl || this.#authOpened.has(result.sessionId)) return;
    this.#authOpened.add(result.sessionId);
    if (result.browserOpened) return;
    void Promise.resolve(this.openBrowser(result.authorizationUrl)).catch((error) => {
      this.#warn("could not open authorization URL", error);
    });
  }
  #activeAuthSession(providerId) {
    return [...this.#authSessions.values()].find((session) => session.providerId === providerId && ["pending", "processing"].includes(session.status ?? "pending")) ?? null;
  }
  async #waitForAuthorizationUrl(providerId, started, openBrowser = true) {
    this.#openAuthorizationUrl(started, openBrowser);
    if (started.authorizationUrl || !["pending", "processing"].includes(started.status)) return started;
    const deadline = Date.now() + AUTH_URL_WAIT_MS;
    let result = started;
    while (Date.now() < deadline && ["pending", "processing"].includes(result.status)) {
      await sleep(100);
      result = await this.runtime.pollAuthorization(providerId, started.sessionId);
      this.#openAuthorizationUrl(result, openBrowser);
    }
    return result;
  }
  #scheduleAuthorization(providerId, sessionId) {
    const current = this.#authSessions.get(sessionId);
    if (!current || current.timer) return;
    current.timer = setTimeout(async () => {
      current.timer = null;
      if (this.#disposed) return;
      try {
        const result = await this.pollAuthorization(providerId, sessionId);
        if (["pending", "processing"].includes(result.status)) this.#scheduleAuthorization(providerId, sessionId);
      } catch (error) {
        this.#authSessions.delete(sessionId);
        this.#warn("OAuth authorization polling failed", error);
      }
    }, AUTH_POLL_INTERVAL_MS);
    current.timer.unref?.();
  }
  #warn(message, error) {
    this.logger?.warn?.(`[dockyard-dsh] ${message}: ${redactError(error)}`);
  }
};
function createDockyardCommand(service) {
  return {
    name: "dockyard",
    description: "Manage Dockyard DSH providers, OAuth accounts, quotas, models, and account selection",
    input: { hint: "status | scan | add | login | refresh | models | policy | use | cancel" },
    handler: async ({ rawInput, signal }) => {
      if (signal?.aborted) return commandError("Dockyard \u547D\u4EE4\u5DF2\u53D6\u6D88\u3002");
      const [verb = "help", ...args] = commandTokens(rawInput);
      try {
        switch (verb.toLowerCase()) {
          case "help":
            return commandSuccess(service.helpText());
          case "status": {
            const snapshot = await service.snapshot();
            const lines = ["Dockyard DSH \u72B6\u6001", `\u66F4\u65B0\u65F6\u95F4\uFF1A${displayTime(snapshot.generatedAt)}`];
            for (const provider of snapshot.providers ?? []) {
              lines.push(`
${providerName(provider.manifest)} [${provider.providerId}]`);
              lines.push(`\u7B56\u7565\uFF1A${provider.policy}\uFF1B\u5F53\u524D\u8D26\u53F7\uFF1A${provider.defaultAccountId ?? "\u8DDF\u968F\u7B56\u7565"}`);
              if (!provider.accounts?.length) lines.push("\u6682\u65E0\u5DF2\u6DFB\u52A0\u8D26\u53F7");
              for (const account of provider.accounts ?? []) lines.push(`- ${displayAccount(account)}`);
            }
            return commandSuccess(lines.join("\n"));
          }
          case "scan": {
            const result = await service.scan(args[0] ?? null);
            const lines = ["\u672C\u673A OAuth \u767B\u5F55\u6001\u626B\u63CF\u7ED3\u679C\uFF1A"];
            for (const provider of result.providers ?? []) {
              lines.push(`
${providerName(provider.manifest)} [${provider.providerId}]`);
              if (!provider.candidates?.length) lines.push(`\u672A\u53D1\u73B0\uFF1A${provider.diagnostics?.join("\uFF1B") || "provider \u672A\u8FD4\u56DE\u5019\u9009"}`);
              for (const candidate2 of provider.candidates ?? []) {
                lines.push(`- ${candidate2.imported ? "\u5DF2\u6DFB\u52A0" : "\u53EF\u6DFB\u52A0"} ${candidate2.candidateId}\uFF1A${candidate2.email ?? candidate2.displayName ?? candidate2.accountId}`);
              }
            }
            return commandSuccess(lines.join("\n"));
          }
          case "add": {
            const result = await service.add(args[0] ?? null, args[1] ?? null);
            const lines = [`\u5DF2\u6DFB\u52A0\u8D26\u53F7\uFF1A${result.accounts.length}`];
            for (const account of result.accounts) lines.push(`- ${account.email ?? account.displayName ?? account.accountId}`);
            if (!result.accounts.length) lines.push("\u6CA1\u6709\u65B0\u7684 OAuth \u5019\u9009\uFF1B\u5148\u6267\u884C /dockyard scan \u67E5\u770B\u672C\u673A\u767B\u5F55\u6001\u3002");
            if (result.diagnostics.length) lines.push(`\u8BCA\u65AD\uFF1A${result.diagnostics.join("\uFF1B")}`);
            return commandSuccess(lines.join("\n"));
          }
          case "login": {
            if (!args[0]) return commandError("\u7528\u6CD5\uFF1A/dockyard login <provider>");
            const result = await service.startAuthorization(args[0]);
            if (["unsupported", "opened", "failed"].includes(result.status)) {
              return result.status === "failed" ? commandError(result.diagnostic ?? result.instructions) : commandSuccess(result.instructions);
            }
            const lines = [`OAuth \u72B6\u6001\uFF1A${result.status}`, `\u4F1A\u8BDD\uFF1A${result.sessionId}`];
            if (result.authorizationUrl) lines.push(`\u5B98\u65B9\u6388\u6743\u9875\uFF1A${result.authorizationUrl}`);
            if (result.instructions) lines.push(result.instructions);
            if (result.diagnostic) lines.push(`\u8BCA\u65AD\uFF1A${result.diagnostic}`);
            return commandSuccess(lines.join("\n"));
          }
          case "refresh": {
            const results = await service.refresh(args[0] ?? null);
            const lines = [`\u5DF2\u5237\u65B0\u8D26\u53F7\uFF1A${results.length}`];
            for (const result of results) {
              const account = result.account;
              lines.push(`- ${account?.providerId ?? "provider"}/${account?.email ?? account?.accountId ?? "unknown"}\uFF1A${result.diagnostics?.join("\uFF1B") || "\u6210\u529F"}`);
            }
            return commandSuccess(lines.join("\n"));
          }
          case "models": {
            if (!args[0]) return commandError("\u7528\u6CD5\uFF1A/dockyard models <provider>");
            const { providerId, manifest, catalog } = await service.catalog(args[0]);
            const lines = [`${providerName(manifest)} [${providerId}] \u5B9E\u65F6\u6A21\u578B\u76EE\u5F55\uFF1A`];
            for (const model of catalog.models ?? []) {
              const efforts = model.reasoning?.efforts?.map((effort) => effort.id).join(", ");
              lines.push(`- ${model.id}${model.name && model.name !== model.id ? `\uFF1A${model.name}` : ""}${efforts ? `\uFF1B\u6863\u4F4D\uFF1A${efforts}` : ""}`);
            }
            if (!(catalog.models ?? []).length) lines.push("provider \u5F53\u524D\u6CA1\u6709\u8FD4\u56DE\u6A21\u578B\u3002");
            return commandSuccess(lines.join("\n"));
          }
          case "policy": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard policy <provider> <manual|sticky_session|round_robin|failover> [accountId]");
            const result = await service.setPolicy(args[0], args[1], args[2]);
            return commandSuccess(`\u5DF2\u8BBE\u7F6E ${result.providerId} \u7B56\u7565\u4E3A ${result.policy}\uFF1B\u9ED8\u8BA4\u8D26\u53F7\uFF1A${result.defaultAccountId ?? "\u8DDF\u968F\u7B56\u7565"}`);
          }
          case "use": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard use <provider> <accountId>");
            const result = await service.setDefaultAccount(args[0], args[1]);
            return commandSuccess(`\u5DF2\u5C06 ${result.providerId} \u5F53\u524D\u8D26\u53F7\u8BBE\u4E3A ${result.defaultAccountId}`);
          }
          case "remove": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard remove <provider> <accountId>");
            const result = await service.removeAccount(args[0], args[1]);
            const diagnostic = result.diagnostics?.length ? `\uFF1B${result.diagnostics.join("\uFF1B")}` : "";
            return commandSuccess(`\u5DF2\u79FB\u9664 ${result.providerId}/${result.accountId}\uFF1B\u5F53\u524D\u8D26\u53F7\uFF1A${result.defaultAccountId ?? "\u8DDF\u968F\u7B56\u7565"}${diagnostic}`);
          }
          case "cancel": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard cancel <provider> <sessionId>");
            const result = await service.cancelAuthorization(args[0], args[1]);
            return commandSuccess(`OAuth \u4F1A\u8BDD ${result.sessionId}\uFF1A${result.status}`);
          }
          default:
            return commandError(`\u672A\u77E5 Dockyard \u5B50\u547D\u4EE4\uFF1A${verb}

${service.helpText()}`);
        }
      } catch (error) {
        return commandError(`Dockyard \u547D\u4EE4\u5931\u8D25\uFF1A${redactError(error)}`);
      }
    }
  };
}
var dockyardDshConstants = Object.freeze({
  defaultRefreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  authPollIntervalMs: AUTH_POLL_INTERVAL_MS
});

// packages/dsh-plugin/src/dockyard-credential-store.mjs
import { createHash as createHash9 } from "node:crypto";
function dshCredentialRef(ref) {
  const digest = createHash9("sha256").update(String(ref)).digest("hex");
  return `DOCKYARD_DSH_${digest}`;
}
function parseCredential(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("DSH Credentials \u4E2D\u7684 Dockyard \u51ED\u8BC1\u683C\u5F0F\u65E0\u6548");
  }
}
function createDockyardCredentialStore(credentials, fallback = null) {
  const usable = credentials && typeof credentials.resolve === "function" && typeof credentials.set === "function" && typeof credentials.unset === "function";
  return {
    async read(ref) {
      if (usable) {
        const resolved = await credentials.resolve(dshCredentialRef(ref));
        const parsed = parseCredential(resolved?.value);
        if (parsed !== null) return parsed;
      }
      return typeof fallback?.read === "function" ? fallback.read(ref) : null;
    },
    async write(ref, value) {
      if (usable) {
        await credentials.set(dshCredentialRef(ref), JSON.stringify(value));
        return ref;
      }
      if (typeof fallback?.write !== "function") throw new Error("DSH Credentials \u5C1A\u672A\u5C31\u7EEA");
      return fallback.write(ref, value);
    },
    async delete(ref) {
      if (usable) await credentials.unset(dshCredentialRef(ref));
      if (typeof fallback?.delete === "function") await fallback.delete(ref);
    }
  };
}

// packages/dsh-plugin/src/native-key-pool-host.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import { isAgentLoopRequest, markAgentLoopRequest } from "@deepseek-ai/dsh-llm";
import { join as join14 } from "node:path";

// packages/dsh-plugin/src/native-usage.mjs
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
var builtinBaseUrls = /* @__PURE__ */ new Map();
for (const provider of builtinProviders()) {
  if (typeof provider?.id === "string" && typeof provider?.baseUrl === "string") {
    builtinBaseUrls.set(provider.id, provider.baseUrl);
  }
}
function baseUrlFor(providerId, profile) {
  const configured = typeof profile?.baseURL === "string" ? profile.baseURL.trim() : "";
  const baseUrl = configured || builtinBaseUrls.get(providerId) || null;
  return baseUrl ? validateNativeEndpoint(baseUrl, { providerId }) : null;
}
function endpoint(baseUrl, path) {
  if (!baseUrl) throw new Error("provider \u6CA1\u6709\u8FD4\u56DE\u53EF\u7528\u7684 base URL");
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), base).toString();
}
async function readJson2(response) {
  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = typeof body?.error === "string" ? body.error : body?.error?.message ?? body?.message ?? response.statusText;
    throw new Error(`${response.status} ${detail || "provider usage \u8BF7\u6C42\u5931\u8D25"}`);
  }
  if (!body || typeof body !== "object") throw new Error("provider usage \u8FD4\u56DE\u4E86\u65E0\u6548 JSON");
  return body;
}
function bearerHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
}
function updatedAt() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function deepseekBalanceModule() {
  return {
    id: "deepseek-balance",
    supports: ["deepseek", "deepseek-official"],
    async fetch({ providerId, profile, apiKey, signal }) {
      const body = await readJson2(await fetch(endpoint(baseUrlFor(providerId, profile), "user/balance"), {
        method: "GET",
        headers: bearerHeaders(apiKey),
        signal
      }));
      const refreshedAt = updatedAt();
      const balances = Array.isArray(body.balance_infos) ? body.balance_infos : [];
      return {
        status: "ok",
        source: "DeepSeek /user/balance",
        updatedAt: refreshedAt,
        available: body.is_available === true,
        quota: {
          windows: balances.map((balance) => ({
            id: `balance-${balance.currency ?? "unknown"}`,
            name: "\u8D26\u6237\u4F59\u989D",
            kind: "balance",
            remaining: typeof balance.total_balance === "string" || typeof balance.total_balance === "number" ? balance.total_balance : null,
            limit: null,
            unit: balance.currency ?? null,
            resetAt: null,
            updatedAt: refreshedAt
          }))
        },
        details: balances.map((balance) => ({
          currency: balance.currency ?? null,
          totalBalance: balance.total_balance ?? null,
          grantedBalance: balance.granted_balance ?? null,
          toppedUpBalance: balance.topped_up_balance ?? null
        }))
      };
    }
  };
}
function openRouterCreditsModule() {
  return {
    id: "openrouter-credits",
    supports: ["openrouter"],
    async fetch({ providerId, profile, apiKey, signal }) {
      const body = await readJson2(await fetch(endpoint(baseUrlFor(providerId, profile), "credits"), {
        method: "GET",
        headers: bearerHeaders(apiKey),
        signal
      }));
      const data = body.data ?? body;
      const total = typeof data.total_credits === "number" ? data.total_credits : null;
      const used = typeof data.total_usage === "number" ? data.total_usage : null;
      const refreshedAt = updatedAt();
      return {
        status: "ok",
        source: "OpenRouter /api/v1/credits",
        updatedAt: refreshedAt,
        quota: {
          windows: [{
            id: "credits",
            name: "\u5269\u4F59 credits",
            kind: "balance",
            remaining: total !== null && used !== null ? total - used : null,
            limit: total,
            unit: "USD",
            resetAt: null,
            updatedAt: refreshedAt
          }]
        },
        details: { totalCredits: total, totalUsage: used }
      };
    }
  };
}
function unsupportedModule(providerIds, message, helpUrl = null) {
  return {
    id: `unsupported-${providerIds.join("-")}`,
    supports: providerIds,
    async fetch({ providerId }) {
      return {
        status: "unsupported",
        source: "provider official API",
        providerId,
        message,
        ...helpUrl ? { helpUrl } : {},
        updatedAt: updatedAt()
      };
    }
  };
}
var MODULES = [
  deepseekBalanceModule(),
  openRouterCreditsModule(),
  unsupportedModule(
    ["opencode", "opencode-go"],
    "OpenCode \u5B98\u65B9\u76EE\u524D\u516C\u5F00\u6A21\u578B\u76EE\u5F55\u548C\u63A7\u5236\u53F0\u7528\u91CF\uFF0C\u6CA1\u6709\u516C\u5F00\u7ED9 API Key \u8C03\u7528\u7684\u5B9E\u65F6\u4F59\u989D/\u989D\u5EA6\u63A5\u53E3\u3002",
    "https://opencode.ai/zen"
  )
];
var modulesByProvider = /* @__PURE__ */ new Map();
for (const module of MODULES) {
  for (const providerId of module.supports) modulesByProvider.set(providerId, module);
}
var genericUnsupported = unsupportedModule([], "\u8BE5 provider \u5F53\u524D\u6CA1\u6709\u53EF\u9A8C\u8BC1\u7684\u5B98\u65B9\u4F59\u989D/\u989D\u5EA6\u63A5\u53E3\uFF1B\u4E0D\u4F1A\u7528\u8BF7\u6C42\u6B21\u6570\u6216\u56FA\u5B9A\u767E\u5206\u6BD4\u66FF\u4EE3\u3002", null);
function usageModuleFor(providerId) {
  return modulesByProvider.get(providerId) ?? genericUnsupported;
}

// packages/dsh-plugin/src/native-key-pool-host.mjs
var POLICIES = /* @__PURE__ */ new Set(["manual", "round_robin", "failover"]);
var PATCH_MARK = Symbol("dockyard-native-key-pool");
var VISIBLE_STREAM_CHUNKS = /* @__PURE__ */ new Set(["text-delta", "reasoning-delta", "tool-call-delta"]);
function retryableStreamError(error) {
  if (!error || typeof error !== "object") return false;
  const statuses = [error.status, error.upstreamStatus, error.upstreamCode].map((value) => Number(value)).filter((value) => Number.isFinite(value));
  return Boolean(
    error.rateLimited || error.quotaExhausted || error.authExpired || error.authForbidden || statuses.some((status) => [401, 403, 429].includes(status))
  );
}
var NON_RETRYABLE_FAILURE_STATUSES = /* @__PURE__ */ new Set([400, 404, 405, 413, 422]);
var NON_RETRYABLE_FAILURE_CODES = /INVALID_ARGUMENT|BAD_REQUEST|UNSUPPORTED|NOT_FOUND|CONTEXT_LENGTH|PAYLOAD/i;
function nonRetryableStreamFailure(failure) {
  if (!failure || typeof failure !== "object") return false;
  const statuses = [failure.status, failure.upstreamStatus].map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (statuses.some((status) => NON_RETRYABLE_FAILURE_STATUSES.has(status))) return true;
  const codes = [failure.code, failure.upstreamCode].filter((value) => typeof value === "string");
  return codes.some((code) => NON_RETRYABLE_FAILURE_CODES.test(code));
}
function text2(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function applyContextWindowOverride(request, contextWindow) {
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) return request;
  const next = {
    ...request,
    modelContext: {
      ...request?.modelContext ?? {},
      contextWindow
    }
  };
  if (isAgentLoopRequest(request)) markAgentLoopRequest(next);
  return next;
}
function applyModelContextWindow(model, contextWindow) {
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0 || !model || typeof model !== "object") return model;
  return {
    ...model,
    context: {
      ...model.context ?? {},
      contextWindow
    },
    // dsh-llm-pi-ai keeps its internal resolved model in this flat shape.
    // Preserve it as well so its stream-side overflow classification uses the
    // same effective capacity as the durable DSH request/context event.
    ...Number.isInteger(model.contextWindow) ? { contextWindow } : {}
  };
}
async function* iterateWithContext(storage, state, next) {
  const output = await storage.run(state, () => next());
  const iterator = await storage.run(state, () => {
    if (output?.[Symbol.asyncIterator]) return output[Symbol.asyncIterator]();
    if (output?.[Symbol.iterator]) return output[Symbol.iterator]();
    return null;
  });
  if (!iterator) return;
  try {
    while (true) {
      const result = await storage.run(state, () => iterator.next());
      if (result.done) return;
      yield result.value;
    }
  } finally {
    await storage.run(state, () => iterator.return?.());
  }
}
function pathValue(source, path = []) {
  let current = source;
  for (const segment of path) {
    if (!current || typeof current !== "object") return void 0;
    current = current[segment];
  }
  return current;
}
function cleanRecord(raw) {
  const keys = Array.isArray(raw?.keys) ? raw.keys.filter((entry) => text2(entry?.ref)).map((entry) => ({
    ref: text2(entry.ref),
    label: text2(entry.label) ?? text2(entry.ref),
    createdAt: text2(entry.createdAt)
  })) : [];
  return {
    policy: POLICIES.has(raw?.policy) ? raw.policy : "manual",
    keys
  };
}
function publicCredential(info) {
  if (!info || typeof info !== "object") return { configured: false };
  return {
    configured: info.configured === true,
    ...typeof info.source === "string" ? { source: info.source } : {},
    ...typeof info.writable === "boolean" ? { writable: info.writable } : {}
  };
}
function failureMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "\u672A\u77E5\u9519\u8BEF");
}
function nativeProfile(ctx, providerId) {
  const hasGetter = typeof ctx?.get === "function";
  const llm = hasGetter ? ctx.get("llm") : ctx.llm;
  const settings = hasGetter ? ctx.get("settings") : ctx.settings;
  const entry = llm?.listConfigurableProviders?.().find((candidate2) => candidate2.provider === providerId) ?? null;
  const profile = entry && settings?.get ? pathValue(settings.get(entry.settingsNs), entry.settingsPath) : null;
  if (!entry || !profile || typeof profile !== "object") return { entry, profile: null };
  const native = entry.settingsNs === "llm-pi-ai" || text2(profile.apiKeyEnv) !== null;
  return { entry, profile: native ? profile : null };
}
var NativeKeyPoolHost = class {
  ctx;
  credentials;
  settings;
  llm;
  logger;
  stateStore;
  contextWindowOverrides;
  records = /* @__PURE__ */ new Map();
  cursors = /* @__PURE__ */ new Map();
  #requestContext = new AsyncLocalStorage();
  #contextOverrideRequests = /* @__PURE__ */ new WeakSet();
  patches = [];
  offAdapters = null;
  offStreams = null;
  readyPromise;
  constructor(ctx, { logger = null, stateStore = null, contextWindowOverrides = null } = {}) {
    this.ctx = ctx;
    this.credentials = null;
    this.settings = null;
    this.llm = null;
    this.logger = logger ?? console;
    this.contextWindowOverrides = contextWindowOverrides;
    this.stateStore = stateStore ?? new JsonStateStore({
      filePath: join14(defaultDockyardHome(), "native-key-pools.json")
    });
    this.readyPromise = this.loadState();
  }
  resolveServices() {
    const get = (name2) => {
      try {
        if (typeof this.ctx?.get === "function") return this.ctx.get(name2);
        return this.ctx?.[name2];
      } catch {
        return null;
      }
    };
    this.credentials = get("credentials");
    this.settings = get("settings");
    this.llm = get("llm");
  }
  async loadState() {
    try {
      const state = await this.stateStore.load();
      const providers = state?.nativeKeyPools;
      if (providers && typeof providers === "object") {
        for (const [providerId, record] of Object.entries(providers)) {
          this.records.set(providerId, cleanRecord(record));
        }
      }
    } catch (error) {
      this.logger.warn?.(`native Key \u6C60\u72B6\u6001\u8BFB\u53D6\u5931\u8D25\uFF1A${failureMessage(error)}`);
    }
    return this;
  }
  async saveState() {
    const nativeKeyPools = Object.fromEntries([...this.records].map(([providerId, record]) => [
      providerId,
      cleanRecord(record)
    ]));
    await this.stateStore.save({ nativeKeyPools });
  }
  async start() {
    await this.readyPromise;
    await this.contextWindowOverrides?.ready?.();
    this.resolveServices();
    this.patchAdapters();
    if (typeof this.ctx.on === "function") {
      this.offAdapters = this.ctx.on("llm/adapters-updated", () => this.patchAdapters());
      this.offStreams = this.ctx.on("llm/stream", (options, next) => this.stream(options, next));
    }
    this.patchAdapters();
    return this;
  }
  dispose() {
    this.offAdapters?.();
    this.offStreams?.();
    this.offAdapters = null;
    this.offStreams = null;
    for (const patch of this.patches.splice(0)) {
      if (patch.config?.resolveApiKey?.[PATCH_MARK] === patch.wrapper) {
        patch.config.resolveApiKey = patch.original;
      }
      if (patch.target?.[patch.method]?.[PATCH_MARK] === patch.wrapper) {
        patch.target[patch.method] = patch.original;
      }
    }
  }
  contextWindowForModel(providerId, modelId) {
    if (!text2(providerId) || !text2(modelId) || !this.contextWindowOverrides?.hasAny?.(providerId, modelId)) return null;
    const profile = nativeProfile(this.ctx, providerId).profile;
    const keyRef = text2(profile?.apiKeyEnv);
    return this.contextWindowOverrides.resolve(providerId, modelId, {
      ...keyRef ? { keyRef } : {}
    });
  }
  patchAdapterMethod(adapter, method, transform) {
    const original = adapter?.[method];
    if (typeof original !== "function" || original?.[PATCH_MARK]) return;
    const wrapper = transform(original);
    Object.defineProperty(wrapper, PATCH_MARK, { value: wrapper });
    adapter[method] = wrapper;
    this.patches.push({ target: adapter, method, original, wrapper });
  }
  patchAdapters() {
    const adapters = this.llm?.adapters;
    if (!adapters || typeof adapters.values !== "function") return;
    const thisHost = this;
    for (const registration of adapters.values()) {
      const adapter = registration?.adapter;
      const config = adapter?.config;
      const original = config?.resolveApiKey;
      if (!config || typeof original !== "function" || original?.[PATCH_MARK]) continue;
      const directConnectionResolver = typeof config.options === "function" && typeof config.resolveUserId === "function";
      const wrapper = directConnectionResolver ? async (connection) => this.resolveDirectApiKey(connection, original) : async (providerId, profile) => this.resolveApiKey(providerId, profile, original);
      Object.defineProperty(wrapper, PATCH_MARK, { value: wrapper });
      config.resolveApiKey = wrapper;
      this.patches.push({ config, original, wrapper });
      this.patchAdapterMethod(adapter, "modelOf", (modelOf) => function(...args) {
        const model = modelOf.apply(this, args);
        const contextWindow = thisHost.contextWindowForModel(args[1], args[2]);
        return applyModelContextWindow(model, contextWindow);
      });
      this.patchAdapterMethod(adapter, "resolveModel", (resolveModel) => async function(...args) {
        const model = await resolveModel.apply(this, args);
        const contextWindow = thisHost.contextWindowForModel(args[0], args[1]);
        return applyModelContextWindow(model, contextWindow);
      });
      this.patchAdapterMethod(adapter, "prepareCall", (prepareCall) => async function(...args) {
        const prepared = await prepareCall.apply(this, args);
        const contextWindow = thisHost.contextWindowForModel(args[0], args[1]);
        if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0 || !prepared || typeof prepared !== "object") return prepared;
        return {
          ...prepared,
          model: applyModelContextWindow(prepared.model, contextWindow)
        };
      });
    }
  }
  record(providerId) {
    let record = this.records.get(providerId);
    if (!record) {
      record = cleanRecord({});
      this.records.set(providerId, record);
    }
    return record;
  }
  async syncProvider(providerId, profileHint = null) {
    await this.readyPromise;
    const profile = profileHint ?? nativeProfile(this.ctx, providerId).profile;
    const activeRef = text2(profile?.apiKeyEnv);
    if (!activeRef) return { profile, activeRef: null, record: this.record(providerId) };
    const record = this.record(providerId);
    if (!record.keys.some((entry) => entry.ref === activeRef)) {
      record.keys.push({ ref: activeRef, label: "\u5F53\u524D DSH Key", createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      await this.saveState();
    }
    return { profile, activeRef, record };
  }
  async register(providerId, ref, label = "") {
    const keyRef = text2(ref);
    if (!text2(providerId) || !keyRef) throw new Error("provider \u548C Key \u5F15\u7528\u4E0D\u80FD\u4E3A\u7A7A");
    const { record } = await this.syncProvider(providerId);
    const current = record.keys.find((entry) => entry.ref === keyRef);
    if (current) {
      current.label = text2(label) ?? current.label;
    } else {
      record.keys.push({ ref: keyRef, label: text2(label) ?? `Key ${record.keys.length + 1}`, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
    await this.saveState();
    return this.status(providerId);
  }
  async unregister(providerId, ref) {
    const record = this.record(providerId);
    record.keys = record.keys.filter((entry) => entry.ref !== ref);
    await this.saveState();
    return this.status(providerId);
  }
  async setPolicy(providerId, policy) {
    if (!POLICIES.has(policy)) throw new Error(`\u4E0D\u652F\u6301\u7684 Key \u7B56\u7565\uFF1A${policy}`);
    const record = this.record(providerId);
    record.policy = policy;
    this.cursors.delete(providerId);
    await this.saveState();
    return this.status(providerId);
  }
  async credentialInfo(ref) {
    try {
      if (typeof this.credentials?.describe !== "function") return { configured: false };
      return publicCredential(await this.credentials.describe(ref));
    } catch (error) {
      return { configured: false, error: failureMessage(error) };
    }
  }
  async configuredKeys(record) {
    const rows = [];
    for (const entry of record.keys) {
      const credential = await this.credentialInfo(entry.ref);
      rows.push({ ...entry, configured: credential.configured, credential });
    }
    return rows;
  }
  async status(providerId) {
    const synced = await this.syncProvider(providerId);
    const rows = await this.configuredKeys(synced.record);
    return {
      providerId,
      policy: synced.record.policy,
      activeRef: synced.activeRef,
      runtimeMode: this.patches.length > 0 ? "request-key-pool" : "native-single-key",
      keys: rows.map((entry) => ({ ...entry, active: entry.ref === synced.activeRef })),
      quota: null,
      usage: null
    };
  }
  async pickKey(providerId, record, activeRef, { excluded = [] } = {}) {
    const candidates = [];
    for (const entry of record.keys) {
      const credential = await this.credentialInfo(entry.ref);
      if (credential.configured) candidates.push(entry);
    }
    if (candidates.length === 0) return null;
    const excludedSet = new Set(excluded);
    const available = candidates.filter((entry) => !excludedSet.has(entry.ref));
    const pool = available.length > 0 ? available : candidates;
    const policy = record.policy;
    if (policy === "manual") {
      return pool.find((entry) => entry.ref === activeRef) ?? pool[0];
    }
    if (policy === "failover") {
      return pool.find((entry) => entry.ref === activeRef) ?? pool[0];
    }
    const cursor = this.cursors.get(providerId) ?? 0;
    const chosen = pool[cursor % pool.length];
    this.cursors.set(providerId, (cursor + 1) % pool.length);
    return chosen;
  }
  async prepareContextWindow(options, requestState) {
    const providerId = text2(options?.provider);
    const modelId = text2(options?.model);
    if (!providerId || !modelId || !this.contextWindowOverrides?.hasAny?.(providerId, modelId)) return options;
    const profile = nativeProfile(this.ctx, providerId).profile;
    const synced = await this.syncProvider(providerId, profile);
    let chosen = null;
    if (synced.profile && synced.activeRef && typeof this.credentials?.resolve === "function") {
      chosen = await this.pickKey(providerId, synced.record, synced.activeRef, {
        excluded: [...requestState?.excluded ?? []]
      });
      if (chosen) requestState.preselectedKeyRef = chosen.ref;
    }
    const contextWindow = this.contextWindowOverrides.resolve(providerId, modelId, {
      ...chosen?.ref ? { keyRef: chosen.ref } : {}
    });
    return applyContextWindowOverride(options, contextWindow);
  }
  async *streamWithContextWindow(options, next, requestState) {
    requestState.preselectedKeyRef = null;
    const prepared = await this.prepareContextWindow(options, requestState);
    if (prepared === options || typeof this.llm?.stream !== "function") {
      yield* next();
      return;
    }
    this.#contextOverrideRequests.add(prepared);
    try {
      yield* iterateWithContext(this.#requestContext, requestState, () => this.llm.stream(prepared));
    } finally {
      this.#contextOverrideRequests.delete(prepared);
    }
  }
  async resolveApiKey(providerId, profile, original) {
    const synced = await this.syncProvider(providerId, profile);
    if (!synced.profile || !synced.activeRef || synced.record.policy === "manual" || typeof this.credentials?.resolve !== "function") {
      return original(providerId, profile);
    }
    const requestState = this.#requestContext.getStore();
    const excluded = [...requestState?.excluded ?? []];
    const forced = text2(requestState?.preselectedKeyRef);
    const chosen = forced ? synced.record.keys.find((entry) => entry.ref === forced) ?? await this.pickKey(providerId, synced.record, synced.activeRef, { excluded }) : await this.pickKey(providerId, synced.record, synced.activeRef, { excluded });
    if (!chosen) return original(providerId, profile);
    if (synced.record.policy === "failover" && requestState) requestState.lastResolvedKey = chosen.ref;
    const resolved = await this.credentials.resolve(chosen.ref);
    const value = text2(resolved?.value);
    if (value) return value;
    return original(providerId, profile);
  }
  async resolveDirectApiKey(connection, original) {
    const providerId = "deepseek-official";
    const synced = await this.syncProvider(providerId, connection);
    if (!synced.profile || !synced.activeRef || synced.record.policy === "manual" || typeof this.credentials?.resolve !== "function") {
      return original(connection);
    }
    const requestState = this.#requestContext.getStore();
    const excluded = [...requestState?.excluded ?? []];
    const forced = text2(requestState?.preselectedKeyRef);
    const chosen = forced ? synced.record.keys.find((entry) => entry.ref === forced) ?? await this.pickKey(providerId, synced.record, synced.activeRef, { excluded }) : await this.pickKey(providerId, synced.record, synced.activeRef, { excluded });
    if (!chosen) return original(connection);
    if (synced.record.policy === "failover" && requestState) requestState.lastResolvedKey = chosen.ref;
    const resolved = await this.credentials.resolve(chosen.ref);
    const value = text2(resolved?.value);
    if (value) return value;
    return original(connection);
  }
  shouldRetry(providerId) {
    const record = this.records.get(providerId);
    return record?.policy === "failover" && record.keys.length > 1;
  }
  async *stream(options, next) {
    if (typeof next !== "function") return;
    if (this.#contextOverrideRequests.delete(options)) {
      yield* next();
      return;
    }
    const requestState = { excluded: /* @__PURE__ */ new Set(), lastResolvedKey: null };
    if (!this.shouldRetry(options?.provider)) {
      yield* iterateWithContext(this.#requestContext, requestState, async () => {
        return this.streamWithContextWindow(options, next, requestState);
      });
      return;
    }
    const configured = await this.configuredKeys(this.records.get(options.provider));
    const attempts = Math.max(1, configured.filter((entry) => entry.configured).length);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0 && requestState.lastResolvedKey) {
        requestState.excluded.add(requestState.lastResolvedKey);
      }
      const buffered = [];
      let emitted = false;
      let retryable = false;
      try {
        const output = iterateWithContext(this.#requestContext, requestState, async () => {
          return this.streamWithContextWindow(options, next, requestState);
        });
        for await (const chunk of output) {
          if (VISIBLE_STREAM_CHUNKS.has(chunk?.type)) emitted = true;
          if (!emitted) buffered.push(chunk);
          else if (buffered.length > 0) {
            yield* buffered.splice(0);
            yield chunk;
          } else yield chunk;
          if (chunk?.type === "finish" && chunk.reason?.kind === "error") {
            retryable = !emitted && !nonRetryableStreamFailure(chunk.reason.failure);
            if (retryable && attempt + 1 < attempts) break;
          }
        }
      } catch (error) {
        retryable = !emitted && retryableStreamError(error);
        if (!retryable || attempt + 1 >= attempts) throw error;
      }
      if (retryable && !emitted && attempt + 1 < attempts) continue;
      if (buffered.length > 0) yield* buffered;
      return;
    }
  }
  async refreshUsage(providerId, signal) {
    const synced = await this.syncProvider(providerId);
    const rows = await this.configuredKeys(synced.record);
    const module = usageModuleFor(providerId);
    const nextRows = [];
    for (const row of rows) {
      let usage;
      if (!row.configured || typeof this.credentials?.resolve !== "function") {
        usage = { status: "unconfigured", message: "\u8BE5 Key \u5C1A\u672A\u914D\u7F6E" };
      } else {
        try {
          const resolved = await this.credentials.resolve(row.ref);
          const apiKey = text2(resolved?.value);
          usage = apiKey ? await module.fetch({ providerId, profile: synced.profile, apiKey, signal }) : { status: "unconfigured", message: "\u8BE5 Key \u5C1A\u672A\u914D\u7F6E" };
        } catch (error) {
          usage = { status: "error", message: failureMessage(error), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        }
      }
      nextRows.push({ ...row, active: row.ref === synced.activeRef, usage, quota: usage?.quota ?? null });
    }
    const active = nextRows.find((entry) => entry.active) ?? nextRows[0] ?? null;
    return {
      providerId,
      policy: synced.record.policy,
      activeRef: synced.activeRef,
      runtimeMode: this.patches.length > 0 ? "request-key-pool" : "native-single-key",
      keys: nextRows,
      usage: active?.usage ?? { status: "unsupported", message: "provider \u5C1A\u672A\u8FD4\u56DE\u989D\u5EA6\u6570\u636E" },
      quota: active?.quota ?? null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};

// packages/dsh-plugin/src/index.mjs
var name = "dockyard-dsh";
var inject = ["llm", "commands", "credentials", "settings", "webServer"];
function contextLogger(ctx, name2) {
  try {
    const factory = typeof ctx?.get === "function" ? ctx.get("logger") : null;
    if (typeof factory === "function") return factory(name2);
  } catch {
  }
  return console;
}
function apply(ctx, config = {}) {
  const runtimeOptions = { ...config.runtimeOptions ?? {} };
  let catalogWarmers = [];
  if (!config.runtime && !runtimeOptions.providers) {
    const antigravityOptions = {
      ...runtimeOptions.antigravity ?? {}
    };
    antigravityOptions.projectResolver = antigravityOptions.projectResolver ?? createAntigravityProjectResolver(antigravityOptions);
    antigravityOptions.quotaReader = runtimeOptions.antigravity?.quotaReader ?? createAntigravityNativeQuotaReader(antigravityOptions);
    runtimeOptions.antigravity = antigravityOptions;
    const modelRegistryLoader = runtimeOptions.modelRegistryLoader ?? createPiAiModelRegistryLoader();
    const antigravityCatalogLoader = runtimeOptions.catalogLoaders?.antigravity ?? createAntigravityCatalogLoader({ ...antigravityOptions, registryLoader: modelRegistryLoader });
    runtimeOptions.requestExecutors = {
      ...runtimeOptions.requestExecutors ?? {},
      "openai-codex": runtimeOptions.requestExecutors?.["openai-codex"] ?? createCodexDshRequestExecutor(),
      antigravity: runtimeOptions.requestExecutors?.antigravity ?? createAntigravityNativeExecutor({
        ...antigravityOptions
      }),
      claude: runtimeOptions.requestExecutors?.claude ?? createClaudeNativeExecutor(runtimeOptions.claude ?? {}),
      cursor: runtimeOptions.requestExecutors?.cursor ?? createCursorNativeExecutor(runtimeOptions.cursor ?? {}),
      grok: runtimeOptions.requestExecutors?.grok ?? createGrokNativeExecutor(runtimeOptions.grok ?? {}),
      opencode: runtimeOptions.requestExecutors?.opencode ?? createOpencodeNativeExecutor(runtimeOptions.opencode ?? {}),
      workbuddy: runtimeOptions.requestExecutors?.workbuddy ?? createWorkbuddyNativeExecutor(runtimeOptions.workbuddy ?? {}),
      kilo: runtimeOptions.requestExecutors?.kilo ?? createKiloNativeExecutor(runtimeOptions.kilo ?? {})
    };
    runtimeOptions.catalogLoaders = {
      ...runtimeOptions.catalogLoaders ?? {},
      "openai-codex": runtimeOptions.catalogLoaders?.["openai-codex"] ?? createCodexDshCatalogLoader(runtimeOptions.codex ?? {}),
      antigravity: antigravityCatalogLoader,
      grok: runtimeOptions.catalogLoaders?.grok ?? createGrokCatalogLoader({
        ...runtimeOptions.grok ?? {},
        commandRunner: runtimeOptions.grok?.commandRunner ?? runCliCommand,
        registryLoader: modelRegistryLoader
      }),
      claude: runtimeOptions.catalogLoaders?.claude ?? createClaudeCatalogLoader({ registryLoader: modelRegistryLoader }),
      cursor: runtimeOptions.catalogLoaders?.cursor ?? createCursorCatalogLoader(runtimeOptions.cursor ?? {}),
      opencode: runtimeOptions.catalogLoaders?.opencode ?? createOpencodeCatalogLoader({
        ...runtimeOptions.opencode ?? {},
        registryLoader: modelRegistryLoader
      }),
      workbuddy: runtimeOptions.catalogLoaders?.workbuddy ?? createWorkbuddyCatalogLoader(runtimeOptions.workbuddy ?? {}),
      kilo: runtimeOptions.catalogLoaders?.kilo ?? createKiloCatalogLoader(runtimeOptions.kilo ?? {})
    };
    runtimeOptions.providers = createDefaultProviderEntries(runtimeOptions);
    catalogWarmers = Object.entries(runtimeOptions.catalogLoaders).filter(([, loader]) => typeof loader === "function");
  }
  const runtime = config.runtime ?? new DockyardRuntime(runtimeOptions);
  if (catalogWarmers.length > 0 && typeof runtime.init === "function") {
    void (async () => {
      await runtime.init();
      const providers = runtime.snapshot?.().providers ?? [];
      const connected = new Set(
        providers.filter((provider) => Array.isArray(provider.accounts) && provider.accounts.length > 0).map((provider) => provider.providerId)
      );
      const accountsByProvider = new Map(providers.map((provider) => [provider.providerId, provider.accounts ?? []]));
      await Promise.all(catalogWarmers.filter(([providerId]) => providerId === "openai-codex" || providerId === "opencode" || providerId === "workbuddy" || providerId === "kilo" || connected.has(providerId)).map(([providerId, loader]) => loader({ accounts: accountsByProvider.get(providerId) ?? [] }).catch(() => null)));
    })().catch((error) => {
      contextLogger(ctx, "dockyard-dsh").warn?.(error);
    });
  }
  const adapter = createDockyardLlmAdapter({
    runtime,
    providerIds: config.providers ?? runtime.listProviderIds(),
    // Resolve this only when a request is actually streamed. The attachment
    // service is installed by DSH's base profile after plugin composition;
    // reading it while the plugin graph is being composed breaks boot.
    attachmentsResolver: () => {
      try {
        return typeof ctx.get === "function" ? ctx.get("attachments") : ctx.attachments;
      } catch {
        return void 0;
      }
    }
  });
  const installAdapter = () => {
    const result = ctx.llm.registerAdapter(adapter.providers(), adapter);
    return typeof result?.dispose === "function" ? result.dispose.bind(result) : typeof result === "function" ? result : null;
  };
  if (typeof ctx.effect === "function") {
    ctx.effect(() => {
      const disposeAdapter = installAdapter();
      return () => {
        try {
          disposeAdapter?.();
        } catch {
        }
      };
    }, "dockyard-dsh: llm adapter");
  } else {
    installAdapter();
  }
  if (typeof runtime.init === "function") {
    const notifyAdaptersUpdated = () => {
      try {
        ctx.emit("llm/adapters-updated");
        ctx.llm?.emitAdaptersUpdated?.();
      } catch {
      }
    };
    const service = config.service ?? new DockyardDshService({
      runtime,
      ...config.serviceOptions ?? {},
      logger: config.serviceOptions?.logger ?? contextLogger(ctx, "dockyard-dsh"),
      notifyAdaptersUpdated
    });
    if (typeof ctx.provide === "function") ctx.provide("dockyard", service);
    let nativeKeyPool = config.nativeKeyPool ?? null;
    const install = () => {
      try {
        const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : ctx.credentials;
        if (credentials && typeof runtime.setSecretStore === "function") {
          runtime.setSecretStore(createDockyardCredentialStore(credentials, runtime.secretStore));
        }
      } catch (error) {
        contextLogger(ctx, "dockyard-dsh").warn?.(`DSH Credentials \u63A5\u5165\u5931\u8D25\uFF0C\u5C06\u4FDD\u7559\u539F\u6709\u5B89\u5168\u5B58\u50A8\uFF1A${error.message}`);
      }
      nativeKeyPool ??= new NativeKeyPoolHost(ctx, {
        logger: config.serviceOptions?.logger ?? contextLogger(ctx, "dockyard-dsh"),
        contextWindowOverrides: runtime.contextWindowOverrides
      });
      const nativeKeyPoolReady = nativeKeyPool.start();
      void nativeKeyPoolReady.catch((error) => {
        contextLogger(ctx, "dockyard-dsh").warn?.(error);
      });
      const unregister = ctx.commands?.register?.(createDockyardCommand(service));
      void service.start().catch((error) => {
        contextLogger(ctx, "dockyard-dsh").error?.(error);
      });
      let remoteFiberPromise;
      if (typeof ctx.plugin === "function") {
        remoteFiberPromise = Promise.resolve().then(() => (init_dockyard_remote_host(), dockyard_remote_host_exports)).then(({ DockyardRemoteService: DockyardRemoteService2 }) => ctx.plugin(DockyardRemoteService2, { service, nativeKeyPool })).catch((error) => {
          contextLogger(ctx, "dockyard-dsh").error?.(error);
          return null;
        });
      }
      let unregisterArtifactsRoute;
      try {
        const webServer = ctx.webServer ?? (typeof ctx.get === "function" ? ctx.get("webServer") : null);
        if (webServer && typeof webServer.register === "function") {
          unregisterArtifactsRoute = webServer.register({
            kind: "prefix",
            path: "/artifacts",
            handler: async (req, res) => {
              try {
                const url = new URL(req.url, "http://127.0.0.1");
                const cleanPath = url.pathname.replace(/^\/artifacts\/?/, "");
                if (!cleanPath || cleanPath.includes("..")) {
                  res.writeHead(403);
                  res.end("Forbidden");
                  return;
                }
                const filePath = join15(process.cwd(), "artifacts", cleanPath);
                if (!existsSync5(filePath)) {
                  res.writeHead(404);
                  res.end("Not Found");
                  return;
                }
                const ext = cleanPath.split(".").pop()?.toLowerCase();
                const mimeTypes = {
                  png: "image/png",
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  webp: "image/webp",
                  gif: "image/gif",
                  svg: "image/svg+xml"
                };
                const contentType = mimeTypes[ext] ?? "application/octet-stream";
                const content = readFileSync4(filePath);
                res.writeHead(200, {
                  "Content-Type": contentType,
                  "Content-Length": content.length,
                  "Cache-Control": "public, max-age=3600"
                });
                res.end(content);
              } catch (err) {
                res.writeHead(500);
                res.end("Internal Server Error");
              }
            }
          });
        }
      } catch (error) {
        contextLogger(ctx, "dockyard-dsh").warn?.(`Failed to register /artifacts/ route: ${error.message}`);
      }
      return async () => {
        try {
          unregisterArtifactsRoute?.();
        } catch {
        }
        try {
          await remoteFiberPromise?.catch?.(() => null);
        } catch {
        }
        try {
          await nativeKeyPoolReady.catch?.(() => null);
        } catch {
        }
        try {
          nativeKeyPool?.dispose?.();
        } catch {
        }
        try {
          unregister?.();
        } catch {
        }
        try {
          await service.dispose();
        } catch {
        }
      };
    };
    if (typeof ctx.effect === "function") {
      ctx.effect(install, "dockyard-dsh: service and commands");
    } else {
      install();
    }
  }
}
export {
  DockyardDshService,
  DockyardRuntime,
  NativeKeyPoolHost,
  apply,
  createDockyardCommand,
  createDockyardLlmAdapter,
  inject,
  name
};
