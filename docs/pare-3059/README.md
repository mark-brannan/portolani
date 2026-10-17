# Paré's bear-headed monster and sea bishop, `pare-bear` and `pare-bishop`: ink kept (#111)

Two sprites of the `scanned` pack from one scan, `pare-3059` (Ambroise Paré, *Des monstres*, woodcut, Wellcome
Collection L0033059, CC BY 4.0; 3555 px wide). Crops: bear (980,3220)-(2920,3860); bishop (1400,630)-(2520,2470).

![raw crop, the ink sprite, the patch candidate; 3x map size above, map size below, each multiplied onto parchment](steps.png)

`steps.png`: for each sprite, left to right, the raw crop, the ink sprite (the one shipped) and the patch candidate
(paper measured from the crop, `#c2c2c2` for the bear and `#b8b8b8` for the bishop; the figure's outline dilated 40 px
and feathered 14 px, so the whole crop round the figure stays), each multiplied onto parchment. The top two rows are 3x
the width the map draws them (bear 200 px, bishop 110 px); the bottom row is map size.
`pare-*.raw.png` and `.key.png` (both shrunk to 700 px wide) with `.cut.png` are the images behind the ink sprites;
`.patch.cut.png` is the candidate.

| Sprite | Call | Reason | In the raw, not in the sprite |
|---|---|---|---|
| `pare-bear` | keep `ink` | A woodcut in ink alone: the figure stands on no water or ground and has no wash, so the surround is only page. The patch candidate carries that page, a grey cloud and a smudged halo round the figure, and reads dirtier than the ink at map size. The ink silhouette (ink 50 %, dilate 8 px) takes the whole body, tail and fist; it cuts nothing of the figure. | the page's grey tone and mottling; the show-through of the verso's ghost figure; the verso's lettering ("qu'on auoit vn monstre marin en la mer de Norvvege") under the belly and arm. All are the book's, not the figure's. |
| `pare-bishop` | keep `ink` | The same: ink alone, no water or ground drawn. The polygon `mask` follows the figure's outline outside the ink and takes all of him: mitre, cope, hand and claws, scales, legs, the curl of tail at his left foot. The patch candidate carries the page's ghosts and smears round him. | the page's tone and the ghost of the verso's figure behind his left side; a grey ink stain and a few faint smeared strokes at his feet, a printing smear, not a drawn ground (at map size they read as a smudge, as the patch column shows); the verso's lettering below his feet. |

Neither sprite needed its outline widened, and neither is changed: the packs and the goldens are as on main.
Undo for each: `key: 'patch'` on the sprite (with a measured `paper`, as in the candidates) in `scripts/build-packs.mjs`.
