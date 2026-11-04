// The world turned to the chart (docs/spec/design.md, "The world turned to the chart", "A chart with no up turns for
// the reader"): a view's `bearing` turns the map on the canvas about its centre, and every sheet with it. Seconds, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { panView, zoomView, clampView, viewProjection, DEFAULT_VIEW, PROJECTION_NAMES, W, H } from '../scripts/scene.mjs';
import { frameBox } from '../scripts/frame-box.mjs';
import { sheetCorners, sheetView } from '../scripts/overlays.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const cosa = overlays.find((o) => o.id === 'de-la-cosa');
const at = { lon: -15, lat: 21, zoom: 4, projection: 'mercator' };

test('north up is no bearing: the view keeps no key, and a turn all the way round is north up', () => {
  assert.equal('bearing' in clampView(at), false);
  assert.equal('bearing' in clampView({ ...at, bearing: 360 }), false);
  assert.equal(clampView({ ...at, bearing: -90 }).bearing, 270);
  assert.equal(clampView({ ...at, bearing: 450 }).bearing, 90);
});

test('the bearing is the compass direction at the top of the canvas: west up puts north on the right', () => {
  const p = viewProjection({ ...at, bearing: 270 }), [cx, cy] = p.project(at.lon, at.lat);
  close(cx, W / 2); close(cy, H / 2);
  const [nx, ny] = p.project(at.lon, at.lat + 5), [wx, wy] = p.project(at.lon - 5, at.lat);
  assert.ok(nx > cx + 50 && Math.abs(ny - cy) < 1, 'north to the right');
  assert.ok(wy < cy - 50 && Math.abs(wx - cx) < 1, 'west at the top');
});

test('in every projection a turned point inverts back to itself, and the canvas centre stays the view centre', () => {
  for (const projection of PROJECTION_NAMES) {
    const p = viewProjection({ ...at, projection, bearing: 123 });
    const [x, y] = p.project(-10, 30), [lon, lat] = p.invert(x, y);
    close(lon, -10, 1e-6); close(lat, 30, 1e-6);
    close(p.project(at.lon, at.lat)[0], W / 2, 1e-6);
    // x and y as the relief and the trees take them agree with project
    close(p.x(-10, 30), x); close(p.y(30, -10), y);
  }
});

test('a drag turned with the world moves the map under the pointer, and its reverse comes back', () => {
  const v = clampView({ ...at, bearing: 270 }), p = viewProjection(v);
  const before = p.project(-20, 25), moved = panView(v, 60, -40), after = viewProjection(moved).project(-20, 25);
  close(after[0] - before[0], 60, 1e-6); close(after[1] - before[1], -40, 1e-6);
  const back = panView(moved, -60, 40);
  close(back.lon, v.lon); close(back.lat, v.lat);
  assert.equal(back.bearing, 270);
});

test('a wheel under a bearing keeps the point under the pointer', () => {
  const v = clampView({ ...at, bearing: 200 }), px = 1100, py = 300;
  const ll = viewProjection(v).invert(px, py), z = zoomView(v, 2, px, py), [x, y] = viewProjection(z).project(...ll);
  close(x, px, 1e-4); close(y, py, 1e-4);
  assert.equal(z.bearing, 200);
});

test('the frame a turned view paints holds every corner of the canvas', () => {
  for (const projection of ['mercator', 'orthographic']) {
    const p = viewProjection({ ...DEFAULT_VIEW, projection, zoom: 4, bearing: 45 }), f = frameBox(p, W, H);
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const [lon, lat] = p.invert(x, y);
      assert.ok(lon >= f.lonMin - 1e-9 && lon <= f.lonMax + 1e-9 && lat >= f.latMin - 1e-9 && lat <= f.latMax + 1e-9, `${projection} ${x},${y}`);
    }
  }
});

test('de la Cosa is drawn west up: at the bearing its `up` names, the scan stands upright on the canvas, the equator up and down', () => {
  assert.equal(cosa.up, 90);
  const bearing = cosa.sheet.turn - cosa.up, v = sheetView(cosa, cosa.sheet, { bearing });
  const p = viewProjection(v), img = { ...cosa, img: { width: cosa.width, height: cosa.height } };
  const [tl, tr, , bl] = sheetCorners(img, p, cosa.sheet);
  // the scan's top edge runs straight down the canvas on its right: turned a quarter clockwise, its west edge on top
  close(tl[0], tr[0], 1e-6); assert.ok(tr[1] > tl[1]);
  close(tl[1], bl[1], 1e-6); assert.ok(tl[0] > bl[0]);
  // framed whole, inside the canvas
  for (const [x, y] of sheetCorners(img, p, cosa.sheet)) assert.ok(x >= 0 && x <= W && y >= 0 && y <= H, `${x},${y}`);
});

test('a sheet keeps its place on the world as the world turns: the walk round the table', () => {
  const img = { ...cosa, img: { width: cosa.width, height: cosa.height } }, v = clampView({ ...at, zoom: 2 });
  const corner = (b) => viewProjection({ ...v, bearing: b }).invert(...sheetCorners(img, viewProjection({ ...v, bearing: b }), cosa.sheet)[0]);
  const [lon0, lat0] = corner(0);
  for (const b of [30, 180, 300]) { const [lon, lat] = corner(b); close(lon, lon0, 1e-6); close(lat, lat0, 1e-6); }
});
