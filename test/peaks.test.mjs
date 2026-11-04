// Landmark peaks (scripts/peaks.mjs): which summits the site ships, and what a click on one finds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slimPeaks, peaksOf, peakTile, kmBetween, PEAK_SEA_KM } from '../scripts/peaks.mjs';
import { peakHits } from '../scripts/scene.mjs';

const read = (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));
const fixture = read(new URL('./fixtures/peaks-10m.json', import.meta.url));
const names = new Set(peaksOf(fixture).map((p) => p.name));

test('the committed peaks are what slimPeaks reads off the coastlines files', () => {
  const points = read(import.meta.resolve('coastlines/data/ne-geography-regions-elevation-points-10m'));
  const coast = read(import.meta.resolve('coastlines/data/ne-coastline-10m'));
  assert.deepEqual(slimPeaks(points, coast), fixture);
});

test('a summit within 100 km of the sea is kept, one farther inland is not, nor a pass or a depression', () => {
  assert.equal(PEAK_SEA_KM, 100);
  for (const n of ['Mount Rainier', 'Mount Baker', 'Mount Olympus', 'Monte Etna', 'Vesuvio', 'Pico del Teide']) assert.ok(names.has(n), n);
  for (const n of ['Mont Blanc', 'Sierra Blanca Peak']) assert.ok(!names.has(n), n); // the Alps' and New Mexico's, far inland
  const kinds = new Set(read(import.meta.resolve('coastlines/data/ne-geography-regions-elevation-points-10m')).features
    .filter((f) => names.has(f.properties.name)).map((f) => f.properties.featurecla));
  assert.ok([...kinds].every((k) => k === 'mountain' || k === 'spot elevation'), [...kinds].join());
});

test('kmBetween is the great-circle distance', () => {
  assert.ok(Math.abs(kmBetween([0, 0], [1, 0]) - 111.19) < 0.05);
  assert.ok(Math.abs(kmBetween([179.5, 0], [-179.5, 0]) - 111.19) < 0.05); // across the date line
});

test('a peak\'s tile gives its name and its height in metres and feet', () => {
  assert.deepEqual(peakTile({ name: 'Mount Rainier', elevation: 4392 }), { title: 'Mount Rainier', date: '4,392 m (14,409 ft)' });
});

test('a click anywhere on a peak\'s drawing, or just off it, takes the peak', () => {
  const proj = { toPx: ([lon, lat]) => [lon * 10, lat * 10] }, tile = { title: 'Mount Baker' };
  const [m] = peakHits([{ at: [50, 40], w: 90, h: 55, tile }], proj, { x0: 0, y0: 0, x1: 1600, y1: 1000 });
  const inside = (x, y) => x > m.hit[0][0] && x < m.hit[1][0] && y > m.hit[0][1] && y < m.hit[2][1];
  assert.equal(m.tile, tile);
  assert.ok(inside(500 - 45 - 7, 400 - 27 - 7) && inside(500 + 45 + 7, 400 + 27 + 7), 'the whole sprite and a margin');
  assert.ok(!inside(500 + 45 + 10, 400));
  assert.deepEqual(peakHits([{ at: [500, 40], w: 90, h: 55, tile }], proj, { x0: 0, y0: 0, x1: 1600, y1: 1000 }), []); // off the window
});
