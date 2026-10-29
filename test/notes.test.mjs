import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTE_SETS, noteMarks } from '../scripts/notes.mjs';
import { viewProjection } from '../scripts/scene.mjs';

const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const overlay = (id) => overlays.find((o) => o.id === id);
const CHARTS = ['carta-marina', 'catalan-atlas', 'de-la-cosa', 'aguiar', 'agnese-world', 'dourado-atlantic'];
const VIEWS = Object.fromEntries(overlays.map((o) => [o.id, { lon: o.sheet.lon, lat: o.sheet.lat }])); // each sheet's own centre
const rect = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };

test('each laid chart has its notes, each of the shape in #248, with a source', () => {
  assert.deepEqual(Object.keys(NOTE_SETS).sort(), [...CHARTS].sort());
  const ids = Object.values(NOTE_SETS).flatMap((s) => s.notes.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, 'ids unique across charts');
  for (const [id, { scan, notes }] of Object.entries(NOTE_SETS)) {
    assert.ok(notes.length > 0, `${id} has notes`);
    const o = overlay(id);
    assert.ok(o, `${id} is in overlays.json`);
    assert.deepEqual([scan.w, scan.h], [o.width, o.height], `${id} scan size`);
    for (const n of notes) {
      for (const k of ['id', 'title', 'drawn', 'real']) assert.ok(typeof n[k] === 'string' && n[k].length, `${n.id} ${k}`);
      assert.ok(n.source.label && /^https:\/\//.test(n.source.url), `${n.id} source`);
      const [x, y] = n.at.px;
      assert.ok(x >= 0 && x <= scan.w && y >= 0 && y <= scan.h, `${n.id} px inside the scan`);
      if (n.at.lonlat !== null) {
        const [lon, lat] = n.at.lonlat;
        assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 90, `${n.id} lonlat in range`);
      }
    }
  }
});

test('a chart\'s marks show while it is laid and not otherwise', () => {
  assert.equal(noteMarks(null, viewProjection({ ...VIEWS['carta-marina'], zoom: 3, projection: 'mercator' }), rect).length, 0);
  for (const id of Object.keys(NOTE_SETS)) {
    const proj = viewProjection({ ...VIEWS[id], zoom: 3, projection: 'mercator' });
    assert.equal(noteMarks({ ...overlay(id), id: 'other' }, proj, rect).length, 0, id);
    const marks = noteMarks(overlay(id), proj, rect);
    assert.equal(marks.length, NOTE_SETS[id].notes.length, id);
    assert.ok(marks.every((m) => m.tile.drawn && m.tile.real && m.tile.link), id);
  }
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
  assert.equal(noteMarks({ ...o, mode: 'pieces' }, proj, rect).length, NOTE_SETS.aguiar.notes.length, 'the warped pieces still carry the marks');
});

// The sheet is opaque, so a second draw after the marks hides them all (a merge left one in, #270)
test('in drawScene and drawAnchored the sheet is drawn once, before the notes\' marks', () => {
  const src = readFileSync(new URL('../scripts/scene.mjs', import.meta.url), 'utf8');
  for (const fn of ['drawScene', 'drawAnchored']) {
    const body = src.slice(src.indexOf(`\nfunction ${fn}(`)).split(/\n}\n/)[0];
    const sheets = [...body.matchAll(/drawSheet\(/g)].map((m) => m.index), notes = body.indexOf('drawNotes(');
    assert.equal(sheets.length, 1, `${fn} draws the sheet once`);
    assert.ok(notes > sheets[0], `${fn} draws the marks over the sheet`);
  }
});
