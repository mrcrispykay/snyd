// Draws the app icon (an ivory die showing five, walnut ground, red centre pip) as PNGs and SVG.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(out, { recursive: true });

const BG = [0x1a, 0x13, 0x0f];
const IVORY = [0xf6, 0xef, 0xe2];
const PIP = [0x2a, 0x1d, 0x16];
const RED = [0xd8, 0x38, 0x3f];
const pips = [[0.37, 0.37], [0.63, 0.37], [0.37, 0.63], [0.63, 0.63]];

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}
function sample(x, y) {
  if (!inRoundRect(x, y, 0.24, 0.24, 0.76, 0.76, 0.1)) return BG;
  if (Math.hypot(x - 0.5, y - 0.5) < 0.055) return RED;
  for (const [px, py] of pips) if (Math.hypot(x - px, y - py) < 0.045) return PIP;
  return IVORY;
}
function render(size) {
  const ss = 4;
  const px = Buffer.alloc(size * size * 3);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = sample((i + (sx + 0.5) / ss) / size, (j + (sy + 0.5) / ss) / size);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const k = (j * size + i) * 3;
    for (let q = 0; q < 3; q++) px[k + q] = acc[q] / (ss * ss);
  }
  return px;
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size) {
  const px = render(size);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let j = 0; j < size; j++) px.copy(raw, j * (size * 3 + 1) + 1, j * size * 3, (j + 1) * size * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [180, 192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), png(s));
fs.writeFileSync(path.join(out, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#1a130f"/><rect x="18" y="18" width="64" height="64" rx="13" fill="#f6efe2"/><g fill="#2a1d16"><circle cx="35" cy="35" r="6"/><circle cx="65" cy="35" r="6"/><circle cx="35" cy="65" r="6"/><circle cx="65" cy="65" r="6"/></g><circle cx="50" cy="50" r="7.5" fill="#d8383f"/></svg>\n`);
console.log('Icons written to', out);
