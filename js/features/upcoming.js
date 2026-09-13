// Upcoming feature module. Gathers everything that is about to fall due
// (subscription renewals, debt due dates, recurring rules) into one sorted
// list for the dashboard. `computeUpcoming` is pure so it can be unit tested.

function isoToDate(iso) {
  return new Date(iso + "T00:00:00");
}

function dateToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, days) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToISO(d);
}

function daysBetween(fromISO, toISO) {
  return Math.round((isoToDate(toISO) - isoToDate(fromISO)) / 86400000);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// The next date a "day N of every month" rule falls on, starting from `today`.
// Days past the end of a month land on that month's last day (31 -> Sep 30).
function nextRecurringDate(dayOfMonth, today, monthOffset = 0) {
  const base = isoToDate(today);
  const year = base.getFullYear();
  const monthIndex = base.getMonth() + monthOffset;
  const d = new Date(year, monthIndex, 1);
  d.setDate(Math.min(dayOfMonth, daysInMonth(d.getFullYear(), d.getMonth())));
  return dateToISO(d);
}

// Mirrors the duplicate check the recurring auto-run uses when it records a rule.
function recordedOn(rule, dateISO, transactions) {
  return transactions.some((t) =>
    t.dateISO === dateISO &&
    t.categoryId === rule.categoryId &&
    t.amount === rule.amount &&
    (t.note || "") === (rule.note || "")
  );
}

import { t } from "../i18n.js?v=1"; // query must match app.js so both share one module instance
export function computeUpcoming({ subscriptions = [], debts = [], recurringRules = [], transactions = [], today, horizonDays = 14 }) {
  const horizonEnd = addDaysISO(today, horizonDays);
  const items = [];

  for (const s of subscriptions) {
    if (s.status === "cancelled") continue;
    if (!s.nextRenewal || s.nextRenewal > horizonEnd) continue;
    items.push({
      kind: "subscription",
      id: s.id,
      label: s.name || "Subscription",
      dateISO: s.nextRenewal,
      amount: s.amount || 0,
      direction: "out",
      overdue: s.nextRenewal < today,
      view: "subscriptions",
    });
  }

  for (const d of debts) {
    if (d.status === "settled") continue;
    if (!d.dueDate || d.dueDate > horizonEnd) continue;
    items.push({
      kind: "debt",
      id: d.id,
      label: d.person || "Debt",
      dateISO: d.dueDate,
      amount: d.amount || 0,
      direction: d.direction === "owed_to_me" ? "in" : "out",
      overdue: d.dueDate < today,
      view: "debts",
    });
  }

  for (const r of recurringRules) {
    const day = r.dayOfMonth || 1;
    let dateISO = nextRecurringDate(day, today);
    if (dateISO < today || recordedOn(r, dateISO, transactions)) {
      dateISO = nextRecurringDate(day, today, 1);
    }
    if (dateISO > horizonEnd) continue;
    items.push({
      kind: "recurring",
      id: r.id,
      label: r.note || r.categoryName || "Recurring",
      dateISO,
      amount: r.amount || 0,
      direction: r.type === "revenue" ? "in" : "out",
      overdue: false,
      view: "recurring",
    });
  }

  for (const item of items) item.daysFromToday = daysBetween(today, item.dateISO);

  items.sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : a.label.localeCompare(b.label)));

  const totalToPay = items.filter((i) => i.direction === "out").reduce((sum, i) => sum + i.amount, 0);
  const totalToReceive = items.filter((i) => i.direction === "in").reduce((sum, i) => sum + i.amount, 0);
  return { items, totalToPay, totalToReceive, horizonDays };
}

// Plain-language description of what kind of item a row is.
function kindLabel(item) {
  if (item.kind === "subscription") return t("Subscription renewal");
  if (item.kind === "debt") return t("Debt");
  if (item.kind === "recurring") return item.direction === "in" ? t("Recurring income") : t("Recurring bill");
  return t("Item");
}

function relativeDayText(days) {
  if (days === 0) return t("Today");
  if (days === 1) return t("Tomorrow");
  if (days === -1) return t("1 day overdue");
  if (days < 0) return t("{n} days overdue", { n: -days });
  return t("in {n} days", { n: days });
}

// Renders the dashboard "Upcoming" section from a computeUpcoming() result.
// Pure: DOM-free so it can be unit tested; helpers come from the core.
export function upcomingHtml(result, { money, escapeHtml, icon }) {
  const { items, totalToPay, totalToReceive, horizonDays = 14 } = result;
  if (items.length === 0) {
    return `<div class="muted small">${icon("check", "icon-sm")} ${t("Nothing due in the next {n} days.", { n: horizonDays })}</div>`;
  }

  const totals = `<div class="debt-summary upcoming-totals">
    <div class="debt-summary-item"><span class="debt-summary-label">${t("To pay")}</span><span class="debt-summary-value expense">${money(totalToPay)}</span></div>
    <div class="debt-summary-item"><span class="debt-summary-label">${t("To receive")}</span><span class="debt-summary-value revenue">${money(totalToReceive)}</span></div>
  </div>`;

  const rows = items.map((item) => {
    const isIn = item.direction === "in";
    const amountCls = isIn ? "revenue" : "expense";
    const sign = isIn ? "+" : "-";
    const overdueTag = item.overdue ? `<span class="upcoming-tag overdue">${t("Overdue")}</span>` : "";
    const when = relativeDayText(item.daysFromToday);
    const kind = kindLabel(item);
    const flow = isIn ? t("You receive") : t("You pay");
    return `<button type="button" class="dash-recent-item upcoming-item${item.overdue ? " overdue" : ""}" data-action="open-upcoming" data-view="${escapeHtml(item.view)}" data-id="${escapeHtml(item.id)}" title="${t("Tap to open")}">
      <span class="upcoming-when"><span class="upcoming-date">${escapeHtml(item.dateISO)}</span><span class="upcoming-relative">${escapeHtml(when)}</span></span>
      <span class="dash-tx-note"><span class="upcoming-label">${escapeHtml(item.label)}</span> <span class="upcoming-kind">${escapeHtml(kind)}</span>${overdueTag}</span>
      <span class="upcoming-amount-wrap"><span class="dash-tx-amount ${amountCls}">${sign}${money(item.amount)}</span><span class="upcoming-flow ${amountCls}">${flow}</span></span>
    </button>`;
  }).join("");

  return `${totals}<div class="dash-recent-list upcoming-list">${rows}</div>`;
}

// DOM wrapper used by the dashboard. Reads live state from the shared ctx.
export function createUpcoming(ctx) {
  const { money, escapeHtml, icon, todayISO } = ctx;

  function renderUpcoming() {
    const container = document.getElementById("dashUpcoming");
    if (!container) return;
    const result = computeUpcoming({
      subscriptions: ctx.subscriptions,
      debts: ctx.debts,
      recurringRules: ctx.recurringRules,
      transactions: ctx.transactions,
      today: todayISO(),
    });
    container.innerHTML = upcomingHtml(result, { money, escapeHtml, icon });
  }

  return { renderUpcoming };
}
