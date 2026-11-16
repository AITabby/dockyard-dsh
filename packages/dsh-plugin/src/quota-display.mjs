const PERIOD_HINTS = [
  [/five[\s-]*hour|5[\s-]*hour|\b5h\b/i, 5 * 60 * 60 * 1000],
  [/one[\s-]*hour|hourly|\b1h\b|\bhour\b/i, 60 * 60 * 1000],
  [/one[\s-]*day|daily|\b24h\b|\b1d\b|\bday\b/i, 24 * 60 * 60 * 1000],
  [/one[\s-]*week|weekly|\b7d\b|\bweek\b/i, 7 * 24 * 60 * 60 * 1000],
  [/one[\s-]*month|monthly|\b30d\b|\bmonth\b/i, 30 * 24 * 60 * 60 * 1000],
  [/yearly|annual|\b365d\b|\byear\b/i, 365 * 24 * 60 * 60 * 1000],
];

function numericTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (value instanceof Date) return value.getTime();
  if (value === null || value === undefined || value === "") return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function periodHint(window) {
  const label = `${window?.id ?? ""} ${window?.name ?? ""}`;
  return PERIOD_HINTS.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}

function resetRemaining(window, now) {
  const timestamp = numericTimestamp(window?.resetAt);
  if (timestamp === null || timestamp <= now) return null;
  return timestamp - now;
}

function remainingFraction(window) {
  const remaining = Number(window?.remaining);
  const limit = Number(window?.limit);
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return null;
  return Math.max(0, Math.min(1, remaining / limit));
}

function numericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function comparisonValue(window, now) {
  return periodHint(window) ?? resetRemaining(window, now) ?? Number.POSITIVE_INFINITY;
}

/**
 * Pick the most immediate quota window for compact UI summaries.
 * Explicit period names win over provider array order; resetAt is the
 * fallback for providers that return generic window names.
 */
export function selectPrimaryQuotaWindow(windows, now = Date.now()) {
  if (!Array.isArray(windows) || windows.length === 0) return null;
  // A provider can name the window that actually gates usage — Command Code's
  // monthly credit grant, for instance — which must win over reset ordering.
  const declared = windows.filter((window) => window?.primary === true);
  if (declared.length === 1) return declared[0];
  return windows.reduce((selected, candidate) => {
    if (!selected) return candidate;
    const selectedValue = comparisonValue(selected, now);
    const candidateValue = comparisonValue(candidate, now);
    if (candidateValue < selectedValue) return candidate;
    if (candidateValue > selectedValue) return selected;
    const selectedFraction = remainingFraction(selected);
    const candidateFraction = remainingFraction(candidate);
    if (candidateFraction !== null && (selectedFraction === null || candidateFraction < selectedFraction)) return candidate;
    return selected;
  }, null);
}

/**
 * Return only data that is safe to show in the compact chat control.
 * Balance windows are intentionally kept as money even when a provider also
 * returns a total, because pay-as-you-go credit is not a subscription quota.
 */
export function selectQuotaIndicator(windows, now = Date.now()) {
  const window = selectPrimaryQuotaWindow(windows, now);
  if (!window) return null;
  const remaining = numericValue(window.remaining);
  if (remaining === null) return null;

  if (window.kind === "balance") {
    return { type: "balance", window, remaining };
  }

  const limit = numericValue(window.limit);
  if (limit === null || limit <= 0) return null;
  return {
    type: "quota",
    window,
    remaining,
    percent: Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))),
  };
}
