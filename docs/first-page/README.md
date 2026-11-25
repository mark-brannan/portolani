# The first page

The home view is Dulcert's sheet (1339), and Dulcert drew no rose and no ship at sea. With historical
accuracy on, [#416](https://github.com/mark-brannan/portolani/pull/416) reads that sheet as bare, and the
first page a reader meets loses every figure. The bar for the first page: a rose, ships, and a framing of
some part of Europe that reads as a portolan chart at a glance.

`options.jpg` is six first pages side by side, drawn by `render.mjs` from the page's default style:

| | first page | rose | ships |
|---|---|---|---|
| A | today, seeded figures | none in frame | one, off Sicily |
| B | #416 as it stands, Dulcert read as bare | none | none |
| C | the default frame; Dulcert lent the Catalan Atlas's rose at its own hub, and its ships | at the hub, off Calabria | five |
| D | the same figures, the frame moved so the hub is centred: Italy in the middle, Sardinia to the Aegean | centred | five |
| E | the same figures, a wider frame: Gibraltar to Greece | centred | five |
| F | a closer first page at zoom 7, Italy and the Tyrrhenian on a grid sheet, seeded | one, off Sardinia | one |

**Lent figures.** Dulcert was a Majorcan; the Catalan Atlas (1375) is the same workshop tradition a
generation on, and carries the earliest known rose. C, D and E draw that rose at Dulcert's own hub (the
place his lines meet) and his sea carries the atlas's ship. The hub tile from #416 then says so: no rose of
Dulcert's, this one is the Catalan Atlas's. The rose in these renders is drawn at twice the 5% cap of
`ROSE_CAP`, about the share a Majorcan chart gives its rose; the cap change is not built yet.

`hub-centred.jpg`, `wide.jpg` and `default-frame.jpg` are D, E and C at full size.

## D with the rose moved

At the hub the rose covers Calabria. The lines are Dulcert's: their meeting point is read off his scan
([centres.md](../atlas/centres.md), 14.5°E 40.0°N, ±1.5°), so they stay. The rose is lent, and the chart it is
lent from does not set it on its own centre: the Catalan Atlas's rose sits 0.72 of the radius out on the west
line. So the rose moves out along one of Dulcert's rhumbs into open sea, and his lines still meet at a bare
point, as he drew them. `rose-moved.jpg` is three places for it, D's frame unchanged:

| | the rose | file |
|---|---|---|
| D1 | on the south-east rhumb, in the Ionian | `rose-ionian.jpg` |
| D2 | on the west rhumb, between Minorca and Sardinia | `rose-west-basin.jpg` |
| D3 | a short way out on the west rhumb, in the Tyrrhenian | `rose-tyrrhenian.jpg` |

A lent ship that stood where the rose now stands moves to the Tyrrhenian.
