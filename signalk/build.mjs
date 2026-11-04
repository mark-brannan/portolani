// Builds the webapp into public/, which signalk-server serves at /signalk-portolan/: the page and its
// adapter (app/), the scene modules scene.mjs reaches (scripts/), coast-wright, the coastlines catalogue,
// the font, of the packs only what a chart draws (app/chart.mjs), and of the world geo only the mountain
// ranges and landmark peaks (geo.mjs). No voyages.
//   node signalk/build.mjs
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { relativeImports } from '../scripts/scene-modules.mjs';
import { packOf } from './app/chart.mjs';
import { chartGeo } from './geo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..'), OUT = join(HERE, 'public');
const out = (p) => { mkdirSync(dirname(join(OUT, p)), { recursive: true }); return join(OUT, p); };

rmSync(OUT, { recursive: true, force: true });
cpSync(join(HERE, 'app'), OUT, { recursive: true });
for (const f of await relativeImports(ROOT)) cpSync(join(ROOT, 'scripts', f), out(`scripts/${f}`));
cpSync(join(ROOT, 'node_modules', 'coast-wright', 'lib'), out('coast-wright'), { recursive: true });
cpSync(join(ROOT, 'node_modules', 'coastlines', 'catalogue.json'), out('coastlines/catalogue.json'));
cpSync(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), out('font/IMFeENrm28P.ttf'));
cpSync(join(ROOT, 'test', 'fixtures', 'OFL-IMFellEnglish.txt'), out('font/OFL-IMFellEnglish.txt'));
let files = 0;
for (const pack of ['vivid', 'scanned', 'debry']) {
  const kept = packOf(pack, JSON.parse(readFileSync(join(ROOT, 'packs', pack, 'pack.json'), 'utf8')));
  writeFileSync(out(`packs/${pack}/pack.json`), JSON.stringify(kept));
  for (const s of kept.sprites) { cpSync(join(ROOT, 'packs', pack, s.file), out(`packs/${pack}/${s.file}`)); files++; }
}
let geoBytes = 0;
for (const [p, geo] of Object.entries(chartGeo(ROOT))) { const s = JSON.stringify(geo); writeFileSync(out(p), s); geoBytes += Buffer.byteLength(s); }
console.log(`public/: ${(await relativeImports(ROOT)).size} scene modules, ${files} sprites, ${geoBytes} bytes of geo (ranges and peaks)`);
