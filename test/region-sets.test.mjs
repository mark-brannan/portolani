// The drawer's region chips show a sample name of each set (REGION_SAMPLES): each one must be a name the set
// letters, in its own spelling (`latin`) or its reading (`english`), so a renamed or dropped region fails here
// rather than leave a chip showing a name the map no longer letters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REGION_SETS, REGION_SAMPLES, regionsOfToday } from '../scripts/scene.mjs';

const namesOf = async (id) => (id === 'today' ? regionsOfToday() : JSON.parse(await readFile(new URL(`../data/names/${id}.json`, import.meta.url))).names);

test('every region set has a sample, and each sample is a region of its set', async () => {
  assert.deepEqual(Object.keys(REGION_SAMPLES).sort(), [...REGION_SETS].sort());
  for (const id of REGION_SETS) {
    const names = await namesOf(id);
    const { latin, english } = REGION_SAMPLES[id];
    assert.ok(names.some((r) => r.name === latin && r.reading === english), `${id}: no region lettered ${latin} / ${english}`);
  }
});
