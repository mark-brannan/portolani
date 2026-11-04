// NOAA's US3WA46M as published, through GDAL: each layer's feature count equals GDAL 3.14's ogr2ogr on
// the same cell, measured 2026-11-03. The zip is fetched into downloads/ once; offline, the test skips.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCells, withCell, convertCell } from '../lib/cells.mjs';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'downloads', 'enc');
const URL_ = 'https://charts.noaa.gov/ENCs/US3WA46M.zip';
const ORACLE = { DEPARE: 598, DEPCNT: 700, SOUNDG: 40, COALNE: 383, LNDARE: 133, SEAARE: 110, LIGHTS: 250, BOYLAT: 36, WRECKS: 81 };

async function cell() {
  const zip = join(CACHE, 'US3WA46M.zip'), dir = join(CACHE, 'US3WA46M');
  if (!existsSync(zip)) {
    const res = await fetch(URL_, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${URL_}: ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  if (!existsSync(dir)) execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  return findCells(dir).find((c) => c.cell === 'US3WA46M');
}

test('US3WA46M from NOAA: the layers count as GDAL 3.14 counts them', { timeout: 30000 }, async (t) => {
  let c;
  try { c = await cell(); } catch (e) { t.skip(`offline: ${e.message}`); return; }
  const counts = await withCell(c, async (Gdal, ds, layers) => layers);
  for (const [name, n] of Object.entries(ORACLE)) assert.equal(counts[name], n, name);
  const { layers } = await convertCell(c);
  for (const name of ['DEPARE', 'DEPCNT', 'SOUNDG', 'COALNE', 'LNDARE', 'WRECKS']) assert.equal(layers[name].length, ORACLE[name], `${name} in the store`);
});
