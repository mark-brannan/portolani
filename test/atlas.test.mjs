import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetsFor, inShadow, cutOut, bandFor, widening, BANDS, hiddenCircle, ROSE, CURATED } from '../scripts/atlas.mjs';
import { readFileSync } from 'node:fs';

const bounds = (zoom, west, south, east, north) => ({ zoom, west, south, east, north });
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const inside = (k, p) => k.west >= p.west - 1e-9 && k.east <= p.east + 1e-9 && k.south >= p.south - 1e-9 && k.north <= p.north + 1e-9;

test('zoom bands pick the doc heights; the world band gets the overview grid', () => {
  const h = (z) => bandFor(z).height;
  assert.deepEqual([1, 5.9, 6, 7.9, 8, 10, 12, 14, 14.9, 15, 17].map(h), [19.2, 19.2, 19.2, 19.2, 4.8, 1.2, 0.3, 0.075, 0.075, 0.075, 0.075]);
});

test('edges sit on whole multiples of the height and width out from the rose', () => {
  for (const z of [6, 8, 10, 12, 14]) {
    for (const s of sheetsFor({ lon: 12.3, lat: 41.9, zoom: z })) {
      const h = s.extent.north - s.extent.south, w = s.extent.east - s.extent.west;
      const q = (v) => v - Math.round(v);
      close(q((s.extent.south - ROSE.lat) / h), 0);
      if (s.extent.west > -180) close(q((s.extent.west - ROSE.lon) / w), 0);
      if (s.extent.east < 180) close(q((s.extent.east - ROSE.lon) / w), 0);
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
    assert.ok(got.some((s) => /^PT\dN0+E0+$/.test(s.name))); // the cell whose south-west corner is the rose
  }
});

test('sixteen sheets of a band nest in one of the band above', () => {
  const parent = sheetsFor(bounds(8, 10.1, 41.2, 10.2, 41.3))[0].extent;
  const kids = sheetsFor(bounds(10, parent.west + 1e-4, parent.south + 1e-4, parent.east - 1e-4, parent.north - 1e-4));
  assert.equal(kids.length, 16);
  for (const k of kids) assert.ok(inside(k.extent, parent));
});

test('widening: 1x, 2x wholly past 49 12, 4x wholly past 69 12, north and south, coastal band down only', () => {
  const coastal = BANDS[2], general = BANDS[1];
  assert.equal(widening(coastal, 40, 1.2), 1);
  assert.equal(widening(coastal, 48.5, 1.2), 1); // straddles 49 12: not wholly past
  assert.equal(widening(coastal, 49.2, 1.2), 2);
  assert.equal(widening(coastal, 60, 1.2), 2);
  assert.equal(widening(coastal, 68.5, 1.2), 2);
  assert.equal(widening(coastal, 70.8, 1.2), 4);
  assert.equal(widening(coastal, -50.4, 1.2), 2);
  assert.equal(widening(coastal, -49.5, 1.2), 1); // its north edge is at -48.3
  assert.equal(widening(coastal, -72, 1.2), 4);
  assert.equal(widening(general, 80, 4.8), 1);
  const w = (lat) => { const e = sheetsFor(bounds(10, 0.01, lat, 0.02, lat + 0.01))[0].extent; return +(e.east - e.west).toFixed(6); };
  assert.deepEqual([w(45), w(55), w(75), w(-55), w(-75)], [1.2, 2.4, 4.8, 2.4, 4.8]);
});

test('nesting holds across widened rows too', () => {
  const parent = sheetsFor(bounds(8, 10.1, 60.1, 10.2, 60.2))[0].extent;
  const kids = sheetsFor(bounds(10, parent.west + 1e-4, parent.south + 1e-4, parent.east - 1e-4, parent.north - 1e-4));
  assert.equal(kids.length, 8); // 2.4 wide by 1.2 high: two columns, four rows
  for (const k of kids) assert.ok(inside(k.extent, parent));
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

test('no polar caps beyond the last whole row', () => {
  const north = sheetsFor(bounds(6, -10, 60, 10, 90));
  assert.ok(Math.max(...north.map((s) => s.extent.north)) <= 80.5 + 1e-9); // 42.1 + 2 * 19.2 = 80.5; the next row reaches 90
  const south = sheetsFor(bounds(6, -10, -90, 10, -60));
  assert.ok(Math.min(...south.map((s) => s.extent.south)) >= -73.1 - 1e-9); // 42.1 - 6 * 19.2 = -73.1 is the last whole row's south edge; the next row reaches -92.3
  assert.ok(Math.min(...south.map((s) => s.extent.south)) > -90);
  for (const z of [8, 10, 12, 14]) for (const s of sheetsFor(bounds(z, 0, 85, 1, 90))) assert.ok(s.extent.north <= 90 + 1e-9);
  assert.equal(sheetsFor(bounds(6, 0, 81, 1, 90)).length, 0);
});

test('names are ENC-style, unique, and the same wherever the view is', () => {
  const a = sheetsFor({ lon: 12.3, lat: 41.9, zoom: 10 });
  assert.ok(a.every((s) => /^PT3[NS]\d{3}[EW]\d{4}$/.test(s.name)));
  assert.equal(new Set(a.map((s) => s.name)).size, a.length);
  const b = sheetsFor({ lon: 12.31, lat: 41.91, zoom: 10 });
  for (const s of b) { const m = a.find((x) => x.name === s.name); if (m) assert.deepEqual(m.extent, s.extent); }
  const at = (dLon, dLat) => sheetsFor(bounds(10, ROSE.lon + dLon, ROSE.lat + dLat, ROSE.lon + dLon + 0.1, ROSE.lat + dLat + 0.1))[0].name;
  assert.equal(at(0.1, 0.1), 'PT3N000E0000'); // north-east of the rose
  assert.equal(at(0.1, -0.2), 'PT3S000E0000');
  assert.equal(at(-0.2, 0.1), 'PT3N000W0000');
  assert.equal(at(-0.2, -0.2), 'PT3S000W0000');
});

test('a view returns every sheet it overlaps and none that it does not', () => {
  const v = bounds(10, 2.5, 41.5, 4.5, 43.5);
  const got = sheetsFor(v);
  for (const s of got) assert.ok(s.extent.east > 2.5 && s.extent.west < 4.5 && s.extent.north > 41.5 && s.extent.south < 43.5);
  // 1.2 cells: columns 2 (2.4-3.6), 3 (3.6-4.8) and rows 34 (40.8-42), 35 (42-43.2), 36 (43.2-44.4)
  assert.equal(got.length, 2 * 3);
});

test('a view from centre and zoom gives the doc window: about one 4.8 sheet at z8', () => {
  const n = sheetsFor({ lon: 2.4, lat: 2.4, zoom: 8 }).length;
  assert.ok(n >= 1 && n <= 4, `${n}`);
});

test('the hidden circle: centre at the cell centre, sixteen nodes, radius a parameter', () => {
  const [s] = sheetsFor({ lon: 12, lat: 42, zoom: 8 });
  close(s.circle.lon, (s.extent.west + s.extent.east) / 2);
  assert.equal(s.circle.nodes.length, 16);
  assert.equal(s.circle.radius, 0.5);
  assert.equal(sheetsFor({ lon: 12, lat: 42, zoom: 8 }, { radius: 0.4 })[0].circle.radius, 0.4);
  const c = hiddenCircle({ west: 0, east: 4.8, south: 0, north: 4.8 }, 0.5);
  close(c.nodes[0].lon, c.lon);
  assert.ok(c.nodes[0].lat > c.lat);
  close(c.nodes[4].lat, c.lat, 1e-3);
  const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
  const d = (n) => Math.hypot(n.lon - c.lon, my(n.lat) - my(c.lat));
  for (const n of c.nodes) close(d(n), d(c.nodes[0]), 1e-6);
});

test("no sheet touches a pole, so every hidden circle has finite nodes below it", () => {
  for (const z of [6, 8, 10, 12, 14]) for (const x of sheetsFor(bounds(z, 0, 85, 1, 90))) {
    assert.ok(x.extent.north < 90);
    for (const n of x.circle.nodes) assert.ok(Number.isFinite(n.lon) && n.lat < 90, x.name);
  }
});

test('band 5 names keep the row digits whole, 4 digits past row 999', () => {
  const [s] = sheetsFor(bounds(14, 10, 80, 10.01, 80.01));
  assert.match(s.name, /^PT5[NS]\d{4}[EW]\d{4}$/);
  assert.match(sheetsFor(bounds(14, 10, 40, 10.01, 40.01))[0].name, /^PT5[NS]\d{4}[EW]\d{4}$/);
});

test('curated sheets: the overview band serves five, the world band the curated alone, and they displace grid cells', () => {
  const names = (z, v) => sheetsFor({ ...v, zoom: z }, { curated: true }).filter((s) => s.curated).map((s) => s.name);
  const med = bounds(6, 0, 35, 30, 45);
  assert.deepEqual(names(6, med).sort(), ['Europe and the Mediterranean', 'Levant and Black Sea', 'Mediterranean, east', 'Mediterranean, west']);
  const wide = bounds(6, -60, 0, 100, 50), got = sheetsFor(wide, { curated: true });
  assert.ok(got.some((s) => !s.curated), 'grid cells still fill what no curated sheet holds');
  const cur = got.filter((s) => s.curated).map((s) => s.extent);
  for (const g of got.filter((s) => !s.curated)) {
    const lon = (g.extent.west + g.extent.east) / 2, lat = (g.extent.south + g.extent.north) / 2;
    assert.ok(!cur.some((e) => lon >= e.west && lon <= e.east && lat >= e.south && lat <= e.north), g.name);
  }
  const world = sheetsFor({ lon: 0, lat: 30, zoom: 3 }, { curated: true });
  assert.ok(world.length > 0 && world.every((s) => s.curated && s.band === 1));
  assert.ok(world.some((s) => s.name === 'The known world of 1375') && world.some((s) => s.name === 'The Atlantic and the Americas'));
  assert.deepEqual(sheetsFor(med).filter((s) => s.curated), [], 'off by default');
});

test('curated circles sit at the read centres with sixteen nodes at the read radius', () => {
  const [w] = sheetsFor(bounds(6, 5, 38, 9, 42), { curated: true }).filter((s) => s.name === 'Mediterranean, west');
  close(w.circle.lon, 7.4); close(w.circle.lat, 40.0);
  assert.equal(w.circle.nodes.length, 16);
  assert.ok(w.circle.nodes[0].lat > 47 && w.circle.nodes[0].lat < 49, 'north node 8 degrees up');
});

test('where curated sheets overlap, the smaller wins; the Carte Pisane pair shares its overlap', () => {
  const s = Object.fromEntries(sheetsFor(bounds(6, 0, 35, 30, 45), { curated: true }).filter((x) => x.curated).map((x) => [x.name, x]));
  assert.equal(s['Mediterranean, west'].shadow.length, 0);
  assert.equal(s['Mediterranean, east'].shadow.length, 1, 'Vesconte, the smaller, lies over its north-east');
  assert.ok(s['Europe and the Mediterranean'].shadow.length >= 2);
  assert.ok(inShadow(s['Europe and the Mediterranean'], 8, 40));
});

test('a line is cut where a smaller sheet lies, on the edge, and left whole elsewhere', () => {
  const box = { west: 10, east: 20, south: 30, north: 40 };
  const line = [[0, 35], [5, 35], [30, 35]];
  const runs = cutOut(line, [box]);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0].slice(0, 2), [[0, 35], [5, 35]]);
  close(runs[0].at(-1)[0], 10); close(runs[1][0][0], 20); assert.deepEqual(runs[1].at(-1), [30, 35]);
  // a line leaving through the north edge starts there
  const [out] = cutOut([[15, 35], [15, 50]], [box]);
  close(out[0][1], 40); assert.deepEqual(out.at(-1), [15, 50]);
  assert.deepEqual(cutOut(line, []), [line]);
  assert.deepEqual(cutOut([[0, 0], [5, 5]], [box]), [[[0, 0], [5, 5]]], 'a line that misses the box is whole');
  assert.deepEqual(cutOut([[12, 32], [18, 38]], [box]), [], 'a line wholly inside is gone');
  // two boxes on one segment leave three runs
  assert.equal(cutOut([[0, 35], [60, 35]], [box, { west: 40, east: 50, south: 30, north: 40 }]).length, 3);
});

// docs/atlas/ornaments.md: a read chart carries its own figures, a chart that draws none an empty set, and
// a sheet in view hands them to the scene; every named sprite is one the packs hold.
test('curated sheets carry their charts\' own figures', () => {
  const ids = new Set(['vivid', 'scanned'].flatMap((p) => JSON.parse(readFileSync(new URL(`../packs/${p}/pack.json`, import.meta.url))).sprites.map((s) => s.id)));
  const by = Object.fromEntries(CURATED.map((c) => [c.source, c]));
  for (const s of ['Carte Pisane, western circle', 'Carte Pisane, eastern circle', 'Vesconte, 1311', 'Dulcert, 1339']) assert.deepEqual(by[s].ornaments, [], s);
  const marina = by['Carta Marina, 1539'].ornaments;
  assert.deepEqual(['rose', 'monster', 'ship'].map((k) => marina.filter((f) => f.kind === k).length), [4, 11, 12]);
  for (const c of CURATED) for (const f of c.ornaments ?? []) {
    assert.ok(['rose', 'monster', 'ship'].includes(f.kind) && Math.abs(f.lon) <= 180 && Math.abs(f.lat) <= 90, `${c.source} ${JSON.stringify(f)}`);
    if (f.sprite) assert.ok(ids.has(f.sprite), `${c.source}: no sprite ${f.sprite}`);
  }
  const baltic = sheetsFor({ lon: 19.5, lat: 58, zoom: 7 }, { curated: true });
  assert.equal(baltic.find((s) => s.source === 'Carta Marina, 1539').ornaments, marina);
  assert.deepEqual(baltic.find((s) => s.source === 'Dulcert, 1339').ornaments, []);
});
