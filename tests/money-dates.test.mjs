// Money rounding, per-month budgets, subscription renewals and savings-goal
// months. Run in UTC+8 (the app's users) so local-vs-UTC date slips show up.
process.env.TZ = "Asia/Kuala_Lumpur";

import { test } from "node:test";
import assert from "node:assert/strict";
import { roundMoney, monthlyBudgetFor } from "../utils.js";
import { nextRenewalDate, subscriptionPaymentId } from "../js/features/subscriptions.js";
import { goalSaved, goalProgress, monthlyNeeded, validateContribution } from "../js/features/goals.js";

test("roundMoney removes floating-point drift from sums", () => {
  assert.equal(roundMoney(1.01 + 7.19 + 1.8), 10);
  assert.equal(roundMoney(10.1 + 10.2 + 9.7), 30);
  assert.equal(roundMoney("12.345"), 12.35);
  assert.equal(roundMoney(undefined), 0);
});

test("roundMoney never returns -0 (no \"-0.00\" on screen)", () => {
  assert.ok(Object.is(roundMoney(-0.001), 0));
  assert.ok(Object.is(roundMoney(0.1 + 0.2 - 0.3), 0));
  assert.equal(roundMoney(-0.001).toFixed(2), "0.00");
});

test("monthlyBudgetFor: a month without its own amount uses the latest earlier month", () => {
  const months = { "2026-08": 500, "2026-10": 600 };
  assert.equal(monthlyBudgetFor(months, "2026-08"), 500);
  assert.equal(monthlyBudgetFor(months, "2026-09"), 500, "September is not changed by editing October");
  assert.equal(monthlyBudgetFor(months, "2026-10"), 600);
  assert.equal(monthlyBudgetFor(months, "2026-11"), 600, "October's change carries forward");
  assert.equal(monthlyBudgetFor(months, "2026-07"), null, "nothing before the first month");
});

test("monthlyBudgetFor: editing an earlier month leaves later months alone", () => {
  const months = { "2026-08": 500, "2026-09": 400, "2026-10": 600 };
  assert.equal(monthlyBudgetFor(months, "2026-09"), 400);
  assert.equal(monthlyBudgetFor(months, "2026-10"), 600);
  assert.equal(monthlyBudgetFor(months, "2026-11"), 600);
});

test("monthlyBudgetFor ignores junk keys and values", () => {
  assert.equal(monthlyBudgetFor({ "2026-8": 1, foo: 2, "2026-07": "x", "2026-06": 300 }, "2026-09"), 300);
  assert.equal(monthlyBudgetFor(null, "2026-09"), null);
  assert.equal(monthlyBudgetFor({ "2026-08": 0 }, "2026-09"), 0, "a budget set to 0 is still a budget");
});

test("nextRenewalDate keeps the same day each month in UTC+8 (no day lost per payment)", () => {
  assert.equal(nextRenewalDate("2026-11-15", "month", 15), "2026-12-15");
  assert.equal(nextRenewalDate("2026-12-01", "month", 1), "2027-01-01", "December isn't charged twice");
  let d = "2026-01-15";
  for (let i = 0; i < 12; i++) d = nextRenewalDate(d, "month", 15);
  assert.equal(d, "2027-01-15", "twelve payments land on the same day a year later");
});

test("nextRenewalDate uses the month's last day when it is shorter, then returns to the anchor day", () => {
  assert.equal(nextRenewalDate("2026-01-31", "month", 31), "2026-02-28");
  assert.equal(nextRenewalDate("2026-02-28", "month", 31), "2026-03-31");
  assert.equal(nextRenewalDate("2026-03-31", "month", 31), "2026-04-30");
  assert.equal(nextRenewalDate("2028-01-30", "month", 30), "2028-02-29", "leap year");
});

test("nextRenewalDate: yearly renewals", () => {
  assert.equal(nextRenewalDate("2026-11-01", "year", 1), "2027-11-01");
  assert.equal(nextRenewalDate("2028-02-29", "year", 29), "2029-02-28");
  assert.equal(nextRenewalDate("2031-02-28", "year", 29), "2032-02-29");
});

test("nextRenewalDate falls back to the date's own day without an anchor", () => {
  assert.equal(nextRenewalDate("2026-05-20", "month"), "2026-06-20");
});

test("subscriptionPaymentId is the same for the same renewal", () => {
  assert.equal(subscriptionPaymentId("abc", "2026-11-15"), "sub_abc_2026-11-15");
  assert.equal(subscriptionPaymentId("abc", "2026-11-15"), subscriptionPaymentId("abc", "2026-11-15"));
});

test("goalSaved rounds to cents, so a goal filled with decimals counts as reached", () => {
  const goal = { target: 30, contributions: [
    { id: "a", amount: 10.1, kind: "deposit" },
    { id: "b", amount: 10.2, kind: "deposit" },
    { id: "c", amount: 9.7, kind: "deposit" },
  ] };
  assert.equal(goalSaved(goal), 30);
  assert.equal(goalProgress(goal).isDone, true);
  assert.equal(validateContribution(goal, { amount: 30, kind: "withdraw" }), null, "the whole amount can be withdrawn");
});

test("monthlyNeeded: Oct 31 → Dec 1 is two months (month-end doesn't roll over)", () => {
  const goal = { target: 1000, deadline: "2026-12-01", contributions: [] };
  assert.equal(monthlyNeeded(goal, "2026-10-31"), 500);
});

test("monthlyNeeded: same day next month is one month", () => {
  const goal = { target: 600, deadline: "2026-11-30", contributions: [] };
  assert.equal(monthlyNeeded(goal, "2026-10-31"), 600);
});
