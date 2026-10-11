#!/usr/bin/env node
// Adds the browser preview to _site/preview/ (run after build:demo, which clears _site):
// the page, the shared scene module, the sprite packs, and the Natural Earth GeoJSON and font
// the page fetches, vendored so nothing loads from a CDN. Sources come from downloads/ and are
// fetched from the pinned URLs in ASSETS.md when missing, then checked against their sha256.

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '_site', 'preview');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const SOURCES = [
  [`${NE}/ne_50m_coastline.geojson`, 'ne_50m_coastline.geojson', '271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283', 'geo'],
  [`${NE}/ne_50m_land.geojson`, 'ne_50m_land.geojson', 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b', 'geo'],
  [`${NE}/ne_50m_populated_places_simple.geojson`, 'ne_50m_populated_places_simple.geojson', '8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978', 'geo'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/IMFeENrm28P.ttf', 'IMFeENrm28P.ttf', 'fe9705bbde51af802719246d4608d08d37bde956ab99d9a590da996a5221a24c', 'font'],
];

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
await cp(path.join(root, 'public'), out, { recursive: true });
await cp(path.join(root, 'scripts', 'scene.mjs'), path.join(out, 'scene.mjs'));
await cp(path.join(root, 'packs'), path.join(out, 'packs'), { recursive: true });
console.log(`preview assembled in ${path.relative(root, out)}/`);
