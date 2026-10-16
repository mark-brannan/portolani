// A redraw at zoom 10 with the ornaments on stays fast (#177): it took 10.9 s in the browser (4 s here) because every
// sea probe of the beasts' placement walked all the points of a coast ring; a long ring is now read through a latitude index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, insideRing } from '../scripts/scene.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const names = joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

const naive = (ring, lon, lat) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < xj + ((lat - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside;
};

test('a long ring answers as the plain even-odd walk does, at every point, on and off its vertices', () => {
  const rings = read(join(GEO, 'ne-land-50m.geojson')).features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]));
  const long = rings.filter((r) => r.length > 2000).slice(0, 6);
  assert.ok(long.length >= 3);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const ring of long) {
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let n = 0; n < 400; n++) {
      const lon = x0 + (x1 - x0) * (1.2 * rnd() - 0.1), lat = n % 4 === 0 ? ring[Math.floor(rnd() * ring.length)][1] : y0 + (y1 - y0) * (1.2 * rnd() - 0.1);
      assert.equal(insideRing(ring, lon, lat), naive(ring, lon, lat), `${lon},${lat}`);
    }
  }
});

test('a zoom-10 scene with the ornaments on is built in seconds, not tens of them', async () => {
  const opts = { view: { lon: 8.93, lat: 44.41, zoom: 10 }, scale: 'off', density: 1 };
  await createScene(env, opts); // warm: the data, the fonts and the ring indexes
  const t = performance.now();
  await createScene(env, opts);
  const ms = performance.now() - t;
  // ~0.8 s measured with the index on a loaded 16-thread laptop, 4 s without it; the bound is for a slow, busy runner
  assert.ok(ms < 3500, `${Math.round(ms)} ms`);
});
