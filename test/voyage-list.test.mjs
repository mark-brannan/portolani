// The voyages drawer's list (#242): earliest voyage first, the index's order breaking ties, each with a summary and a
// link to read more (scripts/voyages.mjs voyageStart, chronological, voyageLink).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { voyageStart, chronological, voyageLink } from '../scripts/voyages.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(`../data/voyages/${p}.json`, import.meta.url), 'utf8'));

test('a voyage\'s start year is read off its when, negative before Christ', () => {
  assert.equal(voyageStart('c. 600 BC'), -600);
  assert.equal(voyageStart('c. 330–320 BC'), -330);
  assert.equal(voyageStart('c. 1000'), 1000);
  assert.equal(voyageStart('1497–1499'), 1497);
  assert.ok(Number.isNaN(voyageStart(undefined)));
});

test('the drawer lists the voyages chronologically, ties in file order, undated last', () => {
  const pairs = [['b', { when: '1500' }], ['x', {}], ['a', { when: 'c. 500 BC' }], ['c', { when: '1500–1502' }]];
  assert.deepEqual(chronological(pairs).map(([id]) => id), ['a', 'b', 'c', 'x']);
  const ids = read('index'), list = chronological(ids.map((id) => [id, read(id)]));
  const years = list.map(([, v]) => voyageStart(v.when));
  assert.ok(years.every((y, i) => !Number.isNaN(y) && (i === 0 || y >= years[i - 1])), 'every voyage dated and in order');
  assert.ok(list.findIndex(([id]) => id === 'da-gama') < list.findIndex(([id]) => id === 'columbus-3'), 'da Gama 1497 before Columbus 1498');
});

test('every voyage in the drawer has a summary and a link to read more', () => {
  const sources = read('sources');
  for (const id of read('index')) {
    const v = read(id), link = voyageLink(v, sources);
    assert.ok(typeof v.summary === 'string' && v.summary.length > 20, `${id} summary`);
    assert.ok(link && /^https:\/\//.test(link.url) && link.label, `${id} link`);
  }
  assert.equal(voyageLink({ who: ['Hanno the Navigator'] }).url, 'https://en.wikipedia.org/wiki/Hanno_the_Navigator');
});
