import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleOrder, nextInCycle } from '../public/cycle.mjs';

const names = Array.from({ length: 40 }, (_, i) => `place ${i}`);

test('pressing next comes round every name once before any repeats, then starts again', () => {
  let last = null; const seen = [];
  for (let i = 0; i < names.length; i++) seen.push(last = nextInCycle(names, last));
  assert.equal(new Set(seen).size, names.length);
  assert.equal(nextInCycle(names, last), seen[0]);
});
test('the order is the same on every load and is not the list order', () => {
  assert.deepEqual(cycleOrder(names), cycleOrder([...names].reverse()));
  assert.notDeepEqual(cycleOrder(names), names);
});
test('a name added later leaves the others in their order', () => {
  assert.deepEqual(cycleOrder([...names, 'new place']).filter((n) => n !== 'new place'), cycleOrder(names));
});
test('a last name no longer listed starts from the first; no names gives null', () => {
  assert.equal(nextInCycle(names, 'gone'), cycleOrder(names)[0]);
  assert.equal(nextInCycle([], null), null);
});
