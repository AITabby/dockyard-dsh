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

  const adapter = createDockyardLlmAdapter({ runtime, providerIds: ["opencode"] });

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

test("compactMessagesForOpencode applies sliding window preserving initial context and milestone", async () => {
  const { compactMessagesForOpencode } = await import("../modules/provider-opencode/src/native-transport.mjs");
  const messages = [
    { role: "user", content: "Initial requirement" },
  ];
  for (let i = 1; i <= 60; i++) {
    messages.push({ role: i % 2 === 1 ? "assistant" : "user", content: `Turn ${i}` });
  }

  const compacted = compactMessagesForOpencode(messages, { maxMessages: 20, quantum: 5 });
  assert.ok(compacted.length <= 25);
  assert.equal(compacted[0].content, "Initial requirement");
  assert.ok(compacted[1].content.includes("[System Note: Context sliding window active"));
  assert.equal(compacted[compacted.length - 1].content, "Turn 60");
});

test("parseOpencodeCatalog filters by installedIds when CLI is present", async () => {
  const installedIds = ["beam-free", "deepseek-v4.1-flash-free", "flint-40b-free"];
  const parsed = parseOpencodeCatalog(null, { installedIds });
  assert.equal(parsed.models.length, 3);
  assert.deepEqual(parsed.models.map((m) => m.id), installedIds);
});

test("DSH LLM adapter prepares compaction request with minimal reasoning and no thinking", async () => {
  const { createDockyardLlmAdapter } = await import("../packages/dsh-bridge/src/llm-adapter.mjs");

  let capturedRequest = null;
  const runtime = {
    async stream(provider, request, options) {
      capturedRequest = request;
      return (async function* () {
        yield { type: "block-start", index: 0, blockType: "text" };
        yield { type: "text-delta", index: 0, text: "summary text" };
        yield { type: "block-end", index: 0, block: { type: "text", text: "summary text" } };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
    snapshot() {
      return { providers: [{ providerId: "opencode", accounts: [{ accountId: "opencode-free" }] }] };
    },
    async listModels() {
      return [{ id: "deepseek-v4.1-flash-free", maxTokens: 8192, contextWindow: 200000 }];
    },
  };

  const adapter = createDockyardLlmAdapter({ runtime, providerIds: ["opencode"] });
  const stream = adapter.stream({
    provider: "opencode",
    model: "deepseek-v4.1-flash-free",
    messages: [{ role: "user", content: "Summarize this" }],
    purpose: "compaction",
    reasoningEffort: "high",
  });

  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  assert.ok(capturedRequest);
  assert.equal(capturedRequest.purpose, "compaction");
  assert.equal(capturedRequest.reasoningEffort, "minimal");
  assert.equal(capturedRequest.thinking, false);
});

test("runViaOpencodeServer suppresses reasoning, denies permissions, and completes in 1 step during compaction", async () => {
  const { createOpencodeNativeExecutor } = await import("../modules/provider-opencode/src/native-transport.mjs");

  const recordedReplies = [];
  let sessionRequestBody = null;
  const sseEvents = [
    { type: "session.reasoning.delta", data: { sessionID: "sess-123", delta: "Internal reasoning" } },
    { type: "session.text.delta", data: { sessionID: "sess-123", delta: "Compacted summary text" } },
    { type: "permission.request", data: { sessionID: "sess-123", id: "perm-1" } },
    { type: "session.step.ended", data: { sessionID: "sess-123", finish: "stop", tokens: { input: 100, output: 20 } } },
    // Notice: no session.execution.succeeded sent! Simulating autonomous agent that would keep running
  ];

  const ssePayload = sseEvents.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

  const mockFetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes("/api/session/sess-123/permission/")) {
      const body = JSON.parse(options.body || "{}");
      recordedReplies.push(body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    }
    if (urlStr.endsWith("/api/session") && options.method === "POST") {
      sessionRequestBody = JSON.parse(options.body || "{}");
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: "sess-123" }) };
    }
    if (urlStr.endsWith("/api/event")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(ssePayload));
            controller.close();
          },
        }),
      };
    }
    if (urlStr.includes("/api/session/sess-123/prompt")) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    }
    if (options.method === "DELETE") {
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    }
    return { ok: true, status: 200, text: async () => "{}" };
  };

  const { runViaOpencodeServer } = await import("../modules/provider-opencode/src/native-transport.mjs");
  const server = { url: "http://127.0.0.1:9999", auth: "Basic test" };
  const chunks = [];
  for await (const chunk of runViaOpencodeServer({
    server,
    request: { model: "deepseek-v4.1-flash-free", purpose: "compaction", prompt: "Summarize" },
    fetchImpl: mockFetch,
  })) {
    chunks.push(chunk);
  }

  // Verify: reasoning deltas were suppressed during compaction
  assert.equal(chunks.some((c) => c.type === "reasoning-delta"), false);
  assert.equal(chunks.some((c) => c.type === "block-start" && c.blockType === "reasoning"), false);

  // Verify: text delta was yielded
  const textDeltas = chunks.filter((c) => c.type === "text-delta").map((c) => c.text).join("");
  assert.equal(textDeltas, "Compacted summary text");

  // Verify: finished immediately on step ended, did not wait indefinitely
  const finishChunk = chunks.find((c) => c.type === "finish");
  assert.ok(finishChunk);
  assert.deepEqual(finishChunk.reason, { kind: "stop" });

  // Verify: permission request was denied during compaction
  assert.equal(recordedReplies.length, 1);
  assert.deepEqual(recordedReplies[0], { decision: "deny" });

  // Verify: compaction does not force a model-specific reasoning variant.
  // Unsupported variants (e.g. "minimal" on deepseek-v4.1-flash-free) fail the
  // whole session with provider.no-route.
  assert.ok(sessionRequestBody);
  assert.equal(sessionRequestBody.model.id, "deepseek-v4.1-flash-free");
  assert.equal(sessionRequestBody.model.variant, undefined);
});

test("createOpencodeNativeExecutor falls back to pure network web wire when CLI is not installed", async () => {
  const { createOpencodeNativeExecutor } = await import("../modules/provider-opencode/src/native-transport.mjs");

  const sseChunks = [
    `data: ${JSON.stringify({
      id: "test-stream-1",
      choices: [{ delta: { reasoning_content: "Thinking without CLI..." } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-stream-2",
      choices: [{ delta: { content: "Zero CLI " } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-stream-3",
      choices: [{ delta: { content: "Web Wire Works!" } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "test-stream-4",
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
    })}\n\n`,
    `data: [DONE]\n\n`,
  ];

  let interceptedUrl = null;
  let interceptedHeaders = null;
  let interceptedBody = null;

  const mockFetch = async (url, options) => {
    interceptedUrl = url;
    interceptedHeaders = options.headers;
    interceptedBody = JSON.parse(options.body);

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

  const executor = createOpencodeNativeExecutor({
    fetchImpl: mockFetch,
    cliPath: null,
  });

  const events = [];
  for await (const event of executor({
    request: { model: "big-pickle", messages: [{ role: "user", content: "Hi" }] },
    credential: { access: "free-tier" },
  })) {
    events.push(event);
  }

  // Verify pure web endpoint and fingerprint headers were dispatched
  assert.ok(interceptedUrl.includes("/inference/v1/chat/completions"));
  assert.equal(interceptedHeaders["Authorization"], "Bearer public");
  assert.equal(interceptedHeaders["user-agent"], "opencode/latest/2.0.26/cli");
  assert.ok(interceptedHeaders["x-opencode-session"].startsWith("ses_"));
  assert.ok(Array.isArray(interceptedBody.tools));
  assert.equal(interceptedBody.tools.length, 2);
  assert.equal(interceptedBody.tools[0].function.name, "read");
  assert.equal(interceptedBody.tools[1].function.name, "shell");

  // Verify streaming deltas
  const reasoning = events.filter((e) => e.type === "reasoning-delta").map((e) => e.text).join("");
  assert.equal(reasoning, "Thinking without CLI...");

  const text = events.filter((e) => e.type === "text-delta").map((e) => e.text).join("");
  assert.equal(text, "Zero CLI Web Wire Works!");

  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.reason.kind, "stop");
  assert.equal(finish.usage.totalTokens, 40);
});

