import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { similarityFit, applyFit, affineThrough3, loadOverlay, drawOverlay, OVERLAY_DEFAULTS, overlayFromHash, overlayToHash } from '../scripts/overlays.mjs';
import { figureRows, landmarkRows } from '../scripts/build-overlays.mjs';
import { viewProjection } from '../scripts/scene.mjs';

const ROOT = new URL('..', import.meta.url);
const rows = figureRows(readFileSync(new URL('docs/atlas/ornaments.md', ROOT), 'utf8'));
const { overlays } = JSON.parse(readFileSync(new URL('packs/overlays/overlays.json', ROOT), 'utf8'));
const carta = overlays.find((o) => o.id === 'carta-marina');
const catalan = overlays.find((o) => o.id === 'catalan-atlas');
const landmarks = landmarkRows(readFileSync(new URL('docs/atlas/ornaments.md', ROOT), 'utf8'), '### Landmarks, sheet 5');

test('the figures table of the Carta Marina has its 27 rows, 23 west and 4 Baltic', () => {
  assert.equal(rows.length, 27);
  assert.equal(rows.filter((r) => r.fit === 'west').length, 23);
});

// The table's lon, lat were produced by the fits, to 0.1 degree, so the refit gives them back to
// about that rounding (ornaments.md's own residual is 47 to 101 km against the landmarks).
test('the committed fits give back every figure of ornaments.md to within 0.1 degree', () => {
  const [west, baltic] = carta.pieces;
  let worst = 0;
  for (const r of rows) {
    const piece = r.px[0] <= west.x1 ? west : baltic;
    assert.equal(piece === west ? 'west' : 'baltic', r.fit, `${r.id} takes its side's fit`);
    const [lon, lat] = applyFit(piece.fit, ...r.px);
    worst = Math.max(worst, Math.abs(lon - r.ll[0]), Math.abs(lat - r.ll[1]));
  }
  assert.ok(worst < 0.1, `worst ${worst.toFixed(3)} degrees`);
  // the doc's scale and turn: west 0.0113 deg/px at 48 degrees, Baltic 0.0100 at 3
  const w = similarityFit(rows.filter((r) => r.fit === 'west').map((r) => [r.px, r.ll]));
  const b = similarityFit(rows.filter((r) => r.fit === 'baltic').map((r) => [r.px, r.ll]));
  assert.equal(w.scale.toFixed(4), '0.0113'); assert.equal(Math.round(w.turn), 48);
  assert.equal(b.scale.toFixed(4), '0.0100'); assert.equal(Math.round(b.turn), 3);
});

// ornaments.md, "Landmarks, sheet 5": one similarity, 0.00331 deg/px, no turn, 127 km RMS, El Hierro worst at 284.
test('the Catalan Atlas fit is the least-squares fit of its 19 landmarks, and their residual is the doc\'s', () => {
  assert.equal(landmarks.length, 19);
  const [piece] = catalan.pieces, fit = similarityFit(landmarks.map((r) => [r.px, r.ll]));
  for (const k of ['a', 'b', 'tx', 'ty']) assert.ok(Math.abs(fit[k] - piece.fit[k]) < 1e-9, k);
  assert.equal(fit.scale.toFixed(5), '0.00331'); assert.ok(Math.abs(fit.turn) < 0.5);
  const km = ([lon, lat], [lo2, la2]) => 6371 * Math.hypot((lon - lo2) * Math.cos(((lat + la2) / 2) * Math.PI / 180), lat - la2) * Math.PI / 180;
  const off = landmarks.map((r) => km(applyFit(piece.fit, ...r.px), r.ll));
  assert.equal(Math.round(Math.sqrt(off.reduce((s, d) => s + d * d, 0) / off.length) / 10), 13); // 127 km, to the nearest 10
  assert.equal(landmarks[off.indexOf(Math.max(...off))].id, 'L19');
});

// ornaments.md, "Landmarks, 1500": three similarities, west 154 km RMS, atlantic 140, east 406; one fit for
// the whole chart leaves 790.
test('Juan de la Cosa\'s three pieces are the least-squares fits of their landmarks, with the doc\'s residuals', () => {
  const cosa = overlays.find((o) => o.id === 'de-la-cosa');
  const rows = landmarkRows(readFileSync(new URL('docs/atlas/ornaments.md', ROOT), 'utf8'), '### Landmarks, 1500');
  assert.equal(rows.length, 14);
  const km = ([lon, lat], [lo2, la2]) => 6371 * Math.hypot((lon - lo2) * Math.cos(((lat + la2) / 2) * Math.PI / 180), lat - la2) * Math.PI / 180;
  const rms = (fit, rs) => Math.round(Math.sqrt(rs.reduce((s, r) => s + km(applyFit(fit, ...r.px), r.ll) ** 2, 0) / rs.length));
  assert.deepEqual(cosa.pieces.map((p) => [p.x0, p.x1]), [[70, 880], [880, 1150], [1150, 2060]]);
  ['west', 'atlantic', 'east'].forEach((name, i) => {
    const rs = rows.filter((r) => r.piece === name), fit = similarityFit(rs.map((r) => [r.px, r.ll]));
    for (const k of ['a', 'b', 'tx', 'ty']) assert.ok(Math.abs(fit[k] - cosa.pieces[i].fit[k]) < 1e-9, `${name} ${k}`);
    for (const r of rs) assert.ok(r.px[0] >= cosa.pieces[i].x0 && r.px[0] < cosa.pieces[i].x1, `${r.id} in ${name}`);
    assert.equal(rms(fit, rs), [154, 140, 406][i], name);
  });
  assert.equal(rms(similarityFit(rows.map((r) => [r.px, r.ll])), rows), 790);
});

test('a similarity fitted to exact pairs is recovered', () => {
  const fit = { a: 0.01, b: 0.002, tx: -5, ty: 70 };
  const pts = [[100, 200], [3000, 400], [1500, 3000], [4000, 2500]];
  const back = similarityFit(pts.map((p) => [p, applyFit(fit, ...p)]));
  for (const k of ['a', 'b', 'tx', 'ty']) assert.ok(Math.abs(back[k] - fit[k]) < 1e-9, k);
});

test('affineThrough3 takes its three points onto theirs, and a fourth by the same map', () => {
  const src = [[0, 0], [10, 0], [0, 5]], dst = [[100, 50], [120, 60], [95, 70]];
  const [a, b, c, d, e, f] = affineThrough3(src, dst);
  const at = ([x, y]) => [a * x + c * y + e, b * x + d * y + f];
  src.forEach((p, i) => at(p).forEach((v, j) => assert.ok(Math.abs(v - dst[i][j]) < 1e-9)));
  const far = at([10, 5]);
  assert.ok(Math.abs(far[0] - 115) < 1e-9 && Math.abs(far[1] - 80) < 1e-9);
  assert.equal(affineThrough3([[0, 0], [1, 1], [2, 2]], dst), null);
});

test('in Mercator the drawn affine lands every figure where its fit and the projection put it', () => {
  const proj = viewProjection({ lon: 19.7, lat: 61.7, zoom: 4 });
  for (const piece of carta.pieces) {
    const s = carta.scale, corners = [[piece.x0, 0], [piece.x1, 0], [piece.x0, carta.height]];
    const m = affineThrough3(corners.map(([x, y]) => [x / s, y / s]), corners.map(([x, y]) => proj.project(...applyFit(piece.fit, x, y))));
    for (const r of rows.filter((q) => (q.px[0] <= 2700) === (piece.x0 === 0))) {
      const [x, y] = [r.px[0] / s, r.px[1] / s], want = proj.project(...applyFit(piece.fit, ...r.px));
      assert.ok(Math.hypot(m[0] * x + m[2] * y + m[4] - want[0], m[1] * x + m[3] * y + m[5] - want[1]) < 0.01, r.id);
    }
  }
});

test('an overlay the site lacks loads as null and draws nothing', async () => {
  const env = { readJSON: async () => ({ overlays }), loadImage: async () => { throw new Error('no image'); } };
  assert.equal(await loadOverlay('no-such-chart', env), null);
  assert.equal(await loadOverlay('../etc', env), null);
  assert.equal(await loadOverlay('carta-marina', env), null); // its image fails to load
  const calls = [];
  const g = new Proxy({}, { get: (_, k) => (...args) => calls.push(k) });
  drawOverlay(g, null, viewProjection({ lon: 0, lat: 0, zoom: 2 }), 0.6);
  assert.deepEqual(calls, []);
});

// docs/spec/drawer.md "Scan overlay": the overlay's two hash keys, defaults off and 0.6.
const written = (st) => { const q = new URLSearchParams(); overlayToHash(st, q); return q.toString(); };
test('the overlay in the hash: the default writes nothing, a link round-trips, an unknown id reads as off', () => {
  assert.deepEqual(OVERLAY_DEFAULTS, { overlay: null, overlayOpacity: 0.6 });
  assert.equal(written(OVERLAY_DEFAULTS), '', 'the default writes nothing');
  assert.deepEqual(overlayFromHash(new URLSearchParams('')), OVERLAY_DEFAULTS, 'no keys read as the default');
  const ids = new Set(overlays.map((o) => o.id));
  const read = overlayFromHash(new URLSearchParams('overlay=carta-marina&overlayopacity=0.6'), ids);
  assert.deepEqual(read, { overlay: 'carta-marina', overlayOpacity: 0.6 });
  assert.equal(written(read), 'overlay=carta-marina', '0.6 is the default, so only the id is written back');
  const faint = overlayFromHash(new URLSearchParams('overlay=carta-marina&overlayopacity=0.3'), ids);
  assert.equal(written(faint), 'overlay=carta-marina&overlayopacity=0.3');
  assert.equal(overlayFromHash(new URLSearchParams('overlay=nowhere'), ids).overlay, null, 'an id the site lacks reads as off');
  assert.equal(overlayFromHash(new URLSearchParams('overlay=off')).overlay, null);
  assert.equal(overlayFromHash(new URLSearchParams('overlay=../etc')).overlay, null);
  assert.equal(overlayFromHash(new URLSearchParams('overlayopacity=2')).overlayOpacity, 0.6, 'out of range falls back');
});
