# Voyages

A voyage overlay is a historical track drawn over the modern-geometry map, in any projection: the
reader picks one at a time (none by default) and the map draws its legs, graded by how well the
course is known, with a skull and crossbones where one of its people died. Historical interest and
education come before precision: where the course is unknown the line is an editorial broad brush,
a smooth curve the way the winds and currents would have taken a ship, and it says so by its stroke.

| Confidence | Stroke | Means |
|---|---|---|
| `attested` | solid | the course is recorded: a log, a journal, a pilot's roteiro, a named landfall every few days |
| `inferred` | dashed | the ends are known and the way between is worked out from the season's winds and currents, or from a later account |
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

- `legs[].mode`: `sea` or `land`. Every sample of a sea leg must be at sea on the Natural Earth 50m
  coast (`npm test` checks, `node scripts/check-voyages.mjs <id>` lists the samples that are not):
  a strait is followed by its waypoints, 25 km apart or closer where it is narrow.
- `legs[].points`: `[lon, lat]` pairs, first the departure, last the arrival. A `rhumb` or
  `great-circle` leg joins each consecutive pair; a `spline` leg curves through all of them.
- `legs[].source`: where the course comes from, in a few words; `sources[]` carries the full
  citations with URLs. `note` is free.
- `events[]`: `kind` is `death`, `landfall` or `event`; a death carries `who` and is drawn as a skull
  and crossbones with its label. Each of the voyage's named people has a death event, wherever it
  fell: on the track (Magellan at Mactan) or far from it (Columbus at Valladolid).

## What is drawn

Each leg is stroked in the chart's red ink over a parchment halo, dashed by its confidence, with a
dot at each leg's ends; a death is a skull and crossbones with its label beside it. The overlay rides
in the link as `voyage=<id>`.
