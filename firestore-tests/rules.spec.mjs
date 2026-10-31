// Tests for ../firestore.rules against the Firestore emulator.
// Run:  cd firestore-tests && npm ci && npm test   (needs Java for the emulator)
// Named *.spec.mjs so the app's own `node --test` (repo root) doesn't pick it up.
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, orderBy,
  writeBatch, runTransaction, serverTimestamp,
} from "firebase/firestore";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-accountbook",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
// A record exactly as the app writes it (saveTransaction in app.js).
const record = (fields = {}) => ({
  categoryId: "c1", categoryName: "Food", type: "expense", amount: 12.5,
  note: "lunch", noteLower: "lunch", tags: [], dateISO: "2026-10-31",
  receiptCount: 0, createdAt: serverTimestamp(), ...fields,
});
// Put data in place without going through the rules.
const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

test("the owner can add, read, change and delete their records", async () => {
  const db = as("alice");
  const ref = doc(db, "users/alice/transactions/t1");
  await assertSucceeds(setDoc(ref, record()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(setDoc(ref, { receiptCount: 2 }, { merge: true }));
  await assertSucceeds(setDoc(ref, { amount: 20, note: "dinner", updatedAt: serverTimestamp() }, { merge: true }));
  await assertSucceeds(deleteDoc(ref));
});

test("the app's own write patterns pass", async () => {
  const db = as("alice");
  // Record + photos in one batch, as when a record is saved with photos.
  const batch = writeBatch(db);
  batch.set(doc(db, "users/alice/transactions/t1"), record({ receiptCount: 1 }));
  batch.set(doc(db, "users/alice/transactions/t1/receipts/p1"), { dataUrl: "data:image/jpeg;base64,AAAA", createdAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  // The listeners' query.
  await assertSucceeds(getDocs(query(collection(db, "users/alice/transactions"), orderBy("createdAt", "desc"))));
  await assertSucceeds(getDocs(collection(db, "users/alice/transactions/t1/receipts")));
  // Recurring catch-up: read the rule, write the month's record, mark the rule.
  await seed("users/alice/recurring/r1", { categoryId: "c1", type: "expense", amount: 1200, note: "rent", dayOfMonth: 31, startISO: "2026-08-01" });
  await assertSucceeds(runTransaction(db, async (tr) => {
    const rule = await tr.get(doc(db, "users/alice/recurring/r1"));
    const month = await tr.get(doc(db, "users/alice/transactions/rec_r1_2026-10"));
    if (!rule.exists() || month.exists()) throw new Error("unexpected state");
    tr.set(doc(db, "users/alice/transactions/rec_r1_2026-10"), record({ amount: 1200, note: "rent", recurringRuleId: "r1", dateISO: "2026-10-31" }));
    tr.set(doc(db, "users/alice/recurring/r1"), { lastPostedMonth: "2026-10" }, { merge: true });
  }));
  // Settings, as saved from the Settings screen.
  await assertSucceeds(setDoc(doc(db, "users/alice/settings/preferences"), { currencySymbol: "RM" }, { merge: true }));
});

test("nobody else can read or write a user's data", async () => {
  await seed("users/alice/transactions/t1", record());
  await seed("users/alice/categories/c1", { name: "Food" });
  await seed("users/alice/transactions/t1/receipts/p1", { dataUrl: "data:image/jpeg;base64,AAAA" });
  for (const db of [as("bob"), anonymous()]) {
    await assertFails(getDoc(doc(db, "users/alice/transactions/t1")));
    await assertFails(getDocs(collection(db, "users/alice/transactions")));
    await assertFails(setDoc(doc(db, "users/alice/transactions/t2"), record()));
    await assertFails(deleteDoc(doc(db, "users/alice/transactions/t1")));
    await assertFails(getDoc(doc(db, "users/alice/categories/c1")));
    await assertFails(setDoc(doc(db, "users/alice/categories/c2"), { name: "x" }));
    await assertFails(getDoc(doc(db, "users/alice/transactions/t1/receipts/p1")));
    await assertFails(getDoc(doc(db, "users/alice/settings/preferences")));
  }
});

test("records with the wrong shape are rejected", async () => {
  const db = as("alice");
  const bad = [
    { amount: "50" }, { amount: 0 }, { amount: -5 },
    { type: "gift" }, { dateISO: "31/10/2026" }, { dateISO: 20261031 },
    { categoryId: 7 }, { note: "x".repeat(501) },
  ];
  for (const [i, fields] of bad.entries()) {
    await assertFails(setDoc(doc(db, `users/alice/transactions/bad${i}`), record(fields)));
  }
  const missing = record();
  delete missing.categoryId;
  await assertFails(setDoc(doc(db, "users/alice/transactions/nocat"), missing));
});

test("an update that would break a record is rejected", async () => {
  await seed("users/alice/transactions/t1", record());
  const db = as("alice");
  await assertFails(setDoc(doc(db, "users/alice/transactions/t1"), { amount: "abc" }, { merge: true }));
  await assertFails(setDoc(doc(db, "users/alice/transactions/t1"), { type: "other" }, { merge: true }));
});

test("the currency label is limited to 5 characters", async () => {
  const db = as("alice");
  await assertSucceeds(setDoc(doc(db, "users/alice/settings/preferences"), { currencySymbol: "RM" }));
  await assertFails(setDoc(doc(db, "users/alice/settings/preferences"), { currencySymbol: "<img src=x>" }));
  await assertFails(setDoc(doc(db, "users/alice/settings/preferences"), { currencySymbol: 5 }));
});

test("receipt photos must be a data string", async () => {
  await seed("users/alice/transactions/t1", record());
  const db = as("alice");
  await assertSucceeds(setDoc(doc(db, "users/alice/transactions/t1/receipts/p1"), { dataUrl: "data:image/jpeg;base64,AAAA" }));
  await assertFails(setDoc(doc(db, "users/alice/transactions/t1/receipts/p2"), { dataUrl: 42 }));
});

test("the other collections work for their owner", async () => {
  const db = as("alice");
  for (const name of ["categories", "savingsGoals", "targets", "recurring", "templates", "debts", "subscriptions"]) {
    await assertSucceeds(setDoc(doc(db, `users/alice/${name}/x1`), { name: "test", amount: 1 }));
    await assertSucceeds(getDocs(collection(db, `users/alice/${name}`)));
    await assertSucceeds(deleteDoc(doc(db, `users/alice/${name}/x1`)));
  }
});

test("anything else is denied", async () => {
  const db = as("alice");
  await assertFails(setDoc(doc(db, "users/alice/secrets/x"), { a: 1 }));
  await assertFails(getDocs(collection(db, "users/alice/secrets")));
  await assertFails(setDoc(doc(db, "public/x"), { a: 1 }));
  await assertFails(getDocs(collection(db, "users")));
});
