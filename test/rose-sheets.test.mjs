// Roses and rhumb lines belong to the atlas's sheets, not the window (docs/atlas/README.md). Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, viewProjection, panView, BUDGET } from '../scripts/scene.mjs';
import { territory } from '../scripts/atlas.mjs';
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

// where a rose stands on the earth, to a millionth of a degree, with the sheet it belongs to
const earth = async (view) => {
  const { scene, data } = await createScene(env, { view, scale: 'off' });
  return {
    roses: scene.roseDraws.map((r) => `${r.sheet} ${r.sprite.id} ${data.proj.invert(r.x, r.y).map((v) => v.toFixed(6)).join(' ')}`).sort(),
    lines: scene.sheets.map((s) => `${s.name} ${s.reach.toFixed(6)}`).sort(),
  };
};

test('two views over one part of the world put the roses at the same map positions', async () => {
  const a = await earth({ lon: 8.93, lat: 44.41, zoom: 9 });
  const b = await earth({ lon: 9.05, lat: 44.35, zoom: 9 }); // dragged, the windows overlapping
  assert.ok(a.roses.length > 0, 'a rose is placed');
  const shared = a.lines.filter((l) => b.lines.includes(l)).map((l) => l.split(' ')[0]);
  assert.ok(shared.length > 0, 'the views share a sheet');
  for (const sheet of shared) {
    const of = (e) => e.roses.filter((r) => r.startsWith(sheet));
    assert.deepEqual(of(a), of(b));
  }
});

const beasts = async (view) => {
  const { scene, data } = await createScene(env, { view, scale: 'off' });
  return [...scene.monsters, ...scene.ships].map((b) => `${b.sheet} ${b.sprite.id} ${data.proj.invert(b.x, b.y).map((v) => v.toFixed(6)).join(' ')}`).sort();
};

test('two views over one part of the world put the monsters and ships at the same map positions', async () => {
  const a = await beasts({ lon: 8.93, lat: 44.41, zoom: 9 });
  const b = await beasts({ lon: 9.05, lat: 44.35, zoom: 9 });
  assert.ok(a.length > 0, 'a beast is placed');
  const inB = (x) => b.filter((l) => l.split(' ')[0] === x);
  const common = [...new Set(a.map((l) => l.split(' ')[0]))].filter((s) => inB(s).length);
  assert.ok(common.length > 0, 'the views share a sheet with beasts');
  for (const sheet of common) {
    const key = (l) => l.split(' ').slice(1).join(' ');
    const sa = a.filter((l) => l.startsWith(sheet)).map(key), sb = inB(sheet).map(key);
    assert.deepEqual(sa, sb);
  }
});

// a drag south, the sheet's beasts mostly below the first window: a beast whose place is inside both windows is placed in both
test('a beast inside both of two overlapping windows is placed in both', async () => {
  const views = [{ lon: 8.6, lat: 44.2, zoom: 9 }, { lon: 8.6, lat: 44, zoom: 9 }];
  const placed = await Promise.all(views.map(async (view) => {
    const { scene, data } = await createScene(env, { view, scale: 'off' });
    return { proj: data.proj, at: [...scene.monsters, ...scene.ships].map((b) => ({ id: `${b.sheet} ${b.sprite.id}`, ll: data.proj.invert(b.x, b.y) })) };
  }));
  const inside = (proj, [lon, lat]) => { const [x, y] = proj.project(lon, lat); return x > 0 && y > 0 && x < 1600 && y < 1000; };
  const both = placed.flatMap((p) => p.at).filter((b) => placed.every((q) => inside(q.proj, b.ll)));
  assert.ok(both.length > 0, 'a beast stands where the windows overlap');
  for (const b of both) for (const q of placed) {
    assert.ok(q.at.some((o) => o.id === b.id && Math.hypot(o.ll[0] - b.ll[0], o.ll[1] - b.ll[1]) < 1e-6), `${b.id} at ${b.ll} in both views`);
  }
});

// everything a sheet holds, by where it stands on the earth: zoom within the band and a small drag change nothing
const held = async (view) => {
  const { scene, data } = await createScene(env, { view, scale: 'off' });
  const bySheet = new Map();
  for (const [kind, list] of [['rose', scene.roseDraws], ['monster', scene.monsters], ['ship', scene.ships]]) {
    for (const o of list) {
      const [lon, lat] = data.proj.invert(o.x, o.y);
      bySheet.set(o.sheet, [...(bySheet.get(o.sheet) ?? []), `${kind} ${o.sprite.id} ${lon.toFixed(6)} ${lat.toFixed(6)}`]);
    }
  }
  for (const [k, v] of bySheet) bySheet.set(k, v.sort());
  return bySheet;
};

test('a sheet holds the same roses, monsters and ships at every zoom of its band and after a drag', async () => {
  const views = [8.1, 9, 9.9].map((zoom) => ({ lon: 8.93, lat: 44.41, zoom })).concat([{ lon: 8.93 + 1125 / 2 ** 9 * 0.01, lat: 44.41, zoom: 9 }]);
  const all = await Promise.all(views.map(held));
  const common = [...all[0].keys()].filter((k) => all.every((m) => m.has(k)));
  assert.ok(common.length > 0, 'the views share a sheet');
  assert.ok(common.some((k) => all[0].get(k).length > 0), 'a shared sheet holds something');
  for (const sheet of common) for (const m of all.slice(1)) assert.deepEqual(m.get(sheet), all[0].get(sheet), sheet);
});

// #131 step 4, the issue's measurement: Genoa, a drag of 1% of the window width, at z5 and z9. A decoration
// keeps its place if one of its kind stands within 2 px of it on the earth afterwards.
for (const zoom of [5, 9]) {
  test(`after a drag of 1% of the window at z${zoom} every rose, monster and ship keeps its place`, async () => {
    const from = { lon: 8.93, lat: 44.41, zoom };
    const to = panView(from, 1600 * 0.01, 0);
    const [a, b] = await Promise.all([from, to].map(async (view) => {
      const { scene, data } = await createScene(env, { view, scale: 'off' });
      return { proj: data.proj, list: [['rose', scene.roseDraws], ['monster', scene.monsters], ['ship', scene.ships]].flatMap(([kind, l]) => l.map((o) => ({ kind, ll: data.proj.invert(o.x, o.y), x: o.x, y: o.y }))) };
    }));
    // every ornament placed in the first window, whether or not it is on screen: a sheet's are placed in its own frame
    const kept = (o) => { const [x, y] = b.proj.project(...o.ll); return b.list.some((q) => q.kind === o.kind && Math.hypot(x - q.x, y - q.y) <= 2); };
    for (const kind of ['rose', 'monster', 'ship']) {
      const of = a.list.filter((o) => o.kind === kind), ok = of.filter(kept).length;
      console.log(`# z${zoom} ${kind}: ${ok}/${of.length} kept after a 1% drag`);
      assert.equal(ok, of.length, `every ${kind} placed in the first window keeps its place`);
    }
    assert.ok(a.list.length > 0, 'something is placed');
  });
}

// One ornament budget per window (#147): a sheet holds no more roses, monsters and ships together than its
// territory in windows times the budget, whatever the density, and the density scales that budget.
const heldAt = async (view, density) => {
  const { scene } = await createScene(env, { view, scale: 'off', density, historical: false });
  const per = {};
  for (const o of [...scene.roseDraws, ...scene.monsters, ...scene.ships]) per[o.sheet] = (per[o.sheet] ?? 0) + 1;
  return { scene, per, total: Object.values(per).reduce((a, b) => a + b, 0) };
};

test('each sheet keeps its roses, monsters and ships within its share of the one budget', async () => {
  for (const view of [{ lon: -75, lat: 18, zoom: 6 }, { lon: 25, lat: 38, zoom: 8 }]) {
    for (const density of [1, 0.5]) {
      const { scene, per } = await heldAt(view, density);
      assert.ok(Object.keys(per).length > 0, 'ornaments are placed');
      for (const sh of scene.sheets) assert.ok((per[sh.name] ?? 0) <= Math.round(BUDGET * density * territory(sh, sh.from)), `${sh.name} at density ${density}`);
    }
  }
});

test('the density slider scales the one budget', async () => {
  const view = { lon: -75, lat: 18, zoom: 6 };
  const [half, one, two] = [await heldAt(view, 0.5), await heldAt(view, 1), await heldAt(view, 2)];
  assert.ok(half.total < one.total && one.total < two.total, `${half.total} < ${one.total} < ${two.total}`);
  assert.equal((await heldAt(view, 0)).total, 0);
});
