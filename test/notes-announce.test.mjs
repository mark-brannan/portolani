// A chart's notes announce themselves (notePulse, NOTE_PULSE) and points of interest close together group under one
// badge (groupMarks, dateSpan): docs/spec/design.md, "A chart's notes get their moment, then leave the art alone" and
// "Points of interest close together". The drawing is the page's (public/page.js drawLayer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVoyage } from '../scripts/voyages.mjs';
import { readJSON } from '../scripts/check-voyages.mjs';
import { notePulse, NOTE_PULSE, groupMarks, dateSpan, noteCount, viewProjection, voyageMarks, voyageView, DEFAULT_VIEW } from '../scripts/scene.mjs';

test('the pulse: three rings over about four seconds, the marks fading to nothing with the last, then nothing drawn', () => {
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

test('the pulse with reduced motion: no rings, the marks whole for the same time, then a fade', () => {
  const { ms, fade } = NOTE_PULSE;
  assert.deepEqual(notePulse(ms / 2, true), { alpha: 1, ring: null });
  assert.equal(notePulse(ms - 1, true).alpha, 1);
  assert.ok(Math.abs(notePulse(ms + fade / 2, true).alpha - 0.5) < 1e-9);
  assert.equal(notePulse(ms + fade, true), null);
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
  assert.equal(dateSpan([]), '');
});
