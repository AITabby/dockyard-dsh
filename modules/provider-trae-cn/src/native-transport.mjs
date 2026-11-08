/**
 * Trae CN (ByteDance's AI IDE) as a provider transport.
 *
 * Two channels, both verified against a real account on 2026-11-07:
 *
 *  1. Sign-in: Trae CN's own authorization page takes a callback on 127.0.0.1
 *     (`auth_callback_url`) and sends the account's `userJwt`, `userInfo` and
 *     `refreshToken` there as query parameters. Nothing is read out of the
 *     IDE and nothing is decrypted: this is the same browser flow the IDE
 *     runs, so the plugin is a client of its own rather than a copy of the
 *     IDE's storage.
 *
 *  2. Chat: `POST /api/agent/v3/llm_utils_chat` answers in its own SSE. Each
 *     `output` event carries `response` (the answer text) and
 *     `reasoning_content` (the model's thinking), never `content`.
 *
 * The request's identity headers are the IDE's own. Trae rejects a request
 * that omits them: without `x-app-version-code` it answers
 * `400 bad request: binding: expr_path=app_version_code, cause=miss`.
 */
import { createServer } from "node:http";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { guardEmptyCompletion } from "../../../packages/providers/src/native-transport.mjs";

export const PROVIDER_ID = "trae-cn";

export const TRAE_CN_SITE = Object.freeze({
  id: PROVIDER_ID,
  name: "Trae CN",
  webHost: "https://www.trae.cn",
  authHost: "https://api.trae.cn",
  apiHost: "https://trae-api-cn.mchost.guru",
  clientId: "ono9krqynydwx5",
  appId: "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8",
  pluginVersion: "2.3.24254",
  // The IDE version named to the authorization page, and the client version
  // the model host is told it serves.
  ideVersion: "3.3.65",
  clientVersion: "0.1.69",
  clientVersionCode: "20260917",
  brand: "ASUS TUF Gaming A15 FA507RM_FA507RM",
  deviceType: "windows",
  osVersion: "Windows 10",
  systemType: "Windows",
  deviceCpu: "AMD",
});

/**
 * Trae publishes no model-list endpoint: every listing path answers 404 on the
 * model host. This table is the IDE's own (`chat_v3`) roster, and each id was
 * checked against a real account — all six answer 200.
 */
/**
 * Only a fallback: every model below carries the capacity Trae CN itself
 * publishes (`context_window_tokens`), where `max` is the figure its "更大上下文
 * (Max)" toggle unlocks — 1M for the current generation, 200k for the older one.
 * DSH sizes compaction from this number, so it is not cosmetic.
 */
export const TRAE_CN_CONTEXT_FALLBACK = 200_000;

/**
 * Trae CN's own effort vocabulary (its UI shows 轻 / 高 / 极高). The endpoint
 * accepts the words without validating them per model, so only the three the
 * product actually renders are offered.
 */
export const TRAE_CN_REASONING = Object.freeze({
  efforts: [
    { id: "ultra", name: "Ultra", description: "Maximum reasoning depth." },
    { id: "high", name: "High", description: "Thorough reasoning for hard tasks.", default: true },
    { id: "light", name: "Light", description: "Fast, light reasoning for simple tasks." },
  ],
  defaultEffort: "high",
});

/** Ids lower-case exactly as the endpoint accepts them; capitalised ids are rejected. */
export const TRAE_CN_MODELS = Object.freeze([
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek-V4.1-Flash",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "DeepSeek-V4-Pro-Official",
    name: "DeepSeek-V4-Pro",
    contextWindow: 1000000,
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "glm-5.3",
    name: "GLM-5.3",
    contextWindow: 1000000,
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "glm-5.3-flash",
    name: "GLM-5.3-Flash",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "glm-5.3-flashx",
    name: "GLM-5.3-FlashX",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "kimi-k3",
    name: "Kimi-K3",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "kimi-k2.7-code",
    name: "kimi-k2.7-code",
    contextWindow: 200000,
  },
  {
    id: "mimo-v2.6-flash",
    name: "MiMo-V2.6-Flash",
    contextWindow: 981504,
    inputModalities: ["text", "image"],
  },
  {
    id: "mimo-v2.6-pro",
    name: "MiMo-V2.6-Pro",
    contextWindow: 981504,
    inputModalities: ["text", "image"],
  },
  {
    id: "minimax-m3",
    name: "MiniMax-M3",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
  },
  {
    id: "minimax-m3.1-flash",
    name: "MiniMax-M3.1-Flash",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "step-5-preview",
    name: "Step-5-Preview",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "qwen3.8-flash",
    name: "Qwen3.8-Flash",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "qwen3.8-max",
    name: "Qwen3.8-Max",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "qwen-3.7-plus",
    name: "Qwen3.7-Plus",
    contextWindow: 200000,
    inputModalities: ["text", "image"],
  },
  {
    id: "Doubao-Seed-Evolving",
    name: "Seed-Evolving",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
  },
  {
    id: "Doubao-Seed-2.1-Pro",
    name: "Seed-2.1-Pro-0915",
    contextWindow: 1000000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "Doubao-Seed-2.1-Turbo",
    name: "Seed-2.1-Turbo",
    contextWindow: 256000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "DeepSeek-V4-Flash",
    name: "DeepSeek-V4-Flash",
    contextWindow: 200000,
  },
  {
    id: "glm-5.2",
    name: "glm-5.2",
    contextWindow: 200000,
  },
  {
    id: "glm-5.1",
    name: "GLM-5.1",
    contextWindow: 200000,
  },
  {
    id: "glm-5",
    name: "GLM-5",
    contextWindow: 200000,
  },
  {
    id: "glm-5v-turbo",
    name: "GLM-5V-Turbo",
    contextWindow: 200000,
    inputModalities: ["text", "image"],
  },
  {
    id: "kimi-k2.6",
    name: "Kimi-K2.6",
    contextWindow: 200000,
    inputModalities: ["text", "image"],
  },
  {
    id: "kimi-k2.5",
    name: "Kimi-K2.5",
    contextWindow: 200000,
    inputModalities: ["text", "image"],
  },
  {
    id: "minimax-m2.7",
    name: "MiniMax-M2.7",
    contextWindow: 200000,
  },
  {
    id: "minimax-m2.5",
    name: "minimax-m2.5",
    contextWindow: 200000,
  },
  {
    id: "qwen-3.6-plus",
    name: "Qwen3.6-Plus",
    contextWindow: 200000,
    inputModalities: ["text", "image"],
  },
  {
    id: "qwen-3.5",
    name: "Qwen3.5-Plus",
    contextWindow: 200000,
    inputModalities: ["text", "image"],
  },
  {
    id: "Doubao-Seed-Code",
    name: "Seed-Code",
    contextWindow: 256000,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
      ],
      defaultEffort: "high",
    },
  },
  {
    id: "Doubao-Seed-2.0-Code",
    name: "Doubao-Seed-2.0-Code",
    contextWindow: 184000,
    inputModalities: ["text", "image"],
  },
]);

/** The IDE's chat function this provider asks through. */
export const TRAE_CN_CHAT_FUNCTION = "chat_v3";

const digits = (count) => Array.from(
  { length: count },
  (_, index) => (index === 0 ? randomInt(1, 10) : randomInt(0, 10)),
).join("");

/**
 * A device as Trae CN sees one: a 16-digit id (its clients' shape) and a
 * machine id. The id is named to the authorization page and sent with every
 * request, so it must stay with the account: a fresh one per request is what
 * the relays saw requests dropped for.
 */
export function newTraeDevice() {
  return {
    deviceId: digits(16),
    machineId: randomBytes(16).toString("hex"),
  };
}

/** Parse one of Trae's expiry times: seconds, milliseconds, or ISO. */
export function traeWhen(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "string" && !/^\d+$/u.test(value.trim())) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number < 1e11 ? number * 1000 : number;
}

function parseJsonish(value) {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Read the sign-in Trae's page handed back. `userJwt` is a JSON blob (not a
 * bare JWT), `userInfo` names the account, and `refreshToken` may arrive on its
 * own when the page could not issue a JWT.
 */
export function readTraeCallback(params, { site = TRAE_CN_SITE, device } = {}) {
  const jwt = parseJsonish(params.get("userJwt"));
  const info = parseJsonish(params.get("userInfo"));
  const token = jwt.Token ?? jwt.token ?? "";
  const refreshToken = jwt.RefreshToken ?? jwt.refreshToken ?? params.get("refreshToken") ?? "";
  if (!token && !refreshToken) {
    throw new Error(`${site.name} 没有返回登录凭据（userJwt / refreshToken 都是空的）`);
  }
  return {
    token,
    refreshToken,
    // `TokenExpireAt` is what the page sends; a bare JWT's exp is the fallback.
    expiresAt: traeWhen(jwt.TokenExpireAt ?? jwt.tokenExpireAt) || traeWhen(jwt.exp * 1000),
    refreshExpiresAt: traeWhen(params.get("refreshExpireAt") ?? jwt.RefreshExpireAt),
    clientId: jwt.ClientID ?? jwt.clientId ?? params.get("clientId") ?? site.clientId,
    uid: String(info.UserID ?? info.userId ?? params.get("userId") ?? jwt.UserID ?? jwt.userId ?? ""),
    name: String(info.ScreenName ?? info.screenName ?? info.UserName ?? ""),
    email: String(info.Email ?? info.email ?? ""),
    device: device ?? newTraeDevice(),
    region: String(params.get("userRegion") ?? ""),
    host: String(params.get("host") ?? ""),
  };
}

/** The URL Trae CN's authorization page is opened at. */
export function traeAuthorizationUrl({ callback, device, site = TRAE_CN_SITE, traceId = randomUUID() }) {
  const query = new URLSearchParams({
    login_version: "1",
    auth_from: "solo",
    login_channel: "native_ide",
    plugin_version: site.pluginVersion,
    auth_type: "local",
    client_id: site.clientId,
    redirect: "0",
    login_trace_id: traceId,
    auth_callback_url: callback,
    machine_id: device.machineId,
    device_id: device.deviceId,
    x_device_id: device.deviceId,
    x_machine_id: device.machineId,
    x_device_brand: site.brand,
    x_device_type: site.deviceType,
    x_os_version: `${site.osVersion} Pro`,
    x_env: "",
    x_app_version: site.ideVersion,
    x_app_type: "stable",
    hide_saas_login: "false",
  });
  return `${site.webHost}/authorization?${query}`;
}

const SIGN_IN_PAGE = (ok, title, message) => `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:40px;max-width:640px;line-height:1.6">
<h2>${ok ? "✅" : "❌"} ${title}</h2><p>${message}</p></body></html>`;

/**
 * Run Trae CN's browser sign-in.
 *
 * Resolves with the account's credential once the page calls back, or with the
 * page's error. The caller owns the returned `cancel`.
 */
export async function startTraeSignIn({ site = TRAE_CN_SITE, timeoutMs = 600_000, device = newTraeDevice() } = {}) {
  let settle;
  const done = new Promise((resolve) => { settle = resolve; });
  let finished = false;
  const finish = (value) => {
    if (finished) return;
    finished = true;
    settle(value);
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    const html = (body) => {
      res.writeHead(200, { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(body);
    };
    if (url.pathname !== "/authorize") {
      res.writeHead(404, cors).end();
      return;
    }
    if (finished) {
      html(SIGN_IN_PAGE(false, "这次登录已经结束", "请重新从 Dockyard 发起登录。"));
      return;
    }
    const params = url.searchParams;
    if (params.get("error")) {
      const message = params.get("error_description") || params.get("error");
      finish({ ok: false, error: message });
      html(SIGN_IN_PAGE(false, "登录没有完成", message));
      return;
    }
    try {
      const credential = readTraeCallback(params, { site, device });
      finish({ ok: true, credential });
      html(SIGN_IN_PAGE(true, "登录成功", `${credential.name || credential.uid || "账号"} 已接入 Dockyard DSH，可以关闭此页面。`));
    } catch (error) {
      finish({ ok: false, error: error.message });
      html(SIGN_IN_PAGE(false, "登录没有完成", error.message));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const callback = `http://127.0.0.1:${server.address().port}/authorize`;
  const authorizationUrl = traeAuthorizationUrl({ callback, device, site });
  const timer = setTimeout(() => finish({ ok: false, error: "登录超时" }), timeoutMs);
  const close = () => {
    clearTimeout(timer);
    try { server.close(); } catch { /* already closed */ }
  };
  done.then(() => setTimeout(close, 5_000).unref?.());
  return {
    authorizationUrl,
    instructions: `在浏览器中登录 ${site.name} 并同意授权；授权完成后本页会自动回到 Dockyard，不需要复制任何代码。`,
    device,
    result: done,
    cancel: () => {
      finish({ ok: false, error: "已取消" });
      close();
    },
  };
}

/** The IDE's identity headers, for an account and its device. */
export function traeHeaders(account, { site = TRAE_CN_SITE, extra = {} } = {}) {
  const token = String(account?.token ?? "");
  return {
    "Content-Type": "application/json",
    Authorization: `Cloud-IDE-JWT ${token}`,
    "X-Cloudide-Token": token,
    "x-ide-token": token,
    "x-uid": String(account?.uid ?? ""),
    "x-app-id": site.appId,
    "x-device-id": String(account?.device?.deviceId ?? ""),
    "x-machine-id": String(account?.device?.machineId ?? ""),
    "x-request-id": randomUUID(),
    "x-app-version": site.clientVersion,
    "x-app-version-code": site.clientVersionCode,
    "x-ide-version": site.clientVersion,
    "x-ide-version-code": site.clientVersionCode,
    "x-ide-version-type": "stable",
    "x-device-cpu": site.deviceCpu,
    "x-device-brand": site.brand,
    "x-device-type": site.deviceType,
    "x-os-version": site.osVersion,
    "x-system-type": site.systemType,
    ...extra,
  };
}

function messageText(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part && (part.type === "text" || typeof part.text === "string"))
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");
}

/** Trae's own message shape: `content` is an array of parts, never a string. */
/**
 * Tools travel to Trae CN natively, and a tool result is a turn of its own, so
 * the history has to speak both: an assistant turn carrying its calls, and the
 * `tool` turn answering each. Text is the only part this provider sends.
 */
export function traeMessages(request = {}) {
  const messages = [];
  if (typeof request.system === "string" && request.system.trim().length > 0) {
    messages.push({ role: "system", content: [{ type: "text", text: request.system }] });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "developer" ? "system" : (message?.role ?? "user");
    const calls = role === "assistant" ? assistantCalls(message) : [];
    if (role === "tool") {
      const text = messageText(message);
      const toolCallId = toolResultId(message);
      messages.push({
        role: "tool",
        tool_call_id: toolCallId,
        content: [{ type: "text", text: text || "(no output)" }],
      });
      continue;
    }
    const text = messageText(message);
    if (!text && calls.length === 0) continue;
    const entry = { role, content: [{ type: "text", text: text ?? "" }] };
    if (calls.length > 0) entry.tool_calls = calls;
    messages.push(entry);
  }
  return messages;
}

/** Calls an assistant turn made, in the shape Trae CN answers with. */
function assistantCalls(message) {
  const calls = [];
  const push = (id, name, args) => {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return;
    calls.push({
      id: String(id ?? `call_${calls.length + 1}`),
      type: "function",
      // Trae's own name for this: `function_call` (a `function` key is read as
      // a ToolCall without a name and the whole stream fails).
      function_call: { name: trimmed, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) },
    });
  };
  for (const block of Array.isArray(message?.content) ? message.content : []) {
    if (block?.type !== "tool-call" && block?.type !== "tool_call") continue;
    push(block.id ?? block.toolCallId, block.name ?? block.toolName, block.arguments ?? block.input ?? "{}");
  }
  for (const call of Array.isArray(message?.tool_calls) ? message.tool_calls : []) {
    push(call.id, call.function?.name ?? call.name, call.function?.arguments ?? call.arguments ?? "{}");
  }
  return calls;
}

/** The call a tool turn answers. */
function toolResultId(message) {
  const direct = message?.tool_call_id ?? message?.toolCallId ?? message?.id;
  if (typeof direct === "string" && direct) return direct;
  for (const block of Array.isArray(message?.content) ? message.content : []) {
    const id = block?.toolCallId ?? block?.tool_call_id ?? block?.id;
    if (typeof id === "string" && id) return id;
  }
  return "call_1";
}

/** Request tools as Trae CN names them: parameters ride as a JSON string. */
export function traeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  const mapped = [];
  for (const tool of tools) {
    const fn = tool?.function ?? tool;
    const name = String(fn?.name ?? "").trim();
    if (!name) continue;
    const parameters = typeof fn.parameters === "string"
      ? fn.parameters
      : JSON.stringify(fn.parameters ?? fn.input_schema ?? { type: "object", properties: {} });
    mapped.push({
      type: "function",
      function: { name, description: String(fn.description ?? ""), parameters },
    });
  }
  return mapped.length > 0 ? mapped : undefined;
}

export function traeChatBody(request = {}, { site = TRAE_CN_SITE, model } = {}) {
  const chosen = model ?? request.model ?? TRAE_CN_MODELS[0].id;
  const body = {
    messages: traeMessages(request),
    function: TRAE_CN_CHAT_FUNCTION,
    // A real model id is required: `"auto"` is answered with
    // `4001 param is invalid`.
    config_name: chosen,
    model: chosen,
    stream: true,
    request_id: randomUUID(),
    session_id: String(request.sessionId ?? randomUUID()),
  };
  if (typeof request.reasoningEffort === "string" && request.reasoningEffort.trim()) {
    body.reasoning_effort = request.reasoningEffort.trim();
  }
  const toolChoice = request.toolChoice ?? request.tool_choice;
  const tools = traeTools(request.tools);
  // Without the tools in the body the model answers with the call written out
  // as text, which DSH renders as prose instead of running anything.
  if (tools && toolChoice !== "none") {
    body.tools = tools;
    const choice = typeof toolChoice === "object"
      ? (toolChoice.function?.name ?? toolChoice.name)
      : toolChoice;
    if (typeof choice === "string" && choice && choice !== "none") body.tool_choice = choice;
    else body.tool_choice = "auto";
    if (typeof request.parallelToolCalls === "boolean") body.parallel_tool_calls = request.parallelToolCalls;
  }
  return body;
}

/** Split an SSE byte stream into `{ event, data }` records. */
export async function* traeSseEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  const pending = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/u, "");
        buffer = buffer.slice(index + 1);
        if (line === "") {
          if (pending.length > 0) {
            const raw = pending.join("\n");
            pending.length = 0;
            let data = raw;
            try { data = JSON.parse(raw); } catch { /* keep the text */ }
            yield { event, data };
            event = "";
          }
          continue;
        }
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          pending.push(line.slice(5).replace(/^ /u, ""));
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * Trae CN answers its own errors as `{code, message}` inside a failed response.
 * Two of them deserve plain language: they are the ones a user can act on.
 */
export function traeRequestError(status, detail = "") {
  const parsed = (() => { try { return JSON.parse(detail); } catch { return null; } })();
  const code = Number(parsed?.code) || 0;
  const message = String(parsed?.message ?? "");
  if (code === 4026 || /context length has exceeded/u.test(message)) {
    const error = new Error("上下文超长：这个模型装不下当前对话，请压缩或换个上下文更大的模型");
    error.code = "CONTEXT_TOO_LONG";
    error.detail = detail.slice(0, 500);
    return error;
  }
  if (code === 1001) {
    const error = new Error("Trae CN 登录已失效，请重新登录");
    error.code = "AUTH_EXPIRED";
    error.detail = detail.slice(0, 500);
    return error;
  }
  const error = new Error(`Trae CN 请求失败（HTTP ${status}）${code ? ` code=${code}` : ""}`);
  error.detail = detail.slice(0, 500);
  return error;
}

/**
 * Execute one conversation turn through Trae CN.
 *
 * The answer arrives as `output` events: `response` is the text, and
 * `reasoning_content` is the model's thinking, emitted as a reasoning block.
 */
export function createTraeNativeExecutor({
  site = TRAE_CN_SITE,
  fetchImpl = fetch,
  timeoutMs = 300_000,
} = {}) {
  async function executeTrae({ request = {}, credential, signal } = {}) {
    const account = credential ?? {};
    const body = traeChatBody(request, { site, model: request.model });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener?.("abort", abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    return (async function* responseStream() {
      // One open block at a time: closing a block releases its index and clears
      // its buffer. The previous version kept both, so a second tool call
      // closed the text block again with everything accumulated so far and the
      // same paragraph reached the host twice.
      let nextIndex = 0;
      let textOpen = false;
      let textIndex = 0;
      let text = "";
      let reasoningOpen = false;
      let reasoningIndex = 0;
      let reasoning = "";
      // Trae CN streams calls the way OpenAI does: the same call keeps arriving
      // as a snapshot of its arguments, so pieces are appended per call index.
      const calls = new Map();
      let callIndex = null;

      function* closeText() {
        if (!textOpen) return;
        yield { type: "block-end", index: textIndex, block: { type: "text", text } };
        textOpen = false;
        text = "";
      }

      function* closeReasoning() {
        if (!reasoningOpen) return;
        yield { type: "block-end", index: reasoningIndex, block: { type: "reasoning", text: reasoning } };
        reasoningOpen = false;
        reasoning = "";
      }

      function* openText() {
        if (textOpen) return;
        textIndex = nextIndex;
        nextIndex += 1;
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }

      function* openReasoning() {
        if (reasoningOpen) return;
        reasoningIndex = nextIndex;
        nextIndex += 1;
        reasoningOpen = true;
        yield { type: "block-start", index: reasoningIndex, blockType: "reasoning" };
      }

      try {
        const response = await fetchImpl(`${site.apiHost}/api/agent/v3/llm_utils_chat`, {
          method: "POST",
          headers: traeHeaders(account, {
            site,
            extra: { Accept: "text/event-stream", ...(request.headers ?? {}) },
          }),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw traeRequestError(response.status, detail);
        }
        for await (const { event, data } of traeSseEvents(response.body)) {
          if (event === "error") {
            const message = data?.message ?? "Trae CN 返回了错误";
            const error = new Error(message);
            error.detail = data;
            throw error;
          }
          if (event !== "output" || !data || typeof data !== "object") continue;
          for (const piece of Array.isArray(data.tool_calls) ? data.tool_calls : []) {
            const key = piece?.index ?? piece?.id ?? 0;
            const existing = calls.get(key);
            // Trae names them `function_call`, not OpenAI's `function`.
            const fn = piece?.function_call ?? piece?.function ?? piece;
            const name = fn?.name;
            const args = fn?.arguments;
            if (!existing) {
              // A call starts a new block, so whatever is streaming must close
              // first: the host allows one open block per index.
              yield* closeReasoning();
              yield* closeText();
              callIndex = { index: nextIndex, id: String(piece?.id ?? `call_${key}`), name: "", arguments: "" };
              nextIndex += 1;
              calls.set(key, callIndex);
              yield { type: "block-start", index: callIndex.index, blockType: "tool-call" };
            }
            const state = calls.get(key);
            if (typeof piece?.id === "string" && piece.id) state.id = piece.id;
            if (typeof name === "string" && name) state.name = name;
            const delta = typeof args === "string" ? args : (args ? JSON.stringify(args) : "");
            if (delta) {
              state.arguments += delta;
              yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: delta };
            }
          }
          const thought = typeof data.reasoning_content === "string" ? data.reasoning_content : "";
          if (thought) {
            yield* closeText();
            yield* openReasoning();
            reasoning += thought;
            yield { type: "reasoning-delta", index: reasoningIndex, text: thought };
          }
          const answer = typeof data.response === "string" ? data.response : "";
          if (answer) {
            yield* closeReasoning();
            yield* openText();
            text += answer;
            yield { type: "text-delta", index: textIndex, text: answer };
          }
        }
        yield* closeReasoning();
        yield* closeText();
        for (const state of calls.values()) {
          yield {
            type: "block-end",
            index: state.index,
            block: { type: "tool-call", id: state.id, name: state.name || "tool", arguments: state.arguments || "{}" },
          };
        }
        yield { type: "finish", reason: calls.size === 0 ? { kind: "stop" } : { kind: "tool-calls" } };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", abort);
      }
    })();
  };
  return guardEmptyCompletion(executeTrae, { providerId: PROVIDER_ID });
}

/** Read the account's credit window (Trae CN bills in credits). */
export async function readTraeCredits({ credential, site = TRAE_CN_SITE, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const response = await fetchImpl(`${site.authHost}/trae/api/v2/pay/ide_user_ent_usage`, {
    method: "POST",
    headers: traeHeaders(credential, { site, extra: { Accept: "application/json" } }),
    body: JSON.stringify({ require_usage: true, req_source: 0 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const error = new Error(`Trae CN 额度查询失败（HTTP ${response.status}）`);
    error.status = response.status;
    error.detail = await response.text().catch(() => "");
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  const payload = data?.data ?? data;
  // Trae CN answers a credit account with `usage_summary`:
  // { consumed_amount, consumption_ratio, total_amount }.
  const summary = payload?.usage_summary ?? payload?.usageSummary ?? {};
  const used = Number(summary.consumed_amount ?? summary.consumedAmount ?? payload?.used_credits ?? 0);
  const limit = Number(summary.total_amount ?? summary.totalAmount ?? payload?.total_credits ?? 0);
  const resetsAt = payload?.expire_time ?? payload?.expireTime ?? summary?.expire_time ?? null;
  return {
    used: Number.isFinite(used) ? used : 0,
    limit: Number.isFinite(limit) ? limit : 0,
    ...(resetsAt ? { resetsAt: new Date(traeWhen(resetsAt)).toISOString() } : {}),
    raw: payload,
  };
}

/**
 * The model roster Trae CN serves to its own client: real context capacity,
 * whether the model takes images, and its credit multiplier. The IDE's local
 * manifests carry none of this, so the catalog reads it live and only trusts
 * the ids this provider has proven against the chat endpoint.
 */
export async function readTraeModelRoster({ credential, site = TRAE_CN_SITE, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const response = await fetchImpl(`${site.apiHost}/api/remote/v1/models`, {
    method: "GET",
    headers: traeHeaders(credential, { site, extra: { Accept: "application/json" } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const error = new Error(`Trae CN 模型目录读取失败（HTTP ${response.status}）`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  const groups = data?.data?.list ?? [];
  const roster = new Map();
  for (const group of groups) {
    for (const model of group?.models ?? []) {
      if (!model?.name) continue;
      const features = parseTraeFeatures(model.features);
      // `max` is what Max mode unlocks; `dev` is the plain default.
      const dev = Number(model.context_window_tokens?.dev) || 0;
      const max = Number(model.context_window_tokens?.max) || 0;
      const contextWindow = Math.max(dev, max);
      roster.set(String(model.name).toLowerCase(), {
        id: String(model.name),
        name: model.display_name ?? String(model.name),
        ...(contextWindow > 0 ? { contextWindow } : {}),
        multimodal: model.multimodal === true,
        reasoning: features.reasoning?.enable !== false,
        ...(Number(features.consumption_rate?.data?.rate) > 0
          ? { creditRate: Number(features.consumption_rate.data.rate) }
          : {}),
      });
    }
  }
  return roster;
}

function parseTraeFeatures(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * Trae CN hands out 100 credits a day for checking in. It is a plain HTTP call
 * on the account's own token, so the IDE is not needed to claim it — the check
 * runs on every account refresh and only claims when today is still unclaimed.
 */
export async function claimTraeDailyCredits({ credential, site = TRAE_CN_SITE, fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const call = async (path) => {
    const response = await fetchImpl(`${site.authHost}${path}`, {
      method: "POST",
      headers: traeHeaders(credential, { site, extra: { Accept: "application/json" } }),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const error = new Error(`Trae CN 签到失败（HTTP ${response.status}）`);
      error.status = response.status;
      throw error;
    }
    return response.json().catch(() => ({}));
  };
  const status = await call("/trae/api/v2/ug/checkin_credits/status");
  const enabled = status?.enable === true;
  const already = status?.checked_in === true;
  const credits = Number(status?.credits) + Number(status?.extra_credits ?? 0) || Number(status?.credits) || 0;
  if (!enabled || already) return { enabled, claimed: false, credits };
  await call("/trae/api/v2/ug/checkin_credits/claim");
  return { enabled, claimed: true, credits };
}
