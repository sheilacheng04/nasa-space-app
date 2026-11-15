import {useEffect,useMemo,useState} from 'react';
import {globeFile} from '../globe-data';
import {hosted} from '../api/client';
import {assetURL} from '../core.js';
import SurfaceMap from './SurfaceMap';
import {createPortal} from 'react-dom';
import {siteHash} from '../selection-url.js';
import type {GlobeSelection,HistoryMode} from '../selection-url.js';
import type {Site,StudyPlace} from '../types';
import {surfaceCategories,surfaceFrames,surfaceMonths,surfaceReading} from '../surface-data';
import type {SurfaceCategory,SurfaceEvidence,SurfaceFrame,SurfaceInventory} from '../surface-data';
import {comparisonGuidance} from '../radar-data.js';
import '../surface-timeline.css';

const monthLabel=(month:string)=>month?new Date(month+'-01T00:00:00Z').toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'}):'Loading dates';
function Preview({frame,label,channel}:{frame?:SurfaceFrame;label:string;channel:string}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[frame?.image]);
 return <figure className="surface-preview"><figcaption><strong>{label}</strong><span>{frame?.date.slice(0,10)||'No saved image'}</span></figcaption>
  {frame?.image&&!failed?<img src={assetURL(frame.image)} alt={`${channel} radar preview, ${frame.date}; regional view, not a calibrated measurement`} onError={()=>setFailed(true)}/>:<div className="surface-empty">{failed?'Preview could not be loaded.':'No preview for this selection.'}</div>}
  {frame&&<small>{channel==='composite'?'NASA GIBS · false-color mosaic':`ASF · ${channel} regional quicklook`}{frame.sourceUrl||frame.url?<> · <a href={frame.sourceUrl||frame.url} target="_blank" rel="noopener">Source ↗</a></>:null}</small>}
 </figure>;
}

export default function SurfaceTimeline({active,ready,sites,places,selection,onChange,navigationKey}:{active:boolean;ready:boolean;sites:Site[];places:StudyPlace[];selection:GlobeSelection;onChange:(patch:GlobeSelection,history?:HistoryMode)=>void;navigationKey:number}) {
 const [evidence,setEvidence]=useState<Record<string,SurfaceEvidence>>({}),[inventory,setInventory]=useState<SurfaceInventory|null>(null);
 const [loaded,setLoaded]=useState(false),[errors,setErrors]=useState<string[]>([]),[attempt,setAttempt]=useState(0),[playing,setPlaying]=useState(false);
 const [scope,setScope]=useState<'PH'|'all'>('PH');
 const category:SurfaceCategory=selection.surface||(hosted?'change':'vegetation'),config=surfaceCategories[category];
 const key=sites.map(site=>site.id).join(',');
 useEffect(()=>{
  if(!active)return;let live=true;setLoaded(false);
  Promise.allSettled([globeFile<SurfaceInventory>('inventory.json',attempt>0),...sites.map(site=>globeFile<SurfaceEvidence>('sites/'+site.id+'/evidence.json',attempt>0))]).then(results=>{
   if(!live)return;const next:Record<string,SurfaceEvidence>={},failed:string[]=[];
   const catalog=results[0];setInventory(catalog.status==='fulfilled'?catalog.value as SurfaceInventory:null);if(catalog.status==='rejected')failed.push('Acquisition catalog');
   results.slice(1).forEach((result,index)=>{if(result.status==='fulfilled')next[sites[index].id]=result.value as SurfaceEvidence;else failed.push(sites[index].name);});
   setEvidence(next);setErrors(failed);setLoaded(true);
  });return()=>{live=false;};
 },[active,key,attempt]);
 const locations=useMemo(()=>{
  const merged=places.map(place=>({...place,recordId:place.siteId||place.id}));
  for(const site of sites)if(!merged.some(place=>place.recordId===site.id))merged.push({id:site.id,recordId:site.id,name:site.name,country:site.country,countryCode:site.country==='Philippines'?'PH':'',lat:site.coordinates[1],lng:site.coordinates[0]} as typeof merged[number]);
  return merged.filter(place=>scope==='all'||place.countryCode==='PH');
 },[places,sites,scope]);
 const months=useMemo(()=>surfaceMonths(inventory,evidence),[inventory,evidence]);
 const latestPreviewMonth=useMemo(()=>Object.values(evidence).flatMap(item=>surfaceFrames(item,category).map(frame=>frame.date.slice(0,7))).sort().at(-1),[evidence,category]);
 const month=selection.month||latestPreviewMonth||months.at(-1)||'',monthIndex=months.indexOf(month);
 useEffect(()=>{if(active&&loaded&&!selection.month&&month)onChange({month,date:undefined},'replace');},[active,loaded,selection.month,month,onChange]);
 const selected=locations.find(place=>place.id===selection.site||place.recordId===selection.site)||locations.find(place=>place.id==='angat')||locations[0];
 const frames=useMemo(()=>surfaceFrames(evidence[selected?.recordId],category),[evidence,selected?.recordId,category]);
 const currentFrames=frames.filter(frame=>frame.date.startsWith(month));
 const requested=selection.date?.startsWith(month)?selection.date:undefined;
 const current=requested?currentFrames.find(frame=>frame.date.slice(0,10)===requested):currentFrames.at(-1);
 const before=current?frames.filter(frame=>frame.date<current.date).at(-1):undefined;
 const readings=useMemo(()=>locations.map(place=>({...place,...surfaceReading(inventory?.sites.find(site=>site.siteId===place.recordId)?.scenes||[],surfaceFrames(evidence[place.recordId],category),month,category)})),[locations,inventory,evidence,category,month]);
 useEffect(()=>{if(!active)setPlaying(false);},[active]);
 useEffect(()=>setPlaying(false),[navigationKey,category,scope]);
 useEffect(()=>{
  const stop=()=>setPlaying(false),visibility=()=>{if(document.hidden)stop();};const media=matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change',stop);document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',stop);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{
  if(!active||!playing)return;
  if(monthIndex<0||monthIndex>=months.length-1){setPlaying(false);return;}
  const timer=setTimeout(()=>onChange({month:months[monthIndex+1],date:undefined},'replace'),1500);return()=>clearTimeout(timer);
 },[active,playing,monthIndex,months,onChange]);
 function seek(value:string){setPlaying(false);onChange({month:value,date:undefined},'replace');}
 function choose(id:string){const place=locations.find(item=>item.id===id);if(!place)return;setPlaying(false);onChange({site:id});}
 function toggle(){if(!playing&&(monthIndex<0||monthIndex===months.length-1))onChange({month:months[0],date:undefined},'replace');setPlaying(value=>!value);}
 const selectedReading=readings.find(place=>place.id===selected?.id);
 return <aside className="surface-panel" hidden={!active} aria-label="Surface change through time" data-month={month} data-category={category} data-playing={playing}>
  {active&&document.getElementById('surface-map-host')&&createPortal(<SurfaceMap places={readings} selectedId={selected?.id} date={current?.date.slice(0,10)} onSelect={choose}/>,document.getElementById('surface-map-host')!)}
  <p className="eyebrow">NISAR / surface observations</p><h2>Follow the land through time.</h2>
  <p>Choose a category, move through calendar months, then select a dot to compare the available radar images.</p>
  <div className="surface-categories" role="group" aria-label="Surface categories">{Object.entries(surfaceCategories).map(([id,item])=><button key={id} aria-pressed={category===id} onClick={()=>{setPlaying(false);onChange({surface:id as SurfaceCategory,date:undefined});}}><i style={{background:item.color}}/>{item.label}<small>{item.channel==='composite'?'NISAR mosaic':`NISAR ${item.channel}`}</small></button>)}</div>
  <p className="surface-explanation">{config.description}</p>
  <div className="surface-calendar">
   <label htmlFor="surface-month">Observation month <strong>{monthLabel(month)}</strong></label>
   <input id="surface-month" type="range" min="0" max={Math.max(0,months.length-1)} value={Math.max(0,monthIndex)} disabled={!loaded||!months.length} aria-valuetext={monthLabel(month)} onChange={event=>seek(months[Number(event.target.value)])}/>
   <div className="surface-months">{months.map(value=><button key={value} aria-pressed={month===value} onClick={()=>seek(value)}>{new Date(value+'-01T00:00:00Z').toLocaleDateString('en',{month:'short',year:'2-digit',timeZone:'UTC'})}</button>)}</div>
   <div className="surface-playback"><button aria-label="Previous surface month" disabled={monthIndex<=0} onClick={()=>seek(months[monthIndex-1])}>←</button><button id="surface-play" className="button primary" disabled={!loaded||months.length<2} aria-pressed={playing} onClick={toggle}>{playing?'Pause months':'Play months'}</button><button aria-label="Next surface month" disabled={monthIndex<0||monthIndex>=months.length-1} onClick={()=>seek(months[monthIndex+1])}>→</button></div>
   {loaded&&monthIndex<0&&<p role="status">This month is outside the saved record. No observation is substituted.</p>}
  </div>
  <div className="surface-scope"><label>Places <select value={scope} onChange={event=>{setPlaying(false);setScope(event.target.value as 'PH'|'all');}}><option value="PH">Philippines</option><option value="all">All study places</option></select></label></div>
  <p className="surface-legend"><span><i style={{background:config.color}}/>Saved preview</span><span><i style={{background:'#e4ae56'}}/>Catalog only</span><span><i style={{background:'#8b99a8'}}/>No saved record</span></p>
  <p className="surface-limit">Dots show observation availability for {monthLabel(month)}, not measured change or hazard severity. Missing months stay empty.</p>
  {!loaded&&<p role="status">Loading saved radar observations…</p>}
  {errors.length>0&&<p role="status">Could not load: {errors.join(', ')}. <button onClick={()=>setAttempt(value=>value+1)}>Retry records</button></p>}
  <div className="surface-places">{readings.map(place=><button key={place.id} aria-pressed={selected?.id===place.id} data-status={place.status} onClick={()=>choose(place.id)}><i style={{background:place.status==='preview'?config.color:place.status==='catalog'?'#e4ae56':'#8b99a8'}}/><span>{place.name}<small>{place.previews?`${place.previews} saved previews`:place.acquisitions?`${place.acquisitions} catalog acquisitions · no preview`:'No saved record this month'}</small></span></button>)}</div>
  {selected&&<section className="surface-detail" aria-label="Selected place radar progression"><h3>{selected.name}</h3><p>{monthLabel(month)} · {selectedReading?.acquisitions||0} catalog acquisitions · {currentFrames.length} saved {config.channel} previews</p>
   {currentFrames.length>0&&<label>Image date <select aria-label="Surface image date" value={current?.date.slice(0,10)||''} onChange={event=>{setPlaying(false);onChange({date:event.target.value});}}>{!current&&<option value="">Requested image unavailable</option>}{currentFrames.map(frame=><option key={frame.id||frame.date} value={frame.date.slice(0,10)}>{frame.date.slice(0,10)}</option>)}</select></label>}
   <div className="surface-comparison"><Preview frame={before} label="Previous saved observation" channel={config.channel}/><Preview frame={current} label="Selected month" channel={config.channel}/></div>
   {!current&&<p>No saved {config.channel} image for this selection. A catalog entry is not an image; no earlier observation is carried forward.</p>}
   {before&&current&&<p className="surface-limit">{comparisonGuidance(before,current,config.channel==='composite'?'gibs':'browse')}</p>}
   <p className="surface-limit">HH/HV previews cover a regional radar frame, not a clipped site map. Calibrated backscatter, soil moisture, water area and landslide measurements are not available in this saved dataset.</p>
   {current&&<a className="button" href={siteHash(selected.recordId,{source:config.channel==='composite'?'gibs':'browse',channel:config.channel,view:before?'swipe':config.channel==='composite'?'timeline':'swipe',date:current.date,before:before?.date,after:current.date})}>Inspect these dates in Sites →</a>}
  </section>}
  <p className="surface-limit">Sources: saved <a href="https://search.asf.alaska.edu/" target="_blank" rel="noopener">ASF NISAR catalog and quicklooks</a>, <a href="https://nisar-docs.asf.alaska.edu/worldview/" target="_blank" rel="noopener">NASA GIBS mosaics</a>. Gray dots include places with no saved data; they are not evidence of no change.</p>
 </aside>;
}
