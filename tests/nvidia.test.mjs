import assert from "node:assert/strict";
import test from "node:test";

import {
  createNvidiaCatalogLoader,
  createNvidiaDriver,
  createNvidiaNativeExecutor,
  parseNvidiaCatalog,
} from "../modules/provider-nvidia/src/index.mjs";

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
  return {
    data,
    async write(ref, value) { data.set(ref, value); },
    async read(ref) { return data.get(ref); },
  };
}

test("the catalog is read from NVIDIA's live list, not a bundled table", async () => {
  const fetched = [];
  const loader = createNvidiaCatalogLoader({
    fetchImpl: async (url) => {
      fetched.push(String(url));
      return new Response(JSON.stringify({
        object: "list",
        data: [
          { id: "nvidia/nemotron-3-ultra-550b-a55b", object: "model", owned_by: "nvidia" },
          { id: "meta/llama-3.3-70b-instruct", object: "model", owned_by: "meta" },
          { id: "nvidia/nemotron-3-ultra-550b-a55b", object: "model", owned_by: "nvidia" },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const catalog = await loader({});
  assert.match(fetched[0], /\/v1\/models$/u);
  // Duplicates collapse; the origin vendor in the id is kept as the label.
  assert.deepEqual(catalog.models.map((model) => model.id), [
    "nvidia/nemotron-3-ultra-550b-a55b",
    "meta/llama-3.3-70b-instruct",
  ]);
  assert.equal(catalog.models[0].name, "nvidia/nemotron-3-ultra-550b-a55b");
  // NVIDIA's hosted tier is free, and the panel groups by this flag.
  assert.ok(catalog.models.every((model) => model.free === true));
});

test("the catalog caches briefly and refetches when forced", async () => {
  let calls = 0;
  const loader = createNvidiaCatalogLoader({
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ data: [{ id: `owned/model-${calls}` }] }), { status: 200 });
    },
  });
  const first = await loader({});
  const second = await loader({});
  assert.equal(calls, 1, "a second read inside the TTL reuses the cache");
  assert.equal(first.models[0].id, second.models[0].id);

  const forced = await loader({ force: true });
  assert.equal(calls, 2);
  assert.equal(forced.models[0].id, "owned/model-2");
});

test("a failed catalog fetch reports a diagnostic instead of an empty success", async () => {
  const loader = createNvidiaCatalogLoader({
    fetchImpl: async () => { throw new Error("network down"); },
  });
  const catalog = await loader({});
  assert.deepEqual(catalog.models, []);
  assert.ok(Array.isArray(catalog.diagnostics) && catalog.diagnostics.length > 0);
});

test("parseNvidiaCatalog ignores entries without a usable id", () => {
  const parsed = parseNvidiaCatalog({ data: [{ id: "" }, { object: "model" }, { id: "a/b" }] });
  assert.deepEqual(parsed.models.map((model) => model.id), ["a/b"]);
});

test("only nvapi- keys are accepted from the panel", async () => {
  const driver = createNvidiaDriver({ fetchImpl: async () => new Response("{}", { status: 200 }) });
  await assert.rejects(() => driver.importSource({ apiKey: "sk-not-nvidia" }), /nvapi-/u);
  await assert.rejects(() => driver.importSource({ apiKey: "   " }), /请输入/u);

  const secretStore = memorySecretStore();
  const [account] = await driver.importSource({ apiKey: "nvapi-test-key-1234567890" }, { secretStore });
  assert.match(account.accountId, /^nvidia-[0-9a-f]{16}$/u);
  assert.equal(account.providerId, "nvidia");
  const stored = await secretStore.read(account.auth.credentialRef);
  assert.equal(stored.apiKey, "nvapi-test-key-1234567890");
});

test("the same key imported twice resolves to one account", async () => {
  const driver = createNvidiaDriver({ fetchImpl: async () => new Response("{}", { status: 200 }) });
  const secretStore = memorySecretStore();
  const [first] = await driver.importSource({ apiKey: "nvapi-stable-key" }, { secretStore });
  const [second] = await driver.importSource({ apiKey: "nvapi-stable-key" }, { secretStore });
  assert.equal(first.accountId, second.accountId);
});

test("the free tier reports no metered quota", async () => {
  const driver = createNvidiaDriver({ fetchImpl: async () => new Response("{}", { status: 200 }) });
  const quota = await driver.getQuota({ accountId: "nvidia-1" });
  assert.match(quota.resources.quotaDiagnostic, /免费/u);
  assert.equal(quota.resources.quotaAvailable, undefined);
});

test("a missing key fails before the request leaves the machine", async () => {
  let called = false;
  const executor = createNvidiaNativeExecutor({
    fetchImpl: async () => { called = true; return new Response("", { status: 200 }); },
    env: {},
  });
  await assert.rejects(async () => {
    for await (const event of executor({ request: { model: "nvidia/x", messages: [] }, credential: null })) void event;
  }, (error) => {
    assert.equal(error.code, "AUTH_REQUIRED");
    return true;
  });
  assert.equal(called, false);
});

test("the executor streams answer, reasoning and tool calls", async () => {
  const executor = createNvidiaNativeExecutor({
    env: {},
    fetchImpl: async () => new Response(sseBody([
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "想一下" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "结果是" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "bash", arguments: "{\"cmd\":" } }] } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "\"ls\"}" } }] } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 5, completion_tokens: 7 } })}\n\n`,
      "data: [DONE]\n\n",
    ]), { status: 200, headers: { "content-type": "text/event-stream" } }),
  });

  const events = await collect(await executor({
    request: { model: "nvidia/nemotron-3-ultra-550b-a55b", messages: [{ role: "user", content: "hi" }] },
    credential: { apiKey: "nvapi-test" },
  }));

  const text = events.filter((event) => event.type === "text-delta").map((event) => event.text).join("");
  assert.equal(text, "结果是");
  const reasoning = events.filter((event) => event.type === "reasoning-delta").map((event) => event.text).join("");
  assert.equal(reasoning, "想一下");
  const call = events.find((event) => event.type === "block-end" && event.block?.type === "tool-call");
  assert.equal(call.block.name, "bash");
  assert.equal(call.block.arguments, '{"cmd":"ls"}');
  assert.deepEqual(events.at(-1), { type: "finish", reason: { kind: "tool-calls" } });
});

test("a stream cut before its terminator fails instead of reporting a stop", async () => {
  const executor = createNvidiaNativeExecutor({
    env: {},
    fetchImpl: async () => new Response(sseBody([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "半句" } }] })}\n\n`,
    ]), { status: 200, headers: { "content-type": "text/event-stream" } }),
  });
  await assert.rejects(async () => {
    for await (const event of executor({
      request: { model: "nvidia/x", messages: [{ role: "user", content: "hi" }] },
      credential: { apiKey: "nvapi-test" },
    })) void event;
  }, (error) => {
    assert.equal(error.code, "NVIDIA_TRUNCATED_STREAM");
    return true;
  });
});

test("a key already stored in DSH's credentials file is reused", async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const home = mkdtempSync(join(tmpdir(), "nvidia-home-"));
  mkdirSync(join(home, ".dsh"), { recursive: true });
  writeFileSync(join(home, ".dsh", ".credentials.yaml"), [
    "# DSH credentials",
    "NVIDIA_API_KEY: nvapi-from-dsh-file-1234567890",
    "OTHER_KEY: sk-something",
  ].join("\n"));

  const driver = createNvidiaDriver({ fetchImpl: async () => new Response("{}", { status: 200 }), env: {}, home });
  const discovered = await driver.discover();
  assert.equal(discovered.source, "dsh_credentials");
  assert.equal(discovered.candidates.length, 1);
  assert.equal(discovered.candidates[0].apiKey, "nvapi-from-dsh-file-1234567890");
});

test("an empty environment and no credentials file reports why nothing was found", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const driver = createNvidiaDriver({
    fetchImpl: async () => new Response("{}", { status: 200 }),
    env: {},
    home: mkdtempSync(join(tmpdir(), "nvidia-empty-")),
  });
  const discovered = await driver.discover();
  assert.deepEqual(discovered.candidates, []);
  assert.match(discovered.diagnostics[0], /nvapi-/u);
});
