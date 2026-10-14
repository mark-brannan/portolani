import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panView, zoomView, clampView, covers, viewProjection, DEFAULT_VIEW, ZOOM, PROJECTION_NAMES, W, H } from '../scripts/scene.mjs';

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
  assert.ok(covers(coarse, { zoom: 9.5, lat: 44.4, lon: 8.9 }));
  assert.ok(covers(cells, { zoom: 9.5, lat: 44.4, lon: 8.9 }));
  assert.ok(!covers(cells, { zoom: 9, lat: 44.4, lon: 8.9 })); // out to 50m
  assert.ok(!covers(cells, { zoom: 9.5, lat: 44.4, lon: 15 })); // dragged past the loaded cells
  assert.ok(!covers(cells, { zoom: 10.5, lat: 44.4, lon: 8.9 })); // into the "h" band: its cells are wanted
  const fine = { ...cells, detail: { ...cells.detail, band: 'h' } };
  assert.ok(covers(fine, { zoom: 10.5, lat: 44.4, lon: 8.9 }));
  assert.ok(!covers(fine, { zoom: 9.5, lat: 44.4, lon: 8.9 })); // back out to 10m
  assert.ok(!covers(fine, { zoom: 12.5, lat: 44.4, lon: 8.9 })); // into the "f" band
  const full = { ...cells, detail: { ...cells.detail, band: 'f' } };
  assert.ok(covers(full, { zoom: 14.5, lat: 44.4, lon: 8.9 }));
  assert.ok(!covers(full, { zoom: 11.5, lat: 44.4, lon: 8.9 })); // back out to "h"
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

test('a zoom on an azimuthal view keeps the point under the pointer where a north-up centre can', () => {
  for (const projection of ['orthographic', 'azimuthal-equidistant', 'stereographic']) {
    for (const lat of [30, 80]) {
      const v = clampView({ lon: 10, lat, zoom: 2, projection });
      for (const [px, py] of [[1000, 300], [700, 650], [W / 2 + 50, H / 2 - 20]]) {
        const at = viewProjection(v).invert(px, py), [qx, qy] = viewProjection(zoomView(v, 1.7, px, py)).project(...at);
        close(qx, px, 1e-6); close(qy, py, 1e-6);
      }
    }
  }
});

test('a sideways drag near a pole swings the longitude but does not snap the view to the pole', () => {
  const k = 512 * 2 ** 2 / (2 * Math.PI);
  for (const projection of ['orthographic', 'azimuthal-equidistant', 'stereographic']) {
    for (const deg of [1, 4, 12]) {
      const v = panView(clampView({ lon: 0, lat: 89, zoom: 2, projection }), -deg * Math.PI / 180 * k, 0);
      assert.ok(Math.abs(v.lat) < 89.5 && Math.abs(v.lat) > 70, `${projection} ${deg} deg: lat ${v.lat}`);
    }
  }
});

test('an unknown projection is Mercator, and a whole map shorter than the canvas sits on the equator', () => {
  assert.equal(clampView({ lon: 0, lat: 0, zoom: 4, projection: 'nonsense' }).projection, 'mercator');
  for (const name of ['constructor', 'toString', '__proto__']) assert.equal(clampView({ lon: 0, lat: 0, zoom: 4, projection: name }).projection, 'mercator', name);
  assert.equal(clampView({ lon: 0, lat: 0, zoom: 4 }).projection, 'mercator');
  for (const projection of ['plate-carree', 'miller', 'equal-area']) {
    assert.equal(clampView({ lon: 0, lat: 60, zoom: ZOOM.min, projection }).lat, 0, projection);
  }
});

const AZIMUTHAL = ['orthographic', 'azimuthal-equidistant', 'stereographic'];

test('an azimuthal view centres anywhere short of the pole, where a drag stops', () => {
  for (const projection of AZIMUTHAL) {
    const v = clampView({ lon: 0, lat: 60, zoom: ZOOM.min, projection });
    assert.equal(v.lat, 60, projection);
    assert.ok(clampView({ lon: 0, lat: 95, zoom: 2, projection }).lat < 90);
    const over = panView(clampView({ lon: 0, lat: 85, zoom: 2, projection }), 0, 400); // the map dragged down, far past the pole
    assert.ok(over.lat > 89.99 && Math.abs(over.lon) < 1e-6, `${projection}: ${JSON.stringify(over)}`); // stops there
    const near = panView(clampView({ lon: 0, lat: 85, zoom: 2, projection }), 0, 10);
    assert.ok(near.lat > 85 && near.lat < 90 && Math.abs(near.lon) < 1e-6, `${projection}: ${JSON.stringify(near)}`);
  }
});

test('a point behind the horizon is refused, one in front projects where it should', () => {
  const view = clampView({ lon: 10, lat: 30, zoom: 2, projection: 'orthographic' });
  const data = viewProjection(view);
  assert.ok(data.visible(10, 30) && data.visible(60, 0) && !data.visible(-170, -30) && !data.visible(10, -70));
  close(data.project(10, 30)[0], W / 2); close(data.project(10, 30)[1], H / 2);
  assert.ok(data.project(100, 30)[0] > W / 2); // east is right
  assert.ok(data.project(10, 80)[1] < H / 2); // north is up
  const [lon, lat] = data.invert(...data.project(40, -20));
  close(lon, 40, 1e-9); close(lat, -20, 1e-9);
  assert.ok(data.rim > 0 && data.rim < H / 2); // the whole globe fits at z2
});
