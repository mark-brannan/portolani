// Portolani mockup renderer: one Web Mercator frame of the western Mediterranean drawn as an
// antique portolan, plus a 2x detail of the same scene. Not product code; the structure mirrors
// the design (buildScene = placement, drawScene = drawTile's draw order) so a build can start here.
//
// Usage: node render.mjs   -> mockup.png, mockup-detail.png

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads');

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
const DETAIL = { lon: 8.93, lat: 44.41, scale: 2 }; // Genoa; window clamped to the scene

const CELL = 16;             // clearance field cell, px
const MONSTER_GAP = 220;     // min centre spacing between monsters, px
const MONSTER_MAX = 4;
const SHIP_MAX = 2;
const TOWN_GAP = 48;
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

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

// Web Mercator fitted to cover the frame, centred on it.
function makeProjection(frame, w, h) {
  const lon0 = ((frame.lonMin + frame.lonMax) / 2) * Math.PI / 180;
  const y0 = (mercY(frame.latMin) + mercY(frame.latMax)) / 2;
  const k = Math.max(w / ((frame.lonMax - frame.lonMin) * Math.PI / 180), h / (mercY(frame.latMax) - mercY(frame.latMin)));
  return {
    k,
    zoom: Math.log2((k * 2 * Math.PI) / 512),
    project: (lon, lat) => [w / 2 + (lon * Math.PI / 180 - lon0) * k, h / 2 - (mercY(lat) - y0) * k],
  };
}

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

function loadGeo(name) {
  return JSON.parse(readFileSync(join(DL, `${name}.geojson`), 'utf8')).features;
}

function ringsOf(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  if (geom.type === 'LineString') return [[geom.coordinates]];
  if (geom.type === 'MultiLineString') return geom.coordinates.map((l) => [l]);
  return [];
}

function loadData(proj) {
  const margin = 2; // degrees
  const near = (coords) => coords.some(([lon, lat]) =>
    lon > FRAME.lonMin - margin && lon < FRAME.lonMax + margin && lat > FRAME.latMin - margin && lat < FRAME.latMax + margin);
  const projectLine = (line) => line.map(([lon, lat]) => proj.project(lon, lat));

  const land = []; // polygons: array of rings in px
  for (const f of loadGeo('ne_50m_land')) {
    for (const poly of ringsOf(f.geometry)) if (poly.some(near)) land.push(poly.map(projectLine));
  }
  const coast = []; // polylines in px
  for (const f of loadGeo('ne_50m_coastline')) {
    for (const [line] of ringsOf(f.geometry)) if (near(line)) coast.push(projectLine(line));
  }
  const places = loadGeo('ne_50m_populated_places_simple')
    .map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
    .filter((p) => p.scalerank <= 4 && p.lon > FRAME.lonMin - margin && p.lon < FRAME.lonMax + margin &&
      p.lat > FRAME.latMin - margin && p.lat < FRAME.latMax + margin)
    .map((p) => ({ name: p.name, rank: p.scalerank, pop: p.pop_max, xy: proj.project(p.lon, p.lat) }));
  return { land, coast, places };
}

async function loadPack(name) {
  const dir = join(ROOT, 'packs', name);
  const manifest = JSON.parse(readFileSync(join(dir, 'pack.json'), 'utf8'));
  const sprites = await Promise.all(manifest.sprites.map(async (s) => {
    const img = await loadImage(join(dir, s.file));
    return { ...s, img, tinted: tint(img, manifest.ink) };
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

function tracePolys(g, polys) {
  g.beginPath();
  for (const poly of polys) for (const ring of poly) {
    ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  }
}

// Land rasterised at CELL px; chamfer distance (1, sqrt2) from every sea cell to land, in px.
function clearanceField(data) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const c = createCanvas(cols, rows);
  const g = c.getContext('2d');
  g.scale(1 / CELL, 1 / CELL);
  g.fillStyle = '#000';
  tracePolys(g, data.land);
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
  tracePolys(fg, data.land);
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

  // Towns, lower scalerank first, >= TOWN_GAP apart; names perpendicular to the nearest coast.
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
    if (towns.some((t) => Math.hypot(t.x - x, t.y - y) < TOWN_GAP)) continue;
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
    names.push({ text: p.name, x: ox, y: oy, angle, fontPx, red: p.rank <= 2 });
  }
  for (const b of boxes.slice(1 + roseDraws.length)) occupied.push({ x: b.cx, y: b.cy, r: Math.max(b.hw, b.hh) * 0.6 });

  // Monsters: farthest-first on the open-water field, >= MONSTER_GAP apart, heaviest sprite first.
  const monsterSprites = packs.cartaMarina.sprites.filter((s) => s.kind === 'monster').sort((a, b) => b.weight - a.weight);
  const monsters = [];
  for (const sprite of monsterSprites) {
    if (monsters.length >= MONSTER_MAX) break;
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
    if (ships.length >= SHIP_MAX) break;
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

function strokeLines(g, lines) {
  g.beginPath();
  for (const line of lines) line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
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

function drawScene(g, scene, data, bg, view) {
  g.save();
  g.setTransform(view.scale, 0, 0, view.scale, -view.x * view.scale, -view.y * view.scale);

  // 1. parchment
  g.drawImage(bg, 0, 0);

  // 2. land: flat tint, then a landward wash along the coast
  g.fillStyle = STYLE.land;
  tracePolys(g, data.land);
  g.fill('evenodd');
  g.save();
  tracePolys(g, data.land);
  g.clip('evenodd');
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const [wd, a] of [[STYLE.washWidth * 2, 0.3], [STYLE.washWidth * 1.3, 0.3], [STYLE.washWidth * 0.7, 0.35]]) {
    g.strokeStyle = hexA(STYLE.gilt, a);
    g.lineWidth = wd;
    strokeLines(g, data.coast);
  }
  g.restore();

  // 3. rhumb lattice: 16 nodes on a circle plus the centre, 32 rays each, in three inks
  const inks = [STYLE.ink, STYLE.windRed, STYLE.windGreen]; // by kind: wind, quarter-wind, half-wind
  g.save();
  g.lineWidth = STYLE.rhumbWidth;
  g.globalAlpha = STYLE.rhumbAlpha;
  const L = Math.hypot(W, H) * 1.5;
  for (const [ix, ink] of inks.entries()) {
    g.strokeStyle = ink;
    g.beginPath();
    for (const n of [scene.centre, ...scene.nodes]) {
      for (let r = 0; r < RHUMB_RAYS; r++) {
        const kind = r % 4 === 0 ? 0 : r % 2 === 1 ? 1 : 2; // wind, quarter (red), half (green)
        if (kind !== ix) continue;
        const a = (r * 2 * Math.PI) / RHUMB_RAYS;
        g.moveTo(n.x, n.y); g.lineTo(n.x + L * Math.cos(a), n.y + L * Math.sin(a));
      }
    }
    g.stroke();
  }
  g.restore();

  // 4. coast
  g.save();
  g.strokeStyle = STYLE.ink;
  g.lineWidth = STYLE.coastWidth;
  g.lineJoin = 'round';
  strokeLines(g, data.coast);
  g.restore();

  // 5. roses
  for (const r of scene.roseDraws) drawSprite(g, r.sprite, r.x, r.y, r.size, { anchor: [0.5, 0.5] });

  // 6. towns
  for (const t of scene.towns) drawTower(g, t);

  // 7. names
  g.save();
  g.textBaseline = 'middle';
  for (const n of scene.names) {
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
  for (const m of scene.monsters) drawSprite(g, m.sprite, m.x, m.y, m.size, { flip: m.flip, anchor: [0.5, 0.5] });
  for (const s of scene.ships) drawSprite(g, s.sprite, s.x, s.y, s.size, { flip: s.flip, rot: s.flip ? -s.tilt : s.tilt, anchor: [0.5, 0.6] });

  // 10. cartouche, lettered in its cleared panel
  const c = scene.cartouche;
  const [px0, py0, px1, py1] = c.sprite.panel;
  const pw = (px1 - px0) * c.w, ph = (py1 - py0) * c.h;
  g.save();
  g.beginPath(); g.rect(c.x + px0 * c.w, c.y + py0 * c.h, pw, ph); g.clip();
  g.drawImage(bg, 0, 0);
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

// ---------------------------------------------------------------- main

GlobalFonts.registerFromPath(join(DL, 'IMFeENrm28P.ttf'), STYLE.font);

const t0 = performance.now();
const proj = makeProjection(FRAME, W, H);
const data = loadData(proj);
const packs = { cartaMarina: await loadPack('carta-marina'), catalan: await loadPack('catalan') };
const tLoad = performance.now();

const measureCtx = createCanvas(10, 10).getContext('2d');
const measure = (text, px) => { measureCtx.font = `${px}px "${STYLE.font}"`; return measureCtx.measureText(text).width; };
const scene = buildScene(data, packs, measure);
const bg = parchment(1539);
const tScene = performance.now();

function render(file, view) {
  const t = performance.now();
  const canvas = createCanvas(W, H);
  drawScene(canvas.getContext('2d'), scene, data, bg, view);
  const tDraw = performance.now();
  mkdirSync(join(ROOT, 'out'), { recursive: true }); writeFileSync(join(ROOT, 'out', file), canvas.toBuffer('image/png'));
  return { draw: tDraw - t, encode: performance.now() - tDraw };
}

const full = render('mockup.png', { scale: 1, x: 0, y: 0 });
const [gx, gy] = proj.project(DETAIL.lon, DETAIL.lat);
const vw = W / DETAIL.scale, vh = H / DETAIL.scale;
const detailView = {
  scale: DETAIL.scale,
  x: Math.max(0, Math.min(W - vw, gx - vw / 2)),
  y: Math.max(0, Math.min(H - vh, gy - vh / 2)),
};
const detail = render('mockup-detail.png', detailView);

const ms = (v) => `${v.toFixed(0)} ms`;
console.log(`zoom ~${proj.zoom.toFixed(2)} (512 px tiles); land polys ${data.land.length}, coast lines ${data.coast.length}, towns ${scene.towns.length}, names ${scene.names.length}, roses ${scene.roseDraws.length}, monsters ${scene.monsters.map((m) => m.sprite.id).join(' ')}, ships ${scene.ships.map((s) => s.sprite.id).join(' ')}`);
console.log(`load ${ms(tLoad - t0)}; placement + parchment ${ms(tScene - tLoad)}; mockup draw ${ms(full.draw)} + encode ${ms(full.encode)}; detail draw ${ms(detail.draw)} + encode ${ms(detail.encode)}; total ${ms(performance.now() - t0)}`);
