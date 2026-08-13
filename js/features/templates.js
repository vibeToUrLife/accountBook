// Quick Templates feature module. Reads/writes the form via ctx.els.
export function createTemplates(ctx) {
  const { els, money, escapeHtml, todayISO, normalizeText, parsePositiveAmount, setAppError, userCollections, firestore } = ctx;
  const { addDoc, deleteDoc, doc, serverTimestamp } = firestore;

  function renderTemplates() {
    // Chips on the Add Record screen
    if (els.templateChips && els.templateChipsWrap) {
      if (!ctx.templates.length) {
        els.templateChips.innerHTML = "";
        els.templateChipsWrap.hidden = true;
      } else {
        els.templateChipsWrap.hidden = false;
        els.templateChips.innerHTML = ctx.templates.map((t) =>
          `<button type="button" class="template-chip" data-action="apply-template" data-id="${t.id}">${escapeHtml(t.label || t.note || t.categoryName || "Template")}</button>`
        ).join("");
      }
    }

    // Management list in Settings
    if (els.templateManageList) {
      if (!ctx.templates.length) {
        els.templateManageList.innerHTML = '<div class="muted small">No templates yet.</div>';
      } else {
        els.templateManageList.innerHTML = ctx.templates.map((t) => {
          const typeLabel = t.type === "revenue" ? "Revenue" : "Expense";
          const amt = t.amount ? money(t.amount) : "";
          return `<div class="template-manage-item">
            <span class="template-manage-info">${escapeHtml(t.label || t.note || "Template")} — ${escapeHtml(t.categoryName || "(no category)")} · ${typeLabel}${amt ? " · " + amt : ""}</span>
            <button type="button" class="btn btn-danger btn-small" data-action="delete-template" data-id="${t.id}">Delete</button>
          </div>`;
        }).join("");
      }
    }
  }

  async function saveCurrentAsTemplate() {
    const categoryId = els.txCategory.value;
    const type = els.txType.value;
    const amount = parsePositiveAmount(els.txAmount.value);
    const note = normalizeText(els.txNote.value);
    const category = ctx.categories.find((c) => c.id === categoryId);
    if (!categoryId) {
      setAppError("Pick a category before saving a template.");
      return;
    }
    const label = (note || category?.name || "Template").slice(0, 40);
    const { templates: templatesCol } = userCollections(ctx.uid);
    await addDoc(templatesCol, {
      label,
      categoryId,
      categoryName: category ? category.name : "(Unknown)",
      type: type === "revenue" ? "revenue" : "expense",
      amount: amount || 0,
      note,
      createdAt: serverTimestamp(),
    });
  }

  function applyTemplate(id) {
    const t = ctx.templates.find((x) => x.id === id);
    if (!t) return;
    if (t.categoryId && ctx.categories.some((c) => c.id === t.categoryId)) {
      els.txCategory.value = t.categoryId;
    }
    els.txType.value = t.type === "revenue" ? "revenue" : "expense";
    if (els.txAmount._bankPrefill) els.txAmount._bankPrefill(t.amount || 0);
    else els.txAmount.value = t.amount ? String(t.amount) : "";
    els.txNote.value = t.note || "";
    if (!els.txDate.value) els.txDate.value = todayISO();
    els.txAmount.focus();
  }

  async function deleteTemplate(id) {
    const { templates: templatesCol } = userCollections(ctx.uid);
    await deleteDoc(doc(templatesCol, id));
  }

  return { renderTemplates, saveCurrentAsTemplate, applyTemplate, deleteTemplate };
}
