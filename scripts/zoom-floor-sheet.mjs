#!/usr/bin/env node
// A contact sheet of every fly: one Playwright shot at 1100 px wide per person (from the People drawer) and per voyage
// (from the Voyages drawer), each taken once its flight has landed with the drawer that launched it open, labelled with
// the name and the zoom it landed at (docs/zoom-floor/contact-sheet.png). The user walks it to judge each framing.
//
//   node scripts/zoom-floor-sheet.mjs [--url http://localhost:10901/] [--out docs/zoom-floor/contact-sheet.png] [--only id,id]
//
// Without --url it serves this checkout with scripts/dev.mjs on a free port (geo/ from the published site, so it needs
// the network). Needs playwright-core and a Chromium (`npx playwright-core install chromium-headless-shell`).

import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { chromium } from 'playwright-core';
import { peopleOf } from './people.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const out = path.resolve(root, arg('out') ?? 'docs/zoom-floor/contact-sheet.png'), only = arg('only')?.split(',') ?? null;
const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const index = read('data/voyages/index.json');
const who = Object.fromEntries(index.map((id) => [id, read(`data/voyages/${id}.json`).who ?? []]));
const items = [
  ...peopleOf(read('data/voyages/people.json'), who).map((p) => ({ kind: 'person', id: p.id, name: p.name, drawer: 'peoplePanel', button: 'people', sel: `[data-person="${p.id}"]` })),
  ...index.map((id) => ({ kind: 'voyage', id, name: read(`data/voyages/${id}.json`).short ?? id, drawer: 'voyagesPanel', button: 'voyages', sel: `[data-voyage="${id}"]` })),
].filter((i) => !only || only.includes(i.id));

let server = null, url = arg('url');
if (!url) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  server = spawn('node', ['scripts/dev.mjs', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  url = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}

const WIDTH = 1100, HEIGHT = 700, START = '#map=6/-75/100'; // a view over Antarctica: no track lies in it, so every voyage flies
const browser = await chromium.launch();
const shots = new Array(items.length);

async function shoot(item) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'dark' });
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
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < items.length) {
    const i = next++;
    shots[i] = await shoot(items[i]).catch(() => shoot(items[i])).catch((e) => ({ ...items[i], zoom: NaN, error: e.message })); // a busy machine times one out: once more
    console.error(`${i + 1}/${items.length} ${items[i].kind} ${items[i].id} z${shots[i].zoom}${shots[i].error ? ` FAILED: ${shots[i].error}` : ''}`);
  }
}));
await browser.close();
server?.kill();

const COLS = 5, TW = 320, TH = Math.round((TW * HEIGHT) / WIDTH), LH = 26, GAP = 8, rows = Math.ceil(shots.length / COLS);
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
console.log(`${out}: ${shots.length} shots, closest z${Math.max(...shots.map((s) => s.zoom).filter(Number.isFinite)).toFixed(2)}`);
