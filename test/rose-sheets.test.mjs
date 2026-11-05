// Roses and rhumb lines belong to the atlas's sheets, not the window (docs/atlas/README.md). Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { createScene, anchorScene, bandInk, placedSheets, tuneOf, viewProjection, panView, zoomView, BUDGET } from '../scripts/scene.mjs';
import { territory, BANDS, bandsAt, WORLD_BAND } from '../scripts/atlas.mjs';
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
  const views = [9.2, 9.5, 9.8].map((zoom) => ({ lon: 8.93, lat: 44.41, zoom })).concat([{ lon: 8.93 + 1125 / 2 ** 9 * 0.01, lat: 44.41, zoom: 9.5 }]);
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

// docs/atlas/README.md, "Which beasts, which ships": a grid sheet's figures are picked by its place on the earth, never by
// its band's number, so numbering the bands another way leaves every rose, beast and ship where it was, the same figure.
test('a sheet draws the same figures under another numbering of the bands', async () => {
  const view = { lon: 8.93, lat: 44.41, zoom: 9.5 };
  const figures = async () => {
    const { scene, data } = await createScene(env, { view, scale: 'off' });
    const at = (o) => data.proj.invert(o.x, o.y).map((v) => v.toFixed(6)).join(' ');
    return { names: scene.sheets.map((s) => s.name).sort(), figures: [['rose', scene.roseDraws], ['monster', scene.monsters], ['ship', scene.ships]].flatMap(([kind, l]) => l.map((o) => `${kind} ${o.sprite.id} ${at(o)}`)).sort() };
  };
  const before = await figures();
  for (const b of BANDS) b.band += 100;
  let after;
  try { after = await figures(); } finally { for (const b of BANDS) b.band -= 100; }
  assert.ok(before.names.every((n) => !after.names.includes(n)), `the sheets are renamed: ${before.names} / ${after.names}`);
  assert.ok(before.figures.some((f) => !f.startsWith('rose')), 'beasts or ships are placed');
  assert.deepEqual(after.figures, before.figures);
});

// docs/atlas/README.md, "The page turn": a stop inside the span places both bands' sheets, each whole; a pan inside the
// span places each sheet as it was; the outgoing band's ornaments fade as the incoming band's come in, and nothing moves.
// A curated chart both placed bands carry (de la Cosa at the turn at 4: the world band sees it at 1.7 windows and band 4
// serves it; under `fit` the world band keeps the Carta Marina over it, under `cut` both bands place it) is placed once
// and inked whole: two copies would draw the same figures over each other at 1 - t and t.
test('a curated chart in both bands of a turn is placed once, from the incoming band, at full ink', () => {
  const view = { lon: -40, lat: 20, zoom: 4 }, knobs = tuneOf();
  const fit = placedSheets(view, bandsAt(view.zoom, knobs.turn), knobs, 'fit');
  assert.ok(fit.every((s) => s.inked === s.band), 'under fit no chart is carried twice here, and every sheet fades with its band');
  const sheets = placedSheets(view, bandsAt(view.zoom, knobs.turn), knobs, 'cut');
  const cosa = sheets.filter((s) => s.name === 'The Atlantic and the Americas');
  assert.equal(cosa.length, 1);
  assert.equal(cosa[0].band, 4, 'the incoming band\'s copy');
  assert.equal(cosa[0].inked, undefined, 'inked like the pinned rose, whole through the turn');
  assert.equal(bandInk([WORLD_BAND.band, 4], 4, knobs.turn)(cosa[0].inked), 1);
  for (const s of sheets) if (s !== cosa[0]) assert.equal(s.inked, s.band, `${s.id} fades with its band`);
  assert.ok(sheets.some((s) => s.band === WORLD_BAND.band) && sheets.some((s) => s.band === 4), 'both bands are still placed');
  // outside the span, one band, every sheet inked by it
  const alone = placedSheets({ ...view, zoom: 4.3 }, bandsAt(4.3, knobs.turn), knobs, 'cut');
  assert.ok(alone.every((s) => s.inked === 4));
});

test('inside a page turn both bands are placed, a pan re-places nothing, and the inks cross', async () => {
  const at = async (view, tune) => {
    const { scene, data } = await createScene(env, { view, scale: 'off', ...(tune && { tune }) });
    const ll = (o) => data.proj.invert(o.x, o.y).map((v) => v.toFixed(6)).join(' ');
    return { scene, data, figures: [['rose', scene.roseDraws], ['monster', scene.monsters], ['ship', scene.ships]].flatMap(([kind, l]) => l.map((o) => `${o.band} ${o.sheet} ${kind} ${o.sprite.id} ${ll(o)}`)).sort() };
  };
  const view = { lon: 8.93, lat: 44.41, zoom: 8.95 };
  const turn = await at(view);
  assert.deepEqual(turn.scene.bands, [8, 9]);
  assert.deepEqual([...new Set(turn.scene.sheets.map((s) => s.band))].sort(), [8, 9]);
  assert.ok([8, 9].every((b) => turn.figures.some((f) => f.startsWith(`${b} `))), 'both bands hold figures');
  // each band's figures are its own band's, as placed outside the span
  const before = await at({ ...view, zoom: 8.6 }), after = await at({ ...view, zoom: 9.3 });
  const mine = (list, b) => list.filter((f) => f.startsWith(`${b} `));
  const sheetsIn = (r) => new Set(r.scene.sheets.map((s) => s.name));
  const common = (a, b, band) => mine(a.figures, band).filter((f) => sheetsIn(b).has(f.split(' ')[1]));
  assert.deepEqual(common(turn, before, 8), common(before, turn, 8).filter((f) => sheetsIn(turn).has(f.split(' ')[1])));
  assert.deepEqual(common(turn, after, 9), common(after, turn, 9).filter((f) => sheetsIn(turn).has(f.split(' ')[1])));
  // a pan inside the span: a sheet in both views holds the same figures
  const panned = await at(panView(view, 16, 0));
  const shared = [...sheetsIn(turn)].filter((n) => sheetsIn(panned).has(n));
  for (const n of shared) assert.deepEqual(turn.figures.filter((f) => f.split(' ')[1] === n), panned.figures.filter((f) => f.split(' ')[1] === n), n);
  // the inks: 8 fades from 1 to 0 across 8.85 to 9.15 as 9 rises; the pinned rose's (band undefined) stays whole
  const ink = bandInk(turn.scene.bands, 0, turn.scene.turn);
  assert.equal(ink(undefined), 1);
  for (const [z, a8] of [[8.9, 5 / 6], [9, 0.5], [9.1, 1 / 6]]) { const k = bandInk([8, 9], z, 0.3); assert.ok(Math.abs(k(8) - a8) < 1e-9 && Math.abs(k(9) - (1 - a8)) < 1e-9, `${z}`); }
  assert.deepEqual([bandInk([8, 9], 8.5, 0.3)(8), bandInk([8, 9], 8.5, 0.3)(9), bandInk([8, 9], 9.5, 0.3)(8), bandInk([8, 9], 9.5, 0.3)(9)], [1, 0, 0, 1]);
  assert.deepEqual([bandInk([8, 9], 10.5, 0.3)(9), bandInk([8, 9], 7.5, 0.3)(8)], [1, 1], 'past both, the nearer stays whole');
  assert.equal(bandInk([9], 8.95, 0.3)(9), 1, 'one band placed is whole');
  // anchored for the moving frames, the lines by band
  const a = anchorScene(turn.scene, turn.data);
  assert.deepEqual(a.bands, [8, 9]);
  assert.ok([8, 9].every((b) => a.rayBands.some((r) => r.band === b && r.lines[0].length)));
  // turn 0: today's hard swap, one band
  assert.deepEqual((await at(view, { turn: 0 })).scene.bands, [8]);
});

test('a chart whose own set lists no rose keeps roses where its drawn lines meet', async () => {
  // de la Cosa's roses wait on the ring reading (ornaments.md); its sheet still draws the roses of the ring it draws
  const { scene } = await createScene(env, { view: { lon: -20, lat: -2, zoom: 3.5 }, scale: 'off' });
  const sheet = scene.sheets.find((s) => s.source === 'Juan de la Cosa, 1500');
  assert.ok(sheet?.circle, 'the de la Cosa sheet is drawn, with its ring');
  const roses = scene.roseDraws.filter((r) => r.sheet === sheet.name);
  assert.ok(roses.length > 0, 'the sheet draws a rose');
  const sites = [sheet.circle, ...sheet.circle.nodes];
  for (const r of roses) assert.ok(sites.some((q) => Math.abs(q.lon - r.lon) < 1e-9 && Math.abs(q.lat - r.lat) < 1e-9), `${r.sprite.id} at ${r.lon}, ${r.lat} sits at the ring's hub or a node`);
});
