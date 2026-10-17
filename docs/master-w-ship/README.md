# Master W's ship, `ship-w-key`: ink kept, the waves widened (#111)

`ship-w-key` of the `scanned` pack. The scan is Master W's engraving of a ship
([Art Institute of Chicago 27881](https://www.artic.edu/artworks/27881), 2139 px wide); crop (10,20)-(2110,2990).

![raw crop, the ink sprite, the patch candidate; map size below, 3x above, each multiplied onto parchment](steps.png)

`steps.png`: left to right, the raw crop, the ink sprite (the one shipped) and the patch candidate, each multiplied
onto parchment; the top row is 3x, the bottom row the width the map draws them (84 px).
`ship-w-key.raw.png` and `.key.png` (both shrunk to 700 px wide), with `.cut.png`, are the images behind the ink sprite; `.patch.cut.png` is the candidate.

**Call: keep `ink`.** The plate is ink alone on paper, and the visual pass found nothing the ink key loses that is
worth keeping. The patch candidate (paper `#d2c9bb`, measured from the open sky) comes out lighter and greyer at map
size, and the plate's uneven paper tone shows as a faint rectangle round the ship on parchment.

**Edge.** An inset mask (feather 40 px) trims only the plate mark at the crop's edge; the waves reach the foot of the
sprite. `pack.json`'s `source.crop` is the build's output, the crop inside that mask.

Absent from the sprite, and why:

- the paper's mottled tone and foxing across the sky: surround, and ink alone is what is wanted here.
- the plate mark and the grey stain at the crop's left edge: not the ship's; the inset mask cuts them.
