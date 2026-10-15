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

| id | what | crop (scan px) | how its outline was drawn |
|---|---|---|---|
| ship-a | the large three-master, bow left | 1202,1055 to 1595,1517 | polygon round hull and rigging; the sea hatching is the same ink |
| ship-b | the smaller three-master | 1892,1008 to 2176,1350 | same |
| monster | sea monster at the foot, with its swell | 522,1263 to 927,1519 | polygon; the blue swell stays, faint |
| canoe | dugout with two paddlers | 190,713 to 292,767 | polygon; heading left is a guess |
| tree-poplar | tall teal poplar | 85,142 to 169,304 | red channel as ink, wash silhouette |
| tree-poplars | three poplars | 103,343 to 239,489 | same |
| tree-broadleaf | three round-crowned trees | 276,206 to 464,359 | same |
| tree-grove | five poplars | 1400,419 to 1567,579 | same; the plate's fold line shows through |
| tree-conifer | one spruce-like tree | 1594,458 to 1669,563 | same; a vine leaf erased at the edge |
| tree-palm | the tiered palm | 2024,424 to 2088,579 | same |
| village-dasamonguepeuc | palisaded ring of huts | 609,300 to 710,369 | min(R,G,B) as ink, ellipse mask |
| village-pasquenoke | the same, paler land | 1310,173 to 1408,223 | same |
| village-roanoac | the ring on Roanoac | 767,625 to 895,703 | same; huts are fuller |

The key is a patch: the masks below draw the outline round each figure and everything inside it
stays, the water a ship sits in, the grass under a tree, the hatching round a village, with the
paper divided out so the renderer's multiply blend hides it. The masks define the whole patch; the
levels only seed the tree silhouette. The sea is hatched in the ink the ships are drawn in, so no
tone separates them and a hand-drawn polygon does it. The teal and green foliage sits on a yellow
wash hatched in brown, which the red channel splits into a silhouette. The village huts are straw
yellow, so the darkest of R, G, B finds them.

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
