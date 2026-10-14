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
const place = (view, extra = { styles: ['marina'], hills: true }) => reliefOf({ proj: mercator(view), land, createCanvas, w: W, h: H, ...extra });

test('relief stands on land: ranges in Scandinavia from afar, hills from zoom 5', () => {
  const far = place({ lon: 15, lat: 62, zoom: 4 });
  assert.equal(place({ lon: 15, lat: 62, zoom: 5 }).humps.length > 0, true, 'hills at zoom 5');
  assert.equal(place({ lon: 15, lat: 62, zoom: 5 }, { styles: [], hills: false }).humps.length, 0, 'hills off: none');
  assert.equal(place({ lon: 15, lat: 62, zoom: 5 }, { styles: [], hills: true }).peaks.length, 0, 'mountains off: no peak');
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

test('each range takes one of the styles selected, by its seed; hills are humps for the sprites', () => {
  const view = { lon: 15, lat: 62, zoom: 4 };
  const mixed = place(view, { styles: ['marina', 'engraved'], hills: true }), seen = new Set(mixed.peaks.map((p) => p.style));
  assert.deepEqual([...seen].sort(), ['engraved', 'marina'], 'drawn ranges carry their style');
  assert.deepEqual([...new Set(place(view, { styles: ['engraved'] }).peaks.map((p) => p.style))], ['engraved']);
});
