import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTES, NOTES_SCAN, NOTES_OVERLAY, noteMarks } from '../scripts/notes.mjs';
import { viewProjection } from '../scripts/scene.mjs';

const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const carta = overlays.find((o) => o.id === NOTES_OVERLAY);

test('there are ten notes, each of the shape in #248', () => {
  assert.equal(NOTES.length, 10);
  assert.equal(new Set(NOTES.map((n) => n.id)).size, 10);
  for (const n of NOTES) {
    for (const k of ['id', 'title', 'drawn', 'real']) assert.ok(typeof n[k] === 'string' && n[k].length, `${n.id} ${k}`);
    assert.ok(n.source.label && /^https:\/\//.test(n.source.url), `${n.id} source`);
    const [x, y] = n.at.px;
    assert.ok(x >= 0 && x <= NOTES_SCAN.w && y >= 0 && y <= NOTES_SCAN.h, `${n.id} px inside the scan`);
    if (n.at.lonlat !== null) {
      const [lon, lat] = n.at.lonlat;
      assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 90, `${n.id} lonlat in range`);
    }
  }
});

test('the marks show with the Carta Marina laid and not otherwise', () => {
  const proj = viewProjection({ lon: 19.7, lat: 61.7, zoom: 3, projection: 'mercator' });
  const rect = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };
  assert.equal(noteMarks(null, proj, rect).length, 0);
  assert.equal(noteMarks({ ...carta, id: 'other' }, proj, rect).length, 0);
  const marks = noteMarks(carta, proj, rect);
  assert.equal(marks.length, 10);
  assert.ok(marks.every((m) => m.tile.drawn && m.tile.real && m.tile.link));
});
