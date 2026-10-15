// The atlas's grid sheets as a pure function of the view (docs/atlas/README.md, "Zoom bands" and
// "The fallback grid"). Sheets follow NOAA's reschemed ENC cells: heights of 19.2, 4.8, 1.2, 0.3 and
// 0.075 degrees, sixteen of a band inside one of the band above, widened to 2x in a row wholly past
// 49 12' and 4x in a row wholly past 69 12' (north and south) from the coastal band down. Unlike NOAA's,
// every band counts its edges out from the Catalan Atlas rose, in whole multiples of the cell height
// north and south and of the cell width east and west, so the rose is a corner of a sheet in every band.
// No sheet crosses the date line, and none reaches a pole. Nothing here reads land or draws.

// The Catalan Atlas rose, read off the scan to +-2 degrees (docs/atlas/centres.md): the point the grids
// count from and the origin of the lines drawn at every zoom.
export const ROSE = { lon: -20.7, lat: 42.1 };

// Page window: the doc's 1125 / 2^z degrees of longitude wide, on a 1600 x 1000 page.
const WINDOW_DEG = 1125, ASPECT = 1000 / 1600;

export const BANDS = [
  { band: 1, name: 'overview', from: 6, to: 8, height: 19.2, widens: false },
  { band: 2, name: 'general', from: 8, to: 10, height: 4.8, widens: false },
  { band: 3, name: 'coastal', from: 10, to: 12, height: 1.2, widens: true },
  { band: 4, name: 'approach', from: 12, to: 14, height: 0.3, widens: true },
  { band: 5, name: 'harbour', from: 14, to: 15, height: 0.075, widens: true },
];
export const WIDEN_2X = 49.2; // 49 12'
export const WIDEN_4X = 69.2; // 69 12'
export const NODES = 16;

const EPS = 1e-9;
const RAD = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
const unMercY = (y) => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;
const round = (v) => Math.round(v * 1e9) / 1e9; // edges are n * 0.075 and the like; keep them clean

// The band a zoom falls in. The world band (below 6) returns the overview grid for now; beyond the
// chart's last zoom the harbour band holds.
export function bandFor(zoom) {
  if (zoom < BANDS[0].from) return BANDS[0];
  for (const b of BANDS) if (zoom < b.to) return b;
  return BANDS[BANDS.length - 1];
}

// How many cell heights wide a cell is in the row from `south` to `south + h`. A row widens only when it
// lies wholly past the threshold, north or south (49 12' is not a whole number of rows from the rose).
export function widening(band, south, h) {
  if (!band.widens) return 1;
  const north = south + h;
  const m = south >= 0 ? south : north <= 0 ? -north : 0; // the row's edge nearest the equator
  return m > WIDEN_4X - EPS ? 4 : m > WIDEN_2X - EPS ? 2 : 1;
}

// The window of a view as { west, east, south, north }, or the view's own bounds if it gives them.
export function viewBounds(view) {
  if (view.west != null) return { west: view.west, east: view.east, south: view.south, north: view.north };
  const span = WINDOW_DEG / 2 ** view.zoom;
  const y = mercY(view.lat);
  const half = (span * ASPECT) / 2;
  return {
    west: view.lon - span / 2, east: view.lon + span / 2,
    south: unMercY(y - half), north: unMercY(y + half),
  };
}

const pad = (n, w) => String(n).padStart(w, '0');

// An ENC-style name: PT, the band number, then the cell's south-west corner as a row north or south of
// the rose and a column east or west of it, e.g. PT3N041E0123 (band 3, 41st row north, 123rd column east).
// South and west count outward from 0, so row -1 is S000 and column -1 is W0000; N000E0000 is the cell
// whose south-west corner is the rose.
export function sheetName(band, row, col) {
  const r = row < 0 ? -row - 1 : row, c = col < 0 ? -col - 1 : col;
  return `PT${band.band}${row < 0 ? 'S' : 'N'}${pad(r, Math.max(3, String(Math.ceil(180 / band.height)).length))}${col < 0 ? 'W' : 'E'}${pad(c, 4)}`;
}

// The hidden circle: centre at the cell centre, sixteen nodes at equal bearings from it, round on the
// Mercator page. `radius` is a fraction of the sheet's height, measured in latitude at the centre.
export function hiddenCircle(extent, radius = 0.5) {
  const lon = (extent.west + extent.east) / 2;
  const lat = unMercY((mercY(extent.south) + mercY(extent.north)) / 2);
  const r = radius * (extent.north - extent.south); // degrees of latitude at the centre
  const R = r / Math.cos(lat * RAD); // the same length on the page, in degrees of longitude
  const cy = mercY(lat);
  const nodes = [];
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES; // bearing from north, clockwise
    nodes.push({ lon: lon + R * Math.sin(b), lat: unMercY(cy + R * Math.cos(b)) });
  }
  return { lon, lat, radius, nodes };
}

// The curated sheets (docs/atlas/README.md, "The curated sheets"): extents from that table, circles from
// the readings in centres.md (centre, and radius in degrees of a great circle). `bands` are the atlas bands
// a sheet serves, 0 for the world band. The Carta Marina has no ring and de la Cosa's is in pixels, so both
// take the overview grid's rule, 0.4 of a sheet height (7.68 degrees).
const RULE = 0.4 * BANDS[0].height;
// A curated chart's own figures (docs/atlas/ornaments.md), as { kind, sprite, lon, lat }: `sprite` names the
// pack sprite cropped from that figure, or null where none is cropped yet and the scene stands in one of the
// sheet's `style`, the pack family its crops belong to. An
// empty set is a chart that draws none; a sheet with no set has not been read, and keeps the seeded figures.
const figures = (sets) => Object.entries(sets).flatMap(([kind, list]) => list.map(([sprite, lon, lat]) => ({ kind, sprite, lon, lat })));
const CARTA_MARINA = figures({
  rose: [[null, -10.5, 65.8], [null, -4.7, 60.7], [null, 7.8, 58.3], [null, 20.6, 62.4]],
  monster: [['serpent-a', -5.5, 66.2], ['whale-b', -8.2, 69.0], ['cete-e', -8.4, 67.5], ['pistrix-c', -13.6, 59.7], [null, -9.5, 57.6], [null, -12.7, 58.5], [null, -4.5, 62.5], [null, -9.3, 64.7], [null, -3.1, 64.5], [null, -7.1, 56.3], [null, 8.9, 60.0]],
  ship: [['ship-a', -11.5, 64.5], ['ship-b', -5.9, 67.9], [null, -19.6, 60.6], [null, -17.5, 61.3], [null, -14.1, 62.8], [null, -12.5, 60.5], [null, -20.1, 62.0], [null, -14.5, 64.0], [null, 8.7, 55.1], [null, 19.5, 58.8], [null, 20.1, 57.0], [null, 17.4, 56.0]],
});
const CATALAN = figures({ rose: [['rose-catalan', -20.7, 42.1]], ship: [[null, -15.5, 26.1]] });
export const CURATED = [
  { name: 'Mediterranean, west', source: 'Carte Pisane, western circle', bands: [0, 1], extent: { west: -10, east: 20, south: 30, north: 48 }, lon: 7.4, lat: 40.0, radius: 8.0, ornaments: [] },
  { name: 'Mediterranean, east', source: 'Carte Pisane, eastern circle', bands: [0, 1], extent: { west: 15, east: 42, south: 30, north: 48 }, lon: 27.4, lat: 36.8, radius: 7.5, ornaments: [] },
  { name: 'Levant and Black Sea', source: 'Vesconte, 1311', bands: [1], extent: { west: 20, east: 42, south: 30, north: 48 }, lon: 25.2, lat: 37.5, radius: 3, ornaments: [] },
  { name: 'Europe and the Mediterranean', source: 'Dulcert, 1339', bands: [0, 1], extent: { west: -25, east: 42, south: 28, north: 60 }, lon: 14.5, lat: 40.0, radius: 17, ornaments: [] },
  { name: 'The known world of 1375', source: 'Catalan Atlas', bands: [0], extent: { west: -25, east: 120, south: 10, north: 60 }, lon: -5.4, lat: 42.3, radius: 16, ornaments: CATALAN, style: 'catalan' },
  { name: 'Scandinavia and the Baltic', source: 'Carta Marina, 1539', bands: [1], extent: { west: -25, east: 45, south: 53, north: 72 }, lon: 19.7, lat: 61.7, radius: RULE, ornaments: CARTA_MARINA, style: 'carta-marina' },
  { name: 'The Atlantic and the Americas', source: 'Juan de la Cosa, 1500', bands: [0], extent: { west: -100, east: 20, south: -20, north: 65 }, lon: -45, lat: 23.4, radius: RULE },
].map((c) => ({ ...c, area: (c.extent.east - c.extent.west) * (c.extent.north - c.extent.south) }));
// the Carte Pisane's two sheets share their overlap; every other overlap goes to the smaller sheet
const PISANE = new Set(['Mediterranean, west', 'Mediterranean, east']);
const within = (e, lon, lat) => lon >= e.west && lon <= e.east && lat >= e.south && lat <= e.north;
const overlaps = (a, b) => a.west < b.east && b.west < a.east && a.south < b.north && b.south < a.north;
export const inShadow = (sheet, lon, lat) => !!sheet.shadow?.some((e) => within(e, lon, lat));

// A sheet's territory, in windows: its extent less the smaller curated sheets over it, on the Mercator page,
// over the page window at zoom `from` (1125 / 2^from degrees across, 1000 / 1600 as tall). It is a property of
// the sheet and its shadow, so it is the same from any view  (#147).
export function territory(sheet, from) {
  const e = sheet.extent, y0 = mercY(e.south), y1 = mercY(e.north);
  const cuts = (sheet.shadow ?? []).filter((o) => overlaps(o, e)).map((o) => ({ x0: Math.max(o.west, e.west), x1: Math.min(o.east, e.east), y0: Math.max(mercY(o.south), y0), y1: Math.min(mercY(o.north), y1) }));
  // the extent's area less the union of the cuts, by the strips between their x edges
  const xs = [...new Set([e.west, e.east, ...cuts.flatMap((c) => [c.x0, c.x1])])].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const mid = (xs[i - 1] + xs[i]) / 2, spans = cuts.filter((c) => c.x0 <= mid && mid <= c.x1).sort((a, b) => a.y0 - b.y0);
    let covered = 0, top = y0;
    for (const c of spans) { const lo = Math.max(c.y0, top); if (c.y1 > lo) { covered += c.y1 - lo; top = c.y1; } }
    area += (xs[i] - xs[i - 1]) * (y1 - y0 - covered);
  }
  const width = WINDOW_DEG / 2 ** from;
  return area / (width * width * ASPECT);
}

// The part of segment a-b, as [t0, t1] along it, inside rectangle r (Liang-Barsky), or null.
function across(ax, ay, bx, by, r) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - r.x0], [dx, r.x1 - ax], [-dy, ay - r.y0], [dy, r.y1 - ay]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t1 > t0 ? [t0, t1] : null;
}

// A line [[lon, lat], ...] with what lies inside any of `extents` cut out: the runs left, each a line. The
// cut is made on the Mercator page, where a rhumb line's segments are straight, so a run ends on the edge.
const PAGE_LAT = 89.9; // a line may run to a pole, which has no Mercator y
export function cutOut(line, extents) {
  if (!extents?.length) return [line];
  const yOf = (lat) => mercY(Math.max(-PAGE_LAT, Math.min(PAGE_LAT, lat)));
  const rects = extents.map((e) => ({ x0: e.west, x1: e.east, y0: yOf(e.south), y1: yOf(e.north) }));
  const runs = [];
  let run = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], ay = yOf(a[1]), by = yOf(b[1]);
    const at = (t) => (t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, unMercY(ay + (by - ay) * t)]);
    const hidden = rects.map((r) => across(a[0], ay, b[0], by, r)).filter(Boolean).sort((p, q) => p[0] - q[0]);
    // what the hidden spans leave of the segment
    const kept = [];
    let s = 0;
    for (const [h0, h1] of hidden) { if (h0 > s) kept.push([s, h0]); s = Math.max(s, h1); }
    if (s < 1) kept.push([s, 1]);
    for (const [k0, k1] of kept) {
      if (k0 > 0 || !run) { if (run) runs.push(run); run = [at(k0)]; }
      run.push(at(k1));
      if (k1 < 1) { runs.push(run); run = null; }
    }
  }
  if (run) runs.push(run);
  return runs;
}

function curatedCircle(c) {
  const cy = mercY(c.lat), R = c.radius / Math.cos(c.lat * RAD), nodes = [];
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES;
    nodes.push({ lon: c.lon + R * Math.sin(b), lat: unMercY(cy + R * Math.cos(b)) });
  }
  return { lon: c.lon, lat: c.lat, radius: c.radius / (c.extent.north - c.extent.south), nodes };
}

// Widths, in windows, a curated sheet is seen at in the world band; narrower or wider, it contributes nothing to the view.
const WORLD_SEEN = { min: 0.25, max: 4 };

// The curated sheets the band serves that the view overlaps, each with `shadow`: the extents of the smaller
// curated sheets over it, where its network is not drawn.
function curatedFor(world, band, b, zoom) {
  // in the world band a sheet is seen only where its width is a quarter to four windows of the view's zoom
  const windows = (c) => (c.extent.east - c.extent.west) / (1125 / 2 ** zoom);
  const seen = (c) => !world || (windows(c) >= WORLD_SEEN.min && windows(c) <= WORLD_SEEN.max);
  const serving = CURATED.filter((c) => c.bands.includes(world ? 0 : band.band) && seen(c));
  return serving.filter((c) => overlaps(c.extent, b)).map((c) => ({
    name: c.name, source: c.source, curated: true, band: band.band, bandName: band.name, extent: c.extent,
    circle: curatedCircle(c),
    ...(c.ornaments && { ornaments: c.ornaments, style: c.style }),
    shadow: serving.filter((o) => o.area < c.area && !(PISANE.has(c.name) && PISANE.has(o.name)) && overlaps(o.extent, c.extent)).map((o) => o.extent),
  }));
}

// Every grid sheet the view overlaps: [{ name, band, bandName, row, col, extent, circle }].
// With `curated`, the world and overview bands take the curated sheets, and a grid cell whose centre lies in
// one is left out; the world band (below zoom 6) is the curated sheets alone.
export function sheetsFor(view, { radius = 0.5, curated = false } = {}) {
  const band = bandFor(view.zoom);
  const h = band.height;
  const b = viewBounds(view);
  const world = view.zoom < BANDS[0].from;
  const all = { west: -180, east: 180, south: -90, north: 90 };
  const everywhere = curated && band.band === 1 ? curatedFor(world, band, all, view.zoom) : [];
  const cur = everywhere.filter((c) => overlaps(c.extent, b));
  if (curated && world) return cur;
  const held = (extent) => everywhere.some((c) => within(c.extent, (extent.west + extent.east) / 2, (extent.south + extent.north) / 2));
  // Whole rows out from the rose that stop short of both poles: a row touching a pole has no Mercator
  // centre, so it is left out like the caps beyond the last.
  const rowLo = Math.floor((-90 - ROSE.lat) / h + EPS) + 1, rowHi = Math.ceil((90 - ROSE.lat) / h - EPS) - 1; // rows rowLo to rowHi - 1
  const south = Math.max(Math.floor((b.south - ROSE.lat) / h + EPS), rowLo);
  const north = Math.min(Math.ceil((b.north - ROSE.lat) / h - EPS), rowHi);
  const out = [];
  for (let row = south; row < north; row++) {
    const s = round(ROSE.lat + row * h);
    const w = h * widening(band, s, h);
    // The window may run past the date line; the sheets stay inside it, and the column the line falls in ends
    // there, so a narrower sheet closes each row at 180 and at -180.
    const c0 = Math.floor((Math.max(b.west, -180) - ROSE.lon) / w + EPS);
    const c1 = Math.ceil((Math.min(b.east, 180) - ROSE.lon) / w - EPS);
    for (let col = c0; col < c1; col++) {
      const extent = { west: Math.max(-180, round(ROSE.lon + col * w)), east: Math.min(180, round(ROSE.lon + (col + 1) * w)), south: s, north: round(s + h) };
      if (held(extent)) continue;
      out.push({
        name: sheetName(band, row, col), band: band.band, bandName: band.name, row, col, extent,
        circle: hiddenCircle(extent, radius),
      });
    }
  }
  return [...cur, ...out];
}
