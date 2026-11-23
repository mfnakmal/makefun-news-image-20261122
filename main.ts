// Sunday 22 November 2026 — The World in One Day.
// A make.fun news-image entry (Node 22, standard library only).
// The program draws the whole page in code — no image is copied in —
// and writes it to /output/entry.png (or $MAKEFUN_OUTPUT_DIR).
// Deterministic: no network, no clock, no randomness; two runs write
// identical bytes.
//
// Design: a one-page editorial atlas in a crisp pixel-art newspaper
// style. 32 dated stories across 7 regions, every one from Sunday
// 22 November 2026, with certainty tags (CONFIRMED / CLAIM / REPORTED /
// PENDING / FORECAST), a UTC timeline, a numbers strip, a world map with
// numbered pins, and a DATE CHECK box that names the big stories left
// out on purpose because they happened on other days.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ font
// A 5x7 pixel font, drawn by hand. Each glyph is 7 rows; each row is a
// 5-bit number, bit 4 = leftmost pixel. Lowercase included (rows 5-7 carry
// descenders for g, j, p, q, y). A few Unicode points are mapped to their
// plain-ASCII lookalikes.
const FONT: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '"': [10, 10, 10, 0, 0, 0, 0],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '$': [4, 15, 20, 14, 5, 30, 4],
  '%': [24, 25, 2, 4, 8, 19, 24],
  '&': [12, 18, 20, 8, 21, 18, 13],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '*': [0, 4, 21, 14, 21, 4, 0],
  '+': [0, 4, 4, 31, 4, 4, 0],
  ',': [0, 0, 0, 0, 12, 4, 8],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '>': [8, 4, 2, 1, 2, 4, 8],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '@': [14, 17, 1, 13, 21, 21, 14],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [1, 1, 1, 1, 1, 17, 14],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '[': [14, 8, 8, 8, 8, 8, 14],
  '\\': [16, 8, 8, 4, 2, 2, 1],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '^': [4, 10, 17, 0, 0, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 31],
  '`': [8, 4, 2, 0, 0, 0, 0],
  a: [0, 0, 14, 1, 15, 17, 15],
  b: [16, 16, 30, 17, 17, 17, 30],
  c: [0, 0, 14, 16, 16, 16, 14],
  d: [1, 1, 15, 17, 17, 17, 15],
  e: [0, 0, 14, 17, 31, 16, 14],
  f: [6, 8, 8, 30, 8, 8, 8],
  g: [0, 15, 17, 17, 15, 1, 14],
  h: [16, 16, 30, 17, 17, 17, 17],
  i: [4, 0, 12, 4, 4, 4, 14],
  j: [2, 0, 6, 2, 2, 18, 12],
  k: [16, 16, 18, 20, 24, 20, 18],
  l: [12, 4, 4, 4, 4, 4, 14],
  m: [0, 0, 26, 21, 21, 21, 21],
  n: [0, 0, 30, 17, 17, 17, 17],
  o: [0, 0, 14, 17, 17, 17, 14],
  p: [0, 0, 30, 17, 17, 30, 16],
  q: [0, 0, 15, 17, 17, 15, 1],
  r: [0, 0, 22, 25, 16, 16, 16],
  s: [0, 0, 15, 16, 14, 1, 30],
  t: [8, 8, 30, 8, 8, 9, 6],
  u: [0, 0, 17, 17, 17, 19, 13],
  v: [0, 0, 17, 17, 17, 10, 4],
  w: [0, 0, 17, 21, 21, 21, 10],
  x: [0, 0, 17, 10, 4, 10, 17],
  y: [0, 0, 17, 17, 15, 1, 14],
  z: [0, 0, 31, 2, 4, 8, 31],
  '{': [2, 4, 4, 8, 4, 4, 2],
  '|': [4, 4, 4, 4, 4, 4, 4],
  '}': [8, 4, 4, 2, 4, 4, 8],
  '~': [0, 0, 0, 14, 21, 0, 0],
  '·': [0, 0, 0, 12, 12, 0, 0],
  '—': [0, 0, 0, 31, 0, 0, 0],
  '–': [0, 0, 0, 31, 0, 0, 0],
  '’': [4, 4, 8, 0, 0, 0, 0],
  '‘': [8, 4, 4, 0, 0, 0, 0],
  '“': [10, 10, 10, 0, 0, 0, 0],
  '”': [10, 10, 10, 0, 0, 0, 0],
  '°': [14, 17, 17, 14, 0, 0, 0],
  '×': [0, 17, 10, 4, 10, 17, 0],
  '≈': [0, 0, 10, 21, 10, 21, 0],
};

function glyph(ch: string): number[] {
  return FONT[ch] ?? FONT['?'];
}

// ---------------------------------------------------------------- canvas
type RGB = [number, number, number];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8Array;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
  }
  fill(c: RGB): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.buf[i * 3] = c[0];
      this.buf[i * 3 + 1] = c[1];
      this.buf[i * 3 + 2] = c[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
    }
  }
  hline(x: number, y: number, w: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: RGB): void {
    this.rect(x, y, 1, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) {
      this.px(Math.round(x0), Math.round(y0), c);
      return;
    }
    for (let i = 0; i <= steps; i++) {
      this.px(Math.round(x0 + (dx * i) / steps), Math.round(y0 + (dy * i) / steps), c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.px(x, y, c);
      }
    }
  }
  ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
    const r2 = r * r;
    const ri = Math.max(0, r - t);
    const ri2 = ri * ri;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 >= ri2) this.px(x, y, c);
      }
    }
  }
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minX = Math.floor(Math.min(x0, x1, x2));
    const maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((x - x0) * (y2 - y0) - (y - y0) * (x2 - x0)) / d;
        const b = ((x - x1) * (y0 - y1) - (y - y1) * (x0 - x1)) / d;
        const cc = 1 - a - b;
        if (a >= 0 && b >= 0 && cc >= 0) this.px(x, y, c);
      }
    }
  }
  // ---- text: 5x7 font, integer scale, 1px tracking at scale 1
  textWidth(s: string, scale: number): number {
    let w = 0;
    for (const ch of s) w += 6 * scale;
    return w - scale; // no trailing tracking
  }
  text(x: number, y: number, s: string, scale: number, c: RGB): number {
    let cx = Math.round(x);
    const top = Math.round(y);
    for (const ch of s) {
      const g = glyph(ch);
      for (let r = 0; r < 7; r++) {
        const row = g[r];
        for (let col = 0; col < 5; col++) {
          if (row & (16 >> col)) this.rect(cx + col * scale, top + r * scale, scale, scale, c);
        }
      }
      cx += 6 * scale;
    }
    return cx;
  }
  textCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(cx - this.textWidth(s, scale) / 2, y, s, scale, c);
  }
  textRight(rx: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(rx - this.textWidth(s, scale), y, s, scale, c);
  }
}

// Word-wrap plain text to lines that fit maxW pixels at the given scale.
function wrapText(cv: Canvas, s: string, scale: number, maxW: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (cv.textWidth(test, scale) <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      // a single word too wide: hard-split it
      let rest = w;
      while (cv.textWidth(rest, scale) > maxW && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && cv.textWidth(rest.slice(0, cut), scale) > maxW) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      cur = rest;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function paragraph(cv: Canvas, x: number, y: number, s: string, scale: number, maxW: number, c: RGB, leading?: number): number {
  const lh = leading ?? 7 * scale + 2;
  const lines = wrapText(cv, s, scale, maxW);
  let yy = y;
  for (const ln of lines) {
    cv.text(x, yy, ln, scale, c);
    yy += lh;
  }
  return yy;
}

// ---------------------------------------------------------------- palette
const PAPER: RGB = [247, 242, 231];
const CARD: RGB = [255, 255, 255];
const INK: RGB = [26, 42, 74];
const INK_SOFT: RGB = [70, 84, 110];
const RED: RGB = [179, 38, 30];
const RED_DARK: RGB = [138, 26, 20];
const GOLD: RGB = [198, 158, 38];
const WHITE: RGB = [255, 255, 255];
const LINE: RGB = [206, 196, 176];
const NIGHT: RGB = [16, 24, 48];
const SKY: RGB = [142, 178, 214];
const TEAL: RGB = [15, 118, 110];
const GREEN: RGB = [34, 120, 60];
const BLUE: RGB = [36, 90, 160];
const ORANGE: RGB = [214, 120, 30];
const PURPLE: RGB = [110, 80, 160];
const GRAY: RGB = [96, 96, 92];
const SAND: RGB = [226, 214, 186];

const REGION_COLOR: Record<string, RGB> = {
  Europe: BLUE,
  'Middle East': RED,
  Americas: TEAL,
  Asia: ORANGE,
  Africa: GREEN,
  Oceania: PURPLE,
  World: GRAY,
};

// ------------------------------------------------------- drawn illustrations
// Small flat scenes, drawn with primitives. Each fills its rect with a
// background and draws a simple, recognisable scene of the story.
type Scene = (cv: Canvas, x: number, y: number, w: number, h: number) => void;

function skyline(cv: Canvas, x: number, y: number, w: number, h: number, c: RGB, lit: RGB): void {
  // a row of dark buildings with lit windows, heights vary by a fixed pattern
  const hs = [0.55, 0.8, 0.45, 0.95, 0.6, 0.75, 0.5, 0.85, 0.62, 0.7];
  const n = hs.length;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const bh = h * hs[i];
    cv.rect(x + i * bw, y + h - bh, bw - 1, bh, c);
    const wins = 2 + (i % 3);
    for (let k = 0; k < wins; k++) {
      const wy = y + h - bh + 4 + k * Math.max(6, bh / 4);
      if (wy < y + h - 3) cv.rect(x + i * bw + 2, wy, 2, 2, lit);
    }
  }
}

function drone(cv: Canvas, x: number, y: number, s: number, c: RGB): void {
  cv.rect(x - s, y, 2 * s + 1, 1, c);
  cv.rect(x, y - s, 1, 2 * s + 1, c);
  cv.circle(x, y, Math.max(1, Math.floor(s / 2)), c);
}

const sceneDrones: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, NIGHT);
  cv.circle(x + w * 0.82, y + h * 0.22, 9, [232, 222, 190]);
  skyline(cv, x, y + h * 0.45, w, h * 0.55, [8, 14, 32], [255, 214, 120]);
  drone(cv, x + w * 0.2, y + h * 0.25, 5, [255, 214, 120]);
  drone(cv, x + w * 0.45, y + h * 0.15, 4, [255, 214, 120]);
  drone(cv, x + w * 0.65, y + h * 0.32, 4, [255, 214, 120]);
  cv.line(x + w * 0.2, y + h * 0.25, x + w * 0.32, y + h * 0.4, [255, 214, 120]);
  cv.line(x + w * 0.65, y + h * 0.32, x + w * 0.55, y + h * 0.48, [255, 214, 120]);
  // searchlight beam
  cv.tri(x + w * 0.72, y + h, x + w * 0.78, y + h, x + w * 0.62, y + h * 0.3, [70, 84, 110]);
};

const sceneCop: Scene = (cv, x, y, w, h) => {
  // COP31 collapses: delegates behind a NO DEAL banner, globe above.
  cv.rect(x, y, w, h, [168, 196, 214]);
  cv.circle(x + w * 0.5, y + h * 0.3, Math.floor(h * 0.16), [120, 180, 120]);
  cv.rect(x + w * 0.5 - 1, y + h * 0.14, 2, Math.floor(h * 0.32), [255, 255, 255]);
  cv.rect(x, y + h * 0.62, w, h * 0.14, [120, 84, 50]); // table
  cv.rect(x, y + h * 0.76, w, h * 0.24, [90, 62, 36]);
  const seats = 5;
  for (let i = 0; i < seats; i++) {
    const sx = x + ((i + 0.5) * w) / seats;
    cv.circle(sx, y + h * 0.5, 5, [40, 50, 70]);
    cv.rect(sx - 6, y + h * 0.55, 12, 7, [40, 50, 70]);
  }
  cv.rect(x, y + h * 0.58, w, 22, RED);
  cv.textCentered(x + w / 2, y + h * 0.58 + 7, 'NO DEAL', 2, WHITE);
};

const sceneCapitol: Scene = (cv, x, y, w, h) => {
  // US Capitol: dome, drum, wings, columns, flag, and a blue 258 banner.
  cv.rect(x, y, w, h, [168, 196, 214]); // sky
  cv.rect(x + w * 0.5 - 1, y + h * 0.1, 2, h * 0.12, [90, 70, 50]); // flagpole
  cv.tri(x + w * 0.5 + 1, y + h * 0.1, x + w * 0.5 + 1, y + h * 0.19, x + w * 0.5 + 18, y + h * 0.145, RED);
  cv.circle(x + w * 0.5, y + h * 0.36, Math.floor(h * 0.14), [245, 245, 245]); // dome
  cv.rect(x + w * 0.5 - Math.floor(h * 0.14), y + h * 0.36, Math.floor(h * 0.28), h * 0.09, [240, 240, 240]); // drum
  cv.rect(x + w * 0.12, y + h * 0.58, w * 0.76, h * 0.27, [225, 230, 236]); // wings
  cv.rect(x + w * 0.38, y + h * 0.45, w * 0.24, h * 0.4, [240, 240, 240]); // central block
  for (let i = 0; i < 6; i++) {
    const cx = x + w * (0.4 + i * 0.04);
    cv.rect(cx - 3, y + h * 0.5, 6, h * 0.3, [200, 205, 212]);
  }
  cv.rect(x + w * 0.1, y + h * 0.85, w * 0.8, h * 0.08, [200, 205, 215]); // steps
  cv.rect(x + w * 0.04, y + h * 0.08, w * 0.16, 20, BLUE); // 258 banner
  cv.textCentered(x + w * 0.12, y + h * 0.08 + 6, '258', 2, WHITE);
};

const sceneCricket: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, [96, 160, 96]);
  cv.rect(x + w * 0.3, y + h * 0.15, w * 0.4, h * 0.7, [210, 190, 140]); // pitch
  for (const sx of [0.38, 0.42, 0.46, 0.62, 0.66, 0.7]) {
    cv.rect(x + w * sx, y + h * 0.2, 2, 10, [240, 220, 160]);
  }
  cv.rect(x + w * 0.52, y + h * 0.45, 3, 16, [120, 70, 30]); // bat
  cv.circle(x + w * 0.55, y + h * 0.62, 4, RED);
  cv.rect(x, y + h * 0.85, w, h * 0.15, [70, 120, 70]);
};

const sceneFire: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, [52, 52, 66]);
  cv.rect(x + w * 0.15, y + h * 0.4, w * 0.7, h * 0.45, [150, 120, 90]);
  cv.rect(x + w * 0.15, y + h * 0.4, w * 0.7, h * 0.08, [110, 88, 66]);
  cv.rect(x + w * 0.6, y + h * 0.2, w * 0.08, h * 0.25, [120, 100, 80]); // chimney
  cv.tri(x + w * 0.3, y + h * 0.42, x + w * 0.42, y + h * 0.42, x + w * 0.36, y + h * 0.18, [255, 170, 40]);
  cv.tri(x + w * 0.5, y + h * 0.42, x + w * 0.6, y + h * 0.42, x + w * 0.55, y + h * 0.24, [255, 90, 20]);
  cv.circle(x + w * 0.66, y + h * 0.14, 6, [200, 200, 200]);
  cv.circle(x + w * 0.72, y + h * 0.08, 8, [200, 200, 200]);
};

const sceneBoat: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, [150, 190, 215]);
  cv.rect(x, y + h * 0.55, w, h * 0.45, [36, 90, 160]);
  cv.rect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.16, [120, 70, 40]);
  cv.rect(x + w * 0.45, y + h * 0.15, 3, h * 0.28, [90, 60, 30]);
  cv.tri(x + w * 0.48, y + h * 0.15, x + w * 0.48, y + h * 0.4, x + w * 0.72, y + h * 0.4, [250, 250, 250]);
  for (let i = 0; i < 4; i++) {
    cv.line(x + w * (0.1 + i * 0.2), y + h * (0.68 + (i % 2) * 0.08), x + w * (0.2 + i * 0.2), y + h * (0.68 + (i % 2) * 0.08), WHITE);
  }
};

const sceneCourt: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, [200, 205, 215]);
  cv.tri(x + w * 0.1, y + h * 0.3, x + w * 0.9, y + h * 0.3, x + w * 0.5, y + h * 0.08, [150, 160, 175]);
  for (let i = 0; i < 4; i++) {
    cv.rect(x + w * (0.16 + i * 0.2), y + h * 0.32, 6, h * 0.5, [240, 240, 240]);
  }
  cv.rect(x + w * 0.1, y + h * 0.82, w * 0.8, h * 0.08, [160, 165, 175]);
};

const sceneMarket: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, [24, 34, 58]);
  const bars = [0.3, 0.45, 0.38, 0.6, 0.52, 0.75, 0.9];
  const bw = w / bars.length;
  for (let i = 0; i < bars.length; i++) {
    const bh = h * bars[i] * 0.7;
    cv.rect(x + i * bw + 2, y + h * 0.85 - bh, bw - 4, bh, i === bars.length - 1 ? [90, 200, 120] : [70, 110, 160]);
  }
  cv.line(x + 4, y + h * 0.8, x + w - 4, y + h * 0.12, [255, 214, 120]);
  cv.tri(x + w - 4, y + h * 0.12, x + w - 12, y + h * 0.12, x + w - 4, y + h * 0.2, [255, 214, 120]);
};

// ------------------------------------------------------------- world map
// A coarse dotted world map: 60 columns x 28 rows, '#' = land.
// Longitude -180..180 left to right; latitude 90..-60 top to bottom.
const MAP_ROWS: string[] = [
  '............................................................',
  '.................##.........................................',
  '...###...#######..###..........##################...........',
  '..####..########..###........######################.........',
  '..###...##########....#......########################.......',
  '..###...##########...#..###..#######################.......',
  '.....#########........###########################....#.....',
  '.....##########.......#################..#######....##......',
  '.....#########........#######..############.........#.......',
  '.....########.........#########.##########..................',
  '......######..........##########.######..#######............',
  '......####............##########.###..###.####..............',
  '.......###............#########.###..###..####..............',
  '.........##...........##########..##...###..##..............',
  '............####......#########........###..######..........',
  '............#####.....########.........###...#####..........',
  '............#####.....#######..........###....####...##......',
  '............####......######...........####...######........',
  '............####......######............###..#######........',
  '............####......#####.............###..#######........',
  '.............###......####..............###..######.........',
  '.............###......###...............###..#####....#.....',
  '.............###......##................###..####.....#.....',
  '.............##.............................###............',
  '.............##............................................',
  '.............##............................................',
  '.............#.............................................',
  '............................................................',
];

function drawMap(cv: Canvas, x: number, y: number, w: number, h: number, pins: { lon: number; lat: number; n: number }[]): void {
  cv.rect(x, y, w, h, [214, 228, 238]);
  const cols = MAP_ROWS[0].length;
  const rows = MAP_ROWS.length;
  const cw = w / cols;
  const ch = h / rows;
  const dot = Math.max(2, Math.floor(Math.min(cw, ch) * 0.62));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (MAP_ROWS[r][c] === '#') {
        cv.rect(x + Math.round(c * cw + (cw - dot) / 2), y + Math.round(r * ch + (ch - dot) / 2), dot, dot, [96, 140, 110]);
      }
    }
  }
  for (const p of pins) {
    const px = x + ((p.lon + 180) / 360) * w;
    const py = y + ((90 - p.lat) / 150) * h;
    cv.circle(px, py, 7, RED);
    cv.circle(px, py, 7, RED);
    cv.textCentered(px, py - 5, String(p.n), 1, WHITE);
  }
}

// ------------------------------------------------------------ extra scenes
const sceneFlag: Scene = (cv, x, y, w, h) => {
  cv.rect(x, y, w, h, [168, 196, 214]);
  cv.rect(x, y + h * 0.68, w, h * 0.32, [120, 150, 110]);
  cv.rect(x + w * 0.3, y + h * 0.15, 3, h * 0.55, [90, 70, 50]);
  cv.tri(x + w * 0.3, y + h * 0.15, x + w * 0.62, y + h * 0.25, x + w * 0.3, y + h * 0.35, RED);
  cv.circle(x + w * 0.72, y + h * 0.3, 8, [232, 222, 190]);
  cv.rect(x + w * 0.1, y + h * 0.68, w * 0.8, 2, [90, 110, 85]);
};

const sceneTankerS: Scene = (cv, x, y, w, h) => {
  // Oil tanker at night near the Strait of Hormuz; a mine and a blast.
  cv.rect(x, y, w, h, [24, 34, 58]);
  cv.rect(x, y + h * 0.6, w, h * 0.4, [40, 58, 84]); // sea
  cv.rect(x + w * 0.15, y + h * 0.42, w * 0.6, h * 0.2, [40, 40, 40]); // hull
  cv.rect(x + w * 0.2, y + h * 0.3, w * 0.12, h * 0.12, [200, 60, 50]); // bridge
  cv.rect(x + w * 0.36, y + h * 0.32, w * 0.3, h * 0.1, [180, 180, 180]); // containers
  cv.circle(x + w * 0.82, y + h * 0.5, 4, [200, 200, 200]); // mine
  cv.line(x + w * 0.82 - 6, y + h * 0.5, x + w * 0.82 + 6, y + h * 0.5, [200, 200, 200]);
  cv.line(x + w * 0.82, y + h * 0.5 - 6, x + w * 0.82, y + h * 0.5 + 6, [200, 200, 200]);
  cv.tri(x + w * 0.72, y + h * 0.45, x + w * 0.8, y + h * 0.45, x + w * 0.76, y + h * 0.25, [255, 170, 40]);
  cv.tri(x + w * 0.74, y + h * 0.45, x + w * 0.78, y + h * 0.45, x + w * 0.76, y + h * 0.33, [255, 90, 20]);
};

const scenePlaneS: Scene = (cv, x, y, w, h) => {
  // Airliner on the runway, grounded by the Delta outage.
  cv.rect(x, y, w, h, [142, 178, 214]);
  cv.rect(x, y + h * 0.75, w, h * 0.25, [120, 130, 140]); // runway
  cv.rect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.16, [240, 240, 240]); // fuselage
  cv.circle(x + w * 0.2, y + h * 0.48, Math.floor(h * 0.08), [240, 240, 240]);
  cv.circle(x + w * 0.8, y + h * 0.48, Math.floor(h * 0.08), [240, 240, 240]);
  cv.tri(x + w * 0.72, y + h * 0.4, x + w * 0.78, y + h * 0.4, x + w * 0.78, y + h * 0.18, [200, 60, 50]); // tail
  cv.tri(x + w * 0.42, y + h * 0.4, x + w * 0.58, y + h * 0.4, x + w * 0.5, y + h * 0.62, [200, 200, 210]); // wing
  for (let i = 0; i < 5; i++) {
    cv.rect(x + w * (0.3 + i * 0.08), y + h * 0.43, 3, 3, [36, 90, 160]);
  }
};

const sceneTennisS: Scene = (cv, x, y, w, h) => {
  // Hard court, net, and a yellow ball.
  cv.rect(x, y, w, h, [96, 160, 96]);
  cv.rect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.7, [60, 120, 200]);
  cv.rect(x + w * 0.1, y + h * 0.15, w * 0.8, 2, WHITE);
  cv.rect(x + w * 0.1, y + h * 0.83, w * 0.8, 2, WHITE);
  cv.line(x + w * 0.5, y + h * 0.15, x + w * 0.5, y + h * 0.85, WHITE);
  cv.rect(x, y + h * 0.48, w, 2, WHITE); // net
  cv.circle(x + w * 0.7, y + h * 0.3, 5, [230, 220, 60]); // ball
};

const sceneSoccerS: Scene = (cv, x, y, w, h) => {
  // Football pitch with a goal and the ball.
  cv.rect(x, y, w, h, [60, 140, 70]);
  cv.rect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.7, [80, 170, 90]);
  cv.line(x + w * 0.5, y + h * 0.15, x + w * 0.5, y + h * 0.85, WHITE);
  cv.line(x + w * 0.1, y + h * 0.5, x + w * 0.9, y + h * 0.5, WHITE);
  cv.rect(x + w * 0.12, y + h * 0.18, 3, h * 0.2, WHITE); // goal post
  cv.rect(x + w * 0.12, y + h * 0.18, w * 0.12, 3, WHITE); // crossbar
  cv.circle(x + w * 0.68, y + h * 0.62, 5, WHITE); // ball
  cv.circle(x + w * 0.68, y + h * 0.62, 2, INK);
};

// ------------------------------------------------------------- story data
// VERIFIED — every story was checked against its source (see
// research/stories.md for the full list with URLs). Every story happened
// or was first reported on Sunday 22 November 2026. Items whose event
// fell on 19-21 Nov are in the DATE CHECK box, never on the page.
type Tag = 'CONFIRMED' | 'CLAIM' | 'REPORTED' | 'PENDING' | 'FORECAST' | 'ONGOING';
type Story = {
  n: number;
  region: string;
  place: string;
  cat: string;
  tag: Tag;
  head: string;
  body: string;
  src: string;
  scene: Scene;
  lon: number;
  lat: number;
};

const TAG_COLOR: Record<Tag, RGB> = {
  CONFIRMED: GREEN,
  CLAIM: ORANGE,
  REPORTED: BLUE,
  PENDING: [160, 130, 20],
  FORECAST: PURPLE,
  ONGOING: TEAL,
};

const FEATURES: Story[] = [
  {
    n: 1, region: 'Europe', place: 'DYMER, KYIV REGION', cat: 'WAR', tag: 'CONFIRMED',
    head: 'Russia fires 186 drones at Ukraine',
    body: 'Russia launches 186 drones at Ukraine overnight; one collapses a five-storey block in Dymer, Kyiv region — 14 people missing, nine evacuated.',
    src: 'Ukrainian Air Force · Reuters', scene: sceneDrones, lon: 24, lat: 58,
  },
  {
    n: 2, region: 'World', place: 'ANTALYA, TÜRKIYE', cat: 'CLIMATE', tag: 'CONFIRMED',
    head: 'COP31 collapses, no deal',
    body: "Antalya ends in collapse: the EU and others reject the final 'Antalya Pact' — it names no fossil fuels. President Murat Kurum concedes no consensus.",
    src: 'CNN · Reuters · Le Monde', scene: sceneCop, lon: 36, lat: 36,
  },
  {
    n: 3, region: 'Americas', place: 'NORTH CAROLINA, USA', cat: 'POLITICS', tag: 'CONFIRMED',
    head: 'Democrats take the House',
    body: 'The last North Carolina race goes to Democrat Chuck Hubbard after a 330-vote recount; Rep. Virginia Foxx concedes. At least 258 seats — most since 1992.',
    src: 'CNN · AP', scene: sceneCapitol, lon: -72, lat: 47,
  },
];

const MEDIUM: Story[] = [
  {
    n: 4, region: 'Middle East', place: 'STRAIT OF HORMUZ', cat: 'GULF', tag: 'CLAIM',
    head: 'Iran: tankers hit by mines',
    body: 'Iran says two tankers hit mines near Hormuz; unverified.',
    src: 'Press TV', scene: sceneTankerS, lon: 60, lat: 26,
  },
  {
    n: 5, region: 'Americas', place: 'ATLANTA, USA', cat: 'AVIATION', tag: 'CONFIRMED',
    head: 'Delta outage delays 1,600+',
    body: 'Weight failure halts Atlanta flights; 1,600+ delayed.',
    src: 'CNN · FlightAware', scene: scenePlaneS, lon: -84, lat: 31,
  },
  {
    n: 6, region: 'Europe', place: 'TURIN, ITALY', cat: 'TENNIS', tag: 'CONFIRMED',
    head: 'Alcaraz wins ATP Finals title',
    body: 'Beats No. 1 Zverev 6-2, 7-6(7); first ATP Finals title.',
    src: 'Reuters', scene: sceneTennisS, lon: 6, lat: 47,
  },
  {
    n: 7, region: 'Europe', place: 'LIVERPOOL, ENGLAND', cat: 'FOOTBALL', tag: 'CONFIRMED',
    head: 'Liverpool rout Man Utd 4-0',
    body: "Thrashed 4-0 in Pochettino's debut; Yoro off.",
    src: 'Reuters', scene: sceneSoccerS, lon: -12, lat: 58,
  },
  {
    n: 8, region: 'Oceania', place: 'WELLINGTON, NZ', cat: 'CRICKET', tag: 'CONFIRMED',
    head: 'India declare 720/9, a record',
    body: 'Pant 128, highest Test total in New Zealand.',
    src: 'CricTracker', scene: sceneCricket, lon: 162, lat: -28,
  },
  {
    n: 9, region: 'Asia', place: 'CIKANDE, INDONESIA', cat: 'FIRE', tag: 'REPORTED',
    head: 'Cikande fire: 36 still missing',
    body: 'Search goes on for 36 missing after a factory fire kills 3.',
    src: 'Reuters', scene: sceneFire, lon: 108, lat: -1,
  },
  {
    n: 10, region: 'Africa', place: 'KHARTOUM, SUDAN', cat: 'WAR', tag: 'CONFIRMED',
    head: 'Drones kill four near Khartoum',
    body: 'Strikes blamed on the RSF damage a UN building.',
    src: 'Al Jazeera', scene: sceneFlag, lon: 30, lat: 15,
  },
  {
    n: 11, region: 'Asia', place: 'SEOUL, S. KOREA', cat: 'POLITICS', tag: 'CONFIRMED',
    head: 'S. Korea minister resigns',
    body: 'Minister quits over AI cheating in the Suneung exam.',
    src: 'Seoul Economic Daily', scene: sceneCourt, lon: 132, lat: 42,
  },
  {
    n: 12, region: 'Asia', place: 'SHANGHAI, CHINA', cat: 'MARKETS', tag: 'CONFIRMED',
    head: 'China eases margin to 80%',
    body: 'Exchanges cut margin ratio to 80% to aid stock markets.',
    src: 'Reuters', scene: sceneMarket, lon: 114, lat: 31,
  },
  {
    n: 13, region: 'Africa', place: 'DAKAR, SENEGAL', cat: 'RESCUE', tag: 'REPORTED',
    head: 'Senegal rescues 1,007 migrants',
    body: 'Navy rescues 1,007 people in 72 hours.',
    src: 'AfricanQuarters', scene: sceneBoat, lon: -18, lat: 15,
  },
];

// Also-on list: short one-liners, kept under ~54 characters each.
const ALSO: string[] = [
  '14 Bessent warns Fed on overtightening (CBS)',
  '15 Senate clears permitting bill 65-31 (BetaBriefing)',
  '16 Teen gamer helps FBI rescue missing girl (BBC)',
  '17 Brazil storm toll rises to 5 (World Media Feed)',
  '18 M5.4 aftershock hits Carhuamayo, Peru (USGS)',
  '19 Bolivia, Chile resume talks after 16 years (EIN)',
  '20 Europe protests enter third day (Daily Summary)',
  '21 Cyprus expels two Russian diplomats (POLITICO)',
  '22 Drone hits Russian corvette at Benghazi (Summary)',
  '23 Iran unveils new missile city (Summary)',
  '24 Saudi intercepts Houthi drone, missile (Summary)',
  '25 UAE condemns Iranian attack on Bahrain (Summary)',
  '26 Settlers burn vehicles in West Bank (Summary)',
  '27 Aoun demands Israeli withdrawal (Summary)',
  '28 WCK: Gaza strike dead were not its team (Summary)',
  '29 Japan to hold Futenma council by year-end (JIJI)',
  '30 Skubal agrees record $450M Mets deal (CNN)',
  '31 Cyclone Xavier weakens near Samoa (NWS)',
  '32 Waikato: a third struggle to afford food (Te Puke)',
];

const NUMBERS: { v: string; label: string }[] = [
  { v: '258', label: "Democrats' House seats, most since 1992" },
  { v: '186', label: 'drones Russia launched at Ukraine overnight' },
  { v: '$450M', label: 'record deal for pitcher Tarik Skubal' },
  { v: '1,600+', label: 'Delta flights delayed by the outage' },
  { v: '1,007', label: "migrants rescued by Senegal's navy" },
  { v: '720/9', label: "India's record Test total in New Zealand" },
];

const TIMELINE: { t: string; label: string }[] = [
  { t: '00:00', label: 'COP31 draft published' },
  { t: '12:46', label: 'FAA halts Delta to Atlanta' },
  { t: '14:05', label: 'COP31 collapses' },
  { t: '16:30', label: 'Atlanta delay lifted' },
  { t: '21:35', label: 'Peru aftershock M5.4' },
];

// Stories left out on purpose — they happened on other days.
const EXCLUDED: string[] = [
  'Peru quake — Fri 20 Nov',
  "'El Chapo Isidro' — Sat 21 Nov",
  'Myanmar ruling — Thu 19 Nov',
  'Kryvyi Rih strike — Fri 20 Nov',
  'Sparta II hit — Sat 21 Nov',
  'BepiColombo — Sat 21 Nov',
  'Nigeria boat — Fri 20 Nov',
  'Russia 400-drone barrage — Thu 19–Fri 20 Nov',
  'Copa Sudamericana final — Sat 21 Nov',
  'NWSL final — Sat 21 Nov',
];

const REGION_ORDER = ['Europe', 'Middle East', 'Americas', 'Asia', 'Africa', 'Oceania', 'World'];

// ---------------------------------------------------------------- layout
function paraMax(cv: Canvas, x: number, y: number, s: string, scale: number, maxW: number, c: RGB, maxLines: number): number {
  const lh = 7 * scale + 2;
  const lines = wrapText(cv, s, scale, maxW).slice(0, maxLines);
  let yy = y;
  for (const ln of lines) {
    cv.text(x, yy, ln, scale, c);
    yy += lh;
  }
  return yy;
}

function truncateTo(cv: Canvas, s: string, scale: number, maxW: number): string {
  if (cv.textWidth(s, scale) <= maxW) return s;
  let t = s;
  while (t.length > 1 && cv.textWidth(t + '…', scale) > maxW) t = t.slice(0, -1);
  return t + '…';
}

function tagChip(cv: Canvas, x: number, y: number, tag: Tag): void {
  const w = cv.textWidth(tag, 1) + 8;
  cv.rect(x, y, w, 13, TAG_COLOR[tag]);
  cv.text(x + 4, y + 3, tag, 1, WHITE);
}

function regionCount(region: string): number {
  let n = 0;
  for (const s of [...FEATURES, ...MEDIUM]) if (s.region === region) n++;
  for (const a of ALSO) {
    // also-items carry no region field; counts below are fixed by construction
  }
  return n;
}

// counts of the 19 also-items by region, as written in the ALSO list
const ALSO_COUNTS: Record<string, number> = {
  Europe: 2, 'Middle East': 6, Americas: 7, Asia: 1, Africa: 1, Oceania: 2, World: 0,
};

function drawPage(cv: Canvas): void {
  const W = 1024;
  const H = 1024;
  const MX = 12; // side margin
  const CW = W - MX * 2; // 1000
  cv.fill(PAPER);

  // ---- top banner
  cv.rect(0, 0, W, 24, INK);
  cv.text(12, 8, 'THE WORLD IN ONE DAY', 1, WHITE);
  cv.textRight(W - 12, 8, '32 STORIES · 7 REGIONS · EVERY ONE DATED SUNDAY 22 NOVEMBER 2026', 1, [200, 210, 225]);

  // ---- masthead
  cv.textCentered(W / 2, 30, 'Sunday 22 November 2026', 6, INK);
  cv.textCentered(W / 2, 78, 'COP31 collapses with no deal · Democrats take the House', 2, RED);
  cv.textCentered(W / 2, 94, '186 drones over Ukraine · Iran says tankers hit near Hormuz', 2, RED);
  cv.hline(MX, 110, CW, INK);

  // ---- numbers strip
  const cellW = CW / 6;
  for (let i = 0; i < NUMBERS.length; i++) {
    const cx = MX + i * cellW;
    if (i > 0) cv.vline(Math.round(cx), 114, 42, LINE);
    cv.textCentered(cx + cellW / 2, 116, NUMBERS[i].v, 3, RED);
    paraMax(cv, cx + 6, 140, NUMBERS[i].label, 1, cellW - 12, INK_SOFT, 2);
  }
  cv.hline(MX, 160, CW, INK);

  // ---- region tabs
  const tabLabels: Record<string, string> = {
    Europe: 'EUROPE 5', 'Middle East': 'MID EAST 7', Americas: 'AMERICAS 9',
    Asia: 'ASIA 4', Africa: 'AFRICA 3', Oceania: 'OCEANIA 3', World: 'WORLD 1',
  };
  const tabW = CW / 7;
  for (let i = 0; i < REGION_ORDER.length; i++) {
    const r = REGION_ORDER[i];
    cv.rect(MX + i * tabW + 1, 164, tabW - 2, 18, REGION_COLOR[r]);
    cv.textCentered(MX + i * tabW + tabW / 2, 169, tabLabels[r], 2, WHITE);
  }

  // ---- UTC timeline
  cv.rect(MX, 186, CW, 18, INK);
  let tx = MX + 8;
  cv.text(tx, 191, 'THE DAY IN UTC', 1, GOLD);
  tx += cv.textWidth('THE DAY IN UTC', 1) + 14;
  for (const it of TIMELINE) {
    cv.text(tx, 191, it.t, 1, GOLD);
    tx += cv.textWidth(it.t, 1) + 4;
    cv.text(tx, 191, it.label, 1, WHITE);
    tx += cv.textWidth(it.label, 1) + 16;
  }

  // ---- three feature stories
  const fcolW = 320;
  const fgap = 20;
  for (let i = 0; i < FEATURES.length; i++) {
    const s = FEATURES[i];
    const fx = MX + i * (fcolW + fgap);
    const fy = 208;
    s.scene(cv, fx, fy, fcolW, 140);
    cv.rect(fx, fy + 140 - 13, fcolW, 1, LINE);
    tagChip(cv, fx + fcolW - (cv.textWidth(s.tag, 1) + 8), fy + 140 - 13, s.tag);
    cv.text(fx, fy + 152, `${s.n} · ${s.place} · ${s.cat}`, 1, REGION_COLOR[s.region]);
    paraMax(cv, fx, fy + 166, s.head, 3, fcolW, INK, 3);
    paraMax(cv, fx, fy + 238, s.body, 1, fcolW, INK_SOFT, 3);
    cv.text(fx, fy + 268, s.src, 1, GRAY);
    cv.rect(fx, fy, fcolW, 1, LINE);
  }
  cv.hline(MX, 484, CW, INK);

  // ---- the day in ten
  cv.text(MX, 490, 'THE DAY IN TEN', 2, INK);
  cv.textRight(W - MX, 492, 'THE STORIES THAT MOVED THE WORLD TODAY', 1, INK_SOFT);
  const mcolW = 192;
  const mgap = 10;
  for (let i = 0; i < MEDIUM.length; i++) {
    const s = MEDIUM[i];
    const col = i % 5;
    const row = Math.floor(i / 5);
    const mx = MX + col * (mcolW + mgap);
    const my = 506 + row * 136;
    s.scene(cv, mx, my, mcolW, 52);
    tagChip(cv, mx + mcolW - (cv.textWidth(s.tag, 1) + 8), my + 52 - 13, s.tag);
    cv.text(mx, my + 60, `${s.n} · ${s.place}`, 1, REGION_COLOR[s.region]);
    paraMax(cv, mx, my + 72, s.head, 2, mcolW, INK, 2);
    paraMax(cv, mx, my + 106, s.body, 1, mcolW, INK_SOFT, 2);
    cv.text(mx, my + 126, s.src, 1, GRAY);
  }

  // ---- bottom band: map + also list
  const bandY = 784;
  const bandH = 132;
  cv.text(MX, bandY, 'WHERE IT HAPPENED', 2, INK);
  cv.textRight(W - MX, bandY + 2, 'PINS MATCH STORY NUMBERS', 1, INK_SOFT);
  const pins = [...FEATURES, ...MEDIUM].map((s) => ({ lon: s.lon, lat: s.lat, n: s.n }));
  drawMap(cv, MX, bandY + 16, 330, bandH - 16, pins);
  const ax = MX + 340;
  cv.text(ax, bandY, 'ALSO ON SUNDAY — 19 MORE STORIES', 2, INK);
  const colW = 325;
  for (let i = 0; i < ALSO.length; i++) {
    const col = Math.floor(i / 11);
    const row = i % 11;
    const lx = ax + col * (colW + 10);
    const ly = bandY + 18 + row * 11;
    cv.text(lx, ly, truncateTo(cv, ALSO[i], 1, colW), 1, INK);
  }

  // ---- date check
  const dcY = 924;
  cv.rect(MX, dcY, CW, 58, WHITE);
  cv.rect(MX, dcY, CW, 1, RED);
  cv.rect(MX, dcY + 57, CW, 1, RED);
  cv.rect(MX, dcY, 1, 58, RED);
  cv.rect(MX + CW - 1, dcY, 1, 58, RED);
  cv.text(MX + 8, dcY + 6, 'DATE CHECK — READ THIS FIRST', 1, RED);
  paraMax(cv, MX + 8, dcY + 18,
    'Every story on this page happened or was first reported on Sun 22 Nov 2026 (UTC), to press time 22:00 UTC. Left out on purpose:',
    1, CW - 16, INK, 1);
  paraMax(cv, MX + 8, dcY + 29, EXCLUDED.join(' · '), 1, CW - 16, INK_SOFT, 2);
  cv.text(MX + 8, dcY + 49, "Tonight's real story: COP31 ended with NO deal — the pact was rejected, not approved.", 1, RED);

  // ---- footer
  cv.textCentered(W / 2, 990, 'Sources: CNN · Reuters · BBC · AP · Al Jazeera · Press TV · Daily Summary of World · USGS · CricTracker · NWS · JIJI Press', 1, INK_SOFT);
  cv.textCentered(W / 2, 1000, 'CONFIRMED = official / 2+ outlets · CLAIM = one side’s account · REPORTED = one source · PENDING = not settled · FORECAST = still to happen', 1, INK_SOFT);
  cv.rect(0, 1012, W, 12, INK);
  cv.text(12, 1015, 'THE WORLD IN ONE DAY', 1, WHITE);
  cv.textRight(W - 12, 1015, 'SUNDAY 22 NOVEMBER 2026 · ONE PAGE', 1, WHITE);
}

// ------------------------------------------------------------------- main
function main(): void {
  const cv = new Canvas(1024, 1024);
  drawPage(cv);
  const png = encodePng(1024, 1024, cv.buf);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
