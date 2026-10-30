// The lon/lat frame a projection paints: the one place that decides what a view covers. `w` x `h` is
// the canvas, `pad` px round it, `margin` degrees more. A cylindrical projection is bounded by the
// canvas edge. An azimuthal one whose padded canvas holds a pole or the rim takes all it can show
// (every longitude, the latitudes the cap reaches); otherwise the padded edge, walked with
// `proj.invert`, bounds it. A frame wider than it needs to be only costs seeds, which the land, the
// canvas and `proj.visible` then refuse, so every error here is toward too wide.
const RAD = Math.PI / 180;
// Offset from the centre within +-180 as coast-wright's seam guard takes it: +180 stays on the right.
export const fromCentre = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
const STEP = 50; // px between edge samples

// { lonMin, lonMax, latMin, latMax } in degrees; lonMin..lonMax is at most 360 + 2 * margin wide,
// measured from the projection's centre longitude, so cells are the same under any pan.
export function frameBox(proj, w, h, pad = 0, margin = 0) {
  if (!proj.rim) { // x is longitude, y is latitude
    const [lonMin, latMax] = proj.invert(-pad, -pad), [lonMax, latMin] = proj.invert(w + pad, h + pad);
    return { lonMin: lonMin - margin, lonMax: lonMax + margin, latMin: latMin - margin, latMax: latMax + margin };
  }
  const inFrame = ([x, y]) => x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;
  const pole = [90, -90].some((lat) => proj.visible(0, lat) && inFrame(proj.project(0, lat)));
  const rimIn = [[-pad, -pad], [w + pad, -pad], [-pad, h + pad], [w + pad, h + pad]].some(([x, y]) => Math.hypot(x - w / 2, y - h / 2) >= proj.rim);
  if (pole || rimIn) {
    const reach = proj.cap / RAD;
    return { lonMin: proj.lonCenter - 180 - margin, lonMax: proj.lonCenter + 180 + margin, latMin: Math.max(-90, proj.lat - reach) - margin, latMax: Math.min(90, proj.lat + reach) + margin };
  }
  let dMin = 0, dMax = 0, latMin = 90, latMax = -90;
  const x1 = w + pad, y1 = h + pad;
  for (let t = 0; t <= Math.max(w, h) + 2 * pad; t += STEP) {
    const x = Math.min(-pad + t, x1), y = Math.min(-pad + t, y1);
    for (const [px, py] of [[x, -pad], [x, y1], [-pad, y], [x1, y]]) {
      const [lon, lat] = proj.invert(px, py), d = fromCentre(lon - proj.lonCenter);
      if (d < dMin) dMin = d; if (d > dMax) dMax = d; if (lat < latMin) latMin = lat; if (lat > latMax) latMax = lat;
    }
  }
  return { lonMin: proj.lonCenter + dMin - margin, lonMax: proj.lonCenter + dMax + margin, latMin: latMin - margin, latMax: latMax + margin };
}
