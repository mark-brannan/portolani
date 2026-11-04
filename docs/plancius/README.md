# The Plancius 1609 galleon and rose as patches

Two sprites of the `scanned` pack, style `plancius`, cut from Petrus Plancius, *Tabula geographica … Actis et Epistolis
Apostolorum* (Amsterdam, Cloppenburgh, 1609 state, engraved by Baptista van Doetecum; National Library of Israel, Eran Laor
Cartographic Collection, system no. 990023688790205171; public domain; 8,304 × 5,352; source id `plancius-acts`). Both are
patches: the whole crop, its edge feathered, the toned paper (`PLANCIUS_PAPER`, `#d5cdb2`, the mean of the 80th to 90th
percentile of the rose's pixels by brightness) divided out.

![raw crop beside the sprite, one row per sprite, both multiplied onto parchment at twice map size](steps.png)

`steps.png`: the raw crop on the left, the sprite on the right, both multiplied onto parchment at twice the width the map
draws them. `<id>.key.png` is the alpha key (white kept).

| Sprite | Kind | Crop (scan px) | Edge | Absent from the sprite, and why |
|---|---|---|---|---|
| `ship-plancius` | ship, bow left | (4558,2945)-(4905,3365); `figure` (4571,2966)-(4891,3310) | crop edge, two erase boxes | the "R" of "PARS" beside the stern (4884,3060)-(4905,3150) and the top of "Persei Specula" below the stern (4815,3292)-(4905,3365): lettering, erased; the second leaves the lower right corner of the sea bare. "PA" and "Canopicum" lie outside the crop. The water, the ripples under the hull and the parallel above the flag stay. |
| `rose-plancius` | rose | (2840,2835)-(3250,3245) | circle r 203, 4 px feather; two erase boxes | "Occidens", "Oriens" and "Meridies": lettering outside the circle; the tail of "Occidens" (2840,3015)-(2885,3065) and the head of "Meridies" (3026,3188)-(3080,3245) inside it, erased. The fleur-de-lis, the east ornament and the rhumbs stay. |

Not cut: the scale cartouche (lower right) is a scale bar with Dutch lettering, and scale bars are drawn in code; the
Acts vignettes round the border are not map decorations.
