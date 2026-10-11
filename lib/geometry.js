// GeoJSON in, shapes out, plus the bounding-box extract.
//
// A "shape" is the unit the format stores: for lines, one chain of
// [lon, lat]; for polygons, an array of rings whose first is the outer and
// whose rest are holes. Keeping the hole structure is the whole difference
// between data you can fill and data you can only stroke.

/** Pulls every line chain out of a GeoJSON document, in source order. */
export function lineShapes(geojson) {
  const out = []
  walk(geojson, (geometry) => {
    switch (geometry.type) {
      case 'LineString':
        out.push(geometry.coordinates)
        break
      case 'MultiLineString':
      case 'Polygon':
        geometry.coordinates.forEach((ring) => out.push(ring))
        break
      case 'MultiPolygon':
        geometry.coordinates.forEach((polygon) =>
          polygon.forEach((ring) => out.push(ring))
        )
        break
    }
  })
  return out
}

/** Pulls every polygon out, outer ring first, holes after. */
export function polygonShapes(geojson) {
  const out = []
  walk(geojson, (geometry) => {
    switch (geometry.type) {
      case 'Polygon':
        out.push(geometry.coordinates)
        break
      case 'MultiPolygon':
        geometry.coordinates.forEach((polygon) => out.push(polygon))
        break
    }
  })
  return out
}

function walk(geojson, visit) {
  const one = (geometry) => {
    if (!geometry) return
    if (geometry.type === 'GeometryCollection') {
      geometry.geometries.forEach(one)
      return
    }
    visit(geometry)
  }
  if (geojson.type === 'FeatureCollection') geojson.features.forEach((f) => one(f.geometry))
  else if (geojson.type === 'Feature') one(geojson.geometry)
  else one(geojson)
}

/** [west, south, east, north] of a chain. */
export function bounds(ring) {
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return [west, south, east, north]
}

/** The larger side of a chain's bounding box, in degrees. */
export function extent(ring) {
  const [west, south, east, north] = bounds(ring)
  return Math.max(east - west, north - south)
}

/** Union of several bounding boxes. */
export function unionBounds(boxes) {
  if (!boxes.length) return null
  return boxes.reduce((a, b) => [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ])
}

const INSIDE = 0
const LEFT = 1
const RIGHT = 2
const BELOW = 4
const ABOVE = 8

function outcode([lon, lat], [west, south, east, north]) {
  let code = INSIDE
  if (lon < west) code |= LEFT
  else if (lon > east) code |= RIGHT
  if (lat < south) code |= BELOW
  else if (lat > north) code |= ABOVE
  return code
}

/**
 * Cohen-Sutherland, one segment at a time, accumulating output chains. A line
 * that leaves the box and comes back becomes two chains rather than one with
 * a shortcut across the middle.
 */
export function clipLine(chain, box) {
  const out = []
  let current = []
  const [west, south, east, north] = box

  for (let i = 0; i < chain.length - 1; i++) {
    let a = chain[i]
    let b = chain[i + 1]
    let codeA = outcode(a, box)
    let codeB = outcode(b, box)
    let accepted = false

    for (;;) {
      if (!(codeA | codeB)) {
        accepted = true
        break
      }
      if (codeA & codeB) break
      const code = codeA || codeB
      let lon
      let lat
      if (code & ABOVE) {
        lon = a[0] + ((b[0] - a[0]) * (north - a[1])) / (b[1] - a[1])
        lat = north
      } else if (code & BELOW) {
        lon = a[0] + ((b[0] - a[0]) * (south - a[1])) / (b[1] - a[1])
        lat = south
      } else if (code & RIGHT) {
        lat = a[1] + ((b[1] - a[1]) * (east - a[0])) / (b[0] - a[0])
        lon = east
      } else {
        lat = a[1] + ((b[1] - a[1]) * (west - a[0])) / (b[0] - a[0])
        lon = west
      }
      if (code === codeA) {
        a = [lon, lat]
        codeA = outcode(a, box)
      } else {
        b = [lon, lat]
        codeB = outcode(b, box)
      }
    }

    if (!accepted) {
      if (current.length > 1) out.push(current)
      current = []
      continue
    }
    const last = current[current.length - 1]
    if (last && last[0] === a[0] && last[1] === a[1]) {
      current.push(b)
    } else {
      if (current.length > 1) out.push(current)
      current = [a, b]
    }
  }

  if (current.length > 1) out.push(current)
  return out
}

function clipHalfPlane(ring, inside, intersect) {
  const out = []
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i]
    const previous = ring[(i + ring.length - 1) % ring.length]
    const currentIn = inside(current)
    const previousIn = inside(previous)
    if (currentIn) {
      if (!previousIn) out.push(intersect(previous, current))
      out.push(current)
    } else if (previousIn) {
      out.push(intersect(previous, current))
    }
  }
  return out
}

/**
 * Sutherland-Hodgman against the four edges. Valid because a bounding box is
 * convex; the result of clipping a hole is still a hole, which is why holes
 * go through the same function as the ring that contains them.
 */
export function clipRing(ring, box) {
  const [west, south, east, north] = box
  const open = closedRing(ring) ? ring.slice(0, -1) : ring.slice()

  let work = clipHalfPlane(
    open,
    (p) => p[0] >= west,
    (a, b) => [west, a[1] + ((b[1] - a[1]) * (west - a[0])) / (b[0] - a[0])]
  )
  work = clipHalfPlane(
    work,
    (p) => p[0] <= east,
    (a, b) => [east, a[1] + ((b[1] - a[1]) * (east - a[0])) / (b[0] - a[0])]
  )
  work = clipHalfPlane(
    work,
    (p) => p[1] >= south,
    (a, b) => [a[0] + ((b[0] - a[0]) * (south - a[1])) / (b[1] - a[1]), south]
  )
  work = clipHalfPlane(
    work,
    (p) => p[1] <= north,
    (a, b) => [a[0] + ((b[0] - a[0]) * (north - a[1])) / (b[1] - a[1]), north]
  )

  if (work.length < 3) return null
  return work.concat([work[0]])
}

export function closedRing(ring) {
  if (ring.length < 2) return false
  const first = ring[0]
  const last = ring[ring.length - 1]
  return first[0] === last[0] && first[1] === last[1]
}

/**
 * A --bbox whose west is east of its east wraps the antimeridian. Rather than
 * clip in a shifted frame and then have to put the seam back, cut it into the
 * two boxes either side of 180 and clip against both: the seam then lands
 * exactly where every drawer already expects one.
 */
export function boxParts([west, south, east, north]) {
  if (west <= east) return [[west, south, east, north]]
  return [
    [west, south, 180, north],
    [-180, south, east, north],
  ]
}
