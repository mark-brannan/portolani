// The dev server serves this checkout's page, scene modules and packs, and sends geo/ to the data
// site, here a local stand-in so the test runs offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { devServer, upstream } from '../scripts/dev.mjs';

const listen = (server) => new Promise((ok) => server.listen(0, 'localhost', () => ok(`http://localhost:${server.address().port}/`)));

test('serves the sources and fetches geo/ from the data site', async (t) => {
  const data = createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ from: req.url })); });
  const dataUrl = await listen(data);
  const dev = devServer({ learn: await mkdtemp(path.join(os.tmpdir(), 'dev-test-')), data: dataUrl.replace(/\/$/, '') }); // no trailing slash, as a hand-typed --data
  const at = await listen(dev);
  t.after(() => { dev.close(); data.close(); });
  const get = (p) => fetch(new URL(p, at));

  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<script type="module" src="page.js">/);
  assert.match((await get('/scene.mjs')).headers.get('content-type'), /javascript/);
  assert.equal((await get('/coast-wright/index.js')).status, 200);
  assert.equal((await get('/coastlines/catalogue.json')).status, 200);
  assert.equal((await get('/coastlines/lib/provider.js')).status, 200); // scene.mjs draws through it, as the import map names it
  assert.equal((await get('/packs/debry/pack.json')).status, 200);
  assert.equal((await get('/data/voyages/index.json')).status, 200);
  assert.deepEqual(await (await get('/geo/f/index.json')).json(), { from: '/geo/f/index.json' });
  assert.equal((await get('/water.mjs')).status, 200); // reached from scene.mjs by import, so Pages has it
  assert.equal((await get('/build-preview.mjs')).status, 404); // in scripts/ but not reached, so Pages lacks it, and so does dev
  assert.equal((await get('/learn/')).status, 200); // rendered on request
  const build = await (await get('/build.json')).json(); // the checkout's commit, for the page's corner
  assert.match(build.sha, /^[0-9a-f]{40}$/);
  assert.equal(build.built, undefined); // nothing was built
  assert.equal((await get('/nothing.mjs')).status, 404); // a missing module is not fetched from the site
  assert.equal((await get('/%2e%2e/package.json')).status, 404);
  assert.equal((await get('/%E0')).status, 400); // a malformed escape is a bad request, not a crash
  assert.equal((await get('/')).status, 200); // and the server is still up
});

test('upstream URLs keep the data site\'s host and base path', () => {
  assert.equal(upstream('geo/f/index.json', 'https://host/portolani/').href, 'https://host/portolani/geo/f/index.json');
  assert.equal(upstream('geo/f/index.json', 'https://host/portolani').href, 'https://host/portolani/geo/f/index.json');
  assert.equal(upstream("geo/../../etc/passwd", "https://host/portolani/").href, "https://host/portolani/etc/passwd");
  assert.equal(upstream('geo/a b.json', 'https://host/portolani/').href, 'https://host/portolani/geo/a%20b.json');
  assert.equal(upstream('geo//evil.com/x', 'https://host/portolani/').host, 'host');
});
