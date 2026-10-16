// #131 step 6: the late drawings a drag frame holds (LATE in scene.mjs) stand on the earth: dragging 10 px east
// draws each of them 10 px east of where it stood, unchanged. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, anchorScene, drawLate, panView, LATE, IN_DRAG, W, H } from '../scripts/scene.mjs';
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

const frame = (a, view, layer) => {
  const g = createCanvas(W, H).getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawLate(g, a, view, [layer]);
  return g.getImageData(0, 0, W, H).data;
};
// ink in the middle of the page, and how much of it the same drawing 10 px over has also (alpha channel only)
const held = (before, after, dx) => {
  let ink = 0, same = 0;
  for (let y = 100; y < H - 100; y++) for (let x = 300; x < W - 300; x++) {
    const a = before[(y * W + x) * 4 + 3];
    if (a < 200) continue;
    ink++;
    if (after[(y * W + x + dx) * 4 + 3] >= 200) same++;
  }
  return { ink, share: same / ink };
};

for (const [layer, view] of [['relief', { lon: 8.93, lat: 44.41, zoom: 6 }], ['trees', { lon: 8.93, lat: 44.41, zoom: 8 }], ['worldNames', { lon: 10, lat: 30, zoom: 3 }]]) {
  test(`a drag frame holds the ${layer} to the earth`, async () => {
    const { scene, data } = await createScene(env, { view, scale: 'off', relief: ['marina'], trees: 'marina', continents: true, regions: 'latin', continentsZoom: 6, regionsZoom: 8 });
    const a = anchorScene(scene, data), moved = panView(view, 10, 0);
    const { ink, share } = held(frame(a, view, layer), frame(a, moved, layer), 10);
    assert.ok(ink > 500, `${layer} drew ${ink} px of ink to compare`);
    assert.ok(share > 0.95, `${layer}: ${(share * 100).toFixed(1)}% of its ink stood 10 px east after a 10 px drag east`);
  });
}

test('IN_DRAG names the whole zooms for every late layer', () => {
  for (const l of LATE) assert.ok(IN_DRAG[l] instanceof Set, l);
});
