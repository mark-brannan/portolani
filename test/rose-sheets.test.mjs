// Roses and rhumb lines belong to the atlas's sheets, not the window (docs/atlas/README.md). Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, viewProjection } from '../scripts/scene.mjs';
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

// where a rose stands on the earth, to a millionth of a degree, with the sheet it belongs to
const earth = async (view) => {
  const { scene, data } = await createScene(env, { view, scale: 'off' });
  return {
    roses: scene.roseDraws.map((r) => `${r.sheet} ${r.sprite.id} ${data.proj.invert(r.x, r.y).map((v) => v.toFixed(6)).join(' ')}`).sort(),
    lines: scene.sheets.map((s) => `${s.name} ${s.reach.toFixed(6)}`).sort(),
  };
};

test('two views over one part of the world put the roses at the same map positions', async () => {
  const a = await earth({ lon: 8.93, lat: 44.41, zoom: 9 });
  const b = await earth({ lon: 9.05, lat: 44.35, zoom: 9 }); // dragged, the windows overlapping
  assert.ok(a.roses.length > 0, 'a rose is placed');
  const shared = a.lines.filter((l) => b.lines.includes(l)).map((l) => l.split(' ')[0]);
  assert.ok(shared.length > 0, 'the views share a sheet');
  for (const sheet of shared) {
    const of = (e) => e.roses.filter((r) => r.startsWith(sheet));
    assert.deepEqual(of(a), of(b));
  }
});

test('past the middle of a band, the next band\'s sheets keep a rose in a window that falls between the nodes', async () => {
  for (const view of [{ lon: 8.93, lat: 44.2, zoom: 9.9 }, { lon: 9.05, lat: 44.15, zoom: 9.9 }]) {
    const { scene } = await createScene(env, { view, scale: 'off' });
    const seen = scene.roseDraws.filter((r) => r.x > 0 && r.x < 1600 && r.y > 0 && r.y < 1000);
    assert.ok(seen.some((r) => r.sheet.startsWith('PT3')), `a coastal sheet's rose shows at ${view.lon} ${view.lat}`);
  }
});
