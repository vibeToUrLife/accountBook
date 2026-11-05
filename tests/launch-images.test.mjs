// iPhone launch images: iOS only shows one whose pixel size is exactly the screen's,
// so each <link rel="apple-touch-startup-image"> must point at a PNG of the size its
// media query names. They must be plain white: iOS shows a white frame between the
// launch image and the page's first paint, and anything else on the launch image
// blinks there. The PNGs come from browser-tests/make-splash-images.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { inflateSync } from "node:zlib";

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

/** Pixels of an 8-bit RGB PNG (what make-splash-images.mjs writes), unfiltered. */
function pngPixels(path) {
  const buf = readFileSync(new URL(path, root));
  const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  assert.deepEqual([buf[24], buf[25]], [8, 2], `${path}: expected 8-bit RGB`);
  const idat = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at), type = buf.toString("latin1", at + 4, at + 8);
    if (type === "IDAT") idat.push(buf.subarray(at + 8, at + 8 + len));
    at += len + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 3, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? out[row + i - 3] : 0, b = y ? out[row - stride + i] : 0, c = y && i >= 3 ? out[row - stride + i - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[row + i] = (raw[src + i] + pred) & 255;
    }
  }
  return out;
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

test("each launch image is plain white", () => {
  for (const { href } of links) {
    assert.ok(pngPixels(href).every((v) => v === 255), `${href} is not plain white`);
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
