// The lon/lat box that covers a view and `pad` px round it, for a seeder that walks cells of
// longitude and Mercator latitude (relief.mjs, trees.mjs). On a cylindrical projection the two
// opposite corners bound it. On an azimuthal one they do not: a corner may lie off the globe or past
// a pole, and the box between two corners' lon/lat can miss most of the view. There the box is
// found by inverting points all round the padded frame's edge, and a pole in frame takes every
// longitude and runs to POLE_LAT. A box wider than it needs to be only costs seeds, which the land,
// the canvas and `proj.visible` then refuse, so every error here is toward too wide.
const RAD = Math.PI / 180;
export const POLE_LAT = 85; // Mercator rows stop here
const STEPS = 24; // edge samples a side
const fromCentre = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);

// { lonMin, lonMax, latMin, latMax } in degrees; lonMin..lonMax is at most 360 wide, measured
// from the projection's centre longitude, so the cells are the same under any pan.
export function frameBox(proj, w, h, pad = 0) {
  if (!proj.rim) { // x is longitude, y is latitude
    const [lonMin, latTop] = proj.invert(-pad, -pad), [lonMax, latBottom] = proj.invert(w + pad, h + pad);
    return { lonMin, lonMax, latMin: latBottom, latMax: latTop };
  }
  let dMin = Infinity, dMax = -Infinity, latMin = 90, latMax = -90;
  for (let i = 0; i <= STEPS; i++) {
    const x = -pad + ((w + 2 * pad) * i) / STEPS, y = -pad + ((h + 2 * pad) * i) / STEPS;
    for (const [px, py] of [[x, -pad], [x, h + pad], [-pad, y], [w + pad, y]]) {
      const [lon, lat] = proj.invert(px, py), d = fromCentre(lon - proj.lonCenter);
      if (d < dMin) dMin = d; if (d > dMax) dMax = d; if (lat < latMin) latMin = lat; if (lat > latMax) latMax = lat;
    }
  }
  // a pole inside the frame has every longitude about it, and no edge point reaches it
  const inFrame = ([x, y]) => x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;
  const north = proj.visible(0, 90) && inFrame(proj.project(0, 90)), south = proj.visible(0, -90) && inFrame(proj.project(0, -90));
  if (north) latMax = POLE_LAT;
  if (south) latMin = -POLE_LAT;
  if (north || south) { dMin = -180; dMax = 180; }
  return { lonMin: proj.lonCenter + dMin, lonMax: proj.lonCenter + dMax, latMin, latMax };
}
