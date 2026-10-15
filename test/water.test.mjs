// Rivers and lakes past z7: Natural Earth 10m and its regional supplements cut into cells (detail-cells.mjs cutWater)
// where the site has them, the 50m files where it does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { shapefilePolygons } from 'coastlines';
import { cutLakes, cutWater, dbfRecords, gshhgLakes, joinWater, WATER_FILES } from '../scripts/detail-cells.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const DL = process.env.PORTOLANI_DOWNLOADS ?? join(ROOT, 'downloads');
const WATER = [...WATER_FILES.rivers, ...WATER_FILES.lakes].map((f) => join(DL, f));
const HAVE_10M = WATER.every(existsSync);
const GSHHG = join(DL, 'gshhg-shp-2.3.7.zip'), HAVE_GSHHG = HAVE_10M && existsSync(GSHHG);
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));

// offline but for the 10m downloads, as test/golden.test.mjs: no urban footprints, no detail land cells
let made;
const names = () => made ??= joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const base = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};
let cells;
const with10m = { ...base, readJSON: async (p) => {
  if (!p.startsWith('geo/water-10m/')) return base.readJSON(p);
  cells ??= cutWater(...['rivers', 'lakes'].map((k) => joinWater(WATER_FILES[k].map((f) => read(join(DL, f))))));
  const k = p.slice('geo/water-10m/'.length, -'.json'.length);
  return k === 'index' ? { cell: 5, cells: [...cells.keys()] } : cells.get(k);
} };

// and the GSHHG "h" lakes, cut as scripts/build-preview.mjs cuts them into geo/h-lakes/
let lakeCells;
const withLakes = { ...with10m, readJSON: async (p) => {
  if (!p.startsWith('geo/h-lakes/')) return with10m.readJSON(p);
  if (!lakeCells) {
    const { zipMember } = await import(new URL('zip.js', import.meta.resolve('coastlines')));
    const zip = readFileSync(GSHHG), member = (level, ext) => zipMember(zip, `GSHHS_shp/h/GSHHS_h_L${level}.${ext}`);
    lakeCells = cutLakes(gshhgLakes(...[2, 3].flatMap((level) => [shapefilePolygons(member(level, 'shp')), dbfRecords(member(level, 'dbf'))])), 1);
  }
  const k = p.slice('geo/h-lakes/'.length, -'.json'.length);
  return k === 'index' ? { cell: 1, cells: [...lakeCells.keys()] } : lakeCells.get(k);
} };

// Lake Maggiore: 50m has the Ticino through it but not the lake; 10m has the lake and the Toce too
const VIEW = { lon: 8.6, lat: 45.95, zoom: 11 };
const LEMAN = { lon: 6.6, lat: 46.45, zoom: 11 }; // Lake Geneva and the Rhône, in 50m too
const OPTS = { view: VIEW, scale: 'off', kinds: [], names: false, rhumb: false, continents: false, rivers: 'marina', lakes: 'marina' };
// each case in its own copy of the scene module, which keeps the bands and cells it has loaded
const scene = (tag) => import(`../scripts/scene.mjs?${tag}`);
const counts = (m, data) => { const k = m.keptWater(data); return { rivers: k.rivers.length, lakes: k.lakes.length }; };

test('past z7 the 10m files keep more rivers and lakes than 50m alone', { skip: !HAVE_10M && 'no 10m rivers and lakes downloads' }, async () => {
  const fine = await scene('10m'), coarse = await scene('50m');
  const a = counts(fine, (await fine.createScene(with10m, OPTS)).data);
  const b = counts(coarse, (await coarse.createScene(base, OPTS)).data);
  assert.ok(a.rivers > b.rivers, `rivers: 10m ${a.rivers}, 50m ${b.rivers}`);
  assert.ok(a.lakes > b.lakes, `lakes: 10m ${a.lakes}, 50m ${b.lakes}`);
});

// Seattle at z8: Lake Washington is in the North America supplement only; 50m has Lake Chelan and no more
const SEATTLE = { lon: -122.136, lat: 47.614, zoom: 8.15 };
test('past z7 a view over Seattle keeps Lake Washington, which 50m lacks', { skip: !HAVE_10M && 'no 10m rivers and lakes downloads' }, async () => {
  const fine = await scene('10m-seattle'), coarse = await scene('50m-seattle');
  const names = (m, data) => m.keptWater(data).lakes.map((l) => l.key);
  const a = names(fine, (await fine.createScene(with10m, { ...OPTS, view: SEATTLE })).data);
  const b = names(coarse, (await coarse.createScene(base, { ...OPTS, view: SEATTLE })).data);
  assert.ok(a.includes('Lake Washington'), `10m lakes: ${a.join(', ')}`);
  assert.ok(!b.includes('Lake Washington'), `50m lakes: ${b.join(', ')}`);
});

// Kunming at z10.5: Dian Chi is in no Natural Earth file, only in GSHHG's lakes. Over Otsu, GSHHG's
// Biwa stands in for Natural Earth's, which is dropped so the lake is drawn once. By Sudbury, Lake
// Panache lies inside GSHHG Superior's box but not its water, so it stays.
const KUNMING = { lon: 102.7, lat: 24.9, zoom: 10.5 }, DIAN_CHI = [102.69, 24.85];
const OTSU = { lon: 135.9, lat: 35.05, zoom: 10.5 }, SUDBURY = { lon: -81.4, lat: 46.2, zoom: 10.5 };
test('past z10 GSHHG lakes draw what Natural Earth lacks, Dian Chi at Kunming, and a lake once but every lake', { skip: !HAVE_GSHHG && 'no 10m water or GSHHG downloads' }, async () => {
  const holds = (l, [lon, lat]) => l.box.x0 <= lon && lon <= l.box.x1 && l.box.y0 <= lat && lat <= l.box.y1;
  const kept = async (tag, env, view) => { const m = await scene(tag); return m.keptWater((await m.createScene(env, { ...OPTS, view })).data).lakes; };
  const ne = await kept('kunming-10m', with10m, KUNMING), both = await kept('kunming-gshhg', withLakes, KUNMING);
  assert.ok(!ne.some((l) => holds(l, DIAN_CHI)), `10m lakes: ${ne.map((l) => l.key).join(', ')}`);
  assert.ok(both.some((l) => l.key.startsWith('gshhg-') && holds(l, DIAN_CHI)), `lakes: ${both.map((l) => l.key).join(', ')}`);
  const otsu = (await kept('otsu-gshhg', withLakes, OTSU)).map((l) => l.key);
  assert.ok(!otsu.includes('Biwa Ko') && otsu.some((k) => k.startsWith('gshhg-')), `Otsu lakes: ${otsu.join(', ')}`);
  const sudbury = (await kept('sudbury-gshhg', withLakes, SUDBURY)).map((l) => l.key);
  assert.ok(sudbury.includes('Lake Panache'), `Sudbury lakes: ${sudbury.join(', ')}`);
});

test('without the 10m files a close view still draws its 50m rivers and lakes', async () => {
  const m = await scene('none');
  const draw = async (opts) => {
    const { scene: s, data, bg } = await m.createScene(base, { ...OPTS, view: LEMAN, ...opts });
    const c = createCanvas(m.W, m.H);
    m.drawScene(c.getContext('2d'), s, data, bg, { scale: 1, x: 0, y: 0 });
    return { px: c.getContext('2d').getImageData(0, 0, m.W, m.H).data, kept: counts(m, data) };
  };
  const wet = await draw({}), dry = await draw({ rivers: 'off', lakes: 'off' });
  assert.ok(wet.kept.rivers > 0 && wet.kept.lakes > 0, JSON.stringify(wet.kept));
  let changed = 0;
  for (let i = 0; i < wet.px.length; i += 4) if (Math.abs(wet.px[i] - dry.px[i]) + Math.abs(wet.px[i + 2] - dry.px[i + 2]) > 30) changed++;
  assert.ok(changed > 1000, `${changed} px drawn`);
});
