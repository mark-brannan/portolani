// Points of interest: places the chart should letter whatever Natural Earth's city data holds, each
// a house, a tent or the like in the Carta Marina's hand (buildings.mjs), from POI_ZOOM on. They are
// the places the page flies to that are too small for the data (an island, an atlas's port, an atoll),
// and each is a subject the cartouche can name. Natural Earth's own place of the same neighbourhood
// is not added a second time.
//   name: the lettering and the cartouche's title; building: a building id from buildings.mjs or a tower id
//   from scene.mjs; palms: how many palms (trees.mjs) stand beside it where there is land for them.
export const POI_ZOOM = 4;
export const POIS = [
  { name: 'Majorca', lon: 2.65, lat: 39.57, building: 'tower', palms: 2 }, // Palma, the Catalan Atlas
  { name: 'Dieppe', lon: 1.08, lat: 49.93, building: 'church' }, // the Vallard Atlas
  { name: 'Guam', lon: 144.79, lat: 13.44, building: 'tent', palms: 2 }, // Islas de los Ladrones
  { name: 'Marquesas', lon: -140.1, lat: -8.91, building: 'tent', palms: 2 }, // Taiohae, Nuku Hiva
  { name: 'Pukapuka', lon: -138.8, lat: -14.82, building: 'tent', palms: 2 }, // Magellan's San Pablo
  { name: 'Pitcairn', lon: -130.1, lat: -25.07, building: 'tent', palms: 2 }, // Adamstown
  // ports with no town today, a castle for now in place of a ruin
  { name: 'Berenike', lon: 35.47, lat: 23.91, building: 'castle' },
  { name: 'Siraf', lon: 52.33, lat: 27.67, building: 'castle' },
  { name: 'Kilwa', lon: 39.52, lat: -8.96, building: 'castle', palms: 2 },
  // the rest of the Pitcairn Islands, each at the middle of its Natural Earth 10m outline
  { name: 'Henderson', lon: -128.32, lat: -24.369, building: 'tent', palms: 2 },
  { name: 'Ducie', lon: -124.788, lat: -24.669, building: 'tent', palms: 1 },
  { name: 'Oeno', lon: -130.747, lat: -23.93, building: 'tent', palms: 1 },
];
