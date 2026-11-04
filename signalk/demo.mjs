// One command for the demo: builds the webapp, makes a fresh signalk-server config dir (.demo/) with this
// plugin linked in and pointed at the test's cell (US3WA46M), starts signalk-server with its sample
// NMEA 0183 data, and opens the webapp on Seattle.
//   node signalk/demo.mjs [--port 3000] [--no-open]
import { mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const port = Number(arg('--port') ?? 3000), SERVER = 'signalk-server@2.35.1';
await import('./build.mjs');

const config = join(HERE, '.demo');
rmSync(config, { recursive: true, force: true });
mkdirSync(join(config, 'node_modules'), { recursive: true });
symlinkSync(HERE, join(config, 'node_modules', 'signalk-portolan'), 'dir');
mkdirSync(join(config, 'plugin-config-data'));
writeFileSync(join(config, 'plugin-config-data', 'signalk-portolan.json'), JSON.stringify({ enabled: true, configuration: { charts: join(HERE, 'test', 'fixtures') } }));
writeFileSync(join(config, 'package.json'), JSON.stringify({ name: 'signalk-server-config', version: '0.0.1', private: true }));
writeFileSync(join(config, 'settings.json'), JSON.stringify({ interfaces: {}, pipedProviders: [] }));

const url = `http://localhost:${port}/signalk-portolan/#-122.425,47.635,11.7`;
console.log(`config ${config}\nstarting ${SERVER}; the webapp will be at ${url}`);
const server = spawn('npx', ['--yes', SERVER, '-c', config, '--sample-nmea0183-data'], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, PORT: String(port) }, detached: true });
let opened = false;
server.stdout.on('data', (d) => {
  process.stdout.write(d);
  if (!opened && /running at|listening/i.test(String(d))) {
    opened = true;
    console.log(`\nwebapp: ${url}`);
    if (!process.argv.includes('--no-open')) spawn(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});
// npx does not pass a signal on, so the server's whole process group is stopped
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
