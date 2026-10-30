#!/usr/bin/env node
// A contact sheet of every fly: one Playwright shot at 1100 px wide per person (from the People drawer) and per voyage
// (from the Voyages drawer), each taken once its flight has landed with the drawer that launched it open, labelled with
// the name and the zoom it landed at (docs/zoom-floor/contact-sheet.png). The user walks it to judge each framing.
//
//   node scripts/zoom-floor-sheet.mjs [--url http://localhost:10901/] [--out docs/zoom-floor/contact-sheet.png] [--only id,id] [--tiles dir] [--workers 3]
//
// Each shot is kept in --tiles (default: zoom-floor-tiles under the system temp dir) and the sheet is laid from every kept
// shot, so `--only` re-shoots just those ids (one that timed out) and the rest of the sheet stays as it was. geo/ and font/
// are cached there too, so the published site is asked for each file once, not on every page load.
//
// Without --url it serves this checkout with scripts/dev.mjs on a free port (geo/ from the published site, so it needs
// the network). Needs playwright-core and a Chromium (`npx playwright-core install chromium-headless-shell`).

import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { chromium } from 'playwright-core';
import { peopleOf } from './people.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const out = path.resolve(root, arg('out') ?? 'docs/zoom-floor/contact-sheet.png'), only = arg('only')?.split(',') ?? null;
const workers = Math.max(1, Number(arg('workers') ?? 3)); // pages shot at once; 1 on a loaded machine
const tiles = path.resolve(arg('tiles') ?? path.join(tmpdir(), 'zoom-floor-tiles'));
const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const index = read('data/voyages/index.json');
const who = Object.fromEntries(index.map((id) => [id, read(`data/voyages/${id}.json`).who ?? []]));
const all = [
  ...peopleOf(read('data/voyages/people.json'), who).map((p) => ({ kind: 'person', id: p.id, name: p.name, drawer: 'peoplePanel', button: 'people', sel: `[data-person="${p.id}"]` })),
  ...index.map((id) => ({ kind: 'voyage', id, name: read(`data/voyages/${id}.json`).short ?? id, drawer: 'voyagesPanel', button: 'voyages', sel: `[data-voyage="${id}"]` })),
];
const items = all.filter((i) => !only || only.includes(i.id));
if (!items.length) { console.error(`no person or voyage matches --only ${only}`); process.exit(1); }
const tile = (i, ext) => path.join(tiles, `${i.kind}-${i.id}.${ext}`);
const cache = path.join(tiles, 'cache'); // geo/ and font/, which dev.mjs fetches from the published site on every load
mkdirSync(cache, { recursive: true });

let server = null, url = arg('url');
if (!url) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  server = spawn('node', ['scripts/dev.mjs', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  url = `http://localhost:${port}/`;
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(url)).ok; } catch { /* not up yet */ } if (!up) await new Promise((r) => setTimeout(r, 500)); }
  if (!up) { server.kill(); throw new Error(`scripts/dev.mjs did not answer on ${url} in 30 s`); }
}

const WIDTH = 1100, HEIGHT = 700, START = '#map=6/-75/100'; // a view over Antarctica: no track lies in it, so every voyage flies
let browser, failed = 0;

async function shoot(item) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'dark' });
  await ctx.route(/\/(geo|font)\//, async (route) => { // fetched from the published site once, then from the cache
    const f = path.join(cache, new URL(route.request().url()).pathname.replace(/^\/+/, '').replaceAll('/', '_'));
    if (existsSync(f)) return route.fulfill({ body: readFileSync(f), contentType: readFileSync(`${f}.type`, 'utf8') });
    const r = await route.fetch();
    if (r.ok()) { writeFileSync(f, await r.body()); writeFileSync(`${f}.type`, r.headers()['content-type'] ?? 'application/octet-stream'); }
    return route.fulfill({ response: r });
  });
  const page = await ctx.newPage();
  try {
    const total = () => page.waitForFunction(() => /total/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
    const open = (d) => page.evaluate((i) => document.getElementById(i).classList.contains('open'), d);
    await page.goto(url + START);
    await total();
    await page.waitForTimeout(500);
    await page.click(`#${item.button}`);
    await page.waitForFunction((d) => document.getElementById(d).classList.contains('open'), item.drawer);
    await page.waitForSelector(item.sel, { timeout: 60000 });
    await page.click(item.sel);
    await page.waitForTimeout(1200);
    let last = '';
    for (let i = 0; i < 120; i++) { // landed: the link and the status line unchanged for a second, the map drawn
      const now = await page.evaluate(() => `${location.hash}|${/total/.test(document.getElementById('status').textContent)}`);
      if (now === last && now.endsWith('true')) break;
      last = now;
      await page.waitForTimeout(1000);
    }
    if (!(await open(item.drawer))) { await page.click(`#${item.button}`); await page.waitForTimeout(500); }
    const zoom = Number((await page.evaluate(() => location.hash)).match(/map=([\d.]+)/)?.[1]);
    return { ...item, zoom, png: await page.screenshot() };
  } finally { await ctx.close(); }
}

let next = 0;
try { // the dev server goes down however the run ends
  browser = await chromium.launch();
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const i = next++;
      const s = await shoot(items[i]).catch(() => shoot(items[i])).catch((e) => ({ ...items[i], zoom: NaN, error: e.message })); // a busy machine times one out: once more
      if (s.png) { writeFileSync(tile(s, 'png'), s.png); writeFileSync(tile(s, 'json'), JSON.stringify({ zoom: s.zoom })); }
      if (s.error) failed++;
      console.error(`${i + 1}/${items.length} ${s.kind} ${s.id} z${s.zoom}${s.error ? ` FAILED: ${s.error}` : ''}`);
    }
  }));
} finally { await browser?.close(); server?.kill(); }

const shots = all.map((i) => (existsSync(tile(i, 'png')) ? { ...i, ...JSON.parse(readFileSync(tile(i, 'json'), 'utf8')), png: readFileSync(tile(i, 'png')) } : { ...i, zoom: NaN }));
const COLS = 5, TW = 260, TH = Math.round((TW * HEIGHT) / WIDTH), LH = 26, GAP = 8, rows = Math.ceil(shots.length / COLS);
const sheet = createCanvas(COLS * (TW + GAP) + GAP, rows * (TH + LH + GAP) + GAP), g = sheet.getContext('2d');
g.fillStyle = '#1b1712'; g.fillRect(0, 0, sheet.width, sheet.height);
for (const [n, s] of shots.entries()) {
  const x = GAP + (n % COLS) * (TW + GAP), y = GAP + Math.floor(n / COLS) * (TH + LH + GAP);
  if (s.png) g.drawImage(await loadImage(s.png), x, y + LH, TW, TH);
  g.fillStyle = s.zoom > 6 ? '#ff6b5a' : '#f1e4c6'; g.font = 'bold 14px sans-serif'; g.textBaseline = 'middle';
  g.fillText(`${s.kind === 'person' ? '' : 'voyage: '}${s.name}`, x + 2, y + LH / 2, TW - 70);
  g.textAlign = 'right'; g.fillText(Number.isFinite(s.zoom) ? `z${s.zoom.toFixed(2)}` : 'failed', x + TW - 2, y + LH / 2); g.textAlign = 'left';
}
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, sheet.toBuffer('image/png'));
const missing = shots.filter((s) => !s.png).map((s) => s.id);
const zooms = shots.map((s) => s.zoom).filter(Number.isFinite);
console.log(`${out}: ${shots.length - missing.length} of ${shots.length} shots${missing.length ? ` (re-run with --only ${missing.join(',')})` : ''}${zooms.length ? `, closest z${Math.max(...zooms).toFixed(2)}` : ''}`);
if (failed || missing.length) process.exitCode = 1;
