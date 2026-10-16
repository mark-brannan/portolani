// A band of detail cells, read from the catalogue the coastlines package publishes. scene.mjs
// fetches cells with it and build-preview.mjs writes them with it, so the directory and the cell
// size of a band have one source and cannot drift apart. This module ships to the browser, so it
// reads the package's JSON (which the preview copies beside the page and the import map names),
// not its Node module `coastlines/catalogue`.

import catalogue from 'coastlines/catalogue.json' with { type: 'json' };

// { dir, zoom, cell, margin } of the catalogue record `id`: `dir` is its `cells` source's folder under
// geo/, `zoom` the first zoom it draws past, `cell` and `margin` its grid in degrees.
export const bandOf = (id) => {
  const r = catalogue.find((c) => c.id === id || c.aliases?.includes(id)); // an id a band once went by is in its `aliases`
  return { dir: r.sources.find((x) => x.kind === 'cells').url.replace(/^geo\/|\/$/g, ''), zoom: r.zoom.min, cell: r.grid.cellDeg, margin: r.grid.marginDeg };
};
