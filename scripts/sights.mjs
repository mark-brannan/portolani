// The tile each astrolabe point of interest and chart-making site opens on a click or tap: { date, text }, the
// date when the place made its name (a year, a century or a span), shown under its name in the list and on the
// tile, and the text, its caption in the list and the tile's body; keyed
// by the name the page lists it under. The mark stands where the button's view is centred, unless the tile says
// `at: [lon, lat]` (a view framing several islands is centred on the sea between them, Alexandria's ruin on the Pharos), or
// `at: [[lon, lat], ...]` for one tile at several marks (Tyre's two sites, 1.7 km apart; at a wide view they stand side by side).
// `ruin: true` draws a ruin there always, beside a town of today or over it (Tyre, Carthage, Ostia, Old Goa);
// `ruin: 'clear'` draws one only where no town is drawn on the site, so a city that covers it stands for it at a
// wide zoom and the ruin shows beside it close up where there is room (Barygaza under Bharuch). Any other place gets
// the plain tower where nothing else is drawn. Nothing is lettered beside it.
export const SIGHT_TILES = {
  // where the charts were made
  Genoa: { date: '1311', text: 'Genoese chartmakers drew some of the earliest signed portolan charts. Pietro Vesconte, who signed "de Janua", made a dated atlas, with the coasts in a compass-rose web of rhumb lines rather than in degrees.' },
  Venice: { date: '1367', text: 'Venice was where a captain bought charts and where mapmakers like the Pizzigani brothers worked. Its galleys sailed to Flanders and the Levant on charts like theirs, and Olaus Magnus had his Carta Marina printed here in 1539.' },
  Majorca: { date: '1375', text: 'The Jewish chartmakers of Palma, Cresques Abraham among them, drew the Catalan Atlas for the heir to the Aragonese throne. It shows Mansa Musa, lord of Mali, holding a nugget, and sailing lines out to the edge of the known world.' },
  Lisbon: { date: '1500s', text: 'The Armazém da Guiné e Índia kept the secret master chart on which every coast the Portuguese reached was entered, and ships\' pilots drew their copies from it. From here each year\'s fleet set out round Africa to India.' },
  Seville: { date: '1503', text: 'Spain kept its own master chart, the Padrón Real, at the Casa de Contratación, and a pilot who had been somewhere new was required to report it. Magellan\'s and Elcano\'s voyage began and ended nearby.' },
  Dieppe: { date: '1547', text: 'The Dieppe school of Normandy drew large, richly coloured atlases, such as the Vallard, with a great southern land and the Portuguese routes to the Indies. Mariners and merchants of the port sailed to Brazil and beyond.' },
  'El Puerto de Santa María': { date: '1500', text: 'Juan de la Cosa, owner of the Santa María and one of Columbus\'s captains, signed his world chart here: "Juan de la Cosa la fizo en el puerto de Santa María en año de 1500". It is the earliest surviving European map to show the New World.' },
  Frankfurt: { date: '1590', text: 'Theodor de Bry, an engraver from Liège, published his America here in 1590. Its first part copied John White\'s paintings of Virginia, and these prints set the image of the New World for a century of Europeans.' },
  // the ancient world
  Alexandria: { ruin: true, at: [29.886, 31.214], date: '331 BC', text: 'Founded by Alexander in 331 BC. Its lighthouse, the Pharos, was one of the wonders of the world and gave a word for lighthouse in several languages; its library was where Eratosthenes measured the earth.' },
  Tyre: { ruin: true, at: [[35.1933, 33.2681], [35.2111, 33.2692]], date: 'c. 1000 BC', text: 'Tyre, an island city off Lebanon, sent out the Phoenician ships that founded Carthage and Gades, and was said to have colonised the whole western Mediterranean. Alexander had to build a causeway to take it. Two sites are dug: on the old island, the colonnaded street, baths and harbour quarter; on the mainland at Al-Bass, the Phoenician cemetery under the Roman road, arch and hippodrome.' },
  Carthage: { ruin: true, date: 'c. 814–146 BC', text: 'Founded from Tyre, Carthage ruled the western Mediterranean until Rome destroyed it in 146 BC. Its sailors, Hanno among them, explored the Atlantic coast of Africa.' },
  Ostia: { ruin: true, date: '1st–2nd c. AD', text: 'Rome\'s port at the Tiber mouth, where grain from Egypt and Africa was landed and carried upriver. Silt has left its ruins inland.' },
  Berenike: { date: 'c. 275 BC', text: 'A Ptolemaic port on the Red Sea, from which the monsoon ships sailed to India with Roman gold and came back with pepper, pearls and cloth. Its ruins have been dug from the sand since the 1990s.' },
  Barygaza: { ruin: 'clear', date: '1st c. AD', text: 'Bharuch on the Narmada. The Periplus of the Erythraean Sea, a Greek merchant\'s guide of the first century, warns of its tides, which came in like an army, and tells pilots to wait for the local pilots to take them up the gulf.' },
  // the medieval Indian Ocean and Asia
  Siraf: { date: '9th–10th c.', text: 'Siraf, on the Persian shore of the Gulf, was where Arab and Persian ships set out for Guangzhou in the 9th century; the merchants\' accounts of China and India collected in 851 begin here. An earthquake in 977 and the rise of Kish ended it.' },
  Aden: { ruin: true, date: '11th–13th c.', text: 'Aden, in a volcanic crater at the mouth of the Red Sea, was where the goods of India were landed for Egypt and the Mediterranean; the letters of the Jewish merchants of Cairo who traded to India pass through it. Ibn Battuta, here in 1331, found its merchants rich and its water held in cisterns.' },
  Kilwa: { date: '13th–15th c.', text: 'An island city of the Swahili coast that held the gold trade from Sofala in the south. Ibn Battuta, here in 1331, called it one of the most beautiful and best-built towns in the world; its Great Mosque and the palace of Husuni Kubwa stand in ruins. The Portuguese sacked it in 1505.' },
  Calicut: { ruin: 'clear', date: '14th–15th c.', text: 'The port of the Zamorin on the Malabar coast, where pepper and ginger were sold to Arab, Gujarati and Chinese merchants. Zheng He\'s fleets called here, and Vasco da Gama came ashore nearby in 1498.' },
  Malacca: { ruin: true, date: 'c. 1400–1511', text: 'Founded about 1400 by Parameswara, a prince from Sumatra, Malacca held the strait between the Indian Ocean and the China seas, and in its harbour, Tomé Pires wrote, eighty-four languages were spoken. Albuquerque took it for Portugal in 1511.' },
  Quanzhou: { ruin: 'clear', date: '11th–14th c.', text: 'Zayton to the Arab and Persian traders, Quanzhou was the greatest port of Song and Yuan China, with a mosque, Hindu temples and an office of maritime trade. Marco Polo sailed from here in 1291, and Ibn Battuta landed here in the 1340s.' },
  // the age of discovery
  'São Jorge da Mina': { date: '1482', text: 'The Portuguese built São Jorge da Mina in 1482 on the Gold Coast to buy gold. From the 1500s the Portuguese, and after 1637 the Dutch who took it from them, shipped enslaved people from here across the Atlantic.' },
  Goa: { ruin: true, date: '1510', text: 'Taken by Afonso de Albuquerque in 1510, Goa remained Portugal\'s capital in Asia for four and a half centuries, until India took it in 1961. The pepper fleets, and the Inquisition, were based here.' },
  Manila: { date: '1571', text: 'Legazpi took the Muslim town of Maynila in 1571 and made it the west end of the galleon trade: Chinese silk and porcelain went across the Pacific to Acapulco, and Mexican silver came back.' },
  Acapulco: { date: '1565', text: 'After Urdaneta found the way back across the Pacific in 1565, the Manila galleon unloaded here once a year, and the fair of Acapulco sold Asia\'s silk to the Americas.' },
  Batavia: { date: '1619', text: 'Founded in 1619 by the Dutch East India Company on the ruins of Jayakarta, and laid out like a Dutch town with canals. Today it is Jakarta.' },
  // the modern world
  Suez: { date: '1869', text: 'The canal, opened in 1869, cut the voyage from London to Bombay (Mumbai) by some 4,000 miles and steamships took it, leaving the Cape route to sailing ships.' },
  Panama: { date: '1914', text: 'The canal, opened in 1914, saved ships the long way round Cape Horn. The Spanish had once carried gold across the isthmus on mule-back, and Drake raided the route.' },
  Singapore: { date: '1819', text: 'Raffles founded a British trading post here in 1819, by treaty with the Johor chiefs, where the old port of Temasek had stood, and it became one of the world\'s busiest ports.' },
  'Hong Kong': { date: '1841', text: 'Britain occupied the island in 1841 and took it by treaty in 1842, at the end of the First Opium War. That war was fought to keep British opium selling into China. A fishing coast became a free port within a few years.' },
  Shanghai: { date: '1843', text: 'Opened to foreign trade by the treaty that ended the First Opium War, on Britain\'s terms, Shanghai grew in a few decades from a county town into China\'s greatest port.' },
  Rotterdam: { date: '1872', text: 'A new cut to the North Sea, finished in 1872, took ocean ships to Rotterdam without the silting of the old channels and made it the gateway of the Rhine.' },
  // remote islands
  'Pukapuka Atoll': { date: '1521', text: 'Magellan\'s ships sighted an atoll, usually taken to be this one, of the Tuamotus on 24 January 1521 and called it San Pablo; Pigafetta recorded no anchorage and nobody ashore, and they sailed on. Its village stands on the eastern shore today.' },
  'Pitcairn Islands': { at: [-130.10, -25.07], date: '1790', text: 'Four islands of volcanic and coral rock. Pitcairn itself, its Polynesian settlers long gone, was empty when the Bounty mutineers and the Tahitians with them landed in 1790 to hide from the Royal Navy. Their descendants live at Adamstown today.' },
};
