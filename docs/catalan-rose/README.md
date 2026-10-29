# The Catalan Atlas rose: a patch from sheet 5, and a traced vector

The Catalan Atlas (Cresques Abraham, 1375; BnF Gallica btv1b55002481n, public domain) has the first wind rose
drawn on any chart. Three sprites carry it:

| sprite | pack | what it is | `sizePx` |
|---|---|---|---|
| `rose-catalan` | scanned | a soft-edged patch of the scan, the whole disc inside the ring | 110 |
| `rose-catalan` | vivid | the traced vector, wind names and all | 300 |
| `rose-catalan-small` | vivid | the same vector inside the ring, no names, scaled to fill its box | 110 |

All three come from the full-size BnF sheet,
[Catalan_Atlas_BNF,_sheet_5.jpg](https://commons.wikimedia.org/wiki/File:Catalan_Atlas_BNF,_sheet_5.jpg)
(6454 x 15862, source `catalan-atlas-5`), where the ring is 1380 px across. They were cut from a 570 px Commons
detail, where it was about 306.

![old cut, new cut, old drawing, new vector, new small vector: each raw beside the sprite multiplied onto parchment, at 330 px and at 110 px](steps.png)

`steps.png`, one row per sprite; each row is the raw scan beside the sprite multiplied onto parchment, at 330 px
and then at 110 px (the width the map draws the small roses):

1. the old scanned cut, from the 570 px detail;
2. the new scanned cut, from sheet 5;
3. the old drawn SVG, beside the 570 px detail it was after;
4. the new vector `rose-catalan`, beside the same frame of sheet 5, wind names and all;
5. the new `rose-catalan-small`, beside the ring's frame of sheet 5.

## Colour

Sheet 5 is in Adobe RGB (1998). Sprites are stored without a profile and read as sRGB, so `build-packs` turns a
scan whose manifest entry names a `colorspace` into sRGB before cutting; without that, the vermilion and lapis go
grey. Every colour below is sRGB.

## The scanned patch

The whole disc inside the ring is the sprite, the vellum divided out so the renderer's multiply sinks it into the
parchment. Only the ring is an outline.

- **Ring:** centre (2060, 7998) on the sheet; outer line r 690, the line inside it r 672, inner circle r 516
  (least-squares fits to the ink, rms 2 to 5 px; the ring was drawn by hand).
- **Crop:** (1285, 7223)-(2835, 8773), so the 6 px edge fade falls on the sea.
- **Circle:** radius 715, 25 px outside the outer line, so its 18 px feather lies past the rhumb tips.
- **Paper:** `#cdc2ae`, the mean of the 80th to 90th percentile by brightness inside the ring.
- **Size:** stored at 330 px, as before. The gain is a sharper and truer source, not more pixels.

`rose-catalan.raw.png`, `.key.png` and `.cut.png` are the build's kept images
(`node scripts/build-packs.mjs --only scanned --keep docs/catalan-rose rose-catalan`).

In the raw but not in the cut, and why:

- the sea's blue waves round the ring: surround, outside the subject's ring;
- the eight wind names in their banners (the feather keeps the first letters of *leuante* and *ponente*): outside
  the ring. The vector carries them.

## The vector

`packs/vivid/rose-catalan.svg` is traced from a 3200 px sRGB crop of the sheet centred on the ring; the points,
rings, ticks, green lines and pole star are drawn from measurements, and the ornament, east cross and wind names
are traced paths (40 KB). The viewBox (-160..160) is unchanged, at 8.46 sheet px per unit.

**Measured geometry** (bearings clockwise from north, radii in sheet px):

| part | measure |
|---|---|
| rings | r 516 (inner), 672 and 690 (double outer), concentric |
| eight points | kites from the centre, tips at r 690; bearings NE 43.5, E 89, SE 137.5, S 178, SW 226, W 270, NW 313 |
| shoulders | r 230 to 268, about 22 deg either side of each axis |
| north | a lapis diamond (tip r 308) under a lapis arrowhead (tip r 518, on the inner circle) |
| pole star | eight gilt spurs with round tips (clubs: a neck about 22 px across, a bulb 40 to 50 px across, the tip rounded) round a core of r 45, centred at r 602 on bearing 0; spurs at bearings 2.7, 48, 85, 131.8, 178.2, 230, 269.3, 315.2, so NE and E sit 37 deg apart and SW and W 39, the rest 45 to 52; tips at 105 px, N 84 (under the ring line) and S 81 (on the arrowhead's tip). [pole-star.png](pole-star.png): raw, the old sun, the first lobes, this star, and each at map size; [pole-star-goldens.png](pole-star-goldens.png): the world goldens change by 8 to 11 px, at the star |
| ticks | 16 vermilion, inner circle to ring, at 12.7, 33.3, 56.5, 78, 103.1, 124.8, 149.4, 169.1, 193.5, 212.6, 235.9, 256.6, 282.5, 302.5, 327, 346.1 |
| green rhumbs | 8 half-wind lines, centre to ring: 22.3, 68, 113.9, 158.6, 202.9, 247, 292, 338.1 |
| east cross | the Levant cross, vermilion, in the band at 89 deg |

**Sampled colours**: raw sRGB on the scan, then as written in the SVG, divided by the vellum so that multiply
lands them on the parchment as they sat on the vellum.

| colour | raw | in the SVG |
|---|---|---|
| vellum (band between the rings) | `#cfc6b3` | white (the ground) |
| gilt (median) | `#bea26e` | `#ead19d` |
| gilt, shaded (the pole star's edge) | `#a28a62` | `#c7b28c` |
| vermilion | `#a6634a` | `#cc8069` |
| lapis, a blue-violet | `#626985` | `#7988be` |
| lapis, deep (ornament line work) | `#4f5573` | `#616ea4` |
| white ornament on the lapis | `#afb1ae` | `#d7e4f8` |
| gold ornament on the vermilion | `#b49472` | `#ddbfa2` |
| black-brown ink (the points' outlines) | `#605146` | `#766964` |
| red ink (ticks, cross, lettering) | `#c66e57` | `#f48e7c` |
| green | `#718471` | `#8baaa1` |
| ring ink | `#99816a` | `#bca797` |

**Trace method:** each ornament colour is a mask on the crop, traced with `findContours` and simplified with
`approxPolyDP` at 1.2 to 1.6 px. The chart's red rhumb lines that cross the banners are erased only where the red
is thin, because a word along its banner is itself a long straight red run.

## A full rose and a small one

The names reach 1.9 ring radii out (*tramuntana* to r 1320), so with them in the box the star is half the sprite:
about 56 px across at 110 px, against the old drawing's 103. So the vector is a pair, as the Martines, Oliva,
Brouscon, fleurs and Dieppe roses are: `rose-catalan` (star 153 px across at 300) and `rose-catalan-small` (star
103 px across at 110). Wherever a rose is drawn no bigger than its `-small` sibling's own size and the set holds
that sibling, the scene draws the sibling; at world zoom every rose is held to a twentieth of the page (80 px), so
there the Catalan rose is always the small one. `goldens.jpg` shows the five world goldens on main, with the names
in the 110 px sprite, and with the pair.

In the raw but not in the vector, and why:

- the sea's blue waves and the banner frames drawn in the same blue: surround (the frames were too faint to measure);
- the chart's own rhumb network and the brown meridian through the north and east banners: lines of the chart, not of the rose;
- the gilt's craquelure and worn grey patches: the leaf's ageing, drawn as one flat gilt;
- the darker brown on the points' shadowed edges: drawn as one even outline;
- the pole star's ragged, worn edge: drawn as eight even clubs at the measured bearings, because its gilt bleeds into the ring line and has flaked between the spurs;
- the finest hairlines of the lapis ornament: below the trace's tolerance;
- the gilt trefoil island and red mark at lower right: another figure.

The small vector also lacks the eight wind names: outside the ring, and at 110 px they would shrink the star to
half. The full sprite carries them.
