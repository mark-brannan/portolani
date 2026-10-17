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
import { mkdtemp } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { buildLearn } from './learn.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export const DATA_URL = 'https://mark-brannan.github.io/portolani/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.geojson': 'application/geo+json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

// URL path -> local file, by the layout build-preview.mjs writes into _site/. Only the prefixes in
// `remote` go to the published site: anything else missing is a 404 here, as it would be on Pages.
export function routes({ learn, site }) {
  if (site) return { local: [['', site]], remote: [] };
  return {
    local: [['coast-wright/', path.join(root, 'node_modules', 'coast-wright', 'lib')],
      ['coastlines/catalogue.json', path.join(root, 'node_modules', 'coastlines', 'catalogue.json')],
      ['packs/', path.join(root, 'packs')], ['learn/', path.join(learn, 'learn')], ['font/', path.join(root, 'downloads')],
      ['', path.join(root, 'public')], ['', path.join(root, 'scripts')]],
    remote: ['geo/', 'font/'],
  };
}

function localFile(table, rel) {
  for (const [prefix, base] of table) {
    if (!rel.startsWith(prefix) && rel !== prefix.replace(/\/$/, '')) continue;
    const rest = rel.slice(prefix.length), file = rest ? path.join(base, rest) : base;
    if (file !== base && !file.startsWith(base + path.sep)) continue; // no climbing out of the base
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export function devServer({ learn, site, data = DATA_URL }) {
  const { local, remote } = routes({ learn, site });
  return createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = localFile(local, rel.endsWith('/') ? `${rel}index.html` : rel);
    if (file) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      return createReadStream(file).pipe(res);
    }
    if (remote.some((p) => rel.startsWith(p))) {
      try {
        const up = await fetch(new URL(rel, data));
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
    await buildLearn(root, learn);
  }
  devServer({ learn, site, data }).listen(port, 'localhost', () => {
    console.log(`portolani on http://localhost:${port}/ (${site ? 'the built _site/' : `this checkout's sources; geo/ and font/ from ${data}`})`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
