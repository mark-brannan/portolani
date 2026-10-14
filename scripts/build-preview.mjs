#!/usr/bin/env node
// Assembles the browser preview into _site/, the Pages root:
// the page, the shared scene module and coast-wright, the sprite packs, the Natural Earth GeoJSON
// from coastlines (checked against its manifest) and the font, vendored so nothing loads from a
// CDN. The font comes from downloads/, fetched from its pinned URL when missing, then checked
// against its sha256; the URLs and hashes below duplicate the ASSETS.md table: re-pin both
// together. The GeoJSON is cut to the scene's frame plus a degree beyond the scene's own margin,
// since the world-wide files are almost all off screen.

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FRAME, MARGIN, COAST_RUN } from './scene.mjs';
import { clipToBox } from './clip-geo.mjs';
import { find, localUrl } from 'coastlines';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '_site');
const GEO = ['ne-land-50m', 'ne-coastline-50m', 'ne-populated-places-50m'];

const SOURCES = [
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/IMFeENrm28P.ttf', 'IMFeENrm28P.ttf', 'fe9705bbde51af802719246d4608d08d37bde956ab99d9a590da996a5221a24c', 'font'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/OFL.txt', 'OFL-IMFellEnglish.txt', '2a3ca501fc4d5efcad9798531e3e06962b1e20c60e464f6cbd6c17630112c773', 'font'],
];

// A degree wider than the scene's own margin, so the scene keeps and drops the same features.
const BOX = { x0: FRAME.lonMin - MARGIN - 1, x1: FRAME.lonMax + MARGIN + 1, y0: FRAME.latMin - MARGIN - 1, y1: FRAME.latMax + MARGIN + 1 };

await mkdir(path.join(root, 'downloads'), { recursive: true });
for (const [url, name, sha, dir] of SOURCES) {
  const file = path.join(root, 'downloads', name);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const got = createHash('sha256').update(await readFile(file)).digest('hex');
  if (got !== sha) throw new Error(`${name}: sha256 ${got} does not match ASSETS.md (${sha})`);
  await mkdir(path.join(out, dir), { recursive: true });
  await cp(file, path.join(out, dir, name));
}
await mkdir(path.join(out, 'geo'), { recursive: true });
for (const id of GEO) {
  const entry = find(id), bytes = await readFile(localUrl(entry));
  const got = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (got !== entry.sha256) throw new Error(`${id}: ${got} does not match the coastlines manifest (${entry.sha256})`);
  await writeFile(path.join(out, 'geo', `${id}.geojson`), JSON.stringify(clipToBox(JSON.parse(bytes), BOX, { run: COAST_RUN })));
}
await cp(path.join(root, 'node_modules', 'coast-wright', 'lib'), path.join(out, 'coast-wright'), { recursive: true });
await cp(path.join(root, 'public'), out, { recursive: true });
await cp(path.join(root, 'scripts', 'scene.mjs'), path.join(out, 'scene.mjs'));
await cp(path.join(root, 'packs'), path.join(out, 'packs'), { recursive: true });
console.log(`preview assembled in ${path.relative(root, out)}/`);
