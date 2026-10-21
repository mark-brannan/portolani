// Overlays: the scan of a chart laid over the live map as an image, an ornament over the vector coast
// (docs/overlay/README.md). Each scan is split into pieces, each with its own fit: a similarity from
// scan pixels to longitude and Mercator latitude, read off the chart's figures (docs/atlas/ornaments.md).
// packs/overlays/overlays.json lists the overlays; scripts/build-overlays.mjs makes it and the image.

const RAD = Math.PI / 180;
const mercDeg = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD; // Mercator latitude, in degrees
const latOf = (m) => (2 * Math.atan(Math.exp(m * RAD)) - Math.PI / 2) / RAD;

// A similarity (scale, turn, shift; no mirror) from scan px to (longitude, Mercator latitude), fitted by
// least squares to `pairs` [[x, y], [lon, lat]]. The scan's y runs down, so it is z = x - iy and the
// fit is w = (a + ib) z + (tx + i ty): lon = a x + b y + tx, mercator = b x - a y + ty. Returns
// { a, b, tx, ty, scale (degrees per px), turn (degrees) }.
export function similarityFit(pairs) {
  const n = pairs.length;
  if (n < 2) throw new Error('a similarity needs two pairs or more');
  const pts = pairs.map(([[x, y], [lon, lat]]) => [x, y, lon, mercDeg(lat)]);
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  const mu = pts.reduce((s, p) => s + p[2], 0) / n, mv = pts.reduce((s, p) => s + p[3], 0) / n;
  // centred, the normal equations separate: a = sum(x u - y v) / sum(x^2 + y^2), b = sum(y u + x v) / ...
  let sa = 0, sb = 0, ss = 0;
  for (const [x, y, u, v] of pts) {
    const dx = x - mx, dy = y - my, du = u - mu, dv = v - mv;
    sa += dx * du - dy * dv; sb += dy * du + dx * dv; ss += dx * dx + dy * dy;
  }
  const a = sa / ss, b = sb / ss;
  return { a, b, tx: mu - a * mx - b * my, ty: mv - b * mx + a * my, scale: Math.hypot(a, b), turn: Math.atan2(b, a) / RAD };
}

// A scan pixel's longitude and latitude by a fit.
export function applyFit(fit, x, y) {
  return [fit.a * x + fit.b * y + fit.tx, latOf(fit.b * x - fit.a * y + fit.ty)];
}

// The affine that takes three points `src` onto three points `dst`, as the canvas's
// [a, b, c, d, e, f] (X = a x + c y + e, Y = b x + d y + f); null when `src` lies on a line.
export function affineThrough3(src, dst) {
  const [[x0, y0], [x1, y1], [x2, y2]] = src;
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-12) return null;
  const solve = (q0, q1, q2) => {
    const p = ((q1 - q0) * (y2 - y0) - (q2 - q0) * (y1 - y0)) / det;
    const q = ((x1 - x0) * (q2 - q0) - (x2 - x0) * (q1 - q0)) / det;
    return [p, q, q0 - p * x0 - q * y0];
  };
  const [a, c, e] = solve(dst[0][0], dst[1][0], dst[2][0]);
  const [b, d, f] = solve(dst[0][1], dst[1][1], dst[2][1]);
  return [a, b, c, d, e, f];
}

// The overlay `id` names in packs/overlays/overlays.json, with its image; null for an id the site lacks
// or a file that fails to load, so a missing overlay never stops the map.
const loaded = new Map();
export function loadOverlay(id, env) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '')) return Promise.resolve(null);
  if (!loaded.has(id)) {
    loaded.set(id, (async () => {
      const list = await env.readJSON('packs/overlays/overlays.json');
      const o = (list?.overlays ?? []).find((v) => v.id === id);
      return o ? { ...o, img: await env.loadImage(`packs/overlays/${o.file}`) } : null;
    })().catch(() => (loaded.delete(id), null)));
  }
  return loaded.get(id);
}

// The overlay drawn through the projection at `opacity` (0 to 1), over whatever the context holds and
// under its current transform (the view's, at a stop; the identity in a moving frame). Each piece is
// one affine through three of its corners, mapped scan px -> (lon, lat) by its fit -> page px by
// `proj.project`. In Mercator that is exact, since a similarity onto Mercator coordinates is affine
// there; in any other projection it is an approximation, true at those three corners and drifting
// between them, the more the further the chart reaches from the view's centre. A piece with a corner
// past an azimuthal projection's horizon, or wholly off the page, is left out.
export function drawOverlay(g, overlay, proj, opacity = 0.6, { w = 1600, h = 1600 } = {}) {
  if (!overlay?.img || !(opacity > 0)) return;
  const s = overlay.scale ?? 1, H = overlay.height;
  g.save();
  g.globalAlpha = Math.min(1, opacity);
  g.globalCompositeOperation = 'source-over';
  for (const { x0, x1, fit } of overlay.pieces) {
    const yb = Math.min(H, overlay.img.height * s), corners = [[x0, 0], [x1, 0], [x0, yb], [x1, yb]].map(([x, y]) => applyFit(fit, x, y));
    if (proj.visible && !corners.every(([lon, lat]) => proj.visible(lon, lat))) continue;
    const page = corners.map(([lon, lat]) => proj.project(lon, lat));
    const xs = page.map((p) => p[0]), ys = page.map((p) => p[1]);
    if (!page.flat().every(Number.isFinite) || Math.max(...xs) < 0 || Math.min(...xs) > w || Math.max(...ys) < 0 || Math.min(...ys) > h) continue;
    const sh = Math.min(H / s, overlay.img.height), src = [[x0 / s, 0], [x1 / s, 0], [x0 / s, sh]];
    const m = affineThrough3(src, page.slice(0, 3));
    if (!m) continue;
    g.save();
    g.transform(...m);
    g.drawImage(overlay.img, x0 / s, 0, (x1 - x0) / s, sh, x0 / s, 0, (x1 - x0) / s, sh);
    g.restore();
  }
  g.restore();
}
