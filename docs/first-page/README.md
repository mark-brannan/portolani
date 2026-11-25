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
