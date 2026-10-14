# Carta Marina

Olaus Magnus, *Carta Marina*, 1539. Scan: [Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/e/ea/Carta_Marina.jpeg),
5016 x 3715 px, public domain, sha256 `1fd3debb10d5f96ca117b0747c99dba8f17b9bc8d7543da68b03b19a1a7a0571`.

## Hills and mountains

![Scan crops beside the drawn relief](relief.png)

`relief.png` sets two crops of the scan, shown at half size, beside the relief `scripts/relief.mjs`
draws, at map size (one map pixel to one sheet pixel), in both styles, `marina` and `engraved`:

| Row | Scan crop, scan px (x0,y0)-(x1,y1) | Drawn view, zoom/lat/lon | Map crop, px (x, y, w, h) |
| --- | --- | --- | --- |
| The Scandian spine | (2200,1500)-(3000,2100) | 5/63/13 | 520, 480, 400, 300 |
| Norvegia, the lesser hills | (1850,1950)-(2650,2550) | 10/61/9 | 420, 330, 400, 300 |

The drawn views are rendered with the continents and Latin regions on and rivers and lakes in the Carta Marina style.
