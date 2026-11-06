// The atlas's grid sheets as a pure function of the view (docs/atlas/README.md, "Zoom bands" and
// "The fallback grid"). Bands are one zoom level wide, 4 to 5 up to 14 to 15, each numbered by its first zoom; below
// zoom 4 the atlas is the world band, one sheet, the whole earth with one ring, as on a planisphere (#199). A band's
// sheet is one window at the band's first zoom: 1125 / 2^z degrees of longitude wide and 1000 / 1600 of that tall on
// the Mercator page, so each band's sheet is half the width and half the height of the band above's and four nest in
// one. Every band counts its edges out from one origin, the Catalan Atlas rose by default (ORIGINS; `origin` of
// sheetsFor), in whole multiples of the sheet's height in Mercator y north and south and of its width east and west,
// so the origin is a corner of a sheet in every band. Counted in Mercator y, a sheet keeps the window's shape at every
// latitude and needs no widening toward the poles.
// No sheet crosses the date line, and a row that would reach a pole ends at the page's edge. Nothing here
// reads land or draws.

// The Catalan Atlas rose, read off the scan through its sheet 5 fit to +-1 degree (docs/atlas/centres.md):
// the point the grids count from and the origin of the lines drawn at every zoom.
export const ROSE = { lon: -20.2, lat: 43.5 };

// The points a grid may count from (`origin` of sheetsFor): the Catalan rose, the default, or 0E 0N, NOAA's own
// zero. Exposed for a while as a knob (docs/atlas/under-the-hood.md).
export const ORIGINS = { rose: ROSE, zero: { lon: 0, lat: 0 } };

// Page window: the doc's 1125 / 2^z degrees of longitude wide, on a 1600 x 1000 page.
export const WINDOW_DEG = 1125;
const ASPECT = 1000 / 1600;

// The bands, 4 to 14, each a zoom level wide. `width` is a sheet's width in degrees of longitude, `height` its height
// in page-degrees (degrees of Mercator y), both one window at `from`.
export const BANDS = Array.from({ length: 11 }, (_, i) => {
  const from = 4 + i, width = WINDOW_DEG / 2 ** from;
  return { band: from, name: `${from} to ${from + 1}`, from, to: from + 1, width, height: width * ASPECT };
});
import { RAD, mercDeg } from './frame-box.mjs';

export const NODES = 16;

const EPS = 1e-9;
const unMercY = (y) => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;
const round = (v) => Math.round(v * 1e9) / 1e9; // longitude edges are n * 1125 / 2^z from the origin; keep them clean
// Web Mercator's square: the page ends here, and so does a row that would reach a pole.
export const PAGE_EDGE = 85.0511287798;
const PAGE_Y = mercDeg(PAGE_EDGE); // the page's edge in page-degrees, about 180

// The band a zoom falls in. The world band (below the first band's zoom) returns the first band's grid;
// beyond the chart's last zoom the last band holds.
export function bandFor(zoom) {
  if (zoom < BANDS[0].from) return BANDS[0];
  for (const b of BANDS) if (zoom < b.to) return b;
  return BANDS[BANDS.length - 1];
}

// The window of a view as { west, east, south, north }, or the view's own bounds if it gives them.
export function viewBounds(view) {
  if (view.west != null) return { west: view.west, east: view.east, south: view.south, north: view.north };
  const span = WINDOW_DEG / 2 ** view.zoom;
  const y = mercDeg(view.lat);
  const half = (span * ASPECT) / 2;
  return {
    west: view.lon - span / 2, east: view.lon + span / 2,
    south: unMercY(y - half), north: unMercY(y + half),
  };
}

const pad = (n, w) => String(n).padStart(w, '0');

// An ENC-style name: PT, the band number, then the cell's south-west corner as a row north or south of
// the grid's origin and a column east or west of it, e.g. PT9N041E0123 (band 9, 41st row north, 123rd column east).
// South and west count outward from 0, so row -1 is S000 and column -1 is W0000; N000E0000 is the cell
// whose south-west corner is the origin.
export function sheetName(band, row, col) {
  const r = row < 0 ? -row - 1 : row, c = col < 0 ? -col - 1 : col;
  return `PT${band.band}${row < 0 ? 'S' : 'N'}${pad(r, Math.max(3, String(Math.ceil(PAGE_Y / band.height)).length))}${col < 0 ? 'W' : 'E'}${pad(c, 4)}`;
}

// The hidden circle: centre at the sheet's centre on the Mercator page, sixteen nodes at equal bearings from it, round
// on the page. `radius` is a fraction of the sheet's height on the page: 0.4, a ring 0.8 of the sheet's height across,
// is the grid's (docs/atlas/README.md, "The fallback grid").
export function hiddenCircle(extent, radius = 0.4) {
  const lon = (extent.west + extent.east) / 2;
  const y0 = mercDeg(extent.south), y1 = mercDeg(extent.north), cy = (y0 + y1) / 2;
  const R = radius * (y1 - y0); // page-degrees, the same across as up
  const nodes = [];
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES; // bearing from north, clockwise
    nodes.push({ lon: lon + R * Math.sin(b), lat: unMercY(cy + R * Math.cos(b)) });
  }
  return { lon, lat: unMercY(cy), radius, nodes };
}

// The curated sheets (docs/atlas/README.md, "The curated sheets"): extents from that table, circles from
// the readings in centres.md (centre, and radius in degrees of a great circle). `bands` are the atlas bands
// a sheet serves: those in which its extent is one to two windows wide at the band's first zoom, the range a grid
// sheet spans across its one-level band; wider than that, a chart is a page of the band above. The world band, below
// the first band, takes every curated sheet seen at the view's zoom (keptIn), under the world sheet (WORLD_SHEET).
// The Carta Marina has no ring and de la Cosa's is in pixels, so both keep the rule of the old overview grid, 0.4 of
// its 19.2 degree cell (7.68 degrees).
const RULE = 7.68;
const servedBands = (extent) => BANDS.filter((b) => { const w = (extent.east - extent.west) / b.width; return w >= 1 - EPS && w <= 2 + EPS; }).map((b) => b.band);
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
// The Carte Pisane's two rings are tangent (centres.md): the west reaches 17.8E, the east 18.0E. Its two sheets meet
// there, edge to edge, so no overlap rule drops one for the other and the chart's two networks stand together.
const PISANE_SEAM = 18;
// The Catalan Atlas's figures, sheets 5 to 12 (ornaments.md): one rose, the beasts and ships of the Caspian and the Indian
// Ocean. Sheets 6 to 8 draw none at sea. Sheet 10's four, which its fit lays on the steppe, and sheet 12's two fish east of
// the extent are not listed: ornaments.md keeps them, so leaving them out rests on this list, not on the land or the edge.
const CATALAN = figures({
  rose: [['rose-catalan', ROSE.lon, ROSE.lat]],
  monster: [['catalan-siren', 113.1, 15.8]],
  ship: [[null, -15.5, 26.1], ['catalan-ship', 50.6, 41.1], ['catalan-junk', 81.2, 13.2]],
});
// Juan de la Cosa's figures on the sheet's extent (ornaments.md): one ship in the South Atlantic, too faint at the scan's
// size to cut, which stands in one of the chart's own ships off India. The chart draws no beast at sea. Its four roses are
// listed in ornaments.md and not drawn until the ring is reread, so the sheet keeps the roses at the hub and nodes of the
// ring it draws (scene.mjs); its fleet off India and the ship off the Cape lie east of the extent.
const DE_LA_COSA = figures({
  ship: [[null, 2.8, -17.8]],
});
export const CURATED = [
  { name: 'Mediterranean, west', source: 'Carte Pisane, western circle', extent: { west: -10, east: PISANE_SEAM, south: 30, north: 48 }, lon: 7.4, lat: 40.0, radius: 8.0 },
  { name: 'Mediterranean, east', source: 'Carte Pisane, eastern circle', extent: { west: PISANE_SEAM, east: 42, south: 30, north: 48 }, lon: 27.4, lat: 36.8, radius: 7.5 },
  { name: 'Levant and Black Sea', source: 'Vesconte, 1311', extent: { west: 20, east: 42, south: 30, north: 48 }, lon: 25.2, lat: 37.5, radius: 3 },
  { name: 'Europe and the Mediterranean', source: 'Dulcert, 1339', extent: { west: -25, east: 42, south: 28, north: 60 }, lon: 14.5, lat: 40.0, radius: 17 },
  { name: 'The known world of 1375', source: 'Catalan Atlas', extent: { west: -25, east: 120, south: 10, north: 60 }, lon: -5.4, lat: 42.3, radius: 16, ornaments: CATALAN, style: 'catalan' },
  { name: 'Scandinavia and the Baltic', source: 'Carta Marina, 1539', extent: { west: -25, east: 45, south: 53, north: 72 }, lon: 19.7, lat: 61.7, radius: RULE, ornaments: CARTA_MARINA, style: 'carta-marina' },
  { name: 'The Atlantic and the Americas', source: 'Juan de la Cosa, 1500', extent: { west: -100, east: 20, south: -20, north: 65 }, lon: -45, lat: 23.4, radius: RULE, ornaments: DE_LA_COSA, style: 'de-la-cosa' },
].map((c) => ({ ...c, bands: servedBands(c.extent), area: (c.extent.east - c.extent.west) * (c.extent.north - c.extent.south) }));
const within = (e, lon, lat) => lon >= e.west && lon <= e.east && lat >= e.south && lat <= e.north;
const overlaps = (a, b) => a.west < b.east && b.west < a.east && a.south < b.north && b.south < a.north;
export const inShadow = (sheet, lon, lat) => !!sheet.shadow?.some((e) => within(e, lon, lat));

// A sheet's territory, in windows: its extent less the smaller curated sheets over it, on the Mercator page,
// over the page window at zoom `from` (1125 / 2^from degrees across, 1000 / 1600 as tall). It is a property of
// the sheet and its shadow, so it is the same from any view  (#147).
export function territory(sheet, from) {
  const e = sheet.extent, y0 = mercDeg(e.south), y1 = mercDeg(e.north);
  const cuts = (sheet.shadow ?? []).filter((o) => overlaps(o, e)).map((o) => ({ x0: Math.max(o.west, e.west), x1: Math.min(o.east, e.east), y0: Math.max(mercDeg(o.south), y0), y1: Math.min(mercDeg(o.north), y1) }));
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

// How the curated charts that overlap one another are drawn (the page's `overlap=`; #199):
//   smallest  only the smallest of the overlapping charts; the grid holds the others' ground, and the world
//             band is the planisphere alone
//   fit       only the chart closest to one window wide at the view's zoom (the default)
//   cut       every chart, each line stopping at the edge of a smaller chart over it (cutOut)
//   uncut     every chart in full, lines and figures alike
// Under smallest and fit no two kept charts overlap, so one network holds any place.
export const OVERLAP_RULES = ['smallest', 'fit', 'cut', 'uncut'];
export const DEFAULT_OVERLAP = 'fit';
export const overlapRule = (rule) => (OVERLAP_RULES.includes(rule) ? rule : DEFAULT_OVERLAP);

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

// A line [[lon, lat], ...] in the pieces that each stay on one side of the antimeridian, and, given `extents`
// (the `cut` rule), with what lies inside any of them cut out: the runs left, each a line. The cut is made on
// the Mercator page, where a rhumb line's segments are straight, so a run ends on the edge. Without extents a
// line is never cut where another sheet lies: every sheet's lines run their whole reach (#199).
const PAGE_LAT = 89.9; // a line may run to a pole, which has no Mercator y
export function cutOut(line, extents) {
  const pieces = splitAtSeam(line);
  if (!extents?.length) return pieces;
  return pieces.flatMap((piece) => cutPiece(piece, extents));
}

function cutPiece(line, extents) {
  const yOf = (lat) => mercDeg(Math.max(-PAGE_LAT, Math.min(PAGE_LAT, lat)));
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
    const t = (edge - a[0]) / (bu - a[0]), ay = mercDeg(Math.max(-PAGE_LAT, Math.min(PAGE_LAT, a[1]))), by = mercDeg(Math.max(-PAGE_LAT, Math.min(PAGE_LAT, b[1])));
    const lat = unMercY(ay + (by - ay) * t);
    run.push([edge, lat]);
    out.push(run);
    run = [[-edge, lat], b];
  }
  if (run.length) out.push(run);
  return out;
}

function curatedCircle(c) {
  const cy = mercDeg(c.lat), R = c.radius / Math.cos(c.lat * RAD), nodes = [];
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES;
    nodes.push({ lon: c.lon + R * Math.sin(b), lat: unMercY(cy + R * Math.cos(b)) });
  }
  return { lon: c.lon, lat: c.lat, radius: c.radius / (c.extent.north - c.extent.south), nodes };
}

// Widths, in windows, a curated sheet is seen at in the world band; narrower or wider, it contributes nothing to the view.
const WORLD_SEEN = { min: 0.25, max: 4 };

// The curated sheets of a band under an overlap rule (OVERLAP_RULES). The candidates are, in the world band, every
// curated sheet seen at the view's zoom, in a band the sheets that serve it. `smallest`
// and `fit` sort them (by area, or by distance from one window wide at the view's zoom) and keep a sheet where
// it overlaps none kept before it, so the grid covers the ground of the others; `cut` and `uncut` keep them all,
// smallest first. Under `smallest` the world band keeps none: it is the planisphere alone.
function keptIn(band, zoom, rule = DEFAULT_OVERLAP) {
  if (band === WORLD_BAND && rule === 'smallest') return [];
  const windows = (c) => (c.extent.east - c.extent.west) / (WINDOW_DEG / 2 ** zoom);
  const seen = (c) => windows(c) >= WORLD_SEEN.min && windows(c) <= WORLD_SEEN.max;
  const serves = (c) => (band === WORLD_BAND ? seen(c) : c.bands.includes(band.band));
  const misfit = (c) => Math.abs(Math.log2(windows(c)));
  const order = rule === 'fit' ? (p, q) => misfit(p) - misfit(q) || p.area - q.area : (p, q) => p.area - q.area;
  const all = rule === 'cut' || rule === 'uncut';
  const kept = [];
  for (const c of CURATED.filter(serves).sort(order)) if (all || !kept.some((k) => overlaps(k.extent, c.extent))) kept.push(c);
  return kept;
}

// The curated sheets the band keeps that the view overlaps, each with `shadow`: the extents of the smaller
// kept sheets over it, where its roses and beasts are not placed and, under `cut`, where its lines stop
// (none under `uncut`, and none while kept sheets never overlap).
function curatedFor(band, b, zoom, rule) {
  const serving = keptIn(band, zoom, rule);
  const shadowOf = (c) => (rule === 'uncut' ? [] : serving.filter((o) => o.area < c.area && overlaps(o.extent, c.extent)).map((o) => o.extent));
  return serving.filter((c) => overlaps(c.extent, b)).map((c) => ({
    name: c.name, source: c.source, curated: true, band: band.band, bandName: band.name, extent: c.extent,
    circle: curatedCircle(c),
    ...(c.ornaments && { ornaments: c.ornaments, style: c.style }),
    shadow: shadowOf(c),
  }));
}

// The world band (below the first band's zoom) is one sheet, the whole earth, with one ring as a planisphere
// has (Juan de la Cosa's, Cantino's): the hub mid-ocean on the equator, due south of the Catalan rose, and the
// rose the ring's north node, so the band's lines run through it (#199). Its lines reach the page. Under every
// rule but `smallest` the world sheets seen at the zoom lie over it, and shadow its nodes as the grid's cells
// are replaced in the bands above.
export const WORLD_BAND = { band: -1, name: 'world', from: 2, to: BANDS[0].from };
export const WORLD_SHEET = (() => {
  const R = mercDeg(ROSE.lat), nodes = []; // the ring's radius on the page, in degrees of longitude
  for (let i = 0; i < NODES; i++) {
    const b = (i * 2 * Math.PI) / NODES;
    nodes.push(i ? { lon: ROSE.lon + R * Math.sin(b), lat: unMercY(R * Math.cos(b)) } : { lon: ROSE.lon, lat: ROSE.lat });
  }
  return {
    name: 'The world', band: WORLD_BAND.band, bandName: WORLD_BAND.name, extent: { west: -180, east: 180, south: -PAGE_EDGE, north: PAGE_EDGE },
    circle: { lon: ROSE.lon, lat: 0, radius: R / (2 * PAGE_EDGE), nodes }, shadow: [],
  };
})();

// A sheet's place on the earth, which its ornaments are picked by (docs/atlas/README.md, "Which beasts, which ships"):
// a grid sheet's extent, to a millionth of a degree, which the band's number and the sheet's name do not enter; a
// curated sheet's or the world sheet's own name, the chart it is.
const fix6 = (v) => v.toFixed(6);
export const sheetPlace = (sh) => (sh.curated || sh.band === WORLD_BAND.band ? sh.name : [sh.extent.west, sh.extent.south, sh.extent.east, sh.extent.north].map(fix6).join(','));

// The page turn (docs/atlas/README.md, "The page turn"): over a span of `turn` zoom levels centred on each band edge
// from 4 up, the outgoing band's sheets fade out as the incoming band's fade in. The bands a zoom draws, each with
// its ink from 0 to 1: one at full ink outside a span, two inside it, their inks summing to 1. A turn of 0 is a hard
// swap at the edge. The outgoing band at 4 is the world band.
export const TURN = 0.3;
export function bandsAt(zoom, turn = TURN) {
  const half = turn / 2;
  if (half > 0) for (let i = 0; i < BANDS.length; i++) {
    const x = BANDS[i].from;
    if (zoom > x - half && zoom < x + half) {
      const t = (zoom - (x - half)) / turn;
      return [{ band: i ? BANDS[i - 1] : WORLD_BAND, alpha: 1 - t }, { band: BANDS[i], alpha: t }];
    }
  }
  return [{ band: zoom < BANDS[0].from ? WORLD_BAND : bandFor(zoom), alpha: 1 }];
}

// Every grid sheet the view overlaps: [{ name, band, bandName, row, col, extent, circle }], counted out from `origin`
// (ORIGINS; the rose by default). With `curated`, each band takes the curated sheets that serve it under the `overlap`
// rule (curatedFor), and a grid cell whose centre lies in one is left out, so a curated sheet replaces the cells it
// holds (#199); the world band (below the first band's zoom) is the world sheet, under the charts the rule keeps there.
// `band` (a BANDS entry or WORLD_BAND) asks for that band's sheets over the view, whatever its zoom: a page turn draws two.
export function sheetsFor(view, { radius = 0.4, curated = false, overlap = DEFAULT_OVERLAP, origin = ROSE, band: asked = null } = {}) {
  const world = asked ? asked === WORLD_BAND : view.zoom < BANDS[0].from;
  const band = asked && !world ? asked : bandFor(view.zoom), rule = overlapRule(overlap);
  const b = viewBounds(view);
  const all = { west: -180, east: 180, south: -90, north: 90 };
  if (curated && world) {
    const shadow = rule === 'uncut' ? [] : keptIn(WORLD_BAND, view.zoom, rule).map((c) => c.extent);
    return [...curatedFor(WORLD_BAND, b, view.zoom, rule), { ...WORLD_SHEET, shadow }];
  }
  const everywhere = curated ? curatedFor(band, all, view.zoom, rule) : [];
  const cur = everywhere.filter((c) => overlaps(c.extent, b));
  const held = (extent) => everywhere.some((c) => within(c.extent, (extent.west + extent.east) / 2, (extent.south + extent.north) / 2));
  // Rows out from the origin in Mercator y up to the page's edge: a pole has no Mercator centre, so a row that would
  // reach past the edge ends on it.
  const O = origin, w = band.width, h = band.height, oy = mercDeg(O.lat);
  const rowLo = Math.floor((-PAGE_Y - oy) / h + EPS), rowHi = Math.ceil((PAGE_Y - oy) / h - EPS); // rows rowLo to rowHi - 1
  const south = Math.max(Math.floor((mercDeg(Math.max(b.south, -PAGE_EDGE)) - oy) / h + EPS), rowLo);
  const north = Math.min(Math.ceil((mercDeg(Math.min(b.north, PAGE_EDGE)) - oy) / h - EPS), rowHi);
  const latOf = (y) => (y <= -PAGE_Y ? -PAGE_EDGE : y >= PAGE_Y ? PAGE_EDGE : unMercY(y));
  // The window may run past the date line; the sheets stay inside it, and the column the line falls in ends
  // there, so a narrower sheet closes each row at 180 and at -180.
  const c0 = Math.floor((Math.max(b.west, -180) - O.lon) / w + EPS);
  const c1 = Math.ceil((Math.min(b.east, 180) - O.lon) / w - EPS);
  const out = [];
  for (let row = south; row < north; row++) {
    const s = latOf(oy + row * h), n = latOf(oy + (row + 1) * h);
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
// ground it is (the smallest, where the rule keeps several), or else the world sheet below the first band and the
// grid cell north-east of it above (whose south-west corner it is, counted from the rose). Its reach is the rose's
// (#199). `origin` and `curated` as sheetsFor's.
export function roseSheet(zoom, { origin = ROSE, curated = true, overlap = DEFAULT_OVERLAP } = {}) {
  const world = zoom < BANDS[0].from;
  if (world && !curated) return WORLD_SHEET;
  const e = 1e-6, got = curated ? sheetsFor({ zoom, west: ROSE.lon - e, east: ROSE.lon + e, south: ROSE.lat - e, north: ROSE.lat + e }, { curated: true, origin, overlap }) : [];
  return got.find((s) => s.curated && within(s.extent, ROSE.lon, ROSE.lat) && !inShadow(s, ROSE.lon, ROSE.lat))
    ?? (world ? WORLD_SHEET : sheetsFor({ zoom, west: ROSE.lon + e, east: ROSE.lon + 2 * e, south: ROSE.lat + e, north: ROSE.lat + 2 * e }, { origin })[0]);
}
