import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { hosted } from '../api/client';
import { initGlobe,pauseGlobe,resumeGlobe,setGlobePoints,flyTo,setGlobeMode,setSatelliteTexture,hideSatelliteTexture,disposeGlobe,getGlobeMarkers,setGeographicContext,setConceptSnapshot } from '../world.js';
import { closeLocalWindow,initLocalWindow } from '../local-window.js';
import { FrameCache,siteCrop,wmsURL,globeFile } from '../globe-data';
import type { GlobeManifest,GlobeFrame,LoadedFrame } from '../globe-data';
import type {ReactNode} from 'react';
import type { Enso,News,NewsByPlaceData,Observation,Place,Site,StudyPlace } from '../types';
import '../satellite.css';
import ConceptTimeline from './ConceptTimeline';
import IllustrativeGlobe from './IllustrativeGlobe';
import type { ConceptPlayback } from './ConceptTimeline';
import ConceptVegetation from './ConceptVegetation';
import {globeHash,frameIndex,includeDates} from '../selection-url.js';
import type {GlobeSelection,HistoryMode} from '../selection-url.js';
import {ShareLink} from './ShareLink';
import {PlaceNewsPanel} from './PlaceNewsPanel';
import {WhereToNext} from './FirstVisitGuide';
import {GlossaryTerm} from './GlossaryTerm';
import type { ConceptSnapshot } from '../concept-data';

const marker=<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></svg>;
const time=(date:string)=>Date.parse(date.slice(0,10)+'T00:00:00Z');
function OceanStrip({enso,news,frame,start,end}:{enso:Enso;news?:News;frame?:GlobeFrame;start:string;end:string}){
 const rows=enso.weekly?.filter(r=>time(r.date)>=time(start)&&time(r.date)<=time(end)&&Number.isFinite(r.anomaly))||[];
 const x=(date:string)=>40+(time(date)-time(start))/Math.max(86400000,time(end)-time(start))*900;
 const min=Math.min(-1,...rows.map(r=>r.anomaly)),max=Math.max(1,...rows.map(r=>r.anomaly)),y=(v:number)=>48-(v-min)/(max-min)*36;
 const path=rows.map((r,i)=>(i?'L':'M')+x(r.date).toFixed(1)+','+y(r.anomaly).toFixed(1)).join(' ');
 const nearest=frame?rows.filter(r=>time(r.date)<=time(frame.date)).at(-1):null;
 const events=Array.from(new Map((news?.items||[]).filter(n=>n.url.startsWith('https:')&&time(n.date)>=time(start)&&time(n.date)<=time(end)).map(n=>[n.date.slice(0,7),n])).values()).slice(0,8);
 return <div className="ocean-strip"><p><strong>Pacific temperature context</strong><span>Difference from usual · {rows.length} weekly readings{nearest?' · '+nearest.date+': '+(nearest.anomaly>0?'+':'')+nearest.anomaly.toFixed(1)+' °C':''}</span></p>
 <svg viewBox="0 0 980 76" role="img" aria-label={'NOAA weekly Niño 3.4 sea-surface temperature anomaly; '+rows.length+' observations. Cursor '+(frame?.date||'not available')}>
 <line x1="40" x2="940" y1={y(0)} y2={y(0)} stroke="#49545e" strokeDasharray="3 5"/><path d={path} fill="none" stroke="var(--orange)" strokeWidth="2"/>
 <text x="2" y="15">{max.toFixed(1)}°</text><text x="2" y="50">{min.toFixed(1)}°</text>
 {frame&&<line data-testid="ocean-cursor" x1={x(frame.date)} x2={x(frame.date)} y1="3" y2="60" stroke="var(--ink)" strokeWidth="1.5"/>}
 {events.map(n=><a key={n.id} href={n.url} target="_blank" rel="noopener" aria-label={'Reporting on '+n.date+': '+n.title}><circle cx={x(n.date)} cy="66" r="3" fill="var(--muted)"/><title>{n.date+' · '+n.title+' · '+n.source}</title></a>)}
 </svg><p className="strip-note"><a href={enso.url} target="_blank" rel="noopener">Source: NOAA CPC</a> · Niño 3.4 ocean region. News dots link to reporting, not independently confirmed events. Latest preceding weekly reading; no interpolation.</p></div>;
}
export default function GlobeExperience({active,sites,places=[],newsByPlace,points,place,enso,news,oceanNotice,newsNotice,selection,onSelection,navigationKey}:{active:boolean;sites:Site[];places?:StudyPlace[];newsByPlace?:NewsByPlaceData;points:Observation[];place:Place|null;enso?:Enso;news?:News;oceanNotice:ReactNode;newsNotice:ReactNode;selection:GlobeSelection;onSelection:(selection:GlobeSelection,history?:HistoryMode)=>void;navigationKey:number}){
 const [manifest,setManifest]=useState<GlobeManifest|null>(null),[manifestError,setManifestError]=useState(''),[retryManifest,setRetryManifest]=useState(0);
 const mode=selection.mode||'satellite',selected=sites.find(site=>site.id===selection.site)||null;
 const selectedStudyPlace=useMemo(()=>places.find(p=>p.id===selection.site||p.siteId===selection.site)||(selected?places.find(p=>p.siteId===selected.id||p.id===selected.id):null)||null,[places,selection.site,selected]);
 const latestSelection=useRef(selection);latestSelection.current=selection;
 const change=useCallback((patch:GlobeSelection,history:HistoryMode='push')=>{if(Object.entries(patch).some(([key,value])=>latestSelection.current[key as keyof GlobeSelection]!==value))onSelection({...latestSelection.current,...patch},history);},[onSelection]);
 const setMode=(mode:GlobeSelection['mode'])=>change({mode});
 const setSelected=useCallback((site:Site)=>change({site:site.id}),[change]);
 const [layerId,setLayerId]=useState(''),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[loop,setLoop]=useState(false);
 const [guidedTour,setGuidedTour]=useState(false),[tourIndex,setTourIndex]=useState(0),[phPresetActive,setPhPresetActive]=useState(false);
 const [localMapHandoff,setLocalMapHandoff]=useState(false);
 const localMapMountRef=useRef<HTMLDivElement>(null),localMapCleanupRef=useRef<(()=>void)|null>(null);
 const [context,setContext]=useState(true),[basemap,setBasemap]=useState('loading');
 const [concept,setConcept]=useState<ConceptSnapshot|null>(null),[vegetationStatus,setVegetationStatus]=useState('loading');
 const [monthPlayback,setMonthPlayback]=useState<ConceptPlayback|null>(null);
 const receiveConcept=useCallback((snapshot:ConceptSnapshot)=>{setConcept(snapshot);setConceptSnapshot(snapshot);},[]);
 const focusConceptSite=useCallback((site:Site)=>{setSelected(site);flyTo(...site.coordinates,1.2);},[setSelected]);
 const [ready,setReady]=useState(false),[status,setStatus]=useState('loading'),[message,setMessage]=useState('Loading the real GIBS date record…'),[retry,setRetry]=useState(0),[announcement,setAnnouncement]=useState('');
 const [loaded,setLoaded]=useState<LoadedFrame|null>(null),[crop,setCrop]=useState({url:'',note:''}),[cropRetry,setCropRetry]=useState(0),[pins,setPins]=useState<{id:string;x:number;y:number;visible:boolean}[]>([]);
 const cache=useRef(new FrameCache()),playingRef=useRef(playing),modeRef=useRef(mode);playingRef.current=playing;modeRef.current=mode;
 const radarActive=active&&mode==='satellite';
 const crops=useRef(new Map<string,Promise<{url:string;note:string}>>());
 const releaseCrop=(promise:Promise<{url:string;note:string}>)=>{void promise.then(result=>{if(result.url.startsWith('blob:'))URL.revokeObjectURL(result.url);}).catch(()=>{});};
 const lastManifestAttempt=useRef(0);
 const section=useRef<HTMLDivElement>(null),initialFocus=useRef(false);
 const layer=manifest?.layers[layerId];
 const frames=useMemo(()=>includeDates<GlobeFrame>(layer?.frames||[],[selection.date],date=>({date,layer:layerId,status:'no-data',maturity:'not available',maturityWindow:'not available',reason:'This requested date is not in the saved date record; live availability is unverified.'})),[layer,layerId,selection.date]);
 const requestedOutside=Boolean(selection.date&&layer&&frameIndex(layer.frames,selection.date)<0);
 const found=frameIndex(frames,selection.date),index=found>=0?found:Math.max(0,frames.length-1),frame=frames[index];
 latestSelection.current={...selection,mode,date:selection.date||frame?.date,month:selection.month||concept?.month};
 function setIndex(next:number|((index:number)=>number),history:HistoryMode='replace'){const target=frames[typeof next==='function'?next(index):next];if(target)change({date:target.date},history);}
 const setMonth=useCallback((month:string,history:HistoryMode='push')=>change({month},history),[change]);
 const currentFrame=useRef(frame);currentFrame.current=frame;
 const bestIndex=useMemo(()=>frames.reduce((best,f,i)=>(f.nontransparentPixels||0)>(frames[best]?.nontransparentPixels||0)?i:best,0),[frames]);
 const dates=useMemo(()=>frames.map(f=>time(f.date)),[frames]),range=dates.length?dates.at(-1)!-dates[0]:1;
 useEffect(()=>{if(!active||manifest)return;let live=true;const reload=retryManifest>lastManifestAttempt.current;lastManifestAttempt.current=retryManifest;setManifestError('');globeFile<GlobeManifest>('globe/manifest.json',reload).then(m=>{if(!live)return;setManifest(m);setLayerId(m.defaultLayer);}).catch(()=>{if(live){setManifestError('The NISAR date manifest could not be loaded.');setStatus('error');}});return()=>{live=false;};},[active,manifest,retryManifest]);
 useEffect(()=>{setGlobePoints(sites,points);},[sites,points]);
 useEffect(()=>{
  let current=true;
  if(active){setGlobeMode(modeRef.current);void initGlobe(sites,points,(id:string)=>{location.hash='sites/'+id+(currentFrame.current?'?date='+currentFrame.current.date:'');}).then(globe=>{if(!current)return;if(globe){setReady(true);initLocalWindow();resumeGlobe();setGlobeMode(modeRef.current);}else{setStatus('error');setMessage('The globe renderer is unavailable.');}});}
  else{setPlaying(false);setGuidedTour(false);pauseGlobe();closeLocalWindow();}
  return()=>{current=false;pauseGlobe();closeLocalWindow();};
 },[active,sites]);
 useEffect(()=>{if(ready&&active&&place)flyTo(...place.geometry.coordinates);},[ready,active,place]);
 useLayoutEffect(()=>{setPlaying(false);closeLocalWindow();if(ready&&active){setGlobeMode(mode);if(mode==='satellite'&&loaded&&loaded.date===frame?.date)void setSatelliteTexture(loaded.url,loaded.image,loaded.date).catch(()=>{setStatus('error');setMessage('The radar texture could not be displayed.');});}},[mode,ready,active]);
 useEffect(()=>{
  if(!active)return;let pinTick=0;const update=()=>{cancelAnimationFrame(pinTick);pinTick=requestAnimationFrame(()=>setPins(getGlobeMarkers()));};
  const select=(e:Event)=>{const id=(e as CustomEvent).detail?.id;const site=sites.find(s=>s.id===id);if(site){setSelected(site);if(modeRef.current!=='illustrative')flyTo(...site.coordinates,.65);}};
  addEventListener('globe:camera',update);addEventListener('globe:select-site',select);
  if(ready)update();return()=>{cancelAnimationFrame(pinTick);removeEventListener('globe:camera',update);removeEventListener('globe:select-site',select);};
 },[ready,sites,mode,setSelected,active]);
 useLayoutEffect(()=>{if(radarActive)cache.current.resume();else cache.current.pause();},[radarActive]);
 useLayoutEffect(()=>{
  if(!ready||!radarActive||!frame)return;if(loaded?.date===frame.date&&status==='ready')return;let live=true;hideSatelliteTexture();setLoaded(null);setStatus('loading');setMessage('Loading '+frame.date+'…');
  if(frame.status==='no-data'||frame.status==='empty'){
   setStatus('gap');setMessage(frame.reason||(frame.status==='no-data'?'No data. GIBS does not advertise this date.':'No coverage in this global mosaic.'));if(!playingRef.current)setAnnouncement(frame.date+'. No data.');return;
  }
  cache.current.load(frame,true).then(async result=>{
   if(!live)return;if(modeRef.current==='satellite')await setSatelliteTexture(result.url,result.image,result.date);
   if(!live)return;setLoaded(result);setStatus('ready');setMessage((result.origin==='live GIBS'?'Live NASA GIBS':result.origin==='saved GIBS frame'?'Saved NASA GIBS frame':'Offline NASA GIBS frame')+' · false color, not calibrated');
   if(modeRef.current==='satellite'&&!initialFocus.current&&!place&&!selected){initialFocus.current=true;if(frame.focus)flyTo(frame.focus.lng,frame.focus.lat,1.5);}
   if(!playingRef.current)setAnnouncement(frame.date+'. '+frame.maturityWindow+'. Pixel maturity not available.');
  }).catch(error=>{if(live){setStatus('error');setMessage(error.message);setPlaying(false);setAnnouncement(frame.date+'. Imagery unavailable.');}});
  return()=>{live=false;};
 },[frame,ready,radarActive,retry]);
 useEffect(()=>{
  if(!frame||status!=='ready'||!radarActive)return;
  frames.slice(index+1,index+3).filter(f=>f.status!=='no-data'&&f.status!=='empty').forEach(f=>{void cache.current.load(f).catch(()=>{});});
 },[frame,status,radarActive,index,frames]);
 useEffect(()=>{
  if(!playing||!active||!frame||status==='loading'||status==='error')return;
  const timer=setTimeout(()=>{if(index===frames.length-1){if(loop)setIndex(0);else setPlaying(false);}else setIndex(i=>i+1);},Math.max(350,1400/speed));
  return()=>clearTimeout(timer);
 },[playing,index,status,speed,loop,frames.length,active]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),stop=()=>{setPlaying(false);setGuidedTour(false);};
  media.addEventListener('change',stop);return()=>media.removeEventListener('change',stop);
 },[]);

 // Guided tour across places
 useEffect(()=>{
  if(!guidedTour||!active||!sites.length)return;
  const targetSite=sites[tourIndex%sites.length];
  if(targetSite){
   setSelected(targetSite);
   flyTo(...targetSite.coordinates,0.55);
  }
  const timer=setTimeout(()=>setTourIndex(i=>(i+1)%sites.length),3200);
  return()=>clearTimeout(timer);
 },[guidedTour,tourIndex,active,sites,setSelected]);

 // Deep-zoom MapLibre local map handoff
 useEffect(()=>{
  if(!localMapHandoff||!hosted||!localMapMountRef.current)return;
  const targetSite=selected||sites.find(s=>s.id==='angat')||sites[0];
  if(!targetSite)return;
  let cancelled=false;
  import('../local-map.js').then(async ({mountMap})=>{
   if(cancelled||!localMapMountRef.current)return;
   try{
    const controller=await mountMap(localMapMountRef.current,targetSite,{
     date:frame?.date||'2026-10-09',
     bounds:targetSite.bbox
    },'GIBS',[],{mode:'gibs'});
    if(cancelled)controller?.dispose();
    else localMapCleanupRef.current=()=>controller?.dispose();
   }catch{}
  }).catch(()=>{});
  return()=>{cancelled=true;localMapCleanupRef.current?.();localMapCleanupRef.current=null;};
 },[localMapHandoff,selected,sites,frame?.date]);

 useLayoutEffect(()=>{
  if(!radarActive)return;
  if(!selected||!frame||status!=='ready'){setCrop({url:'',note:status==='gap'?'No NISAR image for this date.':'Select a loaded frame to view the current-date crop.'});return;}
  let live=true;setCrop({url:'',note:'Loading current-date site crop…'});
  const key=frame.layer+'/'+frame.date+'/'+selected.id;
  let pending=crops.current.get(key);
  if(!pending){pending=siteCrop(frame,selected.bbox,loaded||undefined);const request=pending;void request.catch(()=>{if(crops.current.get(key)===request)crops.current.delete(key);});}
  crops.current.delete(key);crops.current.set(key,pending);while(crops.current.size>4){const oldest=crops.current.keys().next().value!;releaseCrop(crops.current.get(oldest)!);crops.current.delete(oldest);}
  void pending.then(result=>{if(live)setCrop(result);}).catch(()=>{if(live)setCrop({url:'',note:'Current-date crop unavailable. Retry or open Sites.'});});
  return()=>{live=false;};
 },[selected,frame,status,loaded,cropRetry,radarActive]);
 useEffect(()=>()=>{cache.current.clear();for(const value of crops.current.values())releaseCrop(value);crops.current.clear();disposeGlobe();},[]);
 function retryCrop(){if(frame&&selected){const key=frame.layer+'/'+frame.date+'/'+selected.id,pending=crops.current.get(key);if(pending)releaseCrop(pending);crops.current.delete(key);}setCropRetry(n=>n+1);}
 function seek(next:number,history:HistoryMode='push'){setPlaying(false);setGuidedTour(false);setIndex(Math.max(0,Math.min(frames.length-1,next)),history);}
 function togglePlay(){if(!frames.length||status==='error')return;setGuidedTour(false);if(!playing&&index===frames.length-1)setIndex(0);setPlaying(!playing);}
 function selectSite(site:Site){setGuidedTour(false);setSelected(site);flyTo(...site.coordinates,.65);}
 function activatePhilippinesPreset(){
  setGuidedTour(false);
  setPhPresetActive(true);
  const angat=sites.find(s=>s.id==='angat')||sites[0];
  if(angat)setSelected(angat);
  flyTo(121.15,13.5,0.42);
 }
 function resetGlobeView(){
  setGuidedTour(false);
  setPhPresetActive(false);
  setLocalMapHandoff(false);
  change({site:undefined});
  flyTo(115,15,1.5);
 }
 function key(e:React.KeyboardEvent){
  if(mode!=='satellite')return;
  if((e.target as HTMLElement).closest('input:not([type=range]),select,textarea,a,button:not(#sat-play)'))return;
  if(e.key===' '){e.preventDefault();e.stopPropagation();togglePlay();}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();seek(index+(e.key==='ArrowRight'?1:-1));}
  if(e.key==='Home'||e.key==='End'){e.preventDefault();e.stopPropagation();seek(e.key==='Home'?0:frames.length-1);}
 }
 useEffect(()=>{setGeographicContext(context);},[context,ready]);
 useEffect(()=>{const update=()=>setBasemap(document.getElementById('globe-stage')?.dataset.basemap||'loading');addEventListener('globe:basemap',update);update();return()=>removeEventListener('globe:basemap',update);},[ready]);
 const openConceptRadar=useCallback((date:string)=>{setPlaying(false);change({date,mode:'satellite'});},[change]);
 useEffect(()=>setPlaying(false),[navigationKey]);
 useEffect(()=>{if(active&&ready&&selected&&mode!=='illustrative')flyTo(...selected.coordinates,mode==='concept'?1.2:.65);},[active,ready,selected?.id]);
 const gap=manifest?.gap;
 const conceptPin=pins.find(p=>p.id===(selected?.id||'angat')&&p.visible),conceptReading=concept?.sites.find(s=>s.id===conceptPin?.id);
 const philippinePlaces=useMemo(()=>places.filter(p=>p.countryCode==='PH'),[places]);
 return <div className="satellite-page" data-view-mode={mode} ref={section} onKeyDownCapture={key}>
 <div className="satellite-heading"><div><p className="eyebrow">Earth / a record through time · 57 real observations across 4 radar sites</p><h1>{mode==='satellite'?'Earth through time':mode==='illustrative'?'The concept globe':'Seasons seen from space'}</h1></div><div className="globe-heading-controls"><div className="mode-switch" role="group" aria-label="Globe mode"><button id="satellite-mode" aria-pressed={mode==='satellite'} onClick={()=>setMode('satellite')}>Radar observations</button><button id="concept-mode" aria-pressed={mode==='concept'} onClick={()=>setMode('concept')}>Land through time</button><button id="illustrative-mode" aria-pressed={mode==='illustrative'} onClick={()=>setMode('illustrative')}>Concept globe</button></div><ShareLink hash={globeHash({mode,site:selected?.id||(mode==='concept'?(sites.find(s=>s.id==='angat')||sites[0])?.id:undefined),date:frame?.date,month:selection.month||concept?.month})}/>{selection.site&&!selected&&<p role="status">Requested study site is not in this edition. {mode==='concept'?'The default study area is shown.':'No site crop is selected.'}</p>}</div></div>
 <p className="coverage-note">{mode==='satellite'?<>Play dated <GlossaryTerm termKey="NISAR"/> radar images from NASA <GlossaryTerm termKey="GIBS"/>. Colored strips show where the satellite observed Earth; coverage changes with each date.</>:mode==='illustrative'?'Follow an illustrative climate progression, explore connected places, and take a guided tour.':<>Play real monthly <GlossaryTerm termKey="MODIS"/> satellite images to follow vegetation <GlossaryTerm termKey="greenness"/>. Compare seasons and local weather, then explore possible explanations.</>}</p>
 <div className="globe-content"><div className="globe-visual">
 <div id="globe-stage" data-mode={mode} data-frame-status={status} className="satellite-stage">
 <div id="globe-canvas"/><p id="globe-status" className="globe-status" role="status">Loading globe…</p>
 <div className="frame-badge" data-testid="frame-badge">{mode==='illustrative'?<><span>CONCEPT / ILLUSTRATIVE</span><strong>A connected Pacific</strong><small>Animated patterns are not measured observations</small></>:mode==='satellite'?<><span>{frame?.date||'Date not available'} | radar image date</span><strong>Colored strips show radar coverage</strong><small>NASA–ISRO NISAR · image and processing details below</small></>:<><span>{selection.month||concept?.month||'Loading monthly record...'} | monthly satellite image</span><strong>Vegetation greenness</strong><small>Site markers show rainfall compared with usual</small></>}</div>
 <p className="satellite-context-source">{mode==='illustrative'?'Natural Earth outlines · illustrative climate layers':context||mode==='concept'?basemap==='ready'?<><a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noopener">NASA Earth Observatory / Blue Marble</a> | historical 2004 optical reference | not the selected date</>:basemap==='loading'?'Loading saved satellite basemap...':'Natural Earth geographic fallback | satellite basemap unavailable':'Satellite basemap hidden'}</p>
 {mode==='concept'&&conceptPin&&conceptReading&&<div className="sat-marker-layer concept-marker-layer"><button className={'concept-selected-marker '+conceptReading.signal} style={{left:conceptPin.x,top:conceptPin.y}} aria-label={'Focus '+conceptReading.name} onClick={()=>{const site=sites.find(s=>s.id===conceptPin.id);if(site)focusConceptSite(site);}}>{marker}<span>{conceptReading.name}<small>{conceptReading.rainAnomaly===null?'Rainfall unavailable':(conceptReading.rainAnomaly>0?'+':'')+conceptReading.rainAnomaly.toFixed(1)+' mm rainfall departure'}</small></span></button></div>}
 {mode==='satellite'&&<><div className="sat-marker-layer">{pins.filter(p=>p.visible).map(p=>{const site=sites.find(s=>s.id===p.id)!;return <button key={p.id} style={{left:p.x,top:p.y}} title={site.name} aria-label={'Explore '+site.name} onClick={()=>selectSite(site)}>{marker}</button>;})}</div>
 {status==='loading'&&<div className="frame-overlay">Loading NISAR for {frame?.date}... Satellite basemap remains visible.</div>}
 {status==='gap'&&<div className="frame-overlay gap-overlay"><strong>{requestedOutside?'No saved NISAR image':'No NISAR data'} | {frame?.date}</strong><small>Showing the historical satellite basemap. No radar is carried across this gap.</small></div>}
 {(status==='error'||manifestError)&&<div className="failure-copy">NISAR imagery unavailable for this date. The reference Earth stays visible.<br/><button onClick={()=>{if(manifestError)setRetryManifest(n=>n+1);else{if(frame)cache.current.invalidate(frame);setRetry(n=>n+1);}}}>Retry imagery</button></div>}
 </>}
 {localMapHandoff&&<div id="globe-local-map-overlay" className="globe-local-map-overlay" role="region" aria-label="Local GIBS map view">
  <div className="globe-local-map-bar">
   <strong>Local GIBS Map · {selected?.name||'Angat'} · {frame?.date||'2026-10-09'}</strong>
   <button type="button" id="back-to-globe-btn" className="button primary" onClick={()=>setLocalMapHandoff(false)}>← Back to globe</button>
  </div>
  <div ref={localMapMountRef} className="globe-local-map-mount"/>
 </div>}
 </div>
 <div className="globe-time-bar" hidden={mode==='illustrative'} aria-label={mode==='satellite'?'Radar image timeline':'Monthly vegetation timeline'}>
 {mode==='satellite'?<>
  <div className="globe-time-actions"><button aria-label="Previous frame" disabled={!frames.length||index===0} onClick={()=>seek(index-1)}>←</button><button id="sat-play" aria-pressed={playing} disabled={!frames.length||status==='error'} onClick={togglePlay}>{playing?'Pause radar dates':'Play radar dates'}</button><button aria-label="Next frame" disabled={!frames.length||index===frames.length-1} onClick={()=>seek(index+1)}>→</button><label>Go to date<input id="radar-calendar-date" type="date" min={frames[0]?.date} max={frames.at(-1)?.date} value={frame?.date||''} disabled={!frames.length} onChange={e=>{const next=frames.findIndex(f=>f.date===e.target.value);if(next>=0)seek(next);}}/></label></div>
  <label className="scrubber-label" htmlFor="satellite-scrubber">Radar date {frames.length?index+1:0} of {frames.length}<span>{status==='loading'?'Loading selected image…':frame?.date}</span></label>
  <input id="satellite-scrubber" type="range" min="0" max={Math.max(0,frames.length-1)} value={index} disabled={!frames.length} aria-valuetext={frame?frame.date+' '+frame.maturityWindow+' '+status:'Not available'} onChange={e=>seek(Number(e.target.value),'replace')}/>
  <p>{frames[0]?.date} → {frames.at(-1)?.date} · Missing dates stay empty.</p>
 </>:<>
  <div className="globe-time-actions"><button aria-label="Previous vegetation month" disabled={!monthPlayback||monthPlayback.month===monthPlayback.months[0]} onClick={()=>monthPlayback?.step(-1)}>←</button><button id="land-play" aria-pressed={!!monthPlayback?.playing} disabled={!monthPlayback?.canPlay} onClick={()=>monthPlayback?.toggle()}>{monthPlayback?.playing?'Pause months':'Play months'}</button><button aria-label="Next vegetation month" disabled={!monthPlayback||monthPlayback.month===monthPlayback.months.at(-1)} onClick={()=>monthPlayback?.step(1)}>→</button><label>Go to month<input id="vegetation-calendar-month" type="month" min={monthPlayback?.months[0]} max={monthPlayback?.months.at(-1)} value={monthPlayback?.month||''} disabled={!monthPlayback} onChange={e=>{if(monthPlayback?.months.includes(e.target.value))monthPlayback.seek(e.target.value);}}/></label></div>
  <p>{monthPlayback?.months[0]} → {monthPlayback?.months.at(-1)} · {vegetationStatus==='loading'?'Waiting for the selected image…':'Monthly images reveal seasonal greening and browning.'}</p>
 </>}
 </div>
 <ConceptVegetation playing={!!monthPlayback?.playing} active={active&&mode==='concept'} month={selection.month||concept?.month||''} onStatus={setVegetationStatus}/>
 </div>
 <ConceptTimeline oceanNotice={oceanNotice} requestedMonth={selection.month} onMonthChange={setMonth} navigationKey={navigationKey} onPlaybackChange={setMonthPlayback} waiting={vegetationStatus==='loading'} active={active&&mode==='concept'} sites={sites} enso={enso} selectedSiteId={selected?.id} radarDates={frames.filter(f=>f.status==='ready').map(f=>f.date)} onSnapshot={receiveConcept} onSelectSite={focusConceptSite} onOpenRadar={openConceptRadar}/>
 <IllustrativeGlobe active={active&&mode==='illustrative'} ready={ready} sites={sites} news={news} newsNotice={newsNotice} navigationKey={navigationKey} selectedSiteId={selected?.id}/>
 </div>
 <div className="satellite-workspace" hidden={mode!=='satellite'}>
 <section className="playback-sheet" aria-label="Radar playback options and evidence">
 <div className="globe-status-strip" data-testid="globe-status-strip" role="region" aria-label="Current globe status and quick presets">
  <div className="globe-status-pills">
   <span><strong>Mode:</strong> {mode==='satellite'?'Radar observations':mode==='concept'?'Land through time':'Concept globe'}</span>
   <span><strong>Layer:</strong> {layerId||'NISAR Daily Mosaic'}</span>
   <span><strong>Date:</strong> {frame?.date||'Unavailable'} (Frame {frames.length?index+1:0} of {frames.length})</span>
   <span><strong>Place:</strong> {selected?.name||'Global overview'}</span>
  </div>
  <div className="globe-status-actions">
   <button type="button" id="globe-philippines-preset" aria-pressed={phPresetActive} onClick={activatePhilippinesPreset}>Philippines focus (6 places)</button>
   <button type="button" id="globe-guided-tour" aria-pressed={guidedTour} onClick={()=>setGuidedTour(g=>!g)}>{guidedTour?'Stop guided tour':'Guided tour'}</button>
   <button type="button" id="open-globe-local-map" disabled={!hosted} onClick={()=>setLocalMapHandoff(v=>!v)}>{localMapHandoff?'Back to 3D globe':'Zoom to local GIBS map'}</button>
   <button type="button" id="globe-status-reset" onClick={resetGlobeView}>Reset view</button>
  </div>
 </div>
 {phPresetActive&&philippinePlaces.length>0&&<div className="ph-globe-preset-strip" data-testid="ph-globe-preset-strip">
  <strong>Philippines places ({philippinePlaces.length}):</strong>
  {philippinePlaces.map(p=><button key={p.id} type="button" onClick={()=>{if(p.siteId){const s=sites.find(x=>x.id===p.siteId);if(s)selectSite(s);}else flyTo(p.lng,p.lat,0.35);}}>{p.name}{p.hasRadarFrames?' ★':''}</button>)}
 </div>}
 <div className="satellite-map-options"><label><input type="checkbox" checked={context} onChange={e=>setContext(e.target.checked)}/>Satellite basemap</label><button disabled={!frame?.focus||status!=='ready'} onClick={()=>{if(frame?.focus)flyTo(frame.focus.lng,frame.focus.lat,1.6);}}>Find this frame</button><button onClick={()=>{seek(bestIndex);const focus=frames[bestIndex]?.focus;if(focus)flyTo(focus.lng,focus.lat,1.5);}}>Show more radar coverage</button><button onClick={()=>seek(frames.length-1)}>Latest date</button></div>
 <p className="satellite-coverage-info">{context?'The natural-color Earth is a saved NASA satellite composite. Colored strips are the selected NISAR date only.':'Satellite basemap hidden. Only dated NISAR radar strips are shown.'} Daily radar coverage is partial; use Show more radar coverage to explore a fuller recorded day.</p>
 <div className="frame-readout" data-testid="frame-readout"><strong>{frame?.date||'Date not available'}</strong><span>Radar image {frames.length?index+1:0} of {frames.length}</span><span>Compare coverage, then inspect a place.</span></div>
 <div className="playback-controls"><label>Speed<select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4].map(s=><option value={s} key={s}>{s}×</option>)}</select></label><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>Loop</label><label>Mosaic<select aria-label="NISAR mosaic layer" value={layerId} onChange={e=>{const next=manifest!.layers[e.target.value];setPlaying(false);setLayerId(e.target.value);const exact=next.frames.findIndex(f=>f.date===frame?.date);change({date:next.frames[exact>=0?exact:next.frames.length-1]?.date});}}><option value={manifest?.defaultLayer.endsWith('_12Day')?manifest?.defaultLayer.replace('_12Day',''):manifest?.defaultLayer||''}>Daily mosaic</option><option value="NISAR_L2_Geocoded_Polarimetric_Covariance_12Day" disabled={!manifest?.rollingAvailable}>12-day rolling{manifest?.rollingAvailable?'':' · not available'}</option></select></label></div>
 <div className={'loading-line '+(status==='loading'?'is-loading':'')} aria-hidden="true"/>
 {layer&&<><div className="maturity-timeline" aria-label="Documented release windows and date availability">
 {manifest!.maturityWindows.map((w,i)=>{const lo=Math.max(time(w.start),dates[0]),hi=Math.min(time(w.end||layer.end),dates.at(-1)!);return hi>=lo?<a key={w.label} href={w.source} target="_blank" rel="noopener" className={'maturity-segment maturity-'+i} style={{left:(lo-dates[0])/range*100+'%',width:Math.max(.4,(hi-lo)/range*100)+'%'}} title={w.label+' release window; not pixel lineage'}>{w.label}</a>:null;})}
 {frames.filter(f=>f.status==='no-data').map(f=><i key={f.date} className="missing-day" style={{left:(time(f.date)-dates[0])/range*100+'%',width:Math.max(.2,86400000/range*100)+'%'}} title={f.date+' · no data'}/>)}
 {gap&&<span className="mission-gap-label" style={{left:Math.max(0,(Date.parse(gap.start)-dates[0])/range*100)+'%'}}>No data</span>}
 </div><div className="timeline-ends"><span>{layer.start}</span><span>{layer.end}</span></div>{oceanNotice}{newsNotice}{enso&&<OceanStrip enso={enso} news={news} frame={frame} start={layer.start} end={layer.end}/>}</>}
 <p className="frame-status" role={playing?undefined:"status"} aria-live={playing?"off":"polite"}>{manifestError||message}</p>
 <p className="sat-source">Radar: NASA–ISRO NISAR previews via NASA GIBS. Display colors are not natural color or calibrated measurements. Ocean: NOAA{frame&&<> · <a href={frame.sourceUrl||wmsURL(frame.layer,frame.date)} target="_blank" rel="noopener">This frame’s source</a></>}</p>
 <details className="playback-notes"><summary>How to read this record · sources and processing</summary><p>Radar sends microwave pulses toward Earth and measures their return. These previews come from NISAR, the NASA–ISRO radar satellite.</p><p>Selected release window: {frame?.maturityWindow||'not confirmed'}. Individual pixel maturity and acquisition time are unconfirmed. Layer: {layerId||'not available'}.</p><p>The background is NASA Blue Marble, a historical 2004 MODIS optical reference. It is stored with the app, available without an API key, and does not change with the NISAR date. It is not current imagery or evidence of land change.</p><p>{manifest?.colorMapping.text||'Color mapping not confirmed.'} <a href={manifest?.colorMapping.source||'https://nisar-docs.asf.alaska.edu/worldview/'}>Color guide</a></p><p>{manifest?.maturityNote}</p><p>With the satellite basemap hidden, areas without radar coverage stay dark. Dark pixels within covered strips can also be low radar returns; darkness alone is not a water classification. Frames are replaced without blending or differencing maturities.</p><p>{manifest?.defaultReason}. The production date domain includes January–June imagery, so that interval is not drawn as an assumed gap.</p><p>{gap&&<>Permanent gap: {gap.start} through {gap.end}. July 27 and August 10 have partial boundary-day coverage. <a href={gap.source}>NISAR availability guide</a></>}</p><p>Global overviews are downsampled to 1024 × 512 or smaller, about 39-104 km per pixel at the equator. Zooming does not add detail. The current frame dimensions are recorded in the manifest. <a href={layer?.domainUrl}>Full advertised date domain</a></p><p>Space: play/pause. Left/right: step. Home/end: first/latest. No autoplay under reduced motion. Playback waits for each image. Loop starts off.</p></details>
 {!hosted&&<div className="offline-frames"><p>Offline edition: a few real frames are embedded; other dates remain visible as unavailable.</p>{frames.filter(f=>f.offlineEmbedded).map((f)=><button key={f.date} onClick={()=>seek(frames.indexOf(f))}>{f.date}</button>)}</div>}
 <WhereToNext
  stepNumber="Step 4 of 5 · Media"
  nextHref={selectedStudyPlace?`#media?place=${selectedStudyPlace.id}`:'#media'}
  nextLabel="Explore Regional & Local News Dashboard"
  whyText="See how 293 saved headlines connect to these places and why headline tone measures wording rather than physical disaster severity."
  secondaryLinks={[
   {href:selected?`#sites/${selected.id}${frame?'?date='+frame.date:''}`:'#sites/angat',label:'Open in Sites →'},
   {href:'#method',label:'See sources & method →'}
  ]}
 />
 </section>
 <aside className="satellite-site-panel" aria-label="Study-site frame crop"><div className="site-marker-list">{sites.map(site=><button key={site.id} aria-pressed={selected?.id===site.id} onClick={()=>selectSite(site)}>{marker}{site.name}</button>)}</div>
 {selected?<><h2>{selected.name}</h2><p className="mono">{frame?.date||'Date not available'} · {frame?.maturityWindow||'Maturity not available'}</p>{crop.url?<img src={crop.url} alt={'Current NISAR mosaic crop for '+selected.name+', '+frame?.date+'; false color; pixel maturity unconfirmed'}/>:<div className="site-crop-empty">{crop.note||'Current-date crop unavailable.'}</div>}{crop.url&&<p>{crop.note}</p>}<p className="source-line">NASA GIBS · mosaic date {frame?.date||'not available'} · maturity / CRID not available at pixel level · downsampled</p><a className="button" href={'#sites/'+selected.id+(frame?'?date='+frame.date:'')}>Open in Sites</a><button className="text-link" onClick={retryCrop}>Retry crop</button><PlaceNewsPanel place={selectedStudyPlace} newsByPlace={newsByPlace} maxItems={3} compact/></>:<><h2>Follow a place</h2><p>Choose a marker or a study area. Its crop uses the current date, and Sites keeps that date.</p><button className="text-link" onClick={()=>document.getElementById('open-search')?.click()}>Search places and sites</button><PlaceNewsPanel place={places.find(p=>p.id==='angat')||null} newsByPlace={newsByPlace} maxItems={2} compact/></>}
 </aside></div>
 <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
 </div>;
}
