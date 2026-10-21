// The atlas's grid sheets as a pure function of the view (docs/atlas/README.md, "Zoom bands" and
// "The fallback grid"). Sheets follow NOAA's reschemed ENC cells: heights of 19.2, 4.8, 1.2, 0.3 and
// 0.075 degrees, sixteen of a band inside one of the band above, widened to 2x in a row wholly past
// 49 12' and 4x in a row wholly past 69 12' (north and south) from the coastal band down; the ladder runs
// on upward by the same 4x to 76.8 degree cells for zooms 4 to 6. Below zoom 4 the atlas is one sheet, the
// whole earth with one ring, as on a planisphere (#199). Unlike NOAA's,
// every band counts its edges out from one origin, the Catalan Atlas rose by default (ORIGINS; `origin` of
// sheetsFor), in whole multiples of the cell height north and south and of the cell width east and west, so
// the origin is a corner of a sheet in every band.
// No sheet crosses the date line, and a row that would reach a pole ends at the page's edge. Nothing here
// reads land or draws.

// The Catalan Atlas rose, read off the scan to +-2 degrees (docs/atlas/centres.md): the point the grids
// count from and the origin of the lines drawn at every zoom.
export const ROSE = { lon: -20.7, lat: 42.1 };

// The points a grid may count from (`origin` of sheetsFor): the Catalan rose, the default, or 0E 0N, NOAA's own
// zero. Exposed for a while as a knob (docs/atlas/under-the-hood.md).
export const ORIGINS = { rose: ROSE, zero: { lon: 0, lat: 0 } };

// Page window: the doc's 1125 / 2^z degrees of longitude wide, on a 1600 x 1000 page.
const WINDOW_DEG = 1125, ASPECT = 1000 / 1600;

// Band 0 extends NOAA's ladder upward (its cell 4x the one below, the window at its first zoom about 9%
// narrower than the cell), so zooms 4 to 6 have a grid too (#199). Below it is the world band, one sheet.
export const BANDS = [
  { band: 0, name: 'ocean', from: 4, to: 6, height: 76.8, widens: false },
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
// Web Mercator's square: the page ends here, and so does a row that would reach a pole.
export const PAGE_EDGE = 85.0511287798;

// The band a zoom falls in. The world band (below the first band's zoom) returns the first band's grid;
// beyond the chart's last zoom the harbour band holds.
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
// the grid's origin and a column east or west of it, e.g. PT3N041E0123 (band 3, 41st row north, 123rd column east).
// South and west count outward from 0, so row -1 is S000 and column -1 is W0000; N000E0000 is the cell
// whose south-west corner is the origin.
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
// a sheet serves: those in which its extent is one to four windows wide at the band's first zoom. `world`
// marks the sheets the first band takes instead, by their width at the view's zoom (keptIn). The world
// band, below the first band, takes none: it is one sheet (WORLD_SHEET). The Carta Marina has no ring
// and de la Cosa's is in pixels, so both take the overview grid's rule, 0.4 of a sheet height (7.68 degrees).
const RULE = 0.4 * BANDS.find((b) => b.band === 1).height;
const servedBands = (extent) => BANDS.filter((b) => { const w = (extent.east - extent.west) / (WINDOW_DEG / 2 ** b.from); return w >= 1 - EPS && w <= 4 + EPS; }).map((b) => b.band);
// A curated chart's own figures (docs/atlas/ornaments.md), as { kind, sprite, lon, lat }: `sprite` names the
// pack sprite cropped from that figure, or null where none is cropped yet and the scene stands in one of the
// sheet's `style`, the pack family its crops belong to. An
// empty set is a chart that draws none; a sheet with no set has not been read, and keeps the seeded figures
// (the four Mediterranean charts: centres.md read their circles, not their figures; #199).
const figures = (sets) => Object.entries(sets).flatMap(([kind, list]) => list.map(([sprite, lon, lat]) => ({ kind, sprite, lon, lat })));
const CARTA_MARINA = figures({
  rose: [[null, -10.5, 65.8], [null, -4.7, 60.7], [null, 7.8, 58.3], [null, 20.6, 62.4]],
  monster: [['serpent-a', -5.5, 66.2], ['whale-b', -8.2, 69.0], ['cete-e', -8.4, 67.5], ['pistrix-c', -13.6, 59.7], [null, -9.5, 57.6], [null, -12.7, 58.5], [null, -4.5, 62.5], [null, -9.3, 64.7], [null, -3.1, 64.5], [null, -7.1, 56.3], [null, 8.9, 60.0]],
  ship: [['ship-a', -11.5, 64.5], ['ship-b', -5.9, 67.9], [null, -19.6, 60.6], [null, -17.5, 61.3], [null, -14.1, 62.8], [null, -12.5, 60.5], [null, -20.1, 62.0], [null, -14.5, 64.0], [null, 8.7, 55.1], [null, 19.5, 58.8], [null, 20.1, 57.0], [null, 17.4, 56.0]],
});
const CATALAN = figures({ rose: [['rose-catalan', -20.7, 42.1]], ship: [[null, -15.5, 26.1]] });
export const CURATED = [
  { name: 'Mediterranean, west', world: true, source: 'Carte Pisane, western circle', extent: { west: -10, east: 20, south: 30, north: 48 }, lon: 7.4, lat: 40.0, radius: 8.0 },
  { name: 'Mediterranean, east', world: true, source: 'Carte Pisane, eastern circle', extent: { west: 15, east: 42, south: 30, north: 48 }, lon: 27.4, lat: 36.8, radius: 7.5 },
  { name: 'Levant and Black Sea', source: 'Vesconte, 1311', extent: { west: 20, east: 42, south: 30, north: 48 }, lon: 25.2, lat: 37.5, radius: 3 },
  { name: 'Europe and the Mediterranean', world: true, source: 'Dulcert, 1339', extent: { west: -25, east: 42, south: 28, north: 60 }, lon: 14.5, lat: 40.0, radius: 17 },
  { name: 'The known world of 1375', world: true, source: 'Catalan Atlas', extent: { west: -25, east: 120, south: 10, north: 60 }, lon: -5.4, lat: 42.3, radius: 16, ornaments: CATALAN, style: 'catalan' },
  { name: 'Scandinavia and the Baltic', source: 'Carta Marina, 1539', extent: { west: -25, east: 45, south: 53, north: 72 }, lon: 19.7, lat: 61.7, radius: RULE, ornaments: CARTA_MARINA, style: 'carta-marina' },
  { name: 'The Atlantic and the Americas', world: true, source: 'Juan de la Cosa, 1500', extent: { west: -100, east: 20, south: -20, north: 65 }, lon: -45, lat: 23.4, radius: RULE },
].map((c) => ({ ...c, bands: servedBands(c.extent), area: (c.extent.east - c.extent.west) * (c.extent.north - c.extent.south) }));
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

// A line [[lon, lat], ...] in the pieces that each stay on one side of the antimeridian. A line is never cut
// where another sheet lies: every sheet's lines run their whole reach (#199).
const PAGE_LAT = 89.9; // a line may run to a pole, which has no Mercator y
export const cutOut = (line) => splitAtSeam(line);

// A line [[lon, lat], ...] whose longitudes are wrapped to +-180, as rhumb() gives them, in pieces that
// each stay on one side: a segment that jumps the antimeridian (179 to -177) is a 4 degree step the other way,
// not a 356 degree sweep across the page, so it ends one piece on the meridian and starts the next there.
export function splitAtSeam(line) {
  const out = [];
  let run = line.length ? [line[0]] : [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (Math.abs(b[0] - a[0]) <= 180) { run.push(b); continue; }
    const east = a[0] > b[0], edge = east ? 180 : -180, bu = b[0] + (east ? 360 : -360);
    const t = (edge - a[0]) / (bu - a[0]), ay = mercY(Math.max(-PAGE_LAT, Math.min(PAGE_LAT, a[1]))), by = mercY(Math.max(-PAGE_LAT, Math.min(PAGE_LAT, b[1])));
    const lat = unMercY(ay + (by - ay) * t);
    run.push([edge, lat]);
    out.push(run);
    run = [[-edge, lat], b];
  }
  if (run.length) out.push(run);
  return out;
}

function curatedCircle(c) {
  const cy = mercY(c.lat), R = c.radius / Math.cos(c.lat * RAD), nodes = [];
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES;
    nodes.push({ lon: c.lon + R * Math.sin(b), lat: unMercY(cy + R * Math.cos(b)) });
  }
  return { lon: c.lon, lat: c.lat, radius: c.radius / (c.extent.north - c.extent.south), nodes };
}

// Widths, in windows, a world sheet is seen at in the first band; narrower or wider, it contributes nothing to the view.
const WORLD_SEEN = { min: 0.25, max: 4 };

// The curated sheets of a band: in the first band the world sheets seen at the view's zoom, in a later band the
// sheets that serve it. Of those that overlap one another only the smallest is a sheet, so one network holds
// any place and no line need stop at another's edge (#199); the grid covers the ground of the others.
// Smallest first, a sheet is kept where it overlaps none kept before it.
function keptIn(band, zoom) {
  const windows = (c) => (c.extent.east - c.extent.west) / (1125 / 2 ** zoom);
  const seen = (c) => windows(c) >= WORLD_SEEN.min && windows(c) <= WORLD_SEEN.max;
  const kept = [];
  for (const c of CURATED.filter((c) => (band === BANDS[0] ? c.world && seen(c) : c.bands.includes(band.band))).sort((p, q) => p.area - q.area)) if (!kept.some((k) => overlaps(k.extent, c.extent))) kept.push(c);
  return kept;
}

// The curated sheets the band keeps that the view overlaps, each with `shadow`: the extents of the smaller
// kept sheets over it, where its roses and beasts are not placed (none while kept sheets never overlap).
function curatedFor(band, b, zoom) {
  const serving = keptIn(band, zoom);
  return serving.filter((c) => overlaps(c.extent, b)).map((c) => ({
    name: c.name, source: c.source, curated: true, band: band.band, bandName: band.name, extent: c.extent,
    circle: curatedCircle(c),
    ...(c.ornaments && { ornaments: c.ornaments, style: c.style }),
    shadow: serving.filter((o) => o.area < c.area && overlaps(o.extent, c.extent)).map((o) => o.extent),
  }));
}

// The world band (below the first band's zoom) is one sheet, the whole earth, with one ring as a planisphere
// has (Juan de la Cosa's, Cantino's): the hub mid-ocean on the equator, due south of the Catalan rose, and the
// rose the ring's north node, so the band's lines run through it (#199). Its lines reach the page.
export const WORLD_BAND = { band: -1, name: 'world', from: 2, to: BANDS[0].from };
export const WORLD_SHEET = (() => {
  const R = mercY(ROSE.lat), nodes = []; // the ring's radius on the page, in degrees of longitude
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES;
    nodes.push(i ? { lon: ROSE.lon + R * Math.sin(b), lat: unMercY(R * Math.cos(b)) } : { lon: ROSE.lon, lat: ROSE.lat });
  }
  return {
    name: 'The world', band: WORLD_BAND.band, bandName: WORLD_BAND.name, extent: { west: -180, east: 180, south: -PAGE_EDGE, north: PAGE_EDGE },
    circle: { lon: ROSE.lon, lat: 0, radius: R / (2 * PAGE_EDGE), nodes }, shadow: [],
  };
})();

// Every grid sheet the view overlaps: [{ name, band, bandName, row, col, extent, circle }], counted out from `origin`
// (ORIGINS; the rose by default). With `curated`, each band takes the curated sheets that serve it (curatedFor), and a grid cell whose centre lies in one
// is left out, so a curated sheet replaces the cells it holds (#199); the world band (below the first band's
// zoom) is the one world sheet.
export function sheetsFor(view, { radius = 0.5, curated = false, origin = ROSE } = {}) {
  const band = bandFor(view.zoom);
  const h = band.height;
  const b = viewBounds(view);
  const world = view.zoom < BANDS[0].from;
  const all = { west: -180, east: 180, south: -90, north: 90 };
  if (curated && world) return [WORLD_SHEET];
  const everywhere = curated ? curatedFor(band, all, view.zoom) : [];
  const cur = everywhere.filter((c) => overlaps(c.extent, b));
  const held = (extent) => everywhere.some((c) => within(c.extent, (extent.west + extent.east) / 2, (extent.south + extent.north) / 2));
  // Rows out from the origin up to the page's edge: a pole has no Mercator centre, so a row that would reach
  // past the edge ends on it.
  const O = origin;
  const rowLo = Math.floor((-PAGE_EDGE - O.lat) / h + EPS), rowHi = Math.ceil((PAGE_EDGE - O.lat) / h - EPS); // rows rowLo to rowHi - 1
  const south = Math.max(Math.floor((b.south - O.lat) / h + EPS), rowLo);
  const north = Math.min(Math.ceil((b.north - O.lat) / h - EPS), rowHi);
  const out = [];
  for (let row = south; row < north; row++) {
    const s0 = round(O.lat + row * h), s = Math.max(s0, -PAGE_EDGE), n = Math.min(round(s0 + h), PAGE_EDGE);
    const w = h * widening(band, s0, h);
    // The window may run past the date line; the sheets stay inside it, and the column the line falls in ends
    // there, so a narrower sheet closes each row at 180 and at -180.
    const c0 = Math.floor((Math.max(b.west, -180) - O.lon) / w + EPS);
    const c1 = Math.ceil((Math.min(b.east, 180) - O.lon) / w - EPS);
    for (let col = c0; col < c1; col++) {
      const extent = { west: Math.max(-180, round(O.lon + col * w)), east: Math.min(180, round(O.lon + (col + 1) * w)), south: s, north: n };
      if (held(extent)) continue;
      out.push({
        name: sheetName(band, row, col), band: band.band, bandName: band.name, row, col, extent,
        circle: hiddenCircle(extent, radius),
      });
    }
  }
  return [...cur, ...out];
}

// The sheet that holds the Catalan Atlas rose at a zoom, whatever the view: the curated sheet over it whose
// ground it is, or else the grid cell north-east of it (whose south-west corner it is, counted from the rose).
// Its reach is the rose's (#199). `origin` and `curated` as sheetsFor's; the world band is the one world sheet.
export function roseSheet(zoom, { origin = ROSE, curated = true } = {}) {
  if (zoom < BANDS[0].from) return WORLD_SHEET;
  const e = 1e-6, got = curated ? sheetsFor({ zoom, west: ROSE.lon - e, east: ROSE.lon + e, south: ROSE.lat - e, north: ROSE.lat + e }, { curated: true, origin }) : [];
  return got.find((s) => s.curated && within(s.extent, ROSE.lon, ROSE.lat) && !inShadow(s, ROSE.lon, ROSE.lat))
    ?? sheetsFor({ zoom: Math.max(zoom, BANDS[0].from), west: ROSE.lon + e, east: ROSE.lon + 2 * e, south: ROSE.lat + e, north: ROSE.lat + 2 * e }, { origin })[0];
}
