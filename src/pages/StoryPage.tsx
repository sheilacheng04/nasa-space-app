import { useEffect } from 'react';
import { initStory,setStoryActive } from '../story.js';
import { assetURL,finite,formatDate,safeURL } from '../core.js';
import type { Bootstrap } from '../types';

export function StoryPage({active,data}:{active:boolean;data:Bootstrap}){
 useEffect(()=>{initStory().catch(()=>{});},[]);
 useEffect(()=>{setStoryActive(active);return()=>setStoryActive(false);},[active]);
 const lead=data.evidence?.find(s=>s.siteId==='angat')||data.evidence?.[0],enso=data.enso,oni=enso.oni?.at(-1);
 return <section id="page-story" className="page" hidden={!active}>
  <div className="hero"><div className="wrap">
   <p className="eyebrow">NASA Space Apps 2026 · Dancing with the SARs</p>
   <h1>When the Pacific warms, what changes on land?</h1>
   <p>Follow the connection from ocean to rainfall, water supplies, farms and communities. Then explore what satellites can show us, one place and one date at a time.</p>
   <div className="hero-actions"><a className="button primary" href="#story/ocean">Follow the story →</a><a className="button secondary" href="#globe">Explore Earth through time</a></div>
  </div></div>
  <div className="wrap story-wrap">
   <article className="story-section" id="ocean">
    <p className="eyebrow">A connected planet</p><h2><span className="chapter-number">1</span>An ocean shift can change where rain falls</h2>
    <p className="large-copy">El Niño is an unusual warming of the central and eastern tropical Pacific, linked to changes in winds and rainfall. Its influence can reach far beyond the ocean.</p>
    <p>Some places become wetter, others drier. The response depends on the season, the location and the event. Move the slider to explore the mechanism.</p>
    <div className="ocean-control"><div id="ocean-diagram"/><div className="ocean-slider"><label htmlFor="ocean-phase">Explore the mechanism <output id="phase-label">Normal year</output></label><input id="ocean-phase" type="range" min="0" max="100" defaultValue="0"/></div><p className="source-line">Conceptual animation: an explanation, not measured conditions or a forecast.</p></div>
    <p>Latest saved ocean reading: <strong className="heat">{finite(enso.nino34)?(enso.nino34>=0?'+':'')+enso.nino34.toFixed(1)+' °C':'not available'}</strong> relative to the usual surface temperature in the central equatorial Pacific, for the week dated {formatDate(enso.issuedAt)}.</p>
    <details><summary>Ocean measurements and sources</summary><p>The weekly Niño 3.4 reading describes a defined Pacific region. The Oceanic Niño Index (ONI) averages three months: {oni&&finite(oni.anomaly)?oni.season+' '+oni.year+', '+(oni.anomaly>=0?'+':'')+oni.anomaly.toFixed(2)+' °C':'not available'}. These summarize different periods; neither measures an effect at a study site.</p><p className="source-line"><a href={safeURL(enso.url)}>NOAA weekly record ↗</a> · <a href={safeURL(enso.oniSource)}>NOAA three-month record ↗</a> · Retrieved {formatDate(enso.retrievedAt)}. <a href="https://oceanservice.noaa.gov/facts/ninonina.html">NOAA: how El Niño works ↗</a></p></details>
   </article>
   <article className="story-section">
    <p className="eyebrow">Why it matters</p><h2><span className="chapter-number">2</span>Rain connects climate to everyday life</h2>
    <div className="impact-grid three">
     <div className="card"><h3>Water to share</h3><p>Less rain can reduce river flows and reservoir inflows. Water use, storage and dam releases also shape what remains.</p></div>
     <div className="card"><h3>Food to grow</h3><p>The timing of rain can affect planting and crop growth. Irrigation, crop choice and harvest schedules matter too.</p></div>
     <div className="card"><h3>Places to live</h3><p>Heavy rain can threaten homes and roads. Drainage, flood defenses and where people build influence the outcome.</p></div>
    </div>
    <p className="source-line">These are possible pathways. The observations below do not yet establish a measured local impact or its cause.</p>
   </article>
   <article className="story-section radar-lead" id="reading-radar">
    <p className="eyebrow">A way to observe change</p><h2><span className="chapter-number">3</span>Send a pulse. Read the return. Look again.</h2>
    <p className="large-copy">Radar sends microwave pulses toward Earth and measures what returns. Water, plants and buildings reflect those pulses differently, giving us another way to observe the surface.</p>
    <p>Synthetic aperture radar, or SAR, combines echoes collected as a sensor moves to build a detailed image. NISAR is a joint satellite mission from NASA and the Indian Space Research Organisation (ISRO), designed to repeat those observations over time.</p>
    <figure className="hero-observation">
     {lead?.image?<img src={assetURL(lead.image)} alt={'Real regional radar preview covering '+lead.name+'; not a measured water-extent map'} fetchPriority="high"/>:<div className="empty-chart">Radar preview not available.</div>}
     <figcaption><div className="caption-top"><strong>One observation, many possible explanations</strong></div><p>{lead?.name||'Study-area'} example · {formatDate(lead?.date)}</p><p>This real radar preview helps us ask where to investigate. It does not measure a shrinking reservoir, crop damage or the cause of a change.</p><details><summary>Image source and technical details</summary><p>{lead?.label||'Preview not available'} · downsampled. Channel: {lead?.channel||'not available'}.</p><p className="mono">{lead?.maturity||'Maturity not available'} · processing version (CRID): {lead?.crid||'not available'}</p><p className="source-line">NASA/ISRO NISAR via {lead?.source||'ASF DAAC'} · {lead?.n??0} catalog scenes. Measured water-area series: not available.</p></details></figcaption>
    </figure>
    <p>Smooth water often looks dark, but so can smooth soil or radar shadow. Wind can brighten water. Comparing dates and checking other evidence is essential.</p>
    <p className="source-line"><a href="https://science.nasa.gov/mission/nisar/get-to-know-sar/">NASA: how radar images work ↗</a> · <a href="https://science.nasa.gov/mission/nisar/">About the NASA–ISRO mission ↗</a></p>
   </article>
   <article className="story-section" id="site-evidence">
    <div className="section-title"><div><p className="eyebrow">Different places, shared questions</p><h2><span className="chapter-number">4</span>A global connection needs local evidence</h2></div><a href="#sites">Explore the sites ↗</a></div>
    <div className="impact-grid three">
     <div className="card"><h3>Philippines</h3><p>Rice fields and a reservoir raise questions about rainfall, irrigation and water use.</p></div>
     <div className="card"><h3>Pakistan</h3><p>A floodplain tests how to distinguish temporary floodwater from permanent water and managed channels.</p></div>
     <div className="card"><h3>Peru</h3><p>A coastal river plain raises questions about expanding surface water, local rain and river management.</p></div>
    </div>
    <div id="story-sites" className="evidence-list">{data.sites.map(site=>{const e=data.evidence?.find(e=>e.siteId===site.id);return <a className="evidence-row" href={'#sites/'+site.id} key={site.id}>
     <figure>{e?.image?<img loading="lazy" src={assetURL(e.image)} alt={'Real regional radar preview covering '+site.name+'; not a calibrated measurement'}/>:<span>Image not available</span>}<figcaption>{formatDate(e?.date)} · radar preview</figcaption></figure>
     <div><p className="eyebrow">{site.country}</p><h3>{site.name} <span aria-hidden="true">↗</span></h3><p>{site.question}</p><p className="source-line">Measured change not yet available. {site.id==='dadu'?'The 2022 floods are a historical test case from a La Niña year, not evidence of an El Niño impact.':site.id==='piura'?'Seasonal timing and local rainfall need checking.':'Rainfall and human water management both need checking.'}</p></div>
    </a>;})}</div>
   </article>
   <article className="story-section" id="future">
    <p className="eyebrow">From a picture to a better question</p><h2><span className="chapter-number">5</span>Follow the change, then test the explanation</h2>
    <ol className="method-steps"><li><strong>Choose a place and compare dates.</strong> Look for a pattern across observations. A missing image means unknown, not unchanged.</li><li><strong>Add weather and vegetation context.</strong> Compare rainfall with the usual season and follow satellite greenness. Greenness alone does not measure crop health, soil moisture or water storage.</li><li><strong>Check other explanations.</strong> Planting, harvest, irrigation, dam operations and local weather can all matter. An ocean connection is a hypothesis to test.</li></ol>
    <div className="button-row"><a className="button primary" href="#sites">Compare a place over time →</a><a className="button secondary" href="#globe">Explore the globe by date</a><a className="text-link" href="#method">See the data and method</a></div>
   </article>
   <article className="story-section reading-layout" id="local"><div><p className="eyebrow">Life on the ground</p><h2><span className="chapter-number">6</span>Every place has a human story</h2></div><div><p>A farmer’s planting date, a change in water access or a photograph of a flood can help explain what a satellite sees. Community experience belongs alongside the observations.</p><details><summary>Add a community perspective</summary><p>For a contribution from any region, record the place, date, what was observed and who provided it. Include permission, a credit and a description for any photograph. Personal experience adds context; it does not establish a regional trend or its cause.</p></details></div></article>
  </div>
 </section>;
}
