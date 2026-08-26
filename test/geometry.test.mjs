import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  boxParts,
  clipLine,
  clipRing,
  extent,
  lineShapes,
  polygonShapes,
} from '../lib/geometry.js'

const box = [0, 0, 10, 10]

test('a line crossing the box keeps only the part inside', () => {
  const [chain] = clipLine(
    [
      [-5, 5],
      [15, 5],
    ],
    box
  )
  assert.deepEqual(chain, [
    [0, 5],
    [10, 5],
  ])
})

test('a line that leaves and returns becomes two chains, not one shortcut', () => {
  const chains = clipLine(
    [
      [1, 5],
      [5, 20],
      [9, 5],
    ],
    box
  )
  assert.equal(chains.length, 2)
  assert.deepEqual(chains[0][0], [1, 5])
  assert.deepEqual(chains[1][chains[1].length - 1], [9, 5])
})

test('a line wholly outside disappears', () => {
  assert.deepEqual(clipLine([[-5, -5], [-1, -1]], box), [])
})

test('a clipped ring stays closed', () => {
  const clipped = clipRing(
    [
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
      [-5, -5],
    ],
    box
  )
  assert.deepEqual(clipped[0], clipped[clipped.length - 1])
  assert.ok(clipped.every(([lon, lat]) => lon >= 0 && lat >= 0))
})

test('a bbox wrapping the antimeridian becomes the two boxes either side', () => {
  assert.deepEqual(boxParts([170, 0, -170, 20]), [
    [170, 0, 180, 20],
    [-180, 0, -170, 20],
  ])
  assert.deepEqual(boxParts([-10, 0, 10, 20]), [[-10, 0, 10, 20]])
})

test('extent is the larger side of the bounding box', () => {
  assert.equal(extent([[0, 0], [3, 1]]), 3)
})

test('line extraction flattens polygons; polygon extraction does not', () => {
  const document = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[0, 0], [1, 0], [1, 1], [0, 0]],
            [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.2]],
          ],
        },
      },
    ],
  }
  assert.equal(lineShapes(document).length, 2, 'outer and hole become two chains')
  assert.equal(polygonShapes(document).length, 1)
  assert.equal(polygonShapes(document)[0].length, 2, 'the hole stays attached')
})
