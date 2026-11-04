// Checks the real app in Chromium (iPhone-sized, UTC+8, fixed clock), with
// Firebase replaced by the in-memory stand-in in ./stubs.
// Run:  cd browser-tests && npm ci && npm test
// Named *.spec.mjs so the app's own `node --test` (repo root) doesn't pick it up.
import { test, before, after } from "node:test";
import {
  chromium, startServer, openApp, signedIn, docs, storeKeys, view, settle, resume, checks,
  U, ts, cat, PNG,
} from "./lib.mjs";

let browser, server, base;
before(async () => {
  ({ server, base } = await startServer());
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

const tx = (id, catId, amount, type, dateISO, extra = {}) =>
  [U + "transactions/" + id, { categoryId: catId, categoryName: "", type, amount, note: "", dateISO, createdAt: ts(dateISO + "T03:00:00Z"), ...extra }];

// ── Recurring transactions ──────────────────────────────────────────────────

test("recurring: missed months, day 31, older rules, Undo", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: [
    cat("c1", "Rent"),
    [U + "recurring/r1", { categoryId: "c1", categoryName: "Rent", type: "expense", amount: 1200, note: "rent", dayOfMonth: 31, startISO: "2026-08-01", lastPostedMonth: "2026-08", createdAt: ts("2026-08-01T00:00:00Z") }],
    [U + "recurring/r2", { categoryId: "c1", categoryName: "Rent", type: "expense", amount: 30, note: "netflix", dayOfMonth: 5, createdAt: ts("2026-08-02T00:00:00Z") }],
    [U + "recurring/r3", { categoryId: "c1", categoryName: "Rent", type: "expense", amount: 9, note: "new", dayOfMonth: 5, startISO: "2026-10-20", createdAt: ts("2026-10-20T00:00:00Z") }],
    tx("old1", "c1", 30, "expense", "2026-10-05", { note: "netflix" }),
  ] });
  try {
    await settle(page, 800);
    let txs = await docs(page, U + "transactions/");
    const rules = await docs(page, U + "recurring/");
    check("missed September (day 31 → Sep 30) and October are recorded",
      txs["rec_r1_2026-09"]?.dateISO === "2026-09-30" && txs["rec_r1_2026-10"]?.dateISO === "2026-10-31", JSON.stringify(Object.keys(txs)));
    check("a month the old app already recorded isn't added again", !Object.keys(txs).some((k) => k.startsWith("rec_r2")) && Object.keys(txs).length === 3);
    check("rules remember the last recorded month",
      rules.r1.lastPostedMonth === "2026-10" && rules.r2.lastPostedMonth === "2026-10" && rules.r2.startISO === "2026-10-01" && !rules.r3.lastPostedMonth);
    check("toast offers Undo for the 2 records", /Auto-added 2/.test(await page.textContent("#undoText")) && !(await page.isHidden("#undoToast")));
    await resume(page); await settle(page); await resume(page); await settle(page);
    check("returning to the app adds nothing more", Object.keys(await docs(page, U + "transactions/")).length === 3);
    await page.click("#undoBtn"); await settle(page);
    txs = await docs(page, U + "transactions/");
    check("Undo removes the auto-added records", Object.keys(txs).length === 1 && !!txs.old1);
    await resume(page); await settle(page, 700);
    check("…and they aren't added back", Object.keys(await docs(page, U + "transactions/")).length === 1);
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

test("recurring: a device with an out-of-date cache doesn't record a month twice", async () => {
  const check = checks();
  const rule = { categoryId: "c1", categoryName: "Rent", type: "expense", amount: 1200, note: "rent", dayOfMonth: 31, startISO: "2026-08-01", createdAt: ts("2026-08-01T00:00:00Z") };
  const { ctx, page } = await openApp(browser, base, {
    seed: [cat("c1", "Rent"), [U + "recurring/r1", { ...rule, lastPostedMonth: "2026-10" }],
      tx("rec_r1_2026-09", "c1", 1200, "expense", "2026-09-30", { note: "rent" }),
      tx("rec_r1_2026-10", "c1", 1250, "expense", "2026-10-31", { note: "rent (edited)" })],
    stale: { "users/u1/recurring": [["r1", { ...rule, lastPostedMonth: "2026-08" }]], "users/u1/transactions": [] },
  });
  try {
    await settle(page, 800);
    const txs = await docs(page, U + "transactions/");
    check("nothing recorded twice; the edited October record is untouched",
      Object.keys(txs).length === 2 && txs["rec_r1_2026-10"].amount === 1250 && txs["rec_r1_2026-10"].note === "rent (edited)");
    check("no 'Auto-added' toast", await page.isHidden("#undoToast"));
  } finally {
    await ctx.close();
  }
  check.done();
});

test("recurring: offline at launch, recorded once back online", async () => {
  const check = checks();
  const { ctx, page } = await openApp(browser, base, {
    seed: [cat("c1", "Rent"), [U + "recurring/r1", { categoryId: "c1", type: "expense", amount: 50, note: "phone", dayOfMonth: 10, startISO: "2026-09-01", lastPostedMonth: "2026-09", createdAt: ts("2026-09-01T00:00:00Z") }]],
    init: () => { window.__OFFLINE = true; },
  });
  try {
    await settle(page, 700);
    const err = (await page.textContent("#appError").catch(() => "")) || "";
    check("offline: nothing recorded, no error shown", Object.keys(await docs(page, U + "transactions/")).length === 0 && !err.trim(), err);
    await page.evaluate(() => { window.__OFFLINE = false; window.dispatchEvent(new Event("online")); });
    await settle(page, 700);
    const txs = await docs(page, U + "transactions/");
    check("back online: October is recorded", txs["rec_r1_2026-10"]?.dateISO === "2026-10-10", JSON.stringify(Object.keys(txs)));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Subscriptions ───────────────────────────────────────────────────────────

test("subscriptions: renewal dates and Pay & Record", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: [cat("c1", "Bills"),
    [U + "subscriptions/s1", { name: "Netflix", categoryId: "c1", categoryName: "Bills", amount: 50, cycle: "month", nextRenewal: "2026-10-15", status: "active", createdAt: ts("2026-01-01T00:00:00Z") }],
    [U + "subscriptions/s2", { name: "Gym", categoryId: "c1", categoryName: "Bills", amount: 100, cycle: "month", nextRenewal: "2026-10-31", renewalDay: 31, status: "active", createdAt: ts("2026-01-02T00:00:00Z") }]] });
  try {
    await view(page, "subscriptions"); await settle(page, 300);
    await page.evaluate(() => { const b = document.querySelector('[data-action="pay-sub"][data-id="s1"]'); b.click(); b.click(); });
    await settle(page);
    await page.evaluate(() => { const b = document.querySelector('[data-action="pay-sub"][data-id="s1"]'); if (b && !b.disabled) b.click(); });
    await settle(page);
    const txs = await docs(page, U + "transactions/");
    let subs = await docs(page, U + "subscriptions/");
    check("three taps record one expense", Object.keys(txs).filter((k) => k.startsWith("sub_s1_")).length === 1 && txs["sub_s1_2026-10-15"]?.amount === 50, JSON.stringify(Object.keys(txs)));
    check("Oct 15 → Nov 15 (no day lost in UTC+8)", subs.s1.nextRenewal === "2026-11-15" && subs.s1.renewalDay === 15, subs.s1.nextRenewal);
    await page.evaluate(() => document.querySelector('[data-action="pay-sub"][data-id="s2"]').click());
    await settle(page);
    subs = await docs(page, U + "subscriptions/");
    check("Oct 31 → Nov 30", subs.s2.nextRenewal === "2026-11-30", subs.s2.nextRenewal);
    await ctx.clock.setFixedTime(new Date("2026-11-30T10:00:00+08:00"));
    await page.evaluate(() => window.__notify()); await settle(page, 300);
    await page.evaluate(() => document.querySelector('[data-action="pay-sub"][data-id="s2"]').click());
    await settle(page);
    subs = await docs(page, U + "subscriptions/");
    check("Nov 30 → Dec 31 (back on the 31st)", subs.s2.nextRenewal === "2026-12-31", subs.s2.nextRenewal);
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Budgets and amounts ─────────────────────────────────────────────────────

test("budgets: per-month amounts, rounding, refunds", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: [
    [U + "settings/preferences", { currencySymbol: "RM" }],
    cat("food", "Food", { budget: 600, monthlyBudgets: { "2026-08": 500, "2026-10": 600 } }),
    cat("test", "Test", { budget: 0.3, monthlyBudgets: { "2026-10": 0.3 } }),
    cat("shop", "Shop", { budget: 500, monthlyBudgets: { "2026-10": 500 } }),
    tx("t1", "test", 0.1, "expense", "2026-10-02"), tx("t2", "test", 0.2, "expense", "2026-10-03"),
    tx("t4", "shop", 520, "expense", "2026-10-05"), tx("t5", "shop", 50, "revenue", "2026-10-06"),
  ] });
  try {
    await view(page, "budget"); await settle(page, 300);
    const card = (id) => page.evaluate((id) => document.querySelector(`tr[data-category-id="${id}"]`)?.innerText || "", id);
    const testCard = await card("test");
    check("RM0.30 budget, 0.10 + 0.20 spent: 'Fully used', not 'Over by RM0.00'", /fully used/i.test(testCard) && !/over by/i.test(testCard), testCard.replace(/\s+/g, " "));
    const shopCard = await card("shop");
    check("a refund counts against spending: no 'Over by' next to a positive balance", !/over by/i.test(shopCard) && /RM30\.00/.test(shopCard), shopCard.replace(/\s+/g, " "));
    await page.fill("#budgetMonth", "2026-09"); await page.dispatchEvent("#budgetMonth", "change"); await settle(page, 300);
    const sep = await card("food");
    check("September keeps August's RM500 after October became RM600", /RM500\.00/.test(sep) && !/RM600\.00/.test(sep), sep.replace(/\s+/g, " "));
    await page.fill("#budgetMonth", "2026-11"); await page.dispatchEvent("#budgetMonth", "change"); await settle(page, 300);
    check("November carries October's RM600 forward", /RM600\.00/.test(await card("food")));
    check("nothing shows -0.00", !(await page.evaluate(() => document.body.innerText.includes("-0.00"))));
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Deleting with Undo ──────────────────────────────────────────────────────

test("delete + Undo keeps a record's photos; they go once Undo expires", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: [cat("c1", "Food"),
    tx("t1", "c1", 12, "expense", "2026-10-30", { categoryName: "Food", note: "lunch", receiptCount: 1 }),
    [U + "transactions/t1/receipts/p1", { dataUrl: "data:image/png;base64,AAAA", createdAt: ts("2026-10-30T04:00:01Z") }]] });
  try {
    await view(page, "records"); await settle(page, 300);
    const del = async () => {
      await page.evaluate(() => document.querySelector('[data-action="delete-tx"][data-id="t1"]').click());
      await page.waitForSelector("#confirmToast:not([hidden])");
      await page.click("#confirmYesBtn"); await settle(page, 300);
    };
    await del();
    let keys = await storeKeys(page);
    check("delete keeps the photo during the Undo window", !keys.includes(U + "transactions/t1") && keys.includes(U + "transactions/t1/receipts/p1"));
    await page.click("#undoBtn"); await settle(page, 400);
    keys = await storeKeys(page);
    const realTimestamp = await page.evaluate(() => typeof window.__store.get("users/u1/transactions/t1")?.createdAt?.toMillis === "function");
    check("Undo brings back the record with its photo and timestamp", keys.includes(U + "transactions/t1") && keys.includes(U + "transactions/t1/receipts/p1") && realTimestamp);
    await del();
    await page.waitForTimeout(5800);
    keys = await storeKeys(page);
    const queue = await page.evaluate(() => localStorage.getItem("accountBook.receiptPurge"));
    check("after the Undo window the photo is deleted too", !keys.includes(U + "transactions/t1/receipts/p1") && !queue, queue || "");
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Backup import ───────────────────────────────────────────────────────────

test("import: links kept, junk dropped, no markup, no duplicates", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base);
  try {
    await view(page, "settings"); await settle(page, 200);
    const backup = {
      categories: [{ id: "catA", name: "Food", budget: 300, monthlyBudgets: { "2026-10": 300 }, createdAt: "2026-08-01T00:00:00.000Z" }],
      transactions: [{ id: "txA", categoryId: "catA", amount: "12.50", type: "expense", dateISO: "2026-10-01", note: "Lunch", createdAt: { seconds: 1790000000, nanoseconds: 0 } }, { id: "bad", categoryId: "catA", amount: "abc" }],
      savingsGoals: [{ id: "g1", name: "Trip", target: 1000, contributions: [{ id: "k1", amount: 200, kind: "deposit", dateISO: "2026-09-01" }] }],
      templates: [{ id: "tp1", label: "Car", categoryId: "catA", amount: 50, type: "expense" }],
      settings: { currencySymbol: "<img src=x onerror=window.__pwned=1>" },
    };
    const file = { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) };
    const importFile = async () => {
      await page.setInputFiles("#importJsonInput", file);
      await page.waitForSelector("#confirmToast:not([hidden])");
      const label = await page.textContent("#confirmYesBtn");
      await page.click("#confirmYesBtn"); await settle(page, 500);
      return label;
    };
    const label = await importFile();
    check("the confirm button says 'Restore'", label.trim() === "Restore", label);
    const cats = await docs(page, U + "categories/");
    const txs = await docs(page, U + "transactions/");
    const goals = await docs(page, U + "savingsGoals/");
    const settings = await page.evaluate(() => JSON.parse(JSON.stringify(window.__store.get("users/u1/settings/preferences") || {})));
    check("records keep their ids and stay linked to their category", !!cats.catA && !!txs.txA && txs.txA.categoryId === "catA" && txs.txA.amount === 12.5);
    const status = await page.textContent("#importStatus");
    check("the invalid entry is skipped and reported", !txs.bad && /Skipped 1 invalid/.test(status), status);
    check("goal deposits and templates are restored", goals.g1?.contributions?.length === 1 && !!(await docs(page, U + "templates/")).tp1);
    check("the currency symbol can't inject markup", !/[<>]/.test(settings.currencySymbol || "") && !(await page.evaluate(() => window.__pwned)), settings.currencySymbol);
    await importFile();
    check("importing again doesn't duplicate anything",
      Object.keys(await docs(page, U + "categories/")).length === 1 && Object.keys(await docs(page, U + "transactions/")).length === 1);
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Dates after midnight ────────────────────────────────────────────────────

test("resumed after midnight: the default date moves to the new day", async () => {
  const check = checks();
  const { ctx, page } = await openApp(browser, base, { seed: [cat("c1", "Food")], now: "2026-10-31T23:59:00+08:00" });
  try {
    const before = await page.inputValue("#txDate");
    await ctx.clock.setFixedTime(new Date("2026-11-01T08:00:00+08:00"));
    await resume(page); await settle(page, 200);
    const afterResume = await page.inputValue("#txDate");
    check("Oct 31 → Nov 1 when the app comes back", before === "2026-10-31" && afterResume === "2026-11-01", `${before} → ${afterResume}`);
    await page.fill("#txDate", "2026-10-20");
    await ctx.clock.setFixedTime(new Date("2026-11-02T08:00:00+08:00"));
    await resume(page); await settle(page, 200);
    check("a date the user picked is left alone", (await page.inputValue("#txDate")) === "2026-10-20");
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Layout ──────────────────────────────────────────────────────────────────

test("layout on a phone: fits the screen, no iOS zoom, translated labels, readable dark mode", async () => {
  const check = checks();
  const { ctx, page, requests } = await openApp(browser, base, { seed: [cat("c1", "Food"),
    tx("t1", "c1", 12, "expense", "2026-10-30", { categoryName: "Food", note: "lunch" })], lang: "zh", theme: "dark" });
  try {
    const fonts = requests.filter((u) => u.includes("fonts.googleapis.com"));
    check("the unused Orbitron font isn't requested", fonts.length > 0 && !fonts.some((u) => /Orbitron/.test(u)), fonts[0] || "no font request");
    const views = await page.evaluate(() => [...document.querySelectorAll(".sidebar-item")].map((b) => b.dataset.view));
    const small = [];
    let widest = 0;
    for (const v of views) {
      await view(page, v); await settle(page, 150);
      const r = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        small: [...document.querySelectorAll("input, select, textarea")]
          .filter((el) => el.offsetParent !== null && !["file", "checkbox", "radio"].includes(el.type) && parseFloat(getComputedStyle(el).fontSize) < 16)
          .map((el) => `${el.id || el.className || el.tagName}:${getComputedStyle(el).fontSize}`),
      }));
      widest = Math.max(widest, r.w);
      if (r.small.length) small.push(`${v}: ${r.small.join(", ")}`);
      if (v === "stats") check("Statistics fits the 393px screen", r.w <= 393, `scrollWidth ${r.w}`);
    }
    check("every visible field is at least 16px (no iOS zoom)", small.length === 0, small.join(" | "));
    check("no screen scrolls sideways", widest <= 393, `widest ${widest}`);
    await view(page, "records"); await settle(page, 200);
    const label = await page.evaluate(() => document.querySelector("td[data-label]")?.getAttribute("data-label"));
    check("record card labels are translated", label === "日期", label);
    const bg = await page.evaluate(() => { const b = document.querySelector('[data-action="delete-tx"]'); return b ? getComputedStyle(b).backgroundColor : ""; });
    check("dark-mode Delete button uses the deeper red", bg === "rgb(185, 28, 28)", bg);
  } finally {
    await ctx.close();
  }
  check.done();
});

test("header logo: the app's own icon, kept through translation and cached for offline", async () => {
  const check = checks();
  for (const [lang, title, menu] of [["en", "Account Book", "Menu"], ["zh", "记账本", "菜单"]]) {
    const { ctx, page } = await openApp(browser, base, { seed: [cat("c1", "Food")], lang });
    try {
      const r = await page.evaluate(async () => {
        const icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
        const logos = [".app-header h1 img", ".sidebar-header h2 img"].map((s) => {
          const img = document.querySelector(s);
          return img && { src: img.getAttribute("src"), alt: img.getAttribute("alt"), loaded: img.complete && img.naturalWidth > 0 };
        });
        const sw = await (await fetch("./sw.js")).text();
        return {
          icon, logos, precached: sw.includes(`"${icon}"`),
          title: document.querySelector(".app-header h1").textContent.trim(),
          menu: document.querySelector(".sidebar-header h2").textContent.trim(),
        };
      });
      check(`${lang}: header and menu show the app icon (the browser icon's file)`, r.logos.every((l) => l && l.src === r.icon), JSON.stringify(r.logos));
      check(`${lang}: the icon loads`, r.logos.every((l) => l?.loaded));
      check(`${lang}: decorative (empty alt), headings read "${title}" / "${menu}"`,
        r.logos.every((l) => l?.alt === "") && r.title === title && r.menu === menu, `${r.title} / ${r.menu}`);
      if (lang === "en") check("the icon is in the service worker's offline cache", r.precached, r.icon);
    } finally {
      await ctx.close();
    }
  }
  check.done();
});

// ── Adding records ──────────────────────────────────────────────────────────

const formSeed = [cat("c1", "Food"), cat("c2", "Transport"), cat("c3", "Rental"),
  [U + "settings/preferences", { currencySymbol: "RM" }],
  [U + "templates/tp1", { label: "Car wash", categoryId: "c2", categoryName: "Transport", type: "expense", amount: 15, note: "car wash", createdAt: ts("2026-09-01T00:00:00Z") }],
  [U + "templates/tp2", { label: "Petrol", categoryId: "c2", categoryName: "Transport", type: "expense", amount: 0, note: "petrol", createdAt: ts("2026-09-02T00:00:00Z") }]];

test("add record: instant save, feedback, Undo, offline, photos", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: formSeed });
  try {
    const btn = await page.evaluate(() => { const r = document.getElementById("txSubmitBtn").getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
    check("Record is on screen without scrolling", btn.bottom <= 852 && btn.top > 0, JSON.stringify(btn));
    const fabs = await page.evaluate(() => {
      const shown = (el) => el && getComputedStyle(el).display !== "none" && !el.hidden;
      const rec = document.getElementById("txSubmitBtn").getBoundingClientRect();
      const mic = document.getElementById("assistantFab").getBoundingClientRect();
      return { plus: shown(document.getElementById("quickAddFab")), overlap: !(mic.right <= rec.left || mic.left >= rec.right || mic.bottom <= rec.top || mic.top >= rec.bottom) };
    });
    check("no '+' button on Add Record; the mic doesn't cover Record", !fabs.plus && !fabs.overlap, JSON.stringify(fabs));
    await page.type("#txAmount", "0");
    await page.click("#txSubmitBtn"); await settle(page, 200);
    const err = await page.evaluate(() => { const e = document.getElementById("txFormError"); return e.hidden ? "" : e.textContent; });
    check("amount 0.00: message next to the button, nothing saved", /greater than 0/.test(err) && Object.keys(await docs(page, U + "transactions/")).length === 0, err);
    await page.fill("#txAmount", "");
    await page.selectOption("#txCategory", "c2");
    await page.type("#txAmount", "1250");
    await page.fill("#txNote", "grab home");
    await page.click("#txSubmitBtn"); await settle(page);
    let txs = Object.values(await docs(page, U + "transactions/"));
    const toast = await page.textContent("#undoText");
    check("saved with 'Saved RM12.50 · Transport' and the form cleared",
      txs.length === 1 && txs[0].amount === 12.5 && txs[0].note === "grab home" && /Saved RM12\.50 · Transport/.test(toast)
      && (await page.inputValue("#txAmount")) === "" && (await page.inputValue("#txNote")) === "", toast);
    check("the error message is gone after a good save", await page.evaluate(() => document.getElementById("txFormError").hidden));
    await page.click("#undoBtn"); await settle(page);
    check("Undo on 'Saved' removes the record", Object.keys(await docs(page, U + "transactions/")).length === 0);
    await page.evaluate(() => { window.__OFFLINE = true; });
    await page.type("#txAmount", "500");
    await page.click("#txSubmitBtn"); await settle(page);
    await page.type("#txAmount", "300");
    await page.click("#txSubmitBtn"); await settle(page);
    txs = Object.values(await docs(page, U + "transactions/"));
    const disabled = await page.evaluate(() => document.getElementById("txSubmitBtn").disabled);
    check("offline: two records in a row, the button stays usable", txs.length === 2 && !disabled && txs.map((t) => t.amount).sort().join() === "3,5", JSON.stringify(txs.map((t) => t.amount)));
    await page.evaluate(() => { window.__OFFLINE = false; });
    await page.setInputFiles("#txReceiptInput", { name: "r.png", mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(() => document.querySelectorAll("#txReceiptPreview .receipt-thumb").length === 1, null, { timeout: 5000 });
    await page.type("#txAmount", "990");
    await page.click("#txSubmitBtn"); await settle(page);
    const withPhoto = Object.entries(await docs(page, U + "transactions/")).find(([, t]) => t.amount === 9.9);
    const photos = withPhoto ? (await storeKeys(page)).filter((k) => k.startsWith(`${U}transactions/${withPhoto[0]}/receipts/`)).length : 0;
    check("a photo is saved with its record", !!withPhoto && withPhoto[1].receiptCount === 1 && photos === 1, `photos=${photos}`);
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

test("add record: last category remembered, one-tap templates", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: formSeed, local: { "accountBook.lastCategory": "c3" } });
  try {
    check("the form opens on the last category", (await page.inputValue("#txCategory")) === "c3");
    await page.click('.template-chip[data-id="tp1"]'); await settle(page);
    const txs = Object.values(await docs(page, U + "transactions/"));
    check("a template with an amount records in one tap", txs.length === 1 && txs[0].amount === 15 && txs[0].categoryId === "c2" && /Saved RM15\.00/.test(await page.textContent("#undoText")));
    await page.click('.template-chip[data-id="tp2"]'); await settle(page);
    check("a template without an amount fills the form",
      Object.keys(await docs(page, U + "transactions/")).length === 1 && (await page.inputValue("#txNote")) === "petrol" && (await page.inputValue("#txCategory")) === "c2");
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Assistant ───────────────────────────────────────────────────────────────

test("assistant: amounts, dates, Chinese numbers, notes, Undo", async () => {
  const check = checks();
  const { ctx, page, errors } = await openApp(browser, base, { seed: formSeed });
  try {
    await page.click("#assistantFab"); await settle(page, 200);
    const say = async (text) => {
      const before = new Set(Object.keys(await docs(page, U + "transactions/")));
      await page.fill("#assistantInput", text);
      await page.click("#assistantSendBtn"); await settle(page, 500);
      return Object.entries(await docs(page, U + "transactions/")).filter(([id]) => !before.has(id)).map(([, t]) => t);
    };
    let r = await say("rent 1,200");
    check("'rent 1,200' → one record of 1200", r.length === 1 && r[0].amount === 1200, JSON.stringify(r.map((t) => t.amount)));
    r = await say("3月5日 加油 50");
    check("'3月5日 加油 50' → RM50 on 2026-03-05", r.length === 1 && r[0].amount === 50 && r[0].dateISO === "2026-03-05", JSON.stringify(r.map((t) => [t.amount, t.dateISO])));
    r = await say("午饭一百零五块");
    check("'午饭一百零五块' → 105", r.length === 1 && r[0].amount === 105, JSON.stringify(r.map((t) => t.amount)));
    r = await say("今天吃鸡饭18块");
    check("'今天吃鸡饭18块' keeps the user's words as the note", r.length === 1 && r[0].amount === 18 && /鸡饭/.test(r[0].note), JSON.stringify(r.map((t) => t.note)));
    r = await say("lunch 12, coffee 5");
    const toast = await page.textContent("#undoText");
    check("'lunch 12, coffee 5' → two records, one toast", r.length === 2 && r.map((t) => t.amount).sort((a, b) => a - b).join() === "5,12" && /Saved 2 records/.test(toast), toast);
    await page.click("#undoBtn"); await settle(page);
    const left = Object.values(await docs(page, U + "transactions/")).map((t) => t.amount).sort((a, b) => a - b);
    check("Undo (above the open assistant) removes both", !left.includes(12) && !left.includes(5) && left.length === 4, JSON.stringify(left));
    r = await say("sandwich 8");
    check("'sandwich 8' isn't split at 'and'", r.length === 1 && r[0].amount === 8 && /sandwich/.test(r[0].note), JSON.stringify(r.map((t) => [t.amount, t.note])));
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

// ── Launch and charts ───────────────────────────────────────────────────────

test("launch: theme and language applied before app.js arrives", async () => {
  const check = checks();
  const { ctx, page, requests } = await openApp(browser, base, { seed: formSeed, lang: "zh", theme: "dark", block: ["/app.js"], waitSignedIn: false });
  try {
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      hidden: document.documentElement.classList.contains("i18n-pending"),
      title: document.querySelector(".app-header h1").textContent.trim(),
      langBtn: document.querySelector(".lang-toggle-label").textContent,
    }));
    check("dark theme, Chinese text, page visible without app.js", s.theme === "dark" && !s.hidden && s.title === "记账本" && s.langBtn === "EN", JSON.stringify(s));
    check("the Firebase SDK is preloaded from the start", requests.some((u) => u.includes("firebase-firestore.js")));
  } finally {
    await ctx.close();
  }
  check.done();
});

// Notes when the launch screen is first drawn, starts to go and is gone (ms since the
// page began loading), and what was drawn when app.js said it was ready.
const WATCH_SPLASH = `(${() => {
  const s = (window.__splash = {});
  const firstFrame = () => (document.getElementById("splash") ? (s.shown = performance.now()) : requestAnimationFrame(firstFrame));
  requestAnimationFrame(firstFrame);
  document.addEventListener("app-ready", () => {
    s.ready = performance.now();
    s.rowsAtReady = document.querySelectorAll("#txTbody tr").length;
  });
  new MutationObserver(() => {
    const c = document.documentElement.classList;
    if (c.contains("splash-leaving") && s.leaving == null) s.leaving = performance.now();
    if (c.contains("splash-gone") && s.gone == null) s.gone = performance.now();
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ["class"] });
}})();`;

test("launch screen: the logo first, gone once the records are drawn, never stuck", async () => {
  const check = checks();
  const seed = [...formSeed, tx("t1", "c1", 12, "expense", "2026-10-30", { categoryName: "Food" })];
  const cases = [
    ["signed in", { seed }, "Account Book"],
    ["signed in, Chinese", { seed, lang: "zh" }, "记账本"],
    ["signed out", { seed, init: WATCH_SPLASH + "window.__SIGNED_OUT = true;" }, "Account Book"],
    // boot.js blocked too, so the page stays hidden for translation: the logo still shows.
    ["app.js doesn't load", { seed, lang: "zh", block: ["/app.js", "/js/boot.js"] }, "记账本"],
  ];
  for (const [label, opts, name] of cases) {
    const { ctx, page, errors } = await openApp(browser, base, { init: WATCH_SPLASH, ...opts, waitSignedIn: false });
    try {
      const start = await page.evaluate(() => {
        const splash = document.getElementById("splash"), r = splash?.getBoundingClientRect();
        const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return {
          covers: !!r && r.width === innerWidth && r.height === innerHeight && splash.contains(top),
          shown: !!splash && getComputedStyle(splash).visibility === "visible",
          pagePending: document.documentElement.classList.contains("i18n-pending"),
          logo: splash?.querySelector(".splash-logo").getBoundingClientRect().width,
          name: [...(splash?.querySelectorAll(".splash-name span") || [])].filter((el) => el.offsetParent !== null).map((el) => el.textContent).join(),
        };
      });
      check(`${label}: the logo covers the screen as the page opens`, start.covers && start.shown && start.logo > 100, JSON.stringify(start));
      check(`${label}: the name under it is "${name}"`, start.name === name, start.name);
      if (label === "app.js doesn't load") check(`${label}: shown while the page waits for its translation`, start.pagePending && start.shown);

      await page.waitForFunction(() => window.__splash.gone != null, null, { timeout: 8000 });
      const s = await page.evaluate(() => ({ ...window.__splash, inDom: !!document.getElementById("splash"), signIn: !document.getElementById("authCard").hidden }));
      const t = JSON.stringify(s, (k, v) => (typeof v === "number" ? Math.round(v) : v));
      check(`${label}: taken out of the page after its fade`, !s.inDom && s.gone - s.leaving >= 550, t);
      if (label === "app.js doesn't load") {
        check(`${label}: goes by itself ~4 s after it appeared`, s.ready == null && s.leaving - s.shown >= 3900 && s.leaving - s.shown < 4600, t);
      } else {
        check(`${label}: on screen at least ~1.2 s, so it doesn't just flash by`, s.leaving - s.shown >= 1150, t);
        check(`${label}: goes right after that once the app is ready`, s.ready != null && s.leaving - Math.max(s.ready, s.shown + 1200) < 300, t);
        if (label === "signed out") check(`${label}: the sign-in form is what's underneath`, s.signIn, t);
        else check(`${label}: the records are drawn before it goes`, s.rowsAtReady >= 1, t);
        check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
      }
    } finally {
      await ctx.close();
    }
  }
  check.done();
});

test("charts: Chart.js loads from the site only when a chart screen opens", async () => {
  const check = checks();
  const { ctx, page, requests, errors } = await openApp(browser, base, { seed: [...formSeed, tx("t1", "c1", 20, "expense", "2026-10-20", { categoryName: "Food" })] });
  try {
    const chartRequests = () => requests.filter((u) => /chart\.umd\.js|esm\.sh|jsdelivr/.test(u));
    check("not downloaded at launch", chartRequests().length === 0, chartRequests().join(", "));
    await view(page, "stats");
    await page.waitForFunction(() => !!window.Chart, null, { timeout: 5000 }).catch(() => {});
    await settle(page, 400);
    const drawn = await page.evaluate(() => !!(window.Chart?.getChart && window.Chart.getChart("statsChart")));
    check("Statistics loads it once from vendor/ and draws the chart", chartRequests().length === 1 && /vendor\/chart\.umd\.js/.test(chartRequests()[0]) && drawn, chartRequests().join(", "));
    await view(page, "dashboard"); await settle(page, 500);
    check("Dashboard reuses it", chartRequests().length === 1 && await page.evaluate(() => !!window.Chart.getChart("trendChart")));
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});

test("statistics doughnut: fills the card on a phone and fits a 320px screen", async () => {
  const check = checks();
  const seed = [...formSeed];
  ["Food", "Transport", "Rental"].forEach((name, i) => seed.push(tx("s" + i, "c" + (i + 1), 100 + i * 37.5, "expense", "2026-10-1" + i, { categoryName: name })));
  for (const width of [393, 320]) {
    const { ctx, page, errors } = await openApp(browser, base, { seed, width });
    try {
      await view(page, "stats");
      await page.waitForFunction(() => window.Chart?.getChart?.("statsChart"), null, { timeout: 5000 });
      await settle(page, 300);
      const r = await page.evaluate(() => {
        const chart = window.Chart.getChart("statsChart");
        const arc = chart.getDatasetMeta(0).data[0];
        return { outer: Math.round(arc.outerRadius), legend: chart.options.plugins.legend.display, scrollW: document.documentElement.scrollWidth };
      });
      if (width === 393) {
        check("the doughnut is large on a phone (was ~36px radius)", r.outer >= 100, `outer radius ${r.outer}`);
        check("no legend inside the chart (the chips below are the legend)", r.legend === false);
      }
      check(`Statistics doesn't scroll sideways at ${width}px`, r.scrollW <= width, `scrollWidth ${r.scrollW}`);
      check(`no page errors at ${width}px`, errors.length === 0, errors.join(" | "));
    } finally {
      await ctx.close();
    }
  }
  check.done();
});

// ── Budget alerts ───────────────────────────────────────────────────────────

test("budget alerts are shown through the service worker (needed on iPhone)", async () => {
  const check = checks();
  const init = () => {
    window.__shown = [];
    // Headless Chromium always reports "denied"; act as if the user allowed alerts.
    try { Object.defineProperty(Notification, "permission", { get: () => "granted" }); } catch {}
    const reg = { showNotification: (title, opts) => { window.__shown.push({ title, body: opts && opts.body }); return Promise.resolve(); } };
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = () => Promise.resolve(reg);
  };
  const { ctx, page, errors } = await openApp(browser, base, {
    seed: [...formSeed.filter(([p]) => !p.includes("categories/c1")),
      cat("c1", "Food", { budget: 100, monthlyBudgets: { "2026-10": 100 } }),
      tx("t1", "c1", 130, "expense", "2026-10-20", { categoryName: "Food" })],
    local: { "accountBook.budgetAlerts": "on" }, init,
  });
  try {
    await view(page, "dashboard"); await settle(page, 600);
    const shown = await page.evaluate(() => window.__shown);
    check("an over-budget alert goes through the service worker", shown.length >= 1 && /Budget exceeded/.test(shown[0].title) && /Food/.test(shown[0].body), JSON.stringify(shown));
    check("no page errors", errors.length === 0, errors.join(" | "));
  } finally {
    await ctx.close();
  }
  check.done();
});
