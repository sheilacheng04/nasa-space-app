import { feature } from 'topojson-client';
import { dataFile } from './services.js';

let geographyPromise;

export async function geography() {
  if (!geographyPromise) {
    geographyPromise = dataFile('world.topo.json')
      .then((topo) => feature(topo, topo.objects.countries))
      .catch((error) => {
        geographyPromise = null;
        throw error;
      });
  }
  return geographyPromise;
}
