// The island index: every island and atoll in GSHHG "h" that the coarse land (Natural Earth 50m)
// leaves out, as a point and a size, so a view can mark it where its drawn land lacks it, the way
// period charts drew islands they could not draw to scale. Built once (scripts/build-preview.mjs
// writes geo/isles.json; scripts/render.mjs and the tests build it from the installed shapefile)
// and read by scene.mjs.
//
// One record is one island, or one atoll: the islets within JOIN_KM of each other are one group.
// A group whose land is a small share of its extent is an atoll, drawn as a ring round its lagoon;
// any other is an island, drawn as a dot. Dropped: a group the 50m land already holds, and a group
// within NEAR_KM of a 50m coast over ISLAND_KM2, where the skerries of a large coast would only
// thicken its line. A small island in open ocean is never dropped.
//
// The same groups, read from Natural Earth 10m rather than GSHHG, give the outlines of the remote
// islands 50m drops (isleLand: Pitcairn, Ducie, Oeno), which build-preview.mjs writes to
// geo/isles-land.json for the coarse land to draw before the 10m band takes over.

import { ISLAND_KM2 } from './island.mjs';

export const JOIN_KM = 3;   // islets this close are one island or one atoll
export const NEAR_KM = 25;  // a group this close to a large coast is left to that coast
const ATOLL = 9;            // an atoll's extent is over this many times its land

const R_KM = 6371.0088, RAD = Math.PI / 180, KM_DEG = R_KM * RAD;
const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

// Area of a [lon, lat] ring in km2, equirectangular about its own latitude (island.mjs does the
// same, rounded to whole km2, which would lose every islet here).
function ringKm2(ring) {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length, lon0 = ring[0][0], c = Math.cos(lat0 * RAD);
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = ring[i], [p, q] = ring[(i + 1) % ring.length];
    s += wrap(a - lon0) * c * q - wrap(p - lon0) * c * b;
  }
  return (Math.abs(s) / 2) * KM_DEG ** 2;
}
const polyKm2 = (poly) => ringKm2(poly[0]) - poly.slice(1).reduce((s, r) => s + ringKm2(r), 0);

// [lon0, lat0, lon1, lat1] of a ring, lon unwrapped from its first point so a box never spans the world.
function boxOf(ring) {
  const l0 = ring[0][0];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [lon, lat] of ring) {
    const x = l0 + wrap(lon - l0);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (lat < y0) y0 = lat; if (lat > y1) y1 = lat;
  }
  return [x0, y0, x1, y1];
}
// km between two boxes, 0 when they meet
function gapKm(a, b) {
  const c = Math.cos(((a[1] + a[3]) / 2) * RAD);
  const shift = wrap(b[0] - a[0]) - (b[0] - a[0]); // b moved next to a across the antimeridian
  const dx = Math.max(0, a[0] - (b[2] + shift), b[0] + shift - a[2]) * c, dy = Math.max(0, a[1] - b[3], b[1] - a[3]);
  return Math.hypot(dx, dy) * KM_DEG;
}

// Even-odd point in ring, [lon, lat].
function insideRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < xj + ((lat - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside;
}

// Buckets of `deg` degrees: put(item, box) files an item under every bucket its box meets, near(box)
// lists the items filed under the buckets that box meets.
function grid(deg) {
  const m = new Map(), n = Math.round(360 / deg);
  const each = (b, f) => {
    for (let xi = Math.floor(b[0] / deg); xi <= Math.floor(b[2] / deg); xi++) {
      for (let yi = Math.floor(b[1] / deg); yi <= Math.floor(b[3] / deg); yi++) f(`${((xi % n) + n) % n}_${yi}`);
    }
  };
  return {
    put: (item, b) => each(b, (k) => (m.get(k) ?? m.set(k, []).get(k)).push(item)),
    near: (b) => { const s = new Set(); each(b, (k) => m.get(k)?.forEach((i) => s.add(i))); return s; },
  };
}
const widen = ([x0, y0, x1, y1], km) => {
  const dy = km / KM_DEG, dx = dy / Math.max(0.05, Math.cos(Math.min(89, Math.max(Math.abs(y0), Math.abs(y1))) * RAD));
  return [x0 - dx, y0 - dy, x1 + dx, y1 + dy];
};

// km from a point to a segment, flat about the point
function segKm(lon, lat, [ax, ay], [bx, by]) {
  const c = Math.cos(lat * RAD);
  const x1 = wrap(ax - lon) * c, y1 = ay - lat, x2 = wrap(bx - lon) * c, y2 = by - lat;
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / l)) : 0;
  return Math.hypot(x1 + t * dx, y1 + t * dy) * KM_DEG;
}

// Group q takes in p (an islet or a group): its land, its islets, its box (p moved next to q across
// the antimeridian) and its largest islet.
function join(q, p) {
  q.km2 += p.km2;
  if (p.parts) q.parts.push(...p.parts); else q.parts.push(p);
  const s = wrap(p.box[0] - q.box[0]) - (p.box[0] - q.box[0]);
  q.box = [Math.min(q.box[0], p.box[0] + s), Math.min(q.box[1], p.box[1]), Math.max(q.box[2], p.box[2] + s), Math.max(q.box[3], p.box[3])];
  const big = p.big ?? p;
  if (big.km2 > q.big.km2) q.big = big;
}
// A group's centre, its half-extent in km, the radius of a circle of its land, and whether it is an atoll.
function shape(q) {
  const lon = wrap((q.box[0] + q.box[2]) / 2), lat = (q.box[1] + q.box[3]) / 2;
  const c = Math.cos(lat * RAD), ext = (Math.max((q.box[2] - q.box[0]) * c, q.box[3] - q.box[1]) * KM_DEG) / 2;
  const req = Math.sqrt(q.km2 / Math.PI);
  return Object.assign(q, { lon, lat, ext, req, atoll: ext * ext > ATOLL * req * req });
}

// The groups of `islands` ([outer, ...holes] in lon/lat) that `coarse` (the 50m land, likewise)
// lacks, by the rules above: each { lon, lat, ext, req, atoll, parts }, `parts` its islets' { poly }.
function lacking(islands, coarse) {
  const parts = islands.map((poly) => ({ poly, km2: polyKm2(poly), box: boxOf(poly[0]) })).filter((p) => p.km2 < ISLAND_KM2);
  // join islets within JOIN_KM: union-find over the boxes
  const up = parts.map((_, i) => i);
  const root = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
  const g = grid(0.1);
  parts.forEach((p, i) => {
    for (const j of g.near(widen(p.box, JOIN_KM))) if (gapKm(p.box, parts[j].box) < JOIN_KM) up[root(j)] = root(i);
    g.put(i, p.box);
  });
  const groups = new Map();
  parts.forEach((p, i) => {
    const r = root(i), q = groups.get(r);
    if (!q) groups.set(r, { km2: p.km2, box: [...p.box], big: p, parts: [p] });
    else join(q, p);
  });
  // a rim whose gaps run wider than JOIN_KM leaves arcs of motus, each an atoll of its own: a group
  // whose box meets an atoll's, or whose centre falls inside its ring, is folded into it, until none
  // is, so one atoll is one ring
  const all = [...groups.values()].map(shape), gg = grid(1);
  all.forEach((q) => gg.put(q, q.box));
  for (let folded = true; folded;) {
    folded = false;
    for (const a of all.filter((q) => q.atoll && !q.gone).sort((p, q) => q.ext - p.ext)) {
      if (a.gone) continue;
      for (const b of gg.near(widen(a.box, 0))) {
        if (b === a || b.gone || b.ext > a.ext) continue;
        if (gapKm(a.box, b.box) === 0 || Math.hypot(wrap(b.lon - a.lon) * Math.cos(a.lat * RAD), b.lat - a.lat) * KM_DEG < a.ext) { join(a, b); b.gone = folded = true; }
      }
      shape(a); gg.put(a, a.box);
    }
  }
  // the 50m land, boxed, and the outlines of its large polygons cut into segments
  const land = coarse.map((poly) => ({ poly, km2: polyKm2(poly), box: boxOf(poly[0]) })), lg = grid(1);
  land.forEach((l, i) => lg.put(i, l.box));
  const sg = grid(0.5);
  for (const { poly, km2 } of land) {
    if (km2 < ISLAND_KM2) continue;
    for (const ring of poly) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      sg.put([a, b], boxOf([a, b]));
    }
  }
  const held = (lon, lat) => [...lg.near([lon, lat, lon, lat])].some((i) => {
    const [outer, ...holes] = land[i].poly, x = outer[0][0] + wrap(lon - outer[0][0]);
    return insideRing(outer, x, lat) && !holes.some((h) => insideRing(h, x, lat));
  });
  const nearCoast = (lon, lat) => [...sg.near(widen([lon, lat, lon, lat], NEAR_KM))].some(([a, b]) => segKm(lon, lat, a, b) < NEAR_KM);
  // a small 50m island within JOIN_KM of a group is the same island, drawn already
  const beside = (q) => [...lg.near(widen(q.box, JOIN_KM))].some((i) => land[i].km2 < ISLAND_KM2 && gapKm(q.box, land[i].box) < JOIN_KM);
  return all.filter((q) => {
    if (q.gone || q.km2 >= ISLAND_KM2) return false;
    // a probe on the largest islet: the group's centre is lagoon in an atoll
    const [bx0, by0, bx1, by1] = q.big.box, plon = wrap((bx0 + bx1) / 2), plat = (by0 + by1) / 2;
    return !(held(plon, plat) || held(q.lon, q.lat) || beside(q) || nearCoast(q.lon, q.lat));
  });
}

// The index of `islands` (GSHHG "h" land, [outer, ...holes] in lon/lat) against `coarse` (the 50m
// land, likewise): { v, isles: [lon, lat, r, ...] }, flat, three numbers a record, lon and lat to a
// thousandth of a degree; r is the radius in km of a circle of the island's land, or, negative,
// of the atoll's ring.
export function isleIndex(islands, coarse) {
  const out = [];
  for (const { lon, lat, ext, req, atoll } of lacking(islands, coarse)) {
    out.push(+lon.toFixed(3), +lat.toFixed(3), atoll ? -+ext.toFixed(2) || -0.01 : +req.toFixed(2) || 0.01);
  }
  return { v: 1, isles: out };
}

// The outlines of the same islands, for the coarse land to draw: { v, land: [[outer, ...holes], ...] },
// each point [lon, lat] to PLACES decimals (a ten-thousandth of a degree is some 11 m, under a pixel
// until z13, past where the detail bands take over). Fed Natural Earth 10m land, this is the remote
// oceanic islands 50m drops (Pitcairn, Ducie, Oeno), drawn as land from z5 until the 10m band.
const PLACES = 4;
export function isleLand(islands, coarse) {
  const round = (ring) => ring.map(([lon, lat]) => [+lon.toFixed(PLACES), +lat.toFixed(PLACES)])
    .filter((p, i, r) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
  // an islet whose outer ring rounds away goes whole, so a hole never stands in for it as land
  const land = lacking(islands, coarse).flatMap((q) => q.parts.map(({ poly }) => poly.map(round)))
    .filter((poly) => poly[0].length >= 4)
    .map((poly) => poly.filter((r, i) => i === 0 || r.length >= 4));
  return { v: 1, land };
}

// The records of an index as { lon, lat, km, atoll }.
export const islesOf = (index) => {
  const a = index?.isles ?? [], out = [];
  for (let i = 0; i < a.length; i += 3) out.push({ lon: a[i], lat: a[i + 1], km: Math.abs(a[i + 2]), atoll: a[i + 2] < 0 });
  return out;
};
