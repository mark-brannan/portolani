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

// A sheet placement from a similarity: the scan's centre px through the fit, its scale in Mercator degrees
// per scan px, and its turn in degrees clockwise on the page (the fit's b > 0 tilts the scan's x axis
// north going east, which is anticlockwise with y down).
export function sheetOf(fit, width, height) {
  const [lon, lat] = applyFit(fit, width / 2, height / 2);
  return { lon, lat, scale: Math.hypot(fit.a, fit.b), turn: -Math.atan2(fit.b, fit.a) / RAD };
}

// The sheet's affine on the page: [a, b, c, d, e, f] for drawn px (the scan at `overlay.scale`) ->
// page px, by `proj`: its centre at proj.project(lon, lat), its px size from the view's zoom alone (proj.k is
// px per radian of longitude, the same in every projection), turned clockwise by `turn`. Null when the centre
// is past an azimuthal projection's horizon.
export function sheetTransform(overlay, proj, sheet) {
  if (proj.visible && !proj.visible(sheet.lon, sheet.lat)) return null;
  const [cx, cy] = proj.project(sheet.lon, sheet.lat);
  if (![cx, cy].every(Number.isFinite)) return null;
  const k = sheet.scale * (overlay.scale ?? 1) * proj.k * RAD, t = sheet.turn * RAD, c = Math.cos(t) * k, s = Math.sin(t) * k;
  const w = overlay.img?.width ?? overlay.width / (overlay.scale ?? 1), h = overlay.img?.height ?? overlay.height / (overlay.scale ?? 1);
  return [c, s, -s, c, cx - c * (w / 2) + s * (h / 2), cy - s * (w / 2) - c * (h / 2)];
}
// The sheet's four page corners, top-left first then clockwise; null off the horizon.
export function sheetCorners(overlay, proj, sheet) {
  const m = sheetTransform(overlay, proj, sheet);
  if (!m) return null;
  const w = overlay.img?.width ?? overlay.width / (overlay.scale ?? 1), h = overlay.img?.height ?? overlay.height / (overlay.scale ?? 1);
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
}
// Whether page px (x, y) lies on the sheet, by the inverse of its affine.
export function onSheet(overlay, proj, sheet, x, y) {
  const m = sheetTransform(overlay, proj, sheet);
  if (!m) return false;
  const det = m[0] * m[3] - m[1] * m[2], dx = x - m[4], dy = y - m[5];
  const u = (m[3] * dx - m[2] * dy) / det, v = (m[0] * dy - m[1] * dx) / det;
  const w = overlay.img?.width ?? overlay.width / (overlay.scale ?? 1), h = overlay.img?.height ?? overlay.height / (overlay.scale ?? 1);
  return u >= 0 && u <= w && v >= 0 && v <= h;
}
// The lon/lat frame the sheet covers, its four corners in Mercator coordinates about the centre (the
// placement's own geometry, no projection), for a view that frames the whole sheet.
export function sheetFrame(overlay, sheet) {
  const t = sheet.turn * RAD, c = Math.cos(t), s = Math.sin(t), w = overlay.width, h = overlay.height;
  const u0 = sheet.lon, v0 = mercDeg(sheet.lat);
  const lons = [], mercs = [];
  for (const [x, y] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
    // page axes: x east, y down; a clockwise turn by t takes (x, y) to (x c - y s, x s + y c)
    lons.push(u0 + (x * c - y * s) * sheet.scale); mercs.push(v0 - (x * s + y * c) * sheet.scale);
  }
  return { lonMin: Math.min(...lons), lonMax: Math.max(...lons), latMin: latOf(Math.min(...mercs)), latMax: latOf(Math.max(...mercs)) };
}

// The view that shows the whole sheet, in Mercator, with `pad` of its size clear round it: contained, never cropped.
export function sheetView(overlay, sheet, { w = 1600, h = 1000, pad = 0.08 } = {}) {
  const f = sheetFrame(overlay, sheet), m0 = mercDeg(f.latMin), m1 = mercDeg(f.latMax);
  const k = Math.min(w / ((f.lonMax - f.lonMin) * (1 + 2 * pad) * RAD), h / ((m1 - m0) * (1 + 2 * pad) * RAD)); // px per radian
  return { lon: (f.lonMin + f.lonMax) / 2, lat: latOf((m0 + m1) / 2), zoom: Math.log2((k * 2 * Math.PI) / 512) };
}

// The sheet drawn whole, opaque (or at `overlay.alpha` while it fades in), over whatever the context holds, under its current transform.
export function drawSheet(g, overlay, proj, sheet) {
  if (!overlay?.img || !sheet) return;
  const m = sheetTransform(overlay, proj, sheet);
  if (!m) return;
  g.save();
  g.globalAlpha = overlay.alpha ?? 1;
  g.globalCompositeOperation = 'source-over';
  g.transform(...m);
  g.drawImage(overlay.img, 0, 0);
  g.restore();
}

// The overlay `id` names in packs/overlays/overlays.json, with its image; null for an id the site lacks
// or a file that fails to load, so a missing overlay never stops the map. With a `mask` (the scanner's
// paper round the skin, transparent) the image is the scan composed with it on a canvas of the env's.
const loaded = new Map();
export function loadOverlay(id, env) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '')) return Promise.resolve(null);
  if (!loaded.has(id)) {
    loaded.set(id, (async () => {
      const list = await env.readJSON('packs/overlays/overlays.json');
      const o = (list?.overlays ?? []).find((v) => v.id === id);
      if (!o) return null;
      let img = await env.loadImage(`packs/overlays/${o.file}`);
      if (o.mask && env.createCanvas) {
        const mask = await env.loadImage(`packs/overlays/${o.mask}`), c = env.createCanvas(img.width, img.height), g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(mask, 0, 0, img.width, img.height);
        img = c;
      }
      return { ...o, img };
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

// The overlay in the link: `overlay=<id>` the chart's sheet laid over the map at its own placement;
// `sheet=<lon>,<lat>,<scale>,<turn>` where it was dragged to (the chart's own when left out);
// `overlaymode=pieces` the warped pieces instead, with `overlayopacity=<0..1>` how strongly. Off (no
// overlay), the sheet, its own placement and 0.6 are the defaults, and a default is left out of the hash.
// `ids`, when given, are the overlays the site has: any other id reads as off. `q` is a URLSearchParams.
export const OVERLAY_MODES = ['sheet', 'pieces'];
export const OVERLAY_DEFAULTS = { overlay: null, overlayMode: 'sheet', sheet: null, overlayOpacity: 0.6 };
export function overlayFromHash(q, ids) {
  const id = q.get('overlay') ?? '', o = Number(q.get('overlayopacity')), mode = q.get('overlaymode');
  const at = (q.get('sheet') ?? '').split(',').map(Number);
  const sheet = at.length === 4 && at.every(Number.isFinite) && Math.abs(at[1]) < 85.1 && at[2] > 0 ? { lon: at[0], lat: at[1], scale: at[2], turn: at[3] } : null;
  return {
    overlay: /^[a-z][a-z0-9-]*$/.test(id) && id !== 'off' && (!ids || ids.has(id)) ? id : OVERLAY_DEFAULTS.overlay,
    overlayMode: OVERLAY_MODES.includes(mode) ? mode : OVERLAY_DEFAULTS.overlayMode,
    sheet,
    overlayOpacity: q.has('overlayopacity') && o >= 0 && o <= 1 ? o : OVERLAY_DEFAULTS.overlayOpacity,
  };
}
export function overlayToHash(st, q) {
  if (st.overlay) q.set('overlay', st.overlay);
  if (st.overlayMode && st.overlayMode !== OVERLAY_DEFAULTS.overlayMode) q.set('overlaymode', st.overlayMode);
  if (st.sheet) q.set('sheet', sheetText(st.sheet));
  if (st.overlayOpacity !== OVERLAY_DEFAULTS.overlayOpacity) q.set('overlayopacity', st.overlayOpacity);
}
// A placement as the hash writes it: the centre to a thousandth of a degree, the scale to five places (a
// scan px is a few thousandths of a degree), the turn to a tenth.
export const sheetText = (s) => `${(+s.lon).toFixed(3)},${(+s.lat).toFixed(3)},${(+s.scale).toFixed(5)},${(+s.turn).toFixed(1)}`;
// Whether two placements are the same to the hash's rounding.
export const sameSheet = (a, b) => !!a && !!b && sheetText(a) === sheetText(b);
