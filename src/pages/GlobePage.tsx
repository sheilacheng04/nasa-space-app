import { useEffect } from 'react';
import { initGlobe, pauseGlobe, resumeGlobe, setGlobePoints, flyTo } from '../world.js';
import { closeLocalWindow } from '../local-window.js';
import type { Observation, Place, Site } from '../types';

export function GlobePage({active, sites, points, place}: {active: boolean; sites: Site[]; points: Observation[]; place: Place | null}) {
  useEffect(() => { setGlobePoints(sites, points); }, [sites, points]);
  useEffect(() => {
    let current = true;
    if (active) {
      initGlobe(sites, points, (id: string) => { location.hash = 'sites/' + id; }).then(globe => {
        if (!current) return;
        if (globe) { resumeGlobe(); if (place) flyTo(...place.geometry.coordinates); }
      }).catch(console.error);
    } else { pauseGlobe(); closeLocalWindow(); }
    return () => { current = false; pauseGlobe(); closeLocalWindow(); };
  }, [active, sites, place]);
  return <section id="page-globe" className="page" hidden={!active}><section id="globe-section" className="globe-section"><h1 className="sr-only">Explore the Pacific globe</h1><div id="globe-stage"><div id="globe-canvas"/><p id="globe-status" className="globe-status" role="status">Loading the globeâ€¦</p></div></section></section>;
}
