// Notes on the charts laid over the map (#161): what the maker drew, what was really there, and where to read more.
// Each is a point-of-interest tile (page.js fillTile) with two anchors:
//   at.px     the figure on the scan, in px of the chart's full-size scan (overlays.json width x height), read by
//             eye, about +-40 px; the mark sits there through the overlay's own fit, so it stays on the figure as drawn
//   at.lonlat the real place, [lon, lat], or null where nothing is there
// NOTE_SETS holds one list per overlay id; the marks of a list show only while its overlay is laid.
import { applyFit } from './overlays.mjs';

// The Carta Marina, 1539 (#248). Quotations from the 1658 English Historia (public domain) are from the EarlyPrint
// transcription https://distantreader.org/stacks/earlyprint/txt/B26436.txt, spelling kept. at.lonlat is notional
// for the stockfish, the barnacle geese, the glutton, the bears, the falcons, the Kola banner, the reindeer and the
// skiers. Labels in capitals are read off the scan at low resolution. The Orkney Museums and Bell Library pages
// (all rights reserved) were read for facts only; no text is taken from them.
export const CARTA_MARINA_NOTES = [
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
  {
    id: 'polar-bears', title: 'Polar bears on the ice',
    drawn: '"VRSI ALBI": a white bear riding a floe of drift ice east of Iceland.',
    real: 'Polar bears do not live in Iceland, but they have been recorded visiting when sea ice carries them there.',
    source: { label: 'Polar bear, Wikipedia', url: 'https://en.wikipedia.org/wiki/Polar_bear' },
    at: { px: [1295, 610], lonlat: [-15.0, 66.5] },
  },
  {
    id: 'white-falcons', title: 'White falcons',
    drawn: '"FALCO ALBI": white falcons perched on the north of Iceland.',
    real: 'Gyrfalcons, the falconer\'s greatest prize: in European falconry they were kept for kings and nobles, and Scandinavian merchants traded them as far as Egypt and Baghdad.',
    source: { label: 'Gyrfalcon, Wikipedia', url: 'https://en.wikipedia.org/wiki/Gyrfalcon' },
    at: { px: [900, 230], lonlat: [-19.0, 65.0] },
  },
  {
    id: 'merchants-at-war', title: 'Merchants at war off Iceland',
    drawn: 'Ships of Hamburg, Bremen, Lübeck, Scotland and England round Iceland, two of them firing on each other.',
    real: 'English fishermen and German merchants fought over Iceland\'s fish in the 16th century. At Grindavík in 1532, 280 Germans stormed the English ship of John Breye and 15 died; the English were then put out of Iceland.',
    source: { label: 'Grindavík, Wikipedia', url: 'https://en.wikipedia.org/wiki/Grindav%C3%ADk' },
    at: { px: [440, 880], lonlat: [-22.43, 63.84] },
  },
  {
    id: 'greenland-edge', title: 'Greenland\'s edge',
    drawn: 'Two scraps of "Gruntlandia" along the top edge, north of Iceland and reaching toward Norway, with hooded men, upturned boats and floating logs.',
    real: 'Greenland lies west and north-west of Iceland, not in strips above Norway. Its Norse settlements had vanished by the late 15th century, a generation before the chart.',
    source: { label: 'Greenland, Wikipedia', url: 'https://en.wikipedia.org/wiki/Greenland' },
    at: { px: [190, 215], lonlat: [-37.64, 65.61] },
  },
  {
    id: 'hvitsark', title: 'Hvitsark',
    drawn: '"HVITSARK": a round rock west of Iceland, which the Historia puts half way to Greenland.',
    real: 'No island or rock lies there. What Olaus meant by the name is not settled.',
    source: { label: 'Carta marina, Swedish Wikipedia', url: 'https://sv.wikipedia.org/wiki/Carta_marina' },
    at: { px: [305, 395], lonlat: null },
  },
  {
    id: 'faroese-whale', title: 'Faroese whale feast',
    drawn: 'A stranded whale east of "FARE", men cutting it up, a piper beside them.',
    real: 'The Faroese grindadráp drives pilot whales ashore; the islands\' whaling goes back to the Norse settlement in the 9th century, and the drive is still held.',
    source: { label: 'Grindadráp, Wikipedia', url: 'https://en.wikipedia.org/wiki/Grindadr%C3%A1p' },
    at: { px: [1203, 1427], lonlat: [-6.80, 62.01] },
  },
  {
    id: 'whale-island', title: 'Whale mistaken for an island',
    drawn: 'Danish sailors moored on a whale\'s back, a fire lit, the beast about to dive and drown them.',
    real: 'A tale far older than the chart: the bestiaries\' aspidochelone, and Jasconius, the whale on which St Brendan\'s monks landed and made camp. No whale lies still long enough.',
    source: { label: 'Aspidochelone, Wikipedia', url: 'https://en.wikipedia.org/wiki/Aspidochelone' },
    at: { px: [1918, 665], lonlat: null },
  },
  {
    id: 'vardohus', title: 'Vardøhus',
    drawn: '"VARDAHVS": a walled house on Norway\'s far north-east shore.',
    real: 'Vardøhus Fortress. Haakon V built the first fort here in 1306, at Norway\'s edge toward Russia; the oldest surviving record of that border dates from 1326.',
    source: { label: 'Vardøhus Fortress, Wikipedia', url: 'https://en.wikipedia.org/wiki/Vard%C3%B8hus_Fortress' },
    at: { px: [3094, 267], lonlat: [31.09, 70.37] },
  },
  {
    id: 'sweden-banner', title: '"Thus far the realm of Sweden"',
    drawn: 'A red banner on a pole on the Arctic shore, "HVCVSQ EXTEDIT REGNV SVECIE": thus far reaches the kingdom of Sweden.',
    real: 'A claim, not a border. The Kola shore became Russia\'s, and Sweden has no Arctic coast today.',
    source: { label: 'Kola Peninsula, Wikipedia', url: 'https://en.wikipedia.org/wiki/Kola_Peninsula' },
    at: { px: [3785, 108], lonlat: [33.0, 69.0] },
  },
  {
    id: 'magnet-island', title: 'The magnet island',
    drawn: '"INSVLA MAGNETV" under "POLVS ARTICVS": an island at the pole, thought to draw the compass needle.',
    real: 'No island. The north magnetic pole was first reached in 1831, when James Clark Ross found it at Cape Adelaide on the Boothia Peninsula, far across the Arctic in what is now Canada.',
    source: { label: 'North magnetic pole, Wikipedia', url: 'https://en.wikipedia.org/wiki/North_magnetic_pole' },
    at: { px: [4318, 122], lonlat: null },
  },
  {
    id: 'birkarls', title: 'Birkarl traders',
    drawn: '"DOMVS BIRCARORVM": the houses of the Birkarls in Lapland, their chiefs drawn below.',
    real: 'The Birkarls, a small group of traders who held the Sámi trade and its taxes from 1328 until the Swedish crown took it over in the 1550s.',
    source: { label: 'Birkarls, Wikipedia', url: 'https://en.wikipedia.org/wiki/Birkarls' },
    at: { px: [2465, 825], lonlat: [24.15, 65.85] },
  },
  {
    id: 'tornio-market', title: 'Tornio market',
    drawn: '"EMPORIVM MAXIMVM" by Tornia, with bales of goods: a great market at the head of the Gulf of Bothnia.',
    real: 'Tornio, the Birkarls\' base and the trading place of the far north.',
    source: { label: 'Birkarls, Wikipedia', url: 'https://en.wikipedia.org/wiki/Birkarls' },
    at: { px: [3634, 749], lonlat: [24.15, 65.85] },
  },
  {
    id: 'reindeer-sleds', title: 'Reindeer sleds',
    drawn: 'Reindeer drawing a red-wheeled sled in "LAPPIA", and a herd, "GREX RANGIFERORVM".',
    real: 'Sámi reindeer herding, real then and now: semi-nomadic herders follow the reindeer, which give meat, fur and transport.',
    source: { label: 'Sámi people, Wikipedia', url: 'https://en.wikipedia.org/wiki/S%C3%A1mi_people' },
    at: { px: [2861, 815], lonlat: [23.0, 68.5] },
  },
  {
    id: 'skiers', title: 'Skiers of Scricfinnia',
    drawn: '"SCRICFINNIA", the land of the ski-running Finns, and a hunter on long skis with his bow.',
    real: 'The Sámi on skis. Norse speakers called them skridfinn, "skiing Finn", and Saxo still wrote of Skrid-Finns.',
    source: { label: 'Sámi people, Wikipedia', url: 'https://en.wikipedia.org/wiki/S%C3%A1mi_people' },
    at: { px: [2641, 1168], lonlat: [23.04, 69.0] },
  },
  {
    id: 'two-kings', title: 'War of the two kings',
    drawn: '"TENGILVS REX SCRICFINOR" on reindeer against "ARGRIMVS REX HELSINGORVM" on horses.',
    real: 'Legend, from the old histories Olaus drew on, not an event that can be dated or placed.',
    source: { label: '1658 Historia Book 5 (EarlyPrint)', url: 'https://distantreader.org/stacks/earlyprint/txt/B26436.txt' },
    at: { px: [3447, 288], lonlat: null },
  },
  {
    id: 'bothnian-seals', title: 'Seal hunting on the Bothnian ice',
    drawn: 'Men with spears on the floes of "MARE BOTNICV", among seals and bears.',
    real: 'The Gulf of Bothnia is nearly fresh and freezes over about five months every year, so the ice the hunters stand on is true; the bears out on it are the chart\'s.',
    source: { label: 'Gulf of Bothnia, Wikipedia', url: 'https://en.wikipedia.org/wiki/Gulf_of_Bothnia' },
    at: { px: [3547, 951], lonlat: [20.5, 63.0] },
  },
  {
    id: 'kvarken-ice', title: 'Across the Kvarken ice',
    drawn: '"QVERKEN": horse and reindeer sleds crossing the frozen gulf.',
    real: 'The Kvarken, the gulf\'s narrows, about 80 km wide. While Finland was part of Sweden the mail was often carried across when the sea froze from coast to coast.',
    source: { label: 'Kvarken, Wikipedia', url: 'https://en.wikipedia.org/wiki/Kvarken' },
    at: { px: [3307, 1438], lonlat: [21.0, 63.6] },
  },
];

// The Catalan Atlas, sheet 5 (File:Catalan_Atlas_BNF,_sheet_5.jpg, 6454 x 15862), the Atlantic edge of its
// westernmost panel. Quoted legends are the Cresques Project's English translations of panel III
// (https://www.cresquesproject.net/catalan-atlas-legends/panel-iii), cited by their numbers there; the island names
// are read off the scan. at.lonlat is notional for the tents and the cape of Africa.
export const CATALAN_NOTES = [
  {
    id: 'irish-wonders', title: 'The wonders of Ireland',
    drawn: 'A legend west of Ireland (III.1): of its many islands, "a small one where men never die", for they are carried off it to die; no snakes, frogs or poisonous spiders; and "trees that attract birds like ripe figs".',
    real: 'Gerald of Wales\'s Topography of Ireland, about 1188, which the legend follows: the island of the living is Monaincha, a bog island near Roscrea. Ireland truly has no native snakes; the sea cut it off before they came back after the Ice Age.',
    source: { label: 'Cresques Project III.1; Monaincha', url: 'https://en.wikipedia.org/wiki/Monaincha' },
    at: { px: [3400, 3600], lonlat: [-7.80, 52.95] },
  },
  {
    id: 'stillanda', title: 'Stillanda',
    drawn: 'A dark island at the top of the sheet, north-east of the Irish legend, "Island of Stillanda, where they speak the language of Norway and are Christians" (III.2).',
    real: 'Iceland, or Shetland: both spoke Norse, were Christian and were under the Norwegian crown in 1375. Iceland lies north-west of where the fit puts the drawing.',
    source: { label: 'Cresques Project III.2; Iceland', url: 'https://en.wikipedia.org/wiki/Iceland' },
    at: { px: [5520, 1680], lonlat: [-19.0, 64.9] },
  },
  {
    id: 'brasil', title: 'Brasil',
    drawn: 'A round purple island west of Ireland, a ring of land round a dotted middle.',
    real: 'Nothing: open Atlantic. Hy-Brasil sat on charts from the 1320s, always round and always west of Ireland; Bristol ships went looking for it in the 1480s, and it left the charts only in the 1800s.',
    source: { label: 'Brasil (mythical island), Wikipedia', url: 'https://en.wikipedia.org/wiki/Brasil_(mythical_island)' },
    at: { px: [4240, 4780], lonlat: null },
  },
  {
    id: 'corvi-marini', title: 'The island of sea crows',
    drawn: 'A gilt island far out from Galicia, "insule de corvi marini", the islands of sea crows (cormorants).',
    real: 'Perhaps the Azores, 1,300 km further west, which the Portuguese reached only about 1427. Corvo, the smallest and most westerly, may take its name from these charts.',
    source: { label: 'Corvo Island, Wikipedia', url: 'https://en.wikipedia.org/wiki/Corvo_Island' },
    at: { px: [3253, 8908], lonlat: [-31.11, 39.70] },
  },
  {
    id: 'madeira', title: 'The island of timber',
    drawn: 'A gilt half-disc, "insula de legname", the island of timber, with Porto Santo above and the Desertas below.',
    real: 'Madeira, Portuguese for wood. Empty of people in 1375; Zarco and Teixeira claimed it for Portugal in 1419–20 and the settlers burned much of the forest.',
    source: { label: 'Madeira, Wikipedia', url: 'https://en.wikipedia.org/wiki/Madeira' },
    at: { px: [3220, 11980], lonlat: [-16.95, 32.75] },
  },
  {
    id: 'fortunate-isles', title: 'The Fortunate Isles',
    drawn: 'A long legend, upside down to the chart, on the islands "called fortunate because they are replete with all sorts of goods", among them the goat and dog islands; it calls the pagans\' belief that they are paradise a fable (III.4).',
    real: 'The Canaries, home of the Guanches. The names are Pliny\'s, after King Juba\'s men, who found big dogs on Canaria; Ptolemy ran his prime meridian through the islands.',
    source: { label: 'Cresques Project III.4; Canary Islands', url: 'https://en.wikipedia.org/wiki/Canary_Islands' },
    at: { px: [1200, 10900], lonlat: [-15.6, 28.1] },
  },
  {
    id: 'isle-of-hell', title: 'The isle of hell',
    drawn: 'A red island with a white peak, lettered the isle of hell.',
    real: 'Tenerife and Teide, 3,715 m, the highest peak in Spain and an active volcano: the Guanches held that Guayota, their devil, lived inside it. Columbus saw it erupt in 1492.',
    source: { label: 'Teide, Wikipedia', url: 'https://en.wikipedia.org/wiki/Teide' },
    at: { px: [2760, 13870], lonlat: [-16.64, 28.27] },
  },
  {
    id: 'lanzarote', title: 'Lanzarotto\'s island',
    drawn: 'A dark island with a red cross, the arms of Genoa: "insula de lanzaroto maloxelo".',
    real: 'Lanzarote, still named after Lanzarotto Malocello, a Genoese who landed there about 1312 and stayed some twenty years, until the islanders drove him out.',
    source: { label: 'Lanzarotto Malocello, Wikipedia', url: 'https://en.wikipedia.org/wiki/Lanzarotto_Malocello' },
    at: { px: [4140, 13380], lonlat: [-13.63, 29.05] },
  },
  {
    id: 'jaume-ferrer', title: 'Jaume Ferrer\'s ship',
    drawn: 'A ship under the red and gold of Majorca: "The ship of Jaume Ferrer departed for the River of Gold on the 10th of August of 1346, the feast of St. Lawrence" (III.5).',
    real: 'Ferrer, a Majorcan, sailed south past the Canaries for the gold of West Africa and was never heard of again. No ship is known to have passed Cape Bojador and come back until Gil Eanes in 1434.',
    source: { label: 'Cresques Project III.5; Jaume Ferrer', url: 'https://en.wikipedia.org/wiki/Jaume_Ferrer' },
    at: { px: [3000, 15000], lonlat: null },
  },
  {
    id: 'finisterre-of-africa', title: 'The western end of Africa',
    drawn: 'A legend under the coast: "Here starts Africa, which ends in Alexandria and Babylon", a cape at the world\'s western end, with ivory from its many elephants (III.6).',
    real: 'The coast runs on another 3,000 km south to Cape Verde. North Africa\'s own elephants had died out by Roman times; the ivory came across the Sahara from the south.',
    source: { label: 'Cresques Project III.6; North African elephant', url: 'https://en.wikipedia.org/wiki/North_African_elephant' },
    at: { px: [4800, 15000], lonlat: [-14.5, 26.13] },
  },
  {
    id: 'tents', title: 'The tents of Gozola',
    drawn: 'Black tents with gold finials under "GOZOLA". The panel\'s legend of the desert peoples: veiled so only their eyes show, they live in tents and ride camels (III.11).',
    real: 'The Gazula, Berbers of the Sous and the Anti-Atlas, on the caravan road south from Morocco; veiling was the mark of the Sanhaja and the Tuareg men of the desert.',
    source: { label: 'Cresques Project III.11; Tuareg people', url: 'https://en.wikipedia.org/wiki/Tuareg_people' },
    at: { px: [5200, 14120], lonlat: [-10.06, 28.99] },
  },
];

// Each overlay's notes and the size of the scan their px are read off.
export const NOTE_SETS = {
  'carta-marina': { scan: { w: 5016, h: 3715 }, notes: CARTA_MARINA_NOTES },
  'catalan-atlas': { scan: { w: 6454, h: 15862 }, notes: CATALAN_NOTES },
};

// The marks of a laid overlay's notes through the view's projection: [{ x, y, h, tile }] in canvas px, the
// tile in the shape page.js fillTile takes. The scan px goes through the piece (overlays.json) that holds it.
// Nothing for an overlay with no notes, or none laid, so the notes are hidden with the scan.
export const NOTE_H = 20;
export function noteMarks(overlay, proj, rect) {
  const set = overlay && NOTE_SETS[overlay.id];
  if (!set) return [];
  const out = [];
  for (const n of set.notes) {
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
