import type {HistoryMode} from '../selection-url.js';
import {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {assetURL,safeURL} from '../core.js';
import {hosted} from '../api/client';
import {radarUnavailable} from '../radar-data.js';
import type {RadarRecord} from '../radar-data.js';
import '../site-timeline.css';

export interface SiteTimelineFrame {
 date:string;image?:string;url?:string;status?:string;reason?:string;parameters?:{BBOX?:string};
}
export function SiteTimeline({siteName,frames,index,onIndexChange,active,scenes,navigationKey}:{
 siteName:string;frames:SiteTimelineFrame[];index:number;onIndexChange:(index:number,history?:HistoryMode)=>void;active:boolean;navigationKey:number;scenes?:RadarRecord[];
}){
 const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[availableOnly,setAvailableOnly]=useState(true),[retry,setRetry]=useState(0);
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
 useLayoutEffect(()=>{
  let current=true,timer:ReturnType<typeof setTimeout>|undefined;
  setLoaded(null);
  if(!frame||!frame.image){setLoad({key,status:'missing'});return;}
  if(!hosted&&!url.startsWith('data:')){setLoad({key,status:'offline'});return;}
  setLoad({key,status:'loading'});if(!active)return;
  const image=new Image();image.src=url;
  void Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timed out')),10000);})])
   .then(()=>{if(current){setLoaded({key,url});setLoad({key,status:'ready'});}})
   .catch(()=>{if(current){setLoad({key,status:'error'});setPlaying(false);}})
   .finally(()=>clearTimeout(timer));
  return()=>{current=false;clearTimeout(timer);image.removeAttribute('src');};
 },[key,frame,active,retry,url]);
 useEffect(()=>{if(!active)setPlaying(false);},[active]);
 useEffect(()=>setPlaying(false),[navigationKey]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const pause=()=>setPlaying(false),visibility=()=>{if(document.hidden)pause();};
  media.addEventListener('change',pause);document.addEventListener('visibilitychange',visibility);
  return()=>{media.removeEventListener('change',pause);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{
  if(!playing||!active||status==='loading'||status==='error')return;
  if(next===undefined){setPlaying(false);return;}
  const timer=setTimeout(()=>onIndexChange(next,'replace'),1800/speed);
  return()=>clearTimeout(timer);
 },[playing,active,status,next,index,speed,onIndexChange]);
 function seek(i:number,history:HistoryMode='push'){setPlaying(false);onIndexChange(Math.max(0,Math.min(frames.length-1,i)),history);}
 function play(){
  if(playing){setPlaying(false);return;}
  if(!steps.length)return;
  if(next===undefined)onIndexChange(steps[0]);
  else if(!steps.includes(index))onIndexChange(next);
  setPlaying(true);
 }
 function keyboard(e:KeyboardEvent<HTMLElement>){
  if((e.target as HTMLElement).closest('button,input,select,a,summary'))return;
  if(e.key===' '){e.preventDefault();play();}
  if(e.key==='ArrowLeft'&&previous!==undefined){e.preventDefault();seek(previous);}
  if(e.key==='ArrowRight'&&next!==undefined){e.preventDefault();seek(next);}
  if(e.key==='Home'&&steps.length){e.preventDefault();seek(steps[0]);}
  if(e.key==='End'&&steps.length){e.preventDefault();seek(steps[steps.length-1]);}
 }
 return <section className="site-timeline" aria-label={'Dated radar image player for '+siteName} tabIndex={0} onKeyDown={keyboard} data-frame-date={frame?.date||''} data-frame-status={status} data-frame-bounds={frame?.parameters?.BBOX||''} data-playing={playing}>
  <div className="site-time-heading"><div><h3>Watch change through time</h3><p>Real NISAR radar images of the same place. These colors are radar returns, not natural-color photography.</p></div><strong className="site-time-date" aria-live={playing?'off':'polite'}>{frame?.date||'No date available'}</strong></div>
  <div className="radar-stage site-time-stage" aria-busy={status==='loading'}>
   {shown?<img src={shown.url} alt={'NISAR false-color radar image of '+siteName+', mosaic date '+frame?.date+'; saved NASA GIBS image, not calibrated'} data-image-date={frame?.date}/>:<div className="site-time-placeholder" role={playing?undefined:'status'}><strong>{status==='loading'?'Loading this date...':status==='error'?'This image could not load':status==='offline'?'This date is not included offline':absent.title}</strong><span>{frame?.date}</span><p>{status==='loading'?'The previous image is cleared while this one loads.':status==='offline'?'Choose a marked available image or open the hosted edition.':status==='error'?'Your date is preserved. Retry to load the same image.':absent.description}</p>{status==='error'&&<button onClick={()=>setRetry(n=>n+1)}>Retry image</button>}</div>}
  </div>
  <div className="site-time-readout"><span>{days===null?'No earlier step in this sequence':days+' days since the previous '+(availableOnly?'available image':'sampled date')}</span><span>Checkered areas: no displayed radar coverage</span></div>
  <div className="site-time-controls">
   <button aria-label="Previous radar image" disabled={previous===undefined} onClick={()=>previous!==undefined&&seek(previous)}>&#8592; Previous</button>
   <button id="site-play" className="primary" aria-pressed={playing} onClick={play} disabled={!steps.length||status==='error'}>{playing?'Pause':'Play'}</button>
   <button aria-label="Next radar image" disabled={next===undefined} onClick={()=>next!==undefined&&seek(next)}>Next &#8594;</button>
   <label>Speed<select aria-label="Site playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4].map(v=><option key={v} value={v}>{v}x</option>)}</select></label>
   <label><input type="checkbox" checked={availableOnly} onChange={e=>{setPlaying(false);setAvailableOnly(e.target.checked);}}/>Available images only</label>
  </div>
  <label className="timeline-control" htmlFor="site-date-slider">Choose a sampled date <output>{frame?.date||'Unavailable'}</output><input id="site-date-slider" type="range" min="0" max={Math.max(0,frames.length-1)} value={index} disabled={!frames.length} aria-valuetext={(frame?.date||'No date')+' / '+status} onChange={e=>seek(Number(e.target.value),'replace')}/></label>
  <div className="acquisition-strip site-time-dates" aria-label="Sampled image dates">{frames.map((f,i)=><button key={f.date} className={usable(f)?'has-data':'no-data'} aria-pressed={index===i} title={f.date+(usable(f)?' / available':' / unavailable')} aria-label={'Select '+f.date+(usable(f)?', available image':', no image available')} onClick={()=>seek(i)}/>)}</div>
  <div className="site-time-readout"><span>{frames[0]?.date}</span><span>{frames.at(-1)?.date}</span></div>
  <p className="source-line">{availableOnly?'Playback steps through available images; gaps remain marked in gray.':'Playback includes unavailable sampled dates as gap cards.'} {available.length} images available{!hosted?' in this offline edition':''}. Steps are observations, not equal intervals of time.</p>
  <p className="source-line">Source: NASA / ISRO NISAR via NASA GIBS{frame&&' / mosaic date '+frame.date}. {frame?.url&&<a href={safeURL(frame.url)} target="_blank" rel="noopener">Open this date at NASA</a>} The same map bounds and image size are kept throughout.</p>
  <p className="site-time-caution">Changing colors alone do not prove a change in water level, land motion, or crop health. Radar viewing geometry and processing can also change the appearance.</p>
  <details className="reading-notes"><summary>Playback and gaps</summary><p>Frames change directly, with no invented motion or blended intermediate images. Playback waits for each image, starts only when you press Play, and stops at the last date. Play at the end restarts the sequence. Pause or use Previous and Next to inspect a frame.</p><p>These are sampled daily mosaics, not a complete acquisition record. The mission acquisition gap lasted from 27 July 2026, 22:03 UTC to 10 August 2026, 00:55 UTC. Boundary days can have partial coverage. Unavailable images also occur outside that gap.</p><p>Focus this player for Space to play or pause, arrow keys to step, and Home or End to reach the first or last step. Leaving the page, hiding the browser tab, or changing reduced-motion preferences pauses playback.</p></details>
 </section>;
}
