import { ACCOUNT_SELECTION_POLICY } from "./contracts.mjs";
import { ValidationError } from "./errors.mjs";
import { redactError } from "../../providers/src/provider-utils.mjs";

function selectionContext(context, excludedIds) {
  if (excludedIds.size === 0) return context;
  return { ...context, excludeAccountIds: [...excludedIds] };
}

function shouldFailover(error, accountPool, context) {
  return accountPool.policy === ACCOUNT_SELECTION_POLICY.FAILOVER
    && !context.accountId
    && (error?.rateLimited || error?.quotaExhausted || error?.authExpired || error?.emptyOutput);
}

function quotaResetAt(account, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const candidates = [
    account?.quota?.resetAt,
    ...(Array.isArray(account?.quota?.windows) ? account.quota.windows.map((window) => window?.resetAt) : []),
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  if (candidates.length === 0) return null;
  // A reset point that has already passed means the quota window has reset, so
  // the account must become eligible again instead of staying excluded forever.
  // Future reset points still act as a cooldown until that moment.
  const next = candidates.find((candidate) => candidate.getTime() > nowMs);
  return (next ?? candidates[0]).toISOString();
}

function failureStatus(error) {
  if (error?.authExpired) return "auth_expired";
  if (error?.quotaExhausted) return "quota_exhausted";
  if (error?.rateLimited) return "rate_limited";
  return "error";
}

function failureCooldown(error, account, now) {
  return error?.cooldownUntil ?? quotaResetAt(account, now);
}

function reportAccount(accountPool, accountId, result, { opToken } = {}) {
  // Health reporting is secondary to the provider response. In-flight work may
  // finish after the user removes its account, in which case there is nothing
  // left to report and the response must remain intact.
  try {
    // Provider error messages are externally influenced and may embed URLs,
    // response bodies, or credential material: redact before they can reach
    // persisted pool state or UI surfaces.
    const safeResult = result?.message ? { ...result, message: redactError(result.message) } : result;
    accountPool.report(accountId, safeResult, { opToken });
  } catch {
    // A provider response or the original provider error must never be masked
    // by a best-effort health persistence failure.
  }
}

function errorFromTerminalChunk(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error"
    ? chunk.reason.failure
    : null;
  if (!failure) return null;
  const error = new Error(String(failure.message ?? "Provider stream failed"));
  if (failure.code !== undefined) error.code = failure.code;
  if (failure.status !== undefined) error.status = failure.status;
  if (failure.upstreamCode !== undefined) error.upstreamCode = failure.upstreamCode;
  if (failure.authExpired) error.authExpired = true;
  if (failure.authForbidden) error.authForbidden = true;
  if (failure.rateLimited) error.rateLimited = true;
  if (failure.quotaExhausted) error.quotaExhausted = true;
  return error;
}

function hasSubstantiveStreamOutput(chunk) {
  if (!chunk || typeof chunk !== "object") return true;
  if (chunk.type === "block-start") return false;
  if (chunk.type === "block-end") {
    return Boolean(chunk.block?.text || chunk.block?.id || chunk.block?.arguments);
  }
  return !["usage", "finish"].includes(chunk.type);
}

function providerAccount(account, auth) {
  return {
    ...account,
    auth: {
      kind: auth.authKind,
      credentialRef: auth.credentialRef,
      scopes: [...auth.scopes],
    },
  };
}

function requestWithContextWindow(request, providerId, modelId, accountId, contextWindowOverrides) {
  if (!modelId || !contextWindowOverrides || typeof contextWindowOverrides.resolve !== "function") return request;
  const contextWindow = contextWindowOverrides.resolve(providerId, modelId, { accountId });
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) return request;
  return {
    ...request,
    modelContext: {
      ...(request?.modelContext ?? {}),
      contextWindow,
    },
  };
}

export function createProviderRoute({ providerModule, accountPool, contextWindowOverrides = null }) {
  if (!providerModule?.manifest?.id) throw new ValidationError("Provider module is required");
  if (!accountPool?.select || !accountPool?.resolve) throw new ValidationError("Account pool is required");
  if (accountPool.providerId !== providerModule.manifest.id) {
    throw new ValidationError("Provider module and account pool do not match", {
      providerId: providerModule.manifest.id,
      poolProviderId: accountPool.providerId,
    });
  }

  return {
    providerId: providerModule.manifest.id,

    async invoke(request, context = {}) {
      const excludedIds = new Set(context.excludeAccountIds ?? []);
      let lastError = null;
      while (true) {
        let account;
        try {
          account = accountPool.select(selectionContext(context, excludedIds));
        } catch (selectionError) {
          throw lastError ?? selectionError;
        }
        excludedIds.add(account.accountId);
        const auth = accountPool.resolve(account.accountId);
        const selectedAccount = providerAccount(account, auth);
        const selectedRequest = requestWithContextWindow(
          request,
          providerModule.manifest.id,
          request?.model,
          account.accountId,
          contextWindowOverrides,
        );
        try {
          const response = await providerModule.invoke(
            selectedRequest,
            { account: selectedAccount, auth },
            context,
          );
          reportAccount(accountPool, account.accountId, {
            status: "success",
            quota: response?.quota,
            refresh: response?.refresh,
          }, { opToken: account.opToken });
          return response;
        } catch (error) {
          reportAccount(accountPool, account.accountId, {
            status: failureStatus(error),
            cooldownUntil: failureCooldown(error, selectedAccount, accountPool.clock()),
            message: error?.message,
          }, { opToken: account.opToken });
          if (!shouldFailover(error, accountPool, context)) throw error;
          lastError = error;
        }
      }
    },

    stream(request, context = {}) {
      return (async function* streamWithHealth() {
        const excludedIds = new Set(context.excludeAccountIds ?? []);
        let lastError = null;
        while (true) {
          let account;
          try {
            account = accountPool.select(selectionContext(context, excludedIds));
          } catch (selectionError) {
            throw lastError ?? selectionError;
          }
          excludedIds.add(account.accountId);
          const auth = accountPool.resolve(account.accountId);
          const selectedAccount = providerAccount(account, auth);
          const selectedRequest = requestWithContextWindow(
            request,
            providerModule.manifest.id,
            request?.model,
            account.accountId,
            contextWindowOverrides,
          );
          const pending = [];
          let hasOutput = false;
          try {
            const output = providerModule.stream(selectedRequest, { account: selectedAccount, auth }, context);
            for await (const chunk of await output) {
              if (!hasOutput && !hasSubstantiveStreamOutput(chunk)) {
                pending.push(chunk);
                continue;
              }
              if (!hasOutput) {
                hasOutput = true;
                for (const buffered of pending) yield buffered;
              }
              yield chunk;
            }
            if (!hasOutput) {
              const terminalError = pending.map(errorFromTerminalChunk).find(Boolean);
              const error = terminalError ?? new Error("Provider stream ended without substantive output");
              if (!terminalError) {
                error.code = "EMPTY_STREAM_OUTPUT";
                error.emptyOutput = true;
              }
              throw error;
            }
            reportAccount(accountPool, account.accountId, { status: "success" }, { opToken: account.opToken });
            return;
          } catch (error) {
            reportAccount(accountPool, account.accountId, {
              status: failureStatus(error),
              cooldownUntil: failureCooldown(error, selectedAccount, accountPool.clock()),
              message: error?.message,
            }, { opToken: account.opToken });
            if (!hasOutput && shouldFailover(error, accountPool, context)) {
              lastError = error;
              continue;
            }
            throw error;
          }
        }
      })();
    },
  };
}
