// Reefs after the period charts, drawn by hand through coast-wright: Natural Earth's 10m reefs are
// lines, and a chart marked a hazard as a row of small signs rather than a line, so each style is a
// function drawing marks along them in pixels, one pen wide at every zoom. Same shape as the style
// tables of water.mjs: (g, data, features), `data` being { proj, palette } (the view's projection,
// and the scene's ink and red), `features` what reefsOf made, already cut to the view; 'off' is null.

import { runs, simplify, geojsonRings } from 'coast-wright';

const CROSS_HALF = 3.4, CROSS_GAP = 13; // px: a cross's arm, and the space along the line from one to the next
const DOT_R = 1.25, DOT_GAP = 5.5;

// Reefs from Natural Earth GeoJSON, each with its lon/lat box for the view to cut by and Natural
// Earth's own min_zoom (counted in 256 px tiles, as water.mjs's `shown` reads it).
export function reefsOf(geo) {
  return (geo?.features ?? []).map((f, i) => {
    const rings = geojsonRings(f.geometry);
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const [x, y] of rings.flat()) { if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x; if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y; }
    return { id: f.id ?? i, rings, box, minZoom: f.properties?.min_zoom ?? 0 };
  });
}

// Points every `gap` px along each pixel run, the first half a gap in, with the run's direction there.
function along(data, features, gap) {
  const { toPx, seam } = data.proj, marks = [];
  for (const f of features) {
    for (const run of runs(f.rings, toPx, { ...seam })) {
      const line = simplify(run, 1);
      let next = gap / 2; // the distance from here to the next mark
      for (let i = 1; i < line.length; i++) {
        const [x0, y0] = line[i - 1], [x1, y1] = line[i], len = Math.hypot(x1 - x0, y1 - y0);
        if (!len) continue;
        for (; next <= len; next += gap) marks.push({ x: x0 + (x1 - x0) * next / len, y: y0 + (y1 - y0) * next / len, a: Math.atan2(y1 - y0, x1 - x0) });
        next -= len;
      }
    }
  }
  return marks;
}

export const REEFS = {
  off: null,
  // the portolan charts' rocks and reefs: small black crosses in a row, set upright to the line
  crosses: (g, data, features) => {
    g.save();
    g.strokeStyle = data.palette.ink; g.lineWidth = 1.1; g.lineCap = 'round';
    g.beginPath();
    for (const { x, y, a } of along(data, features, CROSS_GAP)) {
      const c = Math.cos(a) * CROSS_HALF, s = Math.sin(a) * CROSS_HALF;
      g.moveTo(x - c, y - s); g.lineTo(x + c, y + s);
      g.moveTo(x + s, y - c); g.lineTo(x - s, y + c);
    }
    g.stroke();
    g.restore();
  },
  // the shoal dots, in red, as the ochre coast's: a dotted line along the reef
  dots: (g, data, features) => {
    g.save();
    g.fillStyle = data.palette.red; g.globalAlpha = 0.9;
    g.beginPath();
    for (const { x, y } of along(data, features, DOT_GAP)) { g.moveTo(x + DOT_R, y); g.arc(x, y, DOT_R, 0, 2 * Math.PI); }
    g.fill();
    g.restore();
  },
};
export const REEF_STYLES = Object.keys(REEFS);
