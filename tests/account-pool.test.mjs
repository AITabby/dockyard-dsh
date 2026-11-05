import assert from "node:assert/strict";
import test from "node:test";

import { ACCOUNT_SELECTION_POLICY, ACCOUNT_HEALTH } from "../packages/core/src/index.mjs";
import { AccountPool } from "../packages/account-pool/src/account-pool.mjs";

function account(accountId, overrides = {}) {
  return {
    providerId: "pool-test",
    accountId,
    auth: { kind: "oauth", credentialRef: `keychain://opaque/${accountId}`, scopes: [] },
    ...overrides,
  };
}

function poolWith(policy, ids = ["a", "b", "c"]) {
  const pool = new AccountPool({ providerId: "pool-test", policy });
  for (const id of ids) pool.upsert(account(id));
  return pool;
}

test("manual policy uses an explicit, default, or single account", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.MANUAL);
  // The first upsert auto-selects a default for a single-account pool.
  assert.equal(pool.select({}).accountId, "a");
  assert.equal(pool.select({ accountId: "b" }).accountId, "b");
  pool.setDefaultAccount("c");
  assert.equal(pool.select({}).accountId, "c");
  pool.setDefaultAccount(null);
  assert.throws(() => pool.select({}), /Manual policy requires accountId/);
  assert.throws(() => pool.select({ accountId: "missing" }), /not eligible/);

  const single = poolWith(ACCOUNT_SELECTION_POLICY.MANUAL, ["only"]);
  assert.equal(single.select({}).accountId, "only");
});

test("round_robin cycles through eligible accounts in order", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.ROUND_ROBIN);
  const picked = [pool.select({}).accountId, pool.select({}).accountId, pool.select({}).accountId, pool.select({}).accountId];
  assert.deepEqual(picked, ["a", "b", "c", "a"]);
});

test("failover always prefers the first eligible account", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.FAILOVER);
  assert.equal(pool.select({}).accountId, "a");
  assert.equal(pool.select({}).accountId, "a");
  pool.report("a", { status: "error", message: "boom" });
  // A degraded account stays selectable; failover still uses the ordered list.
  assert.equal(pool.get("a").health.status, ACCOUNT_HEALTH.DEGRADED);
  assert.equal(pool.select({}).accountId, "a");
});

test("sticky_session keeps one account per session id", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.STICKY_SESSION);
  assert.equal(pool.select({ sessionId: "s1" }).accountId, "a");
  assert.equal(pool.select({ sessionId: "s1" }).accountId, "a");
  assert.equal(pool.select({ sessionId: "s2" }).accountId, "b");
  assert.equal(pool.select({ sessionId: "s2" }).accountId, "b");
});

test("selection excludes accounts and refuses an empty eligible set", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.ROUND_ROBIN);
  assert.throws(
    () => pool.select({ excludeAccountIds: ["a", "b", "c"] }),
    /No eligible account remains/,
  );
  assert.equal(pool.select({ excludeAccountIds: ["a"] }).accountId, "b");
});

test("expired accounts are never selectable", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, ["a", "b"]);
  pool.report("a", { status: "error", message: "expired" });
  pool.upsert(account("a", { health: { status: ACCOUNT_HEALTH.EXPIRED } }));
  assert.equal(pool.select({}).accountId, "b");
  assert.equal(pool.select({}).accountId, "b");
});

test("resolve exposes only the opaque credential reference, never raw secrets", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.MANUAL, ["a"]);
  const resolved = pool.resolve("a");
  assert.equal(resolved.credentialRef, "keychain://opaque/a");
  assert.equal(resolved.authKind, "oauth");
  assert.ok(!("accessToken" in resolved), "raw token must not appear in resolve()");
  assert.ok(!("refreshToken" in resolved), "raw refresh token must not appear in resolve()");
  const serialized = JSON.stringify(pool.listForStorage());
  assert.ok(!serialized.includes("raw-secret"), "storage snapshot must not contain raw credentials");
});

test("unknown policies are rejected", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.MANUAL, ["a"]);
  assert.throws(() => pool.setPolicy("not-a-policy"), /Unknown account selection policy/);
});

test("allowance_fullest picks the account with the most headroom", () => {
  const pool = new AccountPool({ providerId: "pool-test", policy: ACCOUNT_SELECTION_POLICY.ALLOWANCE_FULLEST });
  pool.upsert(account("low", { quota: { windows: [{ id: "w", remaining: 1, limit: 10 }] } }));
  pool.upsert(account("high", { quota: { windows: [{ id: "w", remaining: 9, limit: 10 }] } }));
  pool.upsert(account("mid", { quota: { windows: [{ id: "w", remaining: 5, limit: 10 }] } }));
  assert.equal(pool.select({}).accountId, "high");
  // Selection records lastUsedAt, so the same account keeps winning while it
  // still has the most headroom.
  assert.equal(pool.select({}).accountId, "high");
});

test("allowance_fullest reads the tightest window, not the roomiest", () => {
  const pool = new AccountPool({ providerId: "pool-test", policy: ACCOUNT_SELECTION_POLICY.ALLOWANCE_FULLEST });
  // "wide" looks fine on its monthly window but is nearly spent on the 5h one.
  pool.upsert(account("wide", {
    quota: { windows: [{ id: "5h", remaining: 0, limit: 10 }, { id: "month", remaining: 90, limit: 100 }] },
  }));
  pool.upsert(account("even", { quota: { windows: [{ id: "5h", remaining: 6, limit: 10 }] } }));
  assert.equal(pool.select({}).accountId, "even");
});

test("allowance_fullest falls back to round robin without quota data", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.ALLOWANCE_FULLEST);
  const picked = [pool.select({}).accountId, pool.select({}).accountId, pool.select({}).accountId];
  assert.deepEqual(picked, ["a", "b", "c"]);
});

test("an expired authorization parks the account with a cooldown", () => {
  let now = new Date("2026-11-05T00:00:00.000Z");
  const pool = new AccountPool({ providerId: "pool-test", policy: ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock: () => now });
  pool.upsert(account("a"));
  pool.report("a", { status: "auth_expired", message: "token expired" });
  const parked = pool.get("a");
  assert.equal(parked.health.status, ACCOUNT_HEALTH.EXPIRED);
  assert.ok(parked.health.cooldownUntil, "a cooldown is scheduled");
  // Not selectable while parked.
  assert.throws(() => pool.select({}), /No eligible accounts/);
  // Not due for a retry yet.
  assert.deepEqual(pool.relistable(now), []);

  now = new Date("2026-11-05T00:45:00.000Z");
  assert.deepEqual(pool.relistable(now).map((entry) => entry.accountId), ["a"]);
});

test("a successful refresh clears the parked state", () => {
  let now = new Date("2026-11-05T00:00:00.000Z");
  const pool = new AccountPool({ providerId: "pool-test", policy: ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock: () => now });
  pool.upsert(account("a"));
  pool.report("a", { status: "auth_expired", message: "token expired" });
  pool.report("a", { status: "success" });
  assert.equal(pool.get("a").health.status, ACCOUNT_HEALTH.HEALTHY);
  assert.equal(pool.get("a").health.cooldownUntil, null);
  assert.equal(pool.relistable(now).length, 0);
});

test("a reported balance is kept with the account", () => {
  const pool = poolWith(ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, ["a"]);
  pool.report("a", { status: "success", balance: { amount: 12.5, unit: "CNY", source: "vendor" } });
  const stored = pool.get("a");
  assert.equal(stored.balance.amount, 12.5);
  assert.equal(stored.balance.unit, "CNY");
});

// A poll that finds no new models must stay silent: DSH re-lists the whole
// picker on every "adapters updated" event, which looked like the model list
// was refreshing forever.
test("listModels does not announce an unchanged catalog", async () => {
  const { DockyardRuntime } = await import("../packages/runtime/src/dockyard-runtime.mjs");
  const { createDockyardLlmAdapter } = await import("../packages/dsh-bridge/src/llm-adapter.mjs");
  const { MemorySecretStore } = await import("../packages/vault/src/index.mjs");

  const stateStore = { async load() { return {}; }, async update(fn) { return fn({}); }, async save() { return {}; } };
  const secretStore = new MemorySecretStore();
  let catalogCalls = 0;
  const runtime = {
    async init() { return this; },
    async whenPrepared() { return this; },
    listProviderIds() { return ["pool-test"]; },
    hasProviderCapability() { return true; },
    snapshot() {
      return { providers: [{ providerId: "pool-test", accounts: [{ accountId: "a", health: { status: "healthy" } }] }] };
    },
    getDefaultAccountId() { return "a"; },
    async getCatalog() {
      catalogCalls += 1;
      return { models: [{ id: "m1", name: "M1" }] };
    },
    getModelSelection() { return null; },
  };
  const changes = [];
  const adapter = createDockyardLlmAdapter({
    runtime,
    providerIds: ["pool-test"],
    onCatalogChanged: (provider) => changes.push(provider),
  });
  await adapter.listModels("pool-test");
  assert.equal(catalogCalls, 1);
  assert.deepEqual(changes, [], "the first read has nothing to compare against");

  await adapter.listModels("pool-test");
  assert.equal(catalogCalls, 1, "a cached list is not re-fetched");
  assert.deepEqual(changes, []);
});
