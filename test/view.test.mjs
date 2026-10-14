import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panView, zoomView, clampView, covers, DEFAULT_VIEW, ZOOM, PROJECTION_NAMES, W, H } from '../scripts/scene.mjs';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('a drag and its reverse return to the same view', () => {
  const v = panView(panView(DEFAULT_VIEW, 300, -120), -300, 120);
  close(v.lon, DEFAULT_VIEW.lon); close(v.lat, DEFAULT_VIEW.lat);
});

test('zooming about a point and back about the same point returns to the same view', () => {
  const v = zoomView(zoomView(DEFAULT_VIEW, 4, 200, 700), 1 / 4, 200, 700);
  close(v.lon, DEFAULT_VIEW.lon); close(v.lat, DEFAULT_VIEW.lat); close(v.zoom, DEFAULT_VIEW.zoom);
});

test('zooming about the centre keeps the centre', () => {
  const v = zoomView(DEFAULT_VIEW, 2, W / 2, H / 2);
  close(v.lon, DEFAULT_VIEW.lon); close(v.lat, DEFAULT_VIEW.lat); close(v.zoom, DEFAULT_VIEW.zoom + 1);
});

test('zoom stays within its bounds', () => {
  assert.equal(zoomView(DEFAULT_VIEW, 1e6, 0, 0).zoom, ZOOM.max);
  assert.equal(zoomView(DEFAULT_VIEW, 1e-6, 0, 0).zoom, ZOOM.min);
});

test('panning past the antimeridian wraps the longitude', () => {
  const v = clampView({ lon: 190, lat: 0, zoom: 4 });
  close(v.lon, -170);
});

test('the centre stays far enough from the poles to keep the canvas on the map', () => {
  const v = clampView({ lon: 0, lat: 89, zoom: ZOOM.min });
  assert.ok(v.lat < 85.06 && v.lat > 0);
});

test('a moving view draws from a band\'s cells only while it still picks that band, inside the frame they cover', () => {
  const coarse = { land: [] }, cells = { land: [], detail: { lonMin: 6, lonMax: 12, latMin: 42, latMax: 47, band: '10m' } };
  assert.ok(covers(coarse, { zoom: 11, lat: 44.4, lon: 8.9 }));
  assert.ok(covers(cells, { zoom: 11, lat: 44.4, lon: 8.9 }));
  assert.ok(!covers(cells, { zoom: 9, lat: 44.4, lon: 8.9 })); // out to 50m
  assert.ok(!covers(cells, { zoom: 11, lat: 44.4, lon: 15 })); // dragged past the loaded cells
  assert.ok(!covers(cells, { zoom: 12.5, lat: 44.4, lon: 8.9 })); // into the "h" band: its cells are wanted
  const fine = { ...cells, detail: { ...cells.detail, band: 'h' } };
  assert.ok(covers(fine, { zoom: 12.5, lat: 44.4, lon: 8.9 }));
  assert.ok(!covers(fine, { zoom: 11, lat: 44.4, lon: 8.9 })); // back out to 10m
});

test('in every projection a drag, a zoom and their reverses return to the same view', () => {
  for (const projection of PROJECTION_NAMES) {
    const v0 = clampView({ lon: 12, lat: 41, zoom: 5, projection });
    assert.equal(v0.projection, projection);
    const v = zoomView(panView(zoomView(panView(v0, 300, -120), 4, 200, 700), 0, 0), 1 / 4, 200, 700);
    const back = panView(v, -300, 120);
    close(back.lon, v0.lon, 1e-6); close(back.lat, v0.lat, 1e-6); close(back.zoom, v0.zoom);
    assert.equal(back.projection, projection);
  }
});

test('an unknown projection is Mercator, and a whole map shorter than the canvas sits on the equator', () => {
  assert.equal(clampView({ lon: 0, lat: 0, zoom: 4, projection: 'nonsense' }).projection, 'mercator');
  for (const name of ['constructor', 'toString', '__proto__']) assert.equal(clampView({ lon: 0, lat: 0, zoom: 4, projection: name }).projection, 'mercator', name);
  assert.equal(clampView({ lon: 0, lat: 0, zoom: 4 }).projection, 'mercator');
  for (const projection of PROJECTION_NAMES.filter((p) => p !== 'mercator')) {
    assert.equal(clampView({ lon: 0, lat: 60, zoom: ZOOM.min, projection }).lat, 0, projection);
  }
});
