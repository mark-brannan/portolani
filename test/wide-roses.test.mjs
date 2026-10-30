// At every view a rose is held to the share of the page a world chart's own takes (docs/ornaments-at-wide-views.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, ROSE_CAP, W } from '../scripts/scene.mjs';
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

for (const [name, view] of [['default view', { lon: 7, lat: 40, zoom: 5.4 }], ['world', { lon: -60.871, lat: 28.736, zoom: 2.15 }], ['overview', { lon: -75, lat: 18, zoom: 6 }], ['region', { lon: 7, lat: 40, zoom: 8 }], ['close', { lon: 9, lat: 42, zoom: 10 }]]) {
  test(`no rose over ${ROSE_CAP.big * 100}% of the page (${name})`, async () => {
    const { scene } = await createScene(env, { view, scale: 'off', historical: false });
    assert.ok(scene.roseDraws.length > 0);
    for (const r of scene.roseDraws) assert.ok(r.size <= ROSE_CAP.big * W + 1e-9, `a rose ${r.size} px wide`);
  });
}

test('a shipped sheet that names its own rose is held to the cap too (Catalan Atlas, history on)', async () => {
  const { scene } = await createScene(env, { view: { lon: -20.7, lat: 42.1, zoom: 3 }, scale: 'off', historical: true });
  assert.ok(scene.roseDraws.some((r) => r.sprite.id.startsWith('rose-catalan')), 'the Catalan Atlas rose is drawn');
  for (const r of scene.roseDraws) assert.ok(r.size <= ROSE_CAP.big * W + 1e-9, `a rose ${r.size} px wide`);
});

// #138: the Catalan rose's lines run from the pin at every zoom, so a rose stands there at every zoom,
// whichever sheet the overlap rule keeps over it, and once only.
const atPin = (scene) => scene.roseDraws.filter((r) => Math.hypot(r.x - W / 2, r.y - 500) < 1);
for (const zoom of [2, 5, 8]) {
  test(`the pinned Catalan rose is drawn at the pin, once (zoom ${zoom})`, async () => {
    const { scene } = await createScene(env, { view: { lon: -20.7, lat: 42.1, zoom }, scale: 'off' });
    assert.equal(atPin(scene).length, 1);
    assert.ok(atPin(scene)[0].sprite.id.startsWith('rose-catalan'));
  });
}
test('no pinned rose where the rose lines are off (zoom 8)', async () => {
  const { scene } = await createScene(env, { view: { lon: -20.7, lat: 42.1, zoom: 8 }, scale: 'off', tune: { roselines: 0 } });
  assert.equal(atPin(scene).length, 0);
});
