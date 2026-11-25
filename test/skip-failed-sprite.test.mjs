// A sprite whose picture will not load is left out of the scene, and the rest is drawn: one bad file never blanks the map.
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
const BAD = 'packs/scanned/rose-oliva.webp';
const env = {
  skipFailed: true,
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => (p === BAD ? Promise.reject(new Error(`${p}: image failed`)) : loadImage(resolve(p))),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

test('a rose whose file fails is skipped and the other roses are drawn', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const { scene } = await createScene(env, { view: { lon: 7, lat: 40, zoom: 5.4 }, scale: 'off', historical: false });
  assert.ok(scene.roseDraws.length > 0, 'roses are drawn');
  assert.ok(scene.roseDraws.every((r) => r.sprite.id !== 'rose-oliva'), 'the failed rose is not');
  assert.ok(console.warn.mock.calls.some((c) => String(c.arguments[0]).includes('rose-oliva')), 'the skip is warned');
});

test('a host that does not ask to skip fails loudly on a bad sprite', async () => {
  await assert.rejects(createScene({ ...env, skipFailed: false }, { view: { lon: 7, lat: 40, zoom: 5.4 }, scale: 'off', historical: false }), /image failed/);
});
