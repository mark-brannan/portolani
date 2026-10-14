// Cuts Natural Earth 10m land and coast into square lon/lat cells, so a close view fetches only the
// few cells around it rather than the whole 10m world. Land polygons are clipped to each cell (fill
// is even-odd, so the cut edges vanish; each cell's `m` holds, for its land polygons in order, the
// area in km2 and colour of the island each is a piece of, worked out before the cut); coast lines are split where they pass from one cell to the
// next, each piece keeping the shared point so the line stays joined. Coordinates are rounded to
// `digits` decimals (5 is about a metre). Cell keys are `${xi}_${yi}`, xi = floor(lon / size).

import { islandInfo } from './island.mjs';

const key = (xi, yi) => `${xi}_${yi}`;

// Sutherland-Hodgman against one axis-aligned half-plane: keep points with p[axis] <= v (keep < 0)
// or >= v (keep > 0). `ring` is open (last point not repeated).
function clipHalf(ring, axis, v, keep) {
  const out = [], inside = (p) => (keep < 0 ? p[axis] <= v : p[axis] >= v);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (v - a[axis]) / (b[axis] - a[axis]);
      const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      p[axis] = v;
      out.push(p);
    }
  }
  return out;
}

function ringBox(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

// Polygons ([[outer, ...holes]], open rings) into cells by recursive halving along cell lines, so
// each point is clipped about log2(cells) times rather than once per cell.
function splitPolygons(polys, box, size, emit) {
  if (!polys.length) return;
  const [x0, y0, x1, y1] = box, nx = Math.round((x1 - x0) / size), ny = Math.round((y1 - y0) / size);
  if (nx <= 1 && ny <= 1) { emit(Math.round(x0 / size), Math.round(y0 / size), polys); return; }
  const axis = nx >= ny ? 0 : 1, mid = axis === 0 ? x0 + Math.floor(nx / 2) * size : y0 + Math.floor(ny / 2) * size;
  const lo = [], hi = [];
  for (const poly of polys) {
    const b = ringBox(poly[0]);
    if (b[axis + 2] <= mid) { lo.push(poly); continue; }
    if (b[axis] >= mid) { hi.push(poly); continue; }
    for (const [side, keep] of [[lo, -1], [hi, 1]]) {
      const [outer, ...holes] = poly.map((r) => clipHalf(r, axis, mid, keep));
      if (outer.length >= 3) side.push(Object.assign([outer, ...holes.filter((r) => r.length >= 3)], { isl: poly.isl }));
    }
  }
  const loBox = axis === 0 ? [x0, y0, mid, y1] : [x0, y0, x1, mid], hiBox = axis === 0 ? [mid, y0, x1, y1] : [x0, mid, x1, y1];
  splitPolygons(lo, loBox, size, emit);
  splitPolygons(hi, hiBox, size, emit);
}

// `land`: GeoJSON polygons as [[outer, ...holes]] of closed [lon, lat] rings; `coast`: lines of
// [lon, lat]. Returns Map(key -> { land, coast }), rings closed again, coordinates rounded.
export function cutCells({ land, coast }, size = 5, digits = 5) {
  const f = 10 ** digits, round = (p) => [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
  const tidy = (pts) => pts.map(round).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  const cells = new Map(), cell = (k) => cells.get(k) ?? cells.set(k, { land: [], coast: [], m: [] }).get(k);

  const open = (r) => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r);
  splitPolygons(land.map((poly) => Object.assign(poly.map(open), { isl: islandInfo(poly) })), [-180, -90, 180, 90], size, (xi, yi, polys) => {
    const c = cell(key(xi, yi)), out = c.land;
    for (const poly of polys) {
      const rings = poly.map(tidy).filter((r) => r.length >= 3).map((r) => [...r, r[0]]);
      if (rings.length) { out.push(rings); c.m.push([poly.isl.km2, poly.isl.hue]); }
    }
  });

  // A segment belongs to the cell holding its midpoint; a run of segments in one cell is one piece.
  const cellOf = (a, b) => key(Math.floor((a[0] + b[0]) / 2 / size), Math.floor((a[1] + b[1]) / 2 / size));
  for (const line of coast) {
    let piece = null, at = null;
    for (let i = 0; i < line.length - 1; i++) {
      const k = cellOf(line[i], line[i + 1]);
      if (k !== at) {
        if (piece) cell(at).coast.push(piece);
        piece = [line[i]]; at = k;
      }
      piece.push(line[i + 1]);
    }
    if (piece) cell(at).coast.push(piece);
  }
  for (const c of cells.values()) c.coast = c.coast.map(tidy).filter((l) => l.length > 1);
  return cells;
}
