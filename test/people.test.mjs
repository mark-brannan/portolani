// The people as the People drawer reads them (data/voyages/people.json, scripts/people.mjs): every picture built for
// the site, and the vertical timelines' eras and years, the link keys, the marks and the lit and dimmed voyages. The records' schema is
// checkPerson (test/voyages.test.mjs). Offline and fast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peopleOf, yearOf, lifeSpan, eraOf, eraYears, firstYear, yearsText, eraScale, barOn, DRAWER_ERAS, withRightBefore, deepX, deepBands, lensBands, lensX, LENS_SHARE, FAMILY_ORDER, familyOrder, spanScale, voyageYears, parsePictures, picturesText, parsePictureAt, pictureAtText, withPerson, personMarks, picturePlaces, frameOf, pictureName, pictureCredit, DIMMED, PERSON_RED } from '../scripts/people.mjs';

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
  assert.deepEqual(['c. 350 BC', '24 Feb 1304', 'c. 970s', '5th century BC', '1486 or 1487', 'c. 1,000,000–700,000 BC', 'nothing'].map(yearOf), [-350, 1304, 970, -450, 1486, -1000000, NaN]);
  assert.deepEqual(voyageYears('c. 330–320 BC'), [-330, -320]);
  assert.deepEqual(voyageYears('1325–1354'), [1325, 1354]);
  assert.deepEqual(voyageYears('c. 1,000,000–700,000 BC'), [-1000000, -700000]);
  assert.deepEqual(voyageYears('c. 63,000–48,000 BC'), [-63000, -48000]);
});

test('a life open at an end runs from the voyages and fades there', () => {
  assert.deepEqual(lifeSpan(who('pytheas'), [-330, -320]), [-350, -280, true, false]); // a birth, no death
  assert.deepEqual(lifeSpan(who('hanno-the-navigator'), [-500, -500]), [-490, -410, false, false]); // a guessed birth fades
  assert.deepEqual(lifeSpan(who('marco-polo'), [1271, 1295]), [1254, 1324, true, true]);
});

test('a row\'s era is the one its year falls in, and the headings carry the eras\' years, BC and AD alike', () => {
  assert.deepEqual([-1500, -1201, -1200, 499, 500, 1449, 1450, 1649, 1650, 1799, 1800, 2026].map(eraOf),
    ['The Bronze Age', 'The Bronze Age', 'The ancient world', 'The ancient world', 'The medieval world', 'The medieval world', 'The age of discovery', 'The age of discovery', 'The age of Enlightenment', 'The age of Enlightenment', 'The modern world', 'The modern world']);
  assert.deepEqual([-1000000, -50000, -3301].map(eraOf), ['Deep history', 'Deep history', 'Deep history'], 'anything before the Bronze Age is deep history');
  assert.equal(eraOf(-2000000), 'Deep history');
  assert.equal(eraOf(NaN), null);
  assert.deepEqual(DRAWER_ERAS.map(([n]) => eraYears(n)), ['1,000,000 – 3300 BC', '3300 – 1200 BC', '1200 BC – AD 500', '500 – 1450', '1450 – 1650', '1650 – 1800', 'from 1800']);
});

test('the heading bar runs from 1,000,000 BC to today on log10(years ago + 500): deep history about 68% of it, the modern world about 5%', () => {
  assert.equal(deepX(-1000000, 2026), 0);
  assert.equal(deepX(2026, 2026), 1);
  const years = [-1000000, -700000, -50000, -20000, -3000, -1500, 1, 500, 1450, 1800, 1950, 2026];
  years.forEach((y, i) => { if (i) assert.ok(deepX(y, 2026) > deepX(years[i - 1], 2026), `not monotonic at ${y}`); });
  const share = Object.fromEntries(deepBands(2026).map(([n, a, b]) => [n, b - a]));
  assert.ok(Math.abs(share['Deep history'] - 0.68) < 0.02, `deep history takes ${share['Deep history']}`);
  assert.ok(Math.abs(share['The modern world'] - 0.05) < 0.01, `the modern world takes ${share['The modern world']}`);
  const bands = deepBands(2026);
  assert.equal(bands[0][1], 0);
  assert.equal(bands.at(-1)[2], 1);
  bands.forEach(([, a], i) => { if (i) assert.equal(a, bands[i - 1][2], 'a gap or an overlap between eras'); });
});

test('a family\'s records tie-break in the family\'s order, and checkPerson accepts exactly the families ordered', async () => {
  const { FAMILIES, checkPerson } = await import('../scripts/voyages.mjs');
  assert.deepEqual(Object.keys(FAMILY_ORDER), FAMILIES);
  const people = read('data/voyages/people.json');
  for (const [f, ids] of Object.entries(FAMILY_ORDER)) for (const id of ids) assert.equal(people[id]?.family, f, `${id} is not of ${f}`);
  const rec = (id) => ({ id, family: 'austronesian' });
  assert.deepEqual(['lapita-people', 'marianas-micronesia-settlers', 'austronesian-voyagers'].map(rec).sort(familyOrder).map((p) => p.id),
    ['austronesian-voyagers', 'marianas-micronesia-settlers', 'lapita-people'], 'the user\'s order on #399');
  assert.equal(familyOrder({ id: 'lapita-people', family: 'austronesian' }, { id: 'james-cook' }), 0, 'no family, no tie-break');
  assert.deepEqual(checkPerson('lapita-people', { group: true, family: 'austronesian' }), []);
  assert.equal(checkPerson('x', { family: 'atlantean' }).length, 1);
});

test('a frame across the date line is the short way round, not the whole world (the Lapita, #399)', () => {
  const lapita = frameOf([[147.5, -3], [166.5, -15.5], [178, -18], [-175.2, -21.1], [-171.8, -13.8]]);
  assert.equal(lapita.lonMin, 147.5);
  assert.ok(Math.abs(lapita.lonMax - 188.2) < 1e-9, `lonMax ${lapita.lonMax}`);
  assert.deepEqual([lapita.latMin, lapita.latMax], [-21.1, -3]);
  assert.deepEqual(frameOf([[-10, 30], [120, 40]]), { lonMin: -10, lonMax: 120, latMin: 30, latMax: 40 }, 'one side of the date line: as before');
  assert.deepEqual([frameOf([[-120, 0], [0, 0], [120, 0]]).lonMin, frameOf([[-120, 0], [0, 0], [120, 0]]).lonMax], [-180, 180], 'wider than 200 degrees: the world');
});

test('each era has its own scale for the life bars, with round ticks between its ends', () => {
  const ancient = eraScale('The ancient world', 2026), discovery = eraScale('The age of discovery', 2026), modern = eraScale('The modern world', 2026);
  assert.deepEqual(ancient.ticks.map(([, l]) => l), ['1000 BC', '500 BC', 'AD 1']);
  assert.deepEqual(eraScale('The medieval world').ticks.map(([y]) => y), [750, 1000, 1250]);
  assert.deepEqual(discovery.ticks.map(([y]) => y), [1500, 1550, 1600]);
  assert.deepEqual([modern.from, modern.to], [1800, 2026]);
  assert.equal(eraScale('no such era'), null);
  assert.deepEqual(eraScale('Deep history').ticks.map(([y]) => y), [-750000, -500000, -250000]);
  assert.deepEqual(spanScale(-3000, 1300).ticks.map(([, l]) => l), ['2000 BC', '1000 BC', 'AD 1', '1000']);
  // Magellan, c. 1480 to 1521, on the age of discovery's scale: about a seventh of the way in, a fifth wide
  const [x0, x1, open0, open1] = barOn(discovery, [1480, 1521, true, true]);
  assert.ok(Math.abs(x0 - 30 / 200) < 1e-9 && Math.abs(x1 - 71 / 200) < 1e-9 && !open0 && !open1);
  // a life that runs past its era's end is clipped there and left open
  assert.deepEqual(barOn(eraScale('The medieval world'), [1420, 1480, true, true]).slice(1), [1, false, true]);
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

test('the lens bar gives the open era LENS_SHARE on a straight scale and squeezes the rest in deepX proportion', () => {
  const medieval = 'The medieval world', bands = lensBands(medieval, 2026);
  assert.deepEqual(bands.map(([n]) => n), DRAWER_ERAS.map(([n]) => n));
  assert.equal(bands[0][1], 0);
  assert.ok(Math.abs(bands.at(-1)[2] - 1) < 1e-9);
  for (let i = 1; i < bands.length; i++) assert.ok(Math.abs(bands[i][1] - bands[i - 1][2]) < 1e-9, 'end to end');
  const own = bands.find(([n]) => n === medieval);
  assert.ok(Math.abs(own[2] - own[1] - LENS_SHARE) < 1e-9);
  const deep = Object.fromEntries(deepBands(2026).map(([n, a, b]) => [n, b - a])), lens = Object.fromEntries(bands.map(([n, a, b]) => [n, b - a]));
  const ratio = (m) => lens[m] / deep[m];
  assert.ok(Math.abs(ratio('Deep history') - ratio('The modern world')) < 1e-9, 'the closed eras keep their proportions');
  // straight inside the open era: equal years, equal widths
  assert.ok(Math.abs((lensX(1000, medieval, 2026) - lensX(700, medieval, 2026)) - (lensX(1300, medieval, 2026) - lensX(1000, medieval, 2026))) < 1e-9);
  assert.ok(Math.abs(lensX(500, medieval, 2026) - own[1]) < 1e-9);
  // rising across the whole bar
  const ys = [-500000, -40000, -1500, 0, 500, 1000, 1449, 1450, 1800, 2000];
  for (let i = 1; i < ys.length; i++) assert.ok(lensX(ys[i], medieval, 2026) > lensX(ys[i - 1], medieval, 2026), `${ys[i]} after ${ys[i - 1]}`);
});

test('with no era open the lens bar is the heading bar', () => {
  assert.deepEqual(lensBands(null, 2026), deepBands(2026));
  for (const y of [-40000, 0, 1300, 1900]) assert.ok(Math.abs(lensX(y, null, 2026) - deepX(y, 2026)) < 1e-9);
  assert.ok(Number.isNaN(lensX(NaN, null, 2026)));
});

test('the mansa before Musa sits right before Musa, whatever their years', () => {
  const rows = [['mansa-musa', 1280], ['ibn-battuta', 1304], ['abu-bakr-ii', 1311], ['zheng-he', 1371]].map(([id, y]) => [{ id }, y]);
  assert.deepEqual(withRightBefore(rows).map(([p, y]) => [p.id, y]), [['abu-bakr-ii', 1311], ['mansa-musa', 1280], ['ibn-battuta', 1304], ['zheng-he', 1371]]);
});
