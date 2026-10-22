import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import { createBrowserOAuthAuthorizer } from "../../../packages/oauth/src/browser-oauth-authorizer.mjs";
import { createCliOAuthAuthorizer } from "../../../packages/oauth/src/cli-oauth-authorizer.mjs";
import {
  addSecondsIso,
  decodeJwtPayload,
  fetchJson,
  isoFromEpoch,
  assertSecureEndpointUrl,
  readJsonFile,
  recursiveQuotaWindows,
  redactError,
  selectPrimaryQuotaWindow,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import { OFFICIAL_SESSION_SOURCE_KINDS } from "../../../packages/providers/src/session-source.mjs";

const PROVIDER_ID = "openai-codex";
const AUTH_BASE_URL = "https://auth.openai.com";
const DEFAULT_AUTHORIZATION_URL = `${AUTH_BASE_URL}/oauth/authorize`;
const DEFAULT_TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
const DEFAULT_REDIRECT_URI = "http://localhost:1455/auth/callback";
const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
const DEFAULT_CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";
const DEFAULT_CODEX_CLIENT_VERSION = "0.163.0";
const DEFAULT_CODEX_CATALOG_TTL_MS = 60_000;
const DEFAULT_USAGE_URLS = Object.freeze([
  "https://chatgpt.com/backend-api/wham/usage",
  "https://chatgpt.com/backend-api/codex/usage",
]);
// This is the public Codex OAuth application identity, not a model or provider version.
const DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CREDENTIAL_SLOT = Symbol("dockyard-codex-credential");

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function codexHomePath({ env = process.env, home = homedir(), codexHome, authFilePath } = {}) {
  if (codexHome) return codexHome;
  if (authFilePath) return dirname(authFilePath);
  return env.CODEX_HOME || join(home, ".codex");
}

function codexAuthPath({ env = process.env, home = homedir(), authFilePath, codexHome } = {}) {
  if (authFilePath) return authFilePath;
  const baseHome = codexHomePath({ env, home, codexHome, authFilePath });
  return join(baseHome, "auth.json");
}

function profileClaims(payload) {
  return payload?.["https://api.openai.com/profile"] ?? payload?.profile ?? {};
}

function authClaims(payload) {
  return payload?.["https://api.openai.com/auth"] ?? payload?.auth ?? {};
}

function normalizeTokens(raw) {
  const tokens = raw?.tokens ?? raw ?? {};
  const access = tokens.access_token ?? tokens.access;
  const refresh = tokens.refresh_token ?? tokens.refresh;
  const idToken = tokens.id_token ?? tokens.idToken ?? null;
  if (typeof access !== "string" || typeof refresh !== "string") return null;
  const accessPayload = decodeJwtPayload(access) ?? {};
  const idPayload = decodeJwtPayload(idToken) ?? {};
  const auth = authClaims(accessPayload);
  const idAuth = authClaims(idPayload);
  const accountId = stringValue(
    tokens.account_id
      ?? tokens.accountId
      ?? auth.chatgpt_account_id
      ?? idAuth.chatgpt_account_id,
  );
  if (!accountId) return null;
  const profile = { ...profileClaims(idPayload), ...profileClaims(accessPayload) };
  const expiresAt = isoFromEpoch(accessPayload.exp ?? idPayload.exp);
  return {
    access,
    refresh,
    idToken,
    accountId,
    email: stringValue(tokens.email ?? profile.email),
    displayName: stringValue(tokens.name ?? profile.name),
    plan: stringValue(
      tokens.plan_type
        ?? auth.chatgpt_plan_type
        ?? idAuth.chatgpt_plan_type,
    ),
    scopes: Array.isArray(tokens.scopes) ? tokens.scopes.map(String) : [],
    expiresAt,
    authFileLastRefresh: stringValue(raw?.last_refresh),
    accessPayload,
    idPayload,
  };
}

function accountInput(tokens, credentialRef, now = new Date(), { source = "official_codex_oauth" } = {}) {
  return {
    providerId: PROVIDER_ID,
    accountId: tokens.accountId,
    credentialRef,
    displayName: tokens.displayName,
    email: tokens.email,
    auth: {
      kind: "oauth",
      credentialRef,
      scopes: tokens.scopes,
    },
    subscription: {
      plan: tokens.plan,
      status: null,
      expiresAt: null,
    },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.authFileLastRefresh ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh),
    },
    resources: {
      sessionSource: source.includes("browser")
        ? OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
        : OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE,
      authSource: source,
    },
  };
}

function attachCredential(candidate, tokens) {
  Object.defineProperty(candidate, CREDENTIAL_SLOT, {
    value: tokens,
    enumerable: false,
    configurable: false,
  });
  return candidate;
}

export function summarizeCodexCandidate(candidate) {
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

function candidateFromTokens(tokens, { source, imported = false, now = new Date() } = {}) {
  const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
  return attachCredential({
    candidateId: `codex:${hash(tokens.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId: tokens.accountId,
    displayName: tokens.displayName ?? tokens.email ?? tokens.accountId,
    email: tokens.email,
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.authFileLastRefresh ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh),
    },
    credentialRef,
    imported,
    status: "available",
  }, tokens);
}

function isExpiring(tokens, now, leewaySeconds) {
  if (!tokens.expiresAt) return true;
  return new Date(tokens.expiresAt).getTime() <= now.getTime() + leewaySeconds * 1000;
}

function reasoningFromThinkingLevelMap(thinkingLevelMap) {
  if (!thinkingLevelMap || typeof thinkingLevelMap !== "object") return undefined;
  const efforts = Object.entries(thinkingLevelMap)
    .filter(([id, providerValue]) => id !== "off" && typeof providerValue === "string" && providerValue.length > 0)
    .map(([id, providerValue]) => ({
      id,
      name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      ...(providerValue === id ? {} : { description: `provider value: ${providerValue}` }),
    }));
  return efforts.length > 0 ? { efforts } : undefined;
}

export function parseCodexReasoning(model) {
  if (Array.isArray(model?.supported_reasoning_levels) && model.supported_reasoning_levels.length > 0) {
    const efforts = model.supported_reasoning_levels.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl.effort;
      const name = id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
      const description = typeof lvl?.description === "string" ? lvl.description : undefined;
      return {
        id,
        name,
        ...(description ? { description } : {}),
      };
    });
    const defaultEffort = typeof model.default_reasoning_level === "string" ? model.default_reasoning_level : undefined;
    return {
      efforts,
      ...(defaultEffort && efforts.some((effort) => effort.id === defaultEffort) ? { defaultEffort } : {}),
    };
  }
  return reasoningFromThinkingLevelMap(model?.thinkingLevelMap);
}

export function codexModelToDshCatalog(model) {
  const id = model.slug ?? model.id;
  const name = model.display_name ?? model.name ?? id;
  const reasoning = parseCodexReasoning(model);
  const input = Array.isArray(model.input_modalities)
    ? model.input_modalities
    : (Array.isArray(model.input) ? model.input : undefined);
  const contextWindow = Number.isInteger(model.context_window)
    ? model.context_window
    : (Number.isInteger(model.contextWindow) ? model.contextWindow : undefined);
  const maxTokens = Number.isInteger(model.max_output_tokens)
    ? Math.min(model.max_output_tokens, 16384)
    : (Number.isInteger(model.maxTokens) ? Math.min(model.maxTokens, 16384) : 8192);

  return {
    id,
    name,
    ...(input ? { inputModalities: [...input] } : {}),
    ...(contextWindow ? { contextWindow } : {}),
    ...(maxTokens ? { maxTokens } : {}),
    ...(reasoning ? { reasoning } : {}),
  };
}

export function parseCodexModelCatalog(raw) {
  const modelsList = Array.isArray(raw?.models)
    ? raw.models
    : (Array.isArray(raw) ? raw : []);
  if (modelsList.length === 0) return [];

  const visible = modelsList.filter((m) => m?.visibility !== "hide");
  const candidates = visible.length > 0 ? visible : modelsList;
  const sorted = [...candidates].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  return sorted.map(codexModelToDshCatalog);
}

export function createCodexCatalogLoader({
  env = process.env,
  home = homedir(),
  codexHome,
  authFilePath,
  modelsCachePath,
  modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_CODEX_MODELS_URL,
  clientVersion = env.DOCKYARD_CODEX_CLIENT_VERSION || DEFAULT_CODEX_CLIENT_VERSION,
  fetchImpl = fetch,
  cacheTtlMs = Number(process.env.DOCKYARD_CODEX_CATALOG_TTL_MS) || DEFAULT_CODEX_CATALOG_TTL_MS,
  fallbackLoader = null,
} = {}) {
  const resolvedHome = codexHomePath({ env, home, codexHome, authFilePath });
  const resolvedAuthPath = codexAuthPath({ env, home, authFilePath, codexHome: resolvedHome });
  const resolvedCachePath = modelsCachePath || join(resolvedHome, "models_cache.json");

  let cached = null;
  let cachedAt = 0;
  let pending = null;

  return async function loadCatalog({ force = false, credential = null, signal = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;

    pending = (async () => {
      let discoveredModels = [];
      let source = "official_codex_models_api";
      let liveToken = credential?.access ?? null;
      let liveAccountId = credential?.accountId ?? null;

      if (!liveToken) {
        try {
          const authRaw = await readJsonFile(resolvedAuthPath);
          if (authRaw) {
            const tokens = normalizeTokens(authRaw);
            if (tokens?.access) {
              liveToken = tokens.access;
              liveAccountId = tokens.accountId;
            }
          }
        } catch {}
      }

      if (liveToken) {
        try {
          const url = new URL(modelsUrl);
          url.searchParams.set("client_version", clientVersion);
          const headers = {
            authorization: `Bearer ${liveToken}`,
            "user-agent": `Codex/${clientVersion}`,
            accept: "application/json",
          };
          if (liveAccountId) {
            headers["chatgpt-account-id"] = liveAccountId;
          }
          const res = await fetchImpl(url.href, {
            method: "GET",
            headers,
            ...(signal ? { signal } : {}),
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            discoveredModels = parseCodexModelCatalog(data);
            if (discoveredModels.length > 0) {
              source = "official_codex_models_api";
            }
          }
        } catch {}
      }

      if (discoveredModels.length === 0) {
        try {
          const cacheData = await readJsonFile(resolvedCachePath);
          if (cacheData) {
            discoveredModels = parseCodexModelCatalog(cacheData);
            if (discoveredModels.length > 0) {
              source = "official_codex_models_cache";
            }
          }
        } catch {}
      }

      if (discoveredModels.length === 0 && typeof fallbackLoader === "function") {
        try {
          const fallback = await fallbackLoader();
          if (Array.isArray(fallback?.models) && fallback.models.length > 0) {
            discoveredModels = fallback.models;
            source = fallback.source ?? "dsh_pi_ai_provider_catalog";
          }
        } catch {}
      }

      const result = {
        models: discoveredModels,
        source,
      };

      if (discoveredModels.length > 0) {
        cached = result;
        cachedAt = Date.now();
      }
      return result;
    })().finally(() => {
      pending = null;
    });

    return pending;
  };
}

export class CodexOAuthDriver {
  constructor({
    authFilePath,
    codexHome,
    modelsCachePath,
    env = process.env,
    home = homedir(),
    tokenUrl = env.DOCKYARD_CODEX_TOKEN_URL || DEFAULT_TOKEN_URL,
    usageUrls = env.DOCKYARD_CODEX_USAGE_URL
      ? [env.DOCKYARD_CODEX_USAGE_URL]
      : [...DEFAULT_USAGE_URLS],
    modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_CODEX_MODELS_URL,
    clientVersion = env.DOCKYARD_CODEX_CLIENT_VERSION || DEFAULT_CODEX_CLIENT_VERSION,
    clientId = env.DOCKYARD_CODEX_CLIENT_ID || DEFAULT_CLIENT_ID,
    fetchImpl = fetch,
    requestExecutor = null,
    catalogLoader = null,
    refreshLeewaySeconds = 60,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CODEX_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_CODEX_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL,
    redirectUri = env.DOCKYARD_CODEX_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    browserCallbackPort = Number(env.DOCKYARD_CODEX_CALLBACK_PORT || 1455),
    cliPath = env.DOCKYARD_CODEX_CLI || "codex",
  } = {}) {
    this.authFilePath = codexAuthPath({ env, home, authFilePath, codexHome });
    // SECURITY.md: OAuth endpoints must be https (or loopback http) even when
    // they come from the environment.
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CODEX_TOKEN_URL");
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CODEX_AUTHORIZATION_URL");
    this.usageUrls = usageUrls.map((url) => assertSecureEndpointUrl(url, "DOCKYARD_CODEX_USAGE_URL"));
    this.clientId = clientId;
    this.fetchImpl = fetchImpl;
    this.requestExecutor = requestExecutor;
    this.catalogLoader = catalogLoader ?? createCodexCatalogLoader({
      env,
      home,
      codexHome,
      authFilePath: this.authFilePath,
      modelsCachePath,
      modelsUrl,
      clientVersion,
      fetchImpl,
    });
    this.refreshLeewaySeconds = refreshLeewaySeconds;
    this.cliAuthorizer = createCliOAuthAuthorizer({
      providerId: PROVIDER_ID,
      cliPath,
      loginArgs: ["login", "--device-auth"],
      environmentKey: "CODEX_HOME",
      instructions: "已启动官方 Codex CLI OAuth 登录。请在官方网页完成登录，完成后回到 Dockyard DSH。",
      importCredentials: (raw, context) => this.#importOAuthState(raw, context),
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth
      ? createBrowserOAuthAuthorizer({
        providerId: PROVIDER_ID,
        redirectUri,
        callbackPath: new URL(redirectUri).pathname,
        callbackHost: "localhost",
        callbackPort: browserCallbackPort,
        instructions: "请在官方 Codex 授权页面选择账号并完成授权；完成后会自动返回 Dockyard DSH。",
        authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri: callback }) => {
          const url = new URL(authorizationUrl);
          url.search = new URLSearchParams({
            client_id: clientId,
            response_type: "code",
            redirect_uri: callback,
            scope: "openid email profile offline_access",
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            prompt: "login",
            id_token_add_organizations: "true",
            codex_cli_simplified_flow: "true",
          });
          return url.toString();
        },
        exchangeCode: async ({ code, codeVerifier, redirectUri: callback, context }) => {
          const response = await fetchJson(this.tokenUrl, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: clientId,
              code,
              redirect_uri: callback,
              code_verifier: codeVerifier,
            }),
            ...(context.signal ? { signal: context.signal } : {}),
          }, { fetchImpl: this.fetchImpl });
          return response.body ?? {};
        },
        importCredentials: (raw, context) => this.#importOAuthState(raw, context, "official_codex_browser_oauth"),
      })
      : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }

  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    const raw = await readJsonFile(this.authFilePath);
    if (!raw) {
      return {
        candidates: [],
        source: this.authFilePath,
        diagnostics: [`未发现 Codex OAuth 文件：${this.authFilePath}`],
      };
    }
    const tokens = normalizeTokens(raw);
    if (!tokens) {
      return {
        candidates: [],
        source: this.authFilePath,
        diagnostics: ["Codex OAuth 文件存在，但字段不完整或无法解析账号身份"],
      };
    }
    const candidate = candidateFromTokens(tokens, { source: this.authFilePath, now });
    return {
      candidates: [candidate],
      source: this.authFilePath,
      diagnostics: [],
    };
  }

  async importAccount(candidate, context = {}) {
    const tokens = candidate?.[CREDENTIAL_SLOT];
    if (!tokens) throw new Error("Codex candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
    await context.secretStore.write(credentialRef, {
      type: "oauth",
      providerId: PROVIDER_ID,
      access: tokens.access,
      refresh: tokens.refresh,
      idToken: tokens.idToken,
      accountId: tokens.accountId,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });
    return accountInput(tokens, credentialRef, context.now instanceof Date ? context.now : new Date(), {
      source: candidate.source,
    });
  }

  async importSource(source, context = {}) {
    let raw;
    try {
      raw = typeof source?.content === "string" ? JSON.parse(source.content) : source?.content;
    } catch {
      throw new Error("Codex OAuth source is not valid JSON");
    }
    return this.#importOAuthState(raw, context, source?.fileName || "user_selected_oauth.json");
  }

  async #importOAuthState(raw, context = {}, source = "official_codex_oauth") {
    const tokens = normalizeTokens(raw);
    if (!tokens) throw new Error("Codex OAuth state does not contain a complete account token set");
    const candidate = candidateFromTokens(tokens, {
      source,
      now: context.now instanceof Date ? context.now : new Date(),
    });
    return [await this.importAccount(candidate, context)];
  }

  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      if (!discovered.candidates?.length) return null;
      const accounts = [];
      for (const candidate of discovered.candidates) {
        accounts.push(await this.importAccount(candidate, context));
      }
      return {
        status: "completed",
        providerId: PROVIDER_ID,
        instructions: "已检测到 Codex 官方 OAuth 会话，当前账号已接入 Dockyard DSH。",
        accounts,
        diagnostic: null,
      };
    } catch {
      return null;
    }
  }

  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }

  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:")
      ? this.browserAuthorizer
      : this.oauthAuthorizer === this.browserAuthorizer
        ? this.cliAuthorizer
        : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }

  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:")
      ? this.browserAuthorizer
      : this.oauthAuthorizer === this.browserAuthorizer
        ? this.cliAuthorizer
        : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("当前 Codex 授权流程不接收手动授权码");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }

  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:")
      ? this.browserAuthorizer
      : this.oauthAuthorizer === this.browserAuthorizer
        ? this.cliAuthorizer
        : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }

  async #readCredential(account, context) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const stored = await context.secretStore.read(credentialRef);
    if (!stored?.access || !stored?.refresh) {
      const error = new Error("Codex credential is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    return {
      ...stored,
      accountId: stored.accountId ?? account.accountId,
      expiresAt: stored.expiresAt ?? account.refresh.accessTokenExpiresAt,
    };
  }

  async #refreshCredential(credential, context) {
    const response = await fetchJson(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: this.clientId,
      }),
      ...(context.signal ? { signal: context.signal } : {}),
    }, { fetchImpl: this.fetchImpl });
    const body = response.body ?? {};
    // RFC 6749 §6: a refresh response MAY omit refresh_token when the
    // authorization server issued one previously — the old value stays valid.
    // Requiring a new token here would strand perfectly healthy accounts.
    if (!body.access_token || !Number.isFinite(Number(body.expires_in))) {
      throw new Error("Codex OAuth refresh response is incomplete");
    }
    if (body.refresh_token !== undefined && body.refresh_token !== null && typeof body.refresh_token !== "string") {
      throw new Error("Codex OAuth refresh response returned an invalid refresh token");
    }
    const payload = decodeJwtPayload(body.access_token) ?? {};
    const auth = authClaims(payload);
    const accountId = stringValue(auth.chatgpt_account_id) ?? credential.accountId;
    return {
      ...credential,
      type: "oauth",
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      idToken: body.id_token ?? credential.idToken ?? null,
      accountId,
      expiresAt: addSecondsIso(body.expires_in, context.now instanceof Date ? context.now : new Date()),
      lastRefreshedAt: (context.now instanceof Date ? context.now : new Date()).toISOString(),
    };
  }

  async #liveCredential(account, context = {}, { force = false } = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    let credential = await this.#readCredential(account, context);
    if (credential.refresh && (force || isExpiring(credential, now, this.refreshLeewaySeconds))) {
      try {
        credential = await this.#refreshCredential(credential, context);
        await context.secretStore.write(account.auth?.credentialRef ?? account.credentialRef, credential);
      } catch (error) {
        const wrapped = new Error(`Codex OAuth refresh failed: ${redactError(error)}`);
        // A forbidden response means the provider rejected this operation;
        // it is not proof that the OAuth credential itself has expired.
        wrapped.authForbidden = error?.status === 403;
        wrapped.authExpired = error?.status === 401
          || (error?.status === 400 && ["invalid_grant", "invalid_token"].includes(String(error?.upstreamCode ?? "").toLowerCase()));
        throw wrapped;
      }
    }
    return credential;
  }

  async refreshAccount(account, context = {}) {
    const credential = await this.#liveCredential(account, context, { force: Boolean(context.force) });
    return {
      refresh: {
        accessTokenExpiresAt: credential.expiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: credential.lastRefreshedAt ?? account.refresh.lastRefreshedAt,
        refreshable: Boolean(credential.refresh),
      },
    };
  }

  async getQuota(account, context = {}) {
    const credential = await this.#liveCredential(account, context);
    let lastError = null;
    let sawAuthExpired = false;
    let sawAuthForbidden = false;
    for (const url of this.usageUrls) {
      try {
        const response = await fetchJson(url, {
          headers: {
            authorization: `Bearer ${credential.access}`,
            "chatgpt-account-id": credential.accountId ?? account.accountId,
          },
          ...(context.signal ? { signal: context.signal } : {}),
        }, { fetchImpl: this.fetchImpl });
        const now = context.now instanceof Date ? context.now : new Date();
        const windows = recursiveQuotaWindows(response.body, {
          source: "codex_usage",
          now,
          prefix: "rate_limit",
        });
        const primary = selectPrimaryQuotaWindow(windows);
        return {
          quota: {
            ...primary,
            windows,
            updatedAt: now.toISOString(),
            source: "codex_usage",
          },
          subscription: {
            plan: stringValue(response.body?.plan_type),
            status: stringValue(response.body?.subscription_status),
            expiresAt: null,
          },
          identity: {
            accountId: stringValue(response.body?.account_id) ?? account.accountId,
            email: stringValue(response.body?.email) ?? account.email,
          },
          refresh: {
            accessTokenExpiresAt: credential.expiresAt ?? account.refresh.accessTokenExpiresAt,
            lastRefreshedAt: credential.lastRefreshedAt ?? account.refresh.lastRefreshedAt,
            refreshable: Boolean(credential.refresh),
          },
        };
      } catch (error) {
        lastError = error;
        sawAuthExpired ||= error?.status === 401;
        sawAuthForbidden ||= error?.status === 403;
      }
    }
    const wrapped = new Error(sawAuthExpired
      ? "Codex OAuth credential rejected (401); reauthorization required"
      : `Codex quota request failed: ${redactError(lastError)}`);
    wrapped.rateLimited = lastError?.status === 429;
    // Preserve the strongest auth signal across the endpoint fallback. A
    // stale OAuth token commonly returns 401 from wham/usage and 403 from
    // codex/usage; the final 403 must not hide that reauthorization is needed.
    wrapped.authExpired = sawAuthExpired;
    wrapped.authForbidden = !sawAuthExpired && sawAuthForbidden;
    throw wrapped;
  }

  async getCatalog(context = {}) {
    let credential = null;
    if (context.accounts?.[0] && context.secretStore) {
      try {
        credential = await this.#liveCredential(context.accounts[0], context);
      } catch {}
    }
    if (this.catalogLoader) {
      try {
        const catalog = await this.catalogLoader({
          force: Boolean(context.force),
          credential,
          accounts: context.accounts,
        });
        if (Array.isArray(catalog?.models) && catalog.models.length > 0) return catalog;
      } catch {
        // A catalog is advisory; native invocation can still accept an exact
        // model supplied by DSH even when discovery is temporarily unavailable.
      }
    }
    return {
      models: [],
      source: "no_live_catalog_endpoint",
      diagnostic: "Codex model identifiers are accepted from the active DSH configuration; this module does not invent a model list.",
    };
  }

  async invoke(request, invocation, context = {}) {
    const credential = await this.#liveCredential(invocation.account, context);
    const executor = context.requestExecutor ?? this.requestExecutor ?? nativeCodexExecutor;
    return executor({ request, invocation, credential, context });
  }

  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
}

export function createCodexPiAiExecutor({
  PiAiAdapter,
  createProvider,
  openAICodexResponsesApi,
  modelResolver = null,
}) {
  if (!PiAiAdapter || !createProvider || !openAICodexResponsesApi) {
    throw new Error("Codex DSH transport dependencies are incomplete");
  }
  return async function executeCodex({ request, credential, context = {} }) {
    const modelId = String(request.model);
    const requestedEffort = typeof request.reasoningEffort === "string" ? request.reasoningEffort : undefined;
    const catalogModel = typeof modelResolver === "function" ? modelResolver(modelId) : null;
    const contextWindow = Number.isInteger(catalogModel?.contextWindow) && catalogModel.contextWindow > 0
      ? catalogModel.contextWindow
      : 272_000;
    const maxTokens = Number.isInteger(catalogModel?.maxTokens) && catalogModel.maxTokens > 0
      ? Math.min(catalogModel.maxTokens, 16384)
      : 16384;
    const thinkingLevelMap = catalogModel?.thinkingLevelMap ?? {
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
      ultra: "ultra",
    };
    const model = {
      id: modelId,
      name: typeof catalogModel?.name === "string" && catalogModel.name.length > 0
        ? catalogModel.name
        : modelId,
      api: "openai-codex-responses",
      provider: PROVIDER_ID,
      baseUrl: DEFAULT_CODEX_BASE_URL,
      reasoning: typeof catalogModel?.reasoning === "boolean"
        ? catalogModel.reasoning
        : requestedEffort !== undefined,
      ...(thinkingLevelMap ? { thinkingLevelMap: { ...thinkingLevelMap } } : {}),
      input: Array.isArray(catalogModel?.input) && catalogModel.input.length > 0
        ? [...catalogModel.input]
        : (Array.isArray(catalogModel?.inputModalities) && catalogModel.inputModalities.length > 0
          ? [...catalogModel.inputModalities]
          : ["text", "image"]),
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow,
      maxTokens,
    };

  const provider = createProvider({
    id: PROVIDER_ID,
    name: "OpenAI Codex",
    baseUrl: DEFAULT_CODEX_BASE_URL,
    auth: {
      apiKey: {
        name: "Dockyard DSH OAuth",
        resolve: ({ credential: supplied }) => ({
          auth: { apiKey: supplied?.key },
          source: "Dockyard DSH OAuth",
        }),
      },
    },
    models: [model],
    api: openAICodexResponsesApi(),
  });

  const profile = {
    provider: PROVIDER_ID,
    displayName: "OpenAI Codex",
    piProvider: provider,
    modelErrors: new Map(),
    configuredMaxTokens: new Map(),
    streamIdleTimeoutMs: 300_000,
  };
  const adapter = new PiAiAdapter({
    profiles: () => new Map([[PROVIDER_ID, profile]]),
    resolveApiKey: async () => credential.access,
    // DSH's durable attachment store is required for image input. Keep the
    // resolver lazy so text-only requests remain compatible with standalone
    // Codex driver callers and tests that do not mount attachments.
    resolveAttachments: () => context.attachments,
  });
  return adapter.stream(request);
  };
}

async function nativeCodexExecutor(envelope) {
  try {
    const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }] = await Promise.all([
      import("@deepseek-ai/dsh-llm-pi-ai"),
      import("@earendil-works/pi-ai"),
      import("@earendil-works/pi-ai/api/openai-codex-responses.lazy"),
    ]);
    return createCodexPiAiExecutor({ PiAiAdapter, createProvider, openAICodexResponsesApi })(envelope);
  } catch (error) {
    throw new Error(`Codex DSH transport dependencies are unavailable: ${redactError(error)}`);
  }
}

export function createCodexDriver(options = {}) {
  return new CodexOAuthDriver(options);
}

export const codexDriverConstants = Object.freeze({
  providerId: PROVIDER_ID,
  defaultUsageUrls: DEFAULT_USAGE_URLS,
  defaultBaseUrl: DEFAULT_CODEX_BASE_URL,
});
