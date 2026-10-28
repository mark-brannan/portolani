// The Continents and Regions sliders (mark-brannan/portolani#207): at N, "zoom N and out", the names are
// drawn at zoom N and not past it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene } from '../scripts/scene.mjs';
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
const worldNames = async (zoom, opts) => (await createScene(env, { view: { lon: 12, lat: 42, zoom }, scale: 'off', density: 0, ...opts })).scene.worldNames.length;

for (const [layer, opts] of [['continents', { continents: true, continentsZoom: 4 }], ['regions', { regions: 'latin', regionsZoom: 4 }]]) {
  test(`${layer} at 4 are drawn at zoom 4 and not at 4.3`, async () => {
    assert.ok(await worldNames(4, opts) > 0, 'drawn at zoom 4');
    assert.equal(await worldNames(4.3, opts), 0, 'not drawn at zoom 4.3');
  });
}
