// A chart's position chip draws the line its placement was fitted to (docs/spec/design.md, "A chip shows what it was
// fitted to"): the lines are worked out once by the build (scripts/fit-lines.mjs) and carried in overlays.json beside
// each placement; the page draws them with scene.mjs's drawFitLine, timed by fitLineAt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { landIndex, fitLine, parallelLines, NEAR } from '../scripts/fit-lines.mjs';
import { landmarkRows, catalanMarks } from '../scripts/build-overlays.mjs';
import { FIT_LINE, fitLineAt, fitLineMoving, drawFitLine, viewProjection } from '../scripts/scene.mjs';

const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const md = readFileSync(new URL('../docs/atlas/ornaments.md', import.meta.url), 'utf8');
const km = ([x1, y1], [x2, y2]) => Math.hypot((x2 - x1) * Math.cos(((y1 + y2) / 4) * (Math.PI / 90)), y2 - y1) * 111.2;
const nearest = (line, p) => Math.min(...line.flat().map((q) => km(p, q)));

// A square continent 20° a side, its coast a point every 0.1°, and a small island off its east coast
const square = (x0, y0, s, step) => {
  const ring = [];
  for (let t = 0; t < 4 * s; t += step) { const e = Math.floor(t / s), u = t - e * s; ring.push([[x0 + u, y0], [x0 + s, y0 + u], [x0 + s - u, y0 + s], [x0, y0 + s - u]][e]); }
  return [...ring, ring[0]];
};
const land = landIndex({ features: [
  { geometry: { type: 'Polygon', coordinates: [square(0, 0, 20, 0.1)] } },
  { geometry: { type: 'Polygon', coordinates: [square(22, 10, 0.4, 0.1)] } },
] });

test('a landmark on a small island draws the whole island; on a long coast, the stretch between its neighbours', () => {
  const [isle] = fitLine(land, [[22.2, 10.2]]);
  assert.ok(isle.length >= 4 && Math.abs(isle[0][0] - isle.at(-1)[0]) < 1e-9, 'the island ring, closed');
  // two capes 5° apart on the south coast: the coast between them and a little past, never round the far side
  const [run, ...rest] = fitLine(land, [[5, 0.05], [10, 0.05]]);
  assert.equal(rest.length, 0);
  assert.ok(run.every(([, y]) => Math.abs(y) < 1e-9), `along the south coast only: ${JSON.stringify(run)}`);
  const xs = run.map(([x]) => x);
  assert.ok(Math.min(...xs) < 5 && Math.min(...xs) > 2.5 && Math.max(...xs) > 10 && Math.max(...xs) < 12.5, `5 to 10, a little more each end: ${xs}`);
});

test('a landmark inland on a continent is its place; landmarks far apart along a coast draw apart', () => {
  assert.deepEqual(fitLine(land, [[10, 10]]), [[[10, 10]]], 'the place itself, a ring when drawn');
  const parts = fitLine(land, [[1, 0.05], [19, 19.95]]); // the south west and the north east corners: half the coast apart
  assert.equal(parts.length, 2, 'two stretches, not the coast between them that no landmark is near');
});

test('every placement in overlays.json carries the line it was fitted to, and every landmark lies on it', () => {
  for (const o of overlays) {
    assert.ok(o.sheetLine?.length, `${o.id}: its own placement's line`);
    for (const s of o.snaps) assert.ok(s.line?.length, `${o.id} ${s.label}: its line`);
  }
  const near = (line, p, what) => assert.ok(nearest(line, p) < NEAR + 30, `${what} at ${p}: ${nearest(line, p).toFixed(0)} km from its line`);
  const cosa = overlays.find((o) => o.id === 'de-la-cosa'), rows = landmarkRows(md, '### Landmarks, 1500');
  ['west', 'atlantic', 'east'].forEach((p, i) => { for (const r of rows.filter((q) => q.piece === p)) if (!/middle/.test(r.id)) near(cosa.snaps[i].line, r.ll, `de la Cosa ${p} ${r.id}`); });
  const catalan = overlays.find((o) => o.id === 'catalan-atlas');
  catalanMarks(md).forEach((marks, i) => { for (const p of marks) near(catalan.snaps[i].line, p, `Catalan ${catalan.snaps[i].label}`); });
  // Level is centred between the first and last pages: it draws both their lines
  assert.deepEqual(catalan.sheetLine, [...catalan.snaps[0].line, ...catalan.snaps.at(-1).line]);
});

test('Parallels draws today\'s Tropic of Cancer and equator across the sheet', () => {
  const cosa = overlays.find((o) => o.id === 'de-la-cosa');
  assert.deepEqual(cosa.sheetLine, parallelLines(cosa.parallels, cosa.sheet, cosa.width, cosa.height));
  assert.deepEqual(cosa.sheetLine.map((l) => [...new Set(l.map(([, lat]) => lat))]), [[23.44], [0]], 'each at its latitude');
  for (const l of cosa.sheetLine) {
    const lons = l.map(([lon]) => lon);
    assert.ok(Math.min(...lons) < -90 && Math.max(...lons) > 70, `across the whole skin, the New World to the Indies: ${Math.min(...lons)} to ${Math.max(...lons)}`);
  }
});

test('the line draws itself, holds, then fades to a quarter; with reduced motion it shows whole, then fades', () => {
  const { draw, hold, fade, faint } = FIT_LINE;
  assert.deepEqual(fitLineAt(0), { drawn: 0, alpha: 1 });
  assert.deepEqual(fitLineAt(draw / 2), { drawn: 0.5, alpha: 1 });
  assert.deepEqual(fitLineAt(draw + hold), { drawn: 1, alpha: 1 });
  assert.ok(Math.abs(fitLineAt(draw + hold + fade / 2).alpha - (1 + faint) / 2) < 1e-9);
  assert.deepEqual(fitLineAt(draw + hold + fade + 60_000), { drawn: 1, alpha: faint }, 'faint, and it stays');
  assert.equal(faint, 0.25);
  assert.deepEqual(fitLineAt(0, true), { drawn: 1, alpha: 1 });
  assert.deepEqual(fitLineAt(hold + fade, true), { drawn: 1, alpha: faint });
  assert.ok(fitLineMoving(draw + hold) && !fitLineMoving(draw + hold + fade));
});

test('drawFitLine draws from the line\'s first end, and a place inland as a ring', () => {
  const proj = viewProjection({ lon: 10, lat: 0, zoom: 4 }), c = createCanvas(1600, 1000), g = c.getContext('2d');
  const line = [[[0, 0], [20, 0]]], [x0, y] = proj.project(0, 0), [x1] = proj.project(20, 0);
  const inked = (x, yy) => { const [r, gg, b, a] = g.getImageData(Math.round(x), Math.round(yy), 1, 1).data; return a > 0 && b > r && b > gg; };
  drawFitLine(g, line, proj, { drawn: 0.5 });
  assert.ok(inked(x0 + (x1 - x0) * 0.25, y), 'the first half drawn');
  assert.ok(!inked(x0 + (x1 - x0) * 0.75, y), 'the second half not yet');
  g.clearRect(0, 0, 1600, 1000);
  drawFitLine(g, [[[10, 5]]], proj, { drawn: 1 });
  const [px, py] = proj.project(10, 5);
  assert.ok(inked(px, py - FIT_LINE.ring) && !inked(px, py), 'a ring round the place, nothing on it');
});
