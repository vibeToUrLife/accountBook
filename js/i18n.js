// Tiny translation layer. The English text is the key; `zh` holds the Chinese.
// - t(key, vars)     → translated string with {placeholders} filled in
// - translateDom()   → swaps the text of elements marked data-i18n / data-i18n-html
//                      and the placeholder / title / aria-label attributes
// Anything without a translation falls back to the English key, so a missing
// entry can never blank out the UI.
import { zh } from "./i18n.zh.js";

export { zh };

const LANG_KEY = "accountBook.lang";
const DICTS = { en: null, zh };
const ATTRS = ["placeholder", "title", "aria-label"];

let currentLang = "en";

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== "en" && lang !== "zh") return;
  currentLang = lang;
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, lang);
  } catch {
    // storage blocked (private mode); the choice just won't persist
  }
}

// Saved choice wins; otherwise a Chinese browser gets Chinese, everyone else English.
export function resolveInitialLang(saved, browserLang) {
  if (saved === "zh" || saved === "en") return saved;
  return typeof browserLang === "string" && /^zh\b/i.test(browserLang) ? "zh" : "en";
}

export function initLang() {
  let saved = null;
  try {
    if (typeof localStorage !== "undefined") saved = localStorage.getItem(LANG_KEY);
  } catch {
    // ignore
  }
  const browser = typeof navigator !== "undefined" ? navigator.language : undefined;
  setLang(resolveInitialLang(saved, browser));
  return currentLang;
}

// BCP-47 tag for Intl / toLocaleDateString.
export function locale() {
  return currentLang === "zh" ? "zh-CN" : "en-US";
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function t(key, vars) {
  const dict = DICTS[currentLang];
  const text = dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  return interpolate(text, vars);
}

// ── DOM application ──────────────────────────────────────────────────────────
// Originals are remembered so switching back to English restores the source text.
const textOriginals = new WeakMap();

function translateTextNodes(el) {
  for (const node of el.childNodes) {
    if (node.nodeType !== 3) continue; // text nodes only; child elements are handled by their own marker
    const raw = textOriginals.has(node) ? textOriginals.get(node) : node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!textOriginals.has(node)) textOriginals.set(node, raw);
    const start = raw.indexOf(trimmed);
    node.nodeValue = raw.slice(0, start) + t(trimmed) + raw.slice(start + trimmed.length);
  }
}

function translateMarkup(el) {
  let src = el.getAttribute("data-i18n-src");
  if (src == null) {
    src = el.innerHTML.replace(/\s+/g, " ").trim();
    el.setAttribute("data-i18n-src", src);
  }
  el.innerHTML = t(src);
}

function translateAttributes(scope) {
  for (const attr of ATTRS) {
    const srcAttr = `data-i18n-src-${attr}`;
    for (const el of scope.querySelectorAll(`[${attr}]`)) {
      let src = el.getAttribute(srcAttr);
      if (src == null) {
        src = el.getAttribute(attr);
        el.setAttribute(srcAttr, src);
      }
      el.setAttribute(attr, t(src));
    }
  }
}

export function translateDom(root) {
  if (typeof document === "undefined") return;
  const scope = root || document.body;
  if (!scope) return;
  if (scope.matches && scope.matches("[data-i18n]")) translateTextNodes(scope);
  for (const el of scope.querySelectorAll("[data-i18n]")) translateTextNodes(el);
  for (const el of scope.querySelectorAll("[data-i18n-html]")) translateMarkup(el);
  translateAttributes(scope);
  if (scope === document.body) document.title = t("Account Book");
}
