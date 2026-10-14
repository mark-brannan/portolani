# The atlas: where the ornaments go, and why

Design doc, draft. Status: proposed, not yet built. It governs how the chart decides where its
roses, rhumb lines, monsters, ships, town drawings and names sit, and what happens to them when
the map moves. It is written for people, not only for the code: the chart borrows a construction
from the medieval chartmakers, and the borrowing is the point.

## What the reader sees

Today, dragging or zooming the map in the browser draws only the paper, the land and the coast.
Every ornament disappears, and when the map stops the ornaments are worked out again for the
exact new view. The clearest patch of open sea near the middle of the window is a different patch
after a small drag, so the big rose, its ring of small roses, the lines, the monsters and the
ships all land somewhere else. It reads as a flicker and a jump, and it makes the chart feel like
a window onto a generator rather than a map.

After this design, the ornaments belong to the earth. A rose sits over a fixed point of sea and
slides with the coast when you drag. Zoom in and it grows with the coast, or by a chosen fraction
of that. Nothing jumps when you let go. The only moment the ornaments are rearranged is when you
zoom far enough to cross from one zoom band to the next, and that moment is predictable: it is a
page turn, from one sheet of an atlas to the sheet below it.

## The historical construction

A portolan chart was not drawn coast first. The chartmaker began with a circle, usually not inked,
whose centre was pricked into the vellum; Campbell reports the hole still visible from the back of
surviving charts. The circle was divided into sixteen equal parts. From the centre and from each of the
sixteen nodes ran the lines of the winds, eight principal winds in black (or gold), the eight
half-winds in green and the sixteen quarter-winds in red, thirty-two directions in all. Only after
that network was laid down were the coastlines copied in over it, from a pattern chart. Tony
Campbell's chapter in *The History of Cartography* (volume 1, 1987, pages 390 to 391) is the
reference for the order of work, overturning the earlier view (Stevenson, 1911) that the lines
were added afterwards; Ramon Pujades's account of Pietro Vesconte's method has him "drawing first
the rhumbline grid".

The circle itself was the chart's hidden skeleton. The earliest surviving chart, the Carte Pisane,
has two: one for the western basin of the Mediterranean, one for the eastern, each divided into
sixteen. A single circle was the norm for a chart of the Mediterranean; large planispheres used two
with a shared edge. The decorated compass rose came later than the network. Campbell calls it a
Catalan innovation, and the Catalan Atlas of 1375 is the first chart known to carry one. Before
that, a node was a node: a point where the lines met, sometimes marked with a small rose or an
initial for the wind, sometimes not marked at all.

Two things in that construction matter here. First, the geometry came before the geography, so the
ornaments were fixed before the coast was: a rose was not placed in a gap in the land, the land
was drawn around the rose. Second, the circle was a property of the sheet, not of whatever part of
the sheet the reader was looking at. Both are the opposite of what the chart does today, and both
are what this design restores.

One claim this document does not make: that the circle on a given chart sat at a particular
latitude and longitude. Charts of this period were drawn from compass bearings uncorrected for
magnetic declination, so the whole network is rotated a few degrees anticlockwise from true north
(Joaquim Alves Gaspar's cartometric work, 2008 and his 2010 thesis, is the source). The centres
proposed below are positions on the modern earth chosen to echo each chart's layout. They are not
measurements of the originals; see the table's `centre` column.

## The design

### An atlas of sheets

Each zoom band of the chart is an atlas: a set of sheets fixed to the earth that together cover
it. A sheet is:

| field | what it is |
|---|---|
| `extent` | a rectangle in longitude and latitude, rectangular on the Mercator page |
| `circle` | the hidden circle: a centre in longitude and latitude, a radius in degrees of the sheet's extent, sixteen nodes at equal bearings from it |
| `name` | what the drawer shows for it |
| `source` | for a curated sheet, the chart it is modelled on and where that chart is held; for a grid sheet, the cell it is |

A view shows every sheet it overlaps. Each sheet is placed once, deterministically, against the
land that falls inside it: the big rose on the centre if the centre is at sea and clear, the small
roses on the nodes that are at sea and clear, monsters and ships in the open water left over,
towns and names at their places. Every placed ornament is remembered by the point on the earth it
sits on, not by a pixel. Each frame then asks the live projection where those points are now and
draws there, through whatever projection the page is in. Pan, and everything slides with the
coast. Zoom inside the band, and everything grows with the coast, scaled by its kind's factor
(below). Cross a band boundary, and the next atlas's sheets are placed and drawn: the page turn.

This stays inside the ruling of 2026-10-14 in [decisions.md](../decisions.md): geometry is vector
at every zoom and drawn through coast-wright; a sheet is a placement region, not a tile, and no
ornament layer is ever rasterised and translated, which goes further than the ruling asks.
Ornaments are sprites and strokes drawn afresh at every render, as they are now; what changes is
that they are also drawn on the moving frames, which today draw the ground alone.

### Lines

The rhumb lines are already drawn this way: each ray is a rhumb line in longitude and latitude from
its node, projected at every render, so on a plate carrée page they bow and on a globe they curve. The
design keeps that and adds one rule: a sheet's lines reach to the edge of the sheet's extent plus a
margin of about half a sheet, not to the edge of the window. Two adjacent sheets both cast lines
into a view that straddles them, as two adjacent charts in a real atlas would; the margin is what
keeps the crossing from reading as a tangle. The right margin is a thing to look at on screen, not
to decide here.

### Zoom bands

Portolani's page is 1600 px wide, so at zoom *z* the window spans 1125 / 2^*z* degrees of
longitude at the equator. NOAA's reschemed ENC cells (next section) have heights of 19.2°, 4.8°,
1.2°, 0.3°, 0.075° and 0.0375°, each a quarter of the one before, the last a half. The first five
fall within 10% of one window width at zooms 6, 8, 10, 12 and 14 (the window is about 9% narrower
than the cell at each). That is a happy accident, and the design takes it. The chart stops at zoom
15, so the 0.0375° cell has no zoom to match until the chart goes further:

| band | zooms | sheet height | modelled on |
|---|---|---|---|
| world | 1 to 6 | the whole earth, a few curated sheets | the world charts (Juan de la Cosa, the Catalan Atlas's span) |
| overview | 6 to 8 | 19.2° | ENC band 1, Overview, 1:10,000,000 and 1:3,500,000 |
| general | 8 to 10 | 4.8° | ENC band 2, General, 1:1,500,000 and 1:700,000 |
| coastal | 10 to 12 | 1.2° | ENC band 3, Coastal, 1:350,000 and 1:180,000 |
| approach | 12 to 14 | 0.3° | ENC band 4, Approach, 1:90,000 and 1:45,000 |
| harbour | 14 to 15 | 0.075° | ENC band 5, Harbor, 1:22,000 and 1:12,000 |

A band is two zoom steps, so inside a band the map scales by up to 4x and a sheet is between one
and four windows wide. The harbour band is one step because the chart's zoom ends at 15. Sixteen sheets of a band nest inside one sheet of the band
above, exactly as NOAA's cells do. The world band is the exception: there the earth is one page,
curated sheet by curated sheet, because at those zooms a grid cell would be most of a hemisphere
and the famous charts are the better model.

### The curated sheets

Where a real chart covers a region, the sheet is modelled on that chart: its extent is the chart's,
its circle sits where the chart's did, and the drawer can say so. The list is additive; the grid
below covers everything the list does not. Every entry here is a proposal, open to edit. The
`centre` column is a placement from each chart's extent and is marked as a guess until it has
been set against a scan of the chart; the holding and date columns were checked on 2026-10-14
against the sources at the end.

The charts:

| chart | made | held |
|---|---|---|
| Carte Pisane | Genoa or Pisa, late 13th century | Bibliothèque nationale de France, Cartes et plans |
| Pietro Vesconte's chart of 1311 | Venice, by a Genoese; the earliest signed and dated chart | Archivio di Stato di Firenze, CN 1 |
| Angelino Dulcert (or Dulceti), 1339 | Palma, Majorca; the first chart known from Palma | Bibliothèque nationale de France, GE B-696 (RES) |
| Catalan Atlas, attributed to Abraham Cresques | Majorca, 1375; six leaves of about 64.5 by 50 cm | Bibliothèque nationale de France, Espagnol 30 |
| Olaus Magnus, Carta Marina | Venice, 1539; a woodcut from nine blocks, 125 by 170 cm | Bayerische Staatsbibliothek, Munich; Uppsala University Library |
| Juan de la Cosa's chart of 1500 | El Puerto de Santa María; 96 by 183 cm, two charts of different scale joined | Museo Naval, Madrid |

The Carte Pisane's date is argued: Campbell holds c.1290, revised in 2021 to c.1270; Pujades once
put it in the later 14th century and by 2023 allowed the 1280s or 90s. The doc says "late 13th
century" and leaves the argument to them.

The sheets:

| sheet | after | bands | extent | centre (a guess) | why this centre |
|---|---|---|---|---|---|
| Mediterranean, west | Carte Pisane, western circle | world, overview | 10°W to 20°E, 30°N to 48°N | 8°E 39°N, off Sardinia | the earliest chart splits the sea into two circles; this is the western |
| Mediterranean, east | Carte Pisane, eastern circle | world, overview | 15°E to 42°E, 30°N to 48°N | 26°E 36°N, the Aegean | the eastern circle of the same chart |
| Levant and Black Sea | Vesconte 1311 | overview, general | 20°E to 42°E, 30°N to 48°N | 30°E 40°N, between the Aegean and the Black Sea | the chart covers the eastern Mediterranean and the Black Sea alone |
| Europe and the Mediterranean | Dulcert 1339 | world, overview | 25°W to 42°E, 28°N to 60°N | 5°E 40°N, the Balearic sea | the first Majorcan chart; the Atlantic and the Baltic added to the frame |
| The known world of 1375 | Catalan Atlas | world | 25°W to 120°E, 10°N to 60°N | 20°W 37°N, off Morocco | the first drawn compass rose, on its western leaf; the big rose goes there |
| Scandinavia and the Baltic | Carta Marina 1539 | overview, general | 5°W to 45°E, 53°N to 72°N | 22°E 60°N, the Baltic off Stockholm | its roses are already the chart's ornament pack; the big rose follows its central one |
| The Atlantic and the Americas | Juan de la Cosa 1500 | world | 100°W to 20°E, 20°S to 65°N | 35°W 30°N, the open Atlantic | its rose with the Virgin and Child sits at the western edge; the big rose stands for it |

Two notes on the table. A chart appears in two bands when its extent is about one window wide in
both; the same circle serves, and the page turn between those bands keeps the roses still. The
Carta Marina is the odd one out: it is a printed map of the north, not a navigator's chart, and
Olaus's roses and lines were decoration. It is in the list because its ornaments are already the
chart's (the `scanned` pack), and a reader who zooms to the Baltic should meet them where he put
them.

### The fallback grid

Everywhere no curated sheet reaches, the atlas is a grid modelled on NOAA's reschemed electronic
charts. NOAA's traditional paper charts (ended in January 2025) had irregular, overlapping limits
set by hand: sailing charts at 1:600,000 and smaller, general charts from 1:150,000 to 1:600,000,
coast charts from 1:50,000 to 1:150,000, harbor charts larger than 1:50,000. Those limits are
worth reading for what they say about attention: a harbour that earned its own large-scale chart is
a place people look at closely, and that is where a curated sheet, or at least a hand-set centre,
is worth the effort. But the limits themselves are a poor grid, and NOAA replaced them. The
reschemed layout has six usage bands with two standard scales each, twelve scales in place of more
than a hundred, and rectangular cells on lines of longitude and latitude, each band's cell a
quarter the height of the band above (the last a half), so sixteen cells nest in one. From band 3
down, above 49° 12' N a cell is twice as wide as it is high, above 69° 12' N four times, so a cell on the ground does not become a
sliver as the meridians converge.

The chart's grid takes all of that: the ladder of heights in the band table, the nesting, the
widening at the same two latitudes applied north and south, and cell edges on whole multiples of
the cell height from the equator and the prime meridian. A grid sheet's circle sits at the cell's
centre with a radius of 0.36 to 0.62 of the cell's height, chosen as today's placement chooses it:
the radius that puts the most nodes in water clear enough for a small rose. If the centre is on
land, the big rose is not drawn; the lines still run from it, as they did from a node on land on a
real chart. A grid sheet's name in the drawer is its band and cell, in the manner of an ENC name.

### What size an ornament is

Within a band the map scales by up to 4x. Each kind of ornament scales by a factor of that: at
factor 1 it is ink on the map and grows with it; at 0 it is held at a fixed pixel size; at 0.5 it
grows by the square root, twice across a band. Proposed first settings:

| kind | factor | why |
|---|---|---|
| rose | 0.5 | a rose that held still would look pasted on; one that grew 4x would swallow the sheet |
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

- **Two networks in one view.** Lines from neighbouring sheets cross. The reach margin is the
  control; it must be looked at, at a band boundary and at a sheet corner, before the design is
  trusted.
- **Projection.** The circle is drawn through the projection, so it is round only on the
  cylindrical pages. On the orthographic globe and the azimuthal views it is an ellipse or an egg,
  and that is consistent with how the lines already bow. A sheet whose centre is beyond the globe's
  horizon keeps its placement; its ornaments fall behind the globe and are not drawn.
- **Poles and the date line.** Sheets are longitude and latitude rectangles, so a sheet never
  crosses the date line; it ends at 180° and the next begins. There is no sheet above the last
  widened row near the poles, so the polar caps carry no roses. Today's chart stops a hair short
  of the pole for the same reason.
- **Magnetic tilt.** The originals' networks were rotated by the magnetic declination of their day.
  Drawing the curated circles with that tilt would be more faithful and would confuse the modern
  reader who expects north up. Left open; the sheet record has room for an `orientation` field.
- **Cost per frame.** Projecting every anchor each frame replaces today's ground-only frame with
  one that also draws the ornaments. The mechanism stays open until it is measured; the measurement that settles it: a
  scratch page driving sixty 4 px pans and sixty 1.02x zooms at zooms 5, 9 and 12 over Genoa,
  recording median and p90 frame time for today's frame and for the projected ornaments. A median
  under about 50 ms at zoom 5 holds the design; above it, the ornaments are drawn every other
  frame during a move, which is still no flicker.

## Not decided here

- The exact centres and extents of the curated sheets: a scan of each chart, the circle's centre
  read off it, and the position transferred to the modern earth. One session per chart, with the
  crop kept in this folder as the town and Carta Marina folders keep theirs.
- Whether a child sheet's circle should sit on a node of its parent's, so zooming in descends into
  the same geometry. Sixteen nodes on a ring do not tile a plane, so it would be approximate; nice
  if it works, not required.
- The size factors' values, and whether a pack may override them.

## Sources

Consulted 2026-10-14. Where an entry was read through a secondary source, it says so. Page
references are to the printed chapter where given.

- Tony Campbell, "Portolan Charts from the Late Thirteenth Century to 1500", in *The History of
  Cartography*, vol. 1 (Chicago, 1987), ch. 19, pp. 390–91 on the network being drawn first:
  <https://press.uchicago.edu/books/HOC/HOC_V1/HOC_VOLUME1_chapter19.pdf>. The chapter is a large
  PDF; Campbell's conclusion, and the older view of Stevenson (1911) that it overturned, were read as
  the James Ford Bell Library's portolan pages (below) report them; the chapter itself was not reread.
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
- NOAA, *U.S. Coast Pilot*, chapter 1, "General Information": the paper chart categories, sailing
  1:600,000 and smaller, general 1:150,000 to 1:600,000, coast 1:50,000 to 1:150,000, harbor larger
  than 1:50,000: <https://nauticalcharts.noaa.gov/publications/coast-pilot/files/cp1/CPB1_C01_WEB.pdf>.
- NOAA, *Sunset Plan for Raster Nautical Charts* (2019): traditional paper charts ended by January
  2025: <https://nauticalcharts.noaa.gov/publications/docs/raster-sunset.pdf>.

Unverified, and so not claimed above: that the Carte Pisane carries a grid of small squares beside
its circles, and the geometry of the Juan de la Cosa chart's rhumb network. Stated above on
Campbell's authority without rereading him: that the pricked centre is still visible from the back of
surviving charts.
