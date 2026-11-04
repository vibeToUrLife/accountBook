// Renders the iPhone launch images (icons/splash/*.png): the launch screen from
// index.html (#splash) at each iPhone screen size, so the home-screen app shows
// the same logo from the moment it's tapped until the page takes over. Not a test.
// Run after changing the launch screen:  cd browser-tests && npm run splash
// The <link rel="apple-touch-startup-image"> tags in index.html must list the same
// sizes (tests/launch-images.test.mjs checks that).
//
// The background is painted here from the CSS gradients' own formula rather than
// screenshotted: the browser adds dithering noise to gradients, which makes PNGs
// ~8× bigger. The logo is the page's own SVG, drawn by the browser at the spot the
// page's layout puts it. The name and the dots fade in after the page is up, so
// the launch image (the moment before) has only the logo.
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "./lib.mjs";

// Portrait screens: [width, height] in CSS px, pixel ratio, models.
export const DEVICES = [
  [440, 956, 3, "iPhone 16 Pro Max, 17 Pro Max"],
  [420, 912, 3, "iPhone Air"],
  [402, 874, 3, "iPhone 16 Pro, 17, 17 Pro"],
  [430, 932, 3, "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus"],
  [393, 852, 3, "iPhone 14 Pro, 15, 15 Pro, 16"],
  [428, 926, 3, "iPhone 12 Pro Max, 13 Pro Max, 14 Plus"],
  [390, 844, 3, "iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e"],
  [375, 812, 3, "iPhone X, XS, 11 Pro, 12 mini, 13 mini"],
  [414, 896, 3, "iPhone XS Max, 11 Pro Max"],
  [414, 896, 2, "iPhone XR, 11"],
  [414, 736, 3, "iPhone 6s Plus, 7 Plus, 8 Plus"],
  [375, 667, 2, "iPhone 6s, 7, 8, SE (2nd/3rd gen)"],
  [320, 568, 2, "iPhone SE (1st gen)"],
];

const OUT = fileURLToPath(new URL("../icons/splash/", import.meta.url));

// Runs in the page: paints the launch screen at device resolution, returns RGB as base64.
async function paintSplash(dpr) {
  const splash = document.getElementById("splash");
  // Its timer hides it after a few seconds; the page loads in well under one.
  if (!splash || document.documentElement.classList.contains("splash-leaving")) throw new Error("#splash was already hidden");
  const css = getComputedStyle(splash).backgroundImage;
  const m = css.match(/^radial-gradient\(([\d.]+)% ([\d.]+)% at ([\d.]+)% ([\d.]+)%, rgba\(255, 255, 255, ([\d.]+)\), rgba\(255, 255, 255, 0\)\), linear-gradient\(to right bottom, rgb\((\d+), (\d+), (\d+)\), rgb\((\d+), (\d+), (\d+)\)\)$/);
  if (!m) throw new Error("The #splash background changed shape; update paintSplash() in make-splash-images.mjs to draw it: " + css);
  const [rx, ry, cx, cy, glow] = m.slice(1, 6).map((v) => Number(v) / 100);
  const glowAlpha = glow * 100;
  const from = m.slice(6, 9).map(Number), to = m.slice(9, 12).map(Number);

  const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d");
  // linear-gradient(to right bottom) runs corner to corner: t = x/2W + y/2H.
  // radial-gradient(rx ry at cx cy) of white, alpha glowAlpha → 0, painted over it.
  const bg = g.createImageData(W, H), px = bg.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = Math.min(1, ((x + 0.5) / W + (y + 0.5) / H) / 2);
      const dx = (x + 0.5 - cx * W) / (rx * W), dy = (y + 0.5 - cy * H) / (ry * H);
      const a = glowAlpha * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        const base = from[k] + (to[k] - from[k]) * t;
        px[i + k] = Math.round(base + (255 - base) * a);
      }
      px[i + 3] = 255;
    }
  }
  g.putImageData(bg, 0, 0);

  const logo = splash.querySelector(".splash-logo");
  const box = logo.getBoundingClientRect();
  const svg = logo.cloneNode(true);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", box.width * dpr);
  svg.setAttribute("height", box.height * dpr);
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await img.decode();
  g.drawImage(img, box.left * dpr, box.top * dpr, box.width * dpr, box.height * dpr);

  const rgba = g.getImageData(0, 0, W, H).data, rgb = new Uint8Array(W * H * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) { rgb[j++] = rgba[i]; rgb[j++] = rgba[i + 1]; rgb[j++] = rgba[i + 2]; }
  let bin = "";
  for (let i = 0; i < rgb.length; i += 0x8000) bin += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
  return { W, H, rgb: btoa(bin) };
}

// Minimal PNG writer: 8-bit RGB, per-row filter picked like libpng does, deflate level 9.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function encodePng(rgb, w, h) {
  const stride = w * 3, raw = Buffer.alloc((stride + 1) * h);
  const filtered = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = y * stride, prev = (y - 1) * stride;
    for (let i = 0; i < stride; i++) {
      const v = rgb[row + i];
      const a = i >= 3 ? rgb[row + i - 3] : 0, b = y ? rgb[prev + i] : 0, c = y && i >= 3 ? rgb[prev + i - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      filtered[0][i] = v;
      filtered[1][i] = v - a;
      filtered[2][i] = v - b;
      filtered[3][i] = v - ((a + b) >> 1);
      filtered[4][i] = v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
    }
    let best = 0, bestCost = Infinity;
    for (let f = 0; f < 5; f++) {
      let cost = 0;
      for (const d of filtered[f]) cost += d < 128 ? d : 256 - d;
      if (cost < bestCost) { bestCost = cost; best = f; }
    }
    raw[y * (stride + 1)] = best;
    filtered[best].copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(OUT, { recursive: true });
  const { server, base } = await startServer();
  const browser = await chromium.launch();
  const links = [];
  try {
    for (const [w, h, dpr, models] of DEVICES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
      // Only the page and its CSS: no scripts, so nothing starts the app or hides the launch screen.
      await ctx.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.hostname === "127.0.0.1" && !url.pathname.endsWith(".js") ? route.continue() : route.abort();
      });
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: "load" });
      const { W, H, rgb } = await page.evaluate(paintSplash, dpr);
      await ctx.close();
      if (W !== w * dpr || H !== h * dpr) throw new Error(`painted ${W}×${H}, expected ${w * dpr}×${h * dpr}`);
      const file = `splash-${W}x${H}.png`;
      const png = encodePng(Buffer.from(rgb, "base64"), W, H);
      await writeFile(OUT + file, png);
      links.push(`<!-- ${models} -->\n<link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="./icons/splash/${file}" />`);
      console.log(`wrote icons/splash/${file} (${Math.round(png.length / 1024)} KB)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log("\nTags for index.html:\n" + links.join("\n"));
}
