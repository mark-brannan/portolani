// The style settings read from the pack manifests: which styles a page offers, that every sprite
// names its style, and that a kind and style the chosen rendering lacks is drawn the other way;
// the sprite list a page offers, the default selection's rule, and what a selection draws.
// Offline: it reads only packs/*/pack.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listStyles, chooseSprites, listSprites, defaultSprites, selectSprites, RENDERINGS } from '../scripts/scene.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { readJSON: async (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) };
const manifests = { vivid: await env.readJSON('packs/vivid/pack.json'), scanned: await env.readJSON('packs/scanned/pack.json') };

test('listStyles offers the styles in the packs, the tower first among towns', async () => {
  assert.deepEqual(await listStyles(env), { rose: ['aguiar', 'martines', 'oliva', 'brouscon', 'fleurs', 'dieppe'], monster: ['carta-marina', 'bestiary', 'heraldic', 'pare'], town: ['tower', 'aguiar', 'martines'] });
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
  assert.ok(vivid.monsters.length > 0 && vivid.monsters.every((s) => s.pack === 'vivid' && s.style === 'carta-marina'));
  assert.ok(vivid.ships.length > 0 && vivid.ships.every((s) => s.pack === 'vivid'));
  assert.equal(vivid.cartouche.id, 'cartouche-frame');
  assert.deepEqual(vivid.towns, []); // the tower, drawn in code

  const scanned = chooseSprites(manifests, { rendering: 'scanned', town: 'aguiar' });
  assert.deepEqual(scanned.roses.map((s) => s.id), ['rose-aguiar', 'rose-catalan', 'rose-aguiar-b']);
  assert.equal(scanned.cartouche.id, 'cartouche-dewit');
  assert.deepEqual(scanned.towns.map((s) => `${s.pack}/${s.file}`),
    ['venice', 'genoa', 'lisbon', 'lake', 'lake-moat', 'smina', 'jerusalem', 'ceuta', 'avignon'].map((t) => `scanned/town-aguiar-${t}.png`));
  // a family drawn only as vectors still shows under the scanned rendering
  const bestiary = chooseSprites(manifests, { rendering: 'scanned', monster: 'bestiary' });
  assert.ok(bestiary.monsters.length > 0 && bestiary.monsters.every((s) => s.pack === 'vivid' && s.style === 'bestiary'));
  assert.ok(bestiary.ships.length > 0 && bestiary.ships.every((s) => s.pack === 'vivid' && s.style === 'bestiary'));

  const heraldic = chooseSprites(manifests, { monster: 'heraldic' });
  assert.ok(heraldic.monsters.length > 0 && heraldic.monsters.every((s) => s.pack === 'vivid' && s.style === 'heraldic'));
  assert.ok(heraldic.ships.length > 0 && heraldic.ships.every((s) => s.pack === 'vivid' && s.style === 'heraldic'));

  const plain = chooseSprites(manifests, { rendering: 'plain', town: 'aguiar' });
  assert.deepEqual([plain.roses, plain.monsters, plain.ships, plain.towns, plain.cartouche], [[], [], [], [], null]);

  // an unknown style falls back to the default family
  assert.deepEqual(chooseSprites(manifests, { monster: 'nonesuch' }).monsters.map((s) => s.id),
    chooseSprites(manifests, {}).monsters.map((s) => s.id));
});

test('listSprites keys every sprite by pack, ids that repeat across packs apart, and the shapes drawn in code', async () => {
  const list = await listSprites(env), keys = list.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, 'a key repeats');
  for (const s of list) assert.equal(s.key, `${s.pack}/${s.id}`);
  for (const k of ['vivid/serpent-a', 'scanned/serpent-a', 'plain/rose', 'plain/cartouche', 'plain/tower']) assert.ok(keys.includes(k), k);
  assert.equal(list.length, manifests.vivid.sprites.length + manifests.scanned.sprites.length + 3);
  assert.deepEqual(list.filter((s) => s.pack === 'plain').map((s) => [s.kind, s.file]), [['rose', null], ['cartouche', null], ['town', null]]);
});

test('defaultSprites: Carta Marina and Paré scans plus heraldic drawn monsters, every ship, town and mountain, one cartouche', async () => {
  const list = await listSprites(env), picked = new Set(defaultSprites(list)), on = list.filter((s) => picked.has(s.key));
  const wanted = (s) => s.kind === 'monster' && ((s.pack === 'scanned' && ['carta-marina', 'pare'].includes(s.style)) || (s.pack === 'vivid' && s.style === 'heraldic'));
  assert.deepEqual(on.filter((s) => s.kind === 'monster').map((s) => s.key), list.filter(wanted).map((s) => s.key));
  assert.ok(on.some((s) => s.style === 'pare') && on.some((s) => s.style === 'heraldic') && on.some((s) => s.style === 'carta-marina'));
  for (const kind of ['ship', 'town', 'mountain']) assert.deepEqual(on.filter((s) => s.kind === kind).map((s) => s.key), list.filter((s) => s.kind === kind).map((s) => s.key), kind);
  assert.ok(new Set(on.filter((s) => s.kind === 'ship').map((s) => s.pack)).size === 2, 'ships of both packs');
  assert.deepEqual(on.filter((s) => s.kind === 'cartouche').map((s) => s.key), ['vivid/cartouche-frame']);
  assert.ok(on.filter((s) => s.kind === 'rose').every((s) => s.pack === 'vivid' && s.style === 'aguiar'));
});

test('defaultSprites follows its rule, so a sprite added to a pack joins or stays out by family', async () => {
  const list = await listSprites(env);
  const add = (pack, kind, style) => ({ id: `new-${pack}-${kind}-${style}`, kind, style, pack, key: `${pack}/new-${pack}-${kind}-${style}`, file: 'x.png' });
  const more = [...list, add('scanned', 'monster', 'carta-marina'), add('vivid', 'monster', 'carta-marina'), add('vivid', 'monster', 'heraldic'), add('scanned', 'ship', 'bestiary'), add('vivid', 'town', 'new')];
  const picked = defaultSprites(more);
  assert.ok(['scanned/new-scanned-monster-carta-marina', 'vivid/new-vivid-monster-heraldic', 'scanned/new-scanned-ship-bestiary', 'vivid/new-vivid-town-new'].every((k) => picked.includes(k)));
  assert.ok(!picked.includes('vivid/new-vivid-monster-carta-marina'));
});

test('selectSprites draws the keys it is given, from either pack, and ignores keys it does not know', () => {
  const chosen = selectSprites(manifests, ['scanned/serpent-a', 'vivid/serpent-a', 'vivid/town-martines-port', 'plain/rose', 'plain/tower', 'nowhere/x', 'vivid/nonesuch']);
  assert.deepEqual(chosen.monsters.map((s) => s.key), ['vivid/serpent-a', 'scanned/serpent-a']);
  assert.deepEqual(chosen.monsters.map((s) => s.file), ['carta-marina-serpent-a.svg', 'serpent-a.png']);
  assert.deepEqual(chosen.towns.map((s) => s.key), ['vivid/town-martines-port']);
  assert.equal(chosen.tower, true);
  assert.ok(chosen.roses.length === 2 && chosen.roses.every((s) => s.plain), 'plain/rose is the rose set drawn in code');
  assert.deepEqual([chosen.ships, chosen.mountains, chosen.cartouche], [[], [], null]);
  assert.equal(selectSprites(manifests, ['plain/cartouche']).cartouche.plain, true);
  assert.equal(selectSprites(manifests, ['vivid/cartouche-frame', 'scanned/cartouche-dewit']).cartouche.key, 'vivid/cartouche-frame');
  assert.equal(selectSprites(manifests, []).tower, false);
});
