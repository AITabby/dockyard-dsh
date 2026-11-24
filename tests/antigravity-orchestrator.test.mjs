import test from "node:test";
import assert from "node:assert/strict";

import {
  collapseAntigravityTierFamilies,
  modelsFromFetchAvailableModels,
  withAntigravityOrchestrators,
} from "../modules/provider-antigravity/src/native-transport.mjs";
import {
  ORCHESTRATOR_PLAN_TOOL,
  isOrchestratorContinuation,
  orchestratorPlanTool,
  streamAntigravityOrchestrator,
} from "../modules/provider-antigravity/src/plan-execute.mjs";

const gemini4Account = {
  models: {
    "gemini-4-neon-high": { displayName: "Gemini 4 Neon (High)", maxTokens: 1_048_576, maxOutputTokens: 262_144 },
    "gemini-4-neon-medium": { displayName: "Gemini 4 Neon (Medium)" },
    "gemini-4-neon-low": { displayName: "Gemini 4 Neon (Low)" },
    "gemini-4-carbon-medium": { displayName: "Gemini 4 Carbon (Medium)" },
    "gemini-4-carbon-high": { displayName: "Gemini 4 Carbon (High)" },
    "gemini-4-argon-medium": { displayName: "Gemini 4 Argon (Medium)" },
    "gemini-4-argon-high": { displayName: "Gemini 4 Argon (High)" },
    "gemini-4-hydrogen-high": { displayName: "Gemini 4 Hydrogen (High)" },
    "gemini-4-hydrogen-medium": { displayName: "Gemini 4 Hydrogen (Medium)" },
    "gemini-3.8-flash-high": { displayName: "Gemini 3.8 Flash (High)" },
  },
  agentModelSorts: [{
    groups: [{
      modelIds: [
        "gemini-4-neon-high", "gemini-4-neon-medium", "gemini-4-neon-low",
        "gemini-4-carbon-medium", "gemini-4-carbon-high",
        "gemini-4-argon-medium", "gemini-4-argon-high",
        "gemini-4-hydrogen-high", "gemini-4-hydrogen-medium",
        "gemini-3.8-flash-high",
      ],
    }],
  }],
};

test("orchestrator entries appear for the families the account can select", () => {
  const models = modelsFromFetchAvailableModels(gemini4Account);
  const orchestrators = models.filter((model) => model.id.includes("orchestrator"));
  assert.deepEqual(orchestrators.map((model) => model.id), [
    "gemini-pro-orchestrator-neon",
    "gemini-pro-orchestrator",
    "gemini-pro-orchestrator-argon",
  ]);
  assert.deepEqual(orchestrators.map((model) => model.name), [
    "Orchestrator (Neon)",
    "Orchestrator (Carbon)",
    "Orchestrator (Argon)",
  ]);
  // The pairing is what the transport runs: planner = the family's strongest
  // tier, executor = the cheap Hydrogen tier, exactly like the official client.
  assert.deepEqual(orchestrators[0].combo, { planner: "gemini-4-neon-high", executor: "gemini-4-hydrogen-high" });
  assert.deepEqual(orchestrators[1].combo, { planner: "gemini-4-carbon-high", executor: "gemini-4-hydrogen-high" });
  assert.deepEqual(orchestrators[2].combo, { planner: "gemini-4-argon-high", executor: "gemini-4-hydrogen-high" });

  // Official picker order: the orchestrators follow the Gemini 4 families.
  const ids = models.map((model) => model.id);
  assert.ok(ids.indexOf("gemini-pro-orchestrator-argon") < ids.indexOf("gemini-3.8-flash-high"));
  assert.equal(models.every((model) => model.unavailable === undefined), true);
});

test("no orchestrator without the executor family, or without a high tier", () => {
  const withoutHydrogen = modelsFromFetchAvailableModels({
    models: {
      "gemini-4-neon-high": { displayName: "Gemini 4 Neon (High)" },
      "gemini-4-neon-medium": { displayName: "Gemini 4 Neon (Medium)" },
    },
  });
  assert.equal(withoutHydrogen.some((model) => model.id.includes("orchestrator")), false);

  const withoutHigh = withAntigravityOrchestrators([
    { id: "gemini-4-neon-medium", name: "Gemini 4 Neon" },
    { id: "gemini-4-hydrogen-high", name: "Gemini 4 Hydrogen" },
  ]);
  assert.equal(withoutHigh.some((model) => model.id.includes("orchestrator")), false);
});

test("an account without Gemini 4 gets no orchestrator rows", () => {
  const models = modelsFromFetchAvailableModels({
    models: {
      "gemini-3.8-flash-high": { displayName: "Gemini 3.8 Flash (High)" },
      "claude-sonnet-4-6": { displayName: "Claude Sonnet 4.6 (Thinking)" },
      "gemini-4-carbon-disabled": { displayName: "Gemini 4 Carbon", disabled: true },
      "gemini-4-hydrogen-disabled": { displayName: "Gemini 4 Hydrogen", disabled: true },
    },
    agentModelSorts: [{ groups: [{ modelIds: ["gemini-3.8-flash-high", "claude-sonnet-4-6", "gemini-4-carbon-disabled"] }] }],
  });
  assert.deepEqual(models.map((model) => model.id), ["gemini-3.8-flash-high", "claude-sonnet-4-6"]);
});

test("the CLI catalog's own orchestrator rows only gain the pairing", () => {
  const rows = withAntigravityOrchestrators(collapseAntigravityTierFamilies([
    { id: "gemini-4-argon-high", name: "Gemini 4 Argon (High)" },
    { id: "gemini-4-argon-medium", name: "Gemini 4 Argon (Medium)" },
    { id: "gemini-4-hydrogen-high", name: "Gemini 4 Hydrogen (High)" },
    { id: "gemini-pro-orchestrator-argon", name: "Orchestrator (Argon)" },
  ]));
  const orchestrator = rows.find((model) => model.id === "gemini-pro-orchestrator-argon");
  assert.deepEqual(orchestrator.combo, { planner: "gemini-4-argon-high", executor: "gemini-4-hydrogen-high" });
  assert.equal(rows.filter((model) => model.id === "gemini-pro-orchestrator-argon").length, 1);
});

test("a turn that already ran a tool is an execution continuation", () => {
  assert.equal(isOrchestratorContinuation([{ role: "user", content: "do it" }]), false);
  assert.equal(isOrchestratorContinuation([
    { role: "user", content: "do it" },
    { role: "assistant", content: [{ type: "tool-call", name: "read" }] },
    { role: "user", content: [{ type: "tool-result", content: "file body" }] },
  ]), true);
});

test("the hand-off tool is declared with a plan argument", () => {
  const tool = orchestratorPlanTool();
  assert.equal(tool.name, ORCHESTRATOR_PLAN_TOOL);
  assert.deepEqual(tool.parameters.required, ["plan"]);
});

/** Drive the combo stream with a scripted executor and record what it was asked. */
async function runCombo({ chunksPerModel, messages, state = new Map() }) {
  const calls = [];
  const executor = async ({ request }) => {
    calls.push(request);
    const chunks = chunksPerModel(request);
    return (async function* emit() { for (const chunk of chunks) yield chunk; })();
  };
  const out = [];
  for await (const chunk of streamAntigravityOrchestrator({
    request: { model: "gemini-pro-orchestrator-argon", messages, tools: [{ name: "read" }, { name: "edit" }] },
    invocation: {},
    context: { sessionId: "s1" },
    executor,
    combo: { planner: "gemini-4-argon-high", executor: "gemini-4-hydrogen-high" },
    state,
    sessionKey: "s1",
  })) out.push(chunk);
  return { calls, out };
}

const handOff = (plan) => ([
  { type: "block-start", index: 1, blockType: "reasoning" },
  { type: "reasoning-delta", index: 1, text: "thinking" },
  { type: "block-end", index: 1, block: { type: "reasoning", text: "thinking" } },
  { type: "block-start", index: 2, blockType: "tool-call" },
  { type: "tool-call-delta", index: 2, name: ORCHESTRATOR_PLAN_TOOL, argumentsDelta: JSON.stringify({ plan }) },
  { type: "block-end", index: 2, block: { type: "tool-call", id: "t1", name: ORCHESTRATOR_PLAN_TOOL, arguments: JSON.stringify({ plan }) } },
  { type: "finish", reason: "tool_calls" },
]);

const answer = (text) => ([
  { type: "block-start", index: 1, blockType: "text" },
  { type: "text-delta", index: 1, text },
  { type: "block-end", index: 1, block: { type: "text", text } },
  { type: "finish", reason: "stop" },
]);

test("the planner hands off, then the executor runs the plan", async () => {
  const { calls, out } = await runCombo({
    messages: [{ role: "user", content: "rename the helper" }],
    chunksPerModel: (request) => request.model === "gemini-4-argon-high"
      ? handOff("1. Rename helper in src/a.mjs\n2. Run tests")
      : answer("done"),
  });

  assert.deepEqual(calls.map((call) => call.model), ["gemini-4-argon-high", "gemini-4-hydrogen-high"]);
  // Plan mode is read-only and offers the hand-off tool; the executor keeps the
  // caller's tools and receives the plan.
  const planner = calls[0];
  assert.deepEqual(planner.tools.map((tool) => tool.name), ["read", ORCHESTRATOR_PLAN_TOOL]);
  assert.match(planner.system, /plan_execute_protocol/);
  assert.deepEqual(calls[1].tools.map((tool) => tool.name), ["read", "edit"]);
  assert.match(calls[1].system, /Rename helper in src\/a\.mjs/);

  // The plan is shown, and the hand-off tool never reaches DSH.
  assert.equal(out.some((chunk) => chunk.blockType === "tool-call"), false);
  assert.match(out.filter((chunk) => chunk.type === "reasoning-delta").map((chunk) => chunk.text).join(""), /Rename helper/);
  assert.match(out.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text).join(""), /done/);
});

test("a planner that answers directly is the answer", async () => {
  const { calls, out } = await runCombo({
    messages: [{ role: "user", content: "what does this do?" }],
    chunksPerModel: () => answer("it renames the helper"),
  });
  assert.deepEqual(calls.map((call) => call.model), ["gemini-4-argon-high"]);
  assert.match(out.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text).join(""), /renames the helper/);
});

test("a planner that investigates keeps planning on the next request", async () => {
  const state = new Map();
  const readCall = [
    { type: "block-start", index: 1, blockType: "tool-call" },
    { type: "block-end", index: 1, block: { type: "tool-call", id: "r1", name: "read", arguments: "{}" } },
    { type: "finish", reason: "tool_calls" },
  ];
  const first = await runCombo({
    state,
    messages: [{ role: "user", content: "fix the bug" }],
    chunksPerModel: () => readCall,
  });
  assert.deepEqual(first.calls.map((call) => call.model), ["gemini-4-argon-high"]);
  assert.equal(first.out.some((chunk) => chunk.block?.type === "tool-call"), true);

  const second = await runCombo({
    state,
    messages: [
      { role: "user", content: "fix the bug" },
      { role: "assistant", content: [{ type: "tool-call", name: "read" }] },
      { role: "user", content: [{ type: "tool-result", content: "body" }] },
    ],
    chunksPerModel: () => handOff("apply the fix"),
  });
  // The investigation did not hand off, so this request plans again rather than
  // jumping to the executor.
  assert.equal(second.calls[0].model, "gemini-4-argon-high");
  assert.deepEqual(second.calls.map((call) => call.model), ["gemini-4-argon-high", "gemini-4-hydrogen-high"]);
});

test("the executor keeps running the plan for the rest of the turn", async () => {
  const state = new Map();
  await runCombo({
    state,
    messages: [{ role: "user", content: "fix it" }],
    chunksPerModel: (request) => request.model === "gemini-4-argon-high" ? handOff("apply the fix") : answer("done"),
  });

  const continuation = await runCombo({
    state,
    messages: [
      { role: "user", content: "fix it" },
      { role: "assistant", content: [{ type: "tool-call", name: "read" }] },
      { role: "user", content: [{ type: "tool-result", content: "body" }] },
    ],
    chunksPerModel: () => answer("still going"),
  });
  // No second plan: the turn stays on the executor, and the plan is re-injected.
  assert.deepEqual(continuation.calls.map((call) => call.model), ["gemini-4-hydrogen-high"]);
  assert.match(continuation.calls[0].system, /apply the fix/);

  // A new user message starts a fresh planning phase.
  const nextTurn = await runCombo({
    state,
    messages: [{ role: "user", content: "now something else" }],
    chunksPerModel: (request) => request.model === "gemini-4-argon-high" ? handOff("new plan") : answer("done"),
  });
  assert.deepEqual(nextTurn.calls.map((call) => call.model), ["gemini-4-argon-high", "gemini-4-hydrogen-high"]);
});

test("the driver routes an Orchestrator pick through the pairing", async () => {
  const { createAntigravityDriver } = await import("../modules/provider-antigravity/src/driver.mjs");
  const seen = [];
  const driver = createAntigravityDriver({
    tokenResolver: async () => null,
    catalogLoader: async () => ({
      models: [
        { id: "gemini-4-argon-high", name: "Gemini 4 Argon" },
        { id: "gemini-pro-orchestrator-argon", name: "Orchestrator (Argon)", combo: { planner: "gemini-4-argon-high", executor: "gemini-4-hydrogen-high" } },
      ],
    }),
    requestExecutor: async function* ({ request }) {
      seen.push(request.model);
      if (request.model === "gemini-4-argon-high") {
        for (const chunk of handOff("do the thing")) yield chunk;
        return;
      }
      for (const chunk of answer("done")) yield chunk;
    },
  });

  const stream = await driver.invoke(
    { model: "gemini-pro-orchestrator-argon", messages: [{ role: "user", content: "go" }] },
    { account: { accountId: "a", auth: { kind: "api_key" } } },
    { sessionId: "session-a" },
  );
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);

  assert.deepEqual(seen, ["gemini-4-argon-high", "gemini-4-hydrogen-high"]);
  assert.match(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text).join(""), /done/);
});

test("a plain model still goes straight to the executor", async () => {
  const { createAntigravityDriver } = await import("../modules/provider-antigravity/src/driver.mjs");
  const seen = [];
  const driver = createAntigravityDriver({
    tokenResolver: async () => null,
    catalogLoader: async () => ({ models: [{ id: "gemini-4-argon-high", name: "Gemini 4 Argon" }] }),
    requestExecutor: async function* ({ request }) {
      seen.push(request.model);
      for (const chunk of answer("plain")) yield chunk;
    },
  });
  const stream = await driver.invoke(
    { model: "gemini-4-argon-high", messages: [{ role: "user", content: "go" }] },
    { account: { accountId: "a", auth: { kind: "api_key" } } },
    { sessionId: "session-b" },
  );
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(seen, ["gemini-4-argon-high"]);
  assert.match(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.text).join(""), /plain/);
});
