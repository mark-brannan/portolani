#!/usr/bin/env node
// A dev server for the browser preview: serves this checkout's page, scene modules, coast-wright and
// sprite packs as they stand, with no build, so a PR's "Try it" paste paints in seconds. The data
// the build cuts (geo/, the cells and GeoJSON; font/, the pinned downloads) changes seldom and costs
// a long build to make, so it is fetched from the published site instead. A PR that changes how the
// data is cut passes --build: the full build:preview runs and its _site/ is served as Pages would.
//
//   npm run dev -- --port 10197 [--build] [--data <url>]

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { buildLearn } from './learn.mjs';
import { relativeImports } from './scene-modules.mjs';
import { buildInfo } from './build-info.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export const DATA_URL = 'https://mark-brannan.github.io/portolani/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.geojson': 'application/geo+json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

// URL path -> local file, by the layout build-preview.mjs writes into _site/: the scene modules land
// over public/, so on a name clash scripts/ wins, and only the modules scene.mjs reaches by import
// are there at all (`only`, checked per request so a new import shows without a restart). Only the
// prefixes in `remote` go to the published site: anything else missing is a 404 here, as on Pages.
export function routes({ learn, site }) {
  if (site) return { local: [['', site]], remote: [] };
  return {
    local: [['coast-wright/', path.join(root, 'node_modules', 'coast-wright', 'lib')],
      ['coastlines/catalogue.json', path.join(root, 'node_modules', 'coastlines', 'catalogue.json')],
      ['coastlines/lib/provider.js', path.join(root, 'node_modules', 'coastlines', 'lib', 'provider.js')],
      ['packs/', path.join(root, 'packs')], ['data/', path.join(root, 'data')], ['learn/', path.join(learn, 'learn')], ['font/', path.join(root, 'downloads')],
      ['', path.join(root, 'scripts'), { only: () => relativeImports(root) }], ['', path.join(root, 'public')]],
    remote: ['geo/', 'font/'],
  };
}

async function localFile(table, rel) {
  for (const [prefix, base, { only } = {}] of table) {
    if (!rel.startsWith(prefix) && rel !== prefix.replace(/\/$/, '')) continue;
    const rest = rel.slice(prefix.length), file = rest ? path.join(base, rest) : base;
    if (file !== base && !file.startsWith(base + path.sep)) continue; // no climbing out of the base
    if (only && !(await only()).has(rest)) continue;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

// The upstream URL for a remote path: the data site's own origin and base path, then the request's
// segments, each one encoded, so no request can name another host or climb above the base. A --data
// typed without its trailing slash gets one, or `new URL` would drop its last segment.
export function upstream(rel, data) {
  const base = new URL(data.replace(/\/?$/, '/')), segments = path.posix.normalize(`/${rel}`).split('/').filter(Boolean);
  const url = new URL(base);
  url.pathname = base.pathname + segments.map(encodeURIComponent).join('/');
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`${rel}: outside ${data}`);
  return url;
}

export function devServer({ learn, site, data = DATA_URL }) {
  const { local, remote } = routes({ learn, site });
  return createServer(async (req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'; } catch {
      res.writeHead(400, { 'content-type': 'text/plain' });
      return res.end('bad path\n');
    }
    if (learn && rel.startsWith('learn/')) { // the Learn pages render live, like every other route
      try { await buildLearn(root, learn); } catch (e) { res.writeHead(500, { 'content-type': 'text/plain' }); return res.end(`learn: ${e.message}\n`); }
    }
    if (rel === 'build.json' && !site) { // the checkout's commit, read on each request; no build time, as nothing was built
      const info = buildInfo(root);
      res.writeHead(info ? 200 : 404, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      return res.end(info ? JSON.stringify(info) : '');
    }
    const file = await localFile(local, rel.endsWith('/') ? `${rel}index.html` : rel);
    if (file) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      return createReadStream(file).pipe(res);
    }
    if (remote.some((p) => rel.startsWith(p))) {
      try {
        const up = await fetch(upstream(rel, data));
        res.writeHead(up.status, { 'content-type': up.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'max-age=3600' });
        return up.body ? Readable.fromWeb(up.body).pipe(res) : res.end();
      } catch (e) {
        res.writeHead(502, { 'content-type': 'text/plain' });
        return res.end(`${rel}: ${e.cause?.code ?? e.message} fetching from ${data}\n`);
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`${rel}: not found\n`);
  });
}

async function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
  const port = Number(arg('--port') ?? argv.find((a) => /^\d+$/.test(a)) ?? 8080);
  const data = arg('--data') ?? DATA_URL;
  let site, learn;
  if (argv.includes('--build')) {
    const built = spawnSync(process.execPath, ['--max-old-space-size=6144', path.join(root, 'scripts', 'build-preview.mjs')], { stdio: 'inherit' });
    if (built.status !== 0) process.exit(built.status ?? 1);
    site = path.join(root, '_site');
  } else {
    learn = await mkdtemp(path.join(os.tmpdir(), 'portolani-learn-'));
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => rm(learn, { recursive: true, force: true }).then(() => process.exit(0)));
  }
  devServer({ learn, site, data }).listen(port, 'localhost', () => {
    console.log(`portolani on http://localhost:${port}/ (${site ? 'the built _site/' : `this checkout's sources; geo/ and font/ from ${data}`})`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
