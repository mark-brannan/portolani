#!/usr/bin/env node
// Assembles the browser preview into _site/, the Pages root:
// the page, the shared scene module, the sprite packs, and the Natural Earth GeoJSON and font
// the page fetches, vendored so nothing loads from a CDN. Sources come from downloads/ and are
// fetched from the pinned URLs when missing, then checked against their sha256. The URLs and
// hashes below duplicate the ASSETS.md table: re-pin both together. The GeoJSON is cut to the
// scene's frame plus a margin, since the world-wide files are almost all off screen.

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FRAME } from './scene.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '_site');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const SOURCES = [
  [`${NE}/ne_50m_coastline.geojson`, 'ne_50m_coastline.geojson', '271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283', 'geo'],
  [`${NE}/ne_50m_land.geojson`, 'ne_50m_land.geojson', 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b', 'geo'],
  [`${NE}/ne_50m_populated_places_simple.geojson`, 'ne_50m_populated_places_simple.geojson', '8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978', 'geo'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/IMFeENrm28P.ttf', 'IMFeENrm28P.ttf', 'fe9705bbde51af802719246d4608d08d37bde956ab99d9a590da996a5221a24c', 'font'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/OFL.txt', 'OFL-IMFellEnglish.txt', '2a3ca501fc4d5efcad9798531e3e06962b1e20c60e464f6cbd6c17630112c773', 'font'],
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
  if (dir === 'geo') await writeFile(path.join(out, dir, name), JSON.stringify(clipToFrame(JSON.parse(await readFile(file, 'utf8')))));
  else await cp(file, path.join(out, dir, name));
}
// Wider than the scene's own 2-degree margin, so the scene keeps and drops the same features.
function clipToFrame(geo, margin = 3) {
  const box = { x0: FRAME.lonMin - margin, x1: FRAME.lonMax + margin, y0: FRAME.latMin - margin, y1: FRAME.latMax + margin };
  const inside = ([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  const features = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === 'Point') { if (inside(g.coordinates)) features.push(f); continue; }
    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
        .map((rings) => rings.map((r) => clipRing(r, box)).filter((r) => r.length >= 4))
        .filter((rings) => rings.length);
      if (polys.length) features.push({ ...f, geometry: { type: 'MultiPolygon', coordinates: polys } });
      continue;
    }
    const lines = (g.type === 'LineString' ? [g.coordinates] : g.coordinates).flatMap((l) => clipLine(l, inside));
    if (lines.length) features.push({ ...f, geometry: { type: 'MultiLineString', coordinates: lines } });
  }
  return { ...geo, features };
}

// Sutherland-Hodgman against each edge of the box; returns a closed ring.
function clipRing(ring, box) {
  const edges = [
    [(p) => p[0] >= box.x0, (a, b) => at(a, b, 0, box.x0)], [(p) => p[0] <= box.x1, (a, b) => at(a, b, 0, box.x1)],
    [(p) => p[1] >= box.y0, (a, b) => at(a, b, 1, box.y0)], [(p) => p[1] <= box.y1, (a, b) => at(a, b, 1, box.y1)],
  ];
  let pts = ring.slice(0, -1);
  for (const [keep, cross] of edges) {
    const next = [];
    pts.forEach((p, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (keep(p)) { if (!keep(prev)) next.push(cross(prev, p)); next.push(p); } else if (keep(prev)) next.push(cross(prev, p));
    });
    pts = next;
    if (!pts.length) return [];
  }
  return [...pts, pts[0]];
}

function at(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

// Runs of points inside the box, each with its neighbours outside so boundary segments survive.
function clipLine(line, inside) {
  const runs = [];
  let run = null;
  line.forEach((p, i) => {
    if (inside(p)) {
      if (!run) { run = i > 0 ? [line[i - 1]] : []; runs.push(run); }
      run.push(p);
    } else if (run) { run.push(p); run = null; }
  });
  return runs.filter((r) => r.length >= 2);
}

await cp(path.join(root, 'public'), out, { recursive: true });
await cp(path.join(root, 'scripts', 'scene.mjs'), path.join(out, 'scene.mjs'));
await cp(path.join(root, 'packs'), path.join(out, 'packs'), { recursive: true });
console.log(`preview assembled in ${path.relative(root, out)}/`);
