import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTE_SETS, noteMarks } from '../scripts/notes.mjs';
import { viewProjection } from '../scripts/scene.mjs';

const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const overlay = (id) => overlays.find((o) => o.id === id);
const CHARTS = ['carta-marina', 'catalan-atlas'];
const VIEWS = { 'carta-marina': { lon: 19.7, lat: 61.7 }, 'catalan-atlas': { lon: -14, lat: 40 } };
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
