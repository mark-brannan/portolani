// Town drawings after Jorge de Aguiar's portolan chart, 1492 (Beinecke Library, Yale): buildings in
// oblique elevation, a cream front face and a blue-grey side face, vermilion roofs (hipped, gabled,
// rounded like a cushion, or a needle spire), paired slit windows, madder hatching down the walls,
// standing on a boat-shaped wall seen from above, a green hill or the ground. The crops these follow
// are in docs/towns-aguiar/. Drawn in that idiom, not traced.
//
// A town is drawn as the painter would: rows of oblique boxes, the back rows higher and drawn first,
// so a front building hides part of the one behind it; each box turns its side face away from the
// middle of the town, and every corner and edge is nudged by a seeded jitter for the hand line. Each
// variant is a plan and a handful of parameters; the drawing follows from them and a seed, so the
// output is the same on every run and another seed draws another town of the same kind.
// `node scripts/gen-towns-aguiar.mjs` rewrites packs/vivid/town-aguiar-*.svg (with `--sheets`, the sheets below);
// test/vivid-sprites.test.mjs checks the committed files match what this writes.
//
// The halo of rays (Venice) and the lake with its rivers (the "jellyfish" around the walled town in
// the Saharan lake) belong to one place each: their variants carry `only`, the town names they are
// drawn for, and pack.json carries the same field so the scene keeps them for those towns alone.
// The rays go to the city they were drawn for. The lake town is nowhere on today's map, so the lake
// goes to Mexico City: Tenochtitlan was the walled city in its lake, causeways leaving it.
//
// Each general kind is committed at three seeds, so the towns of one kind differ across a map.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AFTER = 'https://commons.wikimedia.org/wiki/File:Jorge_Aguiar_1492_MR.jpg';
const INK = '#3a2415';
const FULL = { front: '#fbf4e2', side: '#a7bcb3', top: '#e4d9bd', roof: '#c9452b', roofSide: '#a2321d', pink: '#c9705e', gate: '#2a1a10' };
const LIGHT = { ...FULL, side: '#d6ddd3', roof: '#e7b9a8', roofSide: '#d39b88', pink: '#d99a8c' }; // Jerusalem: ink and the lightest washes
const HILL = '#97b073', HILL_DARK = '#56753d', LAPIS = '#2f5891', RAYS = ['#3f6e9c', '#5f8f86', '#46779a'], POOL = '#cddfd6';

// plan: how the town is laid out — 'boat' (a lens-shaped wall seen from above, buildings behind its
// rim), 'hall' (the same round one great red-roofed hall), 'towers' (slender towers and spires on
// the ground), 'hill' (buildings stepping up a green hill behind a wall), 'church', 'gate' (a lone
// gate tower) or 'venice'; width: across the town, in scan px; rows: rows of buildings behind the
// wall; roofs: the odds of each roof; halo: 'rays' or 'moat', for the special towns only.
const KINDS = {
  walled: { after: 'the walled town in the Saharan lake', seed: 3, plan: 'boat', width: 80, rows: 2, keep: true, gate: true, roofs: { hip: 4, gable: 1, flat: 1 } },
  hall: { after: 'Smina on the Niger', seed: 7, plan: 'hall', width: 84, rows: 1, roofs: { cushion: 3, hip: 1 } },
  towers: { after: 'Genoa, without its mole', seed: 11, plan: 'towers', width: 72, towers: 7, roofs: { hip: 3, cushion: 1 } },
  hill: { after: 'Lisbon on its hill', seed: 5, plan: 'hill', width: 92, rows: 3, roofs: { hip: 4, gable: 1, cushion: 1 } },
  church: { after: 'Jerusalem', seed: 19, plan: 'church', width: 66, light: true },
  gate: { after: 'the gate tower at Ceuta', seed: 23, plan: 'gate', width: 34 },
  venice: { after: 'Venice in its halo of rays', seed: 29, plan: 'venice', width: 84, halo: 'rays', only: ['Venice'], roofs: { hip: 3, gable: 1 } },
  moat: { after: 'the walled town in its lake, the rivers leaving it', seed: 31, plan: 'boat', width: 68, rows: 2, keep: true, gate: true, halo: 'moat', only: ['Mexico City'], roofs: { hip: 4, gable: 1 } },
};
export const SEEDS = 3; // drawings of each general kind: `walled`, `walled-2`, `walled-3`
export const VARIANTS = Object.fromEntries(Object.entries(KINDS).flatMap(([k, p]) => (p.only ? [[k, p]] : Array.from({ length: SEEDS }, (_, i) => [i ? `${k}-${i + 1}` : k, { ...p, kind: k, seed: p.seed + i * 101 }]))));

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => String(Math.round(v * 10) / 10);
const LW = 0.85; // the ink line, in scan px

export function townSVG(name, p) {
  const rnd = mulberry32(p.seed), C = p.light ? LIGHT : FULL;
  const between = (a, b) => a + rnd() * (b - a);
  const chance = (q) => rnd() < q;
  const pickRoof = () => {
    const e = Object.entries(p.roofs ?? { hip: 1 }), sum = e.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * sum;
    for (const [k, w] of e) if ((r -= w) < 0) return k;
    return e[0][0];
  };
  let out = [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const see = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };

  // the hand line: a corner shared by two faces moves once, so the faces still meet, and each edge
  // bows a little
  const nudged = new Map();
  const jit = ([x, y]) => {
    const k = `${Math.round(x * 4)},${Math.round(y * 4)}`;
    if (!nudged.has(k)) nudged.set(k, [x + (rnd() - 0.5) * 0.7, y + (rnd() - 0.5) * 0.7]);
    return nudged.get(k);
  };
  const handPath = (pts, closed) => {
    const q = pts.map(jit);
    for (const [x, y] of q) see(x, y, LW / 2);
    let d = `M${n(q[0][0])},${n(q[0][1])}`;
    for (let i = 0; i < (closed ? q.length : q.length - 1); i++) {
      const a = q[i], b = q[(i + 1) % q.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const bow = (rnd() - 0.5) * Math.min(1.1, len * 0.07);
      d += ` Q${n((a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * bow)},${n((a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * bow)} ${n(b[0])},${n(b[1])}`;
    }
    return closed ? `${d} Z` : d;
  };
  const poly = (pts, fill, w = LW) => out.push(`<path d="${handPath(pts, true)}" fill="${fill}" stroke="${INK}" stroke-width="${w}"/>`);
  const inkLine = (pts, w = LW, stroke = INK) => out.push(`<path d="${handPath(pts, false)}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`);
  const raw = (d, fill, extra = '') => out.push(`<path d="${d}" fill="${fill}"${extra}/>`);

  // madder hatching: short vertical strokes hanging from a top edge, one path
  const hatch = (xa, xb, top, bottom, q = 0.6) => {
    let d = '';
    for (let x = xa + between(0.6, 1.6); x < xb - 0.6; x += between(1.6, 2.6)) {
      const t = top(x) + 0.8, b = bottom(x) - 0.6, len = (b - t) * between(0.45, 1);
      if (len > 1) d += `M${n(x)},${n(t)} L${n(x + between(-0.3, 0.3))},${n(t + len)} `;
    }
    if (d) out.push(`<path d="${d.trim()}" fill="none" stroke="${C.pink}" stroke-width="0.8" stroke-opacity="${q}" stroke-linecap="round"/>`);
  };
  // paired slit windows: two dark ticks
  const slits = (xa, xb, y) => {
    const pairs = Math.max(1, Math.floor((xb - xa) / 6.5));
    let d = '';
    for (let i = 0; i < pairs; i++) {
      if (pairs > 1 && chance(0.25)) continue;
      const cx = xa + ((xb - xa) * (i + 0.5)) / pairs + between(-0.6, 0.6);
      for (const dx of [-0.95, 0.75]) d += `M${n(cx + dx)},${n(y)} l0,1.9 `;
    }
    out.push(`<path d="${d.trim()}" fill="none" stroke="${INK}" stroke-width="0.75"/>`);
  };
  // crenellations as merlons along a top edge
  const merlons = (xa, xb, y, h = 1.8) => {
    const k = Math.max(2, Math.round((xb - xa) / 3.2)), step = (xb - xa) / k;
    let d = '';
    for (let i = 0; i < k; i++) d += `M${n(xa + i * step + step * 0.2)},${n(y + 0.3)} v${n(-h)} h${n(step * 0.55)} v${n(h)} `;
    see(xa, y - h);
    out.push(`<path d="${d.trim()}" fill="${C.front}" stroke="${INK}" stroke-width="0.7"/>`);
  };
  const cross = (x, y, s = 3) => { see(x, y - s * 1.6); inkLine([[x, y], [x, y - s * 1.6]], 0.8); inkLine([[x - s * 0.5, y - s * 1.1], [x + s * 0.5, y - s * 1.1]], 0.8); };

  // An oblique box: a front face x..x+w standing on `base`, h tall, and a side face d deep turned
  // away from the town's middle (side: +1 right, -1 left), then its roof.
  const box = (b) => {
    const { x, base, w, h } = b, side = b.side ?? (x + w / 2 >= 0 ? 1 : -1), d = b.d ?? 5;
    const ox = side * d * 0.6, oy = d * 0.36, yT = base - h, e = side > 0 ? x + w : x;
    poly([[e, base], [e + ox, base - oy], [e + ox, yT - oy], [e, yT]], b.sideFill ?? C.side);
    poly([[x, base], [x + w, base], [x + w, yT], [x, yT]], b.fill ?? C.front);
    if (b.hatch ?? chance(0.55)) hatch(x, x + w, () => yT, () => base, 0.55);
    if (b.win !== false && w > 3.5) {
      slits(x + 0.8, x + w - 0.8, yT + Math.min(3.2, h * 0.25));
      for (let y = yT + 9; b.tall && y < base - 6; y += 8) slits(x + 0.8, x + w - 0.8, y);
    }
    roof({ x, w, yT, ox, oy, side, kind: b.roof ?? 'flat', rh: b.rh ?? w * 0.45, fill: b.roofFill, sideFill: b.roofSideFill });
    return { top: yT - oy, cx: x + w / 2 + ox / 2 };
  };
  const roof = ({ x, w, yT, ox, oy, side, kind, rh, fill = C.roof, sideFill = C.roofSide }) => {
    const F0 = [x, yT], F1 = [x + w, yT], B0 = [x + ox, yT - oy], B1 = [x + w + ox, yT - oy];
    const e0 = [x - 0.6, yT + 0.4], e1 = [x + w + 0.6, yT + 0.4], eb0 = [x + ox - 0.6, yT - oy], eb1 = [x + w + ox + 0.6, yT - oy];
    const [Fo, Bo] = side > 0 ? [e1, eb1] : [e0, eb0];
    const cx = x + w / 2 + ox / 2, cy = yT - oy / 2;
    if (kind === 'flat' || kind === 'crenel') {
      poly([F0, F1, B1, B0], C.top, 0.7);
      if (kind === 'crenel') merlons(x, x + w, yT);
    } else if (kind === 'blue') {
      poly([e0, e1, eb1, eb0], LAPIS, 0.9);
    } else if (kind === 'gable') {
      const Rf = [x + w / 2, yT - rh], Rb = [x + w / 2 + ox, yT - rh - oy];
      poly([Rf, side > 0 ? F1 : F0, side > 0 ? B1 : B0, Rb], fill);
      poly([[x - 0.4, yT], Rf, [x + w + 0.4, yT]], C.front);
      if (w > 6) slits(x + w / 2 - 1, x + w / 2 + 1, yT - rh * 0.45);
    } else if (kind === 'hip') {
      const R1 = [cx - w * 0.2, cy - rh * 0.8], R2 = [cx + w * 0.2, cy - rh * 0.8];
      poly([e0, e1, R2, R1], fill);
      poly(side > 0 ? [e1, eb1, R2] : [e0, eb0, R1], sideFill);
    } else if (kind === 'cushion') {
      const [L, R] = side > 0 ? [e0, eb1] : [eb0, e1], k = rh * 1.5;
      const q = [L, Fo, R].map(jit);
      for (const [px, py] of q) see(px, py - k * 0.8);
      raw(`M${n(q[0][0])},${n(q[0][1])} L${n(q[1][0])},${n(q[1][1])} L${n(q[2][0])},${n(q[2][1])} C${n(q[2][0] + side * 0.4)},${n(q[2][1] - k)} ${n(q[0][0] - side * 0.4)},${n(q[0][1] - k)} ${n(q[0][0])},${n(q[0][1])} Z`, fill, ` stroke="${INK}" stroke-width="${LW}"`);
      raw(`M${n(q[1][0])},${n(q[1][1])} Q${n(q[1][0] + side * 0.3)},${n(cy - k * 0.6)} ${n(cx + side * w * 0.12)},${n(cy - k * 0.72)}`, 'none', ` stroke="${sideFill}" stroke-width="1"`);
    } else if (kind === 'pyramid' || kind === 'spire') {
      const A = [cx, cy - rh];
      poly([e0, e1, A], fill, kind === 'spire' ? 0.9 : LW);
      poly([Fo, Bo, A], sideFill, kind === 'spire' ? 0.9 : LW);
    }
  };
  // A round tower: a drum r in radius, its outer side washed, a domed, coned, balled or crenellated top.
  const drum = ({ cx, base, r, h, top = 'cushion', rh = r * 1.1, spire = r * 4 }) => {
    const side = cx >= 0 ? 1 : -1, yT = base - h, sag = r * 0.35;
    const body = handPath([[cx - r, yT], [cx + r, yT], [cx + r, base], [cx, base + sag], [cx - r, base]], true);
    out.push(`<path d="${body}" fill="${C.front}" stroke="${INK}" stroke-width="${LW}"/>`);
    const sx = side > 0 ? [cx + r * 0.25, cx + r] : [cx - r, cx - r * 0.25];
    raw(`M${n(sx[0])},${n(yT + 0.6)} L${n(sx[1])},${n(yT + 0.6)} L${n(sx[1])},${n(base)} L${n(sx[0])},${n(base + sag * 0.8)} Z`, C.side, ' fill-opacity="0.85"');
    if (chance(0.7)) hatch(cx - r, cx + r * 0.2, () => yT, () => base, 0.5);
    slits(cx - r * 0.5, cx + r * 0.5, yT + 3);
    if (h > 18) slits(cx - r * 0.4, cx + r * 0.4, yT + h * 0.5);
    if (top === 'cushion' || top === 'dome') {
      see(cx, yT - rh * 1.2);
      raw(`M${n(cx - r - 0.6)},${n(yT + 0.4)} C${n(cx - r - 0.4)},${n(yT - rh * 1.35)} ${n(cx + r + 0.4)},${n(yT - rh * 1.35)} ${n(cx + r + 0.6)},${n(yT + 0.4)} Z`, top === 'dome' ? C.front : C.roof, ` stroke="${INK}" stroke-width="${LW}"`);
      if (top === 'dome') cross(cx, yT - rh, 2.2);
    } else if (top === 'cone' || top === 'spire') {
      const tall = top === 'cone' ? rh * 1.8 : spire;
      poly([[cx - r - 0.5, yT + 0.3], [cx + r + 0.5, yT + 0.3], [cx, yT - tall]], top === 'cone' ? C.roof : C.front, 0.9);
      if (top === 'spire') raw(`M${n(cx)},${n(yT + 0.3)} L${n(cx + side * (r + 0.5))},${n(yT + 0.3)} L${n(cx)},${n(yT - tall)} Z`, C.side, ' fill-opacity="0.8"');
    } else if (top === 'ball') {
      // Venice: a ring, a short neck and a ball
      poly([[cx - r - 0.8, yT + 0.6], [cx + r + 0.8, yT + 0.6], [cx + r + 0.8, yT - 1.6], [cx - r - 0.8, yT - 1.6]], C.front, 0.8);
      const br = r * 0.8, by = yT - 1.6 - br * 1.15;
      see(cx, by - br, 1);
      out.push(`<circle cx="${n(cx)}" cy="${n(by)}" r="${n(br)}" fill="${C.front}" stroke="${INK}" stroke-width="${LW}"/>`);
    } else if (top === 'crenel') {
      raw(`M${n(cx - r)},${n(yT)} A${n(r)},${n(r * 0.3)} 0 0 0 ${n(cx + r)},${n(yT)} A${n(r)},${n(r * 0.3)} 0 0 0 ${n(cx - r)},${n(yT)} Z`, C.top, ` stroke="${INK}" stroke-width="0.7"`);
      merlons(cx - r, cx + r, yT + 0.6);
    }
    return yT;
  };
  // a run of buildings along a row, drawn from the ends inward so the nearer side faces overlap
  const row = (xa, xb, baseAt, { hmin, hmax, wmin = 8, wmax = 14, gaps = 0, roofOf = pickRoof, d = [3.5, 6] }) => {
    const bs = [];
    for (let x = xa; x < xb - 3;) {
      const w = Math.min(xb - x, between(wmin, wmax));
      if (!(gaps && chance(gaps))) bs.push({ x, w, h: between(hmin, hmax), d: between(...d), roof: roofOf() });
      x += w * between(0.72, 0.95);
    }
    bs.sort((a, b) => Math.abs(b.x + b.w / 2) - Math.abs(a.x + a.w / 2));
    for (const b of bs) box({ ...b, base: baseAt(b.x + b.w / 2) });
  };
  // a low curtain wall along a curve, ticks hanging under its parapet
  const curtain = (xa, xb, foot, h) => {
    const xs = Array.from({ length: 9 }, (_, i) => xa + ((xb - xa) * i) / 8);
    poly([...xs.map((x) => [x, foot(x) - h]), ...xs.reverse().map((x) => [x, foot(x)])], C.front);
    hatch(xa, xb, (x) => foot(x) - h, foot, 0.45);
    let d = '';
    for (let x = xa + 2; x < xb - 1; x += between(3.2, 4.2)) d += `M${n(x)},${n(foot(x) - h + 0.5)} l0.2,1.7 `;
    out.push(`<path d="${d.trim()}" fill="none" stroke="${INK}" stroke-width="0.9"/>`);
  };

  // A boat-shaped wall seen from above, W tip to tip: its rim dips toward the middle, its hull below
  // hatched in madder, ticks hanging under the rim, a dark arched gate at one end.
  const boat = (W) => {
    const bh = W * 0.32, cTop = 0.1 * bh;
    const at = (x, c) => { const t = Math.min(1, Math.max(0, (x / (W / 2) + 1) / 2)); return (1 - t) ** 2 * -bh + 2 * t * (1 - t) * c + t * t * -bh; };
    return { W, bh, rim: (x) => at(x, cTop), keel: (x) => at(x, bh) };
  };
  const hull = (b, gate) => {
    const { W, bh, rim, keel } = b;
    const L = jit([-W / 2, -bh]), R = jit([W / 2, -bh]);
    see(L[0] - 2, L[1]); see(R[0] + 2, R[1]); see(0, 0, LW);
    const lift = between(-1.5, 1.5);
    raw(`M${n(L[0])},${n(L[1])} Q0,${n(0.1 * bh + lift)} ${n(R[0])},${n(R[1])} C${n(R[0] + 2.6)},${n(R[1] + bh * 0.35)} ${n(W * 0.32)},${n(0.6)} 0,0 C${n(-W * 0.32)},${n(0.6)} ${n(L[0] - 2.6)},${n(L[1] + bh * 0.35)} ${n(L[0])},${n(L[1])} Z`, C.front, ` stroke="${INK}" stroke-width="${LW * 1.15}"`);
    hatch(-W / 2 + 2, W / 2 - 2, (x) => rim(x) + 0.6, (x) => keel(x) - 0.4, 0.75);
    // a pink shadow at the near end, as in the lake and Smina drawings
    raw(`M${n(-W / 2 + 1)},${n(-bh + 1)} Q${n(-W / 2 + 4)},${n(-bh * 0.4)} ${n(-W * 0.3)},${n(-bh * 0.18)}`, 'none', ` stroke="${C.pink}" stroke-width="2.6" stroke-opacity="0.45" stroke-linecap="round"`);
    let d = '';
    for (let x = -W / 2 + 4; x < W / 2 - 3; x += between(4.5, 6.5)) d += `M${n(x)},${n(rim(x) + 0.6)} l0.3,2 `;
    out.push(`<path d="${d.trim()}" fill="none" stroke="${INK}" stroke-width="1"/>`);
    // a few loops in the hull: the scan's arrow slits
    let s = '';
    for (const f of [-0.28, 0.02, 0.3].map((f) => f + between(-0.05, 0.05))) {
      const x = f * W, y = (rim(x) + keel(x)) / 2 + between(-1, 1.5);
      s += `M${n(x - 0.8)},${n(y)} q0.8,-1.6 1.6,0 M${n(x)},${n(y)} l0,1.4 `;
    }
    out.push(`<path d="${s.trim()}" fill="none" stroke="${INK}" stroke-width="0.8"/>`);
    if (gate) {
      const gx = W * 0.36, top = rim(gx) + 1.2, bot = top + (keel(gx) - rim(gx)) * 0.62, gw = 3.6;
      raw(`M${n(gx)},${n(bot)} L${n(gx)},${n(top + 1.8)} Q${n(gx + gw / 2)},${n(top - 0.8)} ${n(gx + gw)},${n(top + 1.8)} L${n(gx + gw)},${n(bot)} Z`, C.gate, ` stroke="${INK}" stroke-width="0.6"`);
    }
  };
  const ground = (W) => {
    const g = W / 2 + 4;
    raw(`M${n(-g)},${n(-0.5)} Q${n(-g * 0.4)},${n(-2.4)} 0,${n(-1.2)} Q${n(g * 0.5)},${n(-0.2)} ${n(g)},${n(-1)} Q${n(g * 0.4)},${n(3)} 0,${n(2.6)} Q${n(-g * 0.6)},${n(2.6)} ${n(-g)},${n(-0.5)} Z`, HILL, ' fill-opacity="0.55"');
    see(-g, 3); see(g, 3);
  };

  // the plans
  const W = p.width;
  if (p.plan === 'boat') {
    const b = boat(W), wall = 4.5, R = p.rows ?? 2;
    if (p.keep) box({ x: between(-W * 0.12, 0), base: b.rim(0) - 8, w: 8, h: between(34, 40), d: 4, roof: chance(0.5) ? 'crenel' : 'pyramid', rh: 6, tall: true, hatch: false });
    for (let k = 0; k < R - 1; k++) {
      const half = W / 2 - 6 - (R - 2 - k) * 6;
      row(-half, half, (x) => b.rim(x) - wall - 2 - (R - 2 - k) * 5, { hmin: 11, hmax: 18, wmin: 10, wmax: 16, gaps: 0.2 });
    }
    curtain(-W / 2 + 5, W / 2 - 5, (x) => b.rim(x) + 0.5, wall);
    row(-W / 2 + 7, W / 2 - 9, (x) => b.rim(x) + 1, { hmin: 9, hmax: 14, wmin: 8, wmax: 12, gaps: 0.6 });
    hull(b, p.gate);
  } else if (p.plan === 'hall') {
    const b = boat(W), wall = 5;
    const towers = [-0.2, 0.0, 0.14].map((f) => f * W + between(-2, 2));
    for (const [i, x] of towers.entries()) box({ x, base: b.rim(x) - 10, w: between(7, 9), h: between(22, 30), d: 4, roof: 'cushion', rh: 3.4, tall: true });
    box({ x: W * 0.24, base: b.rim(0) - 4, w: 9, h: between(40, 46), d: 4, roof: 'flat', tall: true, hatch: false });
    box({ x: -W * 0.3, base: b.rim(0) - wall + 1.5, w: W * 0.56, h: 8, d: 12, roof: 'hip', rh: 11, side: 1, win: false });
    curtain(-W / 2 + 5, W / 2 - 5, (x) => b.rim(x) + 0.5, wall);
    for (const s of [-1, 1]) drum({ cx: s * (W / 2 - 8), base: b.rim(s * (W / 2 - 8)) + 1, r: 6, h: s < 0 ? 22 : 16, top: pickRoof() === 'hip' ? 'crenel' : 'cushion', rh: 4 });
    hull(b, p.gate);
  } else if (p.plan === 'towers') {
    ground(W);
    const k = p.towers ?? 7;
    const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => Math.abs(b - (k - 1) / 2) - Math.abs(a - (k - 1) / 2));
    for (const i of order) {
      const t = (i / (k - 1)) * 2 - 1 + between(-0.08, 0.08), w = between(4, 6.5), x = t * (W / 2 - 8) - w / 2;
      const h = between(28, 54) * (1 - 0.3 * Math.abs(t)), top = rnd();
      box({ x, base: -14 - between(0, 4), w, h, d: 3, roof: top < 0.6 ? 'spire' : top < 0.8 ? 'cushion' : 'crenel', rh: top < 0.6 ? w * between(3, 4.5) : w * 0.6, roofFill: top < 0.6 ? C.front : C.roof, roofSideFill: top < 0.6 ? C.side : C.roofSide, tall: true, hatch: chance(0.4) });
    }
    row(-W / 2 + 6, W / 2 - 6, () => -7, { hmin: 12, hmax: 20, wmin: 9, wmax: 15, gaps: 0.15 });
    box({ x: -W / 2 + 6, base: -0.5, w: W - 12, h: 8, d: 2.5, roof: 'crenel', side: 1 });
    for (const s of [-1, 1]) drum({ cx: s * (W / 2 - 5), base: -0.5, r: 4.2, h: s < 0 ? 26 : 18, top: s < 0 ? 'spire' : 'cone', spire: 16 });
    raw(`M${n(-2)},${n(-0.5)} L${n(-2)},${n(-4.4)} Q0,${n(-7)} ${n(2)},${n(-4.4)} L${n(2)},${n(-0.5)} Z`, C.gate);
  } else if (p.plan === 'hill') {
    // a green hill, its crest right of the middle, its top lumpy
    const Hh = W * 0.5, cx = W * 0.08;
    const top = (x) => -Hh * Math.max(0, 1 - ((x - cx) / (W / 2 + 2)) ** 2) ** 0.55 - 1.4 * Math.sin(x * 0.35);
    const xs = Array.from({ length: 25 }, (_, i) => -W / 2 - 2 + ((W + 4) * i) / 24);
    poly([...xs.map((x) => [x, top(x)]), [W / 2 + 2, 0], [-W / 2 - 2, 0]], HILL, 0.9);
    let tufts = '';
    for (const x of xs.slice(2, -2)) tufts += `M${n(x)},${n(top(x) + 2.5)} q1.2,-1.6 2.4,0 `;
    out.push(`<path d="${tufts.trim()}" fill="none" stroke="${HILL_DARK}" stroke-width="0.9"/>`);
    const R = p.rows ?? 3;
    for (let k = 0; k < R; k++) {
      const f = 0.9 - (0.75 * k) / (R - 1), half = W / 2 - 10 - (R - 1 - k) * 6;
      row(-half, half, (x) => Math.min(-6, top(x) * f + 4), { hmin: 8, hmax: 13, wmin: 7, wmax: 12, gaps: k === 0 ? 0.5 : 0.4 });
    }
    box({ x: -W / 2 + 4, base: -0.5, w: W - 8, h: 7, d: 2.5, roof: 'crenel', side: 1 });
    for (const s of [-1, 1]) drum({ cx: s * (W / 2 - 4), base: -0.5, r: 4.5, h: between(15, 19), top: chance(0.5) ? 'crenel' : 'cushion', rh: 3.4 });
  } else if (p.plan === 'church') {
    ground(W);
    box({ x: W * 0.1, base: -10, w: 9, h: 42, d: 4, roof: 'pyramid', rh: 5, tall: true, side: 1 });
    cross(W * 0.1 + 4.5 + 1.2, -10 - 42 - 1.4 - 5);
    box({ x: -W * 0.3, base: -6, w: W * 0.36, h: 20, d: 12, roof: 'gable', rh: 11, side: 1 });
    cross(-W * 0.3 + W * 0.18, -6 - 20 - 11);
    box({ x: -W * 0.08, base: -6 - 20 - 2, w: 6, h: 6, d: 3, roof: 'pyramid', rh: 4, win: false, side: 1 });
    box({ x: -W / 2 + 8, base: -0.5, w: W - 16, h: 12, d: 2, roof: 'flat', side: 1, hatch: true });
    let doors = '';
    for (const f of [-0.25, 0.05, 0.3]) doors += `M${n(f * W - 1.4)},${n(-0.5)} v-3 q1.4,-2 2.8,0 v3 `;
    out.push(`<path d="${doors.trim()}" fill="none" stroke="${INK}" stroke-width="0.9"/>`);
    for (const s of [-1, 1]) drum({ cx: s * (W / 2 - 6), base: -0.5, r: 6, h: s < 0 ? 26 : 24, top: 'dome', rh: 5 });
  } else if (p.plan === 'gate') {
    ground(W);
    for (const s of [-1, 1]) box({ x: s < 0 ? -W / 2 + 2 : 6, base: -1, w: W / 2 - 8, h: 8, d: 2.5, roof: 'crenel', side: s });
    // the gate tower: red, its top a round arch, a pale arched opening
    const w = 14, h = 26, x = -w / 2, d = 5, ox = d * 0.6, oy = d * 0.36, sp = h - w / 2;
    poly([[x + w, 0], [x + w + ox, -oy], [x + w + ox, -sp - oy], [x + w - 0.6, -h + 1.2]], C.roofSide);
    see(0, -h - 1);
    raw(`M${n(x)},0 L${n(x)},${n(-sp)} A${n(w / 2)},${n(w / 2)} 0 0 1 ${n(x + w)},${n(-sp)} L${n(x + w)},0 Z`, C.roof, ` stroke="${INK}" stroke-width="${LW}"`);
    const ow = w * 0.5, ot = -h * 0.78, ob = -h * 0.3;
    raw(`M${n(-ow / 2)},${n(ob)} L${n(-ow / 2)},${n(ot + ow / 2)} A${n(ow / 2)},${n(ow / 2)} 0 0 1 ${n(ow / 2)},${n(ot + ow / 2)} L${n(ow / 2)},${n(ob)} Z`, C.front, ` stroke="${INK}" stroke-width="0.9"`);
    slits(-ow / 2 + 0.5, ow / 2 - 0.5, ot + ow / 2);
    raw(`M${n(-1.6)},0 L${n(-1.6)},${n(-3.6)} Q0,${n(-5.6)} ${n(1.6)},${n(-3.6)} L${n(1.6)},0 Z`, C.gate);
  } else if (p.plan === 'venice') {
    // the campanile, its belfry and needle; towers with balls and spires; a long wall in front
    box({ x: -4.5, base: -8, w: 9, h: 44, d: 4, roof: 'flat', tall: true, side: 1 });
    box({ x: -6, base: -52, w: 12, h: 5, d: 4, roof: 'crenel', side: 1, win: false, hatch: false });
    box({ x: -3, base: -57, w: 6, h: 4, d: 3, roof: 'spire', rh: 20, side: 1, win: false, hatch: false, roofFill: C.front, roofSideFill: C.side });
    for (const s of [-1, 1]) drum({ cx: s * W * 0.3 + between(-2, 2), base: -6, r: 3.6, h: between(26, 32), top: 'ball' });
    for (const s of [-1, 1]) box({ x: s * W * 0.15 - 2.5, base: -8, w: 5, h: between(22, 28), d: 3, roof: 'spire', rh: 12, tall: true, roofFill: C.front, roofSideFill: C.side });
    row(-W / 2 + 8, W / 2 - 8, () => -6, { hmin: 10, hmax: 16, wmin: 8, wmax: 12, gaps: 0.2 });
    box({ x: W * 0.02, base: -6, w: 12, h: 9, d: 5, roof: 'blue', side: 1, win: false });
    box({ x: -W / 2 + 4, base: 0, w: W - 8, h: 8, d: 2, roof: 'crenel', side: 1 });
  }

  // halos, drawn under the town once its extent is known
  const under = [];
  if (p.halo) {
    const town = { x0, x1, y0, y1 }, mid = (town.y0 + town.y1) / 2, rx = (town.x1 - town.x0) / 2, ry = (town.y1 - town.y0) / 2;
    const saved = out;
    out = under;
    if (p.halo === 'rays') {
      // blue and green flames out from behind the town, longest at the sides, their tips curling
      // up; below it they flatten into the water it stands in
      const k = 56;
      for (let i = 0; i < k; i++) {
        const a = Math.PI * (0.84 + (1.32 * ((i * 17) % k)) / (k - 1)) + between(-0.05, 0.05);
        const ux = Math.cos(a), uy = Math.sin(a) * 0.8, r0 = between(0.45, 0.85), sx = ux * rx * r0, sy = mid + uy * ry * r0;
        const len = between(16, 26) * (uy > 0.1 ? 0.6 : 0.6 + 1.1 * Math.abs(ux)), lean = between(1.5, 3.2) * (ux < 0 ? 1 : -1), nx = -uy, ny = ux;
        const P = (f, s) => [sx + ux * len * f + nx * lean * s, sy + uy * len * f + ny * lean * s];
        const [c1, c2, e] = [P(0.35, -0.4), P(0.7, 0.2), P(1, 1)];
        see(e[0], e[1], 1.8);
        out.push(`<path d="M${n(sx)},${n(sy)} C${n(c1[0])},${n(c1[1])} ${n(c2[0])},${n(c2[1])} ${n(e[0])},${n(e[1])}" fill="none" stroke="${RAYS[i % 3]}" stroke-width="${n(between(1.3, 2.4))}" stroke-opacity="0.6" stroke-linecap="round"/>`);
      }
      for (let i = 0; i < 6; i++) {
        const y = 1 + i * 1.3, half = rx * (1.1 - i * 0.12), xa = -half + between(-3, 3);
        see(xa, y, 1); see(half, y, 1);
        out.push(`<path d="M${n(xa)},${n(y)} q${n(half * 0.25)},-1.6 ${n(half * 0.5)},0 t${n(half * 0.5)},0 t${n(half * 0.5)},0 t${n(half * 0.5)},0" fill="none" stroke="${RAYS[i % 3]}" stroke-width="1.6" stroke-opacity="0.65" stroke-linecap="round"/>`);
      }
    } else if (p.halo === 'moat') {
      // the lake: a bell of pale water ringed in lapis, four rivers leaving its foot
      // a cubic from foot to foot whose controls stand at c peaks at three quarters of the way to c
      const a = rx + 15, yt = town.y0 - 5, yb = town.y1 + 4, cy = yb + (yt - yb) / 0.75;
      out.push(`<path d="M${n(-a)},${n(yb)} C${n(-a - 5)},${n(cy)} ${n(a + 5)},${n(cy)} ${n(a)},${n(yb)} Q0,${n(yb + 5)} ${n(-a)},${n(yb)} Z" fill="${POOL}" stroke="${LAPIS}" stroke-width="3.6" stroke-opacity="0.9"/>`);
      let streaks = '';
      for (let y = yt + 4; y < yb - 1; y += 3.2) { const half = (a - 1) * Math.sqrt(Math.max(0, 1 - ((y - yb) / (yt - yb)) ** 2)); for (const s of [-1, 1]) streaks += `M${n(s * half)},${n(y)} q${n(-s * 3)},-1 ${n(-s * between(5, 10))},0 `; }
      out.push(`<path d="${streaks.trim()}" fill="none" stroke="${RAYS[1]}" stroke-width="1.1" stroke-opacity="0.55"/>`);
      see(-a - 4, yt - 2); see(a + 4, yt - 2);
      for (const f of [-0.7, -0.25, 0.25, 0.7]) {
        const sx = f * a, sy = yb + 3.5 - Math.abs(f) * 2.5, len = between(16, 22), out1 = Math.sign(f) * between(3, 6);
        see(sx + out1 * 1.6, sy + len, 2);
        under.push(`<path d="M${n(sx)},${n(sy)} c${n(-out1 * 0.6)},${n(len * 0.35)} ${n(out1 * 1.2)},${n(len * 0.6)} ${n(out1 * 0.6)},${n(len)} q${n(out1 * 0.3)},2 ${n(out1)},1" fill="none" stroke="${LAPIS}" stroke-width="2.6" stroke-opacity="0.9" stroke-linecap="round"/>`);
      }
    }
    out = saved;
  }

  // viewBox centred on x = 0, the town's foot at its bottom edge
  const pad = 1.5, half = Math.max(-x0, x1) + pad, top = y0 - pad, bottom = y1 + pad;
  const vw = 2 * half, vh = bottom - top, scale = 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-half)} ${n(top)} ${n(vw)} ${n(vh)}" width="${Math.round(vw * scale)}" height="${Math.round(vh * scale)}">
  <!-- After the town drawings on Jorge de Aguiar's portolan chart, 1492 (Beinecke Library, Yale),
       ${AFTER}; the crops are in docs/towns-aguiar/.
       Variant "${name}", after ${p.after}. Drawn, not traced, by scripts/gen-towns-aguiar.mjs; do not edit by hand.
       Transparent ground, for the renderer's \`multiply\`; the town point is the bottom centre. -->
  <g stroke-linejoin="round" stroke-linecap="round">
    ${[...under, ...out].join('\n    ')}
  </g>
</svg>
`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const fileOf = (name) => join(ROOT, 'packs', 'vivid', `town-aguiar-${name}.svg`);

// `--sheets` also draws the record in docs/towns-aguiar/: drawn-vs-scan.png (each kind beside the
// crop it follows, large and at map size, 40 and 56 px tall, on parchment) and seeds.png (the
// committed seeds of each general kind, a row each).
const SCAN = { walled: 'lake', hall: 'smina', towers: 'genoa', hill: 'lisbon', church: 'jerusalem', gate: 'ceuta', venice: 'venice', moat: 'lake-moat' };
async function sheets() {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const DOCS = join(ROOT, 'docs', 'towns-aguiar'), PARCH = '#efe3c4';
  const svgImage = (svg) => loadImage(Buffer.from(svg));
  const within = (img, w, h) => { const k = Math.min(w / img.width, h / img.height); return [img.width * k, img.height * k]; };
  const names = Object.keys(KINDS), rh = 230;
  let c = createCanvas(1000, rh * names.length), g = c.getContext('2d');
  g.fillStyle = PARCH; g.fillRect(0, 0, c.width, c.height);
  for (const [i, name] of names.entries()) {
    const y = i * rh + 10, scan = await loadImage(join(DOCS, `town-aguiar-${SCAN[name]}.raw.png`));
    g.globalCompositeOperation = 'source-over';
    g.drawImage(scan, 10, y, ...within(scan, 340, 210));
    const img = await svgImage(townSVG(name, VARIANTS[name]));
    g.globalCompositeOperation = 'multiply';
    g.drawImage(img, 370, y, ...within(img, 420, 210));
    for (const [k, h] of [[0, 40], [1, 56]]) { const w = (img.width * h) / img.height; g.drawImage(img, 820 + k * 70, y + 150 - h, w, h); }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = INK; g.font = '16px serif'; g.fillText(name, 820, y + 190);
  }
  writeFileSync(join(DOCS, 'drawn-vs-scan.png'), c.toBuffer('image/png'));
  const general = Object.entries(VARIANTS).filter(([, p]) => !p.only), cols = SEEDS, cw = 300, ch = 260;
  c = createCanvas(cols * cw, (general.length / cols) * ch); g = c.getContext('2d');
  g.fillStyle = PARCH; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'multiply';
  for (const [i, [name, p]] of general.entries()) {
    const img = await svgImage(townSVG(name, p));
    const [w, h] = within(img, cw - 20, 200), cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    g.drawImage(img, cx + (cw - w) / 2, cy + (ch - h) / 2, w, h);
    g.drawImage(img, cx + cw - 6 - (img.width * 40) / img.height, cy + 6, (img.width * 40) / img.height, 40);
  }
  writeFileSync(join(DOCS, 'seeds.png'), c.toBuffer('image/png'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, p] of Object.entries(VARIANTS)) {
    writeFileSync(fileOf(name), townSVG(name, p));
    console.log(fileOf(name));
  }
  if (process.argv.includes('--sheets')) await sheets();
}
