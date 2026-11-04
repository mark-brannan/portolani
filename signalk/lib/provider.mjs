// The converter's store as a Signal K resource provider for a custom type: the list is the catalogue,
// one resource is a cell's entry, and its property is one layer, `/<type>/<cell>/<CLASS>`.
import { gunzipSync } from 'node:zlib';
import { readCatalogue, layerFile } from './cells.mjs';

export const RESOURCE_TYPE = 'enc-geojson';
const entry = ({ source, ...e }) => e;

export function resourceProvider(store) {
  return {
    type: RESOURCE_TYPE,
    methods: {
      listResources: async () => Object.fromEntries(Object.entries(readCatalogue(store())).map(([id, e]) => [id, entry(e)])),
      async getResource(id, property) {
        const e = readCatalogue(store())[id];
        if (!e) throw new Error(`no cell ${id}`);
        if (!property) return entry(e);
        const gz = layerFile(store(), id, property);
        if (!gz) throw new Error(`no layer ${property} in ${id}`);
        return JSON.parse(gunzipSync(gz));
      },
      setResource: async () => { throw new Error(`${RESOURCE_TYPE} is read-only: its cells come from the charts folder`); },
      deleteResource: async () => { throw new Error(`${RESOURCE_TYPE} is read-only: its cells come from the charts folder`); },
    },
  };
}
