import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILTIN_AGENTROUTER_MODELS,
  DEFAULT_AGENTROUTER_USER_AGENT,
  createAgentRouterCatalogLoader,
  createAgentRouterDriver,
  createAgentRouterNativeExecutor,
  parseAgentRouterCatalog,
} from "../modules/provider-agentrouter/src/index.mjs";

function sseBody(lines) {
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(new TextEncoder().encode(line));
      controller.close();
    },
  });
}

async function collect(stream) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

function memorySecretStore() {
  const data = new Map();
  return { data, async write(ref, value) { data.set(ref, value); }, async read(ref) { return data.get(ref); } };
}

test("requests carry a client string the service allows", async () => {
  // AgentRouter answers "unauthorized client detected" to curl, python and DSH's
  // own client before it ever looks at the key, so this header is load-bearing.
  let headers = null;
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return new Response(sseBody([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
        "data: [DONE]\n\n",
      ]), { status: 200, headers: { "content-type": "text/event-stream" } });
    },
  });

  await collect(await executor({
    request: { model: "gpt-6-astra", messages: [{ role: "user", content: "hi" }] },
    credential: { apiKey: "sk-test" },
  }));

  assert.equal(headers["user-agent"], DEFAULT_AGENTROUTER_USER_AGENT);
  assert.equal(headers.authorization, "Bearer sk-test");
});

test("the client string can be overridden for a changed allow-list", async () => {
  let headers = null;
  const executor = createAgentRouterNativeExecutor({
    env: {},
    userAgent: "opencode/2.0.0",
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return new Response(sseBody([
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
      ]), { status: 200 });
    },
  });
  await collect(await executor({
    request: { model: "gpt-6-astra", messages: [{ role: "user", content: "hi" }] },
    credential: { apiKey: "sk-test" },
  }));
  assert.equal(headers["user-agent"], "opencode/2.0.0");
});

test("the catalog falls back to the advertised models without a key", async () => {
  const loader = createAgentRouterCatalogLoader({ fetchImpl: async () => { throw new Error("no key"); } });
  const catalog = await loader({ credential: null });
  assert.deepEqual(catalog.models.map((model) => model.id), BUILTIN_AGENTROUTER_MODELS.map((model) => model.id));
  assert.match(catalog.diagnostics?.[0] ?? "", /尚未配置 API Key/u);
});

test("a live catalog read wins and keeps the advertised context windows", async () => {
  let sentUa = null;
  const loader = createAgentRouterCatalogLoader({
    fetchImpl: async (_url, init) => {
      sentUa = init.headers["user-agent"];
      return new Response(JSON.stringify({
        data: [
          { id: "gpt-6.1-sol" },
          { id: "gpt-6-astra" },
          { id: "brand-new-model" },
        ],
      }), { status: 200 });
    },
  });
  const catalog = await loader({ credential: { apiKey: "sk-test" } });
  assert.equal(sentUa, DEFAULT_AGENTROUTER_USER_AGENT, "the models read needs the client string too");
  const byId = new Map(catalog.models.map((model) => [model.id, model]));
  assert.equal(byId.get("gpt-6.1-sol").contextWindow, 1_000_000);
  assert.equal(byId.get("gpt-6-astra").contextWindow, 400_000);
  // A model we have no advertisement for still shows up, with a safe default.
  assert.equal(byId.get("brand-new-model").contextWindow, 128_000);
});

test("parsing ignores entries without an id", () => {
  const parsed = parseAgentRouterCatalog({ data: [{ id: "" }, { object: "model" }, { id: "a" }] });
  assert.deepEqual(parsed.models.map((model) => model.id), ["a"]);
});

test("a pasted key becomes one reusable account", async () => {
  const driver = createAgentRouterDriver({ fetchImpl: async () => new Response("{}", { status: 200 }), env: {} });
  const secretStore = memorySecretStore();
  const [first] = await driver.importSource({ apiKey: "sk-live-key-123" }, { secretStore });
  const [second] = await driver.importSource({ apiKey: "sk-live-key-123" }, { secretStore });
  assert.equal(first.accountId, second.accountId);
  assert.equal(first.providerId, "agentrouter");
  const stored = await secretStore.read(first.auth.credentialRef);
  assert.equal(stored.apiKey, "sk-live-key-123");

  await assert.rejects(() => driver.importSource({ apiKey: "  " }), /请输入/u);
});

test("the executor refuses to send anything without a key", async () => {
  let called = false;
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async () => { called = true; return new Response("", { status: 200 }); },
  });
  await assert.rejects(async () => {
    for await (const event of executor({ request: { model: "x", messages: [] }, credential: null })) void event;
  }, (error) => {
    assert.equal(error.code, "AUTH_REQUIRED");
    return true;
  });
  assert.equal(called, false, "nothing leaves the machine without a key");
});

test("a cut stream fails instead of pretending the answer finished", async () => {
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async () => new Response(sseBody([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "half" } }] })}\n\n`,
    ]), { status: 200 }),
  });
  await assert.rejects(async () => {
    for await (const event of executor({
      request: { model: "gpt-6-astra", messages: [{ role: "user", content: "hi" }] },
      credential: { apiKey: "sk-test" },
    })) void event;
  }, (error) => {
    assert.equal(error.code, "AGENTROUTER_TRUNCATED_STREAM");
    return true;
  });
});
