import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILTIN_AGENTROUTER_MODELS,
  buildAgentRouterResponsesRequest,
  DEFAULT_AGENTROUTER_USER_AGENT,
  createAgentRouterCatalogLoader,
  createAgentRouterDriver,
  createAgentRouterNativeExecutor,
  parseAgentRouterCatalog,
} from "../modules/provider-agentrouter/src/index.mjs";

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
  return { data, async write(ref, value) { data.set(ref, value); }, async read(ref) { return data.get(ref); } };
}

test("requests carry a client string the service allows", async () => {
  // AgentRouter answers "unauthorized client detected" to curl, python and DSH's
  // own client before it ever looks at the key, so this header is load-bearing.
  let headers = null;
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return new Response(sseBody([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
        "data: [DONE]\n\n",
      ]), { status: 200, headers: { "content-type": "text/event-stream" } });
    },
  });

  await collect(await executor({
    request: { model: "gpt-6-astra", messages: [{ role: "user", content: "hi" }] },
    credential: { apiKey: "sk-test" },
  }));

  assert.equal(headers["user-agent"], DEFAULT_AGENTROUTER_USER_AGENT);
  assert.equal(headers.authorization, "Bearer sk-test");
});

test("the client string can be overridden for a changed allow-list", async () => {
  let headers = null;
  const executor = createAgentRouterNativeExecutor({
    env: {},
    userAgent: "opencode/2.0.0",
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return new Response(sseBody([
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
      ]), { status: 200 });
    },
  });
  await collect(await executor({
    request: { model: "gpt-6-astra", messages: [{ role: "user", content: "hi" }] },
    credential: { apiKey: "sk-test" },
  }));
  assert.equal(headers["user-agent"], "opencode/2.0.0");
});

test("the catalog falls back to the advertised models without a key", async () => {
  const loader = createAgentRouterCatalogLoader({ fetchImpl: async () => { throw new Error("no key"); } });
  const catalog = await loader({ credential: null });
  assert.deepEqual(catalog.models.map((model) => model.id), BUILTIN_AGENTROUTER_MODELS.map((model) => model.id));
  assert.match(catalog.diagnostics?.[0] ?? "", /尚未配置 API Key/u);
});

test("a live catalog read wins and keeps the advertised context windows", async () => {
  let sentUa = null;
  const loader = createAgentRouterCatalogLoader({
    fetchImpl: async (_url, init) => {
      sentUa = init.headers["user-agent"];
      return new Response(JSON.stringify({
        data: [
          { id: "gpt-6.1-sol" },
          { id: "gpt-6-astra" },
          { id: "brand-new-model" },
        ],
      }), { status: 200 });
    },
  });
  const catalog = await loader({ credential: { apiKey: "sk-test" } });
  assert.equal(sentUa, DEFAULT_AGENTROUTER_USER_AGENT, "the models read needs the client string too");
  const byId = new Map(catalog.models.map((model) => [model.id, model]));
  assert.equal(byId.get("gpt-6.1-sol").contextWindow, 1_000_000);
  assert.equal(byId.get("gpt-6-astra").contextWindow, 400_000);
  // A model we have no advertisement for still shows up, with a safe default.
  assert.equal(byId.get("brand-new-model").contextWindow, 128_000);
});

test("parsing ignores entries without an id", () => {
  const parsed = parseAgentRouterCatalog({ data: [{ id: "" }, { object: "model" }, { id: "a" }] });
  assert.deepEqual(parsed.models.map((model) => model.id), ["a"]);
});

test("a pasted key becomes one reusable account", async () => {
  const driver = createAgentRouterDriver({ fetchImpl: async () => new Response("{}", { status: 200 }), env: {} });
  const secretStore = memorySecretStore();
  const [first] = await driver.importSource({ apiKey: "sk-live-key-123" }, { secretStore });
  const [second] = await driver.importSource({ apiKey: "sk-live-key-123" }, { secretStore });
  assert.equal(first.accountId, second.accountId);
  assert.equal(first.providerId, "agentrouter");
  const stored = await secretStore.read(first.auth.credentialRef);
  assert.equal(stored.apiKey, "sk-live-key-123");

  await assert.rejects(() => driver.importSource({ apiKey: "  " }), /请输入/u);
});

test("the executor refuses to send anything without a key", async () => {
  let called = false;
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async () => { called = true; return new Response("", { status: 200 }); },
  });
  await assert.rejects(async () => {
    for await (const event of executor({ request: { model: "x", messages: [] }, credential: null })) void event;
  }, (error) => {
    assert.equal(error.code, "AUTH_REQUIRED");
    return true;
  });
  assert.equal(called, false, "nothing leaves the machine without a key");
});

test("a cut stream fails instead of pretending the answer finished", async () => {
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async () => new Response(sseBody([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "half" } }] })}\n\n`,
    ]), { status: 200 }),
  });
  await assert.rejects(async () => {
    for await (const event of executor({
      request: { model: "gpt-6-astra", messages: [{ role: "user", content: "hi" }] },
      credential: { apiKey: "sk-test" },
    })) void event;
  }, (error) => {
    assert.equal(error.code, "AGENTROUTER_TRUNCATED_STREAM");
    return true;
  });
});

test("a model that refuses chat-completions is retried on the Responses API", async () => {
  // GPT-6-class models answer exactly this, and the message names the API they
  // want; following it is cheaper than failing the turn.
  const calls = [];
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      if (String(url).endsWith("/v1/chat/completions")) {
        return new Response(JSON.stringify({
          error: { message: "模型 gpt-6.1-sol 不支持 /v1/chat/completions 接口，请改用 /v1/responses（OpenAI Responses API）" },
        }), { status: 400 });
      }
      return new Response(sseBody([
        `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "你好" })}\n\n`,
        `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { usage: { input_tokens: 3, output_tokens: 2 } } })}\n\n`,
      ]), { status: 200, headers: { "content-type": "text/event-stream" } });
    },
  });

  const events = await collect(await executor({
    request: { model: "gpt-6.1-sol", messages: [{ role: "user", content: "hi" }], system: "be brief", reasoningEffort: "xhigh" },
    credential: { apiKey: "sk-test" },
  }));

  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/v1\/responses$/u);
  // The Responses body uses input/instructions and maps xhigh down to high.
  assert.equal(calls[1].body.instructions, "be brief");
  assert.deepEqual(calls[1].body.input[0], { role: "user", content: [{ type: "input_text", text: "hi" }] });
  assert.deepEqual(calls[1].body.reasoning, { effort: "high" });

  assert.equal(events.filter((event) => event.type === "text-delta").map((event) => event.text).join(""), "你好");
  assert.deepEqual(events.at(-1), { type: "finish", reason: { kind: "stop" } });
});

test("Responses tool calls become DSH tool-call blocks", async () => {
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async (url) => {
      if (String(url).endsWith("/v1/chat/completions")) {
        return new Response(JSON.stringify({ error: { message: "does not support /v1/chat/completions, use /v1/responses" } }), { status: 400 });
      }
      return new Response(sseBody([
        `data: ${JSON.stringify({ type: "response.output_item.added", item: { type: "function_call", call_id: "call_1", name: "bash", arguments: "" } })}\n\n`,
        `data: ${JSON.stringify({ type: "response.function_call_arguments.delta", item_id: "call_1", delta: "{\"cmd\":\"ls\"}" })}\n\n`,
        `data: ${JSON.stringify({ type: "response.completed", response: {} })}\n\n`,
      ]), { status: 200 });
    },
  });

  const events = await collect(await executor({
    request: { model: "gpt-6.1-sol", messages: [{ role: "user", content: "go" }] },
    credential: { apiKey: "sk-test" },
  }));
  const call = events.find((event) => event.type === "block-end" && event.block?.type === "tool-call");
  assert.equal(call.block.name, "bash");
  assert.equal(call.block.arguments, '{"cmd":"ls"}');
  assert.deepEqual(events.at(-1), { type: "finish", reason: { kind: "tool-calls" } });
});

test("reasoning output from the Responses API is streamed as a reasoning block", async () => {
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async (url) => {
      if (String(url).endsWith("/v1/chat/completions")) {
        return new Response(JSON.stringify({ error: { message: "use /v1/responses" } }), { status: 400 });
      }
      return new Response(sseBody([
        `data: ${JSON.stringify({ type: "response.reasoning_summary_text.delta", delta: "想一想" })}\n\n`,
        `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "答案" })}\n\n`,
        `data: ${JSON.stringify({ type: "response.completed", response: {} })}\n\n`,
      ]), { status: 200 });
    },
  });
  const events = await collect(await executor({
    request: { model: "gpt-6.1-sol", messages: [{ role: "user", content: "hi" }] },
    credential: { apiKey: "sk-test" },
  }));
  assert.equal(events.filter((event) => event.type === "reasoning-delta").map((event) => event.text).join(""), "想一想");
  assert.equal(events.filter((event) => event.type === "text-delta").map((event) => event.text).join(""), "答案");
});

test("the catalog offers reasoning levels so the panel shows a tier picker", async () => {
  const loader = createAgentRouterCatalogLoader({ fetchImpl: async () => { throw new Error("offline"); } });
  const catalog = await loader({ credential: null });
  for (const model of catalog.models) {
    assert.ok(model.reasoning, `${model.id} should declare reasoning`);
    assert.deepEqual(model.reasoning.efforts.map((e) => e.id), ["low", "medium", "high"]);
    assert.equal(model.reasoning.defaultEffort, "medium");
  }
});

test("the responses request maps tool results and calls back", async () => {
  const body = await buildAgentRouterResponsesRequest({
    model: "gpt-6.1-sol",
    messages: [
      { role: "user", content: "read" },
      { role: "assistant", content: [{ type: "tool-call", id: "call_9", name: "read_file", arguments: "{\"p\":1}" }] },
      { role: "tool", toolCallId: "call_9", content: [{ type: "text", text: "done" }] },
    ],
  });
  assert.deepEqual(body.input[1], { type: "function_call", call_id: "call_9", name: "read_file", arguments: '{"p":1}' });
  assert.deepEqual(body.input[2], { type: "function_call_output", call_id: "call_9", output: "done" });
  assert.equal(body.stream, true);
});

test("a model that needed Responses is remembered and skips the doomed call", async () => {
  const calls = [];
  const executor = createAgentRouterNativeExecutor({
    env: {},
    fetchImpl: async (url) => {
      calls.push(String(url).endsWith("/v1/responses") ? "responses" : "chat");
      if (String(url).endsWith("/v1/chat/completions")) {
        return new Response(JSON.stringify({ error: { message: "模型 X 不支持 /v1/chat/completions 接口，请改用 /v1/responses" } }), { status: 400 });
      }
      return new Response(sseBody([
        `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "ok" })}\n\n`,
        `data: ${JSON.stringify({ type: "response.completed", response: {} })}\n\n`,
      ]), { status: 200 });
    },
  });

  const ask = async () => {
    for await (const event of executor({
      request: { model: "gpt-6.1-sol", messages: [{ role: "user", content: "hi" }] },
      credential: { apiKey: "sk-test" },
    })) void event;
  };

  await ask();
  assert.deepEqual(calls, ["chat", "responses"]);
  await ask();
  // The second turn goes straight to Responses: no wasted 400 round trip.
  assert.deepEqual(calls, ["chat", "responses", "responses"]);
});
