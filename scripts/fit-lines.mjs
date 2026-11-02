// The line a chart's placement was fitted to, in today's geography (docs/spec/design.md, "A chip shows what it
// was fitted to"): each fit is a least-squares similarity through landmarks read off the scan, each landmark a real
// lon, lat (docs/atlas/ornaments.md), so the feature that fit used is the stretch of today's coast those landmarks
// lie on. build-overlays.mjs works it out once per placement from Natural Earth's 10m land and carries it in
// overlays.json beside the placement (`line` on a snap, and on the chart for its own); the page draws it when the
// placement's chip is clicked. A line is a list of parts, each a list of [lon, lat]; a part of one point is a place
// inland, drawn as a small ring round it.
//
// Each landmark gives:
// - on an island under ISLAND km2 (the Canaries, Corsica, Gotland), or at sea within NEAR km of one: the island's
//   whole coast;
// - within NEAR km of a longer coast (a cape, a river mouth, a port): its place on that coast. The landmarks on one
//   coast give the stretch of it between them, PAD km more at each end (one alone, PAD each way), cut where two
//   neighbours along it lie more than GAP km of coast apart: the coast no landmark is near was not what the fit used;
// - inland on an island under BIG_ISLAND km2 ("Ireland, its middle", Iceland): the island's whole coast;
// - inland anywhere else (Prague, Tabriz, Khanbaliq): the place itself.

import { islandInfo } from './island.mjs';

export const NEAR = 40, PAD = 200, GAP = 4000, ISLAND = 30000, BIG_ISLAND = 250000; // km, km, km, km2, km2
const RAD = Math.PI / 180, R_KM = 6371.0088;

// km between two [lon, lat], equirectangular about their mean latitude: good to well under a percent at these spans
const km = ([x1, y1], [x2, y2]) => {
  const dx = ((((x2 - x1 + 540) % 360) - 180) * Math.cos(((y1 + y2) / 2) * RAD)), dy = y2 - y1;
  return Math.hypot(dx, dy) * RAD * R_KM;
};
const inRing = (ring, [x, y]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const boxOf = (ring) => ring.reduce(([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)], [Infinity, Infinity, -Infinity, -Infinity]);

// The land, indexed once: every polygon [outer, ...holes] of a GeoJSON land file, its area, box and each ring's length
// along it (km from its first point).
export function landIndex(geojson) {
  const polys = geojson.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
  return polys.map((poly) => ({
    poly, km2: islandInfo(poly).km2, box: boxOf(poly[0]),
    rings: poly.map((ring) => { const at = [0]; for (let i = 1; i < ring.length; i++) at.push(at[i - 1] + km(ring[i - 1], ring[i])); return { ring, at, box: boxOf(ring) }; }),
  }));
}

// Where one landmark falls: the polygon it lies in (or null), and the nearest point of any coast to it.
function locate(land, p) {
  const [x, y] = p, within = (b, m) => x >= b[0] - m && x <= b[2] + m && y >= b[1] - m && y <= b[3] + m;
  const home = land.find((l) => within(l.box, 0) && inRing(l.poly[0], p) && !l.poly.slice(1).some((h) => inRing(h, p))) ?? null;
  let best = null;
  for (const margin of [3, 360]) { // the coasts nearby first; the whole world only for a landmark far from any
    for (const l of land) for (const r of l.rings) {
      if (!within(r.box, margin)) continue;
      for (let i = 0; i < r.ring.length; i++) { const d = km(p, r.ring[i]); if (!best || d < best.d) best = { d, l, r, i }; }
    }
    if (best && best.d < margin * 60) break;
  }
  return { home, ...best };
}

// The ring from `s0` to `s1` km along it (going on past its end and round, where s1 < s0), its ends interpolated.
function stretch({ ring, at }, s0, s1) {
  const L = at.at(-1), wrap = (s) => ((s % L) + L) % L, a = wrap(s0), b = wrap(s1);
  const pointAt = (s) => { let i = at.findIndex((v) => v >= s); if (i <= 0) return ring[Math.max(0, i)]; const u = (s - at[i - 1]) / (at[i] - at[i - 1] || 1); return [ring[i - 1][0] + (ring[i][0] - ring[i - 1][0]) * u, ring[i - 1][1] + (ring[i][1] - ring[i - 1][1]) * u]; };
  const out = [pointAt(a)];
  const take = (from, to) => { for (let i = 0; i < ring.length; i++) if (at[i] > from && at[i] < to) out.push(ring[i]); };
  if (a <= b) take(a, b); else { take(a, L); take(-1, b); }
  out.push(pointAt(b));
  return out;
}

// Douglas–Peucker in degrees (0.05°, about 5 km, under a pixel where a chart is framed), then rounded to 0.01°: a
// line to draw at chart scale, not to measure by.
function simplify(line, tol) {
  if (line.length < 3) return line;
  const [x0, y0] = line[0], [xn, yn] = line.at(-1);
  if (x0 === xn && y0 === yn) { // a closed ring: two halves, split at its point furthest from its first
    const far = line.reduce((f, [x, y], k) => (Math.hypot(x - x0, y - y0) > Math.hypot(line[f][0] - x0, line[f][1] - y0) ? k : f), 0);
    if (far > 0) return [...simplify(line.slice(0, far + 1), tol), ...simplify(line.slice(far), tol).slice(1)];
  }
  const keep = new Uint8Array(line.length); keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(), [x1, y1] = line[i], [x2, y2] = line[j], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    let far = -1, fd = tol;
    for (let k = i + 1; k < j; k++) { const d = Math.abs(dy * (line[k][0] - x1) - dx * (line[k][1] - y1)) / L; if (d > fd) { fd = d; far = k; } }
    if (far > 0) { keep[far] = 1; stack.push([i, far], [far, j]); }
  }
  return line.filter((_, k) => keep[k]);
}
const round = (part) => part.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);

// The line one fit was computed from, given its landmarks' real [lon, lat] (in the order read): its parts in the
// order their first landmark comes.
export function fitLine(land, marks, { tol = 0.05 } = {}) {
  const parts = []; // { key, ring?, at?: [km along], place? }
  const add = (key, make) => { let p = parts.find((q) => q.key === key); if (!p) parts.push(p = { key, ...make() }); return p; };
  for (const m of marks) {
    const { home, d, l, r, i } = locate(land, m);
    if (home && home.km2 < ISLAND) add(home.rings[0], () => ({ whole: home.rings[0] }));
    else if (!home && d <= NEAR && l.km2 < ISLAND) add(l.rings[0], () => ({ whole: l.rings[0] }));
    else if (d <= NEAR) add(r, () => ({ ring: r, at: [] })).at?.push(r.at[i]);
    else if (home && home.km2 < BIG_ISLAND) add(home.rings[0], () => ({ whole: home.rings[0] }));
    else parts.push({ key: m, place: m });
  }
  return parts.flatMap((p) => {
    if (p.place) return [round([p.place])];
    if (p.whole) return [round(simplify(p.whole.ring, tol))];
    const L = p.ring.at.at(-1), s = [...new Set(p.at)].sort((a, b) => a - b), n = s.length;
    // the coast between its landmarks, cut wherever two neighbours along it lie more than GAP km apart (and, with no
    // gap that wide, at the widest): a stretch per run of landmarks, never the coast between two runs that no landmark is on
    const gaps = s.map((v, k) => (k < n - 1 ? s[k + 1] - v : L - v + s[0]));
    let cuts = gaps.flatMap((g, k) => (g > GAP ? [k] : []));
    if (!cuts.length) {
      const k = gaps.indexOf(Math.max(...gaps));
      if (gaps[k] <= 2 * PAD) return [round(simplify(p.ring.ring, tol))];
      cuts = [k];
    }
    return cuts.map((c, j) => round(simplify(stretch(p.ring, s[(c + 1) % n] - PAD, s[cuts[(j + 1) % cuts.length]] + PAD), tol)));
  });
}

// Today's parallels across a sheet: each drawn parallel ({ lat, from, to } in scan px, overlays.json `parallels`)
// at its true latitude, from the longitude where the sheet's placement puts its drawn west end to its east end,
// a point a degree so it bends with the projection as a parallel does.
export function parallelLines(parallels, sheet, width, height) {
  const t = -sheet.turn * RAD, lonOf = ([x, y]) => sheet.lon + sheet.scale * ((x - width / 2) * Math.cos(t) + (y - height / 2) * Math.sin(t));
  return parallels.map(({ lat, from, to }) => {
    const a = lonOf(from), b = lonOf(to), n = Math.max(1, Math.ceil(Math.abs(b - a)));
    return round(Array.from({ length: n + 1 }, (_, k) => [a + ((b - a) * k) / n, lat]));
  });
}
