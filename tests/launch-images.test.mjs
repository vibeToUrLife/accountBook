// iPhone launch images: iOS only shows one whose pixel size is exactly the screen's,
// so each <link rel="apple-touch-startup-image"> must point at a PNG of the size its
// media query names. The PNGs come from browser-tests/make-splash-images.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const links = [...html.matchAll(/<link rel="apple-touch-startup-image" media="([^"]+)" href="\.\/([^"]+)" \/>/g)]
  .map(([, media, href]) => {
    const m = media.match(/^\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)$/);
    assert.ok(m, `unexpected media query: ${media}`);
    const [w, h, dpr] = m.slice(1).map(Number);
    return { media, href, w, h, dpr };
  });

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path) {
  const buf = readFileSync(new URL(path, root));
  assert.equal(buf.toString("latin1", 1, 4), "PNG", `${path} is not a PNG`);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test("there is a launch image for each iPhone screen size", () => {
  assert.ok(links.length >= 13, `only ${links.length} apple-touch-startup-image links`);
  assert.equal(new Set(links.map((l) => l.media)).size, links.length, "two links share a media query");
});

test("each launch image is exactly its screen's size in pixels", () => {
  for (const { href, w, h, dpr } of links) {
    assert.deepEqual(pngSize(href), [w * dpr, h * dpr], href);
  }
});

test("no launch image is left unused", () => {
  const used = new Set(links.map((l) => l.href));
  const files = readdirSync(new URL("icons/splash/", root)).filter((f) => f.endsWith(".png"));
  assert.deepEqual(files.filter((f) => !used.has("icons/splash/" + f)), []);
});

test("the generator's screen list and the links match", () => {
  const source = readFileSync(new URL("browser-tests/make-splash-images.mjs", root), "utf8");
  const devices = [...source.matchAll(/^\s*\[(\d+), (\d+), (\d), "/gm)].map((m) => m.slice(1).join("x"));
  assert.deepEqual(devices.sort(), links.map((l) => `${l.w}x${l.h}x${l.dpr}`).sort());
});
