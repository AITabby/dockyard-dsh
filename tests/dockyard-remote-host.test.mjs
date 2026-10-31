import test from "node:test";
import assert from "node:assert/strict";

import { publicAuthResult, DockyardRemoteService } from "../packages/dsh-plugin/src/dockyard-remote-host.mjs";
import { DockyardDshService } from "../packages/dsh-plugin/src/dockyard-service.mjs";

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

test("DockyardDshService.testModelConnection measures latency on success and reports errors on failure", async () => {
  let invokedRequest = null;
  const mockRuntime = {
    async init() {},
    listProviderManifests() {
      return [{ id: "kilo", displayName: "Kilo" }];
    },
    async stream(providerId, request) {
      invokedRequest = { providerId, request };
      if (request.model === "failing-model") {
        const error = new Error("503 Service Unavailable: no upstreams available");
        error.status = 503;
        throw error;
      }
      return (async function* () {
        yield { type: "text-delta", text: "pong" };
      })();
    },
  };

  const service = new DockyardDshService({ runtime: mockRuntime });

  // Test successful model connection
  const successRes = await service.testModelConnection("kilo", "nvidia/nemotron-3.5-super-vl:free");
  assert.equal(successRes.ok, true);
  assert.equal(successRes.providerId, "kilo");
  assert.equal(successRes.modelId, "nvidia/nemotron-3.5-super-vl:free");
  assert.ok(typeof successRes.latencyMs === "number" && successRes.latencyMs >= 0);
  assert.equal(invokedRequest.providerId, "kilo");
  assert.equal(invokedRequest.request.model, "nvidia/nemotron-3.5-super-vl:free");
  assert.equal(invokedRequest.request.probe, true);
  assert.equal(invokedRequest.request.noFallback, true);

  // Test failing model connection
  const failRes = await service.testModelConnection("kilo", "failing-model");
  assert.equal(failRes.ok, false);
  assert.equal(failRes.providerId, "kilo");
  assert.equal(failRes.modelId, "failing-model");
  assert.equal(failRes.status, 503);
  assert.ok(failRes.error.includes("503"));

  // Remote service forwarding
  const mockCtx = {
    reflect: { provide() {} },
    provide() {},
    extend() { return this; },
    emit() {},
    on() { return () => {}; },
  };
  const remote = new DockyardRemoteService(mockCtx, { service });
  const remoteSuccess = await remote.testModelConnection({
    providerId: "kilo",
    modelId: "nvidia/nemotron-3.5-super-vl:free",
  });
  assert.equal(remoteSuccess.ok, true);
  assert.equal(remoteSuccess.modelId, "nvidia/nemotron-3.5-super-vl:free");
});
