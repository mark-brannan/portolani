// A sight's pictures (data/sights/pictures.json, scripts/people.mjs): every picture built for the site, keyed by a tile's
// name, credited and captioned, and the row they lie in under the sight's frame. Offline and fast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sightPicturesOf, sightFrame, picturePlaces, pictureName, pictureCredit, pictureNote, SIGHT_PICTURES_FILE, SIGHT_MANIFEST_FILE, SIGHT_PAD, SIGHT_DEAL, sightDeal } from '../scripts/people.mjs';
import { SIGHT_TILES } from '../scripts/sights.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const sights = sightPicturesOf(read(SIGHT_PICTURES_FILE));

test('every sight with pictures has a tile, and Tyre has five to seven', () => {
  for (const name of Object.keys(sights)) assert.ok(SIGHT_TILES[name], `${name}: no tile in SIGHT_TILES`);
  assert.ok(sights.Tyre.length >= 5 && sights.Tyre.length <= 7, `Tyre: ${sights.Tyre.length} pictures`);
});

test('a sight with several marks splits its pictures between them, each mark dealing at least one', () => {
  for (const [name, list] of Object.entries(sights)) {
    const at = SIGHT_TILES[name].at, marks = at && Array.isArray(at[0]) ? at.length : 1;
    if (marks < 2) continue;
    for (const im of list) assert.ok(Number.isInteger(im.site) && im.site >= 0 && im.site < marks, `${name}: ${im.file}: site ${im.site}`);
    for (let k = 0; k < marks; k++) assert.ok(list.some((im) => im.site === k), `${name}: mark ${k} deals nothing`);
  }
});

test('every sight picture is built for the site (npm run people), under its own name, credited and captioned in a line', () => {
  const { pictures } = read(SIGHT_MANIFEST_FILE);
  for (const [name, list] of Object.entries(sights)) for (const im of list) {
    const m = pictures[im.file];
    assert.ok(m, `${name}: ${im.file}: not in the manifest`);
    assert.equal(m.src, `sights/${pictureName(im.file)}`);
    assert.ok(existsSync(join(ROOT, 'packs', 'overlays', m.src)), m.src);
    assert.ok(m.width > 0 && m.height > 0 && m.page.startsWith('https://commons.wikimedia.org/'), im.file);
    const credit = pictureCredit(im);
    assert.ok(credit.includes(im.licence) && credit.includes(im.author) && !/QS:|T\d\d:/.test(im.date), `${im.file}: ${credit}`);
    assert.ok(typeof im.caption === 'string' && im.caption.length && !im.caption.includes('\n') && pictureNote(im) === im.caption, `${im.file}: caption`);
  }
});

test('a sight\'s frame is its spots padded', () => {
  const at = [[35.1933, 33.2681], [35.2111, 33.2692]], f = sightFrame(at); // Tyre's two sites
  assert.ok(Math.abs(f.lonMin - (35.1933 - SIGHT_PAD)) < 1e-9 && Math.abs(f.latMin - (33.2681 - SIGHT_PAD)) < 1e-9 && f.lonMax > f.lonMin && f.latMax > f.latMin);
  assert.equal(sightFrame([]), null);
});

test('a sight\'s pictures are dealt in the bottom third of the window, inside it, larger than before and clear of the place', () => {
  const win = { x0: 0, x1: 1600, y0: 0, y1: 1000 }, sizes = [[640, 480], [640, 488], [640, 480], [640, 480], [640, 427], [640, 424], [640, 369]]; // Tyre's seven
  const { clear, row } = sightDeal(sizes, win, [800, 400]);
  assert.ok(clear, 'a place in the middle stands clear above the row');
  assert.ok(row.every((c) => c.y - c.h / 2 >= 1000 * (2 / 3) - 1 && c.y + c.h / 2 <= 1000), 'in the bottom third');
  const left = row[0].x - (sizes[0][0] / sizes[0][1]) * row[0].h / 2, right = row.at(-1).x + (sizes[6][0] / sizes[6][1]) * row[6].h / 2;
  assert.ok(left >= 0 && right <= 1600, `inside the window: ${left}..${right}`);
  assert.ok(row[0].h > 180, `larger than the 180 px they were dealt at: ${row[0].h}`);
  assert.ok(row.every((c, k) => !k || c.x > row[k - 1].x), 'west to east');
  // a place near the foot would be covered: the row says so, and the page moves the map
  assert.equal(sightDeal(sizes, win, [800, 900]).clear, false);
  // a short row lies centred under the place, at the fill's height
  const one = sightDeal([[640, 480]], win, [500, 300]).row[0];
  assert.ok(Math.abs(one.x - 500) < 1e-9 && Math.abs(one.h - 1000 * SIGHT_DEAL.fill) < 1e-9);
});

// Tyre's two marks: spread apart where they would meet, in their order on the earth, and hit where they are drawn
const { createScene, spreadMarks, drawnMarks, sightHits, pickMark } = await import('../scripts/scene.mjs');
const { MEMENTO, mementoNext } = await import('../scripts/people.mjs');
const { loadImage, createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
const { coastNames, joinNames } = await import('../scripts/names.mjs');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
let seaNames;
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json'
    ? (seaNames ??= joinNames(read('test/fixtures/sea-names-50m.json'), coastNames(JSON.parse(readFileSync(join(GEO, 'ne-admin-0-countries-50m.geojson'), 'utf8')), JSON.parse(readFileSync(join(GEO, 'ne-coastline-50m.geojson'), 'utf8')))))
    : JSON.parse(readFileSync(p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p), 'utf8'))),
  loadImage: (p) => loadImage(p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};
const TYRE = SIGHT_TILES.Tyre.at.map(([lon, lat], site) => ({ lon, lat, tile: { title: 'Tyre', sight: 'Tyre', site, ruin: true } }));

test('spreadMarks: two marks that would meet stand an icon\'s width clear, along their bearing, about their middle, in their order', () => {
  const width = 26, out = spreadMarks([[100, 100], [109, 101]], width);
  assert.ok(Math.hypot(out[1][0] - out[0][0], out[1][1] - out[0][1]) >= 2 * width - 1e-9, 'one width of clear ground between');
  assert.ok(out[0][0] < out[1][0], 'west stays west');
  assert.ok(Math.abs((out[1][0] - out[0][0]) * 1 - (out[1][1] - out[0][1]) * 9) < 1e-6, 'along their bearing');
  assert.deepEqual(out.reduce(([a, b], [x, y]) => [a + x / 2, b + y / 2], [0, 0]).map((v) => +v.toFixed(9)), [104.5, 100.5]);
  assert.equal(spreadMarks([[0, 0], [60, 0]], width), null, 'far enough apart: left where they are');
});

test('Tyre at zooms 8, 9.5 and 11: its two marks a width clear, the city site west, each hit where it is drawn', async () => {
  for (const zoom of [8, 9.5, 11]) {
    const { scene, data } = await createScene(env, { view: { lon: 35.205, lat: 33.255, zoom }, sights: TYRE.map(({ lon, lat, tile }) => ({ name: 'Tyre', lon, lat, ruin: true, site: tile.site })) });
    const marks = scene.lesser.filter((l) => l.mark && l.name === 'Tyre').sort((a, b) => a.site - b.site);
    assert.deepEqual(marks.map((m) => m.site), [0, 1], `z${zoom}: both marks drawn`);
    const [a, b] = marks, width = 2 * a.label.hw;
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 2 * width - 0.5, `z${zoom}: ${Math.hypot(b.x - a.x, b.y - a.y).toFixed(1)} px apart, the icon ${width.toFixed(1)} wide`);
    assert.ok(a.x < b.x, `z${zoom}: the city site west of Al-Bass`);
    const hits = sightHits(TYRE, drawnMarks(scene, data), data.proj, { x0: 0, y0: 0, x1: 1600, y1: 1000 });
    for (const m of marks) {
      const hit = hits.find((h) => h.tile.site === m.site);
      assert.ok(hit && Math.hypot(hit.x - m.label.cx, hit.y - m.label.cy) < 0.5, `z${zoom} site ${m.site}: hit where drawn`);
      assert.equal(pickMark(hits, [m.label.cx, m.label.cy], 20).tile.site, m.site, `z${zoom}: a tap on site ${m.site} opens its own tile`);
    }
  }
});

test('the memento under the skull: every line in order, then back to the first', () => {
  assert.equal(MEMENTO.length, 11);
  let k = 0;
  const seen = [MEMENTO[k]];
  for (let n = 1; n < MEMENTO.length; n++) seen.push(MEMENTO[k = mementoNext(k)]);
  assert.deepEqual(seen, MEMENTO);
  assert.equal(mementoNext(k), 0, 'the last wraps to the first');
});
