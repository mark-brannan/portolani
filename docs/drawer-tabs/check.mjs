// A quick check of the drawer against npm run dev: node docs/drawer-tabs/check.mjs [port]
import { chromium } from 'playwright-core';
const PORT = process.argv[2] ?? 10319;
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(`http://localhost:${PORT}/#map=5.48/40.265/7.000&layout=sheet`); await p.waitForTimeout(5000);
await p.click('#open');
const CONTROLS = ['density','pick-monster','pick-ship','pick-rose','placement','townSize','pick-town','mountains','hills','pick-relief','trees','pick-cartouche','titleMode','title','projection','names','rhumb','continentsZoom','regionSet','regions','regionsZoom','land','islands','seaTint','rivers','lakes','reefs','playas','scale','scaleBorder','ink','parchment'];
for (const id of CONTROLS) { const n = await p.locator(`#drawer [id="${id}"]`).count(); if (n !== 1) console.log('BAD', id, n); }
console.log(await p.locator('#drawer .tabs [role=tab] > span').allTextContents(), await p.locator('.moods .preset').count(), await p.locator('.sample.crammed > *').count());
for (const i of [0, 1, 2]) { await p.click(`#tab-${i}`); console.log(i, await p.locator('#drawer [role=tabpanel]:not([hidden])').count()); }
await p.click('#tab-0');
console.log(await p.locator('#pick-monster .fam-chip b').allTextContents(), await p.locator('#pick-monster .fam-tray .thumb').first().isVisible());
await p.locator('.moods .preset', { hasText: 'Woodcut' }).click(); await p.waitForTimeout(2000);
console.log(await p.evaluate(() => location.hash.slice(0, 80)), await p.locator('#pick-monster .fam-chip b').allTextContents());
await b.close();
