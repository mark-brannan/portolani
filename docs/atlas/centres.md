# The historical centres, read off the scans

The curated sheets in [the atlas design](README.md) put each circle where the chart's own circle
stood. This file reads those circles off public scans, one chart at a time, and moves each centre
onto the modern earth. Read 2026-10-14 for [#107](https://github.com/mark-brannan/portolani/issues/107).

## Method

The same three steps for every chart.

1. **The circle.** On the scan, the nodes of the network are the points where sixteen or
   thirty-two lines meet. Their pixel positions are read off a gridded crop, and a circle is
   fitted to them by least squares. The fit's centre is checked against the hub the lines
   visibly run from. Each image below draws the fitted circle in blue over the scan.
2. **The transfer.** Four or five coastal landmarks that the chart draws recognisably (islands
   above all) are read off the same scan. A similarity transform (one scale, one turn, one
   shift) from scan pixels to modern longitude and latitude is fitted to them, in a plane
   where a degree of longitude is shortened by the cosine of the middle latitude. The
   transform carries the centre and the radius across.
3. **The error.** The transform's root-mean-square residual over its landmarks is the floor.
   Where a chart has too few sure landmarks for a fit, the position is read by eye against the
   nearest coasts and the error says so.

The turn the fit finds is a check on the whole method: on the Carte Pisane it comes out at
8.2°, inside the 8° to 10° Gaspar measures for the portolan charts' magnetic tilt.

Scans are the Wikimedia Commons copies of each library's digitisation, at the resolution
named in each section; reading at a library's full resolution would tighten every number.

## Summary

| sheet | the guess | read off the scan | radius | error |
|---|---|---|---|---|
| Mediterranean, west (Carte Pisane) | 8°E 39°N | 7.4°E 40.0°N, west of Sardinia | 8.0° | ±0.5° |
| Mediterranean, east (Carte Pisane) | 26°E 36°N | 27.4°E 36.8°N, the Dodecanese by Kos | 7.5° | ±0.5° |
| Levant and Black Sea (Vesconte 1311) | 30°E 40°N | 25.2°E 37.5°N, the Cyclades | 3° | ±0.7°, from a tracing |
| Europe and the Mediterranean (Dulcert 1339) | 5°E 40°N | 14.5°E 40.0°N, the south Tyrrhenian | 17° | ±1.5° |
| The known world of 1375 (Catalan Atlas) | 20°W 37°N | rose 20.7°W 42.1°N; network centre 5.4°W 42.3°N | 16° | ±2° |
| Scandinavia and the Baltic (Carta Marina) | 22°E 60°N | 19.5°E 62°N, the Bothnian Sea | no ring | ±1° |
| The Atlantic and the Americas (de la Cosa) | 35°W 30°N | 45°W 23.4°N, on the Tropic of Cancer | about 20° | latitude ±0.5°, longitude ±10° |

The radius is in degrees of a great circle on the modern earth, from the same transform.

## Carte Pisane: two circles

![The Carte Pisane, north up, with its two fitted circles](centres/carte-pisane.jpg)

- **Scan.** Bibliothèque nationale de France, GE B-1118 (RES), Gallica
  [btv1b52503226n](https://gallica.bnf.fr/ark:/12148/btv1b52503226n), through
  [Commons](https://commons.wikimedia.org/wiki/File:Carte_marine_de_l%27oc%C3%A9an_Atlantique_Est,_de_la_mer_M%C3%A9diterran%C3%A9e_et_d%27une_partie_de_la_mer_Noire,_connue_sous_le_nom_de_Carte_Pisane_-_btv1b52503226n_(1_of_2).jpg),
  read at 3840 px wide. The scan has south up; it is turned 180° for reading.
- **Circles.** Eight nodes of each ring fit a circle to within 6 px. West: centre at the hub
  the lines run from, radius 701 px. East: radius 655 px. The two rings come within about
  50 px (half a degree) of each other between Sicily and Greece, so "tangent" stands.
- **Transfer.** Mallorca, the middle of Sardinia, Port-Vendres, the middle of Crete and the
  middle of Cyprus: residuals 0.1° to 0.3°, 0.21° rms, scale 87.5 px a degree, the scan turned
  8.2°.
- **Positions.** West: **7.4°E 40.0°N**, about 0.8° off Sardinia's west coast, radius 8.0°.
  East: **27.4°E 36.8°N**, in the south-east Aegean by Kos, radius 7.5°. Error ±0.5°: the fit's
  0.2° plus the reach from the landmarks to the centres.

## Pietro Vesconte, 1311

![The tracing of Vesconte's 1311 network, with its fitted circle](centres/vesconte-1311.jpg)

- **Scan.** No digitisation of Archivio di Stato di Firenze, CN 1, is on Commons. The source
  read is a published line tracing of its network,
  [Commons](https://commons.wikimedia.org/wiki/File:1311_portolan_of_Pietro_Vesconte.jpg),
  588 px wide, credited to the Archivio. The tracing shows the Aegean part of the chart only.
- **Circle.** Centre at the hub among the Cyclades; eight nodes at 222 to 232 px, radius 230 px.
- **Transfer.** Too few named landmarks on a tracing for a fit. Read against Crete's north coast
  (bottom of the tracing) and the large island at the top (Lemnos or Thasos), with the
  tracing's own scale of miles as a cross-check.
- **Position.** **25.2°E 37.5°N**, the Cyclades by Tinos and Mykonos; radius about 3°. Error
  ±0.7°, mostly from which northern island the tracing draws.
- **Open.** The doc's sheet covers the Black Sea too. Whether the chart has a larger circle
  beyond the one traced here needs the Archivio's own scan.

## Angelino Dulcert, 1339

![Dulcert's chart with its fitted circle](centres/dulcert-1339.jpg)

- **Scan.** Bibliothèque nationale de France, GE B-696 (RES), through
  [Commons](https://commons.wikimedia.org/wiki/File:Map_of_Angelino_Dulcert_cropped.jpg),
  2651 px wide.
- **Circle.** One great circle, centre at the hub at (1305, 968) px. Five sure nodes (west,
  east, the two north-west and north-east, south-west) lie at 1025 to 1128 px; radius
  1070 ± 50 px. The east node falls just beyond the Levant coast, the west node in the Atlantic
  off Iberia.
- **Transfer.** By eye. Sardinia is the one island drawn plainly at this resolution; the hub
  sits 306 px east and 80 px north of its middle, just off the Italian coast's run of names,
  and the east node's place beyond the Levant gives the scale.
- **Position.** **14.5°E 40.0°N**, the south Tyrrhenian off Campania and Calabria; radius about
  17°. Error ±1.5°.

## The Catalan Atlas, 1375

![Gallica's sheet 5 of the Catalan Atlas: the rose in red, the network's circle in blue](centres/catalan-atlas.jpg)

- **Scan.** Bibliothèque nationale de France, Espagnol 30, Gallica
  [btv1b55002481n](https://gallica.bnf.fr/ark:/12148/btv1b55002481n), the BnF's "Feuille 5"
  through [Commons](https://commons.wikimedia.org/wiki/File:Catalan_Atlas_BNF,_sheet_5.jpg),
  960 px wide. It is the Atlantic panel: Ireland at the top, the Canaries at the foot.
- **Circle.** Five nodes down the panel's west side fit a circle to within 10 px, radius 914 px,
  centred on the panel's east edge at the rose's own height. So the network's centre is on the
  join with sheet 6, over Iberia, and the rose is not that centre: it sits on the line from the
  centre to the west node, 0.72 of the way out.
- **Transfer.** The Canaries, Ireland and the Portuguese coast: 1.6° rms.
- **Positions.** The rose: **20.7°W 42.1°N**, open Atlantic west of Galicia. The network's
  centre: **5.4°W 42.3°N**, over northern Iberia; radius 16°. Error ±2°.

## Olaus Magnus, Carta Marina, 1539

![The Carta Marina's Baltic rose, ringed in red](centres/carta-marina.jpg)

- **Scan.** [Commons](https://commons.wikimedia.org/wiki/File:Carta_Marina.jpeg), 5016 px wide
  (read at 3840), credited to a Plymouth Marine Laboratory page; the file does not say whether
  it is the Munich or the Uppsala copy.
- **Circle.** None. The four roses (Mare Glaciale, west of the Faroes, the North Sea, the Gulf of
  Bothnia) are hubs of lines with no ring of sixteen nodes. The central one, the hub the sheet
  follows, is in the Gulf of Bothnia.
- **Transfer.** By eye: the rose sits between the Medelpad and Hälsingland coast (Middelpadia and
  Helsingia on the map) and the Ostrobothnian shore, north of where Olaus draws Åland.
- **Position.** **19.5°E 62°N**, the Bothnian Sea. Error ±1°.

## Juan de la Cosa, 1500

![De la Cosa's chart with its two fitted circles](centres/de-la-cosa.jpg)

- **Scan.** Museo Naval, Madrid, through
  [Commons](https://commons.wikimedia.org/wiki/File:1500_map_by_Juan_de_la_Cosa_rotated.jpg),
  2127 px wide, a photograph of the chart credited to a blog page.
- **Circles.** Two rings of the same radius, about 360 px, each through four drawn roses at
  its nodes. The rings are separate: their centres are about 1000 px apart. Both centres
  sit on the red line of the Tropic of Cancer. The western centre is the rose with the Virgin
  and Child; the eastern is a plain hub east of Arabia.
- **Transfer.** Latitude off the chart's own two lines: the Tropic of Cancer and the equator
  below it. Longitude by eye, carrying the Old World's scale (Cape Blanco to the Red Sea) west.
  The New World is drawn at a larger scale than the Old, so the western longitude is the weak
  number.
- **Positions.** West: **45°W 23.4°N**, mid-Atlantic on the Tropic of Cancer. East: about
  **65°E 23.4°N**, the Arabian Sea. Radius about 20°. Error: latitude ±0.5°, longitude ±10°.

## The three unverified claims

The design doc's sources list three claims as unverified.

- **De la Cosa's network geometry: settled.** Two circles of equal radius, separate, each centre
  on the Tropic of Cancer (above). The doc's "on the equator" for the Virgin and Child rose
  reads wrong against the scan: it is on the Tropic.
- **Which Catalan Atlas leaf carries the rose: settled.** The BnF's Gallica labels it Feuille 5
  of 12, the Atlantic panel. "Folio 5v" is not the BnF's label on the digitisation; "sheet 5"
  is.
- **Pujades on Vesconte's order of work: struck.** The Wikipedia article reports that Pujades
  (2007) shows an image of Vesconte drawing a chart and that "he started by drawing first the
  rhumbline grid", with no page, and tags the sentence "[clarification needed]". Pujades's own
  text was not reached. Campbell (1987, pp. 390 to 391) carries the order of work on its own.

## Sources

Consulted 2026-10-14.

- The scans linked in each section, through Wikimedia Commons.
- Wikipedia, "Rhumbline network": <https://en.wikipedia.org/wiki/Rhumbline_network>.
- Joaquim Alves Gaspar (2008), cited in [the design doc](README.md), for the 8° to 10° tilt
  the Carte Pisane fit is checked against.
