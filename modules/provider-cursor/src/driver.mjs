import { createHash, randomBytes, randomUUID } from "node:crypto";
import { homedir } from "node:os";

import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import { createBrowserOAuthAuthorizer } from "../../../packages/oauth/src/browser-oauth-authorizer.mjs";
import { createCliStatusAuthorizer } from "../../../packages/oauth/src/cli-status-authorizer.mjs";
import { createOfficialSessionAuthorizer } from "../../../packages/oauth/src/official-session-authorizer.mjs";
import {
  cliRequestPrompt,
  createCliAgentExecutor,
  parseJsonOutput,
  runCliCommand,
} from "../../../packages/providers/src/cli-agent-transport.mjs";
import {
  decodeJwtPayload,
  recursiveQuotaWindows,
  selectPrimaryQuotaWindow,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import { readCursorDesktopSession } from "./native-transport.mjs";
import {
  OFFICIAL_SESSION_AUTH_KIND,
  OFFICIAL_SESSION_SOURCE_KINDS,
  normalizeOfficialSessionResult,
  officialSessionResources,
} from "../../../packages/providers/src/session-source.mjs";

const PROVIDER_ID = "cursor";
const CREDENTIAL_SLOT = Symbol("dockyard-cursor-session");

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

function normalizeTokenExpiry(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cursorTokenExpiresAt(raw = {}, payload = {}) {
  const direct = normalizeTokenExpiry(raw.expiresAt ?? raw.expires_at);
  if (direct) return direct;
  const expiresIn = raw.expiresIn ?? raw.expires_in;
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1000).toISOString();
  }
  return normalizeTokenExpiry(payload.exp);
}

function tokenIsExpired(value, now = Date.now()) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now;
}

function tokenNeedsRefresh(value, now = Date.now(), leewayMs = 60_000) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now + leewayMs;
}

function statusObject(output) {
  return parseJsonOutput(output) ?? {};
}

function statusValue(value, ...keys) {
  for (const key of keys) {
    const parts = key.split(".");
    let current = value;
    for (const part of parts) current = current?.[part];
    if (typeof current === "string" && current.length > 0) return current;
    if (typeof current === "number" || typeof current === "boolean") return current;
    if (Array.isArray(current)) return current;
    if (current && typeof current === "object") return current;
  }
  return null;
}

function parseTextEmail(output) {
  return String(output).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

/** Parse only Cursor's public status output; credentials are never scraped. */
export function parseCursorAuthStatus(output) {
  const raw = statusObject(output);
  const email = firstString(
    statusValue(raw, "email", "user.email", "account.email", "accountEmail"),
    parseTextEmail(output),
  );
  const explicitLoggedIn = statusValue(raw, "loggedIn", "authenticated", "isAuthenticated");
  const text = String(output);
  const loggedIn = typeof explicitLoggedIn === "boolean"
    ? explicitLoggedIn
    : !/not authenticated|not logged in|unauthenticated|please login/i.test(text)
      && /authenticated|logged in|account|endpoint/i.test(text);
  const accountId = firstString(
    statusValue(raw, "accountId", "account_id", "userId", "user_id", "user.id", "account.id"),
    email,
    "cursor:active",
  );
  const plan = firstString(
    statusValue(raw, "plan", "planName", "subscription.plan", "subscription.name", "tier", "subscriptionTier"),
  );
  const displayName = firstString(statusValue(raw, "name", "user.name", "account.name"), email, accountId);
  const models = [
    statusValue(raw, "models"),
    statusValue(raw, "availableModels"),
    statusValue(raw, "modelCatalog"),
  ].find((value) => Array.isArray(value)) ?? [];
  return {
    loggedIn,
    accountId,
    email,
    plan,
    displayName,
    models,
    raw,
  };
}

function activeSessionError(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}

function candidateFromStatus(status, {
  source = "official_cursor_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  imported = false,
  credential = null,
} = {}) {
  const credentialRef = createCredentialRef(PROVIDER_ID, status.accountId);
  const candidate = {
    candidateId: `cursor:${hash(status.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId: status.accountId,
    displayName: status.displayName ?? status.accountId,
    email: status.email,
    subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: null,
      nextRefreshAt: null,
      lastRefreshedAt: null,
      refreshable: false,
    },
    credentialRef,
    resources: officialSessionResources({ sourceKind, authSource: source }),
    imported,
    status: status.loggedIn ? "available" : "degraded",
    diagnostic: status.loggedIn ? null : "Cursor 官方会话当前未返回已登录状态",
  };
  Object.defineProperty(candidate, CREDENTIAL_SLOT, {
    value: credential ?? {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID,
      accountId: status.accountId,
      sourceKind,
    },
    enumerable: false,
  });
  return candidate;
}

async function resolveCursorBrowserEmail(raw, access, {
  fetchImpl = null,
  apiBaseUrl = "https://api2.cursor.sh",
  home = homedir(),
  signal,
} = {}) {
  const payload = decodeJwtPayload(access) ?? {};
  const direct = firstString(
    raw?.email,
    raw?.user?.email,
    raw?.profile?.email,
    payload.email,
    payload.user_email,
    payload.email_address,
    payload["https://cursor.com/email"],
  );
  if (direct) return direct;

  // Cursor Desktop keeps the same account's cached email locally. This is a
  // compatibility fallback for browser responses whose JWT only contains the
  // Auth0 subject (for example google-oauth2|user_...).
  try {
    const desktop = readCursorDesktopSession({ home });
    if (desktop?.email) return desktop.email;
  } catch {
    // Continue to Cursor's first-party identity RPC below.
  }

  if (typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, "")}/aiserver.v1.AuthService/GetEmail`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${access}`,
      },
      body: "{}",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({}));
    return firstString(body?.email, body?.user?.email, body?.profile?.email);
  } catch {
    return null;
  }
}

async function candidateFromBrowserTokens(raw, options = {}) {
  const access = firstString(raw?.accessToken, raw?.access_token);
  const refresh = firstString(raw?.refreshToken, raw?.refresh_token);
  if (!access || !refresh) throw new Error("Cursor browser login did not return access and refresh tokens");
  const payload = decodeJwtPayload(access) ?? {};
  const expiresAt = cursorTokenExpiresAt(raw, payload);
  const email = await resolveCursorBrowserEmail(raw, access, options);
  const accountId = firstString(raw.accountId, raw.account_id, raw.userId, raw.user_id, payload.sub, payload.user_id, email)
    ?? `cursor:${hash(access).slice(0, 20)}`;
  const candidate = candidateFromStatus({
    loggedIn: true,
    accountId,
    email,
    plan: firstString(raw.plan, raw.subscription?.plan, raw.membershipType, payload.plan),
    displayName: firstString(raw.name, raw.user?.name, email, accountId),
  }, {
    source: "official_cursor_browser_oauth",
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    credential: {
      type: "oauth",
      providerId: PROVIDER_ID,
      accountId,
      access,
      refresh,
      ...(expiresAt ? { expiresAt } : {}),
      email,
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    },
  });
  candidate.refresh = {
    ...candidate.refresh,
    accessTokenExpiresAt: expiresAt,
    refreshable: true,
  };
  return candidate;
}

function desktopSessionAccountId(session) {
  return session.email ? `cursor:${hash(session.email.toLowerCase()).slice(0, 20)}` : "cursor:desktop";
}

function statusFromDesktopSession(session) {
  return {
    source: "cursor_desktop_app",
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    loggedIn: true,
    accountId: session.accountId,
    email: session.email,
    plan: session.plan,
    displayName: session.email ?? "Cursor desktop session",
    models: [],
    raw: {
      source: "cursor_desktop_app",
      loggedIn: true,
      email: session.email,
      plan: session.plan,
    },
  };
}

function candidateFromDesktopSession(session) {
  const accountId = session.accountId ?? desktopSessionAccountId(session);
  const expiresAt = cursorTokenExpiresAt({}, decodeJwtPayload(session.token) ?? {});
  const candidate = {
    candidateId: `cursor:desktop:${hash(accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source: "cursor_desktop_app",
    accountId,
    displayName: session.email ?? "Cursor desktop session",
    email: session.email,
    subscription: { plan: session.plan, status: "active", expiresAt: null },
    refresh: {
      accessTokenExpiresAt: expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: null,
      refreshable: Boolean(session.refreshToken),
    },
    credentialRef: createCredentialRef(PROVIDER_ID, accountId),
    imported: false,
    status: "available",
    diagnostic: null,
    resources: {
      ...officialSessionResources({
        sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
        authSource: "cursor_desktop_app",
      }),
      transport: "cursor_connect_agent_service",
      identitySource: "cursor_desktop_app",
      sessionPersistence: "captured",
      quotaSource: "cursor_desktop_app",
    },
  };
  Object.defineProperty(candidate, CREDENTIAL_SLOT, {
    value: {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID,
      accountId,
      access: session.token,
      ...(session.refreshToken ? { refresh: session.refreshToken } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    },
    enumerable: false,
  });
  return candidate;
}

export function summarizeCursorCandidate(candidate) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate.candidateId,
    source: candidate.source,
    accountId: candidate.accountId,
    displayName: candidate.displayName,
    email: candidate.email,
    subscription: { ...candidate.subscription },
    refresh: { ...candidate.refresh },
    imported: Boolean(candidate.imported),
    status: candidate.status ?? "available",
    diagnostic: candidate.diagnostic ?? null,
  };
}

function normalizeModel(value) {
  if (typeof value === "string") return { id: value, name: value };
  if (!value || typeof value !== "object") return null;
  const id = firstString(value.id, value.model, value.modelId, value.name);
  if (!id) return null;
  const contextWindow = value.contextWindow
    ?? value.context_window
    ?? value.contextTokenLimit
    ?? value.context_token_limit;
  const maxTokens = value.maxTokens
    ?? value.max_tokens
    ?? value.maxOutputTokens
    ?? value.max_output_tokens;
  const inputModalities = value.input
    ?? value.inputModalities
    ?? value.input_modalities
    ?? (value.supportsImages || value.supports_images ? ["text", "image"] : null);
  return {
    id,
    name: firstString(
      value.clientDisplayName,
      value.client_display_name,
      value.displayName,
      value.display_name,
      value.name,
      value.label,
      id,
    ),
    ...(Number.isInteger(contextWindow) ? { contextWindow } : {}),
    ...(Number.isInteger(maxTokens) ? { maxTokens } : {}),
    ...(Array.isArray(inputModalities) ? { inputModalities: [...inputModalities] } : {}),
    ...(value.reasoning ? { reasoning: value.reasoning } : {}),
    ...(value.supportsThinking || value.supports_thinking ? { reasoning: { supported: true } } : {}),
  };
}

function browserCatalogAccount(accounts) {
  return (Array.isArray(accounts) ? accounts : []).find((entry) => (
    entry?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
    || entry?.resources?.authSource === "official_cursor_browser_oauth"
  ));
}

export function createCursorCatalogLoader({
  cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
  env = process.env,
  commandRunner = runCliCommand,
  apiBaseUrl = process.env.CURSOR_API_BASE_URL || "https://api2.cursor.sh",
  fetchImpl = fetch,
} = {}) {
  // Catalog state is bucketed per browser account (by credential identity):
  // a single global cached/pending pair let concurrent multi-account loads
  // overwrite each other's results.
  const cachedBuckets = new Map();
  const pendingBuckets = new Map();
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "");

  function catalogBucketKey(accounts) {
    const account = browserCatalogAccount(accounts);
    const identity = account?.auth?.credentialRef ?? account?.credentialRef ?? account?.accountId;
    return identity ? String(identity) : "shared";
  }

  async function loadBrowserCatalog({ accounts, secretStore, signal }) {
    const account = browserCatalogAccount(accounts);
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    if (!account || !credentialRef || typeof secretStore?.read !== "function") return null;
    const credential = await secretStore.read(credentialRef);
    if (!credential?.access) return null;
    const response = await fetchImpl(`${normalizedApiBaseUrl}/aiserver.v1.AiService/AvailableModels`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${credential.access}`,
      },
      body: JSON.stringify({
        isNightly: false,
        excludeMaxNamedModels: true,
        additionalModelNames: [],
        useModelParameters: true,
        useReactModelPicker: true,
      }),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({}));
    const values = Array.isArray(body?.models)
      ? body.models
      : body?.modelNames ?? body?.model_names;
    const models = (Array.isArray(values) ? values : []).map(normalizeModel).filter(Boolean);
    if (models.length === 0) return null;
    return {
      models,
      source: "official_cursor_browser_oauth_api",
    };
  }

  return async function loadCatalog({ force = false, accounts = [], secretStore, signal } = {}) {
    const bucketKey = catalogBucketKey(accounts);
    const hasBrowserAccount = bucketKey !== "shared";
    const cached = cachedBuckets.get(bucketKey);
    if (!force && cached && (
      hasBrowserAccount
        ? cached.source === "official_cursor_browser_oauth_api"
        : cached.source !== "official_cursor_browser_oauth_api"
    )) return cached;
    const pending = pendingBuckets.get(bucketKey);
    if (!force && pending) return pending;
    const promise = (async () => {
      try {
        const browser = await loadBrowserCatalog({ accounts, secretStore, signal });
        if (browser) {
          cachedBuckets.set(bucketKey, browser);
          return browser;
        }
      } catch {
        // Fall through to the official CLI status compatibility path.
      }
      try {
        const result = await commandRunner(cliPath, ["status"], {
          env,
          providerId: PROVIDER_ID,
          timeoutMs: 30_000,
          ...(signal ? { signal } : {}),
        });
        const status = parseCursorAuthStatus(result.output);
        const models = status.models.map(normalizeModel).filter(Boolean);
        const catalog = {
          models,
          source: "official_cursor_cli_status",
          ...(models.length ? {} : { diagnostics: ["Cursor 官方 status 没有返回模型目录"] }),
        };
        if (models.length) cachedBuckets.set(bucketKey, catalog);
        else cachedBuckets.delete(bucketKey);
        return catalog;
      } catch (error) {
        const desktop = readCursorDesktopSession({ env });
        const catalog = {
          models: [],
          source: error?.code === "ENOENT"
            ? (desktop ? "cursor_desktop_app" : "cursor_cli_not_found")
            : "official_cursor_cli_status",
          diagnostics: [desktop
            ? "已检测到 Cursor 官方 OAuth；官方模型目录请求未返回结果"
            : `无法读取 Cursor 官方模型目录：${error.message}`],
        };
        cachedBuckets.delete(bucketKey);
        return catalog;
      }
    })().finally(() => {
      if (pendingBuckets.get(bucketKey) === promise) pendingBuckets.delete(bucketKey);
    });
    pendingBuckets.set(bucketKey, promise);
    return promise;
  };
}

export function createCursorCliExecutor({
  cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
  env = process.env,
  timeoutMs = 300_000,
  streamCommandRunner,
} = {}) {
  return createCliAgentExecutor({
    providerId: PROVIDER_ID,
    cliPath,
    env,
    timeoutMs,
    ...(streamCommandRunner ? { streamCommandRunner } : {}),
    buildArgs: ({ request, prompt }) => {
      const args = ["-p", prompt, "--output-format", "stream-json"];
      if (typeof request.model === "string" && request.model.length > 0) args.push("--model", request.model);
      return args;
    },
  });
}

export class CursorSubscriptionDriver {
  constructor({
    cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
    env = process.env,
    home = homedir(),
    commandRunner = runCliCommand,
    requestExecutor = null,
    catalogLoader = null,
    sessionReader = null,
    sessionSource = "official_cursor_client",
    sessionSourceKind = OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CURSOR_BROWSER_OAUTH !== "0",
    websiteUrl = env.CURSOR_WEBSITE_URL || "https://cursor.com",
    apiBaseUrl = env.CURSOR_API_BASE_URL || "https://api2.cursor.sh",
    refreshUrl = env.CURSOR_REFRESH_URL || `${apiBaseUrl}/auth/exchange_user_api_key`,
    fetchImpl = fetch,
  } = {}) {
    this.cliPath = cliPath;
    this.env = env;
    this.home = home;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.websiteUrl = websiteUrl.replace(/\/+$/, "");
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    const refreshEndpoint = new URL(refreshUrl);
    if (refreshEndpoint.protocol !== "https:") {
      throw new Error("Cursor OAuth refresh endpoint must use HTTPS");
    }
    this.refreshUrl = refreshEndpoint.toString().replace(/\/$/, "");
    this.sessionReader = sessionReader;
    this.sessionSource = sessionSource;
    this.sessionSourceKind = sessionSourceKind;
    this.catalogLoader = catalogLoader ?? createCursorCatalogLoader({
      cliPath,
      env,
      commandRunner,
      apiBaseUrl: this.apiBaseUrl,
      fetchImpl: this.fetchImpl,
    });
    this.clientSessionAuthorizer = createOfficialSessionAuthorizer({
      providerId: PROVIDER_ID,
      source: sessionSource,
      instructions: "请在 Cursor 官方客户端完成登录，完成后回到 Dockyard DSH。",
      readSession: async (context = {}) => {
        const status = this.sessionReader
          ? await this.#readStatus(context.signal)
          : (() => {
            const desktop = this.#readDesktopSession();
            return desktop ? statusFromDesktopSession(desktop) : null;
          })();
        if (!status?.loggedIn) return { accounts: [] };
        const desktop = status.source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
        const candidate = desktop
          ? candidateFromDesktopSession(desktop)
          : candidateFromStatus(status, { source: status.source, sourceKind: status.sourceKind });
        return { accounts: [await this.importAccount(candidate, context)] };
      },
    });
    this.cliAuthorizer = createCliStatusAuthorizer({
      providerId: PROVIDER_ID,
      cliPath,
      loginArgs: ["login"],
      environment: env,
      browserOpened: true,
      instructions: "已启动官方 Cursor CLI OAuth 登录。请在 Cursor 官方网页完成登录，完成后回到 Dockyard DSH。",
      importStatus: async (context) => {
        const status = await this.#readStatus();
        if (!status.loggedIn) return [];
        return [await this.importAccount(candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind,
        }), context)];
      },
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth
      ? createBrowserOAuthAuthorizer({
        providerId: PROVIDER_ID,
        instructions: "请在官方 Cursor 授权页面选择账号并完成授权；完成后会自动返回 Dockyard DSH。",
        authorizationUrlBuilder: async () => {
          const verifier = randomBytes(32).toString("base64url");
          const challenge = createHash("sha256").update(verifier).digest("base64url");
          const uuid = randomUUID();
          return {
            url: `${this.websiteUrl}/loginDeepControl?${new URLSearchParams({
              challenge,
              uuid,
              mode: "login",
              redirectTarget: "cli",
            })}`,
            metadata: { uuid, verifier },
          };
        },
        pollSession: async ({ metadata, context }) => {
          if (!metadata?.uuid || !metadata.verifier) return null;
          const response = await this.fetchImpl(`${this.apiBaseUrl}/auth/poll?${new URLSearchParams({
            uuid: metadata.uuid,
            verifier: metadata.verifier,
          })}`, {
            headers: { "content-type": "application/json" },
            ...(context.signal ? { signal: context.signal } : {}),
          });
          if (response.status === 404) return null;
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(`Cursor browser OAuth polling failed (${response.status})`);
          return body?.accessToken && body?.refreshToken ? body : null;
        },
        importCredentials: async (raw, context) => [await this.importAccount(await candidateFromBrowserTokens(raw, {
           fetchImpl: this.fetchImpl,
           apiBaseUrl: this.apiBaseUrl,
           home: this.home,
           signal: context.signal,
         }), context)],
      })
      : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }

  #readDesktopSession() {
    const session = readCursorDesktopSession({ env: this.env, home: this.home });
    if (!session?.token || session.source !== "cursor_desktop_app") return null;
    return {
      ...session,
      accountId: desktopSessionAccountId(session),
    };
  }

  #statusFromResult(result, defaults = {}) {
    const normalized = normalizeOfficialSessionResult(result, {
      source: defaults.source ?? "official_cursor_cli",
      sourceKind: defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
    });
    const status = parseCursorAuthStatus(normalized?.output ?? "");
    return {
      ...status,
      source: normalized?.source ?? defaults.source ?? "official_cursor_cli",
      sourceKind: normalized?.sourceKind ?? defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
    };
  }

  async #readStatus(signal) {
    if (typeof this.sessionReader === "function") {
      try {
        const value = await this.sessionReader({ env: this.env, home: this.home, signal });
        const normalized = normalizeOfficialSessionResult(value, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind,
        });
        if (normalized) return this.#statusFromResult(normalized, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind,
        });
      } catch {
        // Fall through to the official CLI or desktop database reader.
      }
    }
    try {
      const result = await this.commandRunner(this.cliPath, ["status"], {
        env: this.env,
        providerId: PROVIDER_ID,
        timeoutMs: 30_000,
        ...(signal ? { signal } : {}),
      });
      const status = this.#statusFromResult(result, {
        source: "official_cursor_cli",
        sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.CLI,
      });
      if (status.loggedIn) return status;
      const desktop = this.#readDesktopSession();
      return desktop ? statusFromDesktopSession(desktop) : status;
    } catch (error) {
      const desktop = this.#readDesktopSession();
      if (desktop) return statusFromDesktopSession(desktop);
      throw error;
    }
  }

  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_cursor_browser_oauth"
      || account?.refresh?.refreshable === true;
  }

  async #refreshBrowserCredential(account, context = {}) {
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    const credential = context.secretStore && credentialRef
      ? await context.secretStore.read(credentialRef)
      : null;
    if (!credential?.access) throw activeSessionError("Cursor browser OAuth credential is missing; authorize again");
    const expiresAt = cursorTokenExpiresAt(credential, decodeJwtPayload(credential.access) ?? {});
    const now = context.now instanceof Date ? context.now.getTime() : Date.now();
    if (!tokenNeedsRefresh(expiresAt, now)) return credential;
    if (!credential.refresh) throw activeSessionError("Cursor browser OAuth token expired; authorize again");

    let response;
    try {
      response = await this.fetchImpl(this.refreshUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential.refresh}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: "{}",
        ...(context.signal ? { signal: context.signal } : {}),
      });
    } catch (error) {
      const wrapped = activeSessionError("Cursor browser OAuth access token expired and refresh failed; authorize again");
      wrapped.cause = error;
      throw wrapped;
    }
    const body = await response.json().catch(() => ({}));
    const access = firstString(body?.accessToken, body?.access_token);
    if (!response.ok || !access) {
      const error = activeSessionError("Cursor browser OAuth access token expired and refresh failed; authorize again");
      error.status = response.status;
      throw error;
    }
    const refresh = firstString(body?.refreshToken, body?.refresh_token, credential.refresh);
    const refreshedExpiresAt = cursorTokenExpiresAt({
      expiresAt: body?.expiresAt ?? body?.expires_at,
      expiresIn: body?.expiresIn ?? body?.expires_in,
    }, decodeJwtPayload(access) ?? {});
    const updated = {
      ...credential,
      access,
      refresh,
      ...(refreshedExpiresAt ? { expiresAt: refreshedExpiresAt } : {}),
      lastRefreshedAt: new Date(now).toISOString(),
    };
    await context.secretStore.write(credentialRef, updated);
    return updated;
  }

  async #browserStatus(account, context = {}) {
    const credential = await this.#refreshBrowserCredential(account, context);
    const expiresAt = cursorTokenExpiresAt(credential, decodeJwtPayload(credential.access) ?? {});
    if (tokenIsExpired(expiresAt)) {
      throw activeSessionError("Cursor browser OAuth access token expired; authorize again");
    }
    const email = account.email ?? await resolveCursorBrowserEmail({}, credential.access, {
      fetchImpl: this.fetchImpl,
      apiBaseUrl: this.apiBaseUrl,
      home: this.home,
      signal: context.signal,
    });
    return {
      loggedIn: true,
      accountId: account.accountId,
      email,
      displayName: email ?? account.displayName,
      plan: account.subscription?.plan ?? null,
      credential,
      raw: {},
    };
  }

  async #assertActiveSession(account, signal, context = {}) {
    if (this.#isBrowserAccount(account)) return this.#browserStatus(account, context);
    const status = await this.#readStatus(signal);
    if (!status.loggedIn) throw activeSessionError("Cursor OAuth session is not active; authorize again");
    if (account?.accountId !== status.accountId && account?.accountId !== "cursor:active") {
      throw activeSessionError(
        "Cursor only exposes its active official session; authorize the selected account again",
        { mismatch: true },
      );
    }
    return status;
  }

  async discover() {
    try {
      const status = await this.#readStatus();
      const source = status.source ?? "official_cursor_cli";
      if (!status.loggedIn) return { candidates: [], source, diagnostics: ["Cursor 官方环境当前未登录"] };
      const desktop = source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
      const candidate = desktop
        ? candidateFromDesktopSession(desktop)
        : candidateFromStatus(status, { source, sourceKind: status.sourceKind });
      return { candidates: candidate ? [candidate] : [], source, diagnostics: [] };
    } catch (error) {
      return { candidates: [], source: "official_cursor_cli", diagnostics: [`无法读取 Cursor 官方登录态：${error.message}`] };
    }
  }

  async importAccount(candidate, context = {}) {
    const session = candidate?.[CREDENTIAL_SLOT];
    if (!session) throw new Error("Cursor candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(candidate.credentialRef, session);
    return {
      providerId: PROVIDER_ID,
      accountId: candidate.accountId,
      credentialRef: candidate.credentialRef,
      displayName: candidate.displayName,
      email: candidate.email,
      auth: {
        kind: OFFICIAL_SESSION_AUTH_KIND,
        scopes: [],
      },
      subscription: { ...candidate.subscription },
      refresh: { ...candidate.refresh },
      resources: {
        ...officialSessionResources({
          sourceKind: candidate.resources?.sessionSource
            ?? (candidate.source === "cursor_desktop_app"
              ? OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP
              : OFFICIAL_SESSION_SOURCE_KINDS.CLI),
          authSource: candidate.source,
        }),
        transport: "cursor_agentservice_connect_proto",
        quotaSource: candidate.resources?.quotaSource ?? "official_cursor_cli_status",
        ...(candidate.resources ?? {}),
      },
    };
  }

  async getActiveSession(context = {}) {
    try {
      const status = await this.#readStatus(context.signal);
      if (!status.loggedIn) return null;
      const desktop = status.source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
      const candidate = desktop
        ? candidateFromDesktopSession(desktop)
        : candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind,
        });
      const account = await this.importAccount(candidate, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID,
        instructions: "已检测到 Cursor 官方会话，当前账号已接入 Dockyard DSH。",
        accounts: [account],
        diagnostic: null,
      };
    } catch {
      return null;
    }
  }

  async startAuthorization(context = {}) {
    // Add/Login is always a new browser account flow. Existing desktop/CLI
    // sessions remain available through getActiveSession/scan, not this path.
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }

  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:")
      ? this.clientSessionAuthorizer
      : sessionId?.includes(":browser:")
        ? this.browserAuthorizer
        : this.oauthAuthorizer === this.browserAuthorizer
          ? this.cliAuthorizer
          : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }

  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:")
      ? this.clientSessionAuthorizer
      : sessionId?.includes(":browser:")
        ? this.browserAuthorizer
        : this.oauthAuthorizer === this.browserAuthorizer
          ? this.cliAuthorizer
          : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }

  async refreshAccount(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    return {
      identity: { email: status.email, displayName: status.displayName },
      subscription: { plan: status.plan, status: "active", expiresAt: null },
      refresh: {
        accessTokenExpiresAt: this.#isBrowserAccount(account)
          ? cursorTokenExpiresAt(status.credential, decodeJwtPayload(status.credential?.access ?? "") ?? {})
          : account.refresh?.accessTokenExpiresAt ?? null,
        lastRefreshedAt: (context.now instanceof Date ? context.now : new Date()).toISOString(),
        refreshable: this.#isBrowserAccount(account) ? Boolean(status.credential?.refresh) : false,
      },
    };
  }

  async getQuota(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    const now = context.now instanceof Date ? context.now : new Date();
    const quotaSource = this.#isBrowserAccount(account) ? "official_cursor_browser_oauth" : "cursor_cli_status";
    const windows = recursiveQuotaWindows(status.raw, { source: quotaSource, now, prefix: "cursor" });
    if (windows.length === 0) {
      // Browser OAuth accounts (and CLI statuses without window data) return
      // an empty status.raw. Report the quota surface as explicitly
      // unavailable instead of fabricating an empty success while the module
      // still advertises a quota capability for account types that do expose
      // real windows.
      return {
        quota: null,
        subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
        resources: {
          quotaSource,
          quotaAvailable: false,
          quotaDiagnostic: this.#isBrowserAccount(account)
            ? "Cursor 官方浏览器会话未返回任何实时额度窗口；额度数据暂不可用（degraded），请以 Cursor 官方 Dashboard 为准"
            : "Cursor 官方 CLI status 未返回任何实时额度窗口；额度数据暂不可用（degraded），请以 Cursor 官方 Dashboard 为准",
        },
      };
    }
    const primary = selectPrimaryQuotaWindow(windows);
    return {
      quota: {
        remaining: primary.remaining ?? null,
        limit: primary.limit ?? null,
        unit: primary.unit ?? null,
        resetAt: primary.resetAt ?? null,
        windows,
        updatedAt: now.toISOString(),
        source: quotaSource,
      },
      subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
      resources: {
        quotaAvailable: true,
        quotaDiagnostic: null,
      },
    };
  }

  async getCatalog(context = {}) {
    return this.catalogLoader({
      force: Boolean(context.force),
      accounts: context.accounts,
      secretStore: context.secretStore,
      signal: context.signal,
    });
  }

  async invoke(request, invocation, context = {}) {
    await this.#assertActiveSession(invocation?.account, context.signal, context);
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Cursor native invocation transport is not mounted");
    return executor({ request, invocation, context });
  }

  async stream(request, invocation, context = {}) { return this.invoke(request, invocation, context); }
}

export function createCursorDriver(options = {}) { return new CursorSubscriptionDriver(options); }

export const cursorDriverConstants = Object.freeze({ providerId: PROVIDER_ID });
