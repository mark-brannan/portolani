// The people as the People drawer reads them (data/voyages/people.json, scripts/people.mjs): every picture built for
// the site, and the timeline, the link keys, the marks and the lit and dimmed voyages. The records' schema is
// checkPerson (test/voyages.test.mjs). Offline and fast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peopleOf, yearOf, lifeSpan, timelineAxis, voyageYears, parsePictures, picturesText, parsePictureAt, pictureAtText, withPerson, personMarks, picturePlaces, frameOf, pictureName, pictureCredit, DIMMED, PERSON_RED } from '../scripts/people.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const index = read('data/voyages/index.json'), whoMap = Object.fromEntries(index.map((id) => [id, read(`data/voyages/${id}.json`).who]));
const people = peopleOf(read('data/voyages/people.json'), whoMap);
const who = (id) => people.find((p) => p.id === id);

test('everyone a voyage names is listed in the drawer, with their voyages from its who', () => {
  const ids = new Set(people.map((p) => p.id));
  for (const [id, w] of Object.entries(whoMap)) for (const s of w) assert.ok(ids.has(s) && who(s).voyages.includes(id), `${id}: ${s}`);
  assert.deepEqual(who('juan-garrido').voyages, ['ponce-de-leon-1513', 'juan-garrido'].filter((v) => index.includes(v)).sort((a, b) => index.indexOf(a) - index.indexOf(b)));
  assert.equal(who('juan-de-la-cosa').name, 'Juan de la Cosa');
});

test('every picture is built for the site (npm run people), under its own name, and credited', () => {
  const { pictures } = read('packs/overlays/people/people.json');
  for (const p of people) for (const im of p.images) {
    const m = pictures[im.file];
    assert.ok(m, `${im.file}: not in the manifest`);
    assert.equal(m.src, `people/${pictureName(im.file)}`);
    assert.ok(existsSync(join(ROOT, 'packs', 'overlays', m.src)), m.src);
    assert.ok(pictureCredit(im).includes(im.licence) && !/QS:|T\d\d:/.test(im.date), im.file);
  }
});

test('years read off their texts, before Christ negative', () => {
  assert.deepEqual(['c. 350 BC', '24 Feb 1304', 'c. 970s', '5th century BC', '1486 or 1487', 'nothing'].map(yearOf), [-350, 1304, 970, -450, 1486, NaN]);
  assert.deepEqual(voyageYears('c. 330–320 BC'), [-330, -320]);
  assert.deepEqual(voyageYears('1325–1354'), [1325, 1354]);
});

test('a life open at an end runs from the voyages and fades there', () => {
  assert.deepEqual(lifeSpan(who('pytheas'), [-330, -320]), [-350, -280, true, false]); // a birth, no death
  assert.deepEqual(lifeSpan(who('hanno-the-navigator'), [-500, -500]), [-490, -410, false, false]); // a guessed birth fades
  assert.deepEqual(lifeSpan(who('marco-polo'), [1271, 1295]), [1254, 1324, true, true]);
});

test('the timeline breaks between the ancient world and the medieval, and keeps each in order', () => {
  const axis = timelineAxis([[-540, -460], [-360, -300], [970, 1020], [1254, 1324], [1540, 1596]]);
  assert.equal(axis.stretches.length, 2);
  const xs = [-500, -330, 1000, 1300, 1590].map(axis.x);
  assert.deepEqual([...xs].sort((a, b) => a - b), xs);
  assert.ok(axis.x(-300) < axis.stretches[1][2] && axis.x(970) >= axis.stretches[1][2]);
});

test('the picture keys round-trip through the link, the default left out', () => {
  assert.deepEqual(parsePictures(null, [0]), [0]);
  assert.deepEqual(parsePictures('none', [0]), []);
  assert.deepEqual(parsePictures('2,0,2,x', [0]), [2, 0]);
  assert.equal(picturesText([0], [0]), null);
  assert.equal(picturesText([], [0]), 'none');
  const at = { 0: { lon: -5.8, lat: 30.125, scale: 0.0123 }, 2: { lon: 100, lat: -10, scale: 0.5 } };
  assert.deepEqual(parsePictureAt(pictureAtText(at)), at);
  assert.equal(pictureAtText({}), null);
});

test('a person chosen lights their voyages in red and dims the others', () => {
  const ib = who('ibn-battuta');
  const drawn = withPerson([{ id: 'columbus', colour: null, width: 2.2 }, { id: 'ibn-battuta-3', colour: '#1f4e8c', width: 2.2 }], ib, 2.2);
  assert.ok(drawn.filter((v) => ib.voyages.includes(v.id)).every((v) => v.colour === PERSON_RED && v.alpha === undefined));
  assert.deepEqual(drawn.filter((v) => v.alpha === DIMMED).map((v) => v.id), ['columbus']);
});

test('a birth is a mark, and a death no voyage carries is marked too', () => {
  const sources = read('data/voyages/sources.json');
  assert.deepEqual(personMarks({ ...who('juan-de-la-cosa'), voyages: [] }, sources).events.map((e) => e.kind), ['birth', 'death']);
  assert.deepEqual(personMarks(who('juan-de-la-cosa'), sources).events.map((e) => e.kind), ['birth']); // Columbus 1492 carries his death
  const ib = personMarks(who('ibn-battuta'), sources).events;
  assert.deepEqual(ib.map((e) => e.kind), ['birth']); // his voyages carry his death
  assert.ok(ib[0].label && ib[0].cited?.url);
});

test('the pictures lie in a row under the person, each the same height', () => {
  const f = frameOf([[-10, 30], [120, 40], [40, -5]]), at = picturePlaces(f, [[400, 640], [640, 427]]);
  assert.ok(at.every((s) => s.lat < f.latMin));
  assert.ok(Math.abs(at[0].scale * 640 - at[1].scale * 427) < 1e-9);
  assert.ok(at[1].lon > at[0].lon);
  // grown (a wide screen), each is that much taller and the row still lies clear under the frame
  const big = picturePlaces(f, [[400, 640], [640, 427]], 1.5);
  assert.ok(Math.abs(big[0].scale / at[0].scale - 1.5) < 1e-9);
  assert.ok(big.every((s, k) => s.lat < f.latMin && s.lat < at[k].lat));
  // laid a quarter over the one before, the second starts three quarters along the first
  const fan = picturePlaces(f, [[400, 640], [640, 427]], 1.5, 0.25), w0 = 400 * fan[0].scale, w1 = 640 * fan[1].scale;
  assert.ok(Math.abs(fan[1].lon - w1 / 2 - (fan[0].lon - w0 / 2 + 0.75 * w0)) < 1e-9);
});
