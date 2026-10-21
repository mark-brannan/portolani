// The voyage records (docs/voyages/README.md): each one the index lists is well formed and keeps its sea
// legs at sea on the Natural Earth 50m coast, the index lists every record, and the paths are cut and
// sampled as the drawing needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { viewProjection, voyageMarks, W, H } from '../scripts/scene.mjs';
import { legPath, splitAtSeam, problems, distanceKm, STEP_KM, voyageColours, VOYAGE_PALETTE } from '../scripts/voyages.mjs';
import { loadLand, checkVoyage, voyageIds, readVoyage } from '../scripts/check-voyages.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'voyages');
const INDEX = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
let land;
const landOnce = () => (land ??= loadLand());

for (const id of INDEX) {
  test(`voyage ${id}: well formed, and every sea sample at sea`, () => {
    assert.ok(existsSync(join(DIR, `${id}.json`)), `${id}: the index lists it but data/voyages/${id}.json is missing`);
    const v = readVoyage(id);
    assert.equal(v.id, id, `${id}: the record's id is not its file name`);
    assert.deepEqual(problems(v), [], `${id}: schema problems`);
    const ashore = checkVoyage(v, landOnce()).filter((f) => f.where);
    assert.equal(ashore.length, 0, `${id}: ${ashore.length} sea samples on land, first: ${ashore.slice(0, 5).map((f) => `${f.what} at ${f.where.join(', ')}`).join('; ')}`);
  });
}

test('the index lists every voyage record', () => {
  const missing = voyageIds().filter((id) => !INDEX.includes(id));
  assert.deepEqual(missing, [], `in data/voyages/ but not in index.json: ${missing.join(', ')}`);
});

test('the Magellan Pacific crossing is cut at the seam of a map centred on 10° E', () => {
  const v = readVoyage('magellan');
  // the leg whose continuous longitude runs past 180: the one that crosses the date line
  const pacific = v.legs.find((leg) => legPath(leg).some(([lon]) => Math.abs(lon) > 180));
  assert.ok(pacific, 'no Magellan leg crosses the date line');
  assert.ok(splitAtSeam(legPath(pacific), 10).length > 1, 'the crossing is one stroke across the seam');
});

test('a rhumb leg keeps between its ends\' latitudes and is sampled about every STEP_KM', () => {
  const a = [-6.35, 36.78], b = [-16.25, 28.47];
  const path = legPath({ line: 'rhumb', points: [a, b] });
  assert.deepEqual(path[0], a);
  assert.deepEqual(path.at(-1).map((x) => Number(x.toFixed(6))), b);
  for (const [, lat] of path) assert.ok(lat >= b[1] - 1e-9 && lat <= a[1] + 1e-9, `${lat} outside ${b[1]}..${a[1]}`);
  const steps = path.slice(1).map((p, i) => distanceKm(path[i], p));
  assert.ok(Math.max(...steps) <= STEP_KM * 1.05, `a step of ${Math.max(...steps).toFixed(1)} km`);
  assert.ok(Math.min(...steps) >= STEP_KM * 0.8, `a step of ${Math.min(...steps).toFixed(1)} km`);
});

// A minimal well-formed record to bend in the schema tests below.
const base = () => ({
  id: 'x', title: 't', short: 's', when: 'w', summary: 'm', who: ['A B'], sources: [{ title: 't', url: 'u' }],
  legs: [{ from: 'a', to: 'b', mode: 'sea', line: 'rhumb', confidence: 'attested', source: 's', points: [[0, 0], [1, 1]] }],
  events: [{ kind: 'death', who: 'A B', lon: 1, lat: 1, label: 'l', source: 's' }]
});
const alt = { lon: 2, lat: 2, place: 'Elsewhere', label: 'Died elsewhere', source: 'a chronicle' };

test('a death may list alternative places, each with a position, a place, a label and a source', () => {
  const v = base();
  v.events[0].alternatives = [alt];
  assert.deepEqual(problems(v), []);
  v.events[0].alternatives = [{ ...alt, lon: 200 }, { ...alt, source: '' }, { lat: 1 }];
  const found = problems(v);
  assert.ok(found.some((p) => p.includes('alternative 0: lon and lat')), found.join('; '));
  assert.ok(found.some((p) => p.includes('alternative 1: a source')), found.join('; '));
  assert.ok(found.some((p) => p.includes('alternative 2: lon and lat')), found.join('; '));
  v.events[0].alternatives = [];
  assert.ok(problems(v).some((p) => p.includes('alternatives')));
});

test('alternatives belong to a death, not to a landfall', () => {
  const v = base();
  v.events.push({ kind: 'landfall', lon: 1, lat: 1, label: 'l', source: 's', alternatives: [alt] });
  assert.ok(problems(v).some((p) => p.includes('alternatives belong to a death')));
});

test('a person whose place of death is unknown goes in deathUnknown, and only then needs no death event', () => {
  const v = base();
  v.events = [];
  assert.ok(problems(v).some((p) => p.includes('where A B died')));
  v.deathUnknown = ['A B'];
  assert.deepEqual(problems(v), []);
  v.deathUnknown = ['C D'];
  assert.ok(problems(v).some((p) => p.includes('deathUnknown: names from who')));
  v.deathUnknown = ['A B'];
  v.events = base().events;
  assert.ok(problems(v).some((p) => p.includes('is in deathUnknown but has a death event')));
});

test('an event and an alternative may carry text for its tile, and it must be a non-empty string', () => {
  const v = base();
  v.events[0].text = 'Flavour.';
  v.events[0].alternatives = [{ ...alt, text: 'Also flavour.' }];
  assert.deepEqual(problems(v), []);
  v.events[0].text = '';
  v.events[0].alternatives = [{ ...alt, text: 3 }];
  const found = problems(v);
  assert.ok(found.some((p) => p.includes('event 0: text')), found.join('; '));
  assert.ok(found.some((p) => p.includes('alternative 0: text')), found.join('; '));
});

test('a voyage\'s marks carry the tile a tap opens: the usual skull last, its alternatives fainter and first', () => {
  const v = readVoyage('zheng-he');
  const proj = viewProjection({ lon: 85, lat: 20, zoom: 1.5 });
  const marks = voyageMarks(v, proj, { x0: 0, y0: 0, x1: W, y1: H });
  const [usual] = marks.slice(-1);
  assert.equal(usual.tile.title, v.events[0].label);
  assert.ok(usual.tile.text.length > 0, 'the usual account has text');
  const alts = marks.slice(0, -1);
  assert.ok(alts.length >= 1 && alts.every((m) => m.tile.alternative && m.alpha < 1 && m.h < usual.h));
  assert.deepEqual(voyageMarks(null, proj, { x0: 0, y0: 0, x1: W, y1: H }), []);
});

test('Zheng He\'s skull stands at the middle of the Calicut–Malacca leg, the first homeward leg, since no source gives a place', () => {
  const v = readVoyage('zheng-he');
  const leg = v.legs.find((l) => l.from === 'Calicut' && l.to === 'Malacca');
  const path = legPath(leg), death = v.events.find((e) => e.kind === 'death');
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceKm(path[i - 1], path[i]);
  let nearest = Infinity, along = 0, run = 0;
  for (let i = 1; i < path.length; i++) {
    const d = distanceKm(path[i], [death.lon, death.lat]);
    if (d < nearest) { nearest = d; along = run + distanceKm(path[i - 1], path[i]); }
    run += distanceKm(path[i - 1], path[i]);
  }
  assert.ok(nearest < STEP_KM, `the skull is ${nearest.toFixed(0)} km from the leg`);
  assert.ok(Math.abs(along / total - 0.5) < 0.03, `the skull is ${(100 * along / total).toFixed(0)}% along the leg`);
});

test('every Zheng He file carries the same death as the seventh voyage', () => {
  const death = (id) => readVoyage(id).events.find((e) => e.kind === 'death');
  for (const id of ['zheng-he-1', 'zheng-he-4', 'zheng-he-5']) assert.deepEqual(death(id), death('zheng-he'), id);
});

test('the alternatives fixture is well formed, and a bad alternative is named for each thing it lacks', () => {
  const v = JSON.parse(readFileSync(join(DIR, '..', '..', 'test', 'fixtures', 'voyage-alternatives.json'), 'utf8'));
  assert.deepEqual(problems(v), []);
  const bad = structuredClone(v);
  bad.events[0].alternatives.push({ lon: 200, lat: 0, label: 'off the earth' });
  assert.deepEqual(problems(bad), ['event 0 alternative 2: lon and lat', 'event 0 alternative 2: a place', 'event 0 alternative 2: a source']);
});

test('voyage colours: the first red, the rest distinct and seeded on the id, a picked one kept', () => {
  const ids = ['columbus', 'drake', 'magellan', 'polo'];
  const c = voyageColours(ids);
  assert.equal(c.columbus, VOYAGE_PALETTE[0]);
  assert.equal(new Set(Object.values(c)).size, ids.length);
  assert.deepEqual(voyageColours(ids), c, 'the same list drew other colours');
  assert.equal(voyageColours(['magellan', 'drake']).drake, voyageColours(['polo', 'drake']).drake, 'a voyage changed ink with its neighbour');
  const picked = voyageColours(ids, { columbus: '#1f4e8c' });
  assert.equal(picked.columbus, '#1f4e8c');
  assert.equal(picked.drake, VOYAGE_PALETTE[0], 'red is free, so the next one takes it');
  assert.equal(Object.keys(voyageColours(VOYAGE_PALETTE.map((_, i) => `v${i}`).concat('extra'))).length, VOYAGE_PALETTE.length + 1);
});
