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

// The index of `islands` (GSHHG "h" land, [outer, ...holes] in lon/lat) against `coarse` (the 50m
// land, likewise): { v, isles: [lon, lat, r, ...] }, flat, three numbers a record, lon and lat to a
// thousandth of a degree; r is the radius in km of a circle of the island's land, or, negative,
// of the atoll's ring.
export function isleIndex(islands, coarse) {
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
    if (!q) { groups.set(r, { km2: p.km2, box: [...p.box], big: p }); return; }
    q.km2 += p.km2;
    const s = wrap(p.box[0] - q.box[0]) - (p.box[0] - q.box[0]);
    q.box = [Math.min(q.box[0], p.box[0] + s), Math.min(q.box[1], p.box[1]), Math.max(q.box[2], p.box[2] + s), Math.max(q.box[3], p.box[3])];
    if (p.km2 > q.big.km2) q.big = p;
  });
  // the 50m land, boxed, and the outlines of its large polygons cut into segments
  const land = coarse.map((poly) => ({ poly, box: boxOf(poly[0]) })), lg = grid(1);
  land.forEach((l, i) => lg.put(i, l.box));
  const sg = grid(0.5);
  for (const { poly } of land) {
    if (polyKm2(poly) < ISLAND_KM2) continue;
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
  const out = [];
  for (const q of groups.values()) {
    if (q.km2 >= ISLAND_KM2) continue;
    const lon = wrap((q.box[0] + q.box[2]) / 2), lat = (q.box[1] + q.box[3]) / 2;
    const c = Math.cos(lat * RAD), ext = (Math.max((q.box[2] - q.box[0]) * c, q.box[3] - q.box[1]) * KM_DEG) / 2;
    const req = Math.sqrt(q.km2 / Math.PI), atoll = ext * ext > ATOLL * req * req;
    // a probe on the largest islet: the group's centre is lagoon in an atoll
    const [bx0, by0, bx1, by1] = q.big.box, plon = wrap((bx0 + bx1) / 2), plat = (by0 + by1) / 2;
    if (held(plon, plat) || held(lon, lat) || nearCoast(lon, lat)) continue;
    out.push(+lon.toFixed(3), +lat.toFixed(3), atoll ? -+ext.toFixed(2) || -0.01 : +req.toFixed(2) || 0.01);
  }
  return { v: 1, isles: out };
}

// The records of an index as { lon, lat, km, atoll }.
export const islesOf = (index) => {
  const a = index?.isles ?? [], out = [];
  for (let i = 0; i < a.length; i += 3) out.push({ lon: a[i], lat: a[i + 1], km: Math.abs(a[i + 2]), atoll: a[i + 2] < 0 });
  return out;
};
