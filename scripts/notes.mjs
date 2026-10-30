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

// The Catalan Atlas, sheet 5 (File:Catalan_Atlas_BNF,_sheet_5.jpg, 6454 x 15862), the Atlantic edge of its
// westernmost panel; at.px is in the eight pages laid side by side, sheet 5 first, cropped at its own x 288. Quoted legends are the Cresques Project's English translations of panel III
// (https://www.cresquesproject.net/catalan-atlas-legends/panel-iii), cited by their numbers there; the island names
// are read off the scan. at.lonlat is notional for the tents and the cape of Africa.
export const CATALAN_NOTES = [
  {
    id: 'irish-wonders', title: 'The wonders of Ireland',
    drawn: 'A legend west of Ireland (III.1): of its many islands, "a small one where men never die", for they are carried off it to die; no snakes, frogs or poisonous spiders; and "trees that attract birds like ripe figs".',
    real: 'Gerald of Wales\'s Topography of Ireland, about 1188, which the legend follows: the island of the living is Monaincha, a bog island near Roscrea. Ireland truly has no native snakes; the sea cut it off before they came back after the Ice Age.',
    source: { label: 'Cresques Project III.1; Monaincha', url: 'https://en.wikipedia.org/wiki/Monaincha' },
    at: { px: [3112, 3600], lonlat: [-7.80, 52.95] },
  },
  {
    id: 'stillanda', title: 'Stillanda',
    drawn: 'A dark island at the top of the sheet, north-east of the Irish legend, "Island of Stillanda, where they speak the language of Norway and are Christians" (III.2).',
    real: 'Iceland, or Shetland: both spoke Norse, were Christian and were under the Norwegian crown in 1375. Iceland lies north-west of where the fit puts the drawing.',
    source: { label: 'Cresques Project III.2; Iceland', url: 'https://en.wikipedia.org/wiki/Iceland' },
    at: { px: [5232, 1680], lonlat: [-19.0, 64.9] },
  },
  {
    id: 'brasil', title: 'Brasil',
    drawn: 'A round purple island west of Ireland, a ring of land round a dotted middle.',
    real: 'Nothing: open Atlantic. Hy-Brasil sat on charts from the 1320s, always round and always west of Ireland; Bristol ships went looking for it in the 1480s, and it left the charts only in the 1800s.',
    source: { label: 'Brasil (mythical island), Wikipedia', url: 'https://en.wikipedia.org/wiki/Brasil_(mythical_island)' },
    at: { px: [3952, 4780], lonlat: null },
  },
  {
    id: 'corvi-marini', title: 'The island of sea crows',
    drawn: 'A gilt island far out from Galicia, "insule de corvi marini", the islands of sea crows (cormorants).',
    real: 'Perhaps the Azores, 1,300 km further west, which the Portuguese reached only about 1427. Corvo, the smallest and most westerly, may take its name from these charts.',
    source: { label: 'Corvo Island, Wikipedia', url: 'https://en.wikipedia.org/wiki/Corvo_Island' },
    at: { px: [2965, 8908], lonlat: [-31.11, 39.70] },
  },
  {
    id: 'madeira', title: 'The island of timber',
    drawn: 'A gilt half-disc, "insula de legname", the island of timber, with Porto Santo above and the Desertas below.',
    real: 'Madeira, Portuguese for wood. Empty of people in 1375; Zarco and Teixeira claimed it for Portugal in 1419–20 and the settlers burned much of the forest.',
    source: { label: 'Madeira, Wikipedia', url: 'https://en.wikipedia.org/wiki/Madeira' },
    at: { px: [2932, 11980], lonlat: [-16.95, 32.75] },
  },
  {
    id: 'fortunate-isles', title: 'The Fortunate Isles',
    drawn: 'A long legend, upside down to the chart, on the islands "called fortunate because they are replete with all sorts of goods", among them the goat and dog islands; it calls the pagans\' belief that they are paradise a fable (III.4).',
    real: 'The Canaries, home of the Guanches. The names are Pliny\'s, after King Juba\'s men, who found big dogs on Canaria; Ptolemy ran his prime meridian through the islands.',
    source: { label: 'Cresques Project III.4; Canary Islands', url: 'https://en.wikipedia.org/wiki/Canary_Islands' },
    at: { px: [912, 10900], lonlat: [-15.6, 28.1] },
  },
  {
    id: 'isle-of-hell', title: 'The isle of hell',
    drawn: 'A red island with a white peak, lettered the isle of hell.',
    real: 'Tenerife and Teide, 3,715 m, the highest peak in Spain and an active volcano: the Guanches held that Guayota, their devil, lived inside it. Columbus saw it erupt in 1492.',
    source: { label: 'Teide, Wikipedia', url: 'https://en.wikipedia.org/wiki/Teide' },
    at: { px: [2472, 13870], lonlat: [-16.64, 28.27] },
  },
  {
    id: 'lanzarote', title: 'Lanzarotto\'s island',
    drawn: 'A dark island with a red cross, the arms of Genoa: "insula de lanzaroto maloxelo".',
    real: 'Lanzarote, still named after Lanzarotto Malocello, a Genoese who landed there about 1312 and stayed some twenty years, until the islanders drove him out.',
    source: { label: 'Lanzarotto Malocello, Wikipedia', url: 'https://en.wikipedia.org/wiki/Lanzarotto_Malocello' },
    at: { px: [3852, 13380], lonlat: [-13.63, 29.05] },
  },
  {
    id: 'jaume-ferrer', title: 'Jaume Ferrer\'s ship',
    drawn: 'A ship under the red and gold of Majorca: "The ship of Jaume Ferrer departed for the River of Gold on the 10th of August of 1346, the feast of St. Lawrence" (III.5).',
    real: 'Ferrer, a Majorcan, sailed south past the Canaries for the gold of West Africa and was never heard of again. No ship is known to have passed Cape Bojador and come back until Gil Eanes in 1434.',
    source: { label: 'Cresques Project III.5; Jaume Ferrer', url: 'https://en.wikipedia.org/wiki/Jaume_Ferrer' },
    at: { px: [2712, 15000], lonlat: null },
  },
  {
    id: 'finisterre-of-africa', title: 'The western end of Africa',
    drawn: 'A legend under the coast: "Here starts Africa, which ends in Alexandria and Babylon", a cape at the world\'s western end, with ivory from its many elephants (III.6).',
    real: 'The coast runs on another 3,000 km south to Cape Verde. North Africa\'s own elephants had died out by Roman times; the ivory came across the Sahara from the south.',
    source: { label: 'Cresques Project III.6; North African elephant', url: 'https://en.wikipedia.org/wiki/North_African_elephant' },
    at: { px: [4512, 15000], lonlat: [-14.5, 26.13] },
  },
  {
    id: 'tents', title: 'The tents of Gozola',
    drawn: 'Black tents with gold finials under "GOZOLA". The panel\'s legend of the desert peoples: veiled so only their eyes show, they live in tents and ride camels (III.11).',
    real: 'The Gazula, Berbers of the Sous and the Anti-Atlas, on the caravan road south from Morocco; veiling was the mark of the Sanhaja and the Tuareg men of the desert.',
    source: { label: 'Cresques Project III.11; Tuareg people', url: 'https://en.wikipedia.org/wiki/Tuareg_people' },
    at: { px: [4912, 14120], lonlat: [-10.06, 28.99] },
  },
];

// Each overlay's notes and the size of the scan their px are read off.
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

export const NOTE_SETS = {
  'carta-marina': { scan: { w: 5016, h: 3715 }, notes: CARTA_MARINA_NOTES },
  'catalan-atlas': { scan: { w: 46800, h: 15870 }, notes: CATALAN_NOTES }, // the eight pages butted; sheet 5's notes at its own px less its crop, 288
  'de-la-cosa': { scan: { w: 2127, h: 1163 }, notes: DE_LA_COSA_NOTES },
  aguiar: { scan: { w: 5016, h: 3878 }, notes: AGUIAR_NOTES },
  'agnese-world': { scan: { w: 11880, h: 8614 }, notes: AGNESE_NOTES },
  'dourado-atlantic': { scan: { w: 10302, h: 7611 }, notes: DOURADO_NOTES },
};

// The marks of a laid overlay's notes through the view's projection: [{ x, y, h, tile }] in canvas px, the
// tile in the shape page.js fillTile takes. The scan px goes through the sheet as it lies now, or, in pieces mode, the piece that holds it.
// Nothing for an overlay with no notes, or none laid, so the notes are hidden with the scan.
export const NOTE_H = 20;
// A note's page px: on the sheet (`m`, its affine from drawn px), where the sheet lies now, dragged, turned or
// resized; on the warped pieces, through the piece that holds it. [] past an azimuthal projection's horizon.
function notePx(overlay, proj, [px, py], m) {
  if (m) { const x = px / (overlay.scale ?? 1), y = py / (overlay.scale ?? 1); return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  const piece = overlay.pieces.find((p) => px >= p.x0 && px < p.x1) ?? overlay.pieces.at(-1);
  const [lon, lat] = applyFit(piece.fit, px, py);
  if (proj.visible && !proj.visible(lon, lat)) return [];
  return proj.toPx([lon, lat]);
}
export function noteMarks(overlay, proj, rect) {
  const set = overlay && NOTE_SETS[overlay.id];
  if (!set) return [];
  const out = [], sheet = overlay.mode === 'pieces' ? null : overlay.sheet && sheetTransform(overlay, proj, overlay.sheet);
  if (overlay.mode !== 'pieces' && overlay.sheet && !sheet) return []; // the sheet's centre is past the horizon, so is the sheet
  for (const n of set.notes) {
    const [x, y] = notePx(overlay, proj, n.at.px, sheet);
    if (x === undefined) continue;
    if (Number.isFinite(x) && Number.isFinite(y) && x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) {
      out.push({ x, y, h: NOTE_H, tile: { title: n.title, drawn: n.drawn, real: n.real, source: n.source.label, link: n.source.url } });
    }
  }
  return out;
}
