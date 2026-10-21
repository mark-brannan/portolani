import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanPlace, loadOverlay } from '../scripts/overlays.mjs';
import { viewProjection, noteMarks, W, H } from '../scripts/scene.mjs';

// The notes on the Carta Marina (data/notes/carta-marina.json, docs/notes/README.md): offline, in milliseconds.
const ROOT = new URL('..', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const { notes } = read('data/notes/carta-marina.json');
const carta = read('packs/overlays/overlays.json').overlays.find((o) => o.id === 'carta-marina');
const km = ([a, b], [c, d]) => {
  const r = Math.PI / 180, h = Math.sin(((d - b) * r) / 2) ** 2 + Math.cos(b * r) * Math.cos(d * r) * Math.sin(((c - a) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

test('the file parses and every note has its fields', () => {
  assert.equal(notes.length, 10);
  assert.equal(new Set(notes.map((n) => n.id)).size, notes.length, 'ids are unique');
  for (const n of notes) {
    for (const k of ['id', 'title', 'date', 'drew', 'was', 'checked']) assert.ok(typeof n[k] === 'string' && n[k].trim(), `${n.id}: ${k}`);
    for (const k of ['title', 'url', 'licence']) assert.ok(typeof n.source?.[k] === 'string' && n.source[k].trim(), `${n.id}: source.${k}`);
    assert.match(n.source.url, /^https:\/\//, `${n.id}: source.url`);
    assert.ok(Array.isArray(n.at?.px) && n.at.px.length === 2, `${n.id}: at.px`);
    assert.ok(n.at.lonlat === null || (Array.isArray(n.at.lonlat) && n.at.lonlat.length === 2), `${n.id}: at.lonlat is [lon, lat] or null`);
  }
});

test('every scan px lies inside the scan', () => {
  for (const { id, at: { px: [x, y] } } of notes) assert.ok(x >= 0 && x <= carta.width && y >= 0 && y <= carta.height, `${id}: ${x}, ${y} in ${carta.width} x ${carta.height}`);
});

// The chart's extent: the box round the scan's corners, each taken through its piece's fit
test('every real place is inside the chart, or null for an island that is not there', () => {
  const corners = carta.pieces.flatMap((p) => [[p.x0, 0], [p.x1, 0], [p.x0, carta.height], [p.x1, carta.height]]).map((c) => scanPlace(carta, c));
  const lons = corners.map((c) => c[0]), lats = corners.map((c) => c[1]);
  for (const { id, at: { lonlat } } of notes) {
    if (lonlat === null) continue;
    const [lon, lat] = lonlat;
    assert.ok(lon >= Math.min(...lons) && lon <= Math.max(...lons) && lat >= Math.min(...lats) && lat <= Math.max(...lats), `${id}: ${lon}, ${lat}`);
  }
  assert.deepEqual(notes.filter((n) => n.at.lonlat === null).map((n) => n.id), ['tile', 'hvitsark']);
});

// A mark sits on the figure: its scan px through the fit, then the projection. The real place is another
// matter: the chart is out by hundreds of km in the north (docs/notes/README.md lists each note's), so the
// test holds the mark to its figure and the real place only to the sheet, to catch a swapped or mistyped anchor.
test('a mark lands within 60 km of its figure through the fit, and its real place within 1,300 km', () => {
  const proj = viewProjection({ lon: 15, lat: 62, zoom: 4 }), rect = { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 };
  const marks = noteMarks(notes, carta, proj, rect);
  assert.equal(marks.length, notes.length);
  notes.forEach((n, i) => {
    const m = marks[i], at = proj.invert(m.x, m.y), fig = scanPlace(carta, n.at.px);
    assert.ok(km(at, fig) < 60, `${n.id}: mark ${km(at, fig).toFixed(0)} km from its figure`);
    if (n.at.lonlat) assert.ok(km(fig, n.at.lonlat) < 1300, `${n.id}: figure ${km(fig, n.at.lonlat).toFixed(0)} km from the real place`);
    assert.equal(m.tile.title, n.title);
    assert.equal(m.tile.text, `${n.drew}\n\nToday: ${n.was}`);
    assert.equal(m.tile.sourceUrl, n.source.url);
  });
  assert.deepEqual(noteMarks(notes, null, proj, rect), [], 'no overlay, no marks');
  assert.ok(noteMarks(notes, carta, proj, { x0: 0, y0: 0, x1: W, y1: H }).length < notes.length, 'a mark out of view is left out');
});

test('the overlay loads with its notes, and without them when the file is missing', async () => {
  const env = (notesFile) => ({
    readJSON: async (p) => (p === 'packs/overlays/overlays.json' ? { overlays: [{ ...carta, id: notesFile }] } : p.startsWith('data/notes/') && notesFile === 'carta-marina' ? read(p) : Promise.reject(new Error(`${p}: 404`))),
    loadImage: async () => ({ width: 2508, height: 1858 }),
  });
  assert.equal((await loadOverlay('carta-marina', env('carta-marina'))).notes.length, 10);
  assert.deepEqual((await loadOverlay('no-notes', env('no-notes'))).notes, []);
});
