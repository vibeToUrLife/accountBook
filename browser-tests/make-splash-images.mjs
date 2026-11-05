// Writes the iPhone launch images (icons/splash/*.png), one per iPhone screen size.
// Not a test. Run after changing the list below:  cd browser-tests && npm run splash
// The <link rel="apple-touch-startup-image"> tags in index.html must list the same
// sizes (tests/launch-images.test.mjs checks that).
//
// They are plain white on purpose. Between the launch image and the page's first
// paint, iOS shows a white frame (WebKit bug 311569), so a launch image with the logo
// gave logo, white blink, logo. With a white launch image that frame can't be seen;
// the page's launch screen (#splash) starts white in the home-screen app and fades
// the colours and the logo in.
import { writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

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
const WHITE = [255, 255, 255];

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

/** An 8-bit RGB PNG of one colour: each row unfiltered pixels, deflated. */
function solidPng(w, h, [r, g, b]) {
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([r, g, b], 1 + x * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array(h).fill(row)), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(OUT, { recursive: true });
  for (const [w, h, dpr, models] of DEVICES) {
    const file = `splash-${w * dpr}x${h * dpr}.png`;
    const png = solidPng(w * dpr, h * dpr, WHITE);
    await writeFile(OUT + file, png);
    console.log(`wrote icons/splash/${file} (${(png.length / 1024).toFixed(1)} KB) — ${models}`);
  }
}
