# The atlas: where the ornaments go, and why

Design doc, draft. Status: proposed, partly built; the bands, the grid sheet and the page turn
were revised 2026-11-04 (the line in [decisions.md](../decisions.md)). It governs how the chart decides where its
roses, rhumb lines, monsters, ships, town drawings and names sit, and what happens to them when
the map moves. It is written for people, not only for the code: the chart borrows a construction
from the medieval chartmakers, and the borrowing is the point.

## What the reader sees

The ornaments belong to the earth. The rhumb lines, the roses, the beasts and the ships are laid on
the map like printed ink on one sheet of an atlas, and they stay where they were printed until the
reader turns to the next sheet. Before this design, every move of the map threw them away and
worked them out again for the new view: the clearest patch of sea near the middle of the window was
a different patch after a small drag, so everything landed somewhere else, and the chart read as a
window onto a generator rather than a map ([#107](https://github.com/mark-brannan/portolani/issues/107)).

**On a pan, nothing is re-dealt.** The rose off Genoa slides with the coast, its lines slide with
it, and the beast in the Tyrrhenian is the same beast in the same water when the drag ends. Pan
back, and exactly what was there comes back. Why: a chart is a thing you look across, and if
looking across it changes it, it is not a chart.

**On a zoom inside a band, the ink scales and nothing moves.** A line keeps its course across the
coast. A rose stays on its node and grows by a set fraction of the zoom ("What size an ornament
is"), so it neither looks pasted on nor swallows the sea. Why: a band is one sheet's worth of zoom,
and a sheet does not change while you hold it closer.

**Through a page turn, a crossfade.** At each whole zoom level from 4 up, the chart turns to the
sheet below. Over a short span of zoom centred on the whole number, the outgoing sheet's lines,
roses, beasts and ships fade out while the incoming sheet's fade in. This is the only moment the
roses and beasts change, and it comes once per zoom level, at a place the reader learns to expect.
Why a crossfade and not a swap: the turn is where the chart still felt re-dealt ([#107](https://github.com/mark-brannan/portolani/issues/107)'s table),
and a fade makes the jump a change of sheet. It also fills the emptiest end of the outgoing band
with the incoming sheet's nodes, which stand closer together.

**How often a window shows a rose.** A rose stands only on a node or the centre of the sheet's
hidden circle, at sea and clear of land ("The fallback grid"), so not every window holds one:
nearly every window at a band's start, about two in three at its end, before the crossfade adds the
next band's. Measured 2026-11-04 on a mockup branch, headless render of the scene, 1600 x 1000,
default settings:

| views | zoom | where in the band | windows with a rose |
|---|---|---|---|
| 35 off Genoa (lon 3° to 18° E step 2.5°, lat 36° to 43° N step 1.75°) | 8.1 | start | 32 of 35 |
| | 8.5 | middle | 28 of 35 |
| | 8.9 | end | 26 of 35 |
| | 9.1 | start | 35 of 35 |
| | 9.5 | middle | 29 of 35 |
| | 9.9 | end | 23 of 35 |
| 15 around 9°S 140°W, the open Pacific | 5.1 / 5.5 / 5.9 | start / middle / end | 15 / 15 / 14 of 15 |

Before this design the same Genoa views at 9.9 had a rose in 6 of 35, and the Pacific views in none
("Zoom bands" has the comparison).

**A curated chart's window.** Where the window matches a real chart's extent, one to two windows
wide at its band's first zoom, the sheet is that chart: its roses stand where the chartmaker drew
them, its lines run from its own ring's sixteen nodes and its centre, its own beasts and ships ride
its sea, and nothing from any other chart is drawn on it. Zoom past its band and the page turns to
the grid below, as anywhere else. Why: a reader who zooms to Sardinia at the right scale should
meet the Carte Pisane's western circle, not a grid's guess beside it.

**The trade-offs taken.** Five things pull against each other: roses placed correctly, roses
standing where lines meet, a density of lines that makes a usable network at every zoom, lines and
roses that stay still while the map moves, and smooth transitions when they must be redrawn.

| wanted | against | taken | why |
|---|---|---|---|
| a usable density of lines at every zoom | lines and roses that stay still | networks fixed to the earth, in bands one zoom level wide | an earth-fixed network thins fourfold per zoom level; one-level bands stop that at fourfold, where two-level bands let it thin sixteenfold and left the late windows empty ([#199](https://github.com/mark-brannan/portolani/issues/199), [#135](https://github.com/mark-brannan/portolani/pull/135)) |
| a rose where the lines meet | a rose in every window | a rose only on a node or the centre; a late window may hold lines and no rose | a rose off its node is a rose where no lines meet ([#135](https://github.com/mark-brannan/portolani/pull/135)); the crossfade fills most of the gap |
| a chart's roses where it drew them | a ring placed to suit the window | on a curated chart the ring is fitted through its roses; on a grid sheet the rose takes a node | a curated chart's roses are the evidence, so the lines go to them; a grid's ring is ours to place, so the rose goes to it |
| few page turns | a network dense enough late in a band | one turn per zoom level, each a crossfade | twice the turns of two-level bands, each one soft; the stillness inside a band is what the reader holds on to |
| fresh beasts | beasts that stay put | beasts belong to the sheet and change only at a turn | a beast that changes on a pan is the re-dealt feeling again |

## The historical construction

A portolan chart was not drawn coast first. The chartmaker began with a circle, scraped into the
vellum with a compass point and on most charts never inked; Campbell reports a pinhole usually still
visible at each of its sixteen points. The circle was divided into sixteen equal parts. From the
centre and from each of the sixteen nodes ran the lines of the winds, eight principal winds in black
(or brown), the eight half-winds in green and the sixteen quarter-winds in red, thirty-two
directions in all. Only after that network was laid down were the coastlines copied in over it, from
a pattern chart. Tony Campbell's chapter in *The History of Cartography* (volume 1, 1987, pages 390
to 391) is the reference for the order of work, overturning the earlier view (Stevenson, 1911) that
the lines were added afterwards; the Wikipedia article on the rhumbline network, citing Ramon
Pujades, has Pietro Vesconte drawing the rhumbline grid first.

The circle itself was the chart's hidden skeleton. The earliest surviving chart, the Carte Pisane,
has two: one for the western basin of the Mediterranean, one for the eastern, each divided into
sixteen. Most charts have one circle. Some, from the Carte Pisane on, have two, joined in different
ways: tangent on the Carte Pisane, one inside the other on the Canepa chart of 1489, separate on
Juan de la Cosa's. The decorated compass rose came later than the network. Campbell calls it a
Catalan innovation, and the Catalan Atlas of 1375 is the first chart known to carry one. Before
that, a node was a node: a point where the lines met, sometimes marked with a small rose or an
initial for the wind, sometimes not marked at all.

Two things in that construction matter here. First, the geometry came before the geography, so the
ornaments were fixed before the coast was: a rose was not placed in a gap in the land, the land
was drawn around the rose. Second, the circle was a property of the sheet, not of whatever part of
the sheet the reader was looking at. Both are the opposite of what the chart does today, and both
are what this design restores.

One claim this document does not make: that the circle on a given chart sat at a particular latitude
and longitude. Charts of this period were drawn from magnetic compass bearings, and the whole
network is turned about 8° to 10° anticlockwise from true north, an angle that held for three
centuries (Joaquim Alves Gaspar's cartometric work, 2008, pp. 196 and 201, and his 2010 thesis). The
centres proposed below are positions on the modern earth chosen to echo each chart's layout. They
are not measurements of the originals; see the table's `centre` column.

## The design

### An atlas of sheets

Each zoom band of the chart is an atlas: a set of sheets fixed to the earth that together cover
it. A sheet is:

| field | what it is |
|---|---|
| `extent` | a rectangle in longitude and latitude, rectangular on the Mercator page |
| `circle` | the hidden circle: a centre in longitude and latitude, a ring, sixteen nodes at equal bearings from it. On a grid sheet the ring's diameter is 0.8 of the sheet's height ("The fallback grid"); on a curated sheet it is fitted through the chart's drawn roses |
| `ornaments` | the beasts, ships and rose styles the sheet carries: a curated chart's own, or for a grid sheet a pick by a hash of the sheet's place on the earth ("Which beasts, which ships") |
| `name` | what the drawer shows for it |
| `source` | for a curated sheet, the chart it is modelled on and where that chart is held; for a grid sheet, the cell it is |

A view shows every sheet it overlaps. Each sheet is placed once, deterministically, against the
land that falls inside it: the big rose on the centre if the centre is at sea and clear, the small
roses on the nodes that are at sea and clear, monsters and ships in the open water left over,
towns and names at their places. Every placed ornament is remembered by the point on the earth it
sits on, not by a pixel. Each frame then asks the live projection where those points are now and
draws there, through whatever projection the page is in. Pan, and everything slides with the
coast. Zoom inside the band, and everything grows with the coast, scaled by its kind's factor
(below). Cross a band boundary, and the outgoing atlas fades out as the next one fades in: the page
turn ("The page turn").

This stays inside the ruling of 2026-10-14 in [decisions.md](../decisions.md): geometry is vector
at every zoom and drawn through coast-wright; a sheet is a placement region, not a tile, and no
ornament layer is ever rasterised and translated, which goes further than the ruling asks.
Ornaments are sprites and strokes drawn afresh at every render, as they are now; what changes is
that they are also drawn on the moving frames, which today draw the ground alone.

### Lines

The rhumb lines are already drawn this way: each ray is a rhumb line in longitude and latitude from
its node, projected at every render, so on a plate carrée page they bow and on a globe they curve.
The design keeps that and adds one rule: a sheet's lines reach to the edge of the sheet's extent
plus a margin of about half a sheet, not to the edge of the window. Two adjacent sheets both cast
lines into a view that straddles them, as two adjacent charts in a real atlas would; the margin is
what keeps the crossing from reading as a tangle. The right margin is a thing to look at on screen,
not to decide here.

### Zoom bands

Networks are fixed to the earth and come in zoom bands, one zoom level wide: 4 to 5, 5 to 6, and so
on up to 14 to 15, where the chart's zoom ends. Inside a band nothing moves. Below zoom 4 is the
world band, where the earth is one page and the famous charts are the better model ("The curated
sheets").

Why one level and not two. A network fixed to the earth thins as the reader zooms in: each zoom
level doubles the map's scale, so a window holds a quarter of the nodes it held one level up. Across
a band of two levels the network thins sixteenfold, and the windows late in such a band held no
node at all: at zoom 9.9, 27 of 35 windows off Genoa held no meeting point of the lines ([#107](https://github.com/mark-brannan/portolani/issues/107)),
and a rose that filled them from the next band's sheets stood where no lines meet ([#135](https://github.com/mark-brannan/portolani/pull/135)). One
level holds the thinning to fourfold, and the crossfade at the turn carries the rest.

Measured 2026-11-04 on a mockup branch, headless render of the scene, 1600 x 1000, default
settings, the same 35 views off Genoa as above. Each cell is windows with no node / windows with no
rose, of 35. "Window rings" is the grid sheet of "The fallback grid", one circle per sheet sized to
the window:

| zoom | before (main, 2026-11-04) | two-level bands, window rings | one-level bands, window rings |
|---|---|---|---|
| 8.1 | 0 / 10 | 0 / 3 | 0 / 3 |
| 8.5 | 0 / 15 | 0 / 7 | 0 / 7 |
| 8.9 | 0 / 15 | 1 / 9 | 1 / 9 |
| 9.1 | 1 / 15 | 5 / 15 | 0 / 0 |
| 9.5 | 5 / 19 | 7 / 22 | 0 / 6 |
| 9.9 | 18 / 29 | 11 / 26 | 0 / 12 |

The window rings fill the early windows (8.1 to 8.9); the one-level bands fill the late ones (9.1 to
9.9), where a two-level band was still thinning. In the open
Pacific, 15 views around 9°S 140°W at zooms 5.1, 5.5 and 5.9 had no rose in 15, 15 and 15 windows
before, and in 0, 0 and 1 with one-level bands.

A sheet of a band is one window at the band's first zoom. Portolani's page is 1600 px wide, so at
zoom *z* the window spans 1125 / 2^*z* degrees of longitude, and a sheet is that wide and 1000 / 1600
of that tall on the Mercator page:

| band | zooms | sheet width | sheet height on the page |
|---|---|---|---|
| world | below 4 | the whole earth, a few curated sheets | |
| 4 | 4 to 5 | 70.3° | 43.9 page-degrees |
| 5 | 5 to 6 | 35.2° | 22.0 |
| 6 | 6 to 7 | 17.6° | 11.0 |
| 7 | 7 to 8 | 8.8° | 5.5 |
| 8 | 8 to 9 | 4.39° | 2.75 |
| ... | | halving each band | |
| 14 | 14 to 15 | 0.069° | 0.043 |

A page-degree is a degree on the Mercator page: longitude across, Mercator y down. Inside a band the
map scales by up to 2x, so at the band's end a sheet is two windows wide. Each band's sheet is half
the width and half the height of the band above, so four sheets of a band nest inside one sheet of
the band above. Why the window and not a survey cell: a sheet sized to the window is a chart the
reader can frame whole at the band's first zoom, ring and all, as a portolan's reader saw the whole
chart; a survey cell's ring never fitted any window ("The fallback grid").

One rose belongs to no band: the Catalan Atlas rose at 20.2°W 43.5°N, the point every band's grid
counts from ("The fallback grid", below). Current thinking: its rhumb lines are drawn at every zoom,
from the world band to the last band, beside the network of whatever sheets the view shows.
Pinning one rose is what pins the lines: the same lines run through every view and every sheet, and
a page turn between bands leaves them where they were. How far they reach, and how they sit beside
a band's own lines, is a thing to look at on screen, as the sheet margin is.

### The page turn

The page turn between two bands is a crossfade, not a swap. Over a short span of zoom centred on
the band edge, the outgoing network and everything on it (its lines, roses, beasts and ships) fade
out as the incoming network and everything on it fade in. The span is a pencil default of 0.3 zoom
levels, from *x* − 0.15 to *x* + 0.15 for a band edge at zoom *x*, and a knob in the link
(`tune=turn:`) so it can be set by eye. Outside the span exactly one band is drawn, at full ink.

Why. The turn is the one moment the ornaments change, and so it is where the "re-dealt" feeling
lives ({I107}'s table): a swap at a whole number replaced every rose and beast between two frames.
A fade reads as one sheet laid over another. And it does a second job: the last 0.15 of a band is
its emptiest stretch, and the fade lays the incoming band's network over it, whose nodes stand twice
as close.

Ornaments drawn on the window and not on a sheet (the cartouche, the scale bar) and those that
belong to the land rather than to a network (towns, names, relief) do not fade; they are the same on
both sheets.

### Which beasts, which ships

The ornaments a sheet carries (its beasts, ships and rose styles) are a property of the sheet. On a
curated sheet they are the chart's own. On a grid sheet they are picked by a hash of the sheet's
identity on the earth, its place in the grid counted from the origin, never by the band number. So
they change only at a page turn and never on a pan, and two views of the same sheet always carry the
same beasts. Why the identity and not the band number: a pick by band number reshuffles every beast
on the earth whenever the bands are renumbered, which is the re-dealt feeling coming back by a side
door (found 2026-11-04 on the mockup branch, where renumbering the bands did exactly that).

### The curated sheets

Where a real chart covers a region, the sheet is modelled on that chart: its extent is the chart's,
its circle sits where the chart's did, and the drawer can say so. The list is additive; the grid
below covers everything the list does not. Every entry here is a proposal, open to edit. The
`centre` column is a placement from each chart's extent and is marked as a guess until it has
been set against a scan of the chart; the holding and date columns follow the sources at the end.

The charts:

| chart | made | held |
|---|---|---|
| Carte Pisane | Genoa or Pisa, late 13th century | Bibliothèque nationale de France, GE B-1118 (RES) |
| Pietro Vesconte's chart of 1311 | signed by a Genoese, the place of making not stated (Venice or Genoa); the earliest signed and dated chart | Archivio di Stato di Firenze, CN 1 |
| Angelino Dulcert (or Dulceti), 1339 | Palma, Majorca; the first chart known from Palma | Bibliothèque nationale de France, GE B-696 (RES) |
| Catalan Atlas, attributed to Abraham Cresques or his workshop | Majorca, 1375; six double parchment leaves on boards, 64.5 by 24.9 cm a side | Bibliothèque nationale de France, Espagnol 30 |
| Olaus Magnus, Carta Marina | Venice, 1539; a woodcut from nine blocks, 125 by 170 cm | Bayerische Staatsbibliothek, Munich; Uppsala University Library |
| Juan de la Cosa's chart of 1500 | El Puerto de Santa María; about 93 to 96 by 183 cm, two skins joined, the New World drawn at a larger scale than the Old | Museo Naval, Madrid |

The Carte Pisane's date is argued: Campbell holds c.1290, revised in 2021 to c.1270; Pujades once
put it in the later 14th century or even the 1420s or 30s, and by 2023 allowed the 1280s or 90s. The
doc says "late 13th century" and leaves the argument to them.

The sheets:

| sheet | after | band | extent | centre (a guess) | why this centre |
|---|---|---|---|---|---|
| Mediterranean, west | Carte Pisane, western circle | 6 | 10°W to 20°E, 30°N to 48°N | 8°E 39°N, off Sardinia | the earliest chart splits the sea into two circles; this is the western |
| Mediterranean, east | Carte Pisane, eastern circle | 6 | 15°E to 42°E, 30°N to 48°N | 26°E 36°N, the Aegean | the eastern circle of the same chart |
| Levant and Black Sea | Vesconte 1311 | 6 | 20°E to 42°E, 30°N to 48°N | 30°E 40°N, between the Aegean and the Black Sea | the chart covers the eastern Mediterranean and the Black Sea alone |
| Europe and the Mediterranean | Dulcert 1339 | 5 | 25°W to 42°E, 28°N to 60°N | 5°E 40°N, the Balearic sea | the first Majorcan chart; the Atlantic and the Baltic added to the frame |
| The known world of 1375 | Catalan Atlas | world | 25°W to 120°E, 10°N to 60°N | 20°W 37°N, off Morocco | the first drawn compass rose, on folio 5v; the big rose goes there |
| Scandinavia and the Baltic | Carta Marina 1539 | 5 | 25°W to 45°E, 53°N to 72°N | 22°E 60°N, the Baltic off Stockholm | its roses are already the chart's ornament pack; the big rose follows its central one |
| The Atlantic and the Americas | Juan de la Cosa 1500 | 4 | 100°W to 20°E, 20°S to 65°N | 35°W 30°N, the open Atlantic | its rose with the Virgin and Child sits in mid-Atlantic on the equator; the big rose stands for it |

Four notes on the table. A curated sheet's network replaces the grid's in the band whose window
matches the chart's own extent: one to two windows wide at the band's first zoom, the range a grid
sheet spans now that a band is one level. The `band` column is that rule applied to the extent
column, and moves with it when an extent is read off a scan; wider than that, a chart is a page of
the band above. In its band it carries the chart's own roses on its own nodes, and nothing from any
other chart.

On a curated sheet the lines go to the roses, not the roses to the lines. Its ring is read off the
scan together with its roses in one pass: the centre, the ring and all sixteen nodes, one
similarity fit per ring ([centres.md](centres.md) has the method). The drawn roses are nodes of the
ring, and the ring is fitted through them. Why: the chartmaker's roses are the evidence of where
the network stood, and a ring placed by any other rule would put a historical rose where no lines
meet. Juan de la Cosa's chart is reread in its own session before its roses are drawn: its readings
in [centres.md](centres.md) and [ornaments.md](ornaments.md) disagree with each other (node roses at
bearings 57°, 136° and 264° from the read centre, where multiples of 22.5° were expected, and at 306
to 429 px from it, where the ring is 360 px).

The world band is the exception again: at those zooms the earth is one page, so it takes every
curated sheet from the planispheres down to the Carte Pisane's two circles.

Where two curated sheets match the same band (the Carte Pisane's two circles and Vesconte all fall
in band 6), the overlap rule below says which are drawn.

Where curated sheets overlap, a rule in the settings drawer (`overlap=` in the link) says which are drawn (#199):

| rule | draws |
|---|---|
| *Fit* (default) | the sheet closest to one window wide at the view's zoom |
| *Smallest* | the sheet of smaller area; below zoom 4 the planisphere alone |
| *All, cut* | every sheet, a line stopping at the edge of a smaller sheet over it |
| *All, uncut* | every sheet in full |

The Carta Marina is the odd one out: it is a printed map of the north, not a navigator's chart, and
Olaus's roses and lines were decoration. It is in the list because its ornaments are already the
chart's (the `scanned` pack), and a reader who zooms to the Baltic should meet them where he put
them.

### The fallback grid

Everywhere no curated sheet reaches, the atlas is a grid modelled on NOAA's reschemed electronic
charts. NOAA's traditional paper charts (the last cancelled in December 2024) had irregular,
overlapping limits set by hand: sailing charts at 1:600,000 and smaller, general charts from
1:150,000 to 1:600,000, coast charts from 1:50,000 to 1:150,000, harbor charts larger than 1:50,000.
Those limits are worth reading for what they say about attention: a harbour that earned its own
large-scale chart is a place people look at closely, and that is where a curated sheet, or at least
a hand-set centre, is worth the effort. But the limits themselves are a poor grid, and NOAA replaced
them. The reschemed layout has six usage bands with two standard scales each, twelve scales in place
of more than a hundred, and rectangular cells on lines of longitude and latitude, each band's cell a
quarter the height of the band above (the last a half), so sixteen cells nest in one. From band 3
down, above 49° 12' N a cell is twice as wide as it is high, above 69° 12' N four times, so a cell
on the ground does not become a sliver as the meridians converge.

The chart's grid takes the form of that scheme: rectangular sheets on lines of longitude, nested
band inside band, each named by its band and cell. It does not take NOAA's ladder of heights, its
widening, or its zero. The ladder steps by four, which made two-level bands; a sheet here halves
each band, one window at the band's first zoom ("Zoom bands"). The widening keeps a survey cell from
becoming a sliver as the meridians converge; a sheet here is counted in Mercator y, so it keeps the
window's shape at every latitude and needs none. And NOAA counts its cells from the equator and the
prime meridian, which suits a survey and says nothing about a chart, so the hidden circles would
fall wherever the cells happened to land.

Current thinking: every band counts its sheet edges in whole multiples of the sheet's height in
Mercator y, north and south, and of its width east and west, out from one point, the Catalan Atlas rose at 20.2°W 43.5°N, read off
the scan in [centres.md](centres.md) to ±1°. It is the first drawn compass rose known on any chart,
and it is the point the world band's big rose is pinned to. Because each band's height divides the
one above, four sheets still nest in one, and the rose sits on a corner every band's grid shares:
zoom in on it from band 4 to band 14 and it stays on a sheet corner all the way
down. Where a column reaches the date line or a row a pole, the sheet ends there. If a sharper
reading of the scan moves the rose, every grid moves with it.

Open: the rose is the centre of no grid sheet's circle. It is carried by its own lines, drawn at
every zoom (see "Zoom bands"), not by any sheet's.

A grid sheet has one hidden circle: its centre on the sheet's centre, its ring 0.8 of the sheet's
height across (800 px at the band's first zoom, every node inside the window), sixteen nodes on it.
That is the Carte Pisane's proportion: its two rings are each about 0.8 of the chart's height, and
every node is on the page ([the scan with the fitted circles](centres/carte-pisane.jpg)). Why: the
ring this replaces was 0.4 of a survey cell's height in radius, 1.4 to 2.4 window heights tall on
the page, so no view in any band ever framed a ring ({I199}, the diagnosis of 2026-10-18). The 0.8
is a pencil default, to be looked at on screen.

The rose snaps to the network, never the network to the window. A rose stands only on a node or
the centre of the current band's network, at sea and clear of land, and it never leaves its node to
fill a window. A window late in a band may hold lines and no rose, and that is accepted: the
measured cost is in "What the reader sees", and the crossfade at the turn fills most of it. Why: a
rose is where the lines meet, and a rose moved off its node to fill a window stands where no lines
meet ({P135}). If the centre is on land, the big rose is not drawn; the lines still run from it, as
they did from a node on land on a real chart. A grid sheet's name in the drawer is its band and
cell, in the manner of an ENC name.

### What size an ornament is

Within a band the map scales by up to 2x. Each kind of ornament scales by a factor of that: at
factor 1 it is ink on the map and grows with it; at 0 it is held at a fixed pixel size; at 0.5 it
grows by the square root, about 1.4x across a band. Proposed first settings:

| kind | factor | why |
|---|---|---|
| rose | 0.5 | a rose that held still would look pasted on; one that grew 2x with the map would crowd its ring by the band's end |
| rhumb lines | stroke 0, reach 1 | a line's width is ink, its length is geography |
| monster, ship | 0 | a ship is a ship whatever the scale; it is placed once at a size that fits |
| town, city | 0.5 | the town drawings already grow with grandeur, this adds a little with the zoom |
| names | 0 | type is read, not measured |
| mountains, trees, relief | 1 | they stand for ground |

One number per kind, in the style table beside the rest. The factors are a first guess, to be
tuned by eye and recorded in the pack or the style, not here.

### Pinned to the screen

The cartouche and the scale bar are not on the map. They are on the window: the cartouche in the
corner that crosses the least coast, as now, and the scale bar at the bottom left, redrawn each
frame for the current scale. They do not slide. That is a ruling; its line is in
[decisions.md](../decisions.md).

### The drawer

The settings drawer, which is meant to teach, gains one line under the view: the sheet or sheets
under the window and, for a curated sheet, the chart they follow, with a link to the holding
library's digitised copy. Current thinking, lightly held: a reader who learns that the roses off
Sardinia stand where the Carte Pisane's western circle stood has learned how a portolan was made.

## Determinism and the goldens

Placement per sheet is a pure function of the sheet, the selected sprites and the land data, so
the same view draws the same picture in Node and in the browser, as now. The five golden images in
`test/golden` will move once when the sheets go in; the pull request that builds this regenerates
them with `npm run golden` and says so. The card that makes the visual diff a visible check on every
pull request is `1792019529f312eeed` on the board; it is separate work and this design does not
wait on it.

## Risks and the measurement

- **Two networks in one view.** Lines from neighbouring sheets cross, the world rose's lines
  cross every band's, and through a page turn two bands' networks are drawn at once, one fading. The reach margin is the control; it must be looked at, at a band boundary and at a sheet corner, before the design is
  trusted.
- **Projection.** The circle is drawn through the projection, so it is round only on the
  cylindrical pages. On the orthographic globe and the azimuthal views it is an ellipse or an egg,
  and that is consistent with how the lines already bow. A sheet whose centre is beyond the globe's
  horizon keeps its placement; its ornaments fall behind the globe and are not drawn.
- **Poles and the date line.** Sheets are longitude and latitude rectangles, so a sheet never
  crosses the date line; it ends at 180° and the next begins. There is no sheet beyond the last
  row the Mercator page reaches, so the polar caps carry no roses. Today's chart stops a hair short
  of the pole for the same reason.
- **Magnetic tilt.** The originals' networks are turned about 8° to 10° anticlockwise from north.
  Drawing the curated circles with that tilt would be more faithful and would confuse the modern
  reader who expects north up. Left open; the sheet record has room for an `orientation` field.
- **Cost per frame.** Projecting every anchor each frame replaces today's ground-only frame with one
  that also draws the ornaments. The mechanism stays open until it is measured; the measurement that
  settles it: a scratch page driving sixty 4 px pans and sixty 1.02x zooms at zooms 5, 9 and 12 over
  Genoa, recording median and p90 frame time for today's frame and for the projected ornaments. A
  median of a few hundred milliseconds at zoom 5 is acceptable while the chart is in development,
  and about 50 ms is the bar to aim at later; the ruling is in [decisions.md](../decisions.md).
  Above the acceptable bar, the ornaments are drawn every other frame during a move, which is still
  no flicker. The per-frame figures on [#107](https://github.com/mark-brannan/portolani/issues/107) (ornaments projected each frame) stand. The crossfade
  draws two networks for 0.3 of a zoom level, so its frame is measured against the same two bars,
  on the same moves, before it ships.

## Not decided here

- The exact centres and extents of the curated sheets: a scan of each chart, the ring and its
  roses read off it in one pass, and the position transferred to the modern earth. One chart at a
  time, with the crop kept in this folder as the town and Carta Marina folders keep theirs.
- Juan de la Cosa's ring and roses, reread in their own session: its readings in centres.md and
  ornaments.md disagree ("The curated sheets"), and its roses wait on the rereading.
- The crossfade's cost per frame, measured against the bars in "Risks and the measurement" before it
  ships.
- Whether a child sheet's circle should sit on a node of its parent's, so zooming in descends into
  the same geometry. Sixteen nodes on a ring do not tile a plane, and four child sheets nest in a
  parent with their centres off its nodes, so it would be approximate; nice if it works, not
  required.
- The size factors' values, and whether a pack may override them.

## Sources

Consulted 2026-10-14. Where an entry was read through a secondary source, it says so. Page
references are to the printed chapter where given.

- - Tony Campbell, "Portolan Charts from the Late Thirteenth Century to 1500", in *The History of
  Cartography*, vol. 1 (Chicago, 1987), ch. 19: p. 377 on the line colours, pp. 390–92 on the
  network being drawn first (against Stevenson, 1911), the scraped circle and its pinholes, and the
  Carte Pisane's grid of small squares:
  <https://press.uchicago.edu/books/HOC/HOC_V1/HOC_VOLUME1_chapter19.pdf>.
- Tony Campbell, *The Carte Pisane* essay and updates (c.1290, revised to c.1270 in 2021), and the
  Pujades debate: <https://www.maphistory.info/CartePisaneTEXT.html>,
  <https://www.maphistory.info/CartePisaneConclusions.html>.
- Ramon J. Pujades i Bataller, *Les cartes portolanes: la representació medieval d'una mar
  solcada* (Barcelona, 2007); cited for Vesconte's working order via the Wikipedia article below.
- Joaquim Alves Gaspar, "Dead reckoning and magnetic declination: unveiling the mystery of portolan
  charts", *e-Perimetron* 3:4 (2008), 191–203; *From the Portolan Chart of the Mediterranean to the
  Latitude Chart of the Atlantic* (PhD, Lisbon, 2010); "The Planisphere of Juan de la Cosa (1500)",
  *Terrae Incognitae* (2017).
- James Ford Bell Library, University of Minnesota, *Portolan charts*: the two rhumb circles of the
  1489 Canepa chart, <https://apps.lib.umn.edu/bell/map/PORTO/CAN/circle.html>; rhumbs first or
  last, with Campbell 1987 pp. 390–91 and Stevenson 1911,
  <https://apps.lib.umn.edu/bell/map/PORTO/MYS/mainp4.html>.
- Wikipedia, "Rhumbline network" (sixteen nodes, line colours, Pujades on Vesconte's order):
  <https://en.wikipedia.org/wiki/Rhumbline_network>; "Carta Pisana"; "Portolan chart" (the Catalan
  Atlas's rose, Campbell's "Catalan innovation"); "Map of Juan de la Cosa".
- Bibliothèque nationale de France catalogue: Dulcert 1339, GE B-696 (RES); Catalan Atlas, Espagnol
  30. Archivio di Stato di Firenze: Vesconte 1311, CN 1. Museo Naval de Madrid (Google Arts &
  Culture): Juan de la Cosa 1500. Uppsala University Library and Orkney Museums: Carta Marina 1539,
  Munich and Uppsala copies.
- NOAA Office of Coast Survey, *NOAA ENC Design Handbook* (1 June 2024), Tables 1 and 2: the
  twelve standard scales, the six usage bands, cell heights 19.2°, 4.8°, 1.2°, 0.3°, 0.075° and
  0.0375°, widening to 2x above 49° 12' N and 4x above 69° 12' N:
  <https://www.nauticalcharts.noaa.gov/publications/docs/enc-design-handbook.pdf>. The handbook
  calls itself informative; the Nautical Chart Manual governs.
- - NOAA, *U.S. Coast Pilot*, chapter 1, "General Information": the paper chart categories, sailing
  1:600,000 and smaller, general 1:150,000 to 1:600,000, coast 1:50,000 to 1:150,000, harbor larger
  than 1:50,000:
  <https://nauticalcharts.noaa.gov/publications/coast-pilot/files/cp1/CPB1_C01_WEB.pdf>.
- - NOAA, *Sunset Plan for Raster Nautical Charts* (2019): the last traditional paper charts
  cancelled in December 2024: <https://nauticalcharts.noaa.gov/publications/docs/raster-sunset.pdf>.

Unverified, and so not claimed above: the geometry of the Juan de la Cosa chart's rhumb network;
which leaf of the Catalan Atlas carries its rose (the BnF says folio 5v); and Pujades's own words on
Vesconte's order of work, which were read only through Wikipedia.
