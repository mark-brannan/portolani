import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { similarityFit, applyFit, affineThrough3, loadOverlay, drawOverlay, drawSheet, sheetOf, sheetTransform, sheetCorners, onSheet, sheetFrame, sheetView, OVERLAY_DEFAULTS, overlayFromHash, overlayToHash, sheetText, sameSheet } from '../scripts/overlays.mjs';
import { figureRows, landmarkRows, sheetPlacements, paperMask, redLines, catalanPieces, CATALAN_PAGES, pageOffsets } from '../scripts/build-overlays.mjs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
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
// Sheet 5 is the first page of the eight, cropped at its own x 288, so its piece's px are the scan's less 288.
test('the Catalan Atlas\'s first page is fitted to its 19 landmarks, and their residual is the doc\'s', () => {
  assert.equal(landmarks.length, 19);
  const [piece] = catalan.pieces, fit = similarityFit(landmarks.map((r) => [[r.px[0] - 288, r.px[1]], r.ll]));
  for (const k of ['a', 'b', 'tx', 'ty']) assert.ok(Math.abs(fit[k] - piece.fit[k]) < 1e-9, k);
  assert.equal(fit.scale.toFixed(5), '0.00331'); assert.ok(Math.abs(fit.turn) < 0.5);
  const km = ([lon, lat], [lo2, la2]) => 6371 * Math.hypot((lon - lo2) * Math.cos(((lat + la2) / 2) * Math.PI / 180), lat - la2) * Math.PI / 180;
  const off = landmarks.map((r) => km(applyFit(piece.fit, r.px[0] - 288, r.px[1]), r.ll));
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

// The overlay in the hash: the sheet at the chart's own placement by default, `sheet=` where it was dragged to, the
// warped pieces as `overlaymode=pieces` with their opacity.
const written = (st) => { const q = new URLSearchParams(); overlayToHash(st, q); return q.toString(); };
test('the overlay in the hash: the default writes nothing, a link round-trips, an unknown id reads as off', () => {
  assert.deepEqual(OVERLAY_DEFAULTS, { overlay: null, overlayMode: 'sheet', sheet: null, overlayOpacity: 0.6 });
  assert.equal(written(OVERLAY_DEFAULTS), '', 'the default writes nothing');
  assert.deepEqual(overlayFromHash(new URLSearchParams('')), OVERLAY_DEFAULTS, 'no keys read as the default');
  const ids = new Set(overlays.map((o) => o.id));
  const read = overlayFromHash(new URLSearchParams('overlay=carta-marina&overlayopacity=0.6'), ids);
  assert.deepEqual(read, { overlay: 'carta-marina', overlayMode: 'sheet', sheet: null, overlayOpacity: 0.6 });
  assert.equal(written(read), 'overlay=carta-marina', '0.6 and the sheet are the defaults, so only the id is written back');
  const pieces = overlayFromHash(new URLSearchParams('overlay=carta-marina&overlaymode=pieces&overlayopacity=0.3'), ids);
  assert.equal(pieces.overlayMode, 'pieces');
  assert.equal(written(pieces), 'overlay=carta-marina&overlaymode=pieces&overlayopacity=0.3');
  const moved = overlayFromHash(new URLSearchParams('overlay=de-la-cosa&sheet=-5.18,9.418,0.10464,12.5'), ids);
  assert.deepEqual(moved.sheet, { lon: -5.18, lat: 9.418, scale: 0.10464, turn: 12.5 });
  assert.equal(written(moved), 'overlay=de-la-cosa&sheet=-5.180%2C9.418%2C0.10464%2C12.5');
  assert.equal(overlayFromHash(new URLSearchParams('sheet=1,2,3')).sheet, null, 'three numbers are no placement');
  assert.equal(overlayFromHash(new URLSearchParams('sheet=1,2,0,4')).sheet, null, 'a scale of zero is no placement');
  assert.equal(overlayFromHash(new URLSearchParams('overlaymode=sideways')).overlayMode, 'sheet', 'an unknown mode reads as the sheet');
  assert.equal(overlayFromHash(new URLSearchParams('overlay=nowhere'), ids).overlay, null, 'an id the site lacks reads as off');
  assert.equal(overlayFromHash(new URLSearchParams('overlay=off')).overlay, null);
  assert.equal(overlayFromHash(new URLSearchParams('overlay=../etc')).overlay, null);
  assert.equal(overlayFromHash(new URLSearchParams('overlayopacity=2')).overlayOpacity, 0.6, 'out of range falls back');
  assert.ok(sameSheet({ lon: -5.18, lat: 9.418, scale: 0.10464, turn: 12.5 }, { lon: -5.1801, lat: 9.4181, scale: 0.104641, turn: 12.51 }), 'the same to the hash\'s rounding');
  assert.ok(!sameSheet(moved.sheet, null));
  assert.equal(sheetText({ lon: 1, lat: 2, scale: 0.1, turn: 0 }), '1.000,2.000,0.10000,0.0');
});

// The sheet: one similarity for the whole scan. Its own placement comes from the chart's drawn parallels where it has
// them (Juan de la Cosa's tropic and equator), else is level, its scale the geometric mean of the first and last pieces',
// its centre midway between where those fits put the scan's centre; the snaps are the pieces' fits.
test('each chart\'s sheet and snaps in overlays.json are made from its pieces, or its parallels', () => {
  for (const o of overlays) {
    const { sheet, snaps } = sheetPlacements(o.pieces.map((p) => [p.x0, p.x1, p.fit]), o.snaps.map((s) => s.label), o.width, o.height, o.parallels ?? null);
    for (const k of ['lon', 'lat', 'scale', 'turn']) assert.ok(Math.abs(sheet[k] - o.sheet[k]) < 1e-9, `${o.id} ${k}`);
    assert.equal(snaps.length, o.snaps.length);
    snaps.forEach((s, i) => { assert.equal(s.label, o.snaps[i].label); for (const k of ['lon', 'lat', 'scale', 'turn']) assert.ok(Math.abs(s[k] - o.snaps[i][k]) < 1e-9, `${o.id} ${s.label} ${k}`); });
  }
  const cosa = overlays.find((o) => o.id === 'de-la-cosa');
  assert.deepEqual(cosa.snaps.map((s) => s.label), ['New World', 'Atlantic', 'Europe']);
  assert.deepEqual(cosa.parallels.map((l) => l.lat), [23.44, 0], 'the Tropic of Cancer above the equator');
  assert.ok(cosa.sheet.scale > 0.11 && cosa.sheet.scale < 0.125, `between the east and west fits: ${cosa.sheet.scale}`);
  assert.ok(Math.abs(cosa.sheet.turn + 2.2) < 0.3, `the lines tilt about 2 degrees down to the east: ${cosa.sheet.turn}`);
  // at the chart's own placement each drawn parallel lies level on the page, at its latitude's page y, in Mercator
  const proj = viewProjection({ lon: cosa.sheet.lon, lat: cosa.sheet.lat, zoom: 2 }), m = sheetTransform(cosa, proj, cosa.sheet), s = cosa.scale;
  for (const l of cosa.parallels) {
    const ys = [l.from, l.to].map(([x, y]) => m[1] * (x / s) + m[3] * (y / s) + m[5]), want = proj.project(0, l.lat)[1];
    assert.ok(Math.abs(ys[0] - ys[1]) < 1.5, `${l.lat}: level, ${ys}`);
    assert.ok(Math.abs((ys[0] + ys[1]) / 2 - want) < 1.5, `${l.lat}: at its page y ${want}, not ${ys}`);
  }
  // the Carta Marina, without parallels: level at the mean of its fits
  const carta2 = overlays.find((o) => o.id === 'carta-marina'), [w2, b2] = carta2.pieces.map((p) => p.fit);
  assert.equal(carta2.sheet.turn, 0);
  assert.ok(Math.abs(carta2.sheet.scale - Math.sqrt(Math.hypot(w2.a, w2.b) * Math.hypot(b2.a, b2.b))) < 1e-12);
  assert.deepEqual(catalan.snaps.map((s) => s.label), ['Atlantic', 'Mali', 'Italy', 'Black Sea', 'Persia', 'Central Asia', 'India', 'Cathay'], 'a snap per page');
  assert.equal(catalan.sheet.turn, 0, 'level, at the mean of the first and last pages\' fits');
});

// sheetOf: the turn is clockwise on the page, so a fit whose b > 0 (the x axis tilting north going east) turns anticlockwise.
test('sheetOf reads a similarity\'s centre, scale and turn, the turn clockwise on the page', () => {
  const s = sheetOf({ a: 0.01, b: 0.01, tx: 0, ty: 0 }, 200, 100);
  assert.ok(Math.abs(s.scale - Math.hypot(0.01, 0.01)) < 1e-12);
  assert.equal(s.turn.toFixed(6), '-45.000000');
  assert.deepEqual([s.lon, s.lat].map((v) => v.toFixed(6)), applyFit({ a: 0.01, b: 0.01, tx: 0, ty: 0 }, 100, 50).map((v) => v.toFixed(6)));
});

// In Mercator, drawn through a snap (a piece's fit applied to the whole scan), the sheet's corners land where the fit and
// the projection put them, and a point of the scan sits where applyFit says.
test('in Mercator the sheet drawn at a snap lands every scan px where that fit and the projection put it', () => {
  const cosa = overlays.find((o) => o.id === 'de-la-cosa'), proj = viewProjection({ lon: -25, lat: 22, zoom: 2 });
  cosa.snaps.forEach((snap, i) => {
    const fit = cosa.pieces[i].fit, m = sheetTransform(cosa, proj, snap), s = cosa.scale;
    for (const [x, y] of [[0, 0], [cosa.width, 0], [cosa.width, cosa.height], [0, cosa.height], [880, 500], [1500, 300]]) {
      const want = proj.project(...applyFit(fit, x, y)), got = [m[0] * (x / s) + m[2] * (y / s) + m[4], m[1] * (x / s) + m[3] * (y / s) + m[5]];
      assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) < 0.05, `${snap.label} at ${x},${y}: ${got} vs ${want}`);
    }
  });
  // the corners, hit testing and the frame agree with the transform
  const corners = sheetCorners(cosa, proj, cosa.sheet), [cx, cy] = proj.project(cosa.sheet.lon, cosa.sheet.lat);
  assert.ok(onSheet(cosa, proj, cosa.sheet, cx, cy) && !onSheet(cosa, proj, cosa.sheet, corners[0][0] - 5, corners[0][1] - 5));
  const level = { ...cosa.sheet, turn: 0 }, lc = sheetCorners(cosa, proj, level), f = sheetFrame(cosa, level), tl = proj.project(f.lonMin, f.latMax), br = proj.project(f.lonMax, f.latMin);
  assert.ok(Math.hypot(tl[0] - lc[0][0], tl[1] - lc[0][1]) < 0.05 && Math.hypot(br[0] - lc[2][0], br[1] - lc[2][1]) < 0.05, 'level: the frame is the corners');
  // a turned sheet's frame holds all four corners
  const turned = { ...cosa.sheet, turn: 30 }, tc = sheetCorners(cosa, proj, turned), tf = sheetFrame(cosa, turned);
  const [x0, y0] = proj.project(tf.lonMin, tf.latMax), [x1, y1] = proj.project(tf.lonMax, tf.latMin);
  for (const [x, y] of tc) assert.ok(x >= x0 - 0.05 && x <= x1 + 0.05 && y >= y0 - 0.05 && y <= y1 + 0.05, `corner ${x},${y} in ${x0},${y0}..${x1},${y1}`);
  assert.ok(Math.abs(x1 - x0 - (Math.max(...tc.map((c) => c[0])) - Math.min(...tc.map((c) => c[0])))) < 0.05, 'and is tight');
});

// The view that frames the whole sheet contains it, never crops it: at that view every corner is inside the page,
// and the sheet keeps its page size and turn in any projection, its centre pinned.
test('sheetView frames the sheet inside the page, and the sheet keeps its size and turn across projections', () => {
  const cosa = overlays.find((o) => o.id === 'de-la-cosa'), v = sheetView(cosa, cosa.sheet, { w: 1600, h: 1000, pad: 0.08 });
  const corners = sheetCorners(cosa, viewProjection(v), cosa.sheet);
  for (const [x, y] of corners) assert.ok(x >= 0 && x <= 1600 && y >= 0 && y <= 1000, `${x},${y}`);
  const span = Math.max(...corners.map((c) => c[0])) - Math.min(...corners.map((c) => c[0]));
  assert.ok(span > 1600 / 1.16 - 1 && span < 1600 / 1.16 + 1, `8% clear on each side: ${span}`);
  const merc = sheetTransform(cosa, viewProjection(v), cosa.sheet), ortho = sheetTransform(cosa, viewProjection({ ...v, projection: 'orthographic' }), cosa.sheet);
  for (const i of [0, 1, 2, 3]) assert.ok(Math.abs(merc[i] - ortho[i]) < 1e-9, 'the same size and turn');
  assert.ok(Math.abs(merc[4] - ortho[4]) < 1 && Math.abs(merc[5] - ortho[5]) < 1, 'the centre at the view\'s centre in both');
});

// loadOverlay composes the scan with its mask: the paper round the skin is transparent, the skin is not. drawSheet draws it
// through one transform, opaque.
test('a masked overlay loads with the paper transparent, and the sheet is drawn once, opaque, through its transform', async () => {
  const env = { readJSON: async () => ({ overlays }), loadImage: (p) => loadImage(new URL(p, ROOT)), createCanvas };
  const o = await loadOverlay('de-la-cosa', env);
  assert.ok(o?.img && o.mask && o.sheet, 'loaded with its mask and sheet');
  const px = (x, y) => o.img.getContext('2d').getImageData(x, y, 1, 1).data;
  assert.equal(px(10, 10)[3], 0, 'the paper at the corner is transparent');
  assert.equal(px(Math.round(o.img.width / 2), Math.round(o.img.height / 2))[3], 255, 'the skin at the centre is opaque');
  const calls = [];
  const g = new Proxy({}, { get: (_, k) => (k === 'globalAlpha' || k === 'globalCompositeOperation' ? undefined : (...args) => calls.push([k, args])), set: (_, k, v) => (calls.push([k, v]), true) });
  drawSheet(g, o, viewProjection({ lon: -25, lat: 22, zoom: 2 }), o.sheet);
  assert.deepEqual(calls.filter((c) => c[0] === 'drawImage').length, 1);
  assert.deepEqual(calls.find((c) => c[0] === 'globalAlpha'), ['globalAlpha', 1]);
  assert.equal(calls.filter((c) => c[0] === 'transform').length, 1);
});

// redLines: two thin red lines drawn across a canvas, tilted, among red specks, are found with their tilt.
test('redLines finds the two long red lines across a scan, top first, and their tilt', () => {
  const w = 400, h = 200, c = createCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#e8d8b0'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c03020'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(20, 60); g.lineTo(380, 74); g.stroke(); // down 14 over 360: 2.2 degrees
  g.beginPath(); g.moveTo(30, 140); g.lineTo(370, 153); g.stroke();
  g.fillStyle = '#c03020'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, (i * 53) % h, 3, 3); // specks
  const [top, bottom] = redLines(g, w, h);
  assert.ok(Math.abs(top.from[1] - 60) < 3 && Math.abs(top.to[1] - 74) < 3, `top ${JSON.stringify(top)}`);
  assert.ok(Math.abs(bottom.from[1] - 140) < 3 && Math.abs(bottom.to[1] - 153) < 3, `bottom ${JSON.stringify(bottom)}`);
  const one = createCanvas(w, h), g1 = one.getContext('2d');
  g1.fillStyle = '#e8d8b0'; g1.fillRect(0, 0, w, h); g1.strokeStyle = '#c03020'; g1.lineWidth = 2; g1.beginPath(); g1.moveTo(20, 60); g1.lineTo(380, 74); g1.stroke();
  assert.throws(() => redLines(g1, w, h, 2), /fewer than 2/);
});

// paperMask: a flood fill from the border through light grey; a pale but tinted patch inside the skin is kept, and so is
// a light patch the paper does not reach.
test('paperMask keys the paper from the border and keeps the skin, tinted or enclosed', () => {
  const w = 40, h = 30, c = createCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#eeeeee'; g.fillRect(0, 0, w, h); // paper
  g.fillStyle = '#c8a060'; g.fillRect(8, 6, 24, 18); // the skin
  g.fillStyle = '#f0e0c0'; g.fillRect(14, 10, 4, 4); // a pale, tinted sea inside it
  g.fillStyle = '#eeeeee'; g.fillRect(22, 14, 3, 3); // a light grey patch the paper never reaches
  const { mask, keyed } = paperMask(g, w, h);
  const at = (x, y) => mask.data[(y * w + x) * 4 + 3];
  assert.equal(at(2, 2), 0, 'paper'); assert.equal(at(20, 8), 255, 'skin'); assert.equal(at(15, 11), 255, 'tinted sea'); assert.equal(at(23, 15), 255, 'enclosed patch');
  assert.equal(at(8, 15), 128, 'the skin\'s edge px is feathered');
  assert.ok(keyed > 0.5 && keyed < 0.7, `${keyed}`);
});

// The Catalan Atlas is one sheet of eight panels, BnF sheets 5 to 12, each page cropped to its parchment and butted to the
// last: each panel at its offset, a piece per page over exactly its panel, each piece the fit of its page's landmarks.
test('the Catalan Atlas is eight panels butted west to east, a piece and a snap per page', () => {
  const md = readFileSync(new URL('docs/atlas/ornaments.md', ROOT), 'utf8'), at = pageOffsets(CATALAN_PAGES);
  assert.equal(catalan.panels.length, 8);
  assert.equal(catalan.file, undefined, 'no one scan file: its panels');
  catalan.panels.forEach((p, i) => {
    assert.equal(p.x, at[i], `sheet ${CATALAN_PAGES[i].n} at its offset`);
    assert.equal(p.width, CATALAN_PAGES[i].x1 - CATALAN_PAGES[i].x0);
    assert.equal(p.x + p.width, catalan.panels[i + 1]?.x ?? catalan.width, 'butted to the next, the last at the sheet\'s edge');
    assert.deepEqual([catalan.pieces[i].x0, catalan.pieces[i].x1], [p.x, p.x + p.width], 'its piece is the page');
    assert.match(p.file, new RegExp(`^catalan-atlas-${CATALAN_PAGES[i].n}\\.jpg$`));
  });
  assert.equal(catalan.height, Math.max(...catalan.panels.map((p) => p.height)));
  catalanPieces(md).forEach(([, , fit], i) => { for (const k of ['a', 'b', 'tx', 'ty']) assert.ok(Math.abs(fit[k] - catalan.pieces[i].fit[k]) < 1e-9, `sheet ${CATALAN_PAGES[i].n} ${k}`); });
  // west to east: each page's fit puts its middle east of the last page's
  const mids = catalan.pieces.map((p) => applyFit(p.fit, (p.x0 + p.x1) / 2, catalan.height / 2)[0]);
  mids.slice(1).forEach((lon, i) => assert.ok(lon > mids[i], `sheet ${CATALAN_PAGES[i + 1].n} east of sheet ${CATALAN_PAGES[i].n}: ${mids}`));
  const frame = sheetFrame(catalan, catalan.sheet);
  assert.ok(frame.lonMin < -15 && frame.lonMax > 110, `the atlas from the Atlantic to Cathay: ${frame.lonMin} to ${frame.lonMax}`);
});

// A chart with panels draws each panel that has arrived at its offset, through the sheet's one transform; one without
// draws its one image as before (the de la Cosa test above). The warped pieces draw each panel's part inside the piece.
test('drawSheet and drawOverlay draw each panel that has arrived at its offset, and skip one still loading', () => {
  const img = (w, h) => ({ width: w, height: h });
  const paged = { id: 'paged', scale: 4, width: 300, height: 80, sheet: { lon: 0, lat: 0, scale: 0.1, turn: 0 },
    panels: [{ x: 0, width: 100, height: 80, img: img(25, 20) }, { x: 100, width: 100, height: 72, img: null }, { x: 200, width: 100, height: 80, img: img(25, 20) }],
    pieces: [{ x0: 0, x1: 100, fit: { a: 0.1, b: 0, tx: 0, ty: 0 } }, { x0: 100, x1: 200, fit: { a: 0.1, b: 0, tx: 0, ty: 0 } }, { x0: 200, x1: 300, fit: { a: 0.1, b: 0, tx: 0, ty: 0 } }] };
  const record = () => { const calls = []; return [calls, new Proxy({}, { get: (_, k) => (k === 'globalAlpha' || k === 'globalCompositeOperation' ? undefined : (...a) => calls.push([k, a])), set: () => true })]; };
  const proj = viewProjection({ lon: 15, lat: -4, zoom: 4 });
  const [sheetCalls, g1] = record();
  drawSheet(g1, paged, proj, paged.sheet);
  const drawn = sheetCalls.filter((c) => c[0] === 'drawImage');
  assert.equal(drawn.length, 2, 'the panel still loading is skipped');
  assert.deepEqual(drawn.map((c) => c[1].slice(1)), [[0, 0, 25, 20], [50, 0, 25, 20]], 'each at its offset in drawn px, at its own size');
  assert.equal(sheetCalls.filter((c) => c[0] === 'transform').length, 1, 'one transform for the whole sheet');
  const [pieceCalls, g2] = record();
  drawOverlay(g2, paged, proj, 1, { w: 1e6, h: 1e6 });
  const warped = pieceCalls.filter((c) => c[0] === 'drawImage').map((c) => c[1].slice(1));
  assert.deepEqual(warped, [[0, 0, 25, 20, 0, 0, 25, 20], [0, 0, 25, 20, 50, 0, 25, 20]], 'each piece draws the panel under it');
});

// loadOverlay of a chart with panels: on the page (env.onPanel) it comes back at once and each panel lands as its file
// arrives, onPanel called for each; headless (no onPanel) it comes back with every panel landed.
test('a chart of panels loads page by page on the page, and whole headless', async () => {
  const list = { overlays: [{ id: 'paged-lazy', panels: [{ file: 'a.jpg', x: 0, width: 4, height: 4 }, { file: 'b.jpg', x: 4, width: 4, height: 4 }] },
    { id: 'paged-whole', panels: [{ file: 'a.jpg', x: 0, width: 4, height: 4 }, { file: 'missing.jpg', x: 4, width: 4, height: 4 }] }] };
  let release; const gate = new Promise((ok) => { release = ok; });
  const landed = [];
  const lazy = await loadOverlay('paged-lazy', { readJSON: async () => list, loadImage: async (p) => { await gate; return { width: 1, height: 1, p }; }, onPanel: (id) => landed.push(id) });
  assert.deepEqual(lazy.panels.map((p) => p.img), [null, null], 'back before any panel lands');
  release(); await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(lazy.panels.map((p) => p.img?.p), ['packs/overlays/a.jpg', 'packs/overlays/b.jpg']);
  assert.deepEqual(landed, ['paged-lazy', 'paged-lazy']);
  const whole = await loadOverlay('paged-whole', { readJSON: async () => list, loadImage: async (p) => { if (p.includes('missing')) throw new Error('no'); return { width: 1, height: 1, p }; } });
  assert.deepEqual(whole.panels.map((p) => p.img?.p ?? null), ['packs/overlays/a.jpg', null], 'every panel landed, a failed one left empty');
});

// The 1959 copy is its own chart, its rights the CC BY 3.0 attribution the Commons page gives.
test('the 1959 copy of the Mediterranean is its own chart, titled as a copy, with its attribution', () => {
  const copy = overlays.find((o) => o.id === 'catalan-atlas-1959-copy');
  assert.match(copy.title, /copy of 1959/);
  assert.match(copy.licence, /^CC BY 3\.0;.*Library of Congress, Geography and Map Division/);
  assert.equal(copy.sheet.turn, 0, 'laid level');
});
