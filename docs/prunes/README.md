# Prunes 1559 rose: the work shown

The west rose of Prunes's chart of the Mediterranean, Black Sea and the coasts of western Europe
and north-west Africa, 1559 (Library of Congress 2014588812, public domain,
https://commons.wikimedia.org/wiki/File:(Chart_of_the_Mediterranean,_Black_Sea,_and_the_coasts_of_western_Europe_and_northwest_Africa)_LOC_2014588812.jpg),
cut as `packs/scanned/rose-prunes.png` for #52. Of the three big 32-point roses on the sheet it
stands in the clearest ground: the south rose has the AFRICA banner and a green hill against it,
the north-east one a scroll and a building touching its ring.

The scan is 11,503 x 16,180 with north to the right, so the cut is turned a quarter anticlockwise
(`turn: -90` in `scripts/build-packs.mjs`). The turn is made on the cut, not the scan: ImageMagick
will not turn 186 MP whole within its default limits. The cut is 2,100 px across and is shrunk
to 900 px (three times its 300 px drawn width).

`steps.png`, at twice map size: the raw cut on the left, the sprite multiplied onto the renderer's
parchment on the right.

| In the raw | In the sprite | Why |
|---|---|---|
| the vellum outside the ring, with the rhumb lines running off across it | gone | the circle (radius 1020 in a 2,100 px cut) is the figure's outline; the chart's own rhumb lines are drawn by the renderer |
| a sliver of a neighbouring figure at the left edge | gone | the same circle |
| the vellum's own tone | divided out | the paper is measured on the scan (`#b4a38d`), so under multiply the vellum becomes the map's parchment and the reds, blues and gilt keep their tone |

Nothing of the rose itself is lost: the points, the rings, the red wind letters and the needle are
in the sprite. It is a patch, not keyed by darkness levels.

Regenerate: `node scripts/build-packs.mjs --only scanned` (downloads the scan and checks it against
`scripts/sources.json`).
