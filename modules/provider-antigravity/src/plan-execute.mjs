/**
 * Antigravity's combined ("Orchestrator") models are a client-side protocol,
 * not a server model: the official CLI plans on the strongest tier of a Gemini
 * 4 family, hands the plan to a cheaper executor (Gemini 4 Hydrogen), and keeps
 * the two phases in separate turns. This module reproduces that protocol inside
 * one DSH turn so a Dockyard user can pick "Orchestrator (Argon)" and get the
 * same planner/executor split.
 */

export const ORCHESTRATOR_PLAN_TOOL = "exit_plan_mode";

/**
 * Tools the planner must not call: plan mode is read-only. Bash stays available
 * because the official client allows observing commands (builds, tests,
 * queries); the prompt tells the planner not to use it to change anything.
 */
const MUTATING_TOOL_PATTERN = /^(write|write_file|edit|edit_file|multi_edit|multiedit|apply_patch|str_replace|notebook_edit|create_file|delete_file)$/iu;

function toolName(tool) {
  return tool?.name ?? tool?.function?.name ?? "";
}

/** The hand-off tool. It is answered by this module, never by DSH. */
export function orchestratorPlanTool() {
  return {
    name: ORCHESTRATOR_PLAN_TOOL,
    description:
      "Hand the finished plan to the execution model. Call this once the plan is complete. "
      + "The execution model carries out the plan and cannot ask you questions, so the plan must be self-contained.",
    parameters: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description:
            "The complete plan: the decisions taken, the files and functions to change, the exact changes, "
            + "how to verify the result, and the signs that the plan has gone wrong.",
        },
      },
      required: ["plan"],
    },
  };
}

export function orchestratorPlanProtocol({ planner = null, executor = null } = {}) {
  const plannerLabel = planner ? ` (${planner})` : "";
  const executorLabel = executor ? ` (${executor})` : "";
  return [
    "<plan_execute_protocol>",
    `This turn runs in two phases on two models. You are the planning model${plannerLabel}: the strongest and most expensive one.`,
    "Plan mode is on. Investigate read-only: read code, search, and run commands that only observe. Do not modify files, and do not take any action whose effects leave the workspace.",
    "",
    "Match the depth of planning to the request. Many user messages are small follow-ups whose steps the conversation has already settled: for those, hand off a one- or two-sentence plan instead of investigating.",
    "",
    "When the task does need a plan:",
    "- Make every decision the task needs: how to read anything ambiguous, the design, the APIs, the order of work, and how the result will be verified.",
    "- Write the plan for an engineer who is competent but less capable than you and who cannot ask you questions: name files, functions and exact changes; give the verification commands and what their output must show; record the pitfalls you noticed.",
    "- End the plan with a short \"Re-plan if:\" list - the specific signs, for this task, that the plan has turned out wrong.",
    "",
    `Then call \`${ORCHESTRATOR_PLAN_TOOL}\` with the complete plan. That is the hand-off: a faster, cheaper execution model${executorLabel} starts a new turn with your plan, and nothing you know that is not in the plan or already in the conversation survives it.`,
    "",
    "Do not call the hand-off tool when the request needs nothing done - a question, a review, an explanation. Answer it directly instead. Anything that does something (an edit, or an action with effects outside the workspace) goes to the execution model, however small.",
    "</plan_execute_protocol>",
  ].join("\n");
}

/** System prompt for the executor turn: the plan plus what the hand-off kept. */
export function orchestratorExecutionProtocol({ plan, planner = null } = {}) {
  const plannerLabel = planner ? ` by the planning model (${planner})` : "";
  return [
    "<plan_execute_protocol>",
    `A stronger planning model${plannerLabel} planned this work in the previous phase and handed it to you to carry out.`,
    "You have the full tool set, including the editing tools. Follow the plan; adapt it only where it is clearly wrong for what you find, and say what you changed and why.",
    "When the plan is carried out, verify the result the way the plan says to, then answer the user.",
    "",
    "<plan>",
    String(plan ?? "").trim(),
    "</plan>",
    "</plan_execute_protocol>",
  ].join("\n");
}

function isToolResultPart(part) {
  return part?.type === "tool-result" || part?.type === "tool_result";
}

/**
 * A DSH turn issues one request for the user message and then one per tool
 * round-trip. The last message carrying a tool result means the turn is already
 * executing, so only the first request of a turn is planned.
 */
export function isOrchestratorContinuation(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const last = list.at(-1);
  if (!last) return false;
  const values = Array.isArray(last.content) ? last.content : [last.content];
  return values.some(isToolResultPart);
}

function textOf(chunk) {
  return typeof chunk?.text === "string" ? chunk.text : "";
}

function collectToolCalls(chunks) {
  const calls = [];
  for (const chunk of chunks) {
    if (chunk?.type !== "block-end") continue;
    const block = chunk.block;
    if (block?.type !== "tool-call") continue;
    calls.push(block);
  }
  return calls;
}

function planFromCall(call) {
  let args = call?.arguments;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return String(args).trim() || null;
    }
  }
  const plan = args?.plan ?? args?.plan_text ?? args?.markdown ?? args?.content;
  if (typeof plan !== "string") return null;
  const trimmed = plan.trim();
  return trimmed || null;
}

function planReasoningChunks(plan) {
  const index = 0;
  return [
    { type: "block-start", index, blockType: "reasoning" },
    { type: "reasoning-delta", index, text: `Plan\n\n${plan}` },
    { type: "block-end", index, block: { type: "reasoning", text: `Plan\n\n${plan}` } },
  ];
}

function withSystem(request, addition) {
  const base = typeof request.system === "string" && request.system.length > 0 ? request.system : "";
  return base ? `${base}\n\n${addition}` : addition;
}

function planningRequest(request, combo) {
  const tools = (Array.isArray(request.tools) ? request.tools : [])
    .filter((tool) => !MUTATING_TOOL_PATTERN.test(toolName(tool)));
  return {
    ...request,
    model: combo.planner,
    system: withSystem(request, orchestratorPlanProtocol({ planner: combo.planner, executor: combo.executor })),
    tools: [...tools, orchestratorPlanTool()],
  };
}

function executionRequest(request, combo, plan) {
  return {
    ...request,
    model: combo.executor,
    system: withSystem(request, orchestratorExecutionProtocol({ plan, planner: combo.planner })),
  };
}

/**
 * Stream one Antigravity "Orchestrator" turn.
 *
 * The planner runs first and its whole reply is buffered: it is short, and the
 * hand-off has to be inspected before anything is shown to DSH. A planner that
 * investigates with read-only tools ends the request with those tool calls and
 * the next request plans again; a planner that calls the hand-off tool switches
 * this request straight over to the executor, so the user sees one turn.
 */
export async function* streamAntigravityOrchestrator({
  request,
  invocation,
  context = {},
  executor,
  combo,
  state,
  sessionKey = "default",
}) {
  const session = state.get(sessionKey) ?? { phase: "planning", plan: null };
  state.set(sessionKey, session);

  if (!isOrchestratorContinuation(request.messages)) {
    session.phase = "planning";
    session.plan = null;
  }

  if (session.phase === "executing" && session.plan) {
    const stream = await executor({
      request: executionRequest(request, combo, session.plan),
      invocation,
      context,
    });
    yield* stream;
    return;
  }

  const planned = [];
  const plannerStream = await executor({
    request: planningRequest(request, combo),
    invocation,
    context,
  });
  for await (const chunk of plannerStream) planned.push(chunk);

  const calls = collectToolCalls(planned);
  const handOff = calls.find((call) => call.name === ORCHESTRATOR_PLAN_TOOL);
  const plan = handOff ? planFromCall(handOff) : null;

  if (!plan) {
    // No hand-off: either the planner answered directly (nothing to execute) or
    // it is still investigating with read-only tools. Both are forwarded as-is
    // and the next request continues planning.
    yield* planned;
    return;
  }

  session.plan = plan;
  session.phase = "executing";
  yield* planReasoningChunks(plan);

  const executed = await executor({
    request: executionRequest(request, combo, plan),
    invocation,
    context,
  });
  yield* executed;
}
