# Voyages

A voyage overlay is a historical track drawn over the modern-geometry map, in any projection: the
reader picks one at a time (none by default) and the map draws its legs, graded by how well the
course is known, with a skull and crossbones where one of its people died. Historical interest and
education come before precision: where the course is unknown the line is an editorial broad brush,
a smooth curve the way the winds and currents would have taken a ship, and it says so by its stroke.
The ancient voyages are told at second hand; every identification of a place on them is one scholarly
guess among several.

| Confidence | Stroke | Means |
|---|---|---|
| `attested` | solid | the course is recorded: a log, a journal, a pilot's roteiro, a named landfall every few days |
| `inferred` | dashed | ends known; the way between worked out from winds and currents, or a later account |
| `conventional` | dotted | the way scholars usually draw it; the sources do not say |

Each leg is joined one of three ways: `rhumb` (a constant bearing, straight on Mercator: how a pilot
actually steered between two known points), `great-circle` (the shortest way: an ocean crossing with
no intermediate fix), or `spline` (a smooth curve through every waypoint: the broad brush, for a
coasting run or a route drawn by the winds).

## The record

Each piece of text is written once, in `data/voyages/`: a voyage in `<id>.json` (`index.json` gives the
menu order: chronological by start year, a voyage's own sub-voyages kept together in date order), each
person's death in `people.json`, each source in `sources.json`. `readVoyage` in
`scripts/voyages.mjs` puts a voyage together and `problems` beside it is the schema;
`node scripts/check-voyages.mjs` checks every record and that each sea leg stays at sea.

Two conventions the checks cannot see: where a source says a person died at sea or on the way but gives
no place, the skull stands at the middle of the leg it must have happened on and the death's `text` says
so; and an `alternative` is another place of death, never of burial.

A traveller whose road splits into journeys has the whole road in one file and each journey in its own
(`ibn-battuta` and `ibn-battuta-1` to `ibn-battuta-8`): the parts name the whole road's legs by `sameAs`, so a
course is drawn once. Where the traveller's own dates and a modern chronology differ, a leg's `dates` are the
modern one, and the journey's `summary` or the leg's `note` gives the traveller's. A leg scholars doubt (one the traveller may never have gone)
carries a `doubt`: who doubts it and why. An event may carry one too.

## What is drawn

Any number of voyages are drawn at once, each in its own ink: the first voyage on is the chart's red,
the rest get their own colours, and a colour picked for a voyage overrides them. Each leg is stroked
in its voyage's ink over a parchment halo, dashed by its confidence, with a dot at each leg's ends; the
line weight is one for all of them (Fine, Standard, Bold or Heavy). A death is a skull and crossbones,
and each of its `alternatives` a smaller, fainter skull tied to it by a thin dashed line in the
voyage's ink; an event or landfall is a ring. Nothing is lettered beside a mark: a click or tap on one, on any voyage that is on, opens a small tile
beside it with its heading, date, text and source, and the next touch of the map, Esc or the tile's ×
shuts it.

A doubted leg is drawn as sparse open rings in the voyage's ink, not a line, with a thought cloud nearby; a tap on the cloud opens the leg's tile, which opens with "Scholars doubt this
part:" and the doubt. A doubted event's mark is drawn at half its ink, and its tile opens the same way.

![The doubted Khanbaliq leg of Ibn Battuta's sixth journey: rings, and a cloud on empty land west of it](doubt-before-after.jpg)

The overlay rides in the link as `voyages=<id>[:rrggbb],...`, in the order chosen, a picked colour
after its id (`voyages=magellan,columbus,da-gama:16727a`), and `voyagewidth=<px>` when the weight is
not Standard. An older `voyage=<id>` link still opens, as a list of one.

## Migrations

A record with `"kind": "migration"` is the spread of a people rather than a course sailed by named ones:
`lapita-expansion` (the Bismarcks to Samoa, c. 1500–800 BC) and `east-polynesia-settlement` (the long pause,
then the burst across the Polynesian Triangle, c. 1000–1300). `who` may be empty, and each settled place is a
`waypoint` event whose tile carries its date and story. How it is drawn is in the header of `scripts/voyages.mjs`.

A migration's legs add three fields to the usual ones:

| Field | Values | What it sets |
| --- | --- | --- |
| `reach` | `[0, 0.85]` | how far along the whole spread the leg runs: 0 at the start, 1 at the furthest front |
| `heads` | `end`, `both`, `none` | where the ink chevrons go; `both` for a leg whose direction is unknown |
| `pause` | `true` | a long wait, drawn fainter with a dotted trail |

A branch is a leg that starts on another leg's waypoint.

![The Lapita expansion in red and the settlement of East Polynesia in blue](migrations.jpg)

![Zheng He's skull at the middle of the Calicut–Malacca leg, its tile open, the Calicut alternative beside the coast](zheng-he-alternatives.jpg)
