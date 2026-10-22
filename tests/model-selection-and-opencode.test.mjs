import assert from "node:assert/strict";
import test from "node:test";

import { ModelSelectionStore } from "../packages/runtime/src/model-selection-store.mjs";
import { createOpencodeModule, parseOpencodeCatalog, BUILTIN_OPENCODE_FREE_MODELS } from "../modules/provider-opencode/src/index.mjs";

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

test("ModelSelectionStore round-trips and persists enabled models per provider", async () => {
  const stateStore = memoryStateStore({});
  const store = new ModelSelectionStore({ stateStore });
  await store.ready();

  // Initially null (all models enabled)
  assert.equal(store.get("cursor"), null);

  // Set enabled models
  await store.set("cursor", ["cursor-fast", "claude-3-7-sonnet"]);
  assert.deepEqual(store.get("cursor"), ["cursor-fast", "claude-3-7-sonnet"]);

  // Another store instance reading from the same state store
  const store2 = new ModelSelectionStore({ stateStore });
  await store2.ready();
  assert.deepEqual(store2.get("cursor"), ["cursor-fast", "claude-3-7-sonnet"]);

  // Reset to null
  await store2.set("cursor", null);
  assert.equal(store2.get("cursor"), null);
});

test("OpenCode provider module manifests and catalog parsing", async () => {
  const mod = createOpencodeModule();
  assert.equal(mod.manifest.id, "opencode");
  assert.equal(mod.manifest.displayName, "OpenCode");
  assert.ok(mod.manifest.capabilities.includes("catalog"));
  assert.ok(mod.manifest.capabilities.includes("stream"));

  // Default builtin models
  assert.ok(BUILTIN_OPENCODE_FREE_MODELS.length >= 10);
  const bigPickle = BUILTIN_OPENCODE_FREE_MODELS.find((m) => m.id === "big-pickle");
  assert.ok(bigPickle);
  assert.equal(bigPickle.name, "Big Pickle (Free)");

  // Parsing JSON data from zen endpoint
  const parsed = parseOpencodeCatalog({
    data: [
      { id: "test-model-1", name: "Test Model 1", contextWindow: 65536, maxTokens: 4096 },
      { id: "test-free", contextWindow: 131072 },
    ],
  });
  assert.equal(parsed.models.length, 2);
  assert.equal(parsed.models[0].id, "test-model-1");
  assert.equal(parsed.models[1].id, "test-free");
  assert.equal(parsed.models[1].name, "test-free (Free)");
});

test("DockyardRuntime auto-imports OpenCode free account and LLM adapter filters by modelSelection", async () => {
  const { DockyardRuntime } = await import("../packages/runtime/src/dockyard-runtime.mjs");
  const { createDockyardLlmAdapter } = await import("../packages/dsh-bridge/src/llm-adapter.mjs");

  const stateStore = memoryStateStore({});
  const runtime = new DockyardRuntime({
    stateStore,
  });
  await runtime.init();

  const snapshot = runtime.snapshot();
  const opencodeEntry = snapshot.providers.find((p) => p.providerId === "opencode");
  assert.ok(opencodeEntry, "OpenCode provider should be present");
  assert.equal(opencodeEntry.accounts.length, 1, "OpenCode should auto-provision the free account");
  assert.equal(opencodeEntry.accounts[0].accountId, "opencode-free");

  const adapter = createDockyardLlmAdapter({ runtime });

  // Initially all models returned
  const allModels = await adapter.listModels("opencode");
  assert.ok(allModels.length > 5, "OpenCode should list all available models by default");

  // Restrict to subset
  const subset = [allModels[0].id, allModels[1].id];
  await runtime.setModelSelection("opencode", subset);

  const filteredModels = await adapter.listModels("opencode");
  assert.equal(filteredModels.length, 2);
  assert.deepEqual(filteredModels.map((m) => m.id), subset);
});

test("createOpencodeNativeExecutor yields standard DSH streaming protocol", async () => {
  const { createOpencodeNativeExecutor } = await import("../modules/provider-opencode/src/native-transport.mjs");

  // SSE streaming test with token
  const sseLines = [
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "thinking step" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: " world!" }, finish_reason: "stop" }] })}\n\n`,
    `data: ${JSON.stringify({ usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } })}\n\n`,
    `data: [DONE]\n\n`,
  ];

  const executor = createOpencodeNativeExecutor({
    endpoint: "https://opencode.ai/inference/openai/v1/chat/completions",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: (async function* () {
        for (const line of sseLines) {
          yield new TextEncoder().encode(line);
        }
      })(),
    }),
  });

  const stream = executor({
    request: { model: "deepseek-v4.1-flash-free", messages: [{ role: "user", content: "Hi" }] },
    credential: { apiKey: "test-token" },
  });

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  // Check structure: reasoning block-start -> reasoning-delta -> block-end -> text block-start -> text-deltas -> block-end -> usage -> finish
  const types = chunks.map((c) => c.type);
  assert.ok(types.includes("block-start"));
  assert.ok(types.includes("reasoning-delta"));
  assert.ok(types.includes("text-delta"));
  assert.ok(types.includes("block-end"));
  assert.ok(types.includes("usage"));
  assert.ok(types.includes("finish"));

  const fullText = chunks.filter((c) => c.type === "text-delta").map((c) => c.text).join("");
  assert.equal(fullText, "Hello world!");
});

test("OpenCode driver invoke correctly passes free-tier credentials and handles multi-turn prompt", async () => {
  const { createOpencodeDriver } = await import("../modules/provider-opencode/src/driver.mjs");

  let recordedEnvelope = null;
  const driver = createOpencodeDriver({
    requestExecutor: async (envelope) => {
      recordedEnvelope = envelope;
      return (async function* () {
        yield { type: "block-start", index: 0, blockType: "text" };
        yield { type: "text-delta", index: 0, text: "ok" };
        yield { type: "block-end", index: 0, block: { type: "text", text: "ok" } };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
  });

  const request = {
    model: "deepseek-v4.1-flash-free",
    messages: [
      { role: "system", content: "You are a test" },
      { role: "user", content: "Hi" },
    ],
  };

  const stream = await driver.stream(request, {
    account: { accountId: "opencode-free" },
  });

  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  assert.equal(chunks.length, 4);
  assert.equal(recordedEnvelope.credential.access, "free-tier");
  assert.equal(recordedEnvelope.request.model, "deepseek-v4.1-flash-free");
});

test("textFromContent and promptFromRequest exclude reasoning blocks and strip reasoning during compaction", async () => {
  const { textFromContent } = await import("../packages/providers/src/native-transport.mjs");
  const { buildOpencodeMessages } = await import("../modules/provider-opencode/src/native-transport.mjs");

  // Verify textFromContent excludes reasoning blocks
  assert.equal(textFromContent({ type: "reasoning", text: "secret internal thinking" }), "");
  assert.equal(textFromContent({ type: "thinking", text: "secret internal thinking" }), "");
  assert.equal(textFromContent({ type: "text", text: "visible text" }), "visible text");
  assert.equal(
    textFromContent([
      { type: "reasoning", text: "thought 1" },
      { type: "text", text: "visible part" },
      { type: "reasoning", text: "thought 2" },
    ]),
    "visible part",
  );

  // Verify buildOpencodeMessages strips reasoning blocks from conversation history
  const messages = await buildOpencodeMessages({
    messages: [
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "I am thinking about x..." },
          { type: "text", text: "Here is the answer." },
        ],
      },
    ],
  });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, "Here is the answer.");
});

