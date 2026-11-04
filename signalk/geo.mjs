// The world geo the webapp ships (app/chart.mjs CHART_GEO), built as the page's build-preview builds it:
// the mountain ranges (scripts/ranges-file.mjs, slimRanges of the regions file) and the landmark peaks
// (scripts/peaks.mjs slimPeaks), each from the coastlines package pinned in the root package.json. Node
// only: the build writes these, and the test reads them, so both draw what the boat will.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rangesFromRegions } from '../scripts/ranges-file.mjs';
import { slimPeaks } from '../scripts/peaks.mjs';

export function chartGeo(root) {
  const data = (f) => join(root, 'node_modules', 'coastlines', 'data', f);
  return {
    'geo/ranges-10m.json': rangesFromRegions(data('ne-geography-regions-polys-10m.geojson')),
    'geo/peaks-10m.json': slimPeaks(JSON.parse(readFileSync(data('ne-geography-regions-elevation-points-10m.geojson'), 'utf8'))),
  };
}
