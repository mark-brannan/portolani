// A band of detail cells, read from the catalogue the coastlines package publishes. scene.mjs
// fetches cells with it and build-preview.mjs writes them with it, so the directory and the cell
// size of a band have one source and cannot drift apart.

import { band } from 'coastlines/catalogue';

// { dir, zoom, cell, margin } of the catalogue record `id`: `dir` is its `cells` source's folder under
// geo/, `zoom` the first zoom it draws past, `cell` and `margin` its grid in degrees.
export const bandOf = (id) => {
  const r = band(id);
  return { dir: r.sources.find((x) => x.kind === 'cells').url.replace(/^geo\/|\/$/g, ''), zoom: r.zoom.min, cell: r.grid.cellDeg, margin: r.grid.marginDeg };
};
