// Even-odd point in ring, [lon, lat]. A long ring (a 10m or GSHHG coast is tens of thousands of points) is read
// through a latitude index, so a query walks the edges that cross its latitude and not every edge: the same
// answer, at a few hundred edges a query rather than the whole ring (#177).
const INDEXED_RING = 64, RING_INDEX = new WeakMap();
function ringIndex(ring) {
  let ix = RING_INDEX.get(ring);
  if (ix) return ix;
  const n = ring.length;
  let lo = Infinity, hi = -Infinity;
  for (const p of ring) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  const bands = Math.max(1, Math.min(2048, n >> 3)), k = (hi - lo) / bands || 1;
  const band = (y) => Math.min(bands - 1, Math.max(0, Math.floor((y - lo) / k)));
  const start = new Int32Array(bands + 1);
  const span = (i) => { const a = ring[i][1], b = ring[(i + n - 1) % n][1]; return a < b ? [band(a), band(b)] : [band(b), band(a)]; };
  for (let i = 0; i < n; i++) { const [a, b] = span(i); for (let t = a; t <= b; t++) start[t + 1]++; }
  for (let t = 0; t < bands; t++) start[t + 1] += start[t];
  const fill = start.slice(0, bands), edges = new Int32Array(start[bands]);
  for (let i = 0; i < n; i++) { const [a, b] = span(i); for (let t = a; t <= b; t++) edges[fill[t]++] = i; }
  ix = { lo, hi, band, start, edges };
  RING_INDEX.set(ring, ix);
  return ix;
}
export function insideRing(ring, lon, lat) {
  let inside = false;
  if (ring.length > INDEXED_RING) {
    const { lo, hi, band, start, edges } = ringIndex(ring);
    if (!(lat >= lo && lat <= hi)) return false;
    const t = band(lat), n = ring.length;
    for (let e = start[t]; e < start[t + 1]; e++) {
      const i = edges[e], j = i ? i - 1 : n - 1;
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < xj + ((lat - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
    }
    return inside;
  }
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < xj + ((lat - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside;
}
