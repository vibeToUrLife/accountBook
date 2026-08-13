// Debts / Lending feature module.
// Self-contained: receives a shared `ctx` (live state getters + helpers + firestore)
// from the core (app.js). Reads current state via ctx.* getters; writes go through
// Firestore, and the core's onSnapshot listeners refresh state + re-render.
export function createDebts(ctx) {
  const { money, icon, escapeHtml, todayISO, normalizeText, parsePositiveAmount, userCollections, firestore } = ctx;
  const { addDoc, setDoc, deleteDoc, doc, serverTimestamp } = firestore;

  function renderDebts() {
    const container = document.getElementById("debtsContainer");
    const summary = document.getElementById("debtSummary");
    if (!container) return;

    const showSettled = !!document.getElementById("debtShowSettled")?.checked;

    // Summary (outstanding only)
    const outstanding = ctx.debts.filter((d) => d.status !== "settled");
    const owedToMe = outstanding.filter((d) => d.direction === "owed_to_me").reduce((s, d) => s + (d.amount || 0), 0);
    const iOwe = outstanding.filter((d) => d.direction === "i_owe").reduce((s, d) => s + (d.amount || 0), 0);
    const net = owedToMe - iOwe;
    if (summary) {
      const netCls = net >= 0 ? "revenue" : "expense";
      summary.innerHTML = `
        <div class="debt-summary-item"><span class="debt-summary-label">Owed to me</span><span class="debt-summary-value revenue">${money(owedToMe)}</span></div>
        <div class="debt-summary-item"><span class="debt-summary-label">I owe</span><span class="debt-summary-value expense">${money(iOwe)}</span></div>
        <div class="debt-summary-item"><span class="debt-summary-label">Net</span><span class="debt-summary-value ${netCls}">${money(net)}</span></div>`;
    }

    const visible = showSettled ? ctx.debts : outstanding;
    if (visible.length === 0) {
      container.innerHTML = '<div class="muted small">No debts to show.</div>';
      return;
    }

    const today = todayISO();
    container.innerHTML = visible.map((d) => {
      const settled = d.status === "settled";
      const isOwedToMe = d.direction === "owed_to_me";
      const dirLabel = isOwedToMe ? "owes me" : "I owe";
      const amtCls = isOwedToMe ? "revenue" : "expense";
      const overdue = !settled && d.dueDate && d.dueDate < today;
      const due = d.dueDate
        ? `<span class="debt-due ${overdue ? "overdue" : ""}">Due ${escapeHtml(d.dueDate)}${overdue ? " · overdue" : ""}</span>`
        : "";
      const note = d.note ? `<span class="debt-note">${escapeHtml(d.note)}</span>` : "";
      return `<div class="debt-card ${settled ? "settled" : ""}">
        <div class="debt-info">
          <div class="debt-name">${escapeHtml(d.person || "?")} <span class="debt-dir">${dirLabel}</span> <span class="debt-amount ${amtCls}">${money(d.amount || 0)}</span></div>
          <div class="debt-meta">${escapeHtml(d.dateISO || "")} ${due} ${note}</div>
        </div>
        <div class="debt-actions">
          ${settled
            ? `<span class="debt-settled-tag">${icon("check", "icon-sm")} Settled</span>`
            : `<button class="btn btn-secondary btn-small" type="button" data-action="settle-debt" data-id="${d.id}">Mark paid</button>`}
          <button class="btn btn-danger btn-small" type="button" data-action="delete-debt" data-id="${d.id}">Delete</button>
        </div>
      </div>`;
    }).join("");
  }

  async function addDebt() {
    const personInput = document.getElementById("debtPerson");
    const directionInput = document.getElementById("debtDirection");
    const amountInput = document.getElementById("debtAmount");
    const noteInput = document.getElementById("debtNote");
    const dueInput = document.getElementById("debtDueDate");
    if (!personInput || !amountInput) return;

    const person = normalizeText(personInput.value);
    const direction = directionInput && directionInput.value === "i_owe" ? "i_owe" : "owed_to_me";
    const amount = parsePositiveAmount(amountInput.value);
    const note = noteInput ? normalizeText(noteInput.value) : "";
    const dueDate = dueInput ? dueInput.value : "";

    if (!person || amount == null) return;

    const { debts: debtsCol } = userCollections(ctx.uid);
    await addDoc(debtsCol, {
      person,
      direction,
      amount,
      note,
      dateISO: todayISO(),
      dueDate,
      status: "outstanding",
      createdAt: serverTimestamp(),
    });

    personInput.value = "";
    amountInput.value = "";
    if (noteInput) noteInput.value = "";
    if (dueInput) dueInput.value = "";
    personInput.focus();
  }

  async function settleDebt(debtId) {
    const { debts: debtsCol } = userCollections(ctx.uid);
    await setDoc(doc(debtsCol, debtId), { status: "settled", settledAt: serverTimestamp() }, { merge: true });
  }

  async function deleteDebt(debtId) {
    const { debts: debtsCol } = userCollections(ctx.uid);
    await deleteDoc(doc(debtsCol, debtId));
  }

  return { renderDebts, addDebt, settleDebt, deleteDebt };
}
