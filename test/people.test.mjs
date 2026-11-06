// The people as the People drawer reads them (data/voyages/people.json, scripts/people.mjs): every picture built for
// the site, and the vertical timelines' eras and years, the link keys, the marks and the lit and dimmed voyages. The records' schema is
// checkPerson (test/voyages.test.mjs). Offline and fast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peopleOf, yearOf, lifeSpan, laneAxis, eraBands, TIMELINE_EARLIEST, EARLIER_SHARE, EARLIER_MARKS, TIMELINE_VARIANTS, timelineVariant, eraOf, eraYears, firstYear, yearsText, eraScale, barOn, TIMELINE_FROM, TIMELINE_ERAS, voyageYears, parsePictures, picturesText, parsePictureAt, pictureAtText, withPerson, personMarks, picturePlaces, frameOf, pictureName, pictureCredit, DIMMED, PERSON_RED } from '../scripts/people.mjs';

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

test('timeline=: a or b picks the people and voyages timeline, anything else is A', () => {
  assert.deepEqual(TIMELINE_VARIANTS, ['a', 'b']);
  assert.equal(timelineVariant('a'), 'a');
  assert.equal(timelineVariant('b'), 'b');
  for (const v of [null, undefined, '', 'B', 'c', 'vertical']) assert.equal(timelineVariant(v), 'a', String(v));
});

test('timeline A runs from Lapita to this year on one linear scale, the empty centuries at true width', () => {
  const axis = laneAxis({ to: 2026 });
  assert.equal(axis.width, 1);
  assert.equal(axis.x(TIMELINE_FROM), 0);
  assert.equal(axis.x(2026), 1);
  const per = (a, b) => (axis.x(b) - axis.x(a)) / (b - a);
  assert.ok(Math.abs(per(-300, 1000) - per(1300, 1600)) < 1e-12, 'the years from 300 BC to AD 1000 are squeezed or stretched');
  assert.ok(Math.abs(axis.x(-300) - (1200 / 3526)) < 1e-12);
  assert.deepEqual(axis.ticks.map(([y]) => y), [-1500, -1000, -500, 1, 500, 1000, 1500, 2000]);
  assert.deepEqual(axis.ticks.slice(0, 4).map(([, l]) => l), ['1500 BC', '1000 BC', '500 BC', 'AD 1']);
});

test('timeline A\'s Earlier adds the stretch back to 50,000 BC at its own scale, and the main stretch keeps its width', () => {
  const short = laneAxis({ to: 2026 }), long = laneAxis({ earlier: true, to: 2026 });
  assert.equal(long.width, 1 + EARLIER_SHARE);
  assert.equal(long.stretches.length, 2);
  assert.equal(long.x(TIMELINE_EARLIEST), 0);
  assert.equal(long.x(2026), 1);
  const span = (axis, a, b) => (axis.x(b) - axis.x(a)) * axis.width; // in main-stretch widths
  assert.ok(Math.abs(span(long, TIMELINE_FROM, 2026) - span(short, TIMELINE_FROM, 2026)) < 1e-12, 'the main stretch changed width');
  assert.ok(Math.abs(span(long, 1300, 1600) - span(short, 1300, 1600)) < 1e-12, 'the main stretch changed scale');
  assert.ok(Math.abs(span(long, TIMELINE_EARLIEST, TIMELINE_FROM) - EARLIER_SHARE) < 1e-12);
  assert.ok(long.x(-11000) < long.x(TIMELINE_FROM) && long.x(-20000) < long.x(-11000));
  assert.deepEqual(long.ticks.slice(0, 5).map(([y]) => y), [-50000, -40000, -30000, -20000, -10000]);
  assert.deepEqual(long.ticks.slice(0, 6).map(([, l]) => l), ['50,000 BC', '40,000 BC', '30,000 BC', '20,000 BC', '10,000 BC', '1500 BC']);
  for (const [, y] of EARLIER_MARKS) assert.ok(y >= TIMELINE_EARLIEST && y < TIMELINE_FROM, `${y} is not on the earlier stretch`);
});

test('timeline A\'s era bands run end to end across the main stretch, one per era', () => {
  for (const earlier of [false, true]) {
    const axis = laneAxis({ earlier, to: 2026 }), bands = eraBands(axis);
    assert.deepEqual(bands.map(([name]) => name), TIMELINE_ERAS.map(([name]) => name));
    assert.equal(bands[0][1], TIMELINE_FROM);
    assert.equal(bands.at(-1)[2], 2026);
    bands.forEach(([, a, b], i) => { assert.ok(b > a); if (i) assert.equal(a, bands[i - 1][2], 'a gap or an overlap between eras'); });
  }
});

test('a row\'s era is the one its year falls in, and the headings carry the eras\' years, BC and AD alike', () => {
  assert.deepEqual([-1500, -600, 499, 500, 1325, 1449, 1450, 1799, 1800, 2026].map(eraOf),
    ['The ancient world', 'The ancient world', 'The ancient world', 'The medieval Indian Ocean and Asia', 'The medieval Indian Ocean and Asia', 'The medieval Indian Ocean and Asia', 'The age of discovery', 'The age of discovery', 'The modern world', 'The modern world']);
  assert.equal(eraOf(-50000), 'The ancient world', 'anything before Lapita is the first era');
  assert.equal(eraOf(NaN), null);
  assert.deepEqual(TIMELINE_ERAS.map(([n]) => eraYears(n)), ['1500 BC – AD 500', '500 – 1450', '1450 – 1800', 'from 1800']);
  assert.equal(TIMELINE_ERAS[0][1], TIMELINE_FROM);
});

test('each era has its own scale for the life bars, with round ticks between its ends', () => {
  const ancient = eraScale('The ancient world', 2026), discovery = eraScale('The age of discovery', 2026), modern = eraScale('The modern world', 2026);
  assert.deepEqual(ancient.ticks.map(([, l]) => l), ['1000 BC', '500 BC', 'AD 1']);
  assert.deepEqual(eraScale('The medieval Indian Ocean and Asia').ticks.map(([y]) => y), [750, 1000, 1250]);
  assert.deepEqual(discovery.ticks.map(([y]) => y), [1500, 1600, 1700]);
  assert.deepEqual([modern.from, modern.to], [1800, 2026]);
  assert.equal(eraScale('no such era'), null);
  // Magellan, c. 1480 to 1521, on the age of discovery's scale: a twelfth of the way in, about an eighth wide
  const [x0, x1, open0, open1] = barOn(discovery, [1480, 1521, true, true]);
  assert.ok(Math.abs(x0 - 30 / 350) < 1e-9 && Math.abs(x1 - 71 / 350) < 1e-9 && !open0 && !open1);
  // a life that runs past its era's end is clipped there and left open
  assert.deepEqual(barOn(eraScale('The medieval Indian Ocean and Asia'), [1420, 1480, true, true]).slice(1), [1, false, true]);
  assert.equal(barOn(discovery, [NaN, NaN]), null);
});

test('a person sorts by their birth, else by their first voyage, so a people with no dates takes its voyage\'s years', () => {
  assert.equal(firstYear(who('pytheas'), [-330, -320]), -350);
  assert.equal(firstYear(who('lapita-people'), [-1500, -800]), -1500);
  assert.ok(Number.isNaN(firstYear({ name: 'nobody' }, [])));
  assert.equal(yearsText(who('marco-polo')), 'c. 1254 – 8 Jan 1324');
  assert.equal(yearsText(who('pytheas')), 'born c. 350 BC');
  assert.equal(yearsText(who('lapita-people'), [{ when: 'c. 1500–800 BC' }]), 'c. 1500–800 BC');
  assert.equal(yearsText({ name: 'x' }, [{ when: '1492' }, { when: '1502–1504' }]), 'fl. 1492 – 1504');
  assert.equal(yearsText({ name: 'x' }), '');
});

test('a people is listed as a person: the Lapita and the East Polynesian voyagers have rows, flagged as a group, and their migrations name them', () => {
  for (const [id, voyage] of [['lapita-people', 'lapita-expansion'], ['east-polynesian-voyagers', 'east-polynesia-settlement'], ['phoenician-mariners-of-necho-ii', 'phoenician-africa']]) {
    const p = who(id);
    assert.ok(p && p.group === true && p.bio, `${id}: a group record with a bio`);
    assert.deepEqual(p.voyages, [voyage]);
  }
  assert.equal(who('ibn-battuta').group, undefined);
  for (const [id, w] of Object.entries(whoMap)) assert.ok(w.length, `${id} names nobody: every voyage, a migration too, belongs to someone in the People drawer`);
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
  // one of theirs put off by its eye (listed hidden) is left out, lit or not; without a person a hidden voyage is left out too
  const off = withPerson([{ id: 'ibn-battuta-3', colour: null, width: 2.2, hidden: true }], ib, 2.2);
  assert.ok(!off.some((v) => v.id === 'ibn-battuta-3') && off.length === ib.voyages.length - 1);
  assert.deepEqual(withPerson([{ id: 'columbus', colour: null, width: 2.2, hidden: true }, { id: 'drake', colour: null, width: 2.2 }], null, 2.2).map((v) => v.id), ['drake']);
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

test('a Commons title with no ascii letter or digit takes a stable hashed name', () => {
  assert.equal(pictureName('File:Туд.png'), 'commons-bb4577d2.jpg');
  assert.equal(pictureName('Туд.png'), 'commons-bb4577d2.jpg');
});
