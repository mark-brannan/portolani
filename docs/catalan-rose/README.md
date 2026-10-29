# The Catalan Atlas rose: a patch from sheet 5, and a traced vector

Two sprites carry the wind rose of the Catalan Atlas (Cresques Abraham, 1375; BnF Gallica btv1b55002481n, public
domain), the first rose drawn on any chart: `rose-catalan` of the `scanned` pack and `rose-catalan` of the `vivid`
pack. Both now come from the full-size BnF sheet,
[Catalan_Atlas_BNF,_sheet_5.jpg](https://commons.wikimedia.org/wiki/File:Catalan_Atlas_BNF,_sheet_5.jpg)
(6454 x 15862, source `catalan-atlas-5`), where the rose's ring is 1380 px across. They were cut from a 570 px
Commons detail, where it was about 306.

![old cut, new cut, old drawing, new vector, new small vector: each raw beside the sprite multiplied onto parchment, at 330 px and at 110 px](steps.png)

`steps.png`, one row per sprite. Left to right: the raw scan and the sprite multiplied onto parchment at 330 px
(the scanned sprite's stored width, and near the 300 px the full vector is listed at), then the same pair at
110 px, the width the map draws the small roses.

1. the old scanned cut, from the 570 px detail;
2. the new scanned cut, from sheet 5;
3. the old drawn SVG ("drawn, not traced"), beside the 570 px detail it was after;
4. the new vector, `rose-catalan`, beside the same frame of sheet 5, wind names and all. Its 110 px pair is
   what it would look like drawn small, which is why the small sprite below exists;
5. the new small vector, `rose-catalan-small`, beside the ring's frame of sheet 5 (row 2's raw).

## Colour

Sheet 5 is in Adobe RGB (1998) (its embedded profile). Sprites are stored without a profile and read as sRGB, so
`build-packs` now turns a scan whose manifest entry names a `colorspace` into sRGB before cutting; read as sRGB
the sheet's vermilion and lapis go grey. Every colour below is in sRGB.

## The scanned patch

The patch approach is the one this sprite has had since #111: the whole disc inside the ring is the sprite, the
vellum divided out so the renderer's multiply sinks it into the parchment, and the ring the only outline.

- **Where:** the ring's centre is (2060, 7998) on the sheet. Its outer line has r 690, the line inside it r 672, and
  the inner circle r 516. These are least-squares fits to the brown ink lines, rms 2 to 5 px: the ring was drawn by hand.
- **Crop:** (1285, 7223)-(2835, 8773), 1550 px square, so the 6 px edge fade falls on the sea.
- **Circle:** radius 715, 25 px outside the outer line, so its feather (`circleFeather` 18, the old 4 px scaled by
  the sheet's 4.5x) lies past the rhumb tips and does not fade them.
- **Paper:** `#cdc2ae`, measured the same way as before: the mean of the 80th to 90th percentile by brightness of
  the pixels inside the ring.
- **Size:** stored at 330 px (`MAX_SCALE` x `sizePx`), as before. The gain is a sharper and truer source, not more
  pixels.

`rose-catalan.raw.png`, `.key.png` and `.cut.png` are the build's kept images
(`node scripts/build-packs.mjs --only scanned --keep docs/catalan-rose rose-catalan`).

In the raw but not in the cut, and why:

- the sea's blue waves round the ring: surround, outside the subject's ring;
- the eight wind names in their banners, of which the circle's feather keeps the first letters of *leuante* and
  *ponente*: outside the ring. The vector carries them.

## The vector

`packs/vivid/rose-catalan.svg`, traced from a 3200 px sRGB crop of the sheet centred on the ring. The viewBox
(-160..160) is unchanged. One viewBox unit is 8.46 sheet px (0.1182 units per px), the
scale at which the farthest wind name, *tramuntana* (r 1320 px), ends 4 units inside the box.

**Measured geometry** (bearings clockwise from north, radii in sheet px):

| part | measure |
|---|---|
| rings | r 516 (inner), 672 and 690 (the double outer ring), concentric |
| eight points | kites from the centre; tips at r 690 on the outer ring (read 680 to 715 on the scan), bearings NE 43.5, E 89, SE 137.5, S 178, SW 226, W 270, NW 313 (the star sits about 1 deg anticlockwise of the sheet's north) |
| shoulders | r 230 to 268, about 22 deg either side of each axis (e.g. E 63.5/229 and 114.8/252) |
| north | a short lapis diamond (tip r 308, shoulders 336.2/215 and 15.6/208) under a lapis arrowhead whose tip is at r 518, on the inner circle, which leaves room for the pole star |
| pole star | eight gilt lobes round a core, centred at r 602, reaching 98 px from its centre |
| ticks | 16 vermilion ticks from the inner circle to the ring, at the quarter winds: 12.7, 33.3, 56.5, 78, 103.1, 124.8, 149.4, 169.1, 193.5, 212.6, 235.9, 256.6, 282.5, 302.5, 327, 346.1 |
| green rhumbs | 8 half-wind lines from the centre (hidden under the star) to the ring: 22.3, 68, 113.9, 158.6, 202.9, 247, 292, 338.1 |
| east cross | the Levant cross, vermilion, in the band at 89 deg: traced |

**Sampled colours** (raw sRGB on the scan, then as written: divided by the vellum so that multiply lands them on
the parchment as they sat on the vellum):

| colour | raw | in the SVG |
|---|---|---|
| vellum (band between the rings) | `#cfc6b3` | white (the ground) |
| gilt (median) | `#bea26e` | `#ead19d` |
| gilt, shaded (20th percentile; the pole star's edge) | `#a28a62` | `#c7b28c` |
| vermilion | `#a6634a` | `#cc8069` |
| lapis (the user's purple) | `#626985` | `#7988be` |
| lapis, deep (the ornament's line work) | `#4f5573` | `#616ea4` |
| white ornament on the lapis | `#afb1ae` | `#d7e4f8` |
| gold ornament on the vermilion | `#b49472` | `#ddbfa2` |
| black-brown ink (the points' outlines) | `#605146` | `#766964` |
| red ink (ticks, cross, lettering) | `#c66e57` | `#f48e7c` |
| green | `#718471` | `#8baaa1` |
| ring ink | `#99816a` | `#bca797` |

**Traced:** the white and deep-lapis ornament on the lapis points, the gold scrolls and dotted midline on the
vermilion, the east cross and the eight wind names round the ring. Each colour is a mask on the crop, traced with `findContours` and simplified with
`approxPolyDP` at 1.2 to 1.6 px. The wind names are the red inside each banner. The chart's red rhumb lines that
cross the banners are erased only where the red is thin, because a word written along its banner is itself a long
straight red run. The points, rings, ticks, green lines and pole star are drawn from the measurements above, not
from the trace. The file is 40 KB.

**Size on the map: a full rose and a small one.** The names reach 1.9 ring radii out (*tramuntana* to r 1320),
so with them in the box the ring is r 81.5 of 160 and the star is half the sprite: about 56 px across at 110 px,
against the old drawing's 103. So the vector ships as a pair, as the Martines, Oliva, Brouscon, fleurs and
Dieppe roses do:

| sprite | what it holds | `sizePx` | star across at that size |
|---|---|---|---|
| `rose-catalan` | the whole trace, wind names and all | 300 | 153 px |
| `rose-catalan-small` | the same drawing inside the ring (star, rings, ticks, green rhumbs, cross, pole star), no names, scaled 1.84x so the ring reaches r 150 | 110 | 103 px |

The full one is the centre rose when the view's seed picks it, and the small one rings it. Wherever a rose is
drawn no bigger than its `-small` sibling's own size and the set holds that sibling, the scene draws the sibling
instead: at world zoom every rose is held to a twentieth of the page (80 px), so there the Catalan rose is
always the small one. `goldens.jpg` shows the five world goldens on main, with the names in the 110 px sprite,
and with the pair.

In the raw but not in the vector, and why:

- the sea's blue waves, and the banner frames drawn in the same blue: surround (the frames were too faint against
  the waves to measure reliably);
- the chart's own rhumb network (red, green and brown lines crossing the rose and the banners) and the brown
  meridian through the north and east banners: lines of the chart, not of the rose;
- the gilt's craquelure and its worn grey patches (the north-west point most): the leaf's ageing, drawn as one
  flat gilt;
- the darker brown on the points' shadowed edges: drawn as one even outline;
- the pole star's own edge: drawn as eight measured lobes round a core, not traced, because its gilt bleeds into
  the ring line;
- the finest hairlines of the lapis ornament: below the trace's tolerance;
- the gilt trefoil island and red mark at lower right: another figure.

The small vector lacks all of the above, and also:

- the eight wind names in their banners: outside the ring, and at 110 px they would shrink the star to half;
  the full sprite carries them.
