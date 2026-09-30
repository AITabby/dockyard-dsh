import { execFileSync } from "node:child_process";
import * as http2 from "node:http2";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

import {
  nativeProviderError,
  validateNativeEndpoint,
} from "../../../packages/providers/src/native-transport.mjs";
import {
  cursorGrpcStatusFlags,
  cursorNativeProtocolConstants,
  cursorTurnComplete,
  cursorFrameMetadata,
  decodeConnectFrames,
  decodeCursorConnectTrailer,
  decodeCursorKvRequest,
  decodeCursorText,
  decodeCursorToolMessage,
  encodeAgentRunRequest,
  encodeHeartbeat,
  encodeKvResponse,
} from "./native-protocol.mjs";

const PROVIDER_ID = "cursor";
const DEFAULT_ENDPOINT = cursorNativeProtocolConstants.endpoint;
const DEFAULT_TOTAL_TIMEOUT_MS = 120_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
// Pin the advertised client version to a fixed, reviewable official
// cursor-agent build id instead of deriving it from today's date: two builds
// of DSH must send identical versions, and a bump must be a deliberate change
// tracking an official CLI release. DOCKYARD_CURSOR_CLIENT_VERSION overrides.
const DEFAULT_CURSOR_CLIENT_VERSION = "cli-2025.09.17-agent-host";
const CURSOR_SESSION_KEYS = [
  "cursorAuth/accessToken",
  "cursorAuth/refreshToken",
  "cursorAuth/cachedEmail",
  "cursorAuth/stripeMembershipType",
];

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

function createAsyncQueue() {
  const values = [];
  const waiters = [];
  let closed = false;
  let failure = null;
  return {
    push(value) {
      if (closed || failure) return;
      const waiter = waiters.shift();
      if (waiter) waiter.resolve({ value, done: false });
      else values.push(value);
    },
    close() {
      if (closed || failure) return;
      closed = true;
      while (waiters.length) waiters.shift().resolve({ value: undefined, done: true });
    },
    fail(error) {
      if (closed || failure) return;
      failure = error;
      while (waiters.length) waiters.shift().reject(error);
    },
    async next() {
      if (values.length) return { value: values.shift(), done: false };
      if (failure) throw failure;
      if (closed) return { value: undefined, done: true };
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    },
    [Symbol.asyncIterator]() { return this; },
  };
}

/**
 * Read Cursor's official desktop OAuth session without starting cursor-agent.
 * The token is returned only to the provider module/native transport and is
 * never included in a public DSH snapshot.
 */
export function readCursorDesktopSession({
  credential,
  env = process.env,
  home = homedir(),
} = {}) {
  const stored = firstString(credential?.access, credential?.token);
  if (stored) {
    return {
      token: stored,
      refreshToken: firstString(credential?.refresh, credential?.refreshToken),
      expiresAt: firstString(credential?.expiresAt, credential?.expires_at),
      email: firstString(credential?.email),
      plan: firstString(credential?.plan),
      kind: "oauth",
      source: "dockyard_credential",
    };
  }
  const fromEnv = firstString(env.CURSOR_API_KEY, env.DOCKYARD_CURSOR_ACCESS_TOKEN);
  if (fromEnv) return { token: fromEnv, kind: "apiKey", source: "environment" };
  if (process.platform !== "darwin") return null;
  const dbPath = join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb");
  try {
    // Escape SQL string literals (doubling embedded single quotes) instead of
    // raw interpolation, since the sqlite3 CLI offers no parameterized-query
    // flag here. This keeps the pattern safe even if reused with non-constant keys.
    const escapeSqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const quotedKeys = CURSOR_SESSION_KEYS.map(escapeSqlLiteral).join(",");
    const output = execFileSync("sqlite3", ["-json", dbPath, `SELECT key, CAST(value AS TEXT) AS value FROM ItemTable WHERE key IN (${quotedKeys});`], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const rows = JSON.parse(output || "[]");
    const valueFor = (key) => rows.find((row) => row.key === key)?.value;
    const access = valueFor("cursorAuth/accessToken");
    return access ? {
      token: access,
      refreshToken: firstString(valueFor("cursorAuth/refreshToken")),
      email: firstString(valueFor("cursorAuth/cachedEmail")),
      plan: firstString(valueFor("cursorAuth/stripeMembershipType")),
      kind: "oauth",
      source: "cursor_desktop_app",
    } : null;
  } catch {
    return null;
  }
}

/** Resolve Cursor's access token without starting cursor-agent. */
export function resolveCursorAccessToken(options = {}) {
  const session = readCursorDesktopSession(options);
  return session
    ? { token: session.token, kind: session.kind, ...(session.expiresAt ? { expiresAt: session.expiresAt } : {}) }
    : null;
}

function cursorHeaders(endpoint, token, requestId, env) {
  const clientVersion = env.DOCKYARD_CURSOR_CLIENT_VERSION || DEFAULT_CURSOR_CLIENT_VERSION;
  const clientKey = randomBytes(32).toString("hex");
  return {
    ":method": "POST",
    ":path": `${endpoint.pathname}${endpoint.search}`,
    ":scheme": "https",
    ":authority": endpoint.host,
    authorization: `Bearer ${token}`,
    "content-type": "application/connect+proto",
    accept: "application/connect+proto",
    "connect-protocol-version": "1",
    "x-request-id": requestId,
    "x-cursor-client-version": clientVersion,
    "x-cursor-client-type": "cli",
    "x-cursor-client-key": clientKey,
    "x-cursor-streaming": "true",
  };
}

function cursorStatusError(status) {
  return nativeProviderError(PROVIDER_ID, `Cursor AgentService returned HTTP ${status}`, { status });
}

function streamCursor({
  endpoint,
  token,
  request,
  context,
  http2Module = http2,
  timeoutMs = DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}) {
  return (async function* cursorStream() {
    const requestId = firstString(request.requestId, context.requestId, randomUUID());
    const conversationId = firstString(request.sessionId, context.sessionId, requestId);
    const model = firstString(request.model);
    if (!model) throw nativeProviderError(PROVIDER_ID, "Cursor model is missing");
    const timeZone = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
    })();
    const encoded = encodeAgentRunRequest({
      messages: request.messages,
      model,
      requestId,
      conversationId,
      // Cursor's AgentService uses its own native tool/exec protocol. Keep
      // this request on the text path until DSH's tool bridge answers those
      // bidirectional ExecServer messages; no CLI prompt is involved.
      tools: [],
      timeZone,
    });
    const url = new URL(endpoint);
    const session = http2Module.connect(url.origin);
    const queue = createAsyncQueue();
    let stream = null;
    let responseStatus = 0;
    let responseBuffer = new Uint8Array();
    const responseDiagnostics = [];
    const protocolError = (message, code) => {
      const error = nativeProviderError(PROVIDER_ID, message, { code });
      if (responseDiagnostics.length > 0) error.cursorDiagnostics = responseDiagnostics.slice(0, 32);
      return error;
    };
    let completed = false;
    let cleaned = false;
    let heartbeat;
    let totalTimer;
    let idleTimer;
    const timeoutFailure = (message, code) => {
      const error = nativeProviderError(PROVIDER_ID, message, { code });
      error.code = code;
      queue.fail(error);
      stream?.close(http2Module.constants?.NGHTTP2_CANCEL);
      session.close();
    };
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => timeoutFailure("Cursor AgentService response idle timeout", "ETIMEDOUT"), idleTimeoutMs);
      idleTimer.unref?.();
    };
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      clearTimeout(totalTimer);
      clearTimeout(idleTimer);
      context.signal?.removeEventListener?.("abort", onAbort);
      if (stream && !stream.destroyed && !stream.closed) stream.close();
      if (!session.closed && !session.destroyed) session.close();
    };
    const onAbort = () => {
      const error = nativeProviderError(PROVIDER_ID, "Cursor request aborted");
      error.code = "ABORT_ERR";
      queue.fail(error);
      stream?.close(http2Module.constants?.NGHTTP2_CANCEL);
      session.close();
    };
    totalTimer = setTimeout(() => timeoutFailure("Cursor AgentService total request timeout", "ETIMEDOUT"), timeoutMs);
    totalTimer.unref?.();
    armIdleTimer();
    context.signal?.addEventListener?.("abort", onAbort, { once: true });
    if (context.signal?.aborted) onAbort();
    session.once("error", (error) => queue.fail(error));
    try {
      stream = session.request(cursorHeaders(url, token, requestId, context.env ?? process.env));
      stream.once("response", (headers) => {
        armIdleTimer();
        responseStatus = Number(headers[":status"] ?? 0);
        if (responseStatus >= 400) queue.fail(cursorStatusError(responseStatus));
      });
      stream.on("data", (chunk) => {
        armIdleTimer();
        const incoming = new Uint8Array(chunk);
        const merged = new Uint8Array(responseBuffer.byteLength + incoming.byteLength);
        merged.set(responseBuffer);
        merged.set(incoming, responseBuffer.byteLength);
        const decoded = decodeConnectFrames(merged);
        responseBuffer = decoded.rest;
        for (const frame of decoded.frames) {
          if ((frame.flags & 0x02) !== 0) {
            const trailer = decodeCursorConnectTrailer(frame.payload);
            if (trailer) {
              const error = nativeProviderError(PROVIDER_ID, trailer.message, {
                code: trailer.code,
                body: { code: trailer.code, message: trailer.message },
              });
              // Binary google.rpc.Status trailers carry the real gRPC code
              // (UNAUTHENTICATED/PERMISSION_DENIED/RESOURCE_EXHAUSTED…);
              // project it onto the account-pool markers.
              Object.assign(error, cursorGrpcStatusFlags(trailer.code));
              queue.fail(error);
            } else {
              completed = true;
              queue.push({ type: "complete" });
            }
            continue;
          }
          if ((frame.flags & 0x01) !== 0) {
            responseDiagnostics.push(cursorFrameMetadata(frame.payload, frame.flags));
            queue.fail(protocolError("Cursor returned a compressed protobuf frame", "CURSOR_COMPRESSED_RESPONSE"));
            continue;
          }
          const kv = decodeCursorKvRequest(frame.payload);
          if (kv) {
            try {
              stream?.write(Buffer.from(encodeKvResponse(kv, encoded.blobs)));
            } catch (error) {
              queue.fail(error);
            }
            continue;
          }
          const toolCall = decodeCursorToolMessage(frame.payload);
          if (toolCall) {
            // The server asked the desktop client to execute a native tool.
            // Failing loudly beats silently dropping the frame and reporting
            // a fabricated empty success.
            queue.fail(protocolError(
              `Cursor AgentService requested an unsupported native tool call`
                + `${toolCall.toolKind ? ` (${toolCall.toolKind})` : ""}`
                + `${toolCall.callId ? ` [${toolCall.callId}]` : ""};`
                + " DSH's Cursor transport does not execute server-side tools",
              "CURSOR_UNSUPPORTED_TOOL_CALL",
            ));
            continue;
          }
          const text = decodeCursorText(frame.payload);
          const turnComplete = cursorTurnComplete(frame.payload);
          if (text) queue.push({ type: "text", text });
          if (!text) responseDiagnostics.push(cursorFrameMetadata(frame.payload, frame.flags));
          if (turnComplete) {
            completed = true;
            queue.push({ type: "complete" });
          }
        }
      });
      stream.once("end", () => {
        if (responseBuffer.byteLength > 0) {
          responseDiagnostics.push({
            payloadLength: responseBuffer.byteLength,
            incomplete: true,
          });
          queue.fail(protocolError("Cursor AgentService returned an incomplete Connect frame", "CURSOR_INCOMPLETE_RESPONSE"));
        } else {
          queue.close();
        }
      });
      stream.once("error", (error) => queue.fail(error));
      stream.write(Buffer.from(encoded.frame));
      heartbeat = setInterval(() => {
        if (!stream || stream.destroyed || stream.closed) return;
        try { stream.write(Buffer.from(encodeHeartbeat())); } catch { /* stream is closing */ }
      }, 5_000);
      let text = "";
      let failed = false;
      yield { type: "block-start", index: 0, blockType: "text" };
      try {
        for await (const item of queue) {
          if (item.type === "text") {
            text += item.text;
            yield { type: "text-delta", index: 0, text: item.text };
          } else if (item.type === "complete") {
            completed = true;
            break;
          }
        }
      } catch (error) {
        failed = true;
        if (error?.status === 401 || error?.status === 403) error.authExpired = error.status === 401;
        throw error;
      } finally {
        cleanup();
      }
      if (!failed) {
        if (!completed) {
          throw protocolError("Cursor AgentService ended before completing the turn", "CURSOR_INCOMPLETE_RESPONSE");
        }
        if (text.trim().length === 0) {
          throw protocolError("Cursor AgentService completed without assistant text", "CURSOR_EMPTY_RESPONSE");
        }
        yield { type: "block-end", index: 0, block: { type: "text", text } };
        yield { type: "finish", reason: { kind: "stop" } };
      }
    } catch (error) {
      cleanup();
      throw error;
    }
  })();
}

export function createCursorNativeExecutor({
  endpoint = process.env.DOCKYARD_CURSOR_ENDPOINT || DEFAULT_ENDPOINT,
  env = process.env,
  home = homedir(),
  tokenResolver = resolveCursorAccessToken,
  http2Module = http2,
  timeoutMs = Number(process.env.DOCKYARD_CURSOR_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs = Number(process.env.DOCKYARD_CURSOR_IDLE_TIMEOUT_MS) || DEFAULT_IDLE_TIMEOUT_MS,
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint, { providerId: PROVIDER_ID });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    if (context.secretStore) {
      const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
      if (ref) credential = await context.secretStore.read(ref);
    }
    const auth = await tokenResolver({ credential, env: { ...env, ...(context.env ?? {}) }, home });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID, "Cursor OAuth token is unavailable; authorize Cursor first");
      error.authExpired = true;
      throw error;
    }
    if (auth.expiresAt) {
      const expiry = Date.parse(auth.expiresAt);
      if (Number.isFinite(expiry) && expiry <= Date.now()) {
        const error = nativeProviderError(PROVIDER_ID, "Cursor OAuth access token expired; authorize Cursor again", {
          code: "CURSOR_TOKEN_EXPIRED",
        });
        error.authExpired = true;
        throw error;
      }
    }
    return streamCursor({
      endpoint: safeEndpoint,
      token: auth.token,
      request,
      context,
      http2Module,
      timeoutMs,
      idleTimeoutMs,
    });
  };
  executor.nativeTransport = "cursor-connect-agent-service";
  return executor;
}

export const cursorNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID,
  endpoint: DEFAULT_ENDPOINT,
  clientVersion: DEFAULT_CURSOR_CLIENT_VERSION,
  totalTimeoutMs: DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
});
