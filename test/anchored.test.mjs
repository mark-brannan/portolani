// Ornaments anchored to the earth: a moving frame draws the placed ornaments through the live
// projection. Offline, as the goldens are. Prints the frame cost at z5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, anchorScene, drawAnchored, viewProjection, paperSheet, W, H } from '../scripts/scene.mjs';
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
const VIEW = { lon: 8.93, lat: 44.41, zoom: 5 };

test('anchored ornaments land where they were placed at the placed view, and slide with a pan', async () => {
  const { scene, data, bg } = await createScene(env, { view: VIEW, scale: 'off' });
  const a = anchorScene(scene, data);
  assert.ok(a.roses.length > 0 && a.rays.length > 0);
  const here = viewProjection(VIEW);
  for (const { o, at } of a.roses) {
    const [x, y] = here.project(...at);
    assert.ok(Math.hypot(x - o.x, y - o.y) < 0.5, 'a rose projects back to where it was placed');
  }
  // panned east by one degree, a rose sits left of where it was
  const east = viewProjection({ ...VIEW, lon: VIEW.lon + 1 });
  const [x] = east.project(...a.roses[0].at);
  assert.ok(x < a.roses[0].o.x - 10, 'the rose slid west with the earth');
  const g = createCanvas(W, H).getContext('2d');
  g.drawImage(paperSheet(bg, viewProjection(VIEW)), 0, 0);
  const before = g.getImageData(0, 0, W, H).data.slice();
  const times = [];
  for (let i = 0; i < 5; i++) { const t = performance.now(); drawAnchored(g, a, bg, { ...VIEW, lon: VIEW.lon + i * 0.2 }); times.push(performance.now() - t); }
  times.sort((p, q) => p - q);
  console.log(`# anchored frame at z5, median ${times[2].toFixed(0)} ms (node, napi canvas)`);
  const after = g.getImageData(0, 0, W, H).data;
  let moved = 0;
  for (let i = 0; i < after.length; i += 4) if (after[i] !== before[i]) moved++;
  assert.ok(moved > 1000, 'ornaments were drawn');

  const coast = a.names.filter((n) => Array.isArray(n.at[0]));
  assert.ok(coast.length > 0, 'the view has coast names');
  const h = createCanvas(W, H).getContext('2d');
  h.drawImage(paperSheet(bg, viewProjection(VIEW)), 0, 0);
  const blank = h.getImageData(0, 0, W, H).data.slice();
  drawAnchored(h, { ...a, towns: [], show: { ...a.show, rhumb: false, scale: "off", kinds: new Set(), names: true }, names: coast }, bg, VIEW);
  const inked = h.getImageData(0, 0, W, H).data;
  let drawn = 0;
  for (let i = 0; i < inked.length; i += 4) if (inked[i] !== blank[i]) drawn++;
  assert.ok(drawn > 100, 'a coast name is lettered in a moving frame');
});

// The paper's marks (mottling, grain, foxing) are the earth's, not the window's: panned by a whole
// number of px, the paper inside the rim's vignette is the same paper moved by that much; on the
// globe, where a pan turns the earth under the window, the paper is plain and the same everywhere.
test('the paper travels with the map as it pans; on the globe it is plain', async () => {
  const { bg } = await createScene(env, { view: VIEW, scale: 'off' });
  const DX = 64, k = viewProjection(VIEW).k, panned = { ...VIEW, lon: VIEW.lon + DX / k / (Math.PI / 180) };
  const pixels = (view) => paperSheet(bg, viewProjection(view)).getContext('2d').getImageData(0, 0, W, H).data.slice();
  const here = pixels(VIEW), there = pixels(panned);
  const diff = (shift) => { // mean channel difference over the middle, where the vignette is clear
    let sum = 0, n = 0;
    for (let y = H / 2 - 150; y < H / 2 + 150; y++) for (let x = W / 2 - 250; x < W / 2 + 250; x++) {
      const i = (y * W + x) * 4, j = (y * W + x - shift) * 4;
      for (let c = 0; c < 3; c++) { sum += Math.abs(here[i + c] - there[j + c]); n++; }
    }
    return sum / n;
  };
  assert.ok(diff(DX) < 0.5, `the same place on the paper is the same paper after the pan (${diff(DX).toFixed(2)})`);
  assert.ok(diff(0) > 2, `the same place on the window is not (${diff(0).toFixed(2)}): the paper moved`);
  const globe = (lon) => pixels({ ...VIEW, lon, projection: 'orthographic' });
  assert.deepEqual(globe(0), globe(40), 'the globe\'s paper does not change as it turns');
});
