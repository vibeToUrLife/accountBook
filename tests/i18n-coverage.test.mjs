// Guards against untranslated UI text: every string handed to t() / tr() in the
// JavaScript sources must have a Chinese entry, and so must the keys used in
// the few ternary calls the literal scan cannot see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { zh } from "../js/i18n.js";

const root = new URL("../", import.meta.url);
const files = [
  new URL("app.js", root),
  ...readdirSync(new URL("js/features/", root)).map((f) => new URL(`js/features/${f}`, root)),
];

function literalKeys() {
  const keys = new Set();
  const re = /\btr?\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
  for (const f of files) {
    const src = readFileSync(f, "utf-8");
    for (const m of src.matchAll(re)) {
      keys.add((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
  return keys;
}

test("every literal t() key in the sources has a Chinese translation", () => {
  const keys = literalKeys();
  assert.ok(keys.size > 200, `expected a large key set, got ${keys.size}`);
  const missing = [...keys].filter((k) => !Object.prototype.hasOwnProperty.call(zh, k));
  assert.deepEqual(missing, []);
});

test("keys chosen at runtime (ternaries, day names) are translated too", () => {
  const runtimeKeys = [
    "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    "weekends", "weekdays",
    "{pct}% more", "{pct}% less",
    "Withdrew {amount} from {goal}.", "Added {amount} to {goal}.",
    "Deposit", "Withdraw",
  ];
  const missing = runtimeKeys.filter((k) => !Object.prototype.hasOwnProperty.call(zh, k));
  assert.deepEqual(missing, []);
});

test("translations keep every {placeholder} of their English key", () => {
  const bad = [];
  for (const [k, v] of Object.entries(zh)) {
    const wanted = k.match(/\{\w+\}/g) || [];
    for (const ph of wanted) if (!v.includes(ph)) bad.push(`${k} → missing ${ph}`);
  }
  assert.deepEqual(bad, []);
});
