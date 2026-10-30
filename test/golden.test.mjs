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
import { createScene, drawScene, doubtMarks, SCALE_NAMES, RIVER_STYLES, LAKE_STYLES, TREE_STYLES, RELIEF_STYLES, PROJECTION_NAMES, W, H } from '../scripts/scene.mjs';
import { VOYAGE_CONTRAST } from '../scripts/voyages.mjs';
import { plantTrees } from '../scripts/trees.mjs';
import { compare, CHANNEL } from '../scripts/golden-compare.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN = join(ROOT, 'test', 'golden');
const OUT = join(ROOT, 'out', 'golden-diff');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const SW = 400, SH = 250;     // goldens are the 1600 x 1000 canvas shrunk 4x, to keep them small
const SHARE = 0.005;         // and the views differ when more than this share of pixels do

const VIEWS = {
  'world-z2': { lon: 10, lat: 30, zoom: 2 },
  'region-z5': { lon: 8.93, lat: 44.41, zoom: 5 },
  'close-z9': { lon: 8.93, lat: 44.41, zoom: 9 },
  'world-z2-plate-carree': { lon: 10, lat: 30, zoom: 2, projection: 'plate-carree' }, // rhumb lines bow
  'world-z2-orthographic': { lon: 10, lat: 30, zoom: 2, projection: 'orthographic' }, // the globe, cut at the horizon
  'world-z2-voyage': { lon: 10, lat: 30, zoom: 2 }, // Magellan's Pacific crossing, cut at the seam
  'world-z2-voyages': { lon: -20, lat: 15, zoom: 2 }, // three voyages at once, each in its own ink, at the bold weight
  'world-z2-person': { lon: 40, lat: 25, zoom: 2 }, // a person chosen: Ibn Battuta's journeys lit in red with his birth marked, Columbus dimmed
  'pacific-z3-migrations': { lon: -170, lat: -15, zoom: 3 }, // two migrations, chevrons over a soft ribbon, across the date line
  'china-z5-doubt': { lon: 117, lat: 35, zoom: 5 }, // a doubted leg: its rings, and its cloud on empty land (Ibn Battuta to Khanbaliq)
  'sheet-z3-voyage': { lon: -30, lat: 15, zoom: 3 }, // de la Cosa's sheet laid over the Atlantic with Columbus's voyage drawn over it, in a colour that reads against the scan
  'old-world-z2.6-1375': { lon: 62, lat: 33, zoom: 2.6 }, // the regions in the Catalan Atlas's names, read in English (docs/period-names)
};
// settings a golden draws with beyond the defaults; region-z5 is the README's picture, lettered PORTOLANI
const OPTS = { 'region-z5': { autoTitle: false }, 'world-z2-voyage': { voyages: [{ id: 'magellan' }] },
  'world-z2-voyages': { voyages: [{ id: 'columbus' }, { id: 'da-gama' }, { id: 'drake' }].map((v) => ({ ...v, width: 3.2 })) },
  'world-z2-person': { person: 'ibn-battuta', voyages: [{ id: 'columbus' }] },
  'pacific-z3-migrations': { voyages: [{ id: 'lapita-expansion' }, { id: 'east-polynesia-settlement', colour: '#1f4e8c' }] } ,
  'china-z5-doubt': { voyages: [{ id: 'ibn-battuta-6' }] },
  'sheet-z3-voyage': { overlay: { id: 'de-la-cosa', mode: 'sheet' }, voyages: [{ id: 'columbus', colour: VOYAGE_CONTRAST[0], width: 3.2 }] },
  'old-world-z2.6-1375': { regions: 'english', regionSet: 'catalan-1375' } };
// and its full-size render is kept for the README, so `npm run golden` refreshes both together
const README_IMAGE = join(ROOT, 'docs', 'readme.jpg');

const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
// seas from the committed fixture (seaNames of the marine download), countries from coastlines
let made;
const names = () => made ??= joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

async function renderFull(view, scale = 'off', opts = {}) {
  const { scene, data, bg } = await createScene(env, { view, scale, ...opts });
  const full = createCanvas(W, H);
  drawScene(full.getContext('2d'), scene, data, bg, { scale: 1, x: 0, y: 0 });
  return full;
}

const shrink = (full) => {
  const small = createCanvas(SW, SH);
  const g = small.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(full, 0, 0, SW, SH);
  return small;
};

const renderView = async (...args) => shrink(await renderFull(...args));

const pixels = (canvas) => canvas.getContext('2d').getImageData(0, 0, SW, SH).data;

for (const [name, view] of Object.entries(VIEWS)) {
  test(`golden image: ${name}`, async () => {
    const full = await renderFull(view, 'off', OPTS[name]);
    const canvas = shrink(full);
    const file = join(GOLDEN, `${name}.png`);
    if (UPDATE) {
      mkdirSync(GOLDEN, { recursive: true });
      if (name === 'region-z5') writeFileSync(README_IMAGE, full.toBuffer('image/jpeg', 90));
      writeFileSync(file, canvas.toBuffer('image/png'));
      return;
    }
    assert.ok(existsSync(file), `${name}: no golden image; run npm run golden and commit test/golden/${name}.png`);
    const want = createCanvas(SW, SH);
    want.getContext('2d').drawImage(await loadImage(file), 0, 0);
    const a = pixels(canvas), b = pixels(want);
    const diff = createCanvas(SW, SH), dg = diff.getContext('2d');
    const { bad, data } = compare(a, b, SW, SH, (x, y) => dg.createImageData(x, y));
    const share = bad / (SW * SH);
    if (share > SHARE) {
      mkdirSync(OUT, { recursive: true });
      dg.putImageData(data, 0, 0);
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
test('world lettering: continents below z5.5, regions below z7, nothing by default', async () => {
  const count = async (view, opts) => (await createScene(env, { view, ...opts })).scene.worldNames.length;
  assert.equal(await count(VIEWS['world-z2']), 0);
  assert.equal(await count(VIEWS['region-z5']), 0);
  assert.ok(await count(VIEWS['world-z2'], { continents: true }) > 0, 'no continents at z2');
  assert.equal(await count({ lon: 8.93, lat: 44.41, zoom: 5.5 }, { continents: true }), 0);
  // continents and regions show together through the fractional zooms between
  for (const zoom of [4.5, 4.81, 5, 5.4]) {
    const names = (await createScene(env, { view: { lon: 14, lat: 46, zoom }, continents: true, regions: 'latin' })).scene.worldNames;
    assert.ok(names.some((n) => !n.italic), `no continent at z${zoom}`);
    assert.ok(names.some((n) => n.italic), `no region at z${zoom}`);
  }
  assert.ok(await count(VIEWS['world-z2'], { regions: 'latin' }) > 0, 'no regions at z2');
  assert.ok(await count(VIEWS['region-z5'], { regions: 'latin' }) > 0, 'no regions at z5');
  assert.ok(await count(VIEWS['region-z5'], { regions: 'english' }) > 0, 'no regions at z5');
  // a period's names letter its realms in its own spelling or read in English, each in its zoom band; an unknown set letters today's
  const lettered = async (opts) => (await createScene(env, { view: { lon: 62, lat: 33, zoom: 2.6 }, ...opts })).scene.worldNames.map((n) => n.text);
  const read = await lettered({ regions: 'english', regionSet: 'catalan-1375' });
  for (const name of ['Golden Horde', 'Mali Empire', 'Il-Khanate', 'Cathay']) assert.ok(read.includes(name), `no ${name} at z2.6`);
  assert.ok(!read.includes('Lombardy'), 'Lombardy is lettered from z4.5');
  assert.ok((await lettered({ regions: 'latin', regionSet: 'catalan-1375' })).includes('Melly'));
  assert.deepEqual(await lettered({ regions: 'latin', regionSet: 'nowhere' }), await lettered({ regions: 'latin' }));
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

// Rivers and lakes are off by default (the goldens hold them off); every style draws, and over the
// Danube and Lake Balaton each one other than off puts ink on the chart.
test('rivers and lakes: every style draws, and off draws none', async () => {
  const danube = { lon: 19, lat: 46, zoom: 5 };
  const off = await renderView(danube, 'off', { rivers: 'off', lakes: 'off' });
  assert.ok(!differs(await renderView(danube), off), 'water drawn by default');
  assert.deepEqual(RIVER_STYLES, ['off', 'aguiar', 'marina', 'plain']);
  assert.deepEqual(LAKE_STYLES, ['off', 'aguiar', 'marina', 'plain']);
  for (const rivers of RIVER_STYLES.slice(1)) assert.ok(differs(await renderView(danube, 'off', { rivers }), off), `rivers ${rivers}: nothing drawn`);
  for (const lakes of LAKE_STYLES.slice(1)) assert.ok(differs(await renderView(danube, 'off', { lakes }), off), `lakes ${lakes}: nothing drawn`);
  await renderView(danube, 'off', { rivers: 'aguiar', lakes: 'marina' }); // the two combine
});

// The goldens hold the drawn styles off (the Catalan sprites are in the default selection, so the hills
// are seeded for them); over the Alps every drawn style draws, and the sprites stand on the hills, not the ranges.
test('hills and mountains: every drawn style draws, the styles mix per range, and none draws no peak', async () => {
  const alps = { lon: 9, lat: 46.5, zoom: 7 };
  const off = await renderView(alps, 'off', { relief: [] });
  assert.ok(!differs(await renderView(alps), off), 'no mountain is drawn by default in the scene');
  assert.deepEqual(RELIEF_STYLES, ['off', 'marina', 'engraved']);
  for (const relief of RELIEF_STYLES.slice(1)) {
    const { scene } = await createScene(env, { view: alps, scale: 'off', relief });
    assert.ok(scene.relief.peaks.length > 0, `relief ${relief}: no peaks placed`);
    assert.ok(scene.relief.peaks.every((p) => p.style === relief));
    assert.ok(differs(await renderView(alps, 'off', { relief }), off), `relief ${relief}: nothing drawn`);
  }
  const mixed = (await createScene(env, { view: alps, scale: 'off', relief: ['marina', 'engraved'] })).scene;
  assert.deepEqual([...new Set(mixed.relief.peaks.map((p) => p.style))].sort(), ['engraved', 'marina'], 'one view, both styles');
  const sprites = (await createScene(env, { view: alps, scale: 'off', relief: [] })).scene;
  assert.equal(sprites.relief.peaks.length, 0, 'no drawn style: no peak');
  assert.ok(sprites.relief.humps.length > 0 && sprites.mountains.length > 0, 'the sprites stand on the hills');
  assert.equal((await createScene(env, { view: alps, scale: 'off', relief: [], kinds: ['rose', 'cartouche'] })).scene.relief, null, 'nothing selected: nothing seeded');
});

// Every projection places a scene with the hills on; relief once read a view's top row past the pole and never ended.
test('hills and mountains: every projection places and ends', async () => {
  for (const projection of PROJECTION_NAMES) {
    const { scene } = await createScene(env, { view: { lon: 10, lat: 30, zoom: 2, projection }, scale: 'off', relief: ['marina'] });
    assert.ok(scene.relief, projection);
  }
});

// Roses stand in open water; where the water is heavily constrained they stand on open land instead, clear of the places.
// The Atlantic sheet holds clear sea at all 17 sites; the two Mediterranean sheets hold too little, so theirs stand on land.
test('roses: open land holds them where the water is too constrained', async () => {
  const inland = { lon: 45, lat: 52, zoom: 7 }; // the Volga steppe: the sheet's circle holds no clear sea
  const { scene } = await createScene(env, { view: inland, scale: 'off', sprites: ['vivid/rose-aguiar', 'vivid/rose-catalan', 'vivid/rose-catalan-small'] });
  assert.ok(scene.roseDraws.some((r) => scene.field.isLand(r.x, r.y)), 'no rose on the land');
  for (const r of scene.roseDraws) for (const t of scene.towns) assert.ok(Math.hypot(r.x - t.x, r.y - t.y) > 20, `a rose sits on ${t.name}`);
  const sea = (await createScene(env, { view: { lon: -45, lat: 23, zoom: 5 }, scale: 'off', sprites: ['vivid/rose-aguiar'] })).scene;
  assert.ok(sea.roseDraws.every((r) => !sea.field.isLand(r.x, r.y)), 'a rose on land where there is sea');
});

// Trees are on by default in the page (the goldens hold them off); every style draws over central Sweden, and
// off draws none.
test('trees: every style draws, and off draws none', async () => {
  const svecia = { lon: 15.5, lat: 59.5, zoom: 7 };
  const off = await renderView(svecia, 'off', { trees: 'off' });
  assert.ok(!differs(await renderView(svecia), off), 'trees drawn by default');
  assert.deepEqual(TREE_STYLES, ['off', 'marina', 'ink']);
  for (const trees of TREE_STYLES.slice(1)) assert.ok(differs(await renderView(svecia, 'off', { trees }), off), `trees ${trees}: nothing drawn`);
  const { data } = await createScene(env, { view: svecia, scale: 'off', trees: 'marina' });
  assert.ok(data.trees.length > 0, 'no stands planted');
  assert.equal((await createScene(env, { view: svecia, scale: 'off' })).data.trees.length, 0, 'stands planted with trees off');
});

// A stand is fixed to the map: a pan meets the same stands where the two views overlap, each the
// same trees at the same size in px; a zoom in meets more.
test('trees: a pan keeps the forest, a zoom in thickens it', () => {
  const projAt = (lon, zoom) => {
    const k = (512 * 2 ** zoom) / (2 * Math.PI), RAD = Math.PI / 180, merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
    const y0 = merc(50);
    return { zoom, x: (l) => W / 2 + (l - lon) * RAD * k, y: (lat) => H / 2 - (merc(lat) - y0) * k,
      invert: (px, py) => [lon + (px - W / 2) / k / RAD, (2 * Math.atan(Math.exp(y0 - (py - H / 2) / k)) - Math.PI / 2) / RAD] };
  };
  const plant = (lon, zoom) => plantTrees({ proj: projAt(lon, zoom), isLand: () => true, w: W, h: H });
  const key = (s) => `${s.lon.toFixed(6)},${s.lat.toFixed(6)}:${s.trees.map((t) => `${t.shape}${t.dx.toFixed(2)}`).join()}`;
  const a = plant(10, 7), b = plant(10.5, 7); // half a degree east, about 360 px at zoom 7
  const shared = (list) => list.filter((s) => s.lon > 9.5 && s.lon < 11).map(key).sort();
  assert.ok(shared(a).length > 5, 'too few stands to compare');
  assert.deepEqual(shared(a), shared(b));
  const count = (zoom) => plant(10, zoom).reduce((n, s) => n + s.trees.length, 0);
  assert.ok(count(3) < count(6) && count(6) < count(9), 'trees do not thicken with zoom');
  assert.equal(count(1), 0, 'trees at zoom 1');
});

// The voyages: a list of { id, colour, width }, the older single `voyage` read as a list of one, the first red by
// default and the rest each a colour of its own; an id the site lacks is left out. A death's `alternatives` draw
// (fainter skulls tied to it), and a death without them draws as before.
test('voyages: a list, coloured and sized; an older single voyage; alternatives drawn when a death has them', async () => {
  const of = async (opts) => (await createScene(env, { view: VIEWS['world-z2'], ...opts })).scene.voyages;
  const one = await of({ voyage: 'magellan' });
  assert.deepEqual(one.map((v) => [v.voyage.id, v.colour, v.width]), [['magellan', '#8c2f1e', 2.2]]);
  const three = await of({ voyages: [{ id: 'columbus' }, { id: 'nowhere' }, { id: 'drake', colour: '#1F4E8C' }, { id: 'polo', width: 4.5 }] });
  assert.deepEqual(three.map((v) => v.voyage.id), ['columbus', 'drake', 'polo']);
  assert.equal(three[0].colour, '#8c2f1e');
  assert.equal(three[1].colour, '#1f4e8c');
  assert.equal(new Set(three.map((v) => v.colour)).size, 3, 'two voyages share an ink');
  assert.equal(three[2].width, 4.5);
  assert.deepEqual(await of({}), []);

  const fixture = read(join(ROOT, 'test', 'fixtures', 'voyage-alternatives.json'));
  // the fixture is one flat file; split it the way the site keeps it: the death in people.json, the sources by id
  const death = fixture.events.find((e) => e.kind === 'death');
  const { kind, who, ...rest } = death;
  const served = { 'data/voyages/fixture-alternatives.json': { ...fixture, who: [who], sources: ['fixture'], events: fixture.events.filter((e) => e !== death) } };
  const withFixture = { ...env, readJSON: async (p) => (p === 'data/voyages/people.json' ? { ...(await env.readJSON(p)), [who]: { death: rest } }
    : p === 'data/voyages/sources.json' ? { ...(await env.readJSON(p)), fixture: fixture.sources[0] }
    : served[p] ?? env.readJSON(p)) };
  const { scene, data, bg } = await createScene(withFixture, { view: VIEWS['world-z2-voyages'], voyages: [{ id: 'fixture-alternatives' }] });
  assert.equal(scene.voyages.length, 1);
  const draw = (s) => { const c = createCanvas(W, H); drawScene(c.getContext('2d'), s, data, bg, { scale: 1, x: 0, y: 0 }); return c.getContext('2d').getImageData(0, 0, W, H).data; };
  const bare = { ...scene.voyages[0], voyage: { ...fixture, events: fixture.events.map(({ alternatives, ...e }) => e) } };
  const a = draw(scene), b = draw({ ...scene, voyages: [bare] });
  assert.ok(a.some((v, i) => v !== b[i]), 'a death\'s alternatives drew nothing');
});

// A doubted leg's cloud stands on its own medium, clear of the names, far enough from the leg for its trail,
// and a tap on it opens the leg's tile with the doubt (doubtMarks).
test('a doubted leg has a cloud on empty ground of its medium, and the cloud carries the leg\'s tile', async () => {
  const { scene, data } = await createScene(env, { view: VIEWS['china-z5-doubt'], voyages: [{ id: 'ibn-battuta-6' }] });
  const marks = doubtMarks(scene.voyages[0], data.proj, { x0: 0, y0: 0, x1: W, y1: H });
  assert.equal(marks.length, 1);
  const [m] = marks;
  assert.match(m.tile.doubt, /Khanbaliq/);
  assert.equal(m.tile.title, 'Hangzhou to Quanzhou, by Khanbaliq');
  assert.ok(scene.field.isLand(m.x, m.y), 'a land leg\'s cloud stands at sea');
  const d = Math.hypot(m.to[0] - m.x, m.to[1] - m.y);
  assert.ok(d >= 100 && d <= 400, `the cloud is ${d.toFixed(0)} px from its leg`);
  assert.ok(scene.names.every((n) => Math.abs(n.box.cx - m.x) > n.box.hw + 40 || Math.abs(n.box.cy - m.y) > n.box.hh + 30), 'the cloud sits on a name');
});
