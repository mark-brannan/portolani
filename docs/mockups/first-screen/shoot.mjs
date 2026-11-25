// Renders docs/mockups/first-screen/: node docs/mockups/first-screen/shoot.mjs [port], with npm run dev serving this checkout.
// Candidates 1 to 3 are drawn over the live page from this script (DOM and CSS added after the map paints) and are not
// wired into the page; `live` is the page as it stands. CHROME=<path to chrome> if playwright's own browser is not installed.
import { chromium } from 'playwright-core';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = dirname(fileURLToPath(import.meta.url)), PORT = process.argv[2] || 10999;
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const P = { width: 390, height: 844 }, D = { width: 1280, height: 800 };

// the three first screens, each with the page's own tokens and type (var(--serif) is IM Fell English)
const HIDE_FOOT = '#status, #build, #mementoEnglish { display: none !important; }'; // the timing, memento and build lines leave the foot in every candidate
const PLATE = `${HIDE_FOOT}
#plate { position: fixed; inset: 0; display: grid; place-items: start center; padding-top: 12vh; z-index: 5; background: rgb(29 25 19 / 0.18); }
#plate .sheet { width: min(420px, 86vw); padding: 26px 28px 22px; text-align: center; color: #3b2a1a; font-family: var(--serif);
  background: #efe3c6; border: 1px solid #b89a68; outline: 3px double #8c2f1e; outline-offset: -8px; box-shadow: 0 6px 30px rgb(0 0 0 / 0.45); }
#plate h1 { margin: 0; font: 400 40px/1 var(--serif); letter-spacing: 0.18em; }
#plate .sub { margin: 10px 0 0; font-size: 18px; line-height: 1.3; }
#plate .how { margin: 18px 0 0; font-size: 15px; line-height: 1.5; color: #5a4128; }
#plate .how b { color: #8c2f1e; font-weight: 400; }
#plate .go { margin: 16px 0 0; font-size: 13px; letter-spacing: 0.08em; color: #8c2f1e; text-transform: uppercase; }
@media (max-width: 520px) { #plate h1 { font-size: 32px; } #plate .sub { font-size: 16px; } #plate .how { font-size: 14px; } }`;
const PLATE_HTML = `<div id="plate"><div class="sheet"><h1>PORTOLANI</h1><p class="sub">The world as a 15th-century portolan chart</p>
<p class="how"><b>Drag</b> to pan · <b>pinch</b> or wheel to zoom<br><b>Tap</b> a ship, a monster or a king for its story</p><p class="go">Tap anywhere to begin</p></div></div>`;

const CARTOUCHE = `${HIDE_FOOT}
#under { position: fixed; z-index: 2; pointer-events: none; font-family: var(--serif); color: #3b2a1a; text-align: center; font-size: 15px; line-height: 1.25;
  text-shadow: 0 0 4px #e9d8b4, 0 0 4px #e9d8b4, 0 0 6px #e9d8b4; }
#ribbon { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 2; padding: 7px 16px; white-space: nowrap;
  font: 15px/1.3 var(--serif); color: #efe3c6; background: rgb(29 25 19 / 0.78); border: 1px solid #a39679; border-radius: 3px; }
#ribbon b { color: #e8b84a; font-weight: 400; }
#halo { position: fixed; z-index: 2; pointer-events: none; width: 150px; height: 150px; border-radius: 50%; border: 3px solid #8c2f1e;
  box-shadow: 0 0 0 6px rgb(140 47 30 / 0.25), 0 0 24px rgb(140 47 30 / 0.5); }
#halo span { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 8px); white-space: nowrap; font: 15px/1 var(--serif); color: #8c2f1e;
  background: #efe3c6; border: 1px solid #b89a68; padding: 4px 9px; }
@media (max-width: 520px) { #ribbon { font-size: 13px; padding: 6px 10px; bottom: 56px; } #under { font-size: 12px; } #halo { width: 120px; height: 120px; } }`;
const CARTOUCHE_HTML = `<p id="under">the world as a 15th-century portolan chart</p>
<div id="halo"><span>tap a figure for its story</span></div>
<p id="ribbon"><b>Drag</b> to pan · <b>pinch</b> to zoom · <b>tap</b> a figure for its story</p>`;

const LEGEND = `${HIDE_FOOT}
#legend { position: fixed; left: 12px; z-index: 2; width: min(300px, calc(100vw - 24px)); padding: 12px 14px 12px; font-family: var(--serif); color: #3b2a1a;
  background: #efe3c6; border: 1px solid #b89a68; box-shadow: 0 2px 10px rgb(0 0 0 / 0.3); }
#legend h1 { margin: 0 0 4px; font: 400 24px/1 var(--serif); letter-spacing: 0.14em; }
#legend p { margin: 6px 0 0; font-size: 14px; line-height: 1.35; }
#legend a { color: #8c2f1e; }
#legend .x { position: absolute; right: 8px; top: 6px; font: 18px/1 var(--serif); color: #8c2f1e; }
#legend .hint { color: #5a4128; }
#legend .hint b { color: #8c2f1e; font-weight: 400; }`;
const LEGEND_HTML = `<div id="legend"><span class="x">✕</span><h1>PORTOLANI</h1>
<p>Today's coasts, drawn as a chart of the 1400s: ink on parchment, rhumb lines from the wind roses, ships and monsters where the sea is empty.</p>
<p class="hint"><b>Drag</b> to pan, <b>pinch</b> to zoom, <b>tap</b> a figure for its story.</p>
<p><a href="#">What a portolan chart was →</a></p></div>`;

// each candidate: its landing view on the phone and on the desktop, and its first screen
const CANDIDATES = [
  { name: 'live', phone: '', desktop: '', wait: 7000 },
  { name: 'candidate-1', phone: '#map=4.3/46.2/-20.2', desktop: '#map=4.4/46.4/-15', wait: 8000, css: PLATE, html: PLATE_HTML },
  { name: 'candidate-2', phone: '#map=4.3/23.7/9&overlay=catalan-atlas&autotitle=0', desktop: '#map=4.1/23.5/8.7&overlay=catalan-atlas&autotitle=0', wait: 14000, css: CARTOUCHE, html: CARTOUCHE_HTML,
    place: (p) => p.evaluate(() => {
      // the phone's cartouche is a card (#cardCartouche); the desktop's is drawn on the map canvas at its top-right corner, so its box is given here
      const r0 = document.getElementById('cardCartouche').getBoundingClientRect(), u = document.getElementById('under');
      const c = r0.width ? { left: r0.left, width: Math.max(r0.width, 170), bottom: r0.bottom } : { left: innerWidth - 285, width: 265, bottom: 208 };
      u.style.left = `${c.left}px`; u.style.width = `${c.width}px`; u.style.top = `${c.bottom + 2}px`;
      const h = document.getElementById('halo'), r = h.getBoundingClientRect();
      h.style.left = `${innerWidth / 2 - r.width / 2}px`; h.style.top = `${innerHeight / 2 - r.height / 2 - 10}px`;
    }) },
  { name: 'candidate-3', phone: '#map=3/28/-57&voyages=columbus', desktop: '#map=3.3/30/-38&voyages=columbus', wait: 14000, css: LEGEND, html: LEGEND_HTML,
    place: (p) => p.evaluate(() => {
      const s = document.getElementById('cardScale').getBoundingClientRect(), l = document.getElementById('legend'), phone = innerWidth < 520;
      if (phone) l.style.bottom = `${innerHeight - s.top + 10}px`; else { l.style.bottom = `${innerHeight - s.bottom}px`; l.style.left = `${s.right + 12}px`; }
    }) },
];

async function shoot({ name, phone: ph, desktop: dk, wait, css, html, place }, vp) {
  const phone = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone, colorScheme: 'dark' });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}/${phone ? ph : dk}`); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(wait);
  if (css) { await p.addStyleTag({ content: css }); await p.evaluate((h) => document.body.insertAdjacentHTML('beforeend', h), html); }
  if (place) await place(p);
  await p.waitForTimeout(400);
  const file = `${OUT}/${name}-${phone ? 'phone' : 'desktop'}.png`;
  await p.screenshot({ path: file });
  console.log(name, phone ? 'phone' : 'desktop', errors.length ? errors : 'ok');
  await ctx.close();
  return file;
}

// side by side: the phone beside the desktop at one height, with a label; then every candidate stacked as overview.png
async function sideBySide(name, label) {
  const ph = await loadImage(`${OUT}/${name}-phone.png`), dk = await loadImage(`${OUT}/${name}-desktop.png`);
  const H = 800, pw = Math.round(ph.width * H / ph.height), dw = Math.round(dk.width * H / dk.height), PAD = 16, TOP = 44;
  const c = createCanvas(pw + dw + 3 * PAD, H + TOP + PAD), g = c.getContext('2d');
  g.fillStyle = '#1d1913'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#efe3c6'; g.font = '24px sans-serif'; g.fillText(label, PAD, 30);
  g.drawImage(ph, PAD, TOP, pw, H); g.drawImage(dk, 2 * PAD + pw, TOP, dw, H);
  writeFileSync(`${OUT}/${name}.png`, c.toBuffer('image/png'));
  return c;
}

const LABELS = { live: 'Live: the page as it stands', 'candidate-1': '1. A title plate, over the Atlantic rose', 'candidate-2': '2. The cartouche names it; Mansa Musa to tap', 'candidate-3': '3. A legend card; Columbus crosses as it opens' };
const sheets = [];
for (const cand of CANDIDATES) {
  await shoot(cand, P); await shoot(cand, D);
  sheets.push(await sideBySide(cand.name, LABELS[cand.name]));
}
{
  const W = Math.max(...sheets.map((s) => s.width)), H = sheets.reduce((n, s) => n + s.height, 0);
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1d1913'; g.fillRect(0, 0, W, H);
  let y = 0; for (const s of sheets) { g.drawImage(s, 0, y); y += s.height; }
  writeFileSync(`${OUT}/overview.png`, c.toBuffer('image/png'));
}
await b.close();
