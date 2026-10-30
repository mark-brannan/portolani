import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOTE_SETS, noteMarks, markClear, tileSpot, TILE_MARGIN } from '../scripts/notes.mjs';
import { viewProjection, W, H } from '../scripts/scene.mjs';

const { overlays } = JSON.parse(readFileSync(new URL('../packs/overlays/overlays.json', import.meta.url), 'utf8'));
const M = TILE_MARGIN;
const at = (spot, [w, h]) => ({ x0: spot.left, y0: spot.top, x1: spot.left + w, y1: spot.top + h });
const meets = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
// the gap between two rectangles that do not meet: the larger of their gaps along either axis
const gap = (a, b) => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
const inside = (a, win) => a.x0 >= M && a.y0 >= M && a.x1 <= win.w - M && a.y1 <= win.h - M;

test('the margin between a hit box and its tile is 8 px', () => assert.equal(TILE_MARGIN, 8));

test('a tile sits to the right of the hit area, a margin clear of it, level with the touch', () => {
  const clear = { x0: 100, y0: 200, x1: 140, y1: 240 }, win = { w: 800, h: 600 };
  const s = tileSpot(clear, [300, 150], win, [120, 220]);
  assert.deepEqual([s.side, s.left, s.top, s.clear], ['right', 148, 212, true]);
});

test('flipped, it sits to the left of the hit area and the same margin clear of it', () => {
  const clear = { x0: 600, y0: 200, x1: 640, y1: 240 }, win = { w: 800, h: 600 };
  const s = tileSpot(clear, [300, 150], win, [620, 220]);
  assert.deepEqual([s.side, s.left, s.top, s.clear], ['left', 600 - M - 300, 212, true]);
});

test('with room neither side, it goes below, then above, the hit area', () => {
  const win = { w: 360, h: 740 };
  const wide = { x0: 20, y0: 100, x1: 340, y1: 300 }; // a figure the width of a phone
  const below = tileSpot(wide, [300, 150], win, [180, 200]);
  assert.deepEqual([below.side, below.top, below.clear], ['below', 308, true]);
  const low = { x0: 20, y0: 500, x1: 340, y1: 700 };
  const above = tileSpot(low, [300, 150], win, [180, 600]);
  assert.deepEqual([above.side, above.top, above.clear], ['above', 500 - M - 150, true]);
});

test('along its side the tile is held inside the window', () => {
  const win = { w: 800, h: 600 }, clear = { x0: 100, y0: 560, x1: 140, y1: 590 };
  const s = tileSpot(clear, [300, 150], win, [120, 580]);
  assert.equal(s.side, 'right');
  assert.equal(s.top, 600 - M - 150);
  assert.ok(inside(at(s, [300, 150]), win));
});

test('a hit box bigger than the room on every side: the side with the most room, held inside the window, and said so', () => {
  const win = { w: 400, h: 300 }, clear = { x0: 40, y0: 30, x1: 330, y1: 260 }; // 24 px of room left, 54 right, 14 above, 24 below
  const s = tileSpot(clear, [300, 150], win, [200, 150]);
  assert.equal(s.side, 'right', 'the most room: 54 px, of the 300 it needs, against 24, 14 and 24');
  assert.equal(s.clear, false);
  assert.ok(inside(at(s, [300, 150]), win));
});

test('a sweep: wherever some side has room the tile is clear of the hit area by the margin and inside the window', () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 2147483648) * n; };
  let clearCount = 0, fallback = 0;
  for (let i = 0; i < 5000; i++) {
    const win = { w: 320 + rnd(1200), h: 480 + rnd(700) }, size = [200 + rnd(100), 60 + rnd(300)];
    const x0 = rnd(win.w), y0 = rnd(win.h), clear = { x0, y0, x1: x0 + 10 + rnd(600), y1: y0 + 10 + rnd(500) };
    const s = tileSpot(clear, size, win, [clear.x0 + rnd(clear.x1 - clear.x0), clear.y0 + rnd(clear.y1 - clear.y0)]);
    const tile = at(s, size);
    const room = [win.w - M - clear.x1 - M, clear.x0 - 2 * M, win.h - M - clear.y1 - M, clear.y0 - 2 * M];
    const fits = room[0] >= size[0] || room[1] >= size[0] || room[2] >= size[1] || room[3] >= size[1];
    assert.equal(s.clear, !meets(tile, clear), 'clear says what is true');
    if (fits) {
      clearCount++;
      assert.ok(!meets(tile, clear) && gap(tile, clear) >= M - 1e-9, `margin ${gap(tile, clear)}`);
      assert.ok(inside(tile, win), 'inside the window');
    } else fallback++;
  }
  assert.ok(clearCount > 1000 && fallback > 50, `${clearCount} with room, ${fallback} without`);
});

test('a drawn mark: the hit area is the square of its reach, so the tile is a margin outside the reach, not just the glyph', () => {
  const m = { x: 400, y: 300, h: 20 }, reach = 22;
  assert.deepEqual(markClear(m, reach), { x0: 378, y0: 278, x1: 422, y1: 322 });
  const s = tileSpot(markClear(m, reach), [300, 150], { w: 1000, h: 700 }, [m.x, m.y]);
  assert.equal(s.left, 422 + M);
});

test('a note\'s hit area is its outline\'s bounds, joined to the reach of its centre', () => {
  const m = { x: 50, y: 50, h: 20, hit: [[0, 0], [100, 20], [60, 120], [-10, 90]] };
  assert.deepEqual(markClear(m, 22), { x0: -10, y0: 0, x1: 100, y1: 120 });
  const small = { x: 50, y: 50, h: 20, hit: [[48, 48], [52, 48], [52, 52], [48, 52]] };
  assert.deepEqual(markClear(small, 22), { x0: 28, y0: 28, x1: 72, y1: 72 });
});

// Every laid chart's notes, at a wide and a phone window with the view over the sheet's centre: a tile for each
// mark that a tap can pick is a margin or more off the bounds of its figure's outline (measured from the outline, not
// from markClear), and no figure at these views is left without a side that has room.
for (const [id, set] of Object.entries(NOTE_SETS)) {
  test(`${id}: the tile of each of its ${set.notes.length} notes clears its hit box`, () => {
    const o = overlays.find((q) => q.id === id), rect = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };
    let checked = 0, covered = 0;
    for (const zoom of [2, 3, 4]) {
      const marks = noteMarks(o, viewProjection({ lon: o.sheet.lon, lat: o.sheet.lat, zoom, projection: 'mercator' }), rect);
      for (const win of [{ w: 1100, h: 740 }, { w: 412, h: 740 }]) {
        const kx = win.w / W, ky = win.h / H;
        for (const m of marks) {
          const c = markClear(m, 22), px = { x0: c.x0 * kx, y0: c.y0 * ky, x1: c.x1 * kx, y1: c.y1 * ky };
          const s = tileSpot(px, [Math.min(300, win.w - 16), 220], win, [m.x * kx, m.y * ky]);
          const outline = m.hit.map(([x, y]) => [x * kx, y * ky]);
          const hitRect = { x0: Math.min(...outline.map((p) => p[0])), y0: Math.min(...outline.map((p) => p[1])), x1: Math.max(...outline.map((p) => p[0])), y1: Math.max(...outline.map((p) => p[1])) };
          if (s.clear) assert.ok(gap(at(s, [Math.min(300, win.w - 16), 220]), hitRect) >= M - 1e-9, `${m.tile.title} at zoom ${zoom} in ${win.w}: gap to the outline's bounds`);
          else covered++;
          checked++;
        }
      }
    }
    assert.ok(checked > 0);
    assert.equal(covered, 0, `${covered} of ${checked} figures have no side with room for a tile (measured: none at these views)`);
  });
}
