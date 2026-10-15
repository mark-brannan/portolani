# de Bry Virginia sprites: the work shown

Sprites for the `debry` colour pack, cropped from Theodor de Bry after John White, *The arrival of
the Englishmen in Virginia* (Briefe and True Report, 1590, hand-coloured, 2,304 x 1,672;
manifest id `debry-virginia`). The map-ready PNGs are `packs/debry/*.png`; this folder is how they
were made, with the intermediate images kept so a crop can be judged and redone.

Regenerate everything here (the other packs are untouched) with:

    node scripts/build-packs.mjs --only debry --keep docs/debry-virginia

and `steps.png` (one row per sprite: raw, key, cut, map size, labelled) with:

    cd docs/debry-virginia
    args=(); while read -r id px; do
      args+=(-label "$id: raw" $id.raw.png -label key $id.key.png -label "cut (multiplied)" $id.cut.png \
             -label "map size, ${px}px wide" \( $id.cut.png -resize ${px}x \))
    done < <(node -e "for (const s of require('../../packs/debry/pack.json').sprites) console.log(s.id, s.sizePx)")
    magick montage -background '#e9d8b4' -fill '#3b2a1a' -pointsize 13 -tile 4x -geometry '300x220>+8+8' \
      "${args[@]}" -depth 8 -define png:compression-level=9 steps.png

## Files

| File | What it is |
|---|---|
| `overview.png` | the scan at 1,400 px wide, every crop box outlined and named |
| `steps.png` | a row per sprite: raw, key, cut, and the cut at map size, labelled |
| `<id>.raw.png` | the crop straight from the scan, no background removal: the before |
| `<id>.key.png` | the outline: white inside the figure's masks, feathered at the edge, the alpha the sprite ships with |
| `<id>.cut.png` | the finished sprite multiplied onto parchment at 1:1, as the renderer draws it, so the colours are true: the after |
| `svg/debry-ship-a.svg`, `.overlay.png` | the one SVG trace, and its overlay on the raw crop |

In `steps.png` the third column is `<id>.cut.png` and the fourth is the same cut shrunk to the
sprite's `sizePx`, the width it is drawn at on the map.

## Sprites

| id | what | crop (scan px) | erased, and why |
|---|---|---|---|
| ship-a | the large three-master, bow left, on its sea | 1122,1064 to 1678,1578 | the wrecked hull above the stern: a neighbouring figure |
| ship-b | the smaller three-master, on its sea | 1831,991 to 2214,1479 | nothing |
| monster | sea monster at the foot, with its swell and the water below | 441,1216 to 1009,1589 | nothing |
| canoe | dugout with two paddlers, on its water; heading left is a guess | 171,691 to 309,789 | the bottom-right corner: a neighbour's edge |
| tree-poplar | tall teal poplar with its grass mound and the shrubs beside it | 77,121 to 261,319 | the tall tree above it: a neighbouring figure |
| tree-poplars | three poplars on their mound | 93,346 to 254,527 | nothing |
| tree-broadleaf | three round-crowned trees | 263,201 to 477,377 | nothing |
| tree-grove | five poplars; the plate's fold line shows through | 1376,406 to 1589,581 | the top-left corner: a neighbour's edge |
| tree-conifer | one spruce-like tree | 1586,451 to 1689,574 | the grapevine's leaf at its right edge |
| tree-palm | the tiered palm | 2006,406 to 2109,594 | nothing |
| village-dasamonguepeuc | palisaded ring of huts with the land and shore round it | 586,297 to 694,384 | nothing |
| village-pasquenoke | the same, paler land | 1289,151 to 1405,227 | nothing |
| village-roanoac | the ring on Roanoac, huts fuller, haystacks beside | 756,603 to 924,701 | the lettering at its foot |

Each sprite's alpha is the whole crop, feathered at its edge, with the paper divided out; an
`erase` box cuts only a neighbour. Nothing in the raw crop is lost but what the last column names.

## Not cropped

- **Wrecked hulls**: only masts and yards show above the waves, in the same hatching; too fragmentary.
- **Fish weir**: a fine grid on hatched water, no colour to key on.
- **Other canoes**: smaller than the one taken; the one with sail and crew in mid-channel is a scene, not a sprite.
- **Grapevine, shrubs, fields**: not tried.

## SVG verdict

Poor: the trace of `debry-ship-a` keeps the masts and hull but loses the ratlines, shading and colour, a diagram rather than the engraving.

## Renderer

`debry` is listed in `PACK_NAMES` (scripts/scene.mjs), so its ships, monster, canoe and villages
are on by default, picked in the same lists as the other packs'. The trees are built but the
scene places no `tree` sprites yet (as with `palms-aguiar`), so they are unwired.
