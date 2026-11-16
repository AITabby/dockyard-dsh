import test from "node:test";
import assert from "node:assert/strict";

import { selectPrimaryQuotaWindow, selectQuotaIndicator } from "../packages/dsh-plugin/src/quota-display.mjs";

const now = Date.parse("2026-08-26T13:50:00.000Z");

test("compact quota summary prefers the five-hour window over weekly windows", () => {
  const fiveHour = {
    id: "group:window fraction",
    name: "group:window fraction",
    remaining: 0.99,
    limit: 1,
    resetAt: "2026-08-26T18:43:04.000Z",
  };
  const weekly = {
    id: "group:window fraction",
    name: "group:window fraction",
    remaining: 1,
    limit: 1,
    resetAt: "2026-09-02T13:48:52.000Z",
  };
  assert.equal(selectPrimaryQuotaWindow([weekly, fiveHour], now), fiveHour);
});

test("compact quota summary uses the only available weekly window", () => {
  const weekly = {
    id: "weekly",
    name: "Weekly",
    remaining: 0.72,
    limit: 1,
    resetAt: "2026-09-02T13:48:52.000Z",
  };
  assert.equal(selectPrimaryQuotaWindow([weekly], now), weekly);
});

test("explicit five-hour period wins even when its reset is later", () => {
  const fiveHour = {
    id: "primary",
    name: "5 hour window",
    remaining: 0.8,
    limit: 1,
    resetAt: "2026-08-27T13:50:00.000Z",
  };
  const weekly = {
    id: "secondary",
    name: "Weekly window",
    remaining: 0.2,
    limit: 1,
    resetAt: "2026-08-26T14:00:00.000Z",
  };
  assert.equal(selectPrimaryQuotaWindow([weekly, fiveHour], now), fiveHour);
});

test("compact quota indicator keeps a pay-as-you-go balance as money", () => {
  const balance = {
    id: "credits",
    name: "Remaining credits",
    kind: "balance",
    remaining: 12.8,
    limit: 50,
    unit: "USD",
  };
  assert.deepEqual(selectQuotaIndicator([balance]), {
    type: "balance",
    window: balance,
    remaining: 12.8,
  });
});

test("compact quota indicator hides a window without a readable amount", () => {
  assert.equal(selectQuotaIndicator([{
    id: "weekly",
    remaining: null,
    limit: 100,
  }]), null);
});

test("a window a provider declares primary wins over reset ordering", () => {
  const now = Date.parse("2026-11-17T00:00:00.000Z");
  const fiveHour = { id: "commandcode:5h", name: "5 小时窗口额度", remaining: 2.2, limit: 3, resetAt: "2026-11-17T02:00:00.000Z" };
  const monthly = { id: "commandcode:monthly", name: "月度额度", primary: true, remaining: 0.05, limit: 10, resetAt: "2026-12-01T13:29:27.000Z" };
  // The monthly credit grant is what runs out, so the compact indicator must
  // show it instead of the comfortable 5-hour window.
  assert.equal(selectPrimaryQuotaWindow([fiveHour, monthly], now), monthly);
  const indicator = selectQuotaIndicator([fiveHour, monthly], now);
  assert.equal(indicator.type, "quota");
  assert.equal(indicator.remaining, 0.05);
  // The plan grant gives it a denominator, so both the panel and the compact
  // indicator draw a percentage bar.
  assert.equal(indicator.percent, 1);
});

test("a monthly credit grant draws a percentage bar like the rolling windows", () => {
  const now = Date.parse("2026-11-17T00:00:00.000Z");
  const monthly = { id: "commandcode:monthly", name: "月度额度", primary: true, remaining: 0.056, limit: 10, unit: "credits" };
  const indicator = selectQuotaIndicator([monthly], now);
  assert.equal(indicator.type, "quota");
  assert.equal(indicator.percent, 1);
});

test("an exhausted monthly grant reports 0% so the bar renders empty", () => {
  const now = Date.parse("2026-11-17T00:00:00.000Z");
  const monthly = { id: "commandcode:monthly", name: "月度额度", primary: true, remaining: 0, limit: 10 };
  const indicator = selectQuotaIndicator([monthly], now);
  assert.equal(indicator.type, "quota");
  assert.equal(indicator.percent, 0);
});
