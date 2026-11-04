// A chart's notes announce themselves (notePulse, NOTE_PULSE) and points of interest close together group under one
// badge (groupMarks, dateSpan): docs/spec/design.md, "A chart's notes get their moment, then leave the art alone" and
// "Points of interest close together". The drawing is the page's (public/page.js drawLayer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVoyage } from '../scripts/voyages.mjs';
import { readJSON } from '../scripts/check-voyages.mjs';
import { readDate } from '../scripts/notes.mjs';
import { notePulse, NOTE_PULSE, drawNoteRing, groupMarks, dateSpan, noteCount, viewProjection, voyageMarks, voyageView, DEFAULT_VIEW } from '../scripts/scene.mjs';

test('the pulse: three rings over about four seconds, the last fading as it goes, then nothing drawn', () => {
  const { ms, rings } = NOTE_PULSE, each = ms / rings;
  assert.equal(rings, 3);
  assert.ok(ms >= 3500 && ms <= 4500, 'about four seconds');
  assert.deepEqual(notePulse(-5), notePulse(0), 'a frame stamped just before the start is the start');
  assert.equal(notePulse(0).alpha, 1);
  assert.equal(notePulse(0).ring, 0);
  for (let i = 0; i < rings; i++) assert.ok(Math.abs(notePulse(i * each + each / 2).ring - 0.5) < 1e-9, `ring ${i + 1} half swollen half way through its turn`);
  assert.equal(notePulse(each * (rings - 1) - 1).alpha, 1, 'whole until the last ring');
  assert.ok(Math.abs(notePulse(each * (rings - 0.5)).alpha - 0.5) < 1e-9, 'fading with the last ring');
  assert.equal(notePulse(ms), null, 'over: nothing stays drawn on the scan');
});

test('the pulse is rings alone: no dot or mark is drawn at any moment of it', () => {
  const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = (...a) => { (o.calls ??= []).push([k, a]); })), set: (o, k, v) => { o[k] = v; return true; } });
  for (const t of [0, 500, 1400, 2000, 3000, 3900]) {
    g.calls = [];
    drawNoteRing(g, { x: 100, y: 100 }, notePulse(t).ring, notePulse(t).alpha);
    assert.ok(!g.calls.some(([k]) => k === 'fill'), `nothing filled at ${t} ms`);
  }
});

test('the pulse with reduced motion: one still ring, fading steadily, then nothing', () => {
  const { ms, still } = NOTE_PULSE;
  assert.deepEqual(notePulse(0, true), { alpha: 1, ring: still });
  assert.ok(Math.abs(notePulse(ms / 2, true).alpha - 0.5) < 1e-9);
  assert.equal(notePulse(ms, true), null);
});

test('a chart counts its notes for its Notes chip; a chart with none has no chip', () => {
  assert.ok(noteCount('carta-marina') > 0);
  assert.equal(noteCount('no-such-chart'), 0);
});

test('marks within reach chain into one group, the one nearest its centre leading; the rest stand alone', () => {
  const ms = [{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 30, y: 0 }, { x: 200, y: 0 }];
  const groups = groupMarks(ms, 22);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].marks, ms.slice(0, 3));
  assert.equal(groups[0].lead, ms[1]);
  assert.deepEqual(groups[1].marks, [ms[3]]);
  assert.deepEqual(groupMarks([], 22), []);
});

test('Mactan and Cebu share a badge at the zoom that frames Magellan, and part when zoomed in on them', async () => {
  const magellan = await readVoyage('magellan', readJSON);
  const view = voyageView(magellan, DEFAULT_VIEW, undefined, true);
  const near = (v) => {
    const marks = voyageMarks(magellan, viewProjection(v), { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 });
    return groupMarks(marks, 22).find((g) => g.marks.some((m) => /Mactan/.test(m.tile.title)));
  };
  const framed = near(view);
  assert.ok(framed.marks.some((m) => /Cebu/.test(m.tile.title)), 'Cebu in Mactan\'s group at the voyage\'s frame');
  const close = near({ ...view, lon: 123.95, lat: 10.3, zoom: 12 });
  assert.equal(close.marks.length, 1, 'zoomed in, the badge goes');
});

test('a group\'s span of dates, as its tile heads it', () => {
  assert.equal(dateSpan(['27 Apr 1521', '1 May 1521']), 'Apr–May 1521');
  assert.equal(dateSpan(['27 Apr 1521', '28 Apr 1521']), 'Apr 1521');
  assert.equal(dateSpan(['8 Nov – 21 Dec 1521']), 'Nov–Dec 1521');
  assert.equal(dateSpan(['Sep 1519', '6 Mar 1521']), '1519–1521');
  assert.equal(dateSpan(['c. 1000 BC']), '1000 BC');
  assert.equal(dateSpan(['1492', '12 Oct 1492']), '1492');
  assert.equal(dateSpan(['undated']), '');
  // a range across the new year: each month takes the year written after it
  assert.deepEqual(readDate('28 Dec 1520 – 3 Jan 1521'), [{ y: 1520, m: 11 }, { y: 1521, m: 0 }]);
  assert.equal(dateSpan(['28 Dec 1520 – 3 Jan 1521']), '1520–1521');
  assert.equal(dateSpan(['28 Dec 1520 – 3 Jan 1521', '5 Jan 1521']), '1520–1521');
  assert.deepEqual(readDate('Nov – 29 Nov 1519'), [{ y: 1519, m: 10 }, { y: 1519, m: 10 }]);
  // years of one or two digits with an era, before or after
  assert.deepEqual(readDate('AD 79'), [{ y: 79, m: null }]);
  assert.deepEqual(readDate('79 CE'), [{ y: 79, m: null }]);
  assert.deepEqual(readDate('44 BC'), [{ y: -44, m: null }]);
  assert.deepEqual(readDate('15 Mar 44 BC'), [{ y: -44, m: 2 }]);
  assert.deepEqual(readDate('27 Apr'), []);
  assert.equal(dateSpan([]), '');
});
