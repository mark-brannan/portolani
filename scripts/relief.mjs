// Hills and mountains after the period charts, drawn in code: a ground layer in the shape water.mjs
// set, a table of styles (RELIEF), a placement (reliefOf) and a pick by zoom (BANDS). Everything is
// in pixels after projection, so a pen stays one width at every zoom.
//
// There is no elevation in the data, so the land is read for its distance from the sea: a range is
// seeded in a lon/lat cell, climbs to the inland ridge and runs along it; a far view holds a few
// long ranges on the great land masses, a close one more and smaller, and from HILL_ZOOM hills
// between them. A slow seeded noise over lon/lat says which country is mountainous, so the same
// regions stay mountainous as the view zooms. The distance field is laid on the map's own pixel
// grid and every seed comes from its cell, so a pan does not reshuffle the land.
//
// Mountains are the ranges, drawn in the style selected (RELIEF_STYLES; several mix per range by
// seed). Hills are the clusters between them, which come back as humps for the scene to stand the
// Catalan Atlas's sprites on (the scene draws the sprites, not the humps). A hill sits
// on the foothill ground of the same noise as the ranges, inland and lower than a range, which
// stands in for elevation, the data holding none.

import { hatch, pen } from 'coast-wright';

const RAD = Math.PI / 180;
const CELL = 16; // distance field cell, px
const PAD = 384; // px of land read beyond the view, so a range's distance from the sea is the same wherever it sits on screen
const SEED_PAD = 140; // px beyond the view where a range may still be seeded and reach into it
const DEEP = 120; // px from the sea past which land counts as equally deep
const NOISE_DEG = 7; // the mountainous country's grain, degrees
// The noise's seed: chosen so the Alps, Pyrenees, Scandes, Carpathians, Caucasus, Apennines,
// Highlands, Rockies, Himalaya and Andes all fall on mountainous ground.
const NOISE_SALT = 3781;
const HILL_ZOOM = 9;
// From each zoom: the range cell (px), a peak's height (px) and the share of the land that is mountainous.
const BANDS = [
  { zoom: 0, cell: 260, peak: 30, share: 0.5 },
  { zoom: 5, cell: 260, peak: 26, share: 0.5, hillCell: 140, hill: 9 },
  { zoom: HILL_ZOOM, cell: 320, peak: 20, share: 0.5, hillCell: 120, hill: 11 },
];
export const RELIEF_ZOOM = 2; // from here the land is big enough to hold a range

// ---------------------------------------------------------------- seeds

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (...n) => n.reduce((h, v) => Math.imul(h ^ (v | 0), 16777619), 2166136261) | 0;
const mod = (a, n) => ((a % n) + n) % n;

// Value noise over lon/lat, 0..1, smooth across NOISE_DEG cells; the same at every zoom.
function noise(lon, lat) {
  const n = Math.round(360 / NOISE_DEG), u = lon / NOISE_DEG, v = lat / NOISE_DEG;
  const i = Math.floor(u), j = Math.floor(v), s = (t) => t * t * (3 - 2 * t), fu = s(u - i), fv = s(v - j);
  const at = (a, b) => mulberry32(hash(NOISE_SALT, mod(a, n), b))();
  return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
}

// ---------------------------------------------------------------- distance from the sea

// The land of `polys` (lon/lat) rasterised at CELL px over the view and PAD round it, on the map's
// own pixel grid, and each land cell's chamfer distance (1, sqrt2) to the nearest sea cell, in px,
// up to DEEP. Outside the raster counts as land, which PAD keeps from mattering.
function depthField({ proj, land, createCanvas, w, h }) {
  const { k, lonCenter } = proj;
  // the screen position of the map's pixel origin, so the cells sit still under a pan
  const ox = w / 2 - lonCenter * RAD * k, oy = proj.y(0, lonCenter);
  const x0 = Math.floor((-PAD - ox) / CELL) * CELL + ox, y0 = Math.floor((-PAD - oy) / CELL) * CELL + oy;
  const cols = Math.ceil((w + 2 * PAD) / CELL) + 1, rows = Math.ceil((h + 2 * PAD) / CELL) + 1;
  const c = createCanvas(cols, rows), g = c.getContext('2d');
  g.setTransform(1 / CELL, 0, 0, 1 / CELL, -x0 / CELL, -y0 / CELL);
  g.fillStyle = '#000';
  g.beginPath();
  for (const poly of land) for (const ring of poly) {
    let prev = null;
    ring.forEach(([lon, lat], i) => {
      if (proj.visible && !proj.visible(lon, lat)) { prev = null; return; } // behind an azimuthal horizon
      const px = proj.x(lon, lat), py = proj.y(lat, lon);
      if (!i || prev === null || Math.abs(px - prev) > Math.PI * k) g.moveTo(px, py); else g.lineTo(px, py);
      prev = px;
    });
    g.closePath();
  }
  g.fill('evenodd');
  const alpha = g.getImageData(0, 0, cols, rows).data;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = alpha[i * 4 + 3] > 40 ? 1e9 : 0;
  const D = Math.SQRT2, relax = (i, j, wt) => { if (d[j] + wt < d[i]) d[i] = d[j] + wt; };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) { relax(i, i - cols, 1); if (x > 0) relax(i, i - cols - 1, D); if (x < cols - 1) relax(i, i - cols + 1, D); }
  }
  for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
    const i = y * cols + x;
    if (x < cols - 1) relax(i, i + 1, 1);
    if (y < rows - 1) { relax(i, i + cols, 1); if (x < cols - 1) relax(i, i + cols + 1, D); if (x > 0) relax(i, i + cols - 1, D); }
  }
  // a cell's distance is to its centre; land cells are at least half a cell deep
  return (px, py) => {
    const cx = Math.floor((px - x0) / CELL), cy = Math.floor((py - y0) / CELL);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return 0;
    const v = d[cy * cols + cx];
    return v ? Math.min(DEEP, (v - 0.5) * CELL) : 0;
  };
}

// ---------------------------------------------------------------- placement

const bandOf = (zoom) => BANDS.findLast((b) => zoom >= b.zoom);

// The lon/lat cells of `px` screen px at the whole zoom, on Mercator rows, that a view and `pad`
// round it meets, each with its own random stream; a cell is the same cell under any pan.
function cellsOf(proj, w, h, px, pad, salt) {
  const zi = Math.floor(proj.zoom), deg = (px * 360) / (512 * 2 ** zi), row = deg * RAD, n = Math.round(360 / deg);
  // clamped, as Mercator is: a view's top row in another projection can reach past the pole, and the loop below would never end
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
  const [lonA, latA] = proj.invert(-pad, -pad), [lonB, latB] = proj.invert(w + pad, h + pad);
  const out = [];
  for (let i = Math.floor(lonA / deg); i <= Math.floor(lonB / deg); i++) {
    for (let j = Math.floor(merc(latB) / row); j <= Math.floor(merc(latA) / row); j++) {
      const rnd = mulberry32(hash(salt, zi, mod(i, n), j));
      const lon = (i + 0.1 + 0.8 * rnd()) * deg, lat = (2 * Math.atan(Math.exp((j + 0.1 + 0.8 * rnd()) * row)) - Math.PI / 2) / RAD;
      out.push({ lon, lat, rnd, key: rnd() });
    }
  }
  return out.sort((a, b) => a.key - b.key); // a stable order, so two ranges contest a ridge the same way every time
}

// A range's spine: from the seed, up to the deepest cell near it, then each way along the ridge in
// steps of `step` px, turning at most 35 degrees a step toward the deeper side, until the land
// grows too shallow or the spine reaches `half` px each way.
function spineOf(depth, x, y, { step, min, half, heading, rnd }) {
  for (let i = 0; i < 6; i++) { // climb
    let best = [x, y, depth(x, y)];
    for (let a = 0; a < 8; a++) {
      const nx = x + Math.cos((a * Math.PI) / 4) * CELL, ny = y + Math.sin((a * Math.PI) / 4) * CELL, v = depth(nx, ny);
      if (v > best[2] + 1) best = [nx, ny, v];
    }
    if (best[0] === x && best[1] === y) break;
    [x, y] = best;
  }
  if (depth(x, y) < min) return null;
  // the ridge runs where the land stays deepest; on a plateau, the seed's own heading
  let dir = heading, deepest = -1;
  for (let a = 0; a < 16; a++) {
    const t = heading + (a * Math.PI) / 16, v = depth(x + Math.cos(t) * 40, y + Math.sin(t) * 40) + depth(x - Math.cos(t) * 40, y - Math.sin(t) * 40);
    if (v > deepest + 2) [dir, deepest] = [t, v];
  }
  const walk = (t) => {
    const pts = [];
    let px = x, py = y;
    for (let s = step; s <= half; s += step) {
      let next = null;
      const wander = (rnd() - 0.5) * 0.5; // where the land is all alike, the range still bends
      for (const turn of [wander, -0.3, 0.3, -0.6, 0.6]) {
        const u = t + turn, nx = px + Math.cos(u) * step, ny = py + Math.sin(u) * step, v = depth(nx, ny);
        if (!next || v > next[3] + 4) next = [nx, ny, u, v];
      }
      if (next[3] < min) break;
      [px, py, t] = next;
      pts.push([px, py]);
    }
    return pts;
  };
  return [...walk(dir + Math.PI).reverse(), [x, y], ...walk(dir)];
}

// A peak standing on its base at (x, y), `w` wide and `h` high, its crags from `rnd`.
function peakOf(x, y, w, h, rnd) {
  return { x, y, w, h, lean: (rnd() - 0.5) * 0.25, jag: [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()] };
}

// What a view holds: { peaks, humps }, each { x, y, w, h, style, ... } in screen px, its base at
// (x, y); a peak's `style` is one of `view.styles`, a hump (a hill, only when `view.hills`) is
// 'marina'. `view` is { proj, land, createCanvas, w, h, styles, hills }: the projection, the land in
// lon/lat, a canvas maker, the canvas size, the styles the mountains are drawn in (RELIEF_STYLES; none
// draws no mountain) and whether hills are wanted.
export function reliefOf(view) {
  const { proj, w, h } = view, band = bandOf(proj.zoom);
  const styles = view.styles ?? [];
  const styleOf = (key, of) => of[Math.floor(key * 1e9) % of.length];
  if (proj.zoom < RELIEF_ZOOM || !view.land.length || !(styles.length || view.hills)) return { peaks: [], humps: [] };
  const depth = depthField(view), P = band.peak, min = P * 0.9;
  const peaks = [], spines = [];
  const near = (x, y, r) => spines.some((s) => s.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < r));
  for (const c of cellsOf(proj, w, h, band.cell, SEED_PAD, 1)) {
    if (noise(c.lon, c.lat) < 1 - band.share) continue;
    const sx = proj.x(c.lon, c.lat), sy = proj.y(c.lat, c.lon);
    if (depth(sx, sy) < min) continue;
    const half = Math.min(band.cell * 0.5, 20 + depth(sx, sy) * 1.2) * (0.6 + 0.5 * c.rnd());
    const spine = spineOf(depth, sx, sy, { step: P * 0.8, min, half, heading: c.rnd() * Math.PI, rnd: c.rnd });
    if (!spine || spine.length < 2 || near(spine[Math.floor(spine.length / 2)][0], spine[Math.floor(spine.length / 2)][1], P * 3.5)) continue;
    const kept = spine.filter(([x, y]) => !near(x, y, P * 2.2));
    if (kept.length < 2) continue;
    spines.push(kept);
    const style = styles.length && styleOf(c.key, styles), mine = [];
    // tallest midway, lower toward the ends
    kept.forEach(([x, y], i) => {
      const t = kept.length > 1 ? i / (kept.length - 1) : 0.5, swell = 0.6 + 0.4 * Math.sin(Math.PI * t);
      const ph = P * swell * (0.85 + 0.3 * c.rnd());
      mine.push(peakOf(x + (c.rnd() - 0.5) * P * 0.3, y, ph * (1.7 + 0.4 * c.rnd()), ph, c.rnd));
      // the heap: peaks behind to either side, more of them midway, and there a lower one in front
      for (const side of [-1, 1]) {
        if (c.rnd() > swell * 0.85) continue;
        const bh = ph * (0.7 + 0.25 * c.rnd());
        mine.push(peakOf(x + side * ph * (0.7 + 0.3 * c.rnd()), y - ph * (0.3 + 0.25 * c.rnd()), bh * 1.8, bh, c.rnd));
      }
      if (swell > 0.9 && c.rnd() < 0.5) {
        const fh = ph * (0.55 + 0.15 * c.rnd());
        mine.push(peakOf(x + (c.rnd() - 0.5) * P * 1.2, y + ph * 0.35, fh * 1.7, fh, c.rnd));
      }
    });
    if (style) peaks.push(...mine.map((p) => ({ ...p, style })));
  }
  const humps = [];
  if (band.hillCell && view.hills) {
    const H = band.hill;
    for (const c of cellsOf(proj, w, h, band.hillCell, SEED_PAD / 2, 2)) {
      if (noise(c.lon, c.lat) < 0.8 - band.share) continue;
      const x = proj.x(c.lon, c.lat), y = proj.y(c.lat, c.lon);
      if (depth(x, y) < H * 2 || near(x, y, P * 2.2) || humps.some((m) => Math.hypot(m.x - x, m.y - y) < H * 5)) continue;
      // one to three humps in a row, the middle one the biggest
      const n = [1, 2, 2, 3, 3][Math.floor(c.rnd() * 5)];
      for (let i = 0; i < n; i++) {
        const hh = H * (i === Math.floor(n / 2) ? 1 : 0.75) * (0.85 + 0.3 * c.rnd()), hx = x + (i - (n - 1) / 2) * H * 1.6;
        if (depth(hx, y) >= H) humps.push({ x: hx, y: y + (c.rnd() - 0.5) * H * 0.3, w: hh * 2.2, h: hh, lean: (c.rnd() - 0.5) * 0.2, style: 'marina' });
      }
    }
  }
  return { peaks, humps };
}

// The peaks and humps whose box (x0, y0, x1, y1) is not `blocked`: kept clear of names, towns and
// the other ornaments.
export const clearOf = (relief, blocked) => {
  const free = (p) => !blocked(p.x - p.w / 2, p.y - p.h, p.x + p.w / 2, p.y);
  return { ...relief, peaks: relief.peaks.filter(free), humps: relief.humps.filter(free) };
};

// ---------------------------------------------------------------- drawing

// A peak's outline (base left, up the lit side to the apex, down the shadow side), its shadow
// (right of the crest line) and its crest, in px. The flanks break at a shoulder or two, as the
// Carta Marina's crags do.
function peakShape({ x, y, w, h, lean, jag }) {
  const a = lean, j = (i, s) => (jag[i] - 0.5) * s;
  // up the lit side: a foothill shoulder, a step, the summit's rounded crag; down the shadow side
  // the same, steeper
  const at = (u, v) => [x + u * w, y - v * h];
  const left = [at(-0.5, 0), at(-0.38 + j(0, 0.06), 0.28 + j(1, 0.1)), at(-0.27, 0.34 + j(1, 0.08)), at(-0.16 + a * 0.5, 0.72 + j(2, 0.1)),
    at(a - 0.07, 0.96), at(a, 1)];
  const right = [at(a, 1), at(a + 0.06, 0.95), at(a + 0.12 + j(3, 0.05), 0.68 + j(4, 0.1)), at(0.2 + j(4, 0.05), 0.5),
    at(0.27, 0.46 + j(5, 0.1)), at(0.37 + j(5, 0.05), 0.24), at(0.5, 0)];
  const crest = [at(a, 1), at(a + 0.02 + j(2, 0.04), 0.62), at(0.04 + j(3, 0.06), 0.3), at(0.08, 0)];
  return { outline: [...left, ...right.slice(1)], flanks: [...left, ...right.slice(1)], shadow: [...right, ...crest.slice().reverse().slice(0, -1)], crest, slope: Math.atan2(h, w * (0.5 - a)) };
}

// A rounded hump, a little lopsided, its shadow the right shoulder.
function humpShape({ x, y, w, h, lean }) {
  const top = (t) => [x + Math.cos(Math.PI * (1 - t)) * w / 2 + Math.sin(Math.PI * t) * lean * w, y - Math.sin(Math.PI * t) * h];
  const arc = Array.from({ length: 13 }, (_, i) => top(i / 12));
  const crest = [top(0.55), [x + w * 0.18, y - h * 0.35], [x + w * 0.12, y]];
  return { outline: arc, flanks: arc, shadow: [...arc.slice(7), ...crest.slice().reverse().slice(0, -1)], crest, slope: Math.atan2(h, w * 0.4) };
}

// coast-wright's hatch takes lon/lat; a shape already in px goes through as it is, measured from
// its own x so no stroke is taken for a seam.
const asIs = ([lon, lat]) => [lon, lat];

// Each shape back to front: washed, its shadow side darker and hatched with short ink strokes down
// the slope, then the flanks and crest inked. `wash` null leaves the paper showing (an engraving).
function drawShapes(g, shapes, lookOf) {
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const s of shapes) {
    const { ink, light, shade, hatching, width } = lookOf(s.style);
    if (light) { g.beginPath(); pen(g, [s.outline], { close: true }); g.fillStyle = light; g.fill(); }
    if (shade) { g.beginPath(); pen(g, [s.shadow], { close: true }); g.fillStyle = shade; g.fill(); }
    hatch(g, [[s.shadow]], asIs, { angle: s.slope + 0.35, gap: hatching.gap, color: ink, width: hatching.width, alpha: hatching.alpha, centralMeridian: s.outline[0][0] });
    g.strokeStyle = ink; g.lineWidth = width;
    g.beginPath(); pen(g, [s.flanks]); g.stroke();
    g.lineWidth = width * 0.7;
    g.beginPath(); pen(g, [s.crest]); g.stroke();
  }
  g.restore();
}

const byDepth = (relief) => [
  ...relief.peaks.map((p) => ({ y: p.y, shape: () => ({ ...peakShape(p), style: p.style }) })),
  ...relief.humps.map((p) => ({ y: p.y, shape: () => ({ ...humpShape(p), style: p.style }) })),
].sort((a, b) => a.y - b.y).map((s) => s.shape());

// The styles' pens: the palette is { ink, land } (the scene's ink and land tint).
const LOOKS = {
  // Carta Marina, 1539: craggy ranges and humped hills washed ochre-brown, the shadow side red-brown
  // and hatched in ink
  marina: ({ ink }) => ({ ink, light: '#d2965a', shade: 'rgba(150, 70, 32, 0.7)', hatching: { gap: 2.4, width: 0.7, alpha: 0.8 }, width: 1.1 }),
  // the same in ink alone, as the uncoloured prints were
  engraved: ({ ink, land }) => ({ ink, light: land, shade: null, hatching: { gap: 2.2, width: 0.7, alpha: 0.9 }, width: 1.1 }),
};

export const RELIEF_STYLES = ['off', ...Object.keys(LOOKS)];

// Draw what reliefOf placed, each peak and hump in its own style, back to front; `data` is { proj, palette }.
export function drawRelief(g, data, relief) {
  drawShapes(g, byDepth(relief), (style) => LOOKS[style]?.(data.palette) ?? LOOKS.marina(data.palette));
}
