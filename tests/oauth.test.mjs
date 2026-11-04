import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserOAuthAuthorizer } from "../packages/oauth/src/browser-oauth-authorizer.mjs";

function authorizer(overrides = {}) {
  const calls = { exchanged: [], imported: [] };
  const auth = createBrowserOAuthAuthorizer({
    providerId: "oauth-test",
    callbackHost: "localhost",
    callbackPort: 0,
    authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri }) =>
      `https://provider.test/authorize?state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    exchangeCode: async ({ code, codeVerifier }) => {
      calls.exchanged.push({ code, codeVerifier });
      return [{ providerId: "oauth-test", accountId: "acct" }];
    },
    importCredentials: async (credentials) => {
      calls.imported.push(credentials);
      return [{ providerId: "oauth-test", accountId: "acct" }];
    },
    ...overrides,
  });
  return { auth, calls };
}

test("begin binds a loopback callback and generates a fresh state plus PKCE challenge", async () => {
  const { auth } = authorizer();
  const first = await auth.begin();
  const second = await auth.begin();
  try {
    assert.equal(first.status, "pending");
    assert.ok(first.sessionId);
    const url = new URL(first.authorizationUrl);
    const state1 = url.searchParams.get("state");
    const state2 = new URL(second.authorizationUrl).searchParams.get("state");
    assert.ok(state1 && state1.length >= 20, "state must be high-entropy");
    assert.notEqual(state1, state2, "each session needs a distinct state");
    assert.ok(url.searchParams.get("code_challenge"), "PKCE S256 challenge must be present");
    assert.match(first.authorizationUrl, /redirect_uri=http%3A%2F%2Flocalhost%3A/, "callback must be loopback");
  } finally {
    await auth.cancel(first.sessionId);
    await auth.cancel(second.sessionId);
  }
});

test("manual callback submission rejects a mismatched state", async () => {
  const { auth, calls } = authorizer();
  const session = await auth.begin();
  try {
    const state = new URL(session.authorizationUrl).searchParams.get("state");
    const result = await auth.submitAuthorizationCode(
      session.sessionId,
      `https://provider.test/callback?code=fake-code&state=${encodeURIComponent(`${state}-tampered`)}`,
    );
    assert.equal(result.status, "failed");
    assert.match(result.diagnostic, /state/);
    assert.equal(calls.exchanged.length, 0, "a tampered state must never reach token exchange");
  } finally {
    await auth.cancel(session.sessionId);
  }
});

test("manual callback submission accepts the matching state and exchanges the code", async () => {
  const { auth, calls } = authorizer();
  const session = await auth.begin();
  const state = new URL(session.authorizationUrl).searchParams.get("state");
  const result = await auth.submitAuthorizationCode(
    session.sessionId,
    `https://provider.test/callback?code=real-code&state=${encodeURIComponent(state)}`,
  );
  assert.notEqual(result.status, "failed");
  assert.deepEqual(calls.exchanged.map((entry) => entry.code), ["real-code"]);
  assert.ok(calls.exchanged[0].codeVerifier, "PKCE verifier must be passed to the token exchange");
});

test("code#state manual input is supported without a full URL", async () => {
  const { auth, calls } = authorizer();
  const session = await auth.begin();
  const state = new URL(session.authorizationUrl).searchParams.get("state");
  const result = await auth.submitAuthorizationCode(session.sessionId, `manual-code#${state}`);
  assert.notEqual(result.status, "failed");
  assert.deepEqual(calls.exchanged.map((entry) => entry.code), ["manual-code"]);
});

test("non-loopback callback hosts and redirect URIs are rejected", () => {
  for (const options of [
    { callbackHost: "0.0.0.0" },
    { redirectUri: "http://192.168.1.5:51121/callback" },
  ]) {
    assert.throws(
      () => authorizer(options).auth,
      /loopback/,
    );
  }
});
