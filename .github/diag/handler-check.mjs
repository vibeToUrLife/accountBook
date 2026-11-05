// One-off check (throwaway branch): on the live site, /__/auth/handler takes the
// fragment Google sends, hands it to the app (localStorage) and goes back to "/".
import { chromium } from "../../browser-tests/node_modules/playwright/index.mjs";
const browser = await chromium.launch();
const page = await (await browser.newContext({ serviceWorkers: "block" })).newPage();
const hops = [];
page.on("framenavigated", (f) => { if (f === page.mainFrame()) hops.push(f.url()); });
await page.goto("https://accbook.vercel.app/__/auth/handler#id_token=diag.check.token&state=diag", { waitUntil: "load" });
await page.waitForURL("https://accbook.vercel.app/", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2500);
console.log("hops:", hops.join("  ->  "));
console.log("final url:", page.url());
console.log("app message:", await page.evaluate(() => { const e = document.getElementById("authError"); return e && !e.hidden ? e.textContent : "(none)"; }).catch((e) => "eval failed: " + e.message));
await browser.close();
