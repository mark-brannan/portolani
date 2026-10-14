// Golden images: three views of the chart (world, region, close) drawn in Node and compared with
// the committed PNGs in test/golden/. Only data in node_modules and committed fixtures is read, so
// it runs offline. Regenerate after a change that is meant to move the pixels:
//   npm run golden
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, drawScene, SCALE_NAMES, W, H } from '../scripts/scene.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = join(ROOT, 'test', 'golden');
const OUT = join(ROOT, 'out', 'golden-diff');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const SW = 400, SH = 250;     // goldens are the 1600 x 1000 canvas shrunk 4x, to keep them small
const CHANNEL = 24;          // a pixel differs when any channel moves more than this
const SHARE = 0.005;         // and the views differ when more than this share of pixels do

const VIEWS = {
  'world-z2': { lon: 10, lat: 30, zoom: 2 },
  'region-z5': { lon: 8.93, lat: 44.41, zoom: 5 },
  'close-z9': { lon: 8.93, lat: 44.41, zoom: 9 },
  'world-z2-plate-carree': { lon: 10, lat: 30, zoom: 2, projection: 'plate-carree' }, // rhumb lines bow
};
// settings a golden draws with beyond the defaults; region-z5 is the README's picture, lettered PORTOLANI
const OPTS = { 'region-z5': { autoTitle: false } };

const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
// seas from the committed fixture (seaNames of the marine download), countries from coastlines
let made;
const names = () => made ??= joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

async function renderView(view, scale = 'off', opts = {}) {
  const { scene, data, bg } = await createScene(env, { view, scale, ...opts });
  const full = createCanvas(W, H);
  drawScene(full.getContext('2d'), scene, data, bg, { scale: 1, x: 0, y: 0 });
  const small = createCanvas(SW, SH);
  const g = small.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(full, 0, 0, SW, SH);
  return small;
}

const pixels = (canvas) => canvas.getContext('2d').getImageData(0, 0, SW, SH).data;

for (const [name, view] of Object.entries(VIEWS)) {
  test(`golden image: ${name}`, async () => {
    const canvas = await renderView(view, 'off', OPTS[name]);
    const file = join(GOLDEN, `${name}.png`);
    if (UPDATE) {
      mkdirSync(GOLDEN, { recursive: true });
      writeFileSync(file, canvas.toBuffer('image/png'));
      return;
    }
    assert.ok(existsSync(file), `${name}: no golden image; run npm run golden and commit test/golden/${name}.png`);
    const want = createCanvas(SW, SH);
    want.getContext('2d').drawImage(await loadImage(file), 0, 0);
    const a = pixels(canvas), b = pixels(want);
    const diff = createCanvas(SW, SH), dg = diff.getContext('2d'), out = dg.createImageData(SW, SH);
    let bad = 0;
    for (let i = 0; i < a.length; i += 4) {
      const off = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      const hit = off > CHANNEL;
      if (hit) bad++;
      out.data.set(hit ? [255, 0, 0, 255] : [a[i] >> 1, a[i + 1] >> 1, a[i + 2] >> 1, 255], i);
    }
    const share = bad / (SW * SH);
    if (share > SHARE) {
      mkdirSync(OUT, { recursive: true });
      dg.putImageData(out, 0, 0);
      writeFileSync(join(OUT, `${name}.png`), diff.toBuffer('image/png'));
      writeFileSync(join(OUT, `${name}-got.png`), canvas.toBuffer('image/png'));
    }
    assert.ok(share <= SHARE, `${name}: ${(share * 100).toFixed(2)}% of pixels differ (limit ${SHARE * 100}%); diff in out/golden-diff/${name}.png`);
  });
}

// The goldens render with the bar off, so draw each style here: it must paint something at z5 and
// nothing at z2 (below SCALE_MIN_ZOOM).
const differs = (a, b) => { const p = pixels(a), q = pixels(b); for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return true; return false; };

// Continent and region lettering is off by default (the goldens hold it off); each setting draws
// its names in the zooms it belongs to and nowhere else.
test('world lettering: continents at z2, regions at z5, nothing by default', async () => {
  const count = async (view, opts) => (await createScene(env, { view, ...opts })).scene.worldNames.length;
  assert.equal(await count(VIEWS['world-z2']), 0);
  assert.equal(await count(VIEWS['region-z5']), 0);
  assert.ok(await count(VIEWS['world-z2'], { continents: true }) > 0, 'no continents at z2');
  assert.equal(await count(VIEWS['region-z5'], { continents: true }), 0);
  assert.equal(await count(VIEWS['world-z2'], { regions: 'latin' }), 0);
  assert.ok(await count(VIEWS['region-z5'], { regions: 'latin' }) > 0, 'no regions at z5');
  assert.ok(await count(VIEWS['region-z5'], { regions: 'english' }) > 0, 'no regions at z5');
  // drawn on their own setting, with the other names off
  const { scene, data, bg } = await createScene(env, { view: VIEWS['world-z2'], names: false, continents: true });
  const draw = (s) => { const c = createCanvas(W, H); drawScene(c.getContext('2d'), s, data, bg, { scale: 1, x: 0, y: 0 }); return c.getContext('2d').getImageData(0, 0, W, H).data; };
  const a = draw(scene), b = draw({ ...scene, worldNames: [] });
  assert.ok(a.some((v, i) => v !== b[i]), 'continents hidden with Names off');
});

test('scale bar: every style draws at z5 and is hidden at z2', async () => {
  const near = await renderView(VIEWS['region-z5']);
  const far = await renderView(VIEWS['world-z2']);
  for (const name of SCALE_NAMES) {
    assert.ok(differs(await renderView(VIEWS['region-z5'], name), near), `${name}: bar not drawn at z5`);
    assert.ok(!differs(await renderView(VIEWS['world-z2'], name), far), `${name}: bar drawn at z2`);
  }
});

// By default the cartouche names what the view is about, at the zoom that name belongs to; custom,
// it says its typed title, PORTOLANI unless told otherwise.
test('cartouche title: automatic from the view by default, or custom', async () => {
  const title = async (view, opts) => (await createScene(env, { view, ...opts })).scene.cartouche.title;
  assert.equal(await title(VIEWS['world-z2']), 'AFRICA');
  assert.equal(await title(VIEWS['region-z5'], { autoTitle: false }), 'PORTOLANI');
  assert.equal(await title(VIEWS['region-z5'], { autoTitle: false, title: 'Mare Nostrum' }), 'Mare Nostrum');
  assert.equal(await title(VIEWS['world-z2'], { autoTitle: true }), 'AFRICA');
  assert.equal(await title({ lon: -4, lat: 45.5, zoom: 5.5 }, { autoTitle: true }), 'BAY OF BISCAY');
  assert.equal(await title({ lon: -9.14, lat: 38.7, zoom: 8 }, { autoTitle: true }), 'LISBON');
  assert.equal(await title(VIEWS['region-z5'], { autoTitle: true, regions: 'english' }), 'ITALY');
});

test('cartouche takes empty land over a coast', async () => {
  const view = { lon: -122.747, lat: 47.642, zoom: 7 }; // Puget Sound: bare land to the north-east
  const { scene } = await createScene(env, { view, scale: 'chequer' });
  assert.ok(scene.cartouche.x > W / 2 && scene.cartouche.y < H / 2, 'cartouche not in the empty top-right corner');
});
