// The tile each astrolabe point of interest and chart-making site opens on a click or tap: { date, text }
// by the name the page lists it under. The mark stands where the button's view is centred, unless the tile says
// `at: [lon, lat]` (a view framing several islands is centred on the sea between them). Nothing is lettered beside it.
export const SIGHT_TILES = {
  // where the charts were made
  Genoa: { date: 'Vesconte, 1311', text: 'Genoese chartmakers drew some of the earliest signed portolan charts. Pietro Vesconte, who signed "de Janua", made a dated atlas, with the coasts in a compass-rose web of rhumb lines rather than in degrees.' },
  Venice: { date: 'Pizzigani, 1367', text: 'Venice was where a captain bought charts and where mapmakers like the Pizzigani brothers worked. Its galleys sailed to Flanders and the Levant on charts like theirs, and Olaus Magnus had his Carta Marina printed here in 1539.' },
  Majorca: { date: 'Cresques, 1375', text: 'The Jewish chartmakers of Palma, Cresques Abraham among them, drew the Catalan Atlas for the heir to the Aragonese throne. It shows the Sahara\'s gold king, Mansa Musa, holding a nugget, and sailing lines out to the edge of the known world.' },
  Lisbon: { date: 'the Armazém; the Carreira da Índia', text: 'The Armazém da Guiné e Índia kept the secret master chart on which every discovery of the Portuguese was entered, and ships\' pilots drew their copies from it. From here each year\'s fleet set out round Africa to India.' },
  Seville: { date: 'Casa de Contratación', text: 'Spain kept its own master chart, the Padrón Real, at the Casa de Contratación, and a pilot who had been somewhere new was required to report it. Magellan\'s and Elcano\'s voyage began and ended nearby.' },
  Dieppe: { date: 'Vallard, 1547', text: 'The Dieppe school of Normandy drew large, richly coloured atlases, such as the Vallard, with a great southern land and the Portuguese discoveries in the Indies. Mariners and merchants of the port sailed to Brazil and beyond.' },
  'El Puerto de Santa María': { date: 'De la Cosa, 1500', text: 'Juan de la Cosa, owner of the Santa María and one of Columbus\'s captains, signed his world chart here: "Juan de la Cosa la fizo en el puerto de Santa María en año de 1500". It is the earliest surviving European map to show the New World.' },
  Frankfurt: { date: 'De Bry, 1590', text: 'Theodor de Bry, an engraver from Liège, published his America here in 1590. Its first part copied John White\'s paintings of Virginia, and these prints set the image of the New World for a century of Europeans.' },
  // the ancient world
  Alexandria: { date: 'Ptolemaic; the Pharos', text: 'Founded by Alexander in 331 BC. Its lighthouse, the Pharos, was one of the wonders of the world and gave a word for lighthouse in several languages; its library was where Eratosthenes measured the earth.' },
  Tyre: { date: 'Phoenician', text: 'Tyre, an island city off Lebanon, sent out the Phoenician ships that founded Carthage and Gades, and was said to have colonised the whole western Mediterranean. Alexander had to build a causeway to take it.' },
  Carthage: { date: 'Phoenician, then Punic', text: 'Founded from Tyre, Carthage ruled the western Mediterranean until Rome destroyed it in 146 BC. Its sailors, Hanno among them, explored the Atlantic coast of Africa.' },
  Ostia: { date: "Rome's harbour", text: 'Rome\'s port at the Tiber mouth, where grain from Egypt and Africa was landed and carried upriver. Silt has left its ruins inland.' },
  Berenike: { date: 'Red Sea, for India', text: 'A Ptolemaic port on the Red Sea, from which the monsoon ships sailed to India with Roman gold and came back with pepper, pearls and cloth. Its ruins have been dug from the sand since the 1990s.' },
  Barygaza: { date: 'in the Periplus', text: 'Bharuch on the Narmada. The Periplus of the Erythraean Sea, a Greek merchant\'s guide of the first century, warns of its tides, which came in like an army, and tells pilots to wait for the local pilots to take them up the gulf.' },
  // the age of discovery
  Elmina: { date: 'Portuguese, then Dutch, fort', text: 'The Portuguese built São Jorge da Mina in 1482 on the Gold Coast to buy gold. From the 1500s the Portuguese, and after 1637 the Dutch who took it from them, shipped enslaved people from here across the Atlantic.' },
  Goa: { date: "Portugal's Asian capital", text: 'Taken by Afonso de Albuquerque in 1510, Goa remained Portugal\'s capital in Asia for four and a half centuries, until India took it in 1961. The pepper fleets, and the Inquisition, were based here.' },
  Manila: { date: 'the galleons, 1571', text: 'Founded by Legazpi in 1571 as the west end of the galleon trade: Chinese silk and porcelain went across the Pacific to Acapulco, and Mexican silver came back.' },
  Acapulco: { date: 'the galleons, 1565', text: 'After Urdaneta found the way back across the Pacific in 1565, the Manila galleon unloaded here once a year, and the fair of Acapulco sold Asia\'s silk to the Americas.' },
  Batavia: { date: 'the VOC, 1619', text: 'Founded in 1619 by the Dutch East India Company on the ruins of Jayakarta, and laid out like a Dutch town with canals. Today it is Jakarta.' },
  // the modern world
  Suez: { date: 'the canal, 1869', text: 'The canal, opened in 1869, cut the voyage from London to Bombay by some 4,000 miles and steamships took it, leaving the Cape route to sailing ships.' },
  Panama: { date: 'the canal, 1914', text: 'The canal, opened in 1914, saved ships the long way round Cape Horn. The Spanish had once carried gold across the isthmus on mule-back, and Drake raided the route.' },
  Singapore: { date: '1819', text: 'Raffles founded a British trading post here in 1819, beside a Malay village at the river mouth, and it became one of the world\'s busiest ports.' },
  'Hong Kong': { date: '1841', text: 'Ceded to Britain in 1842 after the First Opium War, fought to keep British opium selling into China, a fishing coast became a free port within a few years.' },
  Shanghai: { date: 'treaty port, 1843', text: 'Opened to foreign trade by the treaty that ended the First Opium War, on Britain\'s terms, Shanghai grew in a few decades from a county town into China\'s greatest port.' },
  Rotterdam: { date: 'the Nieuwe Waterweg, 1872', text: 'A new cut to the North Sea, finished in 1872, took ocean ships to Rotterdam without the silting of the old channels and made it the gateway of the Rhine.' },
  // remote islands
  'Pukapuka Atoll': { date: "Magellan's San Pablo, 1521", text: 'Magellan\'s ships sighted this atoll of the Tuamotus on 24 January 1521 and called it San Pablo; Pigafetta recorded no anchorage and nobody ashore, and they sailed on. Its village stands on the eastern shore today.' },
  'Pitcairn Islands': { at: [-130.10, -25.07], date: 'the Bounty, 1790', text: 'Four islands of volcanic and coral rock. Pitcairn itself, its Polynesian settlers long gone, was empty when the Bounty mutineers and the Tahitians with them landed in 1790 to hide from the Royal Navy. Their descendants live at Adamstown today.' },
};
