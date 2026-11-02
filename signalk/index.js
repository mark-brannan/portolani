// A Signal K plugin, and the webapp in public/: ENC cells from a charts folder, converted to GeoJSON
// (lib/cells.mjs) and served over the Resources API (lib/provider.mjs) for the webapp to draw.
import { join, dirname } from 'node:path';
import { syncStore } from './lib/cells.mjs';
import { resourceProvider } from './lib/provider.mjs';

export default function plugin(app) {
  let store = null, registered = false, timer = null;
  // signalk-charts-provider-simple keeps the cells it is given in its data dir's enc-store
  const defaultCharts = () => join(dirname(app.getDataDirPath()), 'signalk-charts-provider-simple', 'enc-store');
  return {
    id: 'signalk-portolani',
    name: 'Portolani',
    description: 'ENC cells drawn as a portolan chart',
    schema: {
      type: 'object',
      properties: { charts: { type: 'string', title: 'Folder of ENC cells (.000 and their updates), searched at any depth; empty for signalk-charts-provider-simple\'s enc-store' } },
    },
    start(options = {}) {
      store = join(app.getDataDirPath(), 'cells');
      if (!registered) { app.registerResourceProvider(resourceProvider(() => store)); registered = true; }
      const charts = options.charts || defaultCharts();
      app.setPluginStatus(`Converting the cells in ${charts}`);
      // after start returns, so the server is not held while the cells convert
      timer = setTimeout(() => {
        try {
          const cat = syncStore(charts, store, (line) => app.debug(line));
          app.setPluginStatus(`${Object.keys(cat).length} cells from ${charts}`);
        } catch (e) { app.setPluginError(e.message); }
      }, 0);
    },
    stop() { clearTimeout(timer); },
  };
}
