# Agent decisions

Append-only. Each entry is a call an agent made in pencil: a default it took
under the one-way-door test, with its undo. Written by `agent-decision`; the
heading is the UTC stamp, so `agent_decisions.md#<stamp>` links one entry.

### 20261013t231307z
- Clip rhumb rays to the tile rect; tiles differ from main by subpixel AA on the 0.3-alpha rays (7,420 px >8/255 over 532 tiles, max 73) Undo: draw rays unclipped (restores main's pixels, ~0.6 ms/tile slower on the Pi) ([#26](https://github.com/mark-brannan/portolani/issues/26)) (no PR, branch claude/portolani-tile-rendering-85b1dd)

### 20261014t011838z
- Preview places ship whole-world with only NAME, SCALERANK, POP_MAX Undo: drop KEEP in build-preview.mjs ([#42](https://github.com/mark-brannan/portolani/pull/42))

### 20261014t011858z
- Deleted clip-geo.mjs and its test, unused once data ships whole Undo: revert ([#42](https://github.com/mark-brannan/portolani/pull/42))

### 20261014t011912z
- Rhumb lattice hidden while dragging along with ornaments; rays capped at half the world Undo: draw it in drawGround; lift the cap ([#42](https://github.com/mark-brannan/portolani/pull/42))

### 20261014t064024z
- Sea and country names win an overlap over town names, so a few capitals drop where a country name sits (London at z5, Washington at z4). Undo: list towns before country names in buildScene's lettering list and regenerate the goldens ([#50](https://github.com/mark-brannan/portolani/pull/50))

### 20261014t071006z
- Small rose nodes take every rose but the biggest, in pack order Undo: revert six lines in buildScene ([#52](https://github.com/mark-brannan/portolani/pull/52))

### 20261014t071131z
- loadPack skips sprite kinds the renderer does not place, so unplaced vignettes cost no bytes Undo: drop the filter in loadPack ([#52](https://github.com/mark-brannan/portolani/pull/52))

### 20261014t071918z
- Scale bar default style is chequer; style panel and scale= choose among five Undo: change DEFAULTS.scale and the scene default ([#53](https://github.com/mark-brannan/portolani/pull/53))

### 20261014t071924z
- Goldens render with the scale bar off, so they do not move with scale styling Undo: drop scale:'off' in test/golden.test.mjs, npm run golden ([#53](https://github.com/mark-brannan/portolani/pull/53))

### 20261014t082135z
- Cartouche corner order: open sea, then empty land, then any coast; land only breaks ties (coast*1000 + land) Undo: change the weights in the corner score in scripts/scene.mjs ([#62](https://github.com/mark-brannan/portolani/pull/62))

### 20261014t083600z
- Cartouche corner order: fewest coast crossings first, then least land (open sea, then empty land, then any coast) Undo: change the comparator on corners in scripts/scene.mjs buildScene ([#62](https://github.com/mark-brannan/portolani/pull/62))

### 20261014t085951z
- Projection lives on the view, not the style Undo: edit scripts/scene.mjs PROJECTIONS / page.js ([#63](https://github.com/mark-brannan/portolani/pull/63))

### 20261014t085955z
- Equal-area projection is Gall-Peters, scaled to share x Undo: edit scripts/scene.mjs PROJECTIONS / page.js ([#63](https://github.com/mark-brannan/portolani/pull/63))

### 20261014t085959z
- First projection set: Mercator, plate carree, Miller, equal-area Undo: edit scripts/scene.mjs PROJECTIONS / page.js ([#63](https://github.com/mark-brannan/portolani/pull/63))

### 20261014t095714z
- Vivid heraldic family: style name 'heraldic'; monsters 140-180 px, ships 64-88 px; all ships heading right. Undo: Rename the style in pack.json and the file prefix, or edit sizePx. ([#70](https://github.com/mark-brannan/portolani/pull/70))

### 20261014t095718z
- Dropped sea serpent 351371 (framed 651 KB woodcut), the lymphad (no truthful heading) and Heraldry_Fish_203 (duplicate sea-lion); merman shading greys kept as warm tones; coordinates rounded to 0.5 on three heavy files. Undo: Add the dropped files back from the sources named in the PR. ([#70](https://github.com/mark-brannan/portolani/pull/70))

### 20261014t121719z
- GSHHG "f" read from the pinned GSHHG zip in portolani build-preview, not a coastlines package (a package would be ~66 MB packed, past the 30 MB line) Undo: read f from a package later; the cell cutter is unchanged ([#84](https://github.com/mark-brannan/portolani/pull/84))

### 20261014t122229z
- City plans: bastions and moat for a footprint >= 40 km on a side (about the largest 75 metros) Undo: change FORT_KM in scripts/city.mjs ([#85](https://github.com/mark-brannan/portolani/pull/85))

### 20261014t122232z
- City plans: a church on every 30th built block (was 20) now churches draw 2x Undo: the modulus in block() in scripts/city.mjs ([#85](https://github.com/mark-brannan/portolani/pull/85))

### 20261014t122234z
- City plans: gate-to-plaza streets drawn over the roofs, not cut out of the blocks Undo: revert PR 85 ([#85](https://github.com/mark-brannan/portolani/pull/85))

### 20261014t194833z
- Trees grow on any land between 72 S and 72 N, deserts included (no land-cover data) Undo: add a mask to plantTrees ([#91](https://github.com/mark-brannan/portolani/pull/91))

### 20261014t194837z
- Trees 13 px, a 64 px lattice, per-zoom CHANCE and MOST tables Undo: change the constants at the top of scripts/trees.mjs ([#91](https://github.com/mark-brannan/portolani/pull/91))

### 20261014t194841z
- A second tree style, ink, beside marina Undo: drop its key from TREES and its option in index.html ([#91](https://github.com/mark-brannan/portolani/pull/91))

### 20261014t194845z
- A drag shows the last scene's trees, none on newly revealed ground until the map stops Undo: plant in drawGround ([#91](https://github.com/mark-brannan/portolani/pull/91))

### 20261014t194849z
- The density slider does not scale the trees Undo: pass density into plantTrees and scale CHANCE ([#91](https://github.com/mark-brannan/portolani/pull/91))

### 20261014t195008z
- 10m rivers and lakes ship in 5-degree cells, whole features duplicated per cell and deduped by id Undo: load the two 10m files whole once in loadWater10m ([#92](https://github.com/mark-brannan/portolani/pull/92))

### 20261014t195011z
- 10m water swaps in at zoom > 9, the land band's edge Undo: use >= in the createScene water line ([#92](https://github.com/mark-brannan/portolani/pull/92))

### 20261014t195015z
- a close view whose 10m cells hold no water draws none there rather than falling back to 50m Undo: fall back to 50m when both 10m lists are empty ([#92](https://github.com/mark-brannan/portolani/pull/92))

### 20261014t195019z
- scene.mjs exports keptWater(data) so a test can count what a view keeps Undo: inline keptWater back into paintWater ([#92](https://github.com/mark-brannan/portolani/pull/92))

### 20261014t195321z
- Carta Marina buildings offered in the picker, left out of the default selection Undo: drop the carta-marina clause from DEFAULT_RULES in scene.mjs and refresh the goldens ([#94](https://github.com/mark-brannan/portolani/pull/94))

### 20261014t195326z
- Building ids house, church, castle, round-tower, tent with style carta-marina, their own picker family Undo: rename in buildings.mjs before any link names them ([#94](https://github.com/mark-brannan/portolani/pull/94))

### 20261014t195330z
- Lesser places draw whenever any town family is drawn, always church or house, whatever is picked Undo: gate placeLesser on the selection in buildScene ([#94](https://github.com/mark-brannan/portolani/pull/94))

### 20261014t195334z
- Lesser building 18 px tall, its name 12 px Undo: LESSER_PX and LESSER_LETTER in buildings.mjs ([#94](https://github.com/mark-brannan/portolani/pull/94))

### 20261014t195338z
- Lesser places placed last, dropped whole when the building or its name does not fit Undo: keep the building without its name in placeLesser ([#94](https://github.com/mark-brannan/portolani/pull/94))

### 20261014t195342z
- Church odds by rank 5-8: 3/4, 1/2, 1/4, 0 Undo: lesserBuilding in buildings.mjs ([#94](https://github.com/mark-brannan/portolani/pull/94))

### 20261014t195700z
- Relief: a second style, engraved (ink only), beside marina Undo: drop its RELIEF entry and menu option ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t195711z
- Relief starts at zoom 2 (the mountain sprites started at 3) Undo: RELIEF_ZOOM = 3 ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t195715z
- Relief: mountainous country is a seeded 7-degree noise over half the land, NOISE_SALT 3781 chosen so the great named ranges fall on it Undo: drop the noise gate in reliefOf, or change NOISE_SALT or share ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t195721z
- Relief: ornaments clear it peak by peak, not range by range Undo: filter whole ranges in clearOf ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t195725z
- Relief drawn over rivers and lakes, under coast ink and rhumb lines Undo: call paintRelief before paintWater ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t195729z
- Relief sizes by zoom: peaks 30/26/20 px, hills 11 px, range cells 260/260/320 px, hill cells 120 px Undo: edit BANDS in scripts/relief.mjs ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t195734z
- Relief marina palette: light #d2965a, shadow rgba(150,70,32,0.7) Undo: edit the marina entry in scripts/relief.mjs ([#95](https://github.com/mark-brannan/portolani/pull/95))

### 20261014t202907z
- GSHHG river-lakes (negative area) drawn as lakes Undo: filter area < 0 in gshhgLakes ([#97](https://github.com/mark-brannan/portolani/pull/97))

### 20261014t202910z
- NE lake inside a GSHHG lake's box with 0.02 degree slack Undo: LAKE_SLACK = 0 ([#97](https://github.com/mark-brannan/portolani/pull/97))

### 20261014t202914z
- GSHHG level-4 ponds left out Undo: add L4 as L3 holes are added ([#97](https://github.com/mark-brannan/portolani/pull/97))

### 20261015t021925z
- Origins are the home frame, the frames of the chart scans the ornaments come from (Carta Marina, de Bry Virginia) and the world; locate flies to z10 unless closer; the flyout shows on hover or keyboard focus; the mark is red ink on a parchment halo Undo: edit ORIGINS, LOCATE_ZOOM, the #origins selector or drawHere in public/ ([#121](https://github.com/mark-brannan/portolani/pull/121))

### 20261015t090345z
- World-band beasts are paced at the zoom where the sheet is one window wide Undo: one line in createScene (from:) ([#143](https://github.com/mark-brannan/portolani/pull/143))

### 20261015t090350z
- A world-band view no curated sheet reaches draws no roses, only the Catalan rose's lines Undo: fall back to the window when sheets is empty ([#143](https://github.com/mark-brannan/portolani/pull/143))

### 20261015t090354z
- The rose-variety test checks the big roses at z6, where grid sheets give the variety, not z3 Undo: revert the test hunk ([#143](https://github.com/mark-brannan/portolani/pull/143))

### 20261015t182250z
- PR143: no code change; test left red, needs-human. Undo: remove label (no PR, branch claude/portolani-unattended-shift-2c08b5)

### 20261015t190448z
- PR151 merge: kept main's rose-frame avoid discs plus #146 ownSet branch; goldens regenerated; undo = revert merge 34777c3 (no PR, branch main)

### 20261015t193510z
- Reset keeps view, resets projection (PR 156) (no PR, branch claude/portolani-unattended-shift-2c08b5)

### 20261015t193513z
- Reset adds a history entry (PR 156) (no PR, branch claude/portolani-unattended-shift-2c08b5)

### 20261016t021922z
- Rose cap at wide views (zoom < 8): big 5%, small 2.4% of page width, from the three charts Undo: set WIDE.bigRose and WIDE.smallRose to 1 in scripts/scene.mjs (no PR, branch claude/162a-s2)

### 20261016t021925z
- Wide-band mix: 60% roses up to 6 a sheet, beasts a quarter monsters, budget 10 unchanged Undo: set WIDE.roseShare 0.4, sheetRoses 4, monsterShare 0.333 (no PR, branch claude/162a-s2)

### 20261016t021927z
- Cap and mix apply below zoom 8 only; general band and finer keep sprite sizes Undo: change WIDE.zoom (no PR, branch claude/162a-s2)

### 20261016t024236z
- Default placement equals historic; undo parsePlacement fallthrough (no PR, branch main)

### 20261016t024238z
- seed:<n> implies seeded; undo layer seed over historic (no PR, branch main)

### 20261016t024242z
- Re-roll uses Math.random 31-bit; undo counter (no PR, branch main)

### 20261016t040813z
- oddlines PR: left horizontal ray bundle alone; undo: ask fewer rays or lower alpha ([#168](https://github.com/mark-brannan/portolani/pull/168))

### 20261016t040818z
- oddlines PR: split rays at meridian always; undo: early return in cutOut when no extents ([#168](https://github.com/mark-brannan/portolani/pull/168))

### 20261016t040823z
- oddlines PR: jpeg screenshots under docs/oddlines; undo: delete folder ([#168](https://github.com/mark-brannan/portolani/pull/168))

### 20261016t053412z
- Took: coast (country) names stay lettered on the window's stretch of coast; undo: letter coast names by fixed chunks of the coast (no PR, branch main)

### 20261016t054437z
- portolani#131 Country names: only chunks wholly in the window are lettered; chunk size = window width/0.5 deg rounded to power of 2 points. Undo: revert the commit (no PR, branch claude/131s5b-s2)

### 20261016t083716z
- rose in style aguiar not a new style change style in build-packs.mjs and rebuild ([#179](https://github.com/mark-brannan/portolani/pull/179))

### 20261016t083722z
- rose-prunes sizePx 300 level with rose-aguiar lower sizePx ([#179](https://github.com/mark-brannan/portolani/pull/179))

### 20261016t083728z
- west rose cut, not south or north-east change crop ([#179](https://github.com/mark-brannan/portolani/pull/179))

### 20261017t002523z
- ship-w-buss keeps ink key by visual pass Undo: set key: 'patch', paper: '#d6cdbc' on ship-w-buss (candidate in docs/master-w-buss/) (no PR, branch main)

### 20261017t010122z
- pare-lion keeps ink key by a visual pass (#111) Undo: key: 'patch' on pare-lion in scripts/build-packs.mjs (no PR, branch claude/pare-3060-s3)

### 20261017t010125z
- pare-seaman keeps ink key by a visual pass, crop widened at top for both horns (#111) Undo: key: 'patch' on pare-seaman in scripts/build-packs.mjs (no PR, branch claude/pare-3060-s3)

### 20261017t011603z
- pare-boar keeps ink key (pare-3267) Undo: key: 'patch', paper '#d6d6d6' on pare-boar, no silhouette (no PR, branch claude/pare-3267-s3)

### 20261017t011605z
- pare-calf keeps ink key (pare-3267) Undo: key: 'patch', paper '#d6d6d6' on pare-calf, no silhouette (no PR, branch claude/pare-3267-s3)

### 20261017t015810z
- Aguiar chart paper #d3cfbb measured from the rose ring, shared by the later town sprites Undo: change AGUIAR_CHART_PAPER and rebuild packs (branch:claude/aguiar-chart-a-s3) (no PR, branch claude/aguiar-chart-a-s3)

### 20261017t015813z
- Rose circle radius 160 (crop widened 20 px each side) leaving a river fleck at the east tip; palms mask polygon cuts the red bars only Undo: edit circle/mask in build-packs.mjs and rebuild (branch:claude/aguiar-chart-a-s3) (no PR, branch claude/aguiar-chart-a-s3)

### 20261017t202827z
- dev server takes geo/ and font/ from the published Pages site rather than a shared local cache Undo: point DATA_URL at a local cache, or make --build the default ([#197](https://github.com/mark-brannan/portolani/issues/197)) (no PR, branch claude/portolani-issue-197-7c59d0)

### 20261017t202830z
- show-dont-tell rendered paths: public/**, scripts/*.mjs, packs/**, test/golden/** Undo: edit paths: in .github/show-dont-tell.yml ([#197](https://github.com/mark-brannan/portolani/issues/197)) (no PR, branch claude/portolani-issue-197-7c59d0)

### 20261020t210834z
- Icon functions until ruled: astrolabe = my position (one click), dividers = Go box, anchor = chart views Undo: swap the three buttons' handlers in public/page.js ([#202](https://github.com/mark-brannan/portolani/pull/202))

### 20261020t214355z
- A point of interest's tent stands beside an island too small to stand on, rather than over it. Undo: drop the beside argument in scene.mjs standOf ([#204](https://github.com/mark-brannan/portolani/pull/204))

### 20261020t214401z
- Places' 'Pitcairn Island' became 'Pitcairn Islands', framing all four islands. Undo: restore the 'Pitcairn Island' line in public/page.js ORIGINS ([#204](https://github.com/mark-brannan/portolani/pull/204))

### 20261020t214405z
- The remote islands' 10m outlines draw from z5; below it the island marks stand in, for drag cost. Undo: set ISLE_LAND_ZOOM in scene.mjs to 0 ([#204](https://github.com/mark-brannan/portolani/pull/204))

### 20261020t223119z
- Instrument jobs: compass opens Go (box, My position, places), sheepskin chart opens the Charts drawer, dividers hold the voyages placeholder, anchor flies home in one click, astrolabe has no job and sits in docs/where/astrolabe.svg Undo: swap the buttons' handlers in public/page.js and the row in public/index.html ([#206](https://github.com/mark-brannan/portolani/pull/206))

### 20261020t223124z
- One row per chart: a chart with two read centres (Carte Pisane, Catalan Atlas, De la Cosa) frames both; The North becomes Carta Marina 1539 and Virginia becomes De Bry, Virginia 1590 in the charts list Undo: edit CHARTS and ORIGINS in public/page.js ([#206](https://github.com/mark-brannan/portolani/pull/206))

### 20261020t224746z
- portolani#206: places split anchor=anchorages (home first), astrolabe=points of interest (chart schools, remote islands) Undo: move rows between ANCHORAGES and SIGHTS in public/page.js ([#206](https://github.com/mark-brannan/portolani/pull/206))

### 20261021t092348z
- Build diagnostic: one line under the timing line, sha · build time UTC with age · subject Undo: revert PR 241 ([#241](https://github.com/mark-brannan/portolani/pull/241))

### 20261029t090326z
- De la Cosa's own placement is derived from its two drawn parallels (the Tropic of Cancer and the equator, found as the two long red lines by a Hough vote), its default chip named Parallels; charts without parallels keep the Level default The turn handle sits at the sheet's bottom-left corner and the resize handle at its bottom-right (the cartouche holds the top-right); both 12 canvas px in radius, hit within 6 CSS px more Snap chip labels: New World, Atlantic, Europe for de la Cosa; West, Baltic for the Carta Marina The Carta Marina's own placement is level (turn 0) rather than the mean of its two turns, so the Level chip stays true The frame a chart's thumbnail flies to contains the whole sheet with 8% clear round it The hash rounds a placement to 3 dp of degree for the centre, 5 dp for the scale, 1 dp for the turn The paper mask floods from the border through pixels with min channel over 150 and saturation under 30, keys the outermost 0.6% band whatever it holds, and feathers one px; shipped as an RGBA PNG beside the JPEG Thumbnails are the JPEG cropped to 64 by 44 (object-fit cover), unmasked The 'notes to come' caption line stays under each chart row Touch: one finger drags the sheet and the handles work by touch; two-finger turn and resize are not built The mask applies in both modes, so the warped pieces no longer draw the scanner's paper either Resizing by the handle is bounded to one eighth and eight times the scale it was taken at render.mjs: --overlay <id> draws the sheet; --overlay <id>:<opacity> the warped pieces ([#266](https://github.com/mark-brannan/portolani/pull/266))

### 20261029t095623z
- the row's second pass rewrites the row Feature in place Undo: split the row Feature in two ([#259](https://github.com/mark-brannan/portolani/pull/259))

### 20261029t095644z
- earlier drawer position cited from #206 body as paraphrase Undo: replace with the user's sentence when found ([#259](https://github.com/mark-brannan/portolani/pull/259))

### 20261029t100120z
- name and thumbnail still shut the drawer; the eye does not Undo: edit public/page.js or index.html ([#267](https://github.com/mark-brannan/portolani/pull/267))

### 20261029t100145z
- thumbnails 96x66, the brief's floor Undo: edit public/page.js or index.html ([#267](https://github.com/mark-brannan/portolani/pull/267))

### 20261029t100158z
- fade 0.5 s after landing, not during the flight Undo: edit public/page.js or index.html ([#267](https://github.com/mark-brannan/portolani/pull/267))

### 20261029t113101z
- portolani#270: sheet thumbnails not re-rendered after levelFit scale fix (<0.6%) ([#270](https://github.com/mark-brannan/portolani/pull/270))

### 20261029t113150z
- world.json credit: the name Commons gives (uploader, or the source museum for Ino) Undo: revert ba785ff's world.json credit lines ([#271](https://github.com/mark-brannan/portolani/pull/271))

### 20261029t113206z
- link-only rows get an enabled 'link' button; a ship without a thumb gets 'open' Undo: revert the button change in ba785ff ([#271](https://github.com/mark-brannan/portolani/pull/271))

### 20261029t182005z
- modern city on a POI's spot means a town of today on the same site; Tyre and Carthage get the town glyph, Berenike the ruin Undo: edit docs/spec/design.md ([#274](https://github.com/mark-brannan/portolani/pull/274))

### 20261029t182025z
- high-contrast voyage palette applies only to voyages with a dashed or dotted leg; all-solid voyages keep the current palette at Heavy Undo: edit docs/spec/design.md ([#274](https://github.com/mark-brannan/portolani/pull/274))

### 20261029t195328z
- doubt tile: heading first, then 'Scholars doubt this part:' and the doubt, then date, note, source Undo: move doubt after meta in fillTile ([#278](https://github.com/mark-brannan/portolani/pull/278))

### 20261029t195346z
- Samudra-Quanzhou drawn speculative whole, since the leg carries the Tawalisi doubt Undo: split the leg at Tawalisi ([#278](https://github.com/mark-brannan/portolani/pull/278))

### 20261029t195417z
- the doubt cloud is a fixed ~88x66 px at every zoom Undo: scale CLOUD_LOBES by zoom ([#278](https://github.com/mark-brannan/portolani/pull/278))

### 20261029t210256z
- people.json keyed by slug, name a field, who holds slugs confidence replaces known on born and death, one word with the legs role and origin folded into bio images[] replaces portrait, the #280 shape death: unknown becomes an absent death Pytheas's stand-in manuscript page is kind scene a who that people.json lacks fails the read ([#275](https://github.com/mark-brannan/portolani/pull/275))

### 20261029t212506z
- A click on the open group's heading does nothing; a grouped list is never left with no group open The group slide takes about a quarter of a second The notes pulse is three rings over about four seconds, then the marks fade to nothing; the hide-for-a-voyage setting sits under Settings, Under the hood A cluster badge counts marks within a tap's reach and sits on the mark nearest the group's centre; the tile heads with the count and the date span ([#274](https://github.com/mark-brannan/portolani/pull/274))

### 20261029t212628z
- decisions line appended at the bottom per the file's 'newest last by date' header, not the top spec header points at decisions.md and touch.test.mjs instead of 'verified at main' until #282 merges ([#281](https://github.com/mark-brannan/portolani/pull/281))

### 20261029t212641z
- exponent-form coordinates written as decimals so the Go box parser reads them ([#282](https://github.com/mark-brannan/portolani/pull/282))

### 20261029t223606z
- Mansa Musa named in the Atlantic fleet's who, since the data test needs every person on a voyage Undo: drop mansa-musa from mali-atlantic who once a hajj voyage names him ([#284](https://github.com/mark-brannan/portolani/pull/284))
