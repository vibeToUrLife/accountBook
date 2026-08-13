// Pure, stateless helper functions shared across the app.
// These intentionally have no dependency on app state (DOM, Firebase, globals),
// which makes them easy to test and safe to reuse.

/** Today's date as a YYYY-MM-DD string (local time). */
export function todayISO() {
  return dateObjToISO(new Date());
}

/** Convert a Date object to a YYYY-MM-DD string (local time). */
export function dateObjToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Current month as a YYYY-MM string. */
export function currentMonthValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Start of the week (Monday) at 00:00:00. */
export function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

/** Start of the month at 00:00:00. */
export function startOfMonth(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/** Start of the year at 00:00:00. */
export function startOfYear(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMonth(0, 1);
  return d;
}

/** Return a new Date offset by `days` (can be negative). */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Debounce a function by `ms` milliseconds. */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Parse a value into a positive amount rounded to 2 decimals, or null. */
export function parsePositiveAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** Trim a value to a clean string. */
export function normalizeText(s) {
  return String(s || "").trim();
}

/** Clamp a number between min and max. */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Escape a string for safe insertion into HTML. */
export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Inline SVG icon markup referencing a #i-<name> sprite symbol in index.html.
 * Use in template strings, e.g. `${icon("wallet")}` or `${icon("x", "icon-sm")}`.
 */
export function icon(name, cls = "") {
  return `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

/**
 * Parse a comma-separated tag string into a clean, de-duplicated array.
 * Lowercases, trims, drops empties, caps at 8 tags of 20 chars each.
 */
export function parseTags(value) {
  if (!value) return [];
  const seen = new Set();
  const out = [];
  for (const raw of String(value).split(",")) {
    const t = raw.trim().toLowerCase().slice(0, 20);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= 8) break;
    }
  }
  return out;
}
