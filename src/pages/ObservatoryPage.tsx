import { useEffect, useRef, useState } from 'react';
import { dataFile, errorMessage, hosted, weather } from '../api/client';
import { showRadar, stopRadar, isDemo } from '../radar.js';
import { chart } from '../charts.js';
import { formatDate } from '../core.js';
import { Markup } from '../components/Markup';
import type { Site, Weather } from '../types';

const contextLayers = [
  ['NASA GIBS / MODIS', 'Optical imagery. Enable it in the geographic map; cloud cover may obscure the surface.', 'https://nasa-gibs.github.io/gibs-api-docs/access-basics/'],
  ['ESA WorldCover', 'Land-cover reference. Local raster pending; it is not a current crop map.', 'https://esa-worldcover.org/en/data-access'],
  ['WorldPop', 'Population context. Local raster pending; no exposure counts have been calculated.', 'https://www.worldpop.org/'],
  ['Copernicus DEM', 'Elevation context. Local raster pending; a surface model, not flood depth.', 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM'],
];
export function ObservatoryPage({active, site, sites}: {active: boolean; site: Site; sites: Site[]}) {
  const [climate, setClimate] = useState<Weather | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const cache = useRef(new Map<string, Weather>());
  const version = useRef(0);
  async function load(refresh: boolean) {
    const token = ++version.current;
    setBusy(true);
    setStatus(refresh ? 'Refreshing ERA5 reanalysis…' : 'Loading saved climate context…');
    if (!refresh) setClimate(cache.current.get(site.id) || null);
    try {
      const result = refresh ? await weather(site) : cache.current.get(site.id) || await dataFile<Weather>('context/' + site.id + '.json');
      if (version.current !== token) return;
      cache.current.set(site.id, result);
      setClimate(result);
      setStatus(result.warning || (result.daily?.length ? result.source + ' · retrieved ' + formatDate(result.retrievedAt) + ' · reanalysis, not a station observation' : 'No climate snapshot available yet.'));
    } catch (error) {
      if (version.current !== token) return;
      const saved = cache.current.get(site.id);
      setClimate(saved || null);
      setStatus('Weather unavailable. ' + (saved ? 'Saved snapshot retained. ' : '') + errorMessage(error));
    } finally { if (version.current === token) setBusy(false); }
  }
  useEffect(() => {
    if (active) { showRadar(site).catch(console.error); void load(false); }
    return () => { version.current++; stopRadar(); };
  }, [active, site]);
  return <section id="page-observatory" className="page" hidden={!active}>
    <div className="wrap page-intro"><p className="eyebrow">The observatory</p><h1>Radar observatory</h1><p className="dek">Explore real site evidence, climate context and the questions we can test.</p></div>
    <div className="wrap observatory-layout"><aside className="site-sidebar">
      <label className="field-label" htmlFor="site-select">Study area</label><select id="site-select" value={site.id} onChange={event => { location.hash = 'observatory/' + event.target.value; }}>{sites.map(s => <option key={s.id} value={s.id}>{s.name} · {s.country}</option>)}</select>
      <div id="site-context"><p className="eyebrow">{site.country} / {site.type}</p><h2>{site.subtitle}</h2><p>{site.description}</p><p className="mono">{site.coordinates[1].toFixed(2)}° N · {site.coordinates[0].toFixed(2)}° E</p></div>
      <button id="load-globe" className="button secondary" onClick={() => { location.hash = 'globe'; }}>Explore the 3D globe ↗</button>
      <div className="sidebar-rule"><p className="eyebrow">Evidence status</p><p id="radar-status" role="status"/><button className="text-link" id="toggle-demo" onClick={() => { void showRadar(site, {illustrative: !isDemo()}); }}>Try an illustrative comparison</button></div>
    </aside><div className="observatory-main">
      <div id="radar-view"/>
      <section className="context-section"><div className="section-title"><div><p className="eyebrow">Climate context</p><h2>Weather behind the change</h2></div><button className="button secondary" id="refresh-weather" disabled={busy || !hosted} onClick={() => void load(true)}>Refresh weather</button></div>
        <div id="weather-status" className="source-line" role="status">{status}</div>
        <div id="weather-charts" className="chart-grid">{climate ? <>
          <div className="chart-block"><h3>Mean daily air temperature</h3><Markup html={chart(climate.daily || [], {key: 'temperature', label: 'ERA5 air temperature', unit: '°C', color: '#b94d21', annotation: 'Reanalysis model constrained by observations. Source: Open-Meteo / ECMWF · Chart: team.'})}/></div>
          <div className="chart-block"><h3>Daily precipitation</h3><Markup html={chart(climate.daily || [], {key: 'rain', label: 'ERA5 precipitation', unit: 'mm/day', bars: true, annotation: 'Absolute precipitation, not an anomaly or drought index. Source: Open-Meteo / ECMWF · Chart: team.'})}/></div>
        </> : <p className="empty-chart">Climate data are not loaded. No synthetic values are substituted.</p>}</div>
      </section>
      <div id="hypothesis" className="hypothesis"><p className="eyebrow">A hypothesis to test</p><h2>{site.question}</h2><dl><dt>Possible driver</dt><dd>{site.hypothesis}</dd><dt>Evidence needed</dt><dd>{site.evidence}</dd><dt>What would disprove it</dt><dd>{site.disprove}</dd><dt>Human decisions</dt><dd>{site.humanDrivers}</dd></dl></div>
      <section className="context-section"><p className="eyebrow">Layers of context</p><h2>Put the signal in its landscape.</h2><div id="context-layers">{contextLayers.map(([name, note, url]) => <div className="context-layer" key={name}><div><h3>{name}</h3><p>{note}</p></div><a href={url} target="_blank" rel="noopener">Source ↗</a></div>)}</div></section>
    </div></div>
  </section>;
}
