// Restoring from a backup file: links survive, junk is dropped, nothing runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBackup, cleanCurrencySymbol, exportRecord } from "../js/backup.js";

let counter = 0;
const opts = { today: "2026-10-31", newId: () => `new${++counter}` };

test("returns null for files that aren't backups", () => {
  assert.equal(parseBackup(null, opts), null);
  assert.equal(parseBackup({ categories: [] }, opts), null);
  assert.equal(parseBackup({ categories: {}, transactions: [] }, opts), null);
});

test("records keep their ids, so transactions stay linked to their category", () => {
  const out = parseBackup({
    categories: [{ id: "catFood1", name: "Food", budget: 500, monthlyBudgets: { "2026-10": 500 } }],
    transactions: [{ id: "tx1", categoryId: "catFood1", amount: 12.5, type: "expense", dateISO: "2026-10-01", note: "Lunch", tags: ["Work", "work"] }],
  }, opts);
  assert.equal(out.categories[0].id, "catFood1");
  assert.equal(out.transactions[0].id, "tx1");
  assert.equal(out.transactions[0].data.categoryId, "catFood1");
  assert.equal(out.transactions[0].data.noteLower, "lunch");
  assert.deepEqual(out.transactions[0].data.tags, ["work"]);
  assert.deepEqual(out.categories[0].data.monthlyBudgets, { "2026-10": 500 });
});

test("an unusable category id gets a new id and its records follow it", () => {
  const out = parseBackup({
    categories: [{ id: "bad id/<x>", name: "Food" }],
    transactions: [{ id: "tx1", categoryId: "bad id/<x>", amount: 5 }],
    subscriptions: [{ id: "s1", name: "Netflix", amount: 50, categoryId: "bad id/<x>" }],
  }, opts);
  const newId = out.categories[0].id;
  assert.match(newId, /^new\d+$/);
  assert.equal(out.transactions[0].data.categoryId, newId);
  assert.equal(out.subscriptions[0].data.categoryId, newId);
});

test("amounts are validated: text numbers are converted, junk is skipped", () => {
  const out = parseBackup({
    categories: [{ id: "c1", name: "Food" }],
    transactions: [
      { id: "a", categoryId: "c1", amount: "50" },
      { id: "b", categoryId: "c1", amount: "1,200" },
      { id: "c", categoryId: "c1", amount: "abc" },
      { id: "d", categoryId: "c1", amount: -5 },
      { id: "e", categoryId: "", amount: 5 },
    ],
  }, opts);
  assert.deepEqual(out.transactions.map((t) => t.data.amount), [50, 1200]);
  assert.equal(out.skipped, 3);
});

test("values the app puts into HTML can't carry markup", () => {
  const out = parseBackup({
    categories: [], transactions: [],
    settings: { currencySymbol: "<img src=x onerror=alert(1)>" },
    targets: [{ id: "t1", text: "Retire", age: "<img src=x onerror=alert(1)>" }],
    recurringRules: [{ id: "r1", categoryId: "c1", amount: 10, dayOfMonth: "<b>1</b>" }],
  }, opts);
  assert.ok(!/[<>"'&]/.test(out.currencySymbol));
  assert.ok(out.currencySymbol.length <= 5);
  assert.equal(out.targets[0].data.age, 0);
  assert.equal(out.recurringRules[0].data.dayOfMonth, 1);
  assert.equal(cleanCurrencySymbol(" RM "), "RM");
  assert.equal(cleanCurrencySymbol("$"), "$");
});

test("dates must be real YYYY-MM-DD dates; a missing record date becomes today", () => {
  const out = parseBackup({
    categories: [{ id: "c1", name: "Food" }],
    transactions: [{ id: "a", categoryId: "c1", amount: 1, dateISO: 20261001 }, { id: "b", categoryId: "c1", amount: 1, dateISO: "2026-13-45" }],
    debts: [{ id: "d1", person: "Ali", amount: 20, dueDate: "soon" }],
  }, opts);
  assert.deepEqual(out.transactions.map((t) => t.data.dateISO), ["2026-10-31", "2026-10-31"]);
  assert.equal(out.debts[0].data.dueDate, "");
});

test("goal deposits, templates and recurring progress are restored", () => {
  const out = parseBackup({
    categories: [{ id: "c1", name: "Food" }],
    transactions: [],
    savingsGoals: [{ id: "g1", name: "Trip", target: 3000, contributions: [
      { id: "k1", amount: 500, kind: "deposit", dateISO: "2026-09-01" },
      { id: "k2", amount: "x", kind: "deposit", dateISO: "2026-09-02" },
    ] }],
    templates: [{ id: "tp1", label: "Car", categoryId: "c1", amount: 50, type: "expense" }],
    recurringRules: [{ id: "r1", categoryId: "c1", amount: 1200, dayOfMonth: 31, startISO: "2026-08-15", lastPostedMonth: "2026-10" }],
  }, opts);
  assert.equal(out.savingsGoals[0].data.contributions.length, 1);
  assert.equal(out.savingsGoals[0].data.contributions[0].amount, 500);
  assert.equal(out.templates[0].data.label, "Car");
  assert.equal(out.recurringRules[0].data.lastPostedMonth, "2026-10");
  assert.equal(out.recurringRules[0].data.startISO, "2026-08-15");
});

test("createdAt is read back from ISO strings and from Firestore's {seconds, nanoseconds}", () => {
  const out = parseBackup({
    categories: [{ id: "c1", name: "A", createdAt: "2026-10-01T02:03:04.000Z" }, { id: "c2", name: "B", createdAt: { seconds: 1790000000, nanoseconds: 5000000 } }, { id: "c3", name: "C" }],
    transactions: [],
  }, opts);
  assert.equal(out.categories[0].createdAt.toISOString(), "2026-10-01T02:03:04.000Z");
  assert.equal(out.categories[1].createdAt.getTime(), 1790000000005);
  assert.equal(out.categories[2].createdAt, null);
});

test("exportRecord turns Firestore timestamps into ISO strings", () => {
  const fakeTimestamp = { toDate: () => new Date("2026-10-31T10:00:00.000Z") };
  assert.deepEqual(exportRecord({ id: "x", amount: 5, createdAt: fakeTimestamp }), { id: "x", amount: 5, createdAt: "2026-10-31T10:00:00.000Z" });
});
