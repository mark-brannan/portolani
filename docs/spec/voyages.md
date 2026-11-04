# The voyages drawer

Feature: Voyages drawer  (dividers button `#voyages` opens the timeline `#timelinePanel` at its lower lane, "Voyages"; the people button `#people` opens the same drawer at the upper lane; list `#voyageList` from `data/voyages/index.json`; hash `voyages=<id>[:<rrggbb>][~],...` (`~` marks a voyage hidden by its eye), `voyagewidth`, `voyagedraw`; the older `voyage=<id>` is read as a list of one) [verified against main, 2026-11-02]
  Scenario: the list loads on the first open
    Given the chart with every drawer shut
    When the user clicks `#voyages`
    Then `#voyageList` holds one row per id in `data/voyages/index.json`, in chronological order (the file's order breaks ties), each a bar over the voyage's years with a name button `[data-voyage]`, an eye `[data-eye]`, and its colour swatch once it is chosen
    And the name button reads the voyage's `short` name and years, at every width, and its tooltip is the full `title` (the id if its file will not load)
    And nothing is shown: every eye reads `aria-pressed=false` and `voyages=` is absent from the hash
  Scenario: choosing a voyage by its name
    Given the voyages drawer open
    When the user clicks the name "Columbus"
    Then Columbus is shown alone (every other voyage is hidden), its eye reads `aria-pressed=true`, its line sample turns solid in the chart's red `#8c2f1e`, and a colour swatch appears beside it
    And the map flies to frame the whole voyage, even if part of it is in view, and the line is drawn on from start to end in the seconds `voyagedraw` holds; under reduced motion it is drawn whole
    And the hash holds `voyages=columbus` and the drawer stays open
  Scenario: the eye shows several at once
    Given "Columbus" shown
    When the user clicks the eye in "Drake"'s row
    Then the hash holds `voyages=columbus,drake`, in the order chosen, and both are drawn
    And the map does not move, no line is drawn on and no other voyage changes
    And Drake takes a colour of its own, not red, because the first chosen holds red
  Scenario: the eye again takes it off
    Given "Columbus" and "Drake" shown
    When the user clicks the eye in "Columbus"'s row
    Then the hash holds `voyages=columbus~,drake`, Columbus's eye reads `aria-pressed=false` and its line sample is dashed and faint
    And Columbus keeps its place in the list and its colour, its swatch still beside it, so no other voyage's colour changes
    And the view does not move
  Scenario: the name again, alone
    Given "Columbus" and "Drake" shown
    When the user clicks the name "Columbus"
    Then Drake is hidden and Columbus is shown, the map flies to frame it and its line is drawn on again, every time the name is clicked
  Scenario: picking a colour
    Given "Columbus" chosen
    When the user picks `#1f4e8c` in its swatch
    Then the hash holds `voyages=columbus:1f4e8c`, and the voyage is drawn in it once the picker pauses (about 150 ms), not at every step of a drag
  Scenario: line weight
    Given the voyages drawer open
    When the user clicks a weight chip in `#voyageWidth` (Fine 1.4, Standard 2.2, Bold 3.2, Heavy 4.5, the default)
    Then every voyage's line, and every line sample in the list, takes that width
    And the hash holds `voyagewidth=3.2` for Bold, and omits it for Heavy, the default
  Scenario: Clear
    Given two voyages chosen
    When the user presses Clear in the drawer's tools
    Then `voyages=` leaves the hash and no voyage is drawn; Clear is disabled while none is chosen
  Scenario: a link restores the choice
    Given the link `#voyages=columbus:1f4e8c,drake`
    When the page loads and the drawer is opened
    Then both are shown, Columbus in `#1f4e8c`, and the map draws both
  Scenario: an older single voyage
    Given the link `#voyage=columbus`
    When the page loads
    Then Columbus is the one voyage chosen, and the next hash write says `voyages=columbus`
  Scenario: bad entries are dropped
    Given the link `#voyages=Columbus,drake:zzz,drake,off`
    When the page loads
    Then only `drake` is chosen, in its own colour (an id that is not lower-case letters, digits and hyphens, a repeated id, `off` and a colour that is not six hex digits are each ignored)
  Scenario: an id the site lacks
    Given `voyages=nowhere`
    When the page loads
    Then nothing is drawn for it and the page does not fail
  Scenario: the list fails to load
    Given `data/voyages/index.json` cannot be read
    When the user opens the drawer
    Then the list shows the error message in a single row, and the next open tries again
  Scenario: marks open a tile
    Given a voyage chosen
    When the user clicks one of its event marks on the map
    Then the flavour-text tile opens with the event's title, date, text and source; choosing another voyage, or none, shuts a tile whose mark is gone (page.js:1023, 1059)

Feature: A migration plays on its own calendar  (the row's play button `[data-play]`, page.js `playVoyage`; scripts/voyages.mjs `calendarOf`, `penOn`, `playDateText`, `playPace`; scripts/scene.mjs `drawStream`, `drawCanoe`, `drawPot`; the play itself in design.md, "the play button sails the voyage on its own calendar")
  Scenario: the Lapita stream sails from the Bismarcks to Samoa
    Given the Lapita expansion in the voyages list
    When the user presses its play button
    Then the map frames the whole stream beside the open drawer, and the stream clears to its start at Mussau
    And over the play's seconds (`voyageplay=`, 9 by default) its ribbon and chevrons run out from Mussau to Samoa, an outrigger canoe with a crab-claw sail at the front where the ship's ring would be
    And the canoe reaches each settlement on that settlement's date: Watom c. 1350 BC, the Reef Islands c. 1200 BC, Fiji c. 1100 BC, Tonga c. 900 BC, Samoa c. 800 BC
    And each settlement's pot appears as the canoe reaches it, and no sooner
    And the branch to New Caledonia sets out from Efate as the main stream passes it, its own canoe sailing at the same time as the main one
    And at the end the stream is whole, a chevron at each front, every pot drawn, and the band's button back to play
  Scenario: every migration plays, branches at once
    Given a migration (`kind: "migration"`) whose legs carry dates
    When the user presses its play button
    Then each leg is a branch on its own dates, under way at the same time as the others, and none sets out before an earlier leg's pen has reached its first point
    And a leg dated by one date ("c. 1100 BC") arrives on that date, setting out as the earlier pen passes its start
    And a waypoint at one of a leg's points is a stop the pen reaches on the waypoint's date
    And the band names the stretch between the two settlements the latest branch is between, or the place every branch has landed at, waiting
  Scenario: a waypoint is a settlement's pot
    Given a migration shown, played or whole
    Then each of its waypoints is a small ink pot with a stamped band at its shoulder, not the ring of a named voyage's event
    And a click on the pot opens its tile as before
  Scenario: the band tells a long calendar in years
    Given a voyage whose calendar runs more than 50 years
    When it plays
    Then the band's date is "c." and a year, to the nearest 10 years past 200 years and the nearest 50 past 1,000 ("c. 1210 BC", "c. 1250")
    And its pace reads "about 80 years a second" (the calendar's years over the play's seconds), and the strip's ends are bare years ("1500 BC", "800 BC")
    And a calendar of 50 years or fewer keeps its dates as precise as its legs and its pace as "1,083 days in 9 s"
  Scenario: reduced motion
    Given the user prefers reduced motion
    When the user presses a voyage's play button
    Then the voyage shows whole at once with every mark, the band at its last day, and the strip still scrubs to any day
