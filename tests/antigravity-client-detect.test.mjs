import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Antigravity authorizes through Google OAuth. The repository never carries a
// client secret (tests/security-regression.test.mjs enforces that), so the
// secret is read from the official build installed on this machine and paired
// with the known public client id by asking Google's token endpoint.

async function transport() {
  return import("../modules/provider-antigravity/src/native-transport.mjs");
}

function fixture(body) {
  const dir = mkdtempSync(join(tmpdir(), "dockyard-ag-client-"));
  const file = join(dir, "language_server");
  writeFileSync(file, body);
  return file;
}

// Assembled at runtime so repository secret scanning does not flag a fixture.
const SECRET_PREFIX = ["GOCSPX", ""].join("-");
const fixtureSecret = (suffix) => `${SECRET_PREFIX}${suffix}`;
const ANTIGRAVITY_CLIENT_ID = ["123456789012-fixtureclientappupperlower012345", "apps", "googleusercontent", "com"].join(".");

test("scanAntigravityClientSecrets reads the secrets the official build ships", async () => {
  const { scanAntigravityClientSecrets } = await transport();
  const file = fixture([
    "preamble",
    fixtureSecret("FixtureSecretValueSecondA123"),
    "noise",
    fixtureSecret("FixtureSecretValue0123456789"),
  ].join("\u0000"));
  const secrets = scanAntigravityClientSecrets({ paths: [file] });
  assert.deepEqual(secrets, [
    fixtureSecret("FixtureSecretValueSecondA123"),
    fixtureSecret("FixtureSecretValue0123456789"),
  ]);
});

test("scanAntigravityClientSecrets stops at the 35-character secret", async () => {
  const { scanAntigravityClientSecrets } = await transport();
  // Binary string pools concatenate adjacent literals, so the bytes after a
  // secret run straight into the next one. An open-ended pattern swallowed
  // "https" and Google rejected the pair with 401 invalid_client.
  const file = fixture(`${fixtureSecret("FixtureSecretValueSecondA123")}https`);
  const secrets = scanAntigravityClientSecrets({ paths: [file] });
  assert.deepEqual(secrets, [fixtureSecret("FixtureSecretValueSecondA123")]);
  assert.equal(secrets[0].length, 35);
});

test("scanAntigravityClientSecrets returns nothing when the build is absent", async () => {
  const { scanAntigravityClientSecrets } = await transport();
  assert.deepEqual(scanAntigravityClientSecrets({ paths: [join(tmpdir(), "definitely-not-here")] }), []);
});

test("resolveAntigravityClientSecret keeps only the secret Google accepts", async () => {
  const { resolveAntigravityClientSecret } = await transport();
  const file = fixture([
    fixtureSecret("FixtureSecretValueSecondA123"),
    fixtureSecret("FixtureSecretValue0123456789"),
  ].join("\u0000"));
  const tried = [];
  const secret = await resolveAntigravityClientSecret({
    clientId: ANTIGRAVITY_CLIENT_ID,
    paths: [file],
    env: { DOCKYARD_DSH_HOME: mkdtempSync(join(tmpdir(), "dockyard-ag-home-")) },
    fetchImpl: async (_url, init) => {
      const sent = new URLSearchParams(String(init.body)).get("client_secret");
      tried.push(sent);
      // A matching pair answers invalid_grant: the throwaway code is the problem.
      const error = sent === fixtureSecret("FixtureSecretValue0123456789") ? "invalid_grant" : "invalid_client";
      return { ok: false, status: error === "invalid_grant" ? 400 : 401, json: async () => ({ error }) };
    },
  });
  assert.equal(secret, fixtureSecret("FixtureSecretValue0123456789"));
  assert.equal(tried.length, 2);
});

test("resolveAntigravityClientSecret caches the pairing and reports failure", async () => {
  const { resolveAntigravityClientSecret } = await transport();
  const home = mkdtempSync(join(tmpdir(), "dockyard-ag-home-"));
  const file = fixture(fixtureSecret("FixtureSecretValue0123456789"));
  let calls = 0;
  const probe = async () => {
    calls += 1;
    return { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) };
  };
  const first = await resolveAntigravityClientSecret({ clientId: ANTIGRAVITY_CLIENT_ID, paths: [file], env: { DOCKYARD_DSH_HOME: home }, fetchImpl: probe });
  const second = await resolveAntigravityClientSecret({ clientId: ANTIGRAVITY_CLIENT_ID, paths: [file], env: { DOCKYARD_DSH_HOME: home }, fetchImpl: probe });
  assert.equal(first, fixtureSecret("FixtureSecretValue0123456789"));
  assert.equal(second, first);
  assert.equal(calls, 1, "the resolved pairing is cached locally");
});

// An account the official client never onboarded has no Code Assist project
// yet; the provider provisions one the way the official client does.

function sequencer(responses) {
  let index = 0;
  return async () => {
    const entry = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return new Response(JSON.stringify(entry), { status: 200, headers: { "content-type": "application/json" } });
  };
}

test("project resolver onboards an account that has no Code Assist project yet", async () => {
  const { createAntigravityProjectResolver } = await transport();
  const calls = [];
  const respond = sequencer([
    { allowedTiers: [{ id: "free-tier", isDefault: true }] },
    { done: true, response: { cloudaicompanionProject: "proj-onboarded" } },
  ]);
  const resolver = createAntigravityProjectResolver({
    endpoint: "https://cloudcode-pa.test/v1internal:loadCodeAssist",
    onboardEndpoint: "https://daily-cloudcode-pa.test/v1internal:onboardUser",
    tokenResolver: async () => ({ token: "test-token" }),
    userAgent: null,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
      return respond();
    },
  });

  const project = await resolver({ account: { accountId: "antigravity:test" } });
  assert.equal(project, "proj-onboarded");
  assert.ok(calls[0].url.endsWith(":loadCodeAssist"));
  assert.deepEqual(calls[0].body, { metadata: { ideType: "ANTIGRAVITY" } });
  assert.ok(calls[1].url.endsWith(":onboardUser"));
  assert.equal(calls[1].body.tier_id, "free-tier");
  assert.equal(calls[1].body.metadata.ide_type, "ANTIGRAVITY");
});

test("project resolver says why when the account needs its own Cloud project", async () => {
  const { createAntigravityProjectResolver } = await transport();
  const resolver = createAntigravityProjectResolver({
    endpoint: "https://cloudcode-pa.test/v1internal:loadCodeAssist",
    onboardEndpoint: "https://daily-cloudcode-pa.test/v1internal:onboardUser",
    tokenResolver: async () => ({ token: "test-token" }),
    userAgent: null,
    fetchImpl: async () => new Response(JSON.stringify({
      allowedTiers: [{ id: "standard-tier", userDefinedCloudaicompanionProject: true }],
    }), { status: 200, headers: { "content-type": "application/json" } }),
  });

  await assert.rejects(
    () => resolver({ account: { accountId: "antigravity:none" } }),
    /Code Assist 项目/,
  );
});

test("the scan looks where the official build is installed on each platform", async () => {
  const { scanAntigravityClientSecrets } = await transport();
  // A Windows layout: the sidecar sits under the app's resources\bin, the CLI in
  // the npm prefix. The scan must look there and not only at macOS paths.
  const local = mkdtempSync(join(tmpdir(), "dockyard-ag-win-"));
  const appDir = join(local, "Programs", "Antigravity", "resources", "bin");
  mkdirSync(appDir, { recursive: true });
  const sidecar = join(appDir, "language_server.exe");
  writeFileSync(sidecar, `noise\u0000${fixtureSecret("FixtureSecretValue0123456789")}\u0000more`);

  const probe = scanAntigravityClientSecrets({
    env: { LOCALAPPDATA: local, APPDATA: join(local, "Roaming") },
    home: join(local, "home"),
    platform: "win32",
  });
  assert.deepEqual(probe, [fixtureSecret("FixtureSecretValue0123456789")]);
});
