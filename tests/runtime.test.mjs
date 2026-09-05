import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ACCOUNT_SELECTION_POLICY, ModuleRuntime } from "../packages/core/src/index.mjs";
import { MemorySecretStore } from "../packages/vault/src/index.mjs";
import { JsonStateStore } from "../packages/runtime/src/state-store.mjs";
import { DockyardRuntime } from "../packages/runtime/src/dockyard-runtime.mjs";

function fakeModule() {
  return {
    manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
    async activate(context) {
      context.registerService("provider:test-provider", this);
    },
    async discover() { return { candidates: [], diagnostics: [] }; },
    async importAccount() { throw new Error("not used"); },
    async refreshAccount() { return {}; },
    async getQuota() { return {}; },
    async getCatalog() { return { models: [] }; },
    async invoke() { return {}; },
  };
}

test("runtime reloads account-pool metadata without exposing credentials", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          policy: ACCOUNT_SELECTION_POLICY.MANUAL,
          defaultAccountId: "account-a",
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://opaque-ref", scopes: [] },
            email: "live@example.test",
            quota: { remaining: 4, limit: 10, unit: "requests" },
          }],
        },
      },
    });
    const runtime = new DockyardRuntime({
      providers: [{ module: fakeModule() }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await runtime.init();
    const snapshot = runtime.snapshot();
    assert.equal(snapshot.providers[0].defaultAccountId, "account-a");
    assert.equal(snapshot.providers[0].accounts[0].email, "live@example.test");
    assert.equal(snapshot.providers[0].accounts[0].auth, undefined);
    const scanned = await runtime.scan();
    assert.deepEqual(scanned.routes, ["test-provider"]);
    const targeted = await runtime.scan("test-provider");
    assert.deepEqual(targeted.providers.map((provider) => provider.providerId), ["test-provider"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime reuses a provider module already registered by the DSH host", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-existing-module-"));
  try {
    const hostRuntime = new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } });
    await hostRuntime.register(fakeModule());
    const runtime = new DockyardRuntime({
      providers: [{ module: fakeModule() }],
      runtime: hostRuntime,
      stateStore: new JsonStateStore({ home }),
      secretStore: new MemorySecretStore(),
    });

    await runtime.init();
    assert.deepEqual(runtime.snapshot().routes, ["test-provider"]);
    assert.equal(runtime.snapshot().providers[0].providerId, "test-provider");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime upgrades a legacy discovered session without exposing its credential", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-session-capture-"));
  const credentialRef = "keychain://legacy-session";
  const secretStore = new MemorySecretStore();
  let discoveredAccounts;
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-active",
            auth: { kind: "oauth", credentialRef, scopes: [] },
            displayName: "active session",
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover(context) {
        discoveredAccounts = context.accounts;
        return {
          candidates: [{
            providerId: "test-provider",
            candidateId: "candidate-session",
            accountId: "account-active",
            credentialRef,
            displayName: "account@example.test",
            email: "account@example.test",
            resources: {
              identitySource: "official_cli_auth_status",
              identityLabel: "account@example.test",
              identityNote: "账号邮箱来自官方登录态",
              sessionFingerprint: "A1B2C3D4E5",
              sessionPersistence: "captured",
            },
          }],
        };
      },
      async importAccount(candidate, context) {
        await context.secretStore.write(candidate.credentialRef, { access: "captured-secret" });
        return {
          providerId: "test-provider",
          accountId: candidate.accountId,
          credentialRef: candidate.credentialRef,
          displayName: candidate.displayName,
          email: candidate.email,
          resources: candidate.resources,
        };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore,
    });
    await runtime.scan("test-provider");
    assert.equal(discoveredAccounts[0].accountId, "account-active");
    assert.equal(runtime.snapshot().providers[0].accounts[0].email, "account@example.test");
    assert.equal(runtime.snapshot().providers[0].accounts[0].auth, undefined);
    assert.equal((await secretStore.read(credentialRef)).access, "captured-secret");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime repairs a Grok account from the durable local OAuth source", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-grok-repair-"));
  const secretStore = new MemorySecretStore();
  let imports = 0;
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        grok: {
          accounts: [{
            providerId: "grok",
            accountId: "grok-account",
            auth: { kind: "oauth", credentialRef: "keychain://grok-account", scopes: [] },
            displayName: "grok-account",
            email: null,
            resources: { authSource: "official_grok_browser_oauth", sessionSource: "browser" },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "grok", kind: "provider", displayName: "Grok" },
      async activate(context) { context.registerService("provider:grok", this); },
      async discover() {
        return {
          candidates: [{
            providerId: "grok",
            candidateId: "grok:candidate",
            source: "official_grok_oauth",
            accountId: "grok-account",
            displayName: "grok@example.test",
            email: "grok@example.test",
            resources: { authSource: "official_grok_oauth", sessionSource: "oauth_file" },
          }],
        };
      },
      async importAccount(candidate, context) {
        imports += 1;
        await context.secretStore.write("keychain://grok-account", { access: "fresh-grok-token", email: candidate.email });
        return {
          providerId: "grok",
          accountId: candidate.accountId,
          credentialRef: "keychain://grok-account",
          displayName: candidate.displayName,
          email: candidate.email,
          resources: candidate.resources,
        };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore,
    });
    await runtime.scan("grok");
    const account = runtime.snapshot().providers[0].accounts[0];
    assert.equal(imports, 1);
    assert.equal(account.email, "grok@example.test");
    assert.equal(account.resources.authSource, "official_grok_oauth");
    assert.equal((await secretStore.read("keychain://grok-account")).access, "fresh-grok-token");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime passes only the opaque credential reference to provider operations", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-provider-"));
  const seen = [];
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://opaque-ref", scopes: [] },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount(account) {
        seen.push({ operation: "refresh", auth: account.auth });
        return {};
      },
      async getQuota(account) {
        seen.push({ operation: "quota", auth: account.auth });
        return {};
      },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await runtime.refreshAccount("test-provider", "account-a");
    assert.deepEqual(seen, [
      { operation: "refresh", auth: { kind: "oauth", credentialRef: "keychain://opaque-ref", scopes: [] } },
      { operation: "quota", auth: { kind: "oauth", credentialRef: "keychain://opaque-ref", scopes: [] } },
    ]);
    assert.equal(runtime.snapshot().providers[0].accounts[0].auth, undefined);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime refreshes accounts concurrently and bounds a stuck quota request", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-refresh-boundary-"));
  let active = 0;
  let maxActive = 0;
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [
            {
              providerId: "test-provider",
              accountId: "account-fast",
              auth: { kind: "oauth", credentialRef: "keychain://fast", scopes: [] },
              quota: { remaining: 4, limit: 10, unit: "requests" },
            },
            {
              providerId: "test-provider",
              accountId: "account-stuck",
              auth: { kind: "oauth", credentialRef: "keychain://stuck", scopes: [] },
              quota: { remaining: 3, limit: 10, unit: "requests" },
            },
          ],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount(account) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (account.accountId === "account-stuck") return new Promise(() => {});
        await new Promise((resolve) => setTimeout(resolve, 25));
        active -= 1;
        return {};
      },
      async getQuota(account) {
        return { quota: { remaining: account.accountId === "account-fast" ? 9 : 3, limit: 10, unit: "requests" } };
      },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
      refreshTimeoutMs: 30,
    });
    const startedAt = Date.now();
    const results = await runtime.refreshAll("test-provider");
    const elapsed = Date.now() - startedAt;
    assert.equal(maxActive, 2);
    assert.equal(results.length, 2);
    assert.ok(elapsed < 200, "refresh should be bounded, took " + elapsed + "ms");
    assert.match(results.find((entry) => entry.account.accountId === "account-stuck").diagnostics[0], /超时/);
    assert.equal(runtime.snapshot().providers[0].accounts.find((entry) => entry.accountId === "account-stuck").health.status, "degraded");
    assert.equal(runtime.snapshot().providers[0].accounts.find((entry) => entry.accountId === "account-stuck").quota.remaining, 3);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});


test("runtime deduplicates overlapping refreshes for one account", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-refresh-dedup-"));
  let refreshCalls = 0;
  let release;
  const started = new Promise((resolve) => {
    release = resolve;
  });
  let refreshStarted;
  const refreshReady = new Promise((resolve) => { refreshStarted = resolve; });
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://account-a", scopes: [] },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount() {
        refreshCalls += 1;
        refreshStarted();
        await started;
        return { quota: { remaining: 8, limit: 10, unit: "requests" } };
      },
      async getQuota() { throw new Error("quota should not be called after refresh result"); },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    const first = runtime.refreshAccount("test-provider", "account-a");
    await refreshReady;
    const second = runtime.refreshAccount("test-provider", "account-a");
    release();
    await Promise.all([first, second]);
    assert.equal(refreshCalls, 1);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime ignores a late refresh result after its timeout aborts", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-late-refresh-"));
  let release;
  try {
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async refreshAccount() {
        return new Promise((resolve) => { release = () => resolve({ refresh: { accessTokenExpiresAt: "late" } }); });
      },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://late-refresh", scopes: [] },
          }],
        },
      },
    });
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
      refreshTimeoutMs: 10,
    });
    const pending = runtime.refreshAccount("test-provider", "account-a");
    await assert.rejects(pending, /超时|timed out/i);
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.notEqual(runtime.snapshot().providers[0].accounts[0].refresh.accessTokenExpiresAt, "late");
  } finally {
    release?.();
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime does not infer account health from a separate credits field", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-credits-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://credits", scopes: [] },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount() {
        return { credits: { remaining: 0, upgradeUri: "https://provider.test/upgrade" } };
      },
      async getQuota() { return {}; },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await runtime.refreshAccount("test-provider", "account-a");
    const account = runtime.snapshot().providers[0].accounts[0];
    assert.equal(account.resources.credits.remaining, 0);
    assert.equal(account.health.status, "healthy");
    assert.equal(account.health.lastError, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime keeps OAuth usable when an optional quota surface rejects auth", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-quota-surface-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://account-a", scopes: [] },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount() { return {}; },
      async getQuota() {
        const error = new Error("optional quota surface rejected the request");
        error.quotaUnavailable = true;
        throw error;
      },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await assert.rejects(() => runtime.refreshAccount("test-provider", "account-a"));
    const account = runtime.snapshot().providers[0].accounts[0];
    assert.equal(account.health.status, "degraded");
    assert.equal(account.health.lastError, "刷新实时额度失败：optional quota surface rejected the request");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime imports multiple accounts from one provider source into the pool", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-import-"));
  try {
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider", capabilities: ["oauth_source_import"] },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async importSource() {
        return [
          { providerId: "test-provider", accountId: "account-a", credentialRef: "keychain://a", displayName: "A" },
          { providerId: "test-provider", accountId: "account-b", credentialRef: "keychain://b", displayName: "B" },
        ];
      },
      async importAccount() { throw new Error("not used"); },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore: new JsonStateStore({ home }),
      secretStore: new MemorySecretStore(),
    });
    const result = await runtime.importSource("test-provider", { content: "{}", fileName: "accounts.json" });
    assert.deepEqual(result.accounts.map((account) => account.accountId), ["account-a", "account-b"]);
    assert.deepEqual(runtime.snapshot().providers[0].accounts.map((account) => account.accountId), ["account-a", "account-b"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime rolls back imported accounts and uncommitted credentials when persistence fails", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-import-rollback-"));
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://rollback";
  try {
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async importSource(_source, context) {
        await context.secretStore.write(credentialRef, { access: "temporary" });
        return [{ providerId: "test-provider", accountId: "account-a", credentialRef }];
      },
      async importAccount() { throw new Error("not used"); },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const stateStore = {
      async load() { return { schema: 1, pools: {} }; },
      async save() { throw new Error("disk full"); },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore,
    });
    await assert.rejects(() => runtime.importSource("test-provider", {}), /disk full/);
    assert.deepEqual(runtime.snapshot().providers[0].accounts, []);
    assert.equal(await secretStore.read(credentialRef), null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime persists credentials returned by an OAuth authorization session before pooling the account", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-auth-import-"));
  const credentialRef = "keychain://oauth-session";
  const secretStore = new MemorySecretStore();
  try {
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async importAccount(candidate, context) {
        await context.secretStore.write(credentialRef, { access: "fresh-oauth-secret" });
        return {
          providerId: "test-provider",
          accountId: candidate.accountId,
          credentialRef,
          displayName: candidate.displayName,
          auth: { kind: "oauth", credentialRef, scopes: [] },
        };
      },
      async startAuthorization() {
        return { sessionId: "test-provider:session", providerId: "test-provider", status: "pending" };
      },
      async pollAuthorization() {
        return {
          sessionId: "test-provider:session",
          providerId: "test-provider",
          status: "completed",
          accounts: [{ providerId: "test-provider", accountId: "account-fresh", displayName: "Fresh account" }],
        };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore: new JsonStateStore({ home }),
      secretStore,
    });

    const result = await runtime.pollAuthorization("test-provider", "test-provider:session");
    assert.deepEqual(result.accounts.map((account) => account.accountId), ["account-fresh"]);
    assert.equal(await secretStore.read(credentialRef).then((value) => value.access), "fresh-oauth-secret");
    assert.equal(runtime.snapshot().providers[0].accounts[0].auth, undefined);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime reloads persisted OAuth accounts and credentials after restart", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-restart-oauth-"));
  const credentialRef = "keychain://restart-oauth";
  const secretStore = new MemorySecretStore();
  let refreshCalls = 0;
  const createModule = () => ({
    manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
    async activate(context) { context.registerService("provider:test-provider", this); },
    async discover() { return { candidates: [] }; },
    async importSource(_source, context) {
      await context.secretStore.write(credentialRef, { access: "persisted-access", refresh: "persisted-refresh" });
      return [{
        providerId: "test-provider",
        accountId: "restart-account",
        credentialRef,
        auth: { kind: "oauth", credentialRef, scopes: [] },
      }];
    },
    async refreshAccount(account, context) {
      refreshCalls += 1;
      assert.equal(account.auth.credentialRef, credentialRef);
      assert.equal((await context.secretStore.read(credentialRef)).access, "persisted-access");
      return { refresh: { refreshable: true } };
    },
    async getQuota() { return {}; },
    async getCatalog() { return { models: [] }; },
    async invoke() { return {}; },
  });
  const runtimeOptions = () => ({
    runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
    stateStore: new JsonStateStore({ home }),
    secretStore,
  });
  try {
    const first = new DockyardRuntime({ providers: [{ module: createModule() }], ...runtimeOptions() });
    await first.importSource("test-provider", { content: "{}", fileName: "oauth.json" });

    const second = new DockyardRuntime({ providers: [{ module: createModule() }], ...runtimeOptions() });
    const refreshed = await second.refreshAccount("test-provider", "restart-account", { force: true });
    assert.equal(refreshCalls, 1);
    assert.equal(refreshed.account.accountId, "restart-account");
    assert.equal(refreshed.account.health.status, "healthy");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime passes opaque account references to provider catalog loading", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-catalog-context-"));
  let catalogContext = null;
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "catalog-account",
            email: "catalog@example.test",
            auth: { kind: "oauth", credentialRef: "keychain://catalog-account", scopes: [] },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async getCatalog(context) {
        catalogContext = context;
        return { models: [] };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await runtime.getCatalog("test-provider");
    assert.equal(catalogContext.accounts[0].accountId, "catalog-account");
    assert.equal(catalogContext.accounts[0].auth.credentialRef, "keychain://catalog-account");
    assert.equal(catalogContext.accounts[0].email, "catalog@example.test");
    await runtime.getCatalog("test-provider", { force: true });
    assert.equal(catalogContext.force, true);
    assert.equal(catalogContext.accounts[0].accountId, "catalog-account");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime always starts browser add flow instead of importing an active session", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-active-session-"));
  let activeCalls = 0;
  let authorizationCalls = 0;
  try {
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async getActiveSession() {
        activeCalls += 1;
        return {
          status: "completed",
          providerId: "test-provider",
          accounts: [{ accountId: "desktop-account" }],
        };
      },
      async startAuthorization(context) {
        authorizationCalls += 1;
        assert.deepEqual(context.accounts, []);
        return { sessionId: "test-provider:browser:new", providerId: "test-provider", status: "pending" };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore: new JsonStateStore({ home }),
      secretStore: new MemorySecretStore(),
    });

    const result = await runtime.startAuthorization("test-provider");
    assert.equal(result.status, "pending");
    assert.equal(activeCalls, 0);
    assert.equal(authorizationCalls, 1);
    assert.deepEqual(runtime.snapshot().providers[0].accounts, []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime starts a new browser flow when an account already exists", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-add-account-"));
  let activeCalls = 0;
  let authorizationCalls = 0;
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "existing-account",
            auth: { kind: "oauth", credentialRef: "keychain://existing-account", scopes: [] },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async getActiveSession() {
        activeCalls += 1;
        return { status: "completed", accounts: [{ accountId: "wrong-active-account" }] };
      },
      async startAuthorization(context) {
        authorizationCalls += 1;
        assert.equal(context.accounts.length, 1);
        return { sessionId: "test-provider:browser:new", providerId: "test-provider", status: "pending" };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    const result = await runtime.startAuthorization("test-provider");
    assert.equal(result.status, "pending");
    assert.equal(activeCalls, 0);
    assert.equal(authorizationCalls, 1);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime does not import an already-imported OAuth account a second time", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-auth-normalized-"));
  let importCalls = 0;
  try {
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async importAccount() {
        importCalls += 1;
        throw new Error("normalized OAuth account must not be imported again");
      },
      async startAuthorization() { return { sessionId: "test-provider:session", status: "pending" }; },
      async pollAuthorization() {
        return {
          sessionId: "test-provider:session",
          providerId: "test-provider",
          status: "completed",
          accounts: [{
            providerId: "test-provider",
            accountId: "account-normalized",
            credentialRef: "keychain://already-imported",
            auth: { kind: "oauth", scopes: [] },
          }],
        };
      },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore: new JsonStateStore({ home }),
      secretStore: new MemorySecretStore(),
    });

    const result = await runtime.pollAuthorization("test-provider", "test-provider:session");
    assert.equal(importCalls, 0);
    assert.equal(result.accounts[0].accountId, "account-normalized");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime removes an account, clears the default, and deletes its secret", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-remove-"));
  const credentialRef = "keychain://remove-me";
  const secretStore = new MemorySecretStore();
  await secretStore.write(credentialRef, { access: "sensitive" });
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          policy: ACCOUNT_SELECTION_POLICY.MANUAL,
          defaultAccountId: "account-a",
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef, scopes: [] },
            email: "remove@example.test",
          }],
        },
      },
    });
    const runtime = new DockyardRuntime({
      providers: [{ module: fakeModule() }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore,
    });

    const result = await runtime.removeAccount("test-provider", "account-a");
    assert.deepEqual(result, {
      providerId: "test-provider",
      accountId: "account-a",
      removed: true,
      defaultAccountId: null,
      diagnostics: [],
    });
    assert.equal(runtime.snapshot().providers[0].defaultAccountId, null);
    assert.deepEqual(runtime.snapshot().providers[0].accounts, []);
    assert.equal(await secretStore.read(credentialRef), null);
    const persisted = await stateStore.load();
    assert.deepEqual(persisted.pools["test-provider"].accounts, []);
    assert.equal(persisted.pools["test-provider"].defaultAccountId, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime saves only the provider it changed when runtimes share state", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-shared-state-"));
  try {
    const stateStore = new JsonStateStore({ home });
    const account = (providerId, accountId) => ({
      providerId,
      accountId,
      auth: { kind: "oauth", credentialRef: `keychain://${providerId}/${accountId}`, scopes: [] },
    });
    await stateStore.save({
      pools: {
        "provider-a": { accounts: [account("provider-a", "a")] },
        "provider-b": { accounts: [account("provider-b", "b")] },
      },
    });
    const moduleFor = (providerId) => ({
      manifest: { id: providerId, kind: "provider", displayName: providerId },
      async activate(context) { context.registerService(`provider:${providerId}`, this); },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    });
    const runtimeA = new DockyardRuntime({
      providers: [{ module: moduleFor("provider-a") }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    const runtimeB = new DockyardRuntime({
      providers: [{ module: moduleFor("provider-b") }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await Promise.all([runtimeA.init(), runtimeB.init()]);
    await Promise.all([
      runtimeA.setPolicy("provider-a", ACCOUNT_SELECTION_POLICY.MANUAL),
      runtimeB.setPolicy("provider-b", ACCOUNT_SELECTION_POLICY.MANUAL),
    ]);
    const persisted = await stateStore.load();
    assert.deepEqual(persisted.pools["provider-a"].accounts.map((entry) => entry.accountId), ["a"]);
    assert.deepEqual(persisted.pools["provider-b"].accounts.map((entry) => entry.accountId), ["b"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("a stale same-provider save does not resurrect a removed account", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-same-provider-state-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-a",
            auth: { kind: "oauth", credentialRef: "keychain://same-provider", scopes: [] },
          }],
        },
      },
    });
    const moduleFor = () => ({
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async refreshAccount() { return {}; },
      async getQuota() { return {}; },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    });
    const makeRuntime = () => new DockyardRuntime({
      providers: [{ module: moduleFor() }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    const first = makeRuntime();
    const second = makeRuntime();
    await Promise.all([first.init(), second.init()]);
    await first.removeAccount("test-provider", "account-a");
    await second.setPolicy("test-provider", ACCOUNT_SELECTION_POLICY.MANUAL);
    assert.deepEqual((await stateStore.load()).pools["test-provider"].accounts, []);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime keeps an exhausted account out of the pool after a successful refresh", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-exhausted-refresh-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-empty",
            auth: { kind: "oauth", credentialRef: "keychain://empty", scopes: [] },
            quota: { remaining: 0, limit: 10, unit: "requests" },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount() {
        return { quota: { remaining: 0, limit: 10, unit: "requests" } };
      },
      async getQuota() { return {}; },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await runtime.init();
    await runtime.refreshAccount("test-provider", "account-empty");
    const refreshed = runtime.snapshot().providers[0].accounts.find((entry) => entry.accountId === "account-empty");
    assert.equal(refreshed.quota.remaining, 0);
    // A confirmed zero-quota account must stay exhausted instead of being
    // flipped back to healthy and re-selected for the next request.
    assert.equal(refreshed.health.status, "exhausted");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runtime clears a stale expired state after native quota recovery", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-runtime-native-recovery-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({
      pools: {
        "test-provider": {
          accounts: [{
            providerId: "test-provider",
            accountId: "account-recovered",
            auth: { kind: "oauth", credentialRef: "keychain://recovered", scopes: [] },
            health: { status: "expired", lastError: "stale OAuth refresh failure" },
          }],
        },
      },
    });
    const module = {
      manifest: { id: "test-provider", kind: "provider", displayName: "Test provider" },
      async activate(context) { context.registerService("provider:test-provider", this); },
      async refreshAccount() {
        return {
          quota: { remaining: 1, limit: 1, unit: "fraction" },
          resources: { quotaSource: "antigravity_native" },
        };
      },
      async getQuota() { return {}; },
      async discover() { return { candidates: [] }; },
      async importAccount() { throw new Error("not used"); },
      async getCatalog() { return { models: [] }; },
      async invoke() { return {}; },
    };
    const runtime = new DockyardRuntime({
      providers: [{ module }],
      runtime: new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } }),
      stateStore,
      secretStore: new MemorySecretStore(),
    });
    await runtime.init();
    await runtime.refreshAccount("test-provider", "account-recovered");
    const recovered = runtime.snapshot().providers[0].accounts.find((entry) => entry.accountId === "account-recovered");
    assert.equal(recovered.health.status, "healthy");
    assert.equal(recovered.health.lastError, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("JsonStateStore partial saves preserve other namespaces", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-state-merge-"));
  try {
    const store = new JsonStateStore({ home });
    await store.save({ pools: { test: { accounts: [] } } });
    await store.save({ nativeKeyPools: { test: { policy: "failover" } } });
    const state = await store.load();
    assert.deepEqual(state.pools.test.accounts, []);
    assert.equal(state.nativeKeyPools.test.policy, "failover");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("JsonStateStore recovers from a corrupt state file", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-state-corrupt-"));
  try {
    const stateStore = new JsonStateStore({ home });
    await stateStore.save({ pools: { "test-provider": {} } });
    const { writeFile, readdir } = await import("node:fs/promises");
    await writeFile(stateStore.filePath, "{ this is not json", "utf8");
    const loaded = await stateStore.load();
    assert.deepEqual(loaded.pools, {});
    // The broken file must be archived, not deleted, and a later save must be
    // able to rebuild the snapshot.
    const files = await readdir(join(home, ".dockyard-dsh"));
    assert.ok(files.some((name) => name.includes(".corrupted.")), `expected archived file, got ${files.join(", ")}`);
    await stateStore.save({ pools: { "test-provider": { policy: "manual", accounts: [] } } });
    const reloaded = await stateStore.load();
    assert.equal(reloaded.pools["test-provider"].policy, "manual");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
