// Portolani mockup scene: placement (buildScene) and draw order (drawScene), independent of where
// it runs. A host (scripts/render.mjs in Node, public/page.js in a browser) supplies an
// environment: createCanvas(w, h), readJSON(path), loadImage(path), loadFont(). Paths are logical:
// `geo/<id>.geojson`, a coastlines data id, and `packs/<pack>/<file>`. Land, wash, coast and
// lattice are drawn in lon/lat through coast-wright, so any view or projection draws the same way.
// A view is a Web Mercator centre and zoom, { lon, lat, zoom }, on a W x H canvas.

import { fill, trace, limn, rhumb, geojsonPolygons, geojsonRings } from 'coast-wright';

let env;
const createCanvas = (w, h) => env.createCanvas(w, h);

// ---------------------------------------------------------------- style

const STYLE = {
  parchment: '#e9d8b4',
  rim: '#c9ad7a',
  land: '#dcc49c',
  ink: '#3b2a1a',
  windGreen: '#4f6b3a',
  windRed: '#8c2f1e',
  gilt: '#b58a3c',
  coastWidth: 1.5,
  washWidth: 5,
  rhumbAlpha: 0.3,
  rhumbWidth: 0.75,
  font: 'IM Fell English',
};

const W = 1600, H = 1000;
const FRAME = { lonMin: -6, lonMax: 20, latMin: 34, latMax: 46 };
const MARGIN = 2; // degrees beyond FRAME whose features the scene keeps
const DETAIL = { lon: 8.93, lat: 44.41, scale: 2 }; // Genoa; window clamped to the scene
// Whole world at the far end; 50m data holds to about z9 at the near end.
const ZOOM = { min: 1, max: 9 };

// Per-run tuning; `density` scales how much ornament is placed (1 = the committed mockup).
const TUNE = { monsterMax: 4, shipMax: 2, townGap: 48 };

const CELL = 16;             // clearance field cell, px
const MONSTER_GAP = 220;     // min centre spacing between monsters, px
const NAME_COAST_PX = 60;    // names go horizontal beyond this distance from the coast
const RHUMB_NODES = 16;
const RHUMB_RAYS = 32;

// ---------------------------------------------------------------- utilities

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

const RAD = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
// Offset from the centre within +-180 as coast-wright's seam guard takes it: +180 stays on the right.
const fromCentre = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
const kOf = (zoom) => (512 * 2 ** zoom) / (2 * Math.PI); // px per Mercator radian

// Web Mercator centred on the view; longitudes are measured from its centre, so any seam is behind it.
function makeProjection(view, w = W, h = H) {
  const k = kOf(view.zoom), lonCenter = view.lon, y0 = mercY(view.lat);
  // x(lon, lat) and y(lat, lon), as coast-wright calls them
  const x = (lon) => w / 2 + fromCentre(lon - lonCenter) * RAD * k;
  const y = (lat) => h / 2 - (mercY(lat) - y0) * k;
  return {
    k, zoom: view.zoom, lonCenter, x, y,
    project: (lon, lat) => [x(lon), y(lat)],
    invert: (px, py) => [lonCenter + (px - w / 2) / k / RAD, mercLat(y0 - (py - h / 2) / k)],
  };
}

// The view that covers a lon/lat frame, centred on it.
function viewOfFrame(frame) {
  const y0 = (mercY(frame.latMin) + mercY(frame.latMax)) / 2;
  const k = Math.max(W / ((frame.lonMax - frame.lonMin) * RAD), H / (mercY(frame.latMax) - mercY(frame.latMin)));
  return { lon: (frame.lonMin + frame.lonMax) / 2, lat: mercLat(y0), zoom: Math.log2((k * 2 * Math.PI) / 512) };
}
const DEFAULT_VIEW = viewOfFrame(FRAME);

// Zoom within ZOOM, longitude wrapped, and the centre kept far enough from the poles that the
// canvas stays inside the Mercator square.
function clampView({ lon, lat, zoom }) {
  zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
  const room = Math.max(0, Math.PI - H / 2 / kOf(zoom));
  return { lon: wrapLon(lon), lat: mercLat(Math.max(-room, Math.min(room, mercY(lat)))), zoom };
}

// The view moved so the map follows a drag of (dx, dy) canvas px.
function panView(view, dx, dy) {
  const k = kOf(view.zoom);
  return clampView({ lon: view.lon - dx / k / RAD, lat: mercLat(mercY(view.lat) + dy / k), zoom: view.zoom });
}

// The view zoomed by `factor` about canvas point (px, py), which keeps its place on the map.
function zoomView(view, factor, px, py) {
  const k = kOf(view.zoom), ox = px - W / 2, oy = py - H / 2;
  const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom + Math.log2(factor))), k2 = kOf(zoom);
  const lon = view.lon + (ox / k - ox / k2) / RAD;
  return clampView({ lon, lat: mercLat(mercY(view.lat) - oy / k + oy / k2), zoom });
}

// The lon/lat frame a projection paints, widened by `margin` degrees.
function frameOf(proj, margin) {
  const half = W / 2 / proj.k / RAD;
  return {
    lonMin: proj.lonCenter - half - margin, lonMax: proj.lonCenter + half + margin,
    latMin: proj.invert(0, H)[1] - margin, latMax: proj.invert(0, 0)[1] + margin,
  };
}
// At any of a longitude's 360-degree copies, so a frame may run past the antimeridian.
const SHIFTS = [-360, 0, 360];
const nearLL = (f, lon, lat) => lat > f.latMin && lat < f.latMax && SHIFTS.some((s) => lon + s > f.lonMin && lon + s < f.lonMax);
const meetsLL = (f, b) => b.y1 > f.latMin && b.y0 < f.latMax && SHIFTS.some((s) => b.x1 + s > f.lonMin && b.x0 + s < f.lonMax);

// Oriented boxes for overlap tests: centre, unit axis u, half-extents.
function obb(cx, cy, angle, hw, hh) {
  return { cx, cy, ux: Math.cos(angle), uy: Math.sin(angle), hw, hh };
}
function obbOverlap(a, b) {
  const axes = [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]];
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  for (const [ax, ay] of axes) {
    const ra = a.hw * Math.abs(a.ux * ax + a.uy * ay) + a.hh * Math.abs(-a.uy * ax + a.ux * ay);
    const rb = b.hw * Math.abs(b.ux * ax + b.uy * ay) + b.hh * Math.abs(-b.uy * ax + b.ux * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
  }
  return true;
}
const obbInside = (o, m = 4) => {
  const ex = o.hw * Math.abs(o.ux) + o.hh * Math.abs(o.uy), ey = o.hw * Math.abs(o.uy) + o.hh * Math.abs(o.ux);
  return o.cx - ex >= m && o.cx + ex <= W - m && o.cy - ey >= m && o.cy + ey <= H - m;
};

// ---------------------------------------------------------------- data

const loadGeo = (id) => env.readJSON(`geo/${id}.geojson`);

// The whole world, parsed once per data set, each shape with its lon/lat box; coast lines also
// split into short runs, which is what a frame drawn while dragging walks.
const worlds = new WeakMap();
async function loadWorld() {
  const [landGeo, coastGeo, placesGeo] = await Promise.all(
    ['ne-land-50m', 'ne-coastline-50m', 'ne-populated-places-50m'].map(loadGeo));
  let world = worlds.get(landGeo);
  if (world) return world;
  const land = geojsonPolygons(landGeo).map((poly) => ({ poly, box: bbox(poly[0]) }));
  const lines = geojsonRings(coastGeo).map((line) => ({ line, box: bbox(line) }));
  const runs = lines.flatMap(({ line }) => coastRuns(line).map((run) => ({ run, box: bbox(run) })));
  const places = placesGeo.features
    .filter((f) => f.properties.SCALERANK <= 4)
    .map((f) => ({ name: f.properties.NAME, rank: f.properties.SCALERANK, pop: f.properties.POP_MAX, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
  world = { land, lines, runs, places };
  worlds.set(landGeo, world);
  return world;
}

// What a view keeps of the world: the shapes with a point within MARGIN degrees of its frame.
function viewData(world, view) {
  const proj = makeProjection(view);
  const f = frameOf(proj, MARGIN);
  const near = ([lon, lat]) => nearLL(f, lon, lat);
  const land = world.land.filter((l) => meetsLL(f, l.box) && l.poly.some((ring) => ring.some(near))).map((l) => l.poly);
  const coastLL = world.lines.filter((l) => meetsLL(f, l.box) && l.line.some(near)).map((l) => l.line); // [lon, lat] lines
  // px, for placement; a line is broken where it jumps the seam behind the view
  const coast = coastLL.flatMap((line) => {
    const out = [[]];
    for (const [lon, lat] of line) {
      const p = proj.project(lon, lat), cur = out[out.length - 1], prev = cur[cur.length - 1];
      if (prev && Math.abs(p[0] - prev[0]) > Math.PI * proj.k) out.push([p]); else cur.push(p);
    }
    return out.filter((l) => l.length > 1);
  });
  const places = world.places.filter((p) => nearLL(f, p.lon, p.lat))
    .map((p) => ({ name: p.name, rank: p.rank, pop: p.pop, xy: proj.project(p.lon, p.lat) }));
  return { proj, land, coastLL, coast, places };
}

async function loadPack(name) {
  const manifest = await env.readJSON(`packs/${name}/pack.json`);
  const sprites = await Promise.all(manifest.sprites.map(async (s) => {
    const img = await env.loadImage(`packs/${name}/${s.file}`);
    // a source-colour pack is drawn as scanned; an ink pack is filled with the ink of the day
    return { ...s, img, tinted: (manifest.colour ?? 'source') === 'source' ? img : tint(img, STYLE.ink) };
  }));
  return { ...manifest, sprites };
}

// An ink mask filled with the pack ink, alpha kept: ready to composite with `multiply`.
function tint(img, ink) {
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = ink;
  g.fillRect(0, 0, img.width, img.height);
  return c;
}

// ---------------------------------------------------------------- clearance field

const traceLand = (g, data, polys = data.land) => trace(g, polys, data.proj.x, data.proj.y, { lonCenter: data.proj.lonCenter });

// Land rasterised at CELL px; chamfer distance (1, sqrt2) from every sea cell to land, in px.
function clearanceField(data) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const c = createCanvas(cols, rows);
  const g = c.getContext('2d');
  g.scale(1 / CELL, 1 / CELL);
  g.fillStyle = '#000';
  traceLand(g, data);
  g.fill('evenodd');
  g.strokeStyle = '#000';
  g.lineWidth = CELL; // keeps islands smaller than a cell
  for (const line of data.coast) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  const px = g.getImageData(0, 0, cols, rows).data;

  const INF = 1e9, d = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) d[i] = px[i * 4 + 3] > 40 ? 0 : INF;
  const D = Math.SQRT2;
  const relax = (i, j, w) => { if (d[j] + w < d[i]) d[i] = d[j] + w; };
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
  for (let i = 0; i < d.length; i++) d[i] *= CELL;

  const at = (x, y) => {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL))), cy = Math.min(rows - 1, Math.max(0, Math.floor(y / CELL)));
    return d[cy * cols + cx];
  };
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL, land: d[y * cols + x] });
  // gradient points away from land; the coast tangent is its perpendicular
  const grad = (x, y) => [at(x + CELL, y) - at(x - CELL, y), at(x, y + CELL) - at(x, y - CELL)];

  // exact land at FINE px, for landward tests and sprite footprints
  const FINE = 4, fc = Math.ceil(W / FINE), fr = Math.ceil(H / FINE);
  const f = createCanvas(fc, fr), fg = f.getContext('2d');
  fg.scale(1 / FINE, 1 / FINE);
  traceLand(fg, data);
  fg.fill('evenodd');
  const fpx = fg.getImageData(0, 0, fc, fr).data;
  const isLand = (x, y) => {
    const cx = Math.floor(x / FINE), cy = Math.floor(y / FINE);
    return cx >= 0 && cy >= 0 && cx < fc && cy < fr && fpx[(cy * fc + cx) * 4 + 3] > 127;
  };
  // does an ellipse inscribed in a w x h box touch land or leave the frame?
  const footprintBlocked = (x, y, w, h) => {
    const rx = w * 0.46, ry = h * 0.46;
    if (x - rx < 0 || y - ry < 0 || x + rx > W || y + ry > H) return true;
    for (let dy = -ry; dy <= ry; dy += 5) for (let dx = -rx; dx <= rx; dx += 5) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1 && isLand(x + dx, y + dy)) return true;
    }
    return false;
  };
  return { at, cells, grad, isLand, footprintBlocked };
}

// ---------------------------------------------------------------- placement

function buildScene(data, packs, measure) {
  const field = clearanceField(data);
  const roses = packs.catalan.sprites.filter((s) => s.kind === 'rose');
  const bigRose = roses.find((s) => s.id === 'rose-aguiar');
  const smallRose = roses.find((s) => s.id === 'rose-catalan');
  const cartoucheSprite = packs.catalan.sprites.find((s) => s.kind === 'cartouche');
  const occupied = []; // discs {x, y, r} that later ornaments keep clear of
  const edge = (x, y) => Math.min(x, y, W - x, H - y);
  const free = (x, y) => Math.min(field.at(x, y), edge(x, y), ...occupied.map((o) => Math.hypot(x - o.x, y - o.y) - o.r));

  // Cartouche: the corner whose rectangle covers the least land.
  const cw = cartoucheSprite.sizePx, ch = cw * cartoucheSprite.img.height / cartoucheSprite.img.width, m = 22;
  const corners = [[m, m], [W - m - cw, m], [m, H - m - ch], [W - m - cw, H - m - ch]].map(([x, y]) => {
    let land = 0;
    for (let yy = y; yy < y + ch; yy += 8) for (let xx = x; xx < x + cw; xx += 8) land += field.isLand(xx, yy);
    return { x, y, w: cw, h: ch, land };
  });
  const cartouche = corners.sort((a, b) => a.land - b.land)[0];
  occupied.push({ x: cartouche.x + cw / 2, y: cartouche.y + ch / 2, r: Math.hypot(cw, ch) / 2 });

  // Lattice centre: the clearest open-sea cell in the middle of the frame; the big rose sits on it.
  const central = field.cells.filter((c) => c.x > W * 0.25 && c.x < W * 0.75 && c.y > H * 0.25 && c.y < H * 0.8);
  const centre = central.reduce((a, b) => (free(b.x, b.y) > free(a.x, a.y) ? b : a));
  const bigSize = Math.min(bigRose.sizePx, 2 * 0.95 * free(centre.x, centre.y));
  const roseDraws = [{ sprite: bigRose, x: centre.x, y: centre.y, size: bigSize }];
  occupied.push({ x: centre.x, y: centre.y, r: bigSize / 2 });

  // Circle radius: the one that puts the most nodes in water clear enough for a small rose.
  const ring = (R) => Array.from({ length: RHUMB_NODES }, (_, i) => {
    const a = (i * 2 * Math.PI) / RHUMB_NODES;
    return { x: centre.x + R * Math.cos(a), y: centre.y + R * Math.sin(a) };
  });
  const roseRoom = smallRose.sizePx / 2 + 6;
  let nodes = [], bestCount = -1;
  for (let R = Math.round(H * 0.36); R <= H * 0.62; R += 8) {
    const n = ring(R), count = n.filter((p) => free(p.x, p.y) >= roseRoom).length;
    if (count >= bestCount) { bestCount = count; nodes = n; }
  }

  // Small roses: the clearest lattice nodes that hold the sprite.
  const nodeRank = nodes.map((n) => ({ ...n, c: free(n.x, n.y) })).filter((n) => n.c >= roseRoom).sort((a, b) => b.c - a.c);
  for (const n of nodeRank) {
    if (roseDraws.length >= 4) break;
    if (free(n.x, n.y) < roseRoom || field.footprintBlocked(n.x, n.y, smallRose.sizePx, smallRose.sizePx)) continue;
    roseDraws.push({ sprite: smallRose, x: n.x, y: n.y, size: smallRose.sizePx });
    occupied.push({ x: n.x, y: n.y, r: smallRose.sizePx / 2 + 10 });
  }

  // Towns, lower scalerank first, >= TUNE.townGap apart; names perpendicular to the nearest coast.
  const nearestCoast = ([px, py]) => {
    let best = { d: Infinity };
    for (const line of data.coast) for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1], [bx, by] = line[i];
      if (Math.min(ax, bx) > px + NAME_COAST_PX * 2 || Math.max(ax, bx) < px - NAME_COAST_PX * 2) continue;
      const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
      const qx = ax + t * vx, qy = ay + t * vy, d = Math.hypot(px - qx, py - qy);
      if (d < best.d) best = { d, qx, qy, line, i };
    }
    return best;
  };
  // Landward unit normal of the coast at its nearest point, from a chord ~CHORD px each way
  // so one jagged 50m segment does not swing the name.
  const CHORD = 14;
  const landwardNormal = (c, x, y) => {
    const walk = (dir) => {
      let i = dir > 0 ? c.i : c.i - 1, [px, py] = [c.qx, c.qy], run = 0;
      while (i >= 0 && i < c.line.length && run < CHORD) {
        const [nx, ny] = c.line[i];
        run += Math.hypot(nx - px, ny - py); [px, py] = [nx, ny]; i += dir;
      }
      return [px, py];
    };
    const [ax, ay] = walk(-1), [bx, by] = walk(1);
    let nx = -(by - ay), ny = bx - ax;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const landAhead = (k) => field.isLand(c.qx + nx * k, c.qy + ny * k) && !field.isLand(c.qx - nx * k, c.qy - ny * k);
    if (!landAhead(6) && !landAhead(10)) {
      const flipped = field.isLand(c.qx - nx * 6, c.qy - ny * 6) || (x - c.qx) * nx + (y - c.qy) * ny < 0;
      if (flipped) { nx = -nx; ny = -ny; }
    }
    return [nx, ny];
  };

  const boxes = [obb(cartouche.x + cw / 2, cartouche.y + ch / 2, 0, cw / 2, ch / 2)];
  for (const r of roseDraws) boxes.push(obb(r.x, r.y, 0, r.size * 0.42, r.size * 0.42));
  const towns = [], names = [];
  const sorted = [...data.places].sort((a, b) => a.rank - b.rank || b.pop - a.pop);
  for (const p of sorted) {
    const [x, y] = p.xy;
    if (x < 8 || y < 8 || x > W - 8 || y > H - 8) continue;
    if (towns.some((t) => Math.hypot(t.x - x, t.y - y) < TUNE.townGap)) continue;
    const size = p.rank <= 2 ? 1.25 : 1;
    const icon = obb(x, y - 8 * size, 0, 5 * size, 8.5 * size); // tower body and pennant
    if (boxes.some((b) => obbOverlap(b, icon))) continue;
    towns.push({ x, y, size, red: p.rank <= 2 });
    boxes.push(icon);

    const fontPx = p.rank <= 1 ? 17 : p.rank <= 2 ? 15 : 13;
    const width = measure(p.name, fontPx);
    const c = nearestCoast(p.xy);
    let angle, ox, oy;
    if (c.d <= NAME_COAST_PX) {
      // baseline on the coast normal, running inland from the town
      const [nx, ny] = landwardNormal(c, x, y);
      angle = Math.atan2(ny, nx);
      // start just past the tower, where the normal leaves its box
      const exit = Math.min(icon.hw / (Math.abs(nx) || 1e-6), icon.hh / (Math.abs(ny) || 1e-6)) + 5;
      ox = icon.cx + nx * exit; oy = icon.cy + ny * exit;
    } else {
      angle = 0; ox = x + icon.hw + 4; oy = icon.cy + 2;
    }
    const box = obb(ox + Math.cos(angle) * width / 2, oy + Math.sin(angle) * width / 2, angle, width / 2 + 2, fontPx * 0.45);
    if (!obbInside(box) || boxes.some((b) => b !== icon && obbOverlap(b, box))) continue; // dropped on overlap
    boxes.push(box);
    names.push({ text: p.name, x: ox, y: oy, angle, fontPx, width, red: p.rank <= 2 });
  }
  for (const b of boxes.slice(1 + roseDraws.length)) occupied.push({ x: b.cx, y: b.cy, r: Math.max(b.hw, b.hh) * 0.6 });

  // Monsters: farthest-first on the open-water field, >= MONSTER_GAP apart, heaviest sprite first.
  const monsterSprites = packs.cartaMarina.sprites.filter((s) => s.kind === 'monster').sort((a, b) => b.weight - a.weight);
  const monsters = [];
  for (const sprite of monsterSprites) {
    if (monsters.length >= TUNE.monsterMax) break;
    const aspect = sprite.img.height / sprite.img.width;
    const ranked = field.cells
      .filter((c) => c.land > 0 && monsters.every((mo) => Math.hypot(mo.x - c.x, mo.y - c.y) >= MONSTER_GAP))
      .map((c) => ({ ...c, c: free(c.x, c.y) }))
      .sort((a, b) => b.c - a.c);
    for (const cand of ranked) {
      const size = Math.min(sprite.sizePx, cand.c * 2 * 0.85);
      if (size < sprite.sizePx * 0.65) break; // farthest-first: nothing clearer remains
      if (field.footprintBlocked(cand.x, cand.y, size, size * aspect)) continue;
      if (boxes.some((b) => obbOverlap(b, obb(cand.x, cand.y, 0, size * 0.45, size * aspect * 0.45)))) continue;
      monsters.push({ sprite, x: cand.x, y: cand.y, size, flip: monsters.length % 2 === 1 });
      occupied.push({ x: cand.x, y: cand.y, r: size * 0.5 });
      break;
    }
  }

  // Ships: coastal water, spread out, heading along the nearest coast.
  const shipSprites = packs.cartaMarina.sprites.filter((s) => s.kind === 'ship');
  const ships = [];
  for (const sprite of shipSprites) {
    if (ships.length >= TUNE.shipMax) break;
    const cand = field.cells
      .filter((c) => c.land >= 24 && c.land <= 72 && free(c.x, c.y) >= sprite.sizePx * 0.5 &&
        !field.footprintBlocked(c.x, c.y, sprite.sizePx, sprite.sizePx * sprite.img.height / sprite.img.width) &&
        boxes.every((b) => !obbOverlap(b, obb(c.x, c.y, 0, sprite.sizePx / 2, sprite.sizePx / 2))))
      .map((c) => ({ ...c, spread: Math.min(...occupied.map((o) => Math.hypot(o.x - c.x, o.y - c.y) - o.r)) }))
      .sort((a, b) => b.spread - a.spread)[0];
    if (!cand) continue;
    const [gx, gy] = field.grad(cand.x, cand.y);
    let tx = -gy, ty = gx;
    const flip = tx < 0;
    if (flip) { tx = -tx; ty = -ty; }
    const tilt = Math.max(-0.26, Math.min(0.26, Math.atan2(ty, tx)));
    ships.push({ sprite, x: cand.x, y: cand.y, size: sprite.sizePx, flip, tilt });
    occupied.push({ x: cand.x, y: cand.y, r: sprite.sizePx * 0.6 + 120 });
  }

  return { field, centre, nodes, roseDraws, towns, names, monsters, ships, cartouche: { ...cartouche, sprite: cartoucheSprite } };
}

// ---------------------------------------------------------------- drawing

function parchment(seed) {
  const rnd = mulberry32(seed);
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = STYLE.parchment;
  g.fillRect(0, 0, W, H);

  // mottling: two octaves of smoothed value noise, multiplied in
  for (const [cols, alpha] of [[24, 0.22], [90, 0.12]]) {
    const rows = Math.ceil((cols * H) / W);
    const n = createCanvas(cols, rows), ng = n.getContext('2d'), img = ng.createImageData(cols, rows);
    for (let i = 0; i < cols * rows; i++) {
      const v = 200 + rnd() * 55;
      img.data.set([v, v * 0.97, v * 0.9, 255], i * 4);
    }
    ng.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(n, 0, 0, W, H);
    g.restore();
  }

  // fibre grain
  const grain = createCanvas(W, H), gg = grain.getContext('2d'), gi = gg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = 235 + rnd() * 20; gi.data.set([v, v, v * 0.98, 255], i * 4); }
  gg.putImageData(gi, 0, 0);
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.drawImage(grain, 0, 0); g.restore();

  // vignette toward the rim
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  vg.addColorStop(0, hexA(STYLE.rim, 0));
  vg.addColorStop(0.7, hexA(STYLE.rim, 0.45));
  vg.addColorStop(1, hexA('#8a6a3a', 0.75));
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.restore();

  // sparse foxing: a few clustered rust spots
  for (let s = 0; s < 11; s++) {
    const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 9;
    for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) {
      const sx = x + (rnd() - 0.5) * r * 2.5, sy = y + (rnd() - 0.5) * r * 2.5, sr = r * (0.3 + rnd() * 0.8);
      const fg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      fg.addColorStop(0, 'rgba(150,100,45,0.32)');
      fg.addColorStop(0.6, 'rgba(160,110,50,0.18)');
      fg.addColorStop(1, 'rgba(160,110,50,0)');
      g.fillStyle = fg;
      g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}

// ---------------------------------------------------------------- culling

// The scene-px rectangle a view paints, padded so strokes and antialiasing at the edge survive.
function viewRect(g, view, pad = 16) {
  const s = view.scale;
  return { x0: view.x - pad, y0: view.y - pad, x1: view.x + g.canvas.width / s + pad, y1: view.y + g.canvas.height / s + pad };
}
const disc = (r, x, y, rad) => x + rad > r.x0 && x - rad < r.x1 && y + rad > r.y0 && y - rad < r.y1;
const meets = (r, b) => b.x1 > r.x0 && b.x0 < r.x1 && b.y1 > r.y0 && b.y0 < r.y1;

function bbox(pts) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of pts) { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
  return b;
}

// Coast split into short runs so a view walks only its own.
const COAST_RUN = 64;
function coastRuns(line) {
  const runs = [];
  for (let i = 0; i < line.length - 1; i += COAST_RUN) runs.push(line.slice(i, i + COAST_RUN + 2)); // one shared segment keeps every join
  return runs;
}

// Land and coast runs with px bounding boxes.
const indexes = new WeakMap();
function indexOf(data) {
  let ix = indexes.get(data);
  if (ix) return ix;
  const px = (ring) => ring.map(([lon, lat]) => data.proj.project(lon, lat));
  const land = data.land.map((poly) => ({ poly, box: bbox(px(poly[0])) }));
  const coast = data.coastLL.flatMap(coastRuns).map((run) => ({ run, box: bbox(px(run)) }));
  ix = { land, coast };
  indexes.set(data, ix);
  return ix;
}

// Each node's rays as rhumb lines in [lon, lat], with px boxes for culling; reaching past the
// scene's far corner from any node.
const lattices = new WeakMap();
function latticeOf(scene, data) {
  let rays = lattices.get(scene);
  if (rays) return rays;
  rays = [];
  // Mercator radians at the equator, in degrees; never past half the world, where a ray would lap itself
  const reach = Math.min(180, (Math.hypot(W, H) * 1.5 / data.proj.k) * 180 / Math.PI);
  for (const n of [scene.centre, ...scene.nodes]) {
    const [lon, lat] = data.proj.invert(n.x, n.y);
    for (let k = 0; k < RHUMB_RAYS; k++) {
      const kind = k % 4 === 0 ? 0 : k % 2 === 1 ? 1 : 2; // wind, quarter (red), half (green)
      const line = rhumb([lon, lat], 90 + (k * 360) / RHUMB_RAYS, reach * Math.cos(lat * Math.PI / 180));
      rays.push({ kind, line, box: bbox(line.map(([a, b]) => data.proj.project(a, b))) });
    }
  }
  lattices.set(scene, rays);
  return rays;
}

function drawSprite(g, s, x, y, size, { flip = false, rot = 0, anchor = s.anchor } = {}) {
  const w = size, h = (size * s.img.height) / s.img.width;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(s.tinted, -w * anchor[0], -h * anchor[1], w, h);
  g.restore();
}

function drawTower(g, t) {
  const s = t.size;
  g.save();
  g.translate(t.x, t.y);
  g.scale(s, s);
  g.lineWidth = 1.1;
  g.strokeStyle = STYLE.ink;
  g.fillStyle = hexA(STYLE.parchment, 0.9);
  // body with three merlons, an arched door, a pennant
  g.beginPath();
  g.moveTo(-4, 0); g.lineTo(-4, -9); g.lineTo(-5, -9); g.lineTo(-5, -12);
  g.lineTo(-3, -12); g.lineTo(-3, -10.5); g.lineTo(-1, -10.5); g.lineTo(-1, -12);
  g.lineTo(1, -12); g.lineTo(1, -10.5); g.lineTo(3, -10.5); g.lineTo(3, -12);
  g.lineTo(5, -12); g.lineTo(5, -9); g.lineTo(4, -9); g.lineTo(4, 0); g.closePath();
  g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-1.5, 0); g.lineTo(-1.5, -3); g.arc(0, -3, 1.5, Math.PI, 0); g.lineTo(1.5, 0); g.stroke();
  g.beginPath(); g.moveTo(0, -12); g.lineTo(0, -16.5); g.stroke();
  g.fillStyle = t.red ? STYLE.windRed : STYLE.ink;
  g.beginPath(); g.moveTo(0, -16.5); g.lineTo(4.5, -15.2); g.lineTo(0, -14); g.closePath(); g.fill();
  g.restore();
}

// Flat tint, then a landward wash along the coast.
function paintLand(g, data, land, coast) {
  const { x, y, lonCenter } = data.proj;
  fill(g, land, x, y, { color: STYLE.land, lonCenter });
  g.save();
  traceLand(g, data, land);
  g.clip('evenodd');
  for (const [wd, a] of [[STYLE.washWidth * 2, 0.3], [STYLE.washWidth * 1.3, 0.3], [STYLE.washWidth * 0.7, 0.35]]) {
    limn(g, coast, x, y, { color: hexA(STYLE.gilt, a), alpha: 1, width: wd, cap: 'round', oneStroke: true, lonCenter });
  }
  g.restore();
}
const paintCoast = (g, data, coast) =>
  limn(g, coast, data.proj.x, data.proj.y, { color: STYLE.ink, alpha: 1, width: STYLE.coastWidth, oneStroke: true, lonCenter: data.proj.lonCenter });

// Parchment, land and coast for any view, with no ornaments or lattice: what a drag draws each frame.
function drawGround(g, world, view, bg) {
  const proj = makeProjection(view), data = { proj };
  const f = frameOf(proj, 16 / proj.k / RAD); // 16 px, so strokes at the edge survive
  const land = world.land.filter((l) => meetsLL(f, l.box)).map((l) => l.poly);
  const coast = world.runs.filter((c) => meetsLL(f, c.box)).map((c) => c.run);
  g.drawImage(bg, 0, 0);
  paintLand(g, data, land, coast);
  paintCoast(g, data, coast);
}

function drawScene(g, scene, data, bg, view) {
  g.save();
  g.setTransform(view.scale, 0, 0, view.scale, -view.x * view.scale, -view.y * view.scale);
  // Only what meets the view is traced or drawn; a view skips the rest of the scene.
  const r = viewRect(g, view), idx = indexOf(data);
  const land = idx.land.filter((l) => meets(r, l.box)).map((l) => l.poly);
  const coast = idx.coast.filter((c) => meets(r, c.box)).map((c) => c.run);
  const bgPart = (x0, y0, x1, y1) => {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    if (x1 > x0 && y1 > y0) g.drawImage(bg, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  };

  // 1. parchment
  bgPart(r.x0, r.y0, r.x1, r.y1);

  // 2. land
  paintLand(g, data, land, coast);

  // 3. rhumb lattice: 16 nodes on a circle plus the centre, 32 rhumb lines each, in three inks
  const rays = latticeOf(scene, data);
  const inks = [STYLE.ink, STYLE.windRed, STYLE.windGreen]; // by kind: wind, quarter-wind, half-wind
  for (const [kind, ink] of inks.entries()) {
    const lines = rays.filter((ray) => ray.kind === kind && meets(r, ray.box)).map((ray) => ray.line);
    limn(g, lines, data.proj.x, data.proj.y, { color: ink, alpha: STYLE.rhumbAlpha, width: STYLE.rhumbWidth, oneStroke: true, lonCenter: data.proj.lonCenter });
  }

  // 4. coast
  paintCoast(g, data, coast);

  // 5. roses
  const spriteIn = (s, x, y, size) => disc(r, x, y, Math.hypot(size, (size * s.img.height) / s.img.width));
  for (const d of scene.roseDraws) if (spriteIn(d.sprite, d.x, d.y, d.size)) drawSprite(g, d.sprite, d.x, d.y, d.size, { anchor: [0.5, 0.5] });

  // 6. towns
  for (const t of scene.towns) if (disc(r, t.x, t.y - 8 * t.size, 12 * t.size)) drawTower(g, t);

  // 7. names
  g.save();
  g.textBaseline = 'middle';
  for (const n of scene.names) {
    if (!disc(r, n.x, n.y, n.width + n.fontPx)) continue;
    g.save();
    g.translate(n.x, n.y);
    g.rotate(n.angle);
    g.font = `${n.fontPx}px "${STYLE.font}"`;
    g.fillStyle = n.red ? STYLE.windRed : STYLE.ink;
    g.fillText(n.text, 0, 0);
    g.restore();
  }
  g.restore();

  // 8. monsters, 9. ships
  for (const m of scene.monsters) if (spriteIn(m.sprite, m.x, m.y, m.size)) drawSprite(g, m.sprite, m.x, m.y, m.size, { flip: m.flip, anchor: [0.5, 0.5] });
  for (const s of scene.ships) if (spriteIn(s.sprite, s.x, s.y, s.size)) drawSprite(g, s.sprite, s.x, s.y, s.size, { flip: s.flip, rot: s.flip ? -s.tilt : s.tilt, anchor: [0.5, 0.6] });

  // 10. cartouche, lettered in its cleared panel
  const c = scene.cartouche;
  if (!meets(r, { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h })) { g.restore(); return; }
  const [px0, py0, px1, py1] = c.sprite.panel;
  const pw = (px1 - px0) * c.w, ph = (py1 - py0) * c.h;
  g.save();
  g.beginPath(); g.rect(c.x + px0 * c.w, c.y + py0 * c.h, pw, ph); g.clip();
  bgPart(c.x + px0 * c.w, c.y + py0 * c.h, c.x + px1 * c.w, c.y + py1 * c.h);
  g.restore();
  drawSprite(g, c.sprite, c.x, c.y, c.w, { anchor: [0, 0] });
  g.save();
  g.fillStyle = STYLE.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fpx = ph * 0.62;
  g.font = `${fpx}px "${STYLE.font}"`;
  g.letterSpacing = `${fpx * 0.12}px`;
  while (g.measureText('PORTOLANI').width > pw * 0.86) { fpx -= 1; g.font = `${fpx}px "${STYLE.font}"`; g.letterSpacing = `${fpx * 0.12}px`; }
  g.fillText('PORTOLANI', c.x + (px0 * c.w) + pw / 2 + fpx * 0.06, c.y + py0 * c.h + ph * 0.54);
  g.restore();

  g.restore();
}

// ---------------------------------------------------------------- setup

// Load data and packs, place the ornaments, paint the parchment. `opts`: ink and parchment
// colours (hex), density and view; defaults reproduce the committed mockup.
export async function createScene(environment, opts = {}) {
  env = environment;
  const { ink = '#3b2a1a', parchment: tone = '#e9d8b4', density = 1 } = opts;
  const view = clampView(opts.view ?? DEFAULT_VIEW);
  STYLE.ink = ink;
  STYLE.parchment = tone;
  TUNE.monsterMax = Math.round(4 * density);
  TUNE.shipMax = Math.round(2 * density);
  TUNE.townGap = 48 / density;

  const t0 = performance.now();
  const [, world, cartaMarina, catalan] = await Promise.all(
    [env.loadFont(STYLE.font), loadWorld(), loadPack('carta-marina'), loadPack('catalan')]);
  const packs = { cartaMarina, catalan };
  const tLoad = performance.now();

  const data = viewData(world, view);
  const measureCtx = createCanvas(10, 10).getContext('2d');
  const measure = (text, px) => { measureCtx.font = `${px}px "${STYLE.font}"`; return measureCtx.measureText(text).width; };
  const scene = buildScene(data, packs, measure);
  if (!parchments.has(tone)) parchments.set(tone, parchment(1539));
  const bg = parchments.get(tone);
  return { scene, data, bg, proj: data.proj, world, view, timing: { load: tLoad - t0, place: performance.now() - tLoad } };
}
const parchments = new Map(); // by tone; the same seed paints the same sheet

export { drawScene, drawGround, panView, zoomView, clampView, DEFAULT_VIEW, ZOOM, W, H, DETAIL };
