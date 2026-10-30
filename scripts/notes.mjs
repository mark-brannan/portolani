// Notes on the charts laid over the map (#161): what the maker drew, what was really there, and where to read more.
// Each is a point-of-interest tile (page.js fillTile) with two anchors:
//   at.px     the figure on the scan, in px of the chart's full-size scan (overlays.json width x height), read by
//             eye, about +-40 px; the mark rides on the sheet wherever it lies (or on the warped piece that holds it), so it stays on the figure as drawn
//   at.lonlat the real place, [lon, lat], or null where nothing is there
// NOTE_SETS holds one list per overlay id; the marks of a list show only while its overlay is laid.
import { applyFit, sheetTransform } from './overlays.mjs';

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

// The Catalan Atlas, 1375: BnF sheets 5 to 12 laid side by side as one sheet (overlays.json `panels`). Every large
// figure on the eight pages is a note, the rulers first; a figure with no copy yet is a stub, its title alone, so
// the inner map is mostly clickable and nothing that could be a note waits on its wording. Quoted legends are the
// Cresques Project's English translations (https://www.cresquesproject.net/catalan-atlas-legends/panel-iii to
// panel-vi; panel III is sheets 5 and 6, IV sheets 7 and 8, V sheets 9 and 10, VI sheets 11 and 12), cited by their
// numbers there. Each note's px was read by eye on gridded crops of the Commons scans at a fifth to a tenth of full
// size, about +-100 px, and is given in its page's own scan px (`page`), which adds the page's offset in the open
// atlas. `size` is the figure's whole box in scan px, [w, h] round px, or a radius; `up` is which way the figure
// reads on the scan, degrees clockwise from the sheet's top (180 for one drawn upside down, as most of the far
// east is: the atlas was read from both sides of a table). at.lonlat is the real place, or null where it is notional.
// The page's offset: page n's own scan px plus this is the sheet's (each panel's x less the x it is cropped at).
export const CATALAN_PAGE_X = { 5: -288, 6: 5568, 7: 11424, 8: 17208, 9: 23120, 10: 29032, 11: 34808, 12: 40600 };
const page = (n, x, y) => [CATALAN_PAGE_X[n] + x, y];
// A figure with no copy yet: its title, where it is, its box and which way it faces. `drawn` may say what is
// drawn; with no `real` it needs no source.
const stub = (id, title, px, size, up = 0, drawn = '') => ({ id, title, drawn, real: '', at: { px, lonlat: null }, size, up });
const CRESQUES = (panel) => `https://www.cresquesproject.net/catalan-atlas-legends/panel-${panel}`;
const WIKI = (page) => `https://en.wikipedia.org/wiki/${page}`;

export const CATALAN_NOTES = [
  // Sheet 5: the Atlantic, Ireland to the Canaries
  {
    id: 'irish-wonders', title: 'The wonders of Ireland',
    drawn: 'A legend west of Ireland (III.1): of its many islands, "a small one where men never die", for they are carried off it to die; no snakes, frogs or poisonous spiders; and "trees that attract birds like ripe figs".',
    real: 'Gerald of Wales\'s Topography of Ireland, about 1188, which the legend follows: the island of the living is Monaincha, a bog island near Roscrea. Ireland truly has no native snakes; the sea cut it off before they came back after the Ice Age.',
    source: { label: 'Cresques Project III.1; Monaincha', url: WIKI('Monaincha') },
    at: { px: page(5, 3400, 3600), lonlat: [-7.80, 52.95] }, size: [2200, 800], up: 180,
  },
  {
    id: 'stillanda', title: 'Stillanda',
    drawn: 'A dark island at the top of the sheet, north-east of the Irish legend, "Island of Stillanda, where they speak the language of Norway and are Christians" (III.2).',
    real: 'Iceland, or Shetland: both spoke Norse, were Christian and were under the Norwegian crown in 1375. Iceland lies north-west of where the fit puts the drawing.',
    source: { label: 'Cresques Project III.2; Iceland', url: WIKI('Iceland') },
    at: { px: page(5, 5300, 1550), lonlat: [-19.0, 64.9] }, size: [900, 600], up: 0,
  },
  {
    id: 'brasil', title: 'Brasil',
    drawn: 'A round purple island west of Ireland, a ring of land round a dotted middle.',
    real: 'Nothing: open Atlantic. Hy-Brasil sat on charts from the 1320s, always round and always west of Ireland; Bristol ships went looking for it in the 1480s, and it left the charts only in the 1800s.',
    source: { label: 'Brasil (mythical island), Wikipedia', url: WIKI('Brasil_(mythical_island)') },
    at: { px: page(5, 4240, 4780), lonlat: null }, size: 260, up: 0,
  },
  {
    id: 'corvi-marini', title: 'The island of sea crows',
    drawn: 'A gilt island far out from Galicia, "insule de corvi marini", the islands of sea crows (cormorants).',
    real: 'Perhaps the Azores, 1,300 km further west, which the Portuguese reached only about 1427. Corvo, the smallest and most westerly, may take its name from these charts.',
    source: { label: 'Corvo Island, Wikipedia', url: WIKI('Corvo_Island') },
    at: { px: page(5, 3253, 8908), lonlat: [-31.11, 39.70] }, size: [800, 500], up: 0,
  },
  {
    id: 'madeira', title: 'The island of timber',
    drawn: 'A gilt half-disc, "insula de legname", the island of timber, with Porto Santo above and the Desertas below.',
    real: 'Madeira, Portuguese for wood. Empty of people in 1375; Zarco and Teixeira claimed it for Portugal in 1419–20 and the settlers burned much of the forest.',
    source: { label: 'Madeira, Wikipedia', url: WIKI('Madeira') },
    at: { px: page(5, 3220, 11980), lonlat: [-16.95, 32.75] }, size: [700, 600], up: 0,
  },
  {
    id: 'fortunate-isles', title: 'The Fortunate Isles',
    drawn: 'A long legend, upside down to the chart, on the islands "called fortunate because they are replete with all sorts of goods", among them the goat and dog islands; it calls the pagans\' belief that they are paradise a fable (III.4).',
    real: 'The Canaries, home of the Guanches. The names are Pliny\'s, after King Juba\'s men, who found big dogs on Canaria; Ptolemy ran his prime meridian through the islands.',
    source: { label: 'Cresques Project III.4; Canary Islands', url: WIKI('Canary_Islands') },
    at: { px: page(5, 1100, 11000), lonlat: [-15.6, 28.1] }, size: [1900, 3800], up: 180,
  },
  {
    id: 'isle-of-hell', title: 'The isle of hell',
    drawn: 'A red island with a white peak, lettered the isle of hell.',
    real: 'Tenerife and Teide, 3,715 m, the highest peak in Spain and an active volcano: the Guanches held that Guayota, their devil, lived inside it. Columbus saw it erupt in 1492.',
    source: { label: 'Teide, Wikipedia', url: WIKI('Teide') },
    at: { px: page(5, 2760, 13870), lonlat: [-16.64, 28.27] }, size: [500, 400], up: 0,
  },
  {
    id: 'lanzarote', title: 'Lanzarotto\'s island',
    drawn: 'A dark island with a red cross, the arms of Genoa: "insula de lanzaroto maloxelo".',
    real: 'Lanzarote, still named after Lanzarotto Malocello, a Genoese who landed there about 1312 and stayed some twenty years, until the islanders drove him out.',
    source: { label: 'Lanzarotto Malocello, Wikipedia', url: WIKI('Lanzarotto_Malocello') },
    at: { px: page(5, 4140, 13300), lonlat: [-13.63, 29.05] }, size: [600, 500], up: 0,
  },
  {
    id: 'jaume-ferrer', title: 'Jaume Ferrer\'s ship',
    drawn: 'A ship under the red and gold of Majorca: "The ship of Jaume Ferrer departed for the River of Gold on the 10th of August of 1346, the feast of St. Lawrence" (III.5).',
    real: 'Ferrer, a Majorcan, sailed south past the Canaries for the gold of West Africa and was never heard of again. No ship is known to have passed Cape Bojador and come back until Gil Eanes in 1434.',
    source: { label: 'Cresques Project III.5; Jaume Ferrer', url: WIKI('Jaume_Ferrer') },
    at: { px: page(5, 2900, 14900), lonlat: null }, size: [1900, 1200], up: 0,
  },
  {
    id: 'finisterre-of-africa', title: 'The western end of Africa',
    drawn: 'A legend under the coast: "Here starts Africa, which ends in Alexandria and Babylon", a cape at the world\'s western end, with ivory from its many elephants (III.6).',
    real: 'The coast runs on another 3,000 km south to Cape Verde. North Africa\'s own elephants had died out by Roman times; the ivory came across the Sahara from the south.',
    source: { label: 'Cresques Project III.6; North African elephant', url: WIKI('North_African_elephant') },
    at: { px: page(5, 4800, 15050), lonlat: [-14.5, 26.13] }, size: [1900, 600], up: 0,
  },
  {
    id: 'tents', title: 'The tents of Gozola',
    drawn: 'Black tents with gold finials under "GOZOLA". The panel\'s legend of the desert peoples: veiled so only their eyes show, they live in tents and ride camels (III.11).',
    real: 'The Gazula, Berbers of the Sous and the Anti-Atlas, on the caravan road south from Morocco; veiling was the mark of the Sanhaja and the Tuareg men of the desert.',
    source: { label: 'Cresques Project III.11; Tuareg people', url: WIKI('Tuareg_people') },
    at: { px: page(5, 5200, 14100), lonlat: [-10.06, 28.99] }, size: [1500, 1300], up: 0,
  },
  {
    id: 'catalan-rose', title: 'The first compass rose',
    drawn: 'A star of eight winds in gold, red and blue inside a ring, the winds\' names lettered round it, alone in the open Atlantic.',
    real: 'The earliest known compass rose on a chart. Later charts drew one at the hub of every web of rhumb lines.',
    source: { label: 'Catalan Atlas, Wikipedia', url: WIKI('Catalan_Atlas') },
    at: { px: page(5, 2000, 8000), lonlat: null }, size: 760, up: 0,
  },
  stub('atlantic-gilt-lettering', 'Gilt lettering in the Atlantic', page(5, 2400, 5600), [2000, 320], 180),
  stub('ireland-flag', 'A flag in Ireland', page(5, 5550, 4250), 260),
  stub('canary-purple', 'A purple island', page(5, 3150, 13950), [500, 350]),
  stub('canary-green', 'A green island', page(5, 3650, 13800), [500, 350]),
  stub('canary-blue', 'A blue island', page(5, 1950, 14200), [400, 350]),
  stub('gozola-town', 'A town on the African coast', page(5, 4300, 14350), [700, 600]),
  stub('ocean-sea', 'The Ocean Sea', page(5, 2600, 6500), [4600, 5000]),

  // Sheet 6: Iberia, England, Norway, the western Mediterranean and Mali
  {
    id: 'mansa-musa', title: 'Mansa Musa',
    drawn: 'A black king, crowned in gold, on a throne, a gold nugget held up in one hand and a gold sceptre in the other. The legend (III.10): "This black Lord is called Musse Melly and is the sovereign of the land of the negroes of Gineva. This king is the richest and noblest of all these lands due to the abundance of gold that is extracted from his lands."',
    real: 'Mansa Musa of Mali died in the 1330s, some forty years before the atlas. His pilgrimage to Mecca in 1324, with so much gold that its price fell in Cairo, made him famous in Europe. In 1375 Mali was ruled by Musa II, and its gold came from the fields of Bambuk and Bure.',
    source: { label: 'Cresques Project III.10; Mansa Musa', url: WIKI('Mansa_Musa') },
    at: { px: page(6, 3900, 14150), lonlat: null }, size: [1300, 1800], up: 0,
  },
  {
    id: 'veiled-rider', title: 'The veiled camel rider',
    drawn: 'A man veiled to the eyes in a white turban and a green robe, riding a camel. Beside him the legend of the desert peoples (III.11): "All this land is populated by people who cover themselves such that only their eyes can be seen; they live in tents and ride in camels."',
    real: 'The Tuareg and the Sanhaja of the Sahara, where the men, not the women, wear the veil. Their camel caravans carried salt south and gold north.',
    source: { label: 'Cresques Project III.11; Tuareg people', url: WIKI('Tuareg_people') },
    at: { px: page(6, 1100, 14200), lonlat: null }, size: [1600, 2100], up: 0,
  },
  {
    id: 'atlas-mountains', title: 'The Atlas Mountains',
    drawn: 'A long gilt-brown range across North Africa. The legend (III.8): "All this mountain range is called Carena by the Saracens and Claris Mountains by the Christians", with good cities and castles at war with each other, and bread, wine and oil.',
    real: 'The Atlas, from Morocco through Algeria to Tunisia; Toubkal, 4,167 m, is the highest peak. In 1375 the Marinids, the Zayyanids and the Hafsids shared the lands round it.',
    source: { label: 'Cresques Project III.8; Atlas Mountains', url: WIKI('Atlas_Mountains') },
    at: { px: page(6, 2600, 11700), lonlat: [-7.9, 31.1] }, size: [4400, 1400], up: 0,
  },
  {
    id: 'valley-of-darcha', title: 'The valley of Darcha',
    drawn: 'A legend at the west end of the range (III.9): "The merchants that enter the land of the negroes of Gineva pass through this place; this pass is called Valley of Darcha."',
    real: 'The Draa valley in southern Morocco, the road of the caravans south across the Sahara to the gold of the Sudan.',
    source: { label: 'Cresques Project III.9; Draa River', url: WIKI('Draa_River') },
    at: { px: page(6, 1100, 12500), lonlat: [-6.0, 29.5] }, size: [1400, 600], up: 0,
  },
  {
    id: 'norway', title: 'Norway',
    drawn: 'A mountain wall round the Norwegian coast and a legend inside it (III.7): "This region of Norway is very rugged, very cold, mountainous, wild and covered with forests. Its inhabitants eat more fish and meat than bread", with deer, white bears and gyrfalcons.',
    real: 'Norway under Haakon VI, a kingdom of fishermen and farmers; the Black Death of 1349 had killed perhaps half its people.',
    source: { label: 'Cresques Project III.7; Norway in the Middle Ages', url: WIKI('Norway_in_the_Middle_Ages') },
    at: { px: page(6, 2100, 1200), lonlat: [8.5, 61.0] }, size: [3000, 1600], up: 180,
  },
  {
    id: 'england', title: 'England',
    drawn: 'England in purple, the royal flag of red with gold lions flown over it twice.',
    real: 'England under Edward III. In June 1375 the truce of Bruges paused the Hundred Years\' War with France.',
    source: { label: 'Hundred Years\' War, Wikipedia', url: WIKI('Hundred_Years%27_War') },
    at: { px: page(6, 1000, 3800), lonlat: [-1.5, 52.5] }, size: [1700, 3000], up: 0,
  },
  {
    id: 'majorca', title: 'Majorca, where the atlas was made',
    drawn: 'The Balearics, Majorca, Minorca and Ibiza, under their flags.',
    real: 'The atlas was drawn in Palma de Mallorca by Cresques Abraham, a Jewish master of maps and compasses, and was in the French royal library by 1380.',
    source: { label: 'Cresques Abraham, Wikipedia', url: WIKI('Cresques_Abraham') },
    at: { px: page(6, 3450, 8700), lonlat: [2.65, 39.57] }, size: [1000, 800], up: 0,
  },
  stub('sijilmasa', 'Sijilmasa', page(6, 2200, 12300), 380),
  stub('ciutat-de-melli', 'The city of Mali', page(6, 2000, 15050), [800, 500]),
  stub('tent-6-a', 'A black tent', page(6, 2350, 13800), [500, 350]),
  stub('tent-6-b', 'A black tent', page(6, 4550, 12000), [600, 350]),
  stub('tent-6-c', 'A black tent', page(6, 5750, 12000), [600, 350]),
  stub('tent-6-d', 'A black tent', page(6, 5800, 14000), [600, 350]),
  stub('hill-town-6-a', 'A town on a purple hill', page(6, 1300, 12850), [900, 450]),
  stub('hill-town-6-b', 'A town on a yellow hill', page(6, 3200, 12950), [800, 450]),
  stub('hill-town-6-c', 'A town on a green hill', page(6, 4900, 14050), [900, 450]),
  stub('hill-town-6-d', 'A town on a green hill', page(6, 5850, 12750), [700, 450]),
  stub('hill-town-6-e', 'A town on a purple hill', page(6, 2200, 14450), [800, 450]),
  stub('mali-water', 'Water at the foot of the page', page(6, 2950, 15150), [1300, 350]),
  stub('gilt-round-island', 'A gilt round island', page(6, 3400, 1700), 320),
  stub('green-disc', 'A green disc by Scotland', page(6, 1000, 2500), 260),
  stub('flanders-flag', 'A flag over Flanders', page(6, 2450, 3300), 280),
  stub('france-flags', 'The flags of France', page(6, 2900, 5350), [1300, 450]),
  stub('alps', 'The Alps', page(6, 4400, 5300), [1900, 1100]),
  stub('pyrenees', 'The Pyrenees', page(6, 2600, 7600), [2000, 500]),
  stub('corsica-sardinia', 'Corsica and Sardinia', page(6, 5250, 7800), [800, 1900]),
  stub('iberian-flags', 'The flags of Iberia', page(6, 1000, 9400), [1300, 700]),
  stub('western-sea', 'The western Mediterranean', page(6, 3600, 9600), [3800, 1600]),

  // Sheet 7: Italy, Bohemia, the Baltic and the Sahara
  {
    id: 'king-of-organa', title: 'The king of Organa',
    drawn: 'A king in a blue robe and white turban, a broad sword raised and a red shield, sitting under "ORGANA". The legend (IV.3): "Here rules the King of Organa, a Saracen that constantly battles with the Saracens of the coast and with other Arabs."',
    real: 'Most read Organa as Kanem–Bornu, round Lake Chad, whose kings were Muslim from the 11th century; Ife and Ghana have also been proposed.',
    source: { label: 'Cresques Project IV.3; Kanem–Bornu Empire', url: WIKI('Kanem%E2%80%93Bornu_Empire') },
    at: { px: page(7, 2900, 14400), lonlat: null }, size: [1300, 1900], up: 0,
  },
  {
    id: 'king-of-nubia', title: 'The king of Nubia',
    drawn: 'A tall faded figure in a turban by "NUBIA". The legend of Nubia (V.14): "The king of Nubia is always at war with the Christians of Nubia who are under the dominion of the emperor of Ethiopia and the land of Prester John."',
    real: 'Makuria, the last great Christian kingdom of Nubia, was breaking up under Mamluk pressure; the small Christian kingdom of Dotawo held on into the 15th century. Ethiopia\'s emperors were the Prester John that Europe looked for.',
    source: { label: 'Cresques Project V.14; Makuria', url: WIKI('Makuria') },
    at: { px: page(7, 5500, 14300), lonlat: null }, size: [1100, 2000], up: 0,
  },
  {
    id: 'frozen-baltic', title: 'The frozen Baltic',
    drawn: 'A legend on the Baltic (IV.2): "this sea is frozen during six months of the year; that is to say, from mid-October until mid-March; and it is so hard that one can cross on top of it with an oxcart."',
    real: 'The Baltic\'s northern gulfs freeze most winters, and in hard ones men crossed by sled to the islands and between Sweden and Finland; the open sea seldom freezes over.',
    source: { label: 'Cresques Project IV.2; Baltic Sea', url: WIKI('Baltic_Sea') },
    at: { px: page(7, 1600, 950), lonlat: [19.0, 58.0] }, size: [2700, 800], up: 180,
  },
  {
    id: 'bohemia', title: 'Bohemia\'s ring of hills',
    drawn: 'A green ring of hills round Prague.',
    real: 'Bohemia, ringed by the Ore Mountains, the Sudetes and the Bohemian Forest. In 1375 its king, Charles IV, was also Holy Roman Emperor, and Prague was his capital.',
    source: { label: 'Bohemia, Wikipedia', url: WIKI('Bohemia') },
    at: { px: page(7, 1300, 2800), lonlat: [14.42, 50.08] }, size: [1300, 1300], up: 0,
  },
  {
    id: 'sicily', title: 'Sicily',
    drawn: 'Sicily in gold, under the striped flag with eagles of its Aragonese kings.',
    real: 'Sicily, ruled in 1375 by Frederick III, "the Simple", of a branch of the house of Barcelona.',
    source: { label: 'Frederick III of Sicily, Wikipedia', url: WIKI('Frederick_III_of_Sicily') },
    at: { px: page(7, 2600, 8950), lonlat: [14.0, 37.5] }, size: [1900, 900], up: 0,
  },
  {
    id: 'corsica-sardinia-again', title: 'Corsica and Sardinia, drawn again',
    drawn: 'Corsica and Sardinia again, in gold, at the west edge of the page.',
    real: 'The same islands as on the page before: each page draws them, so they show twice where the pages are butted.',
    source: { label: 'Catalan Atlas, Wikipedia', url: WIKI('Catalan_Atlas') },
    at: { px: page(7, 600, 7800), lonlat: [9.0, 41.0] }, size: [900, 2000], up: 0,
  },
  stub('elephant-7', 'An elephant', page(7, 4300, 14750), [1200, 1100]),
  stub('camel-and-driver', 'A camel and its driver', page(7, 1300, 13950), [1300, 1300]),
  stub('palm-7-a', 'A palm tree', page(7, 1900, 13200), [450, 550]),
  stub('palm-7-b', 'A palm tree', page(7, 1900, 14450), [450, 550]),
  stub('tree-7', 'A tree in a frame', page(7, 2650, 12050), [450, 500]),
  stub('sahara-range', 'The mountains of the Sahara', page(7, 3500, 12400), [5200, 1300]),
  stub('ciutat-organa', 'The city of Organa', page(7, 2300, 13900), 400),
  stub('tent-7', 'A black tent', page(7, 400, 14200), [500, 450]),
  stub('faded-figure', 'A faded figure', page(7, 5700, 11200), [700, 900]),
  stub('baltic-island', 'An island in the Baltic', page(7, 3200, 650), [900, 700]),
  stub('gilt-coast', 'A gilt-brown coast', page(7, 4600, 6500), [900, 900]),
  stub('mare-lettering', 'Gilt lettering on the sea', page(7, 4800, 10000), [2100, 350]),
  stub('central-sea', 'The central Mediterranean', page(7, 3600, 8000), [3800, 2600]),

  // Sheet 8: the eastern Mediterranean, the Black Sea, Egypt and the Red Sea
  {
    id: 'sultan-of-babylon', title: 'The sultan of Babylon',
    drawn: 'A sultan in a great white turban, seated cross-legged, a green bird on his hand. The legend (IV.12): "This sultan of Babylon is great and powerful amongst those of this region."',
    real: '"Babylon" is Cairo (Fustat). The Mamluk sultan in 1375 was al-Ashraf Sha\'ban, who had come to the throne as a boy in 1363; his realm held Egypt, Syria and the Hejaz.',
    source: { label: 'Cresques Project IV.12; Mamluk Sultanate', url: WIKI('Mamluk_Sultanate') },
    at: { px: page(8, 2350, 12200), lonlat: [31.24, 30.04] }, size: [1300, 1700], up: 0,
  },
  {
    id: 'red-sea', title: 'The Red Sea',
    drawn: 'The Red Sea painted red. The legend (IV.11): "This sea is called the Red Sea which was crossed by the Twelve Tribes of Egypt. Let it be known that the water is not red, but the bottom is that color. Through this sea pass most of the spices arriving at Alexandria from India."',
    real: 'The water is blue-green, and the bottom is not red either. The spice trade from India did come up it to Egypt.',
    source: { label: 'Cresques Project IV.11; Red Sea', url: WIKI('Red_Sea') },
    at: { px: page(8, 4950, 13300), lonlat: [38.0, 20.0] }, size: [1900, 4000], up: 0,
  },
  {
    id: 'sinai', title: 'Mount Sinai and St Catherine',
    drawn: 'A green mount with a church: "Here lies the body of St. Catharine Virgin" (IV.7) and "Mount Sinai where God gave Moses the Law" (IV.9).',
    real: 'Saint Catherine\'s Monastery, at the foot of Jebel Musa, the mount tradition takes for Sinai; it is still a working monastery.',
    source: { label: 'Cresques Project IV.7, IV.9; Saint Catherine\'s Monastery', url: WIKI('Saint_Catherine%27s_Monastery') },
    at: { px: page(8, 5250, 11300), lonlat: [33.976, 28.556] }, size: [1000, 900], up: 0,
  },
  {
    id: 'chos', title: 'The spice port of Chos',
    drawn: 'A legend on the Red Sea coast (IV.13): "The spices coming from India are brought to this city of Chos. Then, they are taken to Babylon and Alexandria."',
    real: 'Al-Qusayr, the Red Sea port nearest the Nile: goods went overland to Qus on the river, then down it to Cairo and Alexandria.',
    source: { label: 'Cresques Project IV.13; Quseir', url: WIKI('Quseir') },
    at: { px: page(8, 4200, 13300), lonlat: [34.28, 26.10] }, size: [600, 1600], up: 0,
  },
  {
    id: 'middle-tauris', title: 'The middle branch of Mount Tauris',
    drawn: 'Gilt-brown hills and a legend (IV.10): "This is the middle branch of Mount Tauris. Many Saracens coming from the West pass through this mountain wishing to go to Mecca."',
    real: 'The Cresques Project reads the range as the Tibesti, in the central Sahara. Pilgrims from the Maghreb and Mali did cross to Mecca, most by way of Cairo.',
    source: { label: 'Cresques Project IV.10; Tibesti Mountains', url: WIKI('Tibesti_Mountains') },
    at: { px: page(8, 800, 12600), lonlat: [18.5, 21.0] }, size: [1200, 1800], up: 0,
  },
  {
    id: 'ruler-of-turkey', title: 'The ruler of Turkey',
    drawn: 'A ruler in a turban and grey robe, drawn upside down, seated by "TURCHIA". The legend (IV.5): "Asia Minor also called Turkey, where there are many cities and castles."',
    real: 'Anatolia in 1375 was split among Turkish beyliks: the Ottomans under Murad I in the north-west, Karaman, Germiyan and others. No one ruler held it.',
    source: { label: 'Cresques Project IV.5; Anatolian beyliks', url: WIKI('Anatolian_beyliks') },
    at: { px: page(8, 3500, 6550), lonlat: null }, size: [1100, 1400], up: 180,
  },
  {
    id: 'armenia', title: 'Lesser Armenia',
    drawn: 'A square walled in green, a red lion on gold flying inside it.',
    real: 'Cilician Armenia, the lion its royal arms. In 1375, the atlas\'s year, the Mamluks took its capital, Sis, and carried its last king, Leo V, off to Cairo.',
    source: { label: 'Armenian Kingdom of Cilicia, Wikipedia', url: WIKI('Armenian_Kingdom_of_Cilicia') },
    at: { px: page(8, 4100, 7650), lonlat: [35.82, 37.45] }, size: [1100, 1000], up: 0,
  },
  {
    id: 'cyprus', title: 'Cyprus',
    drawn: 'A long gilt island.',
    real: 'Cyprus under its Lusignan kings; in 1373–74 Genoa invaded and took Famagusta, its great port.',
    source: { label: 'Kingdom of Cyprus, Wikipedia', url: WIKI('Kingdom_of_Cyprus') },
    at: { px: page(8, 3400, 8600), lonlat: [33.2, 35.1] }, size: [1100, 500], up: 0,
  },
  {
    id: 'rhodes', title: 'Rhodes',
    drawn: 'A small red island.',
    real: 'Rhodes, held since 1310 by the Knights Hospitaller.',
    source: { label: 'Knights Hospitaller, Wikipedia', url: WIKI('Knights_Hospitaller') },
    at: { px: page(8, 1500, 8450), lonlat: [28.0, 36.2] }, size: 300, up: 0,
  },
  {
    id: 'crete', title: 'Crete',
    drawn: 'A gilt island at the west edge of the page.',
    real: 'Crete, a Venetian colony since the early 1200s.',
    source: { label: 'Kingdom of Candia, Wikipedia', url: WIKI('Kingdom_of_Candia') },
    at: { px: page(8, 700, 9200), lonlat: [24.9, 35.2] }, size: [900, 450], up: 0,
  },
  stub('ciutat-nubia', 'The city of Nubia', page(8, 1000, 14250), [900, 700]),
  stub('nubia-legend', 'A legend by the city of Nubia', page(8, 950, 14800), [1000, 900]),
  stub('green-bird-a', 'A green bird', page(8, 3500, 12450), [400, 800]),
  stub('green-bird-b', 'A green bird', page(8, 4500, 14700), [800, 500]),
  stub('cross-flags', 'Gold flags with a red cross', page(8, 3250, 15100), [1800, 450]),
  stub('jerusalem', 'Jerusalem', page(8, 4600, 9800), 420),
  stub('jordan-lakes', 'The lakes of the Jordan', page(8, 4950, 9950), [450, 1100]),
  stub('lebanon-range', 'A range by the coast of Syria', page(8, 5500, 9600), [600, 1600]),
  stub('river-mountain', 'A mountain at a river\'s head', page(8, 2000, 1350), [800, 550]),
  stub('six-pointed-star', 'A six-pointed star', page(8, 4100, 6150), 220),
  stub('black-sea', 'The Black Sea', page(8, 3900, 4200), [3800, 2000]),
  stub('eastern-sea', 'The eastern Mediterranean', page(8, 2400, 9600), [3800, 1600]),

  // Sheet 9: the Golden Horde, Persia, the Gulf and Arabia
  {
    id: 'jani-beg', title: 'Jani Beg of the Golden Horde',
    drawn: 'A khan drawn upside down, enthroned on a red cushion in a green robe, a sceptre in his hand and gold discs round him. The legend (V.4): "Here resides the emperor of this northern region whose empire starts in the province of Bulgaria and ends at the city of Organcio. The sovereign is named Jambech, Lord of the Sarra."',
    real: 'Jani Beg, khan of the Golden Horde, died in 1357. By 1375 the Horde was in its Great Troubles, its throne fought over, with the emir Mamai the power in the west. Sarai on the Volga was its capital; Organcio is Urgench.',
    source: { label: 'Cresques Project V.4; Jani Beg', url: WIKI('Jani_Beg') },
    at: { px: page(9, 2500, 1450), lonlat: null }, size: [1600, 2400], up: 180,
  },
  {
    id: 'desert-of-lop', title: 'The voices of the desert',
    drawn: 'A long legend, upside down (V.3): those who would cross the desert rest a week in the city of Lop, and a rider who falls behind "will often hear the voices of devils, similar to the voices of his companions, often calling him by his own name."',
    real: 'The Lop desert round Lop Nur, in the Tarim basin, on the southern Silk Road. Marco Polo told the same tale of spirits that call travellers by name.',
    source: { label: 'Cresques Project V.3; Lop Desert', url: WIKI('Lop_Desert') },
    at: { px: page(9, 5000, 2650), lonlat: [90.0, 40.0] }, size: [2300, 1600], up: 180,
  },
  {
    id: 'caspian', title: 'The sea of Sarai and Baku',
    drawn: 'The Caspian, lettered upside down (V.2): "This sea is called Sea of Sarra and Bacú."',
    real: 'The Caspian Sea, named here after Sarai and Baku. It has no outlet, and is the largest lake on earth.',
    source: { label: 'Cresques Project V.2; Caspian Sea', url: WIKI('Caspian_Sea') },
    at: { px: page(9, 3000, 4300), lonlat: [51.0, 42.0] }, size: [3800, 1600], up: 180,
  },
  {
    id: 'king-of-tauris', title: 'The king of Tauris',
    drawn: 'A crowned king with a long beard, in red and green, seated cross-legged under "REY DEL TAURIS".',
    real: 'The Il-Khans, the Mongol rulers of Persia, ruled from Tabriz until their realm broke up in 1335. In 1375 Tabriz was held by the Jalayirids: Shaikh Uvais died in 1374 and his son Husayn followed him.',
    source: { label: 'Ilkhanate; Jalayirid Sultanate', url: WIKI('Jalayirid_Sultanate') },
    at: { px: page(9, 3600, 9200), lonlat: [46.29, 38.08] }, size: [1400, 1800], up: 0,
  },
  {
    id: 'shiraz', title: 'Shiraz',
    drawn: 'A round walled city and its legend (V.5): "This city is named Siras, and in antiquity, it was named the City of Grace because it was there where astronomy was invented by the great wise man Ptolemy."',
    real: 'Shiraz, in 1375 the Muzaffarid capital and the city of the poet Hafez. Ptolemy worked in Alexandria.',
    source: { label: 'Cresques Project V.5; Shiraz', url: WIKI('Shiraz') },
    at: { px: page(9, 4600, 7950), lonlat: [52.53, 29.61] }, size: [1900, 800], up: 0,
  },
  {
    id: 'nineveh', title: 'Nineveh',
    drawn: 'A legend by the Tigris (V.6): "This city is named the Great Nínive, and it was destroyed because of its sins."',
    real: 'Nineveh, across the Tigris from Mosul, sacked in 612 BC by the Medes and Babylonians.',
    source: { label: 'Cresques Project V.6; Nineveh', url: WIKI('Nineveh') },
    at: { px: page(9, 1500, 8750), lonlat: [43.15, 36.36] }, size: [1300, 600], up: 0,
  },
  {
    id: 'baghdad', title: 'Babylon the great, now Baghdad',
    drawn: 'A city lettered "BALDACH" and its legend (V.7): "Here there was the Great Babylonia, where Nabuconodosor resided, and that is called Baldaca today", where spices from the Indies come to be sent on to Damascus.',
    real: 'Baghdad, which is not Babylon: Babylon\'s ruins lie 85 km south. The Mongols sacked Baghdad in 1258; in 1375 the Jalayirids held it.',
    source: { label: 'Cresques Project V.7; Baghdad', url: WIKI('Baghdad') },
    at: { px: page(9, 1400, 9850), lonlat: [44.36, 33.31] }, size: [2400, 1300], up: 0,
  },
  {
    id: 'gulf-pearls', title: 'The pearl fishers of the Gulf',
    drawn: 'A legend on the Gulf (V.9): here "they search for pearls which are taken to the city of Baldach. The fishermen say their enchantments before diving into the deep to make the fish flee."',
    real: 'The pearl beds of the Gulf, round Bahrain, worked from antiquity until cultured pearls ended the trade in the 1930s.',
    source: { label: 'Cresques Project V.9; Pearl hunting', url: WIKI('Pearl_hunting') },
    at: { px: page(9, 2400, 11550), lonlat: [50.6, 26.1] }, size: [2300, 900], up: 0,
  },
  {
    id: 'hormuz', title: 'Hormuz',
    drawn: 'A city and its legend (V.8): "This city is named Hormes and is the beginning of the Indies. Let it be known that to this city ships arrive that have eight and ten masts with reed sails."',
    real: 'Hormuz, the island port at the mouth of the Gulf where the ships of India, China and East Africa met; the great market of the Gulf until the Portuguese took it in the 1500s.',
    source: { label: 'Cresques Project V.8; Kingdom of Ormus', url: WIKI('Kingdom_of_Ormus') },
    at: { px: page(9, 5450, 10500), lonlat: [56.45, 27.1] }, size: [1300, 1800], up: 0,
  },
  {
    id: 'queen-of-sheba', title: 'The Queen of Sheba',
    drawn: 'A crowned queen in a grey gown on a green throne, a gold ball in her raised hand, by "ARABIA SEBBA". The legend (V.11): "The province that had queen Sebba; now it belongs to the Arabs Saracens, and in it there very good aromas, as well as myrrh and frankincense", and a bird named Phoenix.',
    real: 'Saba, in Yemen, on the incense road; whether its queen ever went to Solomon is not known. In 1375 Yemen was ruled by the Rasulid sultans.',
    source: { label: 'Cresques Project V.11; Queen of Sheba', url: WIKI('Queen_of_Sheba') },
    at: { px: page(9, 3500, 13900), lonlat: [45.33, 15.42] }, size: [1300, 2000], up: 0,
  },
  {
    id: 'mecca', title: 'Mecca',
    drawn: 'A city with a blue court and a gilt box in it, and the legend (V.10): "In this city, one finds the arch of Mohamed, the prophet of the Saracens who make a pilgrimage here from all regions", and pilgrims who blind themselves once they have seen it.',
    real: 'The Prophet is buried in Medina, not Mecca. At Mecca the Kaaba stands in the court of the Great Mosque; the blinding is a European tale.',
    source: { label: 'Cresques Project V.10; Kaaba', url: WIKI('Kaaba') },
    at: { px: page(9, 1300, 13300), lonlat: [39.83, 21.42] }, size: [2200, 1000], up: 0,
  },
  stub('pilgrim', 'A kneeling pilgrim', page(9, 1450, 14200), [700, 1100], 0, 'A pilgrim in blue kneeling below the legend of Mecca.'),
  stub('caspian-ship', 'A ship on the Caspian', page(9, 3400, 5150), [1400, 1000], 180, 'A black-hulled ship drawn upside down, its sail of woven reeds.'),
  stub('patchwork-mountain', 'A patchwork mountain', page(9, 1250, 3000), [700, 700]),
  stub('horde-flag', 'A flag of the Golden Horde', page(9, 3600, 1450), 300, 180),
  stub('range-9', 'A mountain range', page(9, 5000, 1250), [2100, 600], 180),
  stub('round-lake-a', 'A round lake', page(9, 1300, 7300), [700, 800]),
  stub('round-lake-b', 'A round lake', page(9, 2300, 7150), [700, 800]),
  stub('fan-hill', 'A fan-shaped hill', page(9, 1500, 6150), [600, 600]),
  stub('brown-mountains', 'Mountains by Tabriz', page(9, 1000, 6250), [700, 1000]),
  stub('kish', 'The island of Kish', page(9, 4300, 11400), 360),
  stub('gilt-shape-gulf', 'A gilt shape in the Gulf', page(9, 4900, 12200), [550, 300]),
  stub('gilt-star', 'A gilt star', page(9, 5750, 7200), 300),
  stub('purple-island', 'A purple island', page(9, 5800, 12700), 300),
  stub('gilt-island-9', 'A gilt island', page(9, 5900, 14800), 300),
  stub('persian-gulf', 'The Persian Gulf', page(9, 3000, 11500), [5800, 1400]),

  // Sheet 10: India's west coast and the Indian Ocean (drawn upside down), Tarsia and the caravan to Cathay
  {
    id: 'king-of-colombo', title: 'The king of Colombo',
    drawn: 'A king in green drawn upside down, by flags with a red cross. The legend (V.18): "Here reigns the king of Colombo, a Christian. Province of Colombo."',
    real: 'Kollam (Quilon), a pepper port on the Malabar coast with old Saint Thomas Christian communities; Jordan Catala was made its Latin bishop in 1329. Its rulers were Hindu.',
    source: { label: 'Cresques Project V.18; Kollam', url: WIKI('Kollam') },
    at: { px: page(10, 1050, 1350), lonlat: [76.6, 8.9] }, size: [1300, 2100], up: 180,
  },
  {
    id: 'junk', title: 'The junk',
    drawn: 'A great black-hulled ship drawn upside down, its sail of woven reeds. The legend (V.17): "these ships are named nichi, and measure sixty cubits in depth and thirty-four cubits in length; there are few with less than four masts and some even have ten. The sails are made of reed and palm leafs."',
    real: 'Chinese junks, with watertight bulkheads and stiff sails of matting on battens, the largest ships of their age; Ibn Battuta saw them at Calicut in the 1340s.',
    source: { label: 'Cresques Project V.17; Junk (ship)', url: WIKI('Junk_(ship)') },
    at: { px: page(10, 4750, 2750), lonlat: null }, size: [1600, 1700], up: 180,
  },
  {
    id: 'indian-ocean-divers', title: 'The divers of the Indian Ocean',
    drawn: 'Swimmers among fish, drawn upside down, and the legend (V.19): "The fishermen that descend into the sea say their incantations before diving into the sea and this way they dispel the fish. In the event that they do not say them, the fish devour them."',
    real: 'The pearl banks of the Gulf of Mannar, between India and Ceylon, fished for two thousand years; shark charmers worked the dives there into the 1900s.',
    source: { label: 'Cresques Project V.19; Gulf of Mannar', url: WIKI('Gulf_of_Mannar') },
    at: { px: page(10, 4000, 1150), lonlat: [79.0, 8.8] }, size: [3600, 1500], up: 180,
  },
  {
    id: 'sultan-of-delhi', title: 'The sultan of Delhi',
    drawn: 'A ruler in blue on a round red throne, drawn upside down. The legend beside him (V.16): "Here resides a great sultan, powerful and very rich. This sultan has seven hundred elephants, one hundred thousand cavalry soldiers under his command and even countless foot soldiers."',
    real: 'The sultan of Delhi: in 1375 Firuz Shah Tughlaq, a builder of canals and towns, whose realm had shrunk since his cousin Muhammad bin Tughluq lost the south.',
    source: { label: 'Cresques Project V.16; Firuz Shah Tughlaq', url: WIKI('Firuz_Shah_Tughlaq') },
    at: { px: page(10, 4550, 5950), lonlat: [77.2, 28.6] }, size: [1300, 1700], up: 180,
  },
  {
    id: 'magi', title: 'The three kings',
    drawn: 'Three crowned kings on horseback, drawn upside down, riding out of "TARSIA". The legend (V.12): "This province is called Tarsia, and it is from which the three very wise kings departed and came to Bethlehem in Judea with their presents and worshiped Jesus Christ. They are buried in the city of Cologne."',
    real: 'Matthew\'s gospel neither names, numbers nor crowns the Magi. Their relics have been in Cologne since 1164.',
    source: { label: 'Cresques Project V.12; Biblical Magi', url: WIKI('Biblical_Magi') },
    at: { px: page(10, 3300, 7500), lonlat: null }, size: [2700, 1600], up: 180,
  },
  {
    id: 'caravan', title: 'The caravan to Cathay',
    drawn: 'Merchants in tall hats on horseback, men on foot before them, behind a string of camels. Above, the legend (V.13): "This caravan has departed from the Empire of Sarra to go to Alcatayo."',
    real: 'The northern Silk Road from Sarai on the Volga to Khanbaliq (Beijing), open while the Mongol khanates kept the peace; it was failing by the time the Yuan fell in 1368. The riders are often read as the Polos, though the legend names no one.',
    source: { label: 'Cresques Project V.13; Silk Road', url: WIKI('Silk_Road') },
    at: { px: page(10, 4700, 13150), lonlat: null }, size: [2500, 1800], up: 0,
  },
  {
    id: 'mountains-of-sebur', title: 'The mountains of Sebur',
    drawn: 'A legend under the caravan\'s road (V.14): "Mountains of Sebur, where the great river Edil originates."',
    real: 'The Volga (Edil, Itil) rises in the Valdai Hills north-west of Moscow, nowhere near Siberia.',
    source: { label: 'Cresques Project V.14; Volga', url: WIKI('Volga') },
    at: { px: page(10, 2600, 14700), lonlat: [32.6, 57.25] }, size: [1100, 1000], up: 0,
  },
  stub('caravan-camels', 'The caravan\'s camels', page(10, 2400, 13100), [2600, 1800], 0, 'Camels in a line, the first saddled in red.'),
  stub('elephant-rider', 'An elephant and its rider', page(10, 1500, 5300), [2000, 1500], 180, 'An elephant with a rider on its back and a man standing at its head, drawn upside down.'),
  stub('second-ship', 'A second ship', page(10, 4950, 1100), [1100, 600], 180),
  stub('red-fish', 'A red fish', page(10, 2800, 650), [800, 450], 180),
  stub('green-fish', 'A green fish', page(10, 5000, 650), [800, 450], 180),
  stub('cross-flags-10', 'Flags with a red cross', page(10, 2000, 2600), [1300, 1000], 180),
  stub('two-mountains', 'Two mountains', page(10, 2300, 8800), [1400, 900], 180),
  stub('black-banners', 'Black banners', page(10, 2600, 3800), [2400, 2600], 180),
  stub('gold-banners', 'Cities flying gold banners', page(10, 3900, 10400), [3200, 2000]),

  // Sheet 11: the Chagatai khan, King Stephen, the pygmies, Alexander's trumpeters and the islands of the Indies
  {
    id: 'falcon-islands', title: 'The islands of falcons',
    drawn: 'Islands in a northern sea, drawn upside down, and the legend (VI.7): "In these islands are born very good gyrfalcons and falcons that the inhabitants do not there to capture except at the service of the Great Khan."',
    real: 'Gyrfalcons breed on Arctic coasts. Marco Polo tells of the Great Khan hunting with ten thousand falconers.',
    source: { label: 'Cresques Project VI.7; Gyrfalcon', url: WIKI('Gyrfalcon') },
    at: { px: page(11, 2000, 1000), lonlat: null }, size: [3400, 1600], up: 180,
  },
  {
    id: 'funeral', title: 'A funeral with music',
    drawn: 'Mourners and musicians with a lute round a bier, drawn upside down. The legend (VI.6): the dead of this region "are taken to be cremated accompanied with instruments and revelry", and "the wives of the deceased throw themselves into the fire, however, the husbands never throw themselves with their wives."',
    real: 'Sati, the burning of a widow with her husband, practised in India in the 14th century; Ibn Battuta saw it. British law banned it in 1829.',
    source: { label: 'Cresques Project VI.6; Sati (practice)', url: WIKI('Sati_(practice)') },
    at: { px: page(11, 2600, 3400), lonlat: null }, size: [1400, 1500], up: 180,
  },
  {
    id: 'diamond-pickers', title: 'The diamond pickers',
    drawn: 'Two men drawn upside down above a mountain. The legend (VI.3): they cannot climb the mountains where the diamonds are, so "they cleverly toss pieces of meat where the precious stones lay"; birds carry off the meat and the stones fall from it.',
    real: 'The Valley of Diamonds, a tale told of Sinbad and of Alexander. India\'s real diamonds came from river gravels in the Deccan.',
    source: { label: 'Cresques Project VI.3; Valley of Diamonds', url: WIKI('Valley_of_Diamonds') },
    at: { px: page(11, 3000, 5850), lonlat: null }, size: [1200, 1200], up: 180,
  },
  {
    id: 'trumpeters', title: 'Alexander\'s trumpeters',
    drawn: 'A figure blowing gilt trumpets at the page\'s east edge. The legend (VI.2): "These are made of metal and were ordered made by Alexander, a great and powerful king."',
    real: 'In the Alexander romance, he set up trumpeting statues of bronze on the gates he built to shut in Gog and Magog. No such statues are known; some put the gates at Derbent, on the Caspian.',
    source: { label: 'Cresques Project VI.2; Gates of Alexander', url: WIKI('Gates_of_Alexander') },
    at: { px: page(11, 5650, 6400), lonlat: null }, size: [1000, 1800], up: 180,
  },
  {
    id: 'caspian-mountains', title: 'The Caspian mountains',
    drawn: 'Gilt-brown ranges walling in the north-east, and the legend (VI.4): "The Caspian Mountains where Alexander saw trees so tall that their canopies touch the clouds", where Satan saved him, and where he shut in Gog and Magog.',
    real: 'The mountains of the Alexander romance, not a range on the ground.',
    source: { label: 'Cresques Project VI.4; Gog and Magog', url: WIKI('Gog_and_Magog') },
    at: { px: page(11, 4900, 4900), lonlat: null }, size: [2400, 1600], up: 180,
  },
  {
    id: 'lop', title: 'The city of Lop',
    drawn: 'A city and its legend (VI.5): "At this city of Lop arrive merchants from the Empire of Sarra on their way to Cathay taking the direct route; they carry oxen, carts, and camels."',
    real: 'Lop, by Lop Nur in the Tarim basin, the last town before the desert on the southern Silk Road; Marco Polo rested there before the crossing.',
    source: { label: 'Cresques Project VI.5; Lop Nur', url: WIKI('Lop_Nur') },
    at: { px: page(11, 1100, 5100), lonlat: [88.2, 39.0] }, size: [2100, 1000], up: 180,
  },
  {
    id: 'king-chabech', title: 'King Chabech of the Chagatai',
    drawn: 'A crowned king in red on a round blue throne. The legend (VI.8): "Here reigns the King Chabech, lord that is the Medeja Empire. This is located is at Emalech."',
    real: 'Kebek, khan of the Chagatai Khanate, died in 1326. In 1375 Timur was master of its western half, and Almaliq, its old capital in the Ili valley, was in decline.',
    source: { label: 'Cresques Project VI.8; Kebek', url: WIKI('Kebek') },
    at: { px: page(11, 1250, 8800), lonlat: [80.87, 44.05] }, size: [1300, 1900], up: 0,
  },
  {
    id: 'king-stephen', title: 'King Stephen',
    drawn: 'A crowned king in green on a round red throne. The legend (VI.10): "Here reigns the Christian king Stephen. Here lies the body of the apostle St. Thomas."',
    real: 'The shrine of St Thomas at Mylapore, now in Chennai, which Marco Polo visited; no Christian king named Stephen ruled there. He stands for Prester John, the Christian king of the Indies.',
    source: { label: 'Cresques Project VI.10; Prester John', url: WIKI('Prester_John') },
    at: { px: page(11, 1250, 11400), lonlat: [80.27, 13.03] }, size: [1300, 2000], up: 0,
  },
  {
    id: 'pygmies', title: 'The pygmies and the cranes',
    drawn: 'Little men fighting cranes. The legend (VI.9): "Here are born men so small that they no reach more than five palmos in height", who weave and tend cattle, "defend themselves from herons", and live to forty. "Here ends the land of the Lord of Catayo."',
    real: 'The pygmies and cranes of Homer and Pliny, a tale from antiquity set at the end of Cathay.',
    source: { label: 'Cresques Project VI.9; Pygmies', url: WIKI('Pygmies_(Greek_mythology)') },
    at: { px: page(11, 4700, 8700), lonlat: null }, size: [2300, 2300], up: 0,
  },
  {
    id: 'king-of-jana', title: 'The king of Jana',
    drawn: 'A small crowned king on "ILLA IANA". The legend (VI.12): "In the city of Jana there are many trees of aloe, camphor, sandalwood, fine spices, galangal, nutmeg and the tree of cinnamon."',
    real: 'Jana may be Java, ruled in 1375 by Majapahit under Hayam Wuruk, at the height of its power. The spices of the legend came from all over the islands.',
    source: { label: 'Cresques Project VI.12; Majapahit', url: WIKI('Majapahit') },
    at: { px: page(11, 2750, 14100), lonlat: null }, size: [900, 1200], up: 0,
  },
  {
    id: 'naked-island', title: 'The island of the naked',
    drawn: 'A legend among the islands (VI.13): "Island of the naked people, where men and women wear a leaf in front and one behind."',
    real: 'Perhaps the Nicobar Islands, which Marco Polo called Necuveran, whose people he said went naked.',
    source: { label: 'Cresques Project VI.13; Nicobar Islands', url: WIKI('Nicobar_Islands') },
    at: { px: page(11, 4300, 14750), lonlat: [93.8, 8.0] }, size: [900, 600], up: 0,
  },
  stub('canopy-figure', 'A figure under a blue canopy', page(11, 1000, 3300), [1400, 1500], 180),
  stub('diamond-mountains', 'The diamond mountains', page(11, 3100, 6950), [1700, 1300], 180),
  stub('riders-11', 'Riders and a standing man', page(11, 4900, 1900), [2100, 1900], 180, 'Horsemen and a man in blue among tall staffs, drawn upside down.'),
  stub('great-bowl', 'A great bowl on a stand', page(11, 4900, 3300), [1000, 900], 180),
  stub('tree-11-a', 'A tree', page(11, 4500, 1100), 300),
  stub('tree-11-b', 'A tree', page(11, 5850, 1100), 300),
  stub('small-beast', 'A small beast', page(11, 4200, 2700), 220, 180),
  stub('covered-cart', 'A covered cart', page(11, 700, 6900), [900, 900], 180),
  stub('ship-11', 'A ship', page(11, 1100, 14600), [1400, 1200]),
  stub('islands-of-india', 'The islands of the Indies', page(11, 4600, 13600), [3200, 2600]),
  stub('cities-of-india', 'The cities of India', page(11, 3300, 11000), [2000, 2400]),

  // Sheet 12: Gog and Magog, the Great Khan, Cathay and the islands of the east
  {
    id: 'gog-and-magog', title: 'The prince of Gog and Magog',
    drawn: 'A king on horseback leading a court of riders, drawn slanting upside down inside a ring of mountains. The legend (VI.17): "The Great Lord Prince of Gog and Magog. He will appear with many people in the times of the Antichrist."',
    real: 'Gog and Magog are the nations of Ezekiel and Revelation; medieval maps shut them in the far north-east behind Alexander\'s wall. Here they ride as an orderly court, not the man-eaters of the tales.',
    source: { label: 'Cresques Project VI.17; Gog and Magog', url: WIKI('Gog_and_Magog') },
    at: { px: page(12, 3100, 4500), lonlat: null }, size: [2600, 3600], up: 225,
  },
  {
    id: 'alexander', title: 'Alexander the Great',
    drawn: 'A crowned king lettered "alexandri", at the wall of mountains, a winged devil beside him.',
    real: 'The real Alexander reached Central Asia and the Indus, never Cathay; the scene is from the romances told of him.',
    source: { label: 'Alexander Romance, Wikipedia', url: WIKI('Alexander_Romance') },
    at: { px: page(12, 450, 5000), lonlat: null }, size: [800, 1000], up: 270,
  },
  {
    id: 'great-khan', title: 'The Great Khan',
    drawn: 'An emperor in green, drawn upside down, a red sceptre in his hand, the crescent flag of Cathay beside him. The legend (VI.18): "The most powerful prince of the Tartars is named Holubeim, that means Great Khan. This emperor is richer than any other emperor in the world."',
    real: 'Kublai Khan died in 1294. By 1375 the Mongols had been driven out of China for seven years: the Ming emperor Hongwu ruled from Nanjing, and the Yuan held on in Mongolia.',
    source: { label: 'Cresques Project VI.18; Yuan dynasty', url: WIKI('Yuan_dynasty') },
    at: { px: page(12, 1000, 7700), lonlat: [116.4, 39.9] }, size: [1500, 2900], up: 180,
  },
  {
    id: 'khanbaliq', title: 'Khanbaliq',
    drawn: 'A long legend on the city (VI.14): the Great Khan built it beside the old city of Guatibalu; it is twenty-four leagues round, its square wall has twelve gates, and "every gate is guarded by a thousand men".',
    real: 'Khanbaliq, Kublai\'s capital, built from 1267 beside the old Jin capital; the Ming took it in 1368 and renamed it Beiping. It is Beijing.',
    source: { label: 'Cresques Project VI.14; Khanbaliq', url: WIKI('Khanbaliq') },
    at: { px: page(12, 4300, 7400), lonlat: [116.4, 39.9] }, size: [2700, 1200], up: 0,
  },
  {
    id: 'antichrist', title: 'The Antichrist',
    drawn: 'A legend in the eastern sea (VI.16): "Antichrist. He will be raised in Goraym of Galilea, and at the age of thirty he will start to preach in Jerusalem."',
    real: 'Goraym is Chorazin in Galilee, one of the towns Jesus cursed (Matthew 11:21), which is why tradition made it the Antichrist\'s birthplace.',
    source: { label: 'Cresques Project VI.16; Chorazin', url: WIKI('Chorazin') },
    at: { px: page(12, 4550, 1700), lonlat: null }, size: [600, 1800], up: 90,
  },
  {
    id: 'seven-thousand-islands', title: 'The 7,548 islands',
    drawn: 'A legend among the islands (VI.20): "In the Sea of the Indies there are seven thousand five hundred and forty-eight islands whose wonders of gold, silver, spices and precious stones we cannot discuss here."',
    real: 'Marco Polo gives 7,448 islands in the Sea of Chin.',
    source: { label: 'Cresques Project VI.20; The Travels of Marco Polo', url: WIKI('The_Travels_of_Marco_Polo') },
    at: { px: page(12, 1700, 12300), lonlat: null }, size: [1600, 600], up: 0,
  },
  {
    id: 'siren', title: 'The siren',
    drawn: 'A woman with a red fish\'s tail in the sea of the islands. The legend (VI.22): "Sea of the islands of the Indies where one finds spices. Many ships from many nations cross this sea. Here, one finds three kids of fish named sirens."',
    real: 'Dugongs, which suckle their young at the surface, are the usual guess for the sirens of the eastern seas.',
    source: { label: 'Cresques Project VI.22; Dugong', url: WIKI('Dugong') },
    at: { px: page(12, 1500, 14600), lonlat: null }, size: [1300, 1300], up: 0,
  },
  {
    id: 'taprobana', title: 'The king of Taprobana',
    drawn: 'A crowned black king with a long beard, seated by "ILLA TRAPOBANA". The legend (VI.21): "This island is called Magno Caulii by the Tartars, and it is the last island of Orient", with giants who eat strangers, two summers and two harvests a year.',
    real: 'Taprobana is the ancient name of Sri Lanka, but here it is drawn as the last island of the east, often read as Sumatra.',
    source: { label: 'Cresques Project VI.21; Taprobana', url: WIKI('Taprobana') },
    at: { px: page(12, 4800, 14400), lonlat: null }, size: [1200, 1600], up: 0,
  },
  {
    id: 'zayton', title: 'Zayton',
    drawn: 'A walled city on the coast, lettered "Zayton".',
    real: 'Quanzhou, the great port of the Yuan: the Zaitun of Marco Polo and Ibn Battuta.',
    source: { label: 'Quanzhou, Wikipedia', url: WIKI('Quanzhou') },
    at: { px: page(12, 2935, 11032), lonlat: [118.59, 24.9] }, size: 450, up: 0,
  },
  {
    id: 'cansay', title: 'Cansay',
    drawn: 'A walled city on the coast, lettered "Cansay".',
    real: 'Hangzhou, the old Song capital, which Marco Polo called Quinsai and the finest city in the world.',
    source: { label: 'Hangzhou, Wikipedia', url: WIKI('Hangzhou') },
    at: { px: page(12, 1554, 11161), lonlat: [120.15, 30.27] }, size: 450, up: 0,
  },
  { ...stub('isaiah', 'Isaiah\'s prophecy', page(12, 5400, 2700), [600, 1700], 90, 'A legend in the eastern sea (VI.15): "The prophet Isaiah LXVII: I will send those that have survived to the overseas people", to the far islands that have never heard of his glory.'), source: { label: 'Cresques Project VI.15', url: CRESQUES('vi') } },
  { ...stub('savages', 'The savages of the islands', page(12, 4600, 10500), [1800, 1700], 0, 'Two naked men by the shore, and the legend (VI.19): "These people are savages; they live on raw fish, they drink sea water and go around naked."'), source: { label: 'Cresques Project VI.19', url: CRESQUES('vi') } },
  { ...stub('snake-city', 'The city of snakes', page(12, 3600, 14400), [800, 700], 0, 'A city and its legend (VI.23): "This city is deserted due to snakes."'), source: { label: 'Cresques Project VI.23', url: CRESQUES('vi') } },
  stub('satan', 'Satan', page(12, 1150, 5700), [1100, 1000], 0, 'A winged black devil by Alexander.'),
  stub('cathay-flag', 'The crescent flag of Cathay', page(12, 1700, 7700), 320),
  stub('elephant-12', 'An elephant', page(12, 5650, 14600), [1000, 900]),
  stub('gilt-tree-a', 'A gilt tree', page(12, 1500, 4700), [900, 900], 225),
  stub('gilt-tree-b', 'A gilt tree', page(12, 2000, 5600), [800, 800], 225),
  stub('tree-12-a', 'A tree', page(12, 450, 1300), 300),
  stub('tree-12-b', 'A tree', page(12, 950, 1650), 300),
  stub('tree-12-c', 'A tree', page(12, 2050, 2350), 300),
  stub('tree-12-d', 'A tree', page(12, 450, 4100), 300),
  stub('tree-12-e', 'A tree', page(12, 3800, 3700), 300),
  stub('tree-12-f', 'A tree', page(12, 3600, 4500), 300),
  stub('tree-12-g', 'A tree', page(12, 3550, 6300), 300),
  stub('tree-12-h', 'A tree', page(12, 4250, 6200), 300),
  stub('tree-12-i', 'A tree', page(12, 4750, 6250), 300),
  stub('red-fish-12-a', 'A red fish', page(12, 5900, 10900), 300),
  stub('red-fish-12-b', 'A red fish', page(12, 5000, 11500), [600, 300]),
  stub('gilt-disc-beast', 'A gilt disc with a beast', page(12, 3100, 11700), 260),
  stub('gog-lettering', 'GOG I MAGOG', page(12, 1000, 2500), [1300, 900], 180),
  stub('eastern-sea-lettering', 'Gilt name of the eastern sea', page(12, 3300, 700), [2100, 700], 180),
  stub('eastern-islands', 'The islands of the eastern sea', page(12, 5300, 5000), [1500, 6000]),
  stub('islands-of-the-indies', 'The islands of the Indies', page(12, 2600, 12900), [4200, 2200]),
  stub('cathay-cities', 'The cities of Cathay', page(12, 2600, 9500), [2800, 2400]),
];

// The 1959 painted copy of the atlas's Mediterranean (Library of Congress): its figures, legible, at.px in its own
// scan (12956 x 8637), each with the note on the same figure in the atlas (`copy`): its words, its own place and box.
const copy = (of, px, size, up) => { const n = CATALAN_NOTES.find((c) => c.id === of); return { ...n, id: `copy-${of}`, at: { ...n.at, px }, size, up: up ?? n.up }; };
export const CATALAN_COPY_NOTES = [
  copy('catalan-rose', [950, 4300], 650),
  copy('brasil', [2150, 2450], 200),
  copy('jaume-ferrer', [1300, 8300], [1100, 600]),
  copy('tents', [2800, 7850], [1100, 800]),
  copy('veiled-rider', [3850, 7950], [900, 1000]),
  copy('mansa-musa', [5400, 7850], [1000, 1100]),
  copy('king-of-organa', [7300, 8150], [900, 900]),
  copy('elephant-7', [8300, 8150], [800, 700]),
  copy('king-of-nubia', [9200, 8000], [800, 1200]),
  copy('sultan-of-babylon', [10600, 6950], [900, 1000]),
  copy('red-sea', [12000, 7300], [700, 2600]),
  copy('ruler-of-turkey', [11300, 3500], [800, 700]),
  copy('england', [3800, 2000], [1000, 1600]),
  copy('sicily', [7250, 5000], [900, 500]),
  copy('cyprus', [11300, 4800], [800, 400]),
];

// The map of Juan de la Cosa, 1500 (Museo Naval, Madrid). at.px in the Commons "rotated" scan (2127 x 1163).
export const DE_LA_COSA_NOTES = [
  {
    id: 'cosa-new-world', title: 'The New World',
    drawn: 'A long green coast down the west of the sheet, flagged where each crown had sailed.',
    real: 'The Caribbean and the coasts of the Americas as Spanish, Portuguese and English voyages had found them by 1500. It is the oldest known European map that shows the New World.',
    source: { label: 'Juan de la Cosa, Wikipedia', url: 'https://en.wikipedia.org/wiki/Juan_de_la_Cosa' },
    at: { px: [420, 260], lonlat: null },
  },
  {
    id: 'cosa-cuba', title: 'Cuba, an island',
    drawn: 'A long island among the Antilles, drawn north of the red Tropic of Cancer.',
    real: 'Cuba is an island, as drawn, though Columbus never believed it was one; it lies just south of the Tropic of Cancer, not north of it.',
    source: { label: 'Map of Juan de la Cosa, Wikipedia', url: 'https://en.wikipedia.org/wiki/Map_of_Juan_de_la_Cosa' },
    at: { px: [345, 455], lonlat: [-79.5, 21.8] },
  },
  {
    id: 'cosa-hispaniola', title: 'Hispaniola',
    drawn: 'A long mountainous island south of Cuba, on the red line of the tropic.',
    real: 'Hispaniola, where Columbus founded the first Spanish towns in the Americas; it lies at 18 to 20 degrees north, south of the tropic.',
    source: { label: 'Hispaniola, Wikipedia', url: 'https://en.wikipedia.org/wiki/Hispaniola' },
    at: { px: [440, 510], lonlat: [-71.0, 19.0] },
  },
  {
    id: 'cosa-st-christopher', title: 'St Christopher',
    drawn: 'A panel of St Christopher bearing the infant Christ across the water, where the land should run on to the west.',
    real: 'Central America, unknown in 1500. The panel may stand for Columbus carrying Christianity over the Atlantic, and it leaves open a passage on to the Indian Ocean.',
    source: { label: 'Map of Juan de la Cosa, Wikipedia', url: 'https://en.wikipedia.org/wiki/Map_of_Juan_de_la_Cosa' },
    at: { px: [190, 545], lonlat: [-80.0, 9.0] },
  },
  {
    id: 'cosa-english-flags', title: 'Flags in the north',
    drawn: 'Small flags along the northern coast of the New World.',
    real: 'The flags give each region to the crown whose ships found it; the northern coast takes in John Cabot\'s English voyage of 1497.',
    source: { label: 'Map of Juan de la Cosa, Wikipedia', url: 'https://en.wikipedia.org/wiki/Map_of_Juan_de_la_Cosa' },
    at: { px: [580, 307], lonlat: null },
  },
  {
    id: 'cosa-parallels', title: 'The equator and the tropic',
    drawn: 'Two long red lines across the sheet, the upper the Tropic of Cancer, the lower the equator.',
    real: 'The earliest known equator and Tropic of Cancer on a nautical chart. The sheet is laid here by them.',
    source: { label: 'Map of Juan de la Cosa, Wikipedia', url: 'https://en.wikipedia.org/wiki/Map_of_Juan_de_la_Cosa' },
    at: { px: [1000, 762], lonlat: null },
  },
  {
    id: 'cosa-rediscovery', title: 'Found in a junk shop',
    drawn: 'The whole skin: Europe, Africa and Asia east of the ocean, the New World west of it.',
    real: 'Baron Walckenaer bought the map from a Paris junk dealer early in the 1800s; Humboldt recognised it as important in 1832. It is now in the Museo Naval, Madrid.',
    source: { label: 'Map of Juan de la Cosa, Wikipedia', url: 'https://en.wikipedia.org/wiki/Map_of_Juan_de_la_Cosa' },
    at: { px: [1700, 300], lonlat: null },
  },
];

// Jorge de Aguiar's chart, Lisbon 1492 (Beinecke Library, Yale). at.px in File:Jorge_Aguiar_1492_MR.jpg (5016 x 3878).
export const AGUIAR_NOTES = [
  {
    id: 'aguiar-signature', title: 'The maker\'s name',
    drawn: 'A line of lettering up the chart\'s west edge, the maker\'s signature.',
    real: 'Jorge de Aguiar\'s chart of the Mediterranean, western Europe and the African coast, 1492, now at the Beinecke Library, Yale.',
    source: { label: 'Jorge Aguiar 1492, Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Jorge_Aguiar_1492_MR.jpg' },
    at: { px: [209, 2070], lonlat: null },
  },
  {
    id: 'aguiar-granada', title: 'Granada',
    drawn: 'A city on a green mountain with its flags, inland from the south coast of Spain.',
    real: 'Granada, the last Muslim kingdom in Iberia, surrendered to Castile and Aragon in January 1492, the chart\'s year.',
    source: { label: 'Fall of Granada, Wikipedia', url: 'https://en.wikipedia.org/wiki/Fall_of_Granada' },
    at: { px: [2145, 1560], lonlat: [-3.60, 37.18] },
  },
  {
    id: 'aguiar-lisbon', title: 'Lisbon',
    drawn: 'A walled town at the Tagus mouth, lettered for Lisbon.',
    real: 'Lisbon, where the chart was made, the home port of the Portuguese voyages down Africa.',
    source: { label: 'Lisbon, Wikipedia', url: 'https://en.wikipedia.org/wiki/Lisbon' },
    at: { px: [1895, 1491], lonlat: [-9.14, 38.72] },
  },
  {
    id: 'aguiar-venice', title: 'Venice',
    drawn: 'A walled city on a round green island at the head of the Adriatic.',
    real: 'Venice on its islands in the lagoon, then the great sea power of the eastern Mediterranean.',
    source: { label: 'Venice, Wikipedia', url: 'https://en.wikipedia.org/wiki/Venice' },
    at: { px: [3093, 738], lonlat: [12.33, 45.44] },
  },
  {
    id: 'aguiar-red-sea', title: 'The Red Sea, painted red',
    drawn: 'The Red Sea at the chart\'s east edge, coloured solid red.',
    real: 'The Red Sea is blue-green like any sea; chartmakers painted it red after its name.',
    source: { label: 'Red Sea, Wikipedia', url: 'https://en.wikipedia.org/wiki/Red_Sea' },
    at: { px: [4740, 2290], lonlat: [38.0, 20.0] },
  },
  {
    id: 'aguiar-canaries', title: 'The Canaries',
    drawn: 'A cluster of islands off the African coast, flagged.',
    real: 'The Canary Islands, still being conquered by Castile in 1492; Columbus called there that September on his way west.',
    source: { label: 'Canary Islands, Wikipedia', url: 'https://en.wikipedia.org/wiki/Canary_Islands' },
    at: { px: [1400, 2300], lonlat: [-15.5, 28.3] },
  },
  {
    id: 'aguiar-mina', title: 'The Mina',
    drawn: 'A castle under the Portuguese flag on the Guinea coast.',
    real: 'São Jorge da Mina (Elmina), the fort Portugal built in 1482 to trade for West African gold, and later for slaves.',
    source: { label: 'Elmina Castle, Wikipedia', url: 'https://en.wikipedia.org/wiki/Elmina_Castle' },
    at: { px: [3023, 3037], lonlat: [-1.35, 5.08] },
  },
];

// Battista Agnese's oval world map, map 10 of his portolan atlas, Venice about 1544 (Library of Congress). at.px in
// the LoC IIIF scan (11880 x 8614).
export const AGNESE_NOTES = [
  {
    id: 'agnese-magellan-track', title: 'Magellan\'s track',
    drawn: 'A dark line from Spain down the Atlantic, through a strait at the foot of South America, over the Pacific to the Moluccas and home round Africa.',
    real: 'The Magellan–Elcano voyage of 1519–1522, the first round the world. Five ships left Spain; one, the Victoria, came home, with 18 of the crew.',
    source: { label: 'Magellan expedition, Wikipedia', url: 'https://en.wikipedia.org/wiki/Magellan_expedition' },
    at: { px: [3013, 4595], lonlat: null },
  },
  {
    id: 'agnese-strait', title: 'The strait',
    drawn: 'The track squeezing between South America and a southern land, lettered for Magellan\'s strait.',
    real: 'The Strait of Magellan, found in 1520. The land south of it is Tierra del Fuego, an island, not the edge of a southern continent.',
    source: { label: 'Strait of Magellan, Wikipedia', url: 'https://en.wikipedia.org/wiki/Strait_of_Magellan' },
    at: { px: [4959, 5523], lonlat: [-70.9, -53.5] },
  },
  {
    id: 'agnese-moluccas', title: 'The Moluccas',
    drawn: '"INSULE MALUCHE" at the far west edge, where the track begins and ends.',
    real: 'The Maluku Islands, the Spice Islands of cloves and nutmeg, the prize Magellan sailed for.',
    source: { label: 'Maluku Islands, Wikipedia', url: 'https://en.wikipedia.org/wiki/Maluku_Islands' },
    at: { px: [2107, 4052], lonlat: [127.5, -1.0] },
  },
  {
    id: 'agnese-peru-route', title: 'The road to Peru',
    drawn: 'A gold line from Spain to the isthmus of Panama, lettered for the way to Peru.',
    real: 'The Spanish route to Peru: by sea to the Caribbean side of the isthmus, overland to Panama, then south by sea; Pizarro took the Inca empire from 1532.',
    source: { label: 'Spanish conquest of the Inca Empire, Wikipedia', url: 'https://en.wikipedia.org/wiki/Spanish_conquest_of_the_Inca_Empire' },
    at: { px: [4868, 3735], lonlat: [-79.5, 9.0] },
  },
  {
    id: 'agnese-tenochtitlan', title: 'Temistitan',
    drawn: 'A city in a blue lake in Mexico, "timistitan".',
    real: 'Tenochtitlan, the Aztec capital on an island in Lake Texcoco, taken by Cortés in 1521; Mexico City stands on it.',
    source: { label: 'Tenochtitlan, Wikipedia', url: 'https://en.wikipedia.org/wiki/Tenochtitlan' },
    at: { px: [3691, 3780], lonlat: [-99.13, 19.43] },
  },
  {
    id: 'agnese-california', title: 'A red gulf',
    drawn: 'A long gulf painted red behind a peninsula on the west coast of North America.',
    real: 'The Gulf of California. Francisco de Ulloa sailed to its head in 1539, showing that Baja California is a peninsula, as drawn here; later maps made it an island.',
    source: { label: 'Gulf of California, Wikipedia', url: 'https://en.wikipedia.org/wiki/Gulf_of_California' },
    at: { px: [3035, 3622], lonlat: [-110.5, 26.0] },
  },
  {
    id: 'agnese-red-sea', title: 'The Red Sea, painted red',
    drawn: 'The Red Sea coloured solid red, as the gulf in the west is.',
    real: 'The Red Sea, named red but blue-green like any sea.',
    source: { label: 'Red Sea, Wikipedia', url: 'https://en.wikipedia.org/wiki/Red_Sea' },
    at: { px: [7312, 3803], lonlat: [38.0, 20.0] },
  },
  {
    id: 'agnese-bacalaos', title: 'Land of cod',
    drawn: '"terra de bachalaos", the land of cod, in the north-west Atlantic.',
    real: 'Newfoundland and the Grand Banks, where Portuguese, Basque, French and English boats fished cod through the 1500s.',
    source: { label: 'Grand Banks of Newfoundland, Wikipedia', url: 'https://en.wikipedia.org/wiki/Grand_Banks_of_Newfoundland' },
    at: { px: [5275, 2785], lonlat: [-55.0, 48.5] },
  },
  {
    id: 'agnese-cathay', title: 'America joined to Cathay',
    drawn: 'North America running west off the sheet into "CATAIO", China.',
    real: 'Asia and America are parted by the Bering Strait, which Europeans first sailed through with Vitus Bering in 1728.',
    source: { label: 'Bering Strait, Wikipedia', url: 'https://en.wikipedia.org/wiki/Bering_Strait' },
    at: { px: [2356, 3305], lonlat: null },
  },
];

// Fernão Vaz Dourado's chart 4, the North Atlantic, from his atlas made at Goa in 1580 (Bayerische Staatsbibliothek,
// Cod.icon. 137). at.px in the BSB IIIF scan (10302 x 7611).
export const DOURADO_NOTES = [
  {
    id: 'dourado-arms', title: 'Portugal\'s arms on the far shore',
    drawn: 'The crowned arms of Portugal over the land in the north-west.',
    real: 'The Corte-Real brothers sailed there for Portugal in 1500–1502; King Manuel held such lands to fall on Portugal\'s side of the Treaty of Tordesillas. Portugal never settled them.',
    source: { label: 'Gaspar Corte-Real, Wikipedia', url: 'https://en.wikipedia.org/wiki/Gaspar_Corte-Real' },
    at: { px: [1660, 1600], lonlat: null },
  },
  {
    id: 'dourado-archers', title: 'Archers',
    drawn: 'Naked people with bows among the hills of the north-west.',
    real: 'The coast\'s own peoples. Gaspar Corte-Real\'s 1501 voyage is believed to have seized 57 of them and taken them to Portugal to be enslaved.',
    source: { label: 'Gaspar Corte-Real, Wikipedia', url: 'https://en.wikipedia.org/wiki/Gaspar_Corte-Real' },
    at: { px: [858, 1202], lonlat: null },
  },
  {
    id: 'dourado-lavrador', title: 'Tera do Lavrador',
    drawn: '"TERA DO LAVRADOR" across the north-western land.',
    real: 'Named after João Fernandes Lavrador, who reached these coasts about 1499–1500; for most of the 1500s the name was sometimes given to Greenland too.',
    source: { label: 'Labrador, Wikipedia', url: 'https://en.wikipedia.org/wiki/Labrador' },
    at: { px: [2232, 3222], lonlat: [-61.0, 54.0] },
  },
  {
    id: 'dourado-arctic-circle', title: 'The Arctic Circle',
    drawn: '"CIRCVLVS ARTICVS", a red line across the ocean just north of Iceland.',
    real: 'The Arctic Circle, about 66.5 degrees north; it crosses Iceland only at the island of Grímsey, off the north coast.',
    source: { label: 'Arctic Circle, Wikipedia', url: 'https://en.wikipedia.org/wiki/Arctic_Circle' },
    at: { px: [5150, 2318], lonlat: [-18.0, 66.56] },
  },
  {
    id: 'dourado-iceland', title: 'Islanda',
    drawn: 'Iceland, "Islanda", under the Arctic Circle.',
    real: 'Iceland, then under the Danish crown, visited by English and German ships for its fish.',
    source: { label: 'Iceland, Wikipedia', url: 'https://en.wikipedia.org/wiki/Iceland' },
    at: { px: [6532, 2610], lonlat: [-18.5, 65.0] },
  },
  {
    id: 'dourado-brasil', title: 'O Brazil',
    drawn: 'A small round island far west of Ireland, "obrazil".',
    real: 'Nothing: open Atlantic. Hy-Brasil, always round and always west of Ireland, stayed on charts into the 1800s.',
    source: { label: 'Brasil (mythical island), Wikipedia', url: 'https://en.wikipedia.org/wiki/Brasil_(mythical_island)' },
    at: { px: [6078, 4424], lonlat: null },
  },
  {
    id: 'dourado-azores', title: 'The Azores',
    drawn: 'A scatter of islands mid-ocean, west of Lisbon.',
    real: 'The Azores, Portuguese since the 1430s, the last landfall on the way home from the Americas and the Indies.',
    source: { label: 'Azores, Wikipedia', url: 'https://en.wikipedia.org/wiki/Azores' },
    at: { px: [5065, 5980], lonlat: [-28.0, 38.5] },
  },
];

// Each overlay's notes, the size of the scan their px are read off, and the hit box of a note with no `size` of its
// own (a radius in scan px, about a figure's half-width on that chart).
export const NOTE_SETS = {
  'carta-marina': { scan: { w: 5016, h: 3715 }, size: 120, notes: CARTA_MARINA_NOTES },
  'catalan-atlas': { scan: { w: 46800, h: 15870 }, size: 400, notes: CATALAN_NOTES }, // the eight pages butted, each note on its own page (`page`)
  'catalan-atlas-1959-copy': { scan: { w: 12956, h: 8637 }, size: 200, notes: CATALAN_COPY_NOTES },
  'de-la-cosa': { scan: { w: 2127, h: 1163 }, size: 50, notes: DE_LA_COSA_NOTES },
  aguiar: { scan: { w: 5016, h: 3878 }, size: 120, notes: AGUIAR_NOTES },
  'agnese-world': { scan: { w: 11880, h: 8614 }, size: 250, notes: AGNESE_NOTES },
  'dourado-atlantic': { scan: { w: 10302, h: 7611 }, size: 250, notes: DOURADO_NOTES },
};

// The marks of a laid overlay's notes through the view's projection: [{ x, y, h, hit, area, up, tile }] in canvas px,
// the tile in the shape page.js fillTile takes. The scan px goes through the sheet as it lies now, or, in pieces mode,
// the piece that holds it. `hit` is the note's hit box, the figure's whole outline on the page (`size`, or the set's
// default), and `area` its area, so where boxes nest the smallest wins (pickMark). Nothing for an overlay with no
// notes, or none laid, so the notes are hidden with the scan.
export const NOTE_H = 20;
// A note's page px: on the sheet (`m`, its affine from drawn px), where the sheet lies now, dragged, turned or
// resized; on the warped pieces, through `piece` or the piece that holds it. [] past an azimuthal projection's horizon.
function notePx(overlay, proj, [px, py], m, piece) {
  if (m) { const x = px / (overlay.scale ?? 1), y = py / (overlay.scale ?? 1); return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  piece ??= pieceOf(overlay, px);
  const [lon, lat] = applyFit(piece.fit, px, py);
  if (proj.visible && !proj.visible(lon, lat)) return [];
  return proj.toPx([lon, lat]);
}
const pieceOf = (overlay, px) => overlay.pieces.find((p) => px >= p.x0 && px < p.x1) ?? overlay.pieces.at(-1);
// A note's hit box in scan px round at.px: `size` a radius (a circle, as sixteen points) or [w, h] (a box).
export function noteOutline(n, size = n.size) {
  const [x, y] = n.at.px;
  if (Array.isArray(size)) { const [w, h] = size; return [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]]; }
  return Array.from({ length: 16 }, (_, i) => [x + size * Math.cos((i * Math.PI) / 8), y + size * Math.sin((i * Math.PI) / 8)]);
}
const ringArea = (ring) => Math.abs(ring.reduce((t, [x, y], i) => { const [u, v] = ring[(i + 1) % ring.length]; return t + x * v - u * y; }, 0)) / 2;
const inside = (ring, x, y) => {
  let n = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) n = !n;
  }
  return n;
};
export function noteMarks(overlay, proj, rect) {
  const set = overlay && NOTE_SETS[overlay.id];
  if (!set) return [];
  const out = [], sheet = overlay.mode === 'pieces' ? null : overlay.sheet && sheetTransform(overlay, proj, overlay.sheet);
  if (overlay.mode !== 'pieces' && overlay.sheet && !sheet) return []; // the sheet's centre is past the horizon, so is the sheet
  for (const n of set.notes) {
    const piece = sheet ? null : pieceOf(overlay, n.at.px[0]);
    const [x, y] = notePx(overlay, proj, n.at.px, sheet, piece);
    if (x === undefined) continue;
    const hit = noteOutline(n, n.size ?? set.size).map((p) => notePx(overlay, proj, p, sheet, piece));
    const box = hit.every((p) => p.length && p.every(Number.isFinite)) ? hit : null;
    // in view if the box's bounds overlap the view, so a long box crossing it with no corner inside still counts
    const us = box?.map((p) => p[0]), vs = box?.map((p) => p[1]);
    const seen = box ? Math.min(...us) <= rect.x1 && Math.max(...us) >= rect.x0 && Math.min(...vs) <= rect.y1 && Math.max(...vs) >= rect.y0
      : x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
    if (Number.isFinite(x) && Number.isFinite(y) && seen) {
      const tile = { note: true, title: n.title, drawn: n.drawn, real: n.real, source: n.source?.label, link: n.source?.url };
      out.push({ x, y, h: NOTE_H, hit: box, area: box ? ringArea(box) : 0, up: n.up ?? 0, tile });
    }
  }
  return out;
}
// The mark a click or tap at [x, y] opens: a small drawn mark (a voyage's event, a sight) within `reach` of it
// first, nearest wins; else the smallest note hit box holding the point; else the nearest note within reach.
export function pickMark(marks, [x, y], reach) {
  let pin = null, pinD = Infinity, near = null, nearD = Infinity, boxed = null;
  for (const m of marks) {
    if (m.hit && inside(m.hit, x, y)) { if (!boxed || m.area < boxed.area) boxed = m; continue; }
    const d = Math.hypot(m.x - x, m.y - y);
    if (d > Math.max(reach, m.h / 2)) continue;
    if (!m.hit) { if (d < pinD) { pin = m; pinD = d; } } else if (d < nearD) { near = m; nearD = d; }
  }
  return pin ?? boxed ?? near;
}

// Points of interest close together (docs/spec/design.md): the marks within `reach` of each other, chained, as groups
// [{ marks, lead }], each mark in exactly one, in the order given; `lead` the mark nearest the group's centre, which
// carries the count badge. A group of one is a mark alone.
export function groupMarks(marks, reach) {
  const of = marks.map((_, i) => i), root = (i) => (of[i] === i ? i : (of[i] = root(of[i])));
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
    if (Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y) <= reach) of[root(j)] = root(i);
  }
  const groups = new Map();
  marks.forEach((m, i) => { const r = root(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(m); });
  return [...groups.values()].map((ms) => {
    const cx = ms.reduce((t, m) => t + m.x, 0) / ms.length, cy = ms.reduce((t, m) => t + m.y, 0) / ms.length;
    const lead = ms.reduce((a, b) => (Math.hypot(b.x - cx, b.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? b : a));
    return { marks: ms, lead };
  });
}
// A date as written in the record ("27 Apr 1521", "8 Nov – 21 Dec 1521", "28 Dec 1520 – 3 Jan 1521", "c. 1000 BC", "AD 79")
// to the months it names and the year of each: [{ y, m }] (m null where no month is named), [] where no year can be read.
// A month takes the next year written after it, else the last year in the text. A year is three or four digits, or any
// digits with an era (BC, BCE; AD, CE, before or after); a bare one or two digits is a day.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function readDate(text) {
  const t = String(text ?? '');
  const years = [...t.matchAll(/(?:\b(AD|CE)\s*)?\b(\d{1,4})\b(?:\s*(BCE?|AD|CE)\b)?/g)]
    .map((r) => ({ at: r.index, n: r[2], era: r[3] ?? r[1] }))
    .filter((r) => r.n.length >= 3 || r.era)
    .map((r) => ({ at: r.at, y: Number(r.n) * (r.era?.startsWith('BC') ? -1 : 1) }));
  if (!years.length) return [];
  const ms = [...t.toLowerCase().matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g)];
  if (!ms.length) return [{ y: years.at(-1).y, m: null }];
  return ms.map((r) => ({ y: (years.find((yr) => yr.at > r.index) ?? years.at(-1)).y, m: MONTHS.indexOf(r[1]) }));
}
// The span of a group's dates for its tile's heading: "Apr 1521", "Apr–May 1521", "1519–1521"; '' where none can be read.
export function dateSpan(dates) {
  const all = dates.flatMap(readDate);
  if (!all.length) return '';
  const key = (d) => d.y * 12 + (d.m ?? 0), lo = all.reduce((a, b) => (key(b) < key(a) ? b : a)), hi = all.reduce((a, b) => (key(b) > key(a) ? b : a));
  const year = (y) => (y < 0 ? `${-y} BC` : String(y));
  if (lo.y !== hi.y) return `${year(lo.y)}–${year(hi.y)}`;
  if (all.some((d) => d.m == null)) return year(lo.y);
  return lo.m === hi.m ? `${MONTH_NAMES[lo.m]} ${year(lo.y)}` : `${MONTH_NAMES[lo.m]}–${MONTH_NAMES[hi.m]} ${year(lo.y)}`;
}

// Where a tile sits. The hit area of a mark, in the mark's own px, as a rectangle: the box a click can land in (the
// bounds of a note's `hit` outline, or of the circle of radius max(reach, h / 2) that pickMark gives a drawn mark),
// the circle's square joined to the outline for a note taken by a tap just outside its figure. A rotated figure's
// bounds hold the figure, so a tile clear of the bounds is clear of it.
export function markClear(m, reach) {
  const r = Math.max(reach, m.h / 2), pts = [[m.x - r, m.y - r], [m.x + r, m.y + r], ...(m.hit ?? [])];
  const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
  return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs) };
}
export const TILE_MARGIN = 8; // between a hit area and the tile that describes it, and between the tile and the window's edge, px
// The top-left of a tile of [w, h] beside the hit rectangle `clear`, in the window `win` ({ w, h }), all one unit (client
// px). Never over the rectangle: to its right, else its left, else below, else above, the first side with room for
// the whole tile (the tile is a margin off the rectangle and a margin off the window); `near` = [x, y], the mark or the
// touch, sets where along that side it starts. Where no side has room (a hit box wider than the window), the side with
// the most room: the tile lies against the rectangle's edge where it fits the window and is held inside the window where it
// does not, which can cover part of the rectangle. -> { left, top, side, clear }
export function tileSpot(clear, [w, h], win, [nx, ny], margin = TILE_MARGIN) {
  const room = { right: win.w - margin - (clear.x1 + margin), left: clear.x0 - margin - margin, below: win.h - margin - (clear.y1 + margin), above: clear.y0 - margin - margin };
  const need = { right: w, left: w, below: h, above: h };
  const sides = ['right', 'left', 'below', 'above'];
  const side = sides.find((s) => room[s] >= need[s]) ?? sides.reduce((a, b) => (room[b] > room[a] ? b : a));
  const hold = (v, size, span) => Math.max(margin, Math.min(v, span - margin - size)); // inside the window, a margin from its edges
  const across = (v, size, span) => hold(v - margin, size, span); // along the side: starting a margin before the mark
  const left = side === 'right' ? clear.x1 + margin : side === 'left' ? clear.x0 - margin - w : across(nx, w, win.w);
  const top = side === 'below' ? clear.y1 + margin : side === 'above' ? clear.y0 - margin - h : across(ny, h, win.h);
  const spot = { left: hold(left, w, win.w), top: hold(top, h, win.h) };
  const covers = spot.left < clear.x1 && spot.left + w > clear.x0 && spot.top < clear.y1 && spot.top + h > clear.y0;
  return { ...spot, side, clear: !covers };
}
