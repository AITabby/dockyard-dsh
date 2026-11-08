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
  assert.equal(deepseekFlash.name, "DeepSeek V4.1 Flash");
  assert.equal(deepseekFlash.contextWindow, 1000000);
  // Regression: this model accepts images on the Command Code gateway (the live
  // catalog reports ["text","image"] and a real request carries image tokens).
  // The builtin fallback previously said ["text"], which made DSH silently drop
  // every pasted image whenever the live catalog was stale or unavailable.
  assert.ok(deepseekFlash.inputModalities.includes("image"), "builtin fallback must allow image input for v4.1-flash");

  const deepseekPro = BUILTIN_COMMANDCODE_MODELS.find((m) => m.id === "deepseek/deepseek-v4-pro");
  assert.ok(deepseekPro);
  assert.deepEqual(deepseekPro.inputModalities, ["text"], "v4-pro genuinely does not receive images");

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
      {
        id: "retired-model:free",
        name: "Retired Model",
        hidden: true,
      },
      {
        id: "active-free-model:free",
        name: "Active Free Model",
        display: { badge: "free" },
        pricing: { inputCost: 0, outputCost: 0 },
      },
    ],
  };

  const parsed = parseCommandCodeCatalog(livePayload);
  const custom = parsed.models.find((m) => m.id === "custom-test-model");
  assert.ok(custom);
  assert.equal(custom.name, "Custom Test Model");
  assert.equal(custom.contextWindow, 200000);
  assert.equal(custom.maxTokens, 8192);
  assert.equal(custom.reasoning.defaultEffort, "high");
  assert.deepEqual(custom.inputModalities, ["text", "image"]);

  // Verify hidden/retired models are filtered out
  assert.equal(parsed.models.some((m) => m.id === "retired-model:free"), false);
  const activeFree = parsed.models.find((m) => m.id === "active-free-model:free");
  assert.ok(activeFree);
  assert.equal(activeFree.free, true);

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

test("buildCommandCodeMessages and toWireTools transform DSH payloads", async () => {
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

  const { systemPrompt, wireMessages } = await buildCommandCodeMessages(request);
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

test("buildCommandCodeMessages pads reasoning_content for reasoning models and sanitizes tool IDs", async () => {
  const codexId = "call_0194ff7b2b647bc58a184bf418431050|item_0194ff7b2b647bc58a184bf418431051";
  const request = {
    model: "reflection/beam:free",
    messages: [
      { role: "user", content: "Hi" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Here is the response" },
          { type: "tool-call", id: codexId, name: "lookup", arguments: "{}" },
        ],
      },
      { role: "tool", toolCallId: codexId, content: "done" },
    ],
  };

  const { wireMessages } = await buildCommandCodeMessages(request);
  assert.equal(wireMessages.length, 3);
  const asst = wireMessages[1];
  assert.equal(asst.role, "assistant");
  assert.equal(typeof asst.reasoning_content, "string");
  assert.equal(asst.reasoning_content, "");

  const tc = asst.content.find((p) => p.type === "tool-call");
  assert.ok(tc.toolCallId.length <= 64);
  assert.ok(!tc.toolCallId.includes("|"));

  const tr = wireMessages[2];
  assert.equal(tr.role, "tool");
  assert.equal(tr.content[0].toolCallId, tc.toolCallId);
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
  const prevKey = process.env.COMMAND_CODE_API_KEY;
  process.env.COMMAND_CODE_API_KEY = "mock-command-code-key";
  try {
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
  } finally {
    if (prevKey === undefined) delete process.env.COMMAND_CODE_API_KEY;
    else process.env.COMMAND_CODE_API_KEY = prevKey;
  }
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

test("CommandCodeNativeExecutor sends valid UUID threadId and deterministic session ID", async () => {
  const { toWireUuid, deriveConversationSessionId } = await import("../modules/provider-commandcode/src/native-transport.mjs");
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assert.equal(toWireUuid("session-061d450d-caa8-48aa-b7b7-6519eed6ac21"), "061d450d-caa8-48aa-b7b7-6519eed6ac21");
  assert.equal(toWireUuid("061d450d-caa8-48aa-b7b7-6519eed6ac21"), "061d450d-caa8-48aa-b7b7-6519eed6ac21");
  assert.equal(toWireUuid("invalid-uuid"), null);

  const derived = deriveConversationSessionId({ messages: [{ role: "user", content: "hello world" }] });
  assert.ok(UUID_REGEX.test(derived), "Derived session id must be a valid UUID");

  let capturedBody = null;
  let capturedHeaders = null;
  const executor = createCommandCodeNativeExecutor({
    fetchImpl: async (_url, init) => {
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);
      // A real answer, not just a finish marker: an empty completion is now
      // retried and eventually reported as a failure.
      const body = [
        JSON.stringify({ type: "text-delta", text: "ok" }),
        JSON.stringify({ type: "finish", finishReason: "stop" }),
      ].join("\n");
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      });
    },
  });

  for await (const _ of executor({
    request: { model: "deepseek/deepseek-v4.1-flash", messages: [{ role: "user", content: "hello world" }] },
    credential: { apiKey: "test-key" },
  })) {}

  assert.ok(capturedBody.threadId, "threadId must be present in body");
  assert.ok(UUID_REGEX.test(capturedBody.threadId), "threadId must be a valid UUID");
  assert.ok(UUID_REGEX.test(capturedHeaders["x-session-id"]), "x-session-id header must be a valid UUID");
  assert.equal(capturedBody.config.date, new Date().toISOString().split("T")[0]);
});

test("DockyardRuntime auto-provisions commandcode if local auth exists", async () => {
  const prevKey = process.env.COMMAND_CODE_API_KEY;
  process.env.COMMAND_CODE_API_KEY = "mock-command-code-key";
  try {
    const stateStore = memoryStateStore();
    const runtime = new DockyardRuntime({
      stateStore,
      secretStore: {
        data: new Map(),
        async write(ref, val) { this.data.set(ref, val); },
        async read(ref) { return this.data.get(ref); },
      },
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
    assert.ok(ccProvider.accounts.length > 0, "local auth should be auto-imported into account pool");
    assert.equal(ccProvider.accounts[0].displayName, "AITabby (aitabbyspace@gmail.com)");
    assert.equal(ccProvider.accounts[0].subscription.plan, "Command Code Go Plan");
  } finally {
    if (prevKey === undefined) delete process.env.COMMAND_CODE_API_KEY;
    else process.env.COMMAND_CODE_API_KEY = prevKey;
  }
});

test("commandcode deepseek-v4.1-flash forwards image parts end to end", async () => {
  const { createDockyardLlmAdapter } = await import("../packages/dsh-bridge/src/llm-adapter.mjs");
  let forwarded = null;
  const runtime = {
    async init() {},
    listProviderIds() { return ["commandcode"]; },
    listProviderManifests() { return [{ id: "commandcode", capabilities: ["catalog"] }]; },
    snapshot() { return { providers: [{ providerId: "commandcode", accounts: [{ accountId: "a" }] }] }; },
    async getCatalog() { return { models: BUILTIN_COMMANDCODE_MODELS }; },
    async *stream(_provider, request) {
      forwarded = request;
      yield { type: "text", text: "ok" };
    },
  };
  const adapter = createDockyardLlmAdapter({ runtime, providerIds: ["commandcode"] });
  // Warm the catalog exactly like the model picker does before generation.
  await adapter.resolveModel("commandcode", "deepseek/deepseek-v4.1-flash");

  const messages = [{
    role: "user",
    content: [
      { type: "image", attachment: { attachmentId: "sha256:abc", mediaType: "image/webp", width: 10, height: 10 } },
      { type: "text", text: "这张图里是什么？" },
    ],
  }];

  for await (const _chunk of adapter.stream({ provider: "commandcode", model: "deepseek/deepseek-v4.1-flash", messages })) {
    // drain
  }
  assert.ok(forwarded, "the provider transport must receive the request");
  const types = (forwarded.messages?.at(-1)?.content ?? []).map((part) => part.type);
  assert.ok(types.includes("image"), `image part must survive the adapter, got: ${types.join(",")}`);
});

test("buildCommandCodeMessages resolves opaque image attachments into data URLs", async () => {
  // The transport used to require a pre-resolved `block.image`, so a DSH
  // attachment reference ({ type: "image", attachment: {...} }) was dropped and
  // the model never saw the pasted image.
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const attachments = {
    async readImage(ref) {
      return { data: png, ref: { mediaType: ref?.mediaType ?? "image/png" } };
    },
  };
  const { wireMessages } = await buildCommandCodeMessages({
    messages: [{
      role: "user",
      content: [
        { type: "image", attachment: { attachmentId: "sha256:abc", mediaType: "image/png" } },
        { type: "text", text: "看图" },
      ],
    }],
  }, attachments);

  const parts = wireMessages[0].content;
  const image = parts.find((part) => part.type === "image");
  assert.ok(image, "image part must survive into the wire payload");
  assert.match(image.image, /^data:image\/png;base64,/);
  assert.equal(image.image, `data:image/png;base64,${png.toString("base64")}`);
});

test("buildCommandCodeMessages fails loudly when an image attachment cannot be resolved", async () => {
  await assert.rejects(
    () => buildCommandCodeMessages({
      messages: [{
        role: "user",
        content: [{ type: "image", attachment: { attachmentId: "sha256:missing", mediaType: "image/png" } }],
      }],
    }, null),
    /图片附件无法读取/,
  );
});
