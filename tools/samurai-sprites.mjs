#!/usr/bin/env node
// Builds the samurai's crouch strip from his idle strip (LuizMelo's CC0
// "Martial Hero", see CREDITS.md). The pack has no crouch, so this one is made
// here: the hat, head, scarf, shoulders and hands are cut from each idle frame
// and moved down 1:1 (no scaling), the head piece sunk into the shoulders and
// leaning forward; the folded legs, the coat on the deck and the katana are
// redrawn in colours taken from the idle strip.
//
//   node tools/samurai-sprites.mjs            writes public/assets/samurai/crouch.png
//   node tools/samurai-sprites.mjs --preview  also writes candidates/samurai-preview.png:
//                                             idle, the old squashed crouch and the new
//                                             frames at 5x, mirrored, and at 2x, with the
//                                             floor and the 60 px / 98 px game-height guides
//
// Same format as the other strips: 190x72 frames at 1x, facing right, feet on
// the bottom row. Each crouch frame comes from the idle frame with the same
// index, so the breathing (and the scarf) keeps moving. Edit this script and
// re-run it; do not hand-edit crouch.png.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAM_DIR = join(ROOT, 'public/assets/samurai');
const CAND = join(ROOT, 'candidates');

/** Frame size of every samurai strip (1x pixels; the game draws them at 2.4x). */
const FW = 190, FH = 72;

// Colours of the idle strip, one letter each, for the hand-drawn parts below.
const PAL = {
  A: '#331a19', // hakama, darkest brown
  E: '#4d2d2c', // hakama, lit folds
  B: '#97828a', // coat, shade
  C: '#beacb3', // coat, light
  M: '#341a25', // coat lining / sleeve shadow
  J: '#5f4181', // blade, upper edge
  L: '#442b61', // blade, lower edge
};
const RED = new Set(['#ce2038', '#8a0b41']); // scarf
const BLADE = new Set([PAL.J, PAL.L]);

// ---------- tiny raster ----------

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hexAt = (d, i) => '#' + [0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, '0')).join('');

class Frame {
  constructor(w = FW, h = FH) { this.w = w; this.h = h; this.col = new Array(w * h).fill(null); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.col[y * this.w + x] : null; }
  set(x, y, c) { if (this.in(x, y)) this.col[y * this.w + x] = c; }
  /** First and last row with an opaque pixel. */
  rows() {
    let top = -1, bottom = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) { if (top < 0) top = y; bottom = y; }
    }
    return [top, bottom];
  }
}

function readStrip(path) {
  const png = PNG.sync.read(readFileSync(path));
  const frames = [];
  for (let f = 0; f < png.width / FW; f++) {
    const fr = new Frame();
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = (y * png.width + f * FW + x) * 4;
      if (png.data[i + 3] > 0) fr.set(x, y, hexAt(png.data, i));
    }
    frames.push(fr);
  }
  return frames;
}

function stripPNG(frames) {
  const png = new PNG({ width: FW * frames.length, height: FH });
  png.data.fill(0);
  frames.forEach((fr, n) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const c = fr.get(x, y);
      if (c) png.data.set([...hex(c), 255], (y * png.width + n * FW + x) * 4);
    }
  });
  return png;
}

/** Paint letter art (PAL letters, '.' = leave as is) with its top-left at (x0, y0). */
function art(out, rows, x0, y0) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) out.set(x0 + x, y0 + y, PAL[ch]); }));
}

// ---------- crouch ----------

// Idle frame 0 rows (the others breathe up to 3 rows lower): hat 20-33, head and
// scarf 29-37, shoulders and chest 37-47, arms, hands and hilt 44-52, coat and
// hakama 53-71 (feet on row 71), blade from the hilt down to the back.
const HEAD_LAST = 43;            // head piece: hat, head, scarf, shoulders (rows up to here)
const HANDS = [44, 51];          // hands piece: arms and hands on the hilt (no scarf, no blade)
const HEAD_MOVE = { dx: 2, dy: 21 }; // 4 rows deeper than the hands: hunched, leaning forward
const HANDS_MOVE = { dx: 1, dy: 17 };

/** Back of the coat spread on the deck, the hakama on the deck, front foot. Drawn behind. */
const DECK_AT = [80, 67];
const DECK = [
  '..........CCBB............................',
  '........CCCCBB............................',
  '......CCCCCBBBA...........................',
  '....CCCCCCBBBAAAAAAAAAAAAAAAAAAEEAAABCC...',
  '..BCCCCCCBBBBAAAAAAAAAAAAAAAAAAAAAAABCCCB.',
];

/** Near thigh rising to the raised front knee, shin going down to the foot; over the hands. */
const LAP_AT = [80, 64];
const LAP = [
  '..............................AEEA........',
  '.............................AEEEEEA......',
  '.......................AAAAAAEEEEEEA......',
  '..................AAAAAEEEEEEEEEEEEA......',
  '...............AAAEEEEEEEEAAAAEEEEA.......',
  '...............AAAAAAAAAAAAAAAAEEAA.......',
];

/** The katana held low and back, drawn like the blade in the walk frames. */
const BLADE_HILT = [97, 67], BLADE_TIP = [71, 69];
function blade(out) {
  const [x1, y1] = BLADE_HILT, [x0, y0] = BLADE_TIP;
  for (let x = x0; x <= x1; x++) {
    const y = Math.round(y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));
    out.set(x, y, PAL.J);
    out.set(x, y + 1, PAL.L);
  }
}

/**
 * One crouch frame from one idle frame. `b` = how many rows this idle frame's
 * upper body sits below frame 0's (its breath); the crouch breathes less.
 */
function crouch(src, b) {
  const out = new Frame();
  const headBob = Math.round((b * 2) / 3), handsBob = Math.floor(b / 2);
  const copy = (pick, move, bob) => {
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const c = src.get(x, y);
      if (c && pick(c, y - b)) out.set(x + move.dx, y - b + move.dy + bob, c);
    }
  };
  // The scarf tail below the head piece flies behind the body: drawn first.
  copy((c, y) => y > HEAD_LAST && RED.has(c), HEAD_MOVE, headBob);
  art(out, DECK, ...DECK_AT);
  blade(out);
  copy((c, y) => y >= HANDS[0] && y <= HANDS[1] && !RED.has(c) && !BLADE.has(c), HANDS_MOVE, handsBob);
  art(out, LAP, ...LAP_AT);
  copy((c, y) => y <= HEAD_LAST, HEAD_MOVE, headBob);
  return out;
}

function buildCrouch(idle) {
  const top0 = Math.min(...idle.map((fr) => fr.rows()[0]));
  return idle.map((fr) => crouch(fr, fr.rows()[0] - top0));
}

// ---------- preview ----------

// 3x5 pixel font for the labels (same as tools/prop-sprites.mjs).
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', W: '101101111111101',
  X: '101101010101101', Y: '101101010010010', 0: '111101101101111', 1: '010110010010111',
  2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', '-': '000000111000000', '(': '010100100100010', ')': '010001001001010',
  '/': '001001010100100', ',': '000000000010100', ':': '000010000010000', ' ': '000000000000000', '?': '110001010000010',
};

function rect(dst, x, y, w, h, rgb) {
  for (let yy = Math.max(0, y); yy < Math.min(dst.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(dst.width, x + w); xx++) dst.data.set([...rgb, 255], (yy * dst.width + xx) * 4);
  }
}

function text(dst, str, x, y, k = 2, color = '#ffffff') {
  for (const ch of str) {
    const glyph = FONT[ch] ?? FONT['?'];
    for (let i = 0; i < 15; i++) if (glyph[i] === '1') rect(dst, x + (i % 3) * k, y + Math.floor(i / 3) * k, k, k, hex(color));
    x += 4 * k;
  }
}

/** The game's old crouch: idle squashed to sx 1.12, sy 0.58 about the feet (centre bottom). */
function oldCrouch(fr) {
  return (x, y) => fr.get(Math.floor(FW / 2 + (x - FW / 2) / 1.12), Math.floor(FH - (FH - y) / 0.58));
}

const BG = hex('#6e6878'), BELOW = hex('#4a3c34');
const GUIDES = [
  [0, hex('#f0e0c0')],   // the floor, under the feet
  [25, hex('#5ee07a')],  // 60 px on screen: the crouch hurtbox
  [40.8, hex('#ff6ad5')], // 98 px on screen: bottom of the high shot
];

/**
 * One cell: `sample(x, y)` gives the colour at source position (x, y) (floats;
 * frame coordinates, feet on row 71) or null. Drawn at k px per source px.
 */
function cell(dst, ox, oy, k, view, sample, label) {
  const { x0, y0, w, h } = view;
  for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
    const sx = x0 + x / k, sy = y0 + y / k;
    const c = sample(sx, sy);
    dst.data.set([...(c ? hex(c) : sy >= FH ? BELOW : BG), 255], ((oy + y) * dst.width + ox + x) * 4);
  }
  for (const [above, rgb] of GUIDES) {
    const y = Math.round((FH - above - y0) * k);
    if (y >= 0 && y < h * k) rect(dst, ox, oy + y - 1, w * k, 2, rgb);
  }
  if (label) text(dst, label, ox + 4, oy + 4, 2, '#ffffff');
}

function preview(idle, frames) {
  const pick = (fr) => (x, y) => fr.get(Math.floor(x), Math.floor(y));
  const mirror = (fr) => (x, y) => fr.get(FW - 1 - Math.floor(x), Math.floor(y));
  const view = { x0: 62, y0: 14, w: 64, h: 62 };
  const mview = { ...view, x0: FW - view.x0 - view.w };
  const big = [
    [view, pick(idle[0]), 'IDLE 0'],
    [view, oldCrouch(idle[0]), 'OLD CROUCH'],
    ...frames.slice(0, 4).map((fr, i) => [view, pick(fr), `CROUCH ${i}`]),
    ...frames.slice(4).map((fr, i) => [view, pick(fr), `CROUCH ${i + 4}`]),
    [mview, mirror(frames[0]), 'CROUCH 0 FLIPPED'],
    [mview, mirror(idle[0]), 'IDLE 0 FLIPPED'],
  ];
  const k = 5, gap = 8, perRow = 6;
  const small = [pick(idle[0]), oldCrouch(idle[0]), pick(frames[0]), mirror(frames[0])];
  const sk = 2, sview = { x0: 50, y0: 10, w: 90, h: 66 };
  const W = perRow * (view.w * k + gap) + gap;
  const bigH = Math.ceil(big.length / perRow) * (view.h * k + gap);
  const H = gap + bigH + 24 + sview.h * sk + gap;
  const out = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) out.data.set([26, 26, 34, 255], i * 4);
  big.forEach(([v, s, label], i) => {
    const ox = gap + (i % perRow) * (v.w * k + gap), oy = gap + Math.floor(i / perRow) * (v.h * k + gap);
    cell(out, ox, oy, k, v, s, label);
  });
  const sy = gap + bigH;
  text(out, 'AT 2X (THE GAME DRAWS 2.4X): IDLE, OLD CROUCH, CROUCH 0, FLIPPED.  LINES: FLOOR, 60 PX HURTBOX, 98 PX HIGH SHOT', gap, sy + 4, 2, '#ffe9b0');
  small.forEach((s, i) => {
    const v = i === 3 ? { ...sview, x0: FW - sview.x0 - sview.w } : sview;
    cell(out, gap + i * (sview.w * sk + gap), sy + 22, sk, v, s);
  });
  return out;
}

// ---------- main ----------

const idle = readStrip(join(SAM_DIR, 'idle.png'));
const used = new Set(idle.flatMap((fr) => fr.col.filter(Boolean)));
for (const c of Object.values(PAL)) if (!used.has(c)) throw new Error(`${c} is not an idle colour`);
const frames = buildCrouch(idle);
for (const fr of frames) if (fr.rows()[1] !== idle[0].rows()[1]) throw new Error('crouch feet are not on the idle feet row');
writeFileSync(join(SAM_DIR, 'crouch.png'), PNG.sync.write(stripPNG(frames)));
const tall = (fr) => fr.rows()[1] - fr.rows()[0] + 1;
console.log(`wrote public/assets/samurai/crouch.png: ${frames.length} frames, ${frames.map(tall).join('/')} px tall (idle ${idle.map(tall).join('/')})`);
if (process.argv.includes('--preview')) {
  mkdirSync(CAND, { recursive: true });
  writeFileSync(join(CAND, 'samurai-preview.png'), PNG.sync.write(preview(idle, frames)));
  console.log('wrote candidates/samurai-preview.png');
}
