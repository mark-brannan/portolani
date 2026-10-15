// Ornaments per window: roses, monsters and ships with their centre in the window, in a handful of views across the bands, at a
// density (default 1), with the budget they share (docs/measurements.md). Headless, so the 50m land only;
// one scene per view, a few seconds each. Usage: node scripts/measure-ornaments.mjs [density] [seeded]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, W, H } from './scene.mjs';
import { coastNames, joinNames } from './names.mjs';

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

// the first zoom of each band, where a sheet is paced (a window is one sheet or two), over open sea and coast
const VIEWS = [
  { name: 'world, Atlantic', lon: -30, lat: 35, zoom: 2 },
  { name: 'world, North Atlantic', lon: -40, lat: 50, zoom: 3 },
  { name: 'world, Baltic', lon: 20, lat: 60, zoom: 5 },
  { name: 'overview, Caribbean', lon: -75, lat: 18, zoom: 6 },
  { name: 'overview, Mediterranean', lon: 15, lat: 38, zoom: 6 },
  { name: 'overview, Bay of Bengal', lon: 88, lat: 12, zoom: 6 },
  { name: 'general, Aegean', lon: 25, lat: 38, zoom: 8 },
  { name: 'general, Caribbean', lon: -70, lat: 16, zoom: 8 },
  { name: 'coastal, Aegean', lon: 25, lat: 37, zoom: 10 },
  { name: 'coastal, Liguria', lon: 8.93, lat: 44.41, zoom: 10 },
  { name: 'approach, Cyclades', lon: 25.2, lat: 37.1, zoom: 12 },
  { name: 'harbour, Genoa', lon: 8.93, lat: 44.41, zoom: 14 },
];
const density = Number(process.argv[2] ?? 1), historical = process.argv[3] !== 'seeded';
console.log('| View | Zoom | Roses | Monsters | Ships | Total |\n| --- | ---: | ---: | ---: | ---: | ---: |');
const tot = [];
for (const v of VIEWS) {
  const { scene } = await createScene(env, { view: { lon: v.lon, lat: v.lat, zoom: v.zoom }, scale: 'off', density, historical });
  // the scene holds every figure of the sheets in view; the window holds those whose centre lies on its page
  const inside = (list) => list.filter((o) => o.x >= 0 && o.x <= W && o.y >= 0 && o.y <= H).length;
  const r = inside(scene.roseDraws), m = inside(scene.monsters), s = inside(scene.ships);
  tot.push(r + m + s);
  console.log(`| ${v.name} | ${v.zoom} | ${r} | ${m} | ${s} | ${r + m + s} |`);
}
console.log(`\nmean ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1)}, max ${Math.max(...tot)} of ${tot.length} views at density ${density}`);
