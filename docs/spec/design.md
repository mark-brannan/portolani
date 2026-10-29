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
    And no other control sits in the row but its Chart position chips (below) and, for a chart whose sheet carries notes, its Notes chip ("A chart's notes get their moment", below; the user asked for it on 2026-10-29: "there should be a way to show/hide them or retrigger the animation"); the pieces mode and its opacity live under Settings, Under the hood
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
    And over the sheet, in today's geography, the feature that placement was fitted to draws itself as a plain line, from one end to the other, holds, then fades to a faint line (about a quarter of its strength) that stays while the sheet lies at that placement
    And the faint line may lighten later to a ghost (about a tenth) or go entirely; the user chose faint for now, after comparing all three (the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "C for now, may lighten to B or A later", where C was faint, B ghost and A gone)
    And the faint line is the lit chip's: a click on another chip replaces it with that chip's line, drawn from the start; a click on the lit chip draws it again; hiding the chart with its eye takes the line off with the sheet; and as the sheet fades in or out, the line fades with it
    And "Parallels" draws today's equator and Tropic of Cancer; a coast's chip ("New World") draws only the stretch of today's coast that fit used, not the whole coast; the chart's own "Level" draws every coast it is centred between
    And the line is the feature the fit was computed from, carried with the placement in the chart's data, never a stretch drawn by hand to look right
    And with reduced motion the line shows whole, then fades to faint
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
  Source: the user on [#259](https://github.com/mark-brannan/portolani/pull/259), 2026-10-29: "Clicking a new voyage button always zooms to that voyages target window."; "The first time any given voyage is selected after opening the drawer, if it was not previously selected, zoom to the window for that voyage and then animate the line from the start to the finish."; "Each voyage has a show/hide button to the right of it, before the color selector. The show hide always does a quick show/hide action for the line without changing the zoom or view."; "The voyages colors should not "jump" or reset when multiple voyages were selected and an earlier one is then de-selected. The colors in the current display should remain 'sticky' to the voyage they were already assigned to." The pace of the first draw, after comparing three: "A but faster, maybe 1s +/- .5s." (A: an even pace along the line; B: the voyage's dates) This replaces the rule that a voyage put on stays where it is if any of its track is in view, and that a click on a shown voyage takes it off (`public/page.js` at `6960f78`).
  Scenario: the row
    Given the Voyages drawer open
    When the user looks at a voyage's row
    Then it reads, left to right: the voyage's name, a show/hide icon (the same eye as a chart's row), a play button, then its colour picker
  Scenario: the name flies; only the eye hides
    Given a voyage in the list
    When the user clicks its name
    Then the map flies to the view that frames the whole voyage, whether or not any of it was already in view
    And the voyage is shown if it was hidden
    And if this is the first time since the drawer opened that this voyage is shown, and it was not shown when the drawer opened, the line draws itself from the start of the voyage to its end once the flight lands, in about a second (half a second to a second and a half) whatever the voyage's length, at an even pace along the line
    When the user clicks its name again
    Then the map flies to the frame again, the line stays drawn whole, and nothing is hidden
    When the user clicks its eye
    Then the line shows at once, drawn whole, or hides; the view does not move
    And a voyage shown by its eye and then clicked by name in the same opening of the drawer flies but does not draw itself again
    And with reduced motion the line shows whole, no drawing
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
    Then a stand-in mark is drawn at its spot, so the user sees where to tap, and no lettering beside it: the ruin glyph below, or the plain town glyph where a modern city stands
    And a place that already has a town or a sprite drawn there gets no second mark
    And every place listed in the Sights drawer is checked, not only Tyre
  Scenario: a place with no modern city is a ruin
    Given a point of interest with no modern city on its spot (Berenike), where a modern city is on its spot when a town of today stands on the same site, as Sour stands on Tyre and a suburb of Tunis on Carthage
    When its mark is drawn
    Then it is a small ink glyph of a broken colonnade: three columns on a step, two of them snapped short, about the height of a town glyph
    And it is drawn in code, in ink, like the towers, not cut from a scan
    And a place with a modern city on its spot but nothing drawn there yet gets the plain town glyph instead, so no living city reads as a ruin
    And a place's own decoration, link or image laid on later replaces its glyph

Feature: The world turned to the chart (deferred)
  Source: the user on [#266](https://github.com/mark-brannan/portolani/pull/266), 2026-10-29: "A nice to have, not required for any of the charts would be to rotate the world to match the orientation of the chart, rather than the other way around. De La Cosa's map was originally meant to be read vertical, with the equator running up and down and the new world at the top. You can defer this or add it as a 'future' spec."
  Scenario: the map takes the chart's orientation
    Given a chart drawn to be read in another orientation (de la Cosa's, vertical, the New World at the top)
    When the user asks for the chart's own orientation
    Then the map turns under the sheet to match it, and the sheet stays as scanned
    And until this lands, the sheet turns and the map stays north-up

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
    Then a chip beside the position chips reads "Notes · N", N the count, off after the pulse
    And a click on the chip shows the marks and keeps them until it is clicked again; a second control, or the same chip when the marks are already off, plays the rings again
    And the marks are never left on by default; the scan is the thing, the marks are a way to find what is on it
  Scenario: the user sees it first
    Given the pulse built as above
    When the PR that builds it hands over
    Then its body shows the pulse as a short recording or a strip of frames at map size, and the user says whether it reads or is too subtle before the timing is settled

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

Feature: A grouped list in a drawer opens one group at a time
  Source: the user in the session that captured these requirements for [#274](https://github.com/mark-brannan/portolani/pull/274), 2026-10-29: "Sections for the famous ports should open one at a time with an animated slide instead of the open/closed triangle."; asked whether the anchorages list too: "All such lists, probably. We're going to have a similar problem (I think) for all of these as we add content: charts (expanding to other cultures and non-portolan style charts), voyages, ports/anchorages/POIs (And these may be reorganized or subdivided again anyway...I'm not sure which menus I really want to organize them under)". Today the Sights and anchorages lists are `details` elements with a disclosure triangle, any number open at once (`public/page.js`, the `SIGHTS` and `ANCHORAGES` groups).
  Scenario: the groups
    Given any drawer list arranged in groups (the Sights eras, the anchor's regions and seas, and the charts and voyages once they are grouped)
    When the user looks at it
    Then each group is a heading row with no triangle; the heading carries what the group holds (its count, and its span of years where the group is an era)
    And exactly one group is open; the one the list opens with is the group the data marks open, else the first
  Scenario: the slide
    Given one group open
    When the user clicks a closed group's heading
    Then the open group slides shut and the clicked one slides open together, in about a quarter of a second, and the list does not jump
    And a click on the open group's heading does nothing; the list is never left with no group open
    And with reduced motion the groups swap with no slide
  Scenario: the groups are the content's, not the control's
    Given the lists grow and are reorganised, as the user expects
    When a group is added, split or moved to another drawer
    Then the one-open rule and the slide follow it with no new code: the behaviour belongs to the grouped list, not to the Sights drawer
