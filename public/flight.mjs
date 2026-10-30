// How the map flies from one view to another, worked out apart from the page so a test can read it.
// A place near the view (on the canvas, or no more than half a canvas past its edge) is eased to
// straight, the place sliding along a straight line to the centre as the zoom changes, so it never
// swings off the canvas on the way. A far place is flown to in an arc: out to a height from which both
// places would fit one view, across at that height until the place is under the centre, then down. The
// eye reaches the right latitude and longitude before the zoom in. A longer flight takes longer.
// Distances are read on Mercator, the page's default, whatever the projection: near enough for a camera.
//
// The shape and the pace are knobs (FLY_KNOBS), exposed under the hood in the settings drawer while the
// flight is being tuned by eye; each default is the flight as it was before the knobs. Two shapes:
//   step        out about the place left, across at the top, down onto the place. `blend` lets the pan run
//               alongside the zoom once the zoom is at or below it (0: only at the top; past both ends: the
//               whole way, a triangle). `climb` scales the time of the way out (1: as the way down).
//   hyperbolic  van Wijk & Nuij, "Smooth and efficient zooming and panning" (2003), the path MapLibre's
//               flyTo takes: pan and zoom move together along one curve, the height of its top set by
//               `curve` (their rho) and the distance. `fit`, `blend` and `climb` do nothing here.

const RAD = Math.PI / 180;
const k = (zoom) => (512 * 2 ** zoom) / (2 * Math.PI); // canvas px per radian, as the scene's kOf
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
const mercLat = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

export const FIT = 0.6; // at the top of an arc, the two places sit within this share of the canvas
// A flight's length is counted in units: a zoom level is one, a pan of one canvas width at the zoom it is made at is
// PAN_UNITS, since the eye follows a slide across the canvas more slowly than a zoom about its centre.
export const MS_PER_UNIT = 450, PAN_UNITS = 3;
export const MIN_MS = 700, MAX_MS = 5000;

// the knobs: { def, min, max, step } each, or { def, choices }, in the order the drawer shows them
export const FLY_KNOBS = {
  shape: { def: 'step', choices: ['step', 'hyperbolic'] },
  fit: { def: FIT, min: 0.2, max: 1.5, step: 0.05 },
  blend: { def: 0, min: 0, max: 16, step: 0.5 },
  climb: { def: 1, min: 0.2, max: 1.5, step: 0.05 },
  curve: { def: 1.42, min: 0.5, max: 3, step: 0.02 },
  msPerUnit: { def: MS_PER_UNIT, min: 100, max: 900, step: 25 },
  panUnits: { def: PAN_UNITS, min: 0.5, max: 6, step: 0.25 },
  maxMs: { def: MAX_MS, min: 1000, max: 10000, step: 250 },
  ease: { def: 2, min: 1, max: 4, step: 0.25 },
  hold: { def: 1, min: 0, max: 20, step: 0.5 },
};
export const flyDefaults = () => Object.fromEntries(Object.entries(FLY_KNOBS).map(([n, knob]) => [n, knob.def]));

// ease-in-out of power `p` over u from 0 to 1: 1 is linear, 2 the quadratic the page flew with before the knob
export const ease = (u, p = 2) => (u < 0.5 ? 2 ** (p - 1) * u ** p : 1 - 2 ** (p - 1) * (1 - u) ** p);

// The plan of a flight from `from` to `to` (each { lon, lat, zoom }) on a canvas `w` by `h`, the zoom held at or
// above `minZoom`, with the knobs (any left out at their default): { arc, top, ms, at(e) }, where `arc` says
// whether it climbs, `top` is the zoom it crosses at, `ms` its length, and at(e) the { lon, lat, zoom } at e
// from 0 to 1 along the way (the caller eases e).
export function planFlight(from, to, { w, h, minZoom = 1, ...given }) {
  const knobs = { ...flyDefaults(), ...given };
  const dlon = ((to.lon - from.lon + 540) % 360) - 180; // the short way round
  const x0 = from.lon * RAD, y0 = mercY(from.lat), dx = dlon * RAD, dy = mercY(to.lat) - y0; // world radians
  const z0 = from.zoom, z1 = to.zoom;
  const near = Math.abs(dx) * k(z0) <= w && Math.abs(dy) * k(z0) <= h;
  const view = (x, y, zoom) => ({ lon: x / RAD, lat: mercLat(y), zoom: Math.max(minZoom, zoom) });
  const duration = (units) => Math.round(Math.max(MIN_MS, Math.min(knobs.maxMs, knobs.msPerUnit * units)));
  if (near) {
    // Into a place: it slides in a straight line on the canvas to the centre. Out of one: the place left slides
    // in a straight line out from the centre (the same move run backwards). Level: a plain pan.
    const pan = knobs.panUnits * Math.hypot(dx, dy) * k(Math.min(z0, z1)) / w; // how far the place slides on the canvas
    const at = (e) => {
      const z = z0 + (z1 - z0) * e;
      const f = z1 >= z0 ? 1 - (1 - e) * 2 ** (z0 - z) : e * 2 ** (z1 - z); // the share of the way the centre has come
      return view(x0 + dx * f, y0 + dy * f, z);
    };
    return { arc: false, top: Math.min(z0, z1), ms: duration(Math.abs(z1 - z0) + pan), at };
  }
  if (knobs.shape === 'hyperbolic') return hyperbolic({ x0, y0, dx, dy, z0, z1, w, rho: knobs.curve, view, duration });
  // the zoom at which both places fit `fit` of the canvas, no closer than either end and no further than minZoom
  const fits = Math.log2(Math.min((knobs.fit * w) / Math.abs(dx || 1e-12), (knobs.fit * h) / Math.abs(dy || 1e-12)) * 2 * Math.PI / 512);
  const top = Math.max(minZoom, Math.min(fits, z0, z1));
  const up = (z0 - top) * knobs.climb, across = knobs.panUnits * Math.hypot(dx, dy) * k(top) / w, down = z1 - top, all = up + across + down;
  // the pan runs from `a` to `b` along the way: the across leg alone, widened into the way out and the way down
  // while the zoom is at or below `blend`
  const { blend } = knobs;
  const a = z0 <= blend ? 0 : top < blend ? (z0 - blend) * knobs.climb : up;
  const b = z1 <= blend ? all : top < blend ? up + across + (blend - top) : up + across;
  const at = (e) => {
    const p = e * all;
    const zoom = p <= up ? z0 - p / knobs.climb : p <= up + across ? top : Math.min(z1, top + (p - up - across));
    const f = b > a ? Math.max(0, Math.min(1, (p - a) / (b - a))) : p >= a ? 1 : 0;
    return view(x0 + dx * f, y0 + dy * f, zoom);
  };
  return { arc: true, top, ms: duration(all), at };
}

// Van Wijk & Nuij: the view's width in world radians `w` and its centre's way `u` along the pan, both of the
// path length `s`, trade off through rho; the apex is where the path is widest. A pan too short to measure
// is a zoom alone. The length is counted in zoom levels, so a pure zoom costs one unit a level as the step does.
function hyperbolic({ x0, y0, dx, dy, z0, z1, w, rho, view, duration }) {
  const w0 = w / k(z0), w1 = w / k(z1), u1 = Math.hypot(dx, dy), rho2 = rho * rho;
  let S, wOf, uOf;
  if (u1 < 1e-9) {
    const sign = w1 < w0 ? -1 : 1;
    S = Math.abs(Math.log(w1 / w0)) / rho; wOf = (s) => Math.exp(sign * rho * s); uOf = () => 0;
  } else {
    const r = (i) => { const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1); return Math.log(Math.sqrt(b * b + 1) - b); };
    const r0 = r(0), r1 = r(1);
    S = (r1 - r0) / rho;
    wOf = (s) => Math.cosh(r0) / Math.cosh(r0 + rho * s); // the width, as a multiple of w0
    uOf = (s) => (w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2)) / u1; // the share of the way
  }
  const at = (e) => {
    const s = e * S, f = Math.max(0, Math.min(1, uOf(s)));
    return view(x0 + dx * f, y0 + dy * f, z0 - Math.log2(wOf(s)));
  };
  let top = z0; // the lowest zoom on the way, for the record
  for (let e = 0; e <= 1; e += 0.02) top = Math.min(top, at(e).zoom);
  return { arc: true, top, ms: duration((S * rho) / Math.LN2), at };
}
