import { spawn } from "node:child_process";

import { ACCOUNT_SELECTION_POLICY } from "../../core/src/contracts.mjs";
import { redactError } from "../../providers/src/provider-utils.mjs";

const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_POLL_INTERVAL_MS = 750;
const AUTH_URL_WAIT_MS = 2_000;

const POLICY_ALIASES = new Map([
  ["manual", ACCOUNT_SELECTION_POLICY.MANUAL],
  ["sticky", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["sticky-session", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["sticky_session", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["round-robin", ACCOUNT_SELECTION_POLICY.ROUND_ROBIN],
  ["round_robin", ACCOUNT_SELECTION_POLICY.ROUND_ROBIN],
  ["failover", ACCOUNT_SELECTION_POLICY.FAILOVER],
]);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function numericOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function providerName(manifest) {
  return manifest?.displayName ?? manifest?.id ?? "provider";
}

function displayNumber(value, unit = "") {
  if (value === null || value === undefined) return "未知";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function displayTime(value) {
  return value ? new Date(value).toLocaleString() : "未知";
}

function displayQuota(quota) {
  if (!quota) return "额度：未知";
  const topLevel = quota.limit === null || quota.limit === undefined
    ? displayNumber(quota.remaining, quota.unit)
    : `${displayNumber(quota.remaining)} / ${displayNumber(quota.limit)}${quota.unit ? ` ${quota.unit}` : ""}`;
  const windows = Array.isArray(quota.windows)
    ? quota.windows.map((window) => {
      const label = window.name ?? window.id ?? "window";
      const value = window.limit === null || window.limit === undefined
        ? displayNumber(window.remaining, window.unit)
        : `${displayNumber(window.remaining)} / ${displayNumber(window.limit)}${window.unit ? ` ${window.unit}` : ""}`;
      return `${label}: ${value}，重置 ${displayTime(window.resetAt)}`;
    })
    : [];
  return [
    `额度：${topLevel}`,
    ...windows,
    `额度更新时间：${displayTime(quota.updatedAt)}`,
  ].join("；");
}

function displayAccount(account) {
  const identity = account.email ?? account.displayName ?? account.accountId;
  const plan = account.subscription?.plan ?? "订阅未知";
  const health = account.health?.status ?? "unknown";
  const lastChecked = account.health?.lastCheckedAt ?? account.quota?.updatedAt;
  const oauthState = health === "expired"
    ? "OAuth 授权：需重新授权"
    : `OAuth token 有效至：${displayTime(account.refresh?.accessTokenExpiresAt)}`;
  return [
    `${identity} (${account.accountId})`,
    `状态：${health}`,
    `套餐：${plan}`,
    `订阅到期：${displayTime(account.subscription?.expiresAt)}`,
    displayQuota(account.quota),
    `额度检查：${displayTime(lastChecked)}`,
    oauthState,
    `OAuth 下次刷新：${displayTime(account.refresh?.nextRefreshAt)}`,
  ].join("；");
}

function manifestFor(runtime, input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) return null;
  const manifests = runtime.listProviderManifests?.() ?? [];
  return manifests.find((manifest) => String(manifest.id).toLowerCase() === value)
    ?? manifests.find((manifest) => String(manifest.displayName ?? "").toLowerCase() === value)
    ?? manifests.find((manifest) => String(manifest.id).toLowerCase().endsWith(`-${value}`))
    ?? null;
}

function providerIdFor(runtime, input) {
  return manifestFor(runtime, input)?.id ?? null;
}

function commandTokens(rawInput) {
  return String(rawInput ?? "").trim().split(/\s+/).filter(Boolean);
}

function commandSuccess(text) {
  return { kind: "success", text };
}

function commandError(text) {
  return { kind: "error", text };
}

function openDefaultBrowser(url) {
  if (process.platform !== "darwin" || !url) return;
  try {
    const child = spawn("open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // The authorization URL is still returned in the command result.
  }
}

export class DockyardDshService {
  #refreshTimer = null;
  #refreshPromises = new Map();
  #started = false;
  #disposed = false;
  #authSessions = new Map();
  #authOpened = new Set();
  #authStartPromises = new Map();

  constructor({
    runtime,
    refreshIntervalMs = numericOption(process.env.DOCKYARD_DSH_REFRESH_INTERVAL_MS, DEFAULT_REFRESH_INTERVAL_MS),
    autoRefresh = true,
    openBrowser = openDefaultBrowser,
    logger = console,
    catalogAdapter = null,
    onCatalogUpdated = null,
  } = {}) {
    if (!runtime) throw new Error("Dockyard DSH service requires a runtime");
    this.runtime = runtime;
    this.refreshIntervalMs = refreshIntervalMs;
    this.autoRefresh = autoRefresh;
    this.openBrowser = openBrowser;
    this.logger = logger;
    this.catalogAdapter = catalogAdapter;
    this.onCatalogUpdated = typeof onCatalogUpdated === "function" ? onCatalogUpdated : null;
    this.ready = runtime.init();
  }

  async start() {
    await this.ready;
    if (this.#started || this.#disposed) return this;
    this.#started = true;
    if (this.autoRefresh) {
      // Do not start a serial all-provider refresh during boot. A provider
      // popup opened immediately after DSH starts must be able to refresh its
      // own live state without waiting behind every other provider/account.
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
      await this.runtime.cancelAuthorization(providerId, sessionId).catch(() => {});
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
    if (providerInput && !providerId) throw new Error(`未知 provider：${providerInput}`);
    const result = await this.runtime.scan(providerId);
    if (!providerInput) return result;
    return {
      ...result,
      providers: result.providers.filter((provider) => provider.providerId === providerId),
    };
  }

  async add(providerInput = null, candidateId = null) {
    const scan = await this.scan(providerInput);
    const imports = [];
    const diagnostics = [];
    for (const provider of scan.providers) {
      const candidates = provider.candidates.filter((candidate) => !candidate.imported);
      const selected = candidateId
        ? candidates.filter((candidate) => candidate.candidateId === candidateId)
        : candidates;
      if (candidateId && selected.length === 0) continue;
      for (const candidate of selected) {
        try {
          const imported = await this.runtime.importCandidate(provider.providerId, candidate.candidateId);
          let refreshed = imported.account;
          try {
            refreshed = (await this.runtime.refreshAccount(provider.providerId, imported.account.accountId, {
              tolerateFailure: true,
            })).account;
          } catch (error) {
            diagnostics.push(`${providerName(provider.manifest)} ${candidate.candidateId} 刷新失败：${redactError(error)}`);
          }
          imports.push(refreshed);
        } catch (error) {
          diagnostics.push(`${providerName(provider.manifest)} ${candidate.candidateId} 添加失败：${redactError(error)}`);
        }
      }
    }
    if (candidateId && imports.length === 0 && diagnostics.length === 0) {
      throw new Error(`没有找到未添加的 OAuth 候选：${candidateId}`);
    }
    if (imports.length > 0) {
      const catalogProviderId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
      await this.refreshCatalog(catalogProviderId).catch((error) => this.#warn("post-add catalog refresh failed", error));
    }
    return { accounts: imports, diagnostics, scan };
  }

  async refresh(providerInput = null) {
    await this.ready;
    const providerId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
    if (providerInput && !providerId) throw new Error(`未知 provider：${providerInput}`);
    const refreshKey = providerId ?? "*";
    const existing = this.#refreshPromises.get(refreshKey);
    if (existing) return existing;
    const promise = this.runtime.refreshAll(providerId).finally(() => {
      if (this.#refreshPromises.get(refreshKey) === promise) this.#refreshPromises.delete(refreshKey);
    });
    this.#refreshPromises.set(refreshKey, promise);
    return promise;
  }

  async catalog(providerInput, { force = false } = {}) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`未知 provider：${providerInput}`);
    if (force && typeof this.catalogAdapter?.invalidateCatalog === "function") {
      this.catalogAdapter.invalidateCatalog(providerId);
    }
    const catalog = await this.runtime.getCatalog(providerId, force ? { force: true } : {});
    if (force && typeof this.catalogAdapter?.invalidateCatalog === "function") {
      this.catalogAdapter.invalidateCatalog(providerId);
    }
    return { providerId, manifest: manifestFor(this.runtime, providerInput), catalog };
  }

  catalogProviderIds(providerId = null) {
    if (providerId) return [providerId];
    const snapshot = typeof this.runtime.snapshot === "function" ? this.runtime.snapshot() : null;
    const connected = Array.isArray(snapshot?.providers)
      ? snapshot.providers
        .filter((provider) => Array.isArray(provider.accounts) && provider.accounts.length > 0)
        .map((provider) => provider.providerId)
      : [];
    if (connected.length > 0) return connected;
    return this.runtime.listProviderIds?.() ?? [];
  }

  async refreshCatalog(providerInput = null) {
    await this.ready;
    const providerId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
    if (providerInput && !providerId) throw new Error(`未知 provider：${providerInput}`);
    const providerIds = this.catalogProviderIds(providerId);
    const catalogs = [];
    for (const id of providerIds) {
      if (typeof this.catalogAdapter?.invalidateCatalog === "function") {
        this.catalogAdapter.invalidateCatalog(id);
      }
      const catalog = await this.runtime.getCatalog(id, { force: true });
      if (typeof this.catalogAdapter?.invalidateCatalog === "function") {
        this.catalogAdapter.invalidateCatalog(id);
      }
      catalogs.push({
        providerId: id,
        manifest: manifestFor(this.runtime, id),
        catalog,
        modelCount: Array.isArray(catalog?.models) ? catalog.models.length : 0,
        source: catalog?.source ?? null,
        diagnostics: Array.isArray(catalog?.diagnostics) ? catalog.diagnostics : [],
      });
    }
    try {
      this.onCatalogUpdated?.({ providerId, providerIds });
    } catch (error) {
      this.#warn("catalog update notification failed", error);
    }
    return { providerId, providerIds, catalogs };
  }

  async setPolicy(providerInput, policyInput, defaultAccountId = undefined) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`未知 provider：${providerInput}`);
    const policy = POLICY_ALIASES.get(String(policyInput ?? "").toLowerCase());
    if (!policy) throw new Error(`未知账号策略：${policyInput}；可用值：${[...new Set(POLICY_ALIASES.values())].join(", ")}`);
    return this.runtime.setPolicy(providerId, policy, defaultAccountId);
  }

  async setDefaultAccount(providerInput, accountId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`未知 provider：${providerInput}`);
    return this.runtime.setDefaultAccount(providerId, accountId);
  }

  async removeAccount(providerInput, accountId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`未知 provider：${providerInput}`);
    if (!accountId) throw new Error("移除账号需要 accountId");
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

  async startAuthorization(providerInput, { openBrowser = true } = {}) {
    await this.ready;
    const manifest = manifestFor(this.runtime, providerInput);
    if (!manifest) throw new Error(`未知 provider：${providerInput}`);
    if (!manifest.capabilities?.includes("oauth_authorization")) {
      return {
        status: "unsupported",
        providerId: manifest.id,
        instructions: `${providerName(manifest)} 没有独立的官方授权入口；请先在官方客户端或官方环境登录/切换账号，然后扫描本机登录态，再添加候选。`,
      };
    }

    // Deduplicate concurrent UI/remote calls before the first runtime session
    // has been registered. Without this guard two same-tick clicks can each
    // start the provider's official authorization flow.
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
    // A second click must attach to the existing provider session. Starting a
    // second official authorization flow can race the first one while both
    // try to write the same local login state.
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
          ...(existing.authorizationUrl ? { authorizationUrl: existing.authorizationUrl } : {}),
          diagnostic: `已有登录验证进行中，暂时无法读取最新状态：${redactError(error)}`,
        };
      }
      if (current?.status === "completed") return current;
      if (current && ["pending", "processing"].includes(current.status)) {
        this.#scheduleAuthorization(manifest.id, existing.sessionId);
        return {
          ...current,
          instructions: current.instructions ?? "已有登录验证进行中，请使用当前 Google 页面；不会重复打开登录页。",
        };
      }
    }
    const started = await this.runtime.startAuthorization(manifest.id);
    this.#authSessions.set(started.sessionId, {
      providerId: manifest.id,
      sessionId: started.sessionId,
      status: started.status,
      authorizationUrl: started.authorizationUrl ?? null,
      openBrowser,
    });
    const result = await this.#waitForAuthorizationUrl(manifest.id, started, openBrowser);
    const tracked = this.#authSessions.get(started.sessionId);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null,
    });
    if (result.status === "pending" || result.status === "processing") this.#scheduleAuthorization(manifest.id, started.sessionId);
    else if (result.status === "completed") {
      this.#authSessions.delete(started.sessionId);
      await this.refresh(manifest.id).catch((error) => this.#warn("post-login quota refresh failed", error));
      await this.refreshCatalog(manifest.id).catch((error) => this.#warn("post-login catalog refresh failed", error));
    }
    return result;
  }

  async pollAuthorization(providerId, sessionId) {
    const tracked = this.#authSessions.get(sessionId);
    const result = await this.runtime.pollAuthorization(providerId, sessionId);
    this.#openAuthorizationUrl(result, tracked?.openBrowser ?? true);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null,
    });
    if (result.status === "completed") {
      this.#authSessions.delete(sessionId);
      await this.refresh(providerId).catch((error) => this.#warn("post-login quota refresh failed", error));
      await this.refreshCatalog(providerId).catch((error) => this.#warn("post-login catalog refresh failed", error));
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
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null,
    });
    if (result.status === "pending" || result.status === "processing") this.#scheduleAuthorization(providerId, sessionId);
    else if (result.status === "completed") {
      this.#authSessions.delete(sessionId);
      await this.refresh(providerId).catch((error) => this.#warn("post-login quota refresh failed", error));
      await this.refreshCatalog(providerId).catch((error) => this.#warn("post-login catalog refresh failed", error));
    } else if (result.status !== "pending" && result.status !== "processing") {
      this.#authSessions.delete(sessionId);
    }
    return result;
  }

  helpText() {
    const providers = (this.runtime.listProviderManifests?.() ?? []).map((manifest) => `${manifest.id} (${providerName(manifest)})`);
    return [
      "Dockyard DSH 原生命令：",
      "/dockyard status                         查看账号、实时额度和刷新时间",
      "/dockyard scan [provider]                扫描本机官方登录态",
      "/dockyard add [provider] [candidateId]   添加扫描到的 OAuth 账号",
      "/dockyard login <provider>               启动 provider 官方授权流程并登录",
      "/dockyard refresh [provider]             强制读取实时额度",
      "/dockyard models <provider>              强制读取 provider 实时模型/档位",
      "/dockyard policy <provider> <policy>     设置 manual/sticky_session/round_robin/failover",
      "/dockyard use <provider> <accountId>      手动指定账号",
      "/dockyard remove <provider> <accountId>   从账号池移除账号并清理本机 Keychain 引用",
      "/dockyard cancel <provider> <sessionId>  取消 OAuth 登录",
      `当前 providers：${providers.length ? providers.join("、") : "暂无"}`,
    ].join("\n");
  }

  #openAuthorizationUrl(result, openBrowser = true) {
    if (!openBrowser || !result?.authorizationUrl || this.#authOpened.has(result.sessionId)) return;
    this.#authOpened.add(result.sessionId);
    // Provider-owned CLI sessions may need the host-level browser fallback;
    // direct GUI OAuth passes openBrowser=false and navigates its synchronous
    // popup itself. Providers that already opened a browser are never opened
    // a second time.
    if (result.browserOpened) return;
    void Promise.resolve(this.openBrowser(result.authorizationUrl)).catch((error) => {
      this.#warn("could not open authorization URL", error);
    });
  }

  #activeAuthSession(providerId) {
    return [...this.#authSessions.values()].find((session) => (
      session.providerId === providerId
        && ["pending", "processing"].includes(session.status ?? "pending")
    )) ?? null;
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
}

export function createDockyardCommand(service) {
  return {
    name: "dockyard",
    description: "Manage Dockyard DSH providers, OAuth accounts, quotas, models, and account selection",
    input: { hint: "status | scan | add | login | refresh | models | policy | use | cancel" },
    handler: async ({ rawInput, signal }) => {
      if (signal?.aborted) return commandError("Dockyard 命令已取消。");
      const [verb = "help", ...args] = commandTokens(rawInput);
      try {
        switch (verb.toLowerCase()) {
          case "help":
            return commandSuccess(service.helpText());
          case "status": {
            const snapshot = await service.snapshot();
            const lines = ["Dockyard DSH 状态", `更新时间：${displayTime(snapshot.generatedAt)}`];
            for (const provider of snapshot.providers ?? []) {
              lines.push(`\n${providerName(provider.manifest)} [${provider.providerId}]`);
              lines.push(`策略：${provider.policy}；当前账号：${provider.defaultAccountId ?? "跟随策略"}`);
              if (!provider.accounts?.length) lines.push("暂无已添加账号");
              for (const account of provider.accounts ?? []) lines.push(`- ${displayAccount(account)}`);
            }
            return commandSuccess(lines.join("\n"));
          }
          case "scan": {
            const result = await service.scan(args[0] ?? null);
            const lines = ["本机 OAuth 登录态扫描结果："];
            for (const provider of result.providers ?? []) {
              lines.push(`\n${providerName(provider.manifest)} [${provider.providerId}]`);
              if (!provider.candidates?.length) lines.push(`未发现：${provider.diagnostics?.join("；") || "provider 未返回候选"}`);
              for (const candidate of provider.candidates ?? []) {
                lines.push(`- ${candidate.imported ? "已添加" : "可添加"} ${candidate.candidateId}：${candidate.email ?? candidate.displayName ?? candidate.accountId}`);
              }
            }
            return commandSuccess(lines.join("\n"));
          }
          case "add": {
            const result = await service.add(args[0] ?? null, args[1] ?? null);
            const lines = [`已添加账号：${result.accounts.length}`];
            for (const account of result.accounts) lines.push(`- ${account.email ?? account.displayName ?? account.accountId}`);
            if (!result.accounts.length) lines.push("没有新的 OAuth 候选；先执行 /dockyard scan 查看本机登录态。");
            if (result.diagnostics.length) lines.push(`诊断：${result.diagnostics.join("；")}`);
            return commandSuccess(lines.join("\n"));
          }
          case "login": {
            if (!args[0]) return commandError("用法：/dockyard login <provider>");
            const result = await service.startAuthorization(args[0]);
            if (["unsupported", "opened", "failed"].includes(result.status)) {
              return result.status === "failed"
                ? commandError(result.diagnostic ?? result.instructions)
                : commandSuccess(result.instructions);
            }
            const lines = [`OAuth 状态：${result.status}`, `会话：${result.sessionId}`];
            if (result.authorizationUrl) lines.push(`官方授权页：${result.authorizationUrl}`);
            if (result.instructions) lines.push(result.instructions);
            if (result.diagnostic) lines.push(`诊断：${result.diagnostic}`);
            return commandSuccess(lines.join("\n"));
          }
          case "refresh": {
            const results = await service.refresh(args[0] ?? null);
            const lines = [`已刷新账号：${results.length}`];
            for (const result of results) {
              const account = result.account;
              lines.push(`- ${account?.providerId ?? "provider"}/${account?.email ?? account?.accountId ?? "unknown"}：${result.diagnostics?.join("；") || "成功"}`);
            }
            return commandSuccess(lines.join("\n"));
          }
          case "models": {
            if (!args[0]) return commandError("用法：/dockyard models <provider>");
            const { providerId, manifest, catalog } = await service.catalog(args[0], { force: true });
            const lines = [`${providerName(manifest)} [${providerId}] 实时模型目录：`];
            for (const model of catalog.models ?? []) {
              const efforts = model.reasoning?.efforts?.map((effort) => effort.id).join(", ");
              lines.push(`- ${model.id}${model.name && model.name !== model.id ? `：${model.name}` : ""}${efforts ? `；档位：${efforts}` : ""}`);
            }
            if (!(catalog.models ?? []).length) lines.push("provider 当前没有返回模型。");
            return commandSuccess(lines.join("\n"));
          }
          case "policy": {
            if (!args[0] || !args[1]) return commandError("用法：/dockyard policy <provider> <manual|sticky_session|round_robin|failover> [accountId]");
            const result = await service.setPolicy(args[0], args[1], args[2]);
            return commandSuccess(`已设置 ${result.providerId} 策略为 ${result.policy}；默认账号：${result.defaultAccountId ?? "跟随策略"}`);
          }
          case "use": {
            if (!args[0] || !args[1]) return commandError("用法：/dockyard use <provider> <accountId>");
            const result = await service.setDefaultAccount(args[0], args[1]);
            return commandSuccess(`已将 ${result.providerId} 当前账号设为 ${result.defaultAccountId}`);
          }
          case "remove": {
            if (!args[0] || !args[1]) return commandError("用法：/dockyard remove <provider> <accountId>");
            const result = await service.removeAccount(args[0], args[1]);
            const diagnostic = result.diagnostics?.length ? `；${result.diagnostics.join("；")}` : "";
            return commandSuccess(`已移除 ${result.providerId}/${result.accountId}；当前账号：${result.defaultAccountId ?? "跟随策略"}${diagnostic}`);
          }
          case "cancel": {
            if (!args[0] || !args[1]) return commandError("用法：/dockyard cancel <provider> <sessionId>");
            const result = await service.cancelAuthorization(args[0], args[1]);
            return commandSuccess(`OAuth 会话 ${result.sessionId}：${result.status}`);
          }
          default:
            return commandError(`未知 Dockyard 子命令：${verb}\n\n${service.helpText()}`);
        }
      } catch (error) {
        return commandError(`Dockyard 命令失败：${redactError(error)}`);
      }
    },
  };
}

export const dockyardDshConstants = Object.freeze({
  defaultRefreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  authPollIntervalMs: AUTH_POLL_INTERVAL_MS,
});
