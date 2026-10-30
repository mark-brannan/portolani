// How close a person or a voyage flies (the user's walk of 2026-10-30): no closer than zoom 6, whatever the record, and
// Mansa Musa framed from the Atlantic coast of north-west Africa to Mecca in what a drawer leaves clear. Offline: reads
// the records in data/voyages/ and the scene's own projection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peopleOf, personFrame, personView, capFlyZoom, viewContaining, FLY_CLOSEST_ZOOM } from '../scripts/people.mjs';
import { readVoyage } from '../scripts/voyages.mjs';
import { voyageView, viewProjection, W, H } from '../scripts/scene.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const index = read('data/voyages/index.json');
const voyages = Object.fromEntries(await Promise.all(index.map(async (id) => [id, await readVoyage(id, async (p) => read(p))])));
const people = peopleOf(read('data/voyages/people.json'), Object.fromEntries(index.map((id) => [id, voyages[id].who])));
const { pictures } = read('packs/overlays/people/people.json');
const sizesOf = (p) => p.images.map((im) => pictures[im.file]).filter(Boolean).map((m) => [m.width, m.height]);
const far = { lon: -60, lat: -75, zoom: 15, projection: 'mercator' }; // a view none of a track lies in, so the voyage flies

test('the fly clamp holds at 7.96, the zoom the mansa before Musa flew at, and leaves a nearer-out view alone', () => {
  assert.equal(FLY_CLOSEST_ZOOM, 6);
  const v = { lon: -18.65, lat: 15.825, zoom: 7.96 };
  assert.deepEqual(capFlyZoom(v), { ...v, zoom: 6 });
  assert.equal(capFlyZoom({ ...v, zoom: 6 }).zoom, 6);
  assert.equal(capFlyZoom({ ...v, zoom: 3.2 }).zoom, 3.2);
  assert.equal(capFlyZoom({ ...v, zoom: 15 }).zoom, 6);
});

test('no person and no voyage flies closer than zoom 6', () => {
  assert.ok(people.length > 20 && index.length > 20);
  for (const id of index) {
    const to = voyageView(voyages[id], far);
    assert.ok(to, `${id}: no flight`);
    assert.ok(capFlyZoom(to).zoom <= 6, `${id}: z${to.zoom}`);
  }
  for (const p of people) {
    const f = personFrame(p, voyages);
    if (!f) continue;
    const view = personView(p, f, sizesOf(p));
    assert.ok(view.zoom <= 6, `${p.id}: z${view.zoom}`);
  }
});

test('the mansa before Musa and his fleet are brought out to 6; a person already beyond it keeps their view', () => {
  const raw = (p) => viewContaining(personFrame(p, voyages), { w: W, h: H }).zoom;
  const past = people.filter((p) => personFrame(p, voyages) && raw(p) > 6.5).map((p) => p.id);
  assert.ok(past.includes('abu-bakr-ii'), 'the mansa before Musa is the case that was reported');
  const abu = people.find((p) => p.id === 'abu-bakr-ii');
  assert.equal(personView(abu, personFrame(abu, voyages), sizesOf(abu)).zoom, 6);
  assert.equal(capFlyZoom(voyageView(voyages['mali-atlantic'], far)).zoom, 6);
  const polo = people.find((p) => p.id === 'marco-polo'), plain = viewContaining(personFrame(polo, voyages), { w: W, h: H }).zoom;
  assert.ok(personView(polo, personFrame(polo, voyages), []).zoom <= plain + 1e-9 && plain < 6, 'a person already out of 6 keeps their view');
});

test('Mansa Musa: the west of north Africa, Jeddah and Mecca all clear of the drawer, at 1100 px', () => {
  const musa = people.find((p) => p.id === 'mansa-musa'), f = personFrame(musa, voyages);
  for (const [name, drawer] of [['voyages drawer', 480], ['people drawer', 460]]) {
    const right = ((drawer + 12) * W) / 1100; // the drawer and its 12 px margin, in canvas px at a window 1100 px wide
    const view = personView(musa, f, sizesOf(musa), { w: W, h: H, right });
    assert.ok(view.zoom >= 3 && view.zoom <= 4, `${name}: z${view.zoom}`);
    const proj = viewProjection({ ...view, projection: 'mercator' });
    const places = { Tangier: [-5.8, 35.78], Agadir: [-9.6, 30.4], 'Dakhla': [-15.95, 23.7], Dakar: [-17.45, 14.7], Jeddah: [39.17, 21.54], Mecca: [39.83, 21.42] };
    for (const [place, ll] of Object.entries(places)) {
      const [x, y] = proj.toPx(ll);
      assert.ok(x >= 0 && x <= W - right && y >= 0 && y <= H, `${name}: ${place} at ${x.toFixed(0)}, ${y.toFixed(0)}; the clear part is x 0 to ${(W - right).toFixed(0)}`);
    }
  }
  assert.equal(personView(musa, f, sizesOf(musa), { w: W, h: H, right: 0 }).zoom <= 4, true, 'no closer than the record asks, on any window');
});

test('the page flies through the clamp, for a person and for a voyage', () => {
  const page = readFileSync(join(ROOT, 'public/page.js'), 'utf8');
  assert.match(page, /goTo\(personView\(/);
  assert.match(page, /goTo\(capFlyZoom\(to\)\)/);
});
