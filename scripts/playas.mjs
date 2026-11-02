// Playas after the period charts: Natural Earth's 10m dry salt flats and pans (Salar de Uyuni, the
// Great Salt Lake Desert, the Rann of Kutch), true shapes laid on the land, each style a function
// like the ones in water.mjs: (g, data, features), `data` being { proj, palette }, `features` what
// playasOf made, already cut to the view; 'off' is null. Natural Earth's min_zoom (counted in
// 256 px tiles) is read as water.mjs's `shown` reads it.

import { fill, limn, hatch, geojsonPolygons } from 'coast-wright';

const SALT = '#f3eee2', SALT_EDGE = '#8a7f6a', CLAY = '#cdbb98';

export function playasOf(geo) {
  return (geo?.features ?? []).map((f, i) => {
    const polys = geojsonPolygons(f.geometry);
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const [x, y] of polys.flatMap((p) => p[0])) { if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x; if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y; }
    return { id: f.id ?? i, polys, box, minZoom: f.properties?.min_zoom ?? 0 };
  });
}

function flat(g, data, features, { wash, alpha, hatching, edge, dash }) {
  const polys = features.flatMap((f) => f.polys);
  if (!polys.length) return;
  const { toPx, seam } = data.proj;
  fill(g, polys, toPx, { color: wash, alpha, ...seam });
  if (hatching) hatch(g, polys, toPx, { ...hatching, ...seam });
  g.save();
  if (dash) g.setLineDash(dash);
  limn(g, polys.flat(), toPx, { color: edge, alpha: 1, width: 1, oneStroke: true, ...seam });
  g.restore();
}

export const PLAYAS = {
  off: null,
  // a pale crust with a dotted edge and a fine stipple: salt left by a lake that dried
  salt: (g, data, features) => flat(g, data, features, { wash: SALT, alpha: 0.9, edge: SALT_EDGE, dash: [1.5, 3],
    hatching: { angle: Math.PI / 4, gap: 5, dash: [1, 5], color: SALT_EDGE, width: 1, alpha: 0.8 } }),
  // a clay pan ruled across with broken lines, as the Carta Marina rules a lake
  ruled: (g, data, features) => flat(g, data, features, { wash: CLAY, alpha: 0.75, edge: data.palette.ink,
    hatching: { angle: 0, gap: 4, dash: [6, 4], color: data.palette.ink, width: 0.8, alpha: 0.6 } }),
};
export const PLAYA_STYLES = Object.keys(PLAYAS);
