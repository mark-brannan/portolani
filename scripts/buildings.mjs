// Buildings after Olaus Magnus's Carta Marina (1539), drawn in code: the little house, church,
// castle, round tower and Lapp tent that mark every place on that chart, in red and ink on the
// parchment. Each is a shape in the form of scene.mjs's TOWERS: SVG path data (absolute M L H V Q Z
// only) in layers painted in order, `p` filled with parchment, `r` with the wind red, `k` with ink,
// `s` stroked only; every layer but `k` is stroked in ink. Foot at y = 0, the drawing at most 16.5
// units tall (TOWER_H) and `w` half-wide, so the same table draws them as town icons and as the
// page's picker glyphs. `top` is how tall a shape stands, where it is short of the full height.
// Each stands on an ink ground line, as the chart's buildings do.

// a crenellated wall from x0 to x1, from `base` up to y, its n merlons rising d above it
const crenel = (x0, x1, y, n, d, base = 0) => {
  const step = (x1 - x0) / (2 * n - 1);
  let s = '';
  for (let i = 0; i < 2 * n - 1; i++) s += `H${+(x0 + (i + 1) * step).toFixed(2)}${i < 2 * n - 2 ? `V${i % 2 ? y - d : y}` : ''}`;
  return `M${x0} ${base}V${y - d}${s}V${base}Z`;
};

const BUILDINGS = [
  // a house seen corner-on: the gable end with its door, the long side under a red roof
  { id: 'house', style: 'carta-marina', w: 6.5, top: 11, layers: [
    ['p', 'M-5.2 0V-6.2H-0.6V0Z'],
    ['p', 'M-0.6 0V-6.2H5.4V0Z'],
    ['r', 'M-2.9 -11H3.6L5.9 -6.2H-0.6Z'],
    ['p', 'M-5.6 -6.2L-2.9 -11L-0.2 -6.2Z'],
    ['k', 'M-3.6 0V-2.6Q-2.9 -3.6 -2.2 -2.6V0Z'],
    ['k', 'M1.4 -3.2H2.6V-4.5H1.4Z'],
    ['s', 'M-6.5 0H6.5'],
  ] },
  // a church: the west tower under a red needle spire, the nave behind it under a red roof
  { id: 'church', style: 'carta-marina', w: 7, layers: [
    ['p', 'M-2.6 0V-6.4H6V0Z'],
    ['r', 'M-2.6 -6.4V-9.4H3.8L6.4 -6.4Z'],
    ['p', 'M-6.2 0V-10.4H-2.4V0Z'],
    ['r', 'M-6.7 -10.4L-4.3 -16.5L-1.9 -10.4Z'],
    ['k', 'M-4.9 -7.4V-8.6Q-4.3 -9.4 -3.7 -8.6V-7.4Z'],
    ['s', 'M-5.1 0V-2.2Q-4.3 -3.4 -3.5 -2.2V0M0 -1.6V-4M2.2 -1.6V-4M4.4 -1.6V-4'],
    ['s', 'M-7 0H7'],
  ] },
  // a castle: three towers under red cones behind a crenellated wall with its gate
  { id: 'castle', style: 'carta-marina', w: 8, layers: [
    ['p', 'M-7 0V-10.4H-3.8V0Z'], ['p', 'M3.8 0V-10.4H7V0Z'], ['p', 'M-1.8 0V-12.6H1.8V0Z'],
    ['r', 'M-7.6 -10.4L-5.4 -14.6L-3.2 -10.4Z'], ['r', 'M3.2 -10.4L5.4 -14.6L7.6 -10.4Z'],
    ['r', 'M-2.4 -12.6L0 -16.5L2.4 -12.6Z'],
    ['p', crenel(-7.6, 7.6, -4.6, 7, 1.2)],
    ['k', 'M-1.5 0V-2.2Q-1.5 -3.6 0 -3.6Q1.5 -3.6 1.5 -2.2V0Z'],
    ['s', 'M-5.4 -6.8V-8.6M5.4 -6.8V-8.6M0 -8V-10.4'],
    ['s', 'M-8 0H8'],
  ] },
  // a tall round tower: the drum, a crenellated gallery and a red cap, a slit and a door
  { id: 'round-tower', style: 'carta-marina', w: 4.4, layers: [
    ['p', 'M-2.8 0.3Q0 1 2.8 0.3V-9.4H-2.8Z'],
    ['r', 'M-2.9 -10.6L0 -16.5L2.9 -10.6Z'],
    ['p', crenel(-3.6, 3.6, -10.6, 3, 1, -9.4)],
    ['k', 'M-1 0.5V-1.8Q0 -3 1 -1.8V0.5Z'],
    ['s', 'M0 -5V-7.2'],
    ['s', 'M-4.4 0.4H4.4'],
  ] },
  // a Lapp tent: a low cone of skins over its poles, crossed above the smoke hole, a dark door
  { id: 'tent', style: 'carta-marina', w: 6.8, top: 11.4, layers: [
    ['p', 'M-6.6 0Q-3 -4 -0.6 -8.6H0.6Q3 -4 6.6 0Z'],
    ['s', 'M-4 0L-0.4 -8.4M4 0L0.4 -8.4M-1.8 -11.2L1 -7.6M1.8 -11.2L-1 -7.6'],
    ['k', 'M-1.3 0L-0.6 -3.8H0.6L1.3 0Z'],
    ['s', 'M-6.8 0H6.8'],
  ] },
];

// A ruin: a broken colonnade, three columns on a step, two of them snapped short, in ink alone (a place with no city
// on its spot today). Not in BUILDINGS: it is no town to pick at random, only the mark of a place (scene.mjs).
const RUIN = { id: 'ruin', w: 7, top: 12, layers: [
  ['p', 'M-7 0V-1.8H7V0Z'],
  ['p', 'M-5.6 -1.8V-11.2H-3V-1.8Z'],
  ['p', 'M-6.2 -11.2H-2.4V-12.4H-6.2Z'],
  ['p', 'M-1.3 -1.8V-4.6L-0.1 -5.4L1.1 -4.4L1.3 -1.8Z'],
  ['p', 'M3 -1.8V-7.6L4.1 -8.2L5 -7.2L5.6 -7.8V-1.8Z'],
  ['s', 'M-4.8 -3V-10M-4 -3V-10M-0.4 -2.8V-3.6M4.2 -2.8V-6'],
  ['s', 'M-7 0H7'],
] };

// The places too small for the chart's towns (Natural Earth SCALERANK past 4, up to LESSER_RANK) are
// drawn from DETAIL_ZOOM on as a church or a house, LESSER_PX tall whatever the zoom, and lettered
// small. The bigger the place, the likelier a church: by rank and the place's own seed, so a place
// keeps its building across zooms and pans.
const LESSER_RANK = 8, LESSER_PX = 18, LESSER_LETTER = 12;
const lesserBuilding = (rank, seed) => ((seed >>> 0) % 4 < 7.5 - rank ? 'church' : 'house');

export { RUIN, BUILDINGS, LESSER_RANK, LESSER_PX, LESSER_LETTER, lesserBuilding };
