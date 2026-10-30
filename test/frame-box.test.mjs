// Relief and trees are seeded over the lon/lat box a view covers (scripts/frame-box.mjs). On an
// azimuthal projection two corners' lon/lat are no box: a corner may lie off the globe or past a pole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene } from '../scripts/scene.mjs';
import { frameBox, POLE_LAT } from '../scripts/frame-box.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
let made;
const names = () => made ??= joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};
const run = (view, opts = {}) => createScene(env, { view, relief: ['marina'], trees: 'marina', ...opts });
const latOf = (data) => (p) => data.proj.invert(p.x, p.y)[1];

test('a globe that holds a pole is seeded all round it, and one that does not, as before', async () => {
  const polar = (await run({ lon: 0, lat: 80, zoom: 3, projection: 'stereographic' })).data.proj;
  const box = frameBox(polar, 1600, 1000, 140);
  assert.equal(box.latMax, POLE_LAT);
  assert.equal(box.lonMax - box.lonMin, 360, 'every longitude about a pole');
  const flat = (await run({ lon: 15, lat: 62, zoom: 4 })).data.proj;
  const [lonMin, latMax] = flat.invert(-140, -140), [lonMax, latMin] = flat.invert(1740, 1140);
  assert.deepEqual(frameBox(flat, 1600, 1000, 140), { lonMin, lonMax, latMin, latMax }, 'a cylindrical view keeps its corners');
});

test('relief stands across a polar view and a whole-globe view, none on the far side', async () => {
  const polar = await run({ lon: 0, lat: 80, zoom: 3, projection: 'stereographic' });
  const peaks = polar.scene.relief.peaks, lat = latOf(polar.data);
  assert.ok(peaks.filter((p) => lat(p) > 60).length > 8, 'ranges in the Arctic (Greenland, Baffin, Siberia)');
  const globe = await run({ lon: 30, lat: 10, zoom: 2, projection: 'azimuthal-equidistant' });
  assert.ok(globe.scene.relief.peaks.length > 10, `ranges on a view of the whole globe (${globe.scene.relief.peaks.length})`);
  for (const { scene, data } of [polar, globe]) {
    const { proj } = data;
    for (const p of scene.relief.peaks) assert.ok(proj.visible(...proj.invert(p.x, p.y)), 'a peak on the far side');
  }
});

test('trees keep out of the ranges drawn', async () => {
  const { scene, data } = await run({ lon: 15, lat: 62, zoom: 4 });
  assert.ok(scene.relief.peaks.length > 20 && data.trees.length > 0);
  const hit = [];
  for (const s of data.trees) for (const t of s.trees) {
    const x = data.proj.x(s.lon, s.lat) + t.dx, y = data.proj.y(s.lat, s.lon) + t.dy;
    for (const p of scene.relief.peaks) if (x > p.x - p.w / 2 && x < p.x + p.w / 2 && y > p.y - p.h && y < p.y) hit.push([x, y]);
  }
  assert.equal(hit.length, 0, `${hit.length} trees stand in a range`);
});
