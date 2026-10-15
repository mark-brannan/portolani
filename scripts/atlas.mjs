// The atlas's grid sheets as a pure function of the view (docs/atlas/README.md, "Zoom bands" and
// "An atlas of sheets"). Sheets follow NOAA's reschemed ENC cells: heights of 19.2, 4.8, 1.2, 0.3 and
// 0.075 degrees, sixteen of a band inside one of the band above, widened to 2x above 49 12' and 4x
// above 69 12' (north and south) from the coastal band down, edges on whole multiples of the cell
// height from the equator and of the cell width from the prime meridian. No sheet crosses the date
// line, and none lies beyond the last whole row before a pole. Nothing here reads land or draws.

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

// How many cell heights wide a cell is in the row whose south edge is `south` and height `h`. A row
// is widened by the latitude of its centre, so a row that straddles a threshold goes with its larger
// half (69 12' is not a whole number of 0.3 or 0.075 rows).
export function widening(band, south, h) {
  if (!band.widens) return 1;
  const m = Math.abs(south + h / 2);
  return m > WIDEN_4X + EPS ? 4 : m > WIDEN_2X + EPS ? 2 : 1;
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

// An ENC-style name: PT, the band number, then the cell's south-west corner as a row off the equator
// and a column off the prime meridian, e.g. PT3N041E0123 (band 3, 41st row north, 123rd column east).
// South and west count outward from 0, so row -1 is S000 and column -1 is W0000.
export function sheetName(band, row, col) {
  const r = row < 0 ? -row - 1 : row, c = col < 0 ? -col - 1 : col;
  return `PT${band.band}${row < 0 ? 'S' : 'N'}${pad(r, Math.max(3, String(Math.floor(90 / band.height + EPS)).length))}${col < 0 ? 'W' : 'E'}${pad(c, 4)}`;
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

// Every grid sheet the view overlaps: [{ name, band, bandName, row, col, extent, circle }].
export function sheetsFor(view, { radius = 0.5 } = {}) {
  const band = bandFor(view.zoom);
  const h = band.height;
  const b = viewBounds(view);
  // Whole rows off the equator that end short of a pole: a row touching the pole (90 is a whole number of
  // 1.2, 0.3 and 0.075 rows) has no Mercator centre, so it is left out like the caps beyond the last.
  const rows = Math.ceil(90 / h - EPS) - 1;
  const south = Math.max(Math.floor(b.south / h + EPS), -rows);
  const north = Math.min(Math.ceil(b.north / h - EPS), rows);
  const out = [];
  for (let row = south; row < north; row++) {
    const s = row * h;
    const w = h * widening(band, s, h);
    // The window may run past the date line; the sheets stay inside it. 180 is not a whole number of
    // 19.2 or 4.8 degree columns, so the last column of those bands ends at 180 and a narrower sheet closes it.
    const c0 = Math.floor(Math.max(b.west, -180) / w + EPS);
    const c1 = Math.ceil(Math.min(b.east, 180) / w - EPS);
    for (let col = c0; col < c1; col++) {
      const extent = { west: Math.max(-180, round(col * w)), east: Math.min(180, round((col + 1) * w)), south: round(s), north: round(s + h) };
      out.push({
        name: sheetName(band, row, col), band: band.band, bandName: band.name, row, col, extent,
        circle: hiddenCircle(extent, radius),
      });
    }
  }
  return out;
}
