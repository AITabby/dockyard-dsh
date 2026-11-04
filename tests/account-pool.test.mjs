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
