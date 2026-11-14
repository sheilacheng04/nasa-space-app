import { useEffect, useState } from 'react';
import { downloadText } from '../core.js';
import { dataFile } from '../api/client';
import { EvidenceLead } from '../components/EvidenceLead';
import type {ReactNode} from 'react';
import type { Bootstrap } from '../types';

type SourceRecord = {name?:string;url:string;status:string;retrievedAt?:string;maturity?:string;crid?:string;parameters?:unknown};
type MethodRecord = {retrievedAt?:string;sources?:SourceRecord[];collections?:{shortName:string;conceptId:string;doi:string}[]};
const glossary = [
 ['SAR','Synthetic aperture radar: combines echoes collected as a satellite moves to make a detailed radar image.'],
 ['NISAR','The NASA–ISRO Synthetic Aperture Radar mission, observing changes in land, water, vegetation and ice.'],
 ['Backscatter','Radar energy returned to the sensor, affected by roughness, moisture, structure and viewing angle.'],
 ['NDVI','Normalized Difference Vegetation Index: compares reflected red and near-infrared light to describe greenness.'],
 ['Monthly composite','An image assembled across a month; its date identifies that month.'],
 ['Reanalysis','Past weather reconstructed by combining observations and a model. This project uses ERA5.'],
 ['Anomaly','A difference from a reference average, for a stated place, period and baseline.'],
 ['Maturity / CRID','Maturity describes the calibration and validation stage; CRID identifies the processing release.'],
];

export function MethodPage({active,data,newsNotice,sourcesNotice,evidenceNotice}:{active:boolean;data:Pick<Bootstrap,'news'|'sources'|'evidence'>;newsNotice:ReactNode;sourcesNotice:ReactNode;evidenceNotice:ReactNode}) {
 const [record,setRecord]=useState<MethodRecord|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!active)return;
  let cancelled=false;
  dataFile<MethodRecord>('method.json').then(value=>{if(!cancelled)setRecord(value);}).catch(()=>{if(!cancelled)setError('Detailed source records are unavailable in this edition.');});
  return ()=>{cancelled=true;};
 },[active]);
 const download=(path:string)=>{void dataFile(path).then(value=>downloadText(path.split('/').at(-1)!,JSON.stringify(value,null,2),'application/json')).catch(()=>setError('This saved file is not available for download in this edition.'));};
 const sourceRows = [
  ['NISAR radar','NASA / ISRO, via ASF and GIBS','Images of microwave signals returned from the surface.','Works through clouds and in darkness. Colors represent the signal. Daily views show available acquisitions, not every place each day.'],
  ['MODIS vegetation','NASA Terra, via GIBS','Monthly greenness from reflected sunlight, shown as NDVI.','Growth, harvest, weather and land use can change greenness. Clouds and snow affect this optical record.'],
  ['Ocean temperature','NOAA CPC','Tropical Pacific temperature differences from a reference average.','El Niño context: weekly Niño 3.4 and three-month ONI cover different periods.'],
  ['Local weather','ECMWF ERA5, via Open-Meteo','Rainfall and temperature estimates; a 1991–2020 reference where available.','Reanalysis blends observations and a model. Check site dates; values are not local weather-station readings.'],
  ['News reports','GDELT and supplied archive',data.news?data.news.items.length+' source-linked headlines about events and their effects.':'Headline count unavailable while the news archive is unavailable.','Human context. Sentiment scores describe wording, not hazard size or public opinion.'],
 ];
 const conclusionRows = [
  ['Radar browse and catalog coverage','Water area and calibrated radar-change series remain unmeasured. A catalog footprint does not guarantee useful pixels throughout.'],
  ['Monthly vegetation greenness','Color changes do not directly measure crop yield, water shortage or damage. Check seasonality and independent observations.'],
  ['Ocean, weather and reporting context','Timing alone cannot attribute a local event to El Niño. One season cannot separate all possible drivers.'],
 ];
 return <section id="page-method" className="page" hidden={!active}><div className="wrap">
  <div className="page-intro"><p className="eyebrow">From a pattern to an explanation</p><h1>Data and method</h1><p className="dek">Start with a change you can see. Check what the instrument measured, compare the dates fairly, then consider what might explain it.</p></div>
  <nav className="method-links" aria-label="Method sections"><a href="#method/question">The question</a><a href="#method/evidence">The data</a><a href="#method/comparison">Comparing dates</a><a href="#method/limits">Conclusions</a><a href="#method/provenance">Source records</a><a href="#method/citation">Credits</a><a href="#method/my-data">My CSV data</a></nav>

  <section className="story-section" id="question"><h2><span className="chapter-number">1</span>What is changing on the land?</h2><p className="large-copy">Follow changes in water, vegetation and the ground, then examine the conditions around them.</p><p>Does a shoreline move, vegetation become greener, or a radar pattern change? Start globally, then examine a place and its dates. Explaining the cause takes further evidence.</p></section>

  <section className="story-section" id="evidence"><h2><span className="chapter-number">2</span>What each source tells us</h2><p>NISAR is NASA and ISRO’s radar satellite. It uses synthetic aperture radar (SAR), a technique that combines microwave echoes to form images.</p><div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}><table><caption>Sources, imagery types and interpretation</caption><thead><tr><th scope="col">Source</th><th scope="col">What we see</th><th scope="col">How to read it</th></tr></thead><tbody>{sourceRows.map(([name,credit,view,meaning])=><tr key={name}><td><strong>{name}</strong><br/>{credit}</td><td>{view}</td><td>{meaning}</td></tr>)}</tbody></table></div>
  <p>The globe’s natural-color base is Blue Marble, a static reference from 2004 MODIS imagery that helps locate places.</p>
  <p className="source-line">Learn more: <a href="https://science.nasa.gov/mission/nisar/get-to-know-sar/">NASA’s radar introduction</a> · <a href="https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/">NASA’s vegetation guide</a> · <a href="https://www.ecmwf.int/en/about/media-centre/focus/2023/fact-sheet-reanalysis">ECMWF’s reanalysis explanation</a>.</p>
  {newsNotice}
  <details className="source-row"><summary>Plain-language glossary</summary><div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}><table><caption>Scientific glossary</caption><thead><tr><th scope="col">Term</th><th scope="col">Meaning</th></tr></thead><tbody>{glossary.map(([term,meaning])=><tr key={term}><th scope="row">{term}</th><td>{meaning}</td></tr>)}</tbody></table></div></details>
  </section>

  <section className="story-section" id="comparison"><h2><span className="chapter-number">3</span>How to compare dates fairly</h2><ol className="method-steps">
   <li><strong>Fix the place and time.</strong> Keep the same area in view. A monthly vegetation composite and a radar acquisition describe different time spans.</li>
   <li><strong>Compare like with like.</strong> Match radar viewing direction, area, channel and processing version. NISAR’s orbit repeats every 12 days; usable coverage still depends on the observation plan and data.</li>
   <li><strong>Look for a pattern across several observations.</strong> Check the same season in other years. Keep gaps visible: missing data cannot tell us whether anything changed.</li>
   <li><strong>Check other explanations.</strong> Consider rainfall, temperature, irrigation, dam releases, planting, harvest and land use alongside climate.</li>
  </ol><p className="source-line">Sources: <a href="https://science.nasa.gov/mission/nisar/mission-overview/">NISAR repeat orbit</a> · <a href="https://nisar-docs.asf.alaska.edu/worldview/">Reading NISAR imagery</a> · <a href="https://www.usgs.gov/special-topics/remote-sensing-phenology/science/ndvi-foundation-remote-sensing-phenology">Vegetation and seasonal change</a>.</p></section>

  <section className="story-section" id="limits"><h2><span className="chapter-number">4</span>What can we conclude?</h2><p>Real images show patterns to investigate. Agreement across records strengthens a hypothesis, but does not establish a cause.</p><div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}><table><caption>Evidence and remaining limitations</caption><thead><tr><th scope="col">What this project shows</th><th scope="col">What needs more evidence</th></tr></thead><tbody>{conclusionRows.map(([view,limit])=><tr key={view}><td>{view}</td><td>{limit}</td></tr>)}</tbody></table></div>
  <p>Cloud penetration does not guarantee a view of the ground beneath vegetation. Smooth water, dry soil and radar shadow can look dark; wind can brighten water.</p>
  <p className="source-line"><a href="https://hyp3-docs.asf.alaska.edu/hyp3-docs/guides/introduction_to_sar/">ASF explains radar scattering and viewing geometry</a>.</p>
  <details className="source-row"><summary>Image colors, resolution and missing dates</summary><p>Multi-channel GIBS uses HH or VV for red and blue, and HV or VH for green. Single-channel colors differ. Display colors cannot supply water-area or decibel measurements.</p><p>The 21 vegetation images span January 2025–October 2026; April 2025 is missing. Offline includes September/October 2026. The official NDVI legend spans 0–1. Transparency includes fill <em>or</em> low/nonpositive NDVI.</p><p>Globe images are downsampled and lose source detail. Missing radar coverage remains explicit.</p><p className="source-line"><a href="https://nisar-docs.asf.alaska.edu/worldview/">NISAR color mapping</a> · <a href="https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml">Official NDVI color mapping</a> · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/">Blue Marble source</a>.</p></details>
  <details className="source-row"><summary>Advanced: radar processing and quality checks</summary><p>Inventory checks ASF’s NISAR GCOV catalog, CMR collection IDs, site footprints and the observation plan. Quantitative extraction remains untested without authenticated Earthdata access. Compare PROVISIONAL pairs with matching track, frame and CRID; exclude BETA and mixed-stage browse. Check units and masks, preserve gamma-0, and average valid linear power before converting to dB.</p><p>Candidate-water defaults (HH &lt; −17 dB; HV &lt; −24 dB) are uncalibrated demonstrations. OPERA agreement, land-cover statistics, exposure, deformation and soil-moisture estimates are not demonstrated. The saved GIBS check advertised the daily layer, but not the requested rolling 12-day layer.</p><p>Permanent gap: 27 July 2026, 22:03:25 UTC–10 August 2026, 00:55:27 UTC; boundary days can be partial. VALIDATED acquisitions begin 21 October, released 6 November 2026. Reprocessing may change older results. SME2 soil moisture remains preliminary.</p><p className="source-line"><a href="https://nisar-docs.asf.alaska.edu/gcov/">GCOV product guide</a> · <a href="https://nisar-docs.asf.alaska.edu/availability-overview/">Availability and quality stages</a>.</p></details>
  </section>

  <section className="story-section" id="provenance"><h2>Check the source record</h2><p>Inspect sources, retrieval dates and the requests behind this record.</p>{evidenceNotice}<EvidenceLead evidence={data.evidence?.[0]}/>{sourcesNotice}{error&&<p role="status">{error}</p>}
  <div className="button-row"><button className="text-link" disabled={!data.sources} onClick={()=>data.sources&&downloadText('sources.json',JSON.stringify(data.sources,null,2),'application/json')}>Download source index</button><button className="text-link" onClick={()=>download('inventory.json')}>Download scene inventory</button><button className="text-link" onClick={()=>download('network-status.json')}>Download URL audit</button><button className="text-link" onClick={()=>download('globe/vegetation.json')}>Download vegetation record</button></div>
  <details className="source-row"><summary>Source ledger {record?.sources?`(${record.sources.length} saved checks)`:''}</summary><p>Dates are UTC. Web reachability does not establish scientific usability. Maturity and CRID apply to NISAR.</p><div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}><table><caption>Saved source checks: dates in UTC</caption><thead><tr><th scope="col">Source and URL</th><th scope="col">Status</th><th scope="col">Retrieved</th><th scope="col">Maturity / CRID</th><th scope="col">Parameters</th></tr></thead><tbody>{record?.sources?.map((source,i)=><tr key={i}><td><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name||source.url} ↗</a></td><td>{source.status}</td><td>{source.retrievedAt?.slice(0,10)||'not available'}</td><td>{source.maturity||'not applicable'} / {source.crid||'not applicable'}</td><td><details><summary>Request</summary><pre>{JSON.stringify(source.parameters||{},null,2)}</pre></details></td></tr>)}</tbody></table></div></details>
  <details className="source-row"><summary>Local study boundaries and archive assumptions</summary><p>Angat uses the reservoir area near 121.16°E, 14.91°N, supported by an <a href="https://www.napocor.gov.ph/bcsd/bid_files/Bid%20Docs_HO-FFW23-010.pdf">NPC dam-station specification</a>. Piura is an additional case for testing a wet-weather hypothesis. The original 43 supplied headlines are retained with unverified claims labeled.</p></details>
  </section>

  <section className="story-section" id="citation"><h2>Credit and reuse</h2><p>NASA/ISRO NISAR via ASF DAAC and NASA GIBS; MODIS Terra vegetation imagery via GIBS / ESDIS; Blue Marble: NASA Earth Observatory; NOAA CPC; Open-Meteo and ECMWF ERA5; GDELT and each linked publisher. Software is MIT-licensed. Data and imagery retain their providers’ terms.</p><details className="source-row"><summary>NISAR citation guidance and collection identifiers</summary><blockquote>NISAR follows NASA’s standard Data Use and Citation Guidance.</blockquote><p className="source-line">Exact sentence from <a href="https://nisar-docs.asf.alaska.edu/data-use-citation-guidance/">ASF’s citation guidance</a>. Dataset-specific citation text was unavailable: NASA guidance and DOI pages returned 403; CMR supplied DOIs without citation text.</p><div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}><table><caption>undefined</caption><thead><tr><th scope="col">Collection</th><th scope="col">CMR concept</th><th scope="col">DOI</th></tr></thead><tbody>{record?.collections?.map(collection=><tr key={collection.shortName}><td>{collection.shortName}</td><td>{collection.conceptId}</td><td><a href={'https://doi.org/'+collection.doi}>{collection.doi}</a></td></tr>)}</tbody></table></div></details></section>
 </div></section>;
}
