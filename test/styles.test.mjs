// The style settings read from the pack manifests: which styles a page offers, that every sprite
// names its style, and that a kind and style the chosen rendering lacks is drawn the other way.
// Offline: it reads only packs/*/pack.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listStyles, chooseSprites, RENDERINGS } from '../scripts/scene.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { readJSON: async (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) };
const manifests = { vivid: await env.readJSON('packs/vivid/pack.json'), scanned: await env.readJSON('packs/scanned/pack.json') };

test('listStyles offers the styles in the packs, the tower first among towns', async () => {
  assert.deepEqual(await listStyles(env), { rose: ['aguiar'], monster: ['carta-marina'], town: ['tower', 'aguiar'] });
});

test('every sprite in both packs names its style', () => {
  for (const [name, m] of Object.entries(manifests)) {
    for (const s of m.sprites) assert.match(s.style ?? '', /^[a-z][a-z-]*$/, `${name}/${s.id} has no style`);
  }
});

test('a kind the rendering lacks is drawn from the other pack; plain draws no pictures', () => {
  assert.deepEqual(RENDERINGS, ['vivid', 'scanned', 'plain']);
  const vivid = chooseSprites(manifests, { rendering: 'vivid' });
  assert.deepEqual(vivid.roses.map((s) => `${s.pack}/${s.id}`), ['vivid/rose-aguiar', 'vivid/rose-catalan']);
  assert.ok(vivid.monsters.length > 0 && vivid.monsters.every((s) => s.pack === 'scanned' && s.style === 'carta-marina'));
  assert.ok(vivid.ships.length > 0 && vivid.ships.every((s) => s.pack === 'scanned'));
  assert.equal(vivid.cartouche.id, 'cartouche-frame');
  assert.deepEqual(vivid.towns, []); // the tower, drawn in code

  const scanned = chooseSprites(manifests, { rendering: 'scanned', town: 'aguiar' });
  assert.deepEqual(scanned.roses.map((s) => s.id), ['rose-aguiar', 'rose-catalan', 'rose-aguiar-b']);
  assert.equal(scanned.cartouche.id, 'cartouche-dewit');
  assert.deepEqual(scanned.towns.map((s) => `${s.pack}/${s.file}`), ['scanned/town-aguiar.png']);

  const plain = chooseSprites(manifests, { rendering: 'plain', town: 'aguiar' });
  assert.deepEqual([plain.roses, plain.monsters, plain.ships, plain.towns, plain.cartouche], [[], [], [], [], null]);

  // an unknown style falls back to the default family
  assert.deepEqual(chooseSprites(manifests, { monster: 'nonesuch' }).monsters.map((s) => s.id),
    chooseSprites(manifests, {}).monsters.map((s) => s.id));
});
