// Portolani mockup renderer, Node host: draws the scene from scripts/scene.mjs to PNG with
// @napi-rs/canvas. The browser host is public/page.js; both share the scene code.
//
// Usage: npm run render   -> out/mockup.png, out/mockup-detail.png

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScene, drawScene, W, H, DETAIL } from './scene.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads');

// Logical paths: geo/<name>.geojson lives in downloads/, packs/... in the repo.
const resolve = (p) => (p.startsWith('geo/') ? join(DL, p.slice(4)) : join(ROOT, p));
const env = {
  createCanvas,
  readJSON: async (p) => JSON.parse(readFileSync(resolve(p), 'utf8')),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(DL, 'IMFeENrm28P.ttf'), family); },
};

const t0 = performance.now();
const { scene, data, bg, proj, timing } = await createScene(env);

function render(file, view) {
  const t = performance.now();
  const canvas = createCanvas(W, H);
  drawScene(canvas.getContext('2d'), scene, data, bg, view);
  const tDraw = performance.now();
  mkdirSync(join(ROOT, 'out'), { recursive: true }); writeFileSync(join(ROOT, 'out', file), canvas.toBuffer('image/png'));
  return { draw: tDraw - t, encode: performance.now() - tDraw };
}

const full = render('mockup.png', { scale: 1, x: 0, y: 0 });
const [gx, gy] = proj.project(DETAIL.lon, DETAIL.lat);
const vw = W / DETAIL.scale, vh = H / DETAIL.scale;
const detailView = {
  scale: DETAIL.scale,
  x: Math.max(0, Math.min(W - vw, gx - vw / 2)),
  y: Math.max(0, Math.min(H - vh, gy - vh / 2)),
};
const detail = render('mockup-detail.png', detailView);

const ms = (v) => `${v.toFixed(0)} ms`;
console.log(`zoom ~${proj.zoom.toFixed(2)} (512 px tiles); land polys ${data.land.length}, coast lines ${data.coast.length}, towns ${scene.towns.length}, names ${scene.names.length}, roses ${scene.roseDraws.length}, monsters ${scene.monsters.map((m) => m.sprite.id).join(' ')}, ships ${scene.ships.map((s) => s.sprite.id).join(' ')}`);
console.log(`load ${ms(timing.load)}; placement + parchment ${ms(timing.place)}; mockup draw ${ms(full.draw)} + encode ${ms(full.encode)}; detail draw ${ms(detail.draw)} + encode ${ms(detail.encode)}; total ${ms(performance.now() - t0)}`);
