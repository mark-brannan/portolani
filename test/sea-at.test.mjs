import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seaAtOf } from '../scripts/scene.mjs';

// The world's 50m land, as the scene's placement reads it: each polygon its rings, boxed by its outer ring.
const LAND = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')), 'utf8'));
const polys = LAND.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
const box = (ring) => ({ x0: Math.min(...ring.map((p) => p[0])), x1: Math.max(...ring.map((p) => p[0])), y0: Math.min(...ring.map((p) => p[1])), y1: Math.max(...ring.map((p) => p[1])) });
const world = { land: polys.map((poly) => ({ poly, box: box(poly[0]) })) };

test('a hole in the land is sea, and the Caspian is the one hole the world\'s land has', () => {
  const holes = polys.flatMap((p) => p.slice(1));
  assert.equal(holes.length, 1);
  const seaAt = seaAtOf(world);
  assert.equal(seaAt(50.6, 41.1), true, 'the Catalan Atlas\'s Caspian ship');
  assert.equal(seaAt(73.8, 46.6), false, 'sheet 10\'s pearl fishers, on the steppe');
  assert.equal(seaAt(-30, 30), true, 'the open Atlantic');
});
