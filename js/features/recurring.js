// Recurring Transactions feature module. Owns the auto-run gating flags
// internally; the core's listeners call markTransactionsLoaded/markRecurringLoaded
// + autoRun(), and reset() on sign-out.
import { t } from "../i18n.js?v=1"; // query must match app.js so both share one module instance
export function createRecurring(ctx) {
  const { money, escapeHtml, todayISO, normalizeText, parsePositiveAmount, clamp, setAppError, showUndoToast, userCollections, firestore } = ctx;
  const { addDoc, deleteDoc, doc, serverTimestamp } = firestore;

  let recurringLoaded = false;
  let transactionsLoaded = false;
  let hasAutoRun = false;

  function markRecurringLoaded() { recurringLoaded = true; }
  function markTransactionsLoaded() { transactionsLoaded = true; }
  function reset() { recurringLoaded = false; transactionsLoaded = false; hasAutoRun = false; }

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
          <div class="recurring-detail">${typeLabel} · ${money(r.amount)} · ${t("Day {day} each month", { day: r.dayOfMonth || 1 })}</div>
        </div>
        <button class="btn btn-danger btn-small" type="button" data-action="delete-recurring" data-id="${r.id}">${t("Delete")}</button>
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
    await addDoc(recurringCol, { categoryId, categoryName, type, amount, note, dayOfMonth, createdAt: serverTimestamp() });

    amountInput.value = "";
    if (noteInput) noteInput.value = "";
    dayInput.value = "";
  }

  async function deleteRecurringRule(ruleId) {
    const { recurring: recurringCol } = userCollections(ctx.uid);
    await deleteDoc(doc(recurringCol, ruleId));
  }

  // Helper: add the due rules that haven't already been recorded today.
  async function addDueRules(due, dateISO) {
    const { transactions: txCol } = userCollections(ctx.uid);
    let count = 0;
    for (const r of due) {
      const alreadyDone = ctx.transactions.some((t) => t.dateISO === dateISO && t.categoryId === r.categoryId && t.amount === r.amount && (t.note || "") === (r.note || ""));
      if (alreadyDone) continue;
      await addDoc(txCol, {
        categoryId: r.categoryId,
        categoryName: r.categoryName || "(Unknown)",
        type: r.type,
        amount: r.amount,
        note: r.note || "",
        noteLower: (r.note || "").toLowerCase(),
        dateISO,
        createdAt: serverTimestamp(),
      });
      count++;
    }
    return count;
  }

  async function autoRun() {
    if (hasAutoRun) return;
    if (!recurringLoaded || !transactionsLoaded) return;
    hasAutoRun = true;

    if (ctx.recurringRules.length === 0) return;

    const dayOfMonth = new Date().getDate();
    const dateISO = todayISO();
    const due = ctx.recurringRules.filter((r) => (r.dayOfMonth || 1) === dayOfMonth);
    if (due.length === 0) return;

    const count = await addDueRules(due, dateISO);
    if (count > 0) {
      showUndoToast({ message: t("Auto-added {n} recurring transaction(s).", { n: count }), onUndo: () => {} });
    }
  }

  async function runDueRecurring() {
    const dayOfMonth = new Date().getDate();
    const dateISO = todayISO();
    const due = ctx.recurringRules.filter((r) => (r.dayOfMonth || 1) === dayOfMonth);
    if (due.length === 0) {
      setAppError(t("No recurring transactions due today (day {day}).", { day: dayOfMonth }));
      return;
    }
    const count = await addDueRules(due, dateISO);
    setAppError(count > 0 ? t("Added {n} recurring transaction(s).", { n: count }) : t("All due recurring transactions already recorded today."));
  }

  return {
    renderRecurringRules, addRecurringRule, deleteRecurringRule, runDueRecurring,
    autoRun, markRecurringLoaded, markTransactionsLoaded, reset,
  };
}
