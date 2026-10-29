// The voyage records (readVoyage and problems in scripts/voyages.mjs): each one the index lists resolves, is well formed and keeps its sea
// legs at sea on the Natural Earth 50m coast, the index lists every record, and the paths are cut and
// sampled as the drawing needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legPath, splitAtSeam, problems, personProblems, distanceKm, STEP_KM, readVoyage, voyageColours, VOYAGE_PALETTE } from '../scripts/voyages.mjs';
import { viewProjection, voyageMarks, voyageView, W, H } from '../scripts/scene.mjs';
import { loadLand, checkVoyage, voyageIds, readJSON } from '../scripts/check-voyages.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'voyages');
const INDEX = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
let land;
const landOnce = () => (land ??= loadLand());
const voyage = (id) => readVoyage(id, readJSON);

for (const id of INDEX) {
  test(`voyage ${id}: well formed, and every sea sample at sea`, async () => {
    assert.ok(existsSync(join(DIR, `${id}.json`)), `${id}: the index lists it but data/voyages/${id}.json is missing`);
    const v = await voyage(id);
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

test('the Magellan Pacific crossing is cut at the seam of a map centred on 10° E', async () => {
  const v = await voyage('magellan');
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

// Choosing a voyage: the view stays while any of its track is on the canvas, else it fits the whole track.
test('a voyage chosen in view keeps the view; one off screen is fitted, the short way round the date line', async () => {
  const leg = (points) => ({ line: 'rhumb', points });
  const atlantic = { legs: [leg([[-10, 40], [-30, 30]]), leg([[-30, 30], [-60, 15]])] };
  const lisbon = { lon: -9, lat: 38.7, zoom: 7.5, projection: 'mercator' };
  assert.equal(voyageView(atlantic, lisbon), null, 'the track starts in view, so the view should stay');
  const china = { lon: 120, lat: 25, zoom: 6, projection: 'mercator' };
  const to = voyageView(atlantic, china);
  assert.ok(to, 'none of the track is in view, so the view should move');
  const proj = viewProjection(to);
  for (const p of atlantic.legs.flatMap((l) => l.points)) {
    const [x, y] = proj.toPx(p);
    assert.ok(x >= 0 && x <= W && y >= 0 && y <= H, `${p} is off the fitted canvas at ${x.toFixed(0)}, ${y.toFixed(0)}`);
  }
  // across the date line: centred on the Pacific, not on the other side of the globe
  const pacific = { legs: [leg([[170, -10], [-170, -15]])] };
  const far = voyageView(pacific, { lon: 0, lat: 40, zoom: 6, projection: 'mercator' });
  assert.ok(Math.abs(Math.abs(far.lon) - 180) < 1, `centred on ${far.lon}`);
  assert.ok(far.zoom > 3, `zoom ${far.zoom}: framed the long way round`);
  // a real record: Magellan sets out from Sanlúcar, so a view on Seville stays, and one on the North Sea moves
  const magellan = await voyage('magellan');
  assert.equal(voyageView(magellan, { lon: -6, lat: 37, zoom: 7, projection: 'mercator' }), null);
  assert.ok(voyageView(magellan, { lon: 0, lat: 60, zoom: 9, projection: 'mercator' }));
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

// readVoyage over files held in memory: { 'x': voyage, people, sources }
const files = (set) => (path) => {
  const name = path.replace(/^data\/voyages\/|\.json$/g, '');
  if (!(name in set)) throw new Error(`no ${path}`);
  return structuredClone(set[name]);
};
const raw = () => {
  const { events, sources, ...v } = base();
  return { ...v, sources: ['s1'], events: [] };
};
const shared = () => ({ people: { 'A B': { death: { lon: 1, lat: 1, date: 'd', label: 'l', source: 's' } } }, sources: { s1: { title: 't', url: 'https://u' } } });

test('a person\'s death lives once, in people.json, and joins every voyage that names them', async () => {
  const set = { x: raw(), y: { ...raw(), id: 'y' }, ...shared() };
  for (const id of ['x', 'y']) {
    const v = await readVoyage(id, files(set));
    assert.deepEqual(problems(v), []);
    assert.deepEqual(v.events, [{ kind: 'death', who: 'A B', lon: 1, lat: 1, date: 'd', label: 'l', source: 's' }]);
    assert.deepEqual(v.sources, [{ title: 't', url: 'https://u' }]);
  }
  set.x.events = [{ kind: 'death', who: 'A B', lon: 1, lat: 1, label: 'l', source: 's' }];
  await assert.rejects(readVoyage('x', files(set)), /people\.json/);
});

test('a person nobody knows the place of death of is "unknown" in people.json and gets no skull; one missing there is a problem', async () => {
  const set = { x: raw(), ...shared() };
  set.people['A B'] = { death: 'unknown' };
  const v = await readVoyage('x', files(set));
  assert.deepEqual([v.events, v.deathUnknown, problems(v)], [[], ['A B'], []]);
  set.people = {};
  assert.ok(problems(await readVoyage('x', files(set))).some((p) => p.includes('where A B died')));
});

test('a person record may be a death alone, or carry a birth, bio and portrait; a living person gets no skull', async () => {
  const death = { lon: 1, lat: 1, date: 'd', label: 'l', source: 's' };
  assert.deepEqual(personProblems('A B', { death }), []);
  assert.deepEqual(personProblems('A B', { death: 'unknown' }), []);
  const full = {
    id: 'a-b', aka: ['Ab'], origin: 'o', role: ['r'], voyages: ['x'], bio: 'b', sources: ['https://u'],
    portrait: { file: 'A_B.jpg', kind: 'life', author: 'a', date: '1600', licence: 'Public domain' },
    born: { ...death, known: 'speculative', cite: 's1', alternatives: [{ lon: 2, lat: 2, place: 'p', label: 'l', source: 's' }] }, death,
  };
  assert.deepEqual(personProblems('A B', full, { sources: { s1: {} }, voyageIds: ['x'] }), []);
  const bad = personProblems('A B', { ...full, born: { ...death, known: 'certain' }, portrait: { kind: 'life', file: 'https://x/A.jpg' } }, { voyageIds: [] });
  for (const p of ['born: known', 'portrait: file', 'portrait: a licence', 'x is not a voyage']) assert.ok(bad.some((b) => b.includes(p)), p);
  assert.ok(personProblems('A B', { living: true, death }).some((p) => p.includes('living')));
  const set = { x: raw(), ...shared() };
  set.people['A B'] = { living: true, born: { ...death, known: 'attested' } };
  assert.deepEqual(personProblems('A B', set.people['A B']), []);
  const v = await readVoyage('x', files(set));
  assert.deepEqual([v.events, v.living, problems(v)], [[], ['A B'], []]);
});

test('a source is an id into sources.json, and one that is not there does not resolve', async () => {
  const set = { x: { ...raw(), sources: ['nowhere'] }, ...shared() };
  await assert.rejects(readVoyage('x', files(set)), /source nowhere/);
});

test('a shared leg is sameAs the leg its owner names, with its own dates and nothing else', async () => {
  const owner = { ...raw(), legs: [{ ...base().legs[0], id: 'a-b', dates: '1405' }] };
  const set = { x: owner, y: { ...raw(), id: 'y', legs: [{ sameAs: 'x/a-b', dates: '1413' }] }, ...shared() };
  const { id: _, ...leg } = owner.legs[0];
  assert.deepEqual((await readVoyage('y', files(set))).legs, [{ ...leg, dates: '1413' }]);
  set.y.legs = [{ sameAs: 'x/b-c' }];
  await assert.rejects(readVoyage('y', files(set)), /names no leg/);
  set.y.legs = [{ sameAs: 'x/a-b', source: 'other' }];
  await assert.rejects(readVoyage('y', files(set)), /only dates/);
});

test('every person in people.json and every source in sources.json is named by a voyage', async () => {
  const voyages = await Promise.all(INDEX.map((id) => readJSON(`data/voyages/${id}.json`)));
  const people = Object.keys(readJSON('data/voyages/people.json')).filter((w) => !voyages.some((v) => v.who.includes(w)));
  const sources = Object.keys(readJSON('data/voyages/sources.json')).filter((s) => !voyages.some((v) => v.sources.includes(s)));
  assert.deepEqual([people, sources], [[], []]);
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

test('a voyage\'s marks carry the tile a tap opens: the usual skull last, its alternatives fainter and first', async () => {
  const v = await voyage('zheng-he');
  const proj = viewProjection({ lon: 85, lat: 20, zoom: 1.5 });
  const marks = voyageMarks(v, proj, { x0: 0, y0: 0, x1: W, y1: H }).filter((m) => m.skull);
  const [usual] = marks.slice(-1);
  assert.equal(usual.tile.title, v.events.find((e) => e.kind === 'death').label);
  assert.ok(usual.tile.text.length > 0, 'the usual account has text');
  const alts = marks.slice(0, -1);
  assert.ok(alts.length >= 1 && alts.every((m) => m.tile.alternative && m.alpha < 1 && m.h < usual.h));
  assert.deepEqual(voyageMarks(null, proj, { x0: 0, y0: 0, x1: W, y1: H }), []);
});

test('Zheng He\'s skull stands at the middle of the Calicut–Malacca leg, the first homeward leg, since no source gives a place', async () => {
  const v = await voyage('zheng-he');
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

test('every event and death of every voyage links its tile to a source, and every voyage has a landing, death or fight to tap', async () => {
  for (const id of JSON.parse(readFileSync('data/voyages/index.json', 'utf8'))) {
    const { events } = await voyage(id);
    assert.ok(events.length, `${id}: no event`);
    for (const e of events) {
      assert.ok(e.cited?.url?.startsWith('https://'), `${id}: ${e.label} cites no source`);
      for (const a of e.alternatives ?? []) assert.ok(a.cited?.url, `${id}: ${a.label} cites no source`);
    }
  }
});

test('a cite resolves into sources.json; an alternative place takes its death\'s; one not there does not resolve; the mark\'s tile carries it', async () => {
  const set = { x: { ...raw(), events: [{ kind: 'landfall', lon: 1, lat: 1, label: 'l', source: 's', cite: 's1' }] }, ...shared() };
  set.people['A B'].death = { ...set.people['A B'].death, cite: 's1', alternatives: [alt] };
  const v = await readVoyage('x', files(set));
  assert.deepEqual(problems(v), []);
  assert.deepEqual(v.events.map((e) => [e.cite, e.cited, e.alternatives?.[0].cited]), [[undefined, { title: 't', url: 'https://u' }, undefined], [undefined, { title: 't', url: 'https://u' }, { title: 't', url: 'https://u' }]]);
  const proj = { toPx: ([lon, lat]) => [lon * 10, lat * 10] };
  assert.ok(voyageMarks(v, proj, { x0: -100, y0: -100, x1: 100, y1: 100 }).every((m) => m.tile.cited?.url === 'https://u'));
  const bad = { ...v, events: v.events.map((e) => ({ ...e, cited: { title: 't', url: 'javascript:alert(1)' }, ...(e.alternatives ? { alternatives: e.alternatives.map((a) => ({ ...a, cited: { title: 't', url: 'javascript:alert(1)' } })) } : {}) })) };
  assert.ok(problems(bad).filter((p) => p.includes('https url')).length >= 3, 'a non-https cite is a problem, on events and alternatives');
  set.x.events[0].cite = 'nowhere';
  await assert.rejects(readVoyage('x', files(set)), /source nowhere/);
});

test('every event of every voyage has text for its tile', async () => {
  for (const id of JSON.parse(readFileSync('data/voyages/index.json', 'utf8'))) {
    for (const e of (await voyage(id)).events ?? []) assert.ok(e.text, `${id}: ${e.label} has no text`);
  }
});

test('a place with a tile makes a mark where it stands, and none off the view', async () => {
  const { sightMarks } = await import('../scripts/scene.mjs');
  const rect = { x0: 0, y0: 0, x1: W, y1: H };
  const sights = [{ lon: 8.93, lat: 44.41, tile: { title: 'Genoa' } }, { lon: 150, lat: -30, tile: { title: 'Far' } }];
  const marks = sightMarks(sights, viewProjection({ lon: 8.93, lat: 44.41, zoom: 6 }), rect);
  assert.deepEqual(marks.map((m) => m.tile.title), ['Genoa']);
});

test('every place tile is keyed by a name the page lists', async () => {
  const { SIGHT_TILES } = await import('../scripts/sights.mjs');
  // the list is the page's own: each row opens `['Name', <view>(`, and so does each chart's city
  const listed = new Set([...readFileSync('public/page.js', 'utf8').matchAll(/\['([^']+)', (?:port|at|viewOfFrame|both|around)\(/g)].map((m) => m[1]));
  for (const name of Object.keys(SIGHT_TILES)) assert.ok(listed.has(name), `${name} is not a listed place`);
});

test('noteworthy ports: four eras in time order, six ports each, every one with a tile', async () => {
  const { SIGHT_TILES } = await import('../scripts/sights.mjs');
  const src = readFileSync('public/page.js', 'utf8');
  const eras = [...src.matchAll(/^ {2}\['(The [^']+)', \[\n([\s\S]*?)^ {2}\](?:, 'open')?\],$/gm)]
    .map(([, era, rows]) => [era, [...rows.matchAll(/^ {4}\['([^']+)', port\((?!.*CHARTMAKING)/gm)].map((m) => m[1])]);
  assert.deepEqual(eras.map(([era]) => era), ['The ancient world', 'The medieval Indian Ocean and Asia', 'The age of discovery', 'The modern world']);
  for (const [era, ports] of eras) {
    assert.equal(ports.length, 6, `${era} has ${ports.length} ports`);
    for (const name of ports) assert.ok(SIGHT_TILES[name], `${name} has no tile`);
  }
});

// every tile carries a date (a year, a century or a span, never a phrase) and its text, shown under its name in the list
test('every place tile has a date and a text', async () => {
  const { SIGHT_TILES } = await import('../scripts/sights.mjs');
  for (const [name, { date, text }] of Object.entries(SIGHT_TILES)) {
    assert.match(date, /^(c\. )?\d+(st|nd|rd|th)?(s|–\d+(st|nd|rd|th)?)?( c\.)?( (BC|AD))?$|^\d+(st|nd|rd|th)( c\.)?( AD)?$|^\d+(st|nd|rd|th)–\d+(st|nd|rd|th) c\.( AD)?$/, `${name}'s date is ${date}`);
    assert.ok(text?.length > 40, `${name} has no text`);
  }
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

// The menu is chronological: the first number of `when` is the start year (BC negative). A voyage's own
// sub-voyages (columbus, columbus-2..4; zheng-he, zheng-he-1, -4, -5) stay together, ordered by their own
// dates, and the family sits where its first voyage starts.
test('the index is in chronological order of start year, sub-voyages together', () => {
  const year = (id) => {
    const when = JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8')).when;
    const n = Number(/\d+/.exec(when)[0]);
    return /\bBC\b/.test(when) ? -n : n;
  };
  const family = (id) => id.replace(/-\d+$/, '');
  const years = INDEX.map(year);
  const firstOf = new Map();
  INDEX.forEach((id, i) => { const f = family(id); firstOf.set(f, Math.min(firstOf.get(f) ?? Infinity, years[i])); });
  const seen = new Set();
  INDEX.forEach((id, i) => {
    const f = family(id);
    if (i && family(INDEX[i - 1]) === f) assert.ok(years[i] >= years[i - 1], `${id} (${years[i]}) is before ${INDEX[i - 1]} (${years[i - 1]})`);
    else {
      assert.ok(!seen.has(f), `${f}: its voyages are not together in the index`);
      if (i) assert.ok(firstOf.get(f) >= firstOf.get(family(INDEX[i - 1])), `${f} is listed after ${family(INDEX[i - 1])}`);
    }
    seen.add(f);
  });
});
