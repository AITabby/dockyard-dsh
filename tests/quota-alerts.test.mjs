import assert from "node:assert/strict";
import test from "node:test";

import { evaluateQuotaAlerts, DEFAULT_LOW_SHARE } from "../packages/core/src/index.mjs";

// What a subscription's own windows imply, stated as advice the panel can show:
// a window nearly spent, and one that resets soon while most of it is unused.
// The second is the one people miss — allowance about to be thrown away.

test("a nearly spent window raises a low warning", () => {
  const alerts = evaluateQuotaAlerts({
    quota: { windows: [{ id: "5h", name: "5 小时窗口", remaining: 1, limit: 10 }] },
  });
  const low = alerts.find((alert) => alert.kind === "low");
  assert.ok(low, "expected a low alert");
  assert.equal(low.severity, "warning");
  assert.match(low.message, /5 小时窗口/);
});

test("a window above the threshold raises nothing", () => {
  const alerts = evaluateQuotaAlerts({
    quota: { windows: [{ id: "week", name: "周度额度", remaining: 9, limit: 10 }] },
  });
  assert.deepEqual(alerts, []);
});

test("a window that resets soon while mostly unused raises reset_waste", () => {
  const now = new Date("2026-11-05T00:00:00.000Z");
  const alerts = evaluateQuotaAlerts({
    quota: {
      windows: [{
        id: "month",
        name: "月度额度",
        remaining: 80,
        limit: 100,
        resetAt: "2026-11-05T03:00:00.000Z",
      }],
    },
  }, { now });
  const waste = alerts.find((alert) => alert.kind === "reset_waste");
  assert.ok(waste, "expected a reset_waste alert");
  assert.equal(waste.severity, "info");
  assert.match(waste.message, /3 小时内重置/);
});

test("a window far from its reset says nothing about waste", () => {
  const now = new Date("2026-11-05T00:00:00.000Z");
  const alerts = evaluateQuotaAlerts({
    quota: {
      windows: [{ id: "month", remaining: 80, limit: 100, resetAt: "2026-11-20T00:00:00.000Z" }],
    },
  }, { now });
  assert.equal(alerts.some((alert) => alert.kind === "reset_waste"), false);
});

test("windows without usable numbers are ignored", () => {
  const alerts = evaluateQuotaAlerts({
    quota: { windows: [{ id: "x", remaining: null, limit: null }, { id: "y", remaining: 5, limit: 0 }] },
  });
  assert.deepEqual(alerts, []);
});

test("an empty account has nothing to warn about", () => {
  assert.deepEqual(evaluateQuotaAlerts(null), []);
  assert.deepEqual(evaluateQuotaAlerts({}), []);
});

test("the low threshold is the documented default", () => {
  assert.equal(DEFAULT_LOW_SHARE, 0.15);
  const atThreshold = evaluateQuotaAlerts({
    quota: { windows: [{ id: "w", remaining: 15, limit: 100 }] },
  });
  assert.equal(atThreshold.some((alert) => alert.kind === "low"), true);
});

test("a low balance is reported when a threshold is configured", () => {
  const alerts = evaluateQuotaAlerts({ balance: { amount: 1.5, unit: "CNY" } }, { balanceLow: 5 });
  const low = alerts.find((alert) => alert.kind === "balance_low");
  assert.ok(low);
  assert.match(low.message, /余额仅剩 1\.5 CNY/);

  assert.deepEqual(evaluateQuotaAlerts({ balance: { amount: 50, unit: "CNY" } }, { balanceLow: 5 }), []);
});

// Antigravity serves a different model list per account, so discovery asks the
// account itself (v1internal:fetchAvailableModels) instead of the local CLI.
import { modelsFromFetchAvailableModels } from "../modules/provider-antigravity/src/native-transport.mjs";

test("fetchAvailableModels replies are read as one row per enabled model", () => {
  const models = modelsFromFetchAvailableModels({
    models: {
      "gemini-4-pro": { displayName: "Gemini 4 Pro", maxTokens: 1_048_576, maxOutputTokens: 65_536, supportsImages: true },
      "gemini-3.8-flash": { displayName: "Gemini 3.8 Flash" },
      retired: { displayName: "Retired", disabled: true },
    },
    agentModelSorts: [{ groups: [{ modelIds: ["gemini-3.8-flash", "gemini-4-pro"] }] }],
  });
  assert.deepEqual(models.map((model) => model.id), ["gemini-3.8-flash", "gemini-4-pro"]);
  const pro = models.find((model) => model.id === "gemini-4-pro");
  assert.equal(pro.name, "Gemini 4 Pro");
  assert.equal(pro.contextWindow, 1_048_576);
  assert.equal(pro.maxTokens, 65_536);
  assert.deepEqual(pro.inputModalities, ["text", "image"]);
  assert.equal(models.some((model) => model.id === "retired"), false, "disabled rows are left out");
});

test("an empty or missing model table yields no list", () => {
  assert.equal(modelsFromFetchAvailableModels({}), null);
  assert.equal(modelsFromFetchAvailableModels({ models: {} }), null);
  assert.equal(modelsFromFetchAvailableModels(null), null);
});
