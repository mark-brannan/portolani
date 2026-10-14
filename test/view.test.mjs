import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panView, zoomView, clampView, DEFAULT_VIEW, ZOOM, W, H } from '../scripts/scene.mjs';

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
