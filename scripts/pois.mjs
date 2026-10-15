// Points of interest: places the chart should letter whatever Natural Earth's city data holds, each
// a house, a tent or the like in the Carta Marina's hand (buildings.mjs), from POI_ZOOM on. They are
// the places the page flies to that are too small for the data (an island, an atlas's port, an atoll),
// and each is a subject the cartouche can name. Natural Earth's own place of the same neighbourhood
// is not added a second time.
//   name: the lettering and the cartouche's title; building: a building id from buildings.mjs.
export const POI_ZOOM = 4;
export const POIS = [
  { name: 'Majorca', lon: 2.65, lat: 39.57, building: 'church' }, // Palma, the Catalan Atlas
  { name: 'Dieppe', lon: 1.08, lat: 49.93, building: 'house' }, // the Vallard Atlas
  { name: 'Guam', lon: 144.79, lat: 13.44, building: 'tent' }, // Islas de los Ladrones
  { name: 'Marquesas', lon: -140.1, lat: -8.91, building: 'tent' }, // Taiohae, Nuku Hiva
  { name: 'Pukapuka', lon: -138.8, lat: -14.82, building: 'tent' }, // Magellan's San Pablo
  { name: 'Pitcairn', lon: -130.1, lat: -25.07, building: 'house' }, // Adamstown
];
