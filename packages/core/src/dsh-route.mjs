import { ACCOUNT_SELECTION_POLICY } from "./contracts.mjs";
import { ValidationError } from "./errors.mjs";

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

export function createProviderRoute({ providerModule, accountPool }) {
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
        try {
          const response = await providerModule.invoke(
            request,
            { account: selectedAccount, auth },
            context,
          );
          accountPool.report(account.accountId, {
            status: "success",
            quota: response?.quota,
            refresh: response?.refresh,
          });
          return response;
        } catch (error) {
          accountPool.report(account.accountId, {
            status: failureStatus(error),
            cooldownUntil: failureCooldown(error, selectedAccount, accountPool.clock()),
            message: error?.message,
          });
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
          const pending = [];
          let hasOutput = false;
          try {
            const output = providerModule.stream(request, { account: selectedAccount, auth }, context);
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
              const error = new Error("Provider stream ended without substantive output");
              error.code = "EMPTY_STREAM_OUTPUT";
              error.emptyOutput = true;
              throw error;
            }
            accountPool.report(account.accountId, { status: "success" });
            return;
          } catch (error) {
            accountPool.report(account.accountId, {
              status: failureStatus(error),
              cooldownUntil: failureCooldown(error, selectedAccount, accountPool.clock()),
              message: error?.message,
            });
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
