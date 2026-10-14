// Cuts GeoJSON to a lon/lat box {x0, x1, y0, y1}: points filtered, polygon rings clipped, lines
// split into the runs that touch the box. With `run`, lines are cut on the same run boundaries
// a reader that splits each line every `run` points uses, so its runs come out unchanged.
export function clipToBox(geo, box, { run } = {}) {
  const inside = ([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  const features = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === 'Point') { if (inside(g.coordinates)) features.push(f); continue; }
    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
        .map((rings) => rings.map((r) => clipRing(r, box)).filter((r) => r.length >= 4))
        .filter((rings) => rings.length);
      if (polys.length) features.push({ ...f, geometry: { type: 'MultiPolygon', coordinates: polys } });
      continue;
    }
    const lines = (g.type === 'LineString' ? [g.coordinates] : g.coordinates).flatMap((l) => (run ? clipRuns(l, inside, run) : clipLine(l, inside)));
    if (lines.length) features.push({ ...f, geometry: { type: 'MultiLineString', coordinates: lines } });
  }
  return { ...geo, features };
}

// Sutherland-Hodgman against each edge of the box; returns a closed ring.
function clipRing(ring, box) {
  const edges = [
    [(p) => p[0] >= box.x0, (a, b) => at(a, b, 0, box.x0)], [(p) => p[0] <= box.x1, (a, b) => at(a, b, 0, box.x1)],
    [(p) => p[1] >= box.y0, (a, b) => at(a, b, 1, box.y0)], [(p) => p[1] <= box.y1, (a, b) => at(a, b, 1, box.y1)],
  ];
  let pts = ring.slice(0, -1);
  for (const [keep, cross] of edges) {
    const next = [];
    pts.forEach((p, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (keep(p)) { if (!keep(prev)) next.push(cross(prev, p)); next.push(p); } else if (keep(prev)) next.push(cross(prev, p));
    });
    pts = next;
    if (!pts.length) return [];
  }
  return [...pts, pts[0]];
}

function at(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

// Runs of points inside the box, each with its neighbours outside so boundary segments survive.
function clipLine(line, inside) {
  const runs = [];
  let run = null;
  line.forEach((p, i) => {
    if (inside(p)) {
      if (!run) { run = i > 0 ? [line[i - 1]] : []; runs.push(run); }
      run.push(p);
    } else if (run) { run.push(p); run = null; }
  });
  return runs.filter((r) => r.length >= 2);
}

// Whole runs of `run` segments, counted from the line's first point, each with the one segment
// it shares with the next; consecutive runs that touch the box come out as one line.
function clipRuns(line, inside, run) {
  const out = [];
  let from = -1;
  for (let i = 0; i < line.length - 1; i += run) {
    const end = Math.min(line.length - 1, i + run + 1);
    if (line.slice(i, end + 1).some(inside)) { if (from < 0) from = i; continue; }
    if (from >= 0) { out.push(line.slice(from, i + 2)); from = -1; }
  }
  if (from >= 0) out.push(line.slice(from));
  return out;
}
