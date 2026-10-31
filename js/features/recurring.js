// Recurring Transactions feature module. The core's listeners call
// markTransactionsLoaded/markRecurringLoaded + autoRun(), the app calls
// autoRun() again when it comes back to the foreground or online, and reset()
// on sign-out.
//
// Each rule remembers the last month it was recorded for (`lastPostedMonth`,
// "YYYY-MM"). A run records every month after that whose day has arrived, so a
// month is never skipped because the app wasn't opened on the day, and a rule
// on the 31st lands on the last day of shorter months. The record for one month
// has a fixed id, written inside a transaction that first checks the server, so
// two tabs or devices never record the same month twice.
import { t } from "../i18n.js?v=2"; // query must match app.js so both share one module instance

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const pad2 = (n) => String(n).padStart(2, "0");

function monthAfter(monthKey) {
  let [y, m] = monthKey.split("-").map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad2(m)}`;
}

/** Id of the record a rule makes for one month. */
export function recurringTxId(ruleId, monthKey) {
  return `rec_${ruleId}_${monthKey}`;
}

/**
 * The first month that may still be owed: the month after the last recorded
 * one, else the month the rule starts in. Rules saved before the app tracked
 * this (no lastPostedMonth, no startISO) start in the current month.
 */
export function firstOpenMonth(rule, today) {
  if (MONTH_RE.test(rule.lastPostedMonth || "")) return monthAfter(rule.lastPostedMonth);
  if (DATE_RE.test(rule.startISO || "")) return rule.startISO.slice(0, 7);
  return today.slice(0, 7);
}

/**
 * Dates a "day N of every month" rule is owed for: from firstOpenMonth up to
 * today, oldest first, as { monthKey, dateISO }. A day past the end of a month
 * falls on its last day (31 → Feb 28), and nothing before the rule's startISO
 * counts. At most `max` per run; the rest follow on the next run.
 */
export function dueOccurrences(rule, today, max = 12) {
  const day = Math.min(31, Math.max(1, parseInt(rule.dayOfMonth, 10) || 1));
  const start = DATE_RE.test(rule.startISO || "") ? rule.startISO : "";
  const lastMonth = today.slice(0, 7);
  const out = [];
  for (let key = firstOpenMonth(rule, today); key <= lastMonth && out.length < max; key = monthAfter(key)) {
    const [y, m] = key.split("-").map(Number);
    const dateISO = `${key}-${pad2(Math.min(day, new Date(y, m, 0).getDate()))}`;
    if (dateISO > today || (start && dateISO < start)) continue;
    out.push({ monthKey: key, dateISO });
  }
  return out;
}

/**
 * Whether that date already has this rule's record: its fixed id, or a record
 * that matches it exactly (added by hand, or by an older version of the app).
 */
export function alreadyRecorded(rule, occurrence, transactions) {
  const id = recurringTxId(rule.id, occurrence.monthKey);
  const cents = (v) => Math.round(Number(v) * 100);
  return transactions.some((t) => t.id === id || (
    t.dateISO === occurrence.dateISO &&
    t.categoryId === rule.categoryId &&
    cents(t.amount) === cents(rule.amount) &&
    (t.note || "") === (rule.note || "")
  ));
}

export function createRecurring(ctx) {
  const { money, escapeHtml, todayISO, normalizeText, parsePositiveAmount, clamp, setAppError, friendlyDbError, showUndoToast, userCollections, firestore } = ctx;
  const { addDoc, deleteDoc, doc, serverTimestamp, batch, runTransaction } = firestore;

  let recurringLoaded = false;
  let transactionsLoaded = false;
  let running = false;
  let retryAfter = 0; // after a failed run (usually offline), wait before trying again

  function markRecurringLoaded() { recurringLoaded = true; }
  function markTransactionsLoaded() { transactionsLoaded = true; }
  function reset() { recurringLoaded = false; transactionsLoaded = false; running = false; retryAfter = 0; }

  function renderRecurringRules() {
    const container = document.getElementById("recurringContainer");
    if (!container) return;

    // Populate the category select in the recurring form
    const recCatSelect = document.getElementById("recurringCategory");
    if (recCatSelect && recCatSelect.options.length <= 1) {
      recCatSelect.innerHTML = "";
      for (const c of ctx.categories) {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        recCatSelect.appendChild(opt);
      }
    }

    if (ctx.recurringRules.length === 0) {
      container.innerHTML = `<div class="muted small">${t("No recurring rules yet.")}</div>`;
      return;
    }

    container.innerHTML = ctx.recurringRules.map((r) => {
      const cat = ctx.categories.find((c) => c.id === r.categoryId);
      const catName = cat ? cat.name : t("(Unknown)");
      const typeLabel = r.type === "expense" ? t("Expense") : t("Revenue");
      return `<div class="recurring-card">
        <div class="recurring-info">
          <div class="recurring-name">${escapeHtml(catName)} — ${escapeHtml(r.note || "")}</div>
          <div class="recurring-detail">${typeLabel} · ${money(r.amount)} · ${t("Day {day} each month", { day: clamp(parseInt(r.dayOfMonth, 10) || 1, 1, 31) })}</div>
        </div>
        <button class="btn btn-danger btn-small" type="button" data-action="delete-recurring" data-id="${escapeHtml(r.id)}">${t("Delete")}</button>
      </div>`;
    }).join("");
  }

  async function addRecurringRule() {
    const catSelect = document.getElementById("recurringCategory");
    const typeSelect = document.getElementById("recurringType");
    const amountInput = document.getElementById("recurringAmount");
    const noteInput = document.getElementById("recurringNote");
    const dayInput = document.getElementById("recurringDay");

    if (!catSelect || !amountInput || !dayInput) return;

    const categoryId = catSelect.value;
    const type = typeSelect ? typeSelect.value : "expense";
    const amount = parsePositiveAmount(amountInput.value);
    const note = normalizeText(noteInput ? noteInput.value : "");
    const dayOfMonth = clamp(parseInt(dayInput.value, 10) || 1, 1, 31);

    if (!categoryId || amount == null) return;

    const category = ctx.categories.find((c) => c.id === categoryId);
    const categoryName = category ? category.name : "(Unknown)";

    const { recurring: recurringCol } = userCollections(ctx.uid);
    // startISO: a rule only owes days from today on (a day-5 rule added on the
    // 20th first records next month's 5th; one added on its own day records today).
    await addDoc(recurringCol, { categoryId, categoryName, type, amount, note, dayOfMonth, startISO: todayISO(), createdAt: serverTimestamp() });

    amountInput.value = "";
    if (noteInput) noteInput.value = "";
    dayInput.value = "";
  }

  async function deleteRecurringRule(ruleId) {
    const { recurring: recurringCol } = userCollections(ctx.uid);
    await deleteDoc(doc(recurringCol, ruleId));
  }

  // Undo removes the records just added. The rule stays marked as recorded
  // for those months, so they aren't added back on the next run.
  function offerUndo(ids, message) {
    const { transactions: txCol } = userCollections(ctx.uid);
    showUndoToast({
      message,
      onUndo: async () => {
        const writes = batch();
        for (const id of ids) writes.delete(doc(txCol, id));
        writes.commit().catch((err) => setAppError(friendlyDbError(err)));
      },
    });
  }

  // Record what one rule owes. The rule and the month records are read from
  // the server inside a transaction, so a stale local copy (another device
  // already recorded the month) can't produce a second record. Returns the ids
  // of the records created.
  function catchUpRule(localRule, today) {
    const { recurring: recurringCol, transactions: txCol } = userCollections(ctx.uid);
    const ruleRef = doc(recurringCol, localRule.id);
    return runTransaction(async (tr) => {
      const ruleSnap = await tr.get(ruleRef);
      if (!ruleSnap.exists()) return [];
      const rule = { id: localRule.id, ...ruleSnap.data() };
      const due = dueOccurrences(rule, today);
      if (!due.length) return [];
      const owed = due.filter((o) => !alreadyRecorded(rule, o, ctx.transactions));
      const refs = owed.map((o) => doc(txCol, recurringTxId(rule.id, o.monthKey)));
      const snaps = [];
      for (const ref of refs) snaps.push(await tr.get(ref)); // every read before any write
      const category = ctx.categories.find((c) => c.id === rule.categoryId);
      const note = rule.note || "";
      const created = [];
      owed.forEach((o, i) => {
        if (snaps[i].exists()) return;
        tr.set(refs[i], {
          categoryId: rule.categoryId,
          categoryName: category ? category.name : (rule.categoryName || "(Unknown)"),
          type: rule.type === "revenue" ? "revenue" : "expense",
          amount: rule.amount,
          note,
          noteLower: note.toLowerCase(),
          tags: [],
          dateISO: o.dateISO,
          recurringRuleId: rule.id,
          createdAt: serverTimestamp(),
        });
        created.push(refs[i].id);
      });
      const patch = { lastPostedMonth: due[due.length - 1].monthKey };
      if (!rule.startISO) patch.startISO = `${today.slice(0, 7)}-01`;
      tr.set(ruleRef, patch, { merge: true });
      return created;
    });
  }

  /**
   * Record every month the rules owe (see dueOccurrences). Cheap and safe to
   * call whenever data changes: with nothing owed it writes nothing. `force`
   * skips the wait after a failed (offline) run. Resolves to the number of
   * records added, or null when it couldn't run.
   */
  async function autoRun({ manual = false, force = false } = {}) {
    if (!recurringLoaded || !transactionsLoaded || !ctx.uid || running) return null;
    if (!manual && !force && Date.now() < retryAfter) return null;
    const today = todayISO();
    const rules = ctx.recurringRules;

    // Rules saved before catch-up existed get a start date the first time they
    // are seen, so this month stays owed even if the app isn't opened on the day.
    const unmarked = rules.filter((r) => !r.startISO && !r.lastPostedMonth && !dueOccurrences(r, today).length);
    if (unmarked.length) {
      const { recurring: recurringCol } = userCollections(ctx.uid);
      const writes = batch();
      for (const r of unmarked) writes.set(doc(recurringCol, r.id), { startISO: `${today.slice(0, 7)}-01` }, { merge: true });
      writes.commit().catch(() => {});
    }

    const owing = rules.filter((r) => dueOccurrences(r, today).length);
    if (!owing.length) return 0;

    running = true;
    const created = [];
    let failed = false;
    try {
      for (const rule of owing) created.push(...(await catchUpRule(rule, today)));
      retryAfter = 0;
    } catch (err) {
      // Transactions need the server. Offline, try again when the app is back
      // online or in the foreground (or after a minute).
      failed = true;
      retryAfter = Date.now() + 60000;
      if (manual) setAppError(friendlyDbError(err));
    } finally {
      running = false;
    }
    if (created.length) {
      offerUndo(created, manual
        ? t("Added {n} recurring transaction(s).", { n: created.length })
        : t("Auto-added {n} recurring transaction(s).", { n: created.length }));
    }
    return failed && !created.length ? null : created.length;
  }

  async function runDueRecurring() {
    if (!ctx.recurringRules.length) {
      setAppError(t("No recurring rules yet."));
      return;
    }
    const added = await autoRun({ manual: true });
    if (added === 0) setAppError(t("All recurring transactions are recorded up to today."));
  }

  return {
    renderRecurringRules, addRecurringRule, deleteRecurringRule, runDueRecurring,
    autoRun, markRecurringLoaded, markTransactionsLoaded, reset,
  };
}
