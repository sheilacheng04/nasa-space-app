import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { dataFile,hosted } from '../api/client';
import { initGlobe,pauseGlobe,resumeGlobe,setGlobePoints,flyTo,setGlobeMode,setSatelliteTexture,hideSatelliteTexture,getGlobeMarkers,setGeographicContext } from '../world.js';
import { closeLocalWindow } from '../local-window.js';
import { FrameCache,siteCrop,wmsURL } from '../globe-data';
import type { GlobeManifest,GlobeFrame,LoadedFrame } from '../globe-data';
import type { Enso,News,Observation,Place,Site } from '../types';
import '../satellite.css';

const marker=<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></svg>;
const time=(date:string)=>Date.parse(date.slice(0,10)+'T00:00:00Z');
function OceanStrip({enso,news,frame,start,end}:{enso:Enso;news:News;frame?:GlobeFrame;start:string;end:string}){
 const rows=enso.weekly?.filter(r=>time(r.date)>=time(start)&&time(r.date)<=time(end)&&Number.isFinite(r.anomaly))||[];
 const x=(date:string)=>40+(time(date)-time(start))/Math.max(86400000,time(end)-time(start))*900;
 const min=Math.min(-1,...rows.map(r=>r.anomaly)),max=Math.max(1,...rows.map(r=>r.anomaly)),y=(v:number)=>48-(v-min)/(max-min)*36;
 const path=rows.map((r,i)=>(i?'L':'M')+x(r.date).toFixed(1)+','+y(r.anomaly).toFixed(1)).join(' ');
 const nearest=frame?rows.filter(r=>time(r.date)<=time(frame.date)).at(-1):null;
 const events=Array.from(new Map(news.items.filter(n=>n.url.startsWith('https:')&&time(n.date)>=time(start)&&time(n.date)<=time(end)).map(n=>[n.date.slice(0,7),n])).values()).slice(0,8);
 return <div className="ocean-strip"><p><strong>Ocean data, not NISAR</strong><span>Weekly Niño 3.4 anomaly · n = {rows.length}{nearest?' · '+nearest.date+': '+(nearest.anomaly>0?'+':'')+nearest.anomaly.toFixed(1)+' °C':''}</span></p>
 <svg viewBox="0 0 980 76" role="img" aria-label={'NOAA weekly Niño 3.4 sea-surface temperature anomaly; '+rows.length+' observations. Cursor '+(frame?.date||'not available')}>
 <line x1="40" x2="940" y1={y(0)} y2={y(0)} stroke="#49545e" strokeDasharray="3 5"/><path d={path} fill="none" stroke="var(--orange)" strokeWidth="2"/>
 <text x="2" y="15">{max.toFixed(1)}°</text><text x="2" y="50">{min.toFixed(1)}°</text>
 {frame&&<line data-testid="ocean-cursor" x1={x(frame.date)} x2={x(frame.date)} y1="3" y2="60" stroke="var(--ink)" strokeWidth="1.5"/>}
 {events.map(n=><a key={n.id} href={n.url} target="_blank" rel="noopener" aria-label={'Reporting on '+n.date+': '+n.title}><circle cx={x(n.date)} cy="66" r="3" fill="var(--muted)"/><title>{n.date+' · '+n.title+' · '+n.source}</title></a>)}
 </svg><p className="strip-note"><a href={enso.url} target="_blank" rel="noopener">Source: NOAA CPC</a> · News dots link to reporting, not independently confirmed events. Latest preceding weekly reading; no interpolation.</p></div>;
}
function Schematic(){return <div className="orbit-schematic" role="img" aria-label="Schematic of orbit coverage, not data"><svg viewBox="0 0 300 240"><circle cx="150" cy="120" r="77"/><ellipse cx="150" cy="120" rx="115" ry="36" transform="rotate(-55 150 120)"/><ellipse cx="150" cy="120" rx="115" ry="36" transform="rotate(55 150 120)"/></svg><strong>Schematic, not data</strong></div>;}
export default function GlobeExperience({active,sites,points,place,enso,news}:{active:boolean;sites:Site[];points:Observation[];place:Place|null;enso:Enso;news:News}){
 const [manifest,setManifest]=useState<GlobeManifest|null>(null),[manifestError,setManifestError]=useState(''),[retryManifest,setRetryManifest]=useState(0);
 const [mode,setMode]=useState<'satellite'|'concept'>('satellite'),[layerId,setLayerId]=useState(''),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[loop,setLoop]=useState(false);
 const [context,setContext]=useState(true);
 const [ready,setReady]=useState(false),[status,setStatus]=useState('loading'),[message,setMessage]=useState('Loading the real GIBS date record…'),[retry,setRetry]=useState(0),[announcement,setAnnouncement]=useState('');
 const [loaded,setLoaded]=useState<LoadedFrame|null>(null),[selected,setSelected]=useState<Site|null>(null),[crop,setCrop]=useState({url:'',note:''}),[cropRetry,setCropRetry]=useState(0),[pins,setPins]=useState<{id:string;x:number;y:number;visible:boolean}[]>([]);
 const cache=useRef(new FrameCache()),playingRef=useRef(playing),modeRef=useRef(mode);playingRef.current=playing;modeRef.current=mode;
 const section=useRef<HTMLDivElement>(null),initialFocus=useRef(false);
 const layer=manifest?.layers[layerId],frames=layer?.frames||[],frame=frames[index];
 const currentFrame=useRef(frame);currentFrame.current=frame;
 const dates=useMemo(()=>frames.map(f=>time(f.date)),[frames]),range=dates.length?dates.at(-1)!-dates[0]:1;
 useEffect(()=>{let live=true;setManifestError('');dataFile<GlobeManifest>('globe/manifest.json').then(m=>{if(!live)return;setManifest(m);setLayerId(m.defaultLayer);setIndex(m.layers[m.defaultLayer].frames.length-1);}).catch(()=>{if(live){setManifestError('The NISAR date manifest could not be loaded.');setStatus('error');}});return()=>{live=false;};},[retryManifest]);
 useEffect(()=>{setGlobePoints(sites,points);},[sites,points]);
 useEffect(()=>{
  let current=true;
  if(active){setGlobeMode(modeRef.current);void initGlobe(sites,points,(id:string)=>{location.hash='sites/'+id+(currentFrame.current?'?date='+currentFrame.current.date:'');}).then(globe=>{if(!current)return;if(globe){setReady(true);resumeGlobe();setGlobeMode(modeRef.current);}else{setStatus('error');setMessage('The globe renderer is unavailable.');}});}
  else{setPlaying(false);pauseGlobe();closeLocalWindow();}
  return()=>{current=false;pauseGlobe();closeLocalWindow();};
 },[active,sites]);
 useEffect(()=>{if(ready&&active&&place)flyTo(...place.geometry.coordinates);},[ready,active,place]);
 useEffect(()=>{setPlaying(false);if(ready){setGlobeMode(mode);if(mode==='satellite'&&loaded)void setSatelliteTexture(loaded.url,loaded.image,loaded.date).catch(()=>{setStatus('error');setMessage('The radar texture could not be displayed.');});}},[mode,ready]);
 useEffect(()=>{
  let pinTick=0;const update=()=>{cancelAnimationFrame(pinTick);pinTick=requestAnimationFrame(()=>setPins(getGlobeMarkers()));};
  const select=(e:Event)=>{const id=(e as CustomEvent).detail?.id;const site=sites.find(s=>s.id===id);if(site){setSelected(site);flyTo(...site.coordinates,.65);}};
  addEventListener('globe:camera',update);addEventListener('globe:select-site',select);
  if(ready)update();return()=>{cancelAnimationFrame(pinTick);removeEventListener('globe:camera',update);removeEventListener('globe:select-site',select);};
 },[ready,sites,mode]);
 useLayoutEffect(()=>{
  if(!ready||!active||!frame)return;let live=true;hideSatelliteTexture();setLoaded(null);setStatus('loading');setMessage('Loading '+frame.date+'…');
  if(frame.status==='no-data'||frame.status==='empty'){
   setStatus('gap');setMessage(frame.status==='no-data'?'No data. GIBS does not advertise this date.':'No coverage in this global mosaic.');if(!playingRef.current)setAnnouncement(frame.date+'. No data.');return;
  }
  cache.current.load(frame,true).then(async result=>{
   if(!live)return;if(modeRef.current==='satellite')await setSatelliteTexture(result.url,result.image,result.date);
   if(!live)return;setLoaded(result);setStatus('ready');setMessage((result.origin==='live GIBS'?'Live NASA GIBS':result.origin==='saved GIBS frame'?'Live request unavailable; saved NASA GIBS frame':'Offline NASA GIBS frame')+' · false color, not calibrated');
   if(!initialFocus.current&&!place){initialFocus.current=true;if(frame.focus)flyTo(frame.focus.lng,frame.focus.lat,2.3);}
   if(!playingRef.current)setAnnouncement(frame.date+'. '+frame.maturityWindow+'. Pixel maturity not available.');
  }).catch(error=>{if(live){setStatus('error');setMessage(error.message);setPlaying(false);setAnnouncement(frame.date+'. Imagery unavailable.');}});
  return()=>{live=false;};
 },[frame,ready,active,retry]);
 useEffect(()=>{
  if(!frame||status!=='ready'||!active)return;
  frames.slice(index+1,index+3).filter(f=>f.status!=='no-data'&&f.status!=='empty').forEach(f=>{void cache.current.load(f).catch(()=>{});});
 },[frame,status,active,index,frames]);
 useEffect(()=>{
  if(!playing||!active||!frame||status==='loading'||status==='error')return;
  const timer=setTimeout(()=>{if(index===frames.length-1){if(loop)setIndex(0);else setPlaying(false);}else setIndex(i=>i+1);},Math.max(350,1400/speed));
  return()=>clearTimeout(timer);
 },[playing,index,status,speed,loop,frames.length,active]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),stop=()=>setPlaying(false);
  media.addEventListener('change',stop);return()=>media.removeEventListener('change',stop);
 },[]);
 useEffect(()=>{
  if(!selected||!frame||status!=='ready'){setCrop({url:'',note:status==='gap'?'No NISAR image for this date.':'Select a loaded frame to view the current-date crop.'});return;}
  let live=true,objectURL='';setCrop({url:'',note:'Loading current-date site crop…'});
  void siteCrop(frame,selected.bbox,loaded||undefined).then(result=>{if(result.url.startsWith('blob:'))objectURL=result.url;if(live)setCrop(result);else if(objectURL)URL.revokeObjectURL(objectURL);}).catch(()=>{if(live)setCrop({url:'',note:'Current-date crop unavailable. Retry or open Sites.'});});
  return()=>{live=false;if(objectURL)URL.revokeObjectURL(objectURL);};
 },[selected,frame,status,loaded,cropRetry]);
 useEffect(()=>()=>cache.current.clear(),[]);
 function seek(next:number){setPlaying(false);setIndex(Math.max(0,Math.min(frames.length-1,next)));}
 function togglePlay(){if(!frames.length||status==='error')return;if(!playing&&index===frames.length-1)setIndex(0);setPlaying(!playing);}
 function selectSite(site:Site){setSelected(site);flyTo(...site.coordinates,.65);}
 function key(e:React.KeyboardEvent){
  if((e.target as HTMLElement).closest('input:not([type=range]),select,textarea,a,button:not(#sat-play)'))return;
  if(e.key===' '){e.preventDefault();e.stopPropagation();togglePlay();}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();seek(index+(e.key==='ArrowRight'?1:-1));}
  if(e.key==='Home'||e.key==='End'){e.preventDefault();e.stopPropagation();seek(e.key==='Home'?0:frames.length-1);}
 }
 useEffect(()=>{setGeographicContext(context);},[context,ready]);
 const gap=manifest?.gap;
 return <div className="satellite-page" data-view-mode={mode} ref={section} onKeyDownCapture={key}>
 <div className="satellite-heading"><div><p className="eyebrow">NISAR / a record through time</p><h1>Where radar has looked</h1></div><div className="mode-switch" role="group" aria-label="Globe mode"><button id="satellite-mode" aria-pressed={mode==='satellite'} onClick={()=>setMode('satellite')}>Satellite</button><button id="concept-mode" aria-pressed={mode==='concept'} onClick={()=>setMode('concept')}>Concept</button></div></div>
 <p className="coverage-note">{mode==='satellite'?'Coverage is partial and builds as NISAR repeats its orbit; this is not a continuous movie of Earth.':'Modeled climate patterns illustrate an El Niño hypothesis; the NOAA strip below contains real ocean observations.'}</p>
 <div id="globe-stage" data-mode={mode} data-frame-status={status} className="satellite-stage">
 <div id="globe-canvas"/><p id="globe-status" className="globe-status" role="status">Loading globe…</p>
 <div className="frame-badge" data-testid="frame-badge"><span>{frame?.date||'Date not available'} · {mode==='satellite'?'Mosaic date':'Shared date'}</span><strong>{frame?.maturityWindow||'Unconfirmed'} release window</strong><small>Pixel maturity / acquisition time: not available</small><small>NASA GIBS / NISAR GCOV browse / false color</small></div>
 {mode==='satellite'&&<><div className="sat-marker-layer">{pins.filter(p=>p.visible).map(p=>{const site=sites.find(s=>s.id===p.id)!;return <button key={p.id} style={{left:p.x,top:p.y}} title={site.name} aria-label={'Explore '+site.name} onClick={()=>selectSite(site)}>{marker}</button>;})}</div>
 <p className="satellite-context-source">{context?<>Reference map: Natural Earth / not satellite imagery</>:"Reference map hidden"}</p>
 {status==='loading'&&<div className="frame-overlay">Loading dated imagery…</div>}
 {status==='gap'&&<div className="frame-overlay gap-overlay"><strong>No data</strong><span>{frame?.date}</span><small>No image is carried across this gap.</small></div>}
 {(status==='error'||manifestError)&&<><Schematic/><div className="failure-copy">NISAR imagery could not be loaded. Showing a schematic of orbit coverage<br/><button onClick={()=>{if(manifestError)setRetryManifest(n=>n+1);else{if(frame)cache.current.invalidate(frame);setRetry(n=>n+1);}}}>Retry imagery</button></div></>}
 </>}
 </div>
 <div className="satellite-workspace">
 <section className="playback-sheet" aria-label="Dated NISAR playback">
 <div className="satellite-map-options"><label><input type="checkbox" checked={context} onChange={e=>setContext(e.target.checked)}/>Geographic context</label><button disabled={!frame?.focus||status!=='ready'} onClick={()=>{if(frame?.focus)flyTo(frame.focus.lng,frame.focus.lat,1.6);}}>Find this frame</button></div>
 <p className="satellite-coverage-info">{context?'Blue land and ocean are a reference map. Colored radar strips show the selected date only.':'Reference map hidden. Colored radar strips show the selected date only.'} Daily coverage is partial. Use the timeline to see other dates.</p>
 <div className="frame-readout" data-testid="frame-readout"><strong>{frame?.date||'Date not available'}</strong><span>{frame?.maturityWindow||'Unconfirmed'} release window · pixel maturity unconfirmed</span><span>Frame {frames.length?index+1:0} of {frames.length}</span><small>{layerId||'Layer not available'}</small></div>
 <div className="playback-controls"><button aria-label="Previous frame" onClick={()=>seek(index-1)} disabled={!frames.length||index===0}>←</button><button id="sat-play" aria-pressed={playing} onClick={togglePlay} disabled={!frames.length||status==='error'}>{playing?'Pause':'Play'}</button><button aria-label="Next frame" onClick={()=>seek(index+1)} disabled={!frames.length||index===frames.length-1}>→</button><label>Speed<select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4].map(s=><option value={s} key={s}>{s}×</option>)}</select></label><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>Loop</label><label>Mosaic<select aria-label="NISAR mosaic layer" value={layerId} onChange={e=>{const next=manifest!.layers[e.target.value];setPlaying(false);setLayerId(e.target.value);const exact=next.frames.findIndex(f=>f.date===frame?.date);setIndex(exact>=0?exact:next.frames.length-1);}}><option value={manifest?.defaultLayer.endsWith('_12Day')?manifest?.defaultLayer.replace('_12Day',''):manifest?.defaultLayer||''}>Daily mosaic</option><option value="NISAR_L2_Geocoded_Polarimetric_Covariance_12Day" disabled={!manifest?.rollingAvailable}>12-day rolling{manifest?.rollingAvailable?'':' · not available'}</option></select></label></div>
 <label className="scrubber-label" htmlFor="satellite-scrubber">Observation date <span>{playing&&status==='loading'?'Waiting for next frame…':status==='loading'?'Loading…':frame?.date}</span></label>
 <input id="satellite-scrubber" type="range" min="0" max={Math.max(0,frames.length-1)} value={index} disabled={!frames.length} aria-valuetext={frame?frame.date+' '+frame.maturityWindow+' '+status:'Not available'} onChange={e=>seek(Number(e.target.value))}/>
 <div className={'loading-line '+(status==='loading'?'is-loading':'')} aria-hidden="true"/>
 {layer&&<><div className="maturity-timeline" aria-label="Documented release windows and date availability">
 {manifest!.maturityWindows.map((w,i)=>{const lo=Math.max(time(w.start),dates[0]),hi=Math.min(time(w.end||layer.end),dates.at(-1)!);return hi>=lo?<a key={w.label} href={w.source} target="_blank" rel="noopener" className={'maturity-segment maturity-'+i} style={{left:(lo-dates[0])/range*100+'%',width:Math.max(.4,(hi-lo)/range*100)+'%'}} title={w.label+' release window; not pixel lineage'}>{w.label}</a>:null;})}
 {frames.filter(f=>f.status==='no-data').map(f=><i key={f.date} className="missing-day" style={{left:(time(f.date)-dates[0])/range*100+'%',width:Math.max(.2,86400000/range*100)+'%'}} title={f.date+' · no data'}/>)}
 {gap&&<span className="mission-gap-label" style={{left:Math.max(0,(Date.parse(gap.start)-dates[0])/range*100)+'%'}}>No data</span>}
 </div><div className="timeline-ends"><span>{layer.start}</span><span>{layer.end}</span></div><OceanStrip enso={enso} news={news} frame={frame} start={layer.start} end={layer.end}/></>}
 <p className="frame-status" role={playing?undefined:"status"} aria-live={playing?"off":"polite"}>{manifestError||message}</p>
 <p className="sat-source">Source: NISAR L2 GCOV browse mosaics via NASA GIBS, maturity as shown, false color, not calibrated · Ocean strip: NOAA CPC · Chart: team{frame&&<> · <a href={frame.sourceUrl||wmsURL(frame.layer,frame.date)} target="_blank" rel="noopener">This frame’s source</a></>}</p>
 <details className="playback-notes"><summary>How to read this record</summary><p>{manifest?.colorMapping.text||'Color mapping not confirmed.'} <a href={manifest?.colorMapping.source||'https://nisar-docs.asf.alaska.edu/worldview/'}>Color guide</a></p><p>{manifest?.maturityNote}</p><p>With geographic context hidden, areas without radar coverage stay dark. Dark pixels within covered strips can also be low radar returns; darkness alone is not a water classification. Frames are replaced without blending or differencing maturities.</p><p>{manifest?.defaultReason}. The production date domain includes January–June imagery, so that interval is not drawn as an assumed gap.</p><p>{gap&&<>Permanent gap: {gap.start} through {gap.end}. July 27 and August 10 have partial boundary-day coverage. <a href={gap.source}>NISAR availability guide</a></>}</p><p>Global overviews are downsampled to 1024 × 512 or smaller, about 39-104 km per pixel at the equator. Zooming does not add detail. The current frame dimensions are recorded in the manifest. <a href={layer?.domainUrl}>Full advertised date domain</a></p><p>Space: play/pause. Left/right: step. Home/end: first/latest. No autoplay. Playback waits for each image. Loop starts off.</p></details>
 {!hosted&&<div className="offline-frames"><p>Offline edition: a few real frames are embedded; other dates remain visible as unavailable.</p>{frames.filter(f=>f.offlineEmbedded).map((f,i)=><button key={f.date} onClick={()=>seek(frames.indexOf(f))}>{f.date}</button>)}</div>}
 </section>
 <aside className="satellite-site-panel" aria-label="Study-site frame crop"><div className="site-marker-list">{sites.map(site=><button key={site.id} aria-pressed={selected?.id===site.id} onClick={()=>selectSite(site)}>{marker}{site.name}</button>)}</div>
 {selected?<><h2>{selected.name}</h2><p className="mono">{frame?.date||'Date not available'} · {frame?.maturityWindow||'Maturity not available'}</p>{crop.url?<img src={crop.url} alt={'Current NISAR mosaic crop for '+selected.name+', '+frame?.date+'; false color; pixel maturity unconfirmed'}/>:<div className="site-crop-empty">{crop.note||'Current-date crop unavailable.'}</div>}{crop.url&&<p>{crop.note}</p>}<p className="source-line">NASA GIBS · mosaic date {frame?.date||'not available'} · maturity / CRID not available at pixel level · downsampled</p><a className="button" href={'#sites/'+selected.id+(frame?'?date='+frame.date:'')}>Open in Sites</a><button className="text-link" onClick={()=>setCropRetry(n=>n+1)}>Retry crop</button></>:<><h2>Follow a place</h2><p>Choose a marker or a study area. Its crop uses the current date, and Sites keeps that date.</p><button className="text-link" onClick={()=>document.getElementById('open-search')?.click()}>Search places and sites</button></>}
 </aside></div>
 <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
 </div>;
}
