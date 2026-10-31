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
  assert.ok(Array.isArray(autoFree.reasoning?.efforts));
  assert.equal(autoFree.reasoning.defaultEffort, "medium");

  const nemotron = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "nvidia/nemotron-3.5-super-vl:free");
  assert.ok(nemotron);
  assert.equal(nemotron.contextWindow, 1000000);
  assert.equal(nemotron.reasoning, undefined, "Super VL is vision-language model, should not have reasoning effort tiers");

  const ultra = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "nvidia/nemotron-3-ultra-550b-a55b:free");
  assert.ok(ultra);
  assert.ok(Array.isArray(ultra.reasoning?.efforts));
  assert.equal(ultra.reasoning.efforts.length, 4, "Ultra supports max reasoning effort");

  const openrouter = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "openrouter/free");
  assert.ok(openrouter);
  assert.equal(openrouter.contextWindow, 200000);
  assert.ok(Array.isArray(openrouter.reasoning?.efforts));

  const beam = BUILTIN_KILO_FREE_MODELS.find((m) => m.id === "reflection/beam-free");
  assert.ok(beam);
  assert.equal(beam.contextWindow, 1048576);
  assert.equal(beam.maxTokens, 131072);
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
  assert.ok(Array.isArray(parsed.models[0].reasoning?.efforts));
  assert.equal(parsed.models[0].reasoning.defaultEffort, "medium");
  assert.equal(parsed.models[1].id, "nvidia/nemotron-3.5-super-vl:free");
  assert.equal(parsed.models[1].free, true);
  assert.equal(parsed.models[1].reasoning, undefined, "Super VL should have no reasoning tiers in catalog");
});

test("buildKiloMessages formats user and assistant messages and supports DSH attachments service", async () => {
  const dshAttachmentsService = {
    async readImage(ref) { return { mediaType: "image/png", data: "base64" }; },
  };

  const request = {
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: [{ type: "text", text: "Hello Kilo" }] },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "Write a poem" },
    ],
  };

  const messages = await buildKiloMessages(request, dshAttachmentsService);
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

test("KiloDriver supports 3-argument invoke and stream protocols from DSH route", async () => {
  let receivedEnvelope = null;
  const mockExecutor = async function* (envelope) {
    receivedEnvelope = envelope;
    yield { type: "text-delta", index: 0, text: "pong" };
    yield { type: "finish", reason: { kind: "stop" } };
  };

  const driver = createKiloDriver({
    requestExecutor: mockExecutor,
  });

  const request = {
    model: "recursive/flint-v1.0:free",
    messages: [{ role: "user", content: "你好" }],
    reasoningEffort: "high",
  };
  const invocation = {
    account: { accountId: "kilo-free" },
    auth: { access: "free-tier" },
  };
  const context = {
    signal: new AbortController().signal,
  };

  // Test invoke with (request, invocation, context)
  const streamFromInvoke = await driver.invoke(request, invocation, context);
  const invokeEvents = [];
  for await (const chunk of streamFromInvoke) {
    invokeEvents.push(chunk);
  }
  assert.ok(receivedEnvelope);
  assert.equal(receivedEnvelope.request.model, "recursive/flint-v1.0:free");
  assert.equal(receivedEnvelope.request.reasoningEffort, "high");
  assert.equal(invokeEvents.length, 2);

  // Test stream with (request, invocation, context)
  receivedEnvelope = null;
  const streamFromStream = await driver.stream(request, invocation, context);
  const streamEvents = [];
  for await (const chunk of streamFromStream) {
    streamEvents.push(chunk);
  }
  assert.ok(receivedEnvelope);
  assert.equal(receivedEnvelope.request.model, "recursive/flint-v1.0:free");
  assert.equal(streamEvents.length, 2);
});

test("createKiloNativeExecutor includes reasoning_effort and fails over offline 503 models", async () => {
  const requestsMade = [];
  const sseChunk = `data: ${JSON.stringify({
    id: "gen_failover",
    choices: [{ delta: { content: "Fallback success!" } }],
  })}\n\n`;

  const mockFetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requestsMade.push(body);

    if (body.model === "recursive/flint-v1.0:free") {
      // Simulate upstream 503 "no upstreams available"
      return new Response(JSON.stringify({ error: { message: "no upstreams available", code: 503 } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseChunk));
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
    request: {
      model: "recursive/flint-v1.0:free",
      messages: [{ role: "user", content: "你好" }],
      reasoningEffort: "high",
    },
    credential: { access: "free-tier" },
  })) {
    events.push(event);
  }

  // First request was for recursive/flint-v1.0:free with reasoning_effort
  assert.equal(requestsMade.length, 2);
  assert.equal(requestsMade[0].model, "recursive/flint-v1.0:free");
  assert.equal(requestsMade[0].reasoning_effort, "high");

  // Second request fell back to kilo-auto/free and succeeded!
  assert.equal(requestsMade[1].model, "kilo-auto/free");
  assert.equal(requestsMade[1].reasoning_effort, "high");

  const text = events.filter((e) => e.type === "text-delta").map((e) => e.text).join("");
  assert.equal(text, "Fallback success!");
});
