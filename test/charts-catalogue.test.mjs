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
    const dir = c.original.split('/commons/')[1].split('/').slice(0, 2).join('/');
    assert.ok(c.display.includes(`/thumb/${dir}/`) && c.display.includes('/3840px-'), `${c.id}: display is a 3840 px rendering of original`);
    assert.ok(c.width > 0 && c.height > 0, `${c.id}: dimensions`);
  }
});

test('every bbox is a west-east, south-north box on the globe', () => {
  for (const c of charts) {
    const [x0, x1, y0, y1] = c.bbox;
    assert.ok(x0 < x1 && y0 < y1 && x0 >= -180 && x1 <= 180 && y0 >= -90 && y1 <= 90, c.id);
  }
});
