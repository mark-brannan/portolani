// Builds packs/overlays/: each chart's scan at half size and overlays.json, its pieces and their fits
// (scripts/overlays.mjs, docs/overlay/README.md). The scan is downloaded into downloads/ when missing and
// checked against the sha256 in scripts/sources.json, as build-packs.mjs does.
//
// Usage: npm run overlays
//
// The Carta Marina's two fits are refitted from the figures table in docs/atlas/ornaments.md ("Carta
// Marina, 1539"): every row gives a figure's scan px and the lon, lat its side's fit put it at, so a
// least-squares similarity through a side's rows gives back that side's fit.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBytesWithRetry } from './fetch-retry.mjs';
import { similarityFit } from './overlays.mjs';

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
// One side's similarity, refitted from its rows
export function fitOf(rows, side) {
  const { a, b, tx, ty } = similarityFit(rows.filter((r) => r.fit === side).map((r) => [r.px, r.ll]));
  return { a, b, tx, ty };
}

const CHARTS = [{ id: 'carta-marina', title: 'Carta Marina, Olaus Magnus, 1539', source: 'carta-marina', file: 'carta-marina.jpg', split: 2700 }];

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
  const rows = figureRows(readFileSync(join(ROOT, 'docs', 'atlas', 'ornaments.md'), 'utf8'));
  mkdirSync(OUT, { recursive: true });
  const overlays = [];
  for (const c of CHARTS) {
    const src = sources.find((s) => s.id === c.source);
    const img = await loadImage(await scanOf(src));
    const scale = 2, fw = Math.round(img.width / scale), fh = Math.round(img.height / scale);
    const canvas = createCanvas(fw, fh);
    canvas.getContext('2d').drawImage(img, 0, 0, fw, fh);
    writeFileSync(join(OUT, c.file), canvas.toBuffer('image/jpeg', 80));
    overlays.push({
      id: c.id, title: c.title, source: src.page ?? src.url, licence: src.rights, file: c.file,
      width: img.width, height: img.height, scale,
      pieces: [{ x0: 0, x1: c.split, fit: fitOf(rows, 'west') }, { x0: c.split, x1: img.width, fit: fitOf(rows, 'baltic') }],
    });
    console.log(`${c.id}: ${fw} x ${fh} from ${img.width} x ${img.height}; ${rows.length} figures`);
  }
  writeFileSync(join(OUT, 'overlays.json'), `${JSON.stringify({ overlays }, null, 2)}\n`);
}
