import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipToBox } from '../scripts/clip-geo.mjs';

const box = { x0: 0, x1: 10, y0: 0, y1: 10 };
const fc = (geometry) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] });

test('a ring straddling the box keeps only its inside part', () => {
  const ring = [[5, 5], [15, 5], [15, 8], [5, 8], [5, 5]];
  const [f] = clipToBox(fc({ type: 'Polygon', coordinates: [ring] }), box).features;
  const xs = f.geometry.coordinates[0][0].map(([x]) => x);
  assert.equal(Math.max(...xs), 10);
  assert.equal(Math.min(...xs), 5);
});

test('a ring wholly outside the box is dropped', () => {
  const ring = [[20, 20], [30, 20], [30, 30], [20, 20]];
  assert.equal(clipToBox(fc({ type: 'Polygon', coordinates: [ring] }), box).features.length, 0);
});

test('a line that leaves and re-enters yields two runs, each keeping its boundary neighbours', () => {
  const line = [[2, 5], [5, 5], [20, 5], [30, 5], [8, 5], [9, 5]];
  const [f] = clipToBox(fc({ type: 'LineString', coordinates: line }), box).features;
  assert.deepEqual(f.geometry.coordinates, [[[2, 5], [5, 5], [20, 5]], [[30, 5], [8, 5], [9, 5]]]);
});

test('points outside the box are dropped', () => {
  const geo = { type: 'FeatureCollection', features: [[1, 1], [11, 1]].map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } })) };
  assert.deepEqual(clipToBox(geo, box).features.map((f) => f.geometry.coordinates), [[1, 1]]);
});
