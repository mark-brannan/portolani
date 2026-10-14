// Names a chart letters, from Natural Earth: seas, gulfs and bays at a point well inside their
// water, and each country along its own coast, land side marked so the name reads from the sea.
// Run once per build (scripts/build-preview.mjs) or per process (render, golden test); the scene
// reads both sets, joined, as geo/names-50m.json. The golden test reads its seas from
// test/fixtures/sea-names-50m.json, seaNames() of the download, so it runs offline.
//
// Out: GeoJSON features, properties { name, kind: 'sea' | 'coast', rank, min, land? }: `rank` lower
// is more important, `min` the Natural Earth zoom from which the name is worth showing.

const round = (v) => Math.round(v * 1000) / 1000;
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);

function insideRings(rings, lon, lat) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < xj + ((lat - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside;
}

// Squared distance from a point to the nearest edge, longitude shrunk by cos(lat).
function edgeDist(rings, lon, lat) {
  const c = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const ring of rings) for (let i = 1; i < ring.length; i++) {
    const ax = ring[i - 1][0] * c, ay = ring[i - 1][1], bx = ring[i][0] * c, by = ring[i][1], px = lon * c;
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (lat - ay) * vy) / l2));
    const dx = px - ax - t * vx, dy = lat - ay - t * vy;
    best = Math.min(best, dx * dx + dy * dy);
  }
  return best;
}

// The grid point inside the largest part farthest from its edges: where a sea's name has room.
function labelPoint(geometry) {
  const parts = polysOf(geometry);
  const area = (ring) => Math.abs(ring.reduce((s, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return s + x * y2 - x2 * y; }, 0));
  const rings = parts.reduce((a, b) => (area(b[0]) > area(a[0]) ? b : a));
  const xs = rings[0].map((p) => p[0]), ys = rings[0].map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const N = 16, step = Math.ceil(rings.reduce((n, r) => n + r.length, 0) / 300);
  const coarse = rings.map((r) => r.filter((_, i) => i % step === 0)); // edges sampled, for speed
  let best = null;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const lon = x0 + ((x1 - x0) * (i + 0.5)) / (N + 1), lat = y0 + ((y1 - y0) * (j + 0.5)) / (N + 1);
    if (!insideRings(coarse, lon, lat)) continue;
    const d = edgeDist(coarse, lon, lat);
    if (!best || d > best.d) best = { lon, lat, d };
  }
  return best && [round(best.lon), round(best.lat)];
}

const SEA_KINDS = new Set(['sea', 'gulf', 'bay', 'ocean', 'strait', 'sound', 'channel', 'lagoon', 'fjord', 'inlet', 'reef']);

// Natural Earth sets a few names in capitals (INDIAN OCEAN); letter them like the rest.
const titled = (name) => (name === name.toUpperCase() ? name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()) : name);

// Seas, gulfs and bays from Natural Earth's marine polygons, each at its label point.
export function seaNames(marine) {
  const out = [];
  for (const f of marine.features) {
    const p = f.properties;
    if (!p.name || !SEA_KINDS.has(String(p.featurecla).toLowerCase())) continue;
    const at = labelPoint(f.geometry);
    if (at) out.push({ type: 'Feature', properties: { name: titled(p.name), kind: 'sea', rank: p.scalerank, min: p.min_label }, geometry: { type: 'Point', coordinates: at } });
  }
  return { type: 'FeatureCollection', features: out };
}

// The Red Sea for the chart's red tint: Natural Earth's marine polygon, which stops at 28.13 N and
// leaves out the Gulf of Suez and the Gulf of Aqaba (and is generalised, so it also leaves gaps off
// Sinai), plus one box over the northern end. The polygons are drawn under the land, which hides
// whatever of them lies on shore, so the box only needs to cover the water. Rounded to 3 decimals.
const GULFS = [
  { name: 'Gulfs of Suez and Aqaba', ring: [[32.2, 27], [35.4, 27], [35.4, 30.1], [32.2, 30.1], [32.2, 27]] },
];
export function redSea(marine) {
  const red = marine.features.find((f) => f.properties.name === 'Red Sea');
  if (!red) throw new Error('no Red Sea in the marine polygons');
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const features = [{ name: 'Red Sea', rings: red.geometry.coordinates }, ...GULFS.map((g) => ({ name: g.name, rings: [g.ring] }))]
    .map(({ name, rings }) => ({ type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: rings.map((r) => r.map(([x, y]) => [r3(x), r3(y)])) } }));
  return { type: 'FeatureCollection', features };
}

// Each country along every stretch of its coast: the runs of its outline that the coastline
// shares, vertex for vertex.
export function coastNames(countries, coastline) {
  const out = [];
  const key = ([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`;
  const shore = new Set();
  for (const f of coastline.features) for (const line of linesOf(f.geometry)) for (const p of line) shore.add(key(p));
  for (const f of countries.features) {
    const p = f.properties;
    for (const poly of polysOf(f.geometry)) {
      const ring = poly[0].slice(0, -1);
      // signed area > 0: anticlockwise, the land on the left of the walk
      const signed = ring.reduce((s, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return s + x * y2 - x2 * y; }, 0);
      const land = signed > 0 ? 'left' : 'right';
      // start the walk at an inland vertex so a stretch is not cut where the ring closes
      const start = Math.max(0, ring.findIndex((q) => !shore.has(key(q))));
      const runs = [];
      let run = [];
      for (let i = 0; i <= ring.length; i++) {
        const q = ring[(start + i) % ring.length];
        if (shore.has(key(q))) run.push(q); else { if (run.length) runs.push(run); run = []; }
      }
      if (run.length) runs.push(run);
      for (const r of runs) {
        // thinned to a point every 0.1 degrees: lettering follows the coast's run, not its detail
        const thin = [r[0]];
        let len = 0;
        for (const q of r.slice(1)) {
          const l = thin[thin.length - 1], d = Math.hypot(q[0] - l[0], q[1] - l[1]);
          if (d >= 0.1) { thin.push(q); len += d; }
        }
        if (len < 0.5 || thin.length < 3) continue;
        out.push({
          type: 'Feature',
          properties: { name: p.NAME, kind: 'coast', rank: p.LABELRANK, min: p.MIN_LABEL, land },
          geometry: { type: 'LineString', coordinates: thin.map(([lon, lat]) => [round(lon), round(lat)]) },
        });
      }
    }
  }
  // most important country first, its longest stretch first (points are evenly spaced)
  out.sort((a, b) => a.properties.rank - b.properties.rank || b.geometry.coordinates.length - a.geometry.coordinates.length);
  return { type: 'FeatureCollection', features: out };
}

export const joinNames = (...sets) => ({ type: 'FeatureCollection', features: sets.flatMap((s) => s.features) });
