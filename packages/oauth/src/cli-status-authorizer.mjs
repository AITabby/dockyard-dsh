import { randomUUID } from "node:crypto";
import { spawnCli } from "../../providers/src/win32-command.mjs";

import { redactError } from "../../providers/src/provider-utils.mjs";
import { extractSafeAuthorizationUrl } from "./cli-url-sanitizer.mjs";

const CHILD_STOP_GRACE_MS = 2_000;

function publicSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...(session.browserOpened ? { browserOpened: true } : {}),
  };
}

function stopChild(session) {
  const child = session.child;
  if (!child || session.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (session.exitCode === null) session.exitCode = -1;
      resolve();
    };
    child.once("close", finish);
    if (session.exitCode !== null) {
      finish();
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The process may have exited between the grace timeout and SIGKILL.
      }
      finish();
    }, CHILD_STOP_GRACE_MS);
    timer.unref?.();
  });
}

/**
 * OAuth login for CLIs whose official credentials are stored in the OS
 * keychain or the CLI's own profile instead of an importable auth.json.
 * Completion is verified by the provider's status reader, never by scraping
 * tokens from disk.
 */
export function createCliStatusAuthorizer({
  providerId,
  cliPath,
  loginArgs,
  environment = process.env,
  timeoutMs = 10 * 60 * 1000,
  instructions = "请在官方授权页面完成登录，完成后回到 Dockyard DSH。",
  browserOpened = false,
  importStatus,
} = {}) {
  if (!providerId || !cliPath || !Array.isArray(loginArgs) || loginArgs.length === 0) {
    throw new Error(`Invalid CLI status authorizer configuration for ${providerId ?? "provider"}`);
  }
  if (typeof importStatus !== "function") throw new Error(`Missing status importer for ${providerId}`);
  const sessions = new Map();

  function capture(session, chunk) {
    session.output = `${session.output}${String(chunk ?? "")}`.slice(-32_000);
    if (!session.authorizationUrl) {
      session.authorizationUrl = extractSafeAuthorizationUrl(session.output);
    }
  }

  async function finalize(session, context) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        if (session.timedOut) {
          session.status = "failed";
          session.diagnostic = "官方 OAuth 登录超时，请重新点击登录添加账号。";
          return publicSession(session);
        }
        if (session.launchError) {
          session.status = "failed";
          session.diagnostic = `无法启动官方登录命令：${session.launchError}`;
          return publicSession(session);
        }
        if (session.exitCode !== 0) {
          session.status = "failed";
          session.diagnostic = `官方 OAuth 登录未完成（退出码 ${session.exitCode ?? "unknown"}）。`;
          return publicSession(session);
        }
        const accounts = await importStatus(context);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          session.status = "failed";
          session.diagnostic = "官方登录完成，但 provider status 没有返回可接入的订阅账号。";
          return publicSession(session);
        }
        session.status = "completed";
        session.result = { ...publicSession(session), accounts, diagnostic: null };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession(session);
      } finally {
        if (session.timer) clearTimeout(session.timer);
      }
    })();
    return session.finalizing;
  }

  async function begin() {
    const session = {
      sessionId: `${providerId}:${randomUUID()}`,
      providerId,
      browserOpened,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: new Date().toISOString(),
      exitCode: null,
      launchError: null,
      output: "",
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null,
    };
    sessions.set(session.sessionId, session);
    try {
      const child = spawnCli(cliPath, loginArgs, {
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => capture(session, chunk));
      child.stderr?.on("data", (chunk) => capture(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => { session.exitCode = typeof code === "number" ? code : -1; });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        void stopChild(session);
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicSession(session);
  }

  async function poll(sessionId, context) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId,
        status: "missing",
        instructions,
        diagnostic: "OAuth 登录会话不存在或已结束，请重新点击登录添加账号。",
      };
    }
    if (session.exitCode === null) return publicSession(session);
    const result = await finalize(session, context);
    if (result.status !== "pending" && result.status !== "processing") sessions.delete(sessionId);
    return result;
  }

  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    await stopChild(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }

  return Object.freeze({ begin, poll, cancel });
}
