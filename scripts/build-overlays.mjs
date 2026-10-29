// Builds packs/overlays/: each chart's scan shrunk, a mask of the scanner's paper round it, and overlays.json
// with the sheet's own placement, its snaps and the warped pieces' fits (scripts/overlays.mjs, docs/overlay/README.md). The scan is downloaded into downloads/ when missing and
// checked against the sha256 in scripts/sources.json, as build-packs.mjs does.
//
// Usage: npm run overlays
//
// The Carta Marina's two fits are refitted from the figures table in docs/atlas/ornaments.md ("Carta
// Marina, 1539"): every row gives a figure's scan px and the lon, lat its side's fit put it at, so a
// least-squares similarity through a side's rows gives back that side's fit. The Catalan Atlas's one fit
// is made from its landmarks table there ("Landmarks, sheet 5"): each row's scan px and real lon, lat. Juan de
// la Cosa's three are made the same way from "Landmarks, 1500", each from the rows of its piece.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBytesWithRetry } from './fetch-retry.mjs';
import { similarityFit, sheetOf } from './overlays.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads'), OUT = join(ROOT, 'packs', 'overlays');

// The rows of the figures table under a heading of ornaments.md, as { id, px: [x, y], fit, ll: [lon, lat] }.
export function figureRows(markdown, heading = '## Carta Marina, 1539') {
  const at = markdown.indexOf(heading), next = markdown.indexOf('\n## ', at + heading.length);
  const section = markdown.slice(at, next < 0 ? undefined : next);
  const num = (t) => t.split(',').map(Number);
  return section.split('\n').map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c.length > 6 && /^[RMS]\d+$/.test(c[1]) && /^(west|baltic)$/.test(c[4]))
    .map((c) => ({ id: c[1], px: num(c[3]), fit: c[4], ll: num(c[5]) }));
}
// The rows of a landmarks table under a heading of ornaments.md, as { id, px: [x, y], ll: [lon, lat] }: the
// landmark's real place, not where a fit puts it. A table with a piece column adds `piece`, the fit it belongs to.
export function landmarkRows(markdown, heading) {
  const at = markdown.indexOf(heading), next = markdown.indexOf('\n#', at + heading.length);
  const section = markdown.slice(at, next < 0 ? undefined : next);
  const num = (t) => t.split(',').map(Number);
  return section.split('\n').map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c.length > 5 && /^L\d+$/.test(c[1]))
    .map((c) => ({ id: c[1], px: num(c[3]), ll: num(c[4]), ...(/^[a-z]+$/.test(c[5]) && { piece: c[5] }) }));
}
// One side's similarity, refitted from its rows
export function fitOf(rows, side) {
  const { a, b, tx, ty } = similarityFit(rows.filter((r) => r.fit === side).map((r) => [r.px, r.ll]));
  return { a, b, tx, ty };
}

// One piece's similarity, fitted to the landmarks of that piece
export function pieceFit(rows, piece) {
  const { a, b, tx, ty } = similarityFit(rows.filter((r) => r.piece === piece).map((r) => [r.px, r.ll]));
  return { a, b, tx, ty };
}

// Each chart's pieces from ornaments.md, as [x0, x1, fit]; x1 null for the scan's right edge. `scale` is how
// far the scan is shrunk for the site.
const CHARTS = [
  { id: 'carta-marina', title: 'Carta Marina, Olaus Magnus, 1539', source: 'carta-marina', file: 'carta-marina.jpg', scale: 2,
    pieces: (md) => { const rows = figureRows(md); return [[0, 2700, fitOf(rows, 'west')], [2700, null, fitOf(rows, 'baltic')]]; },
    snaps: ['West', 'Baltic'] },
  { id: 'catalan-atlas', title: 'Catalan Atlas, sheet 5, 1375', source: 'catalan-atlas-5', file: 'catalan-atlas.jpg', scale: 4,
    pieces: (md) => { const { a, b, tx, ty } = similarityFit(landmarkRows(md, '### Landmarks, sheet 5').map((r) => [r.px, r.ll])); return [[240, 6080, { a, b, tx, ty }]]; }, // the parchment, not the scan's white margin
    snaps: [] },
  { id: 'de-la-cosa', title: 'Map of Juan de la Cosa, 1500', source: 'de-la-cosa', file: 'de-la-cosa.jpg', scale: 1, // the scan is small: shrunk, the coasts would go; the pieces run from the parchment's west edge to its east
    parallels: [23.44, 0], // the two long red lines across the skin, top first: the Tropic of Cancer and the equator
    pieces: (md) => { const rows = landmarkRows(md, '### Landmarks, 1500'); return [[70, 880, 'west'], [880, 1150, 'atlantic'], [1150, 2060, 'east']].map(([x0, x1, p]) => [x0, x1, pieceFit(rows, p)]); },
    snaps: ['New World', 'Atlantic', 'Europe'] },
];

// The sheet's own placement. With the chart's drawn `parallels` ([{ lat, from, to }], top first, in scan px): the turn
// that lays them level, the scale that sets them their Mercator distance apart, the latitude that puts the scan's centre
// where it lies against them, and the longitude midway between where the first and last pieces' fits put the centre.
// Without: level, its scale the geometric mean of the first and last pieces' and its centre midway between where those
// two fits put the scan's centre; a chart with one piece takes that fit as it is. The snaps: each piece's fit applied
// to the whole scan, labelled.
export function sheetPlacements(pieces, labels, width, height, parallels = null) {
  const fits = pieces.map(([, , fit]) => fit), sheets = fits.map((f) => sheetOf(f, width, height));
  const snaps = sheets.length === 1 ? [] : sheets.map((s, i) => ({ label: labels[i], ...s }));
  const first = sheets[0], last = sheets[sheets.length - 1], lon = (first.lon + last.lon) / 2;
  if (parallels) {
    const slope = (l) => (l.to[1] - l.from[1]) / (l.to[0] - l.from[0]), m = parallels.reduce((t, l) => t + slope(l), 0) / parallels.length;
    const yAt = (l, x) => l.from[1] + slope(l) * (x - l.from[0]), cx = width / 2, cy = height / 2, cos = Math.cos(Math.atan(m));
    const [top, bottom] = parallels, span = (yAt(bottom, cx) - yAt(top, cx)) * cos; // their distance apart, across the lines
    const scale = (mercDeg(top.lat) - mercDeg(bottom.lat)) / span;
    const merc = mercDeg(bottom.lat) - (cy - yAt(bottom, cx)) * cos * scale; // the centre's Mercator latitude: below the bottom line is south
    return { sheet: { lon, lat: latOf(merc), scale, turn: -Math.atan(m) * 180 / Math.PI }, snaps };
  }
  if (sheets.length === 1) return { sheet: sheets[0], snaps };
  return { sheet: { lon, lat: latOf((mercDeg(first.lat) + mercDeg(last.lat)) / 2), scale: Math.sqrt(first.scale * last.scale), turn: 0 }, snaps };
}
const mercDeg = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
const latOf = (m) => (2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * 180 / Math.PI;

// The chart's drawn parallels: the long thin red lines across the skin (Juan de la Cosa's equator and Tropic of
// Cancer). Thin red runs (1 to 5 px tall) in every column are points; a Hough vote over slopes within 4 degrees of
// level and 1 px intercept bins finds the `n` strongest lines at least 60 px apart, each then refitted by least
// squares to its points within 3 px. Returns them top first, as { from: [x, y], to: [x, y] } in the canvas's px
// (the line through its outermost points), or throws when fewer than `n` are found.
export function redLines(ctx, w, h, n = 2) {
  const d = ctx.getImageData(0, 0, w, h).data, red = (x, y) => { const i = (y * w + x) * 4; return d[i] > 120 && d[i] - d[i + 1] > 45 && d[i] - d[i + 2] > 45; };
  const pts = [];
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y++) {
      if (!red(x, y)) continue;
      let y1 = y; while (y1 + 1 < h && red(x, y1 + 1)) y1++;
      if (y1 - y < 5) pts.push([x, (y + y1) / 2]);
      y = y1;
    }
  }
  let best = null;
  for (let m = -0.07; m <= 0.07; m += 0.0005) {
    const bins = new Map();
    for (const [x, y] of pts) { const b = Math.round(y - m * x); bins.set(b, (bins.get(b) ?? 0) + 1); }
    const peaks = [...bins.entries()].sort((a, b) => b[1] - a[1]), chosen = [];
    for (const [b, v] of peaks) { if (chosen.every(([cb]) => Math.abs(cb - b) >= 60)) chosen.push([b, v]); if (chosen.length === n) break; }
    const score = chosen.reduce((t, [, v]) => t + v, 0);
    if (chosen.length === n && (!best || score > best.score)) best = { m, lines: chosen.map(([b]) => b), score };
  }
  if (!best) throw new Error(`fewer than ${n} red lines across the scan`);
  return best.lines.map((b) => {
    const on = pts.filter(([x, y]) => Math.abs(y - best.m * x - b) <= 3), k = on.length;
    const mx = on.reduce((t, p) => t + p[0], 0) / k, my = on.reduce((t, p) => t + p[1], 0) / k;
    const m = on.reduce((t, [x, y]) => t + (x - mx) * (y - my), 0) / on.reduce((t, [x]) => t + (x - mx) ** 2, 0), c = my - m * mx;
    const x0 = Math.min(...on.map((p) => p[0])), x1 = Math.max(...on.map((p) => p[0]));
    return { from: [x0, +(m * x0 + c).toFixed(1)], to: [x1, +(m * x1 + c).toFixed(1)], n: k };
  }).sort((a, b) => a.from[1] - b.from[1]);
}

// The mask of the scanner's paper round the skin, on the shrunk scan: a flood fill from the image's border
// through light or grey unsaturated pixels (never the pale sea inside the skin, which is tinted), the outermost px
// keyed whatever they hold, one px of feather at its edge. Returns { png, keyed }: the mask as an RGBA PNG (alpha 0 where paper) and the share of pixels keyed.
export function paperMask(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, n = w * h;
  // the paper and the scanner's shadow on it are light to mid grey, unsaturated; the skin is tinted even where it is pale
  const paper = (p) => { const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn > 150 && mx - mn < 30; };
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.006)); // the scan's outermost px are the scanner's edge, never the skin
  const seen = new Uint8Array(n), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !paper(p)) continue;
    seen[p] = 1;
    const x = p % w;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (p >= w) stack.push(p - w); if (p + w < n) stack.push(p + w);
  }
  const out = ctx.createImageData(w, h), o = out.data;
  let keyed = 0;
  for (let p = 0; p < n; p++) { const x = p % w, y = (p - x) / w; if (x < band || y < band || x >= w - band || y >= h - band) seen[p] = 1; }
  for (let p = 0; p < n; p++) {
    const x = p % w, edge = !seen[p] && ((x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (p >= w && seen[p - w]) || (p + w < n && seen[p + w]));
    o[p * 4 + 3] = seen[p] ? 0 : edge ? 128 : 255;
    if (seen[p]) keyed++;
  }
  return { mask: out, keyed: keyed / n };
}

async function scanOf(src) {
  const path = join(DL, src.file);
  const bytes = existsSync(path) ? readFileSync(path) : await fetchBytesWithRetry(src.url, { onRetry: (e, n) => console.warn(`retry ${n}: ${e.message}`) });
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== src.sha256) throw new Error(`${src.file}: sha256 ${got} does not match the manifest (${src.sha256})`);
  if (!existsSync(path)) { mkdirSync(DL, { recursive: true }); writeFileSync(path, bytes); } // a bad fetch never reaches disk
  return bytes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(readFileSync(join(ROOT, 'scripts', 'sources.json'), 'utf8')).sources;
  const md = readFileSync(join(ROOT, 'docs', 'atlas', 'ornaments.md'), 'utf8');
  mkdirSync(OUT, { recursive: true });
  const overlays = [];
  for (const c of CHARTS) {
    const src = sources.find((s) => s.id === c.source);
    const img = await loadImage(await scanOf(src));
    const scale = c.scale, fw = Math.round(img.width / scale), fh = Math.round(img.height / scale);
    const canvas = createCanvas(fw, fh), g = canvas.getContext('2d');
    g.drawImage(img, 0, 0, fw, fh);
    writeFileSync(join(OUT, c.file), canvas.toBuffer('image/jpeg', 80));
    const { mask, keyed } = paperMask(g, fw, fh), maskFile = `${c.id}-mask.png`;
    const mc = createCanvas(fw, fh); mc.getContext('2d').putImageData(mask, 0, 0);
    if (keyed > 0) writeFileSync(join(OUT, maskFile), mc.toBuffer('image/png'));
    const pieces = c.pieces(md).map(([x0, x1, fit]) => [x0, x1 ?? img.width, fit]);
    const parallels = c.parallels && redLines(g, fw, fh, c.parallels.length).map((l, i) => ({ lat: c.parallels[i], from: l.from.map((v) => v * scale), to: l.to.map((v) => v * scale) }));
    const { sheet, snaps } = sheetPlacements(pieces, c.snaps, img.width, img.height, parallels);
    overlays.push({
      id: c.id, title: c.title, source: src.page ?? src.url, licence: src.rights, file: c.file, ...(keyed > 0 && { mask: maskFile }),
      width: img.width, height: img.height, scale, sheet, snaps, ...(parallels && { parallels }),
      pieces: pieces.map(([x0, x1, fit]) => ({ x0, x1, fit })),
    });
    console.log(`${c.id}: ${fw} x ${fh} from ${img.width} x ${img.height}, paper ${(keyed * 100).toFixed(1)}%${parallels ? `, parallels ${parallels.map((l) => `${l.lat}° at y ${l.from[1]} to ${l.to[1]}`).join('; ')}` : ''}, sheet ${sheet.scale.toFixed(4)} °/px turn ${sheet.turn.toFixed(2)}°`);
  }
  writeFileSync(join(OUT, 'overlays.json'), `${JSON.stringify({ overlays }, null, 2)}\n`);
}
