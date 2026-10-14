#!/usr/bin/env node
// Times the built preview (_site/, `npm run build:preview`) in headless Chromium at tablet size,
// 1024x768: a full redraw (placement, parchment and draw) and a pan frame (land and coast only),
// at each zoom given, over a coastal spot. Needs playwright-core and its Chromium, which the repo
// does not depend on: `npm i --prefix /some/dir playwright-core && npx --prefix /some/dir
// playwright-core install chromium-headless-shell`, then
//   PLAYWRIGHT=/some/dir/node_modules/playwright-core/index.mjs node scripts/measure-preview.mjs [lat lon [zooms]]
// Times are what the page reports (performance.now around the work), so they leave out the
// browser's compositing after the call returns.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
const site = fileURLToPath(new URL('../_site/', import.meta.url));
const [lat = 44.41, lon = 8.93] = process.argv.slice(2, 4).map(Number);
const zooms = (process.argv[4] ?? '9,10,11').split(',').map(Number);
const REDRAWS = 5, DRAGS = 3, MOVES = 20;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const fetched = new Map(); // path -> bytes, per page load
const server = createServer(async (req, res) => {
  let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.endsWith('/')) p = path.join(p, 'index.html');
  try {
    const body = await readFile(p);
    fetched.set(req.url, body.length);
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const stat = (a) => `${median(a).toFixed(0)} / ${Math.max(...a).toFixed(0)}`;
const num = (re, s) => Number(re.exec(s)?.[1]);

const browser = await chromium.launch();
const rows = [];
for (const zoom of zooms) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  fetched.clear();
  await page.addInitScript(() => {
    window.statuses = [];
    addEventListener('DOMContentLoaded', () => new MutationObserver(() => window.statuses.push(document.getElementById('status').textContent))
      .observe(document.getElementById('status'), { childList: true, characterData: true, subtree: true }));
  });
  const done = async (n) => { await page.waitForFunction((k) => window.statuses.filter((s) => s.includes('total')).length >= k, n, { timeout: 60000 }); };
  await page.goto(`${base}#map=${zoom}/${lat}/${lon}`);
  await done(1);
  const firstText = (await page.evaluate(() => window.statuses)).find((s) => s.includes('total'));
  const bytes = [...fetched].filter(([u]) => u.includes('/geo/10m/')).reduce((s, [, b]) => s + b, 0);
  for (let i = 0; i < REDRAWS; i++) {
    await page.evaluate(() => document.getElementById('density').dispatchEvent(new Event('input')));
    await done(2 + i);
  }
  const redraws = (await page.evaluate(() => window.statuses)).filter((s) => s.includes('total')).slice(1).map((s) => num(/total (\d+)/, s));

  const box = await page.locator('#map').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.evaluate(() => { window.statuses = []; });
  // Each move is a pointer event, then two animation frames: the first draws the moved map, the
  // second comes once that frame is painted. Their span, from the event, is the frame as felt.
  let placed = 0;
  const spans = [];
  for (let d = 0; d < DRAGS; d++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    spans.push(...await page.evaluate(async ({ cx, cy, dir, moves }) => {
      const canvas = document.getElementById('map'), out = [];
      for (let i = 1; i <= moves; i++) {
        const t = performance.now();
        canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: cx + dir * i * 6, clientY: cy + i * 2, bubbles: true }));
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        out.push(performance.now() - t);
      }
      return out;
    }, { cx, cy, dir: d % 2 ? -1 : 1, moves: MOVES }));
    await page.mouse.up();
    await done(++placed); // let it place again before the next drag
  }
  const frames = (await page.evaluate(() => window.statuses)).map((s) => num(/frame (\d+) ms/, s)).filter(Number.isFinite);
  rows.push({ zoom, spans, first: num(/total (\d+)/, firstText), load: num(/load (\d+)/, firstText), redraws, frames, bytes });
  await page.close();
}
await browser.close();
server.close();

console.log(`| Zoom | First draw, ms (of it, data load) | Redraw, ms: median / worst (${REDRAWS} runs) | Pan frame drawn, ms: median / worst | Pan frame painted, ms: median / worst (n) | 10m cells fetched |`);
console.log('| ---: | ---: | ---: | ---: | ---: | ---: |');
for (const r of rows) {
  console.log(`| z${r.zoom} | ${r.first} (${r.load}) | ${stat(r.redraws)} | ${stat(r.frames)} | ${stat(r.spans)} (${r.spans.length}) | ${r.bytes ? `${(r.bytes / 1024).toFixed(0)} KB` : '–'} |`);
}
