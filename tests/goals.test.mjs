import { test } from "node:test";
import assert from "node:assert/strict";
import {
  goalSaved,
  goalProgress,
  monthlyNeeded,
  withContribution,
  withoutContribution,
  sortedContributions,
  validateContribution,
  goalCardHtml,
} from "../js/features/goals.js";

const TODAY = "2026-09-12";

test("goalSaved sums deposits and subtracts withdrawals", () => {
  const goal = { contributions: [
    { id: "a", amount: 500, kind: "deposit" },
    { id: "b", amount: 200, kind: "deposit" },
    { id: "c", amount: 100, kind: "withdraw" },
  ] };
  assert.equal(goalSaved(goal), 600);
});

test("goalSaved is 0 for a goal without contributions and never negative", () => {
  assert.equal(goalSaved({}), 0);
  assert.equal(goalSaved({ contributions: [{ id: "a", amount: 50, kind: "withdraw" }] }), 0);
});

test("goalProgress reports saved, target, a capped percentage and completion", () => {
  const goal = { target: 1000, contributions: [{ id: "a", amount: 250, kind: "deposit" }] };
  assert.deepEqual(goalProgress(goal), { saved: 250, target: 1000, pct: 25, isDone: false });
  const done = { target: 100, contributions: [{ id: "a", amount: 150, kind: "deposit" }] };
  assert.deepEqual(goalProgress(done), { saved: 150, target: 100, pct: 100, isDone: true });
  assert.equal(goalProgress({ target: 0 }).pct, 0);
});

test("monthlyNeeded spreads the remaining amount over the months until the deadline", () => {
  const goal = { target: 1200, deadline: "2027-03-12", contributions: [{ id: "a", amount: 600, kind: "deposit" }] };
  assert.equal(monthlyNeeded(goal, TODAY), 100); // 600 left over 6 months
});

test("monthlyNeeded is null without a deadline, 0 when reached, and the full remainder when overdue", () => {
  assert.equal(monthlyNeeded({ target: 100 }, TODAY), null);
  assert.equal(monthlyNeeded({ target: 100, deadline: "2027-01-01", contributions: [{ id: "a", amount: 100, kind: "deposit" }] }, TODAY), 0);
  assert.equal(monthlyNeeded({ target: 100, deadline: "2026-01-01" }, TODAY), 100);
});

test("withContribution appends without mutating, withoutContribution removes by id", () => {
  const original = [{ id: "a", amount: 1, kind: "deposit" }];
  const added = withContribution(original, { id: "b", amount: 2, kind: "deposit" });
  assert.equal(original.length, 1);
  assert.deepEqual(added.map((c) => c.id), ["a", "b"]);
  assert.deepEqual(withoutContribution(added, "a").map((c) => c.id), ["b"]);
  assert.deepEqual(withContribution(undefined, { id: "x", amount: 1, kind: "deposit" }).length, 1);
});

test("sortedContributions lists newest date first, then newest entry first", () => {
  const list = [
    { id: "old", dateISO: "2026-01-01", createdAtISO: "2026-01-01T10:00:00Z" },
    { id: "new-early", dateISO: "2026-03-01", createdAtISO: "2026-03-01T08:00:00Z" },
    { id: "new-late", dateISO: "2026-03-01", createdAtISO: "2026-03-01T09:00:00Z" },
  ];
  assert.deepEqual(sortedContributions(list).map((c) => c.id), ["new-late", "new-early", "old"]);
  assert.equal(list[0].id, "old"); // input untouched
});

test("validateContribution rejects missing amounts and withdrawals larger than the balance", () => {
  const goal = { target: 500, contributions: [{ id: "a", amount: 100, kind: "deposit" }] };
  assert.equal(validateContribution(goal, { amount: null, kind: "deposit" }), "Enter an amount greater than 0.");
  assert.equal(validateContribution(goal, { amount: 150, kind: "withdraw" }), "You can only withdraw up to 100.");
  assert.equal(validateContribution(goal, { amount: 150, kind: "withdraw" }, (n) => "RM" + n.toFixed(2)), "You can only withdraw up to RM100.00.");
  assert.equal(validateContribution(goal, { amount: 100, kind: "withdraw" }), null);
  assert.equal(validateContribution(goal, { amount: 50, kind: "deposit" }), null);
});

const helpers = {
  money: (n) => "RM" + Number(n).toFixed(2),
  escapeHtml: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  icon: () => "",
};

test("goalCardHtml shows progress and an Add money button, with no form by default", () => {
  const goal = { id: "g1", name: "Trip <Japan>", target: 1000, contributions: [{ id: "c1", amount: 250, kind: "deposit", dateISO: "2026-09-01" }] };
  const html = goalCardHtml(goal, {}, helpers, TODAY);
  assert.match(html, /Trip &lt;Japan&gt;/);
  assert.match(html, /Saved RM250\.00 of RM1000\.00/);
  assert.match(html, /25\.0%/);
  assert.match(html, /data-action="open-contribute" data-id="g1"/);
  assert.match(html, /data-action="delete-goal" data-id="g1"/);
  assert.doesNotMatch(html, /goal-contrib-form/);
  assert.doesNotMatch(html, /per month/);
});

test("goalCardHtml shows the monthly amount needed and the open form with draft values and an error", () => {
  const goal = { id: "g1", name: "Fund", target: 1200, deadline: "2027-03-12", contributions: [{ id: "c1", amount: 600, kind: "deposit", dateISO: "2026-09-01" }] };
  const state = { formOpen: true, error: "Enter an amount greater than 0.", draft: { amount: "12.50", kind: "withdraw", dateISO: "2026-09-10", note: "test" } };
  const html = goalCardHtml(goal, state, helpers, TODAY);
  assert.match(html, /RM100\.00 per month/);
  assert.match(html, /6 months left/);
  assert.match(html, /<form class="goal-contrib-form" data-goal-id="g1"/);
  assert.match(html, /name="amount"[^>]*value="12\.50"/);
  assert.match(html, /name="dateISO"[^>]*value="2026-09-10"/);
  assert.match(html, /name="note"[^>]*value="test"/);
  assert.match(html, /<option value="withdraw" selected>/);
  assert.match(html, /Enter an amount greater than 0\./);
  assert.match(html, /data-action="cancel-contribute" data-id="g1"/);
  // Every field is labelled and the form explains what deposit and withdraw do.
  assert.match(html, /<span>Type<\/span>/);
  assert.match(html, /<span>Amount<\/span>/);
  assert.match(html, /<span>Date<\/span>/);
  assert.match(html, /<span>Note<\/span>/);
  assert.match(html, /Deposit adds money to this goal\. Withdraw takes money out\./);
  assert.match(html, /Save RM100\.00 per month/);
});

test("goalCardHtml form defaults the date to today when there is no draft", () => {
  const goal = { id: "g1", name: "Fund", target: 100 };
  const html = goalCardHtml(goal, { formOpen: true }, helpers, TODAY);
  assert.match(html, /name="dateISO"[^>]*value="2026-09-12"/);
  assert.match(html, /<option value="deposit" selected>/);
});

test("goalCardHtml lists history newest first with signed amounts and delete buttons", () => {
  const goal = { id: "g1", name: "Fund", target: 1000, contributions: [
    { id: "c1", amount: 300, kind: "deposit", dateISO: "2026-08-01", note: "bonus <x>" },
    { id: "c2", amount: 50, kind: "withdraw", dateISO: "2026-09-05", note: "" },
  ] };
  const html = goalCardHtml(goal, { historyOpen: true }, helpers, TODAY);
  assert.match(html, /History \(2\)/);
  const c2 = html.indexOf('data-id="c2"');
  const c1 = html.indexOf('data-id="c1"');
  assert.ok(c2 !== -1 && c1 !== -1 && c2 < c1, "withdrawal on 09-05 should be listed before the deposit on 08-01");
  assert.match(html, /-RM50\.00/);
  assert.match(html, /\+RM300\.00/);
  assert.match(html, /bonus &lt;x&gt;/);
  assert.match(html, /data-action="delete-contribution" data-goal-id="g1" data-id="c1"[^>]*>Remove</);
  assert.match(html, /Deposit history/);
});

test("goalCardHtml marks a reached goal as done", () => {
  const goal = { id: "g1", name: "Done", target: 100, contributions: [{ id: "c1", amount: 100, kind: "deposit", dateISO: "2026-09-01" }] };
  const html = goalCardHtml(goal, {}, helpers, TODAY);
  assert.match(html, /goal-progress-fill done/);
  assert.match(html, /Reached/);
});
