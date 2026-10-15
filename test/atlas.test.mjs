import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetsFor, bandFor, widening, BANDS, hiddenCircle } from '../scripts/atlas.mjs';

const bounds = (zoom, west, south, east, north) => ({ zoom, west, south, east, north });
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const inside = (k, p) => k.west >= p.west - 1e-9 && k.east <= p.east + 1e-9 && k.south >= p.south - 1e-9 && k.north <= p.north + 1e-9;

test('zoom bands pick the doc heights; the world band gets the overview grid', () => {
  const h = (z) => bandFor(z).height;
  assert.deepEqual([1, 5.9, 6, 7.9, 8, 10, 12, 14, 14.9, 15, 17].map(h), [19.2, 19.2, 19.2, 19.2, 4.8, 1.2, 0.3, 0.075, 0.075, 0.075, 0.075]);
});

test('edges sit on whole multiples of the height from the equator and prime meridian', () => {
  for (const z of [6, 8, 10, 12, 14]) {
    for (const s of sheetsFor({ lon: 12.3, lat: 41.9, zoom: z })) {
      const h = s.extent.north - s.extent.south, w = s.extent.east - s.extent.west;
      close(s.extent.south / h, Math.round(s.extent.south / h));
      if (s.extent.west > -180) close(s.extent.west / w, Math.round(s.extent.west / w));
      if (s.extent.east < 180) close(s.extent.east / w, Math.round(s.extent.east / w));
    }
  }
});

test('sixteen sheets of a band nest in one of the band above', () => {
  const parent = sheetsFor(bounds(8, 10.1, 41.2, 10.2, 41.3))[0].extent;
  const kids = sheetsFor(bounds(10, parent.west + 1e-4, parent.south + 1e-4, parent.east - 1e-4, parent.north - 1e-4));
  assert.equal(kids.length, 16);
  for (const k of kids) assert.ok(inside(k.extent, parent));
});

test('widening: 1x, 2x above 49 12, 4x above 69 12, north and south, coastal band down only', () => {
  const coastal = BANDS[2], general = BANDS[1];
  assert.equal(widening(coastal, 40, 1.2), 1);
  assert.equal(widening(coastal, 49.2, 1.2), 2);
  assert.equal(widening(coastal, 60, 1.2), 2);
  assert.equal(widening(coastal, 70.8, 1.2), 4);
  assert.equal(widening(coastal, -50.4, 1.2), 2);
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
  assert.ok(Math.max(...north.map((s) => s.extent.north)) <= 76.8 + 1e-9);
  const south = sheetsFor(bounds(6, -10, -90, 10, -60));
  assert.ok(Math.min(...south.map((s) => s.extent.south)) >= -76.8 - 1e-9);
  for (const z of [8, 10, 12, 14]) for (const s of sheetsFor(bounds(z, 0, 85, 1, 90))) assert.ok(s.extent.north <= 90 + 1e-9);
  assert.equal(sheetsFor(bounds(6, 0, 80, 1, 90)).length, 0);
});

test('names are ENC-style, unique, and the same wherever the view is', () => {
  const a = sheetsFor({ lon: 12.3, lat: 41.9, zoom: 10 });
  assert.ok(a.every((s) => /^PT3[NS]\d{3}[EW]\d{4}$/.test(s.name)));
  assert.equal(new Set(a.map((s) => s.name)).size, a.length);
  const b = sheetsFor({ lon: 12.31, lat: 41.91, zoom: 10 });
  for (const s of b) { const m = a.find((x) => x.name === s.name); if (m) assert.deepEqual(m.extent, s.extent); }
  const ne = sheetsFor(bounds(10, 0.1, 0.1, 0.2, 0.2))[0].name;
  assert.notEqual(ne, sheetsFor(bounds(10, 0.1, -0.2, 0.2, -0.1))[0].name);
  assert.notEqual(ne, sheetsFor(bounds(10, -0.2, 0.1, -0.1, 0.2))[0].name);
  assert.equal(ne, 'PT3N000E0000');
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
