// How the map flies from one view to another, worked out apart from the page so a test can read it.
// A place near the view (on the canvas, or no more than half a canvas past its edge) is eased to
// straight, the place sliding along a straight line to the centre as the zoom changes, so it never
// swings off the canvas on the way. A far place is flown to in an arc: out to a height from which both
// places would fit one view, across at that height until the place is under the centre, then down. The
// eye reaches the right latitude and longitude before the zoom in. A longer flight takes longer.
// Distances are read on Mercator, the page's default, whatever the projection: near enough for a camera.

const RAD = Math.PI / 180;
const k = (zoom) => (512 * 2 ** zoom) / (2 * Math.PI); // canvas px per radian, as the scene's kOf
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
const mercLat = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

export const FIT = 0.6; // at the top of an arc, the two places sit within this share of the canvas
// A flight's length is counted in units: a zoom level is one, a pan of one canvas width at the zoom it is made at is
// PAN_UNITS, since the eye follows a slide across the canvas more slowly than a zoom about its centre.
export const MS_PER_UNIT = 450, PAN_UNITS = 3;
export const MIN_MS = 700, MAX_MS = 5000;

// The plan of a flight from `from` to `to` (each { lon, lat, zoom }) on a canvas `w` by `h`, the zoom held at or
// above `minZoom`: { arc, top, ms, at(e) }, where `arc` says whether it climbs, `top` is the zoom it crosses at,
// `ms` its length, and at(e) the { lon, lat, zoom } at e from 0 to 1 along the way (the caller eases e).
export function planFlight(from, to, { w, h, minZoom = 1 }) {
  const dlon = ((to.lon - from.lon + 540) % 360) - 180; // the short way round
  const x0 = from.lon * RAD, y0 = mercY(from.lat), dx = dlon * RAD, dy = mercY(to.lat) - y0; // world radians
  const z0 = from.zoom, z1 = to.zoom;
  const near = Math.abs(dx) * k(z0) <= w && Math.abs(dy) * k(z0) <= h;
  const view = (x, y, zoom) => ({ lon: x / RAD, lat: mercLat(y), zoom });
  if (near) {
    // Into a place: it slides in a straight line on the canvas to the centre. Out of one: the place left slides
    // in a straight line out from the centre (the same move run backwards). Level: a plain pan.
    const pan = PAN_UNITS * Math.hypot(dx, dy) * k(Math.min(z0, z1)) / w; // how far the place slides on the canvas
    const at = (e) => {
      const z = z0 + (z1 - z0) * e;
      const f = z1 >= z0 ? 1 - (1 - e) * 2 ** (z0 - z) : e * 2 ** (z1 - z); // the share of the way the centre has come
      return view(x0 + dx * f, y0 + dy * f, z);
    };
    return { arc: false, top: Math.min(z0, z1), ms: duration(Math.abs(z1 - z0) + pan), at };
  }
  // the zoom at which both places fit FIT of the canvas, no closer than either end and no further than minZoom
  const fits = Math.log2(Math.min((FIT * w) / Math.abs(dx || 1e-12), (FIT * h) / Math.abs(dy || 1e-12)) * 2 * Math.PI / 512);
  const top = Math.max(minZoom, Math.min(fits, z0, z1));
  const up = z0 - top, across = PAN_UNITS * Math.hypot(dx, dy) * k(top) / w, down = z1 - top, all = up + across + down;
  const at = (e) => {
    const p = e * all;
    if (p <= up) return view(x0, y0, z0 - p); // out, about the place left
    if (p <= up + across) { const f = across ? (p - up) / across : 1; return view(x0 + dx * f, y0 + dy * f, top); } // across
    return view(x0 + dx, y0 + dy, Math.min(z1, top + (p - up - across))); // down, about the place
  };
  return { arc: true, top, ms: duration(all), at };
}

const duration = (units) => Math.round(Math.max(MIN_MS, Math.min(MAX_MS, MS_PER_UNIT * units)));
