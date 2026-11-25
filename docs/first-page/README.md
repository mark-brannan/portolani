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

## The rose where his lines meet

A rose stands only where rhumb lines meet ([the spec](../spec/design.md), "A rose sits where rhumb lines meet").
Dulcert's lines meet at his hub, off Calabria, and at the sixteen nodes of his ring, 17 degrees out
([centres.md](../atlas/centres.md)); three of the sixteen fall in the sea, in the Bay of Biscay, off the Levant
and in the Baltic. None of them is inside D's frame, so on his own lines a frame on Italy holds a rose only at
the hub. `rose-on-lines.jpg` is the two first pages that keep the rule and his lines:

| | first page | file |
|---|---|---|
| G | the frame moved west, Iberia to Italy; the rose on the Biscay node, the hub bare off Italy | `rose-biscay-node.jpg` |
| I | D's frame; the rose at the hub at half the size, clear of Calabria | `rose-hub-small.jpg` |

`rose-at-todays-view.jpg` is the same two roses at the view the page serves today (7°E 40.3°N, zoom 5.48), no frame moved: the Biscay node lies above the top edge there, and the small hub rose is in frame.

`sheet-centred.jpg` is the view centred on the middle of Dulcert's sheet (8.5°E 46.3°N): at the served zoom it is the Alps, with his hub below the bottom edge and no sea node in frame; with the whole sheet in the window (zoom 4.37) the page lays de la Cosa's sheet and lines, not his.
