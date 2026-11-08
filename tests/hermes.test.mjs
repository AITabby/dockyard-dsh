import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createHermesModule,
  createHermesDriver,
  createHermesCatalogLoader,
  parseHermesCatalog,
  summarizeHermesCandidate,
  BUILTIN_HERMES_MODELS,
  buildHermesMessages,
  createHermesNativeExecutor,
} from "../modules/provider-hermes/src/index.mjs";
import { DockyardRuntime, createDefaultProviderEntries } from "../packages/runtime/src/dockyard-runtime.mjs";
import { createDockyardLlmAdapter } from "../packages/dsh-bridge/src/llm-adapter.mjs";

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

test("Hermes provider module manifest and builtin models", async () => {
  const mod = createHermesModule();
  assert.equal(mod.manifest.id, "hermes");
  assert.equal(mod.manifest.displayName, "Hermes (Nous Research)");
  assert.ok(mod.manifest.capabilities.includes("catalog"));
  assert.ok(mod.manifest.capabilities.includes("quota"));
  assert.ok(mod.manifest.capabilities.includes("stream"));

  assert.ok(BUILTIN_HERMES_MODELS.length >= 6);
  const deepseekFlash = BUILTIN_HERMES_MODELS.find((m) => m.id === "deepseek/deepseek-v4.1-flash");
  assert.ok(deepseekFlash);
  assert.equal(deepseekFlash.name, "DeepSeek V4.1 Flash", "the vendor prefix is not repeated in the builtin table");
  assert.equal(deepseekFlash.contextWindow, 1048576);

  const beamFree = BUILTIN_HERMES_MODELS.find((m) => m.id === "reflection/beam-1.0-501b-a23b:free");
  assert.ok(beamFree);
  assert.equal(beamFree.free, true);
});

test("parseHermesCatalog parses live Nous Portal catalog format and filters embeddings", async () => {
  const mockApiData = {
    data: [
      {
        id: "deepseek/deepseek-v4.1-flash",
        name: "DeepSeek: DeepSeek V4.1 Flash",
        context_length: 1048576,
        top_provider: { max_completion_tokens: 131072 },
        architecture: { input_modalities: ["text", "image"] },
        pricing: { prompt: "0.0000001060", completion: "0.0000005130" },
        reasoning: {
          supported_efforts: ["max", "high", "low"],
          default_effort: "high",
        },
        endpoints: ["/api/v1/chat/completions"],
      },
      {
        id: "reflection/beam-1.0-501b-a23b:free",
        name: "Reflection: Beam 1.0 501B A23B (free)",
        context_length: 262144,
        top_provider: { max_completion_tokens: 131072 },
        architecture: { input_modalities: ["text"] },
        pricing: { prompt: "0.0000000000", completion: "0.0000000000" },
        endpoints: ["/api/v1/chat/completions"],
      },
      {
        id: "amazon/titan-embed-text-v2",
        name: "Amazon Titan Text Embeddings V2",
        architecture: { modality: "text->embeddings", output_modalities: ["embeddings"] },
        endpoints: ["/api/v1/embeddings"],
      },
    ],
  };

  const parsed = parseHermesCatalog(mockApiData);
  assert.equal(parsed.models.length, 2);
  assert.equal(parsed.models[0].id, "deepseek/deepseek-v4.1-flash");
  assert.equal(parsed.models[0].contextWindow, 1048576);
  assert.equal(parsed.models[0].reasoning.defaultEffort, "high");

  assert.equal(parsed.models[1].id, "reflection/beam-1.0-501b-a23b:free");
  assert.equal(parsed.models[1].free, true);
});

test("buildHermesMessages formats user, assistant, system, and tool messages", async () => {
  const request = {
    messages: [
      { role: "system", content: "You are a coding assistant" },
      { role: "user", content: "What is 1+1?" },
      {
        role: "assistant",
        content: "Let me calculate",
        tool_calls: [
          {
            id: "call_calc_1",
            type: "function",
            function: { name: "calc", arguments: '{"expr":"1+1"}' },
          },
        ],
      },
      { role: "tool", toolCallId: "call_calc_1", content: "2" },
    ],
  };

  const messages = await buildHermesMessages(request);
  assert.equal(messages.length, 4);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.equal(messages[1].content, "What is 1+1?");
  assert.equal(messages[2].role, "assistant");
  assert.ok(Array.isArray(messages[2].tool_calls));
  assert.equal(messages[2].tool_calls[0].id, "call_calc_1");
  assert.equal(messages[3].role, "tool");
  assert.equal(messages[3].content, "2");
});

test("buildHermesMessages sanitizes composite Codex tool IDs (length > 64) to valid length <= 64", async () => {
  const codexCompositeId = "call_0194ff7b2b647bc58a184bf418431050|item_0194ff7b2b647bc58a184bf418431051";
  assert.equal(codexCompositeId.length, 75);

  const request = {
    messages: [
      {
        role: "assistant",
        content: "calling tool",
        tool_calls: [
          {
            id: codexCompositeId,
            type: "function",
            function: { name: "search", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        toolCallId: codexCompositeId,
        content: "results",
      },
    ],
  };

  const messages = await buildHermesMessages(request);
  assert.equal(messages.length, 2);
  const assistantToolId = messages[0].tool_calls[0].id;
  const toolResultId = messages[1].tool_call_id;

  assert.ok(assistantToolId.length <= 64);
  assert.ok(toolResultId.length <= 64);
  assert.equal(assistantToolId, toolResultId);
  assert.ok(!assistantToolId.includes("|"));
});

test("createHermesNativeExecutor streams reasoning deltas, text deltas, and usage", async () => {
  const sseLines = [
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: { reasoning_content: "Thinking step..." } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: { content: "Hello from Hermes!" } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "gen_1",
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
    })}\n\n`,
  ];

  const mockFetch = async () => {
    const stream = new ReadableStream({
      start(controller) {
        for (const line of sseLines) {
          controller.enqueue(new TextEncoder().encode(line));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const executor = createHermesNativeExecutor({
    fetchImpl: mockFetch,
    apiKey: "sk-test-key",
  });

  const events = [];
  for await (const event of executor({
    request: {
      model: "deepseek/deepseek-v4.1-flash",
      messages: [{ role: "user", content: "Hi" }],
    },
  })) {
    events.push(event);
  }

  const reasoningEvents = events.filter((e) => e.type === "reasoning-delta");
  assert.equal(reasoningEvents.length, 1);
  assert.equal(reasoningEvents[0].text, "Thinking step...");

  const textEvents = events.filter((e) => e.type === "text-delta");
  assert.equal(textEvents.length, 1);
  assert.equal(textEvents[0].text, "Hello from Hermes!");

  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.reason.kind, "stop");
  assert.equal(finish.usage.totalTokens, 40);
});

test("HermesDriver discovers both configured accounts and imports into account pool", async () => {
  const tempAuthPath = join(tmpdir(), `hermes-test-auth-${Date.now()}.json`);
  writeFileSync(tempAuthPath, JSON.stringify({
    accounts: [
      { accountId: "hermes-acc-1", displayName: "Hermes Account 1 ($50)", apiKey: "sk-hermes-1", balance: 50 },
      { accountId: "hermes-acc-2", displayName: "Hermes Account 2 ($10)", apiKey: "sk-hermes-2", balance: 10 },
    ],
  }));
  const prevAuthPath = process.env.HERMES_AUTH_PATH;
  process.env.HERMES_AUTH_PATH = tempAuthPath;

  try {
    const driver = createHermesDriver();
    const discovery = await driver.discover();
    assert.ok(discovery.candidates.length >= 2, "Should discover both configured keys from auth.json");

    const cand1 = discovery.candidates[0];
    const cand2 = discovery.candidates[1];
    assert.equal(cand1.candidateId, "hermes-acc-1");
    // A pay-as-you-go balance is money, not a quota window: it has no cap to
    // divide by, so it is reported as a balance and never as a 100% window.
    assert.equal(cand1.balance.amount, 50);
    assert.equal(cand1.balance.unit, "USD");
    assert.equal(cand1.quota.windows.length, 0);
    assert.ok(cand1.resources?.quotaDiagnostic);
    assert.equal(cand2.candidateId, "hermes-acc-2");
    assert.equal(cand2.balance.amount, 10);

    const mockSecretStore = {
      data: new Map(),
      async write(ref, val) { this.data.set(ref, val); },
      async read(ref) { return this.data.get(ref); },
    };

    const acc1 = await driver.importAccount(cand1, { secretStore: mockSecretStore });
    const acc2 = await driver.importAccount(cand2, { secretStore: mockSecretStore });

    assert.equal(acc1.providerId, "hermes");
    assert.equal(acc1.accountId, "hermes-acc-1");
    assert.equal(acc1.balance.amount, 50);
    assert.ok(acc1.resources?.quotaDiagnostic);

    assert.equal(acc2.providerId, "hermes");
    assert.equal(acc2.accountId, "hermes-acc-2");
    assert.equal(acc2.balance.amount, 10);
  } finally {
    if (prevAuthPath === undefined) delete process.env.HERMES_AUTH_PATH;
    else process.env.HERMES_AUTH_PATH = prevAuthPath;
    try { unlinkSync(tempAuthPath); } catch {}
  }
});

test("DockyardRuntime auto-provisions Hermes accounts and exposes model catalog in adapter", async () => {
  const tempAuthPath = join(tmpdir(), `hermes-runtime-auth-${Date.now()}.json`);
  writeFileSync(tempAuthPath, JSON.stringify({
    accounts: [
      { accountId: "hermes-acc-1", displayName: "Hermes Account 1 ($50)", apiKey: "sk-hermes-1", balance: 50 },
      { accountId: "hermes-acc-2", displayName: "Hermes Account 2 ($10)", apiKey: "sk-hermes-2", balance: 10 },
    ],
  }));
  const prevAuthPath = process.env.HERMES_AUTH_PATH;
  process.env.HERMES_AUTH_PATH = tempAuthPath;

  try {
    const runtime = new DockyardRuntime({
      stateStore: memoryStateStore(),
      secretStore: {
        data: new Map(),
        async write(ref, val) { this.data.set(ref, val); },
        async read(ref) { return this.data.get(ref); },
      },
      providers: [
        {
          module: createHermesModule({
            driver: createHermesDriver({
              apiKey: "sk-mock-key",
              fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
            }),
          }),
        },
      ],
    });

    await runtime.init();
    const snapshot = runtime.snapshot();
    const hermesEntry = snapshot.providers.find((p) => p.providerId === "hermes");
    assert.ok(hermesEntry, "Hermes provider should be registered");
    assert.ok(hermesEntry.accounts.length >= 2, "Both accounts should be auto-provisioned into the pool");
    assert.ok(hermesEntry.accounts.some((a) => a.accountId === "hermes-acc-1"));
    assert.ok(hermesEntry.accounts.some((a) => a.accountId === "hermes-acc-2"));

    const adapter = createDockyardLlmAdapter({
      runtime,
      providerIds: ["hermes"],
    });

    const models = await adapter.listModels("hermes");
    assert.ok(models.length >= 5);
    assert.ok(models.some((m) => m.id === "deepseek/deepseek-v4.1-flash"));
    assert.ok(models.some((m) => m.id === "reflection/beam-1.0-501b-a23b:free"));
  } finally {
    if (prevAuthPath === undefined) delete process.env.HERMES_AUTH_PATH;
    else process.env.HERMES_AUTH_PATH = prevAuthPath;
    try { unlinkSync(tempAuthPath); } catch {}
  }
});

test("hermes driver forwards the durable attachment service to the transport", async () => {
  // Regression: the driver used to invoke the executor without `attachments`,
  // so the transport could not resolve DSH's opaque image references and every
  // pasted image was silently dropped (the model then reported seeing nothing).
  let captured = null;
  const driver = createHermesDriver({
    requestExecutor: async function* (envelope) {
      captured = envelope;
      yield { type: "text", text: "ok" };
    },
  });

  const attachments = {
    async readImage(ref) {
      return { data: Buffer.from("fake-bytes"), ref: { mediaType: ref?.mediaType ?? "image/webp" } };
    },
  };
  const request = {
    model: "deepseek/deepseek-v4.1-flash",
    messages: [{
      role: "user",
      content: [
        { type: "image", attachment: { attachmentId: "sha256:abc", mediaType: "image/webp" } },
        { type: "text", text: "看图" },
      ],
    }],
  };

  for await (const _ of await driver.stream(request, { account: { auth: { credentialRef: null } } }, { attachments })) {
    // drain
  }

  assert.ok(captured, "executor must be invoked");
  assert.equal(captured.attachments, attachments, "driver must forward context.attachments");
});

test("buildHermesMessages never sends an empty content array", async () => {
  // The strict models on this gateway reject the whole request with
  // "messages[N]: content must not be an empty array". An assistant turn that
  // only called a tool used to produce exactly that.
  const messages = await buildHermesMessages({
    messages: [
      { role: "user", content: "check the time" },
      { role: "assistant", content: [{ type: "tool-call", id: "c1", name: "clock", arguments: { tz: "UTC" } }] },
      { role: "tool", toolCallId: "c1", content: "12:00" },
      { role: "assistant", content: [{ type: "text", text: "" }] },
    ],
  });
  for (const message of messages) {
    assert.notEqual(Array.isArray(message.content) && message.content.length === 0, true,
      `message for ${message.role} has an empty content array`);
  }
  const call = messages.find((message) => message.role === "assistant" && message.tool_calls);
  assert.equal(call.content, "");
  assert.equal(call.tool_calls[0].function.name, "clock");
  assert.equal(call.tool_calls[0].function.arguments, JSON.stringify({ tz: "UTC" }));
});

test("HermesDriver never invents a balance the auth file does not carry", async () => {
  const tempAuthPath = join(tmpdir(), `hermes-test-nobalance-${Date.now()}.json`);
  writeFileSync(tempAuthPath, JSON.stringify({
    accounts: [{ accountId: "hermes-acc-9", displayName: "Hermes No Balance", apiKey: "sk-hermes-9" }],
  }));
  const prevAuthPath = process.env.HERMES_AUTH_PATH;
  process.env.HERMES_AUTH_PATH = tempAuthPath;
  try {
    const driver = createHermesDriver();
    const discovery = await driver.discover();
    const candidate = discovery.candidates[0];
    assert.equal(candidate.balance, null, "no balance was reported, so none may be shown");
    assert.equal(candidate.quota.windows.length, 0);
    assert.equal(candidate.subscription.plan, "Nous Portal");
  } finally {
    if (prevAuthPath === undefined) delete process.env.HERMES_AUTH_PATH;
    else process.env.HERMES_AUTH_PATH = prevAuthPath;
    try { unlinkSync(tempAuthPath); } catch {}
  }
});

test("createHermesNativeExecutor parses DSML tool calls emitted inside reasoning delta and triggers tool-calls", async () => {
  const dsmlInReasoning = `Thinking about inspection...\n<｜DSML｜ calls>\n<｜DSML｜ invoke name="bash">\n<｜DSML｜ parameter name="command" string="true">pwd</｜DSML｜ parameter>\n</｜DSML｜ invoke>\n</｜DSML｜ calls>`;
  const ssePayload = [
    `data: ${JSON.stringify({
      id: "hermes-dsml-1",
      choices: [{ delta: { reasoning_content: dsmlInReasoning } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "hermes-dsml-2",
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");

  const mockFetch = async () => new Response(ssePayload, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });

  const executor = createHermesNativeExecutor({
    fetchImpl: mockFetch,
    apiKey: "sk-test-key",
  });

  const events = [];
  for await (const event of executor({
    request: {
      model: "deepseek/deepseek-v4.1-flash",
      messages: [{ role: "user", content: "Run pwd" }],
    },
  })) {
    events.push(event);
  }

  // DSML tags must never leak into reasoning-delta or block-end reasoning text
  const reasoningDeltas = events.filter((e) => e.type === "reasoning-delta");
  for (const rd of reasoningDeltas) {
    assert.equal(rd.text.includes("DSML"), false, "DSML tags should never leak into reasoning-delta");
  }
  const reasoningEnds = events.filter((e) => e.type === "block-end" && e.block?.type === "reasoning");
  assert.equal(reasoningEnds.length, 1);
  assert.equal(reasoningEnds[0].block.text.includes("DSML"), false, "DSML tags should be stripped from reasoning text");
  assert.equal(reasoningEnds[0].block.text.trim(), "Thinking about inspection...");

  // Tool calls should be extracted
  const toolEnds = events.filter((e) => e.type === "block-end" && e.block?.type === "tool-call");
  assert.equal(toolEnds.length, 1);
  assert.equal(toolEnds[0].block.name, "bash");
  assert.equal(toolEnds[0].block.arguments, JSON.stringify({ command: "pwd" }));

  // Finish reason should be tool-calls, not stop
  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.reason.kind, "tool-calls");
});

test("createHermesNativeExecutor parses DSML tool calls emitted inside content delta and triggers tool-calls", async () => {
  const dsmlInContent = `<｜DSML｜ calls>\n<｜DSML｜ invoke name="web_fetch">\n<｜DSML｜ parameter name="url" string="true">https://example.com</｜DSML｜ parameter>\n</｜DSML｜ invoke>\n</｜DSML｜ calls>`;
  const ssePayload = [
    `data: ${JSON.stringify({
      id: "hermes-dsml-c1",
      choices: [{ delta: { content: dsmlInContent } }],
    })}\n\n`,
    `data: ${JSON.stringify({
      id: "hermes-dsml-c2",
      choices: [{ delta: {}, finish_reason: "stop" }],
    })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");

  const mockFetch = async () => new Response(ssePayload, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });

  const executor = createHermesNativeExecutor({
    fetchImpl: mockFetch,
    apiKey: "sk-test-key",
  });

  const events = [];
  for await (const event of executor({
    request: {
      model: "deepseek/deepseek-v4.1-flash",
      messages: [{ role: "user", content: "Fetch url" }],
    },
  })) {
    events.push(event);
  }

  const toolEnds = events.filter((e) => e.type === "block-end" && e.block?.type === "tool-call");
  assert.equal(toolEnds.length, 1);
  assert.equal(toolEnds[0].block.name, "web_fetch");
  assert.equal(toolEnds[0].block.arguments, JSON.stringify({ url: "https://example.com" }));

  const finish = events.find((e) => e.type === "finish");
  assert.ok(finish);
  assert.equal(finish.reason.kind, "tool-calls");
});

function hermesSseResponse(lines) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(new TextEncoder().encode(line));
      controller.close();
    },
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const reasoningOnlySse = [
  `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Only thinking, no answer." } }] })}\n\n`,
  `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
];

const answerSse = [
  `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Now I know." } }] })}\n\n`,
  `data: ${JSON.stringify({ choices: [{ delta: { content: "Final answer." } }] })}\n\n`,
  `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
];

test("a turn that only thinks is retried and the answer survives", async () => {
  let calls = 0;
  const bodies = [];
  const executor = createHermesNativeExecutor({
    apiKey: "sk-test-key",
    fetchImpl: async (_url, init) => {
      calls += 1;
      bodies.push(JSON.parse(init.body));
      return calls === 1 ? hermesSseResponse(reasoningOnlySse) : hermesSseResponse(answerSse);
    },
  });

  const events = [];
  for await (const event of executor({ request: { model: "anthropic/claude-haiku-5.5", messages: [{ role: "user", content: "Hi" }] } })) {
    events.push(event);
  }

  assert.equal(calls, 2, "the empty attempt should have been retried once");
  // The retry must say what went wrong, otherwise it just thinks again.
  const retried = bodies[1].messages;
  assert.ok(
    retried.some((message) => message.role === "system" && String(message.content).includes("只写了思考过程")),
    "the retry should carry the corrective nudge",
  );
  assert.equal(bodies[0].messages.some((message) => String(message.content).includes("只写了思考过程")), false);
  // The host must never see the abandoned attempt: no duplicated reasoning and
  // exactly one answer.
  const texts = events.filter((event) => event.type === "text-delta").map((event) => event.text);
  assert.deepEqual(texts, ["Final answer."]);
  const finishes = events.filter((event) => event.type === "finish");
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].reason.kind, "stop");
});

test("thinking forever fails loudly instead of ending the turn in silence", async () => {
  let calls = 0;
  const executor = createHermesNativeExecutor({
    apiKey: "sk-test-key",
    fetchImpl: async () => {
      calls += 1;
      return hermesSseResponse(reasoningOnlySse);
    },
  });

  await assert.rejects(
    async () => {
      for await (const event of executor({ request: { model: "anthropic/claude-haiku-5.5", messages: [{ role: "user", content: "Hi" }] } })) {
        void event;
      }
    },
    (error) => {
      assert.equal(error.code, "EMPTY_COMPLETION");
      assert.match(String(error.message), /思考内容/u);
      return true;
    },
  );
  assert.equal(calls, 3, "two retries after the first attempt");
});

test("a normal answer is streamed without a second request", async () => {
  let calls = 0;
  const executor = createHermesNativeExecutor({
    apiKey: "sk-test-key",
    fetchImpl: async () => {
      calls += 1;
      return hermesSseResponse(answerSse);
    },
  });

  const events = [];
  for await (const event of executor({ request: { model: "anthropic/claude-haiku-5.5", messages: [{ role: "user", content: "Hi" }] } })) {
    events.push(event);
  }

  assert.equal(calls, 1);
  assert.deepEqual(events.filter((event) => event.type === "text-delta").map((event) => event.text), ["Final answer."]);
});
