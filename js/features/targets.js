// Life Targets feature module.
// A checklist timeline of things you want to achieve (not just money) by a
// certain age. Items are sorted into a timeline by their target age; each can
// be ticked off when achieved, edited in place, or removed.
import { t as tr } from "../i18n.js?v=1"; // query must match app.js so both share one module instance
export function createTargets(ctx) {
  const { icon, escapeHtml, normalizeText, userCollections, firestore } = ctx;
  const { addDoc, deleteDoc, setDoc, doc, serverTimestamp } = firestore;

  const CURRENT_AGE_KEY = "accountBook.currentAge";

  // Id of the target being edited inline (null when nothing is being edited).
  let editingId = null;
  // In-progress edit values, preserved so a background re-render (e.g. a
  // Firestore snapshot) doesn't wipe what the user has typed.
  let editDraft = null;
  // Id of the target the draft above belongs to. Without this a draft captured
  // from one row could be replayed into a different row's edit form.
  let editDraftId = null;

  function getCurrentAge() {
    const raw = localStorage.getItem(CURRENT_AGE_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function setCurrentAge(value) {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0) {
      localStorage.removeItem(CURRENT_AGE_KEY);
    } else {
      localStorage.setItem(CURRENT_AGE_KEY, String(Math.floor(n)));
    }
    renderTargets();
  }

  function yearsLabel(n) {
    return n === 1 ? tr("1 yr") : tr("{n} yrs", { n });
  }

  function renderTargets() {
    const container = document.getElementById("targetsContainer");
    if (!container) return;

    // Preserve any in-progress edit before we rebuild the list, so a snapshot
    // arriving mid-edit doesn't discard what the user has typed. The draft is
    // tagged with the id of the row currently in the DOM, which is not always
    // editingId: when the user jumps straight to another row's Edit button,
    // editingId already points at the new row while the DOM still shows the
    // old one. Tagging keeps the old row's text from leaking into the new form.
    const liveRow = container.querySelector("[data-action='save-target']");
    const liveId = liveRow ? liveRow.dataset.id : null;
    if (liveId != null) {
      const liveText = container.querySelector("[data-edit-text]");
      const liveAge = container.querySelector("[data-edit-age]");
      if (liveText && liveAge) {
        editDraft = { text: liveText.value, age: liveAge.value };
        editDraftId = liveId;
      }
    }

    const summaryEl = document.getElementById("targetSummary");
    const list = [...ctx.targets];

    if (list.length === 0) {
      editingId = null;
      clearDraft();
      container.innerHTML =
        `<div class="muted small">${tr("No targets yet. Add something you want to achieve above!")}</div>`;
      if (summaryEl) summaryEl.textContent = "";
      return;
    }

    // If the target being edited vanished (e.g. deleted elsewhere), drop the
    // edit state so we don't render a phantom edit row.
    if (editingId != null && !list.some((t) => t.id === editingId)) {
      editingId = null;
      clearDraft();
    }

    // Sort into a timeline: earliest target age first.
    list.sort((a, b) => (a.age || 0) - (b.age || 0) || (a.text || "").localeCompare(b.text || ""));

    const currentAge = getCurrentAge();
    const doneCount = list.filter((t) => t.done).length;

    container.innerHTML = list
      .map((t) => (t.id === editingId ? renderEditRow(t) : renderRow(t, currentAge)))
      .join("");

    if (summaryEl) {
      summaryEl.textContent = tr("{done} of {total} achieved", { done: doneCount, total: list.length });
    }
  }

  function renderRow(t, currentAge) {
    const age = t.age || 0;
    const done = !!t.done;

    let when = tr("Age {age}", { age });
    let whenClass = "";
    if (done) {
      when = tr("Age {age} · Achieved", { age });
    } else if (currentAge != null) {
      const diff = age - currentAge;
      if (diff > 0) when = tr("Age {age} · in {years}", { age, years: yearsLabel(diff) });
      else if (diff === 0) { when = tr("Age {age} · this year", { age }); whenClass = "due"; }
      else { when = tr("Age {age} · {years} overdue", { age, years: yearsLabel(-diff) }); whenClass = "overdue"; }
    }

    return `<div class="target-item ${done ? "done" : ""}">
      <div class="target-node">${age}</div>
      <div class="target-body">
        <div class="target-text">${escapeHtml(t.text || tr("Untitled"))}</div>
        <div class="target-when ${whenClass}">${when}</div>
      </div>
      <div class="target-actions">
        <button class="target-check ${done ? "checked" : ""}" type="button"
          data-action="toggle-target" data-id="${t.id}"
          aria-label="${done ? tr("Mark as not achieved") : tr("Mark as achieved")}"
          title="${done ? tr("Mark as not achieved") : tr("Mark as achieved")}">
          ${done ? icon("check", "icon-sm") : ""}
        </button>
        <button class="btn btn-secondary btn-small" type="button"
          data-action="edit-target" data-id="${t.id}"
          aria-label="${tr("Edit target")}" title="${tr("Edit")}">${icon("edit", "icon-sm")}</button>
        <button class="btn btn-danger btn-small" type="button"
          data-action="delete-target" data-id="${t.id}">${tr("Delete")}</button>
      </div>
    </div>`;
  }

  function renderEditRow(t) {
    // Only reuse a draft that belongs to this target; anything else would show
    // another row's unsaved text.
    const draft =
      editDraft && editDraftId === t.id ? editDraft : { text: t.text || "", age: t.age || "" };
    return `<div class="target-item editing">
      <div class="target-node">${t.age || 0}</div>
      <div class="target-body target-edit-body">
        <input class="target-edit-input" type="text" maxlength="80" data-edit-text
          value="${escapeHtml(String(draft.text))}"
          placeholder="${tr("What do you want to achieve?")}" aria-label="${tr("Target description")}" />
        <input class="target-edit-input target-edit-age" type="number" min="1" max="120" step="1"
          data-edit-age value="${escapeHtml(String(draft.age))}"
          placeholder="${tr("Age")}" aria-label="${tr("Target age")}" />
      </div>
      <div class="target-actions">
        <button class="btn btn-small" type="button"
          data-action="save-target" data-id="${t.id}">${tr("Save")}</button>
        <button class="btn btn-secondary btn-small" type="button"
          data-action="cancel-target">${tr("Cancel")}</button>
      </div>
    </div>`;
  }

  async function addTarget() {
    const textInput = document.getElementById("targetText");
    const ageInput = document.getElementById("targetAge");
    if (!textInput || !ageInput) return;

    const text = normalizeText(textInput.value);
    const age = Math.floor(Number(ageInput.value));

    if (!text || !Number.isFinite(age) || age < 1) return;

    const { targets: targetsCol } = userCollections(ctx.uid);
    await addDoc(targetsCol, { text, age, done: false, createdAt: serverTimestamp() });

    textInput.value = "";
    ageInput.value = "";
    textInput.focus();
  }

  function clearDraft() {
    editDraft = null;
    editDraftId = null;
  }

  function focusEditInput() {
    const input = document.querySelector("#targetsContainer [data-edit-text]");
    if (input) { input.focus(); input.select(); }
  }

  // Enter edit mode for a target and focus its description field. Moving to
  // another target discards the unsaved draft of the one being left, exactly as
  // Cancel would.
  function editTarget(targetId) {
    if (!ctx.targets.some((t) => t.id === targetId)) return;
    if (editingId === targetId) { focusEditInput(); return; }
    editingId = targetId;
    clearDraft();
    renderTargets();
    focusEditInput();
  }

  // Always re-render: the edit row can still be on screen after editingId was
  // cleared, and a Cancel that did nothing would leave it stuck there.
  function cancelEditTarget() {
    editingId = null;
    clearDraft();
    renderTargets();
  }

  async function saveTarget(targetId) {
    const container = document.getElementById("targetsContainer");
    if (!container) return;
    const textInput = container.querySelector("[data-edit-text]");
    const ageInput = container.querySelector("[data-edit-age]");
    if (!textInput || !ageInput) return;

    const text = normalizeText(textInput.value);
    const age = Math.floor(Number(ageInput.value));

    // Invalid input: keep editing so the user can fix it.
    if (!text || !Number.isFinite(age) || age < 1) return;

    editingId = null;
    clearDraft();

    // Apply the change locally and redraw straight away rather than waiting for
    // the Firestore snapshot: saving without having changed anything is a no-op
    // write that raises no snapshot at all, which used to leave the row stuck in
    // edit mode with Save and Cancel looking dead.
    const local = ctx.targets.find((t) => t.id === targetId);
    if (local) { local.text = text; local.age = age; }
    renderTargets();

    const { targets: targetsCol } = userCollections(ctx.uid);
    await setDoc(doc(targetsCol, targetId), { text, age }, { merge: true });
  }

  async function toggleTarget(targetId) {
    const target = ctx.targets.find((t) => t.id === targetId);
    if (!target) return;
    const { targets: targetsCol } = userCollections(ctx.uid);
    await setDoc(doc(targetsCol, targetId), { done: !target.done }, { merge: true });
  }

  async function deleteTarget(targetId) {
    if (editingId === targetId) { editingId = null; clearDraft(); }
    const { targets: targetsCol } = userCollections(ctx.uid);
    await deleteDoc(doc(targetsCol, targetId));
  }

  return {
    renderTargets,
    addTarget,
    toggleTarget,
    deleteTarget,
    editTarget,
    cancelEditTarget,
    saveTarget,
    setCurrentAge,
    getCurrentAge,
  };
}
