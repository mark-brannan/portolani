// #131 step 5: after a drag of 1% of the window, the mountains, small towns, names and countries that are still in
// the window stand where they stood. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, panView, KINDS } from '../scripts/scene.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const names = joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

const placed = async (view) => {
  const { scene, data } = await createScene(env, { view, scale: 'off', kinds: KINDS, relief: ['marina'] });
  const all = (kind, l, label) => (l ?? []).map((o) => ({ kind, label: label(o), ll: data.proj.invert(o.x, o.y) }));
  return {
    proj: data.proj, cart: scene.cartouche,
    list: [
      ...all('mountain', scene.mountains, (o) => o.sprite.id),
      ...all('town', scene.towns.filter((t) => !t.city), (o) => o.name),
      ...all('small place', scene.lesser, (o) => o.name),
      ...all('name', scene.names.filter((n) => n.kind !== 'coast'), (o) => o.text),
      ...all('country', scene.names.filter((n) => n.kind === 'coast'), (o) => o.text),
    ],
  };
};

const SITES = { genoa: [8.93, 44.41], dalmatia: [16.44, 43.51], aegean: [25.2, 37.2] };
for (const [site, [lon, lat]] of Object.entries(SITES)) for (const zoom of [5, 7, 9, 11]) {
  test(`after a drag of 1% of the window at ${site} z${zoom} every mountain, small town, name and country keeps its place`, async () => {
    const from = { lon, lat, zoom };
    const [a, b] = await Promise.all([from, panView(from, 1600 * 0.01, 0)].map(placed));
    const kinds = ['mountain', 'town', 'small place', 'name', 'country'];
    let total = 0;
    for (const kind of kinds) {
      // those still well inside the second window: one that leaves it, or comes in at its edge, is not a jump
      // (and not beside the cartouche, which is pinned to the window and clears what stands near it as the map slides under it)
      const c = a.cart, nearCart = (x, y) => x > c.x - 100 && x < c.x + c.w + 100 && y > c.y - 100 && y < c.y + c.h + 100;
      const of = a.list.filter((o) => o.kind === kind).filter((o) => { const [x, y] = b.proj.project(...o.ll); return x > 80 && x < 1520 && y > 80 && y < 920 && !nearCart(x, y); });
      const lost = of.filter((o) => { const [x, y] = b.proj.project(...o.ll); return !b.list.some((q) => q.kind === kind && q.label === o.label && Math.hypot(b.proj.project(...q.ll)[0] - x, b.proj.project(...q.ll)[1] - y) <= 2); });
      console.log(`# ${site} z${zoom} ${kind}: ${of.length - lost.length}/${of.length} kept after a 1% drag`);
      assert.deepEqual(lost.map((o) => o.label), [], `every ${kind} in the window keeps its place`);
      total += of.length;
    }
    assert.ok(total > 0, 'something is placed');
  });
}
