# The Catalan Atlas rose: a patch from sheet 5, and a traced vector

The Catalan Atlas (Cresques Abraham, 1375; BnF Gallica btv1b55002481n, public domain) has the first wind rose
drawn on any chart. Four sprites carry it, a pair in each pack:

| sprite | pack | what it is | `sizePx` |
|---|---|---|---|
| `rose-catalan` | scanned | a soft-edged patch of the scan, the whole rose with its eight wind names | 300 |
| `rose-catalan-small` | scanned | the same patch cut to the disc inside the ring | 110 |
| `rose-catalan` | vivid | the traced vector, wind names and all | 300 |
| `rose-catalan-small` | vivid | the same vector inside the ring, no names, scaled to fill its box | 110 |

All three come from the full-size BnF sheet,
[Catalan_Atlas_BNF,_sheet_5.jpg](https://commons.wikimedia.org/wiki/File:Catalan_Atlas_BNF,_sheet_5.jpg)
(6454 x 15862, source `catalan-atlas-5`), where the ring is 1380 px across. They were cut from a 570 px Commons
detail, where it was about 306.

![scanned full, scanned small, vector, small vector: each raw beside the sprite multiplied onto parchment, at 330 px and at 110 px](steps.png)

`steps.png`, one row per sprite; each row is the raw scan beside the sprite multiplied onto the map's parchment
(`#e9d8b4`), at 330 px and then at 110 px (the width the map draws the small roses):

1. the scanned `rose-catalan`, the whole rose with its names, beside its 2800 px frame of sheet 5;
2. the scanned `rose-catalan-small`, beside the ring's 1550 px frame;
3. the vector `rose-catalan`, beside the first frame;
4. the vector `rose-catalan-small`, beside the second.

## Colour

Sheet 5 is in Adobe RGB (1998). Sprites are stored without a profile and read as sRGB, so `build-packs` turns a
scan whose manifest entry names a `colorspace` into sRGB before cutting; without that, the vermilion and lapis go
grey. Every colour below is sRGB.

A sprite's colour is divided by a paper tone so the renderer's multiply lands it on the parchment. The Catalan
sprites divide by the parchment the map draws on (`#e9d8b4`), not by the sheet's own vellum (`#cdc2ae`, darker):
divided by the vellum, every colour drew 14% lighter in red on the map and the whole rose read washed out. Divided
by the parchment, the gilt, vermilion and lapis land at their values on the scan, and in the scanned sprites the
vellum inside the ring comes through as itself, a shade greyer than the parchment.

## The scanned patches

The full sprite is the whole rose with its eight wind names, the sea round it and the chart's lines through it, as
the raw crop is; the small one is the disc inside the ring. Only a circle is an outline, and nothing is erased.

- **Ring:** centre (2060, 7998) on the sheet; outer line r 690, the line inside it r 672, inner circle r 516
  (least-squares fits to the ink, rms 2 to 5 px; the ring was drawn by hand). The names reach r 1320.
- **Full crop:** (660, 6598)-(3460, 9398), 2800 px; its circle r 1390 cuts only the corners (the gilt trefoil island
  at lower right, the chart's lettering at the foot), with an 18 px feather.
- **Small crop:** (1285, 7223)-(2835, 8773), so the 6 px edge fade falls on the sea; its circle r 715 is 25 px
  outside the ring's outer line, so its 18 px feather lies past the rhumb tips.
- **Paper:** the map's parchment `#e9d8b4`, for the reason above.
- **Size:** the full sprite is stored at 900 px (three per CSS px at `sizePx` 300), the small at 330.

`rose-catalan.raw.png`, `.key.png` and `.cut.png`, and the same three for `rose-catalan-small`, are the build's
kept images (`node scripts/build-packs.mjs --only scanned --keep docs/catalan-rose rose-catalan`); the two raws are
kept at half size, the full one being 10 MB at 1:1.

In the raw but not in the full cut, and why:

- the gilt trefoil island at lower right, and the chart's line of lettering at the foot: other figures, cut by the
  corners of the circle.

In the raw but not in the small cut, and why:

- the sea's blue waves round the ring: surround, outside the subject's ring;
- the eight wind names in their banners (the feather keeps the first letters of *leuante* and *ponente*): outside
  the ring, and at 110 px they would shrink the star to half. The full sprite carries them.

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

**Sampled colours**: raw sRGB on the scan, then as written in the SVG, divided by the map's parchment (`#e9d8b4`)
so that multiply lands them on the parchment at their raw values.

| colour | raw | in the SVG |
|---|---|---|
| vellum (band between the rings) | `#cfc6b3` | white (the ground) |
| gilt (median) | `#bea26e` | `#d0bf9c` |
| gilt, shaded (the pole star's edge) | `#a28a62` | `#b1a38b` |
| vermilion | `#a6634a` | `#b67569` |
| lapis, a blue-violet | `#626985` | `#6b7cbc` |
| lapis, deep (ornament line work) | `#4f5573` | `#5664a3` |
| white ornament on the lapis | `#afb1ae` | `#c0d1f6` |
| gold ornament on the vermilion | `#b49472` | `#c5afa2` |
| black-brown ink (the points' outlines) | `#605146` | `#696063` |
| red ink (ticks, cross, lettering) | `#c66e57` | `#d9827b` |
| green | `#718471` | `#7c9ca0` |
| ring ink | `#99816a` | `#a79896` |

**Trace method:** each ornament colour is a mask on the crop, traced with `findContours` and simplified with
`approxPolyDP` at 1.2 to 1.6 px. The chart's red rhumb lines that cross the banners are erased only where the red
is thin, because a word along its banner is itself a long straight red run.

## A full rose and a small one

The names reach 1.9 ring radii out (*tramuntana* to r 1320), so with them in the box the star is half the sprite:
about 56 px across at 110 px, against the old drawing's 103. So the vector is a pair, as the Martines, Oliva,
Brouscon, fleurs and Dieppe roses are: `rose-catalan` (star 153 px across at 300) and `rose-catalan-small` (star
103 px across at 110). Wherever a rose is drawn no bigger than its `-small` sibling's own size and the set holds
that sibling, the scene draws the sibling; at world zoom every rose is held to a twentieth of the page (80 px), so
there the Catalan rose is always the small one. The scanned pack holds the same pair. `goldens.jpg` shows each world golden that changes, main beside this branch.

In the raw but not in the vector, and why:

- the sea's blue waves and the banner frames drawn in the same blue: surround (the frames were too faint to measure);
- the chart's own rhumb network and the brown meridian through the north and east banners: lines of the chart, not of the rose;
- the gilt's craquelure and worn grey patches: the leaf's ageing, drawn as one flat gilt;
- the darker brown on the points' shadowed edges: drawn as one even outline;
- the north arrowhead and the lapis diamond under it, drawn mirror-symmetric about north: the scan's slight lopsidedness is in its paint, not its outline;
- the pole star's ragged, worn edge: drawn as eight even clubs at the measured bearings, because its gilt bleeds into the ring line and has flaked between the spurs;
- the finest hairlines of the lapis ornament: below the trace's tolerance;
- the gilt trefoil island and red mark at lower right: another figure.

The small vector also lacks the eight wind names: outside the ring, and at 110 px they would shrink the star to
half. The full sprite carries them.
