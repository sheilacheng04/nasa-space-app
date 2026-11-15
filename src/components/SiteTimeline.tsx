import type {HistoryMode} from '../selection-url.js';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {assetURL,safeURL} from '../core.js';
import {hosted} from '../api/client';
import {radarUnavailable} from '../radar-data.js';
import type {RadarRecord} from '../radar-data.js';
import type {Site} from '../types';
import '../site-timeline.css';

const decodedFrameCache = new Map<string, string>();

export interface SiteTimelineFrame {
 date:string;image?:string;url?:string;status?:string;reason?:string;maturity?:string;parameters?:{BBOX?:string};
}
export function SiteTimeline({site,siteName,frames,index,onIndexChange,active,scenes,navigationKey}:{
 site:Pick<Site,'hypothesis'|'evidence'|'humanDrivers'>;siteName:string;frames:SiteTimelineFrame[];index:number;onIndexChange:(index:number,history?:HistoryMode)=>void;active:boolean;navigationKey:number;scenes?:RadarRecord[];
}){
 const sectionRef=useRef<HTMLElement>(null);
 const [reducedMotion,setReducedMotion]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[availableOnly,setAvailableOnly]=useState(true),[retry,setRetry]=useState(0);
 const [loop,setLoop]=useState(()=>!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches));
 const [userInteracted,setUserInteracted]=useState(false);
 const [loaded,setLoaded]=useState<{key:string;url:string}|null>(null),[load,setLoad]=useState<{key:string;status:string}>({key:'',status:'loading'});
 const frame=frames[index],url=assetURL(frame?.image),key=(frame?.date||'')+'|'+url;
 const usable=(f:SiteTimelineFrame)=>Boolean(f.image&&(hosted||assetURL(f.image).startsWith('data:')));
 const available=useMemo(()=>frames.map((f,i)=>usable(f)?i:-1).filter(i=>i>=0),[frames]);
 const steps=availableOnly?available:frames.map((_,i)=>i);
 const status=load.key===key?load.status:'loading';
 const shown=loaded?.key===key?loaded:null;
 const absent=radarUnavailable(frame,scenes);
 const previous=steps.filter(i=>i<index).at(-1),next=steps.find(i=>i>index);
 const days=previous===undefined||!frame?null:Math.round((Date.parse(frame.date)-Date.parse(frames[previous].date))/86400000);
 const stepPosition=Math.max(1,steps.indexOf(index)+1);
 const totalSteps=Math.max(1,steps.length);
 const progressPct=totalSteps>1?Math.round(((stepPosition-1)/(totalSteps-1))*100):100;
 const maturityLabel=frame?.maturity||(frame?.date&&frame.date>='2026-06-17'?'Provisional':'Beta / Provisional');

 useLayoutEffect(()=>{
  let current=true,timer:ReturnType<typeof setTimeout>|undefined;
  setLoaded(null);
  if(!frame||!frame.image){setLoad({key,status:'missing'});return;}
  if(!hosted&&!url.startsWith('data:')){setLoad({key,status:'offline'});return;}
  if(decodedFrameCache.has(key)&&retry===0){
   setLoaded({key,url:decodedFrameCache.get(key)!});
   setLoad({key,status:'ready'});
   return;
  }
  setLoad({key,status:'loading'});if(!active)return;
  const image=new Image();image.src=url;
  void Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timed out')),10000);})])
   .then(()=>{if(current){decodedFrameCache.set(key,url);setLoaded({key,url});setLoad({key,status:'ready'});}})
   .catch(()=>{if(current){setLoad({key,status:'error'});setPlaying(false);}})
   .finally(()=>clearTimeout(timer));
  return()=>{current=false;clearTimeout(timer);image.removeAttribute('src');};
 },[key,frame,active,retry,url]);

 // Prefetch the next 2 available frames without blocking the current frame
 useEffect(()=>{
  if(!active||status!=='ready')return;
  const upcoming=steps.filter(i=>i>index).slice(0,2);
  for(const idx of upcoming){
   const f=frames[idx];
   if(!f?.image)continue;
   const u=assetURL(f.image);
   const k=(f.date||'')+'|'+u;
   if(decodedFrameCache.has(k)||(!hosted&&!u.startsWith('data:')))continue;
   const preload=new Image();
   preload.src=u;
   void preload.decode().then(()=>{decodedFrameCache.set(k,u);}).catch(()=>{});
  }
 },[active,status,index,steps,frames]);

 useEffect(()=>{if(!active)setPlaying(false);},[active]);
 useEffect(()=>setPlaying(false),[navigationKey]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const onMedia=()=>{setReducedMotion(media.matches);if(media.matches){setPlaying(false);setLoop(false);}};
  const visibility=()=>{if(document.hidden)setPlaying(false);};
  media.addEventListener('change',onMedia);document.addEventListener('visibilitychange',visibility);
  return()=>{media.removeEventListener('change',onMedia);document.removeEventListener('visibilitychange',visibility);};
 },[]);

 // Autoplay when >= 50% visible if prefers-reduced-motion is false and visitor hasn't manually paused/interacted
 useEffect(()=>{
  const node=sectionRef.current;
  if(!node||!active||reducedMotion||userInteracted||!steps.length)return;
  if(typeof IntersectionObserver==='undefined')return;
  const io=new IntersectionObserver((entries)=>{
   const entry=entries[0];
   if(!entry)return;
   if(entry.isIntersecting&&entry.intersectionRatio>=0.5){
    setPlaying(true);
   }else if(!entry.isIntersecting){
    setPlaying(false);
   }
  },{threshold:[0,0.5]});
  io.observe(node);
  return()=>io.disconnect();
 },[active,reducedMotion,userInteracted,steps.length]);

 useEffect(()=>{
  if(!playing||!active||status==='loading'||status==='error')return;
  if(next===undefined){
   if(loop&&!reducedMotion&&steps.length>1){
    const loopTimer=setTimeout(()=>onIndexChange(steps[0],'replace'),2200/speed);
    return()=>clearTimeout(loopTimer);
   }
   setPlaying(false);
   return;
  }
  const timer=setTimeout(()=>onIndexChange(next,'replace'),1800/speed);
  return()=>clearTimeout(timer);
 },[playing,active,status,next,index,speed,loop,reducedMotion,steps,onIndexChange]);

 function pauseOnUserInteraction(){
  if(playing){
   setUserInteracted(true);
   setPlaying(false);
  }
 }
 function seek(i:number,history:HistoryMode='push'){setUserInteracted(true);setPlaying(false);onIndexChange(Math.max(0,Math.min(frames.length-1,i)),history);}
 function play(){
  setUserInteracted(true);
  if(playing){setPlaying(false);return;}
  if(!steps.length)return;
  if(next===undefined)onIndexChange(steps[0],'replace');
  else if(!steps.includes(index))onIndexChange(next,'replace');
  setPlaying(true);
 }
 function keyboard(e:KeyboardEvent<HTMLElement>){
  if((e.target as HTMLElement).closest('button,input,select,a,summary'))return;
  if(e.key===' '){e.preventDefault();play();return;}
  if(e.key==='ArrowLeft'&&previous!==undefined){e.preventDefault();seek(previous);return;}
  if(e.key==='ArrowRight'&&next!==undefined){e.preventDefault();seek(next);return;}
  if(e.key==='Home'&&steps.length){e.preventDefault();seek(steps[0]);return;}
  if(e.key==='End'&&steps.length){e.preventDefault();seek(steps[steps.length-1]);return;}
  pauseOnUserInteraction();
 }
 return <section ref={sectionRef} className="site-timeline" aria-label={'Dated radar image player for '+siteName} tabIndex={0} onKeyDown={keyboard} onMouseEnter={()=>{if(!reducedMotion&&playing&&!userInteracted)pauseOnUserInteraction();}} onTouchStart={()=>{if(playing&&!userInteracted)pauseOnUserInteraction();}} data-frame-date={frame?.date||''} data-frame-status={status} data-frame-bounds={frame?.parameters?.BBOX||''} data-playing={playing}>
  <div className="site-time-heading">
   <div className="site-time-meta-badge">
    <strong className="site-time-date" aria-live={playing?'off':'polite'}>{frame?.date||'No date available'}</strong>
    <span className="frame-counter-badge" data-testid="frame-counter">Frame {stepPosition} of {totalSteps}</span>
   </div>
  </div>
  <div className="frame-progress-track" role="progressbar" aria-label="Playback frame progress" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={stepPosition}>
   <div className="frame-progress-fill" style={{width:`${progressPct}%`}}/>
  </div>
  <div className="site-playback-bar" role="group" aria-label="Radar playback">
   <button aria-label="Previous radar image" disabled={previous===undefined} onClick={()=>previous!==undefined&&seek(previous)}>&#8592; Previous</button>
   <button id="site-play" className="primary prominent-play" aria-pressed={playing} onClick={play} disabled={!steps.length||status==='error'}>{playing?'Pause':'Play'}</button>
   <button aria-label="Next radar image" disabled={next===undefined} onClick={()=>next!==undefined&&seek(next)}>Next &#8594;</button>
  </div>
  <div className="radar-stage site-time-stage" aria-busy={status==='loading'}>
   {shown?<img src={shown.url} alt={'NISAR false-color radar image of '+siteName+', mosaic date '+frame?.date+'; saved NASA GIBS image, not calibrated'} data-image-date={frame?.date}/>:<div className="site-time-placeholder" role={playing?undefined:'status'}><strong>{status==='loading'?'Loading this date...':status==='error'?'This image could not load':status==='offline'?'This date is not included offline':absent.title}</strong><span>{frame?.date}</span><p>{status==='loading'?'The previous image is cleared while this one loads.':status==='offline'?'Choose a marked available image or open the hosted edition.':status==='error'?'Your date is preserved. Retry to load the same image.':absent.description}</p>{status==='error'&&<button onClick={()=>setRetry(n=>n+1)}>Retry image</button>}</div>}
  </div>
  <div className="site-time-readout"><span>{days===null?'No earlier step in this sequence':days+' days since the previous '+(availableOnly?'available image':'sampled date')}</span><span>Checkered areas: no displayed radar coverage</span></div>
  <aside className="site-progression-interpretation" aria-label={'How to interpret the '+siteName+' progression'}>
   <p className="eyebrow">Interpret the progression</p>
   <h3>What could explain this change?</h3>
   <p>{site.hypothesis}</p>
   <p><strong>Check against:</strong> {site.evidence}</p>
   <p><strong>Other drivers:</strong> {site.humanDrivers}</p>
  </aside>
  <label className="timeline-control" htmlFor="site-date-slider">Choose a sampled date <output>{frame?.date||'Unavailable'}</output><input id="site-date-slider" type="range" min="0" max={Math.max(0,frames.length-1)} value={index} disabled={!frames.length} aria-valuetext={(frame?.date||'No date')+' / '+status} onChange={e=>seek(Number(e.target.value),'replace')}/></label>
  <details className="site-playback-options"><summary>Playback options and all dates</summary>
  <div className="site-time-controls">
   <label>Speed<select aria-label="Site playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4].map(v=><option key={v} value={v}>{v}x</option>)}</select></label>
   <label><input type="checkbox" checked={availableOnly} onChange={e=>{setUserInteracted(true);setPlaying(false);setAvailableOnly(e.target.checked);}}/>Available images only</label>
   <label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>Loop</label>
  </div>
  <label className="site-date-list">All sampled dates<select aria-label="All sampled radar dates" value={index} disabled={!frames.length} onChange={e=>seek(Number(e.target.value))}>{frames.map((f,i)=><option key={f.date} value={i}>{f.date} / {usable(f)?'available image':'no saved image'}</option>)}</select></label>
  <div className="acquisition-strip site-time-dates" aria-label="Sampled image dates">{frames.map((f,i)=><button key={f.date} className={usable(f)?'has-data':'no-data'} aria-pressed={index===i} title={f.date+(usable(f)?' / available':' / unavailable')} aria-label={'Select '+f.date+(usable(f)?', available image':', no image available')} onClick={()=>seek(i)}><span aria-hidden="true">{f.date.slice(5)}</span></button>)}</div>
  <div className="site-time-readout"><span>{frames[0]?.date}</span><span>{frames.at(-1)?.date}</span></div>
  </details>
  <details className="reading-notes"><summary>Playback help</summary><p>Space plays or pauses. Arrow keys move between dates. Playback waits for each image; leaving the page pauses it.</p><p>Available images only skips unsaved dates during playback. Turn it off to include those gaps. Steps are observations, not equal intervals of time.</p>{frame?.url&&<p className="source-line"><a href={safeURL(frame.url)} target="_blank" rel="noopener">Open this date at NASA</a></p>}</details>
 </section>;
}
