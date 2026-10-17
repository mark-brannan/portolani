// The dev server serves this checkout's page, scene modules and packs, and sends geo/ to the data
// site, here a local stand-in so the test runs offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { devServer } from '../scripts/dev.mjs';

const listen = (server) => new Promise((ok) => server.listen(0, 'localhost', () => ok(`http://localhost:${server.address().port}/`)));

test('serves the sources and fetches geo/ from the data site', async (t) => {
  const data = createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ from: req.url })); });
  const dataUrl = await listen(data);
  const dev = devServer({ learn: await mkdtemp(path.join(os.tmpdir(), 'dev-test-')), data: dataUrl });
  const at = await listen(dev);
  t.after(() => { dev.close(); data.close(); });
  const get = (p) => fetch(new URL(p, at));

  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<script type="module" src="page.js">/);
  assert.match((await get('/scene.mjs')).headers.get('content-type'), /javascript/);
  assert.equal((await get('/coast-wright/index.js')).status, 200);
  assert.equal((await get('/coastlines/catalogue.json')).status, 200);
  assert.equal((await get('/packs/debry/pack.json')).status, 200);
  assert.deepEqual(await (await get('/geo/f/index.json')).json(), { from: '/geo/f/index.json' });
  assert.equal((await get('/nothing.mjs')).status, 404); // a missing module is not fetched from the site
  assert.equal((await get('/%2e%2e/package.json')).status, 404);
});
