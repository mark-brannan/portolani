// How the map flies (public/flight.mjs, from the user's UI walk of 2026-10-30): a place near the view is eased to
// straight and never swings off the canvas; a far one is flown in an arc, out to a height set by the distance,
// across at that height, then down onto it; a longer flight takes longer, within a floor and a ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFlight, FIT, MIN_MS, MAX_MS } from '../public/flight.mjs';

const W = 1600, H = 1000, opts = { w: W, h: H, minZoom: 1 };
const RAD = Math.PI / 180, k = (z) => (512 * 2 ** z) / (2 * Math.PI);
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
// where `p` sits on the canvas of view `v`, in px from the centre (Mercator)
const offset = (v, p) => [(((p.lon - v.lon + 540) % 360) - 180) * RAD * k(v.zoom), (mercY(p.lat) - mercY(v.lat)) * k(v.zoom)];
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const lonClose = (a, b) => close(((a - b + 540) % 360) - 180, 0);

const genoa = { lon: 8.93, lat: 44.41 }, marseille = { lon: 5.37, lat: 43.3 }, havana = { lon: -82.38, lat: 23.13 }, auckland = { lon: 174.76, lat: -36.85 };

test('a place on the canvas is eased to straight, sliding to the centre without swinging off', () => {
  const from = { ...genoa, zoom: 6 }, to = { ...marseille, zoom: 10 };
  const plan = planFlight(from, to, opts);
  assert.equal(plan.arc, false);
  const r0 = Math.hypot(...offset(from, to));
  let last = Infinity;
  for (let e = 0; e <= 1.0001; e += 0.05) {
    const r = Math.hypot(...offset(plan.at(e), to));
    assert.ok(r <= r0 + 1e-6 && r <= last + 1e-6, `at ${e.toFixed(2)} the place is ${r.toFixed(0)} px out, more than ${Math.min(r0, last).toFixed(0)}`);
    last = r;
  }
});

test('a place half a canvas past the edge is still near; a canvas and more past it is far', () => {
  const from = { ...genoa, zoom: 6 }, step = W / k(6) / RAD; // one canvas width of longitude at z6
  assert.equal(planFlight(from, { lon: genoa.lon + 0.95 * step, lat: genoa.lat, zoom: 6 }, opts).arc, false);
  assert.equal(planFlight(from, { lon: genoa.lon + 1.2 * step, lat: genoa.lat, zoom: 6 }, opts).arc, true);
});

test('a far place: out to where both fit, across at that height, then down onto it', () => {
  const from = { ...genoa, zoom: 9 }, to = { ...havana, zoom: 9 };
  const plan = planFlight(from, to, opts);
  assert.ok(plan.arc && plan.top < 9);
  const [dx, dy] = offset({ ...from, zoom: plan.top }, to);
  assert.ok(Math.abs(dx) <= FIT * W + 1e-6 && Math.abs(dy) <= FIT * H + 1e-6, 'both fit at the top');
  // out about the place left, the zoom only falling; across at the top; then down about the place, only rising
  let phase = 'out', prev = plan.at(0);
  for (let e = 0.01; e <= 1.0001; e += 0.01) {
    const v = plan.at(e), atTop = Math.abs(v.zoom - plan.top) < 1e-9;
    if (atTop && phase === 'out') phase = 'across';
    else if (!atTop && phase === 'across') phase = 'down';
    if (phase === 'out') { assert.ok(v.zoom < prev.zoom); lonClose(v.lon, from.lon); close(v.lat, from.lat); }
    if (phase === 'down') { assert.ok(v.zoom >= prev.zoom - 1e-9); lonClose(v.lon, to.lon); close(v.lat, to.lat); }
    prev = v;
  }
  assert.equal(phase, 'down');
});

test('the top of the arc is set by the distance: farther is higher, held at the map\'s widest zoom', () => {
  const from = { ...genoa, zoom: 9 }, tops = [marseille, havana, auckland].map((p) => planFlight(from, { ...p, zoom: 9 }, opts).top);
  close(tops[0], 7.57, 0.01); // Genoa to Marseille, 3.6 degrees of longitude
  close(tops[1], 2.89, 0.01); // to Havana, 91 degrees
  assert.ok(tops[0] > tops[1] && tops[1] > tops[2], tops.join(' > '));
  assert.ok(tops[2] >= 1);
  assert.equal(planFlight({ ...genoa, zoom: 9 }, { ...auckland, zoom: 9 }, { ...opts, minZoom: 2.5 }).top, 2.5);
});

test('the arc never climbs past either end: a target zoomed out further than the fit is the top', () => {
  const plan = planFlight({ ...genoa, zoom: 12 }, { ...havana, zoom: 2 }, opts);
  assert.equal(plan.top, 2);
});

test('it starts where it is and lands on the place, the short way round the date line', () => {
  for (const [from, to] of [[{ ...genoa, zoom: 6 }, { ...marseille, zoom: 10 }], [{ ...genoa, zoom: 9 }, { ...havana, zoom: 7 }], [{ lon: 170, lat: -17, zoom: 9 }, { lon: -170, lat: -14, zoom: 9 }]]) {
    const plan = planFlight(from, to, opts);
    for (const [v, p] of [[plan.at(0), from], [plan.at(1), to]]) { lonClose(v.lon, p.lon); close(v.lat, p.lat); close(v.zoom, p.zoom); }
    for (let e = 0; e <= 1; e += 0.1) { const lon = plan.at(e).lon; assert.ok(lon >= 170 - 1e-9 || lon <= -170 + 1e-9 || from.lon !== 170, `${lon} went the long way`); }
  }
});

test('a longer flight takes longer, within the floor and the ceiling', () => {
  const ms = [[{ ...genoa, zoom: 6 }, { ...genoa, lon: 9, zoom: 6 }], [{ ...genoa, zoom: 9 }, { ...marseille, zoom: 9 }], [{ ...genoa, zoom: 9 }, { ...havana, zoom: 9 }], [{ ...genoa, zoom: 15 }, { ...auckland, zoom: 15 }]]
    .map(([from, to]) => planFlight(from, to, opts).ms);
  assert.equal(ms[0], MIN_MS);
  assert.ok(ms[1] < ms[2], ms.join(' < '));
  assert.equal(ms[3], MAX_MS);
});
