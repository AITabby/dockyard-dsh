import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnCli } from "../../providers/src/win32-command.mjs";

import { redactError } from "../../providers/src/provider-utils.mjs";
import { extractSafeAuthorizationUrl } from "./cli-url-sanitizer.mjs";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
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
 * Run a provider's own OAuth login command.
 *
 * The provider owns the command, environment key, auth-file format, and
 * credential import callback. This package never parses or forwards tokens;
 * it only tracks the local login process and hands its completed auth file
 * back to the provider module. By default the command receives an isolated
 * temporary profile. Providers whose CLI owns its normal browser flow can
 * opt into a provider-owned profile and tell the caller that the browser has
 * already been opened by the CLI.
 */
export function createCliOAuthAuthorizer({
  providerId,
  cliPath,
  loginArgs,
  environmentKey,
  authFileName = "auth.json",
  environment = process.env,
  profilePrefix = `dockyard-${providerId ?? "provider"}-oauth-`,
  instructions = "请在官方授权页面完成登录，完成后回到 Dockyard DSH。",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  importCredentials,
  profileDirectory = null,
  browserOpened = false,
} = {}) {
  if (!providerId) throw new Error("CLI OAuth authorizer requires providerId");
  if (!cliPath) throw new Error(`CLI OAuth authorizer requires a ${providerId} CLI path`);
  if (!Array.isArray(loginArgs) || loginArgs.length === 0) {
    throw new Error(`CLI OAuth authorizer requires login arguments for ${providerId}`);
  }
  if (!environmentKey) throw new Error(`CLI OAuth authorizer requires an environment key for ${providerId}`);
  if (typeof importCredentials !== "function") {
    throw new Error(`CLI OAuth authorizer requires an import callback for ${providerId}`);
  }

  const sessions = new Map();

  async function cleanup(session) {
    if (session.cleanupProfile && session.profileDir) {
      await rm(session.profileDir, { recursive: true, force: true }).catch(() => {});
      session.profileDir = null;
    }
  }

  function captureOutput(session, chunk) {
    const text = String(chunk ?? "");
    session.output = `${session.output}${text}`.slice(-32_000);
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
        let raw;
        try {
          raw = JSON.parse(await readFile(join(session.profileDir, authFileName), "utf8"));
        } catch (error) {
          session.status = "failed";
          session.diagnostic = `官方登录完成，但没有找到可读取的 OAuth 状态：${redactError(error)}`;
          return publicSession(session);
        }
        const accounts = await importCredentials(raw, context);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          session.status = "failed";
          session.diagnostic = "官方登录完成，但 provider 没有返回可接入的账号。";
          return publicSession(session);
        }
        session.status = "completed";
        session.result = {
          ...publicSession(session),
          accounts,
          diagnostic: null,
        };
        return session.result;
      } catch (error) {
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
    const cleanupProfile = !profileDirectory;
    const profileDir = profileDirectory ?? await mkdtemp(join(tmpdir(), profilePrefix));
    if (!cleanupProfile) await mkdir(profileDir, { recursive: true });
    const session = {
      sessionId: `${providerId}:${randomUUID()}`,
      providerId,
      profileDir,
      cleanupProfile,
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
        env: { ...environment, [environmentKey]: profileDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => captureOutput(session, chunk));
      child.stderr?.on("data", (chunk) => captureOutput(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
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
    if (session.timer) clearTimeout(session.timer);
    const result = await finalize(session, context);
    if (result.status !== "pending" && result.status !== "processing") sessions.delete(sessionId);
    return result;
  }

  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    await stopChild(session);
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }

  return Object.freeze({ begin, poll, cancel });
}

export const cliOAuthAuthorizerConstants = Object.freeze({ defaultTimeoutMs: DEFAULT_TIMEOUT_MS });
