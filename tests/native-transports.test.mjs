import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import {
  buildAntigravityRequest,
  createAntigravityNativeExecutor,
  createAntigravityProjectResolver,
} from "../modules/provider-antigravity/src/index.mjs";
import { createClaudeNativeExecutor } from "../modules/provider-claude/src/index.mjs";
import { createGrokNativeExecutor } from "../modules/provider-grok/src/index.mjs";
import { createCursorNativeExecutor } from "../modules/provider-cursor/src/index.mjs";
import { bytesField, encodeAgentRunRequest, frameConnectMessage, stringField } from "../modules/provider-cursor/src/native-protocol.mjs";
import {
  fetchNativeResponse,
  nativeProviderError,
  readSseEvents,
  validateNativeEndpoint,
} from "../packages/providers/src/native-transport.mjs";
import { runCliCommand } from "../packages/providers/src/cli-agent-transport.mjs";

function responseFor(events) {
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return {
    ok: true,
    status: 200,
    body: (async function* stream() {
      yield new TextEncoder().encode(payload);
    })(),
  };
}

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

test("native transports reject plaintext remote endpoints before attaching credentials", () => {
  assert.equal(validateNativeEndpoint("http://127.0.0.1:3000", { providerId: "test" }), "http://127.0.0.1:3000/");
  assert.throws(
    () => validateNativeEndpoint("http://provider.test/v1", { providerId: "test" }),
    /must use HTTPS/,
  );
  assert.throws(
    () => validateNativeEndpoint("https://user:pass@provider.test/v1", { providerId: "test" }),
    /embedded credentials/,
  );
  assert.throws(
    () => createGrokNativeExecutor({ endpoint: "http://provider.test/v1/chat/completions" }),
    /must use HTTPS/,
  );
});

test("native SSE timeout remains active while the response body is stalled", async () => {
  let signal;
  const response = await fetchNativeResponse("https://provider.test/stream", {
    method: "GET",
  }, {
    providerId: "test-provider",
    timeoutMs: 15,
    fetchImpl: async (_url, init) => {
      signal = init.signal;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              read() {
                return new Promise((_, reject) => {
                  signal.addEventListener("abort", () => {
                    const error = new Error("aborted");
                    error.name = "AbortError";
                    reject(error);
                  }, { once: true });
                });
              },
              releaseLock() {},
            };
          },
        },
      };
    },
  });
  await assert.rejects(
    (async () => {
      for await (const _event of readSseEvents(response)) {
        // The stalled body should be aborted by the native deadline.
      }
    })(),
    (error) => error.code === "ETIMEDOUT",
  );
});

test("native auth classification distinguishes token budgets from invalid credentials", () => {
  const budget = nativeProviderError("test", "Invalid token count in image tile");
  const invalidKey = nativeProviderError("test", "API key not valid. Please pass a valid API key.");
  assert.equal(budget.authExpired, false);
  assert.equal(invalidKey.authExpired, true);
});

test("Claude native transport posts Anthropic Messages and streams the first text delta", async () => {
  let call;
  const executor = createClaudeNativeExecutor({
    endpoint: "https://anthropic.test/v1/messages",
    tokenResolver: async () => ({ token: "oauth-token", kind: "oauth" }),
    fetchImpl: async (url, init) => {
      call = { url, init };
      return responseFor([
        { type: "message_start", message: { usage: { input_tokens: 2 } } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "hello" } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } },
      ]);
    },
  });
  const chunks = await collect(await executor({
    request: { model: "claude-sonnet", system: "Be concise.", messages: [{ role: "user", content: "Hi" }] },
  }));
  const body = JSON.parse(call.init.body);
  assert.equal(call.url, "https://anthropic.test/v1/messages");
  assert.equal(call.init.headers.authorization, "Bearer oauth-token");
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages, [{ role: "user", content: "Hi" }]);
  assert.deepEqual(chunks.filter((chunk) => chunk.type === "text-delta"), [{ type: "text-delta", index: 0, text: "hello" }]);
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage")?.usage, { inputTokens: 2, outputTokens: 3 });
});

test("native transports frame reasoning blocks with matching start and end events", async () => {
  const claude = createClaudeNativeExecutor({
    endpoint: "https://anthropic.test/v1/messages",
    tokenResolver: async () => ({ token: "oauth-token", kind: "oauth" }),
    fetchImpl: async () => responseFor([
      { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "think" } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "text" } },
      { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "answer" } },
    ]),
  });
  const claudeChunks = await collect(await claude({ request: { model: "claude", messages: [{ role: "user", content: "hi" }] } }));
  const claudeReasoning = claudeChunks.filter((chunk) => chunk.index === 1 && ["block-start", "reasoning-delta", "block-end"].includes(chunk.type));
  assert.deepEqual(claudeReasoning.map((chunk) => chunk.type), ["block-start", "reasoning-delta", "block-end"]);

  const grok = createGrokNativeExecutor({
    endpoint: "https://grok.test/v1/chat/completions",
    fetchImpl: async () => responseFor([
      { choices: [{ delta: { reasoning_content: "think" } }] },
      { choices: [{ delta: { content: "answer" }, finish_reason: "stop" }] },
       { usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 } },
    ]),
  });
  const grokChunks = await collect(await grok({ request: { model: "grok", messages: [{ role: "user", content: "hi" }] }, credential: { access: "token" } }));
  const grokReasoning = grokChunks.filter((chunk) => chunk.index === 1 && ["block-start", "reasoning-delta", "block-end"].includes(chunk.type));
  assert.deepEqual(grokReasoning.map((chunk) => chunk.type), ["block-start", "reasoning-delta", "block-end"]);
  assert.deepEqual(grokChunks.find((chunk) => chunk.type === "usage")?.usage, { inputTokens: 4, outputTokens: 5, totalTokens: 9 });

  const antigravity = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    tokenResolver: () => ({ token: "token" }),
    // A resolved Code Assist project is required: the transport never
    // fabricates a default project upstream.
    project: "fixture-project",
    fetchImpl: async () => responseFor([
      { candidates: [{ content: { parts: [{ text: "think", thought: true }] } }] },
      { candidates: [{ content: { parts: [{ text: "answer" }] }, finishReason: "STOP" }] },
       { usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, totalTokenCount: 17, cachedContentTokenCount: 3 } },
    ]),
  });
  const antigravityChunks = await collect(await antigravity({ request: { model: "gemini", messages: [{ role: "user", content: "hi" }] } }));
  const antigravityReasoning = antigravityChunks.filter((chunk) => chunk.index === 1 && ["block-start", "reasoning-delta", "block-end"].includes(chunk.type));
  assert.deepEqual(antigravityReasoning.map((chunk) => chunk.type), ["block-start", "reasoning-delta", "block-end"]);
});

test("Antigravity native transport uses streamGenerateContent SSE", async () => {
  let call;
  const executor = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    tokenResolver: () => ({ token: "google-token", kind: "oauth" }),
    project: "fixture-project",
    fetchImpl: async (url, init) => {
      call = { url, init };
      return responseFor([
        { candidates: [{ content: { parts: [{ text: "fast" }] } }] },
        { usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, totalTokenCount: 17, cachedContentTokenCount: 3 } },
      ]);
    },
  });
  const chunks = await collect(await executor({
    request: { model: "gemini-3.7-flash-medium", reasoningEffort: "medium", messages: [{ role: "user", content: "Hi" }] },
  }));
  const body = JSON.parse(call.init.body);
  assert.match(call.url, /streamGenerateContent\?alt=sse$/);
  assert.equal(call.init.headers.authorization, "Bearer google-token");
  assert.equal(call.init.headers.accept, undefined);
  assert.equal(body.project, "fixture-project");
  assert.equal(body.model, "gemini-3.7-flash-medium");
  assert.deepEqual(body.request.contents[0], { role: "user", parts: [{ text: "Hi" }] });
  assert.deepEqual(body.request.generationConfig, {
    temperature: 0.7,
    maxOutputTokens: 65536,
    thinkingConfig: { includeThoughts: true, thinkingBudget: 8192 },
  });
  assert.equal(chunks.find((chunk) => chunk.type === "text-delta")?.text, "fast");
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage")?.usage, {
    inputTokens: 12,
    outputTokens: 5,
    totalTokens: 17,
    cacheReadTokens: 3,
  });
});

test("Antigravity buildAntigravityRequest sets thinkingConfig based on reasoningEffort and model", async () => {
  const reqDefault = await buildAntigravityRequest({ model: "gemini-3.8-flash", messages: [{ role: "user", content: "Hi" }] });
  assert.deepEqual(reqDefault.generationConfig.thinkingConfig, { includeThoughts: true });

  const reqLow = await buildAntigravityRequest({ model: "gemini-3.8-flash", reasoningEffort: "low", messages: [{ role: "user", content: "Hi" }] });
  assert.deepEqual(reqLow.generationConfig.thinkingConfig, { includeThoughts: true, thinkingBudget: 1024 });

  const reqMedium = await buildAntigravityRequest({ model: "gemini-3.8-flash", reasoningEffort: "medium", messages: [{ role: "user", content: "Hi" }] });
  assert.deepEqual(reqMedium.generationConfig.thinkingConfig, { includeThoughts: true, thinkingBudget: 8192 });

  const reqHigh = await buildAntigravityRequest({ model: "gemini-3.8-flash", reasoningEffort: "high", messages: [{ role: "user", content: "Hi" }] });
  assert.deepEqual(reqHigh.generationConfig.thinkingConfig, { includeThoughts: true, thinkingBudget: -1 });

  const reqNone = await buildAntigravityRequest({ model: "gemini-3.8-flash", reasoningEffort: "none", messages: [{ role: "user", content: "Hi" }] });
  assert.deepEqual(reqNone.generationConfig.thinkingConfig, { includeThoughts: false, thinkingBudget: 0 });

  const reqModelSuffix = await buildAntigravityRequest({ model: "gemini-3.8-flash-high", messages: [{ role: "user", content: "Hi" }] });
  assert.deepEqual(reqModelSuffix.generationConfig.thinkingConfig, { includeThoughts: true, thinkingBudget: -1 });
});

test("Antigravity Gemini 3 history flattens unsigned tool calls instead of sending functionCall", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-3-flash",
    messages: [
      { role: "user", content: "check status" },
      {
        role: "assistant",
        content: [
          { type: "tool-call", id: "call-unsigned-1", name: "read_lints", arguments: { paths: ["app.js"] } },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "call-unsigned-1", name: "read_lints", content: "[]" },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "user", parts: [{ text: "check status" }] },
    { role: "model", parts: [{ text: '[tool call: read_lints] {"paths":["app.js"]}' }] },
    { role: "user", parts: [{ text: "[tool result: read_lints] []" }] },
  ]);
});

test("Antigravity Gemini 3 history flattens camelCase toolCall parts without signatures", async () => {
  const native = await buildAntigravityRequest({
    model: "Gemini 3.8 Flash (Medium)",
    messages: [
      { role: "user", content: "check status" },
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "call-unsigned-2", name: "read", arguments: { path: "native-transport.mjs" } },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "toolResult", toolCallId: "call-unsigned-2", name: "read", content: "ok" },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "user", parts: [{ text: "check status" }] },
    { role: "model", parts: [{ text: '[tool call: read] {"path":"native-transport.mjs"}' }] },
    { role: "user", parts: [{ text: "[tool result: read] ok" }] },
  ]);
});

test("Antigravity Gemini 3 history sanitizes native unsigned functionCall parts", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-3.8-flash",
    messages: [
      { role: "user", content: "check status" },
      {
        role: "assistant",
        parts: [
          { functionCall: { name: "default_api:read", args: { path: "native-transport.mjs" } } },
        ],
      },
      {
        role: "user",
        parts: [
          { functionResponse: { name: "default_api:read", response: { content: "ok" } } },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "user", parts: [{ text: "check status" }] },
    { role: "model", parts: [{ text: '[tool call: default_api:read] {"path":"native-transport.mjs"}' }] },
    { role: "user", parts: [{ text: "[tool result: default_api:read] ok" }] },
  ]);
});

test("Antigravity Gemini 3 history echoes thought signatures on functionCall parts", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-3-flash",
    messages: [
      { role: "user", content: "check status" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            id: "call-signed-1",
            name: "read_lints",
            arguments: { paths: ["app.js"] },
            thoughtSignature: "sig-abc",
          },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "call-signed-1", name: "read_lints", content: "[]" },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "user", parts: [{ text: "check status" }] },
    {
      role: "model",
      parts: [{
        functionCall: {
          name: "read_lints",
          args: { paths: ["app.js"] },
        },
        thoughtSignature: "sig-abc",
        thought_signature: "sig-abc",
      }],
    },
    {
      role: "user",
      parts: [{ functionResponse: { name: "read_lints", response: { name: "read_lints", content: "[]" } } }],
    },
  ]);
});

test("Antigravity Gemini 3 history strips thought signatures from inside functionCall", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-3.8-flash",
    messages: [
      { role: "user", content: "check status" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            id: "call-nested-1",
            name: "read_lints",
            arguments: { paths: ["app.js"] },
            functionCall: {
              name: "read_lints",
              args: { paths: ["app.js"] },
              thoughtSignature: "sig-nested",
              thought_signature: "sig-nested",
            },
          },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "call-nested-1", name: "read_lints", content: "[]" },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "user", parts: [{ text: "check status" }] },
    {
      role: "model",
      parts: [{
        functionCall: {
          name: "read_lints",
          args: { paths: ["app.js"] },
        },
        thoughtSignature: "sig-nested",
        thought_signature: "sig-nested",
      }],
    },
    {
      role: "user",
      parts: [{ functionResponse: { name: "read_lints", response: { name: "read_lints", content: "[]" } } }],
    },
  ]);
});

test("Antigravity non-Gemini-3 history keeps unsigned functionCall parts", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "assistant",
        content: [
          { type: "tool-call", id: "call-legacy-1", name: "read_lints", arguments: { paths: ["app.js"] } },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "model", parts: [{ functionCall: { name: "read_lints", args: { paths: ["app.js"] } } }] },
  ]);
});

test("Antigravity Gemini 3 history supports mixed assistant content and tool_calls preserving signatures", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-3.7-flash",
    messages: [
      { role: "user", content: "run command" },
      {
        role: "assistant",
        content: "Checking git status",
        tool_calls: [
          {
            id: "call-bash-1",
            function: { name: "default_api:bash", arguments: '{"command":"git status"}' },
            thought_signature: "sig-bash-1",
          },
        ],
      },
    ],
  });
  assert.deepEqual(native.contents, [
    { role: "user", parts: [{ text: "run command" }] },
    {
      role: "model",
      parts: [
        { text: "Checking git status" },
        {
          functionCall: {
            name: "default_api:bash",
            args: { command: "git status" },
          },
          thoughtSignature: "sig-bash-1",
          thought_signature: "sig-bash-1",
        },
      ],
    },
  ]);
});

test("Antigravity sliding window auto-compacts long history beyond safe threshold", async () => {
  const longMessages = [
    { role: "user", content: "initial goal: build app" },
  ];
  for (let i = 1; i <= 60; i++) {
    longMessages.push({ role: i % 2 === 1 ? "assistant" : "user", content: `turn message ${i}` });
  }
  const native = await buildAntigravityRequest({
    model: "gemini-3.7-flash",
    messages: longMessages,
  });
  assert.ok(native.contents.length <= 42);
  assert.equal(native.contents[0].parts[0].text, "initial goal: build app");
  assert.match(native.contents[1].parts[0].text, /sliding window active/);
  assert.equal(native.contents.at(-1).parts[0].text, "turn message 60");
});

test("Antigravity sliding window preserves static prefix and milestone across turns for prompt caching", async () => {
  const baseMessages = [{ role: "user", content: "initial goal: build app" }];
  for (let i = 1; i <= 50; i++) {
    baseMessages.push({ role: i % 2 === 1 ? "assistant" : "user", content: `turn message ${i}` });
  }
  const turn50 = await buildAntigravityRequest({
    model: "gemini-3.8-flash",
    messages: baseMessages,
  });
  const turn51 = await buildAntigravityRequest({
    model: "gemini-3.8-flash",
    messages: [...baseMessages, { role: "assistant", content: "turn message 51" }],
  });
  // Milestone text MUST be identical across consecutive turns to preserve prefix caching
  assert.equal(turn50.contents[1].parts[0].text, turn51.contents[1].parts[0].text);
  // Cut start index must be frozen across quantum turns
  assert.equal(turn50.contents[2].parts[0].text, turn51.contents[2].parts[0].text);
});

test("Antigravity Gemini 3 surgical sanitization preserves signed call prefix when an unsigned call appears", async () => {
  const native = await buildAntigravityRequest({
    model: "gemini-3.8-flash",
    messages: [
      { role: "user", content: "first step" },
      {
        role: "assistant",
        content: [
          { type: "tool-call", id: "call-signed", name: "read_file", arguments: { path: "a.js" }, thought_signature: "sig-valid" },
        ],
      },
      {
        role: "tool",
        content: [{ type: "tool-result", toolCallId: "call-signed", name: "read_file", content: "ok" }],
      },
      { role: "user", content: "second step" },
      {
        role: "assistant",
        parts: [
          { functionCall: { name: "unsigned_tool", args: {} } },
        ],
      },
      {
        role: "user",
        parts: [
          { functionResponse: { name: "unsigned_tool", response: { content: "res" } } },
        ],
      },
    ],
  });
  // The first signed tool call MUST remain a native functionCall with thoughtSignature intact
  assert.equal(native.contents[1].parts[0].thoughtSignature, "sig-valid");
  assert.equal(native.contents[1].parts[0].functionCall.name, "read_file");
  assert.equal(native.contents[2].parts[0].functionResponse.name, "read_file");
  // Only the second unsigned tool call is converted to text
  assert.match(native.contents[4].parts[0].text, /\[tool call: unsigned_tool\]/);
  assert.match(native.contents[5].parts[0].text, /\[tool result: unsigned_tool\]/);
});

test("Antigravity native transport attaches thought signatures to streamed tool calls", async () => {
  const executor = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    tokenResolver: () => ({ token: "google-token", kind: "oauth" }),
    project: "fixture-project",
    fetchImpl: async () => responseFor([
      {
        candidates: [{
          content: {
            parts: [{
              functionCall: { name: "read_lints", args: { paths: ["app.js"] } },
              thoughtSignature: "sig-stream",
            }],
            finishReason: "STOP",
          },
        }],
      },
    ]),
  });
  const chunks = await collect(await executor({
    request: { model: "gemini-3-flash", messages: [{ role: "user", content: "lint" }] },
  }));
  const toolEnd = chunks.find((chunk) => chunk.type === "block-end" && chunk.block?.type === "tool-call");
  assert.equal(toolEnd.block.name, "read_lints");
  assert.equal(toolEnd.block.thoughtSignature, "sig-stream");
});

test("Antigravity native transport upgrades text tool calls into executable tool-call blocks", async () => {
  const executor = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    tokenResolver: () => ({ token: "google-token", kind: "oauth" }),
    project: "fixture-project",
    fetchImpl: async () => responseFor([
      {
        candidates: [{
          content: {
            parts: [{
              text: '[tool call: bash] {"command":"git status --short","description":"check git"}',
            }],
            finishReason: "STOP",
          },
        }],
      },
    ]),
  });
  const chunks = await collect(await executor({
    request: { model: "Gemini 3.8 Flash (Medium)", messages: [{ role: "user", content: "status" }] },
  }));
  const toolEnd = chunks.find((chunk) => chunk.type === "block-end" && chunk.block?.type === "tool-call");
  assert.ok(toolEnd, "Must emit tool-call block");
  assert.equal(toolEnd.block.name, "bash");
  const parsedArgs = JSON.parse(toolEnd.block.arguments);
  assert.equal(parsedArgs.command, "git status --short");
  const finish = chunks.find((chunk) => chunk.type === "finish");
  assert.deepEqual(finish.reason, { kind: "tool-calls" });
});

test("Antigravity native transport decodes and streams inlineData images", async () => {
  const fakePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const executor = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    tokenResolver: () => ({ token: "google-token", kind: "oauth" }),
    project: "fixture-project",
    fetchImpl: async () => responseFor([
      { candidates: [{ content: { parts: [{ text: "Here is your image:" }, { inlineData: { mimeType: "image/png", data: fakePngBase64 } }] } }] },
      { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } },
    ]),
  });
  const chunks = await collect(await executor({
    request: { model: "gemini-3.7-flash-medium", messages: [{ role: "user", content: "Draw a cat" }] },
  }));
  const textDeltas = chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text);
  assert.ok(textDeltas.some((t) => t.includes("Here is your image:")));
  assert.ok(textDeltas.some((t) => t.includes("![Generated Image](") || t.includes("artifacts/")));
});

test("Antigravity native transport resolves a Code Assist project per selected account", async () => {
  const calls = [];
  const projectResolver = createAntigravityProjectResolver({
    endpoint: "https://gemini.test/v1internal:loadCodeAssist",
    tokenResolver: () => ({ token: "google-token" }),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return { cloudaicompanionProject: "account-project" };
        },
      };
    },
  });
  const executor = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    project: null,
    projectResolver,
    tokenResolver: () => ({ token: "google-token" }),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responseFor([{ candidates: [{ content: { parts: [{ text: "account" }] } }] }]);
    },
  });
  await collect(await executor({
    invocation: {
      account: { accountId: "account-a", auth: { credentialRef: "keychain://account-a" } },
    },
    request: { model: "gemini-3.7-flash", messages: [{ role: "user", content: "Hi" }] },
  }));
  const projectCall = calls.find((call) => call.url.includes("loadCodeAssist"));
  const streamCall = calls.find((call) => call.url.includes("streamGenerateContent"));
  // The enquiry carries the Antigravity identity, as the official client sends it.
  assert.deepEqual(JSON.parse(projectCall.init.body), { metadata: { ideType: "ANTIGRAVITY" } });
  assert.equal(projectCall.init.headers.authorization, "Bearer google-token");
  assert.equal(JSON.parse(streamCall.init.body).project, "account-project");
});

test("native HTTP errors keep the upstream rate-limit signal without leaking raw JSON", async () => {
  const executor = createAntigravityNativeExecutor({
    endpoint: "https://gemini.test/v1internal:streamGenerateContent?alt=sse",
    tokenResolver: () => ({ token: "google-token", kind: "oauth" }),
    project: "fixture-project",
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({
        error: {
          code: 429,
          message: "Resource has been exhausted (e.g. check quota)",
          status: "RESOURCE_EXHAUSTED",
        },
      }),
    }),
  });

  await assert.rejects(
    () => executor({ request: { model: "gemini-3.7-flash-medium", messages: [{ role: "user", content: "Hi" }] } }),
    (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.code, 429);
      assert.equal(error.upstreamCode, 429);
      assert.equal(error.upstreamStatus, "RESOURCE_EXHAUSTED");
      assert.equal(error.quotaExhausted, true);
      assert.equal(error.rateLimited, true);
      assert.match(error.message, /额度或上游资源已耗尽/);
      assert.equal(error.upstreamMessage, "Resource has been exhausted (e.g. check quota)");
      assert.doesNotMatch(error.message, /\"error\"/);
      return true;
    },
  );
});

test("native HTTP error bodies are bounded before being attached to errors", async () => {
  await assert.rejects(
    () => fetchNativeResponse("https://provider.test/error", {}, {
      providerId: "test-provider",
      fetchImpl: async () => ({ ok: false, status: 500, text: async () => "x".repeat(200_000) }),
    }),
    (error) => {
      assert.ok(typeof error.body === "string");
      assert.ok(error.body.length <= 65_536);
      return true;
    },
  );
});

test("Grok native transport uses xAI chat completions SSE and forwards OAuth directly", async () => {
  let call;
  const executor = createGrokNativeExecutor({
    endpoint: "https://xai.test/v1/chat/completions",
    fetchImpl: async (url, init) => {
      call = { url, init };
      return responseFor([{ choices: [{ delta: { content: "xAI" } }] }, { choices: [{ finish_reason: "stop", delta: {} }], usage: { prompt_tokens: 4, completion_tokens: 5 } }]);
    },
  });
  const chunks = await collect(await executor({
    credential: { access: "grok-oauth" },
    request: { model: "grok-4.5", messages: [{ role: "user", content: "Hi" }] },
  }));
  const body = JSON.parse(call.init.body);
  assert.equal(call.url, "https://xai.test/v1/chat/completions");
  assert.equal(call.init.headers.authorization, "Bearer grok-oauth");
  assert.equal(body.messages[0].content, "Hi");
  assert.equal(chunks.find((chunk) => chunk.type === "text-delta")?.text, "xAI");
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage")?.usage, { inputTokens: 4, outputTokens: 5 });
});

test("Grok token-validation errors mark the OAuth account unusable", async () => {
  const executor = createGrokNativeExecutor({
    endpoint: "https://xai.test/v1/chat/completions",
    fetchImpl: async () => responseFor([{
      error: {
        code: "unauthorized",
        message: "access token could not be validated",
      },
    }]),
  });
  await assert.rejects(
    collect(await executor({
      credential: { access: "stale-grok-oauth" },
      request: { model: "grok-4.6", messages: [{ role: "user", content: "Hi" }] },
    })),
    (error) => {
      assert.equal(error.authExpired, true);
      assert.equal(error.authForbidden, false);
      assert.match(error.message, /access token could not be validated/);
      return true;
    },
  );
});

test("Cursor protocol preserves inline image data instead of a placeholder", () => {
  const encoded = encodeAgentRunRequest({
    model: "cursor-test",
    messages: [{ role: "user", content: [{ type: "image", mimeType: "image/png", data: "AQID" }] }],
  });
  const bytes = Buffer.from(encoded.frame).toString("utf8");
  assert.match(bytes, /AQID/);
  assert.doesNotMatch(bytes, /\[image attachment\]/);
});

test("Cursor native transport opens AgentService over HTTP/2 Connect frames", async () => {
  let written;
  const fakeHttp2 = {
    constants: { NGHTTP2_CANCEL: 8 },
    connect() {
      const session = new EventEmitter();
      session.closed = false;
      session.destroyed = false;
      session.close = () => { session.closed = true; };
      session.request = () => {
        const stream = new EventEmitter();
        stream.destroyed = false;
        stream.closed = false;
        stream.write = (value) => {
          written ??= Buffer.from(value);
          if (!written || written.length !== value.length) return;
          setImmediate(() => {
            stream.emit("response", { ":status": 200 });
            const interactionUpdate = bytesField(1, stringField(1, "cursor"));
            stream.emit("data", Buffer.from(frameConnectMessage(bytesField(1, interactionUpdate))));
             stream.emit("data", Buffer.from(frameConnectMessage(new Uint8Array(), 0x02)));
            stream.emit("end");
          });
        };
        stream.close = () => { stream.closed = true; };
        return stream;
      };
      return session;
    },
  };
  const executor = createCursorNativeExecutor({
    tokenResolver: () => ({ token: "cursor-oauth", kind: "oauth" }),
    http2Module: fakeHttp2,
  });
  const chunks = await collect(await executor({
    request: { model: "grok-4.5", requestId: "request-1", messages: [{ role: "user", content: "Hi" }] },
  }));
  assert.ok(written);
  assert.equal(chunks.find((chunk) => chunk.type === "text-delta")?.text, "cursor");
  assert.equal(chunks.at(-1).type, "finish");
});

test("Cursor native transport enforces a total timeout while the upstream is silent", async () => {
  const fakeHttp2 = {
    constants: { NGHTTP2_CANCEL: 8 },
    connect() {
      const session = new EventEmitter();
      session.closed = false;
      session.destroyed = false;
      session.close = () => { session.closed = true; };
      session.request = () => {
        const stream = new EventEmitter();
        stream.destroyed = false;
        stream.closed = false;
        stream.write = () => {};
        stream.close = () => { stream.closed = true; };
        return stream;
      };
      return session;
    },
  };
  const executor = createCursorNativeExecutor({
    tokenResolver: () => ({ token: "cursor-oauth", kind: "oauth" }),
    http2Module: fakeHttp2,
    timeoutMs: 10,
    idleTimeoutMs: 100,
  });
  await assert.rejects(
    collect(await executor({ request: { model: "composer-2.5", messages: [{ role: "user", content: "Hi" }] } })),
    (error) => error.code === "ETIMEDOUT",
  );
});

test("Cursor native transport preserves text across split Connect frames", async () => {
  const textFrame = frameConnectMessage(bytesField(1, bytesField(1, stringField(1, "split"))));
  const completeFrame = frameConnectMessage(new Uint8Array(), 0x02);
  const bytes = Buffer.concat([Buffer.from(textFrame), Buffer.from(completeFrame)]);
  const fakeHttp2 = {
    constants: { NGHTTP2_CANCEL: 8 },
    connect() {
      const session = new EventEmitter();
      session.closed = false;
      session.destroyed = false;
      session.close = () => { session.closed = true; };
      session.request = () => {
        const stream = new EventEmitter();
        stream.destroyed = false;
        stream.closed = false;
        stream.write = () => {
          setImmediate(() => {
            stream.emit("response", { ":status": 200 });
            for (let index = 0; index < bytes.length; index += 1) {
              stream.emit("data", bytes.subarray(index, index + 1));
            }
            stream.emit("end");
          });
        };
        stream.close = () => { stream.closed = true; };
        return stream;
      };
      return session;
    },
  };
  const executor = createCursorNativeExecutor({
    tokenResolver: () => ({ token: "cursor-oauth", kind: "oauth" }),
    http2Module: fakeHttp2,
  });
  const chunks = await collect(await executor({
    request: { model: "composer-2.5", requestId: "request-split", messages: [{ role: "user", content: "Hi" }] },
  }));
  assert.equal(chunks.find((chunk) => chunk.type === "text-delta")?.text, "split");
  assert.equal(chunks.at(-1).type, "finish");
});

test("Cursor native transport rejects a truncated Connect frame", async () => {
  const frame = frameConnectMessage(bytesField(1, bytesField(1, stringField(1, "truncated"))));
  const truncated = frame.slice(0, frame.length - 1);
  const fakeHttp2 = {
    constants: { NGHTTP2_CANCEL: 8 },
    connect() {
      const session = new EventEmitter();
      session.closed = false;
      session.destroyed = false;
      session.close = () => { session.closed = true; };
      session.request = () => {
        const stream = new EventEmitter();
        stream.destroyed = false;
        stream.closed = false;
        stream.write = () => {
          setImmediate(() => {
            stream.emit("response", { ":status": 200 });
            stream.emit("data", Buffer.from(truncated));
            stream.emit("end");
          });
        };
        stream.close = () => { stream.closed = true; };
        return stream;
      };
      return session;
    },
  };
  const executor = createCursorNativeExecutor({
    tokenResolver: () => ({ token: "cursor-oauth", kind: "oauth" }),
    http2Module: fakeHttp2,
  });
  await assert.rejects(
    collect(await executor({
      request: { model: "composer-2.5", requestId: "request-truncated", messages: [{ role: "user", content: "Hi" }] },
    })),
    (error) => {
      assert.equal(error.code, "CURSOR_INCOMPLETE_RESPONSE");
      assert.equal(error.cursorDiagnostics.at(-1).incomplete, true);
      return true;
    },
  );
});

test("Cursor native transport rejects a completed turn with no assistant text", async () => {
  const fakeHttp2 = {
    constants: { NGHTTP2_CANCEL: 8 },
    connect() {
      const session = new EventEmitter();
      session.closed = false;
      session.destroyed = false;
      session.close = () => { session.closed = true; };
      session.request = () => {
        const stream = new EventEmitter();
        stream.destroyed = false;
        stream.closed = false;
        stream.write = () => {
          setImmediate(() => {
            stream.emit("response", { ":status": 200 });
            stream.emit("data", Buffer.from(frameConnectMessage(bytesField(2, stringField(1, "ignored")))));
            stream.emit("data", Buffer.from(frameConnectMessage(new Uint8Array(), 0x02)));
            stream.emit("end");
          });
        };
        stream.close = () => { stream.closed = true; };
        return stream;
      };
      return session;
    },
  };
  const executor = createCursorNativeExecutor({
    tokenResolver: () => ({ token: "cursor-oauth", kind: "oauth" }),
    http2Module: fakeHttp2,
  });
  await assert.rejects(
    collect(await executor({
      request: { model: "composer-2.5", requestId: "request-empty", messages: [{ role: "user", content: "Hi" }] },
    })),
    (error) => {
      assert.equal(error.code, "CURSOR_EMPTY_RESPONSE");
      assert.match(error.message, /completed without assistant text/);
      assert.deepEqual(error.cursorDiagnostics[0].fieldPaths.map((field) => field.path), ["2", "2.1"]);
      assert.equal(error.cursorDiagnostics[0].flags, 0);
      return true;
    },
  );
});

function sseChunks(...payloads) {
  const encoder = new TextEncoder();
  return payloads.map((payload) => encoder.encode(payload));
}

function asyncIteratorBody(chunks, { state } = {}) {
  let index = 0;
  const body = {
    // No `return()` on the iterator: only an explicit body.cancel() may stop
    // the underlying download when the consumer walks away.
    [Symbol.asyncIterator]() {
      return {
        next: async () => (index < chunks.length
          ? { value: chunks[index++], done: false }
          : { done: true }),
      };
    },
    cancel: async () => {
      state.cancelled += 1;
    },
  };
  return body;
}

function readerBody(chunks, { state }) {
  const body = {
    getReader() {
      let index = 0;
      return {
        read: async () => (index < chunks.length
          ? { value: chunks[index++], done: false }
          : { done: true }),
        cancel: async () => {
          state.cancelled += 1;
        },
        releaseLock: () => {
          state.released += 1;
        },
      };
    },
  };
  return body;
}

test("readSseEvents cancels the underlying body when the consumer stops early", async () => {
  const state = { cancelled: 0 };
  const response = {
    ok: true,
    status: 200,
    body: asyncIteratorBody(sseChunks('data: {"i":0}\n\n', 'data: {"i":1}\n\n', 'data: {"i":2}\n\n'), { state }),
  };
  const seen = [];
  for await (const event of readSseEvents(response)) {
    seen.push(event.data.i);
    if (seen.length === 1) break;
  }
  assert.deepEqual(seen, [0]);
  assert.equal(state.cancelled, 1);
});

test("readSseEvents cancels a reader-based body after DONE and on early exit", async () => {
  const doneState = { cancelled: 0, released: 0 };
  const doneResponse = {
    ok: true,
    status: 200,
    body: readerBody(sseChunks('data: {"i":0}\n\n', "data: [DONE]\n\n"), { state: doneState }),
  };
  const doneSeen = [];
  for await (const event of readSseEvents(doneResponse)) {
    doneSeen.push(event.data?.i ?? null);
  }
  assert.deepEqual(doneSeen, [0, null]);
  assert.equal(doneState.cancelled, 1);

  const breakState = { cancelled: 0, released: 0 };
  const breakResponse = {
    ok: true,
    status: 200,
    body: readerBody(sseChunks('data: {"i":0}\n\n', 'data: {"i":1}\n\n', 'data: {"i":2}\n\n'), { state: breakState }),
  };
  const breakSeen = [];
  for await (const event of readSseEvents(breakResponse)) {
    breakSeen.push(event.data.i);
    if (breakSeen.length === 1) break;
  }
  assert.deepEqual(breakSeen, [0]);
  assert.ok(breakState.cancelled >= 1, "reader.cancel must interrupt the body");
  assert.ok(breakState.released >= 1, "reader lock must still be released");
});

test("corrupted SSE JSON data raises a protocol error instead of passing through", async () => {
  const response = {
    ok: true,
    status: 200,
    body: asyncIteratorBody([new TextEncoder().encode('data: {"broken-json\n\ndata: {"i":1}\n\n')]),
  };
  await assert.rejects(
    collect(readSseEvents(response)),
    (error) => {
      assert.equal(error.code, "SSE_PROTOCOL_ERROR");
      assert.match(error.message, /not valid JSON/);
      assert.match(error.message, /broken-json/);
      return true;
    },
  );
});

test("a large network chunk holding many small SSE events is not misjudged as oversized", async () => {
  const lines = [];
  let total = 0;
  let index = 0;
  while (total <= 4 * 1024 * 1024) {
    const line = `data: {"i":${index}}\n\n`;
    lines.push(line);
    total += line.length;
    index += 1;
  }
  assert.ok(total > 4 * 1024 * 1024);
  const response = {
    ok: true,
    status: 200,
    body: asyncIteratorBody([new TextEncoder().encode(lines.join(""))]),
  };
  const seen = [];
  for await (const event of readSseEvents(response)) {
    seen.push(event.data.i);
    if (seen.length === 5) break;
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
});

test("SSE size budget still rejects one genuinely oversized buffered event", async () => {
  const blob = "x".repeat(4 * 1024 * 1024 + 16);
  const response = {
    ok: true,
    status: 200,
    body: asyncIteratorBody([new TextEncoder().encode(`data: {"blob":"${blob}"}\n\n`)]),
  };
  await assert.rejects(collect(readSseEvents(response)), /maximum allowed size/);
});

test("SSE framing accepts CR-only and CRLF terminators split across chunks", async () => {
  const response = {
    ok: true,
    status: 200,
    body: asyncIteratorBody(sseChunks(
      // CR-only framing with a CR-only blank line dispatching the first event.
      'event: add\rdata: {"i":0}\r\r',
      // Data line terminated by a bare CR exactly at the chunk edge…
      'data: {"i":1}\r',
      // …whose LF partner opens the next chunk: one terminator, not two.
      '\n\rdata: {"i":2}\r\n\r\ndata: {"i":3}\r\n\r\n',
    )),
  };
  const seen = [];
  for await (const event of readSseEvents(response)) {
    seen.push({ event: event.event, i: event.data.i });
  }
  assert.deepEqual(seen, [
    { event: "add", i: 0 },
    { event: "message", i: 1 },
    { event: "message", i: 2 },
    { event: "message", i: 3 },
  ]);
});

test("CLI timeout reports ETIMEDOUT even when the child traps SIGTERM and exits 0", { skip: process.platform === "win32" }, async () => {
  await assert.rejects(
    runCliCommand("/bin/sh", ["-c", "trap 'exit 0' TERM; echo started; sleep 30"], {
      timeoutMs: 200,
      providerId: "test-cli",
    }),
    (error) => {
      assert.equal(error.code, "ETIMEDOUT");
      assert.match(error.message, /timed out/);
      return true;
    },
  );
});

test("CLI abort reports ABORT_ERR semantics", { skip: process.platform === "win32" }, async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 80);
  await assert.rejects(
    runCliCommand("/bin/sh", ["-c", "trap 'exit 0' TERM; sleep 30"], {
      signal: controller.signal,
      timeoutMs: 30_000,
      providerId: "test-cli",
    }),
    (error) => {
      assert.equal(error.code, "ABORT_ERR");
      assert.equal(error.name, "AbortError");
      return true;
    },
  );
});

test("Grok sends a tool call once, as tool_calls, never as marker text", async () => {
  const { buildGrokMessages } = await import("../modules/provider-grok/src/native-transport.mjs");
  // Flattening the call into "[Tool Call clock] {...}" text as well taught the
  // model to imitate that format and print it instead of calling a tool.
  const messages = await buildGrokMessages({
    messages: [
      { role: "user", content: "check the time" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "One moment." },
          { type: "tool-call", id: "c1", name: "clock", arguments: { tz: "UTC" } },
        ],
      },
      { role: "tool", toolCallId: "c1", content: "12:00" },
    ],
  });
  const assistant = messages.find((message) => message.role === "assistant");
  assert.equal(assistant.content, "One moment.");
  assert.equal(assistant.tool_calls.length, 1);
  assert.equal(assistant.tool_calls[0].function.name, "clock");
  assert.doesNotMatch(JSON.stringify(assistant.content), /\[Tool Call/);

  const onlyCall = await buildGrokMessages({
    messages: [{ role: "assistant", content: [{ type: "tool-call", id: "c1", name: "clock", arguments: {} }] }],
  });
  const second = onlyCall.find((message) => message.role === "assistant");
  assert.equal(second.content, "");
  assert.equal(second.tool_calls.length, 1);
});
