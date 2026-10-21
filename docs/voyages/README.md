# Voyages

A voyage overlay is a historical track drawn over the modern-geometry map, in any projection: the
reader picks one at a time (none by default) and the map draws its legs, graded by how well the
course is known, with a skull and crossbones where one of its people died. Historical interest and
education come before precision: where the course is unknown the line is an editorial broad brush,
a smooth curve the way the winds and currents would have taken a ship, and it says so by its stroke.

| Confidence | Stroke | Means |
|---|---|---|
| `attested` | solid | the course is recorded: a log, a journal, a pilot's roteiro, a named landfall every few days |
| `inferred` | dashed | ends known; the way between worked out from winds and currents, or a later account |
| `conventional` | dotted | the way scholars usually draw it; the sources do not say |

Each leg is joined one of three ways: `rhumb` (a constant bearing, straight on Mercator: how a pilot
actually steered between two known points), `great-circle` (the shortest way: an ocean crossing with
no intermediate fix), or `spline` (a smooth curve through every waypoint: the broad brush, for a
coasting run or a route drawn by the winds). Longitudes are plain degrees in [-180, 180]; a leg that
crosses the date line just lists its points in order, and `scripts/voyages.mjs` makes the longitude
continuous and cuts the stroke at the map's seam.

## The record

One file per voyage, `data/voyages/<id>.json`; `data/voyages/index.json` lists the ids in menu order.

```json
{
  "id": "magellan",
  "title": "Magellan and Elcano round the world, 1519–22",
  "short": "Magellan–Elcano",
  "who": ["Ferdinand Magellan", "Juan Sebastián Elcano"],
  "when": "1519–1522",
  "summary": "Five ships out of Sanlúcar; one came home under Elcano, the first to sail round the world.",
  "sources": [
    { "title": "Antonio Pigafetta, Relazione del primo viaggio intorno al mondo (1524)", "url": "https://..." }
  ],
  "legs": [
    { "from": "Sanlúcar de Barrameda", "to": "Tenerife", "dates": "20–26 Sep 1519", "mode": "sea", "line": "rhumb",
      "confidence": "attested", "points": [[-6.35, 36.78], [-16.25, 28.47]], "source": "Pigafetta" },
    { "from": "Strait of Magellan", "to": "Guam", "dates": "28 Nov 1520 – 6 Mar 1521", "mode": "sea", "line": "spline",
      "confidence": "inferred", "points": [[-75.2, -52.6], [-78, -40], [-85, -20], [-110, -10], [-135, 0], [-160, 8], [175, 12], [144.8, 13.4]],
      "source": "Pigafetta's latitudes; the course between is the trade-wind route", "note": "no island seen but San Pablo and the Sharks" }
  ],
  "events": [
    { "kind": "death", "who": "Ferdinand Magellan", "lon": 123.97, "lat": 10.29, "date": "27 Apr 1521",
      "label": "Magellan killed at Mactan", "source": "Pigafetta" }
  ]
}
```

- `legs[].mode`: `sea` or `land`; a sea leg must stay at sea on the 50m coast (`npm test` checks it).
- `legs[].points`: `[lon, lat]` from departure to arrival; `spline` curves through all of them.
- `legs[].source`: where the course comes from, in a few words; full citations go in `sources[]`.
- `events[]`: `death`, `landfall` or `event`; each named person has a `death`, on or off the track (every voyage of the same person carries it).
- `deathUnknown`: names from `who` whose place of death nobody knows (Hanno, Pytheas, Nearchus); they get no skull, and a name may not be both here and in a `death`.
- `events[].text` (optional, on any event or alternative): the flavour text its tile shows, a sentence or two for a reader who has tapped the mark. `label` is the tile's heading, `date` its second line and `source` its foot.
- `events[].alternatives` (on a `death` only): other candidate places where the death is disputed, `[{ "lon", "lat", "place", "label", "text", "source" }]`. The event itself stays the usual account; an alternative is a place of death, never of burial.
- Where a source says a person died at sea or on the way but gives no place, the skull stands at the middle of the leg it must have happened on, and the event's `text` says so.

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

## Where each person died

The skull sits at the usual account; `alternatives` are the other places the sources or the scholars give. An em dash means no dispute is recorded.

| Person | Skull drawn | Alternatives | Sources |
|---|---|---|---|
| Leif Erikson | Brattahlíð, Greenland, c. 1020 (inferred: no saga records his death) | — | Leif Erikson (Wikipedia) |
| Marco Polo | Venice, 8 Jan 1324 | — | Wikipedia, Marco Polo |
| Ibn Battuta | Morocco near Fez (-5.00, 34.03), c. 1369 | Marrakesh (-7.99, 31.63) | Wikipedia, Ibn Battuta |
| Zheng He | At sea, mid-way along the Calicut–Malacca leg (87.54, 5.99), 1433 | Calicut (75.78, 11.25); Nanjing (118.78, 32.07) | Ming shi; Zheng He (Wikipedia) |
| Bartolomeu Dias | Off the Cape of Good Hope, 29 May 1500 (the position is a guess) | — | Wikipedia; Britannica 1911 |
| Christopher Columbus | Valladolid, 20 May 1506 | — (his burial place is disputed, his place of death is not) | Britannica 1911, Columbus |
| Vasco da Gama | Cochin, 24 Dec 1524 | — | Wikipedia, Vasco da Gama |
| Paulo da Gama | Angra, Terceira, 1499 | — | Barros; Correia |
| Ferdinand Magellan | Mactan, 27 Apr 1521 | — | Pigafetta |
| Juan Sebastián Elcano | At sea in the Pacific (-135.00, 1.00), 4 Aug 1526 | — (the position is a guess in mid-ocean) | Wikipedia, Juan Sebastián Elcano |
| Francis Drake | Off Portobelo, 28 Jan 1596 | — | Wikipedia, Francis Drake |
| Hanno the Navigator | none drawn (`deathUnknown`) | — | Hanno the Navigator (Wikipedia) |
| Pytheas | none drawn (`deathUnknown`) | — | Pytheas (Wikipedia) |
| Nearchus | none drawn (`deathUnknown`) | — | Nearchus (Wikipedia) |
| Phoenician mariners of Necho II | none drawn (`deathUnknown`) | — | Herodotus 4.42 |

The ancient voyages are told at second hand; every identification of a place on them is one scholarly guess among several.
