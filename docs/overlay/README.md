# The scan laid over the map

A chart's scan can be laid over the live map as an image, warped onto today's coast, so the reader slides
between the old chart and the vector one. It is an ornament over the vector coast: drawn over the land
and sea, under the rhumb lines, names, towns, roses, beasts, ships and voyages. Off by default, like a
voyage; turned on under the chart in the Charts drawer ("Lay the scan over the map", with an opacity
slider) and kept in the link as `overlay=carta-marina&overlayopacity=0.6`.

One chart has it so far: the Carta Marina, 1539 (Olaus Magnus; Commons scan, public domain, see
ASSETS.md), in `packs/overlays/` at half size with `overlays.json`. `npm run overlays` makes both from the
full scan (`scripts/build-overlays.mjs`).

## How it is placed

The chart is not one similarity: Scandinavia is turned. The two fits of
[docs/atlas/ornaments.md](../atlas/ornaments.md) ("Carta Marina, 1539") split it at x = 2700 scan px. Each is
a similarity (scale, turn, shift) from scan px to longitude and Mercator latitude, refitted by least
squares from that page's figures table, which gives every figure's scan px and the lon, lat its side's fit
put it at. The refit gives back all 27 rows to 0.07 degree (the table rounds to 0.1); the fits' own
residual against the landmarks is 47 to 101 km.

| piece | scan px | scale | turn |
|---|---|---|---|
| west | x 0 to 2700 | 0.0113 °/px | 48° |
| Baltic | x 2700 to 5016 | 0.0100 °/px | 3° |

Each piece is drawn with one affine through three of its corners (scan px, through its fit, through the
view's projection). A similarity onto Mercator coordinates is affine in Mercator, so there the warp is
exact. In any other projection it is an approximation: true at those three corners and drifting between
them, the more the further the chart reaches from the view's centre. Where the two pieces meet, at x = 2700,
a straight seam runs down through Sweden and the west piece's turned corner shows as a diagonal edge north
of it; that is the two fits disagreeing, not a fault in the drawing.

## At the Carta Marina view

`npm run render -- --view 19.7,61.7,4.6 --overlay carta-marina:<opacity> --out <file>`, scaled to 1000 px.

Opacity 0.3: today's coast reads first, the chart under it.

![The Baltic and Scandinavia with the Carta Marina scan faint over them](carta-marina-0.3.jpg)

Opacity 0.6, the default: Gotland, Öland and the Åland islands of the scan sit on today's.

![The same view with the scan at 0.6](carta-marina-0.6.jpg)

Opacity 1: the scan alone under the lattice and the ornaments.

![The same view with the scan opaque](carta-marina-1.jpg)

Orthographic, the same centre (`--view 19.7,61.7,4.6,orthographic`): each piece is still one affine,
so it lands as a parallelogram where the true warp would curve; Scandinavia sits near its place, the
far edges of the chart drift.

![The Carta Marina scan over an orthographic view of northern Europe, its two pieces as parallelograms](carta-marina-orthographic.jpg)
