// Savings Goals feature module.
export function createGoals(ctx) {
  const { money, icon, escapeHtml, normalizeText, parsePositiveAmount, userCollections, firestore } = ctx;
  const { addDoc, deleteDoc, doc, serverTimestamp } = firestore;

  function renderSavingsGoals() {
    const container = document.getElementById("goalsContainer");
    if (!container) return;

    if (ctx.savingsGoals.length === 0) {
      container.innerHTML = '<div class="muted small">No savings goals yet. Add one above!</div>';
      return;
    }

    // Total saved = revenue - expense across all time
    const totalRevenue = ctx.transactions.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0);
    const totalExpense = ctx.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalSaved = Math.max(0, totalRevenue - totalExpense);

    container.innerHTML = ctx.savingsGoals.map((g) => {
      const target = g.target || 0;
      const saved = Math.min(totalSaved, target);
      const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
      const isDone = pct >= 100;
      const deadline = g.deadline ? `Due: ${g.deadline}` : "No deadline";

      return `<div class="goal-card">
        <div class="goal-card-header">
          <h4>${icon("target", "icon-sm")} ${escapeHtml(g.name || "Untitled")}</h4>
          <span class="goal-deadline">${deadline}</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill ${isDone ? 'done' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="goal-stats">
          <span>${money(saved)} / ${money(target)}</span>
          <span class="goal-pct">${pct.toFixed(1)}%</span>
        </div>
        <div class="goal-actions">
          <button class="btn btn-danger btn-small" type="button" data-action="delete-goal" data-id="${g.id}">Delete</button>
        </div>
      </div>`;
    }).join("");
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
    await addDoc(goalsCol, { name, target, deadline, createdAt: serverTimestamp() });

    nameInput.value = "";
    targetInput.value = "";
    if (deadlineInput) deadlineInput.value = "";
  }

  async function deleteSavingsGoal(goalId) {
    const { savingsGoals: goalsCol } = userCollections(ctx.uid);
    await deleteDoc(doc(goalsCol, goalId));
  }

  return { renderSavingsGoals, addSavingsGoal, deleteSavingsGoal };
}
