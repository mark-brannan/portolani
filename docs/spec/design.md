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
  Source: docs/decisions.md 2026-10-21, "my preference is as a 'click' or 'tap' on mobile, then a little educational popover tile appears nearby the point of interest"; "a major landing, a death/confrontation, a location where maps were made, whatever we decide is a point of interest should get a tile with flavor text." ([#212](https://github.com/mark-brannan/portolani/pull/212#discussion_r4332019539)); where the tile sits, the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "Tiles popping over for POIs on the charts need to be offset so that they do not cover any part of the hit box.  Ideally there is a small margin between the hitbox of the point and the tile describing that point."
  Scenario: click or tap a point of interest
    Given the chart with a point of interest drawn (a voyage's skull, a landing, a place where maps were made)
    When the user looks at it without touching it
    Then no text is drawn beside the mark, as cities and regions have
    When the user clicks it, or taps it on a phone
    Then a small tile of flavour text opens near it
    And the tile sits clear of the point's hit box, covering no part of it, with a small margin between the two

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
    Source: the user in the session of 2026-11-04: "The resize and manually rotate button on the corners of the charts inside the main map should be removed and instead, dragging any map corner should rotate the map in place through it's allowed orientations (it is not a free form rotate) with the globe/main-map also rotating with it." This overtakes the turn and resize handles of the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292). Later, the user in the session of 2026-11-04, as relayed to the session that built it: the corner drag is "FREE rotation of the whole world/table, exactly like the compass drag"; "Double-clicking a corner ... turns to the nearest snap position"; "a rotate icon appears at a corner only on mouse-over of that corner". This overtakes the quarter-turn settle above.
    Given the sheet shown
    When the user drags inside it
    Then it slides up, down, left and right over the map, and the map does not pan
    When the user drags any of its four corners
    Then the sheet and the world turn together about the middle of the window, following the pointer, and stay at the angle where they are let go, as the compass's drag leaves them
    When the user double-clicks a corner
    Then the sheet and the world turn to the nearest of the chart's quarter turns ("Every chart turns, a quarter at a time", below)
    And no handle is drawn on the sheet: no turn ring, no resize square; the sheet is not resized by hand
    And while the pointer is over a corner, and only then, a small turn icon shows at that corner; it hides while the corner is dragged
    And the link keeps the placement and the bearing
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
  Scenario: comparing the pieces with the map (a slider wipe, a swipe)
    Given the pieces mode on, and a chart laid
    When the user picks Slider wipe or Swipe in Compare with the map, beside the pieces chip under Settings, Under the hood
    Then the pieces are drawn only left of a vertical line, at the slider's share of the map's width (`comparepos`, half by default), and the bare map shows right of it
    And in Slider wipe the slider moves the line; in Swipe the line itself, with a handle, is dragged across the map
    And Off (the default) draws the pieces over the whole map, and the controls show only in the pieces mode
    And the choice rides in the link as `compare=wipe` or `compare=swipe` and `comparepos=<0..1>`; the defaults write nothing

Feature: A chart's row in the Charts drawer
  Source: the user's brief on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29, and the follow-up the same day ("row shape: D", "I would like to use the full name for the chart link on our page: 'Map of Juan de la Cosa'"): "if the only button we need is to jump to the chart's default position and show it, then we really need no button beyond the name of the chart itself"; "put the originating city immediately to the right ... and use it as another button. In that case the button text is still 'Majorca' and no further explanation is needed"; "'Where it was made' is not helpful"; "all charts to have a miniature version of the scan for their icon". The second pass, later that day: "I do want to increase the size of the drawer thumbnails, by at least ~50%, accounting for more vertical space when the notes come in for these entries also. I would like all chart thumbnails for charts that we have to be the full color version all the time (if we have the chart in the project), no fade/gray when unselected. grey when chart not imported is still ok. I would like a show/hide icon (or button?) to the right of each chart name instead of clicking the chart. It might be a simple eye vs closed eye with slash in the usual style, or it might be an eye with an eye patch evocative of a pirate."; "clicking the origin city should hide the chart when zooming to the city, if the chart would result in the obstructing the city from view. Clicking either the map icon, or the map name should zoom to the correct position for the chart...but the show/hide button controls show/hide. The very first time any chart is selected after opening the drawer, when none was selected previously is to fade in the chart when clicking any of these: the chart icon, the chart name; however the show/hide is still a fast show action. Clicking the chart icon or chart name after the chart is already shown does not hide it, only the show/hide icon hides it." The icon and the eye, the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "I expect that the chart icon itself shows a chart and resets a chart to default position"; "I expect the show hide icon to ONLY show and hide individual charts.  It does not reset any, it does not clear others, it does [not] change zoom or position."; "Clicking a 'hide' does NOT change the show/hide status for any other charts.  Clicking a show does NOT change the show/hide status for any other charts."
  Scenario: the row
    Given the Charts drawer open
    When the user looks at a chart's row
    Then its icon is a miniature of that chart's own scan, not the drawer's chart glyph, at least half as big again as 64 by 44, with room below the name for the notes to come
    And a chart whose scan is in the project shows its miniature in full colour, shown or not: no fade, no grey
    And beside the icon the chart's full name as text ("Map of Juan de la Cosa"), and to the right of the name a show/hide icon (an eye and an eye struck through, or an eye with a pirate's patch)
    And under the name the city it was made in and its year, "Majorca, 1375", the city a link that flies to the city; no "where it was made" wording, no tooltip-only meaning
    And no other control sits in the row but its eye, its raise and lower arrows, its opacity slider, its Align to and up chips (below) and, for a chart whose sheet carries notes, its Notes chip ("A chart's notes get their moment", below; the user asked for it on 2026-10-29: "there should be a way to show/hide them or retrigger the animation"); the pieces mode and its opacity live under Settings, Under the hood
    And a chart without a scan yet shows the glyph greyed, its name flying to its sheet view as before
  Scenario: the icon or the name shows that chart alone; the eye is on or off for one chart
    Source: the click, the user on the [#295](https://github.com/mark-brannan/portolani/pull/295) demo, 2026-10-30: "when you just click the chart, it zooms to the chart and resets that one, clearing the others." This settles the walk's "possibly (TBC, not certain) clears other charts". Later, in the user's answers in the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "I am leaning more towards auto clear after seeing the voyages new behavior.  I'll entertain a clear button as an alternative but I thinjk it needs to autoclear or it just gets confusing and cluttered."
    Given a chart in the row, other charts' sheets shown or not, its own sheet moved, turned, snapped to another placement or hidden
    When the user clicks its icon or its name
    Then the sheet is shown, laid back at its default placement, and the map flies to the view that frames it
    And every other chart's sheet hides
    And if no chart was shown since the drawer opened, the sheet fades in
    When the user clicks the icon or the name again
    Then the same again: the placement reset, the frame flown to, the others hidden
    When the user clicks the show/hide icon
    Then the sheet shows at once, no fade, or hides if it was shown; nothing else in the row hides it
    And the eye is on or off for that chart alone: no other chart is shown or hidden, no placement is reset, no flight; the map's zoom, position and bearing stay where they are
    And the eye never plays the points of interest's rings or lights their marks; only the icon, the name and the row's own chips do
  Scenario: a new chart's icon or name clears the old one, then flies
    Source: the user in the session of 2026-11-04 (and later that day: "we have a brief skull animation flicker when selecting different charts by chip. That should not be the behavior now, it should only transition from one chart overlay to the next (clear, fly, overlay) without an extra animation."): "The charts button for show/hide should never change the zoom or the view. It only toggles chart overlays on/off. It does not trigger POI highlighting. This contrasts with clicking the chip for each chart, which focuses a particular position and zoom and overlays only that single chart with highlights for POIs. Immediately upon clicking a map chip the notes, buttons or other controls for that map should appear below it in the drawer, not waiting until after the overlay and animations are fully drawn."; "When clicking a new map chip, first the old one is cleared (As with the skull) effect, prior to 'flying' to the new position."
    Given one chart's sheet shown
    When the user clicks another chart's icon or name
    Then the shown sheet is cleared first, as the skull clears the table but with no skull flash or other animation of its own, and only then does the map fly to the new chart's frame, and the new sheet is laid: clear, fly, overlay
    And the new chart's row shows its Align to chips, its up chip and its Points of interest chip at once, on the click, not once the flight lands or the sheet has faded in
    And once it lands the new sheet alone lies on the map and its points of interest announce themselves
  Scenario: the user restacks the charts shown
    Source: the user in the session of 2026-11-04, as relayed to the session that built it: "Stacking order of shown charts can be changed without re-toggling."; "The transparency (opacity) sliders are per chart, not one setting shared by all charts."
    Given two charts' sheets shown or more
    When the user looks at a shown chart's row
    Then beside its eye are two small arrows, raise and lower, the raise dark on the top sheet and the lower dark on the bottom one; with one sheet shown there are none
    When the user clicks one
    Then that sheet swaps places with its neighbour in the stack, every sheet stays where it lies, and the link keeps the order
    And each shown chart's opacity slider fades that chart's sheet alone, kept in the link per chart
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

Feature: The Catalan Atlas, all eight pages, and the 1959 copy beside it
  Source: the user in the session of 2026-10-29: "I want all eight pages of the Catalan Atlas available on our charts page. Today we only show the first 1st page, which is the least interesting or useful of the bunch!"; of the 1959 copy on Wikimedia Commons, "El mar Mediterráneo en el Atlas catalán de Cresques Abraham" (CC BY 3.0): "Whatever the relationship, I think we should have it as an alternative in our charts and somehow available."
  Scenario: every map page of the atlas
    Given the Charts drawer open
    When the user looks for the Catalan Atlas
    Then all eight of its map pages are there to show, the Bibliothèque nationale de France's sheets 5 to 12, not the first alone
    And sheets 1 to 4, which are text, are not among them
  Scenario: the 1959 copy is an alternative
    Given the Charts drawer open
    When the user looks for the Catalan Atlas
    Then the 1959 copy is there too, as an alternative chart the user can show

Feature: A chart's position chips, and the line each was fitted to
  Source: the three lines, the user in the session of 2026-11-04, as relayed to the session that built it: "Every shown (visible, eye on) chart's controls appear in the drawer just under that chart's row"; "'Align to:' label followed by the placement chips on the same line"; the own placement "renamed 'Default'"; "the up chip, on a line of its own with no label. Every chart gets it". Earlier, the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "The chart snap buttons should not disappear, right now they disappear right away after clicking. They should be inside the drawer for the chart on desktop and they should indicate what they are for. Probably, "Chart Position: <a> <b> ..."", and "When clicking any of the given position buttons, it should animate the primary feature that was used for alignment/sizing/position as a simple line over the chart. Then the line should fade out. For example, "parallels" should animate/overlay the Equator and the Tropic of Cancer. New World should animate/overlay the portion of the South/Central American coast which is aligned with the chart at that orientation."
  Scenario: where the chips live
    Given the Charts drawer open on a wide screen, and a chart whose scan is in the project
    When the user looks at that chart's row
    Then under the city and year a line reads "Align to:" and then, on the same line, one chip per placement (the chart's own, "Parallels" or "Default", then each coast's fit: "Europe", "New World" and so on)
    And under it, on a line of its own with no label, the chart's up chip ("Every chart turns, a quarter at a time"), and under that, where the chart has any, its Points of interest chip
    And every chart shown has these three lines in its own row, the same on every chart, whichever of them are shown and in whatever order; a chart hidden has none
    And the chip for the placement the sheet lies at is lit
    And no chip floats on the map over the sheet
    When the user clicks a chip
    Then the chips stay where they are, the drawer stays open, and the lit chip moves to the one clicked
  Scenario: a chip shows what it was fitted to
    Given a chart's row with its position chips
    When the user clicks a chip
    Then the sheet is shown at that placement, and the map frames it as the chart's name does
    And over the sheet, in today's geography, the feature that placement was fitted to draws itself as a plain line, from one end to the other, holds, then fades to a faint line (about a quarter of its strength) that stays while the sheet lies at that placement
    And the faint line may lighten later to a ghost (about a tenth) or go entirely; the user chose faint for now, after comparing all three (the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "C for now, may lighten to B or A later", where C was faint, B ghost and A gone)
    And the faint line is the lit chip's: a click on another chip replaces it with that chip's line, drawn from the start; a click on the lit chip draws it again; hiding the chart with its eye takes the line off with the sheet; and as the sheet fades in or out, the line fades with it
    And "Parallels" draws today's equator and Tropic of Cancer; a coast's chip ("New World") draws only the stretch of today's coast that fit used, not the whole coast; the chart's own "Default" draws every coast it is centred between
    And the line is the feature the fit was computed from, carried with the placement in the chart's data, never a stretch drawn by hand to look right
    And with reduced motion the line shows whole, then fades to faint
  Scenario: one zoom per placement
    Source: the user on [#372](https://github.com/mark-brannan/portolani/pull/372), 2026-11-04: "Charts should always use a consistent, pre-set zoom level when clicking their alignment buttons. If the orientation happens to be diagonal, this may mean a closer zoom that will cut off the corners of the map, but it will be the same default zoom level for a perfectly level orientation."
    Given a chart's row with its Align to chips
    When the user clicks a chip, at any turn of the world
    Then the map zooms to the same level every time for that placement, whatever the world's turn: the zoom that frames the sheet whole, with a little clear round it, when it stands level on the window as the chart is drawn (de la Cosa west up)
    And a sheet that lies on a slant gets that same zoom, so its corners may run off the window, never a wider view to fit them in

  Scenario: a phone
    Given the Charts drawer open as the bottom sheet, at 520 px and under
    When the user looks for the position chips
    Then they sit in the chart's row as on a wide screen, wrapping onto lines of their own
    And the unlit chips are solid and dark enough to read as buttons on the parchment, and the lit one wears the accent ring

Feature: The projection chips live in the Charts drawer and the settings drawer
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "The controls for map projections should live under charts now, not the compass rose. I'm not sure about other map settings...they probably stay under the rose but it could change."
  Scenario: the user looks for the projection
    Given the drawers on main
    When the user opens the Charts drawer
    Then the projection chips are there, each showing its projection as before, in a Projection section after the charts, at the foot of the drawer
    And they are also still in the settings drawer under the rose; the two sets are one setting, so a choice in either lights the same chip in both

Feature: A drawer stays open on a click or a choice
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "I want to change the behavior on all drawer actions. This may reverse an earlier position I took, but it matters more now: do not immediately close the drawer on click/select but leave the drawer open. This is flexible for mobile and should perhaps be treated differently. I need to see a UI walk specifically for that at a later time." The earlier position, as recorded in [#206](https://github.com/mark-brannan/portolani/pull/206)'s body from the UI walk behind [#202](https://github.com/mark-brannan/portolani/pull/202) (paraphrase): "A choice, Esc or a click outside the row and the drawer also closes it."
  Scenario: a choice in a drawer on a wide screen
    Given any drawer open on a wide screen
    When the user clicks a button, a chip, a link or a checkbox inside it, or picks a place in it
    Then the drawer stays open and the map does what was asked behind it
    And the drawer closes only from its own button, another instrument's button, Esc or a click on the map
  Scenario: a choice, or a tap on the map, with a bottom sheet open on a phone
    Source: the user, 2026-10-30: "phone drawers stay open… Later decision is for them to stay open. It reverses my earlier decision." This reverses the shut-on-tap of [#262](https://github.com/mark-brannan/portolani/pull/262).
    Given a drawer open as the bottom sheet, at 520 px and under
    When the user taps a button, a chip, a link or a checkbox inside it, picks a place in it, or taps the map
    Then the sheet stays open and the map does what was asked behind it
    And the sheet closes only from its own button, another instrument's button or Esc; a tap on the map does not close it

Feature: A voyage's row in the Voyages drawer
  Source: the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "Clicking a new voyage button always zooms to that voyages target window."; "The first time any given voyage is selected after opening the drawer, if it was not previously selected, zoom to the window for that voyage and then animate the line from the start to the finish."; "Each voyage has a show/hide button to the right of it, before the color selector. The show hide always does a quick show/hide action for the line without changing the zoom or view."; "The voyages colors should not "jump" or reset when multiple voyages were selected and an earlier one is then de-selected. The colors in the current display should remain 'sticky' to the voyage they were already assigned to." The pace of the first draw, after comparing three: "A but faster, maybe 1s +/- .5s." (A: an even pace along the line; B: the voyage's dates) This replaces the rule that a voyage put on stays where it is if any of its track is in view, and that a click on a shown voyage takes it off (`public/page.js` at `6960f78`).
  Scenario: the row
    Given the Voyages drawer open
    When the user looks at a voyage's row
    Then it reads, left to right: the voyage's name, a show/hide icon (the same eye as a chart's row), a play button, then its colour picker
  Scenario: the name shows that voyage alone and draws it; the eye is on or off for one voyage
    Source: the user on the [#295](https://github.com/mark-brannan/portolani/pull/295) demo, 2026-10-30: "When you just click the voyage, it resets to that voyage view and redoes the animation, clearing the others.  The show/hide buttons on the other hand, work with no animations and are on/off for individual voyages."; the pace: "The voyage travel does move too fast.  Let's try 2.5s default but I want a slider from 1s to 5s (on the voyages page) so we can play with it and fine tune." These overtake the draw on the first showing only, and its pace of about a second.
    Given a voyage in the list, other voyages shown or not
    When the user clicks its name
    Then the map flies to the view that frames the whole voyage, whether or not any of it was already in view
    And every other voyage hides, and this one is shown
    And once the flight lands the line draws itself from the start of the voyage to its end, at an even pace along the line, in the slider's time whatever the voyage's length
    When the user clicks its name again
    Then the same again: the frame flown to, the line drawn from the start, the others hidden
    When the user clicks its eye
    Then the line shows at once, drawn whole, or hides: no drawing, no flight, and no other voyage shown or hidden
    And with reduced motion the line shows whole, no drawing
  Scenario: a slider sets how long the line takes to draw
    Given the Voyages drawer open
    When the user looks for the draw's pace
    Then a slider in the drawer sets it from 1 to 5 seconds, at 2.5 seconds by default, to try
  Scenario: the play button sails the voyage on its own calendar (may land after the rest of this Feature)
    Source: the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29, after comparing three paces drawn from Magellan's dates: "I want to add scope and put a play button (or maybe other play-style controls) next to each voyage that do the B variant." (B: the voyage's dates, true.)
    Given a voyage whose legs carry their dates
    When the user clicks its play button
    Then the map flies to the voyage's frame if it is not in view, and the line draws itself again from the start, on the voyage's own calendar: the pen runs across open water and sits still through every wait (Magellan's winter at San Julián, the months at Tidore)
    And the date the pen has reached, and the leg it is on, show as it goes
    And the landings, deaths and fights appear as the pen reaches their dates
    And the whole voyage takes some seconds (Magellan's 1,082 days, about nine), however long it was
    And other play-style controls (pause, a scrubber) may join the play button; which ones is open
    And every leg of every voyage needs a start and an end date as data for this; today a leg's dates are free text, often a month at one end ("Nov – 29 Nov 1519")
  Scenario: colours stay with their voyages
    Given three voyages shown, each in its own colour
    When the user hides the first of them
    Then the other two keep the colours they had
    When the user shows another voyage
    Then it takes the first colour of the palette that no shown voyage has, its own former colour first if that one is free
    And a reload of the link shows every voyage in the colour it had
    And how choosing a colour behaves waits on the user (the user on the [#295](https://github.com/mark-brannan/portolani/pull/295) demo, 2026-10-30): "The behavior for color selection is still strange and I'm not sure what I want for that."
  Scenario: the people drawer and the voyages
    Source: the user on the [#295](https://github.com/mark-brannan/portolani/pull/295) demo, 2026-10-30: "I'm also not sure how I want the interplay between the people drawer and the voyages drawer to behave.  They should have a relationship though...and as I hinted earlier, I think I want the voyages of ancient people *Groups* such as the Lapita to be included as a group alongside the people in the people drawer.  Individuals and groups can both be represented alongside one another in that framing."; and the user on [#304](https://github.com/mark-brannan/portolani/pull/304)'s timeline, 2026-11-04, quoted under "People and voyages, each a vertical timeline" below.
    Given the people drawer and the Voyages drawer
    When the user moves between them
    Then each is its own vertical timeline of the same years and eras: every voyage is in the Voyages drawer; a person's voyages live in their tile in the People drawer, directly under their row; and a people such as the Lapita is listed beside the individuals, with their migration as their voyage ("People and voyages, each a vertical timeline", below)

Feature: A dashed or dotted voyage is easy to see
  Source: the user on [#273](https://github.com/mark-brannan/portolani/pull/273), 2026-10-29, looking at the Narváez and Esteban renders: "The dashed legs are hard to see. Why are we using dashes? Same for dots but even worse than dashes. Hard to see!"; "The dots are a no-go though...you have to find something much better"; "part of the problem is the line and part of the problem is the default color palette. You're using grays and reds and they just blend in too much. Blue is no, because it would be confusing with rivers. Green might work. Purple. A brigher red maybe or yellow/orange. The red...idk, it's nice for the aesthetics but if you are using a dash or a dot, you've got to use a better color and heavier weights"; and, after comparing Heavy with Standard in green and purple: "heavy should be our default. ... IT is supposed to be configurable colors and weights anyway...and the colors are supposed to be sticky to one voyage while it is enabled, even if others are selected and deselected. So let's just make sure that when it is any voyage being toggled on where the lines are dashed/dotted that we pick from the higher contrast palette and with heavier weights, by default."
  Scenario: the default weight
    Given a link with no line weight in it
    When any voyage is shown
    Then its line is drawn at Heavy, the heaviest weight in the Voyages drawer
    And a weight the user picks in the drawer, or a link's `voyagewidth=`, still wins
  Scenario: a voyage with dashed or dotted legs takes a high-contrast colour
    Given a voyage with at least one dashed or dotted leg, and no colour picked for it
    When the user shows it
    Then it takes the first colour of the high-contrast palette that no shown voyage has: a green, a purple, a brighter red, an orange or yellow
    And never a blue, which reads as a river, and never a grey, a brown or the chart's muted red, which sink into the parchment and the coast
    And the colour stays with it while it is shown, however other voyages are shown and hidden, as for every voyage
    And a colour the user picks for it still wins
  Scenario: a dashed or dotted leg is never thin
    Given a voyage with a dashed or dotted leg
    When it is drawn at the default weight
    Then each dash and each dot reads on its own at map size, against the parchment, the coast and the chart's rhumb lines, with no zoom
    And a dashed or dotted leg is drawn no lighter than a solid leg of the same voyage
    And what a dash or a dot stands for, and whether dots stay or give way to something else, is open; this holds for any leg drawn broken

Feature: Every point of interest has a mark
  Source: the user on [#257](https://github.com/mark-brannan/portolani/pull/257#discussion_r4407848703), 2026-10-29: "any of the cities that do not have a modern equivalent should get some kind of marker on them, on the map. We could use a decorative placeholder for now similar to other cities but I think in the long run it should be different. Use something like ruins or ...not sure. But for this iteration at least put a placeholder so we are not searching for 'Tyre' on the map when it is merely coordinates and there is nothing there to see."; and on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "for now at least just look at each POI and ensure it has a something. Even a plain "X""
  Scenario: a place with a tile and nothing drawn there
    Given a point of interest with a tile (a noteworthy port, an ancient city, a place where charts were made) and no town, sprite or mark drawn at its spot (Tyre today)
    When the map is at a zoom where its tile opens on a tap
    Then a stand-in mark is drawn at its spot, so the user sees where to tap, and no lettering beside it: the ruin glyph below, or the plain town glyph where a place is no ruin
    And a place that already has a town or a sprite drawn there gets no second mark, except the ruin of an ancient site where there is room beside the town (next scenario)
    And every place listed in the Sights drawer is checked, not only Tyre
  Scenario: an ancient site is a ruin unless the map draws a city over it
    Source: the user on [#310](https://github.com/mark-brannan/portolani/pull/310), 2026-10-30, in paraphrase: Tyre must show a ruin, on or near the old island port. A town standing there today is not reason enough to drop it; only dense built-up ground over the whole site is. Use what the map already draws as the test: where a small town is not drawn at a wide zoom, show the ruin, not a tower added for it; where the map does draw a city on the site, the ruin can give way at that zoom. Close up, it depends on the room between the two marks.
    Given a point of interest that was an ancient or medieval city or port (Tyre, Carthage, Berenike)
    When its mark is drawn at any zoom
    Then it is a small ink glyph of a broken colonnade: three columns on a step, two of them snapped short, about the height of a town glyph
    And it is drawn in code, in ink, like the towers, not cut from a scan
    And a town of today on or near the site does not suppress it: Sour beside Tyre, a suburb of Tunis on Carthage
    And the ruin is suppressed only where the map itself draws a city over the site at that zoom, its built-up ground or its town mark; the map never adds a town glyph just to stand for a living town it does not otherwise draw
    And close up, the ruin stands beside a drawn town where there is room for both marks, and gives way where there is not
    And where part of the site is open ground with standing remains, the ruin goes there: Tyre's on the old island, Alexandria's on the Pharos point, Malacca's on St Paul's Hill
    And a place that is no ruin keeps the plain town glyph where nothing else is drawn: a city founded later and covered by it throughout (Manila, Batavia), or a building still standing (São Jorge da Mina)
    And a place's own decoration, link or image laid on later replaces its glyph

Feature: The world turned to the chart (deferred)
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "A nice to have, not required for any of the charts would be to rotate the world to match the orientation of the chart, rather than the other way around. De La Cosa's map was originally meant to be read vertical, with the equator running up and down and the new world at the top. You can defer this or add it as a 'future' spec."; and in a decision sitting, 2026-10-29: "some of the charts I want to see in their original drawn orientation which would NOT be "north up" (E.g. De La Cosa is "west up" and the equator running up and down vertically)"
  Scenario: the map takes the chart's orientation
    Given a chart drawn to be read in another orientation (de la Cosa's, vertical, the New World at the top)
    When the user asks for the chart's own orientation
    Then the map turns under the sheet to match it, and the sheet stays as scanned
    And until this lands, the sheet turns and the map stays north-up
  Scenario: the world never stays turned once the chart is gone
    Given the world turned to a chart's own orientation
    When the user takes that chart's sheet off the map, or flies to another chart or a place the sheet covers
    Then the world turns back to north up, and the flight that follows lands north up
    And whatever the world's bearing, the compass in the gutter turns it back to north up on a click, with or without a sheet shown

Feature: A chart with no up turns for the reader
  Source: the user in the session of 2026-10-29: "we said earlier that the De La Cosa chart was equator up and down vertical and we wanted a mode to see the chart laid vertical and the world rotated to match. This is somewhat similar with the Catalan Atlas except it has no explicit 'up' or down... rather it is meant to be laid flat on a table and the viewer could walk all around it. So we might want to spin it around for different POIs or play with the UI controls to emphasize that fact. Many of the drawings will be upside down if we pick only one fixed orientation."
  Scenario: the reader walks round the table
    Given a page of the Catalan Atlas shown, the world turned to match it as in "The world turned to the chart"
    When the user turns to a point of interest whose figure is drawn facing another edge of the page
    Then the chart spins round, the world with it, until that figure reads upright: spun for that point of interest, or by the user at the controls; which of the two, or both, is open
    And no one fixed orientation is the chart's own, since any one leaves many of its drawings upside down

Feature: Every chart turns, a quarter at a time
  Source: the user in the session of 2026-11-04: "The chart for de la Cosa has a 'west up' button. I want to keep this, but the behavior is inconsistent right now. All maps should have a function to view different sides 'up', alternatively it can be a 'rotate' button that does 90 degrees....in fact I want to see that at minimum with a "walk around" curved button in either direction that effectively rotates everything around the current position."; "We have dead buttons for angle and size in the drawer for several maps."
  Scenario: the walk-around buttons
    Source: the user in the session of 2026-11-04, as relayed to the session that built it: "Move the walk-around quarter-turn buttons ... out of the drawer to sit beside the compass"; "They are always available and rotate the entire view, with or without a chart."
    Given the map, with or without a chart's sheet shown
    When the user looks at the right gutter
    Then either side of the compass is a curved-arrow button, one each way round, always shown, and the compass is always shown with them
    When the user clicks one with a sheet shown
    Then the world and every sheet on it turn about the middle of the window, that way round, to the top sheet's next quarter turn (its own up and the three quarters from it): the place in the middle stays in the middle, the zoom stays, the sheet keeps its place on the world
    When the user clicks one with no sheet shown
    Then the world turns that way round to the next of north, east, south and west up
    And from one of those quarter turns, four clicks the same way come back to where they began
  Scenario: the compass over the skull on a wide screen; a twist on a phone
    Source: the user, 2026-11-06: "On mobile the compass icon on the lower ride size is not draggable, and the two rotate buttons are removed. For mobile, the usual 2 finger pinch and twist gesture for rotating maps is used to rotate the map orientation only. On desktop the compass is larger, the same diameter as the skull, and appears directly over the skull at the far right, while the two 90 degree rotate buttons appear to the left of the compass and are slightly smaller." This overtakes "either side of the compass" and "always shown" above for both screens.
    Given a wide screen
    When the user looks at the right gutter's foot
    Then the compass stands directly above the skull at the far right, the skull's diameter, and the two walk-around buttons stand side by side to its left, a little smaller
    And the compass still turns the world under a drag, and a click on it turned still sets north up
    Given a phone
    When the user looks at the lower right
    Then the compass is there to read and to tap for north up, and does not turn under a drag; there are no walk-around buttons
    When the user twists two fingers on the map
    Then the world, and every sheet on it, turns with them about their midpoint as the pinch zooms, the way a phone's maps turn; the turn is the map's alone, never a card's
  Scenario: the chart's own up
    Given any chart shown, drawn to be read another way up (de la Cosa's west up) or north up (every chart with no other up)
    When the user looks at its row
    Then its up chip ("West up", "North up") is there on a line of its own, and lit exactly while the world stands at that chart's up, however the user got there: the up chip, the walk-around buttons, a corner drag, the compass or a two-finger twist on a phone
    When the user clicks the up chip unlit
    Then the world turns to the chart's up, framing the sheet as it will stand
    When the user clicks it lit
    Then the world turns back to north up, where the map is
  Scenario: no dead controls in the row
    Given any chart's row
    When the user looks at its chips
    Then every chip in it does something when clicked; there are no Angle or Size chips, since the sheet is turned only with the world and never resized by hand

Feature: The voyage record: people, deaths and what a skull means
  Source: the user on [#275](https://github.com/mark-brannan/portolani/pull/275), 2026-10-29: "the death date and place is either known or unknown. No statement about living = true is necessary (or correct). In fact, nothing should be required at all for the person record besides, perhaps, a name or ID (even a name might be omitted if we wanted to have certain anonymous persons in the project where other details were known but NOT the name). Use a permissive approach and make no assumptions about what is required, or what is present unless strictly required."; "People with a known death location get a skull. Full stop."; "Voyages should have a name or title that we work from, and it will *usually* include the name of the leader (or a singular leader) but there will be a "has" relationship for people and voyages...we could separately have a "leader" relationship but it will get complicated for voyages like Magellan's (maybe Drakes?) where he died before the end and someone else took over leading the remainder."; and in the session that rebuilt the record, 2026-10-29: "we might include a few modern recreation voyages of living people who attempted to recreate polynesian voyages using traditional methods"; "We have some error bars on exact location of death but have chosen to make reasonable judgements about the location. For example, if we know the sea leg where a death took place, we just mark it in the middle of the voyage. ... We have some death locations that might be speculative as well....or deaths that we chose to place in the middle of the ocean in a 'close enough' location on a wide patch of empty sea". The files are `data/voyages/`: a voyage in `<id>.json`, the people in `people.json`, the sources in `sources.json`; `scripts/voyages.mjs` is the schema and `node scripts/check-voyages.mjs` the check.
  Tested by: `node scripts/check-voyages.mjs` and `test/voyages.test.mjs`, which run every record of `people.json` and every voyage through the schema
  Scenario: nothing in a person's record is required
    Given a person in `people.json`
    When the record holds only a name, or only a death, or only a sentence about an unnamed crew, or nothing at all
    Then the check passes: each field is checked for its shape only when it is there
    And no field says whether the person is living; a person with no death recorded is simply a person with no death recorded, a sailor of a modern recreation voyage as much as a Phoenician nobody named
  Scenario: a skull stands where the death record has a place
    Given a person whose `death` has `lon` and `lat`
    When a voyage that names them is shown
    Then a skull and crossbones stands at that place, on the track or off it
    And the coordinates are where the mark stands, not a claim that the place is exact: the record's `confidence` says how it is known (`attested`: recorded; `inferred`: worked out from the sources; `conventional`: the middle of the leg the death happened on, or a 'close enough' spot on an empty patch of sea, as the voyages README has always said; `speculative`: one guess among several), and `alternatives` beside it are the other places
    And a `death` with a date and a sentence but no `lon` and `lat` draws nothing: nobody knows where, and the record says what is known without a mark; the word "unknown" is not a value
  Scenario: one word for how sure, wherever a thing is placed
    Source: the user, 2026-10-29, as relayed by session 71b0f0dc: a confidence level is one word, attested, inferred, conventional or speculative, and it applies to legs, events, births and deaths; the word sets the ink, and reaches the reader as a fixed phrase in the tile: attested "on record", inferred "reckoned from the record", conventional "the usual account", speculative "a guess"; one optional `doubt` sentence may ride with it on all four kinds, used only where a source disputes the fact, a gap in precision staying in `text`; Elcano's evidence is highly reliable, and doubting it was hedging; the record is for amusement and education with a high bar for both, to inform, increase interest and spark curiosity, so hedging is counterproductive: evocative stories and best-effort facts, not scholarship, and `doubt` is written as a hook into a live dispute (Esteban may have lived on among the Zuni; Korčula claims Marco Polo), never as a disclaimer.
    Given a leg, an event on a voyage, a birth or a death
    When the record says how well its place or course is known
    Then it says so in `confidence`, one word from one list for all four: `attested` (a source records it), `inferred` (the ends known, the way or the place worked out from the sources), `conventional` (the way scholars usually draw it, or the editorial convention: the middle of the leg, a 'close enough' patch of sea), `speculative` (may not have happened, or one guess among several); the first three are the user's strokes of 2026-10-20 (solid, dashed, dotted), the fourth is [#278](https://github.com/mark-brannan/portolani/pull/278)'s
    And the word sets the ink, and reaches the reader in the tile as its fixed phrase: `attested` "on record", `inferred` "reckoned from the record", `conventional` "the usual account", `speculative` "a guess"
    And `doubt` beside it is one optional sentence, on any of the four kinds, only where a source disputes the fact: a hook into the dispute, never a disclaimer; a gap in precision (a year only, a place nobody wrote down) stays in `text`
    And later, a tile rule for a later PR than the one that brought the phrases into the record: a doubt on any of the four kinds shows in its tile under the heading "Scholars doubt this part:", after the confidence phrase
  Scenario: a voyage has its people; the title names the voyage
    Given a voyage record
    When it names the people who were on it
    Then `who` lists them in order of prominence, the one the title is named for first, and every one of them has a record in `people.json`
    And there is no leader field: who led, and who took over when the leader died, is the voyage's story, told in its summary and events
    And a person's voyages are read off the voyages that name them, never kept as a second list on the person
  Scenario: a person is keyed by a slug, not by the spelling of a name
    Source: the user in the session that rebuilt the record, 2026-10-29: "slug, yes"; "role replaced with bio, yes"
    Given a person in `people.json`
    When a voyage names them, a link carries them, or a death is joined to a voyage
    Then the key is a lower-case slug (`ferdinand-magellan`), the one identifier a person has; `name` is a field, `aka` the other spellings
    And a person's pictures are `images`, each a Wikimedia Commons file with its kind, author, date and licence, and the person's `bio` is one paragraph of prose: no `role` or `origin` lists, which were a taxonomy with no vocabulary
    And the same marker shape (place, date, label, text, source, cite, confidence, alternatives) serves a voyage's events and a person's birth and death; a `places.json` for the places written more than once, and one Commons-image shape shared with the charts, are the direction, not yet the record

Feature: A laid sheet and what the user flies to next
  Source: the user in the session that captured these requirements for [#274](https://github.com/mark-brannan/portolani/pull/274), 2026-10-29: "Similar to how we did for chart origin cities, after showing a chart, and then zooming to other items such as a voyage route, POI, port, etc. it should hide the chart again so that it is not covering the items we want to see. The alternative for voyages would be to try and draw the voyages line over the charts (regardless of placement?) and that is a nice to have (it might be easy to code and similar to how we do the coastline animation)"; asked which: "Try Draw voyages over as the default, but let me also try a UX option for the recommended. I need to see both and play with it." Today the sheet is painted after the voyages (`scripts/scene.mjs` drawScene, step 9.1 after step 8), so a voyage under a sheet is hidden by it.
  Scenario: a voyage rides over the sheet (the default to try first)
    Given a chart's sheet shown
    When the user shows a voyage, by its name or its eye
    Then the voyage is drawn over the sheet, wherever the sheet lies, in its own colour at its own weight, and the sheet stays shown
    And the line reads against the scan as it reads against the parchment: a voyage with no colour picked takes a colour from the high-contrast palette while any of it crosses a sheet
  Scenario: the sheet clears the way instead (a setting, to compare)
    Given a chart's sheet shown and the setting "Sheet hides for a voyage" on (under Settings, Under the hood, beside the pieces mode)
    When the user clicks a voyage's name and the map flies to its frame
    Then if the sheet would cover any of that frame, the sheet hides as it does for the chart's city, and its eye shows it hidden
    And the eye, or the chart's name or icon, brings it back
    And both behaviours are built so the user can switch between them on the live page; which stays, and whether the other goes, is the user's call after playing with both
  Scenario: a point of interest or a port clears the way
    Given a chart's sheet shown
    When the user clicks a sight, a port, an anchorage or Go, and the map flies there
    Then if the sheet would cover the place in that view, the sheet hides, and its eye shows it hidden, as for the chart's city
    And a fly that lands clear of the sheet leaves it shown

Feature: A chart's notes get their moment, then leave the art alone
  Source: the user in the session that captured these requirements for [#274](https://github.com/mark-brannan/portolani/pull/274), 2026-10-29: "Previously I asked that when opening chart that we hid the poi indications for that chart. However, it is still hard to find them and the change from 'grab hand' to 'pointing finger' is too subtle of a change to find the points of interest. Instead I want to see animated POI point indications when the chart first pops up, that then fade out and disappear. As an alternative we could have a 'show/hide' specifically for a charts points of interest."; and, shown a pulse and a toggle: "Both, but the dots fade to nothing. I need to see that first and see if it is too subtle. The problem is that we don't want the dots covering the art all of the time. The art should get it's moment to shine. If we need the dots for locating information, then there should be a way to show/hide them or retrigger the animation but not automatically mar the surface of the chart with their blemishes."
  Scenario: the notes announce themselves as the sheet arrives
    Given a chart whose sheet carries notes
    When the sheet fades in, or the user clicks the chart's name or icon with the sheet already shown
    Then a ring swells out from every note's spot and fades, three times over about four seconds, and the marks fade to nothing with the last ring
    And nothing stays drawn on the scan afterwards: no dot, no ring, no mark
    And a click or tap where a note was still opens its tile, and the cursor still changes over it
    And with reduced motion the marks show whole for the same time, then fade
  Scenario: the user asks for the notes back
    Given a chart's sheet shown, its notes faded
    When the user looks at the chart's row
    Then a chip on its own line under the up chip reads "Points of interest" with N, their count, in a red dot in the serif's own figures, off after the pulse
    And the chart's own note, its background, is the caption in its row, apart from the points of interest each with its own tile
    And a click on the chip shows the marks and keeps them until it is clicked again, playing the rings as they come on; Go's own compass plays them again, so the row has no second control for it
    Source: the one chip, the user in the session of 2026-11-04, as relayed to the session that built it: "Remove the duplicate compass 'play the rings again' chip from chart rows ... The Go button already does that."
    And the marks are never left on by default; the scan is the thing, the marks are a way to find what is on it
  Scenario: the user sees it first
    Given the pulse built as above
    When the PR that builds it hands over
    Then its body shows the pulse as a short recording or a strip of frames at map size, and the user says whether it reads or is too subtle before the timing is settled

Feature: The Catalan Atlas's figures are its points of interest
  Source: the user in the session of 2026-10-29: "the large illustrations from the Atlas are all POIs after their fashion. Many of them represent people (rulers) of the region at that time."; "In a separate UX decisions session I said I didn't like the original points on the world chart because they were too subtle and hard to find... this is different on the Catalan Atlas where the POIs are massive areas covered by larger-than-life rulers, elephants, palm trees, etc."
  Scenario: a figure is a point of interest
    Given a page of the Catalan Atlas shown on the map
    When the user clicks or taps one of its large figures (a ruler, an elephant, a palm tree)
    Then that figure's tile opens: every large illustration on the page is a point of interest
    And the place to click is the figure itself, the whole area it covers, not a small spot inside it
  Scenario: a ruler is a person too
    Given Mansa Musa, enthroned on sheet 6
    When the user clicks or taps his figure
    Then his tile opens as any figure's does
    And the same figure is his portrait in the people drawer

Feature: Points of interest close together
  Source: the user in the session that captured these requirements for [#274](https://github.com/mark-brannan/portolani/pull/274), 2026-10-29: "There are similar problems as the too-subtle change between grab hand and pointer finger when we have POIs very close to one another. ... a good example is Magellan's death at Mactan being very close to the Massacre at Cebu....there's no indication that more than one POI exists here. Either you accidentally see the tile for the massacre when trying to hover over the X for Magellan's death and are surprised...or you see Magellan's death there at Mactan and think there is no more to the story." The pick, from three drawn: "A: count badge".
  Scenario: a badge says how many
    Given two or more points of interest whose marks lie within a tap's reach of each other at the current zoom (Mactan, 27 Apr 1521, and Cebu, 1 May 1521, at the zoom that frames Magellan's voyage)
    When they are drawn
    Then the mark nearest the group's centre carries a small badge with the count, in the chart's red, and the others draw as they do today
    And the badge goes when the zoom separates the marks by more than a tap's reach
  Scenario: one tap, every story
    Given a badged mark
    When the user clicks or taps it, or any mark of its group
    Then one tile opens, headed by the count and the span of their dates ("2 here · Apr–May 1521"), and lists each story as a line: its mark glyph, its title, its date
    And a click on a line opens that story's tile in the same place, with a way back to the list
    And a group of one is today's tile, unchanged

Feature: A point of interest is big to hit, and none is left out
  Source: the user in the session of 2026-10-29, for every chart's points of interest: "big hit box layout for the POI, as big as is reasonable"; "Dense clickable area. We need the inner area of the map to mostly be point/clickable rather than grab/drag-able."; "exhaustive labeling. I would rather see labels and placeholders for every little tree and item on any given chart that we might add a note for, than to leave it out because we could not think of the copy/text for it and deferred it forever. If it could be a POI, bias for inclusion with placeholder or empty text (e.g. 'palm trees') and we'll take it out only if I later deem it useless on a later UI walk."
  Scenario: the hit box
    Given any chart's sheet shown, with its points of interest
    When the user moves the pointer over it, or taps it on a phone
    Then each point of interest answers over as big an area round what it marks as is reasonable, not a dot at its centre
    And over the inner area of the map the pointer is mostly the pointing finger, a click there opening a point of interest, and only the rest is the grab hand that drags
  Scenario: every item that could take a note has one
    Given any chart in the project
    When its points of interest are listed
    Then every figure and item on it that a note could be written for is among them, down to every little tree
    And one with no copy yet is there all the same, its label or placeholder naming what it shows ("palm trees"), its text a placeholder or empty
    And one goes only when the user, on a later UI walk, finds it useless

Feature: A grouped list in a drawer opens one group at a time
  Source: the user in the session that captured these requirements for [#274](https://github.com/mark-brannan/portolani/pull/274), 2026-10-29: "Sections for the famous ports should open one at a time with an animated slide instead of the open/closed triangle."; asked whether the anchorages list too: "All such lists, probably. We're going to have a similar problem (I think) for all of these as we add content: charts (expanding to other cultures and non-portolan style charts), voyages, ports/anchorages/POIs (And these may be reorganized or subdivided again anyway...I'm not sure which menus I really want to organize them under)". Today the Sights and anchorages lists are `details` elements with a disclosure triangle, any number open at once (`public/page.js`, the `SIGHTS` and `ANCHORAGES` groups).
  Scenario: the groups
    Given any drawer list arranged in groups (the Sights eras, the anchor's regions and seas, and the charts and voyages once they are grouped)
    When the user looks at it
    Then each group is a heading row with no triangle; the heading carries what the group holds (its count, and its span of years where the group is an era)
    And at most one group is open; the one the list opens with is the group the data marks open, else the first
  Scenario: the slide
    Source: the open heading, the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "Clicking the section headings that divide up groups in the drawers should close a section if it was already open, so that we can move between them more quickly if searching." This overtakes "a click on the open group's heading does nothing".
    Given one group open
    When the user clicks a closed group's heading
    Then the open group slides shut and the clicked one slides open together, in about a quarter of a second, and the list does not jump
    When the user clicks the open group's heading
    Then it slides shut, and the list is left with no group open
    When no group is open and the user clicks a heading
    Then that group slides open
    And with reduced motion the groups swap, open or shut, with no slide
  Scenario: a group opens as the pointer nears it (waiting on the user, UI walk 2026-10-30)
    Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "alternatively, an animation effect and mousing over the next section would be a nice experience so that the sections automatically show their contents when you get close to the next section.  This will differ between mobile and desktop."
    Given a grouped list in a drawer
    When the pointer nears a closed group's heading
    Then whether it opens on its own, and how a phone differs from a wide screen, is open until the user has seen it demoed both ways (the user's answers in the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "Hover - I want to see it demoed both ways before I say I'll agree.")
    And hover sits beside the click that shuts the open group, not in its place: "Click to close the drawer does not conflict with hover to change sections though...those are entirely different and complementary."
  Scenario: the groups are the content's, not the control's
    Given the lists grow and are reorganised, as the user expects
    When a group is added, split or moved to another drawer
    Then the one-open rule and the slide follow it with no new code: the behaviour belongs to the grouped list, not to the Sights drawer

Feature: The atlas's own names over the regions (to explore)
  Source: the user in the session of 2026-10-29: "A card for future UX exploration would be to have the terms and the language of this atlas overlaid for the regions, as an alternative to what we use now. In other words the main map (instead of current countries or cities) would show 'Golden Horde', 'Mali Empire', 'Il-Khanate', etc."; later: "That's quite different than what we do now, but of historical and educational interest. So we want to explore that or some way to make it happen."
  Scenario: the main map in the atlas's terms
    Given the main map, with its names of today's countries and cities
    When the user asks for the atlas's names instead
    Then the regions read in the terms and the language of the Catalan Atlas: "Golden Horde", "Mali Empire", "Il-Khanate"
    And today's names stay the default, the period names an alternative to them
    And how it is offered is open: the user asked for it to be explored

Feature: A flight keeps the eye on the ground
  Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: ""flying" needs to be slower when zooming across the map, and fly roughly to the correct lat/lon before zooming in.  Zooming before flying close to the position is dizzying and causes the viewer to loose the visual sense of position."; "When already zoomed in close, and then flying to a far distant location by click...we should zoom out first to a suitable distance and then back in.  The zoom out should be based roughly on the distance between the two points.  IT is not needed to zoom out if the points are very very close to together, for example on the same screen or just at the edge of the screen."
  Scenario: over first, then down
    Given the map at any view
    When the user clicks something that flies the map (a sight, an anchorage, a chart, a voyage, a person, Go)
    Then a flight across the map is slower than the 600 ms flight of the walk; how much slower is open
    And the map reaches roughly the place's longitude and latitude before it zooms in, never zooming in on the way
  Scenario: a far place from a close zoom
    Given the map zoomed in close
    When the user flies to a place far off
    Then the map zooms out first, by roughly as much as the distance between the two places asks, then zooms back in on the place
    And a place on the same screen, or just past its edge, is flown to with no zoom out

Feature: Go reads a position however it is written
  Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "Position should accept coordinates in other formats besides decimal degrees.  lat/lon with degrees, minutes, and seconds OR decimal degrees...  and optionally the ° symbol or N/S/E/W should all be allowed.  You may use simple arithmetic to convert on the 'Go' box...although it would be a nice-to-have if we converted and showed the three forms of position in the text somewhere to the side of the page (At least for desktop, maybe not mobile)"
  Scenario: a position typed in Go
    Given the Go box
    When the user types a latitude and longitude in degrees, minutes and seconds or in decimal degrees, with or without the ° symbol, with or without N, S, E or W
    Then Go reads it and flies there: `38.72 -9.14`, `38°43'12"N 9°08'24"W` and `38 43 12 N 9 8 24 W` all land on Lisbon
  Scenario: the three forms under the box
    Source: the user's answers in the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30, to the recorder's question (paraphrase: the three-form readout inside the Go drawer): "yes, let's try it"
    Given the Go drawer open, on a wide screen or a phone
    When the user types a position in the box
    Then under the box, as they type, the position shows in three forms: decimal degrees, degrees and decimal minutes, and degrees, minutes and seconds (`38.72 -9.14`, `38°43.2'N 9°08.4'W`, `38°43'12"N 9°08'24"W`)

Feature: A person or a voyage lands wide enough to see round it
  Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "We should not have any people with zooms as clsoe as "7.96".  I think 6 is about the closes zoom we should have for any person or voyage (and maybe other things)."; "Mansa Musa should be at about a zoom of 4 and centered in such a way that we can see all of the west side of northern Africa as well as Jeddah/Mecca without the drawer blocking the view."
  Scenario: the closest a flight lands
    Given any person or voyage
    When the user clicks it and the map flies to it
    Then it lands at zoom 6 or wider, never closer (the mansa before Mansa Musa landed at 7.96)
    And whether the same floor holds for other things ("and maybe other things") is open
  Scenario: Mansa Musa
    Given the people drawer open
    When the user flies to Mansa Musa
    Then the map lands at about zoom 4, centred so all of the west side of northern Africa and Jeddah and Mecca show, none of it under the open drawer
  Scenario: other people land wider (waiting on the user, UI walk 2026-10-30)
    Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "Some of the other zooms for other people may also need to be zoomed out a bit more to get context and not feel too "boxed in"."
    Given a person whose flight lands at zoom 6 or wider
    When the user flies to them
    Then which people, and how much wider, is open
    And a contact sheet of every person's and every voyage's landing, at 1100 px wide, goes to the user to walk ("Sure, go")

Feature: A person's picture card
  Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "Picture cards for people, need a way to dismiss them.  We can reset by clicking the person again...but to dismiss, either a gutter/trash to drag to, or an X to click, or probably my preference is for a dismiss or "put away" button/icon on the back of the card.  The text on the back of many of the people pictures is too small.  I think I want the default size on desktop for the pictures to be larger.  Whichever one is touched/grabbed last is automatically on top, in front.  I do not want the full, repetative text "Its page on Wikimedia Commons" repeated everywhere.  IT looks dumb.  Just use a small link glyph of some kind...probably one of these: ⎘, ⧉, ⧉, ⮺, but perhaps 🔗"
  Scenario: put away, and on top
    Given people's picture cards open on the page
    When the user turns a card to its back
    Then a put-away icon there dismisses the card, and a click on the person again brings it back
    And the card last touched or grabbed is on top, in front of the others
  Scenario: the card's back and its size
    Given a picture card
    When the user reads its back
    Then the text is larger than at the walk
    And the link to Wikimedia Commons is a small link glyph (⎘, ⧉, ⮺ or 🔗), never the sentence "Its page on Wikimedia Commons"
    And on a wide screen a card opens larger by default than at the walk
  Scenario: look, then flip and put away
    Source: the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "The resize icon and the flip icon are both confusing.  I feel as though the resize should have arrows or something.  Do you have other examples of a resize icon?  The flip does not look like an arrow.  We could instead put an eye icon or some other view icon and then that would make the image larger, near full size or full size...and then there could be a "flip" or "put away" icon after that point."; and the user on the icons, in the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30: "pics in drawer for people, "look" 👁"; "then flip ⟳ and put away (But not ⏏ for put away, I'm not sure which one I like)"; and later, on the put-away glyph: "For put away: use an X that is evocative of an X for buried treasure on a map  (unicode Chi?), or possibly an X stylized as a small skull and cross bones"
    Given a picture card
    When the user looks at its front
    Then it shows 👁, and a click on it enlarges the card to near full size
    And the enlarged card shows ⟳ to turn it over, and a put-away control drawn as an X like the one that marks buried treasure on a map, or a small skull and crossbones
    And the card's old resize icon goes
  Overtaken: "put away, and on top" and "look, then flip and put away" give way to "A card on the table: a click looks, three buttons, Pulverum" below (2026-11-06). The card's back, its size and its link glyph's look stand.

Feature: A card on the table: a click looks, three buttons, Pulverum
  Source: the user, 2026-11-06, on the cards for people or places dealt onto the map: "we're simplifying the controls"; "view/zoom is simply clicking the picture/card or tapping on mobile. The eye and link icons are removed from the initial 'dealt' cards and no grabbing is needed."; "the view when clicking should go full screen for mobile and a moderately large zoom for desktop"; "After focused/zoomed it should be allowed to zoom in closer to the full resolution or pan, using the normal controls for desktop or mobile (i.e. pinch, drag, scroll wheel, etc.) without the underlying main map moving. Only the view of the card moves."; "when a card is zoomed/focused, then we have three buttons on the right side, lower corner in this order from top to bottom: "read more", "flip", and "put away" (this is the user assist text or on desktop, appears as text right of the button)."; "The icons are the link for read more, loop circle for flip, and the down arrow for put away."; "The read, flip, and away buttons are in the same position on the front and back of the card, so that when flipping is quick and easy to flip back once more and not be disoriented by relative position changes of the buttons."; "Put away merely returns the card to its original position, it does not 'close' as it did previously."; "On the back of the card, the button currently labeled "X Put away" is moved to the lower right inside of the card back, near the other icons. The text is changed to "X Pulverum" in red and an italicized latin script"; "The link icon following the text on the back of the card is removed, only the link icon to the lower right side of the card is needed." And in the same session, choosing from options put to them: Read more opens the subject's article, not the picture's Commons page. The choice "a dealt card is not dragged" was amended the same day to the frame's grab below.
  Scenario: a dealt card carries no controls
    Given a person's or a sight's cards dealt on the table
    When the user looks at a card
    Then it shows its picture alone: no 👁, no link glyph, no grab handle
    And the pointer over the card's body on a wide screen is `zoom-in`, and over its frame `grab`
  Scenario: the frame's edge grabs; the body looks
    Source: the user, 2026-11-06, amending "no drag": "when the pictures are dealt out, a drag from the corners/margins of the frame allows grabbing and changing focus without zooming. So the edge of card behind, can be used to raise it or pull it out to the side over others. The edge of a card in front can be used to drag it aside to reveal others. Clicking/tapping anywhere inside the main body of the card zooms and focuses."
    Given cards dealt on the table, some overlapping
    When the user drags from a card's frame, its margin or a corner, on a wide screen or a phone
    Then the card comes to the top of the pile and moves with the pointer, without looking: a card behind is raised or pulled out over the others, a card in front is drawn aside to show the ones under it
    And the frame's hit band is wide enough for a finger on a phone, however narrow the drawn margin
    When the user clicks or taps anywhere inside the card's body, the picture
    Then the card is looked at, as below; a drag that starts on the body pans the map
  Scenario: a click or a tap looks
    Source: the user, 2026-11-07, on this PR: "I don't like the extra matte/background behind the picture for mobile. a slight background for the card is ok but the map is not dimmed or obscured. And I do not like the way we removed the skull on mobile. bring that back!"
    Given a card dealt on the table
    When the user clicks it, or taps it on a phone
    Then the card flies from its place on the table to the middle of the window, face up, and the map behind it holds still, dimmed on a wide screen
    And on a wide screen it stands moderately large: its longer side about three quarters of the window's shorter side, never past the picture's own pixels
    And on a phone it is the picture fitted whole between the row of instruments and the skull, on a slight card margin, the buttons over its lower right; the map round it is neither dimmed nor covered, and the skull stays
    And a dealt card is in the Tab order, and Enter or Space on it looks, as the click does; Escape puts it away as below
  Scenario: a looked-at card zooms and pans, the map stays
    Given a card looked at
    When the user scrolls the wheel over it or pinches it, then drags it
    Then the picture zooms about the pointer or the fingers' midpoint, up to its full resolution and never smaller than its look size, and a drag pans it inside its frame
    And the map under it neither pans, zooms nor turns, whatever the gesture; the card's view alone moves
    And a double-click or a double-tap toggles between the look size and full resolution at that point; on a dealt card a double-click is one look, the second click doing nothing more
  Scenario: three buttons at the lower right, the same on both faces
    Given a card looked at, face up or face down
    When the user looks at its lower right
    Then three round buttons stand in a column at the card's right edge, low, top to bottom: Read more (a link glyph), Turn over (a loop circle, ⟳), Put away (a down arrow, ↓)
    And on a wide screen the column straddles the card's right edge and each button's name stands as text to its right, outside the card, over the dimmed map; on a phone the names are the buttons' accessible names and their long-press hint, not drawn
    And turning the card over leaves all three exactly where they were, so a second click on Turn over turns it straight back
  Scenario: Read more opens the subject's article
    Given a card looked at, a person's or a place's
    When the user clicks Read more
    Then the person's or the place's article opens in a new tab, never the picture's page on Wikimedia Commons
    And a person's article is their first source, as a voyage's Read more is, else their Wikipedia article by name; a place's is its Wikipedia article by name
  Scenario: Put away sends the card home
    Given a card looked at
    When the user clicks Put away, presses Escape, or clicks the map round it
    Then the card flies back face up to its place on the table, where it was dealt or last dragged, at its dealt size, and the map behind it brightens; it stays dealt
  Scenario: the back's own controls
    Given a card looked at, turned to its back
    When the user reads the back
    Then the text ends with the credit and no link glyph after it; Read more at the lower right is the one link button
    And where a card has more than one link worth following (the picture's page on Wikimedia Commons, a place the person is tied to, another source), they are listed as plain text links in the body of the back, each named for where it goes
    Source, for the list: the user, 2026-11-06: "we can pick any sensible default for the link button for read more, but if we do have more than one viable link for a given card (a commons link, a separate place link from the person to where they are related, etc.) then we could list multiple links inside the body of the back of the card."
    And inside the back, at its lower right beside the three buttons, is ✘ *Pulverum*: the cross, then the word in red, in an italic script hand
    When the user clicks ✘ *Pulverum*
    Then that card alone leaves the table as the skull's clear takes a card, and a click on the person or the mark again deals it back

Feature: A sight's pictures on the chart table
  Source: the user's design for the sights' pictures, 2026-10-30, on [#310](https://github.com/mark-brannan/portolani/pull/310): a sight's tile opened on the map deals its pictures onto the map "as onto a chart table", exactly as a chosen person's pictures are; Tyre first, from the candidates in `docs/ruin-marks/tyre.md`; where the row lies and the split by mark, the user's review of [#326](https://github.com/mark-brannan/portolani/pull/326), 2026-10-30, as #326's body records it (paraphrase: a sight's cards are dealt in a row along the foot of the window, in its bottom third, clear of the mark, the map flying there first from afar; a sight with several marks splits its pictures by mark, Tyre's city site and Al-Bass). This overtakes the row "just south of its marks, centred under them" and the tile that opened all of a sight's pictures.
  Scenario: a mark's tile opens its pictures
    Given a sight with pictures in its record (Tyre: the harbour, the dig, the peninsula from orbit, the arch, the road, the hippodrome, Cassas's aqueduct)
    When the user opens the tile of one of its marks on the map
    Then that mark's pictures are dealt onto the map in a row along the foot of the window, in its bottom third, clear of the mark, each a little askew
    And they drag, resize, turn over to read their credit and caption, look, put away and follow their link to Commons as a person's do
    And the tile shows that mark's pictures as thumbnails, each of which takes its picture off the table or puts it back
    And closing the tile leaves the pictures on the table until the user puts them away or chooses another subject
  Scenario: a sight with several marks splits its pictures by mark
    Given a sight drawn as more than one mark (Tyre: the city site, the old island port, and Al-Bass on the mainland)
    When the user opens one mark's tile
    Then only the pictures of that part of the site are dealt: the city site's harbour, view from orbit and dig, or Al-Bass's arch, road, hippodrome and aqueduct
    And the sight's one row in the Points of interest drawer shows all of them
  Scenario: every mark answers where it is drawn
    Source: the user on [#326](https://github.com/mark-brannan/portolani/pull/326), 2026-10-30, in the session walk: "the northern ruins for Tyre don't do anything. We said we were moving two cards to the norther (port) site but they're just gone. I said the northern site was more important to me than the two...but you left the southern site and didn't build a mouseover/clickpoint for the northern (port) site. I've gotta see that."; "There's also something strange happening with the hit boxes. When I sweep and then click part of the leftmost icon I get the hover text tile, but not always the cards, sometimes if I change the position of the click...then the cards get dealt."; "I see now that at a certain zoom level the north and south sites are both there and have tiles/cards...however I can't figure out why the northern site is not always clickable. To reiterate: something weird is going on with hit boxes and drawing the position of these. It shouldn't be this complicated."
    Given a sight drawn as more than one mark, at any zoom where its marks are drawn, before or after a sweep
    When the user points at any part of a mark, or clicks or taps it
    Then the pointer answers over the whole of that mark, at the spot where it is drawn: where the mark is drawn, there it answers
    And every click on it opens its tile and deals its own pictures, every time; no part of the mark opens the tile and deals nothing
    And no mark of a sight is drawn without answering: the city site, the port the user holds the more important, answers as Al-Bass does
  Scenario: a sight's marks keep their bearing to each other
    Source: the user on [#326](https://github.com/mark-brannan/portolani/pull/326), 2026-10-30, in the session walk: "The ruins for Tyre are inexplicably trading positions around when zooming. Initially they are north/south of one another but then when clicking or zooming they get rendering beside one another."
    Given a sight drawn as more than one mark (Tyre's two sites, 1.7 km apart on one latitude)
    When the user zooms in or out, or clicks
    Then the marks keep their true bearing to each other at every zoom: Tyre's city site stands west, Al-Bass east
    And where they lie too close to stand apart at that zoom, they spread along that bearing only as far as they need to stand clear of each other, and come back to their own places as the zoom opens
    And a click or a zoom never swaps or turns them
  Scenario: one subject at a time
    Given a sight's pictures on the table
    When the user chooses a person in the People drawer
    Then the sight's pictures are put away and the person's dealt, and the other way round when a sight's tile is opened with a person chosen
    And the choice rides in the link as `sight=<name>`, with `pictures=` and `pictureat=` as a person's
  Scenario: built and credited
    Given the sights' picture records (`data/sights/pictures.json`, keyed by the tile's name, each picture with its kind, author, date, licence and a one-line caption)
    When the pictures are built (`npm run people`)
    Then each is fetched from Commons, its licence checked against the record, and written into `packs/overlays/sights/` with a manifest of the people manifest's shape
    And its back reads its credit and its caption

Feature: A place's note and details in the Points of interest drawer
  Source: the user's review of [#326](https://github.com/mark-brannan/portolani/pull/326), 2026-10-30, as #326's body records it (paraphrase: a place's note shows only on hover or focus; a click shows the place's details at the drawer's foot)
  Scenario: the note on hover
    Given the Points of interest drawer open
    When the pointer rests on a place's row, or the keyboard's focus reaches it
    Then the place's note shows, laid over the rows below so nothing jumps, and goes when the pointer or the focus leaves
  Scenario: the details on a click
    Given the Points of interest drawer open
    When the user clicks a place's row
    Then the map flies there, and the place's details show at the drawer's foot: its name and date, its tile's text, and its pictures as thumbnails that put a picture on the table or take it off
    And the click on the row deals nothing; a mark on the map deals

Feature: A flight sweeps the table, then deals on arrival
  Source: the user on [#326](https://github.com/mark-brannan/portolani/pull/326), 2026-10-30, in the session walk: "cards need to sweep themselves for now whenever we do a fly action. I typically want that for people cards too...so it should be the same action if possible. sweep then fly."; "I notice that cards for people are getting dealt before we fly and so they are mysteriously in place when we get to the outer zoom. We should fly and then deal cards when we are nearing the target zoom levels, or the target field of view."
  Scenario: sweep, fly, deal
    Given cards on the table, a person's or a sight's, or none
    When the user chooses something that flies the map: a person, a sight's mark from afar, a row in a drawer, a voyage, a chart, Go
    Then every card on the table is put away first, a person's or a sight's alike, as the skull puts them away
    And then the map flies
    And the chosen subject's cards, a person's or a sight's alike, are dealt only as the flight nears its target view, never before it sets off or while the map is still far from it
  Scenario: the map is there before the deal
    Source: the user, 2026-11-06: "Whenever flying to a new location with cards, the flying occurs first and then the cards are dealt after arriving at the target position (dealing is allowed to happen before the final zoom is reached, while the lat/lon position should be reached before dealing.)"
    Given a flight to a subject with cards
    When the flight is under way
    Then no card is dealt until the middle of the window has reached the latitude and longitude the flight is bound for, its own centre rather than the subject's mark
    And the deal may begin while the zoom is still settling into the target view
  Scenario: a person's voyages draw on as the map arrives
    Source: the user, 2026-11-06: "When arriving at the target position for a person, the voyages are all animated"; and, choosing from options put to them, all draw on together.
    Given a person chosen, the map flying to frame them
    When the map arrives at the target position, as the cards are dealt
    Then every voyage of theirs that is shown draws its line on at once, together, at the pen's pace (the Voyages drawer's slider)
    And with reduced motion the lines are simply there
  Scenario: no flight, no sweep
    Given a choice that does not move the map (a sight's mark opened where the map already is)
    When its cards are dealt
    Then they are dealt at once, in the view the map is in

Feature: The skull in the lower right puts the map back
  Source: the user on [#326](https://github.com/mark-brannan/portolani/pull/326), 2026-10-30, in the session walk: "I don't like the broom. Use a skull and cross bones and put some latin script text below it. I want us to cycle through a handful of phrases about mortality and death/dust that would have been in common use in the period: "Memento, homo, quia pulvis es, et in pulverem reverteris", "Pulvis et umbra sumus", "Hodie mihi, cras tibi", "Mors certa, hora incerta", "All flesche is grasse", "Erthe out of erthe is wonderly wrought, Erthe hath of erthe a dignite of nought", "Ogni uomo è polvere", "Ricordati che devi morire", "Polvo eres, y en polvo te has de convertir", "Nuestras vidas son los ríos que van a dar en la mar, que es el morir", "Recuerda que eres polvo". You may use an animated broom effect on the map when the skull is clicked and the cards are being swept but then the broom disappears. I want the skull and the flavor text to always appear in the lower right persistently. It can always be used to clear things back to the normal state." That one control puts every card away, a person's or a sight's alike, is the earlier call of the same review, as #326's body records it (paraphrase). The broom supersedes nothing older: the sweep was first drawn as a broom on #326, shown only while a card lay on the table and keeping the subject chosen, and the user replaced it with the skull the same day.
  Scenario: the skull is always there
    Given the chart at any view, with cards on the table or none
    When the user looks at the lower right of the window
    Then a skull and crossbones is there, with one period phrase on mortality under it, in the phrase's own language, untranslated
    And it is there at all times, not only while a card lies on the table
  Scenario: the phrases turn
    Given the skull shown
    When the phrase under it changes
    Then it moves on in turn through the list: "Memento, homo, quia pulvis es, et in pulverem reverteris", "Pulvis et umbra sumus", "Hodie mihi, cras tibi", "Mors certa, hora incerta", "All flesche is grasse", "Erthe out of erthe is wonderly wrought, Erthe hath of erthe a dignite of nought", "Ogni uomo è polvere", "Ricordati che devi morire", "Polvo eres, y en polvo te has de convertir", "Nuestras vidas son los ríos que van a dar en la mar, que es el morir", "Recuerda que eres polvo"
    And what turns it, a clock or each click, is open
  Scenario: a click puts the map back to its normal state
    Given cards on the table, a tile open, a person or a sight chosen, in any mix
    When the user clicks the skull
    Then every card is put away, a person's or a sight's alike, every tile closes, and no subject is chosen: the map is in its normal state
    And a large, faint skull flashes over the map as the cards go, then is gone (the broom is retired: docs/spec/drawer.md, "The skull stays in reach while a drawer is in use"); with reduced motion the cards go with no wipe
    And a click with nothing on the table does no harm: the map is already in its normal state
  Scenario: on a phone, the skull alone, smaller
    Source: the user, 2026-11-06: "On mobile, the memento mori text near the skull is suppressed for space constraints. Only the skull is shown and it is a reduced size. The red animated text still appears in both mobile and desktop on the skull button press."
    Given a phone
    When the user looks at the lower right
    Then the skull is there alone, smaller than on a wide screen, with no phrase beside it
    And a press still raises the phrase large in red over the map, as on a wide screen

Feature: The skull is the one clear  (`#sweep`, page.js `clearMap`)
  Source: the user, 2026-11-04: "The skull is the universal 'clear' button.  It should work on any drawer or feature where we need clear/reset functionality.  Charts are cleared/reset with the skull.  Voyages are cleared/reset with the skull.  People, of course.  There is an unneeded 'clear' button in voyages.  When in the context view for a POI, it clears cards but does not reset any view position or zoom."; "It does not clear the rose config settings, map projection settings, position, or view." This widens "The skull in the lower right puts the map back" from the table to every drawer's content, and retires the Voyages drawer's own Clear (docs/spec/voyages.md). A settings group's Clear and Defaults (the figures, the hills) are settings, not the map's content, and stay.
  Tested by: test/touch.test.mjs — 'voyages: several drawn at once, ...' (in a browser: the skull empties the voyages, the drawer stays open, `map=` and the line weight stay); test/drawers.test.mjs — 'the skull is the one clear, and the voyages have no Clear of their own' (offline, source only: the charts' half and the view's are not yet driven in a browser)
  Scenario: one click clears every drawer's content
    Given a person chosen with their cards dealt, two voyages shown, and two charts' sheets laid, one dragged from its place
    When the user clicks the skull
    Then every card is put away and no person or sight is chosen
    And no voyage is drawn, `voyages=` leaves the hash, and a voyage playing stops and its band goes
    And no chart's sheet is laid, `overlay=` and `sheet=` leave the hash, and a chart shown again lies at its own place
    And the faint skull flashes over the map once, as it does when cards go
  Scenario: the skull clears every chart, voyage, person, card and point of interest, leaving only the base map
    Source: the user, 2026-11-04, on a regression in which the skull no longer cleared the charts: "The skull clear is not clearing charts.  It must clear all charts, voyages, people, cars, and POIs (leaving only the base map).  This must be in the spec in addition to fixing it.  It is a firm requirement" ("cars" read as cards).
    Given any mix of charts' sheets, voyages, a person and their cards, a point of interest's tile and cards, and charts' overlays laid by any route (the eye, a chart's name or icon, the link)
    When the user clicks the skull
    Then nothing of them is left on the map: the base map alone is drawn, and no clear stops short for any of them
    And the clear never fails part-way: the charts go even when no voyage or person was there to go first
  Scenario: the view and the settings stay
    Given the map at some place, zoom and bearing (the world turned to a chart), in a projection other than the default, with the rose and the styles as chosen
    When the user clicks the skull
    Then `map=`, `projection=` and `bearing=` are as they were, and the map does not move or turn
    And the rose's settings, every style, every figure, the line weight, the pen's pace and the charts' opacity and mode are as they were
  Scenario: in a point of interest's view, the cards go and the map stays
    Given a point of interest's tile opened and its cards dealt, the map flown to frame it
    When the user clicks the skull
    Then the cards go and the tile shuts, and the map keeps that place and zoom: nothing flies back
  Scenario: no Clear of its own in the Voyages drawer
    Given the Voyages drawer open
    When the user looks at its tools
    Then there is no Clear chip; the skull, in reach over the drawer, is how the voyages are cleared

Feature: The skull's clear is shown  (`#sweep`, page.js `skullRise`, `wordsRise`, `vanish`)
  Source: the user, 2026-11-04, on [#367](https://github.com/mark-brannan/portolani/pull/367): "The skull on the main screen should be more realistic and can be just a skull, not the cross bones.  It should be almost the full height or width depending on which constrains the view.  It should be a slightly slower effect (we can play with timing on this PR with a slider, temporary).  The skull animation effect should also have a slight 'growing' effect where it gets larger to fill the space or even beyond the borders of the space as it fades out. It should have a consistent timing for the clear effect on the objects being cleared also, for example the charts or the photos.  Either they are "swept" away and off screen to the left, or they are faded away into dust and nothingness.  I would like to see a few different effects if possible. Finally the memento mori text should be also drawn in Script/Italics, in the dark red color, in the main view at the bottom of the screen and grow and then fade slightly slower than the fading effect, in order to give the viewer time to read.  This does not replace the existing text that we show near the button, but that text should be sized or placed so that the button does not move for different texts.  The button is in a constant location.  The text can however, appear above/below/beside as appropriate.  I would like that text on a single line if possible.   The hover text for the skull button should be 'Clear the map: <translation>" with the translation of the memento mori text in English (or the users language if we later localize everything). Finally, it should always trigger the effect, even if the screen is already clear." And later the same day, on #367: "Lines on the map for voyages clear only by fading away, never sweeping off screen or pixelating. For the clear effect, for pictures, I want to see the same transition effect as when we place them "on the chart table" but they exit to the left."; "The words should be like a queue. We have words displayed already near the skull button. When clicked, then those are the words that get displayed in red during the animation and a new set of words get queued by the button." And after that: "The speed of the card dealing should not differ significantly between dealing in and dealing out."; "For text that is longer and has a clean split near a comma at about the halfway point, these should be on two lines as if they are verse or a couplet." This overtakes the faint flash of the two Features above for the skull's click; a fly that puts cards away keeps the faint flash.
  Scenario: the skull fills the map, grows and fades
    Given the chart at any view, cleared already or not
    When the user clicks the skull
    Then a skull alone, drawn as bone, no crossbones, rises over the map, almost as tall as the map or as wide, whichever bounds it
    And it grows on past the map's edges as it fades, over a little longer than the old flash
  Scenario: what is cleared leaves, all over one time
    Given cards, voyages or charts' sheets on the map
    When the user clicks the skull
    Then everything cleared leaves together over the same time
    And each card leaves as it was dealt onto the table, mirrored: off to the left, shrinking and turning, one after another, and turns to fine dust as it goes, to nothing; the grains are dust-sized, never large pixels
    And ✘ *Pulverum* takes its one card off the table the same way
    Source, for the dust: the user, 2026-11-07, on #404: "The clear effect is to "Deal" the card out to the left ("exit stage left") but also to do a fade "to dust" effect where it fades into nothingness or small pixelated nothingness (not large pixels, 'dust' sized pixels)."
    And a voyage's line only fades away, never swept off or broken into dust
    And with reduced motion it goes at once
  Scenario: the phrase is read large, then fades last
    When the user clicks the skull
    Then the phrase that was beside the skull is drawn large at the foot of the map, in the italic hand, in the chart's red, on one line or, set as a couplet, two
    And it comes and fades, slower than the skull, so it can be read
    And a long phrase with a comma near its middle is set as a couplet, on two lines split after the comma
    And a phrase that is verse in its source, Manrique's, keeps that verse's lines
    And the next phrase takes its place beside the skull, the one the next click shows
  Scenario: the large phrase is never under the skull or the compass
    Source: the user, 2026-11-06, on #272: "The skull (and potentially the compass) are obscuring the red memento mori text on mobile. IT should be either drawn over those buttons, or displayed slightly higher up above the level of the buttons so that it is fully visible during its animation."
    Given a phone, or any window where the phrase would reach down to the skull and the compass
    When the user clicks the skull
    Then the large phrase stands with its foot above the compass and the skull, and grows upward from there, so every letter of it is in sight from its first frame to its last
  Scenario: the phrase beside the skull never moves it
    Given any phrase beside the skull, the longest included
    When the user looks at the skull
    Then the skull is in the same place as with the shortest phrase, and the phrase is on one line where the window allows
  Scenario: the skull's hover text is the phrase in English
    When the user hovers over the skull
    Then it reads "Clear the map: " and the English of the phrase beside it

Feature: People and voyages, each a vertical timeline
  Source: the user on the timeline [#304](https://github.com/mark-brannan/portolani/pull/304) merged, 2026-11-04: "The entire drawer is way too WIDE! It should not be wider than the drawer for charts or settings/config (480px). We should consider whether we need to reorient it to be a vertical timeline instead of horizontal. Somehow we need to fit things more nicely."; "I do not like AT ALL how we treat people groups. The people group migrations MUST be in the people drawer with people. Nevermind that all the European examples are individuals... people are people. Lapita gets a row in people (not merely voyages)."; "When you click on people in the people drawer it should expand their notes and their voyages should appear directly below that. NOT below all the other people, and not as a naive copy/paste from the voyages drawer of all voyages. If I select Ibn Battuta, then I should get a tile with his notes... then each of the voyages below that (with the notes for that voyage)." This overtakes the one horizontal timeline of two lanes, its Earlier tab and its era bands (the UI walk of [#292](https://github.com/mark-brannan/portolani/pull/292), 2026-10-30), which #304 built and the user turned down on sight.
  Scenario: two drawers, no wider than the charts
    Source, for the one layout: the user, 2026-11-06: "The voyages drawer is separate from the persons drawer, they are NOT combined."; "the person drawer, when a person is selected, shows the subset of voyages that person was a part of, below their tile inside the drawer." The page still opens the one wide timeline (`#timelinePanel`, the A layout) when the hash has no `timeline=`; the two drawers are the only layout, and A, its `timeline=` key and its chip in the settings drawer go. And, the same day: "voyages is a distinct drawer. people is a distinct drawer. Voyages could (in the future) contain links to people inside a voyage but fundamentally, voyages is a different presentation of the data and a different drawer. People will have links to one or more voyages, but it is a different presentation of the voyage data related to a single person."
    Given the instrument row
    When the user clicks the medallion `#people` or the dividers `#voyages`
    Then the People drawer `#peoplePanel` or the Voyages drawer `#voyagesPanel` opens alone, each `width: min(480px, 100vw - 24px)`, the Charts drawer's width, never wider on any screen; on a phone each is a bottom sheet like the others
    And nothing in either scrolls sideways: a row, a tile and a voyage's notes wrap
  Scenario: time reads top to bottom
    Given either drawer
    When the user looks down it
    Then the rows run earliest first down a thin rail, from the Lapita voyages, about 1500 BC: a person by their birth, else by their first voyage; a voyage by the year it set out
    And the Sights eras head the rows that fall in them, as small italic headings with the era's years (`1500 BC – AD 500`, `500 – 1450`, `1450 – 1800`, `from 1800`); a year before Christ reads `BC`
    And a person's row is the name and the years as the record writes them (`24 Feb 1304 – c. 1369`, `born c. 350 BC`, `died 1510`); a people's row carries the years of their voyage (`c. 1500–800 BC`)
  Scenario: a people is a person
    Given a migration, or a voyage whose crew nobody named: the Lapita expansion, the settlement of East Polynesia, Necho's Phoenicians
    When the People drawer lists people
    Then it has a row like anyone else's, `The Lapita people`, `The East Polynesian voyagers`, `Phoenician mariners of Necho II`, each a record in `people.json` with `group: true`, a bio and its sources, marked by a small chip "a people"
    And the voyage's `who` names it, so every voyage, a migration too, belongs to someone in the People drawer, and choosing the people lights their voyage and flies to frame it as choosing a person does
  Scenario: a chosen person's tile and their voyages sit directly under their row
    Given the People drawer open
    When the user clicks a person's name
    Then the person is chosen as before (their pictures dealt, their voyages lit in red, the map flown to frame them, `person=` in the hash) and a tile slides open directly under their row, before the next person's: their notes, their pictures as thumbnails, then one row per voyage of theirs in the index's order, each with its title and years, its notes, Read more, and the same eye and play as the Voyages drawer's rows, so a voyage is shown, hidden or played from here
    And only the chosen person's tile is open; choosing another shuts it and opens theirs under their own row; clicking the chosen person again lets them go and shuts the tile
    And the eye reads on for every voyage of theirs drawn lit; put off, it hides that one voyage while the person stays chosen, and the hash carries it as `voyages=<id>~`
