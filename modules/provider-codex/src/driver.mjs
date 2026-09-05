import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

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
const DEFAULT_USAGE_URLS = Object.freeze([
  "https://chatgpt.com/backend-api/wham/usage",
  "https://chatgpt.com/backend-api/codex/usage",
]);
const DEFAULT_MODELS_URL = `${DEFAULT_CODEX_BASE_URL}/codex/models?client_version=1.0.0`;
const CODEX_CAPACITY_FALLBACKS = Object.freeze(["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]);
// This is the public Codex OAuth application identity, not a model or provider version.
const DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CREDENTIAL_SLOT = Symbol("dockyard-codex-credential");

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function codexAuthPath({ env = process.env, home = homedir(), authFilePath } = {}) {
  if (authFilePath) return authFilePath;
  return join(env.CODEX_HOME || join(home, ".codex"), "auth.json");
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

function humanizeCodexSlug(slug) {
  return String(slug ?? "")
    .replace(/^gpt-/i, "GPT-")
    .replace(/[-_]+/g, " ")
    .replace(/\b([a-z])/g, (character) => character.toUpperCase());
}

function hasCodexCapacities(model) {
  return Number.isInteger(model?.contextWindow) && model.contextWindow > 0
    && Number.isInteger(model?.maxTokens) && model.maxTokens > 0;
}

export function pickCodexCapacityTemplate(registryModels = []) {
  const models = Array.isArray(registryModels) ? registryModels.filter(hasCodexCapacities) : [];
  for (const id of CODEX_CAPACITY_FALLBACKS) {
    const match = models.find((model) => model.id === id);
    if (match) return match;
  }
  return models[0] ?? null;
}

export function synthesizeCodexPiAiModel(modelId, registryModels = []) {
  const id = String(modelId ?? "").trim();
  const exact = (Array.isArray(registryModels) ? registryModels : []).find((model) => model?.id === id);
  const template = hasCodexCapacities(exact) ? exact : pickCodexCapacityTemplate(registryModels);
  const thinkingLevelMap = template?.thinkingLevelMap && typeof template.thinkingLevelMap === "object"
    ? { ...template.thinkingLevelMap }
    : { xhigh: "xhigh", minimal: "low" };
  return {
    id,
    name: typeof exact?.name === "string" && exact.name.length > 0
      ? exact.name
      : humanizeCodexSlug(id),
    api: "openai-codex-responses",
    provider: PROVIDER_ID,
    baseUrl: DEFAULT_CODEX_BASE_URL,
    reasoning: typeof template?.reasoning === "boolean" ? template.reasoning : true,
    thinkingLevelMap,
    input: Array.isArray(template?.input) && template.input.length > 0 ? [...template.input] : ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: hasCodexCapacities(template) ? template.contextWindow : 272_000,
    maxTokens: hasCodexCapacities(template) ? template.maxTokens : 128_000,
  };
}

export function parseCodexLiveModelCatalog(body) {
  const entries = Array.isArray(body?.models) ? body.models : Array.isArray(body) ? body : [];
  const sortable = [];
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const slug = firstString(item.slug, item.id);
    if (!slug) continue;
    const visibility = String(item.visibility ?? "").trim().toLowerCase();
    if (visibility === "hide" || visibility === "hidden") continue;
    const priority = Number.isFinite(Number(item.priority)) ? Number(item.priority) : 10_000;
    sortable.push({
      priority,
      model: {
        id: slug,
        name: firstString(item.title, item.display_name, item.displayName, item.name) ?? humanizeCodexSlug(slug),
      },
    });
  }
  sortable.sort((left, right) => left.priority - right.priority || left.model.id.localeCompare(right.model.id));
  const models = [];
  const seen = new Set();
  for (const { model } of sortable) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  return models;
}

export function mergeCodexLiveCatalog(liveModels, registryModels = []) {
  const registry = Array.isArray(registryModels) ? registryModels : [];
  const merged = [];
  const seen = new Set();
  for (const live of Array.isArray(liveModels) ? liveModels : []) {
    const id = typeof live?.id === "string" ? live.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const synthesized = synthesizeCodexPiAiModel(id, registry);
    merged.push({
      ...synthesized,
      ...(typeof live.name === "string" && live.name.length > 0 ? { name: live.name } : {}),
    });
  }
  return merged;
}

export class CodexOAuthDriver {
  #catalogCache;

  constructor({
    authFilePath,
    env = process.env,
    home = homedir(),
    tokenUrl = env.DOCKYARD_CODEX_TOKEN_URL || DEFAULT_TOKEN_URL,
    usageUrls = env.DOCKYARD_CODEX_USAGE_URL
      ? [env.DOCKYARD_CODEX_USAGE_URL]
      : [...DEFAULT_USAGE_URLS],
    modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_MODELS_URL,
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
    this.authFilePath = codexAuthPath({ env, home, authFilePath });
    // SECURITY.md: OAuth endpoints must be https (or loopback http) even when
    // they come from the environment.
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CODEX_TOKEN_URL");
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CODEX_AUTHORIZATION_URL");
    this.usageUrls = usageUrls.map((url) => assertSecureEndpointUrl(url, "DOCKYARD_CODEX_USAGE_URL"));
    this.modelsUrl = assertSecureEndpointUrl(modelsUrl, "DOCKYARD_CODEX_MODELS_URL");
    this.clientId = clientId;
    this.fetchImpl = fetchImpl;
    this.requestExecutor = requestExecutor;
    this.catalogLoader = catalogLoader;
    this.#catalogCache = null;
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

  async #registryCatalog(context = {}) {
    if (!this.catalogLoader) return null;
    try {
      const catalog = await this.catalogLoader({
        force: Boolean(context.force),
        accounts: context.accounts,
        secretStore: context.secretStore,
        signal: context.signal,
      });
      if (Array.isArray(catalog?.models) && catalog.models.length > 0) return catalog;
    } catch {
      // A catalog is advisory; native invocation can still accept an exact
      // model supplied by DSH even when discovery is temporarily unavailable.
    }
    return null;
  }

  async #loadLiveCatalog(context = {}) {
    const accounts = Array.isArray(context.accounts) ? context.accounts : [];
    const account = accounts[0];
    if (!account || !context.secretStore) return [];
    try {
      const credential = await this.#liveCredential(account, context);
      const accountId = credential.accountId ?? account.accountId;
      const headers = {
        authorization: `Bearer ${credential.access}`,
      };
      if (accountId) headers["chatgpt-account-id"] = accountId;
      const { body } = await fetchJson(this.modelsUrl, {
        headers,
        ...(context.signal ? { signal: context.signal } : {}),
      }, { fetchImpl: this.fetchImpl });
      return parseCodexLiveModelCatalog(body);
    } catch {
      return [];
    }
  }

  async getCatalog(context = {}) {
    const force = Boolean(context.force);
    if (!force && this.#catalogCache) return this.#catalogCache;
    const registry = await this.#registryCatalog(context);
    const live = await this.#loadLiveCatalog(context);
    const catalog = live.length > 0
      ? {
        models: mergeCodexLiveCatalog(live, registry?.models ?? []),
        source: "official_codex_models_api",
      }
      : registry ?? {
        models: [],
        source: "no_live_catalog_endpoint",
        diagnostic: "Codex model identifiers are accepted from the active DSH configuration; this module does not invent a model list.",
      };
    if (catalog.models.length > 0) this.#catalogCache = catalog;
    return catalog;
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
  registryModels = [],
}) {
  if (!PiAiAdapter || !createProvider || !openAICodexResponsesApi) {
    throw new Error("Codex DSH transport dependencies are incomplete");
  }
  return async function executeCodex({ request, credential, context = {} }) {
    const modelId = String(request.model);
    const requestedEffort = typeof request.reasoningEffort === "string" ? request.reasoningEffort : undefined;
    const resolved = typeof modelResolver === "function" ? modelResolver(modelId) : null;
    const catalogModel = hasCodexCapacities(resolved)
      ? resolved
      : synthesizeCodexPiAiModel(modelId, [
        ...(resolved ? [resolved] : []),
        ...(Array.isArray(registryModels) ? registryModels : []),
      ]);
    const contextWindow = catalogModel?.contextWindow;
    const maxTokens = catalogModel?.maxTokens;
    if (!Number.isInteger(contextWindow) || contextWindow <= 0 || !Number.isInteger(maxTokens) || maxTokens <= 0) {
      throw new Error(`Codex live model catalog did not return context/output capacities for "${modelId}"`);
    }
    const thinkingLevelMap = catalogModel?.thinkingLevelMap;
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
        : ["text"],
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
  defaultModelsUrl: DEFAULT_MODELS_URL,
});
