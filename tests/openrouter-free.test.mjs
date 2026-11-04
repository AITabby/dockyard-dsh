import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  OPENROUTER_AGENTIC_HEADERS,
  OPENROUTER_FREE_ROUTER_ID,
  buildOpenRouterFreeCatalogFromRaw,
  clearOpenRouterFreeCache,
  createOpenRouterFreeDriver,
  createOpenRouterFreeModule,
  createOpenRouterFreeNativeExecutor,
  normalizeMessages,
} from "../modules/provider-openrouter-free/src/index.mjs";
import { DockyardRuntime, createDefaultProviderEntries } from "../packages/runtime/src/dockyard-runtime.mjs";
import { JsonStateStore } from "../packages/runtime/src/state-store.mjs";
import { DockyardDshService } from "../packages/dsh-plugin/src/dockyard-service.mjs";
import { MemorySecretStore } from "../packages/vault/src/index.mjs";

test("createOpenRouterFreeModule exposes openrouter-free manifest with api_key_auth", () => {
  const mod = createOpenRouterFreeModule();
  assert.equal(mod.manifest.id, "openrouter-free");
  assert.equal(mod.manifest.displayName, "OpenRouter Free");
  assert.ok(mod.manifest.capabilities.includes("api_key_auth"));
  assert.ok(mod.manifest.capabilities.includes("catalog"));
  assert.ok(mod.manifest.capabilities.includes("stream"));
});

test("buildOpenRouterFreeCatalogFromRaw prioritizes router, stealth, and limited-time free models and dynamically updates", () => {
  const rawModels = [
    {
      id: "openrouter/free",
      name: "Free Models Router",
      pricing: { prompt: "0", completion: "0" },
      context_length: 200000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      supported_parameters: ["tools", "reasoning"],
    },
    {
      id: "thinkingmachines/inkling:free",
      name: "Thinking Machines: Inkling (free)",
      created: 1700000010,
      pricing: { prompt: "0", completion: "0" },
      context_length: 1000000,
      top_provider: { context_length: 1000000, max_completion_tokens: 32768 },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: ["tools", "reasoning", "max_tokens"],
    },
    {
      id: "stealth/crouton-alpha",
      name: "Crouton Alpha",
      created: 1700000050,
      pricing: { prompt: "0", completion: "0" },
      context_length: 262144,
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: ["tools", "reasoning", "max_tokens"],
      description: "Stealth model on OpenRouter",
    },
    {
      id: "x-ai/grok-4.2-promo",
      name: "xAI: Grok 4.2 Promo",
      created: 1700000040,
      pricing: { prompt: "0", completion: "0" },
      context_length: 256000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      supported_parameters: ["tools", "max_tokens"],
    },
    {
      id: "nvidia/nemotron-3.5-content-safety:free",
      name: "NVIDIA: Nemotron Content Safety (free)",
      pricing: { prompt: "0", completion: "0" },
      context_length: 32768,
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: ["max_tokens"],
    },
    {
      id: "google/lyria-3-pro-preview",
      name: "Google: Lyria 3 Pro",
      pricing: { prompt: "0", completion: "0" },
      context_length: 32000,
      architecture: { input_modalities: ["text"], output_modalities: ["text", "audio"] },
      supported_parameters: ["max_tokens"],
    },
    {
      id: "anthropic/claude-sonnet-4.6",
      name: "Anthropic: Claude Sonnet 4.6",
      pricing: { prompt: "0.000003", completion: "0.000015" },
      context_length: 200000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      supported_parameters: ["tools", "reasoning"],
    },
  ];

  const catalog = buildOpenRouterFreeCatalogFromRaw(rawModels);
  const ids = catalog.map((m) => m.id);

  assert.equal(ids[0], OPENROUTER_FREE_ROUTER_ID, "openrouter/free router should always be first");
  assert.equal(catalog[0].name, "Free Models Router");
  assert.equal(catalog[0].contextWindow, 200000);
  assert.equal(ids[1], "stealth/crouton-alpha", "stealth free model should be prioritized right after router");
  assert.equal(catalog[1].freeKind, "stealth");
  assert.equal(catalog[1].name, "Crouton Alpha");
  assert.equal(catalog[1].contextWindow, 262144);
  assert.equal(ids[2], "x-ai/grok-4.2-promo", "limited-time 0-cost model should be next");
  assert.equal(catalog[2].freeKind, "limited_free");
  assert.equal(catalog[2].name, "xAI: Grok 4.2 Promo");
  assert.equal(catalog[2].contextWindow, 256000);
  assert.ok(ids.includes("thinkingmachines/inkling:free"));
  assert.ok(!ids.includes("nvidia/nemotron-3.5-content-safety:free"));
  assert.ok(!ids.includes("google/lyria-3-pro-preview"));
  assert.ok(!ids.includes("anthropic/claude-sonnet-4.6"));
});

test("createOpenRouterFreeNativeExecutor streams DSH chunks, omits reasoning when unset, and fails over across free models", async () => {
  clearOpenRouterFreeCache();
  const capturedRequests = [];

  const mockFetch = async (url, init = {}) => {
    if (String(url).endsWith("/models")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "recursive/flint-v1.0:free",
              name: "Recursive Flint (free)",
              pricing: { prompt: "0", completion: "0" },
              context_length: 131072,
              supported_parameters: ["tools", "reasoning"],
            },
            {
              id: "thinkingmachines/inkling:free",
              name: "Thinking Machines: Inkling (free)",
              pricing: { prompt: "0", completion: "0" },
              context_length: 1000000,
              supported_parameters: ["tools", "reasoning"],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = JSON.parse(init.body);
    capturedRequests.push({ url: String(url), headers: init.headers, body });

    if (capturedRequests.length === 1) {
      return new Response(
        JSON.stringify({ error: { message: "No instances available", code: 503 } }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const sseBody = [
      `data: ${JSON.stringify({ id: "gen-or-1", model: "thinkingmachines/inkling:free", choices: [{ delta: { reasoning: "Thinking..." } }] })}\n\n`,
      `data: ${JSON.stringify({ id: "gen-or-1", model: "thinkingmachines/inkling:free", choices: [{ delta: { content: "Hello from OpenRouter Free!" }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 } })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const executor = createOpenRouterFreeNativeExecutor({
    fetchImpl: mockFetch,
    homeDir: os.tmpdir(),
    env: {},
  });

  const compoundId = `call_abc123456789|${"fc_".padEnd(80, "x")}`;
  const chunks = [];
  for await (const chunk of executor({
    request: {
      model: "openrouter/free",
      reasoningEffort: undefined,
      messages: [
        {
          role: "assistant",
          content: [{ type: "toolCall", id: compoundId, name: "read_file", arguments: "{}" }],
        },
        {
          role: "tool",
          tool_call_id: compoundId,
          content: "ok",
        },
        {
          role: "user",
          content: "nihao",
        },
      ],
    },
    credential: { apiKey: "sk-or-v1-test-key-1234567890" },
  })) {
    chunks.push(chunk);
  }

  const textDeltas = chunks.filter((c) => c.type === "text-delta").map((c) => c.text).join("");
  const reasoningDeltas = chunks.filter((c) => c.type === "reasoning-delta").map((c) => c.text).join("");
  assert.equal(textDeltas, "Hello from OpenRouter Free!");
  assert.equal(reasoningDeltas, "Thinking...");
  assert.equal(capturedRequests.length, 2, "Should automatically fail over to next batch after 503");

  const firstReq = capturedRequests[0];
  assert.equal(firstReq.headers["HTTP-Referer"], OPENROUTER_AGENTIC_HEADERS["HTTP-Referer"]);
  assert.equal(firstReq.headers["X-Title"], OPENROUTER_AGENTIC_HEADERS["X-Title"]);
  assert.equal(firstReq.body.reasoning, undefined, "Must NOT send reasoning: { effort: 'none' } when reasoningEffort is unset");

  const assistantMsg = firstReq.body.messages.find((m) => m.role === "assistant");
  const toolMsg = firstReq.body.messages.find((m) => m.role === "tool");
  assert.ok(assistantMsg.tool_calls[0].id.length <= 64);
  assert.ok(!assistantMsg.tool_calls[0].id.includes("|"));
  assert.equal(assistantMsg.tool_calls[0].id, toolMsg.tool_call_id);
});

test("DockyardDshService saves API Key with MemorySecretStore, refreshes live catalog on every getModelSelection, and passes testModelConnection", async () => {
  clearOpenRouterFreeCache();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dockyard-or-free-test-"));
  const stateStore = new JsonStateStore({ filePath: path.join(tempDir, "state.json") });
  const secretStore = new MemorySecretStore();

  let dynamicModels = [
    {
      id: "openrouter/free",
      name: "Free Models Router",
      pricing: { prompt: "0", completion: "0" },
      context_length: 200000,
      supported_parameters: ["tools", "reasoning"],
    },
    {
      id: "stealth/crouton-alpha",
      name: "Crouton Alpha",
      pricing: { prompt: "0", completion: "0" },
      context_length: 262144,
      supported_parameters: ["tools", "reasoning"],
    },
  ];

  const mockFetch = async (url) => {
    const u = String(url);
    if (u.endsWith("/credits")) {
      // Simulate $0 credit free-tier account — must NOT be marked exhausted!
      return new Response(
        JSON.stringify({ data: { total_credits: 0, total_usage: 0 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (u.endsWith("/key")) {
      return new Response(
        JSON.stringify({ data: { label: "My Free Key", is_free_tier: true } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (u.endsWith("/models")) {
      return new Response(
        JSON.stringify({ data: dynamicModels }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (u.endsWith("/chat/completions")) {
      const sseBody = [
        `data: ${JSON.stringify({ id: "gen-probe-1", model: "stealth/crouton-alpha", choices: [{ delta: { role: "assistant" } }] })}\n\n`,
        "data: [DONE]\n\n",
      ].join("");
      return new Response(sseBody, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }
    return new Response("{}", { status: 200 });
  };

  try {
    const driver = createOpenRouterFreeDriver({
      fetchImpl: mockFetch,
      homeDir: tempDir,
      env: {},
    });
    const runtime = new DockyardRuntime({
      providers: createDefaultProviderEntries({ openrouterFreeDriver: driver }),
      stateStore,
      secretStore,
    });
    const service = new DockyardDshService({
      runtime,
      autoRefresh: false,
    });

    const addResult = await service.add("openrouter-free", null, {
      apiKey: "sk-or-v1-my-custom-key-9999",
      label: "个人免费 Key",
    });

    assert.equal(addResult.accounts.length, 1);
    assert.equal(addResult.accounts[0].displayName, "个人免费 Key");
    assert.equal(addResult.accounts[0].health.status, "healthy");
    assert.equal(addResult.accounts[0].quota.remaining, null, "$0 credit balance on OpenRouter Free must not be 0 (exhausted)");

    const sel1 = await service.getModelSelection("openrouter-free");
    assert.equal(sel1.models.length, 2);

    // Simulate OpenRouter dynamically launching a new limited-time free model
    dynamicModels = [
      ...dynamicModels,
      {
        id: "stealth/nova-omega-alpha",
        name: "Nova Omega Alpha",
        pricing: { prompt: "0", completion: "0" },
        context_length: 512000,
        supported_parameters: ["tools", "reasoning"],
      },
    ];

    // Re-entering the subscription calls getModelSelection("openrouter-free") and must immediately reflect the new model
    const sel2 = await service.getModelSelection("openrouter-free");
    assert.equal(sel2.models.length, 3);
    assert.ok(sel2.models.some((m) => m.id === "stealth/nova-omega-alpha"));

    // Test connection must succeed even when a stealth model only emits role/encrypted reasoning in probe
    const probeRes = await service.testModelConnection("openrouter-free", "stealth/crouton-alpha");
    assert.equal(probeRes.ok, true, `Expected probe ok, got: ${JSON.stringify(probeRes)}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("normalizeMessages preserves DSH tool-call blocks, extracts tool-result blocks, and pairs orphaned tool outputs", async () => {
  const normalized = await normalizeMessages({
    system: "You are a helpful coding assistant.",
    messages: [
      { role: "user", content: "List files" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "I should run ls" },
          { type: "tool-call", toolCallId: "call_ls_1", toolName: "run_command", input: { command: "ls -la" } },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_ls_1",
            toolName: "run_command",
            output: { type: "text", value: "total 72\ndrwxr-xr-x 5 user staff 160" },
          },
        ],
      },
    ],
  });

  assert.equal(normalized.length, 4);
  const asst = normalized[2];
  const tool = normalized[3];
  assert.equal(asst.role, "assistant");
  assert.equal(asst.content, null);
  assert.equal(asst.reasoning_content, "I should run ls");
  assert.equal(asst.tool_calls.length, 1);
  assert.equal(asst.tool_calls[0].id, "call_ls_1");
  assert.equal(asst.tool_calls[0].function.name, "run_command");
  assert.equal(tool.role, "tool");
  assert.equal(tool.tool_call_id, "call_ls_1");
  assert.match(tool.content, /total 72/);

  // Test inline <think> tag extraction during streaming
  clearOpenRouterFreeCache();
  const sseBody = [
    `data: ${JSON.stringify({ id: "gen-think-1", model: "stealth/crouton-alpha", choices: [{ delta: { content: "<think>已写入记忆，准备输出结论" } }] })}\n\n`,
    `data: ${JSON.stringify({ id: "gen-think-1", model: "stealth/crouton-alpha", choices: [{ delta: { content: "</think>这是最终干净的审核结论。" }, finish_reason: "stop" }] })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");

  const executor = createOpenRouterFreeNativeExecutor({
    fetchImpl: async (url) => {
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(sseBody, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    },
    homeDir: os.tmpdir(),
    env: {},
  });

  const chunks = [];
  for await (const chunk of executor({
    request: { model: "stealth/crouton-alpha", messages: [{ role: "user", content: "audit" }] },
    credential: { apiKey: "sk-or-v1-test-key" },
  })) {
    chunks.push(chunk);
  }

  const reasoningText = chunks.filter((c) => c.type === "reasoning-delta").map((c) => c.text).join("");
  const finalText = chunks.filter((c) => c.type === "text-delta").map((c) => c.text).join("");
  assert.equal(reasoningText, "已写入记忆，准备输出结论");
  assert.equal(finalText, "这是最终干净的审核结论。");
});

test("openrouter-free driver forwards the durable attachment service to the transport", async () => {
  let captured = null;
  const { createOpenRouterFreeDriver } = await import("../modules/provider-openrouter-free/src/index.mjs");
  const driver = createOpenRouterFreeDriver({
    requestExecutor: async function* (envelope) {
      captured = envelope;
      yield { type: "text", text: "ok" };
    },
  });
  const attachments = {
    async readImage(ref) {
      return { data: Buffer.from("bytes"), ref: { mediaType: ref?.mediaType ?? "image/png" } };
    },
  };
  for await (const _ of await driver.stream({ messages: [{ role: "user", content: "hi" }] }, { account: null }, { attachments })) {
    // drain
  }
  assert.ok(captured, "executor must be invoked");
  assert.equal(captured.attachments, attachments, "driver must forward context.attachments");
});
