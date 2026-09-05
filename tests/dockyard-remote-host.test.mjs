import test from "node:test";
import assert from "node:assert/strict";

import { publicAuthResult, DockyardRemoteService } from "../packages/dsh-plugin/src/dockyard-remote-host.mjs";

test("publicAuthResult preserves manual-code metadata without exposing credentials", () => {
  const result = publicAuthResult({
    status: "pending",
    providerId: "claude",
    sessionId: "claude:browser:session",
    authorizationUrl: "https://claude.com/cai/oauth/authorize",
    authorizationCodeRequired: true,
    access_token: "must-not-cross-RPC",
    refresh_token: "must-not-cross-RPC",
  });

  assert.equal(result.authorizationCodeRequired, true);
  assert.equal(result.access_token, undefined);
  assert.equal(result.refresh_token, undefined);
  assert.deepEqual(Object.keys(result).sort(), [
    "authorizationCodeRequired",
    "authorizationUrl",
    "providerId",
    "sessionId",
    "status",
  ]);
});

test("Dockyard remote host exposes refreshCatalog as a public RPC", async () => {
  const calls = [];
  const service = {
    async refreshCatalog(providerId) {
      calls.push(providerId);
      return { providerId, providerIds: [providerId], catalogs: [{ providerId, modelCount: 2 }] };
    },
    async snapshot() {
      return { providers: [] };
    },
  };
  const remote = Object.create(DockyardRemoteService.prototype);
  remote.dockyard = service;
  remote.nativeKeyPool = null;
  const result = await remote.refreshCatalog({ providerId: "cursor" });
  assert.deepEqual(calls, ["cursor"]);
  assert.equal(result.result.catalogs[0].modelCount, 2);
  assert.deepEqual(result.snapshot, { providers: [] });
});
