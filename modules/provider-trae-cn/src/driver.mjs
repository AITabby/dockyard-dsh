import { randomUUID } from "node:crypto";
import { createAccountRecord, createQuotaSnapshot } from "../../../packages/core/src/contracts.mjs";
import { redactError, stringValue } from "../../../packages/providers/src/provider-utils.mjs";
import { createCredentialRef } from "../../../packages/vault/src/index.mjs";
import {
  PROVIDER_ID,
  TRAE_CN_MODELS,
  TRAE_CN_SITE,
  createTraeNativeExecutor,
  readTraeCredits,
  readTraeModelRoster,
  startTraeSignIn,
} from "./native-transport.mjs";

const CREDENTIAL_SLOT = Symbol("dockyard-trae-cn-credential");

function accountIdFor(credential) {
  const uid = stringValue(credential?.uid);
  if (!uid) return "trae-cn";
  return `trae-cn-${uid}`;
}

export function summarizeTraeCnCandidate(candidate) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate?.candidateId ?? "trae-cn",
    accountId: candidate?.accountId ?? "trae-cn",
    displayName: candidate?.displayName ?? "Trae CN",
    email: candidate?.email ?? null,
    source: candidate?.source ?? "trae_cn_browser_oauth",
  };
}

/** The catalog: Trae publishes no model list, so this is the IDE's roster. */
export function parseTraeCnCatalog(models = TRAE_CN_MODELS) {
  return {
    models: models.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
      ...(model.maxTokens ? { maxTokens: model.maxTokens } : {}),
      ...(model.reasoning ? { reasoning: model.reasoning } : {}),
      inputModalities: model.inputModalities ?? ["text"],
    })),
  };
}

/**
 * The static table decides *which* ids exist (only ones proven against the chat
 * endpoint); the live roster decides what each one can actually do. Ids the
 * roster does not know keep the conservative floor.
 */
export function mergeTraeCnRoster(models, roster) {
  if (!roster || roster.size === 0) return models;
  return models.map((model) => {
    const live = roster.get(String(model.id).toLowerCase());
    if (!live) return model;
    const creditRate = live.creditRate && live.creditRate !== 1 ? ` (x${live.creditRate})` : "";
    const merged = {
      ...model,
      name: `${live.name ?? model.name}${creditRate}`,
      contextWindow: live.contextWindow ?? model.contextWindow,
      inputModalities: live.multimodal ? ["text", "image"] : ["text"],
    };
    // A model the roster marks as non-reasoning must not offer effort choices.
    if (live.reasoning === false) delete merged.reasoning;
    return merged;
  });
}

export class TraeCnSubscriptionDriver {
  #sessions = new Map();
  #requestExecutor;

  constructor({
    site = TRAE_CN_SITE,
    fetchImpl = fetch,
    timeoutMs = 300_000,
    signInTimeoutMs = 600_000,
    catalogLoader = null,
    requestExecutor = null,
  } = {}) {
    this.site = site;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.signInTimeoutMs = signInTimeoutMs;
    this.#requestExecutor = requestExecutor ?? createTraeNativeExecutor({ site, fetchImpl, timeoutMs });
    this.catalogLoader = catalogLoader ?? (async () => parseTraeCnCatalog());
  }

  /**
   * Trae CN signs in through its own authorization page, which calls back to a
   * loopback server this plugin runs. There is no API key to paste, so the
   * panel's "log in" button is the only entry point.
   */
  async authorizationInstructions() {
    return "Trae CN 使用官方授权页登录，没有可填写的 API Key。"
      + "点「登录」会在浏览器打开 Trae CN 的授权页面；在页面上同意授权后，"
      + "回调会自动回到本机并完成接入，不需要复制任何代码。";
  }

  async startAuthorization(context = {}) {
    const session = await startTraeSignIn({
      site: this.site,
      timeoutMs: this.signInTimeoutMs,
    });
    const sessionId = `${PROVIDER_ID}:${randomUUID()}`;
    const state = { status: "pending", credential: null, error: null };
    session.result.then((result) => {
      if (result?.ok) {
        state.credential = result.credential;
        return;
      }
      state.status = "failed";
      state.error = result?.error ?? "登录失败";
    }).catch((error) => {
      state.status = "failed";
      state.error = redactError(error);
    });
    this.#sessions.set(sessionId, { session, state, startedAt: new Date().toISOString() });
    return {
      status: "pending",
      providerId: PROVIDER_ID,
      sessionId,
      authorizationUrl: session.authorizationUrl,
      instructions: session.instructions,
      startedAt: new Date().toISOString(),
    };
  }

  async pollAuthorization(sessionId, context = {}) {
    const entry = this.#sessions.get(sessionId);
    if (!entry) {
      return {
        status: "failed",
        providerId: PROVIDER_ID,
        sessionId,
        diagnostic: "这次登录会话已经过期，请重新发起登录。",
      };
    }
    if (entry.state.status === "failed") {
      this.#sessions.delete(sessionId);
      return {
        status: "failed",
        providerId: PROVIDER_ID,
        sessionId,
        diagnostic: entry.state.error,
      };
    }
    // A finished sign-in is answered again with the same result: the panel
    // polls faster than the account import completes, and reporting "expired"
    // for the second poll told the user their success was a failure.
    if (entry.state.result) return entry.state.result;
    const credential = entry.state.credential;
    if (!credential) {
      return { status: "pending", providerId: PROVIDER_ID, sessionId };
    }
    const accountId = accountIdFor(credential);
    const candidate = {
      candidateId: accountId,
      accountId,
      displayName: credential.name || credential.uid || "Trae CN",
      email: credential.email || null,
      source: "trae_cn_browser_oauth",
    };
    Object.defineProperty(candidate, CREDENTIAL_SLOT, { value: credential, enumerable: false });
    const completed = {
      status: "completed",
      providerId: PROVIDER_ID,
      sessionId,
      diagnostic: null,
      accounts: [candidate],
    };
    entry.state.result = completed;
    // Keep the finished session long enough for any late poll to see the same
    // answer, then forget it.
    setTimeout(() => this.#sessions.delete(sessionId), 120_000).unref?.();
    return completed;
  }

  async cancelAuthorization(sessionId, context = {}) {
    const entry = this.#sessions.get(sessionId);
    if (entry) {
      entry.session.cancel();
      this.#sessions.delete(sessionId);
    }
    return { status: "cancelled", providerId: PROVIDER_ID, sessionId };
  }

  async importAccount(candidate, context = {}) {
    const credential = candidate?.[CREDENTIAL_SLOT];
    if (!credential) throw new Error("Trae CN 的登录信息已失效，请重新登录");
    const accountId = candidate?.accountId ?? accountIdFor(credential);
    const ref = createCredentialRef(PROVIDER_ID, accountId);
    if (!context.secretStore) {
      throw new Error("Trae CN 需要安全凭据存储，但当前环境没有提供 secretStore");
    }
    {
      await context.secretStore.write(ref, {
        token: credential.token,
        refreshToken: credential.refreshToken,
        expiresAt: credential.expiresAt ?? null,
        refreshExpiresAt: credential.refreshExpiresAt ?? null,
        clientId: credential.clientId ?? this.site.clientId,
        uid: credential.uid,
        name: credential.name ?? null,
        email: credential.email ?? null,
        device: credential.device,
      });
      // Read it back: a store that silently drops the object leaves an account
      // that looks connected and fails on its first request.
      const stored = await context.secretStore.read(ref).catch(() => null);
      if (!stored?.token) {
        throw new Error("Trae CN 登录凭据没有写入安全存储（回读为空）");
      }
    }
    return createAccountRecord({
      providerId: PROVIDER_ID,
      accountId,
      credentialRef: ref,
      displayName: candidate?.displayName ?? credential.name ?? "Trae CN",
      email: candidate?.email ?? credential.email ?? null,
      auth: { kind: "oauth", scopes: [] },
      subscription: { plan: null, status: "active" },
      refresh: {
        accessTokenExpiresAt: credential.expiresAt ? new Date(credential.expiresAt).toISOString() : null,
        refreshable: Boolean(credential.refreshToken),
      },
      resources: {
        transport: "trae_cn_llm_utils_chat",
        quotaSource: "trae_cn_credits",
        uid: credential.uid ?? null,
      },
    });
  }

  getActiveSession() {
    // Trae CN has no ambient desktop session this plugin may read: the account
    // exists only once its own authorization page has been answered.
    return Promise.resolve(null);
  }

  async getCatalog(context = {}) {
    const accounts = context?.accounts ?? [];
    const account = accounts.find((candidate) => candidate?.accountId === context?.accountId) ?? accounts[0];
    if (account) {
      const credential = await this.#credentialOf(account, context);
      if (credential) {
        try {
          const roster = await readTraeModelRoster({
            credential,
            site: this.site,
            fetchImpl: this.fetchImpl,
          });
          return parseTraeCnCatalog(mergeTraeCnRoster(TRAE_CN_MODELS, roster));
        } catch {
          // A live-roster hiccup must not empty the model list.
        }
      }
    }
    return this.catalogLoader({ force: Boolean(context?.force) });
  }

  async getQuota(account, context = {}) {
    const credential = await this.#credentialOf(account, context);
    if (!credential) {
      return createQuotaSnapshot({ unit: "credits", source: "trae_cn_credits" });
    }
    try {
      const credits = await readTraeCredits({
        credential,
        site: this.site,
        fetchImpl: this.fetchImpl,
      });
      return createQuotaSnapshot({
        unit: "credits",
        source: "trae_cn_credits",
        ...(credits.limit > 0 ? { limit: credits.limit, remaining: Math.max(0, credits.limit - credits.used) } : {}),
        ...(credits.resetsAt ? { resetAt: credits.resetsAt } : {}),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      // A rejected JWT is not a transient failure: Trae CN keeps one live
      // sign-in per account, so a sign-in elsewhere (or a later expiry) leaves
      // this account dead until the user logs in again. Reporting an empty
      // snapshot as "healthy" hid exactly that.
      if (error?.status === 401 || error?.status === 403) {
        const expired = new Error("Trae CN 登录已失效，请重新登录");
        expired.code = "AUTH_EXPIRED";
        throw expired;
      }
      return createQuotaSnapshot({ unit: "credits", source: "trae_cn_credits", updatedAt: new Date().toISOString() });
    }
  }

  async refreshAccount(account, context = {}) {
    // Trae renews a JWT through a device-signed ExchangeToken, which this
    // provider does not implement yet: the account keeps working until its
    // token expires, then the user signs in again.
    return {
      health: {
        status: "healthy",
        lastCheckedAt: new Date().toISOString(),
      },
      quota: await this.getQuota(account, context),
    };
  }

  async #credentialOf(account, context = {}) {
    // Callers hand over either an account record or its `auth` object.
    const ref = account?.auth?.credentialRef ?? account?.credentialRef;
    if (ref && context.secretStore) {
      const stored = await context.secretStore.read(ref).catch(() => null);
      if (stored?.token) return stored;
    }
    return null;
  }

  async invoke(requestOrEnvelope, invocation, context = {}) {
    const isEnvelope = requestOrEnvelope && typeof requestOrEnvelope === "object" && "request" in requestOrEnvelope;
    const request = isEnvelope ? requestOrEnvelope.request : requestOrEnvelope;
    const inv = isEnvelope ? requestOrEnvelope.invocation : invocation;
    const ctx = isEnvelope ? (requestOrEnvelope.context ?? {}) : context;
    const executor = ctx?.requestExecutor ?? this.#requestExecutor;
    const credential = (isEnvelope ? requestOrEnvelope.credential : null)
      ?? await this.#credentialOf(inv?.auth ?? inv ?? {}, ctx);
    if (!credential) {
      throw new Error("Trae CN 账号缺少登录凭据，请重新登录");
    }
    return executor({
      request: {
        ...request,
        signal: request?.signal ?? ctx?.signal ?? inv?.signal,
      },
      credential,
      signal: request?.signal ?? ctx?.signal ?? inv?.signal,
    });
  }

  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
}

export function createTraeCnDriver(options = {}) {
  return new TraeCnSubscriptionDriver(options);
}
