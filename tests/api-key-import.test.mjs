import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createCommandCodeDriver,
  createCommandCodeModule,
} from "../modules/provider-commandcode/src/index.mjs";
import {
  createHermesDriver,
  createHermesModule,
} from "../modules/provider-hermes/src/index.mjs";
import {
  createWorkbuddyDriver,
  createWorkbuddyModule,
} from "../modules/provider-workbuddy/src/index.mjs";
import { DockyardRuntime } from "../packages/runtime/src/dockyard-runtime.mjs";

function memoryStateStore() {
  let state = {};
  return {
    async load() { return structuredClone(state); },
    async update(mutator) { state = await mutator(structuredClone(state)); return structuredClone(state); },
    async save(next) { state = structuredClone(next); return structuredClone(state); },
  };
}

function memorySecretStore() {
  const data = new Map();
  return {
    data,
    async write(ref, value) {
      data.set(ref, value);
      return ref;
    },
    async read(ref) {
      return data.get(ref);
    },
    async delete(ref) {
      data.delete(ref);
    },
  };
}

function withEnv(vars, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

// Command Code and Hermes authenticate with a static API Key read from the
// official client's auth file. Before this existed the panel could not accept
// one at all, even though their own diagnostics told users to paste it there.

test("command and hermes both declare api_key_auth", () => {
  assert.ok(createCommandCodeModule().manifest.capabilities.includes("api_key_auth"));
  assert.ok(createHermesModule().manifest.capabilities.includes("api_key_auth"));
});

test("commandcode importSource rejects an empty key", async () => {
  const driver = createCommandCodeDriver();
  await assert.rejects(() => driver.importSource({ apiKey: "   " }), /Command Code API Key/);
});

test("commandcode importSource stores the pasted key and masks it in the label", async () => {
  await withEnv({ COMMAND_CODE_AUTH_PATH: undefined, COMMAND_CODE_API_KEY: undefined }, async () => {
    const driver = createCommandCodeDriver();
    const secretStore = memorySecretStore();

    const [account] = await driver.importSource({ apiKey: "cc-test-key-1234567890" }, { secretStore });

    assert.equal(account.providerId, "commandcode");
    assert.ok(account.accountId.startsWith("commandcode-"));
    const stored = await secretStore.read(account.auth.credentialRef);
    assert.equal(stored.apiKey, "cc-test-key-1234567890");
    // The raw secret must not be echoed back through the display name.
    assert.ok(!account.displayName.includes("cc-test-key-1234567890"));
    assert.match(account.displayName, /^Command Code Key \(/);
  });
});

test("commandcode importSource keeps the same account id for the same key", async () => {
  await withEnv({ COMMAND_CODE_AUTH_PATH: undefined, COMMAND_CODE_API_KEY: undefined }, async () => {
    const driver = createCommandCodeDriver();
    const [first] = await driver.importSource({ apiKey: "stable-key-abcdefgh" }, { secretStore: memorySecretStore() });
    const [second] = await driver.importSource({ apiKey: "stable-key-abcdefgh" }, { secretStore: memorySecretStore() });
    assert.equal(first.accountId, second.accountId);
  });
});

test("commandcode importSource prefers the pasted key over the on-disk auth file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dockyard-cc-"));
  const authPath = join(dir, "auth.json");
  writeFileSync(authPath, JSON.stringify({ apiKey: "key-from-disk", userId: "usr_disk" }));

  await withEnv({ COMMAND_CODE_AUTH_PATH: authPath, COMMAND_CODE_API_KEY: undefined }, async () => {
    const driver = createCommandCodeDriver();
    const secretStore = memorySecretStore();

    const [account] = await driver.importSource({ apiKey: "key-from-panel" }, { secretStore });

    const stored = await secretStore.read(account.auth.credentialRef);
    assert.equal(stored.apiKey, "key-from-panel");
    // A manual import is its own account, not the one the file describes.
    assert.ok(account.accountId.startsWith("commandcode-"));
    assert.notEqual(account.accountId, "usr_disk");
  });
});

test("hermes importSource rejects an empty key", async () => {
  const driver = createHermesDriver();
  await assert.rejects(() => driver.importSource({ apiKey: "" }), /Hermes/);
});

test("hermes importSource stores the pasted key and derives a stable account id", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dockyard-hermes-"));
  const authPath = join(dir, "auth.json");
  writeFileSync(authPath, JSON.stringify({ accounts: [{ accountId: "nous-disk", apiKey: "disk-key" }] }));

  await withEnv({ HERMES_AUTH_PATH: authPath, NOUS_AUTH_PATH: undefined }, async () => {
    const driver = createHermesDriver();
    const secretStore = memorySecretStore();

    const [account] = await driver.importSource({ apiKey: "nous-panel-key-9876" }, { secretStore });
    assert.equal(account.providerId, "hermes");
    assert.ok(account.accountId.startsWith("hermes-"));
    const stored = await secretStore.read(account.auth.credentialRef);
    assert.equal(stored.apiKey, "nous-panel-key-9876");
    assert.ok(!account.displayName.includes("nous-panel-key-9876"));

    const [again] = await driver.importSource({ apiKey: "nous-panel-key-9876" }, { secretStore: memorySecretStore() });
    assert.equal(account.accountId, again.accountId);
  });
});

// WorkBuddy is the opposite case: its account lives in the official desktop
// client and the plugin reads that session. There is no key to paste, so the
// panel must not offer a field and must not claim health it cannot verify.

test("workbuddy does not advertise a key field", () => {
  const capabilities = createWorkbuddyModule().manifest.capabilities;
  assert.ok(!capabilities.includes("api_key_auth"));
  assert.ok(!capabilities.includes("oauth_authorization"));
});

test("workbuddy explains that the account comes from the desktop client", async () => {
  const driver = createWorkbuddyDriver();
  const instructions = await driver.authorizationInstructions();
  // Both branches name the desktop client and the scan action; neither may tell
  // the user to paste a key, because no such key exists.
  assert.match(instructions, /桌面端/);
  assert.match(instructions, /扫描本机登录态/);
  assert.doesNotMatch(instructions, /粘贴/);
});

test("workbuddy offers no importSource", () => {
  assert.equal(createWorkbuddyDriver().importSource, undefined);
});

test("workbuddy refreshAccount reports healthy only when a token resolves", async () => {
  const driver = createWorkbuddyDriver();
  const secretStore = memorySecretStore();
  await secretStore.write("keychain://dockyard-dsh/workbuddy/manual", { access: "wb-token-1234" });
  const account = { auth: { credentialRef: "keychain://dockyard-dsh/workbuddy/manual" } };

  const refreshed = await driver.refreshAccount(account, { secretStore });
  assert.equal(refreshed.health.status, "healthy");
});

test("workbuddy discover does not invent a quota", async () => {
  const driver = createWorkbuddyDriver();
  const result = await driver.discover();
  const candidate = result.candidates[0];
  // It used to report a hard-coded 100/100 "requests" allowance on every scan.
  assert.equal(candidate.quota?.remaining, undefined);
  assert.equal(candidate.quota?.limit, undefined);
});

test("the runtime surfaces a provider's own authorization instructions", async () => {
  const runtime = new DockyardRuntime({
    stateStore: memoryStateStore(),
    secretStore: memorySecretStore(),
    providers: [{ module: createWorkbuddyModule({ driver: createWorkbuddyDriver() }) }],
  });
  await runtime.init();

  const instructions = await runtime.authorizationInstructions("workbuddy");
  assert.ok(typeof instructions === "string" && instructions.includes("桌面端"));

  // A provider that says nothing keeps the host's generic sentence.
  assert.equal(await runtime.authorizationInstructions("not-a-provider"), null);
});
