// The sea's depth, portolan-wise, from an ENC's depth areas, contours, soundings and hazards (S-57
// DEPARE, DEPCNT, SOUNDG, UWTROC, WRECKS, OBSTRN), as a provider's `depth` layer serves them: a faint
// wash on the shoals and stipple on the drying flats, dotted margins along the contours, soundings in
// small italic numerals thinned by their SCAMIN, and hazards as crosses. Drawn just after the parchment
// (scene.mjs drawScene), so the land, lattice, coast and ornaments all fall over it. Depths are metres.
import { fill, trace } from 'coast-wright';

export const DEPTH_CLASSES = ['DEPARE', 'DEPCNT', 'SOUNDG', 'UWTROC', 'WRECKS', 'OBSTRN'];
// the contours drawn, metres, with their dots' gap, radius and alpha: the drying line, 2 fathoms and 10
// (a US cell's depths are fathoms converted, so it has no 5 m or 10 m contour)
const CONTOURS = [[0, 3, 0.55, 0.7], [3.6, 3.2, 0.75, 0.85], [18.2, 5, 0.7, 0.75]];
const SHOAL = 5.4, DEEP = 18.2, PX_MM = 0.28; // a screen px is 0.28 mm, the S-52 pixel, for SCAMIN

const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const pointsOf = (g) => (g.type === 'Point' ? [g.coordinates] : g.type === 'MultiPoint' ? g.coordinates : []);

// The layer's features sorted by class, as the paint reads them; empty for a view with none
export function depthOf(features = []) {
  const by = Object.fromEntries(DEPTH_CLASSES.map((c) => [c, []]));
  for (const f of features) if (f.geometry) by[f.properties?.OBJL]?.push(f);
  return by;
}
export const hasDepth = (d) => DEPTH_CLASSES.some((c) => d?.[c]?.length);

// a seeded scatter, so a redraw stipples the same
function scatter(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// dots spaced `gap` px along a line, those inside `r` traced, filled 2000 at a time
function dotLine(g, line, toPx, r, gap, rad, count) {
  let carry = 0, prev = toPx(line[0]);
  for (let i = 1; i < line.length; i++) {
    const p = toPx(line[i]), dx = p[0] - prev[0], dy = p[1] - prev[1], d = Math.hypot(dx, dy);
    for (let t = gap - carry; t <= d; t += gap) {
      const x = prev[0] + (dx * t) / d, y = prev[1] + (dy * t) / d;
      if (x < r.x0 - 8 || x > r.x1 + 8 || y < r.y0 - 8 || y > r.y1 + 8) continue;
      g.moveTo(x + rad, y); g.arc(x, y, rad, 0, 2 * Math.PI);
      if (++count.n % 2000 === 0) { g.fill(); g.beginPath(); }
    }
    carry = (carry + d) % gap; prev = p;
  }
}

// `r` is the drawn rect in canvas px, `mPerPx` the ground metres a px at the view's centre
export function paintDepth(g, depth, proj, r, mPerPx, { ink, sea, font }) {
  const { toPx, seam } = proj;
  const inR = ([x, y]) => x >= r.x0 - 8 && x <= r.x1 + 8 && y >= r.y0 - 8 && y <= r.y1 + 8;
  const denom = mPerPx / (PX_MM / 1000), shown = (f) => !(f.properties.SCAMIN && denom > f.properties.SCAMIN);
  const areas = (keep) => depth.DEPARE.filter((f) => keep(f.properties.DRVAL1, f.properties.DRVAL2)).flatMap((f) => polysOf(f.geometry));
  const drying = areas((d1) => d1 < 0);
  fill(g, areas((d1, d2) => d1 >= 3.6 && d2 <= DEEP), toPx, { color: sea, alpha: 0.035, ...seam });
  fill(g, areas((d1, d2) => d1 >= 0 && d2 <= SHOAL), toPx, { color: sea, alpha: 0.1, ...seam });
  fill(g, drying, toPx, { color: ink, alpha: 0.1, ...seam });
  // stipple on the drying flats: one scatter over the rect, kept where the clip allows
  if (drying.length) {
    g.save(); g.beginPath(); trace(g, drying, toPx, { ...seam }); g.clip('evenodd');
    g.fillStyle = ink; g.globalAlpha = 0.6; g.beginPath();
    const rnd = scatter(7), w = r.x1 - r.x0, h = r.y1 - r.y0;
    for (let i = 0; i < (w * h) / 10; i++) g.rect(r.x0 + rnd() * w, r.y0 + rnd() * h, 0.8, 0.8);
    g.fill(); g.restore();
  }
  // dotted margins along the contours
  g.save(); g.fillStyle = sea;
  const count = { n: 0 };
  for (const [v, gap, rad, a] of CONTOURS) {
    g.globalAlpha = a; g.beginPath();
    for (const f of depth.DEPCNT) if (f.properties.VALDCO === v) for (const l of linesOf(f.geometry)) dotLine(g, l, toPx, r, gap, rad, count);
    g.fill();
  }
  g.restore();
  // soundings: whole metres, and the tenth as a small subscript under 20 m
  g.save(); g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.9;
  for (const f of depth.SOUNDG.filter(shown)) {
    for (const p of pointsOf(f.geometry)) {
      const xy = toPx(p), d = p[2] ?? f.properties.VALSOU;
      if (!inR(xy) || !Number.isFinite(d)) continue;
      const whole = Math.floor(Math.abs(d)), tenth = Math.round((Math.abs(d) - whole) * 10) % 10;
      g.font = `italic 8.5px "${font}"`;
      const s = `${d < 0 ? '-' : ''}${whole}`, w = g.measureText(s).width;
      g.fillText(s, xy[0], xy[1]);
      if (d < 20 && tenth) { g.font = `italic 6px "${font}"`; g.fillText(String(tenth), xy[0] + w / 2 + 2, xy[1] + 2.5); }
    }
  }
  g.restore();
  // hazards: a rock a small cross, an obstruction a cross in a dotted ring, a wreck a hull stroke through a cross
  const at = (list) => list.filter(shown).flatMap((f) => pointsOf(f.geometry)).map(toPx).filter(inR);
  const rocks = at(depth.UWTROC), obstrn = at(depth.OBSTRN), wrecks = at(depth.WRECKS);
  const cross = (x, y, s) => { g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); };
  g.save(); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 0.8; g.globalAlpha = 0.9; g.beginPath();
  for (const [x, y] of rocks) cross(x, y, 2.2);
  for (const [x, y] of obstrn) cross(x, y, 2);
  for (const [x, y] of wrecks) { cross(x, y, 2.4); g.moveTo(x - 4, y); g.quadraticCurveTo(x, y + 2.5, x + 4, y); }
  g.stroke(); g.beginPath();
  for (const [x, y] of obstrn) for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4, dx = x + 4 * Math.cos(t), dy = y + 4 * Math.sin(t);
    g.moveTo(dx + 0.4, dy); g.arc(dx, dy, 0.4, 0, 2 * Math.PI);
  }
  g.fill(); g.restore();
}
