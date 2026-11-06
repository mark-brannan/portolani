// Landmark peaks: Natural Earth's 10m named summits (its geography regions' elevation points), each
// stood as PEAK_INK, a lone mountain in ink, with a tile on a click that gives its name and height.
// The page letters nothing beside it; the Signal K webapp letters its name (scene.mjs `peakNames`).
//
// Which peaks: every summit (`mountain` or `spot elevation`; not a pass, a depression or a plateau)
// with a name and a height, shown from Natural Earth's own min_zoom, counted in 256 px tiles as
// water.mjs's `shown` reads it. Where a town is on the summit, scene.mjs placePeaks stands it beside
// the town; a peak is never dropped for a town alone.

export const PEAK_STYLES = ['off', 'catalan']; // the page's chip: none, or a peak on each; 'catalan' stays only so saved links keep parsing, and the peak drawn is PEAK_INK
const SUMMITS = new Set(['mountain', 'spot elevation']);

// The peaks the site ships, from Natural Earth's elevation points (GeoJSON): the named summits, as a
// FeatureCollection of points carrying only what the page reads (name, elevation in metres,
// min_zoom), in the file's order. build-preview.mjs writes it to geo/peaks-10m.json and checks
// test/fixtures/peaks-10m.json against it.
export function slimPeaks(points) {
  const summits = points.features.filter((f) => SUMMITS.has(f.properties.featurecla) && f.properties.name && f.properties.elevation > 0);
  return {
    type: 'FeatureCollection',
    features: summits.map((f) => ({
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

// A landmark peak in ink: a lone pointed mountain, in the
// towers' idiom (scene.mjs TOWERS: SVG path layers, foot at y = 0, `p` filled with parchment and
// stroked in ink, `s` stroked only), PEAK_INK_H px tall on the chart.
export const PEAK_INK = { w: 9, h: 16, layers: [
  ['p', 'M-9 0L-4.5 -10L-1.5 -16L2 -9.5L9 0Z'],
  ['s', 'M-1.5 -16L-2.5 -9L-0.5 -3M3 -7.5L4.5 -2M-5 -7L-6.5 -2M0.5 -12L1.5 -8'],
] };
export const PEAK_INK_H = 26;
// PEAK_INK as SVG for a page's chip, in a 28 by 18 box, its foot on the box's floor
export const peakInkSvg = (paper = '#e9d8b4') => `<g transform="translate(14 17)" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">${PEAK_INK.layers
  .map(([kind, d]) => `<path d="${d}" fill="${kind === 'p' ? paper : 'none'}"/>`).join('')}</g>`;
