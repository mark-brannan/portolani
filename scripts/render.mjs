// Portolani mockup renderer, Node host: draws the scene from scripts/scene.mjs to PNG with
// @napi-rs/canvas. The browser host is public/page.js; both share the scene code.
//
// Usage: npm run render   -> out/mockup.png, out/mockup-detail.png

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScene, drawScene, W, H, DETAIL } from './scene.mjs';
import { seaNames, coastNames, joinNames, redSea } from './names.mjs';
import { joinUrban } from './urban.mjs';
import { cutWater, joinWater, WATER_FILES } from './detail-cells.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));

// Logical paths: geo/<id>.geojson is a coastlines data file, packs/... in the repo; the names are
// made here from the marine download and the coastlines countries, the urban footprints from the
// urban areas download (npm run build:preview fetches it), the towns drawn as icons without it;
// the 10m water cells (geo/water-10m/) are cut here from the rivers and lakes downloads and their
// regional supplements, the 50m water drawn at every zoom without them.
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
let made, urban;
const URBAN = join(DL, 'ne_10m_urban_areas.geojson');
const footprints = () => urban ??= existsSync(URBAN) ? joinUrban(read(join(GEO, 'ne-populated-places-50m.geojson')), read(URBAN))
  : (console.warn(`${URBAN} is missing; towns are drawn as icons`), Promise.reject(new Error('no urban areas')));
// the world files are needed; a missing regional supplement is left out with a warning
const [RIVERS_10M, LAKES_10M] = [WATER_FILES.rivers[0], WATER_FILES.lakes[0]].map((f) => join(DL, f));
const waterFiles = (fs) => joinWater(fs.map((f) => (existsSync(join(DL, f)) ? read(join(DL, f)) : (console.warn(`${join(DL, f)} is missing; its rivers or lakes are left out`), null))));
let water10m;
const waterCells = () => water10m ??= existsSync(RIVERS_10M) && existsSync(LAKES_10M) ? cutWater(waterFiles(WATER_FILES.rivers), waterFiles(WATER_FILES.lakes))
  : (console.warn(`${RIVERS_10M} or ${LAKES_10M} is missing; rivers and lakes are drawn from 50m`), null);
const water = (p) => {
  const cells = waterCells(), k = p.slice('geo/water-10m/'.length, -'.json'.length);
  if (!cells) throw new Error('no 10m water');
  return k === 'index' ? { cell: 5, cells: [...cells.keys()] } : cells.get(k);
};
const names = () => made ??= joinNames(seaNames(read(join(DL, 'ne_50m_geography_marine_polys.geojson'))),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : p === 'geo/urban-10m.json' ? footprints() : p === 'geo/red-sea-50m.json' ? redSea(read(join(DL, 'ne_50m_geography_marine_polys.geojson')))
    : p.startsWith('geo/water-10m/') ? water(p) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(DL, 'IMFeENrm28P.ttf'), family); GlobalFonts.registerFromPath(join(DL, 'IMFeENit28P.ttf'), family); },
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
