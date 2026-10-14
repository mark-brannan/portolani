# Carta Marina comparisons

Sheets that set the scan of Olaus Magnus's Carta Marina (1539) beside what the chart draws in
code, so a review can judge the likeness. The scan is
[Carta_Marina.jpeg](https://upload.wikimedia.org/wikipedia/commons/e/ea/Carta_Marina.jpeg)
(5016 x 3715, public domain); crop boxes are in its px, as (x0,y0)-(x1,y1).

## trees.png

Each row is a crop of the scan beside the trees of `scripts/trees.mjs`, both magnified 3x; the
last strip is the chart itself at map size (`trees=marina`, 15.5 E 59.5 N, zoom 9).

| Row | Scan crop | Drawn |
| --- | --- | --- |
| 1 | Svecia, (2850,2185)-(2950,2235): a row and a clump of round crowns | `marina`: rows, a forest clump on its green ground |
| 2 | Lappia, (2950,1085)-(3050,1135): a row of oval crowns | `marina`: ovals and conifers |
| 3 | Svecia, (2790,2160)-(2890,2210): Orsa's rows | `ink`: the same trees uncoloured |
