# Kitab-ı Bahriye Adriatic sprites: the work shown

Sprites for the `kitab` colour pack, cropped from Piri Reis, *Kitab-ı Bahriye*, the Adriatic (a later
copy, Walters Art Museum W.658, fol. 208a, painted and gilt, 1,226 x 1,800; manifest id
`kitab-i-bahriye-adriatic`). The map-ready PNGs are `packs/kitab/*.png`; this folder is how they
were made, with the intermediate images kept so a crop can be judged and redone.

Regenerate everything here (the other packs are untouched) with:

    node scripts/build-packs.mjs --only kitab --keep docs/kitab-i-bahriye

and `steps.png` (one row per sprite: raw, key, cut, map size, labelled) with:

    cd docs/kitab-i-bahriye
    args=(); while read -r id px; do
      args+=(-label "$id: raw" $id.raw.png -label key $id.key.png -label "cut (multiplied)" $id.cut.png \
             -label "map size, ${px}px wide" \( $id.cut.png -resize ${px}x \))
    done < <(node -e "for (const s of require('../../packs/kitab/pack.json').sprites) console.log(s.id, s.sizePx)")
    magick montage -background '#e9d8b4' -fill '#3b2a1a' -pointsize 13 -tile 4x -geometry '300x320>+8+8' \
      "${args[@]}" -depth 8 -define png:compression-level=9 steps.png

## Files

| File | What it is |
|---|---|
| `overview.png` | the scan at 1,000 px wide, the crop box and circle in red, the erase boxes in blue |
| `steps.png` | a row per sprite: raw, key, cut, and the cut at map size, labelled |
| `<id>.raw.png` | the crop straight from the scan, turned north up, no background removal: the before |
| `<id>.key.png` | the outline: white inside the figure's masks, feathered at the edge, the alpha the sprite ships with |
| `<id>.cut.png` | the finished sprite multiplied onto parchment at 1:1, as the renderer draws it, so the colours are true: the after |

## Sprites

| id | what | crop (scan px) | lost from the raw crop, and why |
|---|---|---|---|
| rose-kitab | the rose, fleur-de-lis north and rhumb lines, turned so north is up | 788,720 to 1128,1060 | the coast and lettering to the west, neighbours, and the rhumb lines under them |

The alpha is a feathered circle past the fleur's tip; erase boxes cut only the coast and lettering.

## Not cropped

- **Corner quarter-roses** (top-left and bottom-left): the gilt frame cuts each to a quarter, so neither reads as a rose.
- **Venice**: a lobe of the lagoon with dots for its islands, not a town drawing; the sheet has no town vignettes.
- **Islands**: the blue and yellow islands along the Dalmatian coast are the scene's `island` kind, which it does not place.
- **Ships, monsters, cartouche, mountains**: none on the sheet.

## Renderer

`kitab` is listed in `PACK_NAMES` (scripts/scene.mjs), so its rose is on by default under the
every-rose rule of `DEFAULT_RULES`.
