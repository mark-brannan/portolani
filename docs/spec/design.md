# Design rules

The behaviour specs beside this file say what the page does. These say what the user asked the page to be, on style and on design, so the rules outlive the threads they were given in. Each Feature carries a `Source:` line (where the rule was given); a `Tested by:` line names a fast, offline test, and a Feature without one has none. A quote is the user's words; anything marked *paraphrase* is the recorder's wording of a rule given without a verbatim sentence. Every rule here is current thinking until the user marks it firm.

Feature: One mode only
  Source: [#211](https://github.com/mark-brannan/portolani/pull/211) (paraphrase: one mode, dark margins round the map, parchment inside every drawer, "allowing for a stub" for a low-light mode); the stub: docs/decisions.md 2026-10-21, "Don't delete this.  I want stubs for things much of the time and this one I asked for on purpose" ([#211](https://github.com/mark-brannan/portolani/pull/211#discussion_r4332694498))
  Tested by: test/drawers.test.mjs — 'no prefers-color-scheme rule anywhere in public/'
  Scenario: the browser's light/dark setting is not followed
    Given a browser set to dark mode, and another set to light
    When each opens the chart and opens a drawer
    Then both show the same page: the dark `#1d1913` margin round the map, parchment inside the drawer
    And the low-light mode's empty rule and its comment stay in the stylesheet as a stub

Feature: The cartouche and the scale bar keep to the window
  Source: docs/decisions.md 2026-10-14, "pinned to the screen." ([#107](https://github.com/mark-brannan/portolani/issues/107)); the corner and the drag: [#219](https://github.com/mark-brannan/portolani/pull/219) (paraphrase)
  Scenario: pan leaves them in place; a drag moves them to a corner
    Given the chart with the cartouche and the scale bar drawn
    When the user pans the map
    Then each stays in its corner of the window while the map slides under it
    When the user drags either one toward another corner and lets go
    Then it takes the nearest corner, and the link keeps that corner

Feature: Drawer controls are chips that show their effect
  Source: repo CLAUDE.md, "No dropdowns in the settings drawer where icons, chips or checkboxes will do."; "Option lists are chips, not dropdowns or plain lists, and each chip shows what it does."; "Every control shows its effect where it can (a swatch, a line sample or a small example), not only a label."
  Scenario: an option list in a drawer
    Given any drawer opened
    When the user looks at a control with a set of options
    Then the options are chips, icons or checkboxes, not a dropdown or a plain list
    And each chip or control shows its effect (a swatch, a line sample or a small example) where it can, not only a label

Feature: A point of interest opens a tile, never lettering
  Source: docs/decisions.md 2026-10-21, "my preference is as a 'click' or 'tap' on mobile, then a little educational popover tile appears nearby the point of interest"; "a major landing, a death/confrontation, a location where maps were made, whatever we decide is a point of interest should get a tile with flavor text." ([#212](https://github.com/mark-brannan/portolani/pull/212#discussion_r4332019539))
  Scenario: click or tap a point of interest
    Given the chart with a point of interest drawn (a voyage's skull, a landing, a place where maps were made)
    When the user looks at it without touching it
    Then no text is drawn beside the mark, as cities and regions have
    When the user clicks it, or taps it on a phone
    Then a small tile of flavour text opens near it

Feature: New decorations ship on; headless scene options stay off
  Source: repo CLAUDE.md, "A new visual decoration ships on by default: a sprite kind, a style, a drawn feature. Put it in the page's `DEFAULTS` and in `defaultSprites`, unless the user asks otherwise, for example by raising it as a concern on the PR."; "Headless scene options (`relief`, `trees`, `rivers`, `lakes`) stay off by default, so each golden isolates one thing."
  Tested by: test/styles.test.mjs — 'defaultSprites follows its rule, so a sprite added to a pack joins or stays out by family' (the sprite half only; the headless half has none)
  Scenario: the page and the headless renderer start differently
    Given a decoration added in a PR, with no concern raised on it
    When the page opens at its defaults
    Then the decoration is drawn
    When `scripts/render.mjs` renders a scene with no options
    Then `relief`, `trees`, `rivers` and `lakes` are off

Feature: A scanned sprite is the whole crop, feathered
  Source: repo CLAUDE.md, "A scanned sprite is a soft-edged patch of the scan, not its ink alone." and "The raw crop is the bar."; docs/decisions.md 2026-10-14, "in all cases (or nearly all) I would rather see the raw image on the portolani map than the one we scanned and filtered"; "I would rather have all of the water and keep all of the monster detail, than trim a little water and loose any monster details." ([#104](https://github.com/mark-brannan/portolani/pull/104), [#111](https://github.com/mark-brannan/portolani/issues/111), [#112](https://github.com/mark-brannan/portolani/pull/112#discussion_r4277791146))
  Scenario: a ship or a monster cut from a coloured plate
    Given a crop of a ship or a monster from a coloured scan
    When it is drawn on the map, multiplied onto the parchment
    Then the sea round it, the swell and the ripples come with it, the most water below the figure
    And its feathered edge sits outside the ink, never across a tail tip or a yard
    And nothing is keyed out by darkness levels
    And the sprite PR shows the raw crop beside the sprite at map size, naming with a reason anything the raw has that the sprite lacks

Feature: No icon removed, no section gone, until the reorg
  Source: docs/decisions.md 2026-10-20, "No icons may be removed right now. No section may "go". I intend to do a larger reorg of the sections and drawers at some point because the rose drawer has too much random stuff and the others are not well defined or divided." ([#225](https://github.com/mark-brannan/portolani/issues/225))
  Scenario: a PR that touches the drawers
    Given the instrument buttons and drawer sections on main
    When a PR changes a drawer, before the larger reorg
    Then every instrument button and every drawer section on main is still there after it

Feature: A chart's scan lies on the map as one sheet
  Source: the user's brief on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "the cutout of the jpg scan overlaid, very simply. KISS."; "apply full transparency around the empty 'edge' of the image and do not occlude the background main portolani map, yet also no transparency or mixing of the chart scan with the background map. Purely one on top of the other."; "land as one unsplit image, in whatever orientation is closest, using some average, to the real map features"; "One sheet of paper (or animal skin) set directly on top of another."
  Scenario: the default look of a chart's scan on the map
    Given a chart whose scan the site carries
    When the user shows it
    Then the scan is drawn whole, as one image under one similarity (scale, turn and shift; no warp, no split)
    And the scanner's paper round the skin is transparent, keyed from the image's border inward, so the map shows round the sheet's ragged edge
    And inside that edge the scan is fully opaque: no opacity, no blend, no onion skin
    And it is drawn above every layer of the map (coast, lattice, names, towns, roses, ships, voyages), as one sheet laid on another
  Scenario: where the sheet lands by default
    Given a chart whose coasts fit the map at more than one scale or turn (de la Cosa's two worlds, the Carta Marina's two halves)
    When the user shows it
    Then it lies close, not exact: level, at a scale midway between those fits, centred between them
    And a chart that draws a parallel (de la Cosa's equator and Tropic of Cancer, "the first depiction of the equator and the tropic of cancer on a nautical chart") is anchored by those lines first: its turn from their tilt, its scale and latitude from their spacing, the coasts only setting the longitude
    And the placements that fit one coast best (the European coast, the New World coast, a third where it is as good) are offered as snaps on the sheet, as many as fit well, not only two
  Scenario: the user moves the sheet
    Given the sheet shown
    When the user drags inside it
    Then it slides up, down, left and right over the map, and the map does not pan
    When the user drags its corner handle
    Then it turns about its centre (and, while the user is trying it, resizes by its other handle; resizing may go)
    And the link keeps the placement
  Scenario: the map's projection changes under the sheet
    Given the sheet shown and the view at some zoom and centre
    When the user picks another projection
    Then the map re-draws in it at the same zoom and centre, no jump
    And the sheet keeps its pixel size and turn, its centre pinned to the same longitude and latitude, undistorted

Feature: The warped pieces are the alternative, behind a setting
  Source: the user's brief on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "I do not want to throw this logic away, but it is not working as well as I would like (it's ugly and needs refinement) so I want to make it the alternative UX experience, not the default, that we hide behind a separate setting."
  Scenario: the pieces mode
    Given a chart whose scan is split into pieces, each warped onto today's coast with its own fit
    When the user looks for it
    Then it is off by default and lives under Settings, Under the hood, with its opacity slider beside it, not in the Charts drawer
    And on, it draws exactly as before: each piece under the lattice and the ornaments, at the slider's opacity
    And other comparison controls (a slider wipe, a swipe) are later work, behind the same setting

Feature: A chart's row in the Charts drawer
  Source: the user's brief on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29, and the follow-up the same day ("row shape: D", "I would like to use the full name for the chart link on our page: 'Map of Juan de la Cosa'"): "if the only button we need is to jump to the chart's default position and show it, then we really need no button beyond the name of the chart itself"; "put the originating city immediately to the right ... and use it as another button. In that case the button text is still 'Majorca' and no further explanation is needed"; "'Where it was made' is not helpful"; "all charts to have a miniature version of the scan for their icon". The second pass, later that day: "I do want to increase the size of the drawer thumbnails, by at least ~50%, accounting for more vertical space when the notes come in for these entries also. I would like all chart thumbnails for charts that we have to be the full color version all the time (if we have the chart in the project), no fade/gray when unselected. grey when chart not imported is still ok. I would like a show/hide icon (or button?) to the right of each chart name instead of clicking the chart. It might be a simple eye vs closed eye with slash in the usual style, or it might be an eye with an eye patch evocative of a pirate."; "clicking the origin city should hide the chart when zooming to the city, if the chart would result in the obstructing the city from view. Clicking either the map icon, or the map name should zoom to the correct position for the chart...but the show/hide button controls show/hide. The very first time any chart is selected after opening the drawer, when none was selected previously is to fade in the chart when clicking any of these: the chart icon, the chart name; however the show/hide is still a fast show action. Clicking the chart icon or chart name after the chart is already shown does not hide it, only the show/hide icon hides it."
  Scenario: the row
    Given the Charts drawer open
    When the user looks at a chart's row
    Then its icon is a miniature of that chart's own scan, not the drawer's chart glyph, at least half as big again as 64 by 44, with room below the name for the notes to come
    And a chart whose scan is in the project shows its miniature in full colour, shown or not: no fade, no grey
    And beside the icon the chart's full name as text ("Map of Juan de la Cosa"), and to the right of the name a show/hide icon (an eye and an eye struck through, or an eye with a pirate's patch)
    And under the name the city it was made in and its year, "Majorca, 1375", the city a link that flies to the city; no "where it was made" wording, no tooltip-only meaning
    And no other control sits in the row but its Chart position chips (below); the pieces mode and its opacity live under Settings, Under the hood
    And a chart without a scan yet shows the glyph greyed, its name flying to its sheet view as before
  Scenario: the icon or the name shows the chart; only the eye hides it
    Given a chart in the row
    When the user clicks its icon or its name
    Then the map flies to the view that frames the sheet, and the sheet is shown if it was hidden
    And if no chart was shown since the drawer opened, the sheet fades in
    When the user clicks the icon or the name again, the sheet shown
    Then the map flies to the frame again and the sheet stays shown
    When the user clicks the show/hide icon
    Then the sheet shows at once, no fade, or hides if it was shown; nothing else in the row hides it
  Scenario: the city clears the way to itself
    Given a chart's sheet shown
    When the user clicks the chart's city
    Then the map flies to the city
    And if the sheet would cover the city in that view, the sheet hides, and its eye shows it hidden
  Scenario: the view that frames the sheet
    Given a chart shown by its name
    When the map flies to it
    Then the zoom shows the whole sheet with a small margin, derived from the sheet's corners, never a hand-typed zoom (de la Cosa lands near zoom 2, not 4.4)
    And a chart brought in later carries its own frame, checked at the chart's size on screen before it ships

Feature: A chart's position chips, and the line each was fitted to
  Source: the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "The chart snap buttons should not disappear, right now they disappear right away after clicking. They should be inside the drawer for the chart on desktop and they should indicate what they are for. Probably, "Chart Position: <a> <b> ..."", and "When clicking any of the given position buttons, it should animate the primary feature that was used for alignment/sizing/position as a simple line over the chart. Then the line should fade out. For example, "parallels" should animate/overlay the Equator and the Tropic of Cancer. New World should animate/overlay the portion of the South/Central American coast which is aligned with the chart at that orientation."
  Scenario: where the chips live
    Given the Charts drawer open on a wide screen, and a chart whose scan is in the project
    When the user looks at that chart's row
    Then under the city and year a line reads "Chart position:" and then one chip per placement (the chart's own, "Parallels" or "Level", then each coast's fit: "Europe", "New World" and so on)
    And the chip for the placement the sheet lies at is lit
    And no chip floats on the map over the sheet
    When the user clicks a chip
    Then the chips stay where they are, the drawer stays open, and the lit chip moves to the one clicked
  Scenario: a chip shows what it was fitted to
    Given a chart's row with its position chips
    When the user clicks a chip
    Then the sheet is shown at that placement, and the map frames it as the chart's name does
    And over the sheet, in today's geography, the feature that placement was fitted to draws itself as a plain line, from one end to the other, then fades out
    And "Parallels" draws today's equator and Tropic of Cancer; a coast's chip ("New World") draws only the stretch of today's coast that fit used, not the whole coast; the chart's own "Level" draws every coast it is centred between
    And the line is the feature the fit was computed from, carried with the placement in the chart's data, never a stretch drawn by hand to look right
    And with reduced motion the line shows whole, then fades
  Scenario: a phone (waiting on a UI walk)
    Given the Charts drawer open as the bottom sheet, at 520 px and under
    When the user looks for the position chips
    Then they sit in the chart's row as on a wide screen, until the user has walked the phone's drawers

Feature: The projection chips live in the Charts drawer
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "The controls for map projections should live under charts now, not the compass rose. I'm not sure about other map settings...they probably stay under the rose but it could change."
  Scenario: the user looks for the projection
    Given the drawers on main
    When the user opens the Charts drawer
    Then the projection chips are there, each showing its projection as before
    And they are no longer in the settings drawer under the rose; the rest of its Map section (continents, regions, the land border, colour, rivers, lakes, the scale bar) stays there, and no section goes

Feature: A drawer stays open on a click or a choice
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "I want to change the behavior on all drawer actions. This may reverse an earlier position I took, but it matters more now: do not immediately close the drawer on click/select but leave the drawer open. This is flexible for mobile and should perhaps be treated differently. I need to see a UI walk specifically for that at a later time." The earlier position, as recorded in [#206](https://github.com/mark-brannan/portolani/pull/206)'s body from the UI walk behind [#202](https://github.com/mark-brannan/portolani/pull/202) (paraphrase): "A choice, Esc or a click outside the row and the drawer also closes it."
  Scenario: a choice in a drawer on a wide screen
    Given any drawer open on a wide screen
    When the user clicks a button, a chip, a link or a checkbox inside it, or picks a place in it
    Then the drawer stays open and the map does what was asked behind it
    And the drawer closes only from its own button, another instrument's button, Esc or a click on the map
  Scenario: a choice in a bottom sheet on a phone (waiting on a UI walk)
    Given a drawer open as the bottom sheet, at 520 px and under
    When the user taps a choice inside it
    Then the sheet behaves as it does today, until the user has walked the phone's drawers and set this rule

Feature: A voyage's row in the Voyages drawer
  Source: the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "Clicking a new voyage button always zooms to that voyages target window."; "The first time any given voyage is selected after opening the drawer, if it was not previously selected, zoom to the window for that voyage and then animate the line from the start to the finish."; "Each voyage has a show/hide button to the right of it, before the color selector. The show hide always does a quick show/hide action for the line without changing the zoom or view."; "The voyages colors should not "jump" or reset when multiple voyages were selected and an earlier one is then de-selected. The colors in the current display should remain 'sticky' to the voyage they were already assigned to." This replaces the rule that a voyage put on stays where it is if any of its track is in view, and that a click on a shown voyage takes it off (`public/page.js` at `6960f78`).
  Scenario: the row
    Given the Voyages drawer open
    When the user looks at a voyage's row
    Then it reads, left to right: the voyage's name, a show/hide icon (the same eye as a chart's row), then its colour picker
  Scenario: the name flies; only the eye hides
    Given a voyage in the list
    When the user clicks its name
    Then the map flies to the view that frames the whole voyage, whether or not any of it was already in view
    And the voyage is shown if it was hidden
    And if this is the first time since the drawer opened that this voyage is shown, and it was not shown when the drawer opened, the line draws itself from the start of the voyage to its end once the flight lands
    When the user clicks its name again
    Then the map flies to the frame again, the line stays drawn whole, and nothing is hidden
    When the user clicks its eye
    Then the line shows at once, drawn whole, or hides; the view does not move
    And a voyage shown by its eye and then clicked by name in the same opening of the drawer flies but does not draw itself again
    And with reduced motion the line shows whole, no drawing
  Scenario: colours stay with their voyages
    Given three voyages shown, each in its own colour
    When the user hides the first of them
    Then the other two keep the colours they had
    When the user shows another voyage
    Then it takes the first colour of the palette that no shown voyage has, its own former colour first if that one is free
    And a reload of the link shows every voyage in the colour it had

Feature: Every point of interest has a mark
  Source: the user on [#257](https://github.com/mark-brannan/portolani/pull/257#discussion_r4407848703), 2026-10-29: "any of the cities that do not have a modern equivalent should get some kind of marker on them, on the map. We could use a decorative placeholder for now similar to other cities but I think in the long run it should be different. Use something like ruins or ...not sure. But for this iteration at least put a placeholder so we are not searching for 'Tyre' on the map when it is merely coordinates and there is nothing there to see."; and on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "for now at least just look at each POI and ensure it has a something. Even a plain "X""
  Scenario: a place with a tile and nothing drawn there
    Given a point of interest with a tile (a noteworthy port, an ancient city, a place where charts were made) and no town, sprite or mark drawn at its spot (Tyre today)
    When the map is at a zoom where its tile opens on a tap
    Then a stand-in mark is drawn at its spot, so the user sees where to tap, and no lettering beside it
    And a place that already has a town or a sprite drawn there gets no second mark
    And every place listed in the Sights drawer is checked, not only Tyre
  Scenario: the stand-in is a placeholder
    Given a city with no modern equivalent
    When its own mark is drawn later (ruins, or whatever the user picks)
    Then it replaces the stand-in for that place; until then the stand-in stays

Feature: The world turned to the chart (deferred)
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "A nice to have, not required for any of the charts would be to rotate the world to match the orientation of the chart, rather than the other way around. De La Cosa's map was originally meant to be read vertical, with the equator running up and down and the new world at the top. You can defer this or add it as a 'future' spec."
  Scenario: the map takes the chart's orientation
    Given a chart drawn to be read in another orientation (de la Cosa's, vertical, the New World at the top)
    When the user asks for the chart's own orientation
    Then the map turns under the sheet to match it, and the sheet stays as scanned
    And until this lands, the sheet turns and the map stays north-up
