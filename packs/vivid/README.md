# vivid

Ornaments drawn as SVG for portolani, after public-domain originals: drawn, not traced, except the `heraldic` sea monsters and ships below, which are existing public-domain and CC0 SVG traces, recoloured. Each sprite's
`after` in `pack.json` names the page it is after; each file's opening comment says what it shows.
Paper shows through white, since the renderer lays sprites on the parchment with `multiply`.

## How to read a rose

Each rose style is a pair: a centre rose (300 px) and a small rose for the ring (110 px), drawn to match.

- **aguiar**: four lapis cardinals; east a black cross; the small rose's north a gilt pole star.
- **martines**: north a black fleur-de-lis on a green bar; east a black cross in the lettered disc.
- **oliva**: north a blue fleur-de-lis; east has no mark.
- **brouscon**: black-and-blue cardinals; no mark for north or east.
- **fleurs**: every wind wears a gilt fleur; read north by place.
- **dieppe**: north a gilt fleur-de-lis outside the ring; east a string of beads.

## Heraldic sea monsters and ships

The `heraldic` style (the page's "Monsters and ships"): sea monsters after Bara's 1579 heraldic woodcuts, and
engraved ships; existing public-domain and CC0 SVGs, recoloured to the pack ink. Each file's opening comment names its
source and licence.

## Sprite sizes

Towns, monsters and ships are sized by their ink, not by their files: the scene measures each drawing's inked box and
draws every town at one footprint for its population, and every monster or ship at its kind's footprint, so drawings
cut from different charts at different margins stand together. A town entry's `heightPx` says how grand the drawing is
against its family-mates (the scanned pack's entries take the same field): the grander drawings go to the more
populous towns. A monster's or ship's `sizePx` is the width a preview draws it at. A town entry with `only` (a list of
town names, as Natural Earth spells them) is drawn for those towns alone and never from its family's pool: Venice's
halo of rays, Hong Kong's lake.
