import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommandCodeModule,
  createCommandCodeDriver,
  parseCommandCodeCatalog,
  summarizeCommandCodeCandidate,
  formatCommandCodePlan,
  BUILTIN_COMMANDCODE_MODELS,
  buildCommandCodeMessages,
  toWireTools,
  createCommandCodeNativeExecutor,
} from "../modules/provider-commandcode/src/index.mjs";
import { DockyardRuntime, createDefaultProviderEntries } from "../packages/runtime/src/dockyard-runtime.mjs";

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
    async save(next) {
      state = structuredClone(next);
      return structuredClone(state);
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}

test("Command Code module manifest and builtin models", async () => {
  const mod = createCommandCodeModule();
  assert.equal(mod.manifest.id, "commandcode");
  assert.equal(mod.manifest.displayName, "Command Code");
  assert.ok(mod.manifest.capabilities.includes("catalog"));
  assert.ok(mod.manifest.capabilities.includes("quota"));
  assert.ok(mod.manifest.capabilities.includes("stream"));

  assert.ok(BUILTIN_COMMANDCODE_MODELS.length >= 6);
  const deepseekFlash = BUILTIN_COMMANDCODE_MODELS.find((m) => m.id === "deepseek/deepseek-v4.1-flash");
  assert.ok(deepseekFlash);
  assert.equal(deepseekFlash.name, "DeepSeek V4.1 Flash (Command Code)");
  assert.equal(deepseekFlash.contextWindow, 1000000);

  const claudeSonnet = BUILTIN_COMMANDCODE_MODELS.find((m) => m.id === "claude-sonnet-5-5");
  assert.ok(claudeSonnet);
  assert.ok(claudeSonnet.inputModalities.includes("image"));

  const grok = BUILTIN_COMMANDCODE_MODELS.find((m) => m.id === "xai/grok-4.7");
  assert.ok(grok);
  assert.equal(grok.contextWindow, 500000);
});

test("parseCommandCodeCatalog parses live and cache structures", () => {
  const livePayload = {
    data: [
      {
        id: "custom-test-model",
        name: "Custom Test Model",
        context_length: 200000,
        maxOutputTokens: 8192,
        reasoningEfforts: ["low", "high"],
        inputModalities: ["text", "image"],
      },
    ],
  };

  const parsed = parseCommandCodeCatalog(livePayload);
  const custom = parsed.models.find((m) => m.id === "custom-test-model");
  assert.ok(custom);
  assert.equal(custom.name, "Custom Test Model (Command Code)");
  assert.equal(custom.contextWindow, 200000);
  assert.equal(custom.maxTokens, 8192);
  assert.equal(custom.reasoning.defaultEffort, "high");
  assert.deepEqual(custom.inputModalities, ["text", "image"]);

  // Verify builtin models are merged
  assert.ok(parsed.models.some((m) => m.id === "deepseek/deepseek-v4.1-flash"));

  // Empty data falls back to builtins
  const emptyParsed = parseCommandCodeCatalog({});
  assert.ok(emptyParsed.models.length >= BUILTIN_COMMANDCODE_MODELS.length);
});

test("formatCommandCodePlan formats plan names properly", () => {
  assert.equal(formatCommandCodePlan("individual-go-v1"), "Command Code Go Plan");
  assert.equal(formatCommandCodePlan("pro-tier"), "Command Code Pro Plan");
  assert.equal(formatCommandCodePlan(""), "Command Code Subscription");
});

test("buildCommandCodeMessages and toWireTools transform DSH payloads", () => {
  const request = {
    system: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Hi there" },
          { type: "tool-call", id: "call_1", name: "test_tool", arguments: { query: "abc" } },
        ],
      },
      {
        role: "tool",
        id: "call_1",
        toolName: "test_tool",
        content: "Tool result",
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "test_tool",
          description: "A test tool",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
      },
    ],
  };

  const { systemPrompt, wireMessages } = buildCommandCodeMessages(request);
  assert.equal(systemPrompt, "You are a helpful assistant.");
  assert.equal(wireMessages[0].role, "user");
  assert.equal(wireMessages[0].content, "Hello");

  assert.equal(wireMessages[1].role, "assistant");
  assert.ok(Array.isArray(wireMessages[1].content));
  const tcPart = wireMessages[1].content.find((p) => p.type === "tool-call");
  assert.ok(tcPart);
  assert.equal(tcPart.toolCallId, "call_1");
  assert.deepEqual(tcPart.input, { query: "abc" });

  const trPart = wireMessages[2];
  assert.equal(trPart.role, "tool");
  assert.equal(trPart.content[0].type, "tool-result");
  assert.equal(trPart.content[0].toolName, "test_tool");
  assert.equal(trPart.content[0].output.value, "Tool result");

  const tools = toWireTools(request.tools);
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "test_tool");
  assert.equal(tools[0].description, "A test tool");
});

test("createCommandCodeNativeExecutor streams NDJSON events", async () => {
  const ndjsonLines = [
    JSON.stringify({ type: "reasoning-start" }),
    JSON.stringify({ type: "reasoning-delta", text: "Thinking deeply..." }),
    JSON.stringify({ type: "reasoning-end" }),
    JSON.stringify({ type: "text-start" }),
    JSON.stringify({ type: "text-delta", text: "Hello! " }),
    JSON.stringify({ type: "text-delta", text: "How can I help you?" }),
    JSON.stringify({ type: "text-end" }),
    JSON.stringify({
      type: "tool-input-start",
      id: "call_abc",
      toolName: "fetch_data",
    }),
    JSON.stringify({
      type: "tool-input-delta",
      id: "call_abc",
      delta: '{"key": "value"}',
    }),
    JSON.stringify({
      type: "tool-call",
      toolCallId: "call_abc",
      toolName: "fetch_data",
      input: { key: "value" },
    }),
    JSON.stringify({
      type: "finish",
      totalUsage: {
        inputTokens: 50,
        outputTokens: 30,
        totalTokens: 80,
      },
    }),
  ].join("\n");

  const mockResponse = new Response(ndjsonLines, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });

  const fetchImpl = async () => mockResponse;

  const executor = createCommandCodeNativeExecutor({ fetchImpl });
  const events = [];
  for await (const event of executor({
    request: { model: "claude-sonnet-5-5", messages: [{ role: "user", content: "Hi" }] },
    credential: { apiKey: "test-key" },
  })) {
    events.push(event);
  }

  // Reasoning block
  assert.ok(events.some((e) => e.type === "block-start" && e.blockType === "reasoning"));
  assert.ok(events.some((e) => e.type === "reasoning-delta" && e.text === "Thinking deeply..."));

  // Text block
  assert.ok(events.some((e) => e.type === "block-start" && e.blockType === "text"));
  assert.ok(events.some((e) => e.type === "text-delta" && e.text === "Hello! "));
  assert.ok(events.some((e) => e.type === "text-delta" && e.text === "How can I help you?"));

  // Tool call block
  assert.ok(events.some((e) => e.type === "block-start" && e.blockType === "tool-call"));
  assert.ok(events.some((e) => e.type === "tool-call-delta" && e.id === "call_abc"));
  const toolBlockEnd = events.find((e) => e.type === "block-end" && e.block?.type === "tool-call");
  assert.ok(toolBlockEnd);
  assert.equal(toolBlockEnd.block.name, "fetch_data");

  // Ensure every chunk is losslessly JSON serializable without any undefined properties
  for (const event of events) {
    const serialized = JSON.stringify(event);
    assert.ok(serialized, "Chunk must serialize to JSON");
    const deserialized = JSON.parse(serialized);
    assert.deepEqual(event, deserialized, "Chunk must not lose any undefined or non-JSON properties");
  }

  // Finish
  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.reason.kind, "stop");
  assert.equal(finish.usage.totalTokens, 80);
});

test("CommandCodeDriver discover and importAccount work with mock endpoints", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("whoami")) {
      return new Response(JSON.stringify({
        user: { id: "usr_123", name: "Test User", email: "test@example.com" },
      }), { status: 200 });
    }
    if (url.includes("billing/credits")) {
      return new Response(JSON.stringify({
        credits: { monthlyCredits: 8.5 },
        windowLimits: {
          fiveHour: { cap: 3, used: 1, resetAt: Date.now() + 3600000 },
          weekly: { cap: 6, used: 2, resetAt: Date.now() + 86400000 },
        },
      }), { status: 200 });
    }
    if (url.includes("billing/subscriptions")) {
      return new Response(JSON.stringify({
        data: {
          planId: "individual-go-v1",
          status: "active",
          currentPeriodEnd: "2026-12-01T00:00:00.000Z",
        },
      }), { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  const driver = createCommandCodeDriver({ fetchImpl });
  const discovery = await driver.discover();
  assert.ok(discovery.candidates.length > 0);
  const cand = discovery.candidates[0];
  assert.equal(cand.accountId, "usr_123");
  assert.equal(cand.subscription.plan, "Command Code Go Plan");
  assert.equal(cand.quota.remaining, 8.5);
  assert.equal(cand.quota.windows.length, 2);

  const mockSecretStore = {
    data: new Map(),
    async write(ref, val) { this.data.set(ref, val); },
    async read(ref) { return this.data.get(ref); },
  };

  const account = await driver.importAccount(cand, { secretStore: mockSecretStore });
  assert.equal(account.providerId, "commandcode");
  assert.equal(account.accountId, "usr_123");
  assert.equal(account.subscription.plan, "Command Code Go Plan");
  assert.ok(account.auth.credentialRef.startsWith("keychain://dockyard-dsh/"));
});

test("createCommandCodeNativeExecutor extracts prompt cache read tokens and normalizes input tokens", async () => {
  const ndjsonLines = [
    JSON.stringify({ type: "text-delta", text: "Answer with prompt caching" }),
    JSON.stringify({
      type: "finish-step",
      usage: {
        inputTokens: 7605,
        inputTokenDetails: {
          noCacheTokens: 1461,
          cacheReadTokens: 6144,
        },
        outputTokens: 15,
        totalTokens: 7620,
        cachedInputTokens: 6144,
      },
    }),
    JSON.stringify({
      type: "finish",
      finishReason: "stop",
      totalUsage: {
        inputTokens: 7605,
        inputTokenDetails: {
          noCacheTokens: 1461,
          cacheReadTokens: 6144,
        },
        outputTokens: 15,
        totalTokens: 7620,
        cachedInputTokens: 6144,
      },
    }),
  ].join("\n");

  const mockResponse = new Response(ndjsonLines, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });

  const executor = createCommandCodeNativeExecutor({ fetchImpl: async () => mockResponse });
  const events = [];
  for await (const event of executor({
    request: { model: "deepseek-v4.1-flash", messages: [{ role: "user", content: "Hi" }] },
    credential: { apiKey: "test-key" },
  })) {
    events.push(event);
  }

  const usageEvent = events.find((e) => e.type === "usage");
  assert.ok(usageEvent, "usage event must be emitted");
  assert.deepEqual(usageEvent.usage, {
    inputTokens: 1461,
    outputTokens: 15,
    totalTokens: 7620,
    cacheReadTokens: 6144,
  });

  const finishEvent = events.find((e) => e.type === "finish");
  assert.ok(finishEvent, "finish event must be emitted");
  assert.deepEqual(finishEvent.usage, {
    inputTokens: 1461,
    outputTokens: 15,
    totalTokens: 7620,
    cacheReadTokens: 6144,
  });

  for (const event of events) {
    const serialized = JSON.stringify(event);
    assert.deepEqual(event, JSON.parse(serialized));
  }
});

test("DockyardRuntime auto-provisions commandcode if local auth exists", async () => {
  const stateStore = memoryStateStore();
  const runtime = new DockyardRuntime({
    stateStore,
    providers: [
      {
        module: createCommandCodeModule({
          driver: createCommandCodeDriver({
            fetchImpl: async () => new Response(JSON.stringify({
              user: { id: "usr_123", name: "AITabby", email: "aitabbyspace@gmail.com" },
              credits: { monthlyCredits: 10 },
              data: { planId: "individual-go-v1", status: "active" },
            }), { status: 200 }),
          }),
        }),
      },
    ],
  });

  await runtime.init();
  const snapshot = runtime.snapshot();
  const ccProvider = snapshot.providers.find((p) => p.providerId === "commandcode");
  assert.ok(ccProvider, "commandcode provider must be registered");
  // Local auth exists on this test machine (~/.commandcode/auth.json), so it should auto-provision!
  assert.ok(ccProvider.accounts.length > 0, "local auth should be auto-imported into account pool");
  assert.equal(ccProvider.accounts[0].displayName, "AITabby (aitabbyspace@gmail.com)");
  assert.equal(ccProvider.accounts[0].subscription.plan, "Command Code Go Plan");
});
