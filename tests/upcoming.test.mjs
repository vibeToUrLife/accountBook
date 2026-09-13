import { test } from "node:test";
import assert from "node:assert/strict";
import { computeUpcoming } from "../js/features/upcoming.js";

const TODAY = "2026-09-12";

test("subscription renewing inside the window is listed as money to pay", () => {
  const result = computeUpcoming({
    subscriptions: [{ id: "s1", name: "Netflix", amount: 55, cycle: "month", nextRenewal: "2026-09-20", status: "active" }],
    today: TODAY,
  });
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.equal(item.kind, "subscription");
  assert.equal(item.id, "s1");
  assert.equal(item.label, "Netflix");
  assert.equal(item.dateISO, "2026-09-20");
  assert.equal(item.amount, 55);
  assert.equal(item.direction, "out");
  assert.equal(item.overdue, false);
  assert.equal(result.totalToPay, 55);
  assert.equal(result.totalToReceive, 0);
});

test("cancelled subscriptions are not listed", () => {
  const result = computeUpcoming({
    subscriptions: [{ id: "s1", name: "Old", amount: 10, nextRenewal: "2026-09-15", status: "cancelled" }],
    today: TODAY,
  });
  assert.equal(result.items.length, 0);
});

test("subscriptions renewing after the window are not listed, the last day is included", () => {
  const result = computeUpcoming({
    subscriptions: [
      { id: "edge", name: "Edge", amount: 10, nextRenewal: "2026-09-26", status: "active" },
      { id: "late", name: "Late", amount: 10, nextRenewal: "2026-09-27", status: "active" },
    ],
    today: TODAY,
    horizonDays: 14,
  });
  assert.deepEqual(result.items.map((i) => i.id), ["edge"]);
});

test("a subscription whose renewal date has passed is flagged overdue", () => {
  const result = computeUpcoming({
    subscriptions: [{ id: "s1", name: "Gym", amount: 80, nextRenewal: "2026-09-01", status: "active" }],
    today: TODAY,
  });
  assert.equal(result.items[0].overdue, true);
});

test("a subscription without a renewal date is skipped", () => {
  const result = computeUpcoming({
    subscriptions: [{ id: "s1", name: "Mystery", amount: 5, status: "active" }],
    today: TODAY,
  });
  assert.equal(result.items.length, 0);
});

test("a debt I owe with a due date inside the window is money to pay", () => {
  const result = computeUpcoming({
    debts: [{ id: "d1", person: "Ali", direction: "i_owe", amount: 200, dueDate: "2026-09-18", status: "open" }],
    today: TODAY,
  });
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.equal(item.kind, "debt");
  assert.equal(item.label, "Ali");
  assert.equal(item.dateISO, "2026-09-18");
  assert.equal(item.direction, "out");
  assert.equal(item.view, "debts");
  assert.equal(result.totalToPay, 200);
});

test("a debt owed to me is money to receive", () => {
  const result = computeUpcoming({
    debts: [{ id: "d1", person: "Mei", direction: "owed_to_me", amount: 120, dueDate: "2026-09-14", status: "open" }],
    today: TODAY,
  });
  assert.equal(result.items[0].direction, "in");
  assert.equal(result.totalToReceive, 120);
  assert.equal(result.totalToPay, 0);
});

test("settled debts and debts without a due date are not listed", () => {
  const result = computeUpcoming({
    debts: [
      { id: "settled", person: "A", direction: "i_owe", amount: 1, dueDate: "2026-09-13", status: "settled" },
      { id: "nodate", person: "B", direction: "i_owe", amount: 1, status: "open" },
    ],
    today: TODAY,
  });
  assert.equal(result.items.length, 0);
});

test("a debt past its due date is flagged overdue", () => {
  const result = computeUpcoming({
    debts: [{ id: "d1", person: "Ali", direction: "i_owe", amount: 50, dueDate: "2026-08-30", status: "open" }],
    today: TODAY,
  });
  assert.equal(result.items[0].overdue, true);
});

test("a recurring expense due later this month is listed on that day", () => {
  const result = computeUpcoming({
    recurringRules: [{ id: "r1", categoryId: "c1", categoryName: "Bills", type: "expense", amount: 300, note: "Rent", dayOfMonth: 25 }],
    today: TODAY,
  });
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.equal(item.kind, "recurring");
  assert.equal(item.label, "Rent");
  assert.equal(item.dateISO, "2026-09-25");
  assert.equal(item.direction, "out");
  assert.equal(item.overdue, false);
  assert.equal(item.view, "recurring");
});

test("a recurring rule whose day already passed this month rolls to next month", () => {
  const result = computeUpcoming({
    recurringRules: [{ id: "r1", categoryId: "c1", type: "expense", amount: 50, note: "Phone", dayOfMonth: 5 }],
    today: "2026-09-25",
  });
  assert.equal(result.items[0].dateISO, "2026-10-05");
});

test("a recurring day beyond the month length is clamped to the last day", () => {
  const result = computeUpcoming({
    recurringRules: [{ id: "r1", categoryId: "c1", type: "expense", amount: 50, note: "Loan", dayOfMonth: 31 }],
    today: "2026-09-20",
  });
  assert.equal(result.items[0].dateISO, "2026-09-30");
});

test("a recurring revenue rule is money to receive and falls back to the category name", () => {
  const result = computeUpcoming({
    recurringRules: [{ id: "r1", categoryId: "c1", categoryName: "Salary", type: "revenue", amount: 4000, note: "", dayOfMonth: 15 }],
    today: TODAY,
  });
  assert.equal(result.items[0].direction, "in");
  assert.equal(result.items[0].label, "Salary");
  assert.equal(result.totalToReceive, 4000);
});

test("a recurring rule due today is listed today when not yet recorded", () => {
  const result = computeUpcoming({
    recurringRules: [{ id: "r1", categoryId: "c1", type: "expense", amount: 50, note: "Water", dayOfMonth: 12 }],
    today: TODAY,
  });
  assert.equal(result.items[0].dateISO, TODAY);
});

test("a recurring rule already recorded today rolls to next month", () => {
  const result = computeUpcoming({
    recurringRules: [{ id: "r1", categoryId: "c1", type: "expense", amount: 50, note: "Water", dayOfMonth: 12 }],
    transactions: [{ dateISO: TODAY, categoryId: "c1", amount: 50, note: "Water" }],
    today: TODAY,
  });
  assert.equal(result.items.length, 0);
});

test("items from all sources are ordered by date with overdue first", () => {
  const result = computeUpcoming({
    subscriptions: [{ id: "s1", name: "Spotify", amount: 20, nextRenewal: "2026-09-13", status: "active" }],
    debts: [{ id: "d1", person: "Ali", direction: "i_owe", amount: 50, dueDate: "2026-09-01", status: "open" }],
    recurringRules: [{ id: "r1", categoryId: "c1", type: "expense", amount: 300, note: "Rent", dayOfMonth: 13 }],
    today: TODAY,
  });
  assert.deepEqual(result.items.map((i) => i.id), ["d1", "r1", "s1"]);
});

test("each item carries the number of days from today, negative when overdue", () => {
  const result = computeUpcoming({
    subscriptions: [{ id: "s1", name: "A", amount: 1, nextRenewal: "2026-09-15", status: "active" }],
    debts: [{ id: "d1", person: "B", direction: "i_owe", amount: 1, dueDate: "2026-09-10", status: "open" }],
    today: TODAY,
  });
  const byId = Object.fromEntries(result.items.map((i) => [i.id, i.daysFromToday]));
  assert.equal(byId.s1, 3);
  assert.equal(byId.d1, -2);
});

import { upcomingHtml } from "../js/features/upcoming.js";

const helpers = {
  money: (n) => "RM" + Number(n).toFixed(2),
  escapeHtml: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  icon: () => "",
};

test("upcomingHtml shows an all-clear message when nothing is due", () => {
  const html = upcomingHtml({ items: [], totalToPay: 0, totalToReceive: 0 }, helpers);
  assert.match(html, /Nothing due in the next 14 days/);
});

test("upcomingHtml lists each item with its date, amount and a link to its view", () => {
  const html = upcomingHtml({
    items: [
      { kind: "debt", id: "d1", label: "Ali", dateISO: "2026-09-01", amount: 50, direction: "out", overdue: true, view: "debts", daysFromToday: -11 },
      { kind: "recurring", id: "r1", label: "Salary", dateISO: "2026-09-15", amount: 4000, direction: "in", overdue: false, view: "recurring", daysFromToday: 3 },
      { kind: "recurring", id: "r2", label: "Rent", dateISO: "2026-09-25", amount: 300, direction: "out", overdue: false, view: "recurring", daysFromToday: 13 },
    ],
    totalToPay: 350,
    totalToReceive: 4000,
  }, helpers);
  assert.match(html, /Ali/);
  assert.match(html, /2026-09-01/);
  assert.match(html, /RM50\.00/);
  assert.match(html, /Overdue/);
  assert.match(html, /data-view="debts"/);
  assert.match(html, /data-view="recurring"/);
  assert.match(html, /To pay[\s\S]*RM350\.00/);
  assert.match(html, /To receive[\s\S]*RM4000\.00/);
  assert.match(html, /11 days overdue/);
  assert.match(html, /in 3 days/);
  // Every row says which way the money moves and what kind of item it is.
  assert.match(html, /You pay/);
  assert.match(html, /You receive/);
  assert.match(html, /Recurring income/);
  assert.match(html, /Recurring bill/);
  assert.match(html, /Debt/);
});

test("upcomingHtml escapes item labels", () => {
  const html = upcomingHtml({
    items: [{ kind: "subscription", id: "s1", label: "<b>x</b>", dateISO: "2026-09-13", amount: 1, direction: "out", overdue: false, view: "subscriptions" }],
    totalToPay: 1,
    totalToReceive: 0,
  }, helpers);
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /Subscription renewal/);
});
