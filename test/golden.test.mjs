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
import { createScene, drawScene, W, H } from '../scripts/scene.mjs';

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
};

const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const env = {
  createCanvas,
  readJSON: async (p) => JSON.parse(readFileSync(resolve(p), 'utf8')),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

async function renderView(view) {
  const { scene, data, bg } = await createScene(env, { view });
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
    const canvas = await renderView(view);
    const file = join(GOLDEN, `${name}.png`);
    if (UPDATE || !existsSync(file)) {
      mkdirSync(GOLDEN, { recursive: true });
      writeFileSync(file, canvas.toBuffer('image/png'));
      return;
    }
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
