// Rivers and lakes after the period charts, drawn by hand through coast-wright: in pixels after
// projection, so a wiggle or a hatch stays one pen wide at every zoom and a glyph fits the water as
// the reader sees it. Each style table maps a menu option to a function drawing it,
// (g, data, features): `data` is { proj, palette } (the view's projection, and the scene's ink,
// pigments and seedOf, so a lake keeps its colour across views); `features` are what waterOf made,
// already cut to the view. 'off' maps to null. A later ground layer (mountains, forests) follows the
// same shape: a table of styles, a loader, and a pick by zoom.

import { fill, limn, runs, pen, simplify, meander, footprint, lozenge, hatch, geojsonRings, geojsonPolygons } from 'coast-wright';

const RIVER_INK = '#26355a'; // blue-black, as the Aguiar rivers are drawn
const RIVER_BLUE = '#2f5f8f', RIVER_DARK_BLUE = '#14284f'; // the plain line's blue; the Carta Marina pair's dark blue
const LAKE_BLUE = '#7fa3b8', HATCH_BLUE = '#2e5a7a', LAKE_GREY = '#8fa3a8';
const LOZENGE_PX = 120; // a lake whose footprint is shorter than this is drawn as a lozenge (Aguiar)
const LAKE_MIN_PX = 8; // and one shorter than this is too small to draw as one at this zoom

// Whether a river or lake is worth drawing at a zoom: Natural Earth's own min_zoom, counted in
// 256 px tiles, one zoom behind the scene's 512 px ones. The greatest show from far out, every 50m
// one from zoom 4, so a world view is not a hairball; the 10m ones, drawn only past WATER_ZOOM (z7),
// all carry a min_zoom of 7.2 or less, so a view past z7 draws every one, the view's few cells' worth.
export const shown = (feature, zoom) => feature.minZoom <= zoom + 1;

// Rivers and lakes from Natural Earth GeoJSON, each with its lon/lat box for the view to cut by and
// the feature's `id`, by which a feature fetched from several 10m cells is kept once (cutWater).
export function waterOf(riversGeo, lakesGeo) {
  const box = (pts) => {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const [x, y] of pts) { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
    return b;
  };
  // a lake without a name is keyed by where it is, so it too keeps its colour
  const keyOf = (p, ring) => p.name || `${ring[0][0].toFixed(2)},${ring[0][1].toFixed(2)}`;
  const rivers = (riversGeo?.features ?? []).map((f) => {
    const rings = geojsonRings(f.geometry);
    // a lake's centreline is the water a lake drawn over it stands for
    return { id: f.id, rings, box: box(rings.flat()), minZoom: f.properties.min_zoom, inLake: f.properties.featurecla === 'Lake Centerline', key: keyOf(f.properties, rings[0]) };
  });
  const lakes = (lakesGeo?.features ?? []).map((f) => {
    const polys = geojsonPolygons(f.geometry);
    return { id: f.id, polys, box: box(polys.flatMap((p) => p[0])), minZoom: f.properties.min_zoom, key: keyOf(f.properties, polys[0][0]) };
  });
  return { rivers, lakes };
}

// Each feature's rings as pixel runs, simplified to `tolerance` px, with a phase of its own so
// neighbouring rivers do not wiggle in step.
function pixelRuns(data, features, tolerance) {
  const { x, y, seam } = data.proj;
  return features.flatMap((f) => runs(f.rings, x, y, { ...seam })
    .filter((run) => run.length > 1)
    .map((run, i) => ({ run: simplify(run, tolerance), phase: (data.palette.seedOf(f.key) >>> 0) % 628 / 100 + i })));
}
function stroke(g, lines, color, width) {
  g.save();
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pen(g, lines); g.stroke();
  g.restore();
}
// A run moved `d` px to its left, each vertex along the mean of its two segments' normals.
function offset(run, d) {
  const normal = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
  return run.map((p, i) => {
    const n0 = normal(run[Math.max(0, i - 1)], run[Math.max(1, i)]), n1 = normal(run[Math.min(run.length - 2, i)], run[Math.min(run.length - 1, i + 1)]);
    const nx = n0[0] + n1[0], ny = n0[1] + n1[1], l = Math.hypot(nx, ny) || 1;
    // the mitre: a bend's offset reaches further so the two lines keep their gap, up to twice it
    const m = Math.min(2, 1 / Math.max(0.5, (nx * n1[0] + ny * n1[1]) / l));
    return [p[0] + (nx / l) * d * m, p[1] + (ny / l) * d * m];
  });
}

export const RIVERS = {
  off: null,
  // Aguiar, 1492: one blue-black line wiggling the whole way, the bends of the data simplified away first
  aguiar: (g, data, features) => stroke(g, pixelRuns(data, features, 8).map(({ run, phase }) =>
    meander(run, { amplitude: 3, wavelength: 26, phase })), RIVER_INK, 2.4),
  // Carta Marina, 1539: two thin parallel lines in dark blue, the river between them
  marina: (g, data, features) => stroke(g, pixelRuns(data, features, 2).flatMap(({ run }) =>
    [offset(run, 1.25), offset(run, -1.25)]), RIVER_DARK_BLUE, 0.9),
  plain: (g, data, features) => stroke(g, pixelRuns(data, features, 1).map(({ run }) => run), RIVER_BLUE, 1.4),
};

// True shapes, washed, hatched if asked, and edged.
function trueLakes(g, data, polys, { wash, alpha, hatching, edge }) {
  if (!polys.length) return;
  const { x, y, seam } = data.proj;
  fill(g, polys, x, y, { color: wash, alpha, ...seam });
  if (hatching) hatch(g, polys, x, y, { ...hatching, ...seam });
  limn(g, polys.flat(), x, y, { color: edge, alpha: 1, width: 1.2, oneStroke: true, ...seam });
}
const BLUE_HATCHED = { wash: LAKE_BLUE, alpha: 0.6, hatching: { angle: Math.PI / 2, gap: 9, wavelength: 22, amplitude: 2, color: HATCH_BLUE, width: 1.2 }, edge: RIVER_INK };

// Aguiar's comb: two short wavy tributaries rising off the north side of a lozenge.
function spurs({ cx, cy, angle, length, width }) {
  const a = length / 2, b = width / 2, k = (a * a - b * b) / (2 * b);
  const ux = Math.cos(angle), uy = Math.sin(angle);
  let [vx, vy] = [-uy, ux];
  if (vy > 0) [vx, vy] = [-vx, -vy]; // up the page
  return [-0.3, 0.3].map((t) => {
    const along = t * length, across = Math.sqrt((b + k) ** 2 - along ** 2) - k;
    const sx = cx + ux * along + vx * across, sy = cy + uy * along + vy * across;
    return meander([[sx, sy], [sx + vx * 40, sy + vy * 40]], { amplitude: 2.2, wavelength: 16, phase: along });
  });
}

export const LAKES = {
  off: null,
  // Aguiar, 1492: a small lake is a lozenge washed red, rose or green, with a comb of tributaries
  // above it; a great one keeps its shape, washed blue and hatched with waves
  aguiar: (g, data, features) => {
    const { x, y, seam } = data.proj, { pigments, seedOf } = data.palette;
    const great = [], small = [];
    for (const f of features) {
      for (const poly of f.polys) {
        const [ring] = runs([poly[0]], x, y, { ...seam });
        if (!ring || ring.length < 3) continue;
        const box = footprint(ring);
        if (box.length >= LOZENGE_PX) great.push(poly);
        else if (box.length >= LAKE_MIN_PX) {
          const length = Math.max(box.length * 1.15, 34);
          small.push({ fit: { ...box, length, width: Math.max(length * 0.42, box.width) }, wash: pigments[(seedOf(f.key) >>> 0) % pigments.length] });
        }
      }
    }
    trueLakes(g, data, great, BLUE_HATCHED);
    if (!small.length) return;
    stroke(g, small.flatMap((s) => spurs(s.fit)), RIVER_INK, 2);
    g.save();
    g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = RIVER_INK;
    for (const { fit, wash } of small) {
      g.beginPath(); pen(g, [lozenge(fit)], { close: true });
      g.globalAlpha = 0.85; g.fillStyle = wash; g.fill();
      g.globalAlpha = 1; g.stroke();
    }
    g.restore();
  },
  // Carta Marina, 1539: true shapes, grey-blue, ruled across with broken lines
  marina: (g, data, features) => trueLakes(g, data, features.flatMap((f) => f.polys), {
    wash: LAKE_GREY, alpha: 0.85, hatching: { angle: 0, gap: 4, dash: [6, 4], color: data.palette.ink, width: 0.8, alpha: 0.7 }, edge: data.palette.ink }),
  plain: (g, data, features) => trueLakes(g, data, features.flatMap((f) => f.polys), { wash: LAKE_BLUE, alpha: 0.6, edge: RIVER_INK }),
};

export const RIVER_STYLES = Object.keys(RIVERS);
export const LAKE_STYLES = Object.keys(LAKES);
