// Ramer-Douglas-Peucker, in degrees, with an explicit stack.
//
// The recursive-and-slicing formulation is shorter and is what this started
// as, but its recursion depth is O(n) in the worst case and it copies the
// array at every level. ne_10m_coastline has rings long enough to make both
// of those matter, and a generator whose only failure mode is "the finest
// source overflows the stack" is not a generator.

function segmentDistance(point, start, end) {
  const px = point[0] - start[0]
  const py = point[1] - start[1]
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(px, py)
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared))
  return Math.hypot(px - t * dx, py - t * dy)
}

/** Simplifies an open chain, keeping both endpoints. */
function simplifyChain(points, tolerance, keep) {
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    if (last <= first + 1) continue
    let furthest = -1
    let index = first
    for (let i = first + 1; i < last; i++) {
      const distance = segmentDistance(points[i], points[first], points[last])
      if (distance > furthest) {
        furthest = distance
        index = i
      }
    }
    if (furthest <= tolerance) continue
    keep[index] = true
    stack.push([first, index], [index, last])
  }
}

/**
 * Simplifies a ring. A closed ring is cut at the point furthest from its
 * first before simplifying, because the alternative -- running the algorithm
 * against a zero-length chord from a point to itself -- measures every point
 * against the start rather than against the shape, and eats small islands
 * whole.
 */
export function simplify(points, tolerance, { closed = false } = {}) {
  if (tolerance <= 0 || points.length < 3) return points.slice()

  const ring = closed ? points.slice(0, -1) : points
  if (ring.length < 3) return points.slice()

  const keep = new Array(ring.length).fill(false)
  keep[0] = true
  keep[ring.length - 1] = true

  if (closed) {
    let furthest = -1
    let pivot = 0
    for (let i = 1; i < ring.length; i++) {
      const distance = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
      if (distance > furthest) {
        furthest = distance
        pivot = i
      }
    }
    keep[pivot] = true
    simplifyChain(ring.slice(0, pivot + 1), tolerance, keep)
    const tailKeep = new Array(ring.length - pivot + 1).fill(false)
    simplifyChain(ring.slice(pivot).concat([ring[0]]), tolerance, tailKeep)
    for (let i = 0; i < tailKeep.length; i++) {
      if (tailKeep[i]) keep[(pivot + i) % ring.length] = true
    }
  } else {
    simplifyChain(ring, tolerance, keep)
  }

  const out = []
  for (let i = 0; i < ring.length; i++) if (keep[i]) out.push(ring[i])
  if (closed) out.push(out[0])
  return out
}
