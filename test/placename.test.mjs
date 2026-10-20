import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestPlace } from '../public/placename.mjs';

// Go's candidates in its order: chart views, points of interest, then towns, bigger first.
const candidates = ['The Mediterranean', 'The North', 'Pitcairn', 'London', 'São Paulo', 'Londrina', 'New London', 'Paulo Afonso']
  .map((name) => ({ name }));
const find = (text) => bestPlace(text, candidates)?.name ?? null;

test('Go finds the PR body\'s examples: a dropped letter, no accents', () => {
  assert.equal(find('pitcarn'), 'Pitcairn');
  assert.equal(find('londn'), 'London');
  assert.equal(find('sao paulo'), 'São Paulo');
});

test('Go ranks a whole name, then its start, then a word', () => {
  assert.equal(find('LONDON'), 'London');
  assert.equal(find('londr'), 'Londrina');
  assert.equal(find('north'), 'The North');
});

test('Go finds nothing for an empty box, a short miss or a far slip', () => {
  assert.equal(find('   '), null);
  assert.equal(find('qxz'), null);
  assert.equal(find('zanzibar'), null);
});
