import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { redactError } from "../../providers/src/provider-utils.mjs";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_CALLBACK_PATH = "/oauth/callback";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function publicSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status,
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...(session.browserOpened ? { browserOpened: true } : {}),
    ...(session.authorizationCodeRequired ? { authorizationCodeRequired: true } : {}),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHostname(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return LOOPBACK_HOSTNAMES.has(bare);
}

/**
 * OAuth 回调服务只能绑定本机回环地址。任何非 loopback 的 callbackHost
 * （例如 0.0.0.0 或局域网地址）都会让携带授权码的回调暴露到网络，直接拒绝。
 */
function assertSafeCallbackHost(host) {
  const value = String(host ?? "").trim();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value.toLowerCase();
  if (!isLoopbackHostname(bare)) {
    throw new Error(`OAuth callback host must be loopback (localhost / 127.0.0.1 / ::1), got: ${value || "<empty>"}`);
  }
}

function resolveLoopbackListenHost(host) {
  const bare = String(host ?? "").trim().toLowerCase();
  return bare === "::1" || bare === "[::1]" ? "::1" : "127.0.0.1";
}

function missingSession(sessionId, providerId, instructions) {
  return {
    sessionId,
    providerId,
    status: "missing",
    instructions,
    diagnostic: "OAuth 登录会话不存在或已结束，请重新点击登录添加账号。",
  };
}

function extractCodeInput(input) {
  const text = String(input ?? "").trim();
  if (!text) return { code: "", state: "" };
  try {
    const url = new URL(text);
    return {
      code: url.searchParams.get("code") ?? "",
      state: url.searchParams.get("state") ?? "",
      error: url.searchParams.get("error") ?? "",
    };
  } catch {
    const [code, state] = text.split("#", 2);
    return { code: code.trim(), state: state?.trim() ?? "" };
  }
}

/**
 * Provider-neutral browser OAuth controller. Providers supply only their
 * registered OAuth endpoints and token/account adapters; this layer owns PKCE,
 * state validation, loopback callbacks, manual code input, and cleanup.
 */
export function createBrowserOAuthAuthorizer({
  providerId,
  authorizationUrlBuilder,
  exchangeCode = null,
  pollSession = null,
  importCredentials,
  redirectUri,
  callbackPath = DEFAULT_CALLBACK_PATH,
  callbackHost = "localhost",
  callbackPort = null,
  instructions = "请在官方授权页面选择账号并完成授权。",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  browserOpened = false,
  authorizationCodeRequired = false,
} = {}) {
  if (!providerId) throw new Error("Browser OAuth authorizer requires providerId");
  if (typeof authorizationUrlBuilder !== "function") {
    throw new Error(`Browser OAuth authorizer requires an authorization URL builder for ${providerId}`);
  }
  if (typeof exchangeCode !== "function" && typeof pollSession !== "function") {
    throw new Error(`Browser OAuth authorizer requires a code exchange or session poller for ${providerId}`);
  }
  if (typeof importCredentials !== "function") {
    throw new Error(`Browser OAuth authorizer requires an import callback for ${providerId}`);
  }
  if (!redirectUri && callbackPort === null && typeof pollSession !== "function") {
    throw new Error(`Browser OAuth authorizer requires redirectUri or callbackPort for ${providerId}`);
  }
  assertSafeCallbackHost(callbackHost ?? "localhost");
  if (redirectUri) {
    let parsedRedirectUri = null;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch {
      throw new Error(`Browser OAuth authorizer has an invalid redirectUri for ${providerId}`);
    }
    if (parsedRedirectUri.protocol === "http:" && !isLoopbackHostname(parsedRedirectUri.hostname)) {
      throw new Error(
        `Browser OAuth redirectUri over plain http must use a loopback host for ${providerId}, got: ${parsedRedirectUri.hostname}`,
      );
    }
  }

  const sessions = new Map();

  async function closeServer(session) {
    if (!session.server) return;
    const server = session.server;
    session.server = null;
    await new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    }).catch(() => {});
  }

  async function cleanup(session) {
    if (session.timer) clearTimeout(session.timer);
    await closeServer(session);
  }

  function responseHtml(res, title, message, statusCode = 200) {
    res.statusCode = statusCode;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><p>${escapeHtml(message)}</p><p>可以关闭此页面并返回 Dockyard DSH。</p>`);
  }

  async function handleCallback(session, req, res) {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    if (requestUrl.pathname !== session.callbackPath) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code") ?? "";
    const state = requestUrl.searchParams.get("state") ?? "";
    if (state !== session.state) {
      session.status = "failed";
      session.diagnostic = "OAuth state 校验失败";
      responseHtml(res, "授权未完成", "安全校验失败，可以关闭此页面并重新开始授权。", 400);
      await cleanup(session);
      return;
    }
    if (error) {
      session.callback = { error, state };
      responseHtml(res, "授权未完成", "官方授权被拒绝，可以关闭此页面。");
      return;
    }
    if (!code) {
      session.callback = { error: "授权回调没有返回 code", state };
      responseHtml(res, "授权未完成", "回调缺少授权码，可以关闭此页面。");
      return;
    }
    session.callback = { code, state };
    responseHtml(res, "授权成功", "已收到授权回调，正在返回 Dockyard DSH。");
  }

  async function openCallbackServer(session) {
    if (session.callbackPort === null || session.callbackPort === undefined) return;
    const server = createServer((req, res) => {
      void handleCallback(session, req, res).catch((error) => {
        session.callback = { error: redactError(error) };
        res.statusCode = 500;
        res.end("OAuth callback failed");
      });
    });
    session.server = server;
    const listenOnPort = (port) => new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen({ host: resolveLoopbackListenHost(callbackHost), port });
    });
    try {
      await listenOnPort(session.callbackPort);
    } catch (error) {
      if (error?.code === "EADDRINUSE" && session.callbackPort !== 0) {
        await listenOnPort(0);
      } else {
        throw error;
      }
    }
    server.unref?.();
    const address = server.address();
    if (address && typeof address === "object" && address.port && session.redirectUri) {
      try {
        const parsed = new URL(session.redirectUri);
        if (isLoopbackHostname(parsed.hostname) && Number(parsed.port || 80) !== address.port) {
          parsed.port = String(address.port);
          session.redirectUri = parsed.toString();
        }
      } catch {}
    }
    session.redirectUri = session.redirectUri ?? `http://${callbackHost}:${address.port}${callbackPath}`;
  }

  async function finalize(session, context = {}) {
    if (session.result) return session.result;
    if (session.cancelled || session.status === "cancelled") return publicSession(session);
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        const callback = session.callback;
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        if (!callback && !session.credentials) return publicSession(session);
        if (callback?.error) throw new Error(callback.error);
        const exchanged = session.credentials ?? await exchangeCode({
          code: callback.code,
          state: callback.state,
          codeVerifier: session.codeVerifier,
          redirectUri: session.redirectUri,
          context,
        });
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        const accounts = await importCredentials(exchanged, context);
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          throw new Error("官方授权完成，但 provider 没有返回可接入的订阅账号");
        }
        session.status = "completed";
        session.result = {
          ...publicSession(session),
          accounts,
          diagnostic: null,
        };
        return session.result;
      } catch (error) {
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession(session);
      } finally {
        await cleanup(session);
      }
    })();
    return session.finalizing;
  }

  async function begin() {
    const pkce = createPkce();
    const session = {
      sessionId: `${providerId}:browser:${randomUUID()}`,
      providerId,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: new Date().toISOString(),
      browserOpened,
      authorizationCodeRequired,
      callbackPath,
      callbackPort,
      redirectUri,
      state: base64Url(randomBytes(24)),
      codeVerifier: pkce.verifier,
      callback: null,
      server: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null,
    };
    sessions.set(session.sessionId, session);
    try {
      await openCallbackServer(session);
      session.nonce = base64Url(randomBytes(24));
      const built = await authorizationUrlBuilder({
        state: session.state,
        codeChallenge: pkce.challenge,
        redirectUri: session.redirectUri,
        nonce: session.nonce,
      });
      session.authorizationUrl = typeof built === "string" ? built : built?.url;
      session.metadata = typeof built === "object" ? built.metadata ?? null : null;
      if (!session.authorizationUrl) throw new Error("官方 OAuth 没有返回授权页面地址");
      session.timer = setTimeout(() => {
        if (session.status !== "pending") return;
        session.status = "failed";
        session.diagnostic = "官方 OAuth 登录超时，请重新点击登录添加账号。";
        session.cancelled = true;
        void cleanup(session).finally(() => sessions.delete(session.sessionId));
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.status = "failed";
      session.diagnostic = `无法启动官方浏览器授权：${redactError(error)}`;
      await cleanup(session);
    }
    return publicSession(session);
  }

  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missingSession(sessionId, providerId, instructions);
    if (session.status === "failed" || session.status === "completed") {
      const result = session.result ?? publicSession(session);
      sessions.delete(sessionId);
      return result;
    }
    if (!session.callback && typeof pollSession === "function") {
      try {
        const credentials = await pollSession({ metadata: session.metadata, context });
        if (credentials) session.credentials = credentials;
      } catch (error) {
        session.diagnostic = redactError(error);
      }
    }
    if (!session.callback && !session.credentials) return publicSession(session);
    const result = await finalize(session, context);
    if (!["pending", "processing"].includes(result.status)) sessions.delete(sessionId);
    return result;
  }

  async function submitAuthorizationCode(sessionId, input, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missingSession(sessionId, providerId, instructions);
    const parsed = extractCodeInput(input);
    if (String(input ?? "").length > 8192) {
      session.diagnostic = "授权回调输入过长，请粘贴官方返回的完整回调地址。";
      return publicSession(session);
    }
    if (parsed.state !== session.state) {
      session.status = "failed";
      session.diagnostic = "OAuth state 校验失败，请重新提交当前会话返回的回调地址。";
      await cleanup(session);
      return publicSession(session);
    } else if (parsed.error) {
      session.callback = { error: parsed.error, state: parsed.state };
    } else if (!parsed.code) {
      session.diagnostic = "请粘贴包含 state 的完整回调地址，或使用 code#state 格式。";
      return publicSession(session);
    } else {
      session.callback = { code: parsed.code, state: parsed.state };
    }
    return finalize(session, context);
  }

  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    session.cancelled = true;
    session.status = "cancelled";
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }

  return Object.freeze({ begin, poll, submitAuthorizationCode, cancel });
}

export const browserOAuthAuthorizerConstants = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  defaultCallbackPath: DEFAULT_CALLBACK_PATH,
});
