// The urban footprint each chart town draws as a city plan at close zoom (scene.mjs): Natural
// Earth's 10m urban polygons, which carry no names, joined to the populated places. A metro is
// often split into many pieces, so a place takes every polygon whose vertex centroid lies in its
// LandScan metro box (MAX_BB*, padded) or that holds the place; a polygon two places claim goes
// to the nearer. Rings are simplified (Douglas-Peucker) and rounded, so the file stays small.

// The key a place is joined by: its name and its point rounded, since names repeat (two Portlands).
export const urbanKey = (name, lon, lat) => `${name}|${lon.toFixed(2)}|${lat.toFixed(2)}`;

// Douglas-Peucker on an open run of [lon, lat], `tol` degrees.
function simplifyRun(pts, tol) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let far = -1, dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len ? Math.abs(dy * (px - ax) - dx * (py - ay)) / len : Math.hypot(px - ax, py - ay);
      if (d > dmax) { dmax = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// A closed ring simplified and rounded to 4 decimals, split at its farthest point so both halves
// keep their shape; null when it collapses below a triangle.
export function simplifyRing(ring, tol = 0.0008) {
  const open = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  if (open.length < 3) return null;
  let far = 0, dmax = -1;
  for (let i = 1; i < open.length; i++) { const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]); if (d > dmax) { dmax = d; far = i; } }
  const pts = [...simplifyRun(open.slice(0, far + 1), tol).slice(0, -1), ...simplifyRun([...open.slice(far), open[0]], tol).slice(0, -1)]
    .map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
  return pts.length >= 3 ? pts : null;
}

const inRing = (ring, x, y) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < xj + ((y - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside;
};

// { [urbanKey]: rings } for every place of scalerank `maxRank` or less: `places` and `urban` are
// GeoJSON feature collections (Natural Earth populated places and urban areas); `pad` widens each
// metro box, degrees. A polygon's holes are kept as rings of their own, for an even-odd fill.
export function joinUrban(places, urban, { maxRank = 4, pad = 0.03, tol = 0.0008 } = {}) {
  const ps = places.features.filter((f) => f.properties.SCALERANK <= maxRank).map((f) => {
    const p = f.properties, [lon, lat] = f.geometry.coordinates;
    const box = p.MAX_BBXMIN || p.MAX_BBXMAX ? [p.MAX_BBXMIN - pad, p.MAX_BBYMIN - pad, p.MAX_BBXMAX + pad, p.MAX_BBYMAX + pad] : null;
    return { key: urbanKey(p.NAME, lon, lat), lon, lat, box };
  });
  const out = {};
  for (const f of urban.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    for (const poly of polys) {
      const outer = poly[0];
      let cx = 0, cy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of outer) { cx += x; cy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      cx /= outer.length; cy /= outer.length;
      const claim = ps.filter((p) => (p.box && cx >= p.box[0] && cx <= p.box[2] && cy >= p.box[1] && cy <= p.box[3]) ||
        (p.lon >= x0 && p.lon <= x1 && p.lat >= y0 && p.lat <= y1 && inRing(outer, p.lon, p.lat)));
      if (!claim.length) continue;
      const k = Math.cos(cy * Math.PI / 180);
      const owner = claim.reduce((a, b) => (Math.hypot((b.lon - cx) * k, b.lat - cy) < Math.hypot((a.lon - cx) * k, a.lat - cy) ? b : a));
      const rings = poly.map((r) => simplifyRing(r, tol)).filter(Boolean);
      if (rings.length) (out[owner.key] ??= []).push(...rings);
    }
  }
  return out;
}
