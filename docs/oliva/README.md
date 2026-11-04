# The Oliva family chart's roses, mountains, Jerusalem and palm as patches

Six sprites of the `scanned` pack, style `oliva`, cut from
[17th-century_Portolan_chart_of_the_Mediterranean_Sea_by_a_member_of_the_Oliva_family.jpg](https://commons.wikimedia.org/wiki/File:17th-century_Portolan_chart_of_the_Mediterranean_Sea_by_a_member_of_the_Oliva_family.jpg)
(a member of the Oliva family, 1621–1665, hand-painted on vellum; scan by Barry Lawrence Ruderman Antique Maps, PD-Art;
17,316 × 11,126; source id `oliva-chart`). Every sprite is a patch: the whole crop, its edge feathered, the vellum
(`OLIVA_PAPER`, `#ddd7bf`, the mean of the 80th to 90th percentile of the big rose's pixels by brightness) divided out,
so the renderer's multiply sinks it into the parchment. No levels: the washes keep their tone.

![raw crop beside the sprite, one row per sprite, both multiplied onto parchment at twice map size](steps.png)

`steps.png`: the raw crop on the left, the sprite on the right, both multiplied onto parchment at twice the width the map
draws them. `<id>.key.png` is the alpha key (white kept), shrunk to 800 px; `npm run packs -- --only scanned --keep <dir> <id>`
writes the full-size raw, key and cut.

The chart draws the Levant and Caucasus figures and the Barbary palm on their sides, base to the east; those four cuts are
turned a quarter clockwise (`turn: 90`) so they stand upright.

| Sprite | Kind | Absent from the sprite, and why |
|---|---|---|
| `rose-oliva` | rose | rhumbs and hill outside the ring: surround; a blue wave sliver at the east tip stays. |
| `rose-oliva-small` | rose | the rest of "Valentia" outside the ring: surround. |
| `mountain-oliva-ararat` | mountain | the "A" of "ASIA" and the hills west of the Ark: neighbours. |
| `mountain-oliva-hills` | mountain | the Ark's prow: the next figure, erased; a small notch at the foot. |
| `town-oliva-jerusalem` | town | the "Jerusalem" lettering: outside the crop. |
| `palms-oliva` | tree | (4060,6930)-(5150,8000), turned 90 | crop edge only | nothing; the strip of ground and the rhumb lines stay. |

Not cut: the second big rose (top left) and the third (bottom right) repeat `rose-oliva`'s design, and the top-left one
is clipped by the scale bar; the scale-bar cartouche (bottom centre) has no blank panel for the map's title, and scale
bars are drawn in code; the tower-and-cross figures at Saida and Damascus are worn to blue blots.
