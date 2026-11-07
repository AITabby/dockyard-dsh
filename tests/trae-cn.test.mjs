import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_ID,
  TRAE_CN_MODELS,
  TRAE_CN_CONTEXT_FALLBACK,
  createTraeCnDriver,
  TraeCnSubscriptionDriver,
  createTraeCnModule,
  claimTraeDailyCredits,
  createTraeNativeExecutor,
  newTraeDevice,
  parseTraeCnCatalog,
  traeRequestError,
  mergeTraeCnRoster,
  readTraeCallback,
  readTraeCredits,
  traeAuthorizationUrl,
  traeChatBody,
  traeTools,
  traeHeaders,
  traeMessages,
  traeSseEvents,
  traeWhen,
} from "../modules/provider-trae-cn/src/index.mjs";

function sseBody(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collectEvents(stream) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

test("Trae CN manifest offers a real authorization entry point", () => {
  const module = createTraeCnModule();
  assert.equal(module.manifest.id, "trae-cn");
  assert.equal(module.manifest.displayName, "Trae CN");
  for (const capability of ["oauth_authorization", "oauth_import", "quota", "catalog", "invoke", "stream"]) {
    assert.ok(module.manifest.capabilities.includes(capability), `missing ${capability}`);
  }
});

test("the catalog is the roster proven against the live chat endpoint", () => {
  const catalog = parseTraeCnCatalog();
  assert.equal(catalog.models.length, TRAE_CN_MODELS.length);
  // Every id here answered llm_utils_chat with a real stream; the ones the
  // endpoint rejects (Kimi-K3.1-Pro, gpt-5.x, ...) must not be offered.
  const ids = catalog.models.map((model) => model.id);
  for (const id of ["deepseek-v4.1-flash", "glm-5.3", "kimi-k3", "mimo-v2.6-flash", "minimax-m3"]) {
    assert.ok(ids.includes(id), `missing verified model ${id}`);
  }
  assert.ok(!ids.includes("kimi-k3.1-pro"));
  // Capacities come from Trae CN's own roster: the current generation exposes
  // its 1M "Max" window, the older one stays at 200k.
  assert.equal(catalog.models.find((model) => model.id === "deepseek-v4.1-flash").contextWindow, 1_000_000);
  assert.equal(catalog.models.find((model) => model.id === "kimi-k3").contextWindow, 1_000_000);
  assert.equal(catalog.models.find((model) => model.id === "mimo-v2.6-flash").contextWindow, 981_504);
  assert.equal(catalog.models.find((model) => model.id === "kimi-k2.5").contextWindow, 200_000);
  assert.deepEqual(catalog.models.find((model) => model.id === "glm-5.3").inputModalities, ["text"]);
  assert.deepEqual(catalog.models.find((model) => model.id === "kimi-k3").inputModalities, ["text", "image"]);
});

test("only models that actually reason get effort choices", () => {
  const catalog = parseTraeCnCatalog();
  const reasoning = catalog.models.filter((model) => model.reasoning);
  const kimi25 = catalog.models.find((model) => model.id === "kimi-k2.5");
  assert.equal(kimi25.reasoning, undefined);
  assert.ok(reasoning.length >= 10);
  // Every model carries the option list Trae CN publishes for it.
  const byId = new Map(catalog.models.map((model) => [model.id, model]));
  assert.deepEqual(byId.get("kimi-k3").reasoning.efforts.map((e) => e.id), ["light", "high", "extra_high"]);
  assert.deepEqual(byId.get("Doubao-Seed-Code").reasoning.efforts.map((e) => e.id), ["light", "high"]);
  assert.equal(byId.get("kimi-k3").reasoning.defaultEffort, "high");
  // Models Trae CN marks as non-thinking offer no dial at all.
  assert.equal(byId.get("mimo-v2.6-flash").reasoning, undefined);
  assert.equal(byId.get("minimax-m3").reasoning, undefined);
});

test("a device id has Trae CN's 16 digits and never starts with 0", () => {
  const device = newTraeDevice();
  assert.match(device.deviceId, /^[1-9]\d{15}$/u);
  assert.match(device.machineId, /^[0-9a-f]{32}$/u);
});

test("the authorization URL names the callback and the device", () => {
  const device = newTraeDevice();
  const url = new URL(traeAuthorizationUrl({
    callback: "http://127.0.0.1:1234/authorize",
    device,
  }));
  assert.equal(url.origin, "https://www.trae.cn");
  assert.equal(url.pathname, "/authorization");
  assert.equal(url.searchParams.get("auth_callback_url"), "http://127.0.0.1:1234/authorize");
  assert.equal(url.searchParams.get("device_id"), device.deviceId);
  assert.equal(url.searchParams.get("machine_id"), device.machineId);
  assert.equal(url.searchParams.get("client_id"), "ono9krqynydwx5");
  assert.equal(url.searchParams.get("login_channel"), "native_ide");
});

test("the callback's userJwt and userInfo become a credential", () => {
  const params = new URLSearchParams({
    userJwt: JSON.stringify({ Token: "tok", RefreshToken: "refresh", TokenExpireAt: 1_800_000_000, ClientID: "cid" }),
    userInfo: JSON.stringify({ UserID: 42, ScreenName: "AITABBY" }),
    refreshExpireAt: "1800000000",
    userRegion: "cn",
  });
  const credential = readTraeCallback(params, { device: { deviceId: "1", machineId: "m" } });
  assert.equal(credential.token, "tok");
  assert.equal(credential.refreshToken, "refresh");
  assert.equal(credential.uid, "42");
  assert.equal(credential.name, "AITABBY");
  assert.equal(credential.clientId, "cid");
  assert.equal(credential.expiresAt, 1_800_000_000_000);
  assert.deepEqual(credential.device, { deviceId: "1", machineId: "m" });
});

test("a callback without any token is an error, not an empty account", () => {
  assert.throws(
    () => readTraeCallback(new URLSearchParams({}), {}),
    /没有返回登录凭据/u,
  );
});

test("traeWhen reads seconds, milliseconds and ISO", () => {
  assert.equal(traeWhen(1_800_000_000), 1_800_000_000_000);
  assert.equal(traeWhen(1_800_000_000_000), 1_800_000_000_000);
  assert.equal(traeWhen("2027-01-15T08:00:00.000Z"), Date.parse("2027-01-15T08:00:00.000Z"));
  assert.equal(traeWhen(""), 0);
});

test("messages carry content as an array, as Trae requires", () => {
  const messages = traeMessages({
    system: "be brief",
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ],
  });
  assert.deepEqual(messages[0], { role: "system", content: [{ type: "text", text: "be brief" }] });
  assert.deepEqual(messages[1], { role: "user", content: [{ type: "text", text: "hello" }] });
  assert.deepEqual(messages[2], { role: "assistant", content: [{ type: "text", text: "hi" }] });
});

test("the chat body names a real model, never auto", () => {
  const body = traeChatBody({ model: "glm-5.2", messages: [{ role: "user", content: "hi" }] });
  assert.equal(body.config_name, "glm-5.2");
  assert.equal(body.model, "glm-5.2");
  assert.equal(body.function, "chat_v3");
  assert.equal(body.stream, true);
  assert.ok(body.request_id);
  assert.ok(body.session_id);
});

test("headers carry the version ids Trae demands", () => {
  const headers = traeHeaders({ token: "tok", uid: "42", device: { deviceId: "1", machineId: "m" } });
  assert.equal(headers.Authorization, "Cloud-IDE-JWT tok");
  assert.equal(headers["x-ide-token"], "tok");
  assert.equal(headers["x-uid"], "42");
  assert.equal(headers["x-app-version-code"], "20260917");
  assert.equal(headers["x-ide-version-code"], "20260917");
  assert.equal(headers["x-device-id"], "1");
});

test("SSE events are split into event/data records", async () => {
  const events = await collectEvents(traeSseEvents(sseBody([
    'id:1\nevent:metadata\ndata:{"model":""}\n\n',
    'id:2\nevent:output\ndata:{"response":"你好"}\n\n',
  ])));
  assert.equal(events.length, 2);
  assert.equal(events[0].event, "metadata");
  assert.deepEqual(events[0].data, { model: "" });
  assert.equal(events[1].event, "output");
  assert.equal(events[1].data.response, "你好");
});

test("the executor streams reasoning and answer from output events", async () => {
  const fetchImpl = async () => new Response(sseBody([
    'event:metadata\ndata:{"session_id":"s"}\n\n',
    'event:output\ndata:{"response":"","reasoning_content":"想一想"}\n\n',
    'event:output\ndata:{"response":"你好","reasoning_content":null}\n\n',
    'event:done\ndata:{"finish_reason":"stop"}\n\n',
  ]), { status: 200, headers: { "content-type": "text/event-stream" } });
  const executor = createTraeNativeExecutor({ fetchImpl });
  const events = await collectEvents(await executor({
    request: { model: "DeepSeek-V4-Flash", messages: [{ role: "user", content: "hi" }] },
    credential: { token: "tok", uid: "1", device: { deviceId: "1", machineId: "m" } },
  }));
  const text = events.filter((event) => event.type === "text-delta").map((event) => event.text).join("");
  const reasoning = events.filter((event) => event.type === "reasoning-delta").map((event) => event.text).join("");
  assert.equal(text, "你好");
  assert.equal(reasoning, "想一想");
  assert.equal(events.some((event) => event.type === "block-start" && event.blockType === "reasoning"), true);
  assert.deepEqual(events.at(-1), { type: "finish", reason: { kind: "stop" } });
});

test("the executor surfaces Trae's error event", async () => {
  const fetchImpl = async () => new Response(sseBody([
    'event:error\ndata:{"code":4001,"message":"param is invalid"}\n\n',
  ]), { status: 200, headers: { "content-type": "text/event-stream" } });
  const executor = createTraeNativeExecutor({ fetchImpl });
  await assert.rejects(async () => {
    const stream = await executor({
      request: { model: "glm-5.2", messages: [{ role: "user", content: "hi" }] },
      credential: { token: "tok", uid: "1", device: { deviceId: "1", machineId: "m" } },
    });
    for await (const _event of stream) { /* drain */ }
  }, /param is invalid/u);
});

test("credits are read from Trae CN's usage_summary", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    is_credits_billing: true,
    usage_summary: { consumed_amount: 1.44, total_amount: 2700, consumption_ratio: 0.0005 },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const credits = await readTraeCredits({
    credential: { token: "tok", uid: "1", device: { deviceId: "1", machineId: "m" } },
    fetchImpl,
  });
  assert.equal(credits.used, 1.44);
  assert.equal(credits.limit, 2700);
});

test("getQuota turns credits into a quota snapshot", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    usage_summary: { consumed_amount: 100, total_amount: 2700 },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const driver = createTraeCnDriver({ fetchImpl });
  const secretStore = { read: async () => ({ token: "tok", uid: "1", device: { deviceId: "1", machineId: "m" } }) };
  const quota = await driver.getQuota({ auth: { credentialRef: "x" } }, { secretStore });
  assert.equal(quota.unit, "credits");
  assert.equal(quota.limit, 2700);
  assert.equal(quota.remaining, 2600);
});

test("invoke resolves the credential from the account reference", async () => {
  let seen = null;
  const fetchImpl = async (url, init) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(sseBody([
      'event:output\ndata:{"response":"ok"}\n\n',
    ]), { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const driver = createTraeCnDriver({ fetchImpl });
  const secretStore = { read: async () => ({ token: "tok", uid: "9", device: { deviceId: "1", machineId: "m" } }) };
  const stream = await driver.invoke({
    request: { model: "glm-5.2", messages: [{ role: "user", content: "hi" }] },
    invocation: { auth: { credentialRef: "x" } },
    context: { secretStore },
  });
  const events = await collectEvents(stream);
  assert.equal(events.filter((event) => event.type === "text-delta").map((event) => event.text).join(""), "ok");
  assert.equal(seen.url, "https://trae-api-cn.mchost.guru/api/agent/v3/llm_utils_chat");
  assert.equal(seen.headers["x-uid"], "9");
  assert.equal(seen.body.model, "glm-5.2");
});

test("invoke refuses to run without a credential", async () => {
  const driver = createTraeCnDriver({ fetchImpl: async () => new Response("no") });
  await assert.rejects(
    async () => driver.invoke({ request: {}, invocation: {}, context: { secretStore: { read: async () => null } } }),
    /缺少登录凭据/u,
  );
});

test("startAuthorization hands back a URL and a pending session", async () => {
  const driver = createTraeCnDriver();
  const auth = await driver.startAuthorization({});
  try {
    assert.equal(auth.status, "pending");
    assert.equal(auth.providerId, PROVIDER_ID);
    assert.ok(auth.sessionId);
    assert.match(auth.authorizationUrl, /^https:\/\/www\.trae\.cn\/authorization\?/u);
    const pending = await driver.pollAuthorization(auth.sessionId, {});
    assert.equal(pending.status, "pending");
  } finally {
    await driver.cancelAuthorization(auth.sessionId, {});
  }
});

test("a rejected sign-in is reported, not hidden behind an empty quota", async () => {
  const driver = new TraeCnSubscriptionDriver({
    fetchImpl: async () => new Response("{\"code\":1001}", { status: 401 }),
  });
  const account = {
    accountId: "trae-cn-1",
    auth: { credentialRef: "keychain://dockyard-dsh/deadbeef" },
  };
  const context = { secretStore: { read: async () => ({ token: "stale", device: {} }) } };
  await assert.rejects(() => driver.getQuota(account, context), /重新登录/u);
});

test("the live roster lends real capacity, images and credit rate to the catalog", () => {
  const roster = new Map([
    ["glm-5.3", { id: "glm-5.3", name: "GLM-5.3", contextWindow: 200000, multimodal: false, reasoning: true, creditRate: 0.78 }],
    ["kimi-k3", { id: "kimi-k3", name: "Kimi-K3", contextWindow: 200000, multimodal: true, reasoning: true }],
  ]);
  const merged = mergeTraeCnRoster(TRAE_CN_MODELS, roster);
  const catalog = parseTraeCnCatalog(merged);
  const glm = catalog.models.find((model) => model.id === "glm-5.3");
  assert.equal(glm.contextWindow, 200000);
  assert.equal(glm.name, "GLM-5.3 (x0.78)");
  assert.deepEqual(glm.inputModalities, ["text"]);
  const kimi = catalog.models.find((model) => model.id === "kimi-k3");
  assert.deepEqual(kimi.inputModalities, ["text", "image"]);
  // Ids the roster does not know keep their own tier rather than dropping out.
  const other = catalog.models.find((model) => model.id === "minimax-m3");
  assert.equal(other.contextWindow, 1_000_000);
});

test("a roster that marks a model non-reasoning drops its effort choices", () => {
  const roster = new Map([["kimi-k3", { id: "kimi-k3", name: "Kimi-K3", reasoning: false }]]);
  const catalog = parseTraeCnCatalog(mergeTraeCnRoster(TRAE_CN_MODELS, roster));
  assert.equal(catalog.models.find((model) => model.id === "kimi-k3").reasoning, undefined);
});

test("an over-long conversation and a dead sign-in say what to do", () => {
  const tooLong = traeRequestError(400, JSON.stringify({ code: 4026, message: "your context length has exceeded the maximum limit" }));
  assert.equal(tooLong.code, "CONTEXT_TOO_LONG");
  assert.match(tooLong.message, /上下文超长/u);
  const expired = traeRequestError(401, JSON.stringify({ code: 1001 }));
  assert.equal(expired.code, "AUTH_EXPIRED");
  assert.match(expired.message, /重新登录/u);
  const other = traeRequestError(500, "{}");
  assert.match(other.message, /HTTP 500/u);
});

test("tools travel to Trae CN natively, parameters as a JSON string", () => {
  const body = traeChatBody({
    model: "glm-5.3-flash",
    messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    tools: [{ name: "read_file", description: "读取文件", parameters: { type: "object", properties: { path: { type: "string" } } } }],
  });
  assert.equal(body.tools.length, 1);
  assert.equal(body.tools[0].type, "function");
  assert.equal(body.tools[0].function.name, "read_file");
  // The wire wants the schema as a string, not an object.
  assert.equal(typeof body.tools[0].function.parameters, "string");
  assert.equal(JSON.parse(body.tools[0].function.parameters).properties.path.type, "string");
  assert.equal(body.tool_choice, "auto");
});

test("a tool_choice of none sends no tools at all", () => {
  const body = traeChatBody({
    model: "glm-5.3-flash",
    messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    tools: [{ name: "read_file", parameters: { type: "object" } }],
    toolChoice: "none",
  });
  assert.equal(body.tools, undefined);
});

test("past calls and their results go back as Trae's own turns", () => {
  const messages = traeMessages({
    messages: [
      { role: "user", content: [{ type: "text", text: "读文件" }] },
      { role: "assistant", content: [{ type: "tool-call", id: "call_1", name: "read_file", arguments: "{\"path\":\"/tmp/a\"}" }] },
      { role: "tool", tool_call_id: "call_1", content: [{ type: "text", text: "内容" }] },
    ],
  });
  const assistant = messages.find((message) => message.role === "assistant");
  // `function_call` is Trae's field: a `function` key reads as a nameless call
  // and the whole stream fails with "required field Name is not set".
  assert.deepEqual(assistant.tool_calls[0].function_call, { name: "read_file", arguments: "{\"path\":\"/tmp/a\"}" });
  const tool = messages.find((message) => message.role === "tool");
  assert.equal(tool.tool_call_id, "call_1");
  assert.deepEqual(tool.content, [{ type: "text", text: "内容" }]);
});

test("a streamed tool call becomes a tool-call block, not prose", async () => {
  const events = [
    'event: output\ndata: {"tool_calls":[{"index":0,"id":"call_1","type":"function","function_call":{"name":"read_file","arguments":"{\\"path\\":"}}]}\n\n',
    'event: output\ndata: {"tool_calls":[{"index":0,"function_call":{"arguments":"\\"/tmp/a\\"}"}}]}\n\n',
    'event: done\ndata: {}\n\n',
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of events) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  const execute = createTraeNativeExecutor({ fetchImpl: async () => ({ ok: true, body: stream }) });
  const blocks = [];
  let finish = null;
  for await (const event of await execute({ request: { model: "glm-5.3-flash", messages: [] }, credential: { token: "t", device: {} } })) {
    if (event.type === "block-end" && event.block?.type === "tool-call") blocks.push(event.block);
    if (event.type === "finish") finish = event.reason;
  }
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, "read_file");
  assert.equal(blocks[0].arguments, '{"path":"/tmp/a"}');
  assert.equal(finish.kind, "tool-calls");
});

test("the daily 100 credits are claimed without the IDE", async () => {
  const calls = [];
  const respond = (body) => async (url) => {
    calls.push(url);
    return { ok: true, json: async () => body };
  };
  // Still unclaimed today: status says so, and the claim is made once.
  const first = await claimTraeDailyCredits({
    credential: { token: "t", device: {} },
    fetchImpl: respond({ code: 0, enable: true, checked_in: false, credits: 100, extra_credits: 20 }),
  });
  assert.equal(first.claimed, true);
  assert.equal(first.credits, 120);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /checkin_credits\/claim/u);

  // Already claimed: no second claim goes out.
  calls.length = 0;
  const second = await claimTraeDailyCredits({
    credential: { token: "t", device: {} },
    fetchImpl: respond({ code: 0, enable: true, checked_in: true, credits: 100 }),
  });
  assert.equal(second.claimed, false);
  assert.equal(calls.length, 1);

  // The programme turned off: nothing is claimed either.
  calls.length = 0;
  const third = await claimTraeDailyCredits({
    credential: { token: "t", device: {} },
    fetchImpl: respond({ code: 0, enable: false, checked_in: false }),
  });
  assert.equal(third.claimed, false);
  assert.equal(calls.length, 1);
});
