import assert from "node:assert/strict";
import test from "node:test";

import {
  createKiloModule,
  parseKiloCatalog,
  BUILTIN_KILO_FREE_MODELS,
  buildKiloMessages,
  createKiloDriver,
  createKiloNativeExecutor,
} from "../modules/provider-kilo/src/index.mjs";

function memoryStateStore(initial = {}) {
  let state = structuredClone(initial);
  return {
    async load() {
      return structuredClone(state);
    },
    async update(mutator) {
      state = await mutator(structuredClone(state));
      return structuredClone(state);
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}

test("Kilo provider module manifest and builtin models", async () => {
  const mod = createKiloModule();
  assert.equal(mod.manifest.id, "kilo");
  assert.equal(mod.manifest.displayName, "Kilo Free");
  assert.ok(mod.manifest.capabilities.includes("catalog"));
  assert.ok(mod.manifest.capabilities.includes("stream"));

  assert.ok(BUILTIN_KILO_FREE_MODELS.length >= 8);
  const autoFree = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "kilo-auto/free");
  assert.ok(autoFree);
  assert.equal(autoFree.name, "Auto Free (Kilo)");
  assert.equal(autoFree.contextWindow, 256000);

  const nemotron = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "nvidia/nemotron-3.5-super-vl:free");
  assert.ok(nemotron);
  assert.equal(nemotron.contextWindow, 1000000);

  const beam = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "reflection/beam-free");
  assert.ok(beam);
  assert.equal(beam.contextWindow, 1048576);
});

test("parseKiloCatalog handles live Kilo API payload and filters isFree models", async () => {
  const mockApiData = {
    data: [
      {
        id: "kilo-auto/free",
        name: "Auto Free",
        isFree: true,
        context_length: 256000,
        top_provider: { max_completion_tokens: 32768 },
      },
      {
        id: "nvidia/nemotron-3.5-super-vl:free",
        name: "NVIDIA: Nemotron 3.5 Super VL (free)",
        isFree: true,
        context_length: 1000000,
        top_provider: { max_completion_tokens: 131072 },
      },
      {
        id: "anthropic/claude-opus-5.5",
        name: "Claude Opus 5.5",
        isFree: false,
        context_length: 1000000,
      },
    ],
  };

  const parsed = parseKiloCatalog(mockApiData);
  assert.equal(parsed.models.length, 2);
  assert.equal(parsed.models[0].id, "kilo-auto/free");
  assert.equal(parsed.models[0].free, true);
  assert.equal(parsed.models[1].id, "nvidia/nemotron-3.5-super-vl:free");
  assert.equal(parsed.models[1].free, true);
});

test("buildKiloMessages formats user and assistant messages", async () => {
  const request = {
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello Kilo" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "Write a poem" },
    ],
  };

  const messages = await buildKiloMessages(request);
  assert.equal(messages.length, 4);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[0].content, "You are a helpful assistant");
  assert.equal(messages[1].role, "user");
  assert.equal(messages[1].content, "Hello Kilo");
  assert.equal(messages[2].role, "assistant");
  assert.equal(messages[2].content, "Hello!");
  assert.equal(messages[3].role, "user");
  assert.equal(messages[3].content, "Write a poem");
});

test("createKiloNativeExecutor streams reasoning and text chunks with usage", async () => {
  const sseChunks = [
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: { reasoning_content: "Thinking..." } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: { content: "Hello from " } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: { content: "Kilo Free!" } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    })}\n\n`,
    `data: [DONE]\n\n`,
  ];

  let requestMade = false;
  const mockFetch = async (url, options) => {
    requestMade = true;
    assert.equal(options.method, "POST");
    assert.ok(url.includes("/chat/completions"));

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const executor = createKiloNativeExecutor({
    fetchImpl: mockFetch,
  });

  const events = [];
  for await (const event of executor({
    request: { model: "kilo-auto/free", messages: [{ role: "user", content: "Hi" }] },
    credential: { access: "free-tier" },
  })) {
    events.push(event);
  }

  assert.ok(requestMade);
  const reasoningDeltas = events.filter((e) => e.type === "reasoning-delta").map((e) => e.text).join("");
  assert.equal(reasoningDeltas, "Thinking...");

  const textDeltas = events.filter((e) => e.type === "text-delta").map((e) => e.text).join("");
  assert.equal(textDeltas, "Hello from Kilo Free!");

  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.reason.kind, "stop");
  assert.equal(finish.usage.totalTokens, 30);
});

test("DockyardRuntime auto-provisions Kilo free account without requiring any local CLI or App", async () => {
  const { DockyardRuntime } = await import("../packages/runtime/src/dockyard-runtime.mjs");
  const { createDockyardLlmAdapter } = await import("../packages/dsh-bridge/src/llm-adapter.mjs");

  const stateStore = memoryStateStore();
  const secretStore = {
    async write() {},
    async read() { return null; },
    async delete() {},
  };

  const runtime = new DockyardRuntime({
    stateStore,
    secretStore,
    providers: [
      {
        module: createKiloModule({
          driver: createKiloDriver(),
        }),
      },
    ],
  });

  await runtime.init();

  const snapshot = runtime.snapshot();
  const kiloEntry = snapshot.providers.find((p) => p.providerId === "kilo");
  assert.ok(kiloEntry, "Kilo provider should be registered");
  assert.equal(kiloEntry.accounts.length, 1, "Kilo should auto-provision the free account candidate");
  assert.equal(kiloEntry.accounts[0].accountId, "kilo-free");

  const adapter = createDockyardLlmAdapter({
    runtime,
    providerIds: ["kilo"],
  });

  const models = await adapter.listModels("kilo");
  assert.ok(models.length >= 8);
  assert.ok(models.some((m) => m.id === "kilo-auto/free"));
  assert.ok(models.some((m) => m.id === "nvidia/nemotron-3.5-super-vl:free"));
  assert.ok(models.some((m) => m.id === "reflection/beam-free"));

  // Real-time selection test
  await runtime.setModelSelection("kilo", ["nvidia/nemotron-3.5-super-vl:free"]);
  const filtered = await adapter.listModels("kilo");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "nvidia/nemotron-3.5-super-vl:free");
});
