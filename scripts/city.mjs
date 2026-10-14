// A city drawn over its urban footprint at close zoom, after the Renaissance bird's-eye plans
// (Braun and Hogenberg's Civitates, de' Barbari's Venice, Truschet and Hoyau's Paris): a walled
// core with drum towers and gates, blocks of red-roofed lots on a grid turned per district, the
// streets the gaps between them, suburbs thinning out along the roads from the gates into gardens
// and fields, and the churches drawn standing. cityPlan lays it out once, in canvas px, from a
// seeded random source, so a view always draws the same city; drawCity only draws it.

const ROOF = '#b5533c', SHADE = '#8c3b2b', FRONT = '#e8dcc0', GARDEN = '#6f7d4a', STONE = '#d6c29a', MOAT = '#7f9488';
const LOT_CAP = 20000; // lots a plan holds at most; the blocks grow to keep under it

// Px rings with their boxes, as insideRings takes them.
export const pxRings = (rings) => rings.map((ring) => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  return { ring, b };
});

// Even-odd point in a set of px rings, each with its box.
export function insideRings(rs, x, y) {
  let inside = false;
  for (const { ring, b } of rs) {
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < xj + ((y - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
    }
  }
  return inside;
}

// The plan of a city whose urban rings (px) are `rings` and whose place is (x, y): `extent` is the
// square root of its area, px; `kmPx` px per km; `rnd` a seeded random source; `w` x `h` the canvas,
// the only part laid out (and a margin); `onLand(x, y)` whether a px point is dry ground. The city
// is built where its footprint is on land. One whose footprint is mostly water (Venice in its
// lagoon) is a lagoon city: built over the water, and unwalled. The walled core is set near the
// place but on dry ground; where no ring of ground round it holds a wall, the city is unwalled.
export function cityPlan({ rings, x: px, y: py, extent: E, zoom, kmPx, rnd, w, h, onLand = () => true }) {
  const rs = pxRings(rings);
  const inside = (x, y) => insideRings(rs, x, y);
  const M = 48, fx0 = -M, fy0 = -M, fx1 = w + M, fy1 = h + M;
  const inFrame = (x, y) => x > fx0 && x < fx1 && y > fy0 && y < fy1;
  const sx0 = Math.max(fx0, Math.min(...rs.map((r) => r.b[0]))), sy0 = Math.max(fy0, Math.min(...rs.map((r) => r.b[1])));
  const sx1 = Math.min(fx1, Math.max(...rs.map((r) => r.b[2]))), sy1 = Math.min(fy1, Math.max(...rs.map((r) => r.b[3])));
  // the ground: how much of the footprint in frame is on land decides a lagoon city
  let inF = 0, onL = 0;
  const st = Math.max(6, (Math.max(sx1 - sx0, sy1 - sy0)) / 40);
  for (let y = sy0 + st / 2; y < sy1; y += st) for (let x = sx0 + st / 2; x < sx1; x += st) if (inside(x, y)) { inF++; if (onLand(x, y)) onL++; }
  const lagoon = inF > 0 && onL / inF < 0.5;
  const ground = lagoon ? inside : (x, y) => inside(x, y) && onLand(x, y);
  // blocks grow gently with zoom, shrink so a small city still holds a few streets, and grow again
  // when the lots would pass LOT_CAP
  let s = Math.min(22, Math.max(10, 10 + 3 * (zoom - 9)), Math.max(6, E / 16));
  let area = 0;
  for (let y = fy0 + 12; y < fy1; y += 24) for (let x = fx0 + 12; x < fx1; x += 24) if (ground(x, y)) area += 576;
  const lots0 = (area / (1.3 * s) ** 2) * 5;
  if (lots0 > LOT_CAP) s *= Math.sqrt(lots0 / LOT_CAP);

  // the wall: an irregular ring about the centre, polar so a point's side of it is one comparison.
  // The centre is the place itself when a wall round it stands on the ground, else the point near
  // it (a grid a wall's radius each way) whose wall stands best, nearest first among equals; a wall
  // that stands nowhere at full size is tried smaller, down to a third, before the city goes unwalled.
  const R0 = Math.max(3 * s, Math.min(0.4 * E, Math.max(9 * s, 5 * kmPx)));
  let R = R0, cx = px, cy = py, best = 0;
  const standing = (x, y) => {
    let n = 0;
    for (const k of [0.55, 0.95]) for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * Math.PI; if (ground(x + k * R * Math.cos(a), y + k * R * Math.sin(a))) n++; }
    return n / 24;
  };
  const offsets = [...Array(25)].map((_, i) => [((i % 5) - 2) * 0.5, (Math.floor(i / 5) - 2) * 0.5]).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  for (const k of lagoon ? [] : [1, 0.75, 0.55, 0.4]) {
    R = Math.max(3 * s, k * R0); cx = px; cy = py; best = standing(px, py);
    if (best < 0.9) for (const [dx, dy] of offsets) {
      const x = px + dx * R, y = py + dy * R;
      if ((dx || dy) && inFrame(x, y)) { const v = standing(x, y); if (v > best + 1e-9) { best = v; cx = x; cy = y; } }
    }
    if (best >= 0.75 || R <= 3 * s) break;
  }
  const walled = !lagoon && best >= 0.75;
  const nv = 12 + Math.floor(rnd() * 5), rv = Array.from({ length: nv }, () => R * (0.82 + 0.3 * rnd()));
  const wallR = walled ? (a) => {
    const t = ((((a / (2 * Math.PI)) % 1) + 1) % 1) * nv, i = Math.floor(t), f = t - i;
    return rv[i % nv] * (1 - f) + rv[(i + 1) % nv] * f;
  } : () => 0;
  const wt = walled ? Math.max(4, 0.42 * s) : 0; // wall thickness
  const ng = 3 + Math.floor(rnd() * 3), g0 = rnd() * 2 * Math.PI;
  const gates = Array.from({ length: ng }, (_, i) => g0 + ((i + 0.5 * (rnd() - 0.5)) * 2 * Math.PI) / ng);
  const polar = (x, y) => [Math.hypot(x - cx, y - cy), Math.atan2(y - cy, x - cx)];
  // px from the road out of a gate (beyond the wall) and from the street in to the centre
  const road = (x, y, a, out) => {
    const ux = Math.cos(a), uy = Math.sin(a), t = (x - cx) * ux + (y - cy) * uy;
    if (out ? t < wallR(a) * 0.9 : t < 0 || t > wallR(a)) return Infinity;
    return Math.abs((x - cx) * uy - (y - cy) * ux);
  };
  const roadOut = (x, y) => Math.min(...gates.map((a) => road(x, y, a, true)));
  const roadIn = (x, y) => Math.min(...gates.map((a) => road(x, y, a, false)));

  // districts: the walled core about the centre, and seeds on a jittered grid beyond, each its own angle
  const a0 = rnd() * Math.PI, D = 8 * s;
  const seeds = [];
  const cols = Math.ceil((sx1 - sx0) / D) + 1;
  const hash = new Map();
  for (let j = 0; sy0 + j * D <= sy1 + D; j++) for (let i = 0; i < cols + 1; i++) {
    const sd = { x: sx0 + (i + 0.15 + 0.7 * rnd()) * D, y: sy0 + (j + 0.15 + 0.7 * rnd()) * D, a: a0 + (rnd() - 0.5) * 0.7, i, j };
    seeds.push(sd); hash.set(`${i},${j}`, sd);
  }
  const nearest = (x, y) => {
    const i = Math.floor((x - sx0) / D), j = Math.floor((y - sy0) / D);
    let best = null, bd = Infinity;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const sd = hash.get(`${i + di},${j + dj}`);
      if (sd) { const d = (sd.x - x) ** 2 + (sd.y - y) ** 2; if (d < bd) { bd = d; best = sd; } }
    }
    return best;
  };

  const lots = [], trees = [], hatch = [], field = [], churches = [];
  const SIZES = [0.32, 0.45, 0.6, 0.78, 1].map((k) => k * s);
  const fall = Math.max(E * 0.6 - R, 6 * s);
  let built = 0;

  // one block: corners from its rectangle (u0, v0)-(u1, v1) in a frame at (ox, oy) turned by `a`
  function block(ox, oy, a, u0, v0, u1, v1, core) {
    const c = Math.cos(a), sn = Math.sin(a);
    const P = (u, v) => [ox + u * c - v * sn, oy + u * sn + v * c];
    const corners = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
    const [bx, by] = P((u0 + u1) / 2, (v0 + v1) / 2);
    if (!inFrame(bx, by) || !ground(bx, by)) return;
    const [d, ang] = polar(bx, by);
    if (core) {
      if (corners.some(([x, y]) => { const [dd, aa] = polar(x, y); return dd > wallR(aa) - wt * 1.2; })) return;
      if (d < 1.2 * s) return; // the plaza
      if (roadIn(bx, by) < 0.45 * s) return;
    } else {
      if (corners.some(([x, y]) => { const [dd, aa] = polar(x, y); return dd < wallR(aa) + wt * 3; })) return;
      if (roadOut(bx, by) < 0.75 * s) return;
    }
    const t = core ? 0 : Math.max(0, (d - wallR(ang)) / fall), near = core ? 0 : roadOut(bx, by);
    // inside the wall the lots stand close, with gardens in the outer ring (Braun and Hogenberg's
    // towns keep their orchards against the wall); outside they thin with distance from it
    let p = core ? (d > 0.7 * wallR(ang) ? 0.8 : 0.97) : 0.95 * Math.exp(-0.4 * t);
    if (near < 3 * s) p = Math.max(p, 0.97 * Math.exp(-0.2 * t)); // ribbon suburbs along the roads
    const roll = rnd();
    const L = (u, v) => P(u, v);
    if (roll >= p) {
      // not built: a garden, a ploughed field or open ground
      const q = core ? 0 : (roll - p) / (1 - p); // in the core a garden, never a field
      if (q < 0.5) {
        if (rnd() < 0.55) for (let v = v0 + 2; v < v1 - 1; v += 3.6) for (let u = u0 + 2; u < u1 - 1; u += 3.6) trees.push(...L(u, v));
        else {
          for (let v = v0 + 1; v <= v1 - 1; v += Math.max(3, (v1 - v0) / 3)) hatch.push(...L(u0 + 1, v), ...L(u1 - 1, v));
          for (let u = u0 + 1; u <= u1 - 1; u += Math.max(3, (u1 - u0) / 3)) hatch.push(...L(u, v0 + 1), ...L(u, v1 - 1));
        }
      } else if (q < 0.85) {
        const along = rnd() < 0.5;
        if (along) for (let v = v0 + 1; v < v1; v += 2.4) field.push(...L(u0, v), ...L(u1, v));
        else for (let u = u0 + 1; u < u1; u += 2.4) field.push(...L(u, v0), ...L(u, v1));
      }
      return;
    }
    built++;
    if (built % 20 === 7 && (u1 - u0) > 0.9 * s) { // a church on every twentieth block or so
      churches.push({ x: bx, y: by + (v1 - v0) * 0.25, w: Math.min(u1 - u0, 1.4 * s) * 0.8, kind: rnd() < 0.25 ? 'dome' : 'church', seed: rnd() });
      return;
    }
    const keep = core ? 1 : Math.max(0.65, 1 - 0.3 * t);
    // lots: one or two rows back to back along the block's long side, frontages of a few sizes
    const longU = u1 - u0 >= v1 - v0;
    const [a1, a2, b1, b2] = longU ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
    const at = (al, bl) => (longU ? L(al, bl) : L(bl, al));
    const depth = b2 - b1, rows = depth > 0.6 * s ? 2 : 1;
    const court = rows === 2 && depth > 1.1 * s && rnd() < 0.4;
    const sizes = [SIZES[Math.floor(rnd() * 5)], SIZES[Math.floor(rnd() * 5)], SIZES[Math.floor(rnd() * 5)]];
    for (let r = 0; r < rows; r++) {
      const rd = court ? depth * 0.36 : depth / rows;
      const lb0 = r === 0 ? b1 : b2 - rd, lb1 = r === 0 ? b1 + rd : b2;
      for (let al = a1; al < a2 - 1;) {
        let fw = sizes[Math.floor(rnd() * 3)];
        if (a2 - (al + fw) < 0.25 * s) fw = a2 - al;
        const l0 = al, l1 = Math.min(a2, al + fw);
        al = l1;
        if (rnd() > keep) continue;
        const jit = 0.05 * Math.min(l1 - l0, lb1 - lb0);
        const j = () => (rnd() - 0.5) * 2 * jit;
        const q = [at(l0, lb0), at(l1, lb0), at(l1, lb1), at(l0, lb1)].map(([x, y]) => [x + j(), y + j()]);
        // ridge along the lot's long axis, splitting it in halves; the half facing down-right is in shade
        const alongA = l1 - l0 >= lb1 - lb0;
        const m01 = alongA ? [mid(q[0], q[3]), mid(q[1], q[2])] : [mid(q[0], q[1]), mid(q[3], q[2])];
        const halves = alongA ? [[q[0], q[1], m01[1], m01[0]], [m01[0], m01[1], q[2], q[3]]] : [[q[0], m01[0], m01[1], q[3]], [m01[0], q[1], q[2], m01[1]]];
        const hc = (hv) => hv.reduce((a, p) => a + p[0] + p[1], 0);
        const shade = hc(halves[0]) > hc(halves[1]) ? halves[0] : halves[1];
        // the front wall on the edge facing the viewer (down the canvas), seen obliquely
        let fe = 0, fy = -Infinity;
        for (let e = 0; e < 4; e++) { const yy = q[e][1] + q[(e + 1) % 4][1]; if (yy > fy) { fy = yy; fe = e; } }
        const e0 = q[fe], e1 = q[(fe + 1) % 4], o0 = q[(fe + 3) % 4], o1 = q[(fe + 2) % 4];
        const sw = Math.min(0.25, 2.2 / Math.max(1, Math.hypot(o0[0] - e0[0], o0[1] - e0[1])));
        const strip = [e0, e1, lerp(e1, o1, sw), lerp(e0, o0, sw)];
        const [lx, ly] = mid(q[0], q[2]);
        lots.push(lx, ly, ...q.flat(), ...shade.flat(), ...strip.flat(), ...m01.flat());
      }
    }
  }

  // a district's grid: rows of irregular depth, each with its own run of blocks and alleys
  function grid(ox, oy, a, span, core, own) {
    for (let v = -span; v < span;) {
      const bd = s * (0.7 + 0.55 * rnd()), gv = s * (0.14 + 0.12 * rnd());
      for (let u = -span + rnd() * s; u < span;) {
        const bl = s * (1.0 + 0.9 * rnd()), gu = s * (0.15 + 0.12 * rnd());
        // a block across a district's edge shrinks into its own district, or gives way
        if (!own || ownBlock(own, ox, oy, a, u, v, u + bl, v + bd)) block(ox, oy, a, u, v, u + bl, v + bd, core);
        else {
          const su = bl * 0.25, sv = bd * 0.25;
          if (ownBlock(own, ox, oy, a, u + su, v + sv, u + bl - su, v + bd - sv)) block(ox, oy, a, u + su, v + sv, u + bl - su, v + bd - sv, core);
        }
        u += bl + gu;
      }
      v += bd + gv;
    }
  }
  const ownBlock = (sd, ox, oy, a, u0, v0, u1, v1) => {
    const c = Math.cos(a), sn = Math.sin(a);
    return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].every(([u, v]) => nearest(ox + u * c - v * sn, oy + u * sn + v * c) === sd);
  };
  if (walled) grid(cx, cy, a0, R * 1.2, true, null);
  for (const sd of seeds) {
    if (sd.x < fx0 - D || sd.x > fx1 + D || sd.y < fy0 - D || sd.y > fy1 + D) continue;
    grid(sd.x, sd.y, sd.a, D * 1.2, false, sd);
  }

  // the wall, sampled round its ring; broken at the gates, each gate between two towers
  const gap = (0.8 * s) / R;
  const atGate = (a) => gates.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < gap);
  const n = Math.max(48, Math.ceil((2 * Math.PI * R) / 2));
  const runs = [];
  let run = null;
  for (let k = 0; walled && k <= n; k++) {
    const a = (k / n) * 2 * Math.PI;
    if (atGate(a)) { run = null; continue; }
    if (!run) runs.push(run = []);
    run.push(a);
  }
  if (runs.length > 1 && !atGate(0)) { runs[0] = [...runs.at(-1), ...runs[0]]; runs.pop(); } // the run across angle 0, joined
  const at = (a, dr) => { const r = wallR(a) + dr; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const wall = runs.map((rn) => ({ outer: rn.flatMap((a) => at(a, wt / 2)), inner: rn.flatMap((a) => at(a, -wt / 2)), mid: rn.flatMap((a) => at(a, 0)) }));
  const ticks = [];
  for (const rn of runs) for (let k = 0; k < rn.length; k += 2) ticks.push(...at(rn[k], -wt / 2), ...at(rn[k], wt / 2));
  const towers = [];
  for (const g of walled ? gates : []) for (const sg of [-1, 1]) towers.push(...at(g + sg * gap, 0), wt * 0.95);
  const step = s * (6 + 4 * rnd());
  for (const rn of runs) {
    let acc = step / 2;
    for (let k = 1; k < rn.length; k++) {
      const [x0, y0] = at(rn[k - 1], 0), [x1, y1] = at(rn[k], 0);
      acc += Math.hypot(x1 - x0, y1 - y0);
      if (acc >= step && k < rn.length - 3) { acc = 0; towers.push(x1, y1, wt * 0.8); }
    }
  }
  const core = walled ? Array.from({ length: n + 1 }, (_, k) => at((k / n) * 2 * Math.PI, -wt / 2)).flat() : [];
  const moat = walled ? Array.from({ length: n + 1 }, (_, k) => at((k / n) * 2 * Math.PI, wt * 1.9)).flat() : [];
  // the cathedral on the plaza
  churches.unshift({ x: cx, y: cy + 0.6 * s, w: Math.max(18, 2 * s), kind: rnd() < 0.4 ? 'dome' : 'cathedral', seed: rnd() });
  return {
    s, wt, walled, lagoon, lots: Float32Array.from(lots), trees: Float32Array.from(trees), hatch: Float32Array.from(hatch), field: Float32Array.from(field),
    wall, core: Float32Array.from(core), ticks: Float32Array.from(ticks), towers: Float32Array.from(towers), moat: Float32Array.from(moat), churches,
    box: [Math.max(fx0, Math.min(...rs.map((r) => r.b[0]))), Math.max(fy0, Math.min(...rs.map((r) => r.b[1]))), Math.min(fx1, Math.max(...rs.map((r) => r.b[2]))), Math.min(fy1, Math.max(...rs.map((r) => r.b[3])))],
  };
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const LOT = 30; // floats a lot holds: centre, roof, shade, front, ridge
const quad = (g, a, o) => { g.moveTo(a[o], a[o + 1]); g.lineTo(a[o + 2], a[o + 3]); g.lineTo(a[o + 4], a[o + 5]); g.lineTo(a[o + 6], a[o + 7]); g.closePath(); };
const poly = (g, a, close) => { g.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]); if (close) g.closePath(); };

// A church drawn standing on its ground (x, y): a gabled nave and a campanile with a pyramid cap,
// or a ribbed dome on a drum; a cathedral the bigger, with a tower each side.
function church(g, c, ink, parchment) {
  const { x, y, w } = c, h = w * 0.42;
  const outline = () => { g.fillStyle = parchment; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.8; g.stroke(); };
  const roof = () => { g.fillStyle = ROOF; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke(); };
  const finial = (fx, fy, k) => {
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 4 * k); g.moveTo(fx - 1.5 * k, fy - 2.8 * k); g.lineTo(fx + 1.5 * k, fy - 2.8 * k);
    g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke();
  };
  const k = Math.max(0.8, w / 18);
  // nave
  g.beginPath(); g.rect(x - w / 2, y - h, w, h); outline();
  g.beginPath(); g.moveTo(x - w / 2 - 1, y - h); g.lineTo(x - w / 2 + h * 0.6, y - h * 1.55); g.lineTo(x + w / 2 - h * 0.6, y - h * 1.55); g.lineTo(x + w / 2 + 1, y - h); g.closePath(); roof();
  // arched windows
  g.beginPath();
  for (let i = 1; i < 4; i++) { const wx = x - w / 2 + (i * w) / 4; g.moveTo(wx - 0.8, y - h * 0.25); g.lineTo(wx - 0.8, y - h * 0.6); g.arc(wx, y - h * 0.6, 0.8, Math.PI, 0); g.lineTo(wx + 0.8, y - h * 0.25); }
  g.strokeStyle = ink; g.lineWidth = 0.5; g.stroke();
  if (c.kind === 'dome') {
    const dr = w * 0.24, dy = y - h * 1.5;
    g.beginPath(); g.rect(x - dr * 0.9, dy - dr * 0.5, dr * 1.8, dr * 0.5); outline();
    g.beginPath(); g.ellipse(x, dy - dr * 0.5, dr, dr * 1.05, 0, Math.PI, 0); g.closePath(); roof();
    g.beginPath(); for (const f of [-0.5, 0, 0.5]) { g.moveTo(x + f * dr, dy - dr * 0.5); g.quadraticCurveTo(x + f * dr * 0.6, dy - dr * 1.3, x, dy - dr * 1.55); } g.strokeStyle = ink; g.lineWidth = 0.5; g.stroke();
    g.beginPath(); g.rect(x - dr * 0.18, dy - dr * 1.85, dr * 0.36, dr * 0.32); outline();
    finial(x, dy - dr * 1.85, k);
  }
  // campanile, one end; a cathedral both
  const towers = c.kind === 'cathedral' ? [-1, 1] : c.kind === 'church' ? [c.seed < 0.5 ? -1 : 1] : [];
  for (const side of towers) {
    const tw = w * 0.2, tx = x + side * (w / 2 - tw / 2), th = h * (c.kind === 'cathedral' ? 2.6 : 2.2);
    g.beginPath(); g.rect(tx - tw / 2, y - th, tw, th); outline();
    g.beginPath(); g.rect(tx - tw * 0.22, y - th + tw * 0.35, tw * 0.44, tw * 0.6); g.fillStyle = ink; g.fill();
    g.beginPath(); g.moveTo(tx - tw / 2 - 0.6, y - th); g.lineTo(tx, y - th - tw * 1.3); g.lineTo(tx + tw / 2 + 0.6, y - th); g.closePath(); roof();
    if (side === towers[0] && c.kind === 'cathedral') {
      g.beginPath(); g.moveTo(tx, y - th - tw * 1.3); g.lineTo(tx, y - th - tw * 1.3 - 5 * k); g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke();
      g.beginPath(); g.moveTo(tx, y - th - tw * 1.3 - 5 * k); g.lineTo(tx + 4 * k, y - th - tw * 1.3 - 4 * k); g.lineTo(tx, y - th - tw * 1.3 - 3 * k); g.closePath();
      g.fillStyle = '#8c2f1e'; g.fill();
    } else finial(tx, y - th - tw * 1.3, k * 0.8);
  }
}

// Draws a plan, what meets the scene-px rectangle `r`; `clip(g)` clips to where a city may be drawn.
export function drawCity(g, plan, r, { ink, parchment, clip }) {
  const pad = plan.s * 2;
  const near = (x, y, p = pad) => x > r.x0 - p && x < r.x1 + p && y > r.y0 - p && y < r.y1 + p;
  g.save();
  clip(g);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const lines = (a, colour, width) => {
    g.beginPath();
    for (let i = 0; i < a.length; i += 4) if (near(a[i], a[i + 1])) { g.moveTo(a[i], a[i + 1]); g.lineTo(a[i + 2], a[i + 3]); }
    g.strokeStyle = colour; g.lineWidth = width; g.stroke();
  };
  // a wash over the whole footprint, so the city reads as one mass; then fields, gardens and the moat
  g.fillStyle = 'rgba(214,190,150,0.55)'; g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  lines(plan.field, 'rgba(59,42,26,0.28)', 0.5);
  lines(plan.hatch, 'rgba(111,125,74,0.85)', 0.6);
  // trees as round-capped dots: thousands of arcs in one path are slow to fill
  g.beginPath();
  for (let i = 0; i < plan.trees.length; i += 2) if (near(plan.trees[i], plan.trees[i + 1])) { g.moveTo(plan.trees[i], plan.trees[i + 1]); g.lineTo(plan.trees[i] + 0.01, plan.trees[i + 1]); }
  g.strokeStyle = GARDEN; g.lineWidth = 2.6; g.stroke();
  // inside the wall a roof-red wash under the lots, so even a far city reads as one roofed mass
  if (plan.walled) {
    g.beginPath(); poly(g, plan.core, true); g.fillStyle = 'rgba(181,83,60,0.22)'; g.fill();
    g.beginPath(); poly(g, plan.moat, true); g.strokeStyle = 'rgba(127,148,136,0.45)'; g.lineWidth = plan.wt * 1.4; g.stroke();
  }
  // the lots: one fill per colour, then one ink stroke for every outline and one for the ridges
  const L = plan.lots, seen = [];
  for (let i = 0; i < L.length; i += LOT) if (near(L[i], L[i + 1])) seen.push(i);
  const fillAll = (off, colour) => { g.beginPath(); for (const i of seen) quad(g, L, i + off); g.fillStyle = colour; g.fill(); };
  fillAll(2, 'rgba(181,83,60,0.6)');
  fillAll(10, SHADE);
  fillAll(18, FRONT);
  g.beginPath(); for (const i of seen) quad(g, L, i + 2); g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke();
  g.beginPath(); for (const i of seen) { g.moveTo(L[i + 26], L[i + 27]); g.lineTo(L[i + 28], L[i + 29]); } g.lineWidth = 0.4; g.stroke();
  // the wall: a stone band between two ink lines, crenellated with ticks across it
  g.beginPath(); for (const w of plan.wall) poly(g, w.mid, false);
  g.strokeStyle = STONE; g.lineWidth = plan.wt; g.lineCap = 'butt'; g.stroke();
  lines(plan.ticks, ink, 0.5);
  g.beginPath(); for (const w of plan.wall) { poly(g, w.outer, false); poly(g, w.inner, false); }
  g.strokeStyle = ink; g.lineWidth = 0.9; g.stroke();
  const T = plan.towers;
  g.beginPath(); for (let i = 0; i < T.length; i += 3) if (near(T[i], T[i + 1])) { g.moveTo(T[i] + T[i + 2], T[i + 1]); g.arc(T[i], T[i + 1], T[i + 2], 0, 2 * Math.PI); }
  g.fillStyle = STONE; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.9; g.stroke();
  g.beginPath(); for (let i = 0; i < T.length; i += 3) if (near(T[i], T[i + 1])) { g.moveTo(T[i] + T[i + 2] * 0.5, T[i + 1]); g.arc(T[i], T[i + 1], T[i + 2] * 0.5, 0, 2 * Math.PI); }
  g.fillStyle = ROOF; g.fill();
  g.lineCap = 'round';
  for (const c of plan.churches) if (near(c.x, c.y - c.w, c.w * 2)) church(g, c, ink, parchment);
  g.restore();
}
