// Builds the four storyboards as HTML, then shoots them. Run from this folder: node build.mjs
import { writeFileSync } from 'node:fs';
const W = 700, H = 440;
const rows = [
  ['Reign c. 1312 to c. 1337', 'Accession dated 25 years before his death', 'firm', 'Most accepted'],
  ['In Cairo 19 July to 18 October 1324', 'One secondary source', 'reported', 'Days approximate'],
  ['Gold fell 25 to under 22 dirhams, 12 years', 'Al-Umari', 'reported', 'His report'],
  ['60,000 men, 12,000 slaves with gold bars', 'Later Arabic accounts', 'legend', 'Literary, not a count'],
  ['About 18 tonnes of gold', 'One chain, al-Umari to Ibn Khaldun', 'legend', 'One source repeated'],
  ['Richest person ever, $400 billion', 'Online articles', 'legend', 'Cannot be calculated'],
];
const mark = { firm: ['#3f6b3a', '●', 'firm'], reported: ['#b07a1c', '◐', 'one source'], legend: ['#8e3a2a', '○', 'retelling'] };
const tbl = (cls = '', hi = -1) => `<table class="tbl ${cls}">${rows.map((r, i) => `<tr class="${i === hi ? 'hi' : ''}"><td class="m" style="color:${mark[r[2]][0]}">${mark[r[2]][1]}</td><td>${r[0]}<small>${r[1]}</small></td><td class="f" style="color:${mark[r[2]][0]}">${mark[r[2]][2]}</td></tr>`).join('')}</table>`;
const css = (t) => `
*{box-sizing:border-box;margin:0}
body{background:${t.page};font-family:'Liberation Serif',Georgia,serif;color:${t.ink};padding:28px 32px;width:${3 * W + 2 * 110 + 64}px}
h1{font-size:30px;font-weight:600;letter-spacing:.3px} .sub{font-size:16px;opacity:.75;margin:4px 0 6px;max-width:1500px}
.mood{font:13px 'DejaVu Sans',sans-serif;opacity:.7;margin-bottom:18px}
.row{display:flex;align-items:center;gap:0}
.f{position:relative}
.frame{position:relative;width:${W}px;height:${H}px;overflow:hidden;border:2px solid ${t.edge};border-radius:6px;background:${t.stage};box-shadow:0 6px 18px #0004}
.cap{font:13px 'DejaVu Sans',sans-serif;margin:8px 2px 0;opacity:.85;width:${W}px;height:36px}
.arr{width:110px;text-align:center;font:12px 'DejaVu Sans',sans-serif;color:${t.accent};line-height:1.25;padding:0 6px}
.arr b{display:block;font-size:34px;line-height:30px;font-weight:400}
.map{position:absolute;background:url(hajj.jpg) no-repeat;background-size:1600px 1000px;filter:${t.filter||'none'}}
.fig{position:absolute;background-size:cover;background-position:center}
.tile{position:absolute;background:${t.tile};color:${t.tileInk};border:1px solid ${t.edge};box-shadow:0 4px 14px #0006;padding:14px 16px;font-size:14.5px;line-height:1.35}
.tile h3{font-size:19px;margin-bottom:6px}
.chip{display:inline-block;font:12px 'DejaVu Sans',sans-serif;padding:5px 9px;border:1px solid ${t.accent};border-radius:14px;margin:4px 4px 0 0;color:${t.accent};background:${t.chip}}
.chip.on{background:${t.accent};color:${t.page}}
.ring{position:absolute;border:3px solid ${t.accent};border-radius:50%;box-shadow:0 0 0 6px ${t.accent}44}
.tbl{border-collapse:collapse;width:100%;font-size:13.5px}.tbl td{padding:6px 6px;border-bottom:1px solid ${t.edge}66;vertical-align:top}
.tbl small{display:block;font:11px 'DejaVu Sans',sans-serif;opacity:.65;margin-top:1px}
.tbl .m{font-size:20px;width:26px}.tbl .f{font:12px 'DejaVu Sans',sans-serif;white-space:nowrap;text-align:right}
.tbl tr.hi{background:${t.accent}30}
.lbl{position:absolute;font:11px 'DejaVu Sans',sans-serif;background:${t.tile};color:${t.tileInk};padding:2px 6px;border-radius:3px;border:1px solid ${t.edge}}
`;
const frame = (inner, cap) => `<div><div class="frame">${inner}</div><div class="cap">${cap}</div></div>`;
const arr = (t) => `<div class="arr"><b>→</b>${t}</div>`;
const page = (t, title, sub, mood, frames, arrows) => `<!doctype html><meta charset=utf-8><style>${css(t)}</style><body>
<h1>${title}</h1><div class="sub">${sub}</div><div class="mood">Mood: ${mood}</div>
<div class="row">${frames[0]}${arr(arrows[0])}${frames[1]}${arr(arrows[1])}${frames[2]}</div></body>`;

// ---- 1: the figure opens the door (warm parchment, the map is the page)
const T1 = { page: '#e9dcc0', ink: '#3b2a17', edge: '#8a6a3a', stage: '#d9c59a', accent: '#8b2e1f', tile: '#f3e8cf', tileInk: '#3b2a17', chip: '#f3e8cf' };
const c1 = page(T1, '1. The king opens the door', 'Entry is the Catalan Atlas Musa on the map itself. Click or tap the figure; the map flies to him, a tile opens with chips for the other three tellings. No lettering beside the mark.', 'warm parchment, the map is the whole page, drawers and tiles in the same paper',
[frame(`<div class="map" style="left:-120px;top:-90px;width:1600px;height:1000px"></div>
  <div class="fig" style="left:128px;top:262px;width:78px;height:56px;background-image:url(musa.jpg);border-radius:50%;box-shadow:0 0 0 3px #fff8,0 0 0 6px #8b2e1f"></div>
  <div class="ring" style="left:112px;top:244px;width:110px;height:92px"></div>`, 'View 1. Continent zoom. A gold-ringed Musa where Mali sits; nothing else announces the story.'),
 frame(`<div class="map" style="left:-200px;top:-260px;width:2400px;height:1500px;background-size:2400px 1500px"></div>
  <div class="fig" style="left:90px;top:130px;width:330px;height:236px;background-image:url(musa.jpg);border-radius:14px;box-shadow:0 6px 20px #0008"></div>
  <div class="tile" style="left:432px;top:0;width:268px;height:100%;border-width:0 0 0 1px"><h3>The richest lord of the land</h3>The atlas says so beside him: <i>Musse Melly</i>, sovereign of the land of the black people of Gineva, rich in gold. He holds up a nugget.<br><br><span class="chip on">The king</span><span class="chip">Rex Melly, 1339</span><span class="chip">The hajj</span><span class="chip">How firm</span></div>`, 'View 2. Zoomed in, the raw crop of the scan at map size; the tile slides in from the right.'),
 frame(`<div class="map" style="left:-200px;top:-260px;width:2400px;height:1500px;background-size:2400px 1500px;opacity:.55"></div>
  <div class="tile" style="left:40px;top:28px;width:620px;height:384px;overflow:hidden"><h3>How firm are the famous numbers?</h3>${tbl()}</div>`, 'View 3. Chip "How firm" swaps the tile for the numbers table; the map dims behind it.')],
['Tap the figure: map flies in (900 ms), tile slides from the right', 'Chip: tile body cross-fades; the map stays put']);

// ---- 2: two portraits (cool archival)
const T2 = { page: '#eef0f1', ink: '#1f2a33', edge: '#98a3ab', stage: '#f7f8f8', accent: '#1d4e6b', tile: '#ffffff', tileInk: '#1f2a33', chip: '#fff', filter: 'grayscale(.7) contrast(.95)' };
const c2 = page(T2, '2. Thirty-six years, two portraits', 'Entry is a comparison: Dulcert\'s Rex Melly of 1339 beside the Catalan Atlas Musa of about 1375. The same king, drawn before and after Europe learned his name.', 'cool museum white, plates and captions, the map greyed back to a supporting sheet',
[frame(`<div class="map" style="left:-120px;top:-90px;width:1600px;height:1000px"></div>
  <div class="fig" style="left:40px;top:80px;width:290px;height:166px;background-image:url(rex-melly.jpg);border:6px solid #fff;box-shadow:0 4px 14px #0007"></div>
  <div class="fig" style="left:370px;top:200px;width:290px;height:207px;background-image:url(musa.jpg);border:6px solid #fff;box-shadow:0 4px 14px #0007"></div>
  <div class="lbl" style="left:46px;top:58px">1339 · Dulcert, Majorca</div><div class="lbl" style="left:376px;top:178px">c. 1375 · Catalan Atlas</div>`, 'View 1. Two plates hang over the greyed map, each pinned to where its chart puts him.'),
 frame(`<div class="fig" style="left:20px;top:56px;width:330px;height:189px;background-image:url(rex-melly.jpg)"></div>
  <div class="fig" style="left:360px;top:56px;width:320px;height:229px;background-image:url(musa.jpg)"></div>
  <div class="lbl" style="left:22px;top:8px">Rex Melly, 1339: seated, crowned, a staff</div><div class="lbl" style="left:362px;top:8px">Musse Melly, c. 1375: a gold nugget raised</div>
  <div style="position:absolute;left:24px;top:300px;width:652px;font-size:14.5px;line-height:1.4">Between the two plates the gold arrives. The hajj of 1324 is why Mali is on a European chart at all; the second drawing says what the first only implies.<br><span class="chip on">Compare</span><span class="chip">The hajj</span><span class="chip">How firm</span></div>`, 'View 2. Open a plate: the two figures side by side at plate size, a one-line caption each.'),
 frame(`<div style="position:absolute;inset:0;background:#fff;padding:20px 24px"><h3 style="font-size:19px;margin-bottom:6px">The numbers, and how firm they are</h3>${tbl('', 3)}</div>
  <div class="lbl" style="right:12px;bottom:10px">source and grade appear on the line you touch</div>`, 'View 3. The table as a plain sheet; a touched line names its source.')],
['Open a plate: the other plate slides in beside it (500 ms)', 'Chip "How firm": the plates fold away, the sheet rises']);

// ---- 3: the road (dark ink-and-gold, scroll-driven)
const T3 = { page: '#14172b', ink: '#efe4c4', edge: '#c9a24a', stage: '#0f1222', accent: '#e0b84e', tile: '#1c2040', tileInk: '#efe4c4', chip: '#14172b', filter: 'brightness(.55) sepia(.3) hue-rotate(185deg) saturate(1.3)' };
const rail = (at, lbl) => `<div style="position:absolute;left:30px;right:30px;bottom:38px;height:3px;background:#c9a24a66"></div>${[0, 25, 50, 75, 100].map((p) => `<div style="position:absolute;left:${30 + 6.4 * p}px;bottom:32px;width:${p <= at ? 14 : 10}px;height:${p <= at ? 14 : 10}px;margin-left:-6px;border-radius:50%;background:${p <= at ? '#e0b84e' : '#14172b'};border:2px solid #e0b84e"></div>`).join('')}<div class="lbl" style="left:30px;bottom:8px;background:none;border:0;color:#efe4c4">${lbl}</div>`;
const c3 = page(T3, '3. The road, told by scrolling', 'Entry is the hajj, 1324 to 1325. The map is pinned; a dated rail beneath it advances as the reader moves, and the route draws on. The portraits arrive as stops along the way.', 'dark ink and gold leaf, night caravan; the map dims so only the road is bright',
[frame(`<div class="map" style="left:-120px;top:-250px;width:1600px;height:1000px"></div>
  <svg style="position:absolute;inset:0" width="700" height="440"><path d="M135 320 C 160 270 170 230 168 190" stroke="#e0b84e" stroke-width="4" fill="none" stroke-dasharray="1 0"/><circle cx="135" cy="320" r="7" fill="#e0b84e"/></svg>
  <div class="tile" style="left:300px;top:24px;width:380px"><h3>1324. Niani to Walata</h3>A king from south of the Sahara sets out with a caravan so large people wrote of it for a century. <span class="chip">conventional route</span></div>${rail(0, 'Scroll or drag the rail')}`, 'View 1. Start of the rail: the route has just begun to draw in gold.'),
 frame(`<div class="map" style="left:-760px;top:-120px;width:1600px;height:1000px"></div>
  <svg style="position:absolute;inset:0" width="700" height="440"><path d="M-30 340 C 140 150 330 110 520 118" stroke="#e0b84e" stroke-width="4" fill="none"/><circle cx="520" cy="118" r="8" fill="#e0b84e"/></svg>
  <div class="fig" style="left:420px;top:150px;width:110px;height:79px;background-image:url(musa.jpg);border:2px solid #e0b84e;border-radius:6px"></div>
  <div class="tile" style="left:24px;top:230px;width:420px;font-size:14px"><h3>19 July 1324. Cairo</h3>Three days by the pyramids, three months in the city, gold given away freely. Al-Umari: a mithqal fell from 25 dirhams to under 22.<br><span class="chip on">attested</span> <span class="chip">the fall: his report</span></div>${rail(50, '19 July 1324')}`, 'View 2. Mid-rail, Cairo: the Atlas Musa appears pinned to the stop; the numbers carry their grade as chips.'),
 frame(`<div class="map" style="left:-20px;top:-300px;width:1600px;height:1000px"></div>
  <svg style="position:absolute;inset:0" width="700" height="440"><path d="M100 300 C 40 300 0 250 -20 200" stroke="#efe4c4" stroke-width="3" fill="none" stroke-dasharray="3 7"/></svg>
  <div class="tile" style="left:200px;top:36px;width:470px;font-size:14px"><h3>Before the king: the fleet that did not return</h3>Told once, by al-Umari, from Musa's own mouth: 2,000 ships west into the Atlantic, none back. Drawn dotted, where it ends no one knows.<br><span class="chip on">doubted</span><span class="chip">Rex Melly, 1339</span><span class="chip">How firm</span></div>${rail(100, 'The coda')}`, 'View 3. End of the rail: the fleet (doubted, dotted), and chips onward to Dulcert and the table.')],
['Scroll: the map pans east, the line draws on (1.2 s ease)', 'Scroll on: the map swings to the Atlantic, the gold line gives way to a dotted one']);

// ---- 4: the ledger (plain, numbers first)
const T4 = { page: '#e6ebe0', ink: '#1e2a1c', edge: '#7b8c74', stage: '#f4f6ef', accent: '#2f5d3a', tile: '#fbfcf7', tileInk: '#1e2a1c', chip: '#fff' };
const c4 = page(T4, '4. The ledger', 'Entry is the claim-and-grade table as a tile, open over the map. Every number the internet repeats is a line; touching one lights its place on the map and names its source. The portraits are footnotes.', 'ledger-paper green and grey, plain type, no ornament; the table is the spine',
[frame(`<div class="map" style="left:-120px;top:-90px;width:1600px;height:1000px;filter:grayscale(.5)"></div>
  <div class="tile" style="left:30px;top:20px;width:640px;height:400px;overflow:hidden"><h3>Mansa Musa: what is known, and how firmly</h3>${tbl()}<div style="margin-top:6px;font:11.5px 'DejaVu Sans'">● firm &nbsp; ◐ one source &nbsp; ○ a retelling, not a count</div></div>`, 'View 1. The tile opens from a map chip; six lines, one mark each, the mark also spelled out at the right.'),
 frame(`<div class="map" style="left:-120px;top:-90px;width:1600px;height:1000px;filter:grayscale(.5)"></div>
  <svg style="position:absolute;inset:0" width="700" height="440"><path d="M135 330 C 200 160 520 130 580 118" stroke="#2f5d3a" stroke-width="4" fill="none"/><circle cx="580" cy="118" r="8" fill="#2f5d3a"/></svg>
  <div class="tile" style="left:20px;top:170px;width:360px;height:250px;overflow:hidden;font-size:13px">${tbl('', 1)}</div>
  <div class="tile" style="left:400px;top:150px;width:280px"><h3 style="font-size:16px">Cairo, 19 July to 18 October 1324</h3>One secondary source. The route on the map is the usual drawing, not a record.<br><span class="chip on">reported</span><span class="chip">source</span></div>`, 'View 2. Touch a line: the tile shrinks to the corner, the place lights on the map, a source card opens.'),
 frame(`<div class="map" style="left:-200px;top:-260px;width:2400px;height:1500px;background-size:2400px 1500px;filter:grayscale(.5)"></div>
  <div class="fig" style="left:30px;top:90px;width:300px;height:214px;background-image:url(musa.jpg);border:4px solid #fff;box-shadow:0 3px 10px #0006"></div>
  <div class="fig" style="left:350px;top:90px;width:300px;height:150px;background-image:url(rex-melly.jpg);border:4px solid #fff;box-shadow:0 3px 10px #0006"></div>
  <div class="tile" style="left:350px;top:262px;width:300px;font-size:13px">The drawings come last: the atlas king holds the gold the table keeps weighing; Dulcert's does not.<br><span class="chip">back to the table</span></div>`, 'View 3. "Portraits" chip: the two drawings as footnotes to the ledger, one tap from the table.')],
['Touch a row: tile shrinks to the corner (400 ms), the route draws to the place', 'Chip "Portraits": the tile fades, two plates rise']);

for (const [n, h] of [[1, c1], [2, c2], [3, c3], [4, c4]]) writeFileSync(`c${n}.html`, h);

// overview: the four entry views stacked, to compare at a glance
import { chromium } from 'playwright-core';
const b = await chromium.launch({executablePath:process.env.CHROME}); const p = await b.newPage({ viewport: { width: 3 * W + 2 * 110 + 64, height: 700 }, deviceScaleFactor: 1 });
const names = ['the-king-opens-the-door', 'two-portraits', 'the-road', 'the-ledger'];
for (let i = 1; i <= 4; i++) { await p.goto('file://' + process.cwd() + `/c${i}.html`); await p.waitForTimeout(300); await p.screenshot({ path: `../${i}-${names[i - 1]}.png`, fullPage: true }); }
await b.close();
