import type {HistoryMode} from '../selection-url.js';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {assetURL,safeURL} from '../core.js';
import {hosted} from '../api/client';
import {radarUnavailable} from '../radar-data.js';
import type {RadarRecord} from '../radar-data.js';
import {FigureCaption} from './FigureCaption';
import '../site-timeline.css';

const decodedFrameCache = new Map<string, string>();

export interface SiteTimelineFrame {
 date:string;image?:string;url?:string;status?:string;reason?:string;maturity?:string;parameters?:{BBOX?:string};
}
export function SiteTimeline({siteName,frames,index,onIndexChange,active,scenes,navigationKey}:{
 siteName:string;frames:SiteTimelineFrame[];index:number;onIndexChange:(index:number,history?:HistoryMode)=>void;active:boolean;navigationKey:number;scenes?:RadarRecord[];
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
   <div>
    <p className="eyebrow" data-testid="running-observations-line">57 real observations across 4 places · Dated NISAR sequence</p>
    <h3>Watch change through time</h3>
    <p>Real NISAR radar images of the same place. These colors are radar returns, not natural-color photography.</p>
   </div>
   <div className="site-time-meta-badge">
    <strong className="site-time-date" aria-live={playing?'off':'polite'}>{frame?.date||'No date available'}</strong>
    <span className="frame-counter-badge" data-testid="frame-counter">Frame {stepPosition} of {totalSteps}</span>
    <span className="maturity-badge" data-testid="frame-maturity">Maturity: {maturityLabel}</span>
   </div>
  </div>
  <div className="frame-progress-track" role="progressbar" aria-label="Playback frame progress" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={stepPosition}>
   <div className="frame-progress-fill" style={{width:`${progressPct}%`}}/>
  </div>
  <div className="radar-stage site-time-stage" aria-busy={status==='loading'}>
   {shown?<img src={shown.url} alt={'NISAR false-color radar image of '+siteName+', mosaic date '+frame?.date+'; saved NASA GIBS image, not calibrated'} data-image-date={frame?.date}/>:<div className="site-time-placeholder" role={playing?undefined:'status'}><strong>{status==='loading'?'Loading this date...':status==='error'?'This image could not load':status==='offline'?'This date is not included offline':absent.title}</strong><span>{frame?.date}</span><p>{status==='loading'?'The previous image is cleared while this one loads.':status==='offline'?'Choose a marked available image or open the hosted edition.':status==='error'?'Your date is preserved. Retry to load the same image.':absent.description}</p>{status==='error'&&<button onClick={()=>setRetry(n=>n+1)}>Retry image</button>}</div>}
  </div>
  <div className="site-time-readout"><span>{days===null?'No earlier step in this sequence':days+' days since the previous '+(availableOnly?'available image':'sampled date')}</span><span>Checkered areas: no displayed radar coverage</span></div>
  <div className="site-time-controls">
   <button aria-label="Previous radar image" disabled={previous===undefined} onClick={()=>previous!==undefined&&seek(previous)}>&#8592; Previous</button>
   <button id="site-play" className={reducedMotion?'primary prominent-play':'primary'} aria-pressed={playing} onClick={play} disabled={!steps.length||status==='error'}>{playing?'Pause':'Play'}</button>
   <button aria-label="Next radar image" disabled={next===undefined} onClick={()=>next!==undefined&&seek(next)}>Next &#8594;</button>
   <label>Speed<select aria-label="Site playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4].map(v=><option key={v} value={v}>{v}x</option>)}</select></label>
   <label><input type="checkbox" checked={availableOnly} onChange={e=>{setUserInteracted(true);setPlaying(false);setAvailableOnly(e.target.checked);}}/>Available images only</label>
   <label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>Loop</label>
  </div>
  <label className="timeline-control" htmlFor="site-date-slider">Choose a sampled date <output>{frame?.date||'Unavailable'}</output><input id="site-date-slider" type="range" min="0" max={Math.max(0,frames.length-1)} value={index} disabled={!frames.length} aria-valuetext={(frame?.date||'No date')+' / '+status} onChange={e=>seek(Number(e.target.value),'replace')}/></label>
  <label className="site-date-list">All sampled dates<select aria-label="All sampled radar dates" value={index} disabled={!frames.length} onChange={e=>seek(Number(e.target.value))}>{frames.map((f,i)=><option key={f.date} value={i}>{f.date} / {usable(f)?'available image':'no saved image'}</option>)}</select></label>
  <div className="acquisition-strip site-time-dates" aria-label="Sampled image dates">{frames.map((f,i)=><button key={f.date} className={usable(f)?'has-data':'no-data'} aria-pressed={index===i} title={f.date+(usable(f)?' / available':' / unavailable')} aria-label={'Select '+f.date+(usable(f)?', available image':', no image available')} onClick={()=>seek(i)}><span aria-hidden="true">{f.date.slice(5)}</span></button>)}</div>
  <div className="site-time-readout"><span>{frames[0]?.date}</span><span>{frames.at(-1)?.date}</span></div>
  <FigureCaption
   whatWhere={<>NISAR L-band false-color radar preview over <strong>{siteName}</strong> (fixed geographic bounding box).</>}
   dateSource={<>Mosaic date <strong>{frame?.date||'unavailable'}</strong> · Source: NASA / ISRO NISAR via NASA GIBS ({available.length} saved frames{!hosted?' in this offline edition':''}). {frame?.url&&<a href={safeURL(frame.url)} target="_blank" rel="noopener">Open this date at NASA</a>}</>}
   howToRead="Smooth open water reflects microwave pulses away from the satellite and appears dark. Rough soil, vegetation canopies, and buildings scatter energy back and appear bright green or magenta. Checkered areas have no radar coverage on that date."
   limitations="Browse previews are not photographs or calibrated water-level gauges. Changing colors alone do not prove reservoir volume, crop damage, land motion, or El Niño causation."
  />
  <p className="source-line">{availableOnly?'Playback steps through available images; gaps remain marked in gray.':'Playback includes unavailable sampled dates as gap cards.'} {available.length} images available{!hosted?' in this offline edition':''}. Steps are observations, not equal intervals of time.</p>
  <p className="site-time-caution">Changing colors alone do not prove a change in water level, land motion, or crop health. Radar viewing geometry and processing can also change the appearance.</p>
  <details className="reading-notes"><summary>Playback and gaps</summary><p>Frames change directly, with no invented motion or blended intermediate images. Playback waits for each image and pauses if you hover, touch, focus, or press a key. Play at the end restarts the sequence.</p><p>These are sampled daily mosaics, not a complete acquisition record. The mission acquisition gap lasted from 27 July 2026, 22:03 UTC to 10 August 2026, 00:55 UTC. Boundary days can have partial coverage. Unavailable images also occur outside that gap.</p><p>Focus this player for Space to play or pause, arrow keys to step, and Home or End to reach the first or last step. Leaving the page, hiding the browser tab, or changing reduced-motion preferences pauses playback.</p></details>
 </section>;
}
