// The placement a link names (#162): each mode parses, and a given seed reproduces the same scene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, parsePlacement } from '../scripts/scene.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

test('each placement mode parses; no flag is the default', () => {
  assert.deepEqual(parsePlacement(null), { historical: true, text: '' });
  assert.deepEqual(parsePlacement('historic'), { historical: true, text: 'historic' });
  assert.deepEqual(parsePlacement('seeded'), { historical: false, text: 'seeded' });
  assert.deepEqual(parsePlacement('seed:12345'), { historical: false, seed: 12345, text: 'seed:12345' });
  assert.deepEqual(parsePlacement('seed:-7'), { historical: false, seed: -7, text: 'seed:-7' });
  for (const bad of ['seed:', 'seed:x', 'seed:1.5', 'Seeded', 'nonsense']) assert.deepEqual(parsePlacement(bad), { historical: true, text: '' }, bad);
});

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
const view = { lon: 7, lat: 40, zoom: 5.4 };
const figures = async (placement) => {
  const { scene } = await createScene(env, { view, scale: 'off', ...parsePlacement(placement) });
  const at = (a) => a.map((f) => [f.sprite.id, Math.round(f.x ?? f.lon * 1e3), Math.round(f.y ?? f.lat * 1e3)]);
  return JSON.stringify({ roses: at(scene.roseDraws), monsters: at(scene.monsters ?? []), ships: at(scene.ships ?? []) });
};

test('a seed reproduces its scene, and another seed draws another', async () => {
  const a = await figures('seed:4242'), b = await figures('seed:4242'), c = await figures('seed:99');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, await figures('seeded'));
});

test('no flag draws what it drew before: the default is historic', async () => {
  assert.equal(await figures(''), await figures('historic'));
});
