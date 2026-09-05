import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_SELECTION_POLICY,
  EventBus,
  ModuleRuntime,
  createProviderRoute,
} from "../packages/core/src/index.mjs";
import { AccountPool } from "../packages/account-pool/src/index.mjs";
import { createCodexModule } from "../modules/provider-codex/src/index.mjs";
import { createAntigravityModule } from "../modules/provider-antigravity/src/index.mjs";
import { createGrokModule } from "../modules/provider-grok/src/index.mjs";
import { DshInjectionBridge, createDshBridgeModule } from "../packages/dsh-bridge/src/index.mjs";
import { createDockyardLlmAdapter } from "../packages/dsh-bridge/src/index.mjs";
import {
  apply as applyDockyardDsh,
  createDockyardCommand,
  DockyardDshService,
} from "../packages/dsh-plugin/src/index.mjs";

const fixedNow = () => new Date("2026-08-14T12:00:00.000Z");

function addAccount(pool, accountId, quota) {
  pool.upsert({
    accountId,
    credentialRef: `keychain://dockyard/${pool.providerId}/${accountId}`,
    displayName: accountId,
    quota,
    refresh: {
      accessTokenExpiresAt: "2026-08-14T13:00:00.000Z",
      nextRefreshAt: "2026-08-14T12:50:00.000Z",
      refreshable: true,
    },
  });
}

test("provider modules register without static provider version data", async () => {
  const runtime = new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } });
  await runtime.register(createCodexModule());
  await runtime.register(createAntigravityModule());
  await runtime.register(createGrokModule());

  assert.deepEqual(runtime.list().map((module) => module.id), ["openai-codex", "antigravity", "grok"]);
  for (const module of runtime.list()) assert.equal(Object.hasOwn(module, "version"), false);
  assert.equal(runtime.hasService("provider:openai-codex"), true);
  assert.equal(runtime.hasService("provider:antigravity"), true);
});

test("account pool retains live quota and refresh metadata", () => {
  const pool = new AccountPool({ providerId: "openai-codex", policy: ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock: fixedNow });
  addAccount(pool, "account-a", {
    remaining: 321,
    limit: 1000,
    unit: "requests",
    resetAt: "2026-08-15T00:00:00.000Z",
    source: "provider",
  });
  addAccount(pool, "account-b", {
    remaining: 654,
    limit: 1000,
    unit: "requests",
    resetAt: "2026-08-15T00:00:00.000Z",
    source: "provider",
  });

  const first = pool.get("account-a");
  assert.equal(first.quota.remaining, 321);
  assert.equal(first.quota.resetAt, "2026-08-15T00:00:00.000Z");
  assert.equal(first.refresh.nextRefreshAt, "2026-08-14T12:50:00.000Z");
  assert.equal(first.auth, undefined);

  const selectedA = pool.select({ requestId: "request-a" });
  const selectedB = pool.select({ requestId: "request-b" });
  const sameRequest = pool.select({ requestId: "request-a" });
  assert.equal(selectedA.accountId, "account-a");
  assert.equal(selectedB.accountId, "account-b");
  assert.equal(sameRequest.accountId, "account-a");

  const updated = pool.report("account-a", {
    status: "success",
    quota: { remaining: 111, resetAt: "2026-08-15T01:00:00.000Z" },
    refresh: { nextRefreshAt: "2026-08-14T12:55:00.000Z" },
  });
  assert.equal(updated.quota.remaining, 111);
  assert.equal(updated.quota.resetAt, "2026-08-15T01:00:00.000Z");
  assert.equal(updated.refresh.nextRefreshAt, "2026-08-14T12:55:00.000Z");
  assert.equal(updated.health.status, "healthy");
});

test("round robin rotates session requests while sticky sessions remain pinned", () => {
  const roundRobin = new AccountPool({ providerId: "round-robin", policy: ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock: fixedNow });
  addAccount(roundRobin, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  addAccount(roundRobin, "account-b", { remaining: 1, limit: 2, unit: "requests" });
  assert.deepEqual([
    roundRobin.select({ sessionId: "session-1" }).accountId,
    roundRobin.select({ sessionId: "session-1" }).accountId,
    roundRobin.select({ sessionId: "session-1" }).accountId,
  ], ["account-a", "account-b", "account-a"]);

  const sticky = new AccountPool({ providerId: "sticky", policy: ACCOUNT_SELECTION_POLICY.STICKY_SESSION, clock: fixedNow });
  addAccount(sticky, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  addAccount(sticky, "account-b", { remaining: 1, limit: 2, unit: "requests" });
  assert.equal(sticky.select({ sessionId: "session-1" }).accountId, "account-a");
  assert.equal(sticky.select({ sessionId: "session-1" }).accountId, "account-a");
});

test("account pool clears the default account when it is removed", () => {
  const pool = new AccountPool({ providerId: "openai-codex", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  pool.setDefaultAccount("account-a");

  assert.equal(pool.remove("account-a"), true);
  assert.equal(pool.getDefaultAccountId(), null);
  assert.deepEqual(pool.list(), []);
});

test("account pool excludes a provider account after quota exhaustion", () => {
  const pool = new AccountPool({ providerId: "antigravity", policy: ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock: fixedNow });
  addAccount(pool, "account-exhausted", {
    remaining: 0.97,
    limit: 1,
    unit: "fraction",
    windows: [{
      id: "five-hour",
      remaining: 0.97,
      limit: 1,
      unit: "fraction",
      resetAt: "2026-08-15T18:00:00.000Z",
    }],
  });

  pool.report("account-exhausted", {
    status: "quota_exhausted",
    cooldownUntil: "2026-08-15T18:00:00.000Z",
    message: "antigravity native request failed: 额度或上游资源已耗尽",
  });

  assert.equal(pool.get("account-exhausted").health.status, "exhausted");
  assert.throws(() => pool.select(), /No eligible accounts/);
});

test("reauthorizing an expired account resets its selection health", () => {
  const pool = new AccountPool({ providerId: "claude", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-expired", { remaining: 1, limit: 2, unit: "requests" });
  pool.report("account-expired", { status: "auth_expired", message: "old token expired" });
  assert.throws(() => pool.select({ accountId: "account-expired" }), /No eligible accounts|not eligible/);

  pool.upsert({ accountId: "account-expired", credentialRef: "keychain://dockyard/claude/account-expired" }, { resetHealth: true });
  assert.equal(pool.get("account-expired").health.status, "unknown");
  assert.equal(pool.select({ accountId: "account-expired" }).accountId, "account-expired");
});

test("manual policy automatically uses the only eligible account", () => {
  const pool = new AccountPool({ providerId: "openai-codex", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-only", { remaining: 1, limit: 2, unit: "requests" });

  assert.equal(pool.getDefaultAccountId(), "account-only");
  assert.equal(pool.select().accountId, "account-only");
});

test("account selection exclusions apply to manual, round-robin, and sticky policies", () => {
  for (const policy of [
    ACCOUNT_SELECTION_POLICY.MANUAL,
    ACCOUNT_SELECTION_POLICY.ROUND_ROBIN,
    ACCOUNT_SELECTION_POLICY.STICKY_SESSION,
  ]) {
    const pool = new AccountPool({ providerId: policy, policy, clock: fixedNow });
    addAccount(pool, "account-a", { remaining: 1, limit: 2, unit: "requests" });
    addAccount(pool, "account-b", { remaining: 1, limit: 2, unit: "requests" });
    assert.equal(pool.select({ accountId: policy === ACCOUNT_SELECTION_POLICY.MANUAL ? "account-b" : undefined, sessionId: "session-1", excludeAccountIds: ["account-a"] }).accountId, "account-b");
  }
});

test("reporting a removed account is a harmless no-op", () => {
  const pool = new AccountPool({ providerId: "removed", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  pool.remove("account-a");
  assert.equal(pool.report("account-a", { status: "success" }), null);
});

test("account summaries do not expose nested quota windows", () => {
  const pool = new AccountPool({ providerId: "quota-copy", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-a", {
    remaining: 1,
    limit: 2,
    unit: "requests",
    windows: [{ id: "hour", remaining: 1, limit: 2 }],
  });
  const summary = pool.get("account-a");
  summary.quota.windows[0].remaining = 0;
  assert.equal(pool.get("account-a").quota.windows[0].remaining, 1);
});

test("event listeners are isolated from each other", async () => {
  const events = new EventBus();
  const calls = [];
  events.on("test", async () => { calls.push("first"); throw new Error("listener failed"); });
  events.on("test", () => { calls.push("second"); });
  const result = await events.emit("test", {});
  assert.deepEqual(calls, ["first", "second"]);
  assert.equal(result.errors.length, 1);
});

test("provider health reporting cannot mask a response after account removal", async () => {
  const pool = new AccountPool({ providerId: "in-flight", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const route = createProviderRoute({
    providerModule: {
      manifest: { id: "in-flight" },
      async invoke() {
        await gate;
        return { text: "ok" };
      },
    },
    accountPool: pool,
  });
  const pending = route.invoke({}, { accountId: "account-a" });
  pool.remove("account-a");
  release();
  assert.deepEqual(await pending, { text: "ok" });
});

test("a terminal provider failure is preserved instead of rewritten as empty output", async () => {
  const pool = new AccountPool({ providerId: "terminal-error", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  const route = createProviderRoute({
    providerModule: {
      manifest: { id: "terminal-error" },
      async *stream() {
        yield { type: "finish", reason: { kind: "error", failure: { code: "TRANSPORT", message: "upstream disconnected" } } };
      },
    },
    accountPool: pool,
  });
  await assert.rejects(
    (async () => {
      for await (const _chunk of route.stream({}, { accountId: "account-a" })) {}
    })(),
    (error) => {
      assert.equal(error.code, "TRANSPORT");
      assert.match(error.message, /upstream disconnected/);
      return true;
    },
  );
});

test("DSH bridge mounts provider routes without provider-specific core branches", async () => {
  const runtime = new ModuleRuntime({ logger: { error() {}, warn() {}, info() {} } });
  const adapterCalls = [];
  const bridge = new DshInjectionBridge({
    runtime,
    adapter: {
      async registerProviderRoute(route) {
        adapterCalls.push(route.providerId);
      },
    },
  });
  await runtime.register(createDshBridgeModule(bridge));

  const pool = new AccountPool({ providerId: "openai-codex", policy: ACCOUNT_SELECTION_POLICY.MANUAL, clock: fixedNow });
  addAccount(pool, "account-a", { remaining: 1, limit: 2, unit: "requests" });
  pool.setDefaultAccount("account-a");

  const driver = {
    async invoke(request, invocation) {
      return {
        request,
        accountId: invocation.account.accountId,
        credentialRef: invocation.account.auth?.credentialRef,
      };
    },
  };
  const route = await bridge.mountProvider(createCodexModule({ driver }), pool);
  const response = await route.invoke({ input: "ping" });
  assert.deepEqual(response, {
    request: { input: "ping" },
    accountId: "account-a",
    credentialRef: "keychain://dockyard/openai-codex/account-a",
  });
  assert.deepEqual(adapterCalls, ["openai-codex"]);
  assert.deepEqual(bridge.listRoutes(), ["openai-codex"]);
});

test("provider route rejects a mismatched account pool", () => {
  const pool = new AccountPool({ providerId: "antigravity", clock: fixedNow });
  assert.throws(
    () => createProviderRoute({ providerModule: createCodexModule(), accountPool: pool }),
    /do not match/,
  );
});

test("provider route fails over a rate-limited account before exposing a partial stream", async () => {
  const pool = new AccountPool({
    providerId: "test-provider",
    policy: ACCOUNT_SELECTION_POLICY.FAILOVER,
    clock: fixedNow,
  });
  addAccount(pool, "account-a", { remaining: 0, limit: 10, unit: "requests" });
  addAccount(pool, "account-b", { remaining: 10, limit: 10, unit: "requests" });
  const attempts = [];
  const providerModule = {
    manifest: { id: "test-provider" },
    async *stream(_request, { account }) {
      attempts.push(account.accountId);
      yield { type: "block-start", index: 0, blockType: "text" };
      if (account.accountId === "account-a") {
        const error = new Error("quota exhausted");
        error.rateLimited = true;
        throw error;
      }
      yield { type: "text-delta", index: 0, text: "ok" };
      yield { type: "finish", reason: { kind: "stop" } };
    },
  };
  const route = createProviderRoute({ providerModule, accountPool: pool });
  const chunks = [];
  for await (const chunk of route.stream({ model: "test-model" }, { requestId: "request-1" })) {
    chunks.push(chunk);
  }

  assert.deepEqual(attempts, ["account-a", "account-b"]);
  assert.deepEqual(chunks, [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text: "ok" },
    { type: "finish", reason: { kind: "stop" } },
  ]);
  assert.equal(pool.get("account-a").health.status, "degraded");
  assert.equal(pool.get("account-b").health.status, "healthy");
});

test("provider route rejects an empty successful stream instead of yielding a blank finish", async () => {
  const pool = new AccountPool({
    providerId: "test-provider",
    policy: ACCOUNT_SELECTION_POLICY.MANUAL,
    clock: fixedNow,
  });
  addAccount(pool, "account-empty", { remaining: 1, limit: 2, unit: "requests" });
  const providerModule = {
    manifest: { id: "test-provider" },
    async *stream() {
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "block-end", index: 0, block: {} };
      yield { type: "finish", reason: { kind: "stop" } };
    },
  };
  const route = createProviderRoute({ providerModule, accountPool: pool });
  await assert.rejects(
    (async () => {
      for await (const _chunk of route.stream({ model: "test-model" })) {}
    })(),
    (error) => {
      assert.equal(error.code, "EMPTY_STREAM_OUTPUT");
      assert.equal(error.emptyOutput, true);
      return true;
    },
  );
  assert.equal(pool.get("account-empty").health.status, "degraded");
});

test("provider route fails over an empty stream before exposing a blank response", async () => {
  const pool = new AccountPool({
    providerId: "test-provider",
    policy: ACCOUNT_SELECTION_POLICY.FAILOVER,
    clock: fixedNow,
  });
  addAccount(pool, "account-empty", { remaining: 1, limit: 2, unit: "requests" });
  addAccount(pool, "account-good", { remaining: 1, limit: 2, unit: "requests" });
  const attempts = [];
  const providerModule = {
    manifest: { id: "test-provider" },
    async *stream(_request, { account }) {
      attempts.push(account.accountId);
      yield { type: "block-start", index: 0, blockType: "text" };
      if (account.accountId === "account-empty") {
        yield { type: "block-end", index: 0, block: {} };
        yield { type: "finish", reason: { kind: "stop" } };
        return;
      }
      yield { type: "text-delta", index: 0, text: "ok" };
      yield { type: "finish", reason: { kind: "stop" } };
    },
  };
  const route = createProviderRoute({ providerModule, accountPool: pool });
  const chunks = [];
  for await (const chunk of route.stream({ model: "test-model" }, { requestId: "empty-failover" })) {
    chunks.push(chunk);
  }
  assert.deepEqual(attempts, ["account-empty", "account-good"]);
  assert.deepEqual(chunks, [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text: "ok" },
    { type: "finish", reason: { kind: "stop" } },
  ]);
  assert.equal(pool.get("account-empty").health.status, "degraded");
  assert.equal(pool.get("account-good").health.status, "healthy");
});

test("DSH LLM adapter delegates provider-neutral streaming to the selected route", async () => {
  const emitted = [];
  const fakeRuntime = {
    listProviderIds: () => ["openai-codex"],
    listProviderManifests: () => [{ id: "openai-codex", displayName: "Live Codex" }],
    async getCatalog() {
      return {
        models: [{
          id: "live-model",
          name: "Live model",
          contextWindow: 123456,
          maxTokens: 4096,
          reasoning: {
            efforts: [{ id: "medium", name: "Medium", description: "returned by provider" }],
            defaultEffort: "medium",
          },
        }],
      };
    },
    async stream(provider, request, context) {
      emitted.push({ provider, request, context });
      return (async function* chunks() {
        yield { type: "text-delta", index: 0, text: "ok" };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
  };
  const attachments = { resolve: "durable-store" };
  const adapter = createDockyardLlmAdapter({
    runtime: fakeRuntime,
    attachmentsResolver: () => attachments,
  });
  assert.deepEqual(adapter.providerInfo("openai-codex"), { id: "openai-codex", name: "Live Codex" });
  assert.deepEqual(await adapter.listModels("openai-codex"), [{
    provider: "openai-codex",
    id: "live-model",
    name: "Live model",
    description: "上下文 123,456 tokens · 输出上限 4,096 tokens",
    context: { contextWindow: 123456 },
    defaultMaxTokens: 4096,
    reasoning: {
      efforts: [{ id: "medium", name: "Medium", description: "returned by provider" }],
      defaultEffort: "medium",
    },
  }]);
  const prepared = await adapter.prepareCall("openai-codex", "live-model");
  assert.equal(prepared.model.id, "live-model");
  assert.equal(prepared.model.provider, "openai-codex");
  assert.equal(typeof prepared.stream, "function");
  const preparedChunks = [];
  for await (const chunk of prepared.stream({ provider: "openai-codex", model: "live-model", sessionId: "session-prepared" })) {
    preparedChunks.push(chunk);
  }
  assert.equal(preparedChunks[0].text, "ok");
  const chunks = [];
  for await (const chunk of adapter.stream({ provider: "openai-codex", model: "live-model", sessionId: "session-a" })) {
    chunks.push(chunk);
  }
  assert.equal(chunks[0].text, "ok");
  assert.equal(emitted[0].context.sessionId, "session-prepared");
  assert.equal(emitted[0].context.attachments, attachments);
  assert.equal(emitted[0].request.model, "live-model");
  assert.equal(emitted[1].context.sessionId, "session-a");
  assert.equal(emitted[1].context.attachments, attachments);
  assert.equal(emitted[1].request.model, "live-model");
});

test("DSH LLM adapter does not block a cold stream on provider catalog discovery", async () => {
  let resolveCatalog;
  let catalogCalls = 0;
  const pendingCatalog = new Promise((resolve) => { resolveCatalog = resolve; });
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["grok"],
      listProviderManifests: () => [{ id: "grok", displayName: "Grok" }],
      async getCatalog() {
        catalogCalls += 1;
        return pendingCatalog;
      },
      async stream() {
        return (async function* chunks() {
          yield { type: "text-delta", index: 0, text: "fast" };
          yield { type: "finish", reason: { kind: "stop" } };
        })();
      },
    },
  });

  const stream = adapter.stream({ provider: "grok", model: "grok-4.6" });
  const first = stream.next();
  const outcome = await Promise.race([
    first.then(() => "stream"),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 100)),
  ]);
  assert.equal(outcome, "stream");
  assert.equal(catalogCalls, 1);

  resolveCatalog({ models: [{ id: "grok-4.6", name: "Grok 4.6" }] });
  assert.deepEqual((await first).value, { type: "text-delta", index: 0, text: "fast" });
  await stream.next();
  await stream.return();
});

test("DSH LLM adapter makes Codex WebSocket 1006 retryable", async () => {
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["openai-codex"],
      listProviderManifests: () => [{ id: "openai-codex", displayName: "Live Codex" }],
      async getCatalog() {
        return { models: [{ id: "live-model", name: "Live model" }] };
      },
      async stream() {
        return (async function* chunks() {
          yield {
            type: "finish",
            reason: {
              kind: "error",
              failure: { code: "PI_AI_ERROR", message: "WebSocket closed 1006" },
            },
          };
        })();
      },
    },
  });

  const chunks = [];
  for await (const chunk of adapter.stream({ provider: "openai-codex", model: "live-model" })) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [{
    type: "finish",
    reason: {
      kind: "error",
      failure: { code: "TRANSPORT", message: "WebSocket closed 1006" },
    },
  }]);
});

test("DSH LLM adapter turns a thrown empty provider stream into retryable EMPTY_RESPONSE", async () => {
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["openai-codex"],
      listProviderManifests: () => [{ id: "openai-codex", displayName: "Live Codex" }],
      async getCatalog() {
        return { models: [{ id: "live-model", name: "Live model" }] };
      },
      async stream() {
        return (async function* chunks() {
          const error = new Error("Provider stream ended without substantive output");
          error.code = "EMPTY_STREAM_OUTPUT";
          error.emptyOutput = true;
          throw error;
        })();
      },
    },
  });

  const chunks = [];
  for await (const chunk of adapter.stream({ provider: "openai-codex", model: "live-model" })) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [{
    type: "finish",
    reason: {
      kind: "error",
      failure: {
        code: "EMPTY_RESPONSE",
        message: "Provider stream ended without substantive output",
      },
    },
  }]);
});

test("DSH LLM adapter turns a thrown transport failure into a retryable finish", async () => {
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["openai-codex"],
      listProviderManifests: () => [{ id: "openai-codex", displayName: "Live Codex" }],
      async getCatalog() {
        return { models: [{ id: "live-model", name: "Live model" }] };
      },
      async stream() {
        return (async function* chunks() {
          const error = new Error("WebSocket closed 1006");
          error.code = "PI_AI_ERROR";
          throw error;
        })();
      },
    },
  });

  const chunks = [];
  for await (const chunk of adapter.stream({ provider: "openai-codex", model: "live-model" })) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, [{
    type: "finish",
    reason: {
      kind: "error",
      failure: { code: "TRANSPORT", message: "WebSocket closed 1006" },
    },
  }]);
});

test("DSH LLM adapter does not replay an empty-output failure after forwarding output", async () => {
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["openai-codex"],
      listProviderManifests: () => [{ id: "openai-codex", displayName: "Live Codex" }],
      async getCatalog() {
        return { models: [{ id: "live-model", name: "Live model" }] };
      },
      async stream() {
        return (async function* chunks() {
          yield { type: "text-delta", index: 0, text: "partial" };
          const error = new Error("Provider stream ended without substantive output");
          error.code = "EMPTY_STREAM_OUTPUT";
          error.emptyOutput = true;
          throw error;
        })();
      },
    },
  });

  await assert.rejects(
    (async () => {
      for await (const _chunk of adapter.stream({ provider: "openai-codex", model: "live-model" })) {}
    })(),
    (error) => {
      assert.equal(error.code, "EMPTY_STREAM_OUTPUT");
      assert.equal(error.emptyOutput, true);
      return true;
    },
  );
});

test("DSH LLM adapter does not expose duplicate provider model rows", async () => {
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["claude"],
      listProviderManifests: () => [{ id: "claude", displayName: "Claude" }],
      async getCatalog() {
        return { models: [{ id: "claude-live", name: "Claude Live" }, { id: "claude-live", name: "Claude Live alias" }] };
      },
    },
  });
  assert.deepEqual(await adapter.listModels("claude"), [{
    provider: "claude",
    id: "claude-live",
    name: "Claude Live",
    description: "上下文未由 provider 返回",
  }]);
});

test("DSH LLM adapter hides live catalogs for providers without imported accounts", async () => {
  const catalogCalls = [];
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["claude", "grok"],
      listProviderManifests: () => [
        { id: "claude", displayName: "Claude" },
        { id: "grok", displayName: "Grok" },
      ],
      snapshot: () => ({ providers: [
        { providerId: "claude", accounts: [] },
        { providerId: "grok", accounts: [{ accountId: "grok:active" }] },
      ] }),
      async getCatalog(provider) {
        catalogCalls.push(provider);
        return { models: [{ id: `${provider}-live`, name: `${provider} live` }] };
      },
    },
  });
  assert.deepEqual(await adapter.listModels("claude"), []);
  assert.deepEqual(await adapter.listModels("grok"), [{
    provider: "grok",
    id: "grok-live",
    name: "grok live",
    description: "上下文未由 provider 返回",
  }]);
  assert.deepEqual(catalogCalls, ["grok"]);
});

test("DSH LLM adapter force-refreshes a cached provider catalog", async () => {
  const catalogCalls = [];
  const adapter = createDockyardLlmAdapter({
    runtime: {
      listProviderIds: () => ["grok"],
      listProviderManifests: () => [{ id: "grok", displayName: "Grok" }],
      snapshot: () => ({ providers: [{ providerId: "grok", accounts: [{ accountId: "grok:active" }] }] }),
      async getCatalog(provider, context = {}) {
        catalogCalls.push({ provider, force: Boolean(context.force) });
        return { models: [{ id: `${provider}-${catalogCalls.length}`, name: `${provider} ${catalogCalls.length}` }] };
      },
    },
  });
  assert.equal((await adapter.listModels("grok"))[0].id, "grok-1");
  const refreshed = await adapter.refreshCatalog("grok");
  assert.equal(refreshed[0].catalog.models[0].id, "grok-2");
  assert.deepEqual(catalogCalls, [
    { provider: "grok", force: false },
    { provider: "grok", force: true },
  ]);
});

test("Dockyard service force-refreshes connected provider catalogs", async () => {
  const catalogCalls = [];
  const catalogUpdates = [];
  const runtime = createCommandRuntime();
  runtime.state.imported = true;
  runtime.getCatalog = async (provider, context = {}) => {
    catalogCalls.push({ provider, force: Boolean(context.force) });
    return {
      models: [{ id: "live-model", name: "Live model" }],
      source: "official_test",
    };
  };
  const service = new DockyardDshService({
    runtime,
    autoRefresh: false,
    onCatalogUpdated: (payload) => catalogUpdates.push(payload),
  });
  const result = await service.refreshCatalog("live-provider");
  assert.equal(result.providerIds[0], "live-provider");
  assert.equal(result.catalogs[0].modelCount, 1);
  assert.equal(result.catalogs[0].source, "official_test");
  assert.deepEqual(catalogCalls, [{ provider: "live-provider", force: true }]);
  assert.deepEqual(catalogUpdates, [{ providerId: "live-provider", providerIds: ["live-provider"] }]);
  await service.dispose();
});

test("DSH Cordis plugin registers the modular provider set", () => {
  const registrations = [];
  const fakeRuntime = {
    listProviderIds: () => ["openai-codex", "antigravity"],
    listProviderManifests: () => [
      { id: "openai-codex", displayName: "Codex" },
      { id: "antigravity", displayName: "Antigravity" },
    ],
  };
  applyDockyardDsh({
    llm: {
      registerAdapter(providers, adapter) {
        registrations.push({ providers, adapter });
        return () => {};
      },
    },
  }, { runtime: fakeRuntime });
  assert.deepEqual(registrations[0].providers, ["openai-codex", "antigravity"]);
  assert.equal(registrations[0].adapter.providerInfo("antigravity").name, "Antigravity");
});

function createCommandRuntime({ browserSession = false } = {}) {
  const account = {
    providerId: "live-provider",
    accountId: "account-a",
    displayName: "Live account",
    email: "live@example.test",
    subscription: { plan: "live-plan", status: "active", expiresAt: null },
    quota: {
      remaining: 90,
      limit: 100,
      unit: "percent",
      resetAt: "2026-08-15T13:00:00.000Z",
      updatedAt: "2026-08-15T12:00:00.000Z",
      source: "live-provider",
      windows: [],
    },
    refresh: { nextRefreshAt: "2026-08-15T12:30:00.000Z" },
    health: { status: "healthy", lastCheckedAt: "2026-08-15T12:00:00.000Z" },
  };
  const state = {
    imported: false,
    policy: ACCOUNT_SELECTION_POLICY.ROUND_ROBIN,
    defaultAccountId: null,
    authorizationStarts: 0,
  };
  return {
    account,
    state,
    async init() {},
    listProviderIds: () => ["live-provider"],
    listProviderManifests: () => [{
      id: "live-provider",
      displayName: "Live Provider",
      capabilities: ["oauth_authorization", "catalog", "quota"],
    }],
    snapshot: () => ({
      generatedAt: "2026-08-15T12:00:00.000Z",
      providers: [{
        providerId: "live-provider",
        manifest: {
          id: "live-provider",
          displayName: "Live Provider",
          capabilities: ["oauth_authorization", "catalog", "quota"],
        },
        policy: state.policy,
        defaultAccountId: state.defaultAccountId,
        accounts: state.imported ? [account] : [],
      }],
      routes: ["live-provider"],
    }),
    async scan() {
      return {
        providers: [{
          providerId: "live-provider",
          manifest: { id: "live-provider", displayName: "Live Provider" },
          policy: state.policy,
          accounts: state.imported ? [account] : [],
          candidates: state.imported ? [] : [{
            candidateId: "candidate-a",
            accountId: "account-a",
            displayName: "Live account",
            email: "live@example.test",
            imported: false,
          }],
          diagnostics: [],
        }],
      };
    },
    async importCandidate() {
      state.imported = true;
      return { account, diagnostics: [], needsRefresh: true };
    },
    async refreshAccount() {
      return { account, diagnostics: [] };
    },
    async refreshAll() {
      return state.imported ? [{ account, diagnostics: [] }] : [];
    },
    async getCatalog() {
      return {
        models: [{
          id: "live-model",
          name: "Live model",
          reasoning: {
            efforts: [{ id: "medium", name: "Medium" }],
            defaultEffort: "medium",
          },
        }],
      };
    },
    async setPolicy(_providerId, policy, defaultAccountId) {
      state.policy = policy;
      state.defaultAccountId = defaultAccountId ?? null;
      return { providerId: "live-provider", policy, defaultAccountId: state.defaultAccountId };
    },
    async setDefaultAccount(_providerId, accountId) {
      state.defaultAccountId = accountId;
      return { providerId: "live-provider", defaultAccountId: accountId };
    },
    async removeAccount(_providerId, accountId) {
      state.imported = false;
      state.defaultAccountId = null;
      return { providerId: "live-provider", accountId, removed: true, defaultAccountId: null, diagnostics: [] };
    },
    async startAuthorization() {
      state.authorizationStarts += 1;
      const sessionId = browserSession
        ? `live-provider:browser:session-${state.authorizationStarts}`
        : state.authorizationStarts === 1
          ? "live-provider:session-a"
          : `live-provider:session-${state.authorizationStarts}`;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        sessionId,
        providerId: "live-provider",
        status: "pending",
        authorizationUrl: "https://provider.test/oauth",
        instructions: "complete login",
      };
    },
    async pollAuthorization(_providerId, sessionId) {
      return { sessionId, providerId: "live-provider", status: "pending" };
    },
    async cancelAuthorization(_providerId, sessionId) {
      return { sessionId, status: "cancelled" };
    },
  };
}

test("DSH native service exposes live account, quota, model, and OAuth commands", async () => {
  const runtime = createCommandRuntime();
  const opened = [];
  const service = new DockyardDshService({ runtime, autoRefresh: false, openBrowser: (url) => opened.push(url) });
  const command = createDockyardCommand(service);
  const signal = new AbortController().signal;
  const invoke = (rawInput) => command.handler({ rawInput, signal });

  const initial = await invoke("status");
  assert.match(initial.text, /暂无已添加账号/);

  const added = await invoke("add live-provider");
  assert.match(added.text, /已添加账号：1/);
  assert.equal(runtime.state.imported, true);

  const status = await invoke("status");
  assert.match(status.text, /额度更新时间：/);
  assert.match(status.text, /live@example\.test/);

  const models = await invoke("models live-provider");
  assert.match(models.text, /live-model/);
  assert.match(models.text, /medium/);

  const policy = await invoke("policy live-provider manual account-a");
  assert.match(policy.text, /manual/);
  const use = await invoke("use live-provider account-a");
  assert.match(use.text, /account-a/);

  const removed = await invoke("remove live-provider account-a");
  assert.match(removed.text, /已移除 live-provider\/account-a/);
  assert.equal((await runtime.snapshot()).providers[0].accounts.length, 0);

  const login = await invoke("login live-provider");
  assert.match(login.text, /https:\/\/provider\.test\/oauth/);
  assert.deepEqual(opened, ["https://provider.test/oauth"]);

  const duplicate = await service.startAuthorization("live-provider");
  assert.equal(duplicate.sessionId, "live-provider:session-a");
  assert.match(duplicate.instructions, /已有登录验证进行中/);
  assert.deepEqual(opened, ["https://provider.test/oauth"]);

  await service.dispose();
});

test("DSH service does not duplicate a direct browser OAuth tab", async () => {
  const runtime = createCommandRuntime({ browserSession: true });
  const opened = [];
  const service = new DockyardDshService({ runtime, autoRefresh: false, openBrowser: (url) => opened.push(url) });

  const started = await service.startAuthorization("live-provider", { openBrowser: false });
  assert.equal(started.sessionId, "live-provider:browser:session-1");
  assert.deepEqual(opened, []);
  await service.dispose();
});

test("DSH service collapses concurrent OAuth starts into one provider session", async () => {
  const runtime = createCommandRuntime();
  const opened = [];
  const service = new DockyardDshService({ runtime, autoRefresh: false, openBrowser: (url) => opened.push(url) });

  const [first, second] = await Promise.all([
    service.startAuthorization("live-provider"),
    service.startAuthorization("live-provider"),
  ]);

  assert.equal(runtime.state.authorizationStarts, 1);
  assert.equal(first.sessionId, second.sessionId);
  assert.deepEqual(opened, ["https://provider.test/oauth"]);
  await service.dispose();
});
