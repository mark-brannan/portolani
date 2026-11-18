// Mockup (#272): the candidate looks for the notes' pulse, each a strip of frames across its cycle, on the Carta Marina
// as it lies on the map (the crop and scale of docs/notes-announce/pulse-frames.png, the shipped pulse recorded live).
//   node docs/notes-pulse/strips.mjs  ->  docs/notes-pulse/strips.png
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawNoteRing, notePulse } from '../../scripts/scene.mjs';
import { CARTA_MARINA_NOTES } from '../../scripts/notes.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
GlobalFonts.registerFromPath(`${root}test/fixtures/IMFeENrm28P.ttf`, 'Fell');
const scan = await loadImage(`${root}packs/overlays/carta-marina.jpg`); // half the scan's px
const X0 = 330, Y0 = 500, CW = 2000, CH = 1400, S = 0.22; // the crop in scan px, and scan px to map px
const FW = Math.round(CW * S), FH = Math.round(CH * S), LABEL = 175, HEAD = 26, GAP = 6;
const marks = CARTA_MARINA_NOTES.map((n) => ({ x: (n.at.px[0] - X0) * S, y: (n.at.px[1] - Y0) * S, tile: { title: n.title } }))
  .filter((m) => m.x > 0 && m.y > 0 && m.x < FW && m.y < FH);
const TIMES = [0.2, 0.45, 0.7, 1.05, 3.1, 3.6]; // s: the first turn across, then the last turn fading out
const ROWS = [
  ['a', 'hand', 'A loop drawn', 'with a pen'],
  ['b', 'lamp', 'A lamp’s glow', ''],
  ['c', 'rhumbs', 'A rose’s rhumbs', 'ink, green, red'],
  ['d', 'rings', 'The shipped rings', '(for comparison)'],
];
const W = LABEL + TIMES.length * (FW + GAP), H = HEAD + ROWS.length * (FH + GAP);
const c = createCanvas(W, H), g = c.getContext('2d');
g.fillStyle = '#1d1913'; g.fillRect(0, 0, W, H);
g.fillStyle = '#e9d8b4'; g.font = '18px Fell';
TIMES.forEach((t, i) => g.fillText(`t = ${t.toFixed(2)} s`, LABEL + i * (FW + GAP) + 6, 19));
ROWS.forEach(([key, look, name, sub], r) => {
  const y = HEAD + r * (FH + GAP);
  g.fillStyle = '#e9d8b4'; g.font = '22px Fell'; g.fillText(`(${key})`, 10, y + 30);
  g.font = '19px Fell'; g.fillText(name, 10, y + 58); if (sub) g.fillText(sub, 10, y + 82);
  TIMES.forEach((t, i) => {
    const x = LABEL + i * (FW + GAP), f = createCanvas(FW, FH), fg = f.getContext('2d');
    fg.drawImage(scan, X0 / 2, Y0 / 2, CW / 2, CH / 2, 0, 0, FW, FH);
    const p = notePulse(t * 1000);
    if (p) for (const m of marks) drawNoteRing(fg, m, p.ring, p.alpha, look, p.n, p.whole);
    g.drawImage(f, x, y);
  });
});
writeFileSync(`${root}docs/notes-pulse/strips.png`, c.toBuffer('image/png'));
console.log(`${W}x${H}, ${marks.length} notes`);
