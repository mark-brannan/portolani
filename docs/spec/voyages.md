# The voyages drawer

Feature: Voyages drawer  (dividers button `#voyages` opens `#voyagesPanel`; list `#voyageList` from `data/voyages/index.json`; hash `voyages=<id>[:<rrggbb>],...`, `voyagewidth`; the older `voyage=<id>` is read as a list of one) [verified page.js:129-134, 1164-1218 at acf745d]
  Scenario: the list loads on the first open
    Given the chart with every drawer shut
    When the user clicks `#voyages`
    Then `#voyageList` holds one checkbox button per id in `data/voyages/index.json`, in that order, each labelled with the voyage's `title` (the id if its file will not load)
    And nothing is chosen: every button reads `aria-checked=false` and `voyages=` is absent from the hash
  Scenario: a phone shows the short name
    Given a viewport 520 px wide or narrower
    When the drawer is open
    Then each row reads its `short` name and years instead of its full title, so no title wraps
  Scenario: choosing a voyage
    Given the voyages drawer open
    When the user clicks "Columbus"
    Then the button reads `aria-checked=true`, its line sample turns solid in the chart's red `#8c2f1e`, and a colour swatch appears beside it
    And the hash holds `voyages=columbus` and the drawer stays open
  Scenario: several at once
    Given "Columbus" chosen
    When the user clicks "Drake"
    Then the hash holds `voyages=columbus,drake`, in the order chosen
    And Drake takes a colour of its own, not red, because the first chosen holds red
  Scenario: choosing again takes it off
    Given "Columbus" and "Drake" chosen
    When the user clicks "Columbus"
    Then `voyages=drake` remains, Columbus's swatch is hidden and its line sample is dashed and faint
  Scenario: picking a colour
    Given "Columbus" chosen
    When the user picks `#1f4e8c` in its swatch
    Then the hash holds `voyages=columbus:1f4e8c`, and the voyage is drawn in it once the picker pauses (about 150 ms), not at every step of a drag
  Scenario: line weight
    Given the voyages drawer open
    When the user clicks a weight chip in `#voyageWidth` (Fine 1.4, Standard 2.2, Bold 3.2, Heavy 4.5)
    Then every voyage's line, and every line sample in the list, takes that width
    And the hash holds `voyagewidth=3.2` for Bold, and omits it for Standard, the default
  Scenario: Clear
    Given two voyages chosen
    When the user presses Clear in the drawer's tools
    Then `voyages=` leaves the hash and no voyage is drawn; Clear is disabled while none is chosen
  Scenario: a link restores the choice
    Given the link `#voyages=columbus:1f4e8c,drake`
    When the page loads and the drawer is opened
    Then both are checked, Columbus in `#1f4e8c`, and the map draws both
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
