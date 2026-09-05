import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import { createBrowserOAuthAuthorizer } from "../../../packages/oauth/src/browser-oauth-authorizer.mjs";
import { createCliOAuthAuthorizer } from "../../../packages/oauth/src/cli-oauth-authorizer.mjs";
import {
  contentHasImage,
  createAcpAgentExecutor,
  createCliAgentExecutor,
  runCliCommand,
  unsupportedContentError,
} from "../../../packages/providers/src/cli-agent-transport.mjs";
import { validateNativeEndpoint } from "../../../packages/providers/src/native-transport.mjs";
import {
  addSecondsIso,
  assertSecureEndpointUrl,
  decodeJwtPayload,
  finiteNumber,
  isoFromEpoch,
  readJsonFile,
  stringValue,
} from "../../../packages/providers/src/provider-utils.mjs";
import { OFFICIAL_SESSION_SOURCE_KINDS } from "../../../packages/providers/src/session-source.mjs";

const PROVIDER_ID = "grok";
const DEFAULT_AUTHORIZATION_URL = "https://auth.x.ai/oauth2/authorize";
const DEFAULT_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const DEFAULT_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const DEFAULT_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write workspaces:read workspaces:write";
const DEFAULT_GROK_HOME = join(homedir(), ".grok");
const DEFAULT_CATALOG_TTL_MS = 60_000;
const DEFAULT_GROK_USAGE_URL = "https://grok.com/?_s=usage";
const DEFAULT_GROK_CREDITS_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const DEFAULT_GROK_TOKEN_HEADER = "xai-grok-cli";
// Must follow the official Grok CLI release train (the upstream xai-grok-cli
// version advertised by api.x.ai / cli-chat-proxy.grok.com). Bump this default
// deliberately whenever the official CLI ships a new version; the value is
// overridable at runtime through DOCKYARD_GROK_CLIENT_VERSION.
const DEFAULT_GROK_CLIENT_VERSION = "0.2.112";
const CREDENTIAL_SLOT = Symbol("dockyard-grok-credential");

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}

function grokTokenExpiresAt(value, payload = {}, now = new Date()) {
  return isoFromEpoch(value?.expires_at ?? value?.expiresAt ?? payload.exp)
    ?? addSecondsIso(value?.expires_in ?? value?.expiresIn, now);
}

function grokTokenNeedsRefresh(credential, now = new Date(), leewayMs = 60_000) {
  if (!credential?.refresh || !credential.expiresAt) return false;
  const expiresAt = Date.parse(credential.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime() + leewayMs;
}

function grokHomePath({ env = process.env, home = homedir(), grokHome } = {}) {
  return grokHome ?? env.GROK_HOME ?? join(home, ".grok");
}

function grokCommandEnvironment(env, grokHome) {
  return { ...env, GROK_HOME: grokHome };
}

function authRecords(raw) {
  if (!raw || typeof raw !== "object") return [];
  if (typeof raw.key === "string" || typeof raw.access_token === "string" || typeof raw.accessToken === "string") {
    return [{ scopeKey: "default", value: raw }];
  }
  return Object.entries(raw)
    .filter(([, value]) => value && typeof value === "object")
    .map(([scopeKey, value]) => ({ scopeKey, value }));
}

/** Parse local Grok OAuth metadata while keeping token values private. */
export function parseGrokAuth(raw) {
  return authRecords(raw).map(({ scopeKey, value }) => {
    const access = firstString(value.key, value.access_token, value.accessToken);
    if (!access) return null;
    const accessPayload = decodeJwtPayload(access) ?? {};
    const expiresAt = grokTokenExpiresAt(value, accessPayload);
    const accountId = firstString(
      value.user_id,
      value.userId,
      value.principal_id,
      value.principalId,
      value.team_id,
      value.teamId,
      accessPayload.sub,
      accessPayload.user_id,
      accessPayload.userId,
    ) ?? `${scopeKey}:${hash(access).slice(0, 20)}`;
    const email = firstString(value.email, value.user_email, value.userEmail, accessPayload.email);
    return {
      access,
      refresh: firstString(value.refresh_token, value.refreshToken),
      accountId,
      email,
      displayName: firstString(value.first_name, value.firstName, value.name, accessPayload.name, email, accountId),
      plan: firstString(value.subscription_level, value.subscriptionLevel),
      expiresAt,
      createdAt: firstString(value.create_time, value.createdAt),
      scopes: Array.isArray(value.scopes)
        ? value.scopes.map(String)
        : typeof value.scope === "string" ? value.scope.split(/\s+/).filter(Boolean) : [],
      issuer: firstString(value.oidc_issuer, value.oidcIssuer, scopeKey.split("::")[0]),
      clientId: firstString(value.oidc_client_id, value.oidcClientId),
      authMode: firstString(value.auth_mode, value.authMode),
      scopeKey,
    };
  }).filter(Boolean);
}

function accountInput(tokens, credentialRef, now = new Date(), { source = "official_grok_oauth" } = {}) {
  return {
    providerId: PROVIDER_ID,
    accountId: tokens.accountId,
    credentialRef,
    displayName: tokens.displayName,
    email: tokens.email,
    auth: { kind: "oauth", scopes: tokens.scopes },
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.createdAt ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh),
    },
    resources: {
      transport: "xai_chat_completions_sse",
      accountScope: "oauth_account",
      sessionSource: source.includes("browser")
        ? OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
        : OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE,
      authSource: source,
      quotaSource: source.includes("browser") ? "official_browser_session" : "official_grok_session",
      quotaUrl: DEFAULT_GROK_USAGE_URL,
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

function candidateFromTokens(tokens, { source, now = new Date() } = {}) {
  const expired = tokens.expiresAt && new Date(tokens.expiresAt).getTime() <= now.getTime();
  return attachCredential({
    candidateId: `grok:${hash(tokens.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId: tokens.accountId,
    displayName: tokens.displayName ?? tokens.email ?? tokens.accountId,
    email: tokens.email,
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.createdAt ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh),
    },
    credentialRef: createCredentialRef(PROVIDER_ID, tokens.accountId),
    imported: false,
    status: expired ? "degraded" : "available",
    diagnostic: expired ? "Grok OAuth access token 已过期，导入后需要官方 OAuth 刷新" : null,
  }, tokens);
}

export function summarizeGrokCandidate(candidate) {
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

function cacheEntries(cache) {
  if (!cache?.models || typeof cache.models !== "object") return [];
  return Array.isArray(cache.models)
    ? cache.models.map((value) => [value?.id, value]).filter(([id]) => id)
    : Object.entries(cache.models);
}

function normalizeReasoning(info) {
  const raw = Array.isArray(info?.reasoning_efforts) ? info.reasoning_efforts : [];
  const efforts = raw.map((effort) => {
    const id = firstString(effort?.id, effort?.value);
    if (!id) return null;
    return {
      id,
      name: firstString(effort?.label, effort?.name, id),
      ...(typeof effort?.description === "string" ? { description: effort.description } : {}),
      ...(effort?.default === true ? { default: true } : {}),
    };
  }).filter(Boolean);
  if (!efforts.length) return undefined;
  const preferred = efforts.find((effort) => effort.default)?.id ?? firstString(info?.reasoning_effort);
  return {
    efforts: efforts.map(({ default: _default, ...effort }) => effort),
    ...(preferred && efforts.some((effort) => effort.id === preferred) ? { defaultEffort: preferred } : {}),
  };
}

export function parseGrokModelCatalog(output = "", cache = null) {
  const discovered = [...String(output).matchAll(/^\s*[*-]\s+(\S+)(?:\s+\(([^)]+)\))?/gm)]
    .map((match) => ({ id: match[1], name: match[2] ?? match[1] }));
  const cached = new Map(cacheEntries(cache).map(([id, value]) => [id, value?.info ?? value ?? {}]));
  const ids = [...new Set([...discovered.map((model) => model.id), ...cached.keys()])];
  return ids.map((id) => {
    const fromOutput = discovered.find((model) => model.id === id);
    const info = cached.get(id) ?? {};
    const outputName = fromOutput?.name === "default" ? null : fromOutput?.name;
    const model = { id, name: firstString(info.name, info.model, outputName, id) };
    const reasoning = normalizeReasoning(info);
    if (reasoning) model.reasoning = reasoning;
    const contextWindow = finiteNumber(info.context_window ?? info.contextWindow);
    const maxTokens = finiteNumber(info.max_completion_tokens ?? info.maxTokens);
    if (Number.isInteger(contextWindow)) model.contextWindow = contextWindow;
    if (Number.isInteger(maxTokens)) model.maxTokens = maxTokens;
    if (Array.isArray(info.input) && info.input.length > 0) model.inputModalities = [...info.input];
    return model;
  });
}

function finiteValue(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function centValue(value) {
  return finiteValue(value?.val ?? value);
}

function periodLabel(periodType) {
  const value = String(periodType ?? "").toUpperCase();
  if (value.includes("WEEK")) return "官方周额度周期";
  if (value.includes("MONTH")) return "官方月额度周期";
  return "官方额度周期";
}

/**
 * Normalize the official Grok Build credits config. The CLI's `/billing`
 * proxy forwards `grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig`; it is
 * the supported authenticated surface for the consumer weekly cycle.
 */
export function parseGrokCreditsConfig(body, { now = new Date() } = {}) {
  const config = body?.config && typeof body.config === "object" ? body.config : {};
  const updatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const usagePercent = finiteValue(config.creditUsagePercent);
  const monthlyLimit = centValue(config.monthlyLimit);
  const used = centValue(config.used);
  const currentPeriod = config.currentPeriod && typeof config.currentPeriod === "object"
    ? config.currentPeriod
    : {};
  const periodType = currentPeriod.type ?? config.periodType;
  const periodStart = currentPeriod.start ?? config.billingPeriodStart ?? null;
  const periodEnd = currentPeriod.end ?? config.billingPeriodEnd ?? null;

  let remaining = null;
  let limit = null;
  let unit = null;
  if (usagePercent !== null && usagePercent >= 0 && usagePercent <= 100) {
    remaining = Math.max(0, 100 - usagePercent);
    limit = 100;
    unit = "percent";
  } else if (monthlyLimit !== null && used !== null && monthlyLimit >= 0) {
    remaining = Math.max(0, monthlyLimit - used);
    limit = monthlyLimit;
    unit = "USD cents";
  }

  const windows = periodEnd || remaining !== null || limit !== null
    ? [{
      id: "grok.current_period",
      name: periodLabel(periodType),
      remaining,
      limit,
      unit,
      resetAt: periodEnd,
      updatedAt,
      source: "official_grok_build_billing",
    }]
    : [];
  return {
    quota: {
      remaining,
      limit,
      unit,
      resetAt: periodEnd,
      windows,
      updatedAt,
      source: "official_grok_build_billing",
    },
    subscription: {
      plan: typeof body?.subscriptionTier === "string" ? body.subscriptionTier : null,
      status: null,
      expiresAt: null,
    },
    resources: {
      quotaSource: "official_grok_build_billing",
      quotaDiagnostic: windows.length === 0
        ? "Grok 官方 credits config 未返回当前额度周期或剩余值"
        : remaining === null
          ? "Grok 官方已返回当前额度周期，但未返回剩余百分比"
          : null,
      quotaPeriodType: periodType ?? null,
      quotaPeriodStart: periodStart,
      quotaUrl: DEFAULT_GROK_USAGE_URL,
    },
  };
}

export function createGrokCatalogLoader({
  env = process.env,
  home = homedir(),
  grokHome,
  cliPath = env.DOCKYARD_GROK_CLI || "grok",
  commandRunner = null,
  timeoutMs = 30_000,
  readJson = readJsonFile,
  cacheTtlMs = Number(process.env.DOCKYARD_GROK_CATALOG_TTL_MS) || DEFAULT_CATALOG_TTL_MS,
} = {}) {
  const resolvedHome = grokHomePath({ env, home, grokHome });
  let cached = null;
  let cachedAt = 0;
  let pending = null;
  return async function loadCatalog({ force = false } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (!force && pending) return pending;
    const request = (async () => {
      const cache = await readJson(join(resolvedHome, "models_cache.json"));
      let value;
      if (typeof commandRunner === "function") {
        try {
          const result = await commandRunner(cliPath, ["models"], {
            env,
            timeoutMs,
            providerId: PROVIDER_ID,
          });
          const models = parseGrokModelCatalog(result.output, cache);
          value = {
            models,
            source: "official_grok_cli",
            ...(models.length ? {} : { diagnostics: ["Grok 官方 CLI 没有返回可用模型"] }),
          };
        } catch (error) {
          value = {
            models: parseGrokModelCatalog("", cache),
            source: cache ? "official_grok_local_cache" : "official_grok_cli",
            diagnostics: [`Grok 官方模型目录读取失败：${error.message}`],
          };
        }
      } else {
        value = {
          models: parseGrokModelCatalog("", cache),
          source: "official_grok_local_cache",
          ...(cache ? {} : { diagnostics: [`未找到 Grok 实时模型缓存：${join(resolvedHome, "models_cache.json")}`] }),
        };
      }
      cached = value;
      cachedAt = Date.now();
      return value;
    })().finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request;
  };
}

async function grokPromptContent(value, attachments, result = []) {
  if (typeof value === "string") {
    if (value.length > 0) result.push({ type: "text", text: value });
    return result;
  }
  if (Array.isArray(value)) {
    for (const part of value) await grokPromptContent(part, attachments, result);
    return result;
  }
  if (!value || typeof value !== "object") return result;
  if (value.type === "text") {
    return grokPromptContent(value.text ?? value.content, attachments, result);
  }
  if (value.type === "image") {
    if (typeof value.data === "string" && value.data.length > 0) {
      const mimeType = firstString(value.mimeType, value.mediaType);
      if (!mimeType) throw unsupportedContentError(PROVIDER_ID, "Grok image input is missing its media type");
      result.push({ type: "image", data: value.data, mimeType });
      return result;
    }
    if (typeof value.uri === "string" && value.uri.length > 0) {
      result.push({ type: "image", uri: value.uri });
      return result;
    }
    if (!value.attachment || typeof attachments?.readImage !== "function") {
      throw unsupportedContentError(
        PROVIDER_ID,
        "Grok image input requires DSH's durable attachment service",
      );
    }
    const stored = await attachments.readImage(value.attachment);
    const bytes = stored?.data;
    const mimeType = firstString(stored?.ref?.mediaType, value.attachment?.mediaType, value.mimeType);
    if (!bytes || !mimeType) {
      throw unsupportedContentError(PROVIDER_ID, "Grok could not read the durable image attachment");
    }
    result.push({
      type: "image",
      data: Buffer.from(bytes).toString("base64"),
      mimeType,
    });
    return result;
  }
  if (value.type === "tool-call") {
    const name = value.name ?? "unknown";
    const args = typeof value.arguments === "string" ? value.arguments : JSON.stringify(value.arguments ?? {});
    result.push({ type: "text", text: `[tool call: ${name}] ${args}` });
    return result;
  }
  if (value.type === "tool-result") return grokPromptContent(value.content, attachments, result);
  if (typeof value.text === "string" || typeof value.content === "string" || Array.isArray(value.content)) {
    return grokPromptContent(value.text ?? value.content, attachments, result);
  }
  return result;
}

/** Convert DSH messages to native ACP content blocks without dropping images. */
export async function grokRequestPromptBlocks(request = {}, attachments) {
  const blocks = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    blocks.push({ type: "text", text: `system:\n${request.system}` });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    blocks.push({ type: "text", text: `${message?.role ?? "message"}:\n` });
    await grokPromptContent(message?.content ?? message?.text, attachments, blocks);
  }
  return blocks.length > 0 ? blocks : [{ type: "text", text: "Continue the conversation." }];
}

export function createGrokCliExecutor({
  cliPath = process.env.DOCKYARD_GROK_CLI || "grok",
  env = process.env,
  timeoutMs = 300_000,
  streamCommandRunner,
  acpExecutor = null,
} = {}) {
  const textExecutor = createCliAgentExecutor({
    providerId: PROVIDER_ID,
    cliPath,
    env,
    timeoutMs,
    outputFormat: "streaming-json",
    ...(streamCommandRunner ? { streamCommandRunner } : {}),
    buildArgs: ({ request, prompt }) => {
      const args = ["--single", prompt, "--output-format", "streaming-json"];
      if (typeof request.model === "string" && request.model.length > 0) args.push("--model", request.model);
      if (typeof request.reasoningEffort === "string" && request.reasoningEffort.length > 0) args.push("--reasoning-effort", request.reasoningEffort);
      return args;
    },
  });
  const imageExecutor = acpExecutor ?? createAcpAgentExecutor({
    providerId: PROVIDER_ID,
    cliPath,
    env,
    timeoutMs,
    buildArgs: ({ request }) => {
      const args = [];
      if (typeof request.model === "string" && request.model.length > 0) args.push("--model", request.model);
      if (typeof request.reasoningEffort === "string" && request.reasoningEffort.length > 0) {
        args.push("--reasoning-effort", request.reasoningEffort);
      }
      args.push("agent", "stdio");
      return args;
    },
    promptBuilder: ({ request, context }) => grokRequestPromptBlocks(request, context.attachments),
  });
  return (envelope = {}) => contentHasImage(envelope.request)
    ? imageExecutor(envelope)
    : textExecutor(envelope);
}

export class GrokOAuthDriver {
  constructor({
    authFilePath,
    env = process.env,
    home = homedir(),
    grokHome,
    catalogLoader = null,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_GROK_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_GROK_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_GROK_TOKEN_URL || DEFAULT_TOKEN_URL,
    clientId = env.DOCKYARD_GROK_CLIENT_ID || DEFAULT_CLIENT_ID,
    oauthScope = env.DOCKYARD_GROK_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE,
    cliPath = env.DOCKYARD_GROK_CLI || "grok",
    commandRunner = runCliCommand,
    requestExecutor = null,
    fetchImpl = fetch,
    creditsUrl = env.DOCKYARD_GROK_CREDITS_URL || DEFAULT_GROK_CREDITS_URL,
    tokenHeader = env.DOCKYARD_GROK_TOKEN_HEADER || DEFAULT_GROK_TOKEN_HEADER,
    clientVersion = env.DOCKYARD_GROK_CLIENT_VERSION || DEFAULT_GROK_CLIENT_VERSION,
    timeoutMs = 30_000,
  } = {}) {
    this.env = env;
    this.grokHome = grokHomePath({ env, home, grokHome });
    this.authFilePath = authFilePath ?? join(this.grokHome, "auth.json");
    this.cliPath = cliPath;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.creditsUrl = validateNativeEndpoint(creditsUrl, { providerId: PROVIDER_ID });
    this.tokenHeader = String(tokenHeader || DEFAULT_GROK_TOKEN_HEADER);
    this.clientVersion = String(clientVersion || DEFAULT_GROK_CLIENT_VERSION);
    this.timeoutMs = timeoutMs;
    // SECURITY.md: OAuth endpoints must be https (or loopback http) even when
    // they come from the environment.
    this.authorizationUrl = assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_GROK_AUTHORIZATION_URL");
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_GROK_TOKEN_URL");
    this.clientId = clientId;
    this.oauthScope = oauthScope;
    this.catalogLoader = catalogLoader ?? createGrokCatalogLoader({
      env,
      home,
      grokHome: this.grokHome,
      cliPath,
      commandRunner,
      timeoutMs,
    });
    this.cliAuthorizer = createCliOAuthAuthorizer({
      providerId: PROVIDER_ID,
      cliPath,
      loginArgs: ["login", "--oauth"],
      environmentKey: "GROK_HOME",
      environment: env,
      profileDirectory: this.grokHome,
      browserOpened: true,
      instructions: "已启动官方 Grok CLI OAuth 登录。请在 auth.x.ai 官方网页完成登录，完成后回到 Dockyard DSH。",
      importCredentials: (raw, context) => this.#importOAuthState(raw, context),
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth
      ? createBrowserOAuthAuthorizer({
        providerId: PROVIDER_ID,
        callbackPath: "/callback",
        callbackHost: "127.0.0.1",
        callbackPort: 0,
        instructions: "请在官方 Grok 授权页面选择账号并完成授权；完成后会自动返回 Dockyard DSH。",
        authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri, nonce }) => {
          const url = new URL(authorizationUrl);
          url.search = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: oauthScope,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state,
            nonce,
             referrer: "grok-build",
           });
          return url.toString();
        },
        exchangeCode: async ({ code, codeVerifier, redirectUri, context }) => {
          const response = await this.fetchImpl(`${tokenUrl}`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: clientId,
              code,
              redirect_uri: redirectUri,
              code_verifier: codeVerifier,
            }),
            ...(context.signal ? { signal: context.signal } : {}),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const error = new Error(`Grok OAuth token exchange failed (${response.status})`);
            error.status = response.status;
            error.upstreamCode = body.error ?? body.error_code;
            throw error;
          }
          return {
            ...body,
            oidc_client_id: body.oidc_client_id ?? body.client_id ?? clientId,
            auth_mode: "oauth",
            scope: body.scope ?? oauthScope,
          };
        },
        importCredentials: (raw, context) => this.#importOAuthState(raw, context, "official_grok_browser_oauth"),
      })
      : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }

  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    const raw = await readJsonFile(this.authFilePath);
    if (!raw) {
      return { candidates: [], source: this.authFilePath, diagnostics: [`未发现 Grok OAuth 文件：${this.authFilePath}`] };
    }
    const candidates = parseGrokAuth(raw).map((tokens) => candidateFromTokens(tokens, { source: "official_grok_oauth", now }));
    return {
      candidates,
      source: "official_grok_oauth",
      diagnostics: candidates.length ? [] : ["Grok OAuth 文件存在，但没有可识别的 access token"],
    };
  }

  async importAccount(candidate, context = {}) {
    const tokens = candidate?.[CREDENTIAL_SLOT];
    if (!tokens) throw new Error("Grok candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
    await context.secretStore.write(credentialRef, {
      type: "oauth",
      providerId: PROVIDER_ID,
      access: tokens.access,
      refresh: tokens.refresh,
      accountId: tokens.accountId,
      email: tokens.email,
      displayName: tokens.displayName,
      expiresAt: tokens.expiresAt,
      issuer: tokens.issuer,
      clientId: tokens.clientId,
      scopes: tokens.scopes,
      scopeKey: tokens.scopeKey,
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
      throw new Error("Grok OAuth source is not valid JSON");
    }
    return this.#importOAuthState(raw, context, source?.fileName || "user_selected_oauth.json");
  }

  async #importOAuthState(raw, context = {}, source = "official_grok_oauth") {
    const tokens = parseGrokAuth(raw);
    if (!tokens.length) throw new Error("Grok OAuth state does not contain a supported account token");
    const accounts = [];
    for (const value of tokens) {
      accounts.push(await this.importAccount(candidateFromTokens(value, {
        source,
        now: context.now instanceof Date ? context.now : new Date(),
      }), context));
    }
    return accounts;
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
        instructions: "已检测到 Grok 官方 OAuth 会话，当前账号已接入 Dockyard DSH。",
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
      throw new Error("当前 Grok 授权流程不接收手动授权码");
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

  async #readCredential(account, context = {}) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) {
      const error = new Error("Grok OAuth credential is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    return { ...credential, accountId: credential.accountId ?? account.accountId };
  }

  async #refreshOAuthCredential(account, context = {}, { strict = false } = {}) {
    const credential = await this.#readCredential(account, context);
    const now = context.now instanceof Date ? context.now : new Date();
    if (!grokTokenNeedsRefresh(credential, now)) return credential;
    if (!credential.refresh) {
      if (!strict) return credential;
      const error = new Error("Grok OAuth access token expired; authorize again");
      error.authExpired = true;
      throw error;
    }

    let response;
    try {
      response = await this.fetchImpl(this.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          client_id: credential.clientId ?? this.clientId,
          grant_type: "refresh_token",
          refresh_token: credential.refresh,
        }),
        ...(context.signal ? { signal: context.signal } : {}),
      });
    } catch (cause) {
      const error = new Error("Grok OAuth refresh failed; authorize again");
      error.authExpired = true;
      error.cause = cause;
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    const access = firstString(body.access_token, body.accessToken, body.key);
    if (!response.ok || !access) {
      const error = new Error("Grok OAuth refresh failed; authorize again");
      error.status = response.status;
      error.authExpired = response.status === 401 || response.status === 400;
      throw error;
    }
    const updated = {
      ...credential,
      access,
      refresh: firstString(body.refresh_token, body.refreshToken, credential.refresh),
      expiresAt: grokTokenExpiresAt(body, decodeJwtPayload(access) ?? {}, now) ?? credential.expiresAt,
      lastRefreshedAt: now.toISOString(),
    };
    await context.secretStore.write(account.auth?.credentialRef ?? account.credentialRef, updated);
    return updated;
  }

  async #prepareCredentialEnvironment(account, context = {}) {
    const credential = await this.#readCredential(account, context);
    const profileDir = await mkdtemp(join(tmpdir(), "dockyard-grok-run-"));
    const authPath = join(profileDir, "auth.json");
    const key = account.accountId ?? credential.accountId;
    const raw = {
      [key]: {
        key: credential.access,
        ...(credential.refresh ? { refresh_token: credential.refresh } : {}),
        user_id: credential.accountId ?? account.accountId,
        ...((credential.email ?? account.email) ? { email: credential.email ?? account.email } : {}),
        ...(account.subscription?.plan ? { subscription_level: account.subscription.plan } : {}),
        ...(credential.expiresAt ? { expires_at: credential.expiresAt } : {}),
      },
    };
    await writeFile(authPath, JSON.stringify(raw), { mode: 0o600 });
    return { profileDir, authPath, credential, env: grokCommandEnvironment(this.env, profileDir) };
  }

  async #finishCredentialEnvironment(prepared, account, context = {}) {
    try {
      const raw = JSON.parse(await readFile(prepared.authPath, "utf8"));
      const updated = parseGrokAuth(raw).find((value) => value.accountId === (account.accountId ?? prepared.credential.accountId))
        ?? parseGrokAuth(raw)[0];
      if (updated && context.secretStore) {
        const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
        await context.secretStore.write(credentialRef, {
          ...prepared.credential,
          access: updated.access,
          ...(updated.refresh ? { refresh: updated.refresh } : {}),
          ...(updated.email ? { email: updated.email } : prepared.credential.email ? { email: prepared.credential.email } : {}),
          ...(updated.displayName ? { displayName: updated.displayName } : prepared.credential.displayName ? { displayName: prepared.credential.displayName } : {}),
          ...(updated.expiresAt ? { expiresAt: updated.expiresAt } : {}),
          accountId: updated.accountId,
          lastRefreshedAt: new Date().toISOString(),
        });
      }
      return updated;
    } finally {
      await rm(prepared.profileDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async refreshAccount(account, context = {}) {
    await this.#refreshOAuthCredential(account, context);
    const prepared = await this.#prepareCredentialEnvironment(account, context);
    let updated = null;
    let commandError = null;
    try {
      await this.commandRunner(this.cliPath, ["models"], {
        env: prepared.env,
        timeoutMs: this.timeoutMs,
        providerId: PROVIDER_ID,
      });
    } catch (error) {
      error.authExpired = error.code === 401 || /auth|login|expired|credential|access token.{0,80}(?:valid|invalid|expired|revok)/i.test(String(error.message));
      commandError = error;
    }
    let finishError = null;
    try {
      updated = await this.#finishCredentialEnvironment(prepared, account, context);
    } catch (error) {
      finishError = error;
    }
    if (commandError) {
      if (finishError && !commandError.cause) commandError.cause = finishError;
      throw commandError;
    }
    if (finishError) throw finishError;
    const now = context.now instanceof Date ? context.now : new Date();
    return {
      ...(updated?.email ? { email: updated.email } : {}),
      ...(updated?.displayName ? { displayName: updated.displayName } : {}),
      refresh: {
        accessTokenExpiresAt: updated?.expiresAt ?? account.refresh?.accessTokenExpiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: Boolean(updated?.refresh ?? prepared.credential.refresh),
      },
    };
  }

  async getQuota(account, context = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    const credential = await this.#refreshOAuthCredential(account, context, { strict: true });
    const accountId = credential.accountId ?? account.accountId;
    const response = await this.fetchImpl(this.creditsUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${credential.access}`,
        "x-xai-token-auth": this.tokenHeader,
        "x-userid": accountId,
        "x-grok-client-version": this.clientVersion,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Grok credits request failed (${response.status})`);
      error.status = response.status;
      // Billing/credits is an optional quota surface. A 401 here can mean
      // that the endpoint rejected the CLI billing headers, not that the
      // OAuth credential cannot invoke Grok. Keep the login state durable;
      // request authentication remains authoritative in native transport.
      error.quotaUnavailable = response.status === 401 || response.status === 403;
      throw error;
    }
    const parsed = parseGrokCreditsConfig(body, { now });
    return {
      ...parsed,
      subscription: {
        ...account.subscription,
        ...(parsed.subscription.plan ? { plan: parsed.subscription.plan } : {}),
      },
    };
  }

  async getCatalog(context = {}) {
    return this.catalogLoader({ force: Boolean(context.force) });
  }

  async invoke(request, invocation, context = {}) {
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Grok native invocation transport is not mounted");
    const account = invocation?.account;
    // Native xAI transport receives the selected account's OAuth token
    // directly. Only the legacy CLI path needs a temporary GROK_HOME profile;
    // creating that profile on every request would reintroduce the startup
    // latency this transport is meant to remove.
    if (executor.nativeTransport === "xai-chat-completions") {
      const credential = account && context.secretStore
        ? await this.#refreshOAuthCredential(account, context, { strict: true })
        : null;
      return executor({ request, invocation, credential, context });
    }
    if (!account || !context.secretStore) return executor({ request, invocation, context });
    const prepared = await this.#prepareCredentialEnvironment(account, context);
    let output;
    try {
      output = await executor({
        request,
        invocation,
        context: { ...context, env: prepared.env },
      });
    } catch (error) {
      try {
        await this.#finishCredentialEnvironment(prepared, account, context);
      } catch (finishError) {
        if (!error.cause) error.cause = finishError;
      }
      throw error;
    }
    return (async function* streamWithCleanup() {
      const driver = this;
      let streamError = null;
      try {
        for await (const chunk of output) yield chunk;
      } catch (error) {
        streamError = error;
        throw error;
      } finally {
        try {
          await driver.#finishCredentialEnvironment(prepared, account, context);
        } catch (finishError) {
          if (streamError) {
            if (!streamError.cause) streamError.cause = finishError;
          } else {
            throw finishError;
          }
        }
      }
    }).call(this);
  }

  async stream(request, invocation, context = {}) { return this.invoke(request, invocation, context); }
}

export function createGrokDriver(options = {}) {
  return new GrokOAuthDriver(options);
}

export const grokDriverConstants = Object.freeze({ providerId: PROVIDER_ID });
