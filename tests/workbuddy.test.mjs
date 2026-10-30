import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkbuddyModule,
  parseWorkbuddyCatalog,
  BUILTIN_WORKBUDDY_FREE_MODELS,
  buildWorkbuddyMessages,
  createWorkbuddyDriver,
  createWorkbuddyNativeExecutor,
} from "../modules/provider-workbuddy/src/index.mjs";

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

test("WorkBuddy provider module manifest and builtin models", async () => {
  const mod = createWorkbuddyModule();
  assert.equal(mod.manifest.id, "workbuddy");
  assert.equal(mod.manifest.displayName, "WorkBuddy");
  assert.ok(mod.manifest.capabilities.includes("catalog"));
  assert.ok(mod.manifest.capabilities.includes("stream"));

  assert.equal(BUILTIN_WORKBUDDY_FREE_MODELS.length, 2);
  const deepseek = BUILTIN_WORKBUDDY_FREE_MODELS.find((m) => m.id === "deepseek-v4.1-flash");
  assert.ok(deepseek);
  assert.equal(deepseek.name, "DeepSeek v4.1 Flash (WorkBuddy Free)");
  assert.equal(deepseek.contextWindow, 1000000);
  assert.equal(deepseek.maxTokens, 128000);

  const hy3 = BUILTIN_WORKBUDDY_FREE_MODELS.find((m) => m.id === "hy3");
  assert.ok(hy3);
  assert.equal(hy3.name, "Hunyuan 3 (WorkBuddy Free)");
  assert.equal(hy3.contextWindow, 192000);
  assert.equal(hy3.maxTokens, 64000);
});

test("parseWorkbuddyCatalog handles product snapshot format and flags free tier models", async () => {
  const snapshotData = {
    "product-config-snapshot": {
      data: {
        models: [
          {
            id: "deepseek-v4.1-flash",
            name: "Deepseek-V4.1-Flash",
            credits: "x0.00",
            maxInputTokens: 1000000,
            maxOutputTokens: 128000,
          },
          {
            id: "hy3",
            name: "Hy3",
            credits: "x0.00 credits",
            maxInputTokens: 192000,
            maxOutputTokens: 64000,
          },
          {
            id: "gpt-6-astra",
            name: "GPT-6-Astra",
            credits: "x6.67",
            maxInputTokens: 1000000,
            maxOutputTokens: 128000,
          },
        ],
      },
    },
  };

  const parsed = parseWorkbuddyCatalog(snapshotData);
  assert.ok(parsed.models.length >= 3);

  const freeModels = parsed.models.filter((m) => m.free);
  assert.equal(freeModels.length, 2);
  assert.equal(freeModels[0].id, "deepseek-v4.1-flash");
  assert.ok(freeModels[0].name.includes("(WorkBuddy Free)"));
  assert.equal(freeModels[1].id, "hy3");
  assert.ok(freeModels[1].name.includes("(WorkBuddy Free)"));

  const paidModel = parsed.models.find((m) => m.id === "gpt-6-astra");
  assert.ok(paidModel);
  assert.equal(paidModel.free, false);
});

test("buildWorkbuddyMessages strictly ensures first message is a system message", async () => {
  const requestWithoutSystem = {
    messages: [
      { role: "user", content: "Hello world" },
    ],
  };

  const messages1 = await buildWorkbuddyMessages(requestWithoutSystem);
  assert.equal(messages1.length, 2);
  assert.equal(messages1[0].role, "system");
  assert.equal(messages1[0].content, "You are a helpful AI assistant.");
  assert.equal(messages1[1].role, "user");
  assert.equal(messages1[1].content, "Hello world");

  const requestWithCustomSystem = {
    systemPrompt: "Custom prompt instructions",
    messages: [
      { role: "user", content: "Hi" },
    ],
  };

  const messages2 = await buildWorkbuddyMessages(requestWithCustomSystem);
  assert.equal(messages2[0].role, "system");
  assert.equal(messages2[0].content, "Custom prompt instructions");
  assert.equal(messages2[1].role, "user");

  const requestWithExistingSystem = {
    messages: [
      { role: "system", content: "Existing prompt" },
      { role: "user", content: "Hi" },
    ],
  };

  const messages3 = await buildWorkbuddyMessages(requestWithExistingSystem);
  assert.equal(messages3.length, 2);
  assert.equal(messages3[0].role, "system");
  assert.equal(messages3[0].content, "Existing prompt");
});

test("DockyardRuntime auto-provisions WorkBuddy free account and allows real-time modelSelection", async () => {
  const { DockyardRuntime } = await import("../packages/runtime/src/dockyard-runtime.mjs");
  const { createDockyardLlmAdapter } = await import("../packages/dsh-bridge/src/llm-adapter.mjs");

  const stateStore = memoryStateStore({});
  const runtime = new DockyardRuntime({
    stateStore,
    workbuddy: {
      fetchImpl: async () => new Response(""),
    },
  });
  await runtime.init();

  const snapshot = runtime.snapshot();
  const workbuddyEntry = snapshot.providers.find((p) => p.providerId === "workbuddy");
  assert.ok(workbuddyEntry, "WorkBuddy provider should be registered");
  assert.equal(workbuddyEntry.accounts.length, 1, "WorkBuddy should auto-provision the free account");
  assert.equal(workbuddyEntry.accounts[0].accountId, "workbuddy-free");

  const adapter = createDockyardLlmAdapter({ runtime, providerIds: ["workbuddy"] });

  // Initially all available models returned
  const allModels = await adapter.listModels("workbuddy");
  assert.ok(allModels.length >= 2, "WorkBuddy should list available models");
  assert.ok(allModels.some((m) => m.id === "deepseek-v4.1-flash"));
  assert.ok(allModels.some((m) => m.id === "hy3"));

  // Real-time selection of free tier model subset
  await runtime.setModelSelection("workbuddy", ["deepseek-v4.1-flash"]);
  const filteredModels = await adapter.listModels("workbuddy");
  assert.equal(filteredModels.length, 1);
  assert.equal(filteredModels[0].id, "deepseek-v4.1-flash");

  // Switch selection in real-time
  await runtime.setModelSelection("workbuddy", ["hy3"]);
  const switchedModels = await adapter.listModels("workbuddy");
  assert.equal(switchedModels.length, 1);
  assert.equal(switchedModels[0].id, "hy3");

  // Reset selection (restores full list)
  await runtime.setModelSelection("workbuddy", null);
  const resetModels = await adapter.listModels("workbuddy");
  assert.equal(resetModels.length, allModels.length);
});

test("createWorkbuddyNativeExecutor streams reasoning and text chunks with usage", async () => {
  const ssePayload = [
    ": heartbeat\n\n",
    `data: ${JSON.stringify({
      id: "test-1",
      choices: [{ delta: { reasoning_content: "Thinking step 1" } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-2",
      choices: [{ delta: { reasoning_content: "... done thinking" } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-3",
      choices: [{ delta: { content: "Hello from " } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-4",
      choices: [{ delta: { content: "WorkBuddy Free!" } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-5",
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 },
    })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");

  const mockFetch = async () => new Response(ssePayload, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });

  const executor = createWorkbuddyNativeExecutor({
    accessToken: "mock-wb-token",
    fetchImpl: mockFetch,
  });

  const events = [];
  for await (const event of executor({
    request: {
      model: "deepseek-v4.1-flash",
      messages: [{ role: "user", content: "Hi" }],
    },
    credential: { accessToken: "mock-wb-token" },
  })) {
    events.push(event);
  }

  const textDeltas = events.filter((e) => e.type === "text-delta").map((e) => e.text).join("");
  assert.equal(textDeltas, "Hello from WorkBuddy Free!");

  const reasoningDeltas = events.filter((e) => e.type === "reasoning-delta").map((e) => e.text).join("");
  assert.equal(reasoningDeltas, "Thinking step 1... done thinking");

  const finishEvent = events.find((e) => e.type === "finish");
  assert.ok(finishEvent);
  assert.equal(finishEvent.reason.kind, "stop");
  assert.equal(finishEvent.usage.totalTokens, 25);
  assert.equal(finishEvent.usage.inputTokens, 15);
  assert.equal(finishEvent.usage.outputTokens, 10);
});
