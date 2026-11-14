import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGrokDriver } from "../modules/provider-grok/src/index.mjs";
import { createCredentialRef, MemorySecretStore } from "../packages/vault/src/index.mjs";

const TOKEN_URL = "https://auth.test/oauth2/token";
const CREDITS_URL = "https://grok.test/v1/billing?format=credits";
const USERINFO_URL = "https://grok.test/v1/userinfo";
const EXPIRED = new Date(Date.now() - 3_600_000).toISOString();
const FRESH = new Date(Date.now() + 3_600_000).toISOString();

function makeDriver({ secretStore, fetchImpl, home }) {
  return createGrokDriver({
    authFilePath: join(home, "auth.json"),
    grokHome: home,
    catalogLoader: async () => ({ models: [] }),
    fetchImpl,
    tokenUrl: TOKEN_URL,
    creditsUrl: CREDITS_URL,
    userinfoUrl: USERINFO_URL,
    secretStore,
  });
}

function grokAccount(accountId, credentialRef) {
  return { providerId: "grok", accountId, credentialRef };
}

function storedCredential(accountId, { access, refresh, expiresAt = EXPIRED }) {
  return {
    type: "oauth",
    providerId: "grok",
    access,
    refresh,
    accountId,
    expiresAt,
    clientId: "client-1",
  };
}

function creditsResponse() {
  return { ok: true, status: 200, json: async () => ({ config: { credit_usage_percent: 42 } }) };
}

test("Grok retries with the stored token when another writer rotated ours", async () => {
  // xAI invalidates the previous refresh token on every exchange. If the CLI
  // refreshed first, our copy is already spent and the store holds the live one.
  const home = await mkdtemp(join(tmpdir(), "dockyard-grok-rotate-"));
  try {
    const secretStore = new MemorySecretStore();
    const accountId = "grok-account-rotate";
    const ref = createCredentialRef("grok", accountId);
    await secretStore.write(ref, storedCredential(accountId, { access: "access-old", refresh: "refresh-old" }));

    const presented = [];
    const fetchImpl = async (url, init = {}) => {
      if (String(url).startsWith(TOKEN_URL)) {
        const token = new URLSearchParams(String(init.body)).get("refresh_token");
        presented.push(token);
        if (token === "refresh-old") {
          await secretStore.write(ref, storedCredential(accountId, { access: "access-cli", refresh: "refresh-new" }));
          return { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) };
        }
        return { ok: true, status: 200, json: async () => ({ access_token: "access-new", refresh_token: "refresh-newer", expires_in: 3600 }) };
      }
      return creditsResponse();
    };

    const driver = makeDriver({ secretStore, fetchImpl, home });
    await driver.getQuota(grokAccount(accountId, ref), { secretStore });

    assert.deepEqual(presented, ["refresh-old", "refresh-new"], "retries with the token the store holds now");
    const stored = await secretStore.read(ref);
    assert.equal(stored.access, "access-new");
    assert.equal(stored.refresh, "refresh-newer", "keeps the rotated token so the next refresh still works");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("Concurrent turns share a single token exchange", async () => {
  // Parallel steps used to present the same refresh token twice; the loser got
  // invalid_grant and the account looked expired.
  const home = await mkdtemp(join(tmpdir(), "dockyard-grok-singleflight-"));
  try {
    const secretStore = new MemorySecretStore();
    const accountId = "grok-account-single";
    const ref = createCredentialRef("grok", accountId);
    await secretStore.write(ref, storedCredential(accountId, { access: "access-old", refresh: "refresh-old" }));

    let tokenCalls = 0;
    const fetchImpl = async (url) => {
      if (String(url).startsWith(TOKEN_URL)) {
        tokenCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { ok: true, status: 200, json: async () => ({ access_token: "access-new", refresh_token: "refresh-newer", expires_in: 3600 }) };
      }
      return creditsResponse();
    };

    const driver = makeDriver({ secretStore, fetchImpl, home });
    await Promise.all([
      driver.getQuota(grokAccount(accountId, ref), { secretStore }),
      driver.getQuota(grokAccount(accountId, ref), { secretStore }),
    ]);
    assert.equal(tokenCalls, 1, "one exchange serves both callers");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("A missing credential is rebuilt from the official CLI auth file", async () => {
  // Losing the store entry used to be terminal. The CLI's file is the only
  // surviving copy because the old refresh token was already spent.
  const home = await mkdtemp(join(tmpdir(), "dockyard-grok-heal-"));
  try {
    const accountId = "grok-account-heal";
    await writeFile(join(home, "auth.json"), JSON.stringify({
      "https://auth.x.ai::heal": {
        key: "access-from-cli",
        refresh_token: "refresh-from-cli",
        user_id: accountId,
        expires_at: FRESH,
      },
    }), { mode: 0o600 });

    const secretStore = new MemorySecretStore();
    const seen = [];
    const fetchImpl = async (url, init = {}) => {
      if (String(url).startsWith(TOKEN_URL)) throw new Error("a fresh token must not be refreshed");
      seen.push(init.headers.authorization);
      return creditsResponse();
    };

    const driver = makeDriver({ secretStore, fetchImpl, home });
    await driver.getQuota(grokAccount(accountId, createCredentialRef("grok", accountId)), { secretStore });

    assert.deepEqual(seen, ["Bearer access-from-cli"]);
    assert.equal((await secretStore.read(createCredentialRef("grok", accountId))).refresh, "refresh-from-cli");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("A rotated token is mirrored into the official CLI auth file", async () => {
  // Both sides read one file; without the mirror the CLI keeps a spent token
  // and its next refresh locks us out in turn.
  const home = await mkdtemp(join(tmpdir(), "dockyard-grok-mirror-"));
  try {
    const accountId = "grok-account-mirror";
    const ref = createCredentialRef("grok", accountId);
    const authPath = join(home, "auth.json");
    await writeFile(authPath, JSON.stringify({
      "https://auth.x.ai::mirror": {
        key: "access-old",
        refresh_token: "refresh-old",
        user_id: accountId,
        expires_at: EXPIRED,
      },
    }), { mode: 0o600 });

    const secretStore = new MemorySecretStore();
    await secretStore.write(ref, storedCredential(accountId, { access: "access-old", refresh: "refresh-old" }));

    const fetchImpl = async (url) => {
      if (String(url).startsWith(TOKEN_URL)) {
        return { ok: true, status: 200, json: async () => ({ access_token: "access-mirrored", refresh_token: "refresh-mirrored", expires_in: 3600 }) };
      }
      return creditsResponse();
    };

    const driver = makeDriver({ secretStore, fetchImpl, home });
    await driver.getQuota(grokAccount(accountId, ref), { secretStore });

    const entry = Object.values(JSON.parse(await readFile(authPath, "utf8")))[0];
    assert.equal(entry.key, "access-mirrored");
    assert.equal(entry.refresh_token, "refresh-mirrored");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
