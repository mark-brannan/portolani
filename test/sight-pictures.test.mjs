// A sight's pictures (data/sights/pictures.json, scripts/people.mjs): every picture built for the site, keyed by a tile's
// name, credited and captioned, and the row they lie in under the sight's frame. Offline and fast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sightPicturesOf, sightFrame, picturePlaces, pictureName, pictureCredit, pictureNote, SIGHT_PICTURES_FILE, SIGHT_MANIFEST_FILE, SIGHT_PICTURE_TALL, SIGHT_PAD } from '../scripts/people.mjs';
import { SIGHT_TILES } from '../scripts/sights.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const sights = sightPicturesOf(read(SIGHT_PICTURES_FILE));

test('every sight with pictures has a tile, and Tyre has five to seven', () => {
  for (const name of Object.keys(sights)) assert.ok(SIGHT_TILES[name], `${name}: no tile in SIGHT_TILES`);
  assert.ok(sights.Tyre.length >= 5 && sights.Tyre.length <= 7, `Tyre: ${sights.Tyre.length} pictures`);
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

test('a sight\'s frame is its spots padded, and its pictures lie in a row centred under it at a town\'s size', () => {
  const at = [[35.1933, 33.2681], [35.2111, 33.2692]], f = sightFrame(at); // Tyre's two sites
  assert.ok(Math.abs(f.lonMin - (35.1933 - SIGHT_PAD)) < 1e-9 && Math.abs(f.latMin - (33.2681 - SIGHT_PAD)) < 1e-9 && f.lonMax > f.lonMin && f.latMax > f.latMin);
  assert.equal(sightFrame([]), null);
  const sizes = [[640, 480], [640, 488], [640, 369]], row = picturePlaces(f, sizes, 1.6, 0.25, { tall: SIGHT_PICTURE_TALL, centred: true });
  assert.ok(row.every((s) => s.lat < f.latMin), 'under the frame');
  assert.ok(row.every((s, k) => Math.abs(s.scale * sizes[k][1] - SIGHT_PICTURE_TALL * 1.6) < 1e-9), 'each as tall as the sight\'s height, grown');
  assert.ok(row[1].lon > row[0].lon && row[2].lon > row[1].lon, 'west to east');
  const left = row[0].lon - (sizes[0][0] * row[0].scale) / 2, right = row[2].lon + (sizes[2][0] * row[2].scale) / 2;
  assert.ok(Math.abs((left + right) / 2 - (f.lonMin + f.lonMax) / 2) < 1e-9, 'centred on the frame');
  // a person's row is unchanged: from the frame's west edge, sized from the frame
  const person = picturePlaces(f, sizes, 1.6, 0.25);
  assert.ok(Math.abs(person[0].lon - (sizes[0][0] * person[0].scale) / 2 - f.lonMin) < 1e-9 && person[0].scale * 480 > SIGHT_PICTURE_TALL * 1.6);
});
