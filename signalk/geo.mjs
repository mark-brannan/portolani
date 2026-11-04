// The world geo the webapp ships (app/chart.mjs CHART_GEO), built as the page's build-preview builds it:
// the mountain ranges (scripts/ranges.mjs slimRanges) and the landmark peaks (scripts/peaks.mjs
// slimPeaks), each from the coastlines package pinned in the root package.json. Node only: the build
// writes these, and the test reads them, so both draw what the boat will.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slimRanges } from '../scripts/ranges.mjs';
import { slimPeaks } from '../scripts/peaks.mjs';

export function chartGeo(root) {
  const read = (f) => JSON.parse(readFileSync(join(root, 'node_modules', 'coastlines', 'data', f), 'utf8'));
  return {
    'geo/ranges-10m.json': slimRanges(read('ne-geography-regions-polys-10m.geojson')),
    'geo/peaks-10m.json': slimPeaks(read('ne-geography-regions-elevation-points-10m.geojson'), read('ne-coastline-10m.geojson')),
  };
}
