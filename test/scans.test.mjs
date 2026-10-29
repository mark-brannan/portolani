import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { catalogue, shippable, shrunk, LONG } from '../scripts/build-scans.mjs';

const ROOT = new URL('..', import.meta.url);
const charts = catalogue();

test('a scan is shrunk to its long side, never enlarged', () => {
  assert.deepEqual(shrunk(8000, 4000), [LONG, LONG / 2]);
  assert.deepEqual(shrunk(3000, 9000), [1333, LONG]);
  assert.deepEqual(shrunk(1200, 800), [1200, 800]);
});

test('every chart in the catalogue has an id, a title, a licence and a source page, ids unique', () => {
  const ids = new Set();
  for (const c of charts) {
    assert.match(c.id, /^[a-z0-9-]+$/, c.id);
    assert.ok(!ids.has(c.id), `${c.id}: twice`); ids.add(c.id);
    assert.ok(c.title && c.licence && c.page, `${c.id}: title, licence and page`);
    assert.ok(['ship', 'link'].includes(c.status), `${c.id}: status ${c.status}`);
  }
});

test('every shippable scan has a checksum, and its shrunk JPEG is in packs/scans/', () => {
  for (const c of charts.filter(shippable)) {
    assert.match(c.scan.sha256, /^[0-9a-f]{64}$/, c.id);
    assert.ok(existsSync(new URL(`packs/scans/${c.id}.jpg`, ROOT)), `${c.id}: run npm run scans`);
  }
});
