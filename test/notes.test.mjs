import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTE_SETS, CATALAN_PAGE_X, noteMarks, pickMark } from '../scripts/notes.mjs';
import { viewProjection } from '../scripts/scene.mjs';

const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const overlay = (id) => overlays.find((o) => o.id === id);
const CHARTS = ['carta-marina', 'catalan-atlas', 'catalan-atlas-1959-copy', 'de-la-cosa', 'aguiar', 'agnese-world', 'dourado-atlantic'];
const VIEWS = Object.fromEntries(overlays.map((o) => [o.id, { lon: o.sheet.lon, lat: o.sheet.lat }])); // each sheet's own centre
const rect = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };
const sizeOk = (s) => (Array.isArray(s) ? s.length === 2 && s.every((v) => Number.isFinite(v) && v > 0) : Number.isFinite(s) && s > 0);

test('each laid chart has its notes, each with a title, a place on the scan and a hit box; copy, where there is any, has a source', () => {
  assert.deepEqual(Object.keys(NOTE_SETS).sort(), [...CHARTS].sort());
  const ids = Object.values(NOTE_SETS).flatMap((s) => s.notes.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, 'ids unique across charts');
  for (const [id, { scan, size, notes }] of Object.entries(NOTE_SETS)) {
    assert.ok(notes.length > 0, `${id} has notes`);
    const o = overlay(id);
    assert.ok(o, `${id} is in overlays.json`);
    assert.deepEqual([scan.w, scan.h], [o.width, o.height], `${id} scan size`);
    for (const n of notes) {
      for (const k of ['id', 'title']) assert.ok(typeof n[k] === 'string' && n[k].length, `${n.id} ${k}`);
      for (const k of ['drawn', 'real']) assert.equal(typeof n[k], 'string', `${n.id} ${k} is text, empty until it has copy`);
      if (n.real || n.source) assert.ok(n.source?.label && /^https:\/\//.test(n.source.url), `${n.id} source`);
      const [x, y] = n.at.px;
      assert.ok(x >= 0 && x <= scan.w && y >= 0 && y <= scan.h, `${n.id} px inside the scan`);
      assert.ok(sizeOk(n.size ?? size), `${n.id} has a hit box`);
      if (n.up !== undefined) assert.ok(Number.isFinite(n.up) && n.up >= 0 && n.up < 360, `${n.id} up`);
      if (n.at.lonlat !== null) {
        const [lon, lat] = n.at.lonlat;
        assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 90, `${n.id} lonlat in range`);
      }
    }
  }
});

test('the Catalan Atlas: every note sizes its figure and says which way it faces, on the page it is drawn on', () => {
  const o = overlay('catalan-atlas');
  assert.deepEqual(CATALAN_PAGE_X, Object.fromEntries(o.panels.map((p) => [p.file.match(/-(\d+)\.jpg$/)[1], p.x - p.scanX])), 'page offsets as laid');
  for (const n of NOTE_SETS['catalan-atlas'].notes) {
    assert.ok(sizeOk(n.size) && Number.isFinite(n.up), `${n.id} size and up`);
    const half = Array.isArray(n.size) ? n.size[0] / 2 : n.size, [x] = n.at.px;
    const p = o.panels.find((q) => x >= q.x && x < q.x + q.width);
    assert.ok(p && x - half >= p.x - 300 && x + half <= p.x + p.width + 300, `${n.id} box on its page`);
  }
  for (const panel of o.panels) assert.ok(NOTE_SETS['catalan-atlas'].notes.some((n) => n.at.px[0] >= panel.x && n.at.px[0] < panel.x + panel.width), `${panel.file} has notes`);
});

test('a chart\'s marks show while it is laid and not otherwise; a bare title is a complete note', () => {
  assert.equal(noteMarks(null, viewProjection({ ...VIEWS['carta-marina'], zoom: 3, projection: 'mercator' }), rect).length, 0);
  for (const id of Object.keys(NOTE_SETS)) {
    const proj = viewProjection({ ...VIEWS[id], zoom: 3, projection: 'mercator' });
    assert.equal(noteMarks({ ...overlay(id), id: 'other' }, proj, rect).length, 0, id);
    const marks = noteMarks(overlay(id), proj, rect);
    assert.equal(marks.length, NOTE_SETS[id].notes.length, id);
    assert.ok(marks.every((m) => m.tile.note && m.tile.title && m.hit?.length >= 4 && m.area > 0), id);
    assert.ok(marks.filter((m) => m.tile.real).every((m) => m.tile.drawn && m.tile.link), id);
  }
  const bare = noteMarks(overlay('catalan-atlas'), viewProjection({ ...VIEWS['catalan-atlas'], zoom: 3, projection: 'mercator' }), rect).find((m) => m.tile.title === 'A palm tree');
  assert.deepEqual([bare.tile.drawn, bare.tile.real, bare.tile.link], ['', '', undefined]);
});

test('the marks ride on the sheet where it lies: dragged, turned or resized, each follows its figure', () => {
  const o = overlay('aguiar'), n = NOTE_SETS.aguiar.notes[0], proj = viewProjection({ lon: o.sheet.lon, lat: o.sheet.lat, zoom: 3, projection: 'mercator' });
  const at = (sheet) => noteMarks({ ...o, sheet }, proj, rect).find((m) => m.tile.title === n.title);
  const home = at(o.sheet), moved = at({ ...o.sheet, lon: o.sheet.lon + 10 });
  assert.ok(moved.x - home.x > 50 && Math.abs(moved.y - home.y) < 1e-6, 'moved east, the mark goes east with it');
  const turned = at({ ...o.sheet, turn: 90 }), [cx, cy] = proj.project(o.sheet.lon, o.sheet.lat);
  assert.ok(Math.abs(Math.hypot(turned.x - cx, turned.y - cy) - Math.hypot(home.x - cx, home.y - cy)) < 1e-6, 'turned, the mark keeps its distance from the centre');
  const big = at({ ...o.sheet, scale: o.sheet.scale * 2 });
  assert.ok(Math.abs((big.x - cx) - 2 * (home.x - cx)) < 1e-6, 'twice the scale, twice as far from the centre');
  assert.ok(Math.abs(big.area - 4 * home.area) / home.area < 1e-6, 'twice the scale, four times the hit box');
  assert.equal(noteMarks({ ...o, mode: 'pieces' }, proj, rect).length, NOTE_SETS.aguiar.notes.length, 'the warped pieces still carry the marks');
});

test('a click opens the figure it lands on: anywhere in its box, the smallest box where they nest, a small drawn mark first', () => {
  const o = overlay('catalan-atlas'), proj = viewProjection({ lon: o.sheet.lon, lat: o.sheet.lat, zoom: 5, projection: 'mercator' });
  const marks = noteMarks(o, proj, rect), musa = marks.find((m) => m.tile.title === 'Mansa Musa');
  const [[x0, y0], , [x1, y1]] = musa.hit, corner = [x0 + (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.1];
  assert.ok(Math.hypot(corner[0] - musa.x, corner[1] - musa.y) > 22, 'the corner is out of a pin\'s reach');
  assert.equal(pickMark(marks, corner, 22), musa, 'a click in the figure\'s corner opens it');
  const sea = marks.find((m) => m.tile.title === 'The Ocean Sea'), rose = marks.find((m) => m.tile.title === 'The first compass rose');
  assert.equal(pickMark(marks, [rose.x, rose.y], 22), rose, 'the rose, nested in the sea, wins');
  assert.equal(pickMark(marks, [sea.x + 1, sea.y + 1], 22).tile.title, pickMark(marks, [sea.x, sea.y], 22).tile.title);
  const pin = { x: musa.x + 5, y: musa.y, h: 20, tile: { title: 'a voyage\'s event' } };
  assert.equal(pickMark([...marks, pin], [musa.x, musa.y], 22), pin, 'a small drawn mark within reach wins over a box');
  assert.equal(pickMark(marks, [-1e5, -1e5], 22), null, 'nothing far from every figure');
});

// The sheet is opaque and drawn once; a second draw hid what lay on it (a merge left one in, #270)
test('in drawScene and drawAnchored the sheet is drawn once', () => {
  const src = readFileSync(new URL('../scripts/scene.mjs', import.meta.url), 'utf8');
  for (const fn of ['drawScene', 'drawAnchored']) {
    const body = src.slice(src.indexOf(`\nfunction ${fn}(`)).split(/\n}\n/)[0];
    assert.equal([...body.matchAll(/drawSheet\(/g)].length, 1, `${fn} draws the sheet once`);
  }
});
