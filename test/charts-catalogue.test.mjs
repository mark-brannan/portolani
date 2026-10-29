import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Every catalogue in data/charts/ (the portolans, the other traditions, any added later) holds to the same checks.
const dir = new URL('../data/charts/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const COMMONS = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//;

test('data/charts/ holds at least the portolans and the other traditions', () => {
  for (const f of ['portolans.json', 'world.json']) assert.ok(files.includes(f), f);
});

for (const file of files) {
  const { charts } = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));

  test(`${file}: every chart has an id, a title, a licence and a source page, ids unique`, () => {
    const ids = new Set();
    for (const c of charts) {
      assert.match(c.id, /^[a-z0-9-]+$/, c.id);
      assert.ok(!ids.has(c.id), `${c.id}: twice`); ids.add(c.id);
      assert.ok(c.title && c.licence && c.page, `${c.id}: title, licence and page`);
      assert.ok(['ship', 'link'].includes(c.status), `${c.id}: status ${c.status}`);
      if (c.status === 'link') assert.ok(c.reason, `${c.id}: a link-only chart says why`);
      if (c.bbox) {
        const [x0, x1, y0, y1] = c.bbox;
        assert.ok(c.bbox.length === 4 && x0 < x1 && y0 < y1 && x0 >= -180 && x1 <= 180 && y0 >= -90 && y1 <= 90, `${c.id}: bbox [lonMin, lonMax, latMin, latMax] on the globe`);
      }
    }
  });

  test(`${file}: every open scan has its full-size original and a display copy on Commons`, () => {
    for (const c of charts.filter((c) => c.status === 'ship')) {
      assert.match(c.original, COMMONS, c.id);
      assert.match(c.display, COMMONS, c.id);
      if (c.thumb) assert.match(c.thumb, COMMONS, c.id);
      assert.ok(c.width > 0 && c.height > 0, `${c.id}: dimensions`);
      const at = c.original.split('/commons/')[1].split('/').slice(0, 2).join('/');
      if (Math.max(c.width, c.height) > 3840) assert.ok(c.display.includes(`/thumb/${at}/`) && c.display.includes('/3840px-'), `${c.id}: display is a 3840 px rendering of original`);
      else assert.equal(c.display, c.original, `${c.id}: a scan within 3840 px is its own display`);
    }
  });
}
