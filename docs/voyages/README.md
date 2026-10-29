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

A person in `people.json` is keyed by the name a voyage's `who` uses. Only the death is required: a
`death` marker, or `"unknown"`, or `"living": true` and no death for someone alive (no skull). Every other
field is optional:

```json
"Juan Sebastián Elcano": {
  "id": "juan-sebastian-elcano",
  "aka": ["Elkano", "del Cano"],
  "origin": "Basque, from Getaria",
  "role": ["navigator", "ship-owner"],
  "voyages": ["magellan"],
  "bio": "He brought the Victoria home in 1522, the first ship round the world, …",
  "portrait": { "file": "Juan_Sebastián_Elcano,_anonymous_19th_century_painting.jpg",
                "kind": "posthumous", "author": "Unknown", "date": "19th century",
                "licence": "Public domain", "note": "Museo Naval, Madrid; …" },
  "sources": ["https://en.wikipedia.org/wiki/Juan_Sebasti%C3%A1n_Elcano"],
  "born": { "lon": -2.2, "lat": 43.3, "date": "1486 or 1487", "place": "Getaria",
            "label": "Elcano born at Getaria, 1486 or 1487", "text": "His own will names Getaria. …",
            "known": "inferred", "source": "Wikipedia: Juan Sebastián Elcano",
            "cite": "juan-sebastian-elcano" },
  "death": { "…": "as before" }
}
```

Only the death is required; `personProblems` in `scripts/voyages.mjs` says the rest. Births and portraits
are data only for now: nothing draws them.

Two conventions the checks cannot see: where a source says a person died at sea or on the way but gives
no place, the skull stands at the middle of the leg it must have happened on and the death's `text` says
so; and an `alternative` is another place of death, never of burial.

## What is drawn

Any number of voyages are drawn at once, each in its own ink: the first voyage on is the chart's red,
the rest get their own colours, and a colour picked for a voyage overrides them. Each leg is stroked
in its voyage's ink over a parchment halo, dashed by its confidence, with a dot at each leg's ends; the
line weight is one for all of them (Fine, Standard, Bold or Heavy). A death is a skull and crossbones,
and each of its `alternatives` a smaller, fainter skull tied to it by a thin dashed line in the
voyage's ink; an event or landfall is a ring. Nothing is lettered beside a mark: a click or tap on one, on any voyage that is on, opens a small tile
beside it with its heading, date, text and source, and the next touch of the map, Esc or the tile's ×
shuts it.

The overlay rides in the link as `voyages=<id>[:rrggbb],...`, in the order chosen, a picked colour
after its id (`voyages=magellan,columbus,da-gama:16727a`), and `voyagewidth=<px>` when the weight is
not Standard. An older `voyage=<id>` link still opens, as a list of one.

![Zheng He's skull at the middle of the Calicut–Malacca leg, its tile open, the Calicut alternative beside the coast](zheng-he-alternatives.jpg)
