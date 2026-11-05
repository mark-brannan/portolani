import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetsFor, roseSheet, cutOut, bandFor, BANDS, hiddenCircle, ROSE, ORIGINS, CURATED, PAGE_EDGE, WORLD_SHEET, OVERLAP_RULES } from '../scripts/atlas.mjs';
import { readFileSync } from 'node:fs';

const bounds = (zoom, west, south, east, north) => ({ zoom, west, south, east, north });
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
const inside = (k, p) => k.west >= p.west - 1e-9 && k.east <= p.east + 1e-9 && k.south >= p.south - 1e-9 && k.north <= p.north + 1e-9;

test('zoom bands are one level wide, 4 to 14, each sheet one window at its first zoom; the world band gets the first grid', () => {
  assert.deepEqual(BANDS.map((b) => [b.band, b.from, b.to]), Array.from({ length: 11 }, (_, i) => [4 + i, 4 + i, 5 + i]));
  assert.deepEqual([1, 3.9, 4, 4.99, 5, 8.5, 9, 14, 14.9, 15, 17].map((z) => bandFor(z).band), [4, 4, 4, 4, 5, 8, 9, 14, 14, 14, 14]);
  for (const b of BANDS) { close(b.width, 1125 / 2 ** b.from); close(b.height, b.width * 1000 / 1600); }
  for (let i = 1; i < BANDS.length; i++) { close(BANDS[i - 1].width / BANDS[i].width, 2); close(BANDS[i - 1].height / BANDS[i].height, 2); }
  close(BANDS.find((b) => b.band === 8).width, 4.39453125); // the doc's table: 4.39 wide, 2.75 page-degrees tall
  close(BANDS.find((b) => b.band === 8).height, 2.74658203125);
});

test('edges sit on whole multiples of the height in Mercator y and of the width, out from the rose', () => {
  for (const z of [4, 6, 8, 10, 12, 14]) {
    const b = bandFor(z);
    for (const s of sheetsFor({ lon: 12.3, lat: 41.9, zoom: z })) {
      const q = (v) => v - Math.round(v);
      close(my(s.extent.north) - my(s.extent.south), b.height, 1e-7);
      close(q((my(s.extent.south) - my(ROSE.lat)) / b.height), 0, 1e-6);
      if (s.extent.west > -180) close(q((s.extent.west - ROSE.lon) / b.width), 0);
      if (s.extent.east < 180) close(q((s.extent.east - ROSE.lon) / b.width), 0);
    }
  }
});

test('the rose is a sheet corner in every band', () => {
  for (const b of BANDS) {
    const z = b.from, e = 1e-5;
    const got = sheetsFor(bounds(z, ROSE.lon - e, ROSE.lat - e, ROSE.lon + e, ROSE.lat + e));
    assert.equal(got.length, 4, `band ${b.band}`);
    for (const s of got) {
      const { west, east, south, north } = s.extent;
      assert.ok([west, east].some((v) => Math.abs(v - ROSE.lon) < 1e-9) && [south, north].some((v) => Math.abs(v - ROSE.lat) < 1e-9), `${s.name} ${JSON.stringify(s.extent)}`);
    }
    assert.ok(got.some((s) => /^PT\d+N0+E0+$/.test(s.name))); // the cell whose south-west corner is the rose
  }
});

test('four sheets of a band nest in one of the band above, sixteen in one two bands up, at any latitude', () => {
  for (const lat of [41.3, 60.2, 75.1, -55.2]) {
    const parent = sheetsFor(bounds(8, 10.1, lat, 10.2, lat + 0.05))[0].extent;
    for (const [z, n] of [[9, 4], [10, 16]]) {
      const kids = sheetsFor(bounds(z, parent.west + 1e-4, parent.south + 1e-4, parent.east - 1e-4, parent.north - 1e-4));
      assert.equal(kids.length, n, `${lat} z${z}`);
      for (const k of kids) assert.ok(inside(k.extent, parent));
    }
  }
});

test('a sheet keeps the window\'s shape at every latitude: no widening toward the poles', () => {
  for (const lat of [0, 45, 55, 75, -75]) {
    const [s] = sheetsFor(bounds(10, 0.01, lat, 0.02, lat + 0.01)), e = s.extent;
    close(e.east - e.west, 1125 / 2 ** 10);
    close(my(e.north) - my(e.south), (1125 / 2 ** 10) * 1000 / 1600, 1e-7);
  }
});

test('no sheet crosses the date line', () => {
  const s = sheetsFor(bounds(8, 170, 0, 190, 10));
  assert.ok(s.length > 0);
  for (const x of s) assert.ok(x.extent.west >= -180 && x.extent.east <= 180);
  assert.ok(s.some((x) => x.extent.east === 180));
  for (const z of [6, 10, 14]) for (const lat of [0, 60, 80]) {
    for (const x of sheetsFor(bounds(z, -181, lat, -179.9, lat + 0.01))) assert.ok(x.extent.west >= -180);
    for (const x of sheetsFor(bounds(z, 179.9, lat, 181, lat + 0.01))) assert.ok(x.extent.east <= 180);
  }
});

test('a row that would reach a pole ends at the page edge', () => {
  for (const z of [4, 6, 8, 10, 12, 14]) for (const s of sheetsFor(bounds(z, 0, -90, 1, 90))) assert.ok(s.extent.north <= PAGE_EDGE && s.extent.south >= -PAGE_EDGE && s.extent.north > s.extent.south, `${z} ${s.name}`);
  const rows = sheetsFor(bounds(4, -180, -90, 180, 90)).map((s) => s.extent);
  assert.ok(rows.some((e) => e.north === PAGE_EDGE) && rows.some((e) => e.south === -PAGE_EDGE));
  // band 4's rows are 43.9 page-degrees; the rose sits on a row edge
  assert.ok(rows.some((e) => Math.abs(e.south - ROSE.lat) < 1e-9));
});

test('names are ENC-style, unique, and the same wherever the view is', () => {
  const a = sheetsFor({ lon: 12.3, lat: 41.9, zoom: 10 });
  assert.ok(a.every((s) => /^PT10[NS]\d{3,4}[EW]\d{4}$/.test(s.name)));
  assert.equal(new Set(a.map((s) => s.name)).size, a.length);
  const b = sheetsFor({ lon: 12.31, lat: 41.91, zoom: 10 });
  for (const s of b) { const m = a.find((x) => x.name === s.name); if (m) assert.deepEqual(m.extent, s.extent); }
  const at = (dLon, dLat) => sheetsFor(bounds(10, ROSE.lon + dLon, ROSE.lat + dLat, ROSE.lon + dLon + 0.01, ROSE.lat + dLat + 0.01))[0].name;
  assert.equal(at(0.01, 0.01), 'PT10N000E0000'); // north-east of the rose
  assert.equal(at(0.01, -0.02), 'PT10S000E0000');
  assert.equal(at(-0.02, 0.01), 'PT10N000W0000');
  assert.equal(at(-0.02, -0.02), 'PT10S000W0000');
});

test('a view returns every sheet it overlaps and none that it does not', () => {
  const v = bounds(10, 2.5, 41.5, 4.5, 43.5);
  const got = sheetsFor(v);
  for (const s of got) assert.ok(s.extent.east > 2.5 && s.extent.west < 4.5 && s.extent.north > 41.5 && s.extent.south < 43.5);
  const b = bandFor(10), cols = Math.ceil((4.5 - ROSE.lon) / b.width) - Math.floor((2.5 - ROSE.lon) / b.width);
  const rows = Math.ceil((my(43.5) - my(ROSE.lat)) / b.height - 1e-9) - Math.floor((my(41.5) - my(ROSE.lat)) / b.height);
  assert.equal(got.length, cols * rows);
});

test('a view at a band\'s first zoom is about one sheet: four at most, one where it sits on a sheet', () => {
  const n = sheetsFor({ lon: 2.4, lat: 2.4, zoom: 8 }).length;
  assert.ok(n >= 1 && n <= 4, `${n}`);
  const [s] = sheetsFor({ lon: 12, lat: 42, zoom: 8 }), c = s.circle;
  assert.equal(sheetsFor({ zoom: 8, lon: c.lon, lat: c.lat }).length, 1, 'the window on a sheet\'s centre is that sheet');
});

test('the hidden circle: centre at the sheet centre, sixteen nodes, 0.8 of the sheet height across by default', () => {
  const [s] = sheetsFor({ lon: 12, lat: 42, zoom: 8 });
  close(s.circle.lon, (s.extent.west + s.extent.east) / 2);
  close(my(s.circle.lat), (my(s.extent.south) + my(s.extent.north)) / 2);
  assert.equal(s.circle.nodes.length, 16);
  assert.equal(s.circle.radius, 0.4);
  assert.equal(sheetsFor({ lon: 12, lat: 42, zoom: 8 }, { radius: 0.3 })[0].circle.radius, 0.3);
  const c = hiddenCircle({ west: 0, east: 4.8, south: 0, north: 3 });
  close(c.nodes[0].lon, c.lon);
  assert.ok(c.nodes[0].lat > c.lat);
  close(c.nodes[4].lat, c.lat, 1e-9);
  const d = (n) => Math.hypot(n.lon - c.lon, my(n.lat) - my(c.lat));
  for (const n of c.nodes) close(d(n), 0.4 * my(3), 1e-9);
  // every node of a grid sheet's ring is inside the sheet, so inside the window at the band's first zoom
  for (const n of s.circle.nodes) assert.ok(n.lon > s.extent.west && n.lon < s.extent.east && n.lat > s.extent.south && n.lat < s.extent.north);
});

test("no sheet touches a pole, so every hidden circle has finite nodes below it", () => {
  for (const z of [4, 6, 8, 10, 12, 14]) for (const x of sheetsFor(bounds(z, 0, 85, 1, 90))) {
    assert.ok(x.extent.north < 90);
    for (const n of x.circle.nodes) assert.ok(Number.isFinite(n.lon) && n.lat < 90, x.name);
  }
});

test('band 14 names keep the row digits whole, 4 digits past row 999', () => {
  const [s] = sheetsFor(bounds(14, 10, 80, 10.01, 80.01));
  assert.match(s.name, /^PT14[NS]\d{4}[EW]\d{4}$/);
  assert.match(sheetsFor(bounds(14, 10, 40, 10.01, 40.01))[0].name, /^PT14[NS]\d{4}[EW]\d{4}$/);
});

// Under the `smallest` overlap rule; `fit`, the default, has its own test below (#199).
test('curated sheets: of overlapping ones the smallest is kept, the world band is one sheet, and they displace grid cells', () => {
  const smallest = { curated: true, overlap: 'smallest' };
  const names = (z, v) => sheetsFor({ ...v, zoom: z }, smallest).filter((s) => s.curated).map((s) => s.name);
  const med = bounds(6, 0, 35, 30, 45);
  // Vesconte over the Carte Pisane's east, which overlaps it; the Carte Pisane's west stops at 18E, short of Vesconte's 20E; Dulcert overlaps both
  assert.deepEqual(names(6, med).sort(), ['Levant and Black Sea', 'Mediterranean, west']);
  assert.deepEqual(names(6, bounds(6, -30, 20, 50, 75)).sort(), ['Levant and Black Sea', 'Mediterranean, west']);
  assert.deepEqual(names(5, bounds(5, -30, 20, 50, 75)), ['Scandinavia and the Baltic'], 'band 5: the Carta Marina is smaller than Dulcert, which it overlaps');
  const wide = bounds(6, -60, 0, 100, 50), got = sheetsFor(wide, smallest);
  assert.ok(got.some((s) => !s.curated), 'grid cells still fill what no curated sheet holds');
  const cur = got.filter((s) => s.curated).map((s) => s.extent);
  for (const g of got.filter((s) => !s.curated)) {
    const lon = (g.extent.west + g.extent.east) / 2, lat = (g.extent.south + g.extent.north) / 2;
    assert.ok(!cur.some((e) => lon >= e.west && lon <= e.east && lat >= e.south && lat <= e.north), g.name);
  }
  // no two kept sheets overlap, in any band, so none shadows another
  for (const z of [4, 5, 6]) {
    const kept = sheetsFor(bounds(z, -180, -85, 180, 85), smallest).filter((s) => s.curated);
    for (const a of kept) assert.equal(a.shadow.length, 0, `${z} ${a.name}`);
  }
  for (const z of [1, 2, 3.9]) assert.deepEqual(sheetsFor({ lon: 0, lat: 30, zoom: z }, smallest), [WORLD_SHEET]);
  assert.deepEqual(sheetsFor(med).filter((s) => s.curated), [], 'off by default');
});

// docs/atlas/README.md, "The curated sheets": a curated sheet serves the bands in which it is one to two windows wide at
// the band's first zoom, the spec's table; the world band takes every curated sheet seen at the view's zoom. In every
// band a curated sheet replaces the grid cells whose centres it holds.
test('a curated sheet serves the bands it is one to two windows wide in, and replaces the cells it holds there', () => {
  const by = Object.fromEntries(CURATED.map((c) => [c.source, c.bands]));
  assert.deepEqual(by, {
    'Carte Pisane, western circle': [6], 'Carte Pisane, eastern circle': [6], 'Vesconte, 1311': [6], 'Dulcert, 1339': [5],
    'Catalan Atlas': [], 'Carta Marina, 1539': [5], 'Juan de la Cosa, 1500': [4],
  });
  for (const c of CURATED) for (const b of c.bands) { const w = (c.extent.east - c.extent.west) / (1125 / 2 ** b); assert.ok(w >= 1 && w <= 2, `${c.source} ${w}`); }
  const smallest = { curated: true, overlap: 'smallest' };
  const ocean = sheetsFor(bounds(4.5, -180, -85, 180, 85), smallest);
  assert.deepEqual(ocean.filter((s) => s.curated).map((s) => s.source), ['Juan de la Cosa, 1500'], 'band 4 is de la Cosa\'s');
  assert.deepEqual(sheetsFor({ zoom: 4.3, lat: 40, lon: -150 }, smallest).filter((s) => s.curated), [], 'the Pacific, west of de la Cosa\'s 100W, is the grid\'s');
  assert.ok(sheetsFor({ zoom: 5.5, lat: -9, lon: -140 }, smallest).some((s) => !s.curated && s.band === 5), 'the open Pacific has a grid cell');
  const cur = ocean.filter((s) => s.curated).map((s) => s.extent);
  for (const g of ocean.filter((s) => !s.curated)) {
    const lon = (g.extent.west + g.extent.east) / 2, lat = (g.extent.south + g.extent.north) / 2;
    assert.ok(!cur.some((e) => lon >= e.west && lon <= e.east && lat >= e.south && lat <= e.north), g.name);
  }
  assert.ok(ocean.filter((s) => !s.curated).length < sheetsFor(bounds(4.5, -180, -85, 180, 85)).length, 'cells are replaced, not stacked');
});

test('the Catalan rose takes the reach of the sheet that holds it at each zoom', () => {
  const at = (z) => roseSheet(z, { overlap: 'smallest' }).source ?? roseSheet(z, { overlap: 'smallest' }).name;
  assert.deepEqual([1, 3.9].map(at), ['The world', 'The world']);
  assert.deepEqual([3, 4.33, 5.5, 6].map((z) => roseSheet(z).source ?? roseSheet(z).name), ['Catalan Atlas', 'Juan de la Cosa, 1500', 'Dulcert, 1339', 'PT6N000E0000'], 'under fit, the chart the view fits holds the rose; band 6\'s charts lie east of it, so the rose is its grid cell\'s');
  assert.deepEqual([4, 5, 5.9, 6, 8, 10].map(at), ['Juan de la Cosa, 1500', 'PT5N000E0000', 'PT5N000E0000', 'PT6N000E0000', 'PT8N000E0000', 'PT10N000E0000']);
});

test('curated circles sit at the read centres with sixteen nodes at the read radius', () => {
  const [w] = sheetsFor(bounds(6.2, 5, 38, 9, 42), { curated: true }).filter((s) => s.name === 'Mediterranean, west');
  close(w.circle.lon, 7.4); close(w.circle.lat, 40.0);
  assert.equal(w.circle.nodes.length, 16);
  assert.ok(w.circle.nodes[0].lat > 47 && w.circle.nodes[0].lat < 49, 'north node 8 degrees up');
});

test('the world band is one sheet: the whole page, one ring, the hub on the equator below the Catalan rose, which is its north node', () => {
  const w = WORLD_SHEET;
  assert.deepEqual(w.extent, { west: -180, east: 180, south: -PAGE_EDGE, north: PAGE_EDGE });
  assert.deepEqual([w.circle.lon, w.circle.lat], [ROSE.lon, 0]);
  assert.equal(w.circle.nodes.length, 16);
  assert.deepEqual(w.circle.nodes[0], { lon: ROSE.lon, lat: ROSE.lat });
  close(w.circle.nodes[8].lat, -ROSE.lat); close(w.circle.nodes[4].lat, 0);
});

test('a line is never cut where another sheet lies, only split at the antimeridian', () => {
  const line = [[0, 35], [5, 35], [30, 35]];
  assert.deepEqual(cutOut(line), [line]);
});

// docs/atlas/ornaments.md: a read chart carries its own figures, a chart that draws none an empty set, an unread one none, and
// a sheet in view hands them to the scene; every named sprite is one the packs hold.
test('curated sheets carry their charts\' own figures', () => {
  const ids = new Set(['vivid', 'scanned'].flatMap((p) => JSON.parse(readFileSync(new URL(`../packs/${p}/pack.json`, import.meta.url))).sprites.map((s) => s.id)));
  const by = Object.fromEntries(CURATED.map((c) => [c.source, c]));
  // the four Mediterranean charts' figures are not read yet (centres.md read their circles), so they keep the seeded ones
  for (const s of ['Carte Pisane, western circle', 'Carte Pisane, eastern circle', 'Vesconte, 1311', 'Dulcert, 1339']) assert.equal(by[s].ornaments, undefined, s);
  const marina = by['Carta Marina, 1539'].ornaments;
  assert.deepEqual(['rose', 'monster', 'ship'].map((k) => marina.filter((f) => f.kind === k).length), [4, 11, 12]);
  for (const c of CURATED) for (const f of c.ornaments ?? []) {
    assert.ok(['rose', 'monster', 'ship'].includes(f.kind) && Math.abs(f.lon) <= 180 && Math.abs(f.lat) <= 90, `${c.source} ${JSON.stringify(f)}`);
    if (f.sprite) assert.ok(ids.has(f.sprite), `${c.source}: no sprite ${f.sprite}`);
  }
  const baltic = sheetsFor({ lon: 19.5, lat: 58, zoom: 5.3 }, { curated: true, overlap: 'smallest' });
  assert.equal(baltic.find((s) => s.source === 'Carta Marina, 1539').ornaments, marina);
});

// A figure drawn outside its sheet's extent is never drawn, so a sheet's extent holds every figure the packs
// crop from its chart: the Carta Marina's reach west to Iceland and the Faroes.
test('a curated sheet\'s extent holds its cropped figures', () => {
  for (const c of CURATED) for (const f of (c.ornaments ?? []).filter((o) => o.sprite)) {
    const e = c.extent;
    assert.ok(f.lon >= e.west && f.lon <= e.east && f.lat >= e.south && f.lat <= e.north, `${c.source}: ${f.sprite} at ${f.lon}, ${f.lat} is off the sheet`);
  }
  const marina = CURATED.find((c) => c.source === 'Carta Marina, 1539').ornaments.filter((f) => f.sprite).map((f) => f.sprite);
  assert.deepEqual(marina.sort(), ['cete-e', 'pistrix-c', 'serpent-a', 'ship-a', 'ship-b', 'whale-b']);
  const catalan = CURATED.find((c) => c.source === 'Catalan Atlas').ornaments.filter((f) => f.sprite).map((f) => f.sprite);
  assert.deepEqual(catalan.sort(), ['catalan-junk', 'catalan-ship', 'catalan-siren', 'rose-catalan']);
});

test('a ray across the antimeridian is cut at the meridian, not swept across a sheet it never crosses', () => {
  // an eastward ray wrapped to +-180, as rhumb() gives it: 100 -> 179, then -177 -> -120
  const ray = [[100, 40], [179, 40], [-177, 40], [-120, 40]];
  for (const runs of [cutOut(ray)]) {
    for (const run of runs) for (let i = 1; i < run.length; i++) assert.ok(Math.abs(run[i][0] - run[i - 1][0]) < 180, `no run jumps the seam: ${JSON.stringify(run)}`);
  }
  const [a, b] = cutOut(ray.slice(1), []);
  assert.deepEqual([a.at(-1)[0], b[0][0]], [180, -180], 'one piece ends on the meridian and the next starts on it');
  close(a.at(-1)[1], 40);
  // the ray keeps every point and gains the two on the meridian
  const kept = cutOut(ray.slice(1)).flat().length;
  assert.equal(kept, 5);
});

// #199: where curated charts overlap, the `overlap` rule says which are kept and how their lines run. Each rule gives
// its own set at the Azores (zoom 2.82, in the world band) and at the issue's view 2 (zoom 4.33, the first band).
test('overlap rules: smallest, fit, all cut and all uncut each keep their own charts', () => {
  const azores = { zoom: 2.82, lat: 38.43, lon: -25.468 }, view2 = { zoom: 4.33, lat: 39.525, lon: -26.502 };
  const kept = (view, overlap) => sheetsFor(view, { curated: true, overlap }).map((s) => [s.name, (s.shadow ?? []).length]);
  assert.deepEqual(OVERLAP_RULES, ['smallest', 'fit', 'cut', 'uncut']);
  assert.deepEqual(kept(azores, 'smallest'), [['The world', 0]], 'smallest: the world band is the planisphere alone');
  assert.deepEqual(kept(azores, 'fit'), [['The known world of 1375', 0], ['The world', 1]], 'fit: the Catalan Atlas is 0.9 windows wide at 2.82, and shadows the world ring');
  assert.deepEqual(kept(azores, 'cut'), [['Scandinavia and the Baltic', 0], ['Europe and the Mediterranean', 1], ['The known world of 1375', 2], ['The Atlantic and the Americas', 3], ['The world', 4]], 'cut: every chart seen, each shadowed by the smaller ones over it');
  assert.deepEqual(kept(azores, 'uncut'), [['Scandinavia and the Baltic', 0], ['Europe and the Mediterranean', 0], ['The known world of 1375', 0], ['The Atlantic and the Americas', 0], ['The world', 0]], 'uncut: every chart in full');
  assert.deepEqual(sheetsFor(azores, { curated: true }), sheetsFor(azores, { curated: true, overlap: 'fit' }), 'fit is the default');
  assert.deepEqual(sheetsFor(azores, { curated: true, overlap: 'nonsense' }), sheetsFor(azores, { curated: true, overlap: 'fit' }), 'an unknown rule reads as the default');
  const curated = (view, overlap) => kept(view, overlap).filter(([name]) => name !== 'The world' && !name.startsWith('PT')).map(([name]) => name);
  assert.deepEqual(curated(view2, 'smallest'), ['The Atlantic and the Americas'], 'band 4 is de la Cosa\'s alone');
  assert.deepEqual(curated(view2, 'fit'), ['The Atlantic and the Americas']);
  assert.deepEqual(curated(view2, 'cut').sort(), curated(view2, 'uncut').sort());
  assert.deepEqual(curated({ zoom: 5.3, lat: 55, lon: 10 }, 'cut').sort(), ['Europe and the Mediterranean', 'Scandinavia and the Baltic'], 'band 5 under cut: both its charts');
  assert.equal(roseSheet(2.82, { overlap: 'fit' }).name, 'The known world of 1375');
  assert.equal(roseSheet(2.82, { overlap: 'smallest' }).name, 'The world');
  assert.equal(roseSheet(5.3, { overlap: 'uncut' }).name, 'Europe and the Mediterranean', 'of the charts over the rose, the smallest');
});

test('cutOut cuts a line where it crosses an extent, and nowhere without one', () => {
  const line = [[-30, 40], [0, 40], [30, 40]];
  assert.deepEqual(cutOut(line), [line]);
  assert.deepEqual(cutOut(line, []), [line]);
  const [a, b] = cutOut(line, [{ west: -10, east: 10, south: 30, north: 50 }]);
  assert.deepEqual(a.map(([x]) => Math.round(x)), [-30, -10]);
  assert.deepEqual(b.map(([x]) => Math.round(x)), [10, 30]);
  assert.deepEqual(cutOut(line, [{ west: -10, east: 10, south: 50, north: 60 }]), [line], 'an extent beside the line cuts nothing');
});

test('origin zero: every band counts from 0E 0N, so a cell corner lies on it and the edges are whole cells from it', () => {
  const zero = ORIGINS.zero, e = 1e-5;
  for (const b of BANDS) {
    const got = sheetsFor(bounds(b.from, -e, -e, e, e), { origin: zero });
    assert.equal(got.length, 4, `band ${b.band}`);
    for (const s of got) assert.ok([s.extent.west, s.extent.east].includes(0) && [s.extent.south, s.extent.north].includes(0), `${s.name} ${JSON.stringify(s.extent)}`);
    assert.ok(got.some((s) => /^PT\d+N0+E0+$/.test(s.name) && s.extent.west === 0 && s.extent.south === 0), 'N000E0000 is the cell whose south-west corner is 0, 0');
  }
  for (const s of sheetsFor({ lon: 12.3, lat: 41.9, zoom: 8 }, { origin: zero })) {
    const h = my(s.extent.north) - my(s.extent.south), w = s.extent.east - s.extent.west;
    close(my(s.extent.south) / h - Math.round(my(s.extent.south) / h), 0, 1e-6);
    close(s.extent.west / w - Math.round(s.extent.west / w), 0);
  }
  // the default is the rose, so a sheet set counted from the rose is the one given no origin
  assert.deepEqual(sheetsFor({ lon: 12.3, lat: 41.9, zoom: 8 }, { origin: ROSE }), sheetsFor({ lon: 12.3, lat: 41.9, zoom: 8 }));
});

test('origin zero: the rose\'s sheet still holds the rose, in a cell no longer cornered on it', () => {
  for (const z of [6, 8, 10]) {
    const s = roseSheet(z, { origin: ORIGINS.zero, curated: false }), { west, east, south, north } = s.extent;
    assert.ok(west <= ROSE.lon && ROSE.lon <= east && south <= ROSE.lat && ROSE.lat <= north, `z${z} ${s.name}`);
    assert.ok(![west, east].includes(ROSE.lon), `z${z}: the rose is not on a cell edge`);
  }
});

test('radius: a grid sheet\'s hidden circle takes the radius given; a curated sheet keeps its read one', () => {
  const view = { lon: 5, lat: 40.5, zoom: 6.2 };
  for (const radius of [0.25, 0.5, 0.8]) {
    const got = sheetsFor(view, { radius, curated: true });
    const grid = got.filter((s) => !s.curated), cur = got.filter((s) => s.curated);
    assert.ok(grid.length && cur.length);
    for (const s of grid) assert.deepEqual(s.circle, hiddenCircle(s.extent, radius));
    for (const s of cur) { const c = CURATED.find((k) => k.name === s.name); close(s.circle.radius, c.radius / (c.extent.north - c.extent.south)); }
  }
});

test('curated false: grid cells everywhere, none of them held back', () => {
  const view = { lon: 7.4, lat: 40.5, zoom: 6.2 };
  const plain = sheetsFor(view), with_ = sheetsFor(view, { curated: true });
  assert.ok(plain.every((s) => !s.curated));
  assert.ok(plain.filter((s) => !s.curated).length > with_.filter((s) => !s.curated).length, 'the curated sheets hold cells back');
});

// #146: the Carte Pisane has two tangent rings; its two sheets meet edge to edge at the seam, so where both are drawn
// (band 6 under `cut` or `uncut`) neither shadows the other. Under `fit` and `smallest`, Vesconte, which overlaps the
// eastern circle and is nearer one window wide and smaller, holds the east (the overlap rule, docs/atlas/README.md).
test('the Carte Pisane\'s two sheets meet at the seam, each ring whole on its own sheet', () => {
  const pisane = (z, overlap) => sheetsFor({ zoom: z, lat: 38.5, lon: 17.5 }, { curated: true, overlap }).filter((s) => s.source?.startsWith('Carte Pisane'));
  for (const z of [6, 6.2, 6.5]) for (const o of ['cut', 'uncut']) assert.deepEqual(pisane(z, o).map((s) => s.source).sort(), ['Carte Pisane, eastern circle', 'Carte Pisane, western circle'], `zoom ${z} ${o}`);
  const [w, e] = ['western', 'eastern'].map((k) => pisane(6.2, 'cut').find((s) => s.source.includes(k)));
  assert.equal(w.extent.east, e.extent.west, 'edge to edge');
  assert.ok(!e.shadow.some((x) => x === w.extent) && !w.shadow.some((x) => x === e.extent), 'neither shadows the other');
  for (const s of [w, e]) for (const n of s.circle.nodes) assert.ok(n.lon >= s.extent.west && n.lon <= s.extent.east, `${s.source} node at ${n.lon.toFixed(2)}E`);
  assert.deepEqual(pisane(6.2, 'fit').map((s) => s.source), ['Carte Pisane, western circle']);
});
