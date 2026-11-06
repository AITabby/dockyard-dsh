import {
  ACCOUNT_HEALTH,
  ACCOUNT_SELECTION_POLICY,
  accountSummary,
  createBalanceSnapshot,
  createAccountRecord,
  createQuotaSnapshot,
  createRefreshState,
  accountStorageRecord,
} from "../../core/src/contracts.mjs";
import { AccountSelectionError, ValidationError } from "../../core/src/errors.mjs";

function defaultClock() {
  return new Date();
}

const STICKY_SESSION_TTL_MS = 30 * 60 * 1000;
// How long an account whose authorization expired stays parked before it is
// retried. Overridable per report through `cooldownUntil`.
const RELIST_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_STICKY_ASSIGNMENTS = 10_000;

export class AccountPool {
  #accounts = new Map();
  #sessionAssignments = new Map();
  #cursor = 0;
  #defaultAccountId = null;
  // Monotonic operation sequencing: every select() hands out a token and only
  // the newest report per account may commit health/quota changes. This keeps
  // a late result from an older request (e.g. one that used pre-refresh
  // credentials) from flipping a newer auth_expired back to healthy.
  #operationSeq = 0;
  #reportedOpByAccount = new Map();

  constructor({ providerId, policy = ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock = defaultClock } = {}) {
    if (!providerId) throw new ValidationError("AccountPool providerId is required");
    if (!Object.values(ACCOUNT_SELECTION_POLICY).includes(policy)) {
      throw new ValidationError(`Unknown account selection policy: ${policy}`, { policy });
    }
    this.providerId = providerId;
    this.policy = policy;
    this.clock = clock;
  }

  upsert(input, { resetHealth = false } = {}) {
    if (input.providerId && input.providerId !== this.providerId) {
      throw new ValidationError("Account provider does not match this pool", {
        expected: this.providerId,
        received: input.providerId,
      });
    }
    const current = this.#accounts.get(input.accountId);
    const account = createAccountRecord(
      {
        ...current,
        ...input,
        credentialRef: input.credentialRef ?? current?.auth?.credentialRef,
        providerId: this.providerId,
        auth: { ...current?.auth, ...input.auth },
        subscription: { ...current?.subscription, ...input.subscription },
        quota: { ...current?.quota, ...input.quota },
        refresh: { ...current?.refresh, ...input.refresh },
        resources: { ...current?.resources, ...input.resources },
        health: resetHealth
          ? {
            ...input.health,
            status: input.health?.status === ACCOUNT_HEALTH.EXPIRED
              ? ACCOUNT_HEALTH.UNKNOWN
              : input.health?.status ?? ACCOUNT_HEALTH.UNKNOWN,
            cooldownUntil: null,
            lastError: null,
          }
          : { ...current?.health, ...input.health },
        createdAt: current?.createdAt ?? input.createdAt,
      },
      this.clock(),
    );
    this.#accounts.set(account.accountId, account);
    this.#ensureSingleAccountDefault();
    return accountSummary(account);
  }

  remove(accountId) {
    this.#sessionAssignments.forEach((assignment, key) => {
      const assignedId = typeof assignment === "string" ? assignment : assignment?.accountId;
      if (assignedId === accountId) this.#sessionAssignments.delete(key);
    });
    const removed = this.#accounts.delete(accountId);
    if (removed) this.#reportedOpByAccount.delete(accountId);
    if (removed && this.#defaultAccountId === accountId) this.#defaultAccountId = null;
    this.#ensureSingleAccountDefault();
    return removed;
  }

  get(accountId) {
    const account = this.#accounts.get(accountId);
    return account ? accountSummary(account) : null;
  }

  list() {
    return [...this.#accounts.values()].map(accountSummary);
  }

  listForStorage() {
    return [...this.#accounts.values()].map(accountStorageRecord);
  }

  getDefaultAccountId() {
    return this.#defaultAccountId;
  }

  setPolicy(policy) {
    if (!Object.values(ACCOUNT_SELECTION_POLICY).includes(policy)) {
      throw new ValidationError(`Unknown account selection policy: ${policy}`, { policy });
    }
    this.policy = policy;
    this.#sessionAssignments.clear();
    this.#ensureSingleAccountDefault();
  }

  setDefaultAccount(accountId) {
    if (accountId !== null && !this.#accounts.has(accountId)) {
      throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    }
    this.#defaultAccountId = accountId;
  }

  select(context = {}) {
    const now = this.clock();
    this.#pruneSessionAssignments(now.getTime());
    // A model the provider serves for free does not spend the paid quota, so an
    // account whose quota is spent must still be selectable for it.
    const eligible = this.#eligibleAccounts(now, { allowExhausted: context.allowExhausted === true });
    if (eligible.length === 0) {
      throw new AccountSelectionError(`No eligible accounts for provider ${this.providerId}`, {
        providerId: this.providerId,
      });
    }

    const excludedIds = new Set(Array.isArray(context.excludeAccountIds) ? context.excludeAccountIds : []);
    const selectable = eligible.filter((candidate) => !excludedIds.has(candidate.accountId));
    if (selectable.length === 0) {
      throw new AccountSelectionError("No eligible account remains after selection exclusions", {
        providerId: this.providerId,
        excludeAccountIds: [...excludedIds],
      });
    }

    let account;
    if (this.policy === ACCOUNT_SELECTION_POLICY.MANUAL) {
      const requestedId = context.accountId ?? this.#defaultAccountId ?? (
        selectable.length === 1 ? selectable[0].accountId : null
      );
      if (!requestedId) throw new AccountSelectionError("Manual policy requires accountId");
      account = selectable.find((candidate) => candidate.accountId === requestedId);
      if (!account) throw new AccountSelectionError(`Account is not eligible: ${requestedId}`, { accountId: requestedId });
    } else {
      const sticky = this.policy === ACCOUNT_SELECTION_POLICY.STICKY_SESSION;
      const assignmentKey = sticky ? context.sessionId ?? context.requestId ?? null : null;
      const assignment = assignmentKey ? this.#sessionAssignments.get(assignmentKey) : null;
      const assignedId = typeof assignment === "string" ? assignment : assignment?.accountId;
      account = assignedId
        ? selectable.find((candidate) => candidate.accountId === assignedId)
        : null;
      if (!account) {
        if (this.policy === ACCOUNT_SELECTION_POLICY.FAILOVER) {
          account = selectable[0];
        } else if (this.policy === ACCOUNT_SELECTION_POLICY.ALLOWANCE_FULLEST) {
          // Burn the account with the most headroom, so accounts whose windows
          // reset later are not drained first. Accounts that report no windows
          // cannot be compared, so the pool falls back to round robin.
          account = this.#fullest(selectable) ?? this.#next(selectable);
        } else {
          account = this.#next(selectable);
        }
      }
      if (assignmentKey) {
        this.#sessionAssignments.delete(assignmentKey);
        this.#sessionAssignments.set(assignmentKey, {
          accountId: account.accountId,
          lastUsedAt: now.getTime(),
        });
        this.#pruneSessionAssignments(now.getTime());
      }
    }

    const timestamp = now.toISOString();
    const updated = {
      ...account,
      lastUsedAt: timestamp,
      updatedAt: timestamp,
    };
    this.#accounts.set(updated.accountId, updated);
    const summary = accountSummary(updated);
    return { ...summary, opToken: ++this.#operationSeq };
  }

  resolve(accountId) {
    const account = this.#accounts.get(accountId);
    if (!account) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return {
      providerId: account.providerId,
      accountId: account.accountId,
      credentialRef: account.auth.credentialRef,
      authKind: account.auth.kind,
      scopes: [...account.auth.scopes],
    };
  }

  updateQuota(accountId, input) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, {
      quota: createQuotaSnapshot({ ...current.quota, ...input }, this.clock()),
    });
  }

  updateRefresh(accountId, input) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, {
      refresh: createRefreshState({ ...current.refresh, ...input }),
    });
  }

  updateResources(accountId, input = {}) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, { resources: { ...current.resources, ...input } });
  }

  report(accountId, result = {}, { opToken } = {}) {
    const account = this.#accounts.get(accountId);
    // Requests may finish after the user removes their account. Health for a
    // deleted record has no destination and must not replace the provider's
    // response with an unrelated selection error.
    if (!account) return null;

    // A report from an older operation must never overwrite newer health
    // state (e.g. a stale success flipping auth_expired back to healthy).
    // Unversioned reports (no opToken) keep their previous behavior.
    if (opToken !== undefined) {
      const lastReported = this.#reportedOpByAccount.get(accountId) ?? 0;
      if (opToken <= lastReported) return accountSummary(account);
      this.#reportedOpByAccount.set(accountId, opToken);
    }

    const now = this.clock().toISOString();
    const patch = { updatedAt: now, health: { ...account.health, lastCheckedAt: now } };
    if (result.quota) patch.quota = createQuotaSnapshot({ ...account.quota, ...result.quota }, this.clock());
    if (result.balance) patch.balance = createBalanceSnapshot({ ...account.balance, ...result.balance }, this.clock());
    if (result.refresh) patch.refresh = createRefreshState({ ...account.refresh, ...result.refresh });

    switch (result.status) {
      case "success":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.HEALTHY, cooldownUntil: null, lastError: null };
        break;
      case "rate_limited":
        patch.health = {
          ...patch.health,
          status: result.cooldownUntil ? ACCOUNT_HEALTH.COOLDOWN : ACCOUNT_HEALTH.DEGRADED,
          cooldownUntil: result.cooldownUntil ?? null,
          lastError: result.message ?? null,
        };
        break;
      case "quota_exhausted":
        patch.health = {
          ...patch.health,
          status: ACCOUNT_HEALTH.EXHAUSTED,
          cooldownUntil: result.cooldownUntil ?? null,
          lastError: result.message ?? null,
        };
        break;
      case "auth_expired":
        // Parked, not discarded: the account is retried once the cooldown
        // passes, because an expired token is usually a refresh away from
        // working again (the official CLI may have rotated it, for instance).
        patch.health = {
          ...patch.health,
          status: ACCOUNT_HEALTH.EXPIRED,
          lastError: result.message ?? null,
          cooldownUntil: result.cooldownUntil ?? new Date(
            this.clock().getTime() + RELIST_COOLDOWN_MS,
          ).toISOString(),
        };
        break;
      case "error":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.DEGRADED, lastError: result.message ?? null };
        break;
      default:
        break;
    }
    return this.#patch(accountId, patch);
  }

  #patch(accountId, patch) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    const next = {
      ...current,
      ...patch,
      quota: patch.quota ? { ...current.quota, ...patch.quota } : current.quota,
      balance: patch.balance ? { ...current.balance, ...patch.balance } : current.balance,
      refresh: patch.refresh ? { ...current.refresh, ...patch.refresh } : current.refresh,
      resources: patch.resources ? { ...current.resources, ...patch.resources } : current.resources,
      health: patch.health ? { ...current.health, ...patch.health } : current.health,
    };
    this.#accounts.set(accountId, next);
    return accountSummary(next);
  }

  /**
   * Accounts parked by an expired authorization whose cooldown has passed.
   * The runtime retries exactly these, so a token that was rotated elsewhere is
   * picked back up without the account staying dead forever.
   */
  relistable(now = this.clock()) {
    return [...this.#accounts.values()]
      .filter((account) => account.health?.status === ACCOUNT_HEALTH.EXPIRED)
      .filter((account) => {
        const until = account.health?.cooldownUntil;
        return !until || new Date(until).getTime() <= now.getTime();
      })
      .map(accountSummary);
  }

  #eligibleAccounts(now = this.clock(), { allowExhausted = false } = {}) {
    return [...this.#accounts.values()].filter((account) => {
      if (account.health.status === ACCOUNT_HEALTH.EXPIRED) return false;
      if (!account.health.cooldownUntil) {
        if (account.health.status === ACCOUNT_HEALTH.EXHAUSTED) return allowExhausted;
        return true;
      }
      return new Date(account.health.cooldownUntil).getTime() <= now.getTime();
    });
  }

  #pruneSessionAssignments(nowMs) {
    for (const [key, assignment] of this.#sessionAssignments) {
      const lastUsedAt = typeof assignment === "object" ? assignment.lastUsedAt : nowMs;
      if (nowMs - Number(lastUsedAt) > STICKY_SESSION_TTL_MS) this.#sessionAssignments.delete(key);
    }
    while (this.#sessionAssignments.size > MAX_STICKY_ASSIGNMENTS) {
      const oldest = this.#sessionAssignments.keys().next().value;
      if (oldest === undefined) break;
      this.#sessionAssignments.delete(oldest);
    }
  }

  /**
   * The share of an account's tightest reported window that is still left.
   * The tightest window is the one that will stop the account first, so it is
   * the honest measure of headroom. Returns null when nothing is reported.
   */
  #remainingShare(account) {
    const windows = Array.isArray(account?.quota?.windows) ? account.quota.windows : [];
    let lowest = null;
    for (const window of windows) {
      const remaining = Number(window?.remaining);
      const limit = Number(window?.limit);
      if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) continue;
      const share = Math.max(0, Math.min(1, remaining / limit));
      if (lowest === null || share < lowest) lowest = share;
    }
    return lowest;
  }

  /** The selectable account with the most headroom, if any reports quota. */
  #fullest(selectable) {
    let best = null;
    let bestShare = -1;
    for (const candidate of selectable) {
      const share = this.#remainingShare(candidate);
      if (share === null) continue;
      if (share > bestShare) {
        best = candidate;
        bestShare = share;
      }
    }
    return best;
  }

  #next(accounts) {
    const account = accounts[this.#cursor % accounts.length];
    this.#cursor = (this.#cursor + 1) % accounts.length;
    return account;
  }

  #ensureSingleAccountDefault() {
    if (this.policy !== ACCOUNT_SELECTION_POLICY.MANUAL || this.#defaultAccountId || this.#accounts.size !== 1) return;
    this.#defaultAccountId = this.#accounts.keys().next().value ?? null;
  }
}
