// Under the hood (docs/atlas/under-the-hood.md): the `debug` overlay draws the atlas's sheets and changes nothing
// placed, and the `tune` knobs default to the code's own constants and move what they name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, drawScene, anchorScene, parseTune, parseDebug, tuneOf, TUNE_KNOBS, SHEET_RADIUS, W, H } from '../scripts/scene.mjs';
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
const VIEW = { lon: 7.4, lat: 40.474, zoom: 6.14 }; // view 4 of #199: a curated sheet and grid cells
const placed = (scene) => JSON.stringify([scene.roseDraws, scene.monsters, scene.ships, scene.towns].map((l) => l.map((o) => [o.sprite?.id, Math.round(o.x), Math.round(o.y)])));
const reds = (canvas) => { const d = canvas.getContext('2d').getImageData(0, 0, W, H).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] < 70 && d[i + 2] < 70) n++; return n; };
const draw = ({ scene, data, bg }) => { const c = createCanvas(W, H); drawScene(c.getContext('2d'), scene, data, bg, { scale: 1, x: 0, y: 0 }); return c; };

test('tune text: knobs round-trip, a bad value falls back, a default is left out', () => {
  const all = 'radius:0.5,reach:1.5,origin:zero,curated:0,roselines:0,roseshare:0.6,sheetroses:6';
  assert.equal(parseTune(all).text, all);
  assert.deepEqual(parseTune(all).tune, { radius: 0.5, reach: 1.5, origin: 'zero', curated: 0, roselines: 0, roseshare: 0.6, sheetroses: 6 });
  assert.equal(parseTune('sheetroses:3,radius:0.25').text, 'radius:0.25,sheetroses:3', 'written in one order');
  assert.equal(parseTune('radius:0.9,reach:x,origin:north,curated:2,sheetroses:2.5,roseshare:-1,bogus:1,radius').text, '', 'out of range or malformed');
  assert.equal(parseTune(`radius:${SHEET_RADIUS},reach:1,origin:rose,curated:1,roselines:1`).text, '', 'defaults are not written');
  assert.deepEqual(tuneOf(), Object.fromEntries(Object.entries(TUNE_KNOBS).map(([n, k]) => [n, k.def])));
  assert.equal(tuneOf().radius, SHEET_RADIUS, 'the radius default is the constant');
});

test('debug text: known words kept in one order, any other dropped', () => {
  assert.equal(parseDebug('sheets').text, 'sheets');
  assert.equal(parseDebug('rings,bogus,sheets').text, 'sheets,rings');
  assert.deepEqual(parseDebug('nope').debug, []);
});

test('debug draws the sheets in red over the chart and places nothing differently', async () => {
  const off = await createScene(env, { view: VIEW });
  const on = await createScene(env, { view: VIEW, debug: ['sheets', 'rings', 'bogus'] });
  assert.deepEqual(on.scene.debug, ['sheets', 'rings']);
  assert.equal(placed(on.scene), placed(off.scene));
  assert.equal(anchorScene(on.scene, on.data).rays.length, anchorScene(off.scene, off.data).rays.length);
  const [before, after] = [reds(draw(off)), reds(draw(on))];
  assert.ok(after - before > 1500, `red outlines drawn: ${before} red pixels without, ${after} with`);
});

test('tune: every default spelled out is the scene given none', async () => {
  const none = await createScene(env, { view: VIEW });
  const all = await createScene(env, { view: VIEW, tune: tuneOf() });
  assert.equal(JSON.stringify(all.scene.sheets), JSON.stringify(none.scene.sheets));
  assert.equal(placed(all.scene), placed(none.scene));
});

test('tune: the knobs move what they name', async () => {
  const base = (await createScene(env, { view: VIEW })).scene;
  const sheets = async (tune) => (await createScene(env, { view: VIEW, tune })).scene;
  const zero = await sheets({ origin: 'zero', curated: 0 });
  assert.ok(zero.sheets.every((s) => !s.curated), 'curated 0: grid cells only');
  assert.ok(zero.sheets.every((s) => Math.abs(s.extent.south / 19.2 - Math.round(s.extent.south / 19.2)) < 1e-9 || s.extent.south === -85.0511287798), 'origin zero: rows from the equator');
  const wide = await sheets({ reach: 2, radius: 0.8, curated: 0 });
  const grid = (await sheets({ curated: 0 })).sheets;
  wide.sheets.forEach((s, i) => { assert.ok(s.reach > grid[i].reach || s.reach === 180); assert.equal(s.circle.radius, 0.8); });
  const { data } = await createScene(env, { view: VIEW });
  const noRose = await sheets({ roselines: 0 });
  assert.equal(anchorScene(base, data).rays.length - anchorScene(noRose, data).rays.length >= 32, true, 'the rose\'s 32 lines dropped');
  const one = await sheets({ sheetroses: 1, roseshare: 1 });
  for (const sh of one.sheets.filter((s) => !s.ornaments)) assert.ok(one.roseDraws.filter((r) => r.sheet === sh.name).length <= 1, sh.name);
});
