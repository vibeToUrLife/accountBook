// One-off diagnosis (throwaway branch): start the live site like the iPhone home-screen
// app just back from Google sign-in (pending redirect), and record what Firebase's
// sign-in helper (/__/auth/, proxied by vercel.json) does and how long start-up takes.
import { chromium } from "playwright";
import { firebaseConfig } from "../../firebase-config.js";

const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: "block",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
});
await ctx.addInitScript((key) => {
  Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
  if (location.hostname === "accbook.vercel.app" && location.pathname === "/") {
    sessionStorage.setItem(key, JSON.stringify("true")); // what signInWithRedirect leaves behind
    localStorage.setItem("accountBook.googleRedirect", "1");
  }
}, `firebase:pendingRedirect:${firebaseConfig.apiKey}:[DEFAULT]`);
const page = await ctx.newPage();
page.on("console", (m) => console.log(at(), "console", m.type(), m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log(at(), "pageerror", String(e).slice(0, 300)));
page.on("requestfailed", (r) => console.log(at(), "FAILED", r.url().slice(0, 140), r.failure()?.errorText));
page.on("response", (r) => { if (/\/__\/|apis\.google\.com|identitytoolkit|securetoken/.test(r.url())) console.log(at(), r.status(), r.url().slice(0, 140)); });
page.on("frameattached", (f) => console.log(at(), "frame attached"));
page.on("framenavigated", (f) => { if (f !== page.mainFrame()) console.log(at(), "frame ->", f.url().slice(0, 140)); });

await page.goto("https://accbook.vercel.app/", { waitUntil: "domcontentloaded" });
console.log(at(), "page loaded; authDomain check:", await page.evaluate(() => document.documentElement.className));
const shown = await page.waitForFunction(() => {
  const vis = (id) => { const el = document.getElementById(id); return el && !el.hidden; };
  return vis("authCard") || vis("appContent") ? true : false;
}, null, { timeout: 40000, polling: 250 }).then(() => true, () => false);
console.log(at(), "UI shown:", shown);
console.log(at(), "state:", JSON.stringify(await page.evaluate(() => ({
  stage: window.__startupStage, errors: window.__startupErrors, failed: document.documentElement.classList.contains("splash-failed"),
  authError: document.getElementById("authError")?.hidden ? "" : document.getElementById("authError")?.textContent,
  frames: [...document.querySelectorAll("iframe")].map((f) => f.src.slice(0, 120)),
}))));
await browser.close();
