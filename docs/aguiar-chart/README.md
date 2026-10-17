# The Aguiar 1492 chart's rose and palms as patches (#111)

`rose-aguiar-b` and `palms-aguiar` of the `scanned` pack, re-keyed from ink levels to patches. The scan is
[Jorge_Aguiar_1492_MR.jpg](https://upload.wikimedia.org/wikipedia/commons/2/21/Jorge_Aguiar_1492_MR.jpg)
(Jorge de Aguiar, 1492, Beinecke Library, Yale; public domain), the whole coloured chart. Its paper, `#d3cfbb`
(`AGUIAR_CHART_PAPER`, the mean of the 80th to 90th percentile of the rose's pixels by brightness), is one constant,
shared by the town sprites of this scan when they are re-cut.

![raw crop beside the sprite, one row per sprite, both multiplied onto parchment at twice map size](steps.png)

`steps.png`: the raw crop on the left, the sprite on the right, both multiplied onto parchment at twice the width the
map draws them. `<id>.raw.png`, `.key.png` and `.cut.png` are the images behind it.

| Sprite | Crop (scan px) | Edge | Feather |
|---|---|---|---|
| `rose-aguiar-b` | (4158,2444)-(4502,2788) | circle, radius 165 | 3 px |
| `palms-aguiar` | (2520,2945)-(2740,3290) | polygon, top right | 2 px |

`figure` holds the old box on both, so each keeps its `sizePx` and anchor with the extra surroundings round it.

## `rose-aguiar-b`

The crop is 20 px wider each side than before, because the old one met the outer ring. Dropped fields: `dark`, `level`, eight `clean` boxes.

Visual pass: the star, the three rings, the vellum between the rhumbs, the red, green and blue washes and the wind
names (`ocsti`, `leste` and the rest) all survive, as drawn. Absent from the sprite, and why:

- the river and coast beyond the ring, and the rhumb lines running off: surround, outside the circle.
- a fleck of the river at the east rhumb tip: the tip meets the river, so the circle (radius 165, past the tip)
  takes a little of it; trimming it would cut the tip.
- the brown blot outside the ring at the east: surround, outside the circle.

## `palms-aguiar`

The crop runs 40 px lower than before, because the old one stopped short of the roots. Dropped fields: `level`, two `erase` boxes.

The old `erase` boxes were one on a neighbouring figure and one on lettering. Lettering now stays as drawn.
Visual pass: the three palms, the ground at their roots, the rhumb lines and the coast lettering at the foot all
survive. Absent from the sprite, and why:

- the red bars of the figure above right: a neighbouring figure, not the palms, cut by the polygon, whose edge sits
  just outside the fronds.
- the coast and its lettering below y 3290: outside the crop; the ground under the trees is whole.

## The nine towns

Each is a patch: the whole crop, divided by `AGUIAR_CHART_PAPER`, its edge feathered. `figure` holds the old box, so each
keeps its `sizePx` and anchor with the surroundings added round it. Dropped fields: `dark`, `level` (`TOWN_LEVEL` is
retired) and every `erase` box; lettering and rhumb lines beside a town stay as drawn. Rows 3 to 11 of `steps.png`.

| Sprite | Crop (scan px) | Cut |
|---|---|---|
| `town-aguiar-venice` | (2915,690)-(3170,915) | none |
| `town-aguiar-genoa` | (2745,858)-(2950,1048) | none |
| `town-aguiar-lisbon` | (1806,1458)-(1972,1596) | none, turned -4 degrees |
| `town-aguiar-lake` | (2321,2366)-(2435,2459) | none; the crop stops inside the lake's ring |
| `town-aguiar-lake-moat` | (2290,2334)-(2464,2494) | polygon just outside the ring, 3 px feather |
| `town-aguiar-smina` | (2918,3072)-(3084,3214) | none, turned 6 degrees |
| `town-aguiar-jerusalem` | (4694,1598)-(4826,1730) | none |
| `town-aguiar-ceuta` | (1998,1894)-(2104,2040) | none, turned 8 degrees |
| `town-aguiar-avignon` | (2330,1016)-(2462,1104) | none, turned -14 degrees |

Visual pass: every town, its hatching, wash and ground survive, as does the lettering beside it (the `Veneci` name,
`Genoa`, the coast names under Lisbon, Genoa and Smina). Absent from a sprite, and why:

- `town-aguiar-lake-moat`, the rivers leaving the lake (three tails below, one each side): a river is not the town, and
  the polygon runs just outside the ring so the rivers do not end in a cut stub far from the lake; the short stubs left are
  the feather's reach.
- the other eight: nothing present in the raw is missing at map size. The only difference is the edge feather, a few
  pixels of vellum, which the multiply sinks into the parchment.
