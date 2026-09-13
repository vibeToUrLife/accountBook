// Savings Goals feature module. Progress comes from the goal's own
// contributions (deposits minus withdrawals), stored on the goal document.
export function createGoals(ctx) {
  const { money, icon, escapeHtml, todayISO, normalizeText, parsePositiveAmount, showUndoToast, userCollections, firestore } = ctx;
  const { addDoc, deleteDoc, setDoc, doc, serverTimestamp } = firestore;

  // Inline "Add money" form state lives here so a background re-render
  // (a Firestore snapshot) doesn't close the form or wipe what was typed.
  let formOpenId = null;
  let formError = "";
  let draft = null;
  const historyOpen = new Set();

  const helpers = { money, escapeHtml, icon };

  function stateFor(goalId) {
    const open = formOpenId === goalId;
    return {
      formOpen: open,
      historyOpen: historyOpen.has(goalId),
      error: open ? formError : "",
      draft: open ? draft : null,
    };
  }

  function renderSavingsGoals() {
    const container = document.getElementById("goalsContainer");
    if (!container) return;

    if (ctx.savingsGoals.length === 0) {
      container.innerHTML = '<div class="muted small">No savings goals yet. Add one above!</div>';
      return;
    }

    const today = todayISO();
    container.innerHTML = ctx.savingsGoals.map((g) => goalCardHtml(g, stateFor(g.id), helpers, today)).join("");
  }

  function openContribute(goalId) {
    formOpenId = goalId;
    formError = "";
    draft = null;
    renderSavingsGoals();
    const input = document.querySelector(`.goal-contrib-form[data-goal-id="${goalId}"] input[name="amount"]`);
    if (input) input.focus();
  }

  function cancelContribute() {
    formOpenId = null;
    formError = "";
    draft = null;
    renderSavingsGoals();
  }

  function toggleHistory(goalId) {
    if (historyOpen.has(goalId)) historyOpen.delete(goalId);
    else historyOpen.add(goalId);
    renderSavingsGoals();
  }

  function readForm(form) {
    const data = new FormData(form);
    return {
      amount: data.get("amount") ?? "",
      kind: data.get("kind") === "withdraw" ? "withdraw" : "deposit",
      dateISO: data.get("dateISO") || "",
      note: data.get("note") ?? "",
    };
  }

  // Called on every keystroke in the open form so re-renders keep the values.
  function captureDraft(form) {
    if (form && form.dataset.goalId === formOpenId) draft = readForm(form);
  }

  function newId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  async function saveContributions(goalId, contributions) {
    const { savingsGoals: goalsCol } = userCollections(ctx.uid);
    await setDoc(doc(goalsCol, goalId), { contributions, updatedAt: serverTimestamp() }, { merge: true });
  }

  async function submitContribution(form) {
    const goalId = form.dataset.goalId;
    const goal = ctx.savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;

    const raw = readForm(form);
    draft = raw;
    const amount = parsePositiveAmount(raw.amount);
    const error = validateContribution(goal, { amount, kind: raw.kind }, money) || (raw.dateISO ? null : "Pick a date.");
    if (error) {
      formError = error;
      renderSavingsGoals();
      return;
    }

    const entry = {
      id: newId(),
      amount,
      kind: raw.kind,
      dateISO: raw.dateISO,
      note: normalizeText(raw.note),
      createdAtISO: new Date().toISOString(),
    };
    await saveContributions(goalId, withContribution(goal.contributions, entry));

    formOpenId = null;
    formError = "";
    draft = null;
    renderSavingsGoals();

    const verb = entry.kind === "withdraw" ? "Withdrew" : "Added";
    const prep = entry.kind === "withdraw" ? "from" : "to";
    showUndoToast({
      message: `${verb} ${money(amount)} ${prep} ${goal.name || "goal"}.`,
      onUndo: async () => {
        const latest = ctx.savingsGoals.find((g) => g.id === goalId);
        if (latest) await saveContributions(goalId, withoutContribution(latest.contributions, entry.id));
      },
    });
  }

  async function deleteContribution(goalId, contributionId) {
    const goal = ctx.savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;
    const entry = (goal.contributions || []).find((c) => c.id === contributionId);
    if (!entry) return;

    await saveContributions(goalId, withoutContribution(goal.contributions, contributionId));
    showUndoToast({
      message: `Removed ${money(entry.amount || 0)} entry from ${goal.name || "goal"}.`,
      onUndo: async () => {
        const latest = ctx.savingsGoals.find((g) => g.id === goalId);
        if (latest) await saveContributions(goalId, withContribution(latest.contributions, entry));
      },
    });
  }

  async function addSavingsGoal() {
    const nameInput = document.getElementById("goalName");
    const targetInput = document.getElementById("goalTarget");
    const deadlineInput = document.getElementById("goalDeadline");
    if (!nameInput || !targetInput) return;

    const name = normalizeText(nameInput.value);
    const target = parsePositiveAmount(targetInput.value);
    const deadline = deadlineInput ? deadlineInput.value : "";

    if (!name || target == null) return;

    const { savingsGoals: goalsCol } = userCollections(ctx.uid);
    await addDoc(goalsCol, { name, target, deadline, contributions: [], createdAt: serverTimestamp() });

    nameInput.value = "";
    targetInput.value = "";
    if (deadlineInput) deadlineInput.value = "";
  }

  async function deleteSavingsGoal(goalId) {
    const { savingsGoals: goalsCol } = userCollections(ctx.uid);
    await deleteDoc(doc(goalsCol, goalId));
    historyOpen.delete(goalId);
    if (formOpenId === goalId) { formOpenId = null; formError = ""; draft = null; }
  }

  return {
    renderSavingsGoals, addSavingsGoal, deleteSavingsGoal,
    openContribute, cancelContribute, toggleHistory, captureDraft, submitContribution, deleteContribution,
  };
}

// ── Pure helpers (unit tested) ──────────────────────────────────────────────
// A goal document carries `contributions: [{ id, amount, kind, dateISO, note, createdAtISO }]`
// where kind is "deposit" or "withdraw". Progress is derived from that list.

function contributionsOf(goal) {
  return Array.isArray(goal?.contributions) ? goal.contributions : [];
}

function signedAmount(c) {
  const amt = Number(c?.amount) || 0;
  return c?.kind === "withdraw" ? -amt : amt;
}

export function goalSaved(goal) {
  const total = contributionsOf(goal).reduce((sum, c) => sum + signedAmount(c), 0);
  return Math.max(0, total);
}

export function goalProgress(goal) {
  const saved = goalSaved(goal);
  const target = Number(goal?.target) || 0;
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  return { saved, target, pct, isDone: target > 0 && saved >= target };
}

function isoToDate(iso) {
  return new Date(iso + "T00:00:00");
}

// Calendar months from today until the deadline; a partial month counts as one.
function monthsUntil(todayISO, deadlineISO) {
  const a = isoToDate(todayISO);
  const b = isoToDate(deadlineISO);
  if (b <= a) return 0;
  let whole = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) whole -= 1;
  const anchor = new Date(a);
  anchor.setMonth(anchor.getMonth() + whole);
  return whole + (b > anchor ? 1 : 0);
}

// Amount to put aside each month to reach the target by the deadline.
// null without a deadline, 0 once reached, the whole remainder if overdue.
export function monthlyNeeded(goal, todayISO) {
  if (!goal?.deadline) return null;
  const { saved, target } = goalProgress(goal);
  const remaining = target - saved;
  if (remaining <= 0) return 0;
  const months = Math.max(1, monthsUntil(todayISO, goal.deadline));
  return remaining / months;
}

export function withContribution(list, entry) {
  return [...(Array.isArray(list) ? list : []), entry];
}

export function withoutContribution(list, id) {
  return (Array.isArray(list) ? list : []).filter((c) => c.id !== id);
}

export function sortedContributions(list) {
  return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? 1 : -1;
    const ca = a.createdAtISO || "";
    const cb = b.createdAtISO || "";
    return ca < cb ? 1 : ca > cb ? -1 : 0;
  });
}

// Returns an error message, or null when the entry can be saved.
export function validateContribution(goal, { amount, kind }, money = (n) => String(n)) {
  if (amount == null || !(amount > 0)) return "Enter an amount greater than 0.";
  if (kind === "withdraw") {
    const saved = goalSaved(goal);
    if (amount > saved) return `You can only withdraw up to ${money(saved)}.`;
  }
  return null;
}

const KIND_LABEL = { deposit: "Deposit", withdraw: "Withdraw" };

function contributionFormHtml(goal, state, { escapeHtml }, todayISO) {
  const draft = state.draft || {};
  const kind = draft.kind === "withdraw" ? "withdraw" : "deposit";
  const dateISO = draft.dateISO || todayISO;
  const error = state.error ? `<div class="goal-form-error">${escapeHtml(state.error)}</div>` : "";
  return `<form class="goal-contrib-form" data-goal-id="${escapeHtml(goal.id)}" autocomplete="off">
    <div class="goal-contrib-hint muted small">Deposit adds money to this goal. Withdraw takes money out. This does not change your records or budgets.</div>
    <div class="goal-contrib-fields">
      <label class="field inline-sm">
        <span>Type</span>
        <select name="kind">
          <option value="deposit"${kind === "deposit" ? " selected" : ""}>Deposit</option>
          <option value="withdraw"${kind === "withdraw" ? " selected" : ""}>Withdraw</option>
        </select>
      </label>
      <label class="field inline-sm">
        <span>Amount</span>
        <input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0.00" required value="${escapeHtml(draft.amount ?? "")}" />
      </label>
      <label class="field inline-sm">
        <span>Date</span>
        <input name="dateISO" type="date" required value="${escapeHtml(dateISO)}" />
      </label>
      <label class="field inline-sm">
        <span>Note</span>
        <input name="note" type="text" maxlength="60" placeholder="Optional, e.g. bonus" value="${escapeHtml(draft.note ?? "")}" />
      </label>
    </div>
    <div class="goal-contrib-actions">
      <button class="btn btn-small" type="submit">Save</button>
      <button class="btn btn-secondary btn-small" type="button" data-action="cancel-contribute" data-id="${escapeHtml(goal.id)}">Cancel</button>
    </div>
    ${error}
  </form>`;
}

function historyHtml(goal, { money, escapeHtml }) {
  const list = sortedContributions(goal.contributions);
  if (list.length === 0) return `<div class="goal-history muted small">No deposits yet. Tap "Add money" to put money into this goal.</div>`;
  const rows = list.map((c) => {
    const isWithdraw = c.kind === "withdraw";
    const cls = isWithdraw ? "expense" : "revenue";
    const sign = isWithdraw ? "-" : "+";
    const note = c.note ? ` · ${escapeHtml(c.note)}` : "";
    return `<div class="goal-history-item">
      <span class="goal-history-meta">${escapeHtml(c.dateISO || "")} · ${KIND_LABEL[c.kind] || "Deposit"}${note}</span>
      <span class="goal-history-amount ${cls}">${sign}${money(c.amount || 0)}</span>
      <button class="btn btn-danger btn-small" type="button" data-action="delete-contribution" data-goal-id="${escapeHtml(goal.id)}" data-id="${escapeHtml(c.id)}" title="Remove this entry from the goal">Remove</button>
    </div>`;
  }).join("");
  return `<div class="goal-history"><div class="goal-history-title">Deposit history</div>${rows}</div>`;
}

// One goal card. `state` = { formOpen, historyOpen, error, draft } for this goal.
export function goalCardHtml(goal, state = {}, helpers, todayISO) {
  const { money, escapeHtml, icon } = helpers;
  const { saved, target, pct, isDone } = goalProgress(goal);
  const count = contributionsOf(goal).length;
  const deadline = goal.deadline ? `Due: ${escapeHtml(goal.deadline)}` : "No deadline";

  let planLine = "";
  const needed = monthlyNeeded(goal, todayISO);
  if (needed != null && needed > 0) {
    const months = Math.max(1, monthsUntil(todayISO, goal.deadline));
    planLine = `<div class="goal-plan muted small">Save ${money(needed)} per month to reach it by the deadline (${months} month${months === 1 ? "" : "s"} left).</div>`;
  }
  const doneTag = isDone ? `<span class="goal-done-tag">${icon("check", "icon-sm")} Reached</span>` : "";

  return `<div class="goal-card" data-goal-id="${escapeHtml(goal.id)}">
    <div class="goal-card-header">
      <h4>${icon("target", "icon-sm")} ${escapeHtml(goal.name || "Untitled")} ${doneTag}</h4>
      <span class="goal-deadline">${deadline}</span>
    </div>
    <div class="goal-progress-bar">
      <div class="goal-progress-fill ${isDone ? "done" : ""}" style="width:${pct}%"></div>
    </div>
    <div class="goal-stats">
      <span>Saved ${money(saved)} of ${money(target)}</span>
      <span class="goal-pct">${pct.toFixed(1)}%</span>
    </div>
    ${planLine}
    <div class="goal-actions">
      <button class="btn btn-small" type="button" data-action="open-contribute" data-id="${escapeHtml(goal.id)}" title="Record a deposit or withdrawal for this goal">${icon("plus", "icon-sm")} Add money</button>
      <button class="btn btn-secondary btn-small" type="button" data-action="toggle-history" data-id="${escapeHtml(goal.id)}" aria-expanded="${state.historyOpen ? "true" : "false"}" title="Show every deposit and withdrawal">History (${count})</button>
      <button class="btn btn-danger btn-small" type="button" data-action="delete-goal" data-id="${escapeHtml(goal.id)}" title="Delete this goal and its history">Delete goal</button>
    </div>
    ${state.formOpen ? contributionFormHtml(goal, state, helpers, todayISO) : ""}
    ${state.historyOpen ? historyHtml(goal, helpers) : ""}
  </div>`;
}
