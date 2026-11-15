import {useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import type {Enso,News,Site} from '../types';
import {illustrationDefaults,illustrationLegends} from '../illustrative-globe.js';
import type {IllustrationLayer} from '../illustrative-globe.js';
import {setIllustration,focusIllustrativePlace,flyTo} from '../world.js';
import {initLocalWindow} from '../local-window.js';
import '../illustrative-globe.css';

interface Location {name:string;lat:number;lng:number;id?:string;site?:boolean;user?:boolean;value?:number|null;category?:string;date?:string;description?:string;question?:string}
export default function IllustrativeGlobe({active,ready,sites,enso,news,newsNotice,navigationKey,selectedSiteId}:{active:boolean;ready:boolean;sites:Site[];enso?:Enso;news?:News;newsNotice:ReactNode;navigationKey:number;selectedSiteId?:string}){
 const [state,setState]=useState({...illustrationDefaults}),[playing,setPlaying]=useState(false),[tab,setTab]=useState<'place'|'events'|'tour'>('place'),[tour,setTour]=useState(0);
 const readings=useMemo(()=>(enso?.weekly||[]).filter(row=>Number.isFinite(row.anomaly)).sort((a,b)=>a.date.localeCompare(b.date)),[enso]);
 const [dateIndex,setDateIndex]=useState(0);
 const reading=readings[Math.min(dateIndex,Math.max(0,readings.length-1))];
 const dateLabel=(date:string)=>new Date(date+'T00:00:00Z').toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 useEffect(()=>{setState(previous=>({...previous,phase:reading?Math.min(100,Math.abs(reading.anomaly)/3*100):0,anomaly:reading?.anomaly??0}));},[reading]);
 const [selected,setSelected]=useState<Location|null>(null),[rendering,setRendering]=useState(false);
 useEffect(()=>{setIllustration(state);},[state]);
 useEffect(()=>{
  const select=(event:Event)=>{setSelected((event as CustomEvent<Location>).detail);setTab('place');};
  const visibility=()=>setRendering(document.getElementById('globe-stage')?.dataset.rendering==='active');
  addEventListener('globe:illustrative-select',select);addEventListener('globe:rendering',visibility);visibility();
  return()=>{removeEventListener('globe:illustrative-select',select);removeEventListener('globe:rendering',visibility);};
 },[ready]);
 useEffect(()=>{if(!active)setPlaying(false);},[active]);
 useEffect(()=>setPlaying(false),[navigationKey]);
 useEffect(()=>{if(active&&ready&&selectedSiteId&&selected?.id!==selectedSiteId){const site=sites.find(s=>s.id===selectedSiteId);if(site)choose(site);}},[active,ready,selectedSiteId,sites]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),stop=()=>setPlaying(false);
  media.addEventListener('change',stop);return()=>media.removeEventListener('change',stop);
 },[]);
 useEffect(()=>{
  if(!active||!playing)return;
  if(dateIndex>=readings.length-1){setPlaying(false);return;}
  const timer=setTimeout(()=>setDateIndex(index=>index+1),900);return()=>clearTimeout(timer);
 },[playing,active,dateIndex,readings.length]);
 const seek=(index:number)=>{setPlaying(false);setDateIndex(index);};
 function toggle(){if(!playing&&dateIndex>=readings.length-1)setDateIndex(0);setPlaying(value=>!value);}
 function choose(site:Site){focusIllustrativePlace({...site,site:true,lng:site.coordinates[0],lat:site.coordinates[1]});}
 const steps=[{name:'The ocean connects the story',description:'Begin over the equatorial Pacific. Moving links illustrate a climate relationship, not measured winds or flows of heat.',coordinates:[-145,0],id:''},...sites.map(site=>({...site,description:site.question+' '+site.hypothesis}))];
 function goTour(index:number){const next=(index+steps.length)%steps.length,step=steps[next];setTour(next);if(step.id){const site=sites.find(s=>s.id===step.id);if(site)choose(site);}else flyTo(step.coordinates[0],step.coordinates[1],2.4,850);setTab('tour');}
 const legend=illustrationLegends[state.layer];
 const satellitePlace=selected||(sites[0]?{...sites[0],site:true,lng:sites[0].coordinates[0],lat:sites[0].coordinates[1]}:null);
 function openSatellite(){if(!satellitePlace)return;initLocalWindow();dispatchEvent(new CustomEvent('globe:open-local',{detail:{...satellitePlace,siteId:satellitePlace.site?satellitePlace.id:undefined}}));document.getElementById('globe-stage')?.scrollIntoView({block:'center',behavior:'instant'});}
 return <aside className="illustrative-panel" hidden={!active} aria-label="Concept globe controls" data-date={reading?.date||''} data-phase={state.phase.toFixed(1)} data-playing={playing}>
  <p className="eyebrow">The original concept globe</p><h2>One ocean. Different stories.</h2>
  <div className="illustrative-satellite-action">
   <div><strong>A closer look from space</strong><p id="satellite-window-place">{satellitePlace?.name||'Choose a place on the globe'}</p></div>
   <button type="button" className="button primary satellite-window-launch" aria-describedby="satellite-window-place" disabled={!satellitePlace} onClick={openSatellite}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M13 12h5v5m0-5-7 7"/></svg>
    Open satellite window <span aria-hidden="true">→</span>
   </button>
  </div>
  <p className="illustrative-note">Follow dated NOAA ocean observations week by week. Globe colors illustrate the possible climate response; they are not measured local temperature, rainfall or risk.</p>
  <div className="illustrative-layers" role="group" aria-label="Concept layers">{(['heat','rain','stress','geography'] as IllustrationLayer[]).map((layer,i)=><button key={layer} data-illustrative-layer={layer} aria-pressed={state.layer===layer} onClick={()=>setState(previous=>({...previous,layer}))}>{['Heat','Rain','Combined','Places'][i]}</button>)}</div>
  <div className="illustrative-legend"><strong>{legend[0]}</strong><div style={{background:legend[3]}}/><p><span>{legend[1]}</span><span>{legend[2]}</span></p></div>
  <div className="illustrative-playback">
   <label htmlFor="illustrative-phase">Progression through time <output>{reading?dateLabel(reading.date):'Observations unavailable'}</output></label>
   <input id="illustrative-phase" type="range" min="0" max={Math.max(0,readings.length-1)} step="1" value={dateIndex} disabled={!readings.length} aria-valuetext={reading?dateLabel(reading.date):'No observations'} onChange={event=>seek(Number(event.target.value))}/>
   <div className="illustrative-phases">{Array.from(new Set([0,Math.floor((readings.length-1)/3),Math.floor((readings.length-1)*2/3),readings.length-1])).filter(index=>index>=0&&readings[index]).map(index=><button key={index} onClick={()=>seek(index)}>{dateLabel(readings[index].date)}</button>)}</div>
   <p>{reading?<>Ni?o 3.4 ocean temperature departure: <strong>{reading.anomaly>0?'+':''}{reading.anomaly.toFixed(1)} ?C</strong> ? {reading.anomaly<0?'Cooler':reading.anomaly>0?'Warmer':'At'} than the weekly baseline.</>:'No saved NOAA weekly observations are available.'}</p>
   <div className="illustrative-play-action"><button id="illustrative-play" className="button primary" disabled={!ready||readings.length<2} aria-pressed={playing} onClick={toggle}>{playing?'Pause timeline':'Play timeline'}</button></div>
   <p className="illustrative-note"><a href={enso?.url||'https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for'} target="_blank" rel="noopener">Source: NOAA CPC weekly SST record ?</a>. Each step uses a saved observation date, without interpolation. The ocean index drives an illustrative pattern, not a local measurement or an ENSO event classification.</p>
  </div>
  <div className="illustrative-toggles" role="group" aria-label="Concept overlays">{(['links','towers','labels','userData'] as const).map((key,i)=><button key={key} aria-pressed={state[key]} onClick={()=>setState(previous=>({...previous,[key]:!previous[key]}))}>{['Pacific links','Site towers','Labels','My data'][i]}</button>)}</div>
  <div className="illustrative-tabs" role="tablist" aria-label="Explore the concept globe">{(['tour','place','events'] as const).map((value,i)=><button key={value} className={value==='tour'?'illustrative-tour-tab':''} role="tab" id={'illustrative-tab-'+value} aria-controls="illustrative-details" aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={()=>value==='tour'?goTour(tour):setTab(value)} onKeyDown={event=>{const values=['tour','place','events'] as const;let next=i;if(event.key==='ArrowRight')next=(i+1)%3;else if(event.key==='ArrowLeft')next=(i+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();setTab(values[next]);document.getElementById('illustrative-tab-'+values[next])?.focus();}}>{['Guided tour','Place','News'][i]}</button>)}</div>
  <div id="illustrative-details" role="tabpanel" aria-labelledby={'illustrative-tab-'+tab} tabIndex={0}>
   {tab==='place'&&<>{selected?<><h3>{selected.name}</h3><p className="mono">{selected.lat.toFixed(3)}°, {selected.lng.toFixed(3)}°</p>{selected.user?<p>Your observation: {selected.value??'No numeric value'} {selected.category} · {selected.date||'Undated'}. User supplied, not independently verified.</p>:<p>{selected.description||'A geographic locator. No local measurement is inferred from the concept colors.'}</p>}{selected.question&&<p>{selected.question}</p>}{selected.site&&<a className="button" href={'#sites/'+selected.id}>Open radar observations</a>}</>:<p>Drag the globe, select a country or tower, or search for a place. Choose a study area to explore its evidence.</p>}<div className="illustrative-sites">{sites.map(site=><button key={site.id} aria-pressed={selected?.id===site.id} onClick={()=>choose(site)}>{site.name}<small>{site.country} · {site.type}</small></button>)}</div></>}
   {tab==='events'&&<>{newsNotice}<p>Source-linked reporting; headlines are separate from the illustrative climate layers.</p>{news?.items.filter(item=>item.url.startsWith('https:')&&Boolean(reading)&&item.date.slice(0,10)<=reading.date).slice(0,8).map(item=><a className="illustrative-news" key={item.id} href={item.url} target="_blank" rel="noopener"><small>{item.date} · {item.source}</small>{item.title}</a>)}</>}
   {tab==='tour'&&<><p className="eyebrow">Step {tour+1} of {steps.length}</p><h3>{steps[tour].name}</h3><p>{steps[tour].description}</p><div className="illustrative-tour-actions"><button onClick={()=>goTour(tour-1)}>← Back</button><button onClick={()=>goTour(tour+1)}>Next →</button></div>{steps[tour].id&&<a className="button" href={'#sites/'+steps[tour].id}>Open radar observations</a>}</>}
  </div>
 </aside>;
}
