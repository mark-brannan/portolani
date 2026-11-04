// Landmark peaks: Natural Earth's 10m named summits (its geography regions' elevation points) that a
// sailor could take a bearing on, each stood as one of the mountain sprites (the Catalan family,
// drawn larger than a hill) with a tile on a click that gives its name and height. Nothing is
// lettered beside it.
//
// Which peaks: a summit (`mountain` or `spot elevation`; not a pass, a depression or a plateau)
// within PEAK_SEA_KM of the sea, read off the 10m coastline when the site is built (slimPeaks), and
// shown from Natural Earth's own min_zoom, counted in 256 px tiles as water.mjs's `shown` reads it.

const RAD = Math.PI / 180;
const EARTH_KM = 6371;
export const PEAK_STYLES = ['off', 'catalan']; // the page's chip: none, or the Catalan sprite on each
export const PEAK_SEA_KM = 100; // a peak farther inland than this is no sea mark
const SUMMITS = new Set(['mountain', 'spot elevation']);

// Great-circle distance, km.
export function kmBetween([lon0, lat0], [lon1, lat1]) {
  const a = Math.sin(((lat1 - lat0) * RAD) / 2) ** 2 + Math.cos(lat0 * RAD) * Math.cos(lat1 * RAD) * Math.sin(((lon1 - lon0) * RAD) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// The distance, km, from each of `points` [lon, lat] to the nearest vertex of the coastline `lines`
// ([[lon, lat], ...] each), up to `cap` (Infinity past it). The 10m coastline's vertices are a few
// hundred metres apart, close enough for a 100 km cut. Vertices are bucketed by whole degree.
export function kmToCoast(points, lines, cap = PEAK_SEA_KM) {
  const cells = new Map(), key = (i, j) => `${i},${j}`;
  for (const line of lines) for (const p of line) {
    const k = key(Math.floor(p[0]), Math.floor(p[1]));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(p);
  }
  const dLat = Math.ceil(cap / 111) + 1;
  return points.map((pt) => {
    const dLon = Math.min(180, Math.ceil(cap / (111 * Math.max(0.05, Math.cos(pt[1] * RAD)))) + 1);
    const i0 = Math.floor(pt[0]), j0 = Math.floor(pt[1]);
    let best = Infinity;
    for (let j = j0 - dLat; j <= j0 + dLat; j++) for (let di = -dLon; di <= dLon; di++) {
      const i = ((((i0 + di) + 180) % 360) + 360) % 360 - 180;
      for (const p of cells.get(key(i, j)) ?? []) { const d = kmBetween(pt, p); if (d < best) best = d; }
    }
    return best <= cap ? best : Infinity;
  });
}

// The peaks the site ships, from Natural Earth's elevation points and its coastline (GeoJSON each):
// the summits within PEAK_SEA_KM of the sea, as a FeatureCollection of points carrying only what the
// page reads (name, elevation in metres, min_zoom), in the file's order. build-preview.mjs writes it
// to geo/peaks-10m.json and checks test/fixtures/peaks-10m.json against it.
export function slimPeaks(points, coast) {
  const lines = coast.features.flatMap((f) => (f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]));
  const summits = points.features.filter((f) => SUMMITS.has(f.properties.featurecla) && f.properties.name && f.properties.elevation > 0);
  const km = kmToCoast(summits.map((f) => f.geometry.coordinates), lines);
  return {
    type: 'FeatureCollection',
    features: summits.filter((_, i) => km[i] <= PEAK_SEA_KM).map((f) => ({
      type: 'Feature',
      properties: { name: f.properties.name, elevation: f.properties.elevation, min_zoom: f.properties.min_zoom },
      geometry: { type: 'Point', coordinates: f.geometry.coordinates.map((v) => Math.round(v * 1e4) / 1e4) },
    })),
  };
}

// The peaks from slimPeaks's file: { name, lon, lat, elevation, minZoom }.
export function peaksOf(geo) {
  return (geo?.features ?? []).map((f) => ({
    name: f.properties.name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
    elevation: f.properties.elevation, minZoom: f.properties.min_zoom ?? 0,
  }));
}

// A peak's tile: its name, and its height in metres and feet.
export function peakTile(p) {
  const m = Math.round(p.elevation), ft = Math.round(p.elevation / 0.3048);
  return { title: p.name, date: `${m.toLocaleString('en')} m (${ft.toLocaleString('en')} ft)` };
}

// A peak's sprite width, px: about twice a hill's (HILL_SIZE caps those at about 50 px), and wider the
// higher the peak, up to PEAK_W at TALL metres.
export const PEAK_W = 100, TALL = 6000;
export const peakWidth = (elevation) => PEAK_W * (0.7 + 0.3 * Math.min(1, Math.max(0, elevation) / TALL));
