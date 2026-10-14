// City vignettes after Joan Martines's chart of the Mediterranean, Messina 1584 (Trinity College
// Cambridge R.4.50): a walled town in three-quarter elevation, cream blocks edged in madder with slit
// windows, round towers under a lead hat band and a conical spike, a flat lead dome where asked, on a
// rock or a green plinth, and a pole with a red ball carrying a flag. Drawn in that idiom, not traced.
//
// Each variant is a handful of parameters; the drawing follows from them and a seed, so the output is
// the same on every run. `node scripts/gen-towns.mjs` rewrites packs/vivid/town-martines-*.svg;
// test/vivid-sprites.test.mjs checks the committed files match what this writes.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AFTER = 'https://trinitycollegelibrarycambridge.wordpress.com/2015/08/14/portolan-chart-of-the-mediterranean/';
const INK = '#2a1d12', WALL = '#f1e6c8', SHADE = '#e6d6b0', MADDER = '#a3332a', RED = '#c23a28', LEAD = '#7d7a72',
  ROCK = '#9aa3a8', GREEN = '#6f9a52', GILT = '#c9a13b', WHITE = '#ffffff';

// towers: count; tall: the tallest tower's rise above the wall top; width: the wall's width; tiers:
// rows of blocks, back to front, each a terrace above the next; dome: a flat lead dome mid-town;
// finial: 'crescent' on a pole over the town, or none; ground: 'rock' (grey, a dark shadow at its
// left) or 'green'; keep: a square keep in the middle instead of blocks; flag: { ground, device }
// with device 'cross', 'crescent' or none.
export const VARIANTS = {
  port: { seed: 11, towers: 4, tall: 30, width: 52, tiers: 4, dome: false, ground: 'rock', flag: { ground: WHITE, device: 'cross', size: 18 } },
  levant: { seed: 23, towers: 5, tall: 24, width: 96, tiers: 2, dome: true, finial: 'crescent', ground: 'green', flag: { ground: RED, device: 'crescent', size: 16 } },
  small: { seed: 37, towers: 1, tall: 16, width: 24, tiers: 1, dome: false, ground: 'green', gate: true, flag: { ground: RED } },
  fort: { seed: 41, towers: 2, tall: 12, width: 40, tiers: 1, dome: false, keep: true, ground: 'green', gate: true, flag: { ground: WHITE, device: 'cross' } },
};

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => String(Math.round(v * 10) / 10);

export function townSVG(name, p) {
  const rnd = mulberry32(p.seed);
  const out = [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const see = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  const rect = (x, y, w, h, fill, extra = '') => { see(x, y); see(x + w, y + h); out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra}/>`); };
  const path = (d, fill, extra = '') => out.push(`<path d="${d}" fill="${fill}"${extra}/>`);
  const line = (xa, ya, xb, yb, stroke, w) => out.push(`<path d="M${n(xa)},${n(ya)} L${n(xb)},${n(yb)}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`);

  // slit windows, in pairs, along a row
  const slits = (x, y, w, h) => {
    const pairs = Math.max(1, Math.floor(w / 7));
    for (let i = 0; i < pairs; i++) {
      const cx = x + (w * (i + 0.5)) / pairs;
      for (const dx of [-1, 0.8]) rect(cx + dx - 0.35, y, 0.7, h, INK, ' stroke="none"');
    }
  };
  // merlons along a top edge
  const merlons = (x, y, w) => {
    const k = Math.max(2, Math.round(w / 3.2)), step = w / k;
    let d = `M${n(x)},${n(y)}`;
    for (let i = 0; i < k; i++) d += ` L${n(x + i * step)},${n(y - 1.6)} L${n(x + i * step + step * 0.55)},${n(y - 1.6)} L${n(x + i * step + step * 0.55)},${n(y)} L${n(x + (i + 1) * step)},${n(y)}`;
    see(x, y - 1.6);
    path(d + ' Z', WALL, ` stroke="${INK}" stroke-width="0.5"`);
  };
  // a cream block, its top and foot ruled in madder, crenellated, one or two rows of slits
  const block = (x, base, w, h) => {
    rect(x, base - h, w, h, WALL, ` stroke="${INK}" stroke-width="0.85"`);
    rect(x + w - Math.min(3, w * 0.22), base - h, Math.min(3, w * 0.22), h, SHADE, ' stroke="none"');
    merlons(x, base - h, w);
    line(x, base - h + 0.6, x + w, base - h + 0.6, MADDER, 0.9);
    line(x, base - 0.5, x + w, base - 0.5, MADDER, 0.7);
    slits(x, base - h + 3.2, w, 2.4);
    if (h > 11) slits(x, base - h + 8, w, 2.4);
  };
  // a round tower: shaft, lead hat band ruled in madder beneath, a conical spike, red or lead
  const tower = (cx, base, r, top, spike) => {
    rect(cx - r, top, 2 * r, base - top, WALL, ` stroke="${INK}" stroke-width="0.85"`);
    rect(cx + r * 0.35, top, r * 0.65, base - top, SHADE, ' stroke="none"');
    line(cx - r, top + 3.6, cx + r, top + 3.6, MADDER, 1);
    for (let y = top + 6; y < base - 4; y += 9) for (const dx of [-0.9, 0.9]) rect(cx + dx - 0.35, y, 0.7, 2.6, INK, ' stroke="none"');
    rect(cx - r - 1.1, top - 0.6, 2 * r + 2.2, 2.4, LEAD, ` stroke="${INK}" stroke-width="0.5"`);
    const sh = r * 3.4;
    see(cx, top - 0.6 - sh);
    path(`M${n(cx - r * 0.95)},${n(top - 0.6)} L${n(cx)},${n(top - 0.6 - sh)} L${n(cx + r * 0.95)},${n(top - 0.6)} Z`, spike, ` stroke="${INK}" stroke-width="0.5" stroke-linejoin="round"`);
    return top - 0.6 - sh;
  };
  // a pole with a red ball; a flag at its head, or a crescent finial
  const pole = (x, base, top) => { see(x, top); line(x, base, x, top, INK, 0.7); };
  const ball = (x, y) => { see(x - 1.4, y - 1.4); out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="1.5" fill="${RED}" stroke="${INK}" stroke-width="0.4"/>`); };
  const flag = (x, y, f) => {
    const w = f.size ?? 14, h = w * 0.65;
    rect(x, y, w, h, f.ground, ` stroke="${INK}" stroke-width="0.7"`);
    if (f.device === 'cross') {
      const c = f.ground === RED ? WHITE : RED;
      rect(x + w / 2 - 1.1, y + 0.4, 2.2, h - 0.8, c, ' stroke="none"');
      rect(x + 0.4, y + h / 2 - 1.1, w - 0.8, 2.2, c, ' stroke="none"');
    } else if (f.device === 'crescent') {
      const cx = x + w / 2, cy = y + h / 2;
      path(`M${n(cx - 3)},${n(cy - 2.4)} A3.4,3.4 0 1,0 ${n(cx + 3)},${n(cy - 2.4)} A2.7,2.7 0 1,1 ${n(cx - 3)},${n(cy - 2.4)} Z`, GILT, ` stroke="${INK}" stroke-width="0.3"`);
    }
  };
  const crescent = (x, y) => {
    see(x - 3, y - 4);
    path(`M${n(x - 2.8)},${n(y - 3.4)} A3,3 0 0,0 ${n(x + 2.8)},${n(y - 3.4)} A2.3,2.3 0 0,1 ${n(x - 2.8)},${n(y - 3.4)} Z`, INK);
  };

  // ground: a lozenge of rock or grass the town stands on, its top at y = 0
  const gw = p.width / 2 + (p.ground === 'rock' ? 4 : 10);
  if (p.ground === 'rock') {
    // a grey hill, rising to the town's foot, with a dark shadow down its left flank
    path(`M${n(-gw - 3)},${n(6)} Q${n(-gw - 4)},${n(-4)} ${n(-gw + 2)},${n(-8)} Q${n(-gw + 2)},${n(2)} ${n(-gw + 7)},${n(9)} Z`, INK, ' fill-opacity="0.8"');
    path(`M${n(-gw)},${n(6)} Q${n(-gw - 1)},${n(-6)} ${n(-gw * 0.5)},${n(-6)} L${n(gw * 0.5)},${n(-6)} Q${n(gw + 1)},${n(-6)} ${n(gw)},${n(6)} Q${n(0)},${n(11)} ${n(-gw)},${n(6)} Z`, ROCK, ` stroke="${INK}" stroke-width="0.6"`);
    see(-gw - 4, 11); see(gw + 1, 11);
  } else {
    path(`M${n(-gw)},${n(1.5)} Q${n(-gw * 0.5)},${n(-2)} ${n(0)},${n(-1.5)} Q${n(gw * 0.6)},${n(-1.5)} ${n(gw)},${n(1)} Q${n(gw * 0.4)},${n(6)} ${n(0)},${n(5.5)} Q${n(-gw * 0.6)},${n(5.5)} ${n(-gw)},${n(1.5)} Z`, GREEN, ` stroke="${GREEN}" stroke-width="0.6" stroke-opacity="0.8"`);
    see(-gw, 6); see(gw, 6);
  }

  // tiers back to front: tier k stands `step` above the one in front of it and is narrower
  const step = 8, front = p.ground === 'rock' ? -4 : 0;
  const tierBase = (k) => front - (p.tiers - 1 - k) * step;
  const tierHalf = (k) => p.width / 2 - (p.tiers - 1 - k) * (p.tiers > 2 ? 2.5 : 6);
  const wallTop = tierBase(0) - 12;

  // towers spread across the back tier, the tallest nearest the middle, one lead spike among them
  const towers = [];
  for (let i = 0; i < p.towers; i++) {
    const t = p.towers === 1 ? 0 : (i / (p.towers - 1)) * 2 - 1; // -1..1
    const half = p.keep ? p.width / 2 - 3 : tierHalf(0) - 2;
    const cx = t * half, small = p.towers >= 5 && (i === 1 || i === 3);
    const rise = p.tall * (small ? 0.35 : 1 - 0.45 * Math.abs(t)) * (0.85 + rnd() * 0.3);
    towers.push({ cx, r: small ? 2 : 3 + rnd() * 0.8, top: wallTop - rise, spike: p.towers >= 3 && i === Math.floor(p.towers / 2) ? LEAD : RED });
  }

  // the flag on its own pole at the town's right shoulder, as tall again as the town, or on the
  // tallest tower's spike when there is one in the middle
  const tallest = towers.reduce((a, b) => (b.top < a.top ? b : a), towers[0]);
  let flagAt = null;

  // back tier, then the towers, then the tiers in front of them
  const blocksOf = (k) => {
    const half = tierHalf(k), base = tierBase(k), bs = [];
    for (let x = -half; x < half - 0.5;) {
      const w = Math.min(half - x, 7 + rnd() * 6);
      bs.push([x, base, w, step + 5 + rnd() * 6]);
      x += w;
    }
    return bs;
  };
  if (!p.keep) for (const b of blocksOf(0)) block(...b);
  for (const t of towers) {
    const tip = tower(t.cx, tierBase(0) - 2, t.r, t.top, t.spike);
    if (t === tallest && p.towers >= 3 && !p.finial) flagAt = { x: t.cx, base: tip, top: tip - 14 };
  }
  if (p.dome) {
    const rx = p.width * 0.2, cy = tierBase(0) - 10;
    rect(-rx, cy, 2 * rx, 4, WALL, ` stroke="${INK}" stroke-width="0.85"`);
    see(-rx, cy - rx * 0.42);
    path(`M${n(-rx)},${n(cy)} Q${n(-rx * 0.9)},${n(cy - rx * 0.42)} 0,${n(cy - rx * 0.42)} Q${n(rx * 0.9)},${n(cy - rx * 0.42)} ${n(rx)},${n(cy)} Z`, LEAD, ` stroke="${INK}" stroke-width="0.7"`);
    line(-rx, cy + 0.3, rx, cy + 0.3, MADDER, 0.9);
  }
  if (p.keep) {
    const kw = p.width * 0.42, kh = 30;
    block(-kw / 2, tierBase(0), kw, kh);
    rect(-kw / 2 - 0.4, tierBase(0) - kh - 0.6, kw + 0.8, 2, LEAD, ` stroke="${INK}" stroke-width="0.5"`);
  }
  for (let k = 1; k < p.tiers; k++) for (const b of blocksOf(k)) block(...b);
  // a front curtain: a low wall the width of the town, its gate in the middle
  if (p.gate || p.keep || p.tiers === 1) {
    const half = p.width / 2 + 2, h = 8;
    block(-half, front, 2 * half, h);
    path(`M${n(-2.4)},${n(front)} L${n(-2.4)},${n(front - 3.6)} Q0,${n(front - 6.8)} ${n(2.4)},${n(front - 3.6)} L${n(2.4)},${n(front)} Z`, INK);
  }
  if (p.finial === 'crescent') {
    const top = tallest.top - 18;
    pole(tallest.cx, tallest.top - tallest.r * 3.4, top);
    crescent(tallest.cx, top);
    flagAt = { x: tierHalf(0) - 6, base: tierBase(0) - 12, top: top - 4 };
  }
  if (!flagAt) flagAt = { x: tallest.cx, base: tallest.top, top: tallest.top - (p.towers === 1 ? 14 : 18) };
  pole(flagAt.x, flagAt.base, flagAt.top);
  flag(flagAt.x, flagAt.top + 1.6, p.flag);
  ball(flagAt.x, flagAt.top);

  // viewBox centred on x = 0, foot of the ground at its bottom edge
  const pad = 1.5, half = Math.max(-x0, x1) + pad, top = y0 - pad, bottom = y1 + pad;
  const vw = 2 * half, vh = bottom - top, scale = 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-half)} ${n(top)} ${n(vw)} ${n(vh)}" width="${Math.round(vw * scale)}" height="${Math.round(vh * scale)}">
  <!-- After the city vignettes on Joan Martines's portolan chart, Messina 1584 (Trinity College
       Cambridge R.4.50), ${AFTER}
       Variant "${name}". Drawn, not traced, by scripts/gen-towns.mjs; do not edit by hand.
       Transparent ground, for the renderer's \`multiply\`; the town point is the bottom centre. -->
  <g stroke-linejoin="miter">
    ${out.join('\n    ')}
  </g>
</svg>
`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const fileOf = (name) => join(ROOT, 'packs', 'vivid', `town-martines-${name}.svg`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, p] of Object.entries(VARIANTS)) {
    writeFileSync(fileOf(name), townSVG(name, p));
    console.log(fileOf(name));
  }
}
