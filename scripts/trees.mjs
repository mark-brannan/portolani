// Trees and forests after the Carta Marina (Olaus Magnus, 1539), drawn in code: round and oval
// crowns on short dark trunks, singly, in short rows and in clumps that stand for forests, with
// spiky conifers in the far north. A ground layer in the shape water.mjs set: a table of styles,
// a planter, and a pick by zoom.
//
// Trees stay one pen wide at every zoom: each is drawn at a fixed size in px, never scaled with the
// map. Where they stand is fixed to the map instead: the land is cut into a lattice of cells in
// longitude and Mercator latitude, GRID_PX on screen at each whole zoom, and each cell's stand (or
// none) follows from a hash of the cell alone, so a pan meets the same forest and a zoom meets a
// denser one. A stand keeps to land clear of the coast, of lakes and of what the scene has placed
// (towns, names, roses, mountains, the cartouche).
//
// Each style maps a menu option to a function drawing the planted stands, (g, data, stands):
// `data` is { proj, palette } (the view's projection, and the scene's ink and parchment). 'off'
// maps to null.

import { frameBox } from './frame-box.mjs';

const TREE_H = 13; // a tree's height in px, foot to crown top, at every zoom
const GRID_PX = 64; // the lattice's cell, in px at a whole zoom
const COAST_PX = 9; // a tree stands this far inside the coast
const CLEAR_PX = 4; // and this far from anything the scene placed
const CONIFER_LAT = 60; // north of this most trees are conifers, as in Lappia
const TREELINE_LAT = 72; // and north of this, or south of its mirror, there are none
const MIN_ZOOM = 2;

// A stand's chance to grow in a cell, and the most trees it holds, by whole zoom: a far view
// shows a few small clumps, a close one (zoom 9 and in) rows and forests.
const CHANCE = [0, 0, 0.05, 0.08, 0.12, 0.17, 0.22, 0.28, 0.34, 0.42];
const MOST = [0, 0, 3, 3, 4, 5, 6, 8, 11, 16];
const byZoom = (table, z) => table[Math.min(table.length - 1, Math.max(0, z))];

// ---------------------------------------------------------------- the shapes

// A crown's outline: `n` points round an ellipse joined by scallops bulging outward, the lobed
// edge of a woodcut tree, as SVG path data.
function scallop(cx, cy, rx, ry, n, bulge) {
  const pt = (a, k) => [cx + rx * k * Math.sin(a), cy - ry * k * Math.cos(a)];
  const f = (v) => +v.toFixed(2);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i * 2 * Math.PI) / n, [x, y] = pt(a, 1);
    if (!i) { d += `M${f(x)} ${f(y)}`; continue; }
    const [qx, qy] = pt(a - Math.PI / n, bulge);
    d += `Q${f(qx)} ${f(qy)} ${f(x)} ${f(y)}`;
  }
  return `${d}Z`;
}

// Each shape is a list of layers in SVG path data (absolute M L H V Q Z only), foot at y = 0, in px:
// `c` is the crown, filled green and edged in ink; `d` the crown's shaded side, filled darker; `k`
// filled with ink (the trunk); `s` stroked only.
const SHAPES = {
  // a round crown on a short trunk, the common tree of Svecia and Gothia
  round: [
    ['k', 'M-0.8 0.3L-0.5 -4.6H0.5L0.8 0.3Z'],
    ['c', scallop(0, -8.6, 4.2, 4.5, 7, 1.22)],
    ['d', 'M3.6 -9.6Q4.6 -6.6 2.6 -4.9Q0.6 -3.8 -1.8 -4.6Q1.8 -5.4 3.6 -9.6Z'],
    ['s', 'M-2.4 -9.4Q-1.6 -10.9 0 -11M-2.6 0.4H2.6'],
  ],
  // a taller oval crown, as in Lappia's rows
  oval: [
    ['k', 'M-0.8 0.3L-0.5 -4.2H0.5L0.8 0.3Z'],
    ['c', scallop(0, -8.9, 3.4, 5.1, 8, 1.2)],
    ['d', 'M2.9 -10Q3.6 -6.4 1.8 -4.4Q0.2 -3.6 -1.4 -4.2Q1.6 -5.6 2.9 -10Z'],
    ['s', 'M-1.8 -10Q-1 -11.6 0.4 -11.8M-2.2 0.4H2.2'],
  ],
  // a palm: a bare trunk under a crown of fronds, as the Aguiar chart draws the tropics
  palm: [
    ['k', 'M-0.7 0.3L-0.2 -7.6H0.7L1 0.3Z'],
    ['c', 'M0.3 -8L-4.6 -6.6Q-6.4 -6 -7.4 -4.4Q-4.4 -5.8 -1.6 -6.4L-3.4 -10.4Q-1.4 -9 0.2 -8.4L0.6 -12.2Q1.6 -10.2 2 -8.4Q4.2 -10.4 6.6 -10.2Q4.6 -8.6 3.6 -7.4L7.2 -5.6Q4.2 -5.8 1.8 -6.8Z'],
    ['d', 'M0.3 -8L1.8 -6.8Q4.2 -5.8 7.2 -5.6L3.6 -7.4Q4.6 -8.6 6.6 -10.2Q4.2 -10.4 2 -8.4Z'],
    ['s', 'M-2.4 0.4H2.4'],
  ],
  // a conifer, three tiers of spiky boughs
  conifer: [
    ['k', 'M-0.6 0.3V-2.4H0.6V0.3Z'],
    ['c', 'M0 -13L2.4 -9.4H1.2L3.6 -5.8H2L4.6 -2.2H-4.6L-2 -5.8H-3.6L-1.2 -9.4H-2.4Z'],
    ['d', 'M0 -13L2.4 -9.4H1.2L3.6 -5.8H2L4.6 -2.2H1.4L0.6 -5.8L0.4 -9.4Z'],
    ['s', 'M-2.4 0.4H2.4'],
  ],
};
export const TREE_SHAPES = Object.keys(SHAPES);

// Path data onto a canvas path, for the commands SHAPES use.
function tracePath(g, d) {
  const tok = d.match(/[MLHVQZ]|-?[\d.]+/g);
  let i = 0, x = 0, y = 0, cmd = '';
  const num = () => +tok[i++];
  g.beginPath();
  while (i < tok.length) {
    if (/[MLHVQZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { x = num(); y = num(); g.moveTo(x, y); cmd = 'L'; }
    else if (cmd === 'L') { x = num(); y = num(); g.lineTo(x, y); }
    else if (cmd === 'H') { x = num(); g.lineTo(x, y); }
    else if (cmd === 'V') { y = num(); g.lineTo(x, y); }
    else if (cmd === 'Q') { const cx = num(), cy = num(); x = num(); y = num(); g.quadraticCurveTo(cx, cy, x, y); }
    else if (cmd === 'Z') g.closePath();
  }
}

// One tree, its foot at (x, y), in the pigments `p`: crown, shade, conifer and its shade.
function drawTree(g, shape, x, y, p, ink) {
  const conifer = shape === 'conifer';
  g.save();
  g.translate(x, y);
  for (const [kind, d] of SHAPES[shape]) {
    tracePath(g, d);
    if (kind === 'k') { g.fillStyle = ink; g.fill(); }
    else if (kind === 'c') { g.fillStyle = conifer ? p.conifer : p.crown; g.fill(); }
    else if (kind === 'd') { if (p.shade) { g.fillStyle = conifer ? p.coniferShade : p.shade; g.fill(); } }
    if (kind === 'c' || kind === 's') g.stroke();
  }
  g.restore();
}

// Every stand, a forest's ground washed under it when asked, then the trees, the back rows first.
function drawStands(g, data, stands, pigments) {
  const { x: px, y: py } = data.proj, ink = data.palette.ink;
  const at = stands.map((s) => ({ s, x: px(s.lon, s.lat), y: py(s.lat, s.lon) }));
  g.save();
  if (pigments.ground) {
    g.fillStyle = pigments.ground;
    for (const { s, x, y } of at) {
      if (s.trees.length < 5) continue;
      g.beginPath(); g.ellipse(x + s.cx, y + s.cy + 1, s.rx + 6, s.ry + 3, 0, 0, 2 * Math.PI); g.fill();
    }
  }
  g.strokeStyle = ink; g.lineWidth = 0.8; g.lineJoin = 'round'; g.lineCap = 'round';
  for (const { s, x, y } of at) for (const t of s.trees) drawTree(g, t.shape, x + t.dx, y + t.dy, pigments, ink);
  g.restore();
}

const GREEN = '#3d7a58', GREEN_SHADE = '#24563d', FIR = '#2f6248', FIR_SHADE = '#1c3f2d';
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const TREES = {
  off: null,
  // Carta Marina, 1539: green crowns edged in ink, shaded on the right, forests on a pale green ground
  marina: (g, data, stands) => drawStands(g, data, stands, {
    crown: GREEN, shade: GREEN_SHADE, conifer: FIR, coniferShade: FIR_SHADE, ground: 'rgba(122,156,92,0.32)' }),
  // the same trees in ink alone, the crowns left parchment, as a woodcut before it was coloured
  ink: (g, data, stands) => {
    const paper = hexA(data.palette.parchment, 0.9);
    drawStands(g, data, stands, { crown: paper, shade: null, conifer: paper, coniferShade: null, ground: null });
  },
};
export const TREE_STYLES = Object.keys(TREES);

// ---------------------------------------------------------------- planting

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cellSeed = (z, i, j) => (Math.imul(z + 1, 73856093) ^ Math.imul(i, 19349663) ^ Math.imul(j, 83492791) ^ 0x7ee5) | 0;

const RAD = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD; // in degrees of longitude
const mercLat = (y) => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;

// A stand's trees, in px about its site: a single tree or a pair, a row along the ground, or a
// clump packed in a disc; each tree's shape from its latitude and the cell's hash.
function standOf(rnd, most, lat) {
  const n = 1 + Math.floor(rnd() * most);
  const row = n >= 3 && rnd() < 0.4;
  // a row is mostly tall ovals, a clump mostly round crowns, as the chart draws them
  const shape = () => (lat >= CONIFER_LAT && rnd() < 0.75 ? 'conifer' : rnd() < (row ? 0.35 : 0.65) ? 'round' : 'oval');
  const trees = [];
  if (row) {
    // a row, crowns all but touching, nearly level, as Svecia's are drawn
    const len = Math.min(n, 6), tilt = (rnd() - 0.5) * 0.5;
    for (let k = 0; k < len; k++) {
      const along = (k - (len - 1) / 2) * 9.4;
      trees.push({ dx: along * Math.cos(tilt), dy: along * Math.sin(tilt) + (rnd() - 0.5) * 1.6, shape: shape() });
    }
  } else {
    // a clump: trees on a loose lattice of rows inside a disc that holds them
    const r = n === 1 ? 0 : 4.6 * Math.sqrt(n);
    for (let tries = 0; trees.length < n && tries < n * 8; tries++) {
      const a = rnd() * 2 * Math.PI, d = r * Math.sqrt(rnd());
      const dx = d * Math.cos(a), dy = d * Math.sin(a) * 0.62; // the ground seen at a slant
      if (trees.some((t) => Math.abs(t.dx - dx) < 7 && Math.abs(t.dy - dy) < 3.4)) continue;
      trees.push({ dx, dy, shape: shape() });
    }
  }
  return trees.sort((a, b) => a.dy - b.dy);
}

// The boxes, in px, a tree keeps out of: what the scene placed. `scene` is buildScene's.
function keepOutOf(scene) {
  const out = [];
  const box = (x0, y0, x1, y1) => out.push({ x0: x0 - CLEAR_PX, y0: y0 - CLEAR_PX, x1: x1 + CLEAR_PX, y1: y1 + CLEAR_PX });
  const obb = (o) => {
    const ex = o.hw * Math.abs(o.ux) + o.hh * Math.abs(o.uy), ey = o.hw * Math.abs(o.uy) + o.hh * Math.abs(o.ux);
    box(o.cx - ex, o.cy - ey, o.cx + ex, o.cy + ey);
  };
  const disc = (x, y, r) => box(x - r, y - r, x + r, y + r);
  const c = scene.cartouche;
  if (c) box(c.x, c.y, c.x + c.w, c.y + c.h);
  for (const r of scene.roseDraws ?? []) disc(r.x, r.y, r.size / 2);
  for (const m of scene.mountains ?? []) disc(m.x, m.y, m.size / 2);
  for (const p of scene.relief?.peaks ?? []) box(p.x - p.w / 2, p.y - p.h, p.x + p.w / 2, p.y); // a range keeps its own ground
  for (const t of scene.towns ?? []) {
    if (t.city) obb(t.box);
    else { const hw = t.h * 0.6; box(t.x - hw, t.y - t.h - 2, t.x + hw, t.y + 3); }
  }
  for (const t of scene.lesser ?? []) { const hw = t.h * 0.6; box(t.x - hw, t.y - t.h - 2, t.x + hw, t.y + 3); } // their names are in scene.names
  for (const n of scene.names ?? []) obb(n.box);
  for (const w of scene.worldNames ?? []) disc(w.x, w.y, w.r);
  return out;
}

const insideRing = (ring, lon, lat) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
// Is a lon/lat in one of `lakes` (water.mjs's, each { polys, box })?
export const inLake = (lakes, [lon, lat]) => (lon = ((((lon + 180) % 360) + 360) % 360) - 180, lakes.some((l) => lat > l.box.y0 && lat < l.box.y1 && lon > l.box.x0 && lon < l.box.x1 &&
  l.polys.some((p) => insideRing(p[0], lon, lat) && !p.slice(1).some((hole) => insideRing(hole, lon, lat)))));

// The palms beside the points of interest in view: `pois` are { x, y, palms } in px (the buildings the
// scene placed), `scene` and `isLand` as for plantTrees. A palm stands on the ground round the building
// at a few distances, clear of the coast only so far as a small island allows; none where there is no land.
// Returned as stands (one palm each) so TREES draws them.
export function plantPalms({ proj, isLand, scene = {}, pois, w, h }) {
  const keepOut = keepOutOf(scene), stands = [];
  const ok = (x, y) => x > 0 && y > 0 && x < w && y < h && isLand(x, y - 2) && !keepOut.some((b) => x + 4 > b.x0 && x - 4 < b.x1 && y > b.y0 && y - TREE_H < b.y1);
  for (const { x, y, palms } of pois) {
    const placed = [];
    for (const r of [22, 32, 44]) for (let k = 0; k < 8 && placed.length < palms; k++) {
      const a = (k * Math.PI) / 4 + 0.4, px = x + r * Math.cos(a), py = y + 0.6 * r * Math.sin(a);
      if (ok(px, py) && placed.every((q) => Math.hypot(q.x - px, q.y - py) > 12)) placed.push({ x: px, y: py });
    }
    for (const q of placed) {
      const [lon, lat] = proj.invert(q.x, q.y);
      stands.push({ lon, lat, trees: [{ dx: 0, dy: 0, shape: 'palm' }], cx: 0, cy: 0, rx: 5, ry: 2 });
    }
  }
  return stands;
}

// The stands for a view: each { lon, lat, trees: [{ dx, dy, shape }], cx, cy, rx, ry }, the trees in
// px about the site and the ellipse that holds them. `proj` is the view's projection, `isLand(x, y)`
// tests a px on the canvas (w x h), `scene` what is placed, `lakes` the lakes to keep out of.
export function plantTrees({ proj, isLand, scene = {}, lakes = [], w, h }) {
  const z = Math.round(proj.zoom);
  if (z < MIN_ZOOM) return [];
  const chance = byZoom(CHANCE, z), most = byZoom(MOST, z);
  const step = 360 / ((512 * 2 ** z) / GRID_PX), wrap = Math.round(360 / step); // cells round the world
  const { lonMin: lonA, lonMax: lonB, latMin: latBottom, latMax: latTop } = frameBox(proj, w, h);
  const margin = 2 * step;
  const keepOut = keepOutOf(scene);
  const ok = (x, y) => {
    if (x < -8 || y < -4 || x > w + 8 || y > h + 16) return false;
    // on land, the coast COAST_PX away all round (past the canvas's edge counts as land)
    const land = (px, py) => px < 0 || py < 0 || px >= w || py >= h || isLand(px, py);
    if (!land(x, y - 4)) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (!land(x + COAST_PX * Math.cos(a), y - 4 + COAST_PX * Math.sin(a))) return false;
    }
    return !keepOut.some((b) => x + 5 > b.x0 && x - 5 < b.x1 && y > b.y0 && y - TREE_H < b.y1);
  };
  const stands = [];
  const j0 = Math.floor((mercY(Math.max(-85, latBottom)) - margin) / step), j1 = Math.floor((mercY(Math.min(85, latTop)) + margin) / step);
  const i0 = Math.floor((lonA - margin) / step), i1 = Math.min(Math.floor((lonB + margin) / step), i0 + wrap - 1); // never a cell twice round the world
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const rnd = mulberry32(cellSeed(z, ((i % wrap) + wrap) % wrap, j));
      if (rnd() >= chance) continue;
      const lon = (i + 0.2 + 0.6 * rnd()) * step, lat = mercLat((j + 0.2 + 0.6 * rnd()) * step);
      if (Math.abs(lat) > TREELINE_LAT || (proj.visible && !proj.visible(lon, lat))) continue; // none north of the treeline, or on a globe's far side
      const x = proj.x(lon, lat), y = proj.y(lat, lon);
      const trees = standOf(rnd, most, lat).filter((t) => ok(x + t.dx, y + t.dy) && !inLake(lakes, proj.invert(x + t.dx, y + t.dy)));
      if (!trees.length) continue;
      const xs = trees.map((t) => t.dx), ys = trees.map((t) => t.dy);
      const [ax, bx, ay, by] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      stands.push({ lon, lat, trees, cx: (ax + bx) / 2, cy: (ay + by) / 2, rx: (bx - ax) / 2 + 5, ry: (by - ay) / 2 + 2 });
    }
  }
  return stands.sort((a, b) => b.lat - a.lat); // north first, so a stand nearer the reader is drawn over one behind
}
