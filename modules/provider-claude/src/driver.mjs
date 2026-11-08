import { createHash } from "node:crypto";
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
  assertSecureEndpointUrl,
  finiteNumber,
  recursiveQuotaWindows,
  selectPrimaryQuotaWindow,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import {
  OFFICIAL_SESSION_AUTH_KIND,
  OFFICIAL_SESSION_SOURCE_KINDS,
  normalizeOfficialSessionResult,
  officialSessionResources,
} from "../../../packages/providers/src/session-source.mjs";
import { readClaudeOAuthCredential } from "./native-transport.mjs";

const PROVIDER_ID = "claude";
const DEFAULT_BROWSER_AUTHORIZATION_URL = "https://claude.com/cai/oauth/authorize";
const DEFAULT_BROWSER_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const DEFAULT_BROWSER_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const DEFAULT_BROWSER_REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
// Dockyard only calls the Messages API and reads profile identity; scopes for
// org key creation, MCP servers, file upload, and Claude Code sessions are
// intentionally not requested. DOCKYARD_CLAUDE_OAUTH_SCOPE still overrides.
const DEFAULT_BROWSER_SCOPE = "user:profile user:inference";
const CREDENTIAL_SLOT = Symbol("dockyard-claude-session");

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

function statusObject(raw, output = "") {
  if (raw && typeof raw === "object") return raw;
  return parseJsonOutput(output) ?? {};
}

function statusLoggedIn(value, output = "") {
  if (typeof value.loggedIn === "boolean") return value.loggedIn;
  if (typeof value.authenticated === "boolean") return value.authenticated;
  return !/not logged in|logged out|unauthenticated/i.test(String(output));
}

function isApiKeyStatus(value) {
  const method = String(value.authMethod ?? value.auth_method ?? "").toLowerCase();
  const source = String(value.apiKeySource ?? value.api_key_source ?? "").toLowerCase();
  return method.includes("api_key") || method.includes("apikey") || source.length > 0;
}

function isSubscriptionStatus(value) {
  if (isApiKeyStatus(value)) return false;
  const method = String(value.authMethod ?? value.auth_method ?? "").toLowerCase();
  const provider = String(value.apiProvider ?? value.api_provider ?? "").toLowerCase();
  return method.includes("oauth")
    || method.includes("claude")
    || method.includes("subscription")
    || provider.includes("claude")
    || provider.includes("firstparty");
}

function statusIdentity(value) {
  const profile = value.profile ?? value.user ?? value.account ?? {};
  const email = firstString(value.email, value.userEmail, profile.email, profile.userEmail);
  const accountId = firstString(
    value.accountId,
    value.account_id,
    value.userId,
    value.user_id,
    profile.accountId,
    profile.id,
    email,
  ) ?? "claude:active";
  const plan = firstString(
    value.plan,
    value.planName,
    value.plan_type,
    value.subscriptionType,
    value.subscription?.plan,
    value.subscription?.name,
  );
  const displayName = firstString(value.name, profile.name, email, accountId);
  return { accountId, email, plan, displayName };
}

/** Normalize only public status fields; OAuth/API secrets never leave the provider session reader. */
export function parseClaudeAuthStatus(output) {
  const value = statusObject(null, output);
  const identity = statusIdentity(value);
  return {
    loggedIn: statusLoggedIn(value, output),
    authMethod: firstString(value.authMethod, value.auth_method),
    apiProvider: firstString(value.apiProvider, value.api_provider),
    apiKeySource: firstString(value.apiKeySource, value.api_key_source),
    isApiKey: isApiKeyStatus(value),
    isSubscription: isSubscriptionStatus(value),
    ...identity,
    raw: value,
  };
}

function activeSessionError(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}

function candidateFromStatus(status, {
  source = "official_claude_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  imported = false,
  credential = null,
} = {}) {
  const sourceCredential = credential ?? status.credential ?? null;
  const persistedCredential = sourceCredential?.access && sourceCredential?.refresh
    ? {
      ...sourceCredential,
      type: sourceCredential.type ?? "oauth",
      providerId: PROVIDER_ID,
      accountId: sourceCredential.accountId ?? status.accountId,
    }
    : null;
  const credentialRef = createCredentialRef(PROVIDER_ID, status.accountId);
  const candidate = {
    candidateId: `claude:${hash(status.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId: status.accountId,
    displayName: status.displayName ?? status.accountId,
    email: status.email,
    subscription: { plan: status.plan, status: status.isSubscription ? "active" : null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: persistedCredential?.expiresAt ?? null,
      nextRefreshAt: null,
      lastRefreshedAt: persistedCredential?.lastRefreshedAt ?? null,
      refreshable: Boolean(persistedCredential?.refresh),
    },
    credentialRef,
    resources: officialSessionResources({ sourceKind, authSource: source }),
    imported,
    status: status.isSubscription ? "available" : "degraded",
    diagnostic: status.isApiKey
      ? "当前 Claude 官方会话使用 API key，不是 Claude Pro/Max 订阅 OAuth"
      : status.isSubscription ? null : "Claude 官方会话没有返回可识别的订阅 OAuth 状态",
  };
  Object.defineProperty(candidate, CREDENTIAL_SLOT, {
    value: persistedCredential ?? {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID,
      accountId: status.accountId,
      authMethod: status.authMethod,
      sourceKind,
    },
    enumerable: false,
  });
  return candidate;
}

function browserTokenExpiry(raw, now = new Date()) {
  if (typeof raw?.expires_at === "string") return raw.expires_at;
  const expiresIn = Number(raw?.expires_in);
  return Number.isFinite(expiresIn) ? new Date(now.getTime() + expiresIn * 1000).toISOString() : null;
}

function candidateFromBrowserToken(raw, { source = "official_claude_browser_oauth", now = new Date() } = {}) {
  const access = firstString(raw?.access_token, raw?.accessToken);
  const refresh = firstString(raw?.refresh_token, raw?.refreshToken);
  if (!access || !refresh) throw new Error("Claude browser OAuth response is missing access and refresh tokens");
  const account = raw.account ?? {};
  const organization = raw.organization ?? {};
  const email = firstString(raw.email, account.email, account.email_address, account.emailAddress);
  const accountId = firstString(raw.accountId, raw.account_id, account.uuid, account.id, email) ?? "claude:active";
  const candidate = candidateFromStatus({
    loggedIn: true,
    authMethod: "oauth",
    apiProvider: "firstParty",
    isApiKey: false,
    isSubscription: true,
    accountId,
    email,
    displayName: firstString(raw.name, account.name, email, accountId),
    plan: firstString(raw.plan, raw.plan_type, organization.name),
  }, {
    source,
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    credential: {
      type: "oauth",
      providerId: PROVIDER_ID,
      accountId,
      access,
      refresh,
      expiresAt: browserTokenExpiry(raw, now),
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
      clientId: raw.client_id ?? raw.clientId ?? null,
    },
  });
  candidate.refresh = {
    ...candidate.refresh,
    accessTokenExpiresAt: browserTokenExpiry(raw, now),
    refreshable: true,
  };
  return candidate;
}

export function summarizeClaudeCandidate(candidate) {
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

function catalogModel(model) {
  const reasoning = model?.thinkingLevelMap && typeof model.thinkingLevelMap === "object"
    ? {
        efforts: Object.keys(model.thinkingLevelMap)
          .filter((id) => id !== "off")
          .map((id) => ({ id, name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()) })),
      }
    : model?.reasoning && typeof model.reasoning === "object"
      ? model.reasoning
      : undefined;
  return {
    id: model.id,
    name: model.name ?? model.id,
    ...(Array.isArray(model.input) ? { inputModalities: [...model.input] } : {}),
    ...(Number.isInteger(model.contextWindow) ? { contextWindow: model.contextWindow } : {}),
    ...(Number.isInteger(model.maxTokens) ? { maxTokens: model.maxTokens } : {}),
    ...(reasoning ? { reasoning } : {}),
  };
}

export function createClaudeCatalogLoader({ registryLoader = null } = {}) {
  let cached = null;
  return async function loadCatalog({ force = false } = {}) {
    if (cached && !force) return cached;
    const registry = typeof registryLoader === "function" ? await registryLoader() : [];
    const rows = Array.isArray(registry) ? registry.filter(Boolean) : [];
    // Only Anthropic's own rows belong in a Claude subscription catalog. Other
    // providers (Vercel AI Gateway, Cloudflare, OpenCode, ...) also speak the
    // Anthropic messages protocol, so matching on `api` alone pulled hundreds
    // of foreign models — poolside/laguna-s-2.1-free among them — into the
    // Claude panel, where they could never authenticate. Fall back to the id
    // prefix only if the registry carries no provider field at all.
    // Rows that name another provider are never Anthropic's. Rows with no
    // provider at all are alias rows the registry adds to enrich the same
    // Claude model, so they stay when the id looks like Anthropic's.
    const isClaudeRow = (rawModel) => rawModel.provider === "anthropic"
      || (rawModel.provider == null
        && rawModel.api === "anthropic-messages"
        && /^claude-/u.test(String(rawModel.id ?? "")));
    const modelsById = new Map();
    for (const rawModel of rows) {
      if (!isClaudeRow(rawModel)) continue;
      const model = catalogModel(rawModel);
      if (typeof model.id !== "string" || model.id.length === 0) continue;
      const previous = modelsById.get(model.id);
      if (!previous) {
        modelsById.set(model.id, model);
        continue;
      }
      // The installed registry can expose the same Claude model through more
      // than one provider alias. Keep one DSH row, while retaining any richer
      // metadata returned by the duplicate row.
      modelsById.set(model.id, {
        ...previous,
        ...(previous.name === model.id && model.name !== model.id ? { name: model.name } : {}),
        ...(previous.inputModalities === undefined && model.inputModalities !== undefined
          ? { inputModalities: [...model.inputModalities] }
          : {}),
        ...(previous.contextWindow === undefined && model.contextWindow !== undefined
          ? { contextWindow: model.contextWindow }
          : {}),
        ...(previous.maxTokens === undefined && model.maxTokens !== undefined
          ? { maxTokens: model.maxTokens }
          : {}),
        ...(previous.reasoning === undefined && model.reasoning !== undefined
          ? { reasoning: model.reasoning }
          : {}),
      });
    }
    const models = [...modelsById.values()]
    cached = {
      models,
      source: "dsh_live_provider_registry",
      ...(models.length ? {} : { diagnostics: ["Claude 官方没有公开模型目录，且当前 DSH registry 未返回 Anthropic 模型"] }),
    };
    return cached;
  };
}

export function createClaudeCliExecutor({
  cliPath = process.env.DOCKYARD_CLAUDE_CLI || "claude",
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
      const args = ["-p", prompt, "--output-format", "stream-json", "--include-partial-messages", "--no-session-persistence", "--max-turns", "1", "--tools", ""];
      if (typeof request.model === "string" && request.model.length > 0) args.push("--model", request.model);
      if (typeof request.reasoningEffort === "string" && request.reasoningEffort.length > 0) args.push("--effort", request.reasoningEffort);
      return args;
    },
  });
}

export function claudeRequestPrompt(request) {
  return cliRequestPrompt(request);
}

export class ClaudeSubscriptionDriver {
  constructor({
    cliPath = process.env.DOCKYARD_CLAUDE_CLI || "claude",
    env = process.env,
    commandRunner = runCliCommand,
    requestExecutor = null,
    catalogLoader = null,
    sessionReader = null,
    sessionSource = "official_claude_client",
    sessionSourceKind = OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CLAUDE_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_CLAUDE_AUTHORIZATION_URL || DEFAULT_BROWSER_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_CLAUDE_TOKEN_URL || DEFAULT_BROWSER_TOKEN_URL,
    clientId = env.DOCKYARD_CLAUDE_CLIENT_ID || DEFAULT_BROWSER_CLIENT_ID,
    redirectUri = env.DOCKYARD_CLAUDE_REDIRECT_URI || DEFAULT_BROWSER_REDIRECT_URI,
    oauthScope = env.DOCKYARD_CLAUDE_OAUTH_SCOPE || DEFAULT_BROWSER_SCOPE,
    home = homedir(),
    fetchImpl = fetch,
  } = {}) {
    // SECURITY.md: remote OAuth endpoints must be https (or loopback http).
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CLAUDE_AUTHORIZATION_URL");
    this.cliPath = cliPath;
    this.env = env;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.home = home;
    this.browserTokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CLAUDE_TOKEN_URL");
    this.browserClientId = clientId;
    this.sessionReader = sessionReader;
    this.sessionSource = sessionSource;
    this.sessionSourceKind = sessionSourceKind;
    this.catalogLoader = catalogLoader ?? createClaudeCatalogLoader();
    this.clientSessionAuthorizer = typeof sessionReader === "function"
      ? createOfficialSessionAuthorizer({
        providerId: PROVIDER_ID,
        source: sessionSource,
        instructions: "请在 Claude 官方客户端完成登录，完成后回到 Dockyard DSH。",
        readSession: async (context = {}) => {
          const status = await this.#activeStatus(context.signal);
          const candidate = candidateFromStatus(status, {
            source: status.source,
            sourceKind: status.sourceKind,
          });
          return { accounts: [await this.importAccount(candidate, context)] };
        },
      })
      : null;
    this.cliAuthorizer = createCliStatusAuthorizer({
      providerId: PROVIDER_ID,
      cliPath,
      loginArgs: ["auth", "login", "--claudeai"],
      environment: env,
      browserOpened: true,
      instructions: "已启动官方 Claude CLI OAuth 登录。请在 Claude 官方网页完成登录，完成后回到 Dockyard DSH。",
      importStatus: async (context) => {
        const status = await this.#activeStatus();
        if (!status.loggedIn || !status.isSubscription) return [];
        return [await this.importAccount(candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind,
        }), context)];
      },
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth
      ? createBrowserOAuthAuthorizer({
        providerId: PROVIDER_ID,
        redirectUri,
        callbackPort: 0,
        authorizationCodeRequired: true,
        instructions: "请在官方 Claude 授权页面选择账号并完成授权，然后将页面返回的授权码粘贴回 Dockyard DSH。",
        authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri: callback }) => {
          const url = new URL(authorizationUrl);
          url.search = new URLSearchParams({
            code: "true",
            client_id: clientId,
            response_type: "code",
            redirect_uri: callback,
            scope: oauthScope,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state,
          });
          return url.toString();
        },
        exchangeCode: async ({ code, state, codeVerifier, redirectUri: callback, context }) => {
          const response = await this.fetchImpl(tokenUrl, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              grant_type: "authorization_code",
              code: code.includes("#") ? code.split("#", 1)[0] : code,
              redirect_uri: callback,
              client_id: clientId,
              code_verifier: codeVerifier,
              state,
            }),
            ...(context.signal ? { signal: context.signal } : {}),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const error = new Error(`Claude OAuth token exchange failed (${response.status})`);
            error.status = response.status;
            error.upstreamCode = body.error;
            throw error;
          }
          return body;
        },
        importCredentials: async (raw, context) => [await this.importAccount(candidateFromBrowserToken(raw, {
          source: "official_claude_browser_oauth",
          now: context.now instanceof Date ? context.now : new Date(),
        }), context)],
      })
      : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }

  #statusFromResult(result, defaults = {}) {
    const normalized = normalizeOfficialSessionResult(result, {
      source: defaults.source ?? "official_claude_cli",
      sourceKind: defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
    });
    const status = parseClaudeAuthStatus(normalized?.output ?? "");
    return {
      ...status,
      source: normalized?.source ?? defaults.source ?? "official_claude_cli",
      sourceKind: normalized?.sourceKind ?? defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
      credential: normalized?.credential ?? null,
    };
  }

  async #persistedOAuthCredential() {
    try {
      return await readClaudeOAuthCredential({ home: this.home });
    } catch {
      return null;
    }
  }

  async #readStatus(signal) {
    if (typeof this.sessionReader === "function") {
      try {
        const value = await this.sessionReader({ env: this.env, signal });
        const normalized = normalizeOfficialSessionResult(value, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind,
        });
        if (normalized) return {
          ...normalized,
          credential: normalized.credential ?? await this.#persistedOAuthCredential(),
        };
      } catch {
        // Fall through to the provider CLI when an optional client reader is
        // unavailable on this machine.
      }
    }
    const result = await this.commandRunner(this.cliPath, ["auth", "status", "--json"], {
      env: this.env,
      providerId: PROVIDER_ID,
      timeoutMs: 30_000,
      ...(signal ? { signal } : {}),
    });
    const normalized = normalizeOfficialSessionResult(result, {
      source: "official_claude_cli",
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.CLI,
    });
    return normalized
      ? { ...normalized, credential: normalized.credential ?? await this.#persistedOAuthCredential() }
      : null;
  }

  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_claude_browser_oauth"
      || account?.refresh?.refreshable === true;
  }

  async #readBrowserCredential(account, context = {}) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) throw activeSessionError("Claude browser OAuth credential is missing; authorize again");
    return { ...credential, credentialRef };
  }

  async #refreshBrowserCredential(account, context = {}) {
    const credential = await this.#readBrowserCredential(account, context);
    const now = context.now instanceof Date ? context.now : new Date();
    const expiresAt = Date.parse(credential.expiresAt ?? "");
    if (!credential.refresh || (Number.isFinite(expiresAt) && expiresAt - now.getTime() > 60_000)) return credential;
    const response = await this.fetchImpl(this.browserTokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: credential.clientId ?? this.browserClientId,
      }),
      ...(context.signal ? { signal: context.signal } : {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      const error = new Error(`Claude browser OAuth refresh failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const updated = {
      ...credential,
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      expiresAt: typeof body.expires_in === "number" ? new Date(now.getTime() + body.expires_in * 1000).toISOString() : credential.expiresAt,
    };
    await context.secretStore.write(credential.credentialRef, updated);
    return updated;
  }

  async #browserStatus(account, context = {}) {
    const credential = await this.#refreshBrowserCredential(account, context);
    return {
      loggedIn: true,
      authMethod: "oauth",
      apiProvider: "firstParty",
      isApiKey: false,
      isSubscription: true,
      accountId: account.accountId,
      email: account.email,
      displayName: account.displayName,
      plan: account.subscription?.plan ?? null,
      raw: {},
      source: "official_claude_browser_oauth",
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
      credential,
    };
  }

  async #activeStatus(signal, account = null, context = {}) {
    if (this.#isBrowserAccount(account)) return this.#browserStatus(account, context);
    const result = await this.#readStatus(signal);
    const status = this.#statusFromResult(result, {
      source: this.sessionSource,
      sourceKind: this.sessionSourceKind,
    });
    if (!status.loggedIn || status.isApiKey || !status.isSubscription) {
      throw activeSessionError("Claude subscription OAuth is not the active official session; authorize again");
    }
    return status;
  }

  async #assertActiveSession(account, signal, context = {}) {
    const status = await this.#activeStatus(signal, account, context);
    if (account?.accountId !== status.accountId && account?.accountId !== "claude:active") {
      throw activeSessionError(
        "Claude only exposes its active official session; select the active account or authorize it again",
        { mismatch: true },
      );
    }
    return status;
  }

  async discover() {
    try {
      const result = await this.#readStatus();
      const status = this.#statusFromResult(result, {
        source: this.sessionSource,
        sourceKind: this.sessionSourceKind,
      });
      const source = status.source ?? "official_claude_cli";
      if (!status.loggedIn) {
        return { candidates: [], source, diagnostics: ["Claude 官方会话当前未登录"] };
      }
      if (status.isApiKey) {
        return { candidates: [], source, diagnostics: ["Claude 官方会话当前使用 API key；请使用订阅 OAuth 登录"] };
      }
      if (!status.isSubscription) {
        return { candidates: [], source, diagnostics: ["Claude 官方会话不是可识别的订阅 OAuth"] };
      }
      return {
        candidates: [candidateFromStatus(status, { source, sourceKind: status.sourceKind })],
        source,
        diagnostics: [],
      };
    } catch (error) {
      return { candidates: [], source: this.sessionSource, diagnostics: [`无法读取 Claude 官方会话：${error.message}`] };
    }
  }

  async importAccount(candidate, context = {}) {
    const session = candidate?.[CREDENTIAL_SLOT];
    if (!session) throw new Error("Claude candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(candidate.credentialRef, session);
    return {
      providerId: PROVIDER_ID,
      accountId: candidate.accountId,
      credentialRef: candidate.credentialRef,
      displayName: candidate.displayName,
      email: candidate.email,
      auth: { kind: OFFICIAL_SESSION_AUTH_KIND, scopes: [] },
      subscription: { ...candidate.subscription },
      refresh: { ...candidate.refresh },
      resources: {
        ...officialSessionResources({
          sourceKind: candidate.resources?.sessionSource ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
          authSource: candidate.source,
        }),
        transport: "anthropic_messages_sse",
        quotaSource: candidate.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP
          ? "official_client_status"
          : candidate.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
            ? "official_browser_status"
            : "official_cli_status",
      },
    };
  }

  async getActiveSession(context = {}) {
    try {
      const status = await this.#activeStatus(context.signal);
      const candidate = candidateFromStatus(status, {
        source: status.source,
        sourceKind: status.sourceKind,
      });
      const account = await this.importAccount(candidate, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID,
        instructions: "已检测到 Claude 官方会话，当前账号已接入 Dockyard DSH。",
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

  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:")
      ? this.browserAuthorizer
      : this.oauthAuthorizer === this.browserAuthorizer
        ? this.cliAuthorizer
        : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("当前 Claude 授权流程不接收手动授权码");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
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
    if (this.#isBrowserAccount(account)) await this.#refreshBrowserCredential(account, context);
    const status = await this.#assertActiveSession(account, context.signal, context);
    return {
      identity: { email: status.email, displayName: status.displayName },
      subscription: { plan: status.plan, status: "active", expiresAt: null },
      refresh: {
        accessTokenExpiresAt: status.credential?.expiresAt ?? null,
        lastRefreshedAt: (context.now instanceof Date ? context.now : new Date()).toISOString(),
        refreshable: Boolean(status.credential?.refresh),
      },
    };
  }

  async getQuota(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    const now = context.now instanceof Date ? context.now : new Date();
    const quotaSource = status.sourceKind === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP
      ? "official_client_status"
      : "claude_cli_status";
    const windows = recursiveQuotaWindows(status.raw, { source: quotaSource, now, prefix: "claude" });
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
      subscription: { plan: status.plan, status: status.isSubscription ? "active" : null, expiresAt: null },
      resources: {
        quotaDiagnostic: windows.length
          ? null
          : "Claude 官方会话状态未返回实时订阅额度；Dockyard 不显示估算百分比",
      },
    };
  }

  async getCatalog(context = {}) { return this.catalogLoader({ force: Boolean(context.force) }); }

  async invoke(request, invocation, context = {}) {
    await this.#assertActiveSession(invocation?.account, context.signal, context);
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Claude native invocation transport is not mounted");
    return executor({ request, invocation, context });
  }

  async stream(request, invocation, context = {}) { return this.invoke(request, invocation, context); }
}

export function createClaudeDriver(options = {}) { return new ClaudeSubscriptionDriver(options); }

export const claudeDriverConstants = Object.freeze({ providerId: PROVIDER_ID });
