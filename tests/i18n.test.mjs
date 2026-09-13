import { test } from "node:test";
import assert from "node:assert/strict";
import { t, getLang, setLang, resolveInitialLang, zh } from "../js/i18n.js";

test("t returns the English key unchanged while the language is English", () => {
  setLang("en");
  assert.equal(getLang(), "en");
  assert.equal(t("Add Record"), "Add Record");
});

test("t returns the Chinese translation while the language is Chinese", () => {
  setLang("zh");
  assert.equal(getLang(), "zh");
  assert.equal(t("Add Record"), zh["Add Record"]);
  assert.ok(zh["Add Record"] && zh["Add Record"] !== "Add Record");
  setLang("en");
});

test("t falls back to the English key when a translation is missing", () => {
  setLang("zh");
  assert.equal(t("This sentence has no translation"), "This sentence has no translation");
  setLang("en");
});

test("t fills {placeholders} from the vars object in both languages", () => {
  setLang("en");
  assert.equal(t("Showing {start}-{end} of {total}", { start: 1, end: 10, total: 42 }), "Showing 1-10 of 42");
  setLang("zh");
  const out = t("Showing {start}-{end} of {total}", { start: 1, end: 10, total: 42 });
  assert.doesNotMatch(out, /\{start\}|\{end\}|\{total\}/);
  assert.match(out, /1/);
  assert.match(out, /42/);
  setLang("en");
});

test("setLang ignores unknown languages", () => {
  setLang("en");
  setLang("fr");
  assert.equal(getLang(), "en");
});

test("resolveInitialLang prefers the saved choice, then the browser language", () => {
  assert.equal(resolveInitialLang("zh", "en-US"), "zh");
  assert.equal(resolveInitialLang("en", "zh-CN"), "en");
  assert.equal(resolveInitialLang(null, "zh-CN"), "zh");
  assert.equal(resolveInitialLang(null, "zh-TW"), "zh");
  assert.equal(resolveInitialLang(null, "en-GB"), "en");
  assert.equal(resolveInitialLang(null, undefined), "en");
});

test("the Chinese dictionary has no empty or untranslated entries", () => {
  const bad = Object.entries(zh).filter(([k, v]) => typeof v !== "string" || !v.trim() || v === k);
  assert.deepEqual(bad, []);
});
