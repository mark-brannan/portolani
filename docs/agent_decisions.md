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
