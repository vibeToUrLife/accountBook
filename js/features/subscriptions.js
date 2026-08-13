// Subscriptions feature module. Awareness tracker + "Pay & Record" (logs an
// expense and rolls the renewal date forward one cycle). Receives the shared
// `ctx` from the core; reads live state via ctx.* and writes through Firestore.
export function createSubscriptions(ctx) {
  const { money, escapeHtml, todayISO, normalizeText, parsePositiveAmount, userCollections, firestore } = ctx;
  const { addDoc, setDoc, deleteDoc, doc, serverTimestamp } = firestore;

  function daysBetween(fromISO, toISO) {
    const a = new Date(fromISO + "T00:00:00");
    const b = new Date(toISO + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  function advanceRenewal(dateISO, cycle) {
    const d = new Date((dateISO || todayISO()) + "T00:00:00");
    if (cycle === "year") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  function renderSubscriptions() {
    const container = document.getElementById("subsContainer");
    const summary = document.getElementById("subSummary");
    const catSel = document.getElementById("subCategory");
    if (!container) return;

    // Populate category select, preserving current selection
    if (catSel) {
      const prev = catSel.value;
      catSel.innerHTML = "";
      for (const c of ctx.categories) {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        catSel.appendChild(opt);
      }
      if (prev && ctx.categories.some((c) => c.id === prev)) catSel.value = prev;
    }

    const showCancelled = !!document.getElementById("subShowCancelled")?.checked;
    const active = ctx.subscriptions.filter((s) => s.status !== "cancelled");

    const monthly = active.reduce((sum, s) => sum + (s.cycle === "year" ? (s.amount || 0) / 12 : (s.amount || 0)), 0);
    const yearly = active.reduce((sum, s) => sum + (s.cycle === "year" ? (s.amount || 0) : (s.amount || 0) * 12), 0);
    if (summary) {
      summary.innerHTML = `
        <div class="debt-summary-item"><span class="debt-summary-label">Per month</span><span class="debt-summary-value expense">${money(monthly)}</span></div>
        <div class="debt-summary-item"><span class="debt-summary-label">Per year</span><span class="debt-summary-value expense">${money(yearly)}</span></div>
        <div class="debt-summary-item"><span class="debt-summary-label">Active</span><span class="debt-summary-value">${active.length}</span></div>`;
    }

    const visible = showCancelled ? ctx.subscriptions : active;
    if (visible.length === 0) {
      container.innerHTML = '<div class="muted small">No subscriptions to show.</div>';
      return;
    }

    const today = todayISO();
    container.innerHTML = visible.map((s) => {
      const cancelled = s.status === "cancelled";
      const cycleLabel = s.cycle === "year" ? "Yearly" : "Monthly";

      // Due state drives both the label and the Pay button
      const days = s.nextRenewal ? daysBetween(today, s.nextRenewal) : 0;
      const isOverdue = !!s.nextRenewal && days < 0;
      const isDue = !s.nextRenewal || days <= 0; // payable today or past
      let dueClass = "", dueText = "";
      if (s.nextRenewal) {
        if (days < 0) { dueClass = "overdue"; dueText = `Overdue · ${s.nextRenewal}`; }
        else if (days === 0) { dueClass = "overdue"; dueText = "Renews today"; }
        else if (days <= 3) { dueClass = "soon"; dueText = `Renews in ${days} day${days > 1 ? "s" : ""}`; }
        else { dueText = `Renews ${s.nextRenewal}`; }
      }
      const cat = ctx.categories.find((c) => c.id === s.categoryId);
      const catName = cat ? cat.name : (s.categoryName || "");

      const payAttrs = isDue
        ? `class="btn btn-small ${isOverdue ? "btn-danger" : ""}"`
        : `class="btn btn-small" disabled title="Already paid — next renewal ${escapeHtml(s.nextRenewal || "")}"`;

      return `<div class="debt-card ${cancelled ? "settled" : ""}">
        <div class="debt-info">
          <div class="debt-name">${escapeHtml(s.name || "?")} <span class="debt-amount expense">${money(s.amount || 0)}</span> <span class="debt-dir">/ ${cycleLabel}</span></div>
          <div class="debt-meta">${escapeHtml(catName)} <span class="debt-due ${dueClass}">${escapeHtml(dueText)}</span></div>
        </div>
        <div class="debt-actions">
          ${cancelled
            ? `<span class="debt-settled-tag">Cancelled</span>`
            : `<button ${payAttrs} type="button" data-action="pay-sub" data-id="${s.id}">Pay &amp; Record</button>
               <button class="btn btn-secondary btn-small" type="button" data-action="cancel-sub" data-id="${s.id}">Cancel</button>`}
          <button class="btn btn-danger btn-small" type="button" data-action="delete-sub" data-id="${s.id}">Delete</button>
        </div>
      </div>`;
    }).join("");
  }

  async function addSubscription() {
    const nameInput = document.getElementById("subName");
    const catInput = document.getElementById("subCategory");
    const amountInput = document.getElementById("subAmount");
    const cycleInput = document.getElementById("subCycle");
    const renewalInput = document.getElementById("subRenewal");
    if (!nameInput || !amountInput) return;

    const name = normalizeText(nameInput.value);
    const categoryId = catInput ? catInput.value : "";
    const amount = parsePositiveAmount(amountInput.value);
    const cycle = cycleInput && cycleInput.value === "year" ? "year" : "month";
    const nextRenewal = renewalInput ? renewalInput.value : "";

    if (!name || amount == null || !categoryId || !nextRenewal) return;

    const category = ctx.categories.find((c) => c.id === categoryId);
    const categoryName = category ? category.name : "";

    const { subscriptions: subsCol } = userCollections(ctx.uid);
    await addDoc(subsCol, {
      name, categoryId, categoryName, amount, cycle, nextRenewal,
      status: "active", createdAt: serverTimestamp(),
    });

    nameInput.value = "";
    amountInput.value = "";
    if (renewalInput) renewalInput.value = "";
    nameInput.focus();
  }

  async function paySubscription(subId) {
    const sub = ctx.subscriptions.find((s) => s.id === subId);
    if (!sub || !sub.categoryId || sub.status === "cancelled") return;
    // Guard: only payable when due (renewal date is today or past)
    if (sub.nextRenewal && daysBetween(todayISO(), sub.nextRenewal) > 0) return;

    const category = ctx.categories.find((c) => c.id === sub.categoryId);
    const categoryName = category ? category.name : (sub.categoryName || "(Unknown)");
    const note = `${sub.name} subscription`;

    const { transactions: txCol, subscriptions: subsCol } = userCollections(ctx.uid);
    await addDoc(txCol, {
      categoryId: sub.categoryId,
      categoryName,
      type: "expense",
      amount: sub.amount || 0,
      note,
      noteLower: note.toLowerCase(),
      tags: [],
      dateISO: todayISO(),
      createdAt: serverTimestamp(),
    });

    const nextRenewal = advanceRenewal(sub.nextRenewal, sub.cycle);
    await setDoc(doc(subsCol, subId), { nextRenewal, lastPaidISO: todayISO() }, { merge: true });
  }

  async function cancelSubscription(subId) {
    const { subscriptions: subsCol } = userCollections(ctx.uid);
    await setDoc(doc(subsCol, subId), { status: "cancelled", cancelledAt: serverTimestamp() }, { merge: true });
  }

  async function deleteSubscription(subId) {
    const { subscriptions: subsCol } = userCollections(ctx.uid);
    await deleteDoc(doc(subsCol, subId));
  }

  return { renderSubscriptions, addSubscription, paySubscription, cancelSubscription, deleteSubscription };
}
