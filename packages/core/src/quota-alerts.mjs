// Quota and balance warnings, evaluated locally from what a provider already
// reported. They are advisory: nothing here changes routing or health.

/** A window is "low" once this share of it is gone. */
export const DEFAULT_LOW_SHARE = 0.15;
/** A window is "about to reset and mostly unused" inside this horizon. */
export const DEFAULT_RESET_HORIZON_MS = 6 * 60 * 60 * 1000;
/** A window still counts as unused while this share of it remains. */
export const DEFAULT_WASTE_SHARE = 0.5;

function ratio(remaining, limit) {
  const left = Number(remaining);
  const total = Number(limit);
  if (!Number.isFinite(left) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(1, left / total));
}

function windowLabel(window, index) {
  return window?.name ?? window?.id ?? `窗口 ${index + 1}`;
}

/**
 * Warnings worth showing for one account.
 *
 * Two rules, both taken from what a subscription's own window means:
 *  - `low`: a window is nearly spent, so the account will stop serving soon.
 *  - `reset_waste`: a window resets soon while most of it is unused, which is
 *    allowance that is about to be thrown away. This one is easy to miss and
 *    the easiest to act on.
 *
 * @returns {Array<{kind: string, severity: string, windowId: string|null, message: string, data: object}>}
 */
export function evaluateQuotaAlerts(account, {
  now = new Date(),
  lowShare = DEFAULT_LOW_SHARE,
  resetHorizonMs = DEFAULT_RESET_HORIZON_MS,
  wasteShare = DEFAULT_WASTE_SHARE,
  balanceLow = null,
} = {}) {
  const alerts = [];
  const windows = Array.isArray(account?.quota?.windows) ? account.quota.windows : [];
  const nowMs = now.getTime();

  windows.forEach((window, index) => {
    const share = ratio(window?.remaining, window?.limit);
    if (share === null) return;
    const label = windowLabel(window, index);
    if (share <= lowShare) {
      alerts.push({
        kind: "low",
        severity: "warning",
        windowId: window?.id ?? null,
        message: `${label} 仅剩 ${Math.round(share * 100)}%`,
        data: { remaining: window.remaining, limit: window.limit, share },
      });
    }
    const resetAt = window?.resetAt ? new Date(window.resetAt) : null;
    if (resetAt && Number.isFinite(resetAt.getTime())) {
      const untilReset = resetAt.getTime() - nowMs;
      if (untilReset > 0 && untilReset <= resetHorizonMs && share >= wasteShare) {
        alerts.push({
          kind: "reset_waste",
          severity: "info",
          windowId: window?.id ?? null,
          message: `${label} 将在 ${Math.max(1, Math.round(untilReset / 3_600_000))} 小时内重置，但仍剩 ${Math.round(share * 100)}%`,
          data: { remaining: window.remaining, limit: window.limit, share, resetAt: window.resetAt },
        });
      }
    }
  });

  const balance = Number(account?.balance?.amount);
  if (Number.isFinite(balance) && Number.isFinite(Number(balanceLow)) && balance <= Number(balanceLow)) {
    alerts.push({
      kind: "balance_low",
      severity: "warning",
      windowId: null,
      message: `余额仅剩 ${balance} ${account?.balance?.unit ?? ""}`.trim(),
      data: { amount: balance, unit: account?.balance?.unit ?? null },
    });
  }

  return alerts;
}

/** Whether any alert in the list should be surfaced on demand. */
export function hasBlockingAlert(alerts) {
  return Array.isArray(alerts) && alerts.some((alert) => alert?.severity === "warning");
}
