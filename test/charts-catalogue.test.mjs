import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { charts } = JSON.parse(readFileSync(new URL('../data/charts/portolans.json', import.meta.url), 'utf8'));

test('every chart in the catalogue has an id, a title, a licence and a source page, ids unique', () => {
  const ids = new Set();
  for (const c of charts) {
    assert.match(c.id, /^[a-z0-9-]+$/, c.id);
    assert.ok(!ids.has(c.id), `${c.id}: twice`); ids.add(c.id);
    assert.ok(c.title && c.licence && c.page, `${c.id}: title, licence and page`);
    assert.ok(['ship', 'link'].includes(c.status), `${c.id}: status ${c.status}`);
    if (c.status === 'link') assert.ok(c.reason, `${c.id}: a link-only chart says why`);
  }
});

test('every open scan has its full-size original and a display copy on Commons', () => {
  for (const c of charts.filter((c) => c.status === 'ship')) {
    assert.match(c.original, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, c.id);
    assert.match(c.display, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//, c.id);
  }
});
