#!/usr/bin/env node
// Times one frame of a drag in the Node renderer, layer by layer (#131 step 3): the ground and the
// anchored ornaments a moving frame always draws (base), then each late drawing alone (LATE in
// scene.mjs: relief, trees, worldNames), with every decoration on. Offline: the 50m data in
// node_modules and the committed fixtures. A drag is DRAGS drags of MOVES pointer moves of 6 px east
// and 2 px south each, as scripts/measure-preview.mjs makes; each frame is timed with
// performance.now() around the draw. Prints a markdown table of median / p90 in ms.
//   node scripts/measure-drag.mjs [--layers=relief,trees] [--water=off] [--isle-land=off]
// (--water=off: rivers and lakes not drawn, which the base frame otherwise includes; --isle-land=off: the
// remote islands' 10m outlines, scripts/isles.mjs isleLand, left out of the coarse land)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { joinUrban } from './urban.mjs';
import { createScene, drawScene, anchorScene, drawGround, drawLate, drawAnchored, LATE, IN_DRAG, panView, covers, RIVER_STYLES, LAKE_STYLES, TREE_STYLES, RELIEF_STYLES, W, H } from './scene.mjs';
import { coastNames, joinNames } from './names.mjs';
import { isleLand } from './isles.mjs';
import { geojsonPolygons } from 'coast-wright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const names = joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
// DOWNLOADS=<dir holding ne_10m_urban_areas.geojson>: the 10m urban footprints, which give a city its plan
const urban = process.env.DOWNLOADS && joinUrban(read(join(GEO, 'ne-populated-places-50m.geojson')), read(join(process.env.DOWNLOADS, 'ne_10m_urban_areas.geojson')));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const outlines = flags['isle-land'] === 'off' ? null
  : isleLand(geojsonPolygons(read(join(GEO, 'ne-land-10m.geojson'))), geojsonPolygons(read(join(GEO, 'ne-land-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/urban-10m.json' && urban ? urban : p === 'geo/isles-land.json' && outlines ? outlines : p === 'geo/names-50m.json' ? names : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};
const layers = flags.layers ? flags.layers.split(',') : LATE;
const VIEWS = [['z2', 10, 30, 2], ['Pacific z2', -150, -15, 2], ['z5', 8.93, 44.41, 5], ['Pitcairn Is. z7.3', -127.75, -24.52, 7.31], ['z9', 8.93, 44.41, 9], ['z11', 8.93, 44.41, 11], ['Venice z13', 12.33, 45.44, 13]];
const DRAGS = 5, MOVES = 20, WARM = 10;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const cell = (a) => `${q(a, 0.5).toFixed(1)} / ${q(a, 0.9).toFixed(1)}`;

console.log(`Node ${process.version}, ${os.cpus()[0].model.trim()}, ${os.cpus().length} threads, load ${os.loadavg()[0].toFixed(1)}, ${W}x${H} canvas; ms, median / p90 of ${DRAGS * MOVES} frames. In the drag at zooms: ${JSON.stringify(Object.fromEntries(Object.entries(IN_DRAG).map(([l, z]) => [l, z.size > 20 ? 'all' : [...z]])))}\n`);
console.log(`| View | Base (ground + ornaments) | ${layers.join(' | ')} | All late together |`);
console.log(`| --- | ---: |${layers.map(() => ' ---: |').join('')} ---: |`);
for (const [name, lon, lat, zoom] of VIEWS) {
  const view = { lon, lat, zoom };
  const { scene, data, bg, world, coarse } = await createScene(env, { view, scale: 'off', relief: [RELIEF_STYLES.find((s) => s !== 'off')], trees: TREE_STYLES.find((s) => s !== 'off'),
    rivers: flags.water === 'off' ? 'off' : RIVER_STYLES.find((s) => s !== 'off'), lakes: flags.water === 'off' ? 'off' : LAKE_STYLES.find((s) => s !== 'off'), continents: true, regions: 'latin' });
  const a = anchorScene(scene, data), canvas = createCanvas(W, H), g = canvas.getContext('2d');
  const times = { base: [], all: [], ...Object.fromEntries(layers.map((l) => [l, []])) };
  for (let d = 0; d < DRAGS; d++) {
    let v = view;
    for (let i = 0; i < MOVES + WARM / DRAGS; i++) {
      v = panView(v, d % 2 ? -6 : 6, 2);
      const keep = i >= WARM / DRAGS, w = covers(world, v) ? world : coarse;
      const time = (key, fn) => { g.clearRect(0, 0, W, H); const t = performance.now(); fn(); if (keep) times[key].push(performance.now() - t); };
      time('base', () => { drawGround(g, w, v, bg); drawAnchored(g, a, bg, v, []); });
      for (const l of layers) time(l, () => drawLate(g, a, v, [l]));
      time('all', () => drawLate(g, a, v, layers));
    }
  }
  console.log(`| ${name} | ${cell(times.base)} |${layers.map((l) => ` ${cell(times[l])} |`).join('')} ${cell(times.all)} |`);
}

// What is drawn at the stop and not yet in a drag: the cities' plans and the towns' washes and houses
// (drawScene, steps 3.5 and 4.5), as the cost of the scene's draw with them less without, at scale 1.
console.log(`\nCities and town washes${urban ? ' (10m footprints)' : ' (50m urban areas only: no city plans; set DOWNLOADS for them)'}: drawScene of the whole page, ms, median / p90 of 15 draws.\n`);
console.log('| View | Whole scene | Less the cities | Less the washes and houses | Cities | Washes and houses |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const [name, lon, lat, zoom] of VIEWS.filter((v) => v[3] >= 9).concat([['z12', 8.93, 44.41, 12], ['Venice z12', 12.33, 45.44, 12], ['Venice z13', 12.33, 45.44, 13]])) {
  const { scene, data, bg } = await createScene(env, { view: { lon, lat, zoom }, scale: 'off' });
  const g = createCanvas(W, H).getContext('2d'), v = { scale: 1, x: 0, y: 0 };
  const noCity = { ...scene, towns: scene.towns.filter((t) => !t.city) }, noWash = { ...data, urban: [] };
  const run = (sc, da) => { const out = []; for (let i = 0; i < 15; i++) { g.clearRect(0, 0, W, H); const t = performance.now(); drawScene(g, sc, da, bg, v); out.push(performance.now() - t); } return out; };
  const [all, a, b] = [run(scene, data), run(noCity, data), run(scene, noWash)];
  const diff = (x) => `${(q(all, 0.5) - q(x, 0.5)).toFixed(1)}`;
  console.log(`| ${name} (${scene.towns.filter((t) => t.city).length} cities) | ${cell(all)} | ${cell(a)} | ${cell(b)} | ${diff(a)} | ${diff(b)} |`);
}
