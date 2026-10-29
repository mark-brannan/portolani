// Builds packs/scans/: every chart in data/charts/*.json whose `scan` is shippable (public domain or an open licence),
// downloaded into downloads/ when missing, checked against its sha256 and shrunk so its long side is at most LONG px.
// A scan is the raw material for an overlay: placing it (its sheet, snaps and pieces) is build-overlays.mjs's work, done
// chart by chart; until then the catalogue's `bbox` is a rough frame of what the chart shows.
//
// Usage: npm run scans            (every shippable scan)
//        npm run scans -- <id>... (only those)
//        npm run scans -- --hash  (download, print each sha256 to paste into the catalogue, write nothing else)

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBytesWithRetry } from './fetch-retry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads'), OUT = join(ROOT, 'packs', 'scans'), CAT = join(ROOT, 'data', 'charts');
export const LONG = 4000;

// Every catalogue entry, from every file in data/charts/, in file order
export function catalogue(dir = CAT) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).charts);
}

// A scan the site may carry: an image URL, a checksum and an open licence
export const shippable = (c) => Boolean(c.scan?.url && c.status === 'ship');

// The size a scan is shrunk to: its long side at most `long`, never enlarged
export function shrunk(w, h, long = LONG) {
  const k = Math.min(1, long / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
}

async function bytesOf(scan, hashOnly) {
  const name = decodeURIComponent(scan.url.split('/').pop()), path = join(DL, name);
  const bytes = existsSync(path) ? readFileSync(path) : await fetchBytesWithRetry(scan.url);
  const got = createHash('sha256').update(bytes).digest('hex');
  if (!hashOnly && got !== scan.sha256) throw new Error(`${name}: sha256 ${got} does not match the catalogue (${scan.sha256})`);
  if (!existsSync(path)) { mkdirSync(DL, { recursive: true }); writeFileSync(path, bytes); }
  return { bytes, got };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), hashOnly = args.includes('--hash'), only = args.filter((a) => !a.startsWith('--'));
  const charts = catalogue().filter(shippable).filter((c) => !only.length || only.includes(c.id));
  mkdirSync(OUT, { recursive: true });
  for (const c of charts) {
    const { bytes, got } = await bytesOf(c.scan, hashOnly);
    if (hashOnly) { console.log(`${c.id}\t${got}`); continue; }
    const img = await loadImage(bytes), [w, h] = shrunk(img.width, img.height);
    const canvas = createCanvas(w, h);
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    writeFileSync(join(OUT, `${c.id}.jpg`), canvas.toBuffer('image/jpeg', 80));
    console.log(`${c.id}: ${w} x ${h} from ${img.width} x ${img.height}`);
  }
}
