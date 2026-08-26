# The portolano format, version 1

A **portolano** is one JSON document holding simplified geographic geometry —
a coastline, a set of land polygons, a regional extract — together with enough
provenance to regenerate it exactly.

This document is normative. It exists so that a decoder written in another
language, against no JavaScript at all, can read a portolano correctly and
prove that it did. If your decoder disagrees with this file, this file is
wrong and it is a bug; open an issue.

**Where the pieces live.** `portolani` writes portolani. `coastlines` ships
generated ones. `coast-wright` reads and draws them in a browser. All three
implement what is written here; none of them owns it.

---

## 1. Document

```json
{
  "format": "portolano/1",
  "kind": "lines",
  "encoding": { "type": "polyline", "precision": 1, "order": "lon,lat" },
  "bounds": [-180, -85.6, 180, 83.5],
  "counts": { "shapes": 128, "rings": 128, "points": 2709 },
  "digest": "sha256:b62cff6…",
  "provenance": { "…": "§4" },
  "geometry": ["…", "…"]
}
```

| Member       | Type            | Required | Meaning |
| ------------ | --------------- | -------- | ------- |
| `format`     | string          | yes      | Exactly `"portolano/1"` for this version. A reader that does not recognise the value must refuse the document rather than guess. |
| `kind`       | string          | yes      | `"lines"` or `"polygons"`. Determines the shape of `geometry` (§2). |
| `encoding`   | object          | yes      | How to turn `geometry` back into degrees (§3). |
| `bounds`     | array \| null   | yes      | `[west, south, east, north]` in degrees, of the geometry actually present. `null` only when `geometry` is empty. |
| `counts`     | object          | yes      | `shapes`, `rings`, `points` — see §2. Redundant with the geometry, on purpose: it is what a decoder checks itself against. |
| `digest`     | string          | yes      | `"sha256:"` + lowercase hex, over `geometry` alone (§5). |
| `provenance` | object          | yes      | Where the geometry came from and what was done to it (§4). |
| `geometry`   | array           | yes      | The shapes (§2). |

Unknown members may be present. A reader must ignore members it does not
recognise rather than reject the document — that is how version 1 grows
without a version 2.

There is **no timestamp anywhere in a portolano**, and adding one is a
breaking change. Regenerating from the same source with the same knobs must
produce identical bytes; that is the entire argument for publishing the
generator. When the file was made is recorded by the commit that added it.

## 2. Geometry

Coordinates are always **`[longitude, latitude]`**, in that order, in degrees,
on WGS 84 (EPSG:4326). Longitude is in `[-180, 180]`, latitude in `[-90, 90]`.

> This is GeoJSON's order and GIS convention. It is **not** the order of
> Google's encoded-polyline format, which the encoding in §3 is otherwise
> identical to and which stores `[lat, lng]`. If you are porting a polyline
> decoder you already have, this is the line to change, and it is the reason
> the fixtures in §6 lead with a point that is nonsense when swapped.

### `kind: "lines"`

`geometry` is an array of encoded strings. Each is one open chain of at least
two points. Chains are not closed and must not be closed by the reader; a
chain whose first and last point coincide is a closed loop the source drew
that way (an island's coastline), and it is still stroked, not filled.

```json
"geometry": ["fE?g@Eg@HwBK", "oKoKg@g@g@f@"]
```

`counts.shapes` and `counts.rings` are both the number of strings.

### `kind: "polygons"`

`geometry` is an array of **polygons**. Each polygon is an array of encoded
strings: the first is the outer ring, the rest are holes.

```json
"geometry": [["outer", "hole", "hole"], ["outer"]]
```

Every ring, outer or hole, is **closed**: its last point equals its first, and
it has at least four points. Ring winding order is **not** specified —
a filler must use the even-odd rule, or treat rings after the first as holes
by position, and must not infer holes from winding.

`counts.shapes` is the number of polygons; `counts.rings` is the total number
of rings across all of them.

`counts.points` is the total number of coordinate pairs, counting a closed
ring's repeated final point once (it is one pair on the wire).

### Antimeridian and poles

A portolano stores exactly what the source held, clipped to `provenance.
options.bbox` if one was given. It does **not** promise that shapes avoid the
antimeridian, and it does not split them there beyond what a wrapping `bbox`
already implies.

Two consequences a renderer must handle and a portolano will not do for it:

- **A segment spanning more than half the world is a seam artefact, not a
  line.** Two points a tenth of a degree apart on the ground can be 360 apart
  in the numbers. Drop such segments rather than draw them.
- **A polygon may run along a pole.** Natural Earth's Antarctica is a closed
  ring whose southern edge lies at latitude −90 spanning the full 360 of
  longitude. It fills correctly in an equirectangular projection and needs
  care in an azimuthal one.

## 3. Encoding

`encoding` describes how a string becomes coordinates.

| Member      | Value |
| ----------- | ----- |
| `type`      | `"polyline"` — the only value in version 1. |
| `precision` | Non-negative integer. The number of decimal places kept. Divide the decoded fixed-point integers by `10 ** precision`. |
| `order`     | `"lon,lat"` — the only value in version 1. Present so a decoder can assert on it rather than trust a spec it may not have read. |

The algorithm is Google's [encoded polyline algorithm][gpoly], applied to
`[x, y] = [round(lon × 10^p), round(lat × 10^p)]`:

[gpoly]: https://developers.google.com/maps/documentation/utilities/polylinealgorithm

1. Take the delta from the previous coordinate on that axis (the previous
   coordinate is `(0, 0)` at the start of **every** ring — see below).
2. Left-shift by one; if the original delta was negative, invert all bits.
3. Emit five bits at a time, least significant first; set bit 0x20 on every
   chunk but the last; add 63 to each and write it as an ASCII character.
4. Write the `x` varint, then the `y` varint, for each coordinate in turn.

**Deltas restart at the origin for every ring.** A ring is independently
decodable: you can decode the fourth string in the file without touching the
first three, and a corrupt ring costs you that ring rather than the rest of
the document.

Every emitted character is in the range `0x3f`–`0x7e` (`?` to `~`).

> **`0x5c` is in that range, and it is a backslash.** A portolano is JSON, so
> a backslash in a string is written `\\` on the wire and your JSON reader
> must unescape it. Decoders that read the file with a hand-rolled parser get
> this wrong and the failure is silent until the one ring containing a −1.5°
> delta draws wrong. §6 ships a fixture for exactly this.

The double-quote character `0x22` is **not** in the range, so a portolano's
geometry strings never need quote escaping.

### Consecutive duplicate points

After rounding to `precision`, two consecutive source points may land on the
same fixed-point coordinate. A writer **should** drop the duplicate, except
where it is the point that closes a ring. A reader **must** accept a zero
delta anyway: it is legal, encodes as `"?"`, and a decoder that skips it will
lose the closing point of a ring.

## 4. Provenance

```json
"provenance": {
  "generator": { "name": "portolani", "version": "0.1.0" },
  "source": {
    "id": "ne_110m_coastline",
    "url": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_coastline.geojson",
    "ref": "v5.1.2",
    "sha256": "sha256:…",
    "bytes": 139907,
    "license": "public domain",
    "attribution": "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com"
  },
  "options": {
    "kind": "lines",
    "tolerance": 0.25,
    "precision": 1,
    "minExtent": 1,
    "bbox": null
  }
}
```

`source.sha256` is over the **raw fetched bytes**, before any parsing. It is
what makes the provenance verifiable rather than decorative: a URL can be
rewritten in place, a digest cannot.

`options` records every knob that affected the output, so that

```
portolani --source <id> --ref <ref> --kind <kind> \
          --tolerance <t> --precision <p> --min-extent <m> [--bbox <b>]
```

reconstructs the file. `bbox` is `null` or `[west, south, east, north]`;
`west > east` means the box wraps the antimeridian.

`license` and `attribution` may be `null` when the source is a local file or
an arbitrary URL, where the generator has nothing to go on. They are not
legal advice: the obligations of the source dataset travel with the data
whether or not this block records them.

A consumer that redistributes generated portolani — `coastlines` is the
motivating case — must carry this block through unchanged. A generated
dataset whose link back to its generator and source is not machine-checkable
is just a file somebody made once.

## 5. Digest

```
digest = "sha256:" + hex(sha256(utf8(compact_json(geometry))))
```

where `compact_json` is JSON with no whitespace between tokens, arrays in
document order, and strings escaped as JSON requires. In JavaScript that is
`JSON.stringify(document.geometry)`; in Python, `json.dumps(doc["geometry"],
separators=(",", ":"), ensure_ascii=False)`.

It covers `geometry` and nothing else, so that adding a field to the metadata
does not invalidate a stamp recorded downstream. What it asserts is "these are
the same shapes" — the knobs that produced them are `provenance`'s job.

Note that the digest is over the *encoded* strings. Two decoders can agree on
the digest and still disagree about what the coordinates mean; that is what
§6 is for.

## 6. Fixtures

A generator may emit a companion fixtures document, `portolano-fixtures/1`,
for cross-language self-verification:

```json
{
  "format": "portolano-fixtures/1",
  "generator": { "name": "portolani", "version": "0.1.0" },
  "vectors": [
    {
      "name": "lon-lat-order",
      "note": "Decoded as [lat, lon] this is off the map: latitude 122 does not exist.",
      "precision": 1,
      "encoded": "…",
      "fixed": [[-1222, 375]],
      "degrees": [[-122.2, 37.5]]
    }
  ],
  "documents": [
    {
      "path": "coastline-110m.json",
      "kind": "lines",
      "precision": 1,
      "digest": "sha256:…",
      "counts": { "shapes": 128, "rings": 128, "points": 2709 },
      "bounds": [-180, -85.6, 180, 83.5],
      "firstPoints": [[-163.7, -78.6], [-163.1, -78.2], [-161.2, -78.4]]
    }
  ]
}
```

**A decoder in a new language passes when:**

1. Every `vectors[].encoded` decodes to `vectors[].fixed`, and dividing by
   `10 ** precision` gives `vectors[].degrees`.
2. For each entry in `documents`, decoding the named portolano reproduces its
   `counts` and `bounds`, and its first shape's first three coordinates equal
   `firstPoints`.
3. Recomputing the digest per §5 matches.

Check 1 catches sign and continuation-byte errors. Check 2 catches coordinate
order and precision errors, which check 3 cannot see. Run all three.

## 7. Conformance

A **reader** is conformant if it refuses a `format` it does not know, honours
`encoding.precision`, reads coordinates as `[lon, lat]`, treats `geometry`'s
nesting per `kind`, and passes §6.

A **writer** is conformant if it emits every required member of §1, restarts
deltas per ring, closes every polygon ring, records §4 truthfully, computes
§5 as specified, and emits no timestamp.

## 8. Changes

Version 1 is unreleased and may still change up to `portolani` 0.1.0's first
publication to npm. After that:

- New optional members may be added to `provenance`, `counts` or the document
  root without a version bump. Readers ignore what they do not know.
- Any change to `geometry`, `encoding`, `kind` semantics, or the digest
  definition takes a new `format` value.
