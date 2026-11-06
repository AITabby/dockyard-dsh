import { ACCOUNT_HEALTH, ACCOUNT_SELECTION_POLICY, ModuleRuntime, PROVIDER_BEHAVIOR_CAPABILITIES } from "../../core/src/index.mjs";
import { evaluateQuotaAlerts } from "../../core/src/quota-alerts.mjs";
import { AccountPool } from "../../account-pool/src/index.mjs";
import { DshInjectionBridge } from "../../dsh-bridge/src/index.mjs";
import { createDefaultSecretStore } from "../../vault/src/index.mjs";
import { JsonStateStore } from "./state-store.mjs";
import { ContextWindowOverrideStore } from "./context-window-overrides.mjs";
import { ModelSelectionStore } from "./model-selection-store.mjs";
import { createCodexDriver, createCodexModule, summarizeCodexCandidate } from "../../../modules/provider-codex/src/index.mjs";
import {
  createAntigravityDriver,
  createAntigravityModule,
  summarizeAntigravityCandidate,
} from "../../../modules/provider-antigravity/src/index.mjs";
import { createGrokDriver, createGrokModule, summarizeGrokCandidate } from "../../../modules/provider-grok/src/index.mjs";
import { createClaudeDriver, createClaudeModule, summarizeClaudeCandidate } from "../../../modules/provider-claude/src/index.mjs";
import { createCursorDriver, createCursorModule, summarizeCursorCandidate } from "../../../modules/provider-cursor/src/index.mjs";
import { createOpencodeDriver, createOpencodeModule, summarizeOpencodeCandidate } from "../../../modules/provider-opencode/src/index.mjs";
import { createWorkbuddyDriver, createWorkbuddyModule, summarizeWorkbuddyCandidate } from "../../../modules/provider-workbuddy/src/index.mjs";
import { createKiloDriver, createKiloModule, summarizeKiloCandidate } from "../../../modules/provider-kilo/src/index.mjs";
import {
  createCommandCodeDriver,
  createCommandCodeModule,
  summarizeCommandCodeCandidate,
} from "../../../modules/provider-commandcode/src/index.mjs";
import {
  createHermesDriver,
  createHermesModule,
  summarizeHermesCandidate,
} from "../../../modules/provider-hermes/src/index.mjs";
import {
  createOpenRouterFreeDriver,
  createOpenRouterFreeModule,
  summarizeOpenRouterFreeCandidate,
} from "../../../modules/provider-openrouter-free/src/index.mjs";
import { redactError } from "../../providers/src/provider-utils.mjs";

const candidateSummarizers = new Map([
  ["openai-codex", summarizeCodexCandidate],
  ["antigravity", summarizeAntigravityCandidate],
  ["grok", summarizeGrokCandidate],
  ["claude", summarizeClaudeCandidate],
  ["cursor", summarizeCursorCandidate],
  ["opencode", summarizeOpencodeCandidate],
  ["workbuddy", summarizeWorkbuddyCandidate],
  ["kilo", summarizeKiloCandidate],
  ["commandcode", summarizeCommandCodeCandidate],
  ["hermes", summarizeHermesCandidate],
  ["openrouter-free", summarizeOpenRouterFreeCandidate],
]);

// Official provider CLIs may need a network round-trip to rotate OAuth
// credentials before they can report live quota. Keep this above agy's normal
// refresh latency while still bounding a stuck provider operation.
const DEFAULT_REFRESH_TIMEOUT_MS = 30_000;

function numericOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function refreshTimeoutError(providerId, accountId, timeoutMs) {
  const error = new Error(`刷新 ${providerId}/${accountId} 超时（${Math.ceil(timeoutMs / 1000)} 秒）；已保留上次额度`);
  error.code = "ETIMEDOUT";
  error.refreshTimeout = true;
  error.timeoutMs = timeoutMs;
  return error;
}

/**
 * A successful quota refresh proves the credential works but must not erase a
 * confirmed exhausted/cooldown state: an account whose live quota reports
 * zero remaining would otherwise be re-selected and fail again immediately.
 * An expired state is recoverable only when the provider explicitly reports
 * that the selected account's native transport was authenticated; a CLI
 * metadata check alone must not clear a real transport failure.
 */
function reportPostRefreshHealth(pool, accountId, { allowExpiredRecovery = false } = {}) {
  const account = pool.get(accountId);
  if (!account || (account.health?.status === ACCOUNT_HEALTH.EXPIRED && !allowExpiredRecovery)) return;
  const remaining = account.quota?.remaining;
  if (typeof remaining === "number" && remaining <= 0) {
    pool.report(accountId, {
      status: "quota_exhausted",
      message: "刷新后官方额度仍为 0，请切换账号或稍后重试",
    });
    return;
  }
  pool.report(accountId, { status: "success" });
}

function withRefreshTimeout(task, { providerId, accountId, timeoutMs }) {
  const controller = new AbortController();
  let timer = null;
  const operation = Promise.resolve().then(() => task(controller.signal));
  // The operation may still be unwinding after the timeout signal is sent.
  // Keep its rejection observed while the caller receives the bounded result.
  operation.catch(() => {});
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
  return executor ? { ...(driverOptions ?? {}), requestExecutor: executor } : driverOptions;
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function providerStorageSnapshot(entry) {
  return {
    policy: entry.pool.policy,
    defaultAccountId: entry.pool.getDefaultAccountId(),
    accounts: entry.pool.listForStorage(),
  };
}

/**
 * Merge only changes made by this runtime into the latest locked snapshot.
 * Keeping a baseline prevents a stale policy/health save from resurrecting an
 * account removed by another runtime while still allowing account-level edits
 * to be persisted without replacing unrelated provider state.
 */
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
    if (!beforeRefs.has(ref)) await secretStore.delete(ref).catch(() => {});
  }
}

function mergeProviderStorage(latestInput, current, baseline = {}) {
  const latest = latestInput && typeof latestInput === "object" ? latestInput : {};
  const merged = { ...latest };
  if (current.policy !== baseline.policy) merged.policy = current.policy;
  if ((current.defaultAccountId ?? null) !== (baseline.defaultAccountId ?? null)) {
    merged.defaultAccountId = current.defaultAccountId ?? null;
  }

  const latestById = new Map((Array.isArray(latest.accounts) ? latest.accounts : [])
    .filter((account) => account?.accountId)
    .map((account) => [account.accountId, account]));
  const currentById = new Map((Array.isArray(current.accounts) ? current.accounts : [])
    .filter((account) => account?.accountId)
    .map((account) => [account.accountId, account]));
  const baselineById = new Map((Array.isArray(baseline.accounts) ? baseline.accounts : [])
    .filter((account) => account?.accountId)
    .map((account) => [account.accountId, account]));

  for (const [accountId, currentAccount] of currentById) {
    const baselineAccount = baselineById.get(accountId);
    const latestAccount = latestById.get(accountId);
    if (!baselineAccount) {
      latestById.set(accountId, structuredClone(currentAccount));
      continue;
    }
    if (!latestAccount) {
      // A sibling runtime explicitly removed this baseline account. Do not
      // resurrect it from an unchanged in-memory snapshot.
      continue;
    }
    if (jsonEqual(currentAccount, baselineAccount)) continue;
    const changedAccount = { ...latestAccount };
    for (const [key, value] of Object.entries(currentAccount)) {
      if (!jsonEqual(value, baselineAccount[key])) changedAccount[key] = structuredClone(value);
    }
    latestById.set(accountId, changedAccount);
  }

  // A removal is an explicit local mutation and must survive a stale sibling
  // runtime's later save. Accounts added by that sibling are not in the
  // baseline, so they remain untouched.
  for (const accountId of baselineById.keys()) {
    if (!currentById.has(accountId)) latestById.delete(accountId);
  }
  merged.accounts = [...latestById.values()];
  return merged;
}

export function createDefaultProviderEntries(options = {}) {
  const requestExecutors = options.requestExecutors ?? {};
  const catalogLoaders = options.catalogLoaders ?? {};
  return [
    {
      module: createCodexModule({
        driver: options.codexDriver ?? createCodexDriver({
          ...withRequestExecutor("openai-codex", options.codex, requestExecutors),
          ...(catalogLoaders["openai-codex"] ? { catalogLoader: catalogLoaders["openai-codex"] } : {}),
        }),
      }),
      driver: options.codexDriver,
    },
    {
      module: createAntigravityModule({
        driver: options.antigravityDriver ?? createAntigravityDriver({
          ...withRequestExecutor("antigravity", options.antigravity, requestExecutors),
          ...(catalogLoaders.antigravity ? { catalogLoader: catalogLoaders.antigravity } : {}),
        }),
      }),
      driver: options.antigravityDriver,
    },
    {
      module: createGrokModule({
        driver: options.grokDriver ?? createGrokDriver({
          ...withRequestExecutor("grok", options.grok, requestExecutors),
          ...(catalogLoaders.grok ? { catalogLoader: catalogLoaders.grok } : {}),
        }),
      }),
      driver: options.grokDriver,
    },
    {
      module: createClaudeModule({
        driver: options.claudeDriver ?? createClaudeDriver({
          ...withRequestExecutor("claude", options.claude, requestExecutors),
          ...(catalogLoaders.claude ? { catalogLoader: catalogLoaders.claude } : {}),
        }),
      }),
      driver: options.claudeDriver,
    },
    {
      module: createCursorModule({
        driver: options.cursorDriver ?? createCursorDriver({
          ...withRequestExecutor("cursor", options.cursor, requestExecutors),
          ...(catalogLoaders.cursor ? { catalogLoader: catalogLoaders.cursor } : {}),
        }),
      }),
      driver: options.cursorDriver,
    },
    {
      module: createWorkbuddyModule({
        driver: options.workbuddyDriver ?? createWorkbuddyDriver({
          ...withRequestExecutor("workbuddy", options.workbuddy, requestExecutors),
          ...(catalogLoaders.workbuddy ? { catalogLoader: catalogLoaders.workbuddy } : {}),
        }),
      }),
      driver: options.workbuddyDriver,
    },
    {
      module: createCommandCodeModule({
        driver: options.commandcodeDriver ?? createCommandCodeDriver({
          ...withRequestExecutor("commandcode", options.commandcode, requestExecutors),
          ...(catalogLoaders.commandcode ? { catalogLoader: catalogLoaders.commandcode } : {}),
        }),
      }),
      driver: options.commandcodeDriver,
    },
    {
      module: createHermesModule({
        driver: options.hermesDriver ?? createHermesDriver({
          ...withRequestExecutor("hermes", options.hermes, requestExecutors),
          ...(catalogLoaders.hermes ? { catalogLoader: catalogLoaders.hermes } : {}),
        }),
      }),
      driver: options.hermesDriver,
    },
    {
      module: createOpenRouterFreeModule({
        driver: options.openrouterFreeDriver ?? createOpenRouterFreeDriver({
          ...withRequestExecutor("openrouter-free", options["openrouter-free"] ?? options.openrouterFree, requestExecutors),
          ...(catalogLoaders["openrouter-free"] ? { catalogLoader: catalogLoaders["openrouter-free"] } : {}),
        }),
      }),
      driver: options.openrouterFreeDriver,
    },
  ];
}

function providerContext(app, extra = {}) {
  return {
    secretStore: app.secretStore,
    now: new Date(),
    ...extra,
  };
}

function providerAccount(pool, accountId) {
  const account = pool.get(accountId);
  if (!account) throw new Error(`Account does not exist: ${accountId}`);
  const auth = pool.resolve(accountId);
  return {
    ...account,
    auth: {
      kind: auth.authKind,
      credentialRef: auth.credentialRef,
      scopes: [...auth.scopes],
    },
  };
}

function providerErrorStatus(error) {
  if (error?.quotaUnavailable) return "error";
  if (error?.authExpired || error?.accountMismatch) return "auth_expired";
  // A provider-side 403 is an operation/permission failure. Keep the account
  // usable and surface it as degraded instead of claiming its OAuth expired.
  if (error?.authForbidden) return "error";
  if (error?.quotaExhausted) return "quota_exhausted";
  if (error?.rateLimited) return "rate_limited";
  return "error";
}

export class DockyardRuntime {
  #entries = new Map();
  #candidates = new Map();
  #refreshPromises = new Map();
  #accountRefreshPromises = new Map();
  #stateBaselines = new Map();
  #saveQueue = Promise.resolve();
  // Per-provider import transactions. Import work is async (OAuth, network);
  // without serialization two concurrent imports could roll each other back
  // through stale pool snapshots.
  #providerImportQueues = new Map();
  #initialized = false;
  #initPromise = null;
  // Phase 1 (pools, module registration, injection bridge) resolves here. The
  // model picker only needs phase 1: auto-provisioning a free account can wait
  // on a provider round-trip and must not hold the picker hostage.
  #prepared = false;
  #preparePromise = null;

  constructor({
    providers = createDefaultProviderEntries(),
    runtime = new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
    stateStore = new JsonStateStore(),
    secretStore = createDefaultSecretStore(),
    dshAdapter = null,
    refreshTimeoutMs = numericOption(process.env.DOCKYARD_DSH_REFRESH_TIMEOUT_MS, DEFAULT_REFRESH_TIMEOUT_MS),
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
      modelSelection: this.modelSelection,
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

  /**
   * Phase 1 of startup: build every account pool, register the provider
   * modules, and mount the DSH injection bridge. Disk-bound and fast. The
   * account auto-provisioning in {@link init} is deliberately not part of this
   * phase, because it can wait on a provider's network round-trip.
   *
   * @returns The runtime, once the pools and routes exist.
   */
  async whenPrepared() {
    if (this.#prepared) return this;
    if (this.#preparePromise) return this.#preparePromise;
    this.#preparePromise = (async () => {
      const state = await this.stateStore.load();
      if (state?.pools?.opencode || state?.pools?.kilo || state?.modelSelection?.providers?.opencode || state?.modelSelection?.providers?.kilo) {
        if (typeof this.stateStore.update === "function") {
          await this.stateStore.update((latest) => {
            if (latest?.pools) {
              delete latest.pools.opencode;
              delete latest.pools.kilo;
            }
            if (latest?.modelSelection?.providers) {
              delete latest.modelSelection.providers.opencode;
              delete latest.modelSelection.providers.kilo;
            }
            return latest;
          }).catch(() => {});
        }
      }
      await this.contextWindowOverrides.ready();
      await this.modelSelection.ready();
      for (const entry of this.providers) {
        const providerId = entry.module.manifest.id;
        const stored = state.pools?.[providerId] ?? {};
        this.#stateBaselines.set(providerId, structuredClone({
          policy: stored.policy ?? ACCOUNT_SELECTION_POLICY.ROUND_ROBIN,
          defaultAccountId: stored.defaultAccountId ?? null,
          accounts: Array.isArray(stored.accounts) ? stored.accounts : [],
        }));
        const pool = new AccountPool({
          providerId,
          policy: stored.policy ?? ACCOUNT_SELECTION_POLICY.ROUND_ROBIN,
        });
        for (const account of Array.isArray(stored.accounts) ? stored.accounts : []) {
          if (account?.auth?.credentialRef) {
            pool.upsert({ ...account, credentialRef: account.auth.credentialRef });
          }
        }
        if (stored.defaultAccountId && pool.get(stored.defaultAccountId)) {
          pool.setDefaultAccount(stored.defaultAccountId);
        }
        this.#entries.set(providerId, { ...entry, pool });
        // A DSH host may already have mounted a provider module before the
        // Dockyard integration starts. Reuse that registration instead of
        // aborting the whole subscription snapshot with a module conflict.
        if (!this.runtime.has(providerId)) await this.runtime.register(entry.module);
        await this.bridge.mountProvider(entry.module, pool);
      }
      this.#prepared = true;
      return this;
    })();
    try {
      return await this.#preparePromise;
    } finally {
      this.#preparePromise = null;
    }
  }

  async init() {
    if (this.#initialized) return this;
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = (async () => {
      await this.whenPrepared();
      const autoImported = new Set();
      for (const [providerId, entry] of this.#entries) {
        const pool = entry.pool;
        const hasExpiredOfficialSession = pool.list().some((a) => a.resources?.accountScope === "active_official_session" && a.health?.status === ACCOUNT_HEALTH.EXPIRED);
        const hasNoEligible = pool.list().filter((a) => a.health?.status !== ACCOUNT_HEALTH.EXPIRED).length === 0;
        const autoProvision = this.hasProviderCapability(providerId, PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT)
          && pool.list().length === 0;
        if (autoProvision || (hasExpiredOfficialSession && hasNoEligible)) {
          try {
            const discovery = await (entry.module?.discover?.(providerContext(this)) ?? entry.driver?.discover?.(providerContext(this)));
            const candidates = Array.isArray(discovery?.candidates)
              ? discovery.candidates
              : (Array.isArray(discovery) ? discovery : []);
            for (const candidate of candidates) {
              if (candidate && candidate.status !== "unavailable" && typeof entry.module?.importAccount === "function") {
                if (!pool.get(candidate.accountId)) {
                  const account = await entry.module.importAccount(candidate, providerContext(this));
                  const obsoleteOfficial = pool.list().find((a) => (
                    a.resources?.accountScope === "active_official_session"
                    && candidate.resources?.accountScope === "active_official_session"
                    && a.accountId !== account.accountId
                  ));
                  if (obsoleteOfficial) {
                    pool.remove(obsoleteOfficial.accountId);
                  }
                  pool.upsert(account, { resetHealth: true });
                  if (!pool.getDefaultAccountId()) {
                    pool.setDefaultAccount(account.accountId);
                  }
                  autoImported.add(providerId);
                }
              }
            }
          } catch {
            // best-effort auto-import
          }
        }
      }
      // Free/zero-config providers start with an auto-provisioned account; make
      // sure that initial state is persisted even when no new import happened
      // during this boot. The set of such providers is declared, not hardcoded.
      for (const [id, entry] of this.#entries) {
        if (this.hasProviderCapability(id, PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT)
          && entry.pool?.list()?.length > 0) {
          autoImported.add(id);
        }
      }
      if (autoImported.size > 0) {
        await this.#saveState([...autoImported]).catch(() => {});
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

  // Host code should ask the module what it supports instead of branching on
  // provider ids. Capabilities are declared once in each provider module.
  getProviderCapabilities(providerId) {
    const manifest = this.providers.find(({ module }) => module.manifest.id === providerId)?.module.manifest;
    return new Set(Array.isArray(manifest?.capabilities) ? manifest.capabilities : []);
  }

  hasProviderCapability(providerId, capability) {
    return this.getProviderCapabilities(providerId).has(capability);
  }

  listProviderIds() {
    return this.providers.map(({ module }) => module.manifest.id);
  }

  /**
   * Ask a provider what the user has to do when it has no authorization entry
   * point of its own (a desktop-session provider, for example). The host keeps
   * one generic message for every provider that answers null.
   */
  async authorizationInstructions(providerId) {
    const module = this.providers.find((entry) => entry.module.manifest.id === providerId)?.module;
    if (typeof module?.authorizationInstructions !== "function") return null;
    try {
      const text = await module.authorizationInstructions(providerContext(this, {}));
      return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
    } catch {
      return null;
    }
  }

  async scan(providerId = null) {
    await this.init();
    const entries = providerId
      ? [[providerId, this.#entry(providerId)]]
      : [...this.#entries];
    const providers = [];
    const changedProviderIds = new Set();
    for (const [currentProviderId, entry] of entries) {
      let result;
      try {
        result = await entry.module.discover(providerContext(this, {
          accounts: entry.pool.list(),
        }));
      } catch (error) {
        result = { candidates: [], source: "provider", diagnostics: [redactError(error)] };
      }
      const rawCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
      this.#candidates.set(currentProviderId, new Map(rawCandidates.map((candidate) => [candidate.candidateId, candidate])));
      for (const candidate of rawCandidates) {
        const existing = entry.pool.get(candidate.accountId);
        const candidateIdentity = candidate.resources ?? {};
        const existingIdentity = existing?.resources ?? {};
        if (!existing) {
          const obsoleteOfficial = entry.pool.list().find((a) => (
            a.resources?.accountScope === "active_official_session"
            && candidate.resources?.accountScope === "active_official_session"
            && a.accountId !== candidate.accountId
            && a.health?.status === ACCOUNT_HEALTH.EXPIRED
          ));
          if (obsoleteOfficial && typeof entry.module.importAccount === "function") {
            try {
              const imported = await entry.module.importAccount(candidate, providerContext(this));
              entry.pool.remove(obsoleteOfficial.accountId);
              entry.pool.upsert(imported, { resetHealth: true });
              if (entry.pool.getDefaultAccountId() === obsoleteOfficial.accountId) {
                entry.pool.setDefaultAccount(imported.accountId);
              }
              changedProviderIds.add(currentProviderId);
            } catch {
              // best-effort auto-import on official session switch
            }
          }
          continue;
        }

        const identityChanged = candidate.email !== existing.email
          || candidate.displayName !== existing.displayName
          || candidateIdentity.identitySource !== existingIdentity.identitySource
          || candidateIdentity.identityLabel !== existingIdentity.identityLabel
          || candidateIdentity.sessionFingerprint !== existingIdentity.sessionFingerprint
          || candidateIdentity.identityNote !== existingIdentity.identityNote
          || candidateIdentity.sessionPersistence !== existingIdentity.sessionPersistence;
        if (identityChanged) {
          entry.pool.upsert({
            accountId: candidate.accountId,
            ...(candidate.email !== undefined ? { email: candidate.email } : {}),
            ...(candidate.displayName !== undefined ? { displayName: candidate.displayName } : {}),
            ...(candidate.resources ? { resources: candidate.resources } : {}),
          });
          changedProviderIds.add(currentProviderId);
        }

        // Antigravity can now capture the current local session into the DSH
        // credential vault. Use that once to upgrade a legacy `active` record
        // and whenever the official session token was refreshed, without
        // copying the token into the public snapshot.
        const fingerprintChanged = candidate.resources?.sessionPersistence === "captured"
          && candidate.resources.sessionFingerprint
          && candidate.resources.sessionFingerprint !== existing.resources?.sessionFingerprint;
        if (fingerprintChanged && typeof entry.module.importAccount === "function") {
          try {
            const captured = await entry.module.importAccount(candidate, providerContext(this));
            entry.pool.upsert(captured, { resetHealth: true });
            changedProviderIds.add(currentProviderId);
          } catch {
            // Keep the existing account usable through its current provider
            // session; the next explicit add/scan can retry the capture.
          }
        }

        // Grok's official auth.json is the durable source of its OAuth
        // refresh token. Repair accounts imported by an older browser flow
        // (or without email metadata) from that source during discovery;
        // otherwise the UI can show a UUID while quota requests keep using a
        // stale Keychain credential.
        const shouldRepairLegacyCredential = this.hasProviderCapability(
          currentProviderId,
          PROVIDER_BEHAVIOR_CAPABILITIES.REPAIR_LEGACY_CREDENTIAL,
        )
          && typeof entry.module.importAccount === "function"
          && ((candidate.email && !existing.email)
            || (candidate.source && candidate.source !== existingIdentity.authSource));
        if (shouldRepairLegacyCredential) {
          try {
            const repaired = await entry.module.importAccount(candidate, providerContext(this));
            entry.pool.upsert(repaired, { resetHealth: true });
            changedProviderIds.add(currentProviderId);
          } catch {
            // Discovery metadata can still repair the visible identity even
            // when secure credential migration is unavailable.
          }
        }
      }
      const summarize = candidateSummarizers.get(currentProviderId) ?? ((candidate) => ({ ...candidate }));
      const candidates = rawCandidates.map((candidate) => ({
        ...summarize(candidate),
        imported: Boolean(entry.pool.get(candidate.accountId)),
      }));
      providers.push({
        providerId: currentProviderId,
        manifest: { ...entry.module.manifest },
        policy: entry.pool.policy,
        accounts: entry.pool.list(),
        candidates,
        source: result?.source ?? "unknown",
        diagnostics: result?.diagnostics ?? [],
      });
    }
    if (changedProviderIds.size > 0) await this.#saveState(changedProviderIds);
    return {
      generatedAt: new Date().toISOString(),
      providers,
      routes: this.bridge.listRoutes(),
    };
  }

  async importCandidate(providerId, candidateId) {
    await this.init();
    const entry = this.#entry(providerId);
    const candidate = this.#candidates.get(providerId)?.get(candidateId);
    if (!candidate) throw new Error("Candidate is missing; scan local OAuth states again");
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let rawAccount;
      try {
        rawAccount = await entry.module.importAccount(candidate, providerContext(this));
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
        needsRefresh: true,
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
        rawAccounts = Array.isArray(imported)
          ? imported
          : Array.isArray(imported?.accounts) ? imported.accounts : [imported];
        const importable = rawAccounts.filter((account) => account?.accountId);
        if (importable.length === 0) throw new Error("OAuth source did not contain an importable account");
        for (const account of importable) entry.pool.upsert(account, { resetHealth: true });
        await this.#saveState([providerId]);
        return {
          accounts: importable.map((account) => entry.pool.get(account.accountId)),
          diagnostics: [],
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
      accounts: entry.pool.list(),
    });
    // Login/Add is always a new account operation. Existing desktop/CLI
    // sessions are discovered by scan(), while this path must open the
    // provider-owned browser OAuth flow so the user can choose another account.
    // Providers may still fall back to their official CLI when browser OAuth
    // is unavailable or explicitly disabled.
    const result = await entry.module.startAuthorization(context);
    return this.#persistAuthorizationResult(entry, providerId, result);
  }

  async pollAuthorization(providerId, sessionId) {
    await this.init();
    const entry = this.#entry(providerId);
    const result = await entry.module.pollAuthorization(sessionId, providerContext(this, {
      accounts: entry.pool.list(),
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
      accounts: entry.pool.list(),
    }));
  }

  async refreshAccount(providerId, accountId, { force = false, tolerateFailure = false } = {}) {
    await this.init();
    // Deduplicate only calls with identical semantics: a lenient background
    // refresh must never answer a strict foreground call (and vice versa),
    // and forced refreshes must not be satisfied by cached in-flight ones.
    const key = `${providerId}\u0000${accountId}\u0000${force ? "force" : "auto"}\u0000${tolerateFailure ? "lenient" : "strict"}`;
    const existing = this.#accountRefreshPromises.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        return await withRefreshTimeout(
          (signal) => this.#refreshAccountNow(providerId, accountId, { force, tolerateFailure, signal }),
          { providerId, accountId, timeoutMs: this.refreshTimeoutMs },
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
    providerAccount(entry.pool, accountId);
    const diagnostics = [];
    let authorizationFailure = null;
    let refresh = null;
    try {
      refresh = await entry.module.refreshAccount(
        providerAccount(entry.pool, accountId),
        providerContext(this, { force, signal }),
      );
      // A provider may ignore AbortSignal and resolve after our timeout. Never
      // commit a late refresh result into the live pool.
      if (signal?.aborted) throw signal.reason ?? refreshTimeoutError(providerId, accountId, this.refreshTimeoutMs);
      this.#applyPatch(entry.pool, accountId, refresh);
    } catch (error) {
      if (signal?.aborted) throw error;
      authorizationFailure = error;
      diagnostics.push(`刷新 OAuth 状态失败：${redactError(error)}`);
      entry.pool.report(accountId, {
        status: providerErrorStatus(error),
        message: diagnostics.at(-1),
      });
      if (!tolerateFailure) await this.#saveState([providerId]);
      if (!tolerateFailure) throw error;
    }
    // Do not use a stale access token for quota after OAuth itself returned
    // 401/403. That second request can obscure the actionable reauthorization
    // state with a less useful quota error.
    if (authorizationFailure?.authExpired || authorizationFailure?.authForbidden) {
      await this.#saveState([providerId]);
      return { account: entry.pool.get(accountId), diagnostics };
    }
    try {
      // Some native providers can return the live quota as part of their
      // authentication/status refresh. Reuse that result instead of issuing
      // the same provider request a second time.
      if (refresh && Object.hasOwn(refresh, "quota")) {
        reportPostRefreshHealth(entry.pool, accountId, {
          allowExpiredRecovery: refresh.resources?.quotaSource === "antigravity_native",
        });
        await this.#saveState([providerId]);
        return { account: entry.pool.get(accountId), diagnostics };
      }
      const quota = await entry.module.getQuota(
        providerAccount(entry.pool, accountId),
        providerContext(this, { signal }),
      );
      if (signal?.aborted) throw signal.reason ?? refreshTimeoutError(providerId, accountId, this.refreshTimeoutMs);
      this.#applyPatch(entry.pool, accountId, quota);
      // A provider refresh may only prove that its CLI/session metadata is
      // readable. Do not erase a native-request auth failure merely because a
      // later CLI status check succeeds; reauthorization/import is the action
      // that explicitly clears an expired transport credential.
      reportPostRefreshHealth(entry.pool, accountId, {
        allowExpiredRecovery: quota.resources?.quotaSource === "antigravity_native",
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      diagnostics.push(`刷新实时额度失败：${redactError(error)}`);
      entry.pool.report(accountId, {
        status: providerErrorStatus(error),
        message: diagnostics.at(-1),
      });
      if (!tolerateFailure) await this.#saveState([providerId]);
      if (!tolerateFailure) throw error;
    }
    await this.#saveState([providerId]);
    return { account: entry.pool.get(accountId), diagnostics };
  }

  /**
   * Retry accounts parked by an expired authorization once their cooldown has
   * passed. Cheap when nothing is parked, so a host may call it on a timer.
   *
   * @returns {Promise<Array<{providerId: string, accountId: string}>>} Accounts
   *   that were retried (whether or not they came back healthy).
   */
  async relistExpiredAccounts(providerId = null) {
    await this.whenPrepared();
    const providerIds = providerId ? [providerId] : [...this.#entries.keys()];
    const relisted = [];
    for (const id of providerIds) {
      const pool = this.#entries.get(id)?.pool;
      if (typeof pool?.relistable !== "function") continue;
      for (const account of pool.relistable()) {
        try {
          await this.refreshAccount(id, account.accountId, { tolerateFailure: true });
          relisted.push({ providerId: id, accountId: account.accountId });
        } catch {
          // Still parked; the next pass will try again.
        }
      }
    }
    return relisted;
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

  async setPolicy(providerId, policy, defaultAccountId = undefined) {
    await this.init();
    const pool = this.#entry(providerId).pool;
    pool.setPolicy(policy);
    if (defaultAccountId !== undefined) pool.setDefaultAccount(defaultAccountId);
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
        diagnostics.push(`清理本机 Keychain 引用失败：${redactError(error)}`);
      }
    }
    return {
      providerId,
      accountId,
      removed: true,
      defaultAccountId: entry.pool.getDefaultAccountId(),
      diagnostics,
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

  getModelSelection(providerId, accountId = null) {
    return this.modelSelection.get(providerId, accountId);
  }

  async setModelSelection(providerId, enabledModelIds, accountId = null) {
    await this.init();
    return this.modelSelection.set(providerId, enabledModelIds, accountId);
  }

  async getCatalog(providerId, context = {}) {
    await this.init();
    const entry = this.#entry(providerId);
    const accounts = entry.pool.list().map((account) => providerAccount(entry.pool, account.accountId));
    // A provider serves a different model list per account (a paid tier and a
    // free one differ), so discovery resolves the account that would serve the
    // request instead of asking "the provider" in the abstract.
    const accountId = context.accountId
      ?? entry.pool.getDefaultAccountId()
      ?? (accounts.length === 1 ? accounts[0].accountId : null);
    return entry.module.getCatalog(providerContext(this, { ...context, accounts, accountId }));
  }

  /** The account a provider would use by default, if it has one. */
  getDefaultAccountId(providerId) {
    const pool = this.#entries.get(providerId)?.pool;
    return typeof pool?.getDefaultAccountId === "function" ? pool.getDefaultAccountId() : null;
  }

  async invoke(providerId, request, context = {}) {
    await this.init();
    const route = this.bridge.getRoute(providerId);
    if (!route) throw new Error(`Unknown Dockyard provider route: ${providerId}`);
    try {
      return await route.invoke(request, providerContext(this, context));
    } finally {
      // The route reports rate-limit/quota/auth results into the in-memory
      // pool while invoking. Persist them so a restart sees the same health
      // instead of re-selecting a failed account.
      await this.#saveState([providerId]).catch(() => {});
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
        // dsh-route reports success/auth failure while the stream is being
        // consumed. Persist that result after either completion or failure so
        // a later popup refresh and a process restart see the same health.
        try {
          await runtime.#saveState([providerId]);
        } catch {
          // Never replace the provider's response error with a state-store
          // error. The next explicit refresh can still persist the snapshot.
        }
      }
    })();
  }

  snapshot() {
    return {
      generatedAt: new Date().toISOString(),
      providers: [...this.#entries].map(([providerId, entry]) => ({
        providerId,
        manifest: { ...entry.module.manifest },
        policy: entry.pool.policy,
        defaultAccountId: entry.pool.getDefaultAccountId(),
        // Advisory warnings derived from what the provider already reported: a
        // window nearly spent, or one that resets soon while mostly unused.
        accounts: entry.pool.list().map((account) => ({
          ...account,
          alerts: evaluateQuotaAlerts(account),
        })),
      })),
      routes: this.bridge.listRoutes(),
    };
  }

  #applyPatch(pool, accountId, patch = {}) {
    if (!patch || typeof patch !== "object") return;
    const input = { accountId };
    for (const key of ["email", "displayName", "subscription", "quota", "balance", "refresh", "resources"]) {
      if (patch[key] !== undefined) input[key] = patch[key];
    }
    if (patch.identity?.email !== undefined) input.email = patch.identity.email;
    if (patch.identity?.displayName !== undefined) input.displayName = patch.identity.displayName;
    if (patch.credits !== undefined) input.resources = { credits: patch.credits };
    pool.upsert(input);
  }

  async #persistAuthorizationResult(entry, providerId, result) {
    if (result?.status !== "completed") return result;
    const rawAccounts = Array.isArray(result.accounts)
      ? result.accounts
      : result.account ? [result.account] : [];
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let accounts = [];
      try {
        accounts = await this.#storeImportedAccounts(entry, rawAccounts);
        await this.#saveState([providerId]);
      } catch (error) {
        // Roll the pool back to the pre-import snapshot so a partially
        // completed authorization cannot leave half-registered accounts
        // behind, and drop credentials written for this import only.
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
    this.#providerImportQueues.set(providerId, run.then(() => {}, () => {}));
    return run;
  }

  async #storeImportedAccounts(entry, rawAccounts) {
    const accounts = [];
    for (const account of rawAccounts.filter((value) => value?.accountId)) {
      // Provider OAuth authorizers may return either an already-imported
      // account (with an opaque auth reference) or a short-lived candidate
      // carrying the credential material in a private field. Import the
      // latter before putting it into the pool; otherwise the snapshot looks
      // authenticated while the native request falls back to an old local
      // session.
      const alreadyImported = Boolean(
        account?.auth?.credentialRef
          || (account?.auth?.kind && account?.credentialRef && !account?.candidateId),
      );
      const imported = alreadyImported || typeof entry.module.importAccount !== "function"
        ? account
        : await entry.module.importAccount(account, providerContext(this));
      entry.pool.upsert(imported, { resetHealth: true });
      accounts.push(entry.pool.get(imported.accountId));
    }
    return accounts;
  }

  async #saveState(changedProviderIds = null) {
    // Serialize writes within one runtime. JsonStateStore.update() also holds
    // a cross-process lock while loading and saving the merged snapshot.
    const write = async () => {
      const changed = changedProviderIds === null
        ? new Set(this.#entries.keys())
        : new Set(changedProviderIds);
      const merge = (latest) => {
        const pools = {
          ...(latest?.pools && typeof latest.pools === "object" ? latest.pools : {}),
        };
        for (const [providerId, entry] of this.#entries) {
          if (!changed.has(providerId) && Object.hasOwn(pools, providerId)) continue;
          const current = providerStorageSnapshot(entry);
          pools[providerId] = mergeProviderStorage(
            pools[providerId],
            current,
            this.#stateBaselines.get(providerId),
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
    this.#saveQueue = queued.catch(() => {});
    await queued;
  }
}
