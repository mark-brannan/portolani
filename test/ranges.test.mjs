// Mountain ranges from Natural Earth's Range/mtn polygons (ranges.mjs), drawn by relief.mjs along
// each polygon's ridge. Offline, from coastlines' 10m geography regions and 50m land.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { geojsonPolygons } from 'coast-wright';
import { reliefOf } from '../scripts/relief.mjs';
import { slimRanges, rangesOf, ridgesOf } from '../scripts/ranges.mjs';

const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const land = geojsonPolygons(JSON.parse(readFileSync(join(GEO, 'ne-land-50m.geojson'), 'utf8')));
const slim = slimRanges(JSON.parse(readFileSync(join(GEO, 'ne-geography-regions-polys-10m.geojson'), 'utf8')));
const ranges = rangesOf(slim);
const W = 1600, H = 1000, RAD = Math.PI / 180;

function mercator({ lon, lat, zoom }) {
  const k = (512 * 2 ** zoom) / (2 * Math.PI), f = (l) => Math.log(Math.tan(Math.PI / 4 + (l * RAD) / 2)), y0 = f(lat);
  const wrap = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
  return {
    k, zoom, lonCenter: lon,
    x: (lo) => W / 2 + wrap(lo - lon) * RAD * k,
    y: (la) => H / 2 - (f(la) - y0) * k,
    invert: (px, py) => [lon + (px - W / 2) / k / RAD, (2 * Math.atan(Math.exp(y0 - (py - H / 2) / k)) - Math.PI / 2) / RAD],
  };
}
const place = (view, extra = {}) => reliefOf({ proj: mercator(view), land, ranges, createCanvas, w: W, h: H, styles: ['marina'], hills: false, ...extra });
const inRings = (rings, [x, y]) => {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const named = (name) => ranges.filter((r) => r.name === name);
const onScreen = (p) => p.x > 0 && p.x < W && p.y > 0 && p.y < H;

test('the site ships the ranges only, four properties each', () => {
  assert.ok(slim.features.length > 200);
  for (const f of slim.features) assert.deepEqual(Object.keys(f.properties), ['name', 'scalerank', 'min_label', 'ne_id']);
  assert.ok(named('ALPS').length && named('CASCADE RANGE').length && named('ANDES').length);
});

test('the Alps stand on their polygon', () => {
  const view = { lon: 10, lat: 46, zoom: 6 }, proj = mercator(view), peaks = place(view).peaks.filter(onScreen);
  const alps = named('ALPS');
  assert.ok(peaks.length > 40, `${peaks.length} peaks`);
  const inside = peaks.filter((p) => ranges.some((r) => inRings(r.rings, proj.invert(p.x, p.y))));
  assert.ok(inside.length / peaks.length > 0.95, `${inside.length} of ${peaks.length} peaks on a range`);
  assert.ok(peaks.filter((p) => alps.some((r) => inRings(r.rings, proj.invert(p.x, p.y)))).length > 20, 'the Alps hold peaks');
});

test('a far view holds the great ranges, a close one the rest', () => {
  const harz = named('Harz')[0]; // MIN_LABEL 5.4
  const at = (zoom) => {
    const view = { lon: 10.6, lat: 51.75, zoom }, proj = mercator(view);
    return place(view).peaks.filter((p) => inRings(harz.rings, proj.invert(p.x, p.y))).length;
  };
  assert.equal(at(3), 0, 'the Harz stand nothing from afar');
  assert.ok(at(6.5) > 0, 'the Harz stand peaks close in');
});

test('a pan keeps every range peak where it stood on the map', () => {
  const view = { lon: 10, lat: 46, zoom: 5.3 }, a = place(view), proj = mercator(view);
  const dx = 173.4, dy = -91.7;
  const b = place({ ...view, lon: view.lon - dx / proj.k / RAD, lat: proj.invert(W / 2, H / 2 - dy)[1] });
  const key = (p, ox, oy) => `${Math.round(p.x + ox)},${Math.round(p.y + oy)}`;
  const after = new Set(b.peaks.map((p) => key(p, 0, 0)));
  const before = a.peaks.filter((p) => p.x > 300 && p.x < W - 300 && p.y > 300 && p.y < H - 300);
  assert.ok(before.length > 10);
  const kept = before.filter((p) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => after.has(key(p, dx + ox, dy + oy))));
  assert.equal(kept.length, before.length, `${before.length - kept.length} of ${before.length} peaks moved under a pan`);
});

test('a view with no range in frame still guesses its ranges from the land', () => {
  const view = { lon: 38, lat: 56, zoom: 6 }; // the Russian plain: no Range/mtn polygon in frame
  assert.ok(place(view).peaks.length > 0, 'the far-view guess');
  assert.deepEqual(place(view).peaks, place(view, { ranges: [] }).peaks, 'as it was without ranges');
});

test('a ridge that curls back on itself stops where it meets its own path', () => {
  // a U: two arms joined at the bottom, so a walk round the bend comes back beside its start
  const ring = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]];
  const [range] = rangesOf({ features: [{ properties: { name: 'U', scalerank: 1, min_label: 1 }, geometry: { type: 'Polygon', coordinates: [ring] } }] });
  const [main] = ridgesOf(range, createCanvas);
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02;
  let doubled = 0;
  main.pts.forEach((a, i) => main.pts.forEach((b, j) => { if (j - i > 8 && near(a, b)) doubled++; }));
  assert.equal(doubled, 0);
});
