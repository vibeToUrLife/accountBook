// Which months a recurring rule still owes, and when a month counts as recorded.
process.env.TZ = "Asia/Kuala_Lumpur";

import { test } from "node:test";
import assert from "node:assert/strict";
import { dueOccurrences, firstOpenMonth, alreadyRecorded, recurringTxId } from "../js/features/recurring.js";
import { computeUpcoming } from "../js/features/upcoming.js";

const rule = (fields) => ({ id: "r1", categoryId: "c1", amount: 1200, note: "rent", type: "expense", ...fields });

test("a day-31 rule is owed on the last day of a 30-day month", () => {
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 31, lastPostedMonth: "2026-08" }), "2026-09-30"),
    [{ monthKey: "2026-09", dateISO: "2026-09-30" }]);
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 30, lastPostedMonth: "2027-01" }), "2027-02-28"),
    [{ monthKey: "2027-02", dateISO: "2027-02-28" }]);
});

test("months missed while the app was closed are all owed, oldest first", () => {
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 15, lastPostedMonth: "2026-07" }), "2026-10-03"), [
    { monthKey: "2026-08", dateISO: "2026-08-15" },
    { monthKey: "2026-09", dateISO: "2026-09-15" },
  ]);
});

test("nothing is owed before the day arrives, or once the month is recorded", () => {
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 15, lastPostedMonth: "2026-09" }), "2026-10-14"), []);
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 15, lastPostedMonth: "2026-10" }), "2026-10-20"), []);
});

test("a new rule owes nothing from before it was added", () => {
  const r = rule({ dayOfMonth: 5, startISO: "2026-10-20" });
  assert.deepEqual(dueOccurrences(r, "2026-10-31"), []);
  assert.deepEqual(dueOccurrences(r, "2026-11-05"), [{ monthKey: "2026-11", dateISO: "2026-11-05" }]);
});

test("a rule added on its own day is owed that day", () => {
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 20, startISO: "2026-10-20" }), "2026-10-20"),
    [{ monthKey: "2026-10", dateISO: "2026-10-20" }]);
});

test("rules from before catch-up existed start in the current month", () => {
  assert.equal(firstOpenMonth(rule({ dayOfMonth: 5 }), "2026-10-20"), "2026-10");
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 5 }), "2026-10-20"), [{ monthKey: "2026-10", dateISO: "2026-10-05" }]);
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 5 }), "2026-10-03"), []);
});

test("the month after December is January", () => {
  assert.equal(firstOpenMonth(rule({ lastPostedMonth: "2026-12" }), "2027-01-10"), "2027-01");
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: 1, lastPostedMonth: "2026-11" }), "2027-01-10"), [
    { monthKey: "2026-12", dateISO: "2026-12-01" },
    { monthKey: "2027-01", dateISO: "2027-01-01" },
  ]);
});

test("dueOccurrences caps one run and sanitises the day", () => {
  assert.equal(dueOccurrences(rule({ dayOfMonth: 1, lastPostedMonth: "2020-01" }), "2026-10-10").length, 12);
  assert.equal(dueOccurrences(rule({ dayOfMonth: 1, lastPostedMonth: "2020-01" }), "2026-10-10", 3).length, 3);
  assert.deepEqual(dueOccurrences(rule({ dayOfMonth: "<b>", lastPostedMonth: "2026-09" }), "2026-10-10"),
    [{ monthKey: "2026-10", dateISO: "2026-10-01" }]);
});

test("alreadyRecorded: the month's fixed id, or an identical record on that date", () => {
  const r = rule({ dayOfMonth: 5 });
  const occ = { monthKey: "2026-10", dateISO: "2026-10-05" };
  assert.equal(recurringTxId("r1", "2026-10"), "rec_r1_2026-10");
  assert.equal(alreadyRecorded(r, occ, [{ id: "rec_r1_2026-10", dateISO: "2026-10-05", amount: 1250 }]), true,
    "an edited auto-added record still counts");
  assert.equal(alreadyRecorded(r, occ, [{ id: "x", dateISO: "2026-10-05", categoryId: "c1", amount: 1200.0000000001, note: "rent" }]), true);
  assert.equal(alreadyRecorded(r, occ, [{ id: "x", dateISO: "2026-10-06", categoryId: "c1", amount: 1200, note: "rent" }]), false);
  assert.equal(alreadyRecorded(r, occ, [{ id: "x", dateISO: "2026-10-05", categoryId: "c1", amount: 1200, note: "other" }]), false);
});

test("upcoming skips this month's occurrence once the rule recorded it", () => {
  const { items } = computeUpcoming({
    recurringRules: [rule({ dayOfMonth: 5, lastPostedMonth: "2026-10" })],
    today: "2026-10-05",
    horizonDays: 40,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].dateISO, "2026-11-05");
});
