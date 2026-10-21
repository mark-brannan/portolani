// Notes on the Carta Marina (#248): what the maker drew, what was really there, and where to read more.
// Each is a point-of-interest tile (page.js fillTile) with two anchors:
//   at.px     the figure on the scan, in px of File:Carta_Marina.jpeg (5016 x 3715), read by eye, about +-40 px;
//             the mark sits there through the overlay's own fit, so it stays on the figure as drawn
//   at.lonlat the real place, [lon, lat], or null where nothing is there; notional for 3, 8 and 10
// Quotations from the 1658 English Historia (public domain) are from the EarlyPrint transcription
// https://distantreader.org/stacks/earlyprint/txt/B26436.txt, spelling kept. The marks show only while the overlay is on.
import { applyFit } from './overlays.mjs';

export const NOTES_OVERLAY = 'carta-marina';
export const NOTES_SCAN = { w: 5016, h: 3715 };

export const NOTES = [
  {
    id: 'maelstrom', title: 'The maelstrom',
    drawn: 'A whirlpool swallowing a ship off Lofoten, "HEC EST HORRENDA CARIBDIS".',
    real: 'Moskstraumen: tidal eddies and small whirlpools between Lofotodden and Mosken; no single giant whirlpool.',
    source: { label: 'Moskstraumen, Wikipedia (CC BY-SA 4.0)', url: 'https://en.wikipedia.org/wiki/Moskstraumen' },
    at: { px: [2154, 852], lonlat: [12.83, 67.80] },
  },
  {
    id: 'sea-serpent', title: 'The sea serpent',
    drawn: 'A red serpent coiled round a ship, taking a sailor, off Helgeland. The key: "A worm 200 feet long wrapping itself around a big ship and destroying it."',
    real: 'No such animal. The Historia puts it in caves near Bergen, far south of where the chart draws it.',
    source: { label: 'Public Domain Review (CC BY-SA 4.0)', url: 'https://publicdomainreview.org/2014/02/05/olaus-magnuss-sea-serpent/' },
    at: { px: [1810, 1050], lonlat: [5.32, 60.39] },
  },
  {
    id: 'lofoten-stockfish', title: 'Lofoten stockfish',
    drawn: 'Bundles of dried fish: "HIC FORUM PISCIUM FREQUENTISSIMUM", the busiest fish market.',
    real: 'Lofoten\'s winter cod fishery. Olaus: the fish are dried in the wind, piled "like great Piles of Wood" and shipped to Bergen, "the most famous Mart-Town of all Norway". Vågan, near Kabelvåg, was northern Norway\'s first town.',
    source: { label: '1658 Historia Book 21; Lofoten', url: 'https://en.wikipedia.org/wiki/Lofoten' },
    at: { px: [2443, 965], lonlat: [14.56, 68.23] },
  },
  {
    id: 'hekla', title: 'Hekla',
    drawn: 'Burning mountains under "MONS HEKLA". Olaus: "on the top of them almost a perpetual Snow, and at the bottom a fire of Brimstone"; Iceland has a rock that "boils like to Mount Aetna", where "the place of Hell is, and of Purgatory".',
    real: 'Hekla, which medieval Icelanders called the Gateway to Hell. It erupted in 1510 (VEI 4), in Olaus\'s lifetime.',
    source: { label: '1658 Historia Book 2; Hekla', url: 'https://en.wikipedia.org/wiki/Hekla' },
    at: { px: [575, 645], lonlat: [-19.67, 63.99] },
  },
  {
    id: 'greenland-leather-boats', title: 'Leather boats of Greenland',
    drawn: 'Greenland "pirates" in "Leather-ships" who bore holes in merchants\' hulls from below. Olaus: "I saw two of these Leatherships in the year 1505", hung in St Halvard\'s cathedral.',
    real: 'Inuit kayaks and umiaks. The Norse settlements in Greenland were abandoned between 1350 and 1500.',
    source: { label: '1658 Historia Book 2 ch. 9; Norse settlements in Greenland', url: 'https://en.wikipedia.org/wiki/Norse_settlements_in_Greenland' },
    at: { px: [355, 195], lonlat: [-37.64, 65.61] },
  },
  {
    id: 'thule', title: 'Tile',
    drawn: 'An island between the Orkneys and the Faroes, "HEC THVLE HABET XXX MILIA POPVLI" (30,000 people).',
    real: 'Thule is Pytheas\'s land of about 330 BC, never found; read as Shetland, the Faroes, Iceland or Norway. No island lies here.',
    source: { label: 'Thule, Wikipedia', url: 'https://en.wikipedia.org/wiki/Thule' },
    at: { px: [562, 1708], lonlat: null },
  },
  {
    id: 'whale-and-orca', title: 'Whale and orca',
    drawn: 'A whale with her calf, attacked by an orca. Olaus: the orca "rents the Whales Guts, and tears his Calves body".',
    real: 'True to life: orcas hunting large whales often target the calves.',
    source: { label: '1658 Historia Book 21 ch. 7; Orca', url: 'https://en.wikipedia.org/wiki/Orca' },
    at: { px: [620, 1865], lonlat: null },
  },
  {
    id: 'barnacle-geese', title: 'Barnacle geese',
    drawn: 'Ducks growing on a tree; those that fall in the sea live. Olaus, after a Scots historian: "in the Orcades, Ducks breed of a certain Fruit falling into the Sea".',
    real: 'Barnacle geese breed in Svalbard and Greenland and winter in Scotland, so no one saw them nest; goose barnacles are crustaceans.',
    source: { label: '1658 Historia Book 19; Barnacle goose', url: 'https://en.wikipedia.org/wiki/Barnacle_goose' },
    at: { px: [1046, 2316], lonlat: [-3.0, 59.0] },
  },
  {
    id: 'white-lake', title: 'The White "Lake"',
    drawn: '"LACVS ALBVS": a closed lake of fish, birds and boats.',
    real: 'The White Sea, about 90,000 km², an inlet of the Barents Sea open through the Gorlo strait.',
    source: { label: 'White Sea, Wikipedia', url: 'https://en.wikipedia.org/wiki/White_Sea' },
    at: { px: [4369, 641], lonlat: [37.5, 65.5] },
  },
  {
    id: 'glutton', title: 'The glutton',
    drawn: '"GVLONES": a beast that gorges, squeezes between two trees to empty itself, and eats again. Olaus: "the Gulo hath his name to be the principal" of the insatiable creatures; "in the German Language Vielfras".',
    real: 'The wolverine, mostly a scavenger. "Glutton" partly comes from a mishearing of Norwegian fjellfross as German Vielfraß.',
    source: { label: '1658 Historia Book 18 ch. 5; Wolverine', url: 'https://en.wikipedia.org/wiki/Wolverine' },
    at: { px: [2716, 1045], lonlat: [15.0, 67.0] },
  },
];

// The marks of a laid overlay's notes through the view's projection: [{ x, y, h, tile }] in canvas px, the
// tile in the shape page.js fillTile takes. The scan px goes through the piece (overlays.json) that holds it.
// Nothing for any overlay but the Carta Marina, so the notes are hidden with the scan.
export const NOTE_H = 20;
export function noteMarks(overlay, proj, rect) {
  if (overlay?.id !== NOTES_OVERLAY) return [];
  const out = [];
  for (const n of NOTES) {
    const [px, py] = n.at.px;
    const piece = overlay.pieces.find((p) => px >= p.x0 && px < p.x1) ?? overlay.pieces.at(-1);
    const [lon, lat] = applyFit(piece.fit, px, py);
    if (proj.visible && !proj.visible(lon, lat)) continue;
    const [x, y] = proj.toPx([lon, lat]);
    if (Number.isFinite(x) && Number.isFinite(y) && x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) {
      out.push({ x, y, h: NOTE_H, tile: { title: n.title, drawn: n.drawn, real: n.real, source: n.source.label, link: n.source.url } });
    }
  }
  return out;
}
