// The node-side reader of the mountain ranges (ranges.mjs), for the hosts that build them from
// coastlines' regions file rather than read the site's geo/ranges-10m.json: the dev server, the
// headless render and the golden test. Kept apart so the page, which loads ranges.mjs, never
// imports node:fs.

import { readFileSync } from 'node:fs';
import { slimRanges } from './ranges.mjs';

// The slimmed ranges of a Natural Earth regions file, read once per path.
const fromRegions = new Map();
export function rangesFromRegions(file) {
  if (!fromRegions.has(file)) fromRegions.set(file, slimRanges(JSON.parse(readFileSync(file, 'utf8'))));
  return fromRegions.get(file);
}
