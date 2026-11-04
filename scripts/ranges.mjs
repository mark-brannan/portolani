// Mountain ranges from Natural Earth: its 10m geography regions' Range/mtn polygons, each the ground a
// range stands on. relief.mjs runs a range's ridges along the polygon and heaps its peaks there, so
// the Alps, the Andes and the Cascades stand where they are, not where the land happens to lie far
// from the sea.
//
// A polygon's ridges are found once, in Mercator's own plane (so they keep their shape on the map
// at every zoom): the polygon is rasterised, each cell's distance from its edge measured, and a ridge
// walked from the deepest cell along where the ground stays deepest, then more from the deepest
// cells no ridge is near yet. A ridge carries its half-width, so a close view holds the side ridges
// of a wide range and a far view only the main one.
//
// Which ranges: Natural Earth's own MIN_LABEL, counted in 256 px tiles as water.mjs's `shown` reads
// it, so a far view holds the great ranges (MIN_LABEL 2) and a close one the rest (up to 6).

import { boxOf, shown } from './water.mjs';
import { RAD, mercLat } from './frame-box.mjs';

export const RANGE_CLASS = 'Range/mtn';
const GRID = 128; // cells along a polygon's longer side
const MAX_RIDGES = 8; // per polygon
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
const round = (c) => (typeof c[0] === 'number' ? c.map((v) => Math.round(v * 1e3) / 1e3) : c.map(round));

// The ranges the site ships, from Natural Earth's geography regions (GeoJSON): the Range/mtn
// polygons only, each carrying the four properties the page reads (name, scalerank, min_label,
// ne_id), coordinates to a thousandth of a degree. build-preview.mjs writes it to geo/ranges-10m.json.
export function slimRanges(geo) {
  return {
    type: 'FeatureCollection',
    features: geo.features.filter((f) => f.properties.FEATURECLA === RANGE_CLASS).map((f) => ({
      type: 'Feature',
      properties: { name: f.properties.NAME, scalerank: f.properties.SCALERANK, min_label: f.properties.MIN_LABEL, ne_id: f.properties.NE_ID },
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
    })),
  };
}

const hash = (...n) => n.reduce((h, v) => Math.imul(h ^ (v | 0), 16777619), 2166136261) | 0;

// A ring with its longitudes made continuous, so a range across the antimeridian is one shape.
function unwrap(ring) {
  let prev = null;
  return ring.map(([lon, lat]) => {
    if (prev !== null) while (lon - prev > 180) lon -= 360;
    if (prev !== null) while (lon - prev < -180) lon += 360;
    prev = lon;
    return [lon, lat];
  });
}

// The ranges from slimRanges's file, one per polygon (a MultiPolygon's parts each a range), the
// greatest first: { id, name, rank, minZoom, rings, box: { lonMin, lonMax, latMin, latMax } }.
export function rangesOf(geo) {
  const out = [];
  (geo?.features ?? []).forEach((f, i) => {
    const g = f.geometry, polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    polys.forEach((rings, part) => {
      const rs = rings.map(unwrap), b = boxOf(rs[0]);
      out.push({
        id: hash(f.properties.ne_id ?? i, part), name: f.properties.name, rank: f.properties.scalerank ?? 6, minZoom: f.properties.min_label ?? 6, rings: rs,
        box: { lonMin: b.x0, lonMax: b.x1, latMin: b.y0, latMax: b.y1 },
      });
    });
  });
  return out.sort((a, b) => a.rank - b.rank || a.minZoom - b.minZoom || a.id - b.id);
}

// The ranges a view at `zoom` shows whose box meets the lon/lat frame `box` (frame-box.mjs), at any
// turn of the world.
export function rangesIn(ranges, zoom, box) {
  return ranges.filter((r) => shown(r, zoom) && [-360, 0, 360].some((o) => r.box.lonMax + o >= box.lonMin && r.box.lonMin + o <= box.lonMax)
    && r.box.latMax >= box.latMin && r.box.latMin <= box.latMax);
}

// A chamfer (1, sqrt2) distance, in cells, from each inside cell of `inside` (cols x rows) to the
// nearest outside one; outside the grid counts as outside.
export function chamfer(inside, cols, rows, edgeOutside = true) {
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = inside[i] ? 1e9 : 0;
  const D = Math.SQRT2, relax = (i, j, wt) => { if (d[j] + wt < d[i]) d[i] = d[j] + wt; };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (edgeOutside && (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)) d[i] = Math.min(d[i], inside[i] ? 1 : 0);
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) { relax(i, i - cols, 1); if (x > 0) relax(i, i - cols - 1, D); if (x < cols - 1) relax(i, i - cols + 1, D); }
  }
  for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
    const i = y * cols + x;
    if (x < cols - 1) relax(i, i + 1, 1);
    if (y < rows - 1) { relax(i, i + cols, 1); if (x < cols - 1) relax(i, i + cols + 1, D); if (x > 0) relax(i, i + cols - 1, D); }
  }
  return d;
}

// A range's ridges, found once and kept on it: each { width, pts: [[lon, lat, depth], ...] }, the
// main ridge first; `width` and each point's `depth` (its distance from the polygon's edge) in
// Mercator units, so times a projection's k they are px.
export function ridgesOf(range, createCanvas) {
  if (range.ridges) return range.ridges;
  const P = range.rings.map((ring) => ring.map(([lon, lat]) => [lon * RAD, -merc(lat)]));
  const e = boxOf(P[0]), X0 = e.x0, Y0 = e.y0, span = Math.max(e.x1 - X0, e.y1 - Y0) || 1e-6;
  const cell = span / GRID, ox = X0 - 2 * cell, oy = Y0 - 2 * cell;
  const cols = Math.ceil((e.x1 - ox) / cell) + 3, rows = Math.ceil((e.y1 - oy) / cell) + 3;
  const c = createCanvas(cols, rows), g = c.getContext('2d');
  g.setTransform(1 / cell, 0, 0, 1 / cell, -ox / cell, -oy / cell);
  g.fillStyle = '#000';
  g.beginPath();
  for (const ring of P) { ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
  g.fill('evenodd');
  const alpha = g.getImageData(0, 0, cols, rows).data, inside = new Uint8Array(cols * rows);
  for (let i = 0; i < inside.length; i++) inside[i] = alpha[i * 4 + 3] > 100 ? 1 : 0;
  const d = chamfer(inside, cols, rows);
  // depth, in cells, at a point in cells, between the four cells round it
  const at = (u, v) => {
    const i = Math.floor(u - 0.5), j = Math.floor(v - 0.5), fu = u - 0.5 - i, fv = v - 0.5 - j;
    const q = (a, b) => (a < 0 || b < 0 || a >= cols || b >= rows ? 0 : d[b * cols + a]);
    return (q(i, j) * (1 - fu) + q(i + 1, j) * fu) * (1 - fv) + (q(i, j + 1) * (1 - fu) + q(i + 1, j + 1) * fu) * fv;
  };
  // each cell's distance, in cells, from the nearest point of a ridge walked so far
  const free = new Float32Array(cols * rows).fill(1e9);
  const claim = (pts) => {
    const taken = new Uint8Array(cols * rows).fill(1);
    for (const [pu, pv] of pts) {
      const i = Math.floor(pu), j = Math.floor(pv);
      if (i >= 0 && j >= 0 && i < cols && j < rows) taken[j * cols + i] = 0;
    }
    const nd = chamfer(taken, cols, rows, false);
    for (let i = 0; i < free.length; i++) free[i] = Math.min(free[i], nd[i]);
  };
  const freeAt = (u, v) => {
    const i = Math.floor(u), j = Math.floor(v);
    return i < 0 || j < 0 || i >= cols || j >= rows ? 1e9 : free[j * cols + i];
  };
  const ridges = [];
  const seeds = [...d.keys()].filter((i) => d[i] >= 1).sort((a, b) => d[b] - d[a] || a - b);
  for (const s of seeds) {
    if (ridges.length >= MAX_RIDGES) break;
    const v0 = d[s], u = (s % cols) + 0.5, v = Math.floor(s / cols) + 0.5;
    const clear = Math.max(3, 1.6 * v0);
    if (freeAt(u, v) < clear) continue;
    // the ridge runs where the ground stays deepest
    let dir = 0, deepest = -1;
    const r = Math.max(2, v0 * 2);
    for (let a = 0; a < 16; a++) {
      const t = (a * Math.PI) / 16, sum = at(u + Math.cos(t) * r, v + Math.sin(t) * r) + at(u - Math.cos(t) * r, v - Math.sin(t) * r);
      if (sum > deepest + 0.01) [dir, deepest] = [t, sum];
    }
    const step = 1.5, stopAt = Math.max(0.75, ridges.length ? v0 * 0.35 : 0.75);
    // a ridge never crosses itself: a walk stops at a cell it (or the walk the other way) passed a few steps back
    const seen = new Map([[Math.floor(v) * cols + Math.floor(u), 0]]);
    let base = 0; // each walk's steps count from its own base, so a cell a walk passed is old by the step count
    const walk = (t) => {
      const pts = [];
      let pu = u, pv = v;
      base += 2 * GRID;
      for (let n = 0; n < 2 * GRID; n++) {
        let next = null;
        for (const turn of [0, -0.3, 0.3, -0.6, 0.6]) {
          const a = t + turn, nu = pu + Math.cos(a) * step, nv = pv + Math.sin(a) * step, dv = at(nu, nv);
          if (!next || dv > next[3] + 0.25) next = [nu, nv, a, dv];
        }
        // a ridge ends at the polygon's edge, or where it meets one already walked
        if (next[3] < stopAt || freeAt(next[0], next[1]) < clear * 0.6) break;
        const ci = Math.floor(next[1]) * cols + Math.floor(next[0]);
        if (seen.has(ci) && base + n - seen.get(ci) > 4) break;
        if (!seen.has(ci)) seen.set(ci, base + n);
        [pu, pv, t] = next;
        pts.push([pu, pv, next[3]]);
      }
      return pts;
    };
    const cells = [...walk(dir + Math.PI).reverse(), [u, v, v0], ...walk(dir)];
    claim(cells);
    ridges.push({
      width: v0 * cell,
      pts: cells.map(([cu, cv, dv]) => [(ox + cu * cell) / RAD, mercLat(-(oy + cv * cell)), dv * cell]),
    });
  }
  range.ridges = ridges;
  return ridges;
}
