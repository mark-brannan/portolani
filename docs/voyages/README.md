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
person in `people.json`, each source in `sources.json`. `readVoyage` in `scripts/voyages.mjs` puts a
voyage together; `problems` and `checkPerson` beside it are the schema, and
`node scripts/check-voyages.mjs` checks every record and that each sea leg stays at sea.

A voyage names its people in `who`, slugs into `people.json` in order of prominence: the one has-relationship
between the two, and the only place it is written. There is no leader field; a voyage's title says whose it is,
and a crew member or a nameless company is a record like any other.

```json
"who": ["ferdinand-magellan", "juan-sebastian-elcano"]
```

A person is a record keyed by that slug. Nothing is required: what is there is checked, and what is not is
simply unknown. `name` is the display name, `aka` other names, `bio` a paragraph, `images` Wikimedia Commons
files credited as their file pages ask, `sources` ids into `sources.json`.

```json
"ferdinand-magellan": {
  "name": "Ferdinand Magellan",
  "bio": "A Portuguese officer of minor nobility who served the Crown in Asia, …",
  "images": [{ "file": "Retrato_de_Hernando_de_Magallanes.jpg", "kind": "posthumous", "author": "Unknown",
               "date": "1848", "licence": "Public domain", "note": "A copy after the Madrid portrait; …" }],
  "sources": ["ferdinand-magellan"],
  "born":  { "lon": -7.58, "lat": 41.27, "date": "c. 1480", "place": "Sabrosa, northern Portugal",
             "label": "Magellan born in northern Portugal, c. 1480", "text": "…", "confidence": "inferred",
             "source": "Wikipedia: Ferdinand Magellan", "cite": "ferdinand-magellan",
             "alternatives": [{ "lon": -8.42, "lat": 41.8, "place": "Ponte da Barca",
                                "label": "Born at Ponte da Barca", "source": "Wikidata" }] },
  "death": { "lon": 123.97, "lat": 10.29, "date": "27 Apr 1521", "label": "Magellan killed at Mactan",
             "source": "Pigafetta", "cite": "battle-of-mactan", "text": "…" }
}
```

A marker is one shape for `events`, `born`, `death` and `alternatives`; the fields are in the `checkPerson`
header. The coordinates are where the mark stands, not a claim of exactness:

| the death record has | drawn | means |
|---|---|---|
| lon, lat, `confidence: attested` | skull | the place is recorded |
| lon, lat, `conventional` | skull | the mid-leg or mid-ocean convention below |
| lon, lat, `speculative` | skull | one guess among several, `alternatives` beside it |
| a date, a sentence, no lon and lat | nothing | nobody knows where; the record still has the date |

Births and images are data only for now: nothing draws them.

Two conventions the checks cannot see: where a source says a person died at sea or on the way but gives
no place, the skull stands at the middle of the leg it must have happened on, its `confidence` is `conventional`
and the death's `text` says so; and an `alternative` is another place of death, never of burial.

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

![Zheng He's skull at the middle of the Calicut–Malacca leg, its tile open, the Calicut alternative beside the coast](zheng-he-alternatives.jpg)
