import {
  initFirebase,
  watchAuth,
  signOutUser,
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithGooglePopup,
  userCollections,
  firestoreApi,
} from "./firebase.js";

import {
  todayISO,
  dateObjToISO,
  currentMonthValue,
  startOfWeek,
  startOfMonth,
  startOfYear,
  addDays,
  debounce,
  parsePositiveAmount,
  normalizeText,
  clamp,
  escapeHtml,
  parseTags,
  icon,
} from "./utils.js?v=6";

import { createDebts } from "./js/features/debts.js";
import { createSubscriptions } from "./js/features/subscriptions.js";
import { createGoals } from "./js/features/goals.js";
import { createTargets } from "./js/features/targets.js";
import { createTemplates } from "./js/features/templates.js";
import { createReceipts } from "./js/features/receipts.js";
import { createRecurring } from "./js/features/recurring.js";

const {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} = firestoreApi();

const els = {
  authStatus: document.getElementById("authStatus"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  configCard: document.getElementById("configCard"),
  configWarning: document.getElementById("configWarning"),

  authCard: document.getElementById("authCard"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  signUpBtn: document.getElementById("signUpBtn"),
  signInBtn: document.getElementById("signInBtn"),
  googleBtn: document.getElementById("googleBtn"),
  authError: document.getElementById("authError"),

  appContent: document.getElementById("appContent"),
  appError: document.getElementById("appError"),
  undoToast: document.getElementById("undoToast"),
  undoText: document.getElementById("undoText"),
  undoBtn: document.getElementById("undoBtn"),
  confirmToast: document.getElementById("confirmToast"),
  confirmText: document.getElementById("confirmText"),
  confirmYesBtn: document.getElementById("confirmYesBtn"),
  confirmNoBtn: document.getElementById("confirmNoBtn"),

  categoryForm: document.getElementById("categoryForm"),
  categoryName: document.getElementById("categoryName"),
  categoryBudget: document.getElementById("categoryBudget"),
  categoryPeriod: document.getElementById("categoryPeriod"),
  categoryBudgetHint: document.getElementById("categoryBudgetHint"),
  categoryTbody: document.getElementById("categoryTbody"),
  categorySubmitBtn: document.getElementById("categorySubmitBtn"),
  cancelCategoryEdit: document.getElementById("cancelCategoryEdit"),

  budgetMonth: document.getElementById("budgetMonth"),
  budgetScope: document.getElementById("budgetScope"),

  txForm: document.getElementById("txForm"),
  txCategory: document.getElementById("txCategory"),
  txType: document.getElementById("txType"),
  txAmount: document.getElementById("txAmount"),
  txNote: document.getElementById("txNote"),
  txTags: document.getElementById("txTags"),
  txDate: document.getElementById("txDate"),
  txTbody: document.getElementById("txTbody"),
  txSubmitBtn: document.getElementById("txSubmitBtn"),
  cancelTxEdit: document.getElementById("cancelTxEdit"),
  saveTemplateBtn: document.getElementById("saveTemplateBtn"),
  templateChipsWrap: document.getElementById("templateChipsWrap"),
  templateChips: document.getElementById("templateChips"),
  templateManageList: document.getElementById("templateManageList"),
  toggleBudgetAlertsBtn: document.getElementById("toggleBudgetAlertsBtn"),
  budgetAlertsStatus: document.getElementById("budgetAlertsStatus"),

  txPageInfo: document.getElementById("txPageInfo"),
  txPrevBtn: document.getElementById("txPrevBtn"),
  txNextBtn: document.getElementById("txNextBtn"),

  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  filterDateFrom: document.getElementById("filterDateFrom"),
  filterDateTo: document.getElementById("filterDateTo"),
  filterType: document.getElementById("filterType"),
  filterCategory: document.getElementById("filterCategory"),
  filterMinAmount: document.getElementById("filterMinAmount"),
  filterMaxAmount: document.getElementById("filterMaxAmount"),
  filterTag: document.getElementById("filterTag"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  filterSummary: document.getElementById("filterSummary"),
  todayBtn: document.getElementById("todayBtn"),
  noteSuggestions: document.getElementById("noteSuggestions"),
  duplicateWarning: document.getElementById("duplicateWarning"),
  quickRepeatSection: null,
  quickRepeatList: null,
  expenseTrend: document.getElementById("expenseTrend"),
  revenueTrend: document.getElementById("revenueTrend"),
  projectionRow: document.getElementById("projectionRow"),
  dailyAvgExpense: document.getElementById("dailyAvgExpense"),
  projectedExpense: document.getElementById("projectedExpense"),
  daysLeft: document.getElementById("daysLeft"),

  assistantFab: document.getElementById("assistantFab"),
  assistantPanel: document.getElementById("assistantPanel"),
  quickAddFab: document.getElementById("quickAddFab"),
  closeAssistant: document.getElementById("closeAssistant"),
  assistantChat: document.getElementById("assistantChat"),
  assistantInput: document.getElementById("assistantInput"),
  assistantMicBtn: document.getElementById("assistantMicBtn"),
  assistantSendBtn: document.getElementById("assistantSendBtn"),

  statsRange: document.getElementById("statsRange"),
  statsDateField: document.getElementById("statsDateField"),
  statsAnchorDate: document.getElementById("statsAnchorDate"),
  statsMonthField: document.getElementById("statsMonthField"),
  statsMonth: document.getElementById("statsMonth"),
  statsYearField: document.getElementById("statsYearField"),
  statsYear: document.getElementById("statsYear"),
  refreshStatsBtn: document.getElementById("refreshStatsBtn"),
  statsRangeLabel: document.getElementById("statsRangeLabel"),
  statsChart: document.getElementById("statsChart"),
  statsChartMessage: document.getElementById("statsChartMessage"),
  totalExpense: document.getElementById("totalExpense"),
  totalRevenue: document.getElementById("totalRevenue"),
  netTotal: document.getElementById("netTotal"),
  statsTbody: document.getElementById("statsTbody"),

  editTxModal: document.getElementById("editTxModal"),
  editTxForm: document.getElementById("editTxForm"),
  editTxCategory: document.getElementById("editTxCategory"),
  editTxType: document.getElementById("editTxType"),
  editTxAmount: document.getElementById("editTxAmount"),
  editTxNote: document.getElementById("editTxNote"),
  editTxTags: document.getElementById("editTxTags"),
  editTxDate: document.getElementById("editTxDate"),
  editTxSaveBtn: document.getElementById("editTxSaveBtn"),
  editTxCancelBtn: document.getElementById("editTxCancelBtn"),
  closeEditModal: document.getElementById("closeEditModal"),

  budgetRecordsModal: document.getElementById("budgetRecordsModal"),
  budgetRecordsTitle: document.getElementById("budgetRecordsTitle"),
  budgetRecordsMeta: document.getElementById("budgetRecordsMeta"),
  budgetRecordsSummary: document.getElementById("budgetRecordsSummary"),
  budgetRecordsTbody: document.getElementById("budgetRecordsTbody"),
  closeBudgetRecordsModal: document.getElementById("closeBudgetRecordsModal"),
  budgetRecordsSearch: document.getElementById("budgetRecordsSearch"),
  budgetRecordsPageInfo: document.getElementById("budgetRecordsPageInfo"),
  budgetRecordsPrevBtn: document.getElementById("budgetRecordsPrevBtn"),
  budgetRecordsNextBtn: document.getElementById("budgetRecordsNextBtn"),
  budgetRecordsDateFilter: document.getElementById("budgetRecordsDateFilter"),
  budgetRecordsClearDate: document.getElementById("budgetRecordsClearDate"),

  autoCategorySuggestion: document.getElementById("autoCategorySuggestion"),
  scanReceiptBtn: document.getElementById("scanReceiptBtn"),
  receiptModal: document.getElementById("receiptModal"),
  closeReceiptModal: document.getElementById("closeReceiptModal"),
  receiptVideo: document.getElementById("receiptVideo"),
  receiptCanvas: document.getElementById("receiptCanvas"),
  receiptPreview: document.getElementById("receiptPreview"),
  receiptCameraBtn: document.getElementById("receiptCameraBtn"),
  receiptFileInput: document.getElementById("receiptFileInput"),
  receiptCaptureBtn: document.getElementById("receiptCaptureBtn"),
  receiptStatus: document.getElementById("receiptStatus"),
  receiptResult: document.getElementById("receiptResult"),
  receiptAmountResult: document.getElementById("receiptAmountResult"),
  receiptTextResult: document.getElementById("receiptTextResult"),
  receiptApplyBtn: document.getElementById("receiptApplyBtn"),
  receiptRetryBtn: document.getElementById("receiptRetryBtn"),
  insightsContent: document.getElementById("insightsContent"),
  refreshInsightsBtn: document.getElementById("refreshInsightsBtn"),
  currencySymbolInput: document.getElementById("currencySymbolInput"),
};

let ChartJs = null;
let ChartJsRegistered = false;
let statsChartInstance = null;
let editingCategoryId = null;
let editingTransactionId = null;
let lastUsedCategoryId = null;
let openBudgetRecordsCategoryId = "";
let budgetRecordsPage = 1;
let budgetRecordsSearchTerm = "";
let budgetRecordsDateFilter = "";
const BUDGET_RECORDS_PAGE_SIZE = 10;

// User settings
let currencySymbol = "";
let savingsGoals = [];
let targets = [];
let recurringRules = [];
let templates = [];
let debts = [];
let subscriptions = [];
let unsubSettings = null;
let unsubGoals = null;
let unsubTargets = null;
let unsubRecurring = null;
let unsubTemplates = null;
let unsubDebts = null;
let unsubSubscriptions = null;

// Budget notification tracking (avoid repeat alerts in one session)
let budgetAlertsEnabled = localStorage.getItem("accountBook.budgetAlerts") === "on";
const _notifiedBudgets = new Set();

async function ensureChartJs() {
  if (ChartJs) return ChartJs;

  // Prefer global Chart if available (e.g. UMD build loaded via <script>).
  if (typeof globalThis !== "undefined" && globalThis.Chart) {
    ChartJs = globalThis.Chart;
    return ChartJs;
  }

  const urls = [
    // Chart.js ESM build (requires registering components)
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.js",
    // ESM CDN fallback
    "https://esm.sh/chart.js@4.4.1",
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const mod = await import(url);
      const Chart = mod.Chart || mod.default;
      if (!Chart) continue;
      ChartJs = Chart;

      if (!ChartJsRegistered && mod.registerables && typeof Chart.register === "function") {
        Chart.register(...mod.registerables);
        ChartJsRegistered = true;
      }

      return ChartJs;
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("Failed to load Chart.js");
}

function setStatsChartMessage(message) {
  if (!els.statsChartMessage || !els.statsChart) return;
  const msg = (message || "").trim();
  if (!msg) {
    els.statsChartMessage.hidden = true;
    els.statsChart.style.visibility = "visible";
    return;
  }

  els.statsChartMessage.textContent = msg;
  els.statsChartMessage.hidden = false;
  els.statsChart.style.visibility = "hidden";
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const THEME_KEY = "accountBook.theme";

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  try {
    localStorage.setItem(THEME_KEY, normalized);
  } catch {
    // ignore storage failures
  }

  const isDark = normalized === "dark";
  if (els.themeToggleBtn) {
    els.themeToggleBtn.setAttribute("aria-pressed", String(isDark));
    els.themeToggleBtn.innerHTML = isDark ? icon("sun") : icon("moon");
    els.themeToggleBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }

  // Update chart colors to match the theme.
  renderStats();
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    saved = null;
  }

  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }

  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function money(n) {
  const v = Number(n || 0);
  return `${currencySymbol}${v.toFixed(2)}`;
}

function budgetMonthRefDate() {
  const monthValue = els.budgetMonth.value || currentMonthValue();
  const [y, m] = monthValue.split("-").map((x) => Number(x));
  const d = new Date(y, (m || 1) - 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function budgetReferenceDateForPeriod(budgetPeriod) {
  if (budgetPeriod !== "month" && budgetPeriod !== "year") return null;

  const monthRefDate = budgetMonthRefDate();
  if (budgetPeriod === "year") {
    const yearRefDate = new Date(monthRefDate.getFullYear(), 0, 1);
    yearRefDate.setHours(0, 0, 0, 0);
    return yearRefDate;
  }

  return monthRefDate;
}

/**
 * The first month a monthly budget applies to, as a "YYYY-MM" string. Derived
 * from the earliest key in `monthlyBudgets`, i.e. the month the budget was
 * first set. Months before this predate the budget. Returns null for legacy
 * categories with no per-month map (they apply to every month, as before).
 */
function budgetStartMonthValue(category) {
  const map = category?.monthlyBudgets;
  if (!map || typeof map !== "object") return null;
  const months = Object.keys(map).filter((k) => /^\d{4}-\d{2}$/.test(k));
  if (!months.length) return null;
  return months.reduce((earliest, m) => (m < earliest ? m : earliest));
}

/**
 * Whether a category's budget applies to the month being viewed. A monthly
 * budget only applies from its start month onward: adding a budget this month
 * leaves earlier months untouched (not shown, not counted), while the current
 * and future months keep it. Yearly/lifetime budgets always apply.
 */
function isBudgetActiveForReference(category, budgetPeriod, referenceDate) {
  if ((budgetPeriod || "month") !== "month") return true;
  const start = budgetStartMonthValue(category);
  if (!start) return true;
  const ref = referenceDate || budgetMonthRefDate();
  return currentMonthValue(ref) >= start;
}

/**
 * Effective budget amount for a category in the period being viewed.
 * Monthly categories may carry per-month overrides in `monthlyBudgets`
 * (keyed "YYYY-MM"); a month with no explicit override falls back to the
 * base `budget`. Months before the budget's start month get 0 so a budget
 * added this month doesn't retroactively appear in earlier months.
 * Yearly/lifetime budgets always use the base `budget`.
 */
function effectiveBudgetFor(category, budgetPeriod, referenceDate) {
  const base = Number(category?.budget) || 0;
  if ((budgetPeriod || "month") !== "month") return base;
  const map = category?.monthlyBudgets;
  if (map && typeof map === "object") {
    const ref = referenceDate || budgetMonthRefDate();
    // Months earlier than when the budget was first set predate it.
    if (!isBudgetActiveForReference(category, "month", ref)) return 0;
    const override = map[currentMonthValue(ref)];
    if (override != null && Number.isFinite(Number(override))) return Number(override);
  }
  return base;
}

function budgetRangeForPeriod(budgetPeriod, referenceDate) {
  if (budgetPeriod === "month") {
    const ref = referenceDate || new Date();
    const start = startOfMonth(ref);
    const endExclusive = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      start,
      endExclusive,
      periodLabel: "Monthly",
      scopeLabel: currentMonthValue(start),
      rangeLabel: `${dateObjToISO(start)} → ${dateObjToISO(addDays(endExclusive, -1))}`,
    };
  }

  if (budgetPeriod === "year") {
    const ref = referenceDate || new Date();
    const start = startOfYear(ref);
    const endExclusive = new Date(start.getFullYear() + 1, 0, 1);
    return {
      start,
      endExclusive,
      periodLabel: "Yearly",
      scopeLabel: String(start.getFullYear()),
      rangeLabel: `${dateObjToISO(start)} → ${dateObjToISO(addDays(endExclusive, -1))}`,
    };
  }

  return {
    start: null,
    endExclusive: null,
    periodLabel: "Lifetime",
    scopeLabel: "All time",
    rangeLabel: "All records",
  };
}

function isTransactionInBudgetRange(tx, budgetRange) {
  if (!budgetRange.start || !budgetRange.endExclusive) return true;
  if (!tx?.dateISO) return false;

  const d = new Date(tx.dateISO);
  return d >= budgetRange.start && d < budgetRange.endExclusive;
}

function getBudgetTransactions(categoryId, budgetRange) {
  return transactions
    .filter((tx) => tx.categoryId === categoryId && isTransactionInBudgetRange(tx, budgetRange))
    .sort((a, b) => {
      const ta = a?.dateISO ? new Date(a.dateISO).getTime() : 0;
      const tb = b?.dateISO ? new Date(b.dateISO).getTime() : 0;
      return tb - ta;
    });
}

function setStatsRangeLabel(range, start, endExclusive) {
  if (!els.statsRangeLabel) return;
  const endInclusive = addDays(endExclusive, -1);
  const startISO = dateObjToISO(start);
  const endISO = dateObjToISO(endInclusive);
  const prefix = range === "week" ? "Week" : range === "month" ? "Month" : "Year";
  els.statsRangeLabel.textContent = `${prefix} range: ${startISO} → ${endISO}`;
}



async function renderStatsChart(range, start, endExclusive) {
  if (!els.statsChart) return;

  // Lazy-load chart library only when needed.
  let Chart;
  try {
    Chart = await ensureChartJs();
  } catch {
    // If the CDN is blocked, show a friendly message instead of a blank area.
    if (statsChartInstance) {
      statsChartInstance.destroy();
      statsChartInstance = null;
    }
    setStatsChartMessage("Chart couldn’t load (network/CDN blocked). Try another network or disable ad-block for this site.");
    return;
  }

  // Aggregate expenses by category
  const categoryTotals = {};
  let totalExpense = 0;

  for (const tx of transactions) {
    const d = new Date(tx.dateISO);
    if (!(d >= start && d < endExclusive)) continue;
    if (tx.type !== "expense") continue;

    const catId = tx.categoryId || "uncategorized";
    categoryTotals[catId] = (categoryTotals[catId] || 0) + tx.amount;
    totalExpense += tx.amount;
  }

  // Prepare data for Chart.js
  const labels = [];
  const dataPoints = [];
  const backgroundColors = [];

  // Helper to get category name
  const getCatName = (id) => {
    if (id === "uncategorized") return "Uncategorized";
    const c = categories.find((cat) => cat.id === id);
    if (!c) return null; // deleted category – skip
    return c.name || "Unnamed";
  };

  // Sort categories by amount desc
  const sortedCatIds = Object.keys(categoryTotals).sort(
    (a, b) => categoryTotals[b] - categoryTotals[a]
  );

  // Filter out deleted categories and zero amounts
  const validCatIds = sortedCatIds.filter((id) => {
    const name = getCatName(id);
    return name !== null && categoryTotals[id] > 0;
  });

  if (validCatIds.length === 0 || totalExpense <= 0) {
    if (statsChartInstance) {
      statsChartInstance.destroy();
      statsChartInstance = null;
    }
    setStatsChartMessage("No expense data in this range.");
    return;
  }

  // Build a palette from existing theme tokens (no new hard-coded theme colors).
  const primary = cssVar("--primary", "#6ea8fe");
  const danger = cssVar("--danger", "#ff6b6b");
  const warning = cssVar("--warning", "#ffd166");

  const withAlpha = (color, alpha) => {
    const a = Math.max(0, Math.min(1, alpha));
    if (!color) return `rgba(0,0,0,${a})`;
    const c = String(color).trim();
    if (c.startsWith("rgba(")) {
      return c.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, `rgba($1,$2,$3,${a})`);
    }
    if (c.startsWith("rgb(")) {
      return c.replace(/rgb\(([^,]+),([^,]+),([^\)]+)\)/, `rgba($1,$2,$3,${a})`);
    }
    if (c.startsWith("#") && (c.length === 7 || c.length === 4)) {
      const hex = c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return c;
  };

  const baseColors = [primary, danger, warning];
  const alphaSteps = [0.85, 0.65, 0.5, 0.35];

  validCatIds.forEach((id, index) => {
    labels.push(getCatName(id));
    dataPoints.push(Math.round(categoryTotals[id] * 100) / 100);
    const base = baseColors[index % baseColors.length];
    const alpha = alphaSteps[Math.floor(index / baseColors.length) % alphaSteps.length];
    backgroundColors.push(withAlpha(base, alpha));
  });

  const text = cssVar("--text", "rgba(255,255,255,0.92)");
  const border = cssVar("--border", "rgba(255,255,255,0.12)");

  const ctx = els.statsChart.getContext("2d");
  if (!ctx) return;

  const data = {
    labels,
    datasets: [
      {
        data: dataPoints,
        backgroundColor: backgroundColors,
        borderColor: border,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: text, padding: 12, usePointStyle: true, pointStyle: "circle" },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.parsed;
            const pct =
              totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0;
            return `${context.label}: ${money(val)} (${pct}%)`;
          },
        },
      },
    },
  };

  if (statsChartInstance) {
    statsChartInstance.destroy();
  }

  // Draw "Total <amount>" in the doughnut's center hole.
  const centerTextPlugin = {
    id: "donutCenterText",
    afterDraw(chart) {
      const { ctx: c, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      c.save();
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = text;
      c.font = "600 12px system-ui, -apple-system, sans-serif";
      c.globalAlpha = 0.7;
      c.fillText("Total", cx, cy - 11);
      c.globalAlpha = 1;
      c.font = "700 17px system-ui, -apple-system, sans-serif";
      c.fillText(money(totalExpense), cx, cy + 8);
      c.restore();
    },
  };

  try {
    statsChartInstance = new Chart(ctx, {
      type: "doughnut",
      data,
      options,
      plugins: [centerTextPlugin],
    });
    setStatsChartMessage("");
  } catch {
    statsChartInstance = null;
    setStatsChartMessage("Chart failed to render. Please refresh and try again.");
  }
}

function yearsWithRecords() {
  const set = new Set();
  for (const tx of transactions) {
    const y = Number(String(tx.dateISO || "").slice(0, 4));
    if (Number.isFinite(y)) set.add(y);
  }
  return [...set].sort((a, b) => b - a);
}

function ensureStatsYearOptions() {
  const years = yearsWithRecords();
  const prev = els.statsYear.value;
  els.statsYear.innerHTML = "";

  if (years.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No years yet";
    opt.disabled = true;
    opt.selected = true;
    els.statsYear.appendChild(opt);
    return;
  }

  for (const y of years) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    els.statsYear.appendChild(opt);
  }

  if (prev && years.includes(Number(prev))) {
    els.statsYear.value = prev;
  } else {
    els.statsYear.value = String(years[0]);
  }
}

function renderBudgetScopeLabel() {
  const monthValue = els.budgetMonth.value || currentMonthValue();
  const yearValue = String(budgetMonthRefDate().getFullYear());
  els.budgetScope.textContent = `Budget month: ${monthValue} • Yearly budgets: ${yearValue}`;
}

function setStatsInputVisibility() {
  const range = els.statsRange.value;
  els.statsDateField.hidden = range !== "week";
  els.statsMonthField.hidden = range !== "month";
  els.statsYearField.hidden = range !== "year";
}

function rangeForUi(range) {
  if (range === "week") {
    const anchorISO = els.statsAnchorDate.value || todayISO();
    const anchor = new Date(anchorISO);
    const start = startOfWeek(anchor);
    return { start, endExclusive: addDays(start, 7) };
  }

  if (range === "month") {
    const monthValue = els.statsMonth.value || currentMonthValue();
    const [y, m] = monthValue.split("-").map((x) => Number(x));
    const start = new Date(y, (m || 1) - 1, 1);
    start.setHours(0, 0, 0, 0);
    return { start, endExclusive: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
  }

  const y = Number(els.statsYear.value);
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const start = new Date(year, 0, 1);
  start.setHours(0, 0, 0, 0);
  return { start, endExclusive: new Date(year + 1, 0, 1) };
}

// In-memory state
let uid = null;
let unsubCategories = null;
let unsubTransactions = null;

/** @type {Array<{id:string,name:string,budget:number,createdAt:any}>} */
let categories = [];

/** @type {Array<{id:string,categoryId:string,categoryName:string,type:'expense'|'revenue',amount:number,note:string,dateISO:string,createdAt:any}>} */
let transactions = [];

let searchTerm = "";
let activeCategoryId = "";

// ─── Shared context for extracted feature modules ───────────────────────────
// Live getters expose the core's current state without copying; helpers + a
// firestore bag are passed by reference. Modules read ctx.* and write through
// Firestore — the core's onSnapshot listeners refresh state and re-render.
const ctx = {
  get transactions() { return transactions; },
  get categories() { return categories; },
  get debts() { return debts; },
  get subscriptions() { return subscriptions; },
  get savingsGoals() { return savingsGoals; },
  get targets() { return targets; },
  get recurringRules() { return recurringRules; },
  get templates() { return templates; },
  get uid() { return uid; },
  get currencySymbol() { return currencySymbol; },
  els,
  money,
  icon,
  escapeHtml,
  todayISO,
  normalizeText,
  parsePositiveAmount,
  clamp,
  setAppError,
  showUndoToast,
  userCollections,
  firestore: { collection, addDoc, deleteDoc, doc, getDoc, getDocs, setDoc, onSnapshot, orderBy, query, serverTimestamp },
  get refresh() { return renderAll; },
};

// Feature modules (extracted from this file incrementally)
const { renderDebts, addDebt, settleDebt, deleteDebt } = createDebts(ctx);
const { renderSubscriptions, addSubscription, paySubscription, cancelSubscription, deleteSubscription } = createSubscriptions(ctx);
const { renderSavingsGoals, addSavingsGoal, deleteSavingsGoal } = createGoals(ctx);
const { renderTargets, addTarget, toggleTarget, deleteTarget, editTarget, cancelEditTarget, saveTarget, setCurrentAge, getCurrentAge } = createTargets(ctx);
const { renderTemplates, saveCurrentAsTemplate, applyTemplate, deleteTemplate } = createTemplates(ctx);
const receipts = createReceipts(ctx);
const { queuePendingReceipts, removePendingAt, openReceiptViewer, closeReceiptViewer, addReceiptsFromViewer, deleteReceiptFromViewer, openLightbox, closeLightbox } = receipts;
const recurring = createRecurring(ctx);
const { renderRecurringRules, addRecurringRule, deleteRecurringRule, runDueRecurring } = recurring;

// Advanced Record List filters
let filters = {
  dateFrom: "",
  dateTo: "",
  type: "",
  category: "",
  minAmount: "",
  maxAmount: "",
  tag: "",
};

const TX_PAGE_SIZE = 10;
let txPage = 1;

function setWarning(text) {
  els.configWarning.textContent = text;
  els.configWarning.hidden = !text;
  if (els.configCard) els.configCard.hidden = !text;
}

function setAuthError(text) {
  els.authError.textContent = text;
  els.authError.hidden = !text;
}

function setAuthStatus(text) {
  els.authStatus.textContent = text;
}

function setAppError(text) {
  if (!els.appError) return;
  const msg = String(text || "").trim();
  els.appError.textContent = msg;
  els.appError.hidden = !msg;
}

let pendingUndo = null;
let pendingConfirm = null;

function clearUndoToast() {
  if (pendingUndo?.timer) {
    clearTimeout(pendingUndo.timer);
  }
  pendingUndo = null;
  if (els.undoToast) els.undoToast.hidden = true;
  if (els.undoText) els.undoText.textContent = "";
}

function showUndoToast({ message, onUndo }) {
  if (!els.undoToast || !els.undoText || !els.undoBtn) return;

  // Only allow one pending undo at a time.
  clearUndoToast();

  els.undoText.textContent = message;
  els.undoToast.hidden = false;

  const undoHandler = async () => {
    // Prevent double-clicking undo.
    els.undoBtn.disabled = true;
    try {
      await onUndo();
      clearUndoToast();
    } catch (e) {
      setAppError(friendlyDbError(e));
      clearUndoToast();
    } finally {
      els.undoBtn.disabled = false;
    }
  };

  pendingUndo = {
    onUndo: undoHandler,
    timer: setTimeout(() => {
      clearUndoToast();
    }, 5000),
  };

  // Replace handler each time toast is shown.
  els.undoBtn.onclick = undoHandler;
}

function clearConfirmToast() {
  if (pendingConfirm?.resolver) {
    pendingConfirm.resolver(false);
  }
  pendingConfirm = null;
  if (els.confirmToast) els.confirmToast.hidden = true;
  if (els.confirmText) els.confirmText.textContent = "";
}

function showConfirmToast(message) {
  if (!els.confirmToast || !els.confirmText || !els.confirmYesBtn || !els.confirmNoBtn) {
    return Promise.resolve(typeof window === "undefined" ? true : window.confirm(message));
  }

  clearConfirmToast();

  els.confirmText.textContent = message;
  els.confirmToast.hidden = false;
  els.confirmYesBtn.disabled = false;
  els.confirmNoBtn.disabled = false;

  return new Promise((resolve) => {
    pendingConfirm = { resolver: resolve };

    const cleanup = () => {
      if (pendingConfirm?.resolver === resolve) {
        pendingConfirm = null;
      }
      els.confirmToast.hidden = true;
      els.confirmText.textContent = "";
    };

    els.confirmYesBtn.onclick = () => {
      els.confirmYesBtn.disabled = true;
      els.confirmNoBtn.disabled = true;
      cleanup();
      resolve(true);
    };

    els.confirmNoBtn.onclick = () => {
      els.confirmYesBtn.disabled = true;
      els.confirmNoBtn.disabled = true;
      cleanup();
      resolve(false);
    };
  });
}

function stripUndefined(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const cleaned = stripUndefined(v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}

function friendlyDbError(err) {
  const code = err?.code || "";
  if (code === "permission-denied") {
    return "Permission denied by Firestore Rules. Check that you’re signed in and that your Firestore rules allow read/write for this user.";
  }
  if (code === "unauthenticated") {
    return "You’re signed out. Please sign in again.";
  }
  if (code === "unavailable") {
    return "Firestore is temporarily unavailable (network/offline). Check your connection and try again.";
  }
  if (code === "resource-exhausted") {
    return "Quota exceeded (resource exhausted). Try again later or check Firebase usage/quota.";
  }
  if (code === "not-found") {
    return "Item not found (it may have been deleted in another tab).";
  }
  return err?.message || "Operation failed.";
}

async function withDisabled(elements, fn) {
  const list = Array.isArray(elements) ? elements : [elements];
  const toggled = [];
  for (const el of list) {
    if (el && typeof el === "object" && "disabled" in el) {
      toggled.push(el);
      el.disabled = true;
    }
  }
  try {
    await fn();
  } finally {
    for (const el of toggled) el.disabled = false;
  }
}

function computeCategoryTotals(categoryId, budgetPeriod, referenceDate) {
  let spent = 0;
  let income = 0;

  const budgetRange = budgetRangeForPeriod(budgetPeriod, referenceDate);

  for (const tx of transactions) {
    if (tx.categoryId !== categoryId) continue;
    if (!isTransactionInBudgetRange(tx, budgetRange)) continue;

    if (tx.type === "expense") spent += tx.amount;
    else income += tx.amount;
  }
  return { spent, income, balance: income - spent, budgetRange };
}

function renderCategorySelect() {
  const prev = els.txCategory.value;
  els.txCategory.innerHTML = "";

  if (categories.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Add a category first";
    els.txCategory.appendChild(opt);
    els.txCategory.disabled = true;
    return;
  }

  els.txCategory.disabled = false;
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    els.txCategory.appendChild(opt);
  }

  if (prev && categories.some((c) => c.id === prev)) {
    els.txCategory.value = prev;
  } else if (lastUsedCategoryId && categories.some((c) => c.id === lastUsedCategoryId)) {
    els.txCategory.value = lastUsedCategoryId;
  }
}

function renderCategoriesTable() {
  els.categoryTbody.innerHTML = "";

  if (categories.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">No categories yet.</td>`;
    els.categoryTbody.appendChild(tr);
    return;
  }

  let renderedCount = 0;
  for (const c of categories) {
    const period = c.budgetPeriod || "month";
    const referenceDate = budgetReferenceDateForPeriod(period);
    // A monthly budget added later shouldn't appear in months before it existed.
    if (!isBudgetActiveForReference(c, period, referenceDate)) continue;
    renderedCount += 1;
    const { spent, income, balance } = computeCategoryTotals(
      c.id,
      period,
      referenceDate
    );
    const budgetAmount = effectiveBudgetFor(c, period, referenceDate);
    const effectiveBudgetBalance = budgetAmount + balance;

    const periodLabel =
      period === "month"
        ? `Monthly`
        : period === "year"
          ? `Yearly`
          : "Lifetime";

    const hasBudget = budgetAmount > 0;
    // Raw (uncapped) percentage so we can tell "fully used" (=100%) apart from "over" (>100%).
    const rawUsedPct = hasBudget ? (spent / (budgetAmount || 1)) * 100 : 0;
    const budgetUsedPct = Math.min(rawUsedPct, 100); // for the progress bar width
    const overAmount = spent - budgetAmount;
    let statusClass = 'budget-ok';
    let statusLabel = '';
    if (hasBudget && spent > 0) {
      if (rawUsedPct > 100) {
        statusClass = 'budget-over';
        statusLabel = `<span class="budget-badge over">Over by ${money(overAmount)}</span>`;
      } else if (rawUsedPct >= 100) {
        statusClass = 'budget-full';
        statusLabel = '<span class="budget-badge full">Fully used</span>';
      } else if (rawUsedPct >= 80) {
        statusClass = 'budget-warn';
        statusLabel = `<span class="budget-badge warn">${Math.round(rawUsedPct)}% used</span>`;
      }
    }

    const progressColor = rawUsedPct > 100 ? 'var(--danger)' : rawUsedPct >= 100 ? 'var(--primary-strong, var(--primary))' : rawUsedPct >= 80 ? 'var(--warning)' : 'var(--primary)';
    const pctDisplay = hasBudget ? Math.round(rawUsedPct) : 0;
    const net = income - spent;

    const tr = document.createElement("tr");
    tr.dataset.categoryId = c.id;
    tr.classList.add("clickable-row", statusClass, "budget-card-row");
    tr.tabIndex = 0;
    tr.setAttribute("aria-label", `${c.name} budget. Press Enter to view records.`);
    if (c.id === activeCategoryId) tr.classList.add("selected");

    const progressHtml = hasBudget ? `
          <div class="budget-progress-wrap">
            <div class="budget-progress-bar">
              <div class="budget-progress-fill" style="width:${Math.round(budgetUsedPct)}%;background:${progressColor}"></div>
            </div>
            <div class="budget-progress-label">${pctDisplay}%</div>
          </div>` : '';

    const statsHtml = hasBudget ? `
          <div class="budget-card-stats">
            <div class="budget-stat"><span class="budget-stat-label">Budget</span><span class="budget-stat-val">${money(budgetAmount)}</span></div>
            <div class="budget-stat"><span class="budget-stat-label">Spent</span><span class="budget-stat-val val-negative">${money(spent)}</span></div>
            <div class="budget-stat"><span class="budget-stat-label">Income</span><span class="budget-stat-val val-positive">${money(income)}</span></div>
            <div class="budget-stat"><span class="budget-stat-label">Balance</span><span class="budget-stat-val ${effectiveBudgetBalance > 0 ? 'val-positive' : effectiveBudgetBalance < 0 ? 'val-negative' : ''}">${money(effectiveBudgetBalance)}</span></div>
          </div>` : `
          <div class="budget-card-stats budget-card-stats-3">
            <div class="budget-stat"><span class="budget-stat-label">Spent</span><span class="budget-stat-val val-negative">${money(spent)}</span></div>
            <div class="budget-stat"><span class="budget-stat-label">Income</span><span class="budget-stat-val val-positive">${money(income)}</span></div>
            <div class="budget-stat"><span class="budget-stat-label">Net</span><span class="budget-stat-val ${net > 0 ? 'val-positive' : net < 0 ? 'val-negative' : ''}">${money(net)}</span></div>
          </div>`;

    tr.innerHTML = `
      <td colspan="7" class="budget-card-cell">
        <div class="budget-card-inner">
          <div class="budget-card-top">
            <div class="budget-card-name">${escapeHtml(c.name)} ${statusLabel}${!hasBudget ? '<span class="budget-badge no-limit">NO LIMIT</span>' : ''}</div>
            <div class="budget-card-period">${escapeHtml(periodLabel)}</div>
          </div>
          ${progressHtml}
          ${statsHtml}
          <div class="budget-card-hint muted small">Click card to view records in this budget.</div>
          <div class="budget-card-actions">
            <button class="btn btn-small" type="button" data-action="edit-category" data-id="${c.id}">Edit</button>
            <button class="btn btn-danger btn-small" type="button" data-action="delete-category" data-id="${c.id}">Delete</button>
          </div>
        </div>
      </td>
    `;
    els.categoryTbody.appendChild(tr);
  }

  if (renderedCount === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">No budgets for this month yet.</td>`;
    els.categoryTbody.appendChild(tr);
  }
}

// Applies the advanced Record List filters (date range, type, category, amount).
function applyAdvancedFilters(list) {
  const { dateFrom, dateTo, type, category, minAmount, maxAmount, tag } = filters;
  const min = minAmount !== "" ? parseFloat(minAmount) : null;
  const max = maxAmount !== "" ? parseFloat(maxAmount) : null;
  const tagTerm = (tag || "").trim().toLowerCase();
  return list.filter((t) => {
    if (dateFrom && t.dateISO < dateFrom) return false;
    if (dateTo && t.dateISO > dateTo) return false;
    if (type && t.type !== type) return false;
    if (category && t.categoryId !== category) return false;
    if (min !== null && !isNaN(min) && t.amount < min) return false;
    if (max !== null && !isNaN(max) && t.amount > max) return false;
    if (tagTerm && !(Array.isArray(t.tags) && t.tags.some((x) => x.includes(tagTerm)))) return false;
    return true;
  });
}

function updateFilterSummary() {
  if (!els.filterSummary) return;
  const parts = [];
  if (filters.dateFrom || filters.dateTo) {
    parts.push(`${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`);
  }
  if (filters.type) parts.push(filters.type);
  if (filters.category) {
    const cat = categories.find((c) => c.id === filters.category);
    if (cat) parts.push(cat.name);
  }
  if (filters.minAmount) parts.push(`≥ ${filters.minAmount}`);
  if (filters.maxAmount) parts.push(`≤ ${filters.maxAmount}`);
  if (filters.tag) parts.push(`#${filters.tag}`);
  els.filterSummary.textContent = parts.length ? `Active: ${parts.join(" • ")}` : "";
}

// Keeps the category filter dropdown in sync with the category list.
function renderFilterCategoryOptions() {
  if (!els.filterCategory) return;
  const current = filters.category;
  els.filterCategory.innerHTML =
    '<option value="">All</option>' +
    categories
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
  // Restore selection if the category still exists.
  if (current && categories.some((c) => c.id === current)) {
    els.filterCategory.value = current;
  } else {
    filters.category = "";
  }
}

function renderTransactionsTable() {
  /* Preserve min-height to prevent scroll jump when content changes */
  const tableWrap = els.txTbody.closest(".table-wrap");
  if (tableWrap) {
    tableWrap.style.minHeight = tableWrap.offsetHeight + "px";
  }
  els.txTbody.innerHTML = "";

  const term = searchTerm.trim().toLowerCase();
  let filtered = term
    ? transactions.filter((t) =>
        (t.note || "").toLowerCase().includes(term) ||
        (t.categoryName || "").toLowerCase().includes(term) ||
        (Array.isArray(t.tags) && t.tags.some((x) => x.includes(term)))
      )
    : transactions;

  if (activeCategoryId) {
    filtered = filtered.filter((t) => t.categoryId === activeCategoryId);
  }

  filtered = applyAdvancedFilters(filtered);
  updateFilterSummary();

  // Sort transactions by date (newest first). Work on a copy to avoid mutating the
  // original `transactions` array in-place.
  filtered = filtered.slice().sort((a, b) => {
    const ta = a && a.dateISO ? new Date(a.dateISO).getTime() : 0;
    const tb = b && b.dateISO ? new Date(b.dateISO).getTime() : 0;
    return tb - ta;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / TX_PAGE_SIZE));
  txPage = clamp(txPage, 1, totalPages);

  if (els.txPrevBtn) els.txPrevBtn.disabled = txPage <= 1;
  if (els.txNextBtn) els.txNextBtn.disabled = txPage >= totalPages;
  if (els.txPageInfo) {
    const parts = [];
    if (activeCategoryId) {
      const cat = categories.find((c) => c.id === activeCategoryId);
      parts.push(`Category: ${cat?.name || "(Unknown)"}`);
    }
    if (term) parts.push(`Search: "${term}"`);
    const prefix = parts.length ? `${parts.join(" • ")} — ` : "";

    if (total === 0) {
      els.txPageInfo.textContent = parts.length ? `${prefix}No records.` : "";
    } else {
      const start = (txPage - 1) * TX_PAGE_SIZE + 1;
      const end = Math.min(txPage * TX_PAGE_SIZE, total);
      els.txPageInfo.textContent = `${prefix}Showing ${start}-${end} of ${total} (Page ${txPage}/${totalPages})`;
    }
  }

  if (total === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="muted">No records found.</td>`;
    els.txTbody.appendChild(tr);
    if (tableWrap) requestAnimationFrame(() => { tableWrap.style.minHeight = ""; });
    return;
  }

  const startIndex = (txPage - 1) * TX_PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + TX_PAGE_SIZE);

  for (const tx of pageItems) {
    const tr = document.createElement("tr");
    const typeLabel = tx.type === "expense" ? "Expense" : "Revenue";
    const tagsHtml = Array.isArray(tx.tags) && tx.tags.length
      ? `<div class="tag-chips">${tx.tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";
    tr.innerHTML = `
      <td data-label="Date">${escapeHtml(tx.dateISO)}</td>
      <td data-label="Category">${escapeHtml(tx.categoryName || "")}</td>
      <td data-label="Type">${escapeHtml(typeLabel)}</td>
      <td class="right" data-label="Amount">${money(tx.amount)}</td>
      <td data-label="Note">${escapeHtml(tx.note || "")}${tagsHtml}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-small" type="button" data-action="receipts-tx" data-id="${tx.id}" title="Photos" aria-label="Photos">${icon("paperclip", "icon-sm")}${tx.receiptCount ? " " + tx.receiptCount : ""}</button>
          <button class="btn btn-small" type="button" data-action="edit-tx" data-id="${tx.id}">Edit</button>
          <button class="btn btn-danger btn-small" type="button" data-action="delete-tx" data-id="${tx.id}">Delete</button>
        </div>
      </td>
    `;
    els.txTbody.appendChild(tr);
  }

  /* Release min-height constraint after content is rendered */
  if (tableWrap) {
    requestAnimationFrame(() => { tableWrap.style.minHeight = ""; });
  }
}

function renderStats() {
  const range = els.statsRange.value;
  const { start, endExclusive } = rangeForUi(range);

  setStatsRangeLabel(range, start, endExclusive);
  // Chart updates async (doesn't block the rest of the UI).
  renderStatsChart(range, start, endExclusive);

  const byCategory = new Map();
  let totalExpense = 0;
  let totalRevenue = 0;

  for (const tx of transactions) {
    const d = new Date(tx.dateISO);
    if (!(d >= start && d < endExclusive)) continue;

    const entry = byCategory.get(tx.categoryId) || {
      categoryName: tx.categoryName || "(Unknown)",
      expense: 0,
      revenue: 0,
    };

    if (tx.type === "expense") {
      entry.expense += tx.amount;
      totalExpense += tx.amount;
    } else {
      entry.revenue += tx.amount;
      totalRevenue += tx.amount;
    }

    byCategory.set(tx.categoryId, entry);
  }

  els.totalExpense.textContent = money(totalExpense);
  els.totalExpense.className = 'stat-value val-negative';
  els.totalRevenue.textContent = money(totalRevenue);
  els.totalRevenue.className = 'stat-value val-positive';
  const net = totalRevenue - totalExpense;
  els.netTotal.textContent = money(net);
  els.netTotal.className = `stat-value ${net > 0 ? 'val-positive' : net < 0 ? 'val-negative' : ''}`;

  renderTrend(range, start, endExclusive);
  renderProjection(range, start, endExclusive);

  els.statsTbody.innerHTML = "";

  const rows = [...byCategory.values()].sort((a, b) => {
    const netA = a.revenue - a.expense;
    const netB = b.revenue - b.expense;
    return Math.abs(netB) - Math.abs(netA);
  });

  if (rows.length === 0) {
    els.statsTbody.innerHTML = `<div class="muted small">No records in this range.</div>`;
    return;
  }

  // Color palette for dots
  const dotColors = ["#7c5cfc", "#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#ec4899", "#8b5cf6", "#14b8a6"];

  rows.forEach((r, i) => {
    const dotColor = dotColors[i % dotColors.length];
    const netVal = r.revenue - r.expense;
    const chip = document.createElement("div");
    chip.className = "stats-cat-chip";
    chip.innerHTML = `
      <span class="cat-dot" style="background:${dotColor}"></span>
      <span class="cat-chip-name">${escapeHtml(r.categoryName)}</span>
      <span class="cat-chip-amount">${money(r.expense)}</span>
    `;
    els.statsTbody.appendChild(chip);
  });
}

let renderAllPending = false;
function renderAll() {
  if (renderAllPending) return;
  renderAllPending = true;
  queueMicrotask(() => {
    renderAllPending = false;
    renderCategorySelect();
    renderFilterCategoryOptions();
    renderCategoriesTable();
    renderTransactionsTable();
    syncBudgetRecordsModal();
    renderStats();
    updateNoteSuggestions();
    renderQuickRepeat();
    renderDashboard();
    renderSavingsGoals();
    renderTargets();
    renderRecurringRules();
  });
}

async function startListenersForUser(userId) {
  const { categories: categoriesCol, transactions: txCol, settings: settingsCol, savingsGoals: goalsCol, targets: targetsCol, recurring: recurringCol, debts: debtsCol, subscriptions: subsCol } = userCollections(userId);

  if (unsubCategories) unsubCategories();
  if (unsubTransactions) unsubTransactions();
  if (unsubSettings) unsubSettings();
  if (unsubGoals) unsubGoals();
  if (unsubTargets) unsubTargets();
  if (unsubRecurring) unsubRecurring();
  if (unsubDebts) unsubDebts();
  if (unsubSubscriptions) unsubSubscriptions();

  // Listen to user settings (currency, etc.)
  unsubSettings = onSnapshot(doc(settingsCol, "preferences"), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      currencySymbol = data.currencySymbol || "";
      if (els.currencySymbolInput) els.currencySymbolInput.value = currencySymbol;
    }
    renderAll();
  });

  // Listen to savings goals
  unsubGoals = onSnapshot(query(goalsCol, orderBy("createdAt", "asc")), (snap) => {
    savingsGoals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSavingsGoals();
  });

  // Listen to life targets
  unsubTargets = onSnapshot(query(targetsCol, orderBy("createdAt", "asc")), (snap) => {
    targets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTargets();
  });

  // Listen to debts / lending ledger
  unsubDebts = onSnapshot(query(debtsCol, orderBy("createdAt", "desc")), (snap) => {
    debts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderDebts();
  });

  // Listen to subscriptions
  unsubSubscriptions = onSnapshot(query(subsCol, orderBy("createdAt", "desc")), (snap) => {
    subscriptions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSubscriptions();
  });

  // Listen to recurring rules
  unsubRecurring = onSnapshot(query(recurringCol, orderBy("createdAt", "asc")), (snap) => {
    recurringRules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    recurring.markRecurringLoaded();
    renderRecurringRules();
    recurring.autoRun();
  });

  // Listen to quick templates
  const { templates: templatesCol } = userCollections(userId);
  if (unsubTemplates) unsubTemplates();
  unsubTemplates = onSnapshot(query(templatesCol, orderBy("createdAt", "asc")), (snap) => {
    templates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTemplates();
  });

  unsubCategories = onSnapshot(query(categoriesCol, orderBy("createdAt", "asc")), (snap) => {
    categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (activeCategoryId && !categories.some((c) => c.id === activeCategoryId)) {
      activeCategoryId = "";
      txPage = 1;
    }

    renderAll();
  });

  unsubTransactions = onSnapshot(query(txCol, orderBy("createdAt", "desc")), (snap) => {
    transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    transactions = transactions.map((t) => ({
      ...t,
      categoryName: nameById.get(t.categoryId) || t.categoryName || "(Unknown)",
    }));

    ensureStatsYearOptions();
    renderBudgetScopeLabel();
    renderAll();
    recurring.markTransactionsLoaded();
    recurring.autoRun();
  });
}

function stopListeners() {
  if (unsubCategories) unsubCategories();
  if (unsubTransactions) unsubTransactions();
  if (unsubSettings) unsubSettings();
  if (unsubGoals) unsubGoals();
  if (unsubTargets) unsubTargets();
  if (unsubRecurring) unsubRecurring();
  if (unsubTemplates) unsubTemplates();
  if (unsubDebts) unsubDebts();
  if (unsubSubscriptions) unsubSubscriptions();
  unsubCategories = null;
  unsubTransactions = null;
  unsubSettings = null;
  unsubGoals = null;
  unsubTargets = null;
  unsubRecurring = null;
  unsubTemplates = null;
  unsubDebts = null;
  unsubSubscriptions = null;
}

function setSignedOutUi() {
  uid = null;
  stopListeners();
  categories = [];
  transactions = [];
  savingsGoals = [];
  targets = [];
  recurringRules = [];
  templates = [];
  debts = [];
  subscriptions = [];
  currencySymbol = "";
  recurring.reset();
  activeCategoryId = "";
  txPage = 1;
  setAppError("");
  clearUndoToast();
  clearConfirmToast();
  ensureStatsYearOptions();
  renderBudgetScopeLabel();
  els.appContent.hidden = true;
  els.authCard.hidden = false;
  els.signOutBtn.disabled = true;
  if (els.assistantFab) els.assistantFab.hidden = true;
  if (els.assistantPanel) els.assistantPanel.hidden = true;
  if (els.quickAddFab) els.quickAddFab.hidden = true;
  syncFabLayout();
}

/**
 * Keep the two floating action buttons from overlapping. The Quick-Add FAB
 * normally stacks above the assistant FAB; it only drops to the bottom slot
 * (".solo") when the assistant FAB is actually hidden.
 */
function syncFabLayout() {
  if (!els.quickAddFab) return;
  const assistantVisible = !!(els.assistantFab && !els.assistantFab.hidden);
  els.quickAddFab.classList.toggle("solo", !assistantVisible);
}

async function setSignedInUi(user) {
  uid = user.uid;
  els.authCard.hidden = true;
  els.appContent.hidden = false;
  els.signOutBtn.disabled = false;
  if (els.assistantFab) els.assistantFab.hidden = false;
  if (els.quickAddFab) els.quickAddFab.hidden = false;
  syncFabLayout();
  setAuthError("");
  setAppError("");
  await startListenersForUser(uid);
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  const msg = String(err?.message || "").toLowerCase();
  if (code === "auth/invalid-credential") return "Wrong email or password.";
  if (code === "auth/user-not-found") return "No account found for this email.";
  if (code === "auth/wrong-password") return "Wrong email or password.";
  if (code === "auth/email-already-in-use") return "Email already in use. Try signing in.";
  if (code === "auth/weak-password") return "Password is too weak (min 6 characters).";
  if (code === "auth/popup-closed-by-user") return "Google sign-in popup was closed.";
  if (code === "auth/popup-blocked") return "Google sign-in popup was blocked by the browser. Try again or use a normal browser (Chrome/Safari).";
  if (code === "auth/operation-not-supported-in-this-environment") {
    return "Google sign-in is not supported in this browser (common in in-app browsers). Open the site in Chrome/Safari and try again.";
  }
  if (code === "auth/network-request-failed") {
    return "Network request failed. Check your connection, disable VPN/ad blocker, and try again. On mobile, open the site in Chrome/Safari (not an in-app browser) and make sure cookies are allowed.";
  }
  if (msg.includes("requested action is invalid")) {
    return "Google sign-in failed in this mobile browser. Try opening the site in Chrome/Safari (not an in-app browser), and confirm your domain is added to Firebase Auth → Authorized domains.";
  }
  if (code === "auth/unauthorized-domain") {
    const host = typeof window !== "undefined" ? window.location.host : "";
    const suffix = host ? ` Add this domain in Firebase Console → Authentication → Settings → Authorized domains: ${host}` : " Add your site domain in Firebase Console → Authentication → Settings → Authorized domains.";
    return `This domain is not authorized in Firebase Auth.${suffix}`;
  }
  return err?.message || "Sign-in failed.";
}

async function withAuthButtonsDisabled(fn) {
  els.signUpBtn.disabled = true;
  els.signInBtn.disabled = true;
  els.googleBtn.disabled = true;
  try {
    await fn();
  } finally {
    els.signUpBtn.disabled = false;
    els.signInBtn.disabled = false;
    els.googleBtn.disabled = false;
  }
}

async function addCategory() {
  const name = normalizeText(els.categoryName.value);
  const budget = Number(els.categoryBudget.value);
  const budgetPeriod = els.categoryPeriod.value;

  if (!name) return;
  if (!Number.isFinite(budget) || budget < 0) return;
  if (!["month", "year", "lifetime"].includes(budgetPeriod)) return;

  const { categories: categoriesCol } = userCollections(uid);

  const roundedBudget = Math.round(budget * 100) / 100;
  const docData = {
    name,
    budget: roundedBudget,
    budgetPeriod,
    createdAt: serverTimestamp(),
  };
  // Monthly budgets are stored per-month so history is preserved: the amount
  // entered applies to the currently-selected Budget month.
  if (budgetPeriod === "month") {
    const monthValue = els.budgetMonth.value || currentMonthValue();
    docData.monthlyBudgets = { [monthValue]: roundedBudget };
  }
  await addDoc(categoriesCol, docData);

  els.categoryName.value = "";
  els.categoryBudget.value = "";
  els.categoryName.focus();
}

async function updateCategory() {
  if (!editingCategoryId) return;
  const name = normalizeText(els.categoryName.value);
  const budget = Number(els.categoryBudget.value);
  const budgetPeriod = els.categoryPeriod.value;
  if (!name) return;
  if (!Number.isFinite(budget) || budget < 0) return;
  if (!["month", "year", "lifetime"].includes(budgetPeriod)) return;

  const { categories: categoriesCol } = userCollections(uid);
  const roundedBudget = Math.round(budget * 100) / 100;
  const patch = {
    name,
    budget: roundedBudget,
    budgetPeriod,
    updatedAt: serverTimestamp(),
  };
  // Store the amount as this month's override. `merge: true` deep-merges the
  // map, so other months' saved budgets are left untouched.
  if (budgetPeriod === "month") {
    const monthValue = els.budgetMonth.value || currentMonthValue();
    patch.monthlyBudgets = { [monthValue]: roundedBudget };
  }
  await setDoc(doc(categoriesCol, editingCategoryId), patch, { merge: true });

  // Reset edit state
  cancelCategoryEdit();
}

function startCategoryEdit(id) {
  const c = categories.find((x) => x.id === id);
  if (!c) return;
  editingCategoryId = id;
  const period = c.budgetPeriod || "month";
  els.categoryName.value = c.name || "";
  // Prefill with the budget effective for the currently-selected month, so
  // editing a monthly category reflects that specific month's amount.
  const eff = effectiveBudgetFor(c, period, budgetReferenceDateForPeriod(period));
  els.categoryBudget.value = eff ? String(eff) : "";
  els.categoryPeriod.value = period;
  if (els.categorySubmitBtn) els.categorySubmitBtn.textContent = "Save";
  if (els.cancelCategoryEdit) els.cancelCategoryEdit.hidden = false;
  updateCategoryBudgetHint();
  els.categoryName.focus();
}

function cancelCategoryEdit() {
  editingCategoryId = null;
  els.categoryForm.reset();
  if (els.categorySubmitBtn) els.categorySubmitBtn.textContent = "Add category";
  if (els.cancelCategoryEdit) els.cancelCategoryEdit.hidden = true;
  updateCategoryBudgetHint();
}

/** Shows which month/period the Budget input currently applies to. */
function updateCategoryBudgetHint() {
  if (!els.categoryBudgetHint) return;
  const period = els.categoryPeriod ? els.categoryPeriod.value : "month";
  if (period === "month") {
    const monthValue = els.budgetMonth.value || currentMonthValue();
    els.categoryBudgetHint.textContent =
      `Budget applies to ${monthValue}. Change “Budget month” below to set a different amount for another month.`;
  } else if (period === "year") {
    els.categoryBudgetHint.textContent = "Yearly budget applies to the whole year.";
  } else {
    els.categoryBudgetHint.textContent = "Lifetime budget applies across all records.";
  }
}

/** When editing a monthly category, reload the Budget input for the selected month. */
function refreshEditingBudgetField() {
  if (!editingCategoryId) return;
  if (!els.categoryPeriod || els.categoryPeriod.value !== "month") return;
  const c = categories.find((x) => x.id === editingCategoryId);
  if (!c) return;
  const eff = effectiveBudgetFor(c, "month", budgetMonthRefDate());
  els.categoryBudget.value = eff ? String(eff) : "";
}

async function deleteCategoryById(categoryId) {
  // Only delete the category doc (does not delete old transactions).
  const { categories: categoriesCol } = userCollections(uid);
  await deleteDoc(doc(categoriesCol, categoryId));
}

async function addTransaction() {
  const categoryId = els.txCategory.value;
  const type = els.txType.value;
  const amount = parsePositiveAmount(els.txAmount.value);
  const note = normalizeText(els.txNote.value);
  const tags = parseTags(els.txTags ? els.txTags.value : "");
  const dateISO = els.txDate.value;

  if (!categoryId) return;
  if (type !== "expense" && type !== "revenue") return;
  if (amount == null) return;
  if (!dateISO) return;

  const category = categories.find((c) => c.id === categoryId);
  const categoryName = category ? category.name : "(Unknown)";

  const { transactions: txCol } = userCollections(uid);

  const queuedCount = receipts.pendingCount();
  const ref = await addDoc(txCol, {
    categoryId,
    categoryName,
    type,
    amount,
    note,
    noteLower: note.toLowerCase(),
    tags,
    dateISO,
    receiptCount: queuedCount,
    createdAt: serverTimestamp(),
  });

  await receipts.flushPendingTo(ref.id);

  lastUsedCategoryId = categoryId;
  if (els.txAmount._bankPrefill) els.txAmount._bankPrefill(0);
  else els.txAmount.value = "";
  els.txNote.value = "";
  if (els.txTags) els.txTags.value = "";
  if (els.duplicateWarning) els.duplicateWarning.hidden = true;
  els.txAmount.focus();
}

async function updateTransaction() {
  if (!editingTransactionId) return;
  const categoryId = els.txCategory.value;
  const type = els.txType.value;
  const amount = parsePositiveAmount(els.txAmount.value);
  const note = normalizeText(els.txNote.value);
  const tags = parseTags(els.txTags ? els.txTags.value : "");
  const dateISO = els.txDate.value;

  if (!categoryId) return;
  if (type !== "expense" && type !== "revenue") return;
  if (amount == null) return;
  if (!dateISO) return;

  const category = categories.find((c) => c.id === categoryId);
  const categoryName = category ? category.name : "(Unknown)";
  const { transactions: txCol } = userCollections(uid);

  await setDoc(doc(txCol, editingTransactionId), {
    categoryId,
    categoryName,
    type,
    amount,
    note,
    noteLower: note.toLowerCase(),
    tags,
    dateISO,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  cancelTxEdit();
  txPage = 1;
}

function openEditModal(id) {
  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;
  editingTransactionId = id;

  // Populate modal category dropdown
  els.editTxCategory.innerHTML = "";
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    els.editTxCategory.appendChild(opt);
  }

  els.editTxCategory.value = tx.categoryId || "";
  els.editTxType.value = tx.type || "expense";
  if (els.editTxAmount._bankPrefill) els.editTxAmount._bankPrefill(tx.amount);
  else els.editTxAmount.value = tx.amount != null ? String(tx.amount) : "";
  els.editTxNote.value = tx.note || "";
  if (els.editTxTags) els.editTxTags.value = Array.isArray(tx.tags) ? tx.tags.join(", ") : "";
  els.editTxDate.value = tx.dateISO || todayISO();

  els.editTxModal.hidden = false;
  els.editTxAmount.focus();
}

function closeEditModal() {
  els.editTxModal.hidden = true;
  editingTransactionId = null;
  els.editTxForm.reset();
}

function renderBudgetRecordsModal(category) {
  if (
    !els.budgetRecordsTitle ||
    !els.budgetRecordsMeta ||
    !els.budgetRecordsSummary ||
    !els.budgetRecordsTbody
  ) {
    return;
  }

  const period = category.budgetPeriod || "month";
  const referenceDate = budgetReferenceDateForPeriod(period);
  const { spent, income, balance, budgetRange } = computeCategoryTotals(
    category.id,
    period,
    referenceDate
  );
  const budgetAmount = effectiveBudgetFor(category, period, referenceDate);
  const effectiveBudgetBalance = budgetAmount + balance;
  const allBudgetTransactions = getBudgetTransactions(category.id, budgetRange);
  const recordLabel = allBudgetTransactions.length === 1 ? "1 record" : `${allBudgetTransactions.length} records`;
  const hasBudget = budgetAmount > 0;
  const summaryValue = hasBudget ? effectiveBudgetBalance : balance;
  const summaryItems = [
    {
      label: "Budget",
      value: hasBudget ? money(budgetAmount) : "No limit",
      className: "",
    },
    {
      label: "Spent",
      value: money(spent),
      className: "val-negative",
    },
    {
      label: "Income",
      value: money(income),
      className: "val-positive",
    },
    {
      label: hasBudget ? "Balance" : "Net",
      value: money(summaryValue),
      className: summaryValue > 0 ? "val-positive" : summaryValue < 0 ? "val-negative" : "",
    },
  ];

  els.budgetRecordsTitle.textContent = `${category.name} Records`;
  els.budgetRecordsMeta.textContent = `${budgetRange.periodLabel} • ${budgetRange.rangeLabel} • ${recordLabel}`;
  els.budgetRecordsSummary.innerHTML = `
    <div class="budget-card-stats">
      ${summaryItems
        .map(
          (item) => `
            <div class="budget-stat budget-records-stat">
              <span class="budget-stat-label">${escapeHtml(item.label)}</span>
              <span class="budget-stat-val ${item.className}">${escapeHtml(item.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  // Filter by search term and date
  const term = budgetRecordsSearchTerm.toLowerCase();
  const dateFilter = budgetRecordsDateFilter;
  const filtered = allBudgetTransactions.filter((tx) => {
    if (term) {
      const note = (tx.note || "").toLowerCase();
      const date = (tx.dateISO || "").toLowerCase();
      if (!note.includes(term) && !date.includes(term)) return false;
    }
    if (dateFilter && tx.dateISO !== dateFilter) return false;
    return true;
  });

  // Pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / BUDGET_RECORDS_PAGE_SIZE));
  budgetRecordsPage = clamp(budgetRecordsPage, 1, totalPages);

  if (els.budgetRecordsPrevBtn) els.budgetRecordsPrevBtn.disabled = budgetRecordsPage <= 1;
  if (els.budgetRecordsNextBtn) els.budgetRecordsNextBtn.disabled = budgetRecordsPage >= totalPages;
  if (els.budgetRecordsPageInfo) {
    if (total === 0) {
      const hint = term || dateFilter ? "No matching records." : "";
      els.budgetRecordsPageInfo.textContent = hint;
    } else {
      const start = (budgetRecordsPage - 1) * BUDGET_RECORDS_PAGE_SIZE + 1;
      const end = Math.min(budgetRecordsPage * BUDGET_RECORDS_PAGE_SIZE, total);
      const filters = [];
      if (term) filters.push(`"${budgetRecordsSearchTerm}"`);
      if (dateFilter) filters.push(dateFilter);
      const filterInfo = filters.length ? ` • Filter: ${filters.join(", ")}` : "";
      els.budgetRecordsPageInfo.textContent = `Showing ${start}-${end} of ${total} (Page ${budgetRecordsPage}/${totalPages})${filterInfo}`;
    }
  }

  els.budgetRecordsTbody.innerHTML = "";

  if (total === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">${term || dateFilter ? "No matching records." : "No records in this budget range yet."}</td>`;
    els.budgetRecordsTbody.appendChild(tr);
    return;
  }

  const startIndex = (budgetRecordsPage - 1) * BUDGET_RECORDS_PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + BUDGET_RECORDS_PAGE_SIZE);

  for (const tx of pageItems) {
    const tr = document.createElement("tr");
    const typeLabel = tx.type === "expense" ? "Expense" : "Revenue";
    const amountClass = tx.type === "expense" ? "val-negative" : "val-positive";

    tr.innerHTML = `
      <td data-label="Date">${escapeHtml(tx.dateISO || "")}</td>
      <td data-label="Type">${escapeHtml(typeLabel)}</td>
      <td class="right ${amountClass}" data-label="Amount">${escapeHtml(money(tx.amount))}</td>
      <td data-label="Note">${escapeHtml(tx.note || "")}</td>
    `;
    els.budgetRecordsTbody.appendChild(tr);
  }
}

function openBudgetRecordsModal(categoryId) {
  if (!els.budgetRecordsModal) return;

  const category = categories.find((c) => c.id === categoryId);
  if (!category) return;

  openBudgetRecordsCategoryId = categoryId;
  budgetRecordsPage = 1;
  budgetRecordsSearchTerm = "";
  budgetRecordsDateFilter = "";
  if (els.budgetRecordsSearch) els.budgetRecordsSearch.value = "";
  if (els.budgetRecordsDateFilter) els.budgetRecordsDateFilter.value = "";
  renderBudgetRecordsModal(category);
  els.budgetRecordsModal.hidden = false;
}

function closeBudgetRecordsModal() {
  if (els.budgetRecordsModal) els.budgetRecordsModal.hidden = true;
  openBudgetRecordsCategoryId = "";
  budgetRecordsSearchTerm = "";
  budgetRecordsDateFilter = "";
  budgetRecordsPage = 1;
  if (els.budgetRecordsSearch) els.budgetRecordsSearch.value = "";
  if (els.budgetRecordsDateFilter) els.budgetRecordsDateFilter.value = "";
}

function syncBudgetRecordsModal() {
  if (!els.budgetRecordsModal || els.budgetRecordsModal.hidden || !openBudgetRecordsCategoryId) return;

  const category = categories.find((c) => c.id === openBudgetRecordsCategoryId);
  if (!category) {
    closeBudgetRecordsModal();
    return;
  }

  renderBudgetRecordsModal(category);
}

async function saveEditModal() {
  if (!editingTransactionId) return;
  const categoryId = els.editTxCategory.value;
  const type = els.editTxType.value;
  const amount = parsePositiveAmount(els.editTxAmount.value);
  const note = normalizeText(els.editTxNote.value);
  const tags = parseTags(els.editTxTags ? els.editTxTags.value : "");
  const dateISO = els.editTxDate.value;

  if (!categoryId || !dateISO || amount == null) return;
  if (type !== "expense" && type !== "revenue") return;

  const category = categories.find((c) => c.id === categoryId);
  const categoryName = category ? category.name : "(Unknown)";
  const { transactions: txCol } = userCollections(uid);

  await setDoc(doc(txCol, editingTransactionId), {
    categoryId,
    categoryName,
    type,
    amount,
    note,
    noteLower: note.toLowerCase(),
    tags,
    dateISO,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  closeEditModal();
}

function cancelTxEdit() {
  editingTransactionId = null;
  els.txForm.reset();
  if (els.txSubmitBtn) els.txSubmitBtn.textContent = "Record";
  if (els.cancelTxEdit) els.cancelTxEdit.hidden = true;
}

async function deleteTransactionById(txId) {
  const { transactions: txCol } = userCollections(uid);
  // Remove attached receipt photos first (subcollections aren't auto-deleted).
  try {
    await receipts.deleteAllForTx(txId);
  } catch { /* ignore */ }
  await deleteDoc(doc(txCol, txId));
}

function updateNoteSuggestions() {
  if (!els.noteSuggestions) return;
  const seen = new Set();
  const opts = [];
  // Most recent transactions first, take unique notes (max 50)
  for (const tx of transactions) {
    const n = (tx.note || "").trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    opts.push(n);
    if (opts.length >= 50) break;
  }
  els.noteSuggestions.innerHTML = "";
  for (const text of opts) {
    const opt = document.createElement("option");
    opt.value = text;
    els.noteSuggestions.appendChild(opt);
  }
}

function renderQuickRepeat() {
  /* Quick repeat removed */
  return;
}

function computeTrend(range, start, endExclusive) {
  // Calculate the previous period of same length
  const durationMs = endExclusive.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = start;

  let curExp = 0, curRev = 0, prevExp = 0, prevRev = 0;
  for (const tx of transactions) {
    const d = new Date(tx.dateISO);
    if (d >= start && d < endExclusive) {
      if (tx.type === "expense") curExp += tx.amount;
      else curRev += tx.amount;
    } else if (d >= prevStart && d < prevEnd) {
      if (tx.type === "expense") prevExp += tx.amount;
      else prevRev += tx.amount;
    }
  }
  return { curExp, curRev, prevExp, prevRev };
}

function renderTrend(range, start, endExclusive) {
  if (!els.expenseTrend || !els.revenueTrend) return;
  const { curExp, curRev, prevExp, prevRev } = computeTrend(range, start, endExclusive);

  const formatTrend = (cur, prev) => {
    if (prev === 0 && cur === 0) return { text: "", cls: "" };
    if (prev === 0) return { text: "↑ new", cls: "trend-up" };
    const pct = ((cur - prev) / prev) * 100;
    const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
    return {
      text: `${arrow} ${Math.abs(pct).toFixed(0)}% vs prev`,
      cls: pct > 0 ? "trend-up" : pct < 0 ? "trend-down" : "",
    };
  };

  const expT = formatTrend(curExp, prevExp);
  els.expenseTrend.textContent = expT.text;
  els.expenseTrend.className = `trend-label muted small ${expT.cls}`;

  // For revenue, up is good (flip colors)
  const revT = formatTrend(curRev, prevRev);
  els.revenueTrend.textContent = revT.text;
  els.revenueTrend.className = `trend-label muted small ${revT.cls === "trend-up" ? "trend-down" : revT.cls === "trend-down" ? "trend-up" : ""}`;
}

function renderProjection(range, start, endExclusive) {
  if (!els.projectionRow) return;
  // Only show projection for monthly range and current month
  if (range !== "month") {
    els.projectionRow.hidden = true;
    return;
  }
  const now = new Date();
  const isCurrentMonth = start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
  if (!isCurrentMonth) {
    els.projectionRow.hidden = true;
    return;
  }
  els.projectionRow.hidden = false;

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remaining = daysInMonth - dayOfMonth;

  let totalExp = 0;
  for (const tx of transactions) {
    const d = new Date(tx.dateISO);
    if (d >= start && d < endExclusive && tx.type === "expense") {
      totalExp += tx.amount;
    }
  }

  const dailyAvg = dayOfMonth > 0 ? totalExp / dayOfMonth : 0;
  const projected = totalExp + dailyAvg * remaining;

  if (els.dailyAvgExpense) els.dailyAvgExpense.textContent = money(dailyAvg);
  if (els.projectedExpense) els.projectedExpense.textContent = `~${money(projected)}`;
  if (els.daysLeft) els.daysLeft.textContent = `${remaining} days`;
}

/* =============================================
   BILINGUAL NLP ASSISTANT ENGINE
   Chinese + English + Mixed (Manglish)
   ============================================= */

// --- Chinese number parser ---
function parseChinese(text) {
  const digits = { 零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9 };
  const units = { 十:10,百:100,千:1000,万:10000,亿:100000000 };

  // Simple shorthand like "两百五" = 250, "一百二" = 120
  let s = text.replace(/块|元|令吉|ringgit/gi, "").trim();
  if (!s) return NaN;

  // If it's already a plain number, return it
  const plain = parseFloat(s);
  if (!isNaN(plain) && /^[\d.]+$/.test(s)) return plain;

  // Mixed: "18块" already stripped to "18"
  const mixed = parseFloat(s);
  if (!isNaN(mixed) && /^\d/.test(s)) return mixed;

  let result = 0;
  let current = 0;
  let lastUnit = 1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (digits[ch] !== undefined) {
      current = digits[ch];
    } else if (units[ch] !== undefined) {
      const u = units[ch];
      if (u >= 10000) {
        result = (result + (current || 1)) * u;
        current = 0;
        lastUnit = u;
      } else {
        if (current === 0 && u === 10 && result === 0) current = 1;
        result += (current || 1) * u;
        current = 0;
        lastUnit = u;
      }
    }
  }

  // Trailing digit shorthand: "两百五" → current=5, lastUnit=100 → 5 * 10 = 50
  if (current > 0) {
    if (lastUnit >= 100 && current < 10) {
      result += current * (lastUnit / 10);
    } else {
      result += current;
    }
  }

  return result || NaN;
}

function extractAmount(text) {
  // Try patterns: "18.5", "RM18.5", "$18.5", "18块5", "18.5块"
  const rmMatch = text.match(/(?:rm|RM|MYR|myr)\s*([\d,.]+)/);
  if (rmMatch) return parseFloat(rmMatch[1].replace(/,/g, ""));

  const numMatch = text.match(/([\d]+\.[\d]+|[\d]+)/);
  const chineseAmount = parseChinese(text);

  if (numMatch && !isNaN(chineseAmount)) {
    // Prefer the explicitly parsed number
    return Math.max(parseFloat(numMatch[0]), chineseAmount) || parseFloat(numMatch[0]);
  }
  if (numMatch) return parseFloat(numMatch[0]);
  if (!isNaN(chineseAmount) && chineseAmount > 0) return chineseAmount;
  return null;
}

// --- Category mapping ---
const CATEGORY_MAP = [
  // Food
  { keys: ["food","eat","meal","makan","lunch","dinner","breakfast","吃","饭","餐","鸡饭","chicken rice","nasi","面","mee","粉","饮料","drink","kopi","coffee","tea","茶","奶茶","boba","snack","零食","外卖","takeaway","bento","便当","burger","pizza","sushi","火锅","hotpot","bakery","面包","蛋糕","cake","supper","宵夜"], cat: "food" },
  // Fuel / Transport
  { keys: ["fuel","gas","petrol","diesel","油","打油","加油","transport","grab","taxi","uber","parking","停车","toll","过路费","bus","train","火车","巴士","地铁","mrt","lrt"], cat: "fuel" },
  // Shopping
  { keys: ["shop","shopping","购物","买","buy","bought","淘宝","taobao","shopee","lazada","amazon","mall","商场"], cat: "shopping" },
  // Daily / Groceries
  { keys: ["grocery","groceries","daily","日常","杂货","超市","supermarket","market","菜","蔬菜","水果","fruit"], cat: "daily" },
  // Entertainment
  { keys: ["entertainment","movie","电影","game","游戏","karaoke","ktv","concert","演唱会","bar","pub","club","娱乐"], cat: "entertainment" },
  // Bills / Utilities
  { keys: ["bill","utility","utilities","电费","水费","网费","电话费","phone","internet","wifi","subscription","订阅","netflix","spotify"], cat: "bills" },
  // Rental / Housing
  { keys: ["rent","rental","房租","住房","housing","mortgage","贷款"], cat: "rental" },
  // Health / Medical
  { keys: ["health","medical","doctor","hospital","药","medicine","clinic","诊所","医院","牙","dental"], cat: "health" },
  // Education
  { keys: ["education","school","学费","tuition","book","书","course","课程","学习"], cat: "education" },
  // Salary / Income
  { keys: ["salary","工资","薪水","income","收入","bonus","奖金","freelance","兼职","dividend","利息","interest"], cat: "salary" },
];

function detectCategory(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const group of CATEGORY_MAP) {
    for (const key of group.keys) {
      if (lower.includes(key) && key.length > bestScore) {
        best = group.cat;
        bestScore = key.length;
      }
    }
  }
  return best;
}

// --- Item name extraction ---
const ITEM_MAP = {
  "鸡饭": "chicken rice", "chicken rice": "chicken rice",
  "nasi lemak": "nasi lemak", "nasi goreng": "nasi goreng",
  "炒饭": "fried rice", "fried rice": "fried rice",
  "面": "noodle", "mee": "noodle", "noodle": "noodle",
  "粉": "noodle",
  "kopi": "coffee", "咖啡": "coffee", "coffee": "coffee",
  "奶茶": "milk tea", "boba": "boba tea",
  "茶": "tea", "tea": "tea",
  "burger": "burger", "汉堡": "burger",
  "pizza": "pizza", "披萨": "pizza",
  "sushi": "sushi", "寿司": "sushi",
  "便当": "bento", "bento": "bento",
  "面包": "bread", "bread": "bread",
  "蛋糕": "cake", "cake": "cake",
  "打油": "fuel", "加油": "fuel", "petrol": "fuel", "fuel": "fuel",
  "parking": "parking", "停车": "parking",
  "lotus": "lotus", "莲花": "lotus",
};

function detectItemName(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const [key, val] of Object.entries(ITEM_MAP)) {
    if (lower.includes(key) && key.length > bestLen) {
      best = val;
      bestLen = key.length;
    }
  }
  return best;
}

// --- Date extraction ---
function extractDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  if (/今天|today|今日/.test(lower)) return todayISO();
  if (/昨天|yesterday|昨日/.test(lower)) return dateObjToISO(addDays(now, -1));
  if (/前天|day before/.test(lower)) return dateObjToISO(addDays(now, -2));

  // "2月26" or "2/26" or "02-26"
  const dateMatch = lower.match(/(\d{1,2})[月/\-](\d{1,2})/);
  if (dateMatch) {
    const m = parseInt(dateMatch[1]);
    const d = parseInt(dateMatch[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${now.getFullYear()}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null; // Will default to today
}

// --- Month extraction ---
function extractMonth(text) {
  const lower = text.toLowerCase();

  if (/这个月|this month|本月|当月/.test(lower)) return "current";
  if (/上个月|last month|上月/.test(lower)) return "last";

  const mMatch = lower.match(/(\d{1,2})\s*月/);
  if (mMatch) return parseInt(mMatch[1]);

  const engMatch = lower.match(/(?:month|月)\s*(\d{1,2})/);
  if (engMatch) return parseInt(engMatch[1]);

  return null;
}

// --- Intent detection ---
function detectIntent(text) {
  const lower = text.toLowerCase();

  // Query intents (check first, since they overlap with keywords)
  const isQuery = /多少|how much|spent|花了|用了|花费|总共|total|查|查询|几|what|多少钱|summary|report/.test(lower);

  if (isQuery) {
    const month = extractMonth(lower);
    const category = detectCategory(lower);
    const itemName = detectItemName(lower);

    if (itemName && !category) {
      return { intent: "query_item", item_name: itemName, month: month || "current" };
    }
    if (category) {
      return { intent: "query_category", category, month: month || "current" };
    }
    return { intent: "query_total", month: month || "current" };
  }

  // Income intents
  const isIncome = /收入|income|salary|薪水|工资|bonus|奖金|earned|赚|入账|revenue/.test(lower);
  if (isIncome) return { intent: "add_income" };

  // Default: add expense
  return { intent: "add_expense" };
}

// --- Parse multiple transactions from one sentence ---
function parseMultipleTransactions(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const base = detectIntent(raw);
  
  // Query intents don't batch
  if (base.intent && base.intent.startsWith("query_")) {
    return [parseNaturalInput(raw)];
  }

  // For add_expense/add_income, split on common delimiters and try to extract multiple items
  const delimiters = /\s*(?:,|，|and|且|还有|以及|、|;|；)\s*/;
  const segments = raw.split(delimiters).filter(s => s.trim());

  if (segments.length === 1) {
    // Single transaction
    return [parseNaturalInput(raw)];
  }

  // Try to parse multiple transactions
  const results = [];
  for (const segment of segments) {
    const parsed = parseNaturalInput(segment);
    // Only add if we got an amount (query intents or amounts without value are skipped)
    if (parsed && parsed.amount && parsed.amount > 0) {
      results.push(parsed);
    }
  }

  // If we successfully parsed multiple items with amounts, return them
  if (results.length > 1) {
    return results;
  }

  // Otherwise fall back to single parse of whole text
  return [parseNaturalInput(raw)];
}

// --- Main NLP parser (single transaction) ---
function parseNaturalInput(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const base = detectIntent(raw);
  const amount = extractAmount(raw);
  const category = base.category || detectCategory(raw);
  const itemName = base.item_name || detectItemName(raw);
  const date = extractDate(raw);
  const month = base.month || extractMonth(raw);

  const result = { ...base };

  if (amount != null && amount > 0) result.amount = Math.round(amount * 100) / 100;
  if (category) result.category = category;
  if (itemName) result.item_name = itemName;
  if (date) result.date = date;
  if (month) result.month = month;
  result.currency = "MYR";

  return result;
}

// --- Execute parsed intent ---
function resolveMonth(monthVal) {
  const now = new Date();
  if (monthVal === "current") {
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      label: currentMonthValue(),
    };
  }
  if (monthVal === "last") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      month: prev.getMonth() + 1,
      year: prev.getFullYear(),
      label: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`,
    };
  }
  if (typeof monthVal === "number" && monthVal >= 1 && monthVal <= 12) {
    return {
      month: monthVal,
      year: now.getFullYear(),
      label: `${now.getFullYear()}-${String(monthVal).padStart(2, "0")}`,
    };
  }
  return { month: now.getMonth() + 1, year: now.getFullYear(), label: currentMonthValue() };
}

function queryTransactions(parsed) {
  const r = resolveMonth(parsed.month);
  const start = new Date(r.year, r.month - 1, 1);
  const end = new Date(r.year, r.month, 1);

  let filtered = transactions.filter((tx) => {
    const d = new Date(tx.dateISO);
    return d >= start && d < end;
  });

  if (parsed.intent === "query_category" && parsed.category) {
    const catLower = parsed.category.toLowerCase();
    // Find matching categories by name or our mapped name
    const matchingCatIds = new Set();
    for (const c of categories) {
      const cName = c.name.toLowerCase();
      if (cName.includes(catLower) || catLower.includes(cName)) {
        matchingCatIds.add(c.id);
      }
    }
    // Also match via CATEGORY_MAP
    const mapGroup = CATEGORY_MAP.find((g) => g.cat === catLower);
    if (mapGroup) {
      for (const c of categories) {
        const cName = c.name.toLowerCase();
        if (mapGroup.keys.some((k) => cName.includes(k) || k.includes(cName))) {
          matchingCatIds.add(c.id);
        }
      }
    }
    if (matchingCatIds.size > 0) {
      filtered = filtered.filter((tx) => matchingCatIds.has(tx.categoryId));
    } else {
      // Try note matching as fallback
      filtered = filtered.filter((tx) =>
        (tx.note || "").toLowerCase().includes(catLower) ||
        (tx.categoryName || "").toLowerCase().includes(catLower)
      );
    }
  }

  if (parsed.intent === "query_item" && parsed.item_name) {
    const itemLower = parsed.item_name.toLowerCase();
    // Also check original Chinese text
    const originalKeys = Object.entries(ITEM_MAP)
      .filter(([, v]) => v === parsed.item_name)
      .map(([k]) => k.toLowerCase());

    filtered = filtered.filter((tx) => {
      const note = (tx.note || "").toLowerCase();
      const cat = (tx.categoryName || "").toLowerCase();
      return note.includes(itemLower) || cat.includes(itemLower) ||
        originalKeys.some((k) => note.includes(k));
    });
  }

  let totalExpense = 0;
  let totalRevenue = 0;
  for (const tx of filtered) {
    if (tx.type === "expense") totalExpense += tx.amount;
    else totalRevenue += tx.amount;
  }

  return {
    count: filtered.length,
    totalExpense: Math.round(totalExpense * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    net: Math.round((totalRevenue - totalExpense) * 100) / 100,
    monthLabel: r.label,
  };
}

function findCategoryByNlp(catName) {
  if (!catName) return null;
  const lower = catName.toLowerCase();

  // Direct name match
  for (const c of categories) {
    if (c.name.toLowerCase() === lower) return c;
  }

  // Partial match
  for (const c of categories) {
    const cName = c.name.toLowerCase();
    if (cName.includes(lower) || lower.includes(cName)) return c;
  }

  // Map-based match
  const mapGroup = CATEGORY_MAP.find((g) => g.cat === lower);
  if (mapGroup) {
    for (const c of categories) {
      const cName = c.name.toLowerCase();
      if (mapGroup.keys.some((k) => cName.includes(k) || k.includes(cName))) return c;
    }
  }

  return null;
}

async function executeAssistantIntent(parsed) {
  if (!uid) return { ok: false, message: "Please sign in first." };
  if (!parsed) return { ok: false, message: "I didn't understand that. Try again?" };

  const intent = parsed.intent;

  // --- Queries ---
  if (intent === "query_total" || intent === "query_category" || intent === "query_item" || intent === "query_month" || intent === "query_custom") {
    const result = queryTransactions(parsed);
    let label = "";
    if (intent === "query_category") {
      label = `${parsed.category || "all"} spending`;
    } else if (intent === "query_item") {
      label = `"${parsed.item_name}" spending`;
    } else {
      label = "total";
    }
    return {
      ok: true,
      type: "query",
      message: `${label} for ${result.monthLabel}`,
      expense: result.totalExpense,
      revenue: result.totalRevenue,
      net: result.net,
      count: result.count,
    };
  }

  // --- Add expense / income ---
  if (intent === "add_expense" || intent === "add_income") {
    if (!parsed.amount || parsed.amount <= 0) {
      return { ok: false, message: "I couldn't detect the amount. Please include a number." };
    }

    const type = intent === "add_income" ? "revenue" : "expense";
    const cat = findCategoryByNlp(parsed.category);
    if (!cat && categories.length === 0) {
      return { ok: false, message: "No categories yet. Please add a category first." };
    }

    const categoryId = cat ? cat.id : categories[0].id;
    const categoryName = cat ? cat.name : categories[0].name;
    const dateISO = parsed.date || todayISO();
    const note = parsed.item_name || parsed.category || "";

    const { transactions: txCol } = userCollections(uid);
    await addDoc(txCol, {
      categoryId,
      categoryName,
      type,
      amount: parsed.amount,
      note,
      noteLower: note.toLowerCase(),
      dateISO,
      createdAt: serverTimestamp(),
    });

    lastUsedCategoryId = categoryId;

    const typeLabel = type === "expense" ? "Expense" : "Income";
    return {
      ok: true,
      type: "add",
      message: `${typeLabel} recorded!`,
      detail: `${categoryName} · ${money(parsed.amount)} · ${dateISO}${note ? " · " + note : ""}`,
    };
  }

  return { ok: false, message: "I'm not sure what to do. Try saying something like '今天吃鸡饭18块' or 'spent 50 on fuel'." };
}

// --- Chat UI helpers ---
function addChatBubble(type, html) {
  if (!els.assistantChat) return;
  const div = document.createElement("div");
  div.className = `chat-bubble ${type === "user" ? "chat-user" : "chat-bot"}`;
  div.innerHTML = html;
  els.assistantChat.appendChild(div);
  els.assistantChat.scrollTop = els.assistantChat.scrollHeight;
}

function addThinking() {
  if (!els.assistantChat) return null;
  const div = document.createElement("div");
  div.className = "chat-thinking";
  div.textContent = "Thinking...";
  els.assistantChat.appendChild(div);
  els.assistantChat.scrollTop = els.assistantChat.scrollHeight;
  return div;
}

function formatQueryResult(result) {
  let html = `<span>${icon("chart", "icon-sm")} ${escapeHtml(result.message)}</span>`;
  html += `<span class="chat-amount">${money(result.expense)} expense</span>`;
  if (result.revenue > 0) {
    html += `<span class="chat-detail">Revenue: ${money(result.revenue)} · Net: ${money(result.net)}</span>`;
  }
  html += `<span class="chat-detail">${result.count} record(s) found</span>`;
  return html;
}

function formatAddResult(result) {
  let html = `<span class="chat-success">${icon("check", "icon-sm")} ${escapeHtml(result.message)}</span>`;
  html += `<span class="chat-detail">${escapeHtml(result.detail)}</span>`;
  return html;
}

function formatBatchAddResult(results, errors) {
  let html = `<span class="chat-success">${icon("check", "icon-sm")} ${results.length} transaction(s) recorded!</span>`;
  
  // Show each transaction
  for (const r of results) {
    html += `<span class="chat-detail">• ${escapeHtml(r.detail)}</span>`;
  }
  
  // Show any errors
  if (errors && errors.length > 0) {
    html += `<span class="chat-detail" style="color:var(--warning);">${icon("warn", "icon-sm")} ${errors.length} failed: ${escapeHtml(errors[0])}</span>`;
  }
  
  return html;
}

async function handleAssistantMessage(text) {
  const raw = text.trim();
  if (!raw) return;

  addChatBubble("user", escapeHtml(raw));
  const thinking = addThinking();

  try {
    const parsedList = parseMultipleTransactions(raw);
    
    // Handle single transaction case (queries)
    if (parsedList.length === 1 && parsedList[0].intent.startsWith("query_")) {
      const result = await executeAssistantIntent(parsedList[0]);
      if (thinking) thinking.remove();

      if (!result.ok) {
        addChatBubble("bot", `<span>${escapeHtml(result.message)}</span>`);
        return;
      }
      if (result.type === "query") {
        addChatBubble("bot", formatQueryResult(result));
      }
      return;
    }

    // Handle batch add (add_expense / add_income)
    if (parsedList.length > 0 && (parsedList[0].intent === "add_expense" || parsedList[0].intent === "add_income")) {
      const results = [];
      const errors = [];

      for (const parsed of parsedList) {
        try {
          const result = await executeAssistantIntent(parsed);
          if (result.ok) {
            results.push(result);
          } else {
            errors.push(result.message);
          }
        } catch (err) {
          errors.push(friendlyDbError(err));
        }
      }

      if (thinking) thinking.remove();

      if (results.length === 0 && errors.length > 0) {
        addChatBubble("bot", `<span>${icon("x-circle", "icon-sm")} ${escapeHtml(errors[0])}</span>`);
        return;
      }

      if (results.length > 1) {
        // Batch result
        addChatBubble("bot", formatBatchAddResult(results, errors));
      } else if (results.length === 1) {
        // Single result
        addChatBubble("bot", formatAddResult(results[0]));
      }
      return;
    }

    // Fallback to single parse
    const result = await executeAssistantIntent(parsedList[0]);
    if (thinking) thinking.remove();

    if (!result.ok) {
      addChatBubble("bot", `<span>${escapeHtml(result.message)}</span>`);
      return;
    }

    if (result.type === "query") {
      addChatBubble("bot", formatQueryResult(result));
    } else if (result.type === "add") {
      addChatBubble("bot", formatAddResult(result));
    }
  } catch (err) {
    if (thinking) thinking.remove();
    addChatBubble("bot", `<span>${icon("x-circle", "icon-sm")} Error: ${escapeHtml(friendlyDbError(err))}</span>`);
  }
}

// --- Web Speech API ---
let speechRecognition = null;
let isListening = false;

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = false;
  // Support Chinese + English mixed input
  rec.lang = "zh-CN";

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (els.assistantInput) els.assistantInput.value = transcript;
    handleAssistantMessage(transcript);
    stopListening();
  };

  rec.onerror = (event) => {
    stopListening();
    if (event.error === "no-speech") {
      addChatBubble("bot", `<span>${icon("mic", "icon-sm")} No speech detected. Please try again.</span>`);
    } else if (event.error === "not-allowed") {
      addChatBubble("bot", `<span>${icon("mic", "icon-sm")} Microphone access denied. Please allow mic permission.</span>`);
    }
  };

  rec.onend = () => {
    stopListening();
  };

  return rec;
}

function startListening() {
  if (!speechRecognition) {
    speechRecognition = initSpeechRecognition();
  }
  if (!speechRecognition) {
    addChatBubble("bot", `<span>${icon("mic", "icon-sm")} Speech recognition not supported in this browser. Use Chrome for best results.</span>`);
    return;
  }
  try {
    speechRecognition.start();
    isListening = true;
    if (els.assistantMicBtn) els.assistantMicBtn.classList.add("listening");
  } catch {
    // Already started
  }
}

function stopListening() {
  isListening = false;
  if (els.assistantMicBtn) els.assistantMicBtn.classList.remove("listening");
  try {
    if (speechRecognition) speechRecognition.stop();
  } catch {
    // ignore
  }
}

function toggleAssistantPanel(show) {
  if (!els.assistantPanel || !els.assistantFab) return;
  const visible = show !== undefined ? show : els.assistantPanel.hidden;
  els.assistantPanel.hidden = !visible;
  els.assistantFab.hidden = visible;
  if (visible && els.assistantInput) {
    els.assistantInput.focus();
  }
  if (!visible) {
    stopListening();
  }
}

function wireAssistantEvents() {
  if (els.assistantFab) {
    els.assistantFab.addEventListener("click", () => toggleAssistantPanel(true));
  }
  if (els.closeAssistant) {
    els.closeAssistant.addEventListener("click", () => toggleAssistantPanel(false));
  }
  if (els.assistantSendBtn) {
    els.assistantSendBtn.addEventListener("click", () => {
      const val = els.assistantInput?.value || "";
      if (val.trim()) {
        handleAssistantMessage(val);
        els.assistantInput.value = "";
      }
    });
  }
  if (els.assistantInput) {
    els.assistantInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = els.assistantInput.value || "";
        if (val.trim()) {
          handleAssistantMessage(val);
          els.assistantInput.value = "";
        }
      }
    });
  }
  if (els.assistantMicBtn) {
    els.assistantMicBtn.addEventListener("click", () => {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  }
  // Escape closes the panel
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (els.assistantPanel && !els.assistantPanel.hidden) {
        toggleAssistantPanel(false);
      }
      if (els.budgetRecordsModal && !els.budgetRecordsModal.hidden) {
        closeBudgetRecordsModal();
      }
      if (els.editTxModal && !els.editTxModal.hidden) {
        closeEditModal();
      }
      if (els.receiptModal && !els.receiptModal.hidden) {
        closeReceiptModal();
      }
    }
  });
}

function checkDuplicate() {
  if (!els.duplicateWarning) return;
  const categoryId = els.txCategory.value;
  const amount = parsePositiveAmount(els.txAmount.value);
  const dateISO = els.txDate.value;
  if (!categoryId || !amount || !dateISO) {
    els.duplicateWarning.hidden = true;
    return;
  }
  const isDup = transactions.some(
    (t) => t.categoryId === categoryId && t.amount === amount && t.dateISO === dateISO && t.id !== editingTransactionId
  );
  els.duplicateWarning.hidden = !isDup;
}

/* ─── Smart Auto-Categorization ─── */
// Learns the note → category mapping from past transactions, weighting recent
// records and exact-token matches more heavily so suggestions improve over time.
function suggestCategoryFromNote(noteText) {
  const text = (noteText || "").trim().toLowerCase();
  if (!text || text.length < 2) return null;

  const inputWords = text.split(/\s+/).filter((w) => w.length >= 2);
  const now = Date.now();
  const HALF_LIFE_DAYS = 60; // recent habits matter more than old ones

  const scores = new Map();
  let totalScore = 0;

  for (const tx of transactions) {
    const txNote = (tx.note || "").trim().toLowerCase();
    if (!txNote) continue;

    // Recency weight: decays toward ~0.5 after HALF_LIFE_DAYS.
    const txTime = tx.dateISO ? new Date(tx.dateISO).getTime() : now;
    const ageDays = Math.max(0, (now - txTime) / 86400000);
    const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS); // 1 → 0

    let match = 0;
    if (txNote === text) {
      match = 5; // identical note: strongest signal
    } else if (txNote.includes(text) || text.includes(txNote)) {
      match = 3; // substring match
    } else {
      const noteWords = txNote.split(/\s+/);
      const overlap = inputWords.filter((w) =>
        noteWords.some((nw) => nw === w || nw.includes(w) || w.includes(nw))
      );
      if (overlap.length > 0) match = overlap.length;
    }
    if (match === 0) continue;

    const weighted = match * (0.5 + recency); // base + recency boost
    scores.set(tx.categoryId, (scores.get(tx.categoryId) || 0) + weighted);
    totalScore += weighted;
  }

  if (scores.size === 0 || totalScore === 0) return null;

  let bestId = null;
  let bestScore = 0;
  for (const [catId, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestId = catId;
    }
  }
  if (!bestId) return null;

  // Only suggest when reasonably confident (best option dominates the rest).
  const confidence = bestScore / totalScore;
  if (confidence < 0.5) return null;

  const cat = categories.find((c) => c.id === bestId);
  return cat ? { id: cat.id, name: cat.name, score: bestScore, confidence } : null;
}

function updateAutoCategorySuggestion() {
  if (!els.autoCategorySuggestion) return;
  const noteText = els.txNote.value;
  const currentCat = els.txCategory.value;
  const suggestion = suggestCategoryFromNote(noteText);

  if (!suggestion || suggestion.id === currentCat) {
    els.autoCategorySuggestion.hidden = true;
    return;
  }

  els.autoCategorySuggestion.innerHTML = `${icon("bulb", "icon-sm")} Suggest: ${escapeHtml(suggestion.name)} (${Math.round(suggestion.confidence * 100)}% match — click to apply)`;
  els.autoCategorySuggestion.hidden = false;
  els.autoCategorySuggestion.onclick = () => {
    els.txCategory.value = suggestion.id;
    els.autoCategorySuggestion.hidden = true;
  };
}

/* ─── Spending Insights ─── */
function generateInsights() {
  if (!els.insightsContent) return;
  if (transactions.length === 0) {
    els.insightsContent.innerHTML = '<div class="muted">Add some records to see insights.</div>';
    return;
  }

  const now = new Date();
  const thisMonth = currentMonthValue(now);
  const lastMonth = currentMonthValue(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  // Current month transactions
  const curMonthTxs = transactions.filter((t) => t.dateISO && t.dateISO.substring(0, 7) === thisMonth);
  const prevMonthTxs = transactions.filter((t) => t.dateISO && t.dateISO.substring(0, 7) === lastMonth);

  let curExpense = 0, curRevenue = 0, prevExpense = 0, prevRevenue = 0;
  const catSpend = new Map();

  for (const tx of curMonthTxs) {
    if (tx.type === "expense") {
      curExpense += tx.amount;
      catSpend.set(tx.categoryName || "(Unknown)", (catSpend.get(tx.categoryName || "(Unknown)") || 0) + tx.amount);
    } else {
      curRevenue += tx.amount;
    }
  }
  for (const tx of prevMonthTxs) {
    if (tx.type === "expense") prevExpense += tx.amount;
    else prevRevenue += tx.amount;
  }

  const cards = [];
  const netCur = curRevenue - curExpense;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const dailyAvg = dayOfMonth > 0 ? curExpense / dayOfMonth : 0;
  const projected = dailyAvg * daysInMonth;
  const monthName = now.toLocaleDateString(undefined, { month: "long" });

  // 1. Friendly headline
  let heroSub, heroIcon;
  if (curExpense === 0 && curRevenue === 0) {
    heroSub = "Nothing logged this month yet — add a record to get started!";
    heroIcon = "edit";
  } else if (netCur >= 0) {
    heroSub = `You're up <b class="insight-good">${money(netCur)}</b> so far — nice going!`;
    heroIcon = "up";
  } else {
    heroSub = `You've spent <b class="insight-warn">${money(-netCur)}</b> more than you earned this month.`;
    heroIcon = "down";
  }
  cards.push(`<div class="insight-hero">
    <div class="insight-hero-emoji">${icon(heroIcon)}</div>
    <div>
      <div class="insight-hero-title">Your ${escapeHtml(monthName)} so far</div>
      <div class="insight-hero-sub">${heroSub}</div>
    </div>
  </div>`);

  // Nothing more to show if the month is empty
  if (curExpense === 0 && curRevenue === 0) {
    els.insightsContent.innerHTML = cards.join("");
    return;
  }

  // 2. Overview tiles
  const projLine = (dayOfMonth < daysInMonth && curExpense > 0)
    ? `<div class="insight-line muted small">${icon("up", "icon-sm")} On track to spend about <b>${money(projected)}</b> by month-end (≈ ${money(dailyAvg)}/day).</div>`
    : "";
  cards.push(`<div class="insight-card">
    <div class="insight-tiles">
      <div class="insight-tile"><span class="insight-tile-label">${icon("down", "icon-sm")} Spent</span><span class="insight-tile-value insight-warn">${money(curExpense)}</span></div>
      <div class="insight-tile"><span class="insight-tile-label">${icon("up", "icon-sm")} Earned</span><span class="insight-tile-value insight-good">${money(curRevenue)}</span></div>
      <div class="insight-tile"><span class="insight-tile-label">${icon("gem", "icon-sm")} Net</span><span class="insight-tile-value ${netCur >= 0 ? 'insight-good' : 'insight-warn'}">${money(netCur)}</span></div>
    </div>
    ${projLine}
  </div>`);

  // 3. vs Last month — compact chips
  if (prevExpense > 0 || prevRevenue > 0) {
    const chip = (label, change, higherIsBad) => {
      const flat = Math.abs(change) < 0.05;
      const up = change > 0;
      const arrow = flat ? "→" : up ? "↑" : "↓";
      const cls = flat ? "" : (up !== higherIsBad ? "insight-good" : "insight-warn");
      const word = flat ? "about the same" : `${Math.abs(change).toFixed(0)}% ${up ? "more" : "less"}`;
      return `<div class="insight-chip ${cls}"><span class="insight-chip-arrow">${arrow}</span> ${label} ${word}</div>`;
    };
    const expChange = prevExpense > 0 ? ((curExpense - prevExpense) / prevExpense * 100) : 0;
    const revChange = prevRevenue > 0 ? ((curRevenue - prevRevenue) / prevRevenue * 100) : 0;
    cards.push(`<div class="insight-card">
      <h4>${icon("up", "icon-sm")} Compared to last month</h4>
      <div class="insight-chips">
        ${chip("spending", expChange, true)}
        ${chip("income", revChange, false)}
      </div>
    </div>`);
  }

  // 4. Where your money went — bars
  if (catSpend.size > 0) {
    const sorted = [...catSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxAmount = sorted[0][1] || 1;
    const bars = sorted.map(([name, amount]) => {
      const pctTotal = curExpense > 0 ? Math.round(amount / curExpense * 100) : 0;
      const barW = Math.round(amount / maxAmount * 100);
      return `<div class="insight-bar-row">
        <div class="insight-bar-head"><span>${escapeHtml(name)}</span><span class="muted">${money(amount)} · ${pctTotal}%</span></div>
        <div class="insight-bar-track"><div class="insight-bar-fill" style="width:${barW}%"></div></div>
      </div>`;
    }).join("");
    cards.push(`<div class="insight-card">
      <h4>${icon("trophy", "icon-sm")} Where your money went</h4>
      <div class="insight-bars">${bars}</div>
    </div>`);
  }

  // 5. Budgets to watch — progress rows
  const budgetAlerts = [];
  const thisMonthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  for (const cat of categories) {
    if ((cat.budgetPeriod || "month") !== "month") continue;
    const budgetAmount = effectiveBudgetFor(cat, "month", thisMonthRef);
    if (!budgetAmount || budgetAmount <= 0) continue;
    const spent = curMonthTxs.filter((t) => t.categoryId === cat.id && t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const pct = (spent / budgetAmount) * 100;
    if (pct >= 80) budgetAlerts.push({ name: cat.name, spent, budget: budgetAmount, pct });
  }
  if (budgetAlerts.length > 0) {
    const rows = budgetAlerts.map((a) => {
      const over = a.pct > 100;
      const badge = over ? `${icon("warn", "icon-sm")} Over by ${money(a.spent - a.budget)}` : a.pct >= 100 ? `${icon("check", "icon-sm")} Fully used` : `${icon("zap", "icon-sm")} ${a.pct.toFixed(0)}%`;
      return `<div class="insight-bar-row">
        <div class="insight-bar-head"><span>${escapeHtml(a.name)}</span><span class="${over ? 'insight-warn' : 'insight-highlight'}">${badge}</span></div>
        <div class="insight-bar-track"><div class="insight-bar-fill ${over ? 'over' : ''}" style="width:${Math.min(100, a.pct)}%"></div></div>
      </div>`;
    }).join("");
    cards.push(`<div class="insight-card">
      <h4>${icon("warn", "icon-sm")} Budgets to watch</h4>
      <div class="insight-bars">${rows}</div>
    </div>`);
  }

  // 6. Habit — one friendly line
  const weekday = { total: 0, count: 0 };
  const weekend = { total: 0, count: 0 };
  for (const tx of curMonthTxs) {
    if (tx.type !== "expense") continue;
    const day = new Date(tx.dateISO).getDay();
    const bucket = (day === 0 || day === 6) ? weekend : weekday;
    bucket.total += tx.amount;
    bucket.count++;
  }
  if (weekday.count > 0 && weekend.count > 0) {
    const wdAvg = weekday.total / weekday.count;
    const weAvg = weekend.total / weekend.count;
    const moreWeekend = weAvg > wdAvg;
    cards.push(`<div class="insight-card">
      <h4>${icon("calendar", "icon-sm")} Your habit</h4>
      <div class="insight-line">You spend more on <strong>${moreWeekend ? "weekends" : "weekdays"}</strong> — about <b class="insight-highlight">${money(moreWeekend ? weAvg : wdAvg)}</b> per transaction vs ${money(moreWeekend ? wdAvg : weAvg)}.</div>
    </div>`);
  }

  els.insightsContent.innerHTML = cards.join("");
}

/* ─── Receipt OCR Scan ─── */
let receiptStream = null;
let TesseractWorker = null;
let receiptExtractedAmount = null;
let receiptExtractedText = "";

async function ensureTesseract() {
  if (TesseractWorker) return TesseractWorker;
  if (els.receiptStatus) els.receiptStatus.textContent = "Loading OCR engine…";

  // Load Tesseract.js via script tag if not already loaded
  if (!globalThis.Tesseract) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load Tesseract.js"));
      document.head.appendChild(script);
    });
  }

  const worker = await globalThis.Tesseract.createWorker("eng");
  TesseractWorker = worker;
  if (els.receiptStatus) els.receiptStatus.textContent = "";
  return worker;
}

function stopReceiptCamera() {
  if (receiptStream) {
    for (const track of receiptStream.getTracks()) track.stop();
    receiptStream = null;
  }
  if (els.receiptVideo) els.receiptVideo.hidden = true;
  if (els.receiptCaptureBtn) els.receiptCaptureBtn.hidden = true;
}

function openReceiptModal() {
  if (els.receiptModal) els.receiptModal.hidden = false;
  if (els.receiptResult) els.receiptResult.hidden = true;
  if (els.receiptPreview) els.receiptPreview.hidden = true;
  if (els.receiptStatus) els.receiptStatus.textContent = "";
  receiptExtractedAmount = null;
  receiptExtractedText = "";
}

function closeReceiptModal() {
  stopReceiptCamera();
  if (els.receiptModal) els.receiptModal.hidden = true;
  if (els.receiptResult) els.receiptResult.hidden = true;
  if (els.receiptPreview) els.receiptPreview.hidden = true;
}

async function startReceiptCamera() {
  try {
    stopReceiptCamera();
    receiptStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    els.receiptVideo.srcObject = receiptStream;
    els.receiptVideo.hidden = false;
    els.receiptCaptureBtn.hidden = false;
    if (els.receiptStatus) els.receiptStatus.textContent = "Point camera at receipt and tap Capture.";
  } catch (err) {
    if (els.receiptStatus) els.receiptStatus.textContent = "Camera not available. Try uploading an image instead.";
  }
}

function captureFromVideo() {
  const video = els.receiptVideo;
  const canvas = els.receiptCanvas;
  if (!video || !canvas) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  stopReceiptCamera();
  return canvas;
}

async function processReceiptImage(imageSource) {
  if (els.receiptStatus) els.receiptStatus.textContent = "Analyzing receipt…";
  if (els.receiptResult) els.receiptResult.hidden = true;

  try {
    const worker = await ensureTesseract();
    const { data } = await worker.recognize(imageSource);
    const fullText = data.text || "";

    // Extract amounts — look for currency patterns
    const amountRegex = /(?:RM|MYR|USD|\$|€|£|¥)?\s*(\d{1,}[.,]\d{2})\b/gi;
    const amounts = [];
    let match;
    while ((match = amountRegex.exec(fullText)) !== null) {
      const val = parseFloat(match[1].replace(",", "."));
      if (val > 0 && val < 1000000) amounts.push(val);
    }

    // Also try plain number patterns like "12.50" on their own lines
    if (amounts.length === 0) {
      const lineAmounts = fullText.split("\n").map((l) => l.trim()).filter((l) => /^\d+[.,]\d{2}$/.test(l));
      for (const la of lineAmounts) {
        const val = parseFloat(la.replace(",", "."));
        if (val > 0) amounts.push(val);
      }
    }

    // Pick the largest amount as "total"
    const bestAmount = amounts.length > 0 ? Math.max(...amounts) : null;
    receiptExtractedAmount = bestAmount;

    // Clean the text for note — take first meaningful non-number line
    const lines = fullText.split("\n").map((l) => l.trim()).filter((l) => l.length > 2);
    const noteLines = lines.filter((l) => !/^\d+[.,]\d{2}$/.test(l)).slice(0, 3);
    receiptExtractedText = noteLines.join(" ").substring(0, 80);

    if (els.receiptAmountResult) els.receiptAmountResult.textContent = bestAmount != null ? money(bestAmount) : "Not detected";
    if (els.receiptTextResult) els.receiptTextResult.textContent = receiptExtractedText || "Not detected";
    if (els.receiptResult) els.receiptResult.hidden = false;
    if (els.receiptStatus) els.receiptStatus.textContent = "Done! Review the extracted data below.";
  } catch (err) {
    if (els.receiptStatus) els.receiptStatus.textContent = "OCR failed: " + (err.message || "Unknown error");
  }
}

function applyReceiptToForm() {
  if (receiptExtractedAmount != null) {
    if (els.txAmount._bankPrefill) els.txAmount._bankPrefill(receiptExtractedAmount);
    else els.txAmount.value = String(receiptExtractedAmount);
  }
  if (receiptExtractedText) {
    els.txNote.value = receiptExtractedText;
    updateAutoCategorySuggestion();
  }
  closeReceiptModal();
}

/* ─── Dashboard ─── */
function renderDashboard() {
  const now = new Date();
  const thisMonth = currentMonthValue(now);
  const monthTxs = transactions.filter((t) => t.dateISO && t.dateISO.substring(0, 7) === thisMonth);

  let expense = 0, revenue = 0;
  for (const tx of monthTxs) {
    if (tx.type === "expense") expense += tx.amount;
    else revenue += tx.amount;
  }

  const dashExpense = document.getElementById("dashExpense");
  const dashRevenue = document.getElementById("dashRevenue");
  const dashNet = document.getElementById("dashNet");
  const dashCount = document.getElementById("dashCount");

  if (dashExpense) dashExpense.textContent = money(expense);
  if (dashRevenue) dashRevenue.textContent = money(revenue);
  if (dashNet) {
    const net = revenue - expense;
    dashNet.textContent = money(net);
    dashNet.style.color = net >= 0 ? "var(--success)" : "var(--danger)";
  }
  if (dashCount) dashCount.textContent = String(transactions.length);

  // Salary allocation: this month's income − monthly category budgets
  const thisMonthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  const budgetedMonthly = categories.reduce((sum, c) => {
    if ((c.budgetPeriod || "month") !== "month") return sum;
    const amt = effectiveBudgetFor(c, "month", thisMonthRef);
    return amt > 0 ? sum + amt : sum;
  }, 0);
  const remaining = revenue - budgetedMonthly;
  const allocIncome = document.getElementById("allocIncome");
  const allocBudgeted = document.getElementById("allocBudgeted");
  const allocRemaining = document.getElementById("allocRemaining");
  const allocBar = document.getElementById("allocBar");
  const allocNote = document.getElementById("allocNote");

  if (allocIncome) allocIncome.textContent = money(revenue);
  if (allocBudgeted) allocBudgeted.textContent = money(budgetedMonthly);
  if (allocRemaining) {
    allocRemaining.textContent = money(remaining);
    allocRemaining.style.color = remaining >= 0 ? "var(--success)" : "var(--danger)";
  }
  if (allocBar) {
    const pct = revenue > 0
      ? Math.min((budgetedMonthly / revenue) * 100, 100)
      : (budgetedMonthly > 0 ? 100 : 0);
    allocBar.style.width = pct + "%";
    allocBar.classList.toggle("over", remaining < 0);
  }
  if (allocNote) {
    if (revenue <= 0) {
      allocNote.textContent = "No income recorded this month yet.";
    } else if (remaining < 0) {
      allocNote.textContent = `Over-allocated by ${money(-remaining)} — your monthly budgets exceed this month's income.`;
    } else {
      const pctBudgeted = Math.round((budgetedMonthly / revenue) * 100);
      allocNote.textContent = `${pctBudgeted}% of income budgeted — ${money(remaining)} still unallocated.`;
    }
  }

  // Recent transactions (last 5)
  const dashRecent = document.getElementById("dashRecentTx");
  if (dashRecent) {
    const recent = transactions.slice(0, 5);
    if (recent.length === 0) {
      dashRecent.innerHTML = '<div class="muted small">No recent transactions.</div>';
    } else {
      dashRecent.innerHTML = recent.map((tx) => {
        const cls = tx.type === "expense" ? "expense" : "revenue";
        const sign = tx.type === "expense" ? "-" : "+";
        return `<div class="dash-recent-item">
          <span>${escapeHtml(tx.dateISO)}</span>
          <span class="dash-tx-note">${escapeHtml(tx.categoryName || "")} ${escapeHtml(tx.note || "")}</span>
          <span class="dash-tx-amount ${cls}">${sign}${money(tx.amount)}</span>
        </div>`;
      }).join("");
    }
  }

  // Budget alerts (with run-rate forecasting for the current month)
  const dashAlerts = document.getElementById("dashBudgetAlerts");
  if (dashAlerts) {
    const monthRef = budgetMonthRefDate();
    const now = new Date();
    const isCurrentMonth =
      monthRef.getFullYear() === now.getFullYear() &&
      monthRef.getMonth() === now.getMonth();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const alerts = [];
    const forecasts = [];
    for (const cat of categories) {
      const period = cat.budgetPeriod || "month";
      if (period !== "month") continue;
      const budgetAmount = effectiveBudgetFor(cat, period, monthRef);
      if (!budgetAmount || budgetAmount <= 0) continue;
      const { spent } = computeCategoryTotals(cat.id, period, monthRef);
      const pct = (spent / budgetAmount) * 100;

      if (pct >= 80) {
        const label = pct > 100
          ? `${icon("warn", "icon-sm")} Over by ${money(spent - budgetAmount)}`
          : pct >= 100 ? `${icon("check", "icon-sm")} Fully used` : `${icon("zap", "icon-sm")} ${Math.round(pct)}% used`;
        alerts.push(`<div class="dash-alert-item">${escapeHtml(cat.name)}: ${money(spent)} / ${money(budgetAmount)} — ${label}</div>`);

        // Browser notification (deduped per category + month + threshold)
        const monthKey = currentMonthValue(monthRef);
        if (pct > 100) {
          notifyBudget("Budget exceeded", `${cat.name}: ${money(spent)} / ${money(budgetAmount)} — over by ${money(spent - budgetAmount)}`, `${cat.id}:${monthKey}:over`);
        } else {
          notifyBudget("Budget warning", `${cat.name}: ${Math.round(pct)}% of budget used (${money(spent)} / ${money(budgetAmount)})`, `${cat.id}:${monthKey}:80`);
        }
      }

      // Forecast: project month-end spend from the current daily run-rate.
      if (isCurrentMonth && dayOfMonth > 0 && spent > 0 && pct < 100) {
        const dailyRate = spent / dayOfMonth;
        const projected = dailyRate * daysInMonth;
        if (projected > budgetAmount) {
          const crossDay = Math.ceil(budgetAmount / dailyRate);
          const dayText = crossDay <= daysInMonth ? `around day ${crossDay}` : "after month-end";
          forecasts.push(
            `<div class="dash-alert-item dash-forecast-item">${icon("activity", "icon-sm")} ${escapeHtml(cat.name)}: at this rate you'll spend ~${money(projected)} (budget ${money(budgetAmount)}) — likely exceed ${dayText}.</div>`
          );
        }
      }
    }

    const html = [...alerts, ...forecasts];
    dashAlerts.innerHTML = html.length > 0 ? html.join("") : `<div class="muted small">${icon("check", "icon-sm")} All budgets are on track.</div>`;
  }

  renderHeatmapCalendar();
  renderMonthComparison();
}

function renderMonthComparison() {
  const summary = document.getElementById("momSummary");
  const catsEl = document.getElementById("momCategories");
  if (!summary) return;

  const now = new Date();
  const thisMonth = currentMonthValue(now);
  const lastMonth = currentMonthValue(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const agg = (month) => {
    let expense = 0, income = 0;
    const byCat = {};
    for (const t of transactions) {
      if (!t.dateISO || t.dateISO.substring(0, 7) !== month) continue;
      if (t.type === "expense") {
        expense += t.amount;
        byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount;
      } else {
        income += t.amount;
      }
    }
    return { expense, income, byCat };
  };

  const cur = agg(thisMonth);
  const prev = agg(lastMonth);

  if (!cur.expense && !cur.income && !prev.expense && !prev.income) {
    summary.innerHTML = '<div class="muted small">Not enough data to compare yet.</div>';
    if (catsEl) catsEl.innerHTML = "";
    return;
  }

  // higherIsBad: for expense, an increase is "bad" (red); for income it's "good" (green)
  const deltaRow = (label, curVal, prevVal, higherIsBad) => {
    const diff = curVal - prevVal;
    const pct = prevVal > 0 ? Math.round((diff / prevVal) * 100) : (curVal > 0 ? 100 : 0);
    const flat = diff === 0;
    const up = diff > 0;
    const arrow = flat ? "→" : up ? "↑" : "↓";
    const cls = flat ? "" : (up !== higherIsBad ? "revenue" : "expense");
    const sign = diff > 0 ? "+" : "";
    return `<div class="mom-row">
      <span class="mom-label">${label}</span>
      <span class="mom-vals">${money(curVal)} <span class="muted small">vs ${money(prevVal)}</span></span>
      <span class="mom-delta ${cls}">${arrow} ${sign}${money(diff)}${prevVal > 0 ? ` (${sign}${pct}%)` : ""}</span>
    </div>`;
  };

  summary.innerHTML =
    deltaRow("Expense", cur.expense, prev.expense, true) +
    deltaRow("Income", cur.income, prev.income, false);

  // Biggest per-category expense changes
  const catIds = new Set([...Object.keys(cur.byCat), ...Object.keys(prev.byCat)]);
  const changes = [];
  for (const id of catIds) {
    const c = cur.byCat[id] || 0;
    const p = prev.byCat[id] || 0;
    const diff = c - p;
    if (diff === 0) continue;
    const cat = categories.find((x) => x.id === id);
    changes.push({ name: cat ? cat.name : "Uncategorized", p, diff });
  }
  changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const top = changes.slice(0, 4);

  if (catsEl) {
    if (!top.length) {
      catsEl.innerHTML = '<div class="muted small">No category changes vs last month.</div>';
    } else {
      catsEl.innerHTML = '<div class="mom-cat-title muted small">Biggest category changes</div>' + top.map((x) => {
        const up = x.diff > 0;
        const arrow = up ? "↑" : "↓";
        const cls = up ? "expense" : "revenue";
        const sign = up ? "+" : "";
        const pct = x.p > 0 ? ` (${sign}${Math.round((x.diff / x.p) * 100)}%)` : "";
        return `<div class="mom-cat-row">
          <span>${escapeHtml(x.name)}</span>
          <span class="mom-delta ${cls}">${arrow} ${sign}${money(x.diff)}${pct}</span>
        </div>`;
      }).join("");
    }
  }
}

/* ─── Category Trends Chart ─── */
async function renderTrendChart() {
  const canvas = document.getElementById("trendChart");
  const msgEl = document.getElementById("trendChartMessage");
  if (!canvas) return;

  if (transactions.length === 0) {
    if (msgEl) { msgEl.textContent = "No data yet."; msgEl.hidden = false; }
    canvas.style.visibility = "hidden";
    return;
  }

  try {
    const Chart = await ensureChartJs();

    // Get last 6 months
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(currentMonthValue(d));
    }

    // Top 5 expense categories by total spending
    const catTotals = new Map();
    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const m = tx.dateISO ? tx.dateISO.substring(0, 7) : "";
      if (!months.includes(m)) continue;
      catTotals.set(tx.categoryId, (catTotals.get(tx.categoryId) || 0) + tx.amount);
    }
    const topCats = [...catTotals.entries()]
      .filter(([id]) => categories.some((c) => c.id === id))
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);

    const colors = ["#7c5cfc", "#e54360", "#22c55e", "#e89420", "#3b82f6"];
    const datasets = topCats.map((catId, i) => {
      const cat = categories.find((c) => c.id === catId);
      const data = months.map((m) => {
        return transactions.filter((t) => t.categoryId === catId && t.type === "expense" && t.dateISO && t.dateISO.substring(0, 7) === m)
          .reduce((s, t) => s + t.amount, 0);
      });
      return {
        label: cat ? cat.name : "(Unknown)",
        data,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + "22",
        fill: false,
        tension: 0.3,
      };
    });

    if (window._trendChart) window._trendChart.destroy();
    window._trendChart = new Chart(canvas, {
      type: "line",
      data: { labels: months, datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    });

    if (msgEl) msgEl.hidden = true;
    canvas.style.visibility = "visible";
  } catch (err) {
    if (msgEl) { msgEl.textContent = "Chart unavailable."; msgEl.hidden = false; }
  }
}

/* ─── Quick Templates ─── */
/* ─── Quick Templates → extracted to js/features/templates.js (createTemplates) ─── */

/* ─── Cashflow Chart (income vs expense, last 6 months) ─── */
async function renderCashflowChart() {
  const canvas = document.getElementById("cashflowChart");
  const msgEl = document.getElementById("cashflowChartMessage");
  if (!canvas) return;

  if (transactions.length === 0) {
    if (msgEl) { msgEl.textContent = "No data yet."; msgEl.hidden = false; }
    canvas.style.visibility = "hidden";
    return;
  }

  try {
    const Chart = await ensureChartJs();
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(currentMonthValue(d));
    }

    const income = months.map((m) =>
      transactions.filter((t) => t.type === "revenue" && t.dateISO && t.dateISO.substring(0, 7) === m)
        .reduce((s, t) => s + t.amount, 0));
    const expense = months.map((m) =>
      transactions.filter((t) => t.type === "expense" && t.dateISO && t.dateISO.substring(0, 7) === m)
        .reduce((s, t) => s + t.amount, 0));

    if (window._cashflowChart) window._cashflowChart.destroy();
    window._cashflowChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Income", data: income, backgroundColor: "#22c55eaa", borderColor: "#22c55e", borderWidth: 1 },
          { label: "Expense", data: expense, backgroundColor: "#e54360aa", borderColor: "#e54360", borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    });

    if (msgEl) msgEl.hidden = true;
    canvas.style.visibility = "visible";
  } catch (err) {
    if (msgEl) { msgEl.textContent = "Chart unavailable."; msgEl.hidden = false; }
  }
}

/* ─── Spending Heatmap Calendar (current month) ─── */
function renderHeatmapCalendar() {
  const wrap = document.getElementById("heatmapCalendar");
  if (!wrap) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthKey = currentMonthValue(now);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = new Map();
  let maxSpend = 0;
  for (const tx of transactions) {
    if (tx.type !== "expense" || !tx.dateISO) continue;
    if (tx.dateISO.substring(0, 7) !== monthKey) continue;
    const day = Number(tx.dateISO.substring(8, 10));
    const v = (byDay.get(day) || 0) + tx.amount;
    byDay.set(day, v);
    if (v > maxSpend) maxSpend = v;
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let html = dayNames.map((d) => `<div class="heatmap-dayname">${d}</div>`).join("");

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i++) html += '<div class="heatmap-cell heatmap-empty"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const spend = byDay.get(day) || 0;
    const intensity = maxSpend > 0 ? spend / maxSpend : 0;
    let level = 0;
    if (spend > 0) level = intensity > 0.66 ? 3 : intensity > 0.33 ? 2 : 1;
    const dateISO = `${monthKey}-${String(day).padStart(2, "0")}`;
    const title = spend > 0 ? `${dateISO}: ${money(spend)} — tap for details` : `${dateISO} — tap for details`;
    html += `<div class="heatmap-cell heatmap-l${level} heatmap-clickable" data-date="${dateISO}" title="${escapeHtml(title)}"><span class="heatmap-daynum">${day}</span></div>`;
  }

  wrap.innerHTML = html;
}

function openDayDetail(dateISO) {
  const modal = document.getElementById("dayDetailModal");
  const title = document.getElementById("dayDetailTitle");
  const summary = document.getElementById("dayDetailSummary");
  const list = document.getElementById("dayDetailList");
  if (!modal) return;

  const dayTxs = transactions.filter((t) => t.dateISO === dateISO);
  let expense = 0, income = 0;
  for (const t of dayTxs) {
    if (t.type === "expense") expense += t.amount;
    else income += t.amount;
  }

  if (title) title.innerHTML = `${icon("calendar")} ${escapeHtml(dateISO)}`;
  if (summary) {
    summary.innerHTML = `
      <span class="day-detail-stat"><span class="muted small">Expense</span><b class="mom-delta expense">${money(expense)}</b></span>
      <span class="day-detail-stat"><span class="muted small">Income</span><b class="mom-delta revenue">${money(income)}</b></span>
      <span class="day-detail-stat"><span class="muted small">Net</span><b>${money(income - expense)}</b></span>`;
  }
  if (list) {
    if (!dayTxs.length) {
      list.innerHTML = '<div class="muted small">No transactions on this day.</div>';
    } else {
      list.innerHTML = dayTxs.map((t) => {
        const exp = t.type === "expense";
        return `<div class="day-detail-item">
          <span class="day-detail-cat">${escapeHtml(t.categoryName || "")}${t.note ? ` <span class="muted small">${escapeHtml(t.note)}</span>` : ""}</span>
          <span class="mom-delta ${exp ? "expense" : "revenue"}">${exp ? "-" : "+"}${money(t.amount)}</span>
        </div>`;
      }).join("");
    }
  }
  modal.hidden = false;
}

function closeDayDetail() {
  const modal = document.getElementById("dayDetailModal");
  if (modal) modal.hidden = true;
}

/* ─── Budget browser notifications ─── */
function notifyBudget(title, body, key) {
  if (!budgetAlertsEnabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (_notifiedBudgets.has(key)) return;
  _notifiedBudgets.add(key);
  try {
    new Notification(title, { body });
  } catch (_) { /* ignore */ }
}

async function toggleBudgetAlerts() {
  if (typeof Notification === "undefined") {
    if (els.budgetAlertsStatus) els.budgetAlertsStatus.textContent = "Notifications not supported on this device.";
    return;
  }
  if (!budgetAlertsEnabled) {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      budgetAlertsEnabled = true;
      localStorage.setItem("accountBook.budgetAlerts", "on");
    } else {
      if (els.budgetAlertsStatus) els.budgetAlertsStatus.textContent = "Permission denied. Enable notifications in your browser settings.";
      return;
    }
  } else {
    budgetAlertsEnabled = false;
    localStorage.setItem("accountBook.budgetAlerts", "off");
  }
  updateBudgetAlertsUi();
}

function updateBudgetAlertsUi() {
  if (els.toggleBudgetAlertsBtn) {
    els.toggleBudgetAlertsBtn.textContent = budgetAlertsEnabled ? "Disable Budget Alerts" : "Enable Budget Alerts";
  }
  if (els.budgetAlertsStatus) {
    els.budgetAlertsStatus.textContent = budgetAlertsEnabled ? "On — you'll be alerted at 80% and over budget." : "Off";
  }
}

/* ─── Savings Goals ─── */
/* ─── Savings Goals → extracted to js/features/goals.js (createGoals) ─── */

/* ─── Debts / Lending → extracted to js/features/debts.js (createDebts) ─── */

/* ─── Subscriptions → extracted to js/features/subscriptions.js (createSubscriptions) ─── */

/* ─── Receipt Photos → extracted to js/features/receipts.js (createReceipts) ─── */

/* ─── Recurring Transactions → extracted to js/features/recurring.js (createRecurring) ─── */

/* ─── Settings: Currency ─── */
async function saveCurrencySymbol() {
  const input = document.getElementById("currencySymbolInput");
  if (!input) return;
  const symbol = input.value.trim().substring(0, 5);
  const { settings: settingsCol } = userCollections(uid);
  await setDoc(doc(settingsCol, "preferences"), { currencySymbol: symbol }, { merge: true });
  currencySymbol = symbol;
  renderAll();
}

/* ─── Data Export/Import ─── */
function exportDataAsJson() {
  const data = {
    exportDate: new Date().toISOString(),
    categories: categories.map((c) => ({ ...c })),
    transactions: transactions.map((t) => ({ ...t })),
    savingsGoals: savingsGoals.map((g) => ({ ...g })),
    targets: targets.map((t) => ({ ...t })),
    recurringRules: recurringRules.map((r) => ({ ...r })),
    debts: debts.map((d) => ({ ...d })),
    subscriptions: subscriptions.map((s) => ({ ...s })),
    settings: { currencySymbol },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `accountbook-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importDataFromJson(file) {
  const statusEl = document.getElementById("importStatus");
  if (!file) return;

  try {
    if (statusEl) statusEl.textContent = "Reading file…";
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.categories || !data.transactions) {
      if (statusEl) statusEl.innerHTML = `${icon("x-circle", "icon-sm")} Invalid backup file format.`;
      return;
    }

    if (statusEl) statusEl.textContent = "Importing…";

    const { categories: catCol, transactions: txCol, savingsGoals: goalsCol, targets: targetsCol, recurring: recCol, settings: settingsCol, debts: debtsCol, subscriptions: subsCol } = userCollections(uid);

    // Import categories
    let catCount = 0;
    for (const c of data.categories) {
      if (!c.name) continue;
      const docData = { name: c.name, budget: c.budget || 0, budgetPeriod: c.budgetPeriod || "month", createdAt: serverTimestamp() };
      if (c.monthlyBudgets && typeof c.monthlyBudgets === "object") docData.monthlyBudgets = c.monthlyBudgets;
      await addDoc(catCol, docData);
      catCount++;
    }

    // Import transactions
    let txCount = 0;
    for (const t of data.transactions) {
      if (!t.categoryId || !t.amount) continue;
      const docData = {
        categoryId: t.categoryId, categoryName: t.categoryName || "", type: t.type || "expense",
        amount: t.amount, note: t.note || "", noteLower: (t.note || "").toLowerCase(),
        dateISO: t.dateISO || todayISO(), createdAt: serverTimestamp(),
      };
      await addDoc(txCol, docData);
      txCount++;
    }

    // Import goals
    let goalCount = 0;
    if (data.savingsGoals) {
      for (const g of data.savingsGoals) {
        if (!g.name) continue;
        await addDoc(goalsCol, { name: g.name, target: g.target || 0, deadline: g.deadline || "", createdAt: serverTimestamp() });
        goalCount++;
      }
    }

    // Import life targets
    if (data.targets) {
      for (const t of data.targets) {
        if (!t.text) continue;
        await addDoc(targetsCol, { text: t.text, age: t.age || 0, done: !!t.done, createdAt: serverTimestamp() });
      }
    }

    // Import recurring
    let recCount = 0;
    if (data.recurringRules) {
      for (const r of data.recurringRules) {
        if (!r.categoryId) continue;
        await addDoc(recCol, {
          categoryId: r.categoryId, categoryName: r.categoryName || "", type: r.type || "expense",
          amount: r.amount || 0, note: r.note || "", dayOfMonth: r.dayOfMonth || 1, createdAt: serverTimestamp(),
        });
        recCount++;
      }
    }

    // Import debts
    let debtCount = 0;
    if (data.debts) {
      for (const d of data.debts) {
        if (!d.person || !d.amount) continue;
        await addDoc(debtsCol, {
          person: d.person, direction: d.direction === "i_owe" ? "i_owe" : "owed_to_me",
          amount: d.amount, note: d.note || "", dateISO: d.dateISO || todayISO(),
          dueDate: d.dueDate || "", status: d.status === "settled" ? "settled" : "outstanding",
          createdAt: serverTimestamp(),
        });
        debtCount++;
      }
    }

    // Import subscriptions
    let subCount = 0;
    if (data.subscriptions) {
      for (const s of data.subscriptions) {
        if (!s.name || !s.amount) continue;
        await addDoc(subsCol, {
          name: s.name, categoryId: s.categoryId || "", categoryName: s.categoryName || "",
          amount: s.amount, cycle: s.cycle === "year" ? "year" : "month",
          nextRenewal: s.nextRenewal || todayISO(),
          status: s.status === "cancelled" ? "cancelled" : "active",
          createdAt: serverTimestamp(),
        });
        subCount++;
      }
    }

    // Import settings
    if (data.settings && data.settings.currencySymbol != null) {
      await setDoc(doc(settingsCol, "preferences"), { currencySymbol: data.settings.currencySymbol }, { merge: true });
    }

    if (statusEl) statusEl.innerHTML = `${icon("check", "icon-sm")} Imported ${catCount} categories, ${txCount} transactions, ${goalCount} goals, ${recCount} recurring rules, ${debtCount} debts, ${subCount} subscriptions.`;
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `${icon("x-circle", "icon-sm")} Import failed: ${escapeHtml(err.message || "Unknown error")}`;
  }
}

/* ─── PDF Report ─── */
async function generatePdfReport() {
  const monthInput = document.getElementById("pdfReportMonth");
  if (!monthInput || !monthInput.value) return;
  const month = monthInput.value; // "YYYY-MM"

  const monthTxs = transactions.filter((t) => t.dateISO && t.dateISO.substring(0, 7) === month);
  if (monthTxs.length === 0) {
    setAppError("No transactions found for " + month);
    return;
  }

  let totalExp = 0, totalRev = 0;
  for (const tx of monthTxs) {
    if (tx.type === "expense") totalExp += tx.amount;
    else totalRev += tx.amount;
  }

  // Generate printable HTML
  const rows = monthTxs.map((tx) =>
    `<tr><td>${escapeHtml(tx.dateISO)}</td><td>${escapeHtml(tx.categoryName || "")}</td><td>${tx.type === "expense" ? "Expense" : "Revenue"}</td><td style="text-align:right">${money(tx.amount)}</td><td>${escapeHtml(tx.note || "")}</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report ${month}</title>
<style>
body{font-family:Arial,sans-serif;margin:40px;color:#2d2640;}
h1{font-size:22px;margin-bottom:4px;}
.sub{color:#666;font-size:13px;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;}
th{background:#f4f1fb;font-weight:700;}
.summary{margin-bottom:20px;display:flex;gap:30px;}
.summary div{font-size:14px;}
.summary strong{font-size:18px;}
@media print{body{margin:20px;}}
</style></head><body>
<h1>💰 Account Book — Monthly Report</h1>
<div class="sub">${month}</div>
<div class="summary">
<div>Expense: <strong style="color:#e54360">${money(totalExp)}</strong></div>
<div>Revenue: <strong style="color:#22c55e">${money(totalRev)}</strong></div>
<div>Net: <strong>${money(totalRev - totalExp)}</strong></div>
</div>
<table><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>
<div style="margin-top:20px;color:#999;font-size:11px;">Generated on ${new Date().toLocaleString()}</div>
</body></html>`;

  const printWin = window.open("", "_blank");
  if (printWin) {
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => printWin.print(), 500);
  }
}

/** Scroll to top of the page for pagination UX */
function scrollToRecordList() {
  if (window.scrollY < 10) return; /* Already at top, skip */
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 50);
}

/**
 * Bank / TNG-style amount input.
 * Digits shift right through the decimal: typing "1001" shows "10.01".
 */
function initBankAmountInput(el) {
  let cents = 0;

  function fmt(c) {
    const s = String(c).padStart(3, "0");
    return s.slice(0, -2) + "." + s.slice(-2);
  }

  // Single source of truth: rebuild cents from whatever digits are in the
  // field. This works identically on desktop and mobile. We intentionally do
  // NOT manipulate the value in keydown, because on mobile virtual keyboards
  // preventDefault() does not stop character insertion, which caused each
  // digit to be counted twice (e.g. typing "1" produced "0.11" not "0.01").
  el.addEventListener("input", () => {
    const raw = el.value.replace(/[^0-9]/g, "");
    if (!raw) { cents = 0; el.value = ""; return; }
    cents = Math.min(Number(raw), 9_999_999);
    const formatted = fmt(cents);
    if (el.value !== formatted) {
      el.value = formatted;
      // Keep the caret at the end so the next typed digit is always appended,
      // not inserted mid-string (which would corrupt the value on some mobile
      // keyboards).
      try { el.setSelectionRange(formatted.length, formatted.length); } catch (_) {}
    }
  });

  // Pre-fill from a stored float (e.g. 10.01 → shows "10.01")
  el._bankPrefill = (val) => {
    const n = parseFloat(val);
    cents = isNaN(n) || n <= 0 ? 0 : Math.round(n * 100);
    el.value = cents === 0 ? "" : fmt(cents);
  };
}

function wireEvents() {
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeSidebarBtn = document.getElementById("closeSidebar");
  const sidebarItems = document.querySelectorAll(".sidebar-item");
  const viewSections = document.querySelectorAll(".view-section");

  function openSidebar() {
    if (window.innerWidth >= 980) {
      /* Desktop: toggle collapsed state */
      document.body.classList.toggle("sidebar-collapsed");
      return;
    }
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("open");
    sidebarOverlay.hidden = false;
  }

  function closeSidebar() {
    if (window.innerWidth >= 980) {
      /* Desktop: collapse sidebar */
      document.body.classList.add("sidebar-collapsed");
      return;
    }
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("open");
    setTimeout(() => { sidebarOverlay.hidden = true; }, 300);
  }

  function switchView(viewName) {
    viewSections.forEach((s) => {
      s.classList.toggle("active", s.dataset.view === viewName);
    });
    sidebarItems.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    /* Close sidebar after navigation on all screen sizes */
    if (window.innerWidth < 980) {
      closeSidebar();
    } else {
      document.body.classList.add("sidebar-collapsed");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Auto-generate insights when navigating to that view
    if (viewName === "insights") {
      generateInsights();
    }
    if (viewName === "dashboard") {
      renderDashboard();
      renderTrendChart();
      renderCashflowChart();
    }
    if (viewName === "goals") {
      renderSavingsGoals();
    }
    if (viewName === "targets") {
      renderTargets();
    }
    if (viewName === "recurring") {
      renderRecurringRules();
    }
    if (viewName === "debts") {
      renderDebts();
    }
    if (viewName === "subscriptions") {
      renderSubscriptions();
    }
  }

  if (menuBtn) menuBtn.addEventListener("click", openSidebar);
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSidebar();
    });
  }
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

  sidebarItems.forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view));
  });

  /* -- Quick Add floating button + keyboard shortcuts -- */
  function jumpToAddRecord() {
    switchView("record");
    // Focus the note field so the user can start typing immediately.
    setTimeout(() => {
      const field = els.txNote || els.txCategory;
      if (field) field.focus();
    }, 120);
  }
  if (els.quickAddFab) {
    els.quickAddFab.addEventListener("click", jumpToAddRecord);
  }
  syncFabLayout();
  document.addEventListener("keydown", (e) => {
    // Ignore when typing in an input/textarea/select or a modifier is held.
    const tag = (e.target && e.target.tagName) || "";
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || e.target?.isContentEditable;
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (els.appContent && els.appContent.hidden) return; // only when signed in
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      jumpToAddRecord();
    } else if (e.key === "/") {
      e.preventDefault();
      switchView("records");
      setTimeout(() => els.searchInput && els.searchInput.focus(), 120);
    }
  });

  /* Activate the default view */
  switchView("record");

  /* -- Collapsible sections on mobile -- */
  document.querySelectorAll(".collapsible-toggle").forEach((toggle) => {
    const section = toggle.closest(".collapsible-section");
    if (!section) return;
    const body = section.querySelector(".collapsible-body");
    const chevron = toggle.querySelector(".collapse-chevron");

    const setCollapsed = (collapsed) => {
      if (collapsed) {
        section.classList.add("collapsed");
        toggle.setAttribute("aria-expanded", "false");
        if (chevron) chevron.textContent = "▸";
      } else {
        /* Preserve scroll position so page doesn't jump */
        const prevTop = toggle.getBoundingClientRect().top;
        section.classList.remove("collapsed");
        toggle.setAttribute("aria-expanded", "true");
        if (chevron) chevron.textContent = "▾";
        /* Restore toggle to same visual position */
        const newTop = toggle.getBoundingClientRect().top;
        if (Math.abs(newTop - prevTop) > 2) {
          window.scrollBy(0, newTop - prevTop);
        }
      }
    };

    const doToggle = () => {
      setCollapsed(!section.classList.contains("collapsed"));
    };

    /* Scroll-aware toggle: ignore taps that were really scrolls */
    let _toggleTouchMoved = false;
    let _toggleTouchStartY = 0;
    toggle.addEventListener("touchstart", (e) => {
      _toggleTouchMoved = false;
      _toggleTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    toggle.addEventListener("touchmove", (e) => {
      /* If finger moved more than 10px, it's a scroll, not a tap */
      if (Math.abs(e.touches[0].clientY - _toggleTouchStartY) > 10) {
        _toggleTouchMoved = true;
      }
    }, { passive: true });

    toggle.addEventListener("click", (e) => {
      if (_toggleTouchMoved) { _toggleTouchMoved = false; return; }
      doToggle();
    });
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doToggle(); }
    });

    /* Re-measure when content changes (e.g. new records) */
    if (body) {
      const observer = new MutationObserver(() => {
        /* Update item count badge */
        updateCollapsibleCount(toggle, section);
      });
      observer.observe(body, { childList: true, subtree: true });
    }
  });

  /* Helper: update the count badge on a collapsible toggle */
  function updateCollapsibleCount(toggle, section) {
    const labelEl = toggle.querySelector(".collapsible-label");
    if (!labelEl) return;
    const icon = toggle.dataset.icon || "";
    const label = toggle.dataset.label || "";
    const rows = section.querySelectorAll(".collapsible-body tbody tr");
    /* Don't count empty-state rows */
    const count = Array.from(rows).filter(r => !r.querySelector("td.muted")).length;
    const countBadge = count > 0 ? `<span class="collapsible-count">${count}</span>` : "";
    labelEl.innerHTML = `${icon} ${label} ${countBadge}`;
  }

  if (els.themeToggleBtn) {
    els.themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  els.signOutBtn.addEventListener("click", async () => {
    setAppError("");
    els.signOutBtn.disabled = true;
    try {
      await signOutUser();
    } catch (e) {
      setAppError(friendlyDbError(e));
      els.signOutBtn.disabled = false;
    }
  });

  els.signUpBtn.addEventListener("click", async () => {
    setAuthError("");
    const email = normalizeText(els.authEmail.value);
    const password = String(els.authPassword.value || "");
    if (!email || !password) {
      setAuthError("Please enter email and password.");
      return;
    }
    await withAuthButtonsDisabled(async () => {
      try {
        await signUpWithEmailPassword(email, password);
      } catch (e) {
        setAuthError(friendlyAuthError(e));
      }
    });
  });

  els.signInBtn.addEventListener("click", async () => {
    setAuthError("");
    const email = normalizeText(els.authEmail.value);
    const password = String(els.authPassword.value || "");
    if (!email || !password) {
      setAuthError("Please enter email and password.");
      return;
    }
    await withAuthButtonsDisabled(async () => {
      try {
        await signInWithEmailPassword(email, password);
      } catch (e) {
        setAuthError(friendlyAuthError(e));
      }
    });
  });

  els.googleBtn.addEventListener("click", async () => {
    setAuthError("");
    await withAuthButtonsDisabled(async () => {
      try {
        await signInWithGooglePopup();
      } catch (e) {
        setAuthError(friendlyAuthError(e));
      }
    });
  });

  els.categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAppError("");
    await withDisabled([els.categorySubmitBtn, els.cancelCategoryEdit], async () => {
      try {
        if (editingCategoryId) {
          await updateCategory();
        } else {
          await addCategory();
        }
      } catch (err) {
        setAppError(friendlyDbError(err));
      }
    });
  });

  /* Track scrolling so we don't fire button clicks during scroll */
  let _catScrolling = false;
  els.categoryTbody.addEventListener("touchstart", () => { _catScrolling = false; }, { passive: true });
  els.categoryTbody.addEventListener("touchmove", () => { _catScrolling = true; }, { passive: true });

  els.categoryTbody.addEventListener("click", async (e) => {
    if (_catScrolling) { _catScrolling = false; return; }
    const btn = e.target.closest("button");
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "delete-category") {
        setAppError("");
        const ok = await showConfirmToast("Delete this category? (Transactions in this category are not deleted.)");
        if (!ok) return;

        await withDisabled(btn, async () => {
          try {
            const { categories: categoriesCol } = userCollections(uid);
            const docRef = doc(categoriesCol, id);

            let backup = categories.find((c) => c.id === id) || null;
            if (!backup) {
              const snap = await getDoc(docRef);
              backup = snap.exists() ? { id: snap.id, ...snap.data() } : null;
            }

            await deleteCategoryById(id);

            if (backup) {
              const dataToRestore = stripUndefined({ ...backup });
              delete dataToRestore.id;
              showUndoToast({
                message: `Category deleted. Undo?`,
                onUndo: async () => {
                  await setDoc(docRef, dataToRestore);
                },
              });
            }
          } catch (err) {
            setAppError(friendlyDbError(err));
          }
        });
        return;
      }
      if (action === "edit-category") {
        startCategoryEdit(id);
        return;
      }
    }

    const row = e.target.closest("tr");
    const id = row?.dataset?.categoryId;
    if (!id) return;

    openBudgetRecordsModal(id);
  });

  els.categoryTbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest("button")) return;

    const row = e.target.closest("tr[data-category-id]");
    const id = row?.dataset?.categoryId;
    if (!id) return;

    e.preventDefault();
    openBudgetRecordsModal(id);
  });

  els.txForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAppError("");
    await withDisabled([els.txSubmitBtn, els.cancelTxEdit], async () => {
      try {
        if (editingTransactionId) {
          await updateTransaction();
        } else {
          await addTransaction();
        }
      } catch (err) {
        setAppError(friendlyDbError(err));
      }
    });
  });

  els.txTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === "delete-tx") {
      setAppError("");
      const ok = await showConfirmToast("Delete this record?");
      if (!ok) return;

      await withDisabled(btn, async () => {
        try {
          const { transactions: txCol } = userCollections(uid);
          const docRef = doc(txCol, id);

          let backup = transactions.find((t) => t.id === id) || null;
          if (!backup) {
            const snap = await getDoc(docRef);
            backup = snap.exists() ? { id: snap.id, ...snap.data() } : null;
          }

          await deleteTransactionById(id);

          if (backup) {
            const dataToRestore = stripUndefined({ ...backup });
            delete dataToRestore.id;
            showUndoToast({
              message: "Record deleted. Undo?",
              onUndo: async () => {
                await setDoc(docRef, dataToRestore);
              },
            });
          }
        } catch (err) {
          setAppError(friendlyDbError(err));
        }
      });
      return;
    }
    if (action === "edit-tx") {
      openEditModal(id);
      return;
    }
    if (action === "receipts-tx") {
      openReceiptViewer(id);
      return;
    }
  });

  const debouncedSearch = debounce(() => {
    searchTerm = els.searchInput.value;
    txPage = 1;
    renderTransactionsTable();
  }, 200);
  els.searchInput.addEventListener("input", debouncedSearch);

  els.clearSearchBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    searchTerm = "";
    activeCategoryId = "";
    txPage = 1;
    renderCategoriesTable();
    renderTransactionsTable();
  });

  /* -- Advanced Record List filters -- */
  function syncFiltersFromInputs() {
    filters.dateFrom = els.filterDateFrom ? els.filterDateFrom.value : "";
    filters.dateTo = els.filterDateTo ? els.filterDateTo.value : "";
    filters.type = els.filterType ? els.filterType.value : "";
    filters.category = els.filterCategory ? els.filterCategory.value : "";
    filters.minAmount = els.filterMinAmount ? els.filterMinAmount.value : "";
    filters.maxAmount = els.filterMaxAmount ? els.filterMaxAmount.value : "";
    filters.tag = els.filterTag ? els.filterTag.value : "";
    txPage = 1;
    renderTransactionsTable();
  }
  [
    els.filterDateFrom, els.filterDateTo, els.filterType,
    els.filterCategory, els.filterMinAmount, els.filterMaxAmount,
  ].forEach((el) => {
    if (el) el.addEventListener("change", syncFiltersFromInputs);
  });
  if (els.filterTag) els.filterTag.addEventListener("input", debounce(syncFiltersFromInputs, 250));
  if (els.clearFiltersBtn) {
    els.clearFiltersBtn.addEventListener("click", () => {
      if (els.filterDateFrom) els.filterDateFrom.value = "";
      if (els.filterDateTo) els.filterDateTo.value = "";
      if (els.filterType) els.filterType.value = "";
      if (els.filterCategory) els.filterCategory.value = "";
      if (els.filterMinAmount) els.filterMinAmount.value = "";
      if (els.filterMaxAmount) els.filterMaxAmount.value = "";
      if (els.filterTag) els.filterTag.value = "";
      filters = { dateFrom: "", dateTo: "", type: "", category: "", minAmount: "", maxAmount: "", tag: "" };
      txPage = 1;
      renderTransactionsTable();
    });
  }

  if (els.cancelCategoryEdit) {
    els.cancelCategoryEdit.addEventListener("click", () => {
      cancelCategoryEdit();
    });
  }

  if (els.cancelTxEdit) {
    els.cancelTxEdit.addEventListener("click", () => {
      cancelTxEdit();
    });
  }

  // Quick templates: save current form, apply chip, delete from settings
  if (els.saveTemplateBtn) {
    els.saveTemplateBtn.addEventListener("click", async () => {
      els.saveTemplateBtn.disabled = true;
      try { await saveCurrentAsTemplate(); }
      catch (e) { setAppError(friendlyDbError(e)); }
      finally { els.saveTemplateBtn.disabled = false; }
    });
  }
  if (els.templateChips) {
    els.templateChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='apply-template']");
      if (btn) applyTemplate(btn.dataset.id);
    });
  }
  if (els.templateManageList) {
    els.templateManageList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action='delete-template']");
      if (btn) {
        try { await deleteTemplate(btn.dataset.id); }
        catch (err) { setAppError(friendlyDbError(err)); }
      }
    });
  }

  // Budget alerts toggle
  if (els.toggleBudgetAlertsBtn) {
    els.toggleBudgetAlertsBtn.addEventListener("click", toggleBudgetAlerts);
  }
  updateBudgetAlertsUi();

  // Edit modal event listeners
  if (els.closeEditModal) {
    els.closeEditModal.addEventListener("click", closeEditModal);
  }
  if (els.closeBudgetRecordsModal) {
    els.closeBudgetRecordsModal.addEventListener("click", closeBudgetRecordsModal);
  }
  if (els.editTxCancelBtn) {
    els.editTxCancelBtn.addEventListener("click", closeEditModal);
  }
  if (els.budgetRecordsModal) {
    els.budgetRecordsModal.addEventListener("click", (e) => {
      if (e.target === els.budgetRecordsModal) closeBudgetRecordsModal();
    });
  }

  // Budget records modal search & pagination
  if (els.budgetRecordsSearch) {
    let budgetSearchTimer;
    els.budgetRecordsSearch.addEventListener("input", () => {
      clearTimeout(budgetSearchTimer);
      budgetSearchTimer = setTimeout(() => {
        budgetRecordsSearchTerm = els.budgetRecordsSearch.value.trim();
        budgetRecordsPage = 1;
        syncBudgetRecordsModal();
      }, 200);
    });
  }
  if (els.budgetRecordsPrevBtn) {
    els.budgetRecordsPrevBtn.addEventListener("click", () => {
      budgetRecordsPage = Math.max(1, budgetRecordsPage - 1);
      syncBudgetRecordsModal();
    });
  }
  if (els.budgetRecordsNextBtn) {
    els.budgetRecordsNextBtn.addEventListener("click", () => {
      budgetRecordsPage += 1;
      syncBudgetRecordsModal();
    });
  }
  if (els.budgetRecordsDateFilter) {
    els.budgetRecordsDateFilter.addEventListener("change", () => {
      budgetRecordsDateFilter = els.budgetRecordsDateFilter.value;
      budgetRecordsPage = 1;
      syncBudgetRecordsModal();
    });
  }
  if (els.budgetRecordsClearDate) {
    els.budgetRecordsClearDate.addEventListener("click", () => {
      budgetRecordsDateFilter = "";
      if (els.budgetRecordsDateFilter) els.budgetRecordsDateFilter.value = "";
      budgetRecordsPage = 1;
      syncBudgetRecordsModal();
    });
  }

  if (els.editTxModal) {
    els.editTxModal.addEventListener("click", (e) => {
      if (e.target === els.editTxModal) closeEditModal();
    });
  }
  if (els.editTxForm) {
    els.editTxForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await saveEditModal();
      } catch (err) {
        setAppError(friendlyDbError(err));
      }
    });
  }

  if (els.txPrevBtn) {
    els.txPrevBtn.addEventListener("click", () => {
      txPage = Math.max(1, txPage - 1);
      renderTransactionsTable();
      scrollToRecordList();
    });
  }

  if (els.txNextBtn) {
    els.txNextBtn.addEventListener("click", () => {
      txPage = txPage + 1;
      renderTransactionsTable();
      scrollToRecordList();
    });
  }

  els.refreshStatsBtn.addEventListener("click", () => {
    renderStats();
  });

  els.statsRange.addEventListener("change", () => {
    setStatsInputVisibility();
    renderStats();
  });

  els.statsAnchorDate.addEventListener("change", () => {
    renderStats();
  });

  els.statsMonth.addEventListener("change", () => {
    renderStats();
  });

  els.statsYear.addEventListener("change", () => {
    renderStats();
  });

  els.budgetMonth.addEventListener("change", () => {
    renderBudgetScopeLabel();
    renderCategoriesTable();
    syncBudgetRecordsModal();
    updateCategoryBudgetHint();
    refreshEditingBudgetField();
  });

  if (els.categoryPeriod) {
    els.categoryPeriod.addEventListener("change", updateCategoryBudgetHint);
  }

  // Bank/TNG-style amount inputs
  if (els.txAmount) initBankAmountInput(els.txAmount);
  if (els.editTxAmount) initBankAmountInput(els.editTxAmount);

  // Duplicate detection on form input changes
  const dupFields = [els.txCategory, els.txType, els.txAmount, els.txDate];
  for (const field of dupFields) {
    if (field) field.addEventListener("change", checkDuplicate);
  }
  if (els.txAmount) els.txAmount.addEventListener("input", debounce(checkDuplicate, 300));

  // Auto-categorization on note input
  if (els.txNote) {
    els.txNote.addEventListener("input", debounce(updateAutoCategorySuggestion, 300));
  }

  // Receipt scan
  if (els.scanReceiptBtn) {
    els.scanReceiptBtn.addEventListener("click", openReceiptModal);
  }
  if (els.closeReceiptModal) {
    els.closeReceiptModal.addEventListener("click", closeReceiptModal);
  }
  if (els.receiptModal) {
    els.receiptModal.addEventListener("click", (e) => {
      if (e.target === els.receiptModal) closeReceiptModal();
    });
  }
  if (els.receiptCameraBtn) {
    els.receiptCameraBtn.addEventListener("click", startReceiptCamera);
  }
  if (els.receiptFileInput) {
    els.receiptFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (els.receiptPreview) {
        els.receiptPreview.src = url;
        els.receiptPreview.hidden = false;
      }
      stopReceiptCamera();
      await processReceiptImage(file);
      els.receiptFileInput.value = "";
    });
  }
  if (els.receiptCaptureBtn) {
    els.receiptCaptureBtn.addEventListener("click", async () => {
      const canvas = captureFromVideo();
      if (!canvas) return;
      if (els.receiptPreview) {
        els.receiptPreview.src = canvas.toDataURL("image/png");
        els.receiptPreview.hidden = false;
      }
      await processReceiptImage(canvas);
    });
  }
  if (els.receiptApplyBtn) {
    els.receiptApplyBtn.addEventListener("click", applyReceiptToForm);
  }
  if (els.receiptRetryBtn) {
    els.receiptRetryBtn.addEventListener("click", () => {
      if (els.receiptResult) els.receiptResult.hidden = true;
      if (els.receiptPreview) els.receiptPreview.hidden = true;
      if (els.receiptStatus) els.receiptStatus.textContent = "";
    });
  }

  // Insights
  if (els.refreshInsightsBtn) {
    els.refreshInsightsBtn.addEventListener("click", generateInsights);
  }

  // Quick-fill Today button
  if (els.todayBtn) {
    els.todayBtn.addEventListener("click", () => {
      els.txDate.value = todayISO();
    });
  }

  // Export CSV
  if (els.exportCsvBtn) {
    els.exportCsvBtn.addEventListener("click", () => {
      const term = searchTerm.trim().toLowerCase();
      let data = term
        ? transactions.filter((t) =>
            (t.note || "").toLowerCase().includes(term) ||
            (t.categoryName || "").toLowerCase().includes(term)
          )
        : transactions;
      if (activeCategoryId) {
        data = data.filter((t) => t.categoryId === activeCategoryId);
      }
      data = applyAdvancedFilters(data);
      if (data.length === 0) {
        setAppError("No records to export.");
        return;
      }
      const header = "Date,Category,Type,Amount,Note";
      const csvRows = data.map((t) => {
        const note = String(t.note || "").replace(/"/g, '""');
        const cat = String(t.categoryName || "").replace(/"/g, '""');
        return `${t.dateISO},"${cat}",${t.type},${t.amount},"${note}"`;
      });
      const csv = [header, ...csvRows].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `account-book-${todayISO()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ── Savings Goals ──
  const goalForm = document.getElementById("goalForm");
  if (goalForm) {
    goalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addSavingsGoal();
    });
  }
  const goalsContainer = document.getElementById("goalsContainer");
  if (goalsContainer) {
    goalsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='delete-goal']");
      if (btn && btn.dataset.id) deleteSavingsGoal(btn.dataset.id);
    });
  }

  // ── Life Targets ──
  const targetForm = document.getElementById("targetForm");
  if (targetForm) {
    targetForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addTarget();
    });
  }
  const targetsContainer = document.getElementById("targetsContainer");
  if (targetsContainer) {
    targetsContainer.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest("[data-action='toggle-target']");
      if (toggleBtn && toggleBtn.dataset.id) { toggleTarget(toggleBtn.dataset.id); return; }
      const editBtn = e.target.closest("[data-action='edit-target']");
      if (editBtn && editBtn.dataset.id) { editTarget(editBtn.dataset.id); return; }
      const saveBtn = e.target.closest("[data-action='save-target']");
      if (saveBtn && saveBtn.dataset.id) { saveTarget(saveBtn.dataset.id); return; }
      const cancelBtn = e.target.closest("[data-action='cancel-target']");
      if (cancelBtn) { cancelEditTarget(); return; }
      const delBtn = e.target.closest("[data-action='delete-target']");
      if (delBtn && delBtn.dataset.id) deleteTarget(delBtn.dataset.id);
    });
    // Enter saves the edit, Escape cancels it.
    targetsContainer.addEventListener("keydown", (e) => {
      const input = e.target.closest("[data-edit-text], [data-edit-age]");
      if (!input) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const saveBtn = targetsContainer.querySelector("[data-action='save-target']");
        if (saveBtn && saveBtn.dataset.id) saveTarget(saveBtn.dataset.id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditTarget();
      }
    });
  }
  const targetCurrentAge = document.getElementById("targetCurrentAge");
  if (targetCurrentAge) {
    const savedAge = getCurrentAge();
    if (savedAge != null) targetCurrentAge.value = String(savedAge);
    targetCurrentAge.addEventListener("input", (e) => setCurrentAge(e.target.value));
  }

  // ── Debts / Lending ──
  const debtForm = document.getElementById("debtForm");
  if (debtForm) {
    debtForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addDebt();
    });
  }
  const debtsContainer = document.getElementById("debtsContainer");
  if (debtsContainer) {
    debtsContainer.addEventListener("click", (e) => {
      const settleBtn = e.target.closest("[data-action='settle-debt']");
      if (settleBtn && settleBtn.dataset.id) { settleDebt(settleBtn.dataset.id); return; }
      const delBtn = e.target.closest("[data-action='delete-debt']");
      if (delBtn && delBtn.dataset.id) deleteDebt(delBtn.dataset.id);
    });
  }
  const debtShowSettled = document.getElementById("debtShowSettled");
  if (debtShowSettled) {
    debtShowSettled.addEventListener("change", renderDebts);
  }

  // ── Subscriptions ──
  const subForm = document.getElementById("subForm");
  if (subForm) {
    subForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addSubscription();
    });
  }
  const subsContainer = document.getElementById("subsContainer");
  if (subsContainer) {
    subsContainer.addEventListener("click", (e) => {
      const payBtn = e.target.closest("[data-action='pay-sub']");
      if (payBtn && payBtn.dataset.id) { paySubscription(payBtn.dataset.id); return; }
      const cancelBtn = e.target.closest("[data-action='cancel-sub']");
      if (cancelBtn && cancelBtn.dataset.id) { cancelSubscription(cancelBtn.dataset.id); return; }
      const delBtn = e.target.closest("[data-action='delete-sub']");
      if (delBtn && delBtn.dataset.id) deleteSubscription(delBtn.dataset.id);
    });
  }
  const subShowCancelled = document.getElementById("subShowCancelled");
  if (subShowCancelled) {
    subShowCancelled.addEventListener("change", renderSubscriptions);
  }

  // ── Receipt Photos ──
  const txReceiptInput = document.getElementById("txReceiptInput");
  if (txReceiptInput) {
    txReceiptInput.addEventListener("change", (e) => {
      queuePendingReceipts(e.target.files);
      e.target.value = "";
    });
  }
  const txReceiptPreview = document.getElementById("txReceiptPreview");
  if (txReceiptPreview) {
    txReceiptPreview.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-action='remove-pending']");
      if (removeBtn) {
        removePendingAt(Number(removeBtn.dataset.idx));
        return;
      }
      const img = e.target.closest("img[data-action='view-pending']");
      if (img) openLightbox(img.src);
    });
  }
  const closeReceiptViewerBtn = document.getElementById("closeReceiptViewer");
  if (closeReceiptViewerBtn) closeReceiptViewerBtn.addEventListener("click", closeReceiptViewer);
  const receiptViewerModal = document.getElementById("receiptViewerModal");
  if (receiptViewerModal) {
    receiptViewerModal.addEventListener("click", (e) => {
      if (e.target === receiptViewerModal) closeReceiptViewer();
    });
  }
  const receiptViewerAddInput = document.getElementById("receiptViewerAddInput");
  if (receiptViewerAddInput) {
    receiptViewerAddInput.addEventListener("change", (e) => {
      addReceiptsFromViewer(e.target.files);
      e.target.value = "";
    });
  }
  const receiptViewerGrid = document.getElementById("receiptViewerGrid");
  if (receiptViewerGrid) {
    receiptViewerGrid.addEventListener("click", (e) => {
      const delBtn = e.target.closest("[data-action='delete-receipt']");
      if (delBtn && delBtn.dataset.id) { deleteReceiptFromViewer(delBtn.dataset.id); return; }
      const img = e.target.closest("img[data-action='view-receipt']");
      if (img) openLightbox(img.src);
    });
  }
  const receiptLightbox = document.getElementById("receiptLightbox");
  if (receiptLightbox) receiptLightbox.addEventListener("click", closeLightbox);

  // ── Calendar day detail ──
  const heatmapCalendar = document.getElementById("heatmapCalendar");
  if (heatmapCalendar) {
    heatmapCalendar.addEventListener("click", (e) => {
      const cell = e.target.closest("[data-date]");
      if (cell && cell.dataset.date) openDayDetail(cell.dataset.date);
    });
  }
  const closeDayDetailBtn = document.getElementById("closeDayDetail");
  if (closeDayDetailBtn) closeDayDetailBtn.addEventListener("click", closeDayDetail);
  const dayDetailModal = document.getElementById("dayDetailModal");
  if (dayDetailModal) {
    dayDetailModal.addEventListener("click", (e) => {
      if (e.target === dayDetailModal) closeDayDetail();
    });
  }

  // ── Recurring Transactions ──
  const recurringForm = document.getElementById("recurringForm");
  if (recurringForm) {
    recurringForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addRecurringRule();
    });
  }
  const recurringContainer = document.getElementById("recurringContainer");
  if (recurringContainer) {
    recurringContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action='delete-recurring']");
      if (btn && btn.dataset.id) deleteRecurringRule(btn.dataset.id);
    });
  }
  const runRecurringBtn = document.getElementById("runRecurringBtn");
  if (runRecurringBtn) {
    runRecurringBtn.addEventListener("click", runDueRecurring);
  }

  // ── Settings: Currency ──
  const saveCurrencyBtn = document.getElementById("saveCurrencyBtn");
  if (saveCurrencyBtn) {
    saveCurrencyBtn.addEventListener("click", saveCurrencySymbol);
  }

  // ── Data Export/Import ──
  const exportJsonBtn = document.getElementById("exportJsonBtn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", exportDataAsJson);
  }
  const importJsonInput = document.getElementById("importJsonInput");
  if (importJsonInput) {
    importJsonInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importDataFromJson(file);
      importJsonInput.value = "";
    });
  }

  // ── PDF Report ──
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", generatePdfReport);
  }

  // Escape key cancels editing
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (editingCategoryId) { cancelCategoryEdit(); }
      if (editingTransactionId) { cancelTxEdit(); }
    }
  });
}

async function main() {
  initTheme();

  els.txDate.value = todayISO();
  els.statsAnchorDate.value = todayISO();
  els.statsMonth.value = currentMonthValue();
  setStatsInputVisibility();
  ensureStatsYearOptions();

  els.budgetMonth.value = currentMonthValue();
  renderBudgetScopeLabel();
  updateCategoryBudgetHint();

  wireEvents();
  wireAssistantEvents();

  const init = await initFirebase();
  if (!init.ok) {
    setWarning(init.reason);
    setAuthStatus("Firebase not configured");
    return;
  }

  if (init.redirectError) {
    setAuthError(friendlyAuthError(init.redirectError));
  }

  if (init.persistenceMode === "memory") {
    // In-memory persistence means auth state is lost on full page reload/redirect.
    // This commonly happens in in-app browsers or when storage/cookies are blocked.
    setAuthError(
      "This browser is blocking storage/cookies, so sign-in may not persist. Open this site in Chrome/Safari (not an in-app browser) and try again."
    );
  }

  setWarning("");
  setAuthStatus("Checking session…");

  watchAuth(async (user) => {
    if (!user) {
      setAuthStatus("Signed out");
      setSignedOutUi();
      return;
    }

    const label = user.email || user.displayName || "Signed in";
    setAuthStatus(`Signed in: ${label}`);
    await setSignedInUi(user);
  });
}

main();
