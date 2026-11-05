import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ACCOUNT_SELECTION_POLICY, ModuleRuntime } from "../packages/core/src/index.mjs";
import { AccountPool } from "../packages/account-pool/src/account-pool.mjs";
import { createProviderRoute } from "../packages/core/src/dsh-route.mjs";
import { MemorySecretStore } from "../packages/vault/src/index.mjs";
import { JsonStateStore } from "../packages/runtime/src/state-store.mjs";
import { DockyardRuntime } from "../packages/runtime/src/dockyard-runtime.mjs";
import { assertSecureEndpointUrl, isLoopbackHostname } from "../packages/providers/src/provider-utils.mjs";
import { extractSafeAuthorizationUrl } from "../packages/oauth/src/cli-url-sanitizer.mjs";
import {
  createBrowserOAuthAuthorizer,
} from "../packages/oauth/src/browser-oauth-authorizer.mjs";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("assertSecureEndpointUrl enforces the SECURITY.md endpoint contract", () => {
  assert.equal(assertSecureEndpointUrl("https://auth.example.test/token"), "https://auth.example.test/token");
  assert.equal(assertSecureEndpointUrl("http://127.0.0.1:8080/dev"), "http://127.0.0.1:8080/dev");
  assert.equal(assertSecureEndpointUrl("http://localhost:1455/auth/callback?x=1"), "http://localhost:1455/auth/callback?x=1");
  assert.throws(() => assertSecureEndpointUrl("http://attacker.example.test/token"), /loopback/);
  assert.throws(() => assertSecureEndpointUrl("ftp://attacker.example.test/token"), /http\(s\)/);
  assert.throws(() => assertSecureEndpointUrl("not a url"), /valid URL/);
  assert.throws(
    () => assertSecureEndpointUrl("https://user:secret@auth.example.test/token"),
    /must not embed credentials/,
  );
});

test("isLoopbackHostname accepts loopback spellings only", () => {
  for (const value of ["localhost", "127.0.0.1", "::1", "[::1]", "LOCALHOST"]) {
    assert.equal(isLoopbackHostname(value), true, value);
  }
  for (const value of ["0.0.0.0", "::", "example.test", "192.168.1.10", ""]) {
    assert.equal(isLoopbackHostname(value), false, value);
  }
});

test("browser OAuth authorizer refuses non-loopback callback hosts", async (t) => {
  assert.throws(
    () => createBrowserOAuthAuthorizer({
      providerId: "p",
      authorizationUrlBuilder: async () => "https://example.test/authorize",
      exchangeCode: async () => [],
      importCredentials: async () => [],
      callbackHost: "0.0.0.0",
      callbackPort: 0,
    }),
    /loopback/,
  );
  assert.throws(
    () => createBrowserOAuthAuthorizer({
      providerId: "p",
      authorizationUrlBuilder: async () => "https://example.test/authorize",
      exchangeCode: async () => [],
      importCredentials: async () => [],
      redirectUri: "http://192.168.1.5:51121/callback",
    }),
    /loopback/,
  );
  await t; // no-op keeps the async signature uniform
});

test("browser OAuth authorizer still binds localhost callbacks on the loopback interface", async () => {
  const authorizer = createBrowserOAuthAuthorizer({
    providerId: "loopback-check",
    callbackHost: "localhost",
    callbackPort: 0,
    authorizationUrlBuilder: async ({ redirectUri }) => `https://example.test/authorize?redirect=${encodeURIComponent(redirectUri)}`,
    exchangeCode: async () => [],
    importCredentials: async () => [{ providerId: "loopback-check", accountId: "a" }],
  });
  const session = await authorizer.begin();
  try {
    assert.match(session.authorizationUrl ?? "", /redirect=http%3A%2F%2Flocalhost%3A/);
  } finally {
    if (session.sessionId) await authorizer.cancel(session.sessionId);
  }
});

test("extractSafeAuthorizationUrl filters callback redirects and non-loopback http", () => {
  assert.equal(extractSafeAuthorizationUrl("Visit https://provider.test/oauth/authorize\x1b[0m"), "https://provider.test/oauth/authorize");
  // A URL carrying an authorization code is a response redirect: never surface it.
  assert.equal(extractSafeAuthorizationUrl("https://provider.test/callback?code=super-secret&state=abc"), null);
  assert.equal(extractSafeAuthorizationUrl("https://provider.test/callback#access_token=leak"), null);
  assert.equal(extractSafeAuthorizationUrl("http://attacker.example.test/path"), null);
  assert.equal(extractSafeAuthorizationUrl("no urls here"), null);
});

test("account pool drops stale health reports via opToken ordering", () => {
  const pool = new AccountPool({
    providerId: "test-provider",
    policy: ACCOUNT_SELECTION_POLICY.MANUAL,
  });
  pool.upsert({ providerId: "test-provider", accountId: "a", auth: { kind: "oauth", credentialRef: "ref-a", scopes: [] } });

  const first = pool.select({});
  const second = pool.select({ excludeAccountIds: [] });

  // Newest operation reports a rate limit first (degraded stays selectable)...
  pool.report(second.accountId, { status: "rate_limited", message: "429" }, { opToken: second.opToken });
  assert.equal(pool.get("a").health.status, "degraded");
  // ...then a late success from the older request must not flip it back.
  pool.report(first.accountId, { status: "success" }, { opToken: first.opToken });
  assert.equal(pool.get("a").health.status, "degraded");

  // A genuinely newer success still applies.
  const third = pool.select({ excludeAccountIds: [] });
  assert.equal(third.accountId, "a");
  pool.report(third.accountId, { status: "success" }, { opToken: third.opToken });
  assert.equal(pool.get("a").health.status, "healthy");

  // Unversioned reports keep their previous unconditional behavior.
  pool.report("a", { status: "error", message: "boom" });
  assert.equal(pool.get("a").health.status, "degraded");
});

test("route-reported provider failures are redacted before entering account state", async () => {
  const pool = new AccountPool({
    providerId: "redact-provider",
    policy: ACCOUNT_SELECTION_POLICY.MANUAL,
  });
  pool.upsert({
    providerId: "redact-provider",
    accountId: "acct",
    auth: { kind: "oauth", credentialRef: "keychain://opaque", scopes: [] },
  });
  pool.setDefaultAccount("acct");
  const route = createProviderRoute({
    providerModule: {
      manifest: { id: "redact-provider" },
      async invoke() {
        throw new Error("upstream rejected sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAA with 401 at https://secret-endpoint.test");
      },
    },
    accountPool: pool,
  });
  await assert.rejects(route.invoke({}, {}));
  const lastError = pool.get("acct")?.health?.lastError ?? "";
  assert.ok(lastError.includes("[redacted]"), `expected redaction, got: ${lastError}`);
  assert.ok(!lastError.includes("sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAA"), "raw credential leaked into lastError");
});

test("per-provider import serialization keeps a late rollback from erasing newer imports", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-import-race-"));
  try {
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const module = {
      manifest: { id: "race-provider", kind: "provider", displayName: "Race provider" },
      async activate(context) {
        context.registerService("provider:race-provider", this);
      },
      async discover() {
        return { candidates: [{ candidateId: "first" }, { candidateId: "second" }], diagnostics: [] };
      },
      async importAccount(candidate) {
        if (candidate.candidateId === "first") {
          await firstGate;
          throw new Error("first import failed");
        }
        return {
          providerId: "race-provider",
          accountId: "account-second",
          auth: { kind: "oauth", credentialRef: "keychain://race-provider/second", scopes: [] },
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
    await runtime.init();
    await runtime.scan();

    const firstAttempt = runtime.importCandidate("race-provider", "first");
    await delay(20); // let the first transaction enter its critical section
    const secondAttempt = runtime.importCandidate("race-provider", "second"); // queued behind it
    releaseFirst();

    await assert.rejects(firstAttempt, /first import failed/);
    const imported = await secondAttempt;
    assert.equal(imported.account.accountId, "account-second");
    const accountIds = runtime.snapshot().providers[0].accounts.map((account) => account.accountId);
    assert.deepEqual(accountIds, ["account-second"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("repository and release bundle never embed a real Google OAuth client secret", async () => {
  // README.md and SECURITY.md promise that no OAuth credentials are committed.
  // A real Google client secret follows the GOCSPX- prefix; a regression that
  // restores a hard-coded default must fail this test in both source and dist.
  const paths = [
    "../modules/provider-antigravity/src/driver.mjs",
    "../packages/dsh-plugin/dist/index.mjs",
  ];
  for (const relative of paths) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /GOCSPX-[A-Za-z0-9_-]{10,}/, `${relative} embeds a real OAuth client secret`);
  }
});

test("Antigravity browser OAuth uses the official client id and no committed secret", async () => {
  const { createAntigravityDriver } = await import("../modules/provider-antigravity/src/index.mjs");
  const driver = createAntigravityDriver({
    env: {},
    commandRunner: async () => ({ code: 0, stdout: "", stderr: "" }),
    tokenResolver: () => null,
    cacheFilePath: null,
  });
  // The client id is public (it ships in every copy of the official build); the
  // secret is not, so it is resolved at runtime or left empty here.
  assert.equal(
    driver.browserClientId,
    `${["1071006060591", "tmhssin2h21lcre235vtolojh4g403ep"].join("-")}.apps.googleusercontent.com`,
  );
  assert.equal(driver.browserClientSecret, "");
  assert.equal(driver.hasExplicitBrowserClient, false);

  const disabled = createAntigravityDriver({
    env: { DOCKYARD_ANTIGRAVITY_DISABLE_BROWSER: "1" },
    commandRunner: async () => ({ code: 0, stdout: "", stderr: "" }),
    tokenResolver: () => null,
    cacheFilePath: null,
  });
  assert.equal(disabled.browserClientId, "");
  assert.equal(disabled.browserAuthorizer, null, "browser OAuth must fail closed when disabled");

  const configured = createAntigravityDriver({
    env: {
      DOCKYARD_ANTIGRAVITY_CLIENT_ID: "operator-client-id",
      DOCKYARD_ANTIGRAVITY_CLIENT_SECRET: "operator-client-secret",
    },
    commandRunner: async () => ({ code: 0, stdout: "", stderr: "" }),
    tokenResolver: () => null,
    cacheFilePath: null,
  });
  assert.equal(configured.hasExplicitBrowserClient, true);
});

test("corrupt state files are archived and recovery re-reads under the lock", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-state-corrupt-"));
  try {
    const filePath = join(home, "state.json");
    const store = new JsonStateStore({ filePath });
    await writeFile(filePath, "{ definitely not json", "utf8");
    const state = await store.load();
    assert.deepEqual(state.pools, {});
    const entries = await readdir(home);
    assert.ok(entries.some((name) => name.startsWith("state.json.corrupted.")), `expected archived corrupt state, got: ${entries.join(", ")}`);
    // The store can recover and save fresh state afterwards.
    await store.save({ pools: { p: {} } });
    const reloaded = await store.load();
    assert.deepEqual(Object.keys(reloaded.pools), ["p"]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
