// Builds packs/overlays/people/: each picture of a person in data/voyages/people.json (`images`) shrunk for the site, and
// people.json, the manifest the page reads (the picture's file on the site, its size, its Commons page). The pictures
// lie on the map as sheets, as the charts' scans do (scripts/overlays.mjs), so they live beside them. The sights'
// pictures (data/sights/pictures.json) are built the same way into packs/overlays/sights/, with sights.json their manifest.
//
// Usage: npm run people
//
// Each file is looked up through the Commons API (its licence must still read as the record says, and the original's
// sha1 is kept in the manifest, so a file changed upstream shows in the diff), and the API's thumbnail, at most 800 px a
// side, is downloaded once into downloads/people/ and reused after. A picture already in the manifest under the same sha1
// is not fetched again.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBytesWithRetry } from './fetch-retry.mjs';
import { pictureName, peopleOf, sightPicturesOf, PEOPLE_FILE, SIGHT_PICTURES_FILE } from './people.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads', 'people'), OVERLAYS = join(ROOT, 'packs', 'overlays');
const API = 'https://commons.wikimedia.org/w/api.php';
const AGENT = { 'User-Agent': 'portolani-build (https://github.com/mark-brannan/portolani)' };
const LONG = 640; // the long side of a picture on the site, px

// What the Commons API says of `titles`: { [title]: { url, thumb, sha1, licence } }, null for one it does not have
async function lookUp(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 40) {
    const q = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|sha1|extmetadata', iiextmetadatafilter: 'LicenseShortName', iiurlwidth: '800', iiurlheight: '800', titles: titles.slice(i, i + 40).join('|') });
    const j = JSON.parse(String(await fetchBytesWithRetry(`${API}?${q}`, { fetchImpl: (u) => fetch(u, { headers: AGENT }) })));
    const from = Object.fromEntries((j.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(j.query.pages)) {
      const ii = p.imageinfo?.[0], t = from[p.title] ?? p.title;
      out[t] = ii ? { url: ii.descriptionurl, thumb: ii.thumburl ?? ii.url, sha1: ii.sha1, licence: ii.extmetadata?.LicenseShortName?.value } : null;
    }
  }
  return out;
}

// One set of pictures built into packs/overlays/<dir>/ with its manifest <dir>/<dir>.json: `wanted` the image records,
// each with `title` (its Commons title) and `owner` (whose it is, for the log). Returns the problems found.
async function buildSet(dir, wanted) {
  const out = join(OVERLAYS, dir), manifestPath = join(out, `${dir}.json`);
  const before = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).pictures : {};
  const names = new Map();
  for (const w of wanted) { const n = pictureName(w.file); if (names.has(n) && names.get(n) !== w.file) throw new Error(`${w.file} and ${names.get(n)} would both be built as ${n}`); names.set(n, w.file); }
  const api = await lookUp([...new Set(wanted.map((w) => w.title))]);
  mkdirSync(DL, { recursive: true }); mkdirSync(out, { recursive: true });
  const pictures = {}, problems = [];
  for (const w of wanted) {
    const a = api[w.title];
    if (!a) { problems.push(`${w.file}: not on Commons`); continue; }
    if (a.licence !== w.licence) { problems.push(`${w.file}: Commons says ${a.licence}, the record ${w.licence}`); continue; }
    const name = pictureName(w.file), file = join(out, name);
    if (before[w.file]?.sha1 === a.sha1 && existsSync(file)) { pictures[w.file] = before[w.file]; continue; }
    const cached = join(DL, `${a.sha1}.img`);
    const bytes = existsSync(cached) ? readFileSync(cached) : await fetchBytesWithRetry(a.thumb, { fetchImpl: (u) => fetch(u, { headers: AGENT }), onRetry: (e, n) => console.warn(`retry ${n}: ${e.message}`) });
    if (!existsSync(cached)) writeFileSync(cached, bytes);
    const img = await loadImage(bytes), k = Math.min(1, LONG / Math.max(img.width, img.height));
    const width = Math.round(img.width * k), height = Math.round(img.height * k);
    const c = createCanvas(width, height), g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, width, height); // a transparent PNG on paper, as it shows on its page
    g.drawImage(img, 0, 0, width, height);
    writeFileSync(file, c.toBuffer('image/jpeg', 82));
    pictures[w.file] = { src: `${dir}/${name}`, width, height, page: a.url, sha1: a.sha1 };
    console.log(`${w.owner}: ${name} ${width} x ${height}`);
  }
  writeFileSync(manifestPath, `${JSON.stringify({ pictures }, null, 2)}\n`);
  return problems;
}
const titled = (im, owner) => ({ ...im, title: `File:${im.file.replace(/_/g, ' ')}`, owner });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const people = peopleOf(JSON.parse(readFileSync(join(ROOT, PEOPLE_FILE), 'utf8')));
  const sights = existsSync(join(ROOT, SIGHT_PICTURES_FILE)) ? sightPicturesOf(JSON.parse(readFileSync(join(ROOT, SIGHT_PICTURES_FILE), 'utf8'))) : {};
  const problems = [
    ...await buildSet('people', people.flatMap((p) => p.images.map((im) => titled(im, p.id)))),
    ...await buildSet('sights', Object.entries(sights).flatMap(([name, list]) => list.map((im) => titled(im, name)))),
  ];
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
}
