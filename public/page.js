// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
import { createScene, drawScene, W, H } from './scene.mjs';

const memo = new Map();
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };

const env = {
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  readJSON: (p) => once(p, () => fetch(p).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); })),
  loadImage: (p) => once(p, () => new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => no(new Error(`${p}: image failed`));
    img.src = p;
  })),
  loadFont: (family) => once('font', async () => {
    const face = new FontFace(family, 'url(font/IMFeENrm28P.ttf)');
    document.fonts.add(await face.load());
  }),
};

const $ = (id) => document.getElementById(id);
const ctx = $('map').getContext('2d');
let run = 0;

async function render() {
  const me = ++run;
  $('densityOut').textContent = $('density').value;
  try {
    const t0 = performance.now();
    const { scene, data, bg, timing } = await createScene(env, {
      ink: $('ink').value, parchment: $('parchment').value, density: Number($('density').value),
    });
    if (me !== run) return; // a newer change superseded this one
    const t1 = performance.now();
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, scene, data, bg, { scale: 1, x: 0, y: 0 });
    const t2 = performance.now();
    $('status').textContent = `load ${timing.load.toFixed(0)} ms, placement + parchment ${timing.place.toFixed(0)} ms, draw ${(t2 - t1).toFixed(0)} ms (total ${(t2 - t0).toFixed(0)} ms)`;
  } catch (e) {
    $('status').textContent = `Failed: ${e.message}`;
    throw e;
  }
}

for (const id of ['ink', 'parchment', 'density']) $(id).addEventListener('input', render);
render();
