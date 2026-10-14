// Hills and mountains (relief.mjs): placed on land only, the same land the same way under a pan,
// and hills only from close in. Offline, from coastlines' Natural Earth 50m land.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { geojsonPolygons } from 'coast-wright';
import { reliefOf } from '../scripts/relief.mjs';

const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const land = geojsonPolygons(JSON.parse(readFileSync(join(GEO, 'ne-land-50m.geojson'), 'utf8')));
const W = 1600, H = 1000, RAD = Math.PI / 180;

// Web Mercator centred on the view, as scene.mjs projects it
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
const place = (view) => reliefOf({ proj: mercator(view), land, createCanvas, w: W, h: H });

test('relief stands on land: ranges in Scandinavia from afar, hills from zoom 9', () => {
  const far = place({ lon: 15, lat: 62, zoom: 4 });
  assert.ok(far.peaks.length > 20, `a far view of Scandinavia holds ranges (${far.peaks.length} peaks)`);
  assert.equal(far.humps.length, 0, 'no hills from afar');
  const close = place({ lon: 9, lat: 61, zoom: 10 });
  assert.ok(close.humps.length > 0 && close.peaks.length > 0, 'a close view holds ranges and hills');
  const sea = place({ lon: -30, lat: 45, zoom: 5 }); // the open Atlantic; Ireland's ranges lie past its edge
  const seen = (p) => p.x + p.w / 2 > 0 && p.x - p.w / 2 < W && p.y > 0 && p.y - p.h < H;
  assert.equal([...sea.peaks, ...sea.humps].filter(seen).length, 0, 'nothing at sea');
});

test('a pan keeps every peak where it stood on the map', () => {
  const view = { lon: 15, lat: 62, zoom: 4.3 }, a = place(view), proj = mercator(view);
  const dx = 173.4, dy = -91.7; // a drag of (dx, dy) px moves the map, and every peak with it
  const moved = { ...view, lon: view.lon - dx / proj.k / RAD, lat: proj.invert(W / 2, H / 2 - dy)[1] };
  const b = place(moved);
  const key = (p, ox, oy) => `${Math.round(p.x + ox)},${Math.round(p.y + oy)}`;
  const inner = (p) => p.x > 300 && p.x < W - 300 && p.y > 300 && p.y < H - 300;
  const after = new Set(b.peaks.map((p) => key(p, 0, 0)));
  const before = a.peaks.filter(inner);
  assert.ok(before.length > 10);
  const kept = before.filter((p) => after.has(key(p, dx, dy)) || after.has(key(p, dx + 1, dy)) || after.has(key(p, dx - 1, dy)) || after.has(key(p, dx, dy + 1)) || after.has(key(p, dx, dy - 1)));
  assert.equal(kept.length, before.length, `${before.length - kept.length} of ${before.length} peaks moved under a pan`);
});

test('each range takes one of the styles selected, by its seed; the Catalan ranges come back as spines, not peaks', () => {
  const view = { lon: 15, lat: 62, zoom: 4 }, at = (styles) => reliefOf({ proj: mercator(view), land, createCanvas, w: W, h: H, styles });
  const mixed = at(['marina', 'engraved', 'catalan']), seen = new Set(mixed.peaks.map((p) => p.style));
  assert.deepEqual([...seen].sort(), ['engraved', 'marina'], 'drawn ranges carry their style');
  assert.ok(mixed.ranges.length > 0 && mixed.ranges.every((r) => r.spine.length >= 2 && r.height > 0 && r.peaks.length > 0), 'Catalan ranges come back as spines, with the peaks a drag draws meanwhile');
  const marina = at(['marina']);
  assert.equal(marina.ranges.length, 0);
  assert.ok(marina.peaks.every((p) => p.style === 'marina'));
  assert.ok(marina.peaks.length > mixed.peaks.length, 'a range given to another style is not also drawn');
  assert.equal(at(['catalan']).peaks.length, 0, 'the sprites alone leave no drawn peak');
  assert.deepEqual(at(['marina', 'engraved']).peaks.map((p) => [p.x, p.y, p.style]), at(['marina', 'engraved']).peaks.map((p) => [p.x, p.y, p.style]), 'the same view mixes the same way');
});
