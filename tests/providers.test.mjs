import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { MemorySecretStore } from "../packages/vault/src/index.mjs";
import { createBrowserOAuthAuthorizer } from "../packages/oauth/src/browser-oauth-authorizer.mjs";
import { createCliOAuthAuthorizer } from "../packages/oauth/src/cli-oauth-authorizer.mjs";
import { createCliStatusAuthorizer } from "../packages/oauth/src/cli-status-authorizer.mjs";
import { createOfficialSessionAuthorizer } from "../packages/oauth/src/official-session-authorizer.mjs";
import {
  createCodexDriver,
  createCodexPiAiExecutor,
  mergeCodexLiveCatalog,
  parseCodexLiveModelCatalog,
  synthesizeCodexPiAiModel,
} from "../modules/provider-codex/src/index.mjs";
import {
  createAntigravityCatalogLoader,
  createAntigravityCliExecutor,
  createAntigravityDriver,
  createAntigravityOAuthAuthorizer,
  createAntigravityNativeQuotaReader,
  enrichAntigravityModelCatalog,
  extractAntigravityAccountEmail,
  antigravityRequestPrompt,
  parseAntigravityNativeQuota,
  parseAntigravityKeychainValue,
  parseAntigravityModelCatalog,
  readAntigravityTokenFile,
  resolveAntigravityInvocationModel,
  resolveAntigravityNativeInvocationModel,
} from "../modules/provider-antigravity/src/index.mjs";
import {
  createGrokCatalogLoader,
  createGrokCliExecutor,
  createGrokDriver,
  grokRequestPromptBlocks,
  parseGrokAuth,
  parseGrokCreditsConfig,
  parseGrokModelCatalog,
} from "../modules/provider-grok/src/index.mjs";
import {
  createClaudeCatalogLoader,
  createClaudeCliExecutor,
  createClaudeDriver,
  parseClaudeAuthStatus,
} from "../modules/provider-claude/src/index.mjs";
import {
  createCursorCatalogLoader,
  createCursorCliExecutor,
  createCursorDriver,
  createCursorNativeExecutor,
  parseCursorAuthStatus,
} from "../modules/provider-cursor/src/index.mjs";
import { frameConnectMessage, decodeCursorConnectTrailer } from "../modules/provider-cursor/src/native-protocol.mjs";
import { codexModelToDshCatalog } from "../packages/dsh-plugin/src/codex-transport.mjs";
import { cliEventText } from "../packages/providers/src/cli-agent-transport.mjs";

function jwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() { return JSON.stringify(body); },
    async json() { return body; },
  };
}

const antigravityTestEnv = {
  ...process.env,
  DOCKYARD_ANTIGRAVITY_CLIENT_ID: "test-google-client-id",
  DOCKYARD_ANTIGRAVITY_CLIENT_SECRET: "test-google-client-secret",
};

test("Codex driver imports local OAuth and parses live multi-window quota", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-codex-"));
  try {
    const authPath = join(home, "auth.json");
    const access = jwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      "https://api.openai.com/auth": { chatgpt_account_id: "acct-live", chatgpt_plan_type: "pro" },
      "https://api.openai.com/profile": { email: "live@example.test", name: "Live User" },
    });
    await writeFile(authPath, JSON.stringify({
      tokens: { access_token: access, refresh_token: "refresh-live", account_id: "acct-live" },
      last_refresh: "2026-08-14T12:00:00.000Z",
    }));
    const driver = createCodexDriver({
      authFilePath: authPath,
      usageUrls: ["https://provider.test/primary", "https://provider.test/fallback"],
      fetchImpl: async (url) => url.endsWith("primary")
        ? response(403, {})
        : response(200, {
          account_id: "acct-live",
          email: "live@example.test",
          plan_type: "pro",
          rate_limit: {
            primary_window: { used_percent: 20, reset_at: 1_900_000_000_000 },
            secondary_window: { used_percent: 5, reset_after_seconds: 300 },
          },
        }),
    });
    const secretStore = new MemorySecretStore();
    const discovered = await driver.discover({ now: new Date("2026-08-14T12:00:00.000Z") });
    assert.equal(discovered.candidates.length, 1);
    const account = await driver.importAccount(discovered.candidates[0], { secretStore, now: new Date("2026-08-14T12:00:00.000Z") });
    const quota = await driver.getQuota(account, { secretStore, now: new Date("2026-08-14T12:00:00.000Z") });
    assert.equal(quota.subscription.plan, "pro");
    assert.equal(quota.identity.email, "live@example.test");
    assert.equal(quota.quota.remaining, 80);
    assert.equal(quota.quota.unit, "percent");
    assert.equal(quota.quota.windows.length, 2);
    assert.equal((await driver.getCatalog()).models.length, 0);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Codex live model catalog parse hides entries and sorts by priority", () => {
  const models = parseCodexLiveModelCatalog({
    models: [
      { slug: "gpt-5.4", priority: 20 },
      { slug: "secret", visibility: "hidden", priority: 1 },
      { slug: "gpt-6", priority: 10, display_name: "GPT-6" },
      { slug: "gpt-6" },
    ],
  });
  assert.deepEqual(models.map((model) => model.id), ["gpt-6", "gpt-5.4"]);
  assert.equal(models[0].name, "GPT-6");
});

test("Codex live merge synthesizes registry-backed capacities for unknown slugs", () => {
  const registry = [{
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    contextWindow: 272_000,
    maxTokens: 128_000,
    input: ["text", "image"],
    reasoning: true,
    thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
  }];
  const merged = mergeCodexLiveCatalog([{ id: "gpt-6", name: "GPT-6" }, { id: "gpt-5.6-luna" }], registry);
  const gpt6 = merged.find((model) => model.id === "gpt-6");
  assert.equal(gpt6.name, "GPT-6");
  assert.equal(gpt6.contextWindow, 272_000);
  assert.equal(gpt6.maxTokens, 128_000);
  assert.deepEqual(gpt6.thinkingLevelMap, { xhigh: "xhigh", minimal: "low" });
  assert.equal(gpt6.api, "openai-codex-responses");
  const known = merged.find((model) => model.id === "gpt-5.6-luna");
  assert.equal(known.name, "GPT-5.6 Luna");
});

test("Codex driver fetches the official live model catalog with account headers", async () => {
  let seen;
  const registry = [{
    id: "gpt-5.4",
    name: "GPT-5.4",
    contextWindow: 272_000,
    maxTokens: 128_000,
    input: ["text", "image"],
    reasoning: true,
    thinkingLevelMap: { xhigh: "xhigh", minimal: "low" },
  }];
  const driver = createCodexDriver({
    fetchImpl: async (url, init = {}) => {
      seen = { url, headers: init.headers ?? {} };
      return response(200, { models: [
        { slug: "gpt-5.4", priority: 20 },
        { slug: "gpt-6", priority: 10, display_name: "GPT-6" },
        { slug: "secret", visibility: "hidden", priority: 1 },
      ] });
    },
    catalogLoader: async () => ({ models: registry, source: "dsh_pi_ai_provider_catalog" }),
  });
  const secretStore = new MemorySecretStore();
  const access = jwt({
    exp: Math.floor(Date.now() / 1000) + 3600,
    "https://api.openai.com/auth": { chatgpt_account_id: "acct-live", chatgpt_plan_type: "pro" },
  });
  const [account] = await driver.importSource({
    content: JSON.stringify({
      tokens: { access_token: access, refresh_token: "refresh-live", account_id: "acct-live" },
    }),
  }, { secretStore });
  const catalog = await driver.getCatalog({ accounts: [account], secretStore });
  assert.match(seen.url, /chatgpt\.com\/backend-api\/codex\/models/);
  assert.equal(seen.headers.authorization, `Bearer ${access}`);
  assert.equal(seen.headers["chatgpt-account-id"], "acct-live");
  assert.equal(catalog.source, "official_codex_models_api");
  assert.deepEqual(catalog.models.map((model) => model.id), ["gpt-6", "gpt-5.4"]);
  const gpt6 = catalog.models[0];
  assert.equal(gpt6.name, "GPT-6");
  assert.equal(gpt6.contextWindow, 272_000);
  assert.equal(gpt6.maxTokens, 128_000);
});

test("Codex driver falls back to the registry catalog when the live endpoint fails", async () => {
  const registry = [{ id: "gpt-5.4", name: "GPT-5.4", contextWindow: 272_000, maxTokens: 128_000 }];
  const driver = createCodexDriver({
    fetchImpl: async () => response(500, {}),
    catalogLoader: async () => ({ models: registry, source: "dsh_pi_ai_provider_catalog" }),
  });
  const secretStore = new MemorySecretStore();
  const access = jwt({
    exp: Math.floor(Date.now() / 1000) + 3600,
    "https://api.openai.com/auth": { chatgpt_account_id: "acct-live" },
  });
  const [account] = await driver.importSource({
    content: JSON.stringify({
      tokens: { access_token: access, refresh_token: "refresh-live", account_id: "acct-live" },
    }),
  }, { secretStore });
  const catalog = await driver.getCatalog({ accounts: [account], secretStore });
  assert.equal(catalog.source, "dsh_pi_ai_provider_catalog");
  assert.deepEqual(catalog.models.map((model) => model.id), ["gpt-5.4"]);
});

test("Codex executor synthesizes capacities for slugs missing from the registry", async () => {
  class StubPiAiAdapter {
    stream(request) { return "stream-result"; }
  }
  const executor = createCodexPiAiExecutor({
    PiAiAdapter: StubPiAiAdapter,
    createProvider: (options) => options,
    openAICodexResponsesApi: () => ({}),
    modelResolver: () => null,
    registryModels: [],
  });
  await executor({
    request: { model: "gpt-6", input: [{ type: "text", text: "hello" }] },
    credential: { access: "oauth-access" },
    context: {},
  });
  const synthesized = synthesizeCodexPiAiModel("gpt-6", []);
  assert.equal(synthesized.contextWindow, 272_000);
  assert.equal(synthesized.maxTokens, 128_000);
  assert.equal(synthesized.api, "openai-codex-responses");
});

test("Codex PiAI transport forwards DSH durable attachments", async () => {  let adapterOptions;
  let streamedRequest;
  class StubPiAiAdapter {
    constructor(options) {
      adapterOptions = options;
    }

    stream(request) {
      streamedRequest = request;
      return "stream-result";
    }
  }
  const executor = createCodexPiAiExecutor({
    PiAiAdapter: StubPiAiAdapter,
    createProvider: (options) => options,
    openAICodexResponsesApi: () => ({}),
    modelResolver: () => ({
      name: "Live Codex",
      contextWindow: 272_000,
      maxTokens: 128_000,
      input: ["text", "image"],
    }),
  });
  const attachments = { id: "durable-attachments" };
  const request = { model: "live-codex", input: [{ type: "text", text: "hello" }] };
  const result = await executor({
    request,
    credential: { access: "oauth-access" },
    context: { attachments },
  });

  assert.equal(result, "stream-result");
  assert.equal(streamedRequest, request);
  assert.equal(adapterOptions.resolveAttachments(), attachments);
});

test("Codex preserves a 401 OAuth signal across quota endpoint fallback", async () => {
  const access = jwt({
    exp: Math.floor(Date.now() / 1000) + 3600,
    "https://api.openai.com/auth": { chatgpt_account_id: "acct-stale", chatgpt_plan_type: "plus" },
    "https://api.openai.com/profile": { email: "stale@example.test", name: "Stale User" },
  });
  const driver = createCodexDriver({
    usageUrls: ["https://provider.test/primary", "https://provider.test/fallback"],
    fetchImpl: async (url) => url.endsWith("primary") ? response(401, {}) : response(403, {}),
  });
  const secretStore = new MemorySecretStore();
  const [account] = await driver.importSource({
    content: JSON.stringify({
      tokens: { access_token: access, refresh_token: "refresh-stale", account_id: "acct-stale" },
    }),
  }, { secretStore });

  await assert.rejects(
    driver.getQuota(account, { secretStore }),
    (error) => {
      assert.equal(error.authExpired, true);
      assert.equal(error.authForbidden, false);
      assert.match(error.message, /reauthorization required/);
      return true;
    },
  );
});

test("Codex does not classify an unrelated 400 refresh failure as expired OAuth", async () => {
  const driver = createCodexDriver({
    tokenUrl: "https://provider.test/oauth/token",
    fetchImpl: async () => response(400, { error: "server_error" }),
  });
  const secretStore = new MemorySecretStore();
  await secretStore.write("keychain://codex/account-a", {
    access: "access-token",
    refresh: "refresh-token",
    accountId: "account-a",
  });
  await assert.rejects(
    () => driver.refreshAccount({
      accountId: "account-a",
      auth: { credentialRef: "keychain://codex/account-a" },
      refresh: {},
    }, { secretStore, force: true }),
    (error) => error.authExpired === false,
  );
});

test("CLI OAuth authorizer waits for the official login process and imports its isolated profile", async () => {
  const authState = JSON.stringify({ login: "completed" });
  const childScript = [
    "const { writeFileSync } = require('node:fs');",
    "const { join } = require('node:path');",
    `writeFileSync(join(process.env.DOCKYARD_TEST_OAUTH_HOME, 'auth.json'), ${JSON.stringify(authState)});`,
    "console.error('https://provider.test/oauth/authorize\\u001b[0m');",
  ].join(" ");
  const authorizer = createCliOAuthAuthorizer({
    providerId: "test-provider",
    cliPath: process.execPath,
    loginArgs: ["-e", childScript],
    environmentKey: "DOCKYARD_TEST_OAUTH_HOME",
    importCredentials: async (raw) => [{
      providerId: "test-provider",
      accountId: raw.login,
      credentialRef: "keychain://test-provider/login",
    }],
  });
  const started = await authorizer.begin();
  assert.equal(started.status, "pending");
  let result = await authorizer.poll(started.sessionId, {});
  for (let attempt = 0; result.status === "pending" && attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    result = await authorizer.poll(started.sessionId, {});
  }
  assert.equal(result.status, "completed");
  assert.equal(result.accounts[0].accountId, "completed");
  assert.equal(result.authorizationUrl, "https://provider.test/oauth/authorize");
});

test("CLI OAuth authorizer can keep a provider profile and report CLI-owned browser flow", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-provider-oauth-"));
  try {
    const authState = JSON.stringify({ login: "provider-profile" });
    const childScript = [
      "const { writeFileSync } = require('node:fs');",
      "const { join } = require('node:path');",
      `writeFileSync(join(process.env.DOCKYARD_TEST_OAUTH_HOME, 'auth.json'), ${JSON.stringify(authState)});`,
      "console.error('https://provider.test/oauth/authorize\\u001b[0m');",
    ].join(" ");
    const authorizer = createCliOAuthAuthorizer({
      providerId: "test-provider-profile",
      cliPath: process.execPath,
      loginArgs: ["-e", childScript],
      environmentKey: "DOCKYARD_TEST_OAUTH_HOME",
      profileDirectory: home,
      browserOpened: true,
      importCredentials: async (raw) => [{
        providerId: "test-provider-profile",
        accountId: raw.login,
        credentialRef: "keychain://test-provider-profile/login",
      }],
    });
    const started = await authorizer.begin();
    assert.equal(started.status, "pending");
    assert.equal(started.browserOpened, true);
    let result = await authorizer.poll(started.sessionId, {});
    for (let attempt = 0; result.status === "pending" && attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      result = await authorizer.poll(started.sessionId, {});
    }
    assert.equal(result.status, "completed");
    assert.equal(result.browserOpened, true);
    assert.equal(result.accounts[0].accountId, "provider-profile");
    assert.equal(result.authorizationUrl, "https://provider.test/oauth/authorize");
    assert.equal(await readFile(join(home, "auth.json"), "utf8"), authState);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("CLI status authorizer reports a browser already opened by the provider CLI", async () => {
  const childScript = "console.error('https://provider.test/oauth/authorize');";
  const authorizer = createCliStatusAuthorizer({
    providerId: "test-status-provider",
    cliPath: process.execPath,
    loginArgs: ["-e", childScript],
    browserOpened: true,
    importStatus: async () => [{
      providerId: "test-status-provider",
      accountId: "active-account",
    }],
  });
  const started = await authorizer.begin();
  assert.equal(started.browserOpened, true);
  let result = await authorizer.poll(started.sessionId, {});
  for (let attempt = 0; result.status === "pending" && attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    result = await authorizer.poll(started.sessionId, {});
  }
  assert.equal(result.status, "completed");
  assert.equal(result.browserOpened, true);
  assert.equal(result.accounts[0].accountId, "active-account");
  assert.equal(result.authorizationUrl, "https://provider.test/oauth/authorize");
});

test("browser OAuth authorizer validates state and imports a loopback callback", async () => {
  let request;
  const authorizer = createBrowserOAuthAuthorizer({
    providerId: "test-browser-provider",
    callbackHost: "127.0.0.1",
    callbackPort: 0,
    authorizationUrlBuilder: async (value) => {
      request = value;
      return `https://example.test/authorize?state=${value.state}`;
    },
    exchangeCode: async (value) => {
      assert.equal(value.code, "browser-code");
      assert.equal(value.state, request.state);
      assert.equal(typeof value.codeVerifier, "string");
      return { access_token: "opaque-token" };
    },
    importCredentials: async (value) => [{ providerId: "test-browser-provider", accountId: value.access_token }],
  });
  const started = await authorizer.begin();
  const callback = new URL(request.redirectUri);
  callback.searchParams.set("code", "browser-code");
  callback.searchParams.set("state", request.state);
  const responseValue = await fetch(callback).then((response) => response.text());
  assert.match(responseValue, /授权成功/);
  const completed = await authorizer.poll(started.sessionId);
  assert.equal(completed.status, "completed");
  assert.equal(completed.accounts[0].accountId, "opaque-token");
});

test("browser OAuth rejects callbacks and pasted codes without matching state", async () => {
  let callbackRequest;
  const callbackAuthorizer = createBrowserOAuthAuthorizer({
    providerId: "test-browser-state-provider",
    callbackHost: "127.0.0.1",
    callbackPort: 0,
    authorizationUrlBuilder: async (value) => {
      callbackRequest = value;
      return "https://example.test/authorize";
    },
    exchangeCode: async () => { throw new Error("must not exchange an invalid callback"); },
    importCredentials: async () => [],
  });
  const callbackStarted = await callbackAuthorizer.begin();
  const callback = new URL(callbackRequest.redirectUri);
  callback.searchParams.set("error", "access_denied");
  const callbackResponse = await fetch(callback);
  assert.match(await callbackResponse.text(), /安全校验失败/);
  const callbackResult = await callbackAuthorizer.poll(callbackStarted.sessionId);
  assert.equal(callbackResult.status, "failed");
  assert.match(callbackResult.diagnostic, /OAuth state 校验失败/);

  const pastedAuthorizer = createBrowserOAuthAuthorizer({
    providerId: "test-pasted-state-provider",
    redirectUri: "https://example.test/oauth/callback",
    callbackPort: null,
    authorizationUrlBuilder: async () => "https://example.test/authorize",
    exchangeCode: async () => { throw new Error("must not exchange a bare code"); },
    importCredentials: async () => [],
  });
  const pastedStarted = await pastedAuthorizer.begin();
  const pastedResult = await pastedAuthorizer.submitAuthorizationCode(pastedStarted.sessionId, "bare-code");
  assert.equal(pastedResult.status, "failed");
  assert.match(pastedResult.diagnostic, /OAuth state 校验失败/);
});

test("browser OAuth cancellation wins a concurrent exchange", async () => {
  let request;
  let release;
  let imports = 0;
  const authorizer = createBrowserOAuthAuthorizer({
    providerId: "test-browser-cancel-provider",
    redirectUri: "https://example.test/oauth/callback",
    callbackPort: null,
    authorizationUrlBuilder: async (value) => {
      request = value;
      return "https://example.test/authorize";
    },
    exchangeCode: async () => new Promise((resolve) => { release = () => resolve({ access_token: "late" }); }),
    importCredentials: async () => { imports += 1; return [{ accountId: "late" }]; },
  });
  const started = await authorizer.begin();
  const submitted = authorizer.submitAuthorizationCode(started.sessionId, `code#${request.state}`);
  const cancelled = await authorizer.cancel(started.sessionId);
  assert.equal(cancelled.status, "cancelled");
  release?.();
  const result = await submitted;
  assert.equal(result.status, "cancelled");
  assert.equal(imports, 0);
});

test("official client session authorizer polls a provider-owned desktop session", async () => {
  let ready = false;
  const authorizer = createOfficialSessionAuthorizer({
    providerId: "test-client-provider",
    readSession: async () => ready
      ? { accounts: [{ providerId: "test-client-provider", accountId: "desktop-account" }] }
      : { accounts: [] },
  });
  const started = await authorizer.begin();
  assert.equal(started.status, "pending");
  assert.equal((await authorizer.poll(started.sessionId)).status, "pending");
  ready = true;
  const completed = await authorizer.poll(started.sessionId);
  assert.equal(completed.status, "completed");
  assert.equal(completed.accounts[0].accountId, "desktop-account");
});

test("Antigravity OAuth authorizer captures agy's browser URL and imports its isolated token", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { writable: true, write() {} };
  child.kill = () => true;
  const authorizer = createAntigravityOAuthAuthorizer({
    cliPath: "agy",
    spawnImpl: (_command, _args, options) => {
      queueMicrotask(async () => {
        child.stderr.emit("data", "https://accounts.google.com/o/oauth2/auth?state=test&code_challenge=test\n");
        await mkdir(dirname(options.env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE), { recursive: true });
        await writeFile(options.env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE, JSON.stringify({ access_token: "isolated-token" }));
      });
      return child;
    },
  });
  const started = await authorizer.begin({ accounts: [] });
  assert.equal(started.status, "pending");
  let result = await authorizer.poll(started.sessionId, { accounts: [] });
  for (let attempt = 0; result.status === "pending" && attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    result = await authorizer.poll(started.sessionId, { accounts: [] });
  }
  assert.equal(result.status, "completed");
  assert.equal(result.authorizationUrl, "https://accounts.google.com/o/oauth2/auth?state=test&code_challenge=test");
  assert.equal(result.accounts[0].resources.sessionPersistence, "captured");
  assert.equal(result.accounts[0].resources.sessionSource, "browser");
  assert.equal(result.accounts[0].resources.credentialRefreshMode, "agy_session");
  assert.equal(result.accounts[0].source, "official_antigravity_browser_oauth");
  assert.equal(started.browserOpened, true);
});

test("Antigravity OAuth authorizer reports submitted codes as processing", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  const writes = [];
  child.stdin = { writable: true, write(value) { writes.push(value); } };
  child.kill = () => true;
  const authorizer = createAntigravityOAuthAuthorizer({
    cliPath: "agy",
    spawnImpl: () => child,
  });
  const started = await authorizer.begin();
  const submitted = await authorizer.submitAuthorizationCode(started.sessionId, "fresh-code");
  assert.equal(submitted.status, "processing");
  assert.match(submitted.instructions, /正在等待官方登录完成/);
  assert.deepEqual(writes, ["fresh-code\n"]);
  await authorizer.cancel(started.sessionId);
});

test("Antigravity decodes the official go-keyring Keychain session", () => {
  const encoded = Buffer.from(JSON.stringify({
    auth_method: "consumer",
    token: {
      access_token: "keychain-access",
      refresh_token: "keychain-refresh",
      expiry: "2026-08-27T04:00:00.000Z",
    },
  })).toString("base64");
  assert.deepEqual(parseAntigravityKeychainValue(`go-keyring-base64:${encoded}`), {
    token: "keychain-access",
    refreshToken: "keychain-refresh",
    expiresAt: "2026-08-27T04:00:00.000Z",
    kind: "oauth",
    source: "antigravity_keychain",
    email: null,
  });
});

test("Antigravity token files retain the OAuth refresh token and expiry", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-antigravity-token-file-"));
  try {
    const tokenPath = join(home, "antigravity-oauth-token.json");
    await writeFile(tokenPath, JSON.stringify({
      credentials: {
        access_token: "google-access",
        refresh_token: "google-refresh",
        expiry_date: Date.parse("2026-08-25T00:00:00.000Z"),
      },
    }));
    assert.deepEqual(readAntigravityTokenFile({
      env: { DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath },
      home,
    }), {
      token: "google-access",
      refreshToken: "google-refresh",
      expiresAt: "2026-08-25T00:00:00.000Z",
      kind: "oauth",
      email: null,
    });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Antigravity driver uses official CLI data without requiring token storage", async () => {
  const commandRunner = async (_command, args) => {
    const command = args[1];
    if (command === "/quota") return { output: JSON.stringify({ status: "SUCCESS", command: { data: { groups: [{ name: "Live group", buckets: [{ id: "window-live", name: "Live window", remaining_fraction: 0.75, reset_time: 1_900_000_000_000 }] }] } }, response: "" }), errorOutput: "" };
    if (command === "/credits") return { output: JSON.stringify({ status: "SUCCESS", command: { data: { remaining_credits: 4, upgrade_uri: "https://provider.test/upgrade" } }, response: "" }), errorOutput: "" };
    if (args[0] === "models") return { output: "Fetching available models...\nmodel-from-provider\tLive model\n", errorOutput: "" };
    throw new Error("unexpected command");
  };
  const driver = createAntigravityDriver({ commandRunner, tokenResolver: () => null });
  const secretStore = new MemorySecretStore();
  const discovered = await driver.discover({ now: new Date("2026-08-14T12:00:00.000Z") });
  assert.equal(discovered.candidates.length, 1);
  const account = await driver.importAccount(discovered.candidates[0], { secretStore });
  const quota = await driver.getQuota(account, { secretStore, now: new Date("2026-08-14T12:00:00.000Z") });
  assert.equal(quota.quota.remaining, 0.75);
  assert.equal(quota.resources, undefined);
  assert.equal(quota.credits.remaining, 4);
  assert.deepEqual((await driver.getCatalog()).models, [{ id: "model-from-provider", name: "Live model" }]);
});

test("Antigravity account discovery keeps provider identity and captures distinct local sessions", async () => {
  const commandRunner = async () => ({
    output: JSON.stringify({
      status: "SUCCESS",
      command: { data: { groups: [{ buckets: [{ id: "window-live", remaining_fraction: 0.75 }] }] } },
      response: "",
    }),
    errorOutput: "applyAuthResult: email=first@example.test",
  });
  const driver = createAntigravityDriver({
    commandRunner,
    tokenResolver: () => ({ token: "session-token-first" }),
  });
  const discovered = await driver.discover({ now: new Date("2026-08-14T12:00:00.000Z") });
  const candidate = discovered.candidates[0];
  assert.equal(extractAntigravityAccountEmail("OAuth: authenticated successfully as first@example.test"), "first@example.test");
  assert.equal(candidate.email, "first@example.test");
  assert.equal(candidate.displayName, "first@example.test");
  assert.equal(candidate.resources.sessionPersistence, "captured");
  assert.equal(candidate.resources.identitySource, "official_cli_auth_status");

  const secretStore = new MemorySecretStore();
  const account = await driver.importAccount(candidate, { secretStore });
  assert.deepEqual(await secretStore.read(account.credentialRef), {
    type: "official_session",
    providerId: "antigravity",
    access: "session-token-first",
    email: "first@example.test",
  });

  const second = createAntigravityDriver({
    commandRunner: async () => ({
      output: JSON.stringify({ status: "SUCCESS", command: { data: { groups: [{ buckets: [{ id: "window-live", remaining_fraction: 0.75 }] }] } } }),
      errorOutput: "applyAuthResult: email=second@example.test",
    }),
    tokenResolver: () => ({ token: "session-token-second" }),
  });
  const secondCandidate = (await second.discover({ now: new Date("2026-08-14T12:00:00.000Z") })).candidates[0];
  assert.notEqual(secondCandidate.accountId, candidate.accountId);
  assert.notEqual(secondCandidate.resources.sessionFingerprint, candidate.resources.sessionFingerprint);
});

test("Antigravity resolves the active session email from Google userinfo", async () => {
  const commandRunner = async () => ({
    output: JSON.stringify({
      status: "SUCCESS",
      command: { data: { groups: [{ buckets: [{ id: "window-live", remaining_fraction: 0.75 }] }] } },
      response: "",
    }),
    errorOutput: "",
  });
  let userInfoCalls = 0;
  const driver = createAntigravityDriver({
    commandRunner,
    tokenResolver: () => ({ token: "session-token" }),
    fetchImpl: async (url) => {
      userInfoCalls += 1;
      assert.match(url, /googleapis\.com\/oauth2\/v1\/userinfo/);
      return response(200, { email: "userinfo@example.test" });
    },
  });
  const found = (await driver.discover({ now: new Date("2026-08-14T12:00:00.000Z") })).candidates[0];
  assert.equal(found.email, "userinfo@example.test");
  assert.equal(found.displayName, "userinfo@example.test");
  assert.equal(userInfoCalls, 1);
});

test("Antigravity rejects a captured account after the local session changes", async () => {
  let currentToken = "session-token-first";
  const commandRunner = async () => ({
    output: JSON.stringify({
      status: "SUCCESS",
      command: { data: { groups: [{ buckets: [{ id: "window-live", remaining_fraction: 0.75 }] }] } },
      response: "",
    }),
    errorOutput: "applyAuthResult: email=first@example.test",
  });
  let invoked = false;
  const driver = createAntigravityDriver({
    commandRunner,
    tokenResolver: () => ({ token: currentToken }),
    requestExecutor: async () => { invoked = true; },
  });
  const candidate = (await driver.discover()).candidates[0];
  const account = await driver.importAccount(candidate, { secretStore: new MemorySecretStore() });
  currentToken = "session-token-second";

  await assert.rejects(
    () => driver.invoke({}, { account }),
    (error) => error.authExpired === true && error.accountMismatch === true,
  );
  assert.equal(invoked, false);
});

test("Antigravity refreshAccount reuses the live quota response", async () => {
  const calls = [];
  const commandRunner = async (_command, args) => {
    const command = args[1];
    calls.push(command);
    if (command === "/quota") {
      return { output: JSON.stringify({ status: "SUCCESS", command: { data: { groups: [{ name: "Live group", buckets: [{ id: "window-live", name: "Live window", remaining_fraction: 0.8, reset_time: 1_900_000_000_000 }] }] } }, response: "" }), errorOutput: "" };
    }
    if (command === "/credits") {
      return { output: JSON.stringify({ status: "SUCCESS", command: { data: { remaining_credits: 5 } }, response: "" }), errorOutput: "" };
    }
    throw new Error(`unexpected command: ${command}`);
  };
  const driver = createAntigravityDriver({ commandRunner, tokenResolver: () => null });
  const discovered = await driver.discover({ now: new Date("2026-08-14T12:00:00.000Z") });
  const account = await driver.importAccount(discovered.candidates[0], { secretStore: new MemorySecretStore() });
  calls.length = 0;

  const refreshed = await driver.refreshAccount(account, { now: new Date("2026-08-14T12:00:00.000Z") });
  assert.equal(refreshed.quota.remaining, 0.8);
  assert.equal(refreshed.credits.remaining, 5);
  assert.deepEqual(calls.sort(), ["/credits", "/quota"]);
});

test("Antigravity does not fall back to the global CLI quota for a selected account", async () => {
  let cliCalls = 0;
  const driver = createAntigravityDriver({
    quotaReader: async () => {
      throw new Error("selected account quota unavailable");
    },
    tokenResolver: () => null,
    commandRunner: async () => {
      cliCalls += 1;
      throw new Error("global CLI must not be used");
    },
  });
  await assert.rejects(
    () => driver.refreshAccount({
      accountId: "account-a",
      auth: { credentialRef: "keychain://account-a" },
    }),
    /selected account quota unavailable/,
  );
  assert.equal(cliCalls, 0);
});

test("Antigravity browser OAuth refreshes persisted Google credentials after restart", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://antigravity/browser-account";
  await secretStore.write(credentialRef, {
    type: "official_session",
    providerId: "antigravity",
    access: "expired-access",
    refresh: "google-refresh",
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  let refreshCalls = 0;
  let quotaCredential = null;
  const driver = createAntigravityDriver({
    cliPath: "missing-agy",
    commandRunner: async () => { throw new Error("CLI must not be used for persisted browser OAuth"); },
    clientId: "dockyard-google-client",
    clientSecret: "dockyard-google-secret",
    quotaReader: async ({ credential }) => {
      quotaCredential = credential;
      return {
        quotaGroups: [{
          name: "Persisted browser group",
          buckets: [{ id: "daily", name: "Daily", remainingFraction: 0.8, resetTime: 1_900_000_000_000 }],
        }],
      };
    },
    fetchImpl: async (url) => {
      assert.match(url, /oauth2\.googleapis\.com\/token/);
      refreshCalls += 1;
      return response(200, { access_token: "refreshed-access", expires_in: 3600 });
    },
  });
  const account = {
    providerId: "antigravity",
    accountId: "antigravity:google:browser-account",
    email: "google@example.test",
    credentialRef,
    auth: { kind: "official_session", credentialRef, scopes: [] },
    resources: { sessionSource: "browser" },
    refresh: { accessTokenExpiresAt: "2020-01-01T00:00:00.000Z" },
  };

  const refreshed = await driver.refreshAccount(account, {
    secretStore,
    now: new Date("2026-08-16T12:00:00.000Z"),
  });
  assert.equal(refreshCalls, 1);
  assert.equal(quotaCredential.access, "refreshed-access");
  assert.equal(refreshed.quota.remaining, 0.8);
  assert.equal((await secretStore.read(credentialRef)).access, "refreshed-access");
  assert.equal((await secretStore.read(credentialRef)).refresh, "google-refresh");
});

test("Antigravity agy browser sessions refresh captured and legacy credentials through agy", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-antigravity-agy-session-"));
  const tokenPath = join(home, ".gemini", "antigravity-cli", "antigravity-oauth-token");
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://antigravity/agy-browser-account";
  await secretStore.write(credentialRef, {
    type: "official_session",
    providerId: "antigravity",
    access: "agy-expired-access",
    refresh: "agy-refresh",
    expiresAt: null,
  });
  let refreshCalls = 0;
  let quotaCredential = null;
  const driver = createAntigravityDriver({
    cliPath: "agy",
    env: { HOME: home, DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath },
    commandRunner: async (_command, args, options) => {
      refreshCalls += 1;
      assert.deepEqual(args, ["models"]);
      assert.equal(options.env.AGY_CLI_HIDE_ACCOUNT_INFO, "1");
      assert.equal(options.env.HOME, home);
      assert.equal(options.env.GEMINI_FORCE_FILE_STORAGE, "true");
      await mkdir(dirname(options.env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE), { recursive: true });
      await writeFile(options.env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE, JSON.stringify({
        auth_method: "consumer",
        token: {
          access_token: "agy-refreshed-access",
          refresh_token: "agy-refreshed-refresh",
          expiry: "2026-08-25T13:00:00.000Z",
        },
      }));
      return { output: "", errorOutput: "" };
    },
    tokenResolver: () => null,
    quotaReader: async ({ credential }) => {
      quotaCredential = credential;
      return {
        quotaGroups: [{
          name: "Captured agy group",
          buckets: [{ id: "daily", name: "Daily", remainingFraction: 0.72, resetTime: 1_900_000_000_000 }],
        }],
      };
    },
    fetchImpl: async () => {
      refreshCalls += 1;
      throw new Error("DSH Google refresh must not run for agy sessions");
    },
  });
  const account = {
    providerId: "antigravity",
    accountId: "antigravity:session:agy-browser-account",
    credentialRef,
    auth: { kind: "official_session", credentialRef, scopes: [] },
    resources: {
      sessionSource: "browser",
      // This intentionally omits credentialRefreshMode to cover accounts
      // imported before the mode was persisted in the account snapshot.
      sessionPersistence: "captured",
    },
    refresh: { accessTokenExpiresAt: null, refreshable: true },
  };

  const refreshed = await driver.refreshAccount(account, {
    secretStore,
    now: new Date("2026-08-25T12:00:00.000Z"),
  });
  assert.equal(refreshCalls, 1);
  assert.equal(quotaCredential.access, "agy-refreshed-access");
  assert.equal(quotaCredential.refresh, "agy-refreshed-refresh");
  assert.equal(refreshed.quota.remaining, 0.72);
  assert.equal(refreshed.refresh.accessTokenExpiresAt, "2026-08-25T13:00:00.000Z");
  assert.equal(refreshed.refresh.refreshable, true);
  assert.equal((await secretStore.read(credentialRef)).access, "agy-refreshed-access");
  assert.equal((await secretStore.read(credentialRef)).refresh, "agy-refreshed-refresh");
  await rm(home, { recursive: true, force: true });
});

test("Antigravity local agy sessions refresh the canonical token before native quota", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-antigravity-active-session-"));
  const tokenPath = join(home, ".gemini", "antigravity-cli", "antigravity-oauth-token");
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://antigravity/active-session";
  await mkdir(dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, JSON.stringify({
    auth_method: "consumer",
    token: {
      access_token: "active-expired-access",
      refresh_token: "active-refresh",
      expiry: "2026-08-25T13:00:00.000Z",
    },
  }));
  let refreshCalls = 0;
  let quotaCredential = null;
  const driver = createAntigravityDriver({
    cliPath: "agy",
    env: { HOME: home, DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath },
    usePtyForSessionRefresh: false,
    commandRunner: async (_command, args, options) => {
      refreshCalls += 1;
      assert.deepEqual(args, ["models"]);
      assert.equal(options.env.AGY_CLI_HIDE_ACCOUNT_INFO, "1");
      assert.equal(options.env.HOME, home);
      assert.equal(options.env.GEMINI_FORCE_FILE_STORAGE, "true");
      await writeFile(options.env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE, JSON.stringify({
        auth_method: "consumer",
        token: {
          access_token: "active-refreshed-access",
          refresh_token: "active-refreshed-refresh",
          expiry: "2026-08-25T14:00:00.000Z",
        },
      }));
      return { output: "", errorOutput: "" };
    },
    quotaReader: async ({ credential }) => {
      quotaCredential = credential;
      return {
        quotaGroups: [{
          name: "Active agy group",
          buckets: [{ id: "daily", name: "Daily", remainingFraction: 0.81, resetTime: 1_900_000_000_000 }],
        }],
      };
    },
  });
  const account = {
    providerId: "antigravity",
    accountId: "antigravity:active",
    auth: { kind: "official_session", credentialRef, scopes: [] },
    resources: { sessionSource: "cli" },
    refresh: { accessTokenExpiresAt: "2026-08-25T13:00:00.000Z", refreshable: true },
  };

  const refreshed = await driver.refreshAccount(account, {
    secretStore,
    now: new Date("2026-08-25T13:30:00.000Z"),
  });
  assert.equal(refreshCalls, 1);
  assert.equal(quotaCredential.access, "active-refreshed-access");
  assert.equal(quotaCredential.refresh, "active-refreshed-refresh");
  assert.equal(refreshed.quota.remaining, 0.81);
  assert.equal(refreshed.refresh.accessTokenExpiresAt, "2026-08-25T14:00:00.000Z");
  assert.equal((await secretStore.read(credentialRef)).access, "active-refreshed-access");
  await rm(home, { recursive: true, force: true });
});

test("Antigravity native quota reader uses the first-party summary endpoint", async () => {
  let request;
  const reader = createAntigravityNativeQuotaReader({
    endpoint: "https://provider.test/v1internal:retrieveUserQuotaSummary",
    project: null,
    tokenResolver: () => ({ token: "oauth-token" }),
    fetchImpl: async (url, init) => {
      request = { url, init };
      return {
        status: 200,
        ok: true,
        async json() {
          return {
            quotaGroups: [{
              name: "Live group",
              buckets: [{ id: "weekly", name: "Weekly", remainingFraction: 0.91, resetTime: 1_900_000_000_000 }],
            }],
            remainingCredits: 7,
          };
        },
      };
    },
  });
  const raw = await reader({});
  const quota = parseAntigravityNativeQuota(raw, new Date("2026-08-14T12:00:00.000Z"));
  assert.equal(request.url, "https://provider.test/v1internal:retrieveUserQuotaSummary");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.authorization, "Bearer oauth-token");
  assert.deepEqual(JSON.parse(request.init.body), {});
  assert.equal(quota.windows[0].remaining, 0.91);
  assert.equal(quota.windows[0].source, "antigravity_native");
  assert.equal(quota.credits.remaining, 7);
});

test("Antigravity catalog stays mounted when the optional CLI is unavailable", async () => {
  let calls = 0;
  const loader = createAntigravityCatalogLoader({
    cacheFilePath: null,
    cacheTtlMs: 60_000,
    commandRunner: async () => {
      calls += 1;
      const error = new Error("spawn agy ENOENT");
      error.code = "ENOENT";
      throw error;
    },
  });

  const first = await loader();
  const second = await loader();
  assert.deepEqual(first.models, []);
  assert.equal(first.source, "antigravity_cli_not_found");
  assert.match(first.diagnostics[0], /spawn agy ENOENT/);
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test("provider model metadata exposes only returned reasoning tiers", () => {
  assert.deepEqual(parseAntigravityModelCatalog([
    "Fetching available models...",
    "gemini-live-low\tGemini Live (Low)",
    "gemini-live-medium\tGemini Live (Medium)",
    "gemini-live-high\tGemini Live (High)",
    "claude-live\tClaude Live (Thinking)",
  ].join("\n")), [
    {
      id: "gemini-live-low",
      name: "Gemini Live (Low)",
      reasoning: {
        efforts: [
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
        ],
        defaultEffort: "low",
      },
    },
    {
      id: "gemini-live-medium",
      name: "Gemini Live (Medium)",
      reasoning: {
        efforts: [
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
        ],
        defaultEffort: "medium",
      },
    },
    {
      id: "gemini-live-high",
      name: "Gemini Live (High)",
      reasoning: {
        efforts: [
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
        ],
        defaultEffort: "high",
      },
    },
    { id: "claude-live", name: "Claude Live (Thinking)" },
  ]);

  assert.deepEqual(codexModelToDshCatalog({
    id: "live-gpt",
    name: "Live GPT",
    reasoning: true,
    thinkingLevelMap: { minimal: "low", xhigh: "xhigh", off: "none" },
  }).reasoning, {
    efforts: [
      { id: "minimal", name: "Minimal", description: "provider value: low" },
      { id: "xhigh", name: "Xhigh" },
    ],
  });
});

test("Antigravity capacity metadata is enriched only from a live-compatible registry family", () => {
  const live = parseAntigravityModelCatalog([
    "gemini-3.6-flash-high\tGemini 3.6 Flash (High)",
    "gemini-3.6-flash-medium\tGemini 3.6 Flash (Medium)",
  ].join("\n"));
  assert.deepEqual(enrichAntigravityModelCatalog(live, [{
    id: "gemini-3.6-flash",
    contextWindow: 1048576,
    maxTokens: 65536,
    input: ["text", "image"],
  }]), [
    {
      id: "gemini-3.6-flash-high",
      name: "Gemini 3.6 Flash (High)",
      reasoning: {
        efforts: [
          { id: "high", name: "High" },
          { id: "medium", name: "Medium" },
        ],
        defaultEffort: "high",
      },
      contextWindow: 1048576,
      maxTokens: 65536,
      inputModalities: ["text", "image"],
    },
    {
      id: "gemini-3.6-flash-medium",
      name: "Gemini 3.6 Flash (Medium)",
      reasoning: {
        efforts: [
          { id: "high", name: "High" },
          { id: "medium", name: "Medium" },
        ],
        defaultEffort: "medium",
      },
      contextWindow: 1048576,
      maxTokens: 65536,
      inputModalities: ["text", "image"],
    },
  ]);
  assert.deepEqual(enrichAntigravityModelCatalog(live, [{ id: "gemini-3.7-flash" }])[0].contextWindow, undefined);
});

test("Antigravity catalog supplies the published Gemini 3.7 capacity fallback", async () => {
  const loader = createAntigravityCatalogLoader({
    cacheFilePath: null,
    commandRunner: async () => ({
      output: [
        "gemini-3.7-flash-high\tGemini 3.7 Flash (High)",
        "gemini-3.7-flash-medium\tGemini 3.7 Flash (Medium)",
      ].join("\n"),
    }),
    registryLoader: async () => [],
  });
  const catalog = await loader({ force: true });
  assert.deepEqual(catalog.models.map((model) => ({
    id: model.id,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
  })), [
    { id: "gemini-3.7-flash-high", contextWindow: 1_048_576, maxTokens: 65_536 },
    { id: "gemini-3.7-flash-medium", contextWindow: 1_048_576, maxTokens: 65_536 },
  ]);
  assert.equal(catalog.source, "official_antigravity_cli+model_registry");
});

test("Antigravity prompt keeps the newest messages inside returned model capacity", () => {
  const prompt = antigravityRequestPrompt({
    modelContext: { contextWindow: 16, maxTokens: 1 },
    messages: [
      { role: "user", content: "old ".repeat(100) },
      { role: "assistant", content: "previous answer" },
      { role: "user", content: "new" },
    ],
  });
  assert.equal(prompt.includes("old ".repeat(10)), false);
  assert.equal(prompt.includes("new"), true);
});

test("Antigravity executor calls the official CLI with the selected model and effort", async () => {
  let command;
  const executor = createAntigravityCliExecutor({
    cliPath: "agy-test",
    env: { PATH: "/provider/bin" },
    streamCommandRunner: async function* (path, args, options) {
      command = { path, args, options };
      yield JSON.stringify({ event: "content_block_delta", delta: { text_delta: "provider" } });
      yield JSON.stringify({ event: "content_block_delta", delta: { text_delta: " response" } });
      yield JSON.stringify({
        event: "result",
        result: {
          status: "SUCCESS",
          response: "provider response",
          usage: { input_tokens: 3, output_tokens: 2 },
        },
      });
    },
  });
  const stream = await executor({
    request: {
      model: "gemini-live-medium",
      reasoningEffort: "medium",
      system: "Be concise.",
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(command.args.slice(-7), ["--model", "gemini-live-medium", "--effort", "medium", "--sandbox", "--output-format", "stream-json"]);
  assert.equal(command.args[0], "-p");
  assert.match(command.args[1], /system:\nBe concise\./);
  assert.deepEqual(chunks, [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "text-delta", index: 0, text: "provider" },
    { type: "text-delta", index: 0, text: " response" },
    { type: "block-end", index: 0, block: { type: "text", text: "provider response" } },
    { type: "usage", usage: { inputTokens: 3, outputTokens: 2 } },
    { type: "finish", reason: { kind: "stop" } },
  ]);
});

test("Antigravity maps a native run_command event into DSH bash", async () => {
  const executor = createAntigravityCliExecutor({
    cliPath: "agy-test",
    streamCommandRunner: async function* () {
      yield JSON.stringify({
        event: "step_update",
        step_update: {
          state: "ACTIVE",
          step_type: "tool",
          tool_name: "run_command",
          tool_info: { parameters: { CommandLine: "pwd", Cwd: "/tmp" } },
        },
      });
      throw new Error("the bridge should stop after forwarding the tool call");
    },
  });
  const stream = await executor({
    request: {
      model: "gemini-live-medium",
      tools: [{ name: "bash", description: "Execute bash", parameters: {} }],
      messages: [{ role: "user", content: [{ type: "text", text: "check" }] }],
    },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(chunks, [
    { type: "block-start", index: 0, blockType: "text" },
    { type: "block-end", index: 0, block: { type: "text", text: "" } },
    { type: "block-start", index: 1, blockType: "tool-call" },
    {
      type: "block-end",
      index: 1,
      block: {
        type: "tool-call",
        id: chunks[3].block.id,
        name: "bash",
        arguments: JSON.stringify({ command: "pwd", description: "Run the requested command", workdir: "/tmp" }),
      },
    },
    { type: "finish", reason: { kind: "tool-calls" } },
  ]);
});

test("Antigravity maps a selected effort to the exact returned model row", async () => {
  const catalogLoader = async () => ({
    models: [
      {
        id: "gemini-live-high",
        name: "Gemini Live (High)",
        reasoning: { efforts: [{ id: "high", name: "High" }, { id: "medium", name: "Medium" }], defaultEffort: "high" },
      },
      {
        id: "gemini-live-medium",
        name: "Gemini Live (Medium)",
        reasoning: { efforts: [{ id: "high", name: "High" }, { id: "medium", name: "Medium" }], defaultEffort: "medium" },
      },
    ],
  });
  assert.deepEqual(await resolveAntigravityInvocationModel({
    catalogLoader,
    model: "gemini-live-medium",
    reasoningEffort: "high",
  }), { model: "gemini-live-high", reasoningEffort: undefined });
  assert.deepEqual(await resolveAntigravityNativeInvocationModel({
    catalogLoader,
    model: "gemini-live-medium",
    reasoningEffort: "medium",
  }), { model: "gemini-live-medium", reasoningEffort: "medium" });

  let calls = 0;
  const cachedLoader = createAntigravityCatalogLoader({
    cacheFilePath: null,
    cacheTtlMs: 60_000,
    commandRunner: async () => {
      calls += 1;
      return { output: "live-model\tLive model\n", errorOutput: "" };
    },
  });
  await cachedLoader();
  await cachedLoader();
  assert.equal(calls, 1);
});

test("Antigravity catalog persists an account-scoped last-known result", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-antigravity-catalog-"));
  const cacheFilePath = join(home, "catalog.json");
  const accounts = [{ accountId: "antigravity-account-a" }];
  try {
    const first = createAntigravityCatalogLoader({
      cacheFilePath,
      commandRunner: async () => ({ output: "gemini-3.7-flash-high\tGemini 3.7 Flash (High)\ngemini-3.7-flash-medium\tGemini 3.7 Flash (Medium)\n" }),
      registryLoader: async () => [],
    });
    const live = await first({ force: true, accounts });
    assert.equal(live.models[0].contextWindow, 1_048_576);

    const rawCache = await readFile(cacheFilePath, "utf8");
    assert.equal(rawCache.includes("antigravity-account-a"), false);

    let refreshCalls = 0;
    const restoredLoader = createAntigravityCatalogLoader({
      cacheFilePath,
      commandRunner: async () => {
        refreshCalls += 1;
        return { output: "gemini-3.7-flash-high\tGemini 3.7 Flash (High)\ngemini-3.7-flash-medium\tGemini 3.7 Flash (Medium)\n" };
      },
      registryLoader: async () => [],
    });
    const restored = await restoredLoader({ accounts });
    assert.deepEqual(restored.models.map((model) => model.id), [
      "gemini-3.7-flash-high",
      "gemini-3.7-flash-medium",
    ]);
    assert.match(restored.source, /persistent_cache/);
    assert.equal(refreshCalls, 1);
    // The cached-catalog path refreshes in the background without awaiting
    // the persisted write. Settle it before removing the temp directory so
    // the cleanup cannot race the catalog.json write (ENOTEMPTY flake).
    await first.whenIdle();
    await restoredLoader.whenIdle();
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Grok imports every OAuth account in a provider source without exposing tokens", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-grok-"));
  try {
    const raw = {
      "https://auth.x.ai::account-a": {
        key: "access-a",
        refresh_token: "refresh-a",
        user_id: "grok-account-a",
        email: "a@example.test",
        first_name: "Account A",
        expires_at: "2026-08-15T12:00:00.000Z",
        oidc_issuer: "https://auth.x.ai",
        oidc_client_id: "client-a",
      },
      "https://auth.x.ai::account-b": {
        key: "access-b",
        refresh_token: "refresh-b",
        user_id: "grok-account-b",
        email: "b@example.test",
        expires_at: "2026-08-15T12:00:00.000Z",
        oidc_issuer: "https://auth.x.ai",
        oidc_client_id: "client-b",
      },
    };
    assert.deepEqual(parseGrokAuth(raw).map(({ access: _access, refresh: _refresh, ...value }) => value), [
      {
        accountId: "grok-account-a",
        email: "a@example.test",
        displayName: "Account A",
        plan: null,
        expiresAt: "2026-08-15T12:00:00.000Z",
        createdAt: null,
        scopes: [],
        issuer: "https://auth.x.ai",
        clientId: "client-a",
        authMode: null,
        scopeKey: "https://auth.x.ai::account-a",
      },
      {
        accountId: "grok-account-b",
        email: "b@example.test",
        displayName: "b@example.test",
        plan: null,
        expiresAt: "2026-08-15T12:00:00.000Z",
        createdAt: null,
        scopes: [],
        issuer: "https://auth.x.ai",
        clientId: "client-b",
        authMode: null,
        scopeKey: "https://auth.x.ai::account-b",
      },
    ]);
    const driver = createGrokDriver({
      authFilePath: join(home, "auth.json"),
      grokHome: home,
      catalogLoader: async () => ({ models: [] }),
    });
    const secretStore = new MemorySecretStore();
    const imported = await driver.importSource({ content: JSON.stringify(raw), fileName: "auth.json" }, { secretStore });
    assert.deepEqual(imported.map((account) => account.accountId), ["grok-account-a", "grok-account-b"]);
    assert.equal(imported[0].auth.credentialRef, undefined);
    assert.equal((await secretStore.read(imported[0].credentialRef)).access, "access-a");
    assert.equal((await secretStore.read(imported[0].credentialRef)).email, "a@example.test");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Grok quota reads the official credits config and weekly period", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://grok/credits";
  await secretStore.write(credentialRef, { access: "grok-access", accountId: "grok-account" });
  let call = null;
  const driver = createGrokDriver({
    catalogLoader: async () => ({ models: [] }),
    creditsUrl: "https://grok.test/v1/billing?format=credits",
    clientVersion: "0.2.test",
    fetchImpl: async (url, init) => {
      call = { url, init };
      return response(200, {
        config: {
          creditUsagePercent: 42.5,
          currentPeriod: {
            type: "USAGE_PERIOD_TYPE_WEEKLY",
            start: "2026-08-15T22:06:42.000Z",
            end: "2026-08-22T22:06:42.000Z",
          },
        },
      });
    },
  });
  const quota = await driver.getQuota({
    accountId: "grok-account",
    auth: { credentialRef },
    subscription: { plan: null },
  }, { secretStore, now: new Date("2026-08-16T12:00:00.000Z") });
  assert.equal(call.url, "https://grok.test/v1/billing?format=credits");
  assert.equal(call.init.headers.authorization, "Bearer grok-access");
  assert.equal(call.init.headers["x-xai-token-auth"], "xai-grok-cli");
  assert.equal(call.init.headers["x-userid"], "grok-account");
  assert.equal(call.init.headers["x-grok-client-version"], "0.2.test");
  assert.equal(quota.quota.remaining, 57.5);
  assert.equal(quota.quota.limit, 100);
  assert.equal(quota.quota.unit, "percent");
  assert.equal(quota.quota.resetAt, "2026-08-22T22:06:42.000Z");
  assert.equal(quota.quota.windows[0].name, "官方周额度周期");
  assert.equal(quota.resources.quotaDiagnostic, null);
  assert.equal(quota.resources.quotaUrl, "https://grok.com/?_s=usage");
});

test("Grok credits parser keeps an official period when remaining usage is omitted", () => {
  const parsed = parseGrokCreditsConfig({
    config: {
      currentPeriod: {
        type: "USAGE_PERIOD_TYPE_WEEKLY",
        start: "2026-08-15T22:06:42.000Z",
        end: "2026-08-22T22:06:42.000Z",
      },
      prepaidBalance: { val: 0 },
    },
  }, { now: new Date("2026-08-16T12:00:00.000Z") });
  assert.equal(parsed.quota.remaining, null);
  assert.equal(parsed.quota.windows.length, 1);
  assert.equal(parsed.quota.windows[0].resetAt, "2026-08-22T22:06:42.000Z");
  assert.match(parsed.resources.quotaDiagnostic, /未返回剩余百分比/);
});

test("Grok credits authorization failures remain quota errors", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://grok/quota-401";
  await secretStore.write(credentialRef, { access: "grok-access", accountId: "grok-account", email: "grok@example.test" });
  const driver = createGrokDriver({
    catalogLoader: async () => ({ models: [] }),
    creditsUrl: "https://grok.test/v1/billing?format=credits",
    fetchImpl: async () => response(401, {}),
  });
  await assert.rejects(
    () => driver.getQuota({
      providerId: "grok",
      accountId: "grok-account",
      email: "grok@example.test",
      auth: { credentialRef },
    }, { secretStore }),
    (error) => error.quotaUnavailable === true && error.authExpired !== true,
  );
});

test("Grok model metadata comes from the provider cache, including returned reasoning tiers", () => {
  assert.deepEqual(parseGrokModelCatalog("", {
    models: {
      "grok-live": {
        info: {
          model: "grok-live",
          name: "Grok Live",
          context_window: 123456,
          reasoning_effort: "high",
          reasoning_efforts: [
            { id: "low", value: "low", label: "Low Effort" },
            { id: "high", value: "high", label: "High Effort", description: "provider returned", default: true },
          ],
        },
      },
    },
  }), [{
    id: "grok-live",
    name: "Grok Live",
    reasoning: {
      efforts: [
        { id: "low", name: "Low Effort" },
        { id: "high", name: "High Effort", description: "provider returned" },
      ],
      defaultEffort: "high",
    },
    contextWindow: 123456,
  }]);
});

test("Grok catalog loader caches a local provider response", async () => {
  let reads = 0;
  const loader = createGrokCatalogLoader({
    grokHome: "/provider/grok",
    readJson: async (path) => {
      reads += 1;
      assert.match(path, /models_cache\.json$/);
      return { models: { "grok-live": { info: { model: "grok-live" } } } };
    },
    cacheTtlMs: 60_000,
  });
  const first = await loader();
  const second = await loader();
  assert.deepEqual(first.models, [{ id: "grok-live", name: "grok-live" }]);
  assert.strictEqual(first, second);
  assert.equal(reads, 1);
  const forced = await loader({ force: true });
  assert.equal(reads, 2);
  assert.deepEqual(forced.models, [{ id: "grok-live", name: "grok-live" }]);
});

test("Grok catalog loader force refresh does not join an in-flight request", async () => {
  let calls = 0;
  let releaseFirst;
  let enteredFirst;
  const firstStarted = new Promise((resolve) => { releaseFirst = resolve; });
  const firstEntered = new Promise((resolve) => { enteredFirst = resolve; });
  const loader = createGrokCatalogLoader({
    grokHome: "/provider/grok",
    readJson: async () => {
      const call = ++calls;
      if (call === 1) {
        enteredFirst();
        await firstStarted;
      }
      return { models: { [`grok-${call}`]: { info: { model: `grok-${call}` } } } };
    },
    cacheTtlMs: 60_000,
  });
  const firstPromise = loader();
  await firstEntered;
  const forced = await loader({ force: true });
  releaseFirst();
  const first = await firstPromise;
  assert.equal(calls, 2);
  assert.deepEqual(forced.models, [{ id: "grok-2", name: "grok-2" }]);
  assert.deepEqual(first.models, [{ id: "grok-1", name: "grok-1" }]);
});

test("Claude subscription status rejects API keys and maps live registry metadata", async () => {
  const apiKey = parseClaudeAuthStatus(JSON.stringify({
    loggedIn: true,
    authMethod: "api_key",
    apiProvider: "firstParty",
    apiKeySource: "ANTHROPIC_API_KEY",
  }));
  assert.equal(apiKey.isApiKey, true);
  assert.equal(apiKey.isSubscription, false);

  const subscription = parseClaudeAuthStatus(JSON.stringify({
    loggedIn: true,
    authMethod: "oauth",
    apiProvider: "firstParty",
    email: "claude@example.test",
    plan: "max",
  }));
  assert.equal(subscription.isSubscription, true);
  assert.equal(subscription.email, "claude@example.test");

  const loader = createClaudeCatalogLoader({
    registryLoader: async () => [
      {
        id: "claude-live",
        name: "Claude Live",
        provider: "anthropic",
        api: "anthropic-messages",
        input: ["text", "image"],
        contextWindow: 200_000,
        maxTokens: 32_000,
        thinkingLevelMap: { off: {}, low: {}, high: {} },
      },
      { id: "unrelated", provider: "other" },
    ],
  });
  assert.deepEqual((await loader()).models, [{
    id: "claude-live",
    name: "Claude Live",
    inputModalities: ["text", "image"],
    contextWindow: 200_000,
    maxTokens: 32_000,
    reasoning: {
      efforts: [{ id: "low", name: "Low" }, { id: "high", name: "High" }],
    },
  }]);
});

test("CLI subscription drivers reject a non-active selected account before invoking", async () => {
  let claudeInvoked = false;
  const claude = createClaudeDriver({
    commandRunner: async () => ({
      output: JSON.stringify({
        loggedIn: true,
        authMethod: "oauth",
        apiProvider: "firstParty",
        accountId: "current-claude",
        email: "current@example.test",
      }),
    }),
    requestExecutor: async () => { claudeInvoked = true; },
  });
  await assert.rejects(
    () => claude.invoke({}, { account: { accountId: "old-claude", auth: { kind: "official_cli_session" } } }),
    (error) => error.authExpired === true && error.accountMismatch === true,
  );
  assert.equal(claudeInvoked, false);

  let cursorInvoked = false;
  const cursor = createCursorDriver({
    commandRunner: async () => ({
      output: JSON.stringify({ loggedIn: true, accountId: "current-cursor", email: "current@example.test" }),
    }),
    requestExecutor: async () => { cursorInvoked = true; },
  });
  await assert.rejects(
    () => cursor.invoke({}, { account: { accountId: "old-cursor", auth: { kind: "official_cli_session" } } }),
    (error) => error.authExpired === true && error.accountMismatch === true,
  );
  assert.equal(cursorInvoked, false);
});

test("browser OAuth invocations refresh Claude and Cursor access tokens", async () => {
  const secretStore = new MemorySecretStore();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const futureAccess = jwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "cursor-browser-account", email: "cursor@example.test" });

  let claudeRefreshCalls = 0;
  const claudeRef = "keychain://claude/browser-refresh";
  await secretStore.write(claudeRef, {
    type: "oauth",
    access: "claude-old-access",
    refresh: "claude-old-refresh",
    expiresAt: expiredAt,
  });
  const claude = createClaudeDriver({
    fetchImpl: async () => {
      claudeRefreshCalls += 1;
      return response(200, { access_token: "claude-new-access", refresh_token: "claude-new-refresh", expires_in: 3600 });
    },
    requestExecutor: async () => "claude-response",
  });
  const claudeResult = await claude.invoke({}, {
    account: {
      accountId: "claude-browser-account",
      email: "claude@example.test",
      auth: { credentialRef: claudeRef },
      resources: { authSource: "official_claude_browser_oauth" },
    },
  }, { secretStore });
  assert.equal(claudeResult, "claude-response");
  assert.equal(claudeRefreshCalls, 1);
  assert.equal((await secretStore.read(claudeRef)).access, "claude-new-access");

  let cursorRefreshCalls = 0;
  const cursorRef = "keychain://cursor/browser-refresh";
  await secretStore.write(cursorRef, {
    type: "oauth",
    access: jwt({ exp: Math.floor(Date.now() / 1000) - 60, sub: "cursor-browser-account" }),
    refresh: "cursor-old-refresh",
    expiresAt: expiredAt,
  });
  const cursor = createCursorDriver({
    fetchImpl: async (url) => {
      if (url.endsWith("/auth/exchange_user_api_key")) {
        cursorRefreshCalls += 1;
        return response(200, { accessToken: futureAccess, refreshToken: "cursor-new-refresh" });
      }
      throw new Error(`unexpected Cursor request: ${url}`);
    },
    requestExecutor: async () => "cursor-response",
  });
  const cursorResult = await cursor.invoke({}, {
    account: {
      accountId: "cursor-browser-account",
      email: "cursor@example.test",
      auth: { credentialRef: cursorRef },
      resources: { authSource: "official_cursor_browser_oauth" },
    },
  }, { secretStore });
  assert.equal(cursorResult, "cursor-response");
  assert.equal(cursorRefreshCalls, 1);
  assert.equal((await secretStore.read(cursorRef)).refresh, "cursor-new-refresh");
});

test("Claude CLI OAuth credentials are captured and refreshed from the persisted session", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-claude-oauth-file-"));
  const secretStore = new MemorySecretStore();
  try {
    await mkdir(join(home, ".claude"), { recursive: true });
    await writeFile(join(home, ".claude", ".credentials.json"), JSON.stringify({
      claudeAiOauth: {
        accessToken: "claude-file-old-access",
        refreshToken: "claude-file-refresh",
        expiresAt: "2020-01-01T00:00:00.000Z",
      },
    }));
    let refreshCalls = 0;
    const driver = createClaudeDriver({
      home,
      cliPath: "missing-claude",
      commandRunner: async () => ({
        output: JSON.stringify({
          loggedIn: true,
          authMethod: "oauth",
          apiProvider: "firstParty",
          accountId: "claude-file-account",
          email: "claude-file@example.test",
        }),
      }),
      fetchImpl: async () => {
        refreshCalls += 1;
        return response(200, {
          access_token: "claude-file-new-access",
          refresh_token: "claude-file-new-refresh",
          expires_in: 3600,
        });
      },
      requestExecutor: async () => "claude-file-response",
    });
    const active = await driver.getActiveSession({ secretStore });
    const account = active.accounts[0];
    assert.equal(account.refresh.refreshable, true);
    assert.equal((await secretStore.read(account.credentialRef)).refresh, "claude-file-refresh");
    const result = await driver.invoke({}, { account }, {
      secretStore,
      now: new Date("2026-08-24T12:00:00.000Z"),
    });
    assert.equal(result, "claude-file-response");
    assert.equal(refreshCalls, 1);
    assert.equal((await secretStore.read(account.credentialRef)).access, "claude-file-new-access");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("official desktop session readers can replace CLI detection and login", async () => {
  const claudeStore = new MemorySecretStore();
  const claude = createClaudeDriver({
    cliPath: "missing-claude",
    commandRunner: async () => { throw new Error("CLI should not be called"); },
    sessionReader: async () => ({
      source: "claude_desktop_app",
      sourceKind: "desktop_app",
      loggedIn: true,
      authMethod: "oauth",
      apiProvider: "firstParty",
      accountId: "claude-desktop-account",
      email: "desktop-claude@example.test",
    }),
  });
  const claudeActive = await claude.getActiveSession({ secretStore: claudeStore });
  assert.equal(claudeActive.status, "completed");
  assert.equal(claudeActive.accounts[0].auth.kind, "official_session");
  assert.equal(claudeActive.accounts[0].resources.sessionSource, "desktop_app");
  assert.equal((await claudeStore.read(claudeActive.accounts[0].credentialRef)).type, "official_session");
  const claudeStarted = await claude.startAuthorization();
  assert.equal(claudeStarted.status, "pending");
  assert.equal(claudeStarted.authorizationCodeRequired, true);
  await claude.cancelAuthorization(claudeStarted.sessionId);

  const cursorStore = new MemorySecretStore();
  const cursor = createCursorDriver({
    cliPath: "missing-cursor-agent",
    commandRunner: async () => { throw new Error("CLI should not be called"); },
    sessionReader: async () => ({
      source: "cursor_desktop_app",
      sourceKind: "desktop_app",
      loggedIn: true,
      accountId: "cursor-desktop-account",
      email: "desktop-cursor@example.test",
      plan: "pro",
    }),
  });
  const cursorActive = await cursor.getActiveSession({ secretStore: cursorStore });
  assert.equal(cursorActive.status, "completed");
  assert.equal(cursorActive.accounts[0].auth.kind, "official_session");
  assert.equal(cursorActive.accounts[0].resources.sessionSource, "desktop_app");
  const cursorStarted = await cursor.startAuthorization();
  assert.equal(cursorStarted.status, "pending");
  assert.match(cursorStarted.authorizationUrl, /^https:\/\/cursor\.com\/loginDeepControl/);
  await cursor.cancelAuthorization(cursorStarted.sessionId);
});

test("subscription drivers start browser OAuth without a local CLI", async () => {
  const cliCalls = [];
  const commandRunner = async (...args) => {
    cliCalls.push(args);
    throw new Error("CLI must not be required for browser OAuth");
  };
  const codex = createCodexDriver({ cliPath: "missing-codex", commandRunner });
  const codexStarted = await codex.startAuthorization();
  assert.equal(codexStarted.status, "pending");
  const codexUrl = new URL(codexStarted.authorizationUrl);
  assert.equal(codexUrl.origin, "https://auth.openai.com");
  assert.equal(codexUrl.pathname, "/oauth/authorize");
  assert.equal(codexUrl.searchParams.get("redirect_uri"), "http://localhost:1455/auth/callback");
  assert.equal(codexUrl.searchParams.get("code_challenge_method"), "S256");
  await codex.cancelAuthorization(codexStarted.sessionId);

  const antigravity = createAntigravityDriver({ cliPath: "missing-agy", commandRunner, env: antigravityTestEnv });
  const antigravityStarted = await antigravity.startAuthorization();
  assert.equal(antigravityStarted.status, "pending");
  const antigravityUrl = new URL(antigravityStarted.authorizationUrl);
  assert.equal(antigravityUrl.origin, "https://accounts.google.com");
  assert.equal(antigravityUrl.pathname, "/o/oauth2/v2/auth");
  assert.equal(antigravityUrl.searchParams.get("redirect_uri"), "http://localhost:51121/oauth-callback");
  assert.equal(antigravityUrl.searchParams.get("code_challenge_method"), "S256");
  await antigravity.cancelAuthorization(antigravityStarted.sessionId);

  const grok = createGrokDriver({ cliPath: "missing-grok", commandRunner });
  const grokStarted = await grok.startAuthorization();
  assert.equal(grokStarted.status, "pending");
  const grokUrl = new URL(grokStarted.authorizationUrl);
  assert.equal(grokUrl.origin, "https://auth.x.ai");
  assert.equal(grokUrl.pathname, "/oauth2/authorize");
  assert.equal(new URL(grokUrl.searchParams.get("redirect_uri")).pathname, "/callback");
  assert.equal(grokUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(grokUrl.searchParams.get("referrer"), "grok-build");
  await grok.cancelAuthorization(grokStarted.sessionId);

  const cursor = createCursorDriver({ cliPath: "missing-cursor-agent", commandRunner });
  const cursorStarted = await cursor.startAuthorization();
  assert.equal(cursorStarted.status, "pending");
  const cursorUrl = new URL(cursorStarted.authorizationUrl);
  assert.equal(cursorUrl.origin, "https://cursor.com");
  assert.equal(cursorUrl.pathname, "/loginDeepControl");
  assert.equal(cursorUrl.searchParams.get("mode"), "login");
  assert.equal(cursorUrl.searchParams.get("redirectTarget"), "cli");
  assert.equal(cursorUrl.searchParams.has("redirect_uri"), false);
  assert.ok(cursorUrl.searchParams.get("challenge"));
  assert.ok(cursorUrl.searchParams.get("uuid"));
  await cursor.cancelAuthorization(cursorStarted.sessionId);

  const claude = createClaudeDriver({ cliPath: "missing-claude", commandRunner });
  const claudeStarted = await claude.startAuthorization();
  assert.equal(claudeStarted.status, "pending");
  assert.equal(claudeStarted.authorizationCodeRequired, true);
  const claudeUrl = new URL(claudeStarted.authorizationUrl);
  assert.equal(claudeUrl.origin, "https://claude.com");
  assert.equal(claudeUrl.pathname, "/cai/oauth/authorize");
  assert.equal(claudeUrl.searchParams.get("code"), "true");
  assert.equal(claudeUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(claudeUrl.searchParams.get("redirect_uri"), "https://platform.claude.com/oauth/code/callback");
  await claude.cancelAuthorization(claudeStarted.sessionId);
  assert.equal(cliCalls.length, 0);
});

test("browser OAuth adapters exchange and import provider credentials", async () => {
  const secretStore = new MemorySecretStore();
  const commandRunner = async () => { throw new Error("CLI must not be used"); };
  const completeLoopback = async (driver, started) => {
    const redirect = new URL(new URL(started.authorizationUrl).searchParams.get("redirect_uri"));
    redirect.searchParams.set("code", "browser-code");
    redirect.searchParams.set("state", new URL(started.authorizationUrl).searchParams.get("state"));
    await fetch(redirect).then((value) => value.text());
    return driver.pollAuthorization(started.sessionId, { secretStore });
  };

  const codex = createCodexDriver({
    cliPath: "missing-codex",
    browserCallbackPort: 1455,
    commandRunner,
    fetchImpl: async () => response(200, {
      access_token: jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "codex-browser-account" } }),
      refresh_token: "codex-refresh",
      id_token: jwt({ "https://api.openai.com/profile": { email: "codex@example.test" } }),
    }),
  });
  const codexStarted = await codex.startAuthorization();
  const codexResult = await completeLoopback(codex, codexStarted);
  assert.equal(codexResult.status, "completed");
  assert.equal(codexResult.accounts[0].resources.sessionSource, "browser");
  assert.equal((await secretStore.read(codexResult.accounts[0].credentialRef)).refresh, "codex-refresh");

  const grok = createGrokDriver({
    cliPath: "missing-grok",
    commandRunner,
    fetchImpl: async () => response(200, {
      access_token: jwt({ sub: "grok-browser-account", email: "grok@example.test" }),
      refresh_token: "grok-refresh",
      expires_in: 3600,
    }),
  });
  const grokStarted = await grok.startAuthorization();
  const grokResult = await completeLoopback(grok, grokStarted);
  assert.equal(grokResult.status, "completed");
  assert.equal(grokResult.accounts[0].email, "grok@example.test");
  assert.equal(grokResult.accounts[0].resources.sessionSource, "browser");

  const claude = createClaudeDriver({
    cliPath: "missing-claude",
    commandRunner,
    fetchImpl: async () => response(200, {
      access_token: "claude-access",
      refresh_token: "claude-refresh",
      expires_in: 3600,
      email: "claude@example.test",
    }),
  });
  const claudeStarted = await claude.startAuthorization();
  const claudeRedirect = new URL(new URL(claudeStarted.authorizationUrl).searchParams.get("redirect_uri"));
  claudeRedirect.searchParams.set("code", "manual-code");
  claudeRedirect.searchParams.set("state", new URL(claudeStarted.authorizationUrl).searchParams.get("state"));
  const claudeResult = await claude.submitAuthorizationCode(claudeStarted.sessionId, claudeRedirect.toString(), { secretStore });
  assert.equal(claudeResult.status, "completed");
  assert.equal(claudeResult.accounts[0].resources.sessionSource, "browser");

  const antigravity = createAntigravityDriver({
    cliPath: "missing-agy",
    commandRunner,
    env: antigravityTestEnv,
    fetchImpl: async (url) => url.includes("userinfo")
      ? response(200, { email: "google@example.test", name: "Google Browser" })
      : response(200, { access_token: "google-access", refresh_token: "google-refresh", expires_in: 3600 }),
  });
  const antigravityStarted = await antigravity.startAuthorization();
  const antigravityResult = await completeLoopback(antigravity, antigravityStarted);
  assert.equal(antigravityResult.status, "completed");
  assert.equal(antigravityResult.accounts[0].email, "google@example.test");
  assert.equal(antigravityResult.accounts[0].resources.sessionSource, "browser");
  assert.equal(antigravityResult.accounts[0].resources.credentialRefreshMode, "dockyard_browser_oauth");
  const antigravityCredential = await secretStore.read(antigravityResult.accounts[0].credentialRef);
  assert.equal(antigravityCredential.access, "google-access");
  assert.equal(antigravityCredential.refresh, "google-refresh");
  assert.ok(antigravityCredential.expiresAt);

  const cursor = createCursorDriver({
    cliPath: "missing-cursor-agent",
    commandRunner,
    fetchImpl: async (url) => url.includes("/auth/poll")
      ? response(200, {
        accessToken: jwt({ sub: "cursor-browser-account", email: "cursor@example.test" }),
        refreshToken: "cursor-refresh",
      })
      : response(500, {}),
  });
  const cursorStarted = await cursor.startAuthorization();
  const cursorResult = await cursor.pollAuthorization(cursorStarted.sessionId, { secretStore });
  assert.equal(cursorResult.status, "completed");
  assert.equal(cursorResult.accounts[0].email, "cursor@example.test");
  assert.equal(cursorResult.accounts[0].resources.sessionSource, "browser");
});

test("Claude catalog collapses duplicate registry aliases", async () => {
  const loader = createClaudeCatalogLoader({
    registryLoader: async () => [
      { id: "claude-live", name: "Claude Live", provider: "anthropic", contextWindow: 200_000 },
      { id: "claude-live", name: "Claude Live", api: "anthropic-messages", maxTokens: 32_000 },
    ],
  });
  assert.deepEqual((await loader()).models, [{
    id: "claude-live",
    name: "Claude Live",
    contextWindow: 200_000,
    maxTokens: 32_000,
  }]);
});

test("Claude official CLI executor preserves streaming output and selected model tier", async () => {
  const calls = [];
  const executor = createClaudeCliExecutor({
    cliPath: "claude",
    streamCommandRunner: async function* (command, args, options) {
      calls.push({ command, args, options });
      yield JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } } });
      yield JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "lo" } } });
      yield JSON.stringify({ type: "result", result: "Hello", usage: { input_tokens: 2, output_tokens: 3 } });
    },
  });
  const stream = await executor({
    request: {
      model: "claude-live",
      reasoningEffort: "high",
      messages: [{ role: "user", content: "Say hello" }],
    },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "claude");
  assert.deepEqual(calls[0].args.slice(0, 4), ["-p", "user:\nSay hello", "--output-format", "stream-json"]);
  assert.ok(calls[0].args.includes("--model") && calls[0].args.includes("claude-live"));
  assert.ok(calls[0].args.includes("--effort") && calls[0].args.includes("high"));
  assert.deepEqual(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text), ["Hel", "lo"]);
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage")?.usage, { inputTokens: 2, outputTokens: 3 });
});

test("CLI event parsing only exposes assistant content", () => {
  assert.deepEqual(cliEventText({ type: "message", role: "user", content: "secret input" }), []);
  assert.deepEqual(cliEventText({ type: "assistant", role: "assistant", content: "answer" }), ["answer"]);
  assert.deepEqual(cliEventText({ type: "tool_result", content: "tool output" }), []);
});

test("text-only subscription CLIs reject images instead of dropping them", async () => {
  const imageRequest = {
    messages: [{
      role: "user",
      content: [{ type: "text", text: "Inspect this" }, { type: "image", attachment: { attachmentId: "img-1" } }],
    }],
  };
  const executor = createClaudeCliExecutor({ cliPath: "claude" });
  await assert.rejects(
    () => executor({ request: imageRequest }),
    (error) => error.code === "UNSUPPORTED_CONTENT" && /image attachments/.test(error.message),
  );
});

test("text-only subscription CLIs can continue after an earlier failed image turn", async () => {
  const calls = [];
  const executor = createClaudeCliExecutor({
    cliPath: "claude",
    streamCommandRunner: async function* (command, args) {
      calls.push({ command, args });
      yield JSON.stringify({ type: "text_delta", text: "continued" });
    },
  });
  const stream = await executor({
    request: {
      messages: [
        { role: "user", content: [{ type: "image", attachment: { attachmentId: "failed-image" } }] },
        { role: "assistant", content: "The image turn failed." },
        { role: "user", content: "Continue with text only." },
      ],
    },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(calls.length, 1);
  assert.match(calls[0].args[1], /previous image attachment omitted by native CLI/);
  assert.equal(chunks.find((chunk) => chunk.type === "text-delta")?.text, "continued");
});

test("Grok ACP prompt preserves durable image bytes and media type", async () => {
  const blocks = await grokRequestPromptBlocks({
    system: "Use the image.",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "What is here?" },
        { type: "image", attachment: { attachmentId: "img-1", mediaType: "image/png" } },
      ],
    }],
  }, {
    async readImage(ref) {
      assert.equal(ref.attachmentId, "img-1");
      return { ref: { mediaType: "image/png" }, data: Uint8Array.from([1, 2, 3]) };
    },
  });
  assert.deepEqual(blocks.at(-1), { type: "image", data: "AQID", mimeType: "image/png" });
});

test("Grok image requests use the native ACP executor", async () => {
  let textExecutorCalled = false;
  let acpRequest;
  const executor = createGrokCliExecutor({
    streamCommandRunner: async function* () {
      textExecutorCalled = true;
    },
    acpExecutor: async ({ request }) => {
      acpRequest = request;
      return (async function* () {
        yield { type: "text-delta", index: 0, text: "image ok" };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
  });
  const stream = await executor({
    request: {
      model: "grok-vision-live",
      messages: [{ role: "user", content: [{ type: "image", data: "AQID", mimeType: "image/png" }] }],
    },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(textExecutorCalled, false);
  assert.equal(acpRequest.model, "grok-vision-live");
  assert.equal(chunks[0].text, "image ok");
});

test("Cursor status/catalog are sourced from the official CLI response", async () => {
  const output = JSON.stringify({
    loggedIn: true,
    email: "cursor@example.test",
    plan: "pro",
    models: [{ id: "cursor-live", name: "Cursor Live", contextWindow: 128_000, maxTokens: 16_000 }],
  });
  const status = parseCursorAuthStatus(output);
  assert.equal(status.loggedIn, true);
  assert.equal(status.email, "cursor@example.test");
  assert.equal(status.models[0].id, "cursor-live");
  const loader = createCursorCatalogLoader({
    commandRunner: async (command, args) => {
      assert.equal(command, "cursor-agent");
      assert.deepEqual(args, ["status"]);
      return { output, errorOutput: "" };
    },
  });
  assert.deepEqual((await loader()).models, [{
    id: "cursor-live",
    name: "Cursor Live",
    contextWindow: 128_000,
    maxTokens: 16_000,
  }]);
});

test("Cursor catalog loader force refresh does not join an in-flight request", async () => {
  let calls = 0;
  let releaseFirst;
  let enteredFirst;
  const firstStarted = new Promise((resolve) => { releaseFirst = resolve; });
  const firstEntered = new Promise((resolve) => { enteredFirst = resolve; });
  const loader = createCursorCatalogLoader({
    commandRunner: async () => {
      const call = ++calls;
      if (call === 1) {
        enteredFirst();
        await firstStarted;
      }
      return {
        output: JSON.stringify({
          loggedIn: true,
          models: [{ id: `cursor-${call}`, name: `Cursor ${call}` }],
        }),
        errorOutput: "",
      };
    },
  });
  const firstPromise = loader();
  await firstEntered;
  const forced = await loader({ force: true });
  releaseFirst();
  const first = await firstPromise;
  assert.equal(calls, 2);
  assert.equal(forced.models[0].id, "cursor-2");
  assert.equal(first.models[0].id, "cursor-1");
});

test("Cursor Connect trailers expose upstream quota errors instead of an empty success", () => {
  const trailer = new TextEncoder().encode(JSON.stringify({
    error: { code: "resource_exhausted", message: "Error" },
  }));
  assert.deepEqual(decodeCursorConnectTrailer(trailer), {
    code: "resource_exhausted",
    message: "Error",
  });
  assert.equal(decodeCursorConnectTrailer(new TextEncoder().encode("{}")), null);
});

test("Cursor native executor rejects a quota trailer instead of yielding blank text", async () => {
  const http2Module = {
    constants: { NGHTTP2_CANCEL: 8 },
    connect() {
      const session = new EventEmitter();
      session.closed = false;
      session.destroyed = false;
      session.request = () => {
        const stream = new EventEmitter();
        stream.closed = false;
        stream.destroyed = false;
        stream.write = () => true;
        stream.close = () => {
          stream.closed = true;
          stream.destroyed = true;
        };
        queueMicrotask(() => {
          stream.emit("response", { ":status": 200 });
          stream.emit("data", Buffer.from(frameConnectMessage(
            new TextEncoder().encode(JSON.stringify({
              error: { code: "resource_exhausted", message: "Error" },
            })),
            0x02,
          )));
          stream.emit("end");
        });
        return stream;
      };
      session.close = () => {
        session.closed = true;
        session.destroyed = true;
      };
      return session;
    },
  };
  const executor = createCursorNativeExecutor({
    endpoint: "https://cursor.test/agent.v1.AgentService/Run",
    http2Module,
    tokenResolver: async () => ({ token: "opaque-test-token" }),
  });
  await assert.rejects(async () => {
    const stream = await executor({
      request: { model: "composer-2.5", messages: [{ role: "user", content: "Hello" }] },
      context: { requestId: "cursor-test", sessionId: "cursor-test" },
    });
    for await (const _chunk of stream) {
      // The quota trailer must fail before the synthetic finish event.
    }
  }, (error) => {
    assert.equal(error.code, "resource_exhausted");
    assert.equal(error.quotaExhausted, true);
    assert.match(error.message, /额度或上游资源已耗尽/);
    return true;
  });
});

test("Cursor browser OAuth resolves an email through the official identity RPC", async () => {
  const secretStore = new MemorySecretStore();
  let identityRequest = null;
  const driver = createCursorDriver({
    home: join(tmpdir(), "dockyard-cursor-rpc-test-no-desktop"),
    cliPath: "missing-cursor-agent",
    commandRunner: async () => { throw new Error("CLI must not be used"); },
    fetchImpl: async (url, init = {}) => {
      if (url.includes("/auth/poll")) {
        return response(200, {
          accessToken: jwt({ sub: "google-oauth2|user_cursor" }),
          refreshToken: "cursor-refresh",
          expiresIn: 3600,
        });
      }
      identityRequest = { url, init };
      return response(200, { email: "cursor-rpc@example.test" });
    },
  });
  const started = await driver.startAuthorization();
  const result = await driver.pollAuthorization(started.sessionId, { secretStore });
  assert.equal(result.accounts[0].email, "cursor-rpc@example.test");
  assert.equal(result.accounts[0].displayName, "cursor-rpc@example.test");
   assert.equal(result.accounts[0].refresh.refreshable, true);
   assert.ok(result.accounts[0].refresh.accessTokenExpiresAt);
   assert.equal((await secretStore.read(result.accounts[0].credentialRef)).expiresAt !== undefined, true);
  assert.equal(identityRequest.url, "https://api2.cursor.sh/aiserver.v1.AuthService/GetEmail");
  assert.equal(identityRequest.init.method, "POST");
  assert.deepEqual(JSON.parse(identityRequest.init.body), {});
  assert.equal((await secretStore.read(result.accounts[0].credentialRef)).email, "cursor-rpc@example.test");
});

test("Cursor refresh repairs an existing browser account's missing email", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://cursor/missing-email";
  await secretStore.write(credentialRef, { access: "cursor-access", refresh: "cursor-refresh" });
  const driver = createCursorDriver({
    home: join(tmpdir(), "dockyard-cursor-refresh-email-no-desktop"),
    commandRunner: async () => { throw new Error("CLI must not be used"); },
    fetchImpl: async (url) => url.includes("/GetEmail")
      ? response(200, { email: "repaired@example.test" })
      : response(500, {}),
  });
  const refreshed = await driver.refreshAccount({
    accountId: "google-oauth2|user_cursor",
    displayName: "google-oauth2|user_cursor",
    email: null,
    auth: { credentialRef, kind: "official_session" },
    resources: { authSource: "official_cursor_browser_oauth", sessionSource: "browser" },
    subscription: { plan: null },
  }, { secretStore, now: new Date("2026-08-16T12:00:00.000Z") });
  assert.equal(refreshed.identity.email, "repaired@example.test");
  assert.equal(refreshed.identity.displayName, "repaired@example.test");
});

test("Cursor browser OAuth rejects an expired access token before invocation", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://cursor/expired-browser";
  await secretStore.write(credentialRef, {
    access: jwt({ exp: Math.floor(Date.now() / 1000) - 60 }),
    refresh: "cursor-refresh",
  });
  const driver = createCursorDriver({
    commandRunner: async () => { throw new Error("CLI must not be used"); },
    fetchImpl: async () => { throw new Error("identity RPC must not be called"); },
  });
  await assert.rejects(
    driver.refreshAccount({
      accountId: "google-oauth2|user_expired",
      displayName: "Expired Cursor",
      email: "expired@example.test",
      auth: { credentialRef, kind: "official_session" },
      resources: { authSource: "official_cursor_browser_oauth", sessionSource: "browser" },
      subscription: { plan: null },
    }, { secretStore }),
    (error) => {
      assert.equal(error.authExpired, true);
      assert.match(error.message, /access token expired/);
      return true;
    },
  );
});

test("Cursor browser OAuth loads the official account model catalog without the CLI", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://cursor/browser-catalog";
  await secretStore.write(credentialRef, { access: "cursor-access" });
  let request = null;
  const loader = createCursorCatalogLoader({
    cliPath: "missing-cursor-agent",
    commandRunner: async () => { throw new Error("CLI must not be used for browser catalog"); },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return response(200, {
        models: [
          { name: "default", clientDisplayName: "Auto", supportsAgent: true },
          { name: "claude-4.5-sonnet", clientDisplayName: "Claude 4.5 Sonnet", contextTokenLimit: 200_000 },
        ],
      });
    },
  });
  const catalog = await loader({
    accounts: [{
      auth: { credentialRef },
      resources: { sessionSource: "browser", authSource: "official_cursor_browser_oauth" },
    }],
    secretStore,
  });
  assert.equal(catalog.source, "official_cursor_browser_oauth_api");
  assert.deepEqual(catalog.models, [
    { id: "default", name: "Auto" },
    { id: "claude-4.5-sonnet", name: "Claude 4.5 Sonnet", contextWindow: 200_000 },
  ]);
  assert.equal(request.url, "https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels");
  assert.equal(request.init.headers.authorization, "Bearer cursor-access");
  assert.equal(JSON.parse(request.init.body).useReactModelPicker, true);
});

test("Cursor official CLI executor passes the selected model and normalizes stream-json", async () => {
  const calls = [];
  const executor = createCursorCliExecutor({
    cliPath: "cursor-agent",
    streamCommandRunner: async function* (command, args, options) {
      calls.push({ command, args, options });
      yield JSON.stringify({ type: "text_delta", text: "Cursor response" });
      yield JSON.stringify({ type: "result", result: "Cursor response", usage: { input_tokens: 4, output_tokens: 5 } });
    },
  });
  const stream = await executor({
    request: { model: "cursor-live", messages: [{ role: "user", content: "Hello" }] },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(calls[0].command, "cursor-agent");
  assert.deepEqual(calls[0].args.slice(0, 4), ["-p", "user:\nHello", "--output-format", "stream-json"]);
  assert.ok(calls[0].args.includes("--model") && calls[0].args.includes("cursor-live"));
  assert.deepEqual(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text), ["Cursor response"]);
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage")?.usage, { inputTokens: 4, outputTokens: 5 });
});

test("Grok OAuth account execution uses an isolated official CLI profile", async () => {
  const home = await mkdtemp(join(tmpdir(), "dockyard-grok-exec-"));
  const secretStore = new MemorySecretStore();
  let profileDir = null;
  try {
    const driver = createGrokDriver({
      grokHome: home,
      commandRunner: async () => ({ output: "", errorOutput: "" }),
      catalogLoader: async () => ({ models: [] }),
      requestExecutor: async ({ context }) => {
        profileDir = context.env.GROK_HOME;
        const raw = JSON.parse(await readFile(join(profileDir, "auth.json"), "utf8"));
        assert.equal(raw["grok-account"].key, "access-token");
        return (async function* () {
          yield { type: "text-delta", index: 0, text: "ok" };
          yield { type: "finish", reason: { kind: "stop" } };
        })();
      },
    });
    const [account] = await driver.importSource({
      content: JSON.stringify({
        "grok-account": {
          key: "access-token",
          refresh_token: "refresh-token",
          user_id: "grok-account",
        },
      }),
    }, { secretStore });
    const stream = await driver.stream({ messages: [{ role: "user", content: "Hi" }] }, { account }, { secretStore });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(chunks[0].text, "ok");
    assert.ok(profileDir);
    await assert.rejects(readFile(join(profileDir, "auth.json")));
  } finally {
    await rm(home, { recursive: true, force: true });
    if (profileDir) await rm(profileDir, { recursive: true, force: true });
  }
});

test("Grok native invocation refreshes an expired OAuth credential before sending", async () => {
  const secretStore = new MemorySecretStore();
  const credentialRef = "keychain://grok/native-refresh";
  await secretStore.write(credentialRef, {
    type: "oauth",
    access: "grok-old-access",
    refresh: "grok-old-refresh",
    expiresAt: "2020-01-01T00:00:00.000Z",
    accountId: "grok-native-account",
  });
  let refreshRequest = null;
  let sentCredential = null;
  const executor = async ({ credential }) => {
    sentCredential = credential;
    return "grok-response";
  };
  executor.nativeTransport = "xai-chat-completions";
  const driver = createGrokDriver({
    tokenUrl: "https://auth.x.ai/oauth2/token",
    requestExecutor: executor,
    fetchImpl: async (url, init) => {
      refreshRequest = { url, init };
      return response(200, {
        access_token: "grok-new-access",
        refresh_token: "grok-new-refresh",
        expires_in: 3600,
      });
    },
  });
  const result = await driver.invoke({}, {
    account: {
      providerId: "grok",
      accountId: "grok-native-account",
      credentialRef,
      auth: { credentialRef },
      refresh: { accessTokenExpiresAt: "2020-01-01T00:00:00.000Z", refreshable: true },
    },
  }, {
    secretStore,
    now: new Date("2026-08-24T12:00:00.000Z"),
  });
  assert.equal(result, "grok-response");
  assert.equal(refreshRequest.url, "https://auth.x.ai/oauth2/token");
  assert.equal(refreshRequest.init.method, "POST");
  assert.match(String(refreshRequest.init.body), /grant_type=refresh_token/);
  assert.equal(sentCredential.access, "grok-new-access");
  assert.equal((await secretStore.read(credentialRef)).refresh, "grok-new-refresh");
});

test("Grok official CLI executor keeps streaming-json and live model selection", async () => {
  const calls = [];
  const executor = createGrokCliExecutor({
    cliPath: "grok",
    streamCommandRunner: async function* (command, args, options) {
      calls.push({ command, args, options });
      yield JSON.stringify({ type: "text_delta", text: "Grok response" });
      yield JSON.stringify({ type: "result", result: "Grok response" });
    },
  });
  const stream = await executor({
    request: { model: "grok-live", messages: [{ role: "user", content: "Hello" }], reasoningEffort: "high" },
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(calls[0].command, "grok");
  assert.deepEqual(calls[0].args.slice(0, 4), ["--single", "user:\nHello", "--output-format", "streaming-json"]);
  assert.ok(calls[0].args.includes("--model") && calls[0].args.includes("grok-live"));
  assert.ok(calls[0].args.includes("--reasoning-effort") && calls[0].args.includes("high"));
  assert.deepEqual(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text), ["Grok response"]);
});
