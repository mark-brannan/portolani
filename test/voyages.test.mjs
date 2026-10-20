// The voyage records (docs/voyages/README.md): each one the index lists is well formed and keeps its sea
// legs at sea on the Natural Earth 50m coast, the index lists every record, and the paths are cut and
// sampled as the drawing needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legPath, splitAtSeam, problems, distanceKm, STEP_KM } from '../scripts/voyages.mjs';
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
