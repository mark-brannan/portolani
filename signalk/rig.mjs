// Builds the plugin and syncs it into a local signalk-server's node_modules, so the rig runs this tree
// rather than the npm release. Stamps the copy with the commit it was built from and whether the tree
// was dirty (public/build.json, served at /signalk-portolan/build.json). Restarts the server container
// only when what it reads at startup (index.js, lib/, package.json) changed; the webapp in public/ is served fresh on reload.
//   SIGNALK_RIG=~/symphony/signalk SIGNALK_CONTAINER=signalk-server npm run rig
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RIG = (process.env.SIGNALK_RIG ?? join(homedir(), 'symphony', 'signalk')).replace(/^~(?=\/|$)/, homedir());
const CONTAINER = process.env.SIGNALK_CONTAINER ?? 'signalk-server';
const DEST = join(RIG, 'node_modules', 'signalk-portolan');
if (!existsSync(join(RIG, 'node_modules'))) throw new Error(`no signalk-server config dir at ${RIG} (set SIGNALK_RIG)`);

// A digest of what the server reads only at startup: index.js, every file under lib/, and package.json.
const serverDigest = (root) => {
  const h = createHash('sha256');
  const walk = (p, rel) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f), `${rel}/${f}`);
    else h.update(rel).update('\0').update(readFileSync(p)).update('\0');
  };
  walk(join(root, 'index.js'), 'index.js');
  walk(join(root, 'lib'), 'lib');
  walk(join(root, 'package.json'), 'package.json');
  return h.digest('hex');
};

execFileSync(process.execPath, [join(HERE, 'build.mjs')], { stdio: 'inherit' });

const git = (...a) => execFileSync('git', a, { cwd: HERE, encoding: 'utf8' }).trim();
const stamp = { commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain').length > 0, builtAt: new Date().toISOString() };

const before = serverDigest(DEST);
for (const f of ['index.js', 'lib', 'public', 'package.json']) {
  rmSync(join(DEST, f), { recursive: true, force: true });
  cpSync(join(HERE, f), join(DEST, f), { recursive: true });
}
writeFileSync(join(DEST, 'public', 'build.json'), JSON.stringify(stamp, null, 2) + '\n');
const changed = serverDigest(DEST) !== before;
console.log(`synced ${stamp.commit.slice(0, 7)}${stamp.dirty ? ' (dirty)' : ''} into ${DEST}`);

if (!changed) { console.log('index.js, lib/ and package.json unchanged: no restart, reload the page'); process.exit(0); }
const t0 = Date.now();
execFileSync('docker', ['restart', CONTAINER], { stdio: 'inherit' });
const port = process.env.SIGNALK_PORT ?? '3000';
for (;;) {
  try { const r = await fetch(`http://localhost:${port}/signalk`); if (r.ok) break; } catch {}
  if (Date.now() - t0 > 120_000) throw new Error(`${CONTAINER} not answering on :${port} after 120 s`);
  await new Promise((r) => setTimeout(r, 500));
}
console.log(`restarted ${CONTAINER}: up in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
