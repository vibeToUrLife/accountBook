// Shared helpers for app.spec.mjs: a static file server for the repository,
// and a phone-sized Chromium page with Firebase swapped for the in-memory
// stand-in in ./stubs (seeded per test).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STUBS = fileURLToPath(new URL("./stubs/", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

/** Serve the repository like the live site (plain files, "/" → index.html, "/x" → x.html as Vercel's cleanUrls does). */
export function startServer() {
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    let file = path.join(ROOT, pathname === "/" ? "index.html" : decodeURIComponent(pathname));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    try {
      const body = await readFile(file).catch(async (e) => {
        if (path.extname(file)) throw e;
        file += ".html";
        return readFile(file);
      });
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` }));
  });
}

export const U = "users/u1/";
export const ts = (iso) => ({ __ts: Date.parse(iso) });
export const cat = (id, name, extra = {}) => [U + "categories/" + id, { name, budget: 0, budgetPeriod: "month", createdAt: ts("2026-08-01T00:00:00Z"), ...extra }];
// 1×1 PNG
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

/**
 * Open the app signed in as users/u1 on a 393×852 phone in UTC+8 at a fixed
 * time. `seed` = [[path, data]] documents; `stale` = what listeners see for a
 * collection (an out-of-date cache); `init` runs before the app (e.g. to start
 * offline); `block` aborts matching URLs (e.g. "/app.js").
 */
export async function openApp(browser, base, {
  seed = [], stale = null, now = "2026-10-31T10:00:00+08:00", lang = "en", theme = "light",
  local = {}, block = [], init = null, width = 393, waitSignedIn = true, path: at = "", routes = [],
} = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: 852 }, timezoneId: "Asia/Kuala_Lumpur", serviceWorkers: "block",
    isMobile: width < 980, hasTouch: width < 980,
  });
  await ctx.clock.setFixedTime(new Date(now));
  const requests = [];
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (block.some((b) => url.href.includes(b))) return route.abort();
    if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
      return route.fulfill({
        status: 200, contentType: "application/javascript", headers: { "Access-Control-Allow-Origin": "*" },
        body: readFileSync(path.join(STUBS, path.basename(url.pathname)), "utf8"),
      });
    }
    if (url.hostname === "127.0.0.1") return route.continue();
    return route.abort(); // fonts and CDNs: tests run without the network
  });
  // Extra [pattern, handler] routes, which take precedence over the one above.
  for (const [pattern, handler] of routes) await ctx.route(pattern, handler);
  await ctx.addInitScript(({ seed, stale, lang, theme, local }) => {
    window.__SEED = seed;
    if (stale) window.__STALE = stale;
    try {
      localStorage.setItem("accountBook.lang", lang);
      localStorage.setItem("accountBook.theme", theme);
      localStorage.setItem("accountBook.helpTipDismissed", "1");
      for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
    } catch {}
  }, { seed, stale, lang, theme, local });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + at, { waitUntil: "domcontentloaded" });
  if (waitSignedIn) await signedIn(page);
  return { ctx, page, errors, requests };
}

export async function signedIn(page) {
  await page.waitForFunction(() => /Signed in|已登录/.test(document.getElementById("authStatus").textContent), null, { timeout: 10000 });
  await page.waitForTimeout(400);
}

/** Documents directly under a collection path, as plain JSON. */
export const docs = (page, prefix) => page.evaluate((prefix) => Object.fromEntries(
  [...window.__store].filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
    .map(([k, v]) => [k.slice(prefix.length), JSON.parse(JSON.stringify(v))])), prefix);
export const storeKeys = (page) => page.evaluate(() => [...window.__store.keys()]);
export const view = (page, name) => page.evaluate((n) => document.querySelector(`.sidebar-item[data-view="${n}"]`).click(), name);
export const settle = (page, ms = 400) => page.waitForTimeout(ms);
export const resume = (page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

/** Collect named checks and report every failure at the end of a test. */
export function checks() {
  const failed = [];
  const check = (name, ok, detail = "") => { if (!ok) failed.push(detail ? `${name} — ${detail}` : name); };
  check.done = () => assert.deepEqual(failed, [], `failed checks:\n  ${failed.join("\n  ")}`);
  return check;
}

export { chromium };
