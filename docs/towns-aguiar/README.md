# Aguiar town sprites: the work shown

Every town drawing on Jorge de Aguiar's 1492 chart
(https://commons.wikimedia.org/wiki/File:Jorge_Aguiar_1492_MR.jpg), cut as a sprite for the
scanned pack and traced as SVG, with the intermediate images kept so a crop or a trace can be
judged and refined in a later pass. The map-ready sprites are `packs/scanned/town-aguiar-*.png`;
this folder is the record of how they were made.

Regenerate everything here with:

    node scripts/build-packs.mjs --keep docs/towns-aguiar town-aguiar

## Files

| File | What it is |
|---|---|
| `town-aguiar-<id>.raw.png` | the crop straight from the scan, deskewed where the sprite has a `rotate`, with no background removal: the before |
| `town-aguiar-<id>.cut.png` | the finished sprite laid on the renderer's parchment at 1:1: the after of the keying |
| `svg/town-aguiar-<id>.svg` | an SVG traced over the raw crop (viewBox = the crop's pixel size), simple geometry matched to the drawn shapes |
| `svg/town-aguiar-<id>.overlay.png` | raw crop · the SVG on parchment · the SVG at half opacity over the raw crop, to see where the trace drifts |
| `before-after-z5.png` | the region view at zoom 5 with the old single crop (left) and these sprites (right) |

| `drawn-vs-scan.png` | each drawn variant (below) beside the crop it follows, large and at map size, 40 and 56 px tall |
| `seeds.png` | twelve seeds of the drawn walled town |

The traced SVGs are not in a pack; the vivid pack draws these towns with the generator below.

## The towns

| id | where on the chart | crop (scan px) | notes |
|---|---|---|---|
| venice | Venice in its lagoon | 2930,728 to 3160,888 | the halo of blue and green rays kept; the name, flagpole and coast names erased |
| genoa | Genoa under its mountain | 2762,882 to 2940,1018 | the blue harbour mole kept; the mountain and the lettering below erased |
| lisbon | Lisbon on the Tagus | 1822,1472 to 1958,1578 | deskewed 4 degrees; the river kept, the names round it erased |
| lake | the walled town in the Saharan lake | 2326,2372 to 2430,2452 | the town alone; this was the old `town-aguiar` crop's subject |
| lake-moat | the same with its lake | 2300,2358 to 2448,2486 | the rivers leaving the lake erased |
| smina | Smina on the Niger | 2932,3086 to 3072,3202 | deskewed 6 degrees; the river erased |
| jerusalem | Jerusalem | 4708,1612 to 4815,1714 | ink only, drawn lightly: keyed on luminance with a harder level |
| ceuta | a red gate tower on the Moroccan coast | 2010,1908 to 2092,2012 | deskewed 8 degrees; small |
| avignon | the red palace at Avignon | 2342,1026 to 2452,1086 | deskewed 14 degrees; drawn askew on the chart; small |

Keying: darkness = min(R, G, B) so the red and lapis washes count as ink, levelled 30 to 80 percent
(the roses use 12 to 78) so the thin brown line work reaches full alpha and reads at map size. The
renderer stands a town at its `sizePx` in px, flag to foot, times 1.25 for a chief town.

## SVG traces: state after the first pass

Good on the scan: venice, lake, smina, ceuta, jerusalem. Rough first passes: genoa (towers as boxes, the mole
right) and lisbon (buildings float on the hill). Avignon traces the crop as it is, which still
leans about 19 degrees: the sprite's `rotate: -14` is not enough, so the raster and the trace both
want a second deskew. Lake-moat is not traced. None of these is wired into a pack yet.

## Drawn variants: scripts/gen-towns-aguiar.mjs

The vivid pack's `town-aguiar-*.svg` are drawn by a generator in Aguiar's idiom, not traced:

    node scripts/gen-towns-aguiar.mjs --sheets

A town is laid out as the painter laid it: rows of oblique boxes, the back rows higher and drawn
first, so a front building hides part of the one behind it. Each box has a cream front face and a
blue-grey side face turned away from the middle of the town, paired slit windows, and madder
hatching down the wall; its roof is hipped, gabled, a rounded cushion, a pyramid, a needle spire or
a crenellated flat. Every corner and edge moves by a seeded jitter for the hand line. The town
stands on a boat-shaped wall seen from above (its rim dipping to the middle, ticks under the rim, a
dark gate at one end), on a green hill behind a wall, or on the ground. A variant is a plan and a
few parameters; the seed draws the rest, so the files are the same on every run and another seed
draws another town of the same kind (`seeds.png`).

| variant | after | heightPx |
|---|---|---|
| walled | the walled town in the Saharan lake | 72 |
| hall | Smina: a great red-roofed hall, round towers at the ends | 70 |
| towers | Genoa without its mole: slender towers and spires | 84 |
| hill | Lisbon: buildings stepping up a green hill | 80 |
| church | Jerusalem: church, belfry, domed corner towers, the lightest washes | 60 |
| gate | the red gate tower at Ceuta | 44 |
| venice | Venice in its halo of rays | 84 |
| moat | the walled town in its lake, the rivers leaving it | 84 |

The halo of rays and the lake with its rivers belong to one place each. Their pack entries carry
`only`, the town names they are drawn for (Venice; Hong Kong), and the scene keeps them out of the
family's pool: those towns draw them whenever the Aguiar family is chosen, and no other town does.
The scene ranks the other six by the ink their `heightPx` gives them: hill and walled for the
greatest cities, towers and hall next, church and gate for the smallest towns.
