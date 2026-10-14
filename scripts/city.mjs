// A city drawn over its urban footprint at close zoom, after the Renaissance bird's-eye plans
// (Braun and Hogenberg's Civitates, de' Barbari's Venice, Truschet and Hoyau's Paris): a walled
// core holding most of the town, with drum towers and gates (a great city's wall a star of bastions
// behind a moat), its blocks ringed by continuous rows of red roofs about green yards, closest at
// the centre, the streets the pale gaps between them; outside, roads from the gates through
// suburbs that thin into a patchwork of green and ochre fields; and the churches drawn standing.
// cityPlan lays it out once, in canvas px, from a seeded random source, so a view always draws the
// same city; drawCity only draws it.

const ROOF = '#b5533c', SHADE = '#8c3b2b', FRONT = '#e8dcc0', GARDEN = '#6f7d4a', STONE = '#d6c29a', MOAT = '#7f9488';
const STREET = '#f2e8cc'; // the pale ground of the streets and roads
const FIELDS = ['#a7b06a', '#d9bb69', '#bfc07f', '#c9a95a']; // meadow, corn, lea, stubble
const LOT_CAP = 20000; // roof runs a plan holds at most; the blocks grow to keep under it
const FORT_KM = 40; // a footprint this many km on a side (about the largest 75 metros) is walled with bastions
const TAU = 2 * Math.PI;

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

// The radius at angle `a` of a polygon star-shaped about the origin, its vertices [angle, radius]:
// the ray meets the straight edge between the vertices either side of it.
function polarPolygon(vs) {
  const pts = vs.map(([a, r]) => [((a % TAU) + TAU) % TAU, r]).sort((p, q) => p[0] - q[0]).map(([a, r]) => [a, r * Math.cos(a), r * Math.sin(a)]);
  const n = pts.length;
  const fn = (a) => {
    a = ((a % TAU) + TAU) % TAU;
    let k = 0;
    while (k < n && pts[k][0] <= a) k++;
    const p = pts[(k - 1 + n) % n], q = pts[k % n], dx = q[1] - p[1], dy = q[2] - p[2];
    return (p[1] * dy - p[2] * dx) / (Math.cos(a) * dy - Math.sin(a) * dx);
  };
  fn.angles = pts.map((p) => p[0]);
  return fn;
}

// Squared px from (x, y) to the segment (ax, ay)-(bx, by).
function segD2(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}

// The plan of a city whose urban rings (px) are `rings` and whose place is (x, y): `extent` is the
// square root of its area, px; `kmPx` px per km; `rnd` a seeded random source; `w` x `h` the canvas,
// the only part laid out (and a margin); `onLand(x, y)` whether a px point is dry ground. The city
// is built where its footprint is on land. One whose footprint is mostly water (Venice in its
// lagoon) is a lagoon city: built over the water, and unwalled. The walled core is set near the
// place but on dry ground, and spans about two thirds of the extent; where no ring of ground round
// it holds a wall, the wall is tried smaller, and failing that the city is unwalled.
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
  // when the roof runs would pass LOT_CAP
  let s = Math.min(22, Math.max(10, 10 + 3 * (zoom - 9)), Math.max(6, E / 16));
  let area = 0;
  for (let y = fy0 + 12; y < fy1; y += 24) for (let x = fx0 + 12; x < fx1; x += 24) if (ground(x, y)) area += 576;
  const lots0 = (area / (1.8 * s) ** 2) * 6;
  if (lots0 > LOT_CAP) s *= Math.sqrt(lots0 / LOT_CAP);

  // the wall's place: the centre is the place itself when a wall round it stands on the ground, else
  // the point near it (a grid a wall's radius each way) whose wall stands best, nearest first among equals
  const fort = !lagoon && E / kmPx >= FORT_KM;
  const R0 = Math.max(3 * s, E / 3);
  let R = R0, cx = px, cy = py, best = 0;
  const standing = (x, y) => {
    let n = 0;
    for (const k of [0.55, 0.95]) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; if (ground(x + k * R * Math.cos(a), y + k * R * Math.sin(a))) n++; }
    return n / 24;
  };
  const offsets = [...Array(25)].map((_, i) => [((i % 5) - 2) * 0.5, (Math.floor(i / 5) - 2) * 0.5]).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  for (const k of lagoon ? [] : [1, 0.75, 0.55, 0.4, 0.28, 0.2]) {
    R = Math.max(3 * s, k * R0); cx = px; cy = py; best = standing(px, py);
    if (best < 0.9) for (const [dx, dy] of offsets) {
      const x = px + dx * R, y = py + dy * R;
      if ((dx || dy) && inFrame(x, y)) { const v = standing(x, y); if (v > best + 1e-9) { best = v; cx = x; cy = y; } }
    }
    if (best >= 0.75 || R <= 3 * s) break;
  }
  const walled = !lagoon && best >= 0.75;
  const bastioned = walled && fort;
  const wt = walled ? Math.max(4, (bastioned ? 0.6 : 0.42) * s) : 0; // wall thickness
  // the wall's trace, polar about the centre so a point's side of it is one comparison: a medieval
  // wall a ring of straight runs between corner towers; a great city's a star of bastions, each a
  // pointed salient out from the curtain, `curtain` the line between them that the town keeps inside
  let wallR = () => 0, curtain = wallR, gates;
  if (bastioned) {
    const nb = 9 + Math.floor(rnd() * 4), b0 = rnd() * TAU, span = TAU / nb, vs = [], cv = [], bt = [];
    for (let i = 0; i < nb; i++) {
      const t = b0 + (i + 0.15 * (rnd() - 0.5)) * span, r = R * (0.94 + 0.1 * rnd()), dl = 0.14 * span;
      bt.push(t);
      vs.push([t - dl, r], [t - 0.75 * dl, r * 1.05], [t, r * 1.14], [t + 0.75 * dl, r * 1.05], [t + dl, r]);
      cv.push([t - dl, r], [t + dl, r]);
    }
    wallR = polarPolygon(vs); curtain = polarPolygon(cv);
    // gates mid-curtain, between bastions
    const ng = 3 + Math.floor(rnd() * 3), pick = [...Array(nb).keys()].sort(() => rnd() - 0.5).slice(0, ng);
    gates = pick.map((i) => bt[i] + span / 2);
  } else {
    if (walled) {
      const nv = 9 + Math.floor(rnd() * 5);
      wallR = curtain = polarPolygon(Array.from({ length: nv }, (_, i) => [((i + 0.3 * (rnd() - 0.5)) / nv) * TAU, R * (0.85 + 0.25 * rnd())]));
    }
    const ng = 3 + Math.floor(rnd() * 3), g0 = rnd() * TAU;
    gates = Array.from({ length: ng }, (_, i) => g0 + ((i + 0.5 * (rnd() - 0.5)) * TAU) / ng);
  }
  const polar = (x, y) => [Math.hypot(x - cx, y - cy), Math.atan2(y - cy, x - cx)];
  const at = (a, dr, f = wallR) => { const r = f(a) + dr; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const outside = wt * (bastioned ? 5 : 3); // the clear ground beyond the wall: a moat and glacis for a fort

  // the roads: from each gate out across the country, wandering a little but holding their heading,
  // to the edge of the frame; the street in from each gate runs straight to the plaza
  const roads = lagoon ? [] : gates.map((g) => {
    const pts = [...at(g, walled ? wt / 2 : 0)];
    let hd = g, [x, y] = pts;
    for (let k = 0; k < 400 && inFrame(x, y); k++) {
      hd += (rnd() - 0.5) * 0.3 + 0.25 * Math.atan2(Math.sin(g - hd), Math.cos(g - hd));
      x += 2.5 * s * Math.cos(hd); y += 2.5 * s * Math.sin(hd);
      pts.push(x, y);
    }
    return pts;
  });
  const roadOut = (x, y) => {
    let d = Infinity;
    for (const p of roads) for (let i = 2; i < p.length; i += 2) d = Math.min(d, segD2(x, y, p[i - 2], p[i - 1], p[i], p[i + 1]));
    return Math.sqrt(d);
  };
  const streets = walled ? gates.map((g) => [...at(g, 0), cx + 1.4 * s * Math.cos(g), cy + 1.4 * s * Math.sin(g)]) : [];

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

  const lots = [], parts = [], trees = [], furrows = [], pave = [], yards = [], fields = FIELDS.map(() => []), churches = [];
  const fall = walled ? Math.max(E * 0.6 - R, 6 * s) : 0.6 * E;
  const dr = 0.34 * s; // a row of houses, deep
  let built = 0;

  // a run of houses from l0 to l1 along a row, b1 to b2 across it: its roof split along the ridge,
  // the half facing down-right in shade, the front wall on the edge facing the viewer (down the
  // canvas), seen obliquely; `walls` the party walls between its houses
  function roofRun(at, l0, l1, b1, b2, walls) {
    const q = [at(l0, b1), at(l1, b1), at(l1, b2), at(l0, b2)], bm = (b1 + b2) / 2;
    const m01 = [at(l0, bm), at(l1, bm)];
    const halves = [[q[0], q[1], m01[1], m01[0]], [m01[0], m01[1], q[2], q[3]]];
    const hc = (hv) => hv.reduce((a, p) => a + p[0] + p[1], 0);
    const shade = hc(halves[0]) > hc(halves[1]) ? halves[0] : halves[1];
    let fe = 0, fy = -Infinity;
    for (let e = 0; e < 4; e++) { const yy = q[e][1] + q[(e + 1) % 4][1]; if (yy > fy) { fy = yy; fe = e; } }
    const e0 = q[fe], e1 = q[(fe + 1) % 4], o0 = q[(fe + 3) % 4], o1 = q[(fe + 2) % 4];
    const sw = Math.min(0.25, 2.2 / Math.max(1, Math.hypot(o0[0] - e0[0], o0[1] - e0[1])));
    const strip = [e0, e1, lerp(e1, o1, sw), lerp(e0, o0, sw)];
    const [lx, ly] = mid(q[0], q[2]);
    lots.push(lx, ly, ...q.flat(), ...shade.flat(), ...strip.flat(), ...m01.flat());
    for (const l of walls) parts.push(...at(l, b1), ...at(l, b2));
  }
  // a row of houses filling (u0, v0)-(u1, v1), ridged along its long side: continuous where `keep`
  // is 1, else broken into runs where houses drop out
  function row(P, u0, v0, u1, v1, keep) {
    const longU = u1 - u0 >= v1 - v0;
    const [a1, a2, b1, b2] = longU ? [u0, u1, v0, v1] : [v0, v1, u0, u1];
    const at = (al, bl) => (longU ? P(al, bl) : P(bl, al));
    let start = null, walls = [];
    for (let al = a1; al < a2 - 0.5;) {
      let fw = s * (0.24 + 0.3 * rnd());
      if (a2 - (al + fw) < 0.15 * s) fw = a2 - al;
      const l1 = Math.min(a2, al + fw);
      if (rnd() < keep) { if (start === null) start = al; else walls.push(al); }
      else if (start !== null) { roofRun(at, start, al, b1, b2, walls); start = null; walls = []; }
      al = l1;
    }
    if (start !== null) roofRun(at, start, a2, b1, b2, walls);
  }
  const rect = (P, u0, v0, u1, v1, e = 0) => [P(u0 - e, v0 - e), P(u1 + e, v0 - e), P(u1 + e, v1 + e), P(u0 - e, v1 + e)].flat();

  // one block: corners from its rectangle (u0, v0)-(u1, v1) in a frame at (ox, oy) turned by `a`,
  // `gap` the street round it
  function block(ox, oy, a, u0, v0, u1, v1, gap, core) {
    const c = Math.cos(a), sn = Math.sin(a);
    const P = (u, v) => [ox + u * c - v * sn, oy + u * sn + v * c];
    const corners = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
    const [bx, by] = P((u0 + u1) / 2, (v0 + v1) / 2);
    if (!inFrame(bx, by) || !ground(bx, by)) return;
    const [d, ang] = polar(bx, by);
    if (core) {
      if (corners.some(([x, y]) => { const [dd, aa] = polar(x, y); return dd > curtain(aa) - wt * 1.2; })) return;
      if (d < 1.4 * s) return; // the plaza
    } else {
      if (corners.some(([x, y]) => { const [dd, aa] = polar(x, y); return dd < wallR(aa) + outside; })) return;
      if (roadOut(bx, by) < 0.75 * s) return;
    }
    // how far out: inside the wall 0 at the centre to 1 at the wall; outside, the wall's distance over `fall`
    const k = core ? d / curtain(ang) : Math.max(0, (d - wallR(ang)) / fall), near = core ? Infinity : roadOut(bx, by);
    // inside the wall the blocks stand close, with gardens toward it (Braun and Hogenberg's towns keep
    // their orchards against the wall); outside they thin with distance from it, but for ribbon
    // suburbs along the roads, into fields
    let p = lagoon ? 0.97 : core ? 0.99 - 0.25 * k ** 3 : walled ? 0.9 * Math.exp(-0.9 * k) : 0.97 * Math.exp(-0.6 * k);
    if (near < 3 * s) p = Math.max(p, 0.97 * Math.exp(-0.15 * k));
    const roll = rnd();
    if (roll >= p) {
      if (lagoon && !core) return; // open water
      // not built: in the core a garden; outside an orchard, a field, or open ground
      const q = core ? 0 : (roll - p) / (1 - p);
      if (q < 0.2) {
        yards.push(...rect(P, u0, v0, u1, v1));
        for (let v = v0 + 2; v < v1 - 1; v += 3.6) for (let u = u0 + 2; u < u1 - 1; u += 3.6) if (rnd() < 0.7) trees.push(...P(u, v));
      } else if (q < 0.92) {
        fields[Math.floor(rnd() * FIELDS.length)].push(...rect(P, u0, v0, u1, v1, gap / 2));
        const along = rnd() < 0.5, step = 2.6;
        if (along) for (let v = v0 + 1; v < v1; v += step) furrows.push(...P(u0, v), ...P(u1, v));
        else for (let u = u0 + 1; u < u1; u += step) furrows.push(...P(u, v0), ...P(u, v1));
      }
      return;
    }
    if (!core) pave.push(...rect(P, u0, v0, u1, v1, gap / 2 + 0.5));
    built++;
    if (built % 30 === 7 && (u1 - u0) > 0.9 * s) { // a church on every thirtieth block or so
      churches.push({ x: bx, y: by + (v1 - v0) * 0.25, w: Math.min(u1 - u0, 1.4 * s) * 1.6, kind: rnd() < 0.25 ? 'dome' : 'church', seed: rnd() });
      return;
    }
    // the houses: rows round the block's edge about a yard, or a block too small for one built
    // solid, back to back along its long side; at the centre the blocks are built solid
    const keep = core ? 1 : Math.max(0.75, 1 - 0.2 * k);
    const du = u1 - u0, dv = v1 - v0;
    if (Math.min(du, dv) > 2.6 * dr && rnd() < (core ? 0.15 + 0.75 * k : 0.7)) {
      row(P, u0, v0, u1, v0 + dr, keep); row(P, u0, v1 - dr, u1, v1, keep);
      row(P, u0, v0 + dr, u0 + dr, v1 - dr, keep); row(P, u1 - dr, v0 + dr, u1, v1 - dr, keep);
      yards.push(...rect(P, u0 + dr, v0 + dr, u1 - dr, v1 - dr));
      if (rnd() < 0.5) trees.push(...P((u0 + u1) / 2, (v0 + v1) / 2));
    } else if (Math.min(du, dv) < 1.3 * dr) row(P, u0, v0, u1, v1, keep);
    else if (du >= dv) { const vm = (v0 + v1) / 2; row(P, u0, v0, u1, vm, keep); row(P, u0, vm, u1, v1, keep); }
    else { const um = (u0 + u1) / 2; row(P, u0, v0, um, v1, keep); row(P, um, v0, u1, v1, keep); }
  }

  // a district's grid: rows of irregular depth, each with its own run of blocks and streets; inside
  // the wall the blocks are larger and the streets narrower toward the centre
  function grid(ox, oy, a, span, core, own) {
    const c = Math.cos(a), sn = Math.sin(a);
    for (let v = -span; v < span;) {
      const bd = s * (1.0 + 0.7 * rnd());
      const k = core ? Math.min(1, Math.hypot(v, 0) / R) : 1;
      const gv = s * (0.12 + 0.1 * rnd()) * (core ? 0.7 + 0.6 * k : 1.2);
      for (let u = -span + rnd() * s; u < span;) {
        const bl = s * (1.3 + 1.1 * rnd());
        const kk = core ? Math.min(1, Math.hypot(u, v) / R) : 1;
        const gu = s * (0.12 + 0.1 * rnd()) * (core ? 0.7 + 0.6 * kk : 1.2);
        // a block across a district's edge shrinks into its own district, or gives way
        if (!own || ownBlock(own, ox, oy, c, sn, u, v, u + bl, v + bd)) block(ox, oy, a, u, v, u + bl, v + bd, Math.min(gu, gv), core);
        else {
          const su = bl * 0.25, sv = bd * 0.25;
          if (ownBlock(own, ox, oy, c, sn, u + su, v + sv, u + bl - su, v + bd - sv)) block(ox, oy, a, u + su, v + sv, u + bl - su, v + bd - sv, Math.min(gu, gv), core);
        }
        u += bl + gu;
      }
      v += bd + gv;
    }
  }
  const ownBlock = (sd, ox, oy, c, sn, u0, v0, u1, v1) =>
    [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].every(([u, v]) => nearest(ox + u * c - v * sn, oy + u * sn + v * c) === sd);
  if (walled) grid(cx, cy, a0, R * 1.3, true, null);
  for (const sd of seeds) {
    if (sd.x < fx0 - D || sd.x > fx1 + D || sd.y < fy0 - D || sd.y > fy1 + D) continue;
    grid(sd.x, sd.y, sd.a, D * 1.2, false, sd);
  }

  // the wall, sampled round its ring and at every corner of its trace; broken at the gates, each
  // gate between two towers
  const gap = (0.8 * s) / R;
  const atGate = (a) => gates.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < gap);
  const n = Math.max(48, Math.ceil((TAU * R) / 6));
  const ring = walled ? [...Array.from({ length: n }, (_, k) => (k / n) * TAU), ...wallR.angles].sort((p, q) => p - q) : [];
  const runs = [];
  let run = null;
  for (const a of ring) {
    if (atGate(a)) { run = null; continue; }
    if (!run) runs.push(run = []);
    run.push(a);
  }
  if (runs.length > 1 && !atGate(0) && !atGate(ring.at(-1))) { runs[0] = [...runs.at(-1), ...runs[0]]; runs.pop(); } // the run across angle 0, joined
  const wall = runs.map((rn) => ({ outer: rn.flatMap((a) => at(a, wt / 2)), inner: rn.flatMap((a) => at(a, -wt / 2)), mid: rn.flatMap((a) => at(a, 0)) }));
  const ticks = [];
  for (const rn of runs) for (let k = 1; k < rn.length; k++) {
    const [x0, y0] = at(rn[k - 1], 0), [x1, y1] = at(rn[k], 0), len = Math.hypot(x1 - x0, y1 - y0);
    for (let t = 1.5; t < len; t += 3) { const a = rn[k - 1] + Math.atan2(Math.sin(rn[k] - rn[k - 1]), Math.cos(rn[k] - rn[k - 1])) * (t / len); ticks.push(...at(a, -wt / 2), ...at(a, wt / 2)); }
  }
  // towers: a pair at each gate; on a medieval wall, at its corners and along its longer runs too
  const towers = [];
  for (const g of walled ? gates : []) for (const sg of [-1, 1]) towers.push(...at(g + sg * gap, 0), wt * 0.95);
  if (walled && !bastioned) {
    const step = s * (5 + 3 * rnd());
    for (const rn of runs) {
      let acc = 0;
      for (let k = 1; k < rn.length; k++) {
        const [x0, y0] = at(rn[k - 1], 0), [x1, y1] = at(rn[k], 0);
        acc += Math.hypot(x1 - x0, y1 - y0);
        const corner = wallR.angles.includes(rn[k]);
        if ((corner && acc > 1.5 * s) || acc >= step) { acc = 0; if (k < rn.length - 2) towers.push(x1, y1, wt * 0.8); }
      }
    }
  }
  const trace = (f, dr) => (walled ? ring.flatMap((a) => at(a, dr, f)) : []);
  const core = trace(curtain, -wt / 2);
  // a fort's bastions, filled between the star and its curtain, and its moat
  const bastions = bastioned ? { star: trace(wallR, 0), curtain: trace(curtain, 0) } : null;
  const moat = bastioned ? trace(wallR, wt * 2.6) : [];
  // the cathedral on the plaza
  churches.unshift({ x: cx, y: cy + 0.6 * s, w: Math.min(Math.max(36, 4 * s), E / 2), kind: rnd() < 0.4 ? 'dome' : 'cathedral', seed: rnd() });
  const F = (a) => Float32Array.from(a);
  return {
    s, wt, walled, bastioned, lagoon, lots: F(lots), parts: F(parts), trees: F(trees), furrows: F(furrows), pave: F(pave), yards: F(yards), fields: fields.map(F),
    roads: roads.map(F), streets: streets.map(F), roadW: 0.6 * s, wall, core: F(core), ticks: F(ticks), towers: F(towers), moat: F(moat), bastions: bastions && { star: F(bastions.star), curtain: F(bastions.curtain) }, churches,
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
// No wash: the city is its streets, roofs, gardens and fields on the chart's own ground.
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
  const quads = (a, fillColour, edge) => {
    g.beginPath();
    for (let i = 0; i < a.length; i += 8) if (near(a[i], a[i + 1])) quad(g, a, i);
    g.fillStyle = fillColour; g.fill();
    if (edge) { g.strokeStyle = edge; g.lineWidth = 0.5; g.stroke(); }
  };
  // the ground: pale streets inside the wall and round the blocks outside it; fields, yards and orchards
  if (plan.walled) { g.beginPath(); poly(g, plan.core, true); g.fillStyle = STREET; g.fill(); }
  quads(plan.pave, STREET);
  plan.fields.forEach((f, i) => quads(f, FIELDS[i], 'rgba(59,42,26,0.35)'));
  lines(plan.furrows, 'rgba(59,42,26,0.22)', 0.5);
  quads(plan.yards, 'rgba(111,125,74,0.55)');
  // trees as round-capped dots: thousands of arcs in one path are slow to fill
  g.beginPath();
  for (let i = 0; i < plan.trees.length; i += 2) if (near(plan.trees[i], plan.trees[i + 1])) { g.moveTo(plan.trees[i], plan.trees[i + 1]); g.lineTo(plan.trees[i] + 0.01, plan.trees[i + 1]); }
  g.strokeStyle = GARDEN; g.lineWidth = 2.6; g.stroke();
  // a fort's moat, water between ink banks
  if (plan.moat.length) {
    g.beginPath(); poly(g, plan.moat, true);
    g.strokeStyle = ink; g.lineWidth = plan.wt * 2 + 1.6; g.stroke();
    g.strokeStyle = MOAT; g.lineWidth = plan.wt * 2; g.stroke();
  }
  // the roads out of the gates, pale between ink edges, crossing the moat as bridges
  g.beginPath(); for (const p of plan.roads) poly(g, p, false);
  g.strokeStyle = 'rgba(59,42,26,0.55)'; g.lineWidth = plan.roadW + 1.4; g.stroke();
  g.strokeStyle = STREET; g.lineWidth = plan.roadW; g.stroke();
  // the roofs, standing: each raised a storey over its ground, its front wall hung below the edge
  // facing the viewer, as the bird's-eye plans draw them. Back rows first, a band at a time, so a
  // nearer house hides the one behind it; within a band one fill per colour, then one ink stroke
  // for the outlines, one for the ridges and one for the party walls.
  const L = plan.lots, up = Math.max(2.5, plan.s * 0.38), bands = new Map(), band = Math.max(4, plan.s * 0.5);
  for (let i = 0; i < L.length; i += LOT) if (near(L[i], L[i + 1], pad + up)) {
    const k = Math.floor(L[i + 1] / band);
    if (!bands.has(k)) bands.set(k, []);
    bands.get(k).push(i);
  }
  const P = plan.parts, partBands = new Map();
  for (let i = 0; i < P.length; i += 4) if (near(P[i], P[i + 1], pad + up)) {
    const k = Math.floor(Math.max(P[i + 1], P[i + 3]) / band);
    if (!partBands.has(k)) partBands.set(k, []);
    partBands.get(k).push(i);
  }
  const raised = (o) => { g.moveTo(L[o], L[o + 1] - up); for (let k = 1; k < 4; k++) g.lineTo(L[o + 2 * k], L[o + 2 * k + 1] - up); g.closePath(); };
  const wallOf = (i) => { const o = i + 18; g.moveTo(L[o], L[o + 1]); g.lineTo(L[o + 2], L[o + 3]); g.lineTo(L[o + 2], L[o + 3] - up); g.lineTo(L[o], L[o + 1] - up); g.closePath(); };
  for (const k of [...new Set([...bands.keys(), ...partBands.keys()])].sort((a, b) => a - b)) {
    const seen = bands.get(k) ?? [];
    g.beginPath(); for (const i of seen) wallOf(i); g.fillStyle = FRONT; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.55; g.stroke();
    g.beginPath(); for (const i of seen) raised(i + 2); g.fillStyle = ROOF; g.fill();
    g.beginPath(); for (const i of seen) raised(i + 10); g.fillStyle = SHADE; g.fill();
    g.beginPath(); for (const i of seen) raised(i + 2); g.strokeStyle = ink; g.lineWidth = 0.7; g.stroke();
    g.beginPath(); for (const i of seen) { g.moveTo(L[i + 26], L[i + 27] - up); g.lineTo(L[i + 28], L[i + 29] - up); } g.lineWidth = 0.4; g.stroke();
    g.beginPath(); for (const i of partBands.get(k) ?? []) { g.moveTo(P[i], P[i + 1] - up); g.lineTo(P[i + 2], P[i + 3] - up); } g.stroke();
  }
  // the streets in from the gates to the plaza, over the roofs
  g.beginPath(); for (const p of plan.streets) poly(g, p, false);
  g.strokeStyle = 'rgba(59,42,26,0.55)'; g.lineWidth = plan.roadW + 1.4; g.stroke();
  g.strokeStyle = STREET; g.lineWidth = plan.roadW; g.stroke();
  // a fort's bastions, solid between the star and its curtain
  if (plan.bastions) {
    g.beginPath(); poly(g, plan.bastions.star, true); poly(g, plan.bastions.curtain, true);
    g.fillStyle = STONE; g.fill('evenodd');
    g.beginPath(); poly(g, plan.bastions.star, true); g.strokeStyle = ink; g.lineWidth = 0.9; g.stroke();
  }
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

// Little houses standing in the wash of a built-up area too far off for its plan, after the Carta
// Marina's towns: a gabled front, its roof running back up and to the right, a side wall in shade.
// `pts` holds x, y (the foot of the front), width and a seed in [0, 1) per house; drawn back to
// front, each a little askew, as a hand would.
export function drawHouses(g, pts, { ink, alpha = 1 }) {
  const order = [];
  for (let i = 0; i < pts.length; i += 4) order.push(i);
  order.sort((a, b) => pts[a + 1] - pts[b + 1]);
  g.save(); g.globalAlpha = alpha; g.lineJoin = 'round';
  for (const i of order) {
    const x = pts[i], y = pts[i + 1], w = pts[i + 2], sd = pts[i + 3];
    const wob = (k) => (((sd * 9301 * (k + 1)) % 1) - 0.5) * 0.14 * w;
    const hw = w * (0.4 + 0.2 * ((sd * 7) % 1)), rise = w * 0.45, ox = w * 0.65, oy = -w * 0.38;
    const A = [x - w / 2 + wob(1), y], B = [x + w / 2 + wob(2), y], C = [B[0] + wob(3), y - hw], D = [A[0] + wob(4), y - hw], P = [x + wob(5), y - hw - rise];
    const path = (pp) => { g.beginPath(); pp.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
    const shift = ([px, py]) => [px + ox, py + oy];
    path([B, shift(B), shift(C), C]); g.fillStyle = '#c4ad86'; g.fill(); g.strokeStyle = ink; g.lineWidth = 0.5; g.stroke();
    path([P, C, shift(C), shift(P)]); g.fillStyle = ROOF; g.fill(); g.stroke();
    path([A, B, C, P, D]); g.fillStyle = '#dcc9a0'; g.fill(); g.stroke();
    if (w > 5) { g.beginPath(); g.rect(x - w * 0.1, y - hw * 0.55, w * 0.2, hw * 0.55); g.fillStyle = ink; g.fill(); } // a door
  }
  g.restore();
}
