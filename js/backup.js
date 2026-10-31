// Backup file (Settings → Export JSON) → clean records ready to write back.
//
// Everything in the file is untrusted: ids must look like Firestore ids,
// amounts must be positive numbers, dates YYYY-MM-DD, text is trimmed and
// length-capped, and anything else is dropped. Records keep their ids, so a
// restore keeps every record linked to its category, and importing the same
// file twice overwrites the same records instead of adding copies.
//
// Pure functions only (no DOM, no Firebase), so they can be unit-tested.

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Currency label shown before every amount: short plain text only. */
export function cleanCurrencySymbol(value) {
  return String(value ?? "").replace(/[<>&"'`\\]/g, "").trim().slice(0, 5);
}

function text(value, max) {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" && Number.isFinite(value)) return String(value).slice(0, max);
  return "";
}

function positiveAmount(value) {
  const n = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function nonNegativeAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function isoDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return "";
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? "" : value;
}

function intInRange(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

// createdAt as exported (ISO string, {seconds, nanoseconds}, or ms) → Date.
function timestamp(value) {
  let ms = NaN;
  if (typeof value === "string") ms = Date.parse(value);
  else if (typeof value === "number") ms = value;
  else if (value && typeof value === "object" && Number.isFinite(Number(value.seconds))) {
    ms = Number(value.seconds) * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1e6);
  }
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : null;
}

function tags(value) {
  const seen = new Set();
  for (const raw of list(value)) {
    const tag = text(raw, 20).toLowerCase();
    if (tag) seen.add(tag);
    if (seen.size >= 8) break;
  }
  return [...seen];
}

function monthlyBudgets(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const [key, amount] of Object.entries(value).slice(0, 600)) {
    if (MONTH_RE.test(key) && Number.isFinite(Number(amount)) && Number(amount) >= 0) {
      out[key] = Math.round(Number(amount) * 100) / 100;
    }
  }
  return Object.keys(out).length ? out : null;
}

function contributions(value, newId) {
  const out = [];
  for (const c of list(value)) {
    if (!c || typeof c !== "object") continue;
    const amount = positiveAmount(c.amount);
    const dateISO = isoDate(c.dateISO);
    if (amount == null || !dateISO) continue;
    out.push({
      id: typeof c.id === "string" && ID_RE.test(c.id) ? c.id : newId(),
      amount,
      kind: c.kind === "withdraw" ? "withdraw" : "deposit",
      dateISO,
      note: text(c.note, 200),
      createdAtISO: timestamp(c.createdAtISO)?.toISOString() || "",
    });
  }
  return out;
}

/**
 * Parse a backup into { categories, transactions, savingsGoals, targets,
 * recurringRules, debts, subscriptions, templates } — arrays of
 * { id, data, createdAt } where createdAt is a Date or null — plus
 * `currencySymbol` (string or null) and `skipped` (records left out).
 * Returns null when the file isn't a backup at all.
 * `newId()` makes an id for a record whose own id isn't usable.
 */
export function parseBackup(raw, { today, newId }) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.categories) || !Array.isArray(raw.transactions)) {
    return null;
  }
  let skipped = 0;
  const idOf = (value) => (typeof value === "string" && ID_RE.test(value) ? value : newId());

  // Category ids in the file → ids written (the same unless unusable), so
  // records point at the right category after the restore.
  const categoryIds = new Map();
  const categoryRef = (value) => {
    if (value == null || value === "") return "";
    if (categoryIds.has(String(value))) return categoryIds.get(String(value));
    return typeof value === "string" && ID_RE.test(value) ? value : "";
  };
  const record = (r, data) => ({ id: idOf(r.id), data, createdAt: timestamp(r.createdAt) });

  const categories = [];
  for (const c of list(raw.categories)) {
    const name = c && text(c.name, 50);
    if (!name) { skipped++; continue; }
    const rec = record(c, {
      name,
      budget: nonNegativeAmount(c.budget),
      budgetPeriod: ["month", "year", "lifetime"].includes(c.budgetPeriod) ? c.budgetPeriod : "month",
    });
    const months = monthlyBudgets(c.monthlyBudgets);
    if (months) rec.data.monthlyBudgets = months;
    if (c.id != null) categoryIds.set(String(c.id), rec.id);
    categories.push(rec);
  }

  const transactions = [];
  for (const t of list(raw.transactions)) {
    const amount = t && positiveAmount(t.amount);
    const categoryId = t && categoryRef(t.categoryId);
    if (amount == null || !categoryId) { skipped++; continue; }
    const note = text(t.note, 500);
    transactions.push(record(t, {
      categoryId,
      categoryName: text(t.categoryName, 50),
      type: t.type === "revenue" ? "revenue" : "expense",
      amount,
      note,
      noteLower: note.toLowerCase(),
      tags: tags(t.tags),
      dateISO: isoDate(t.dateISO) || today,
    }));
  }

  const savingsGoals = [];
  for (const g of list(raw.savingsGoals)) {
    const name = g && text(g.name, 80);
    if (!name) { skipped++; continue; }
    savingsGoals.push(record(g, {
      name,
      target: nonNegativeAmount(g.target),
      deadline: isoDate(g.deadline),
      contributions: contributions(g.contributions, newId),
    }));
  }

  const targets = [];
  for (const t of list(raw.targets)) {
    const label = t && text(t.text, 200);
    if (!label) { skipped++; continue; }
    targets.push(record(t, { text: label, age: intInRange(t.age, 0, 150, 0), done: t.done === true }));
  }

  const recurringRules = [];
  for (const r of list(raw.recurringRules)) {
    const amount = r && positiveAmount(r.amount);
    const categoryId = r && categoryRef(r.categoryId);
    if (amount == null || !categoryId) { skipped++; continue; }
    const rec = record(r, {
      categoryId,
      categoryName: text(r.categoryName, 50),
      type: r.type === "revenue" ? "revenue" : "expense",
      amount,
      note: text(r.note, 500),
      dayOfMonth: intInRange(r.dayOfMonth, 1, 31, 1),
    });
    if (isoDate(r.startISO)) rec.data.startISO = r.startISO;
    if (typeof r.lastPostedMonth === "string" && MONTH_RE.test(r.lastPostedMonth)) rec.data.lastPostedMonth = r.lastPostedMonth;
    recurringRules.push(rec);
  }

  const debts = [];
  for (const d of list(raw.debts)) {
    const person = d && text(d.person, 100);
    const amount = d && positiveAmount(d.amount);
    if (!person || amount == null) { skipped++; continue; }
    debts.push(record(d, {
      person,
      direction: d.direction === "i_owe" ? "i_owe" : "owed_to_me",
      amount,
      note: text(d.note, 500),
      dateISO: isoDate(d.dateISO) || today,
      dueDate: isoDate(d.dueDate),
      status: d.status === "settled" ? "settled" : "outstanding",
    }));
  }

  const subscriptions = [];
  for (const s of list(raw.subscriptions)) {
    const name = s && text(s.name, 80);
    const amount = s && positiveAmount(s.amount);
    if (!name || amount == null) { skipped++; continue; }
    const nextRenewal = isoDate(s.nextRenewal) || today;
    const rec = record(s, {
      name,
      categoryId: categoryRef(s.categoryId),
      categoryName: text(s.categoryName, 50),
      amount,
      cycle: s.cycle === "year" ? "year" : "month",
      nextRenewal,
      renewalDay: intInRange(s.renewalDay, 1, 31, Number(nextRenewal.slice(8, 10))),
      status: s.status === "cancelled" ? "cancelled" : "active",
    });
    if (isoDate(s.lastPaidISO)) rec.data.lastPaidISO = s.lastPaidISO;
    subscriptions.push(rec);
  }

  const templates = [];
  for (const tpl of list(raw.templates)) {
    const categoryId = tpl && categoryRef(tpl.categoryId);
    if (!categoryId) { skipped++; continue; }
    const note = text(tpl.note, 500);
    templates.push(record(tpl, {
      label: text(tpl.label, 40) || note.slice(0, 40) || text(tpl.categoryName, 40),
      categoryId,
      categoryName: text(tpl.categoryName, 50),
      type: tpl.type === "revenue" ? "revenue" : "expense",
      amount: nonNegativeAmount(tpl.amount),
      note,
    }));
  }

  const symbol = raw.settings && raw.settings.currencySymbol != null ? cleanCurrencySymbol(raw.settings.currencySymbol) : null;

  return {
    categories, transactions, savingsGoals, targets, recurringRules, debts, subscriptions, templates,
    currencySymbol: symbol,
    skipped,
  };
}

/** A record as stored in the backup file: Firestore timestamps become ISO strings. */
export function exportRecord(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value && typeof value.toDate === "function" ? value.toDate().toISOString() : value;
  }
  return out;
}
