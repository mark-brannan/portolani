import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simplify } from '../lib/simplify.js'

test('a straight line collapses to its endpoints', () => {
  const line = Array.from({ length: 50 }, (_, i) => [i, 0])
  assert.deepEqual(simplify(line, 0.25), [
    [0, 0],
    [49, 0],
  ])
})

test('a spike taller than the tolerance survives', () => {
  const line = [
    [0, 0],
    [1, 5],
    [2, 0],
  ]
  assert.equal(simplify(line, 0.25).length, 3)
  assert.equal(simplify(line, 10).length, 2)
})

test('tolerance 0 keeps every point', () => {
  const line = Array.from({ length: 20 }, (_, i) => [i, i % 2])
  assert.equal(simplify(line, 0).length, 20)
})

test('a closed ring stays closed and keeps its corners', () => {
  const square = [
    [0, 0],
    [5, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ]
  const simplified = simplify(square, 0.25, { closed: true })
  assert.deepEqual(simplified[0], simplified[simplified.length - 1])
  assert.equal(simplified.length, 5, 'the collinear midpoint goes, the corners stay')
})

test('a small ring is not eaten by measuring from its first point', () => {
  // The failure this guards: running Douglas-Peucker on a closed ring against
  // the zero-length chord from its first point to itself measures distance
  // from the start rather than from the shape, which flattens islands.
  const diamond = [
    [0, 0],
    [1, 1],
    [0, 2],
    [-1, 1],
    [0, 0],
  ]
  assert.equal(simplify(diamond, 0.25, { closed: true }).length, 5)
})

test('a ring long enough to overflow a recursive implementation is fine', () => {
  // 200k points on a smooth arc: deeper than the call stack the slicing
  // recursive form needs, and the shape a fine coastline actually has.
  const arc = Array.from({ length: 200000 }, (_, i) => [
    Math.cos(i * 1e-5) * 50,
    Math.sin(i * 1e-5) * 50,
  ])
  const simplified = simplify(arc, 0.01)
  assert.ok(simplified.length > 2)
  assert.ok(simplified.length < 1000)
  assert.deepEqual(simplified[0], arc[0])
  assert.deepEqual(simplified[simplified.length - 1], arc[arc.length - 1])
})
