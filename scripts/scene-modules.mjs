// scene.mjs and compass-turn.mjs (which the page and the webapp import beside it) and every file they
// reach by a relative import, walked rather than listed, so a new
// module ships with the scene that imports it (a hand-kept list once left the page blank). The
// build copies exactly this set into _site/, and the dev server serves exactly this set from
// scripts/, so a module the walk misses is blank in both places, never only on Pages.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const ENTRIES = ['scene.mjs', 'compass-turn.mjs'];
export async function relativeImports(root, entry = ENTRIES, seen = new Set()) {
  if (Array.isArray(entry)) { for (const e of entry) await relativeImports(root, e, seen); return seen; }
  if (seen.has(entry)) return seen;
  seen.add(entry);
  if (!entry.endsWith('.mjs')) return seen;
  const src = await readFile(path.join(root, 'scripts', entry), 'utf8');
  for (const [, f] of src.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+'\.\/([^']+)'/gm)) await relativeImports(root, f, seen);
  return seen;
}
