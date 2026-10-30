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
