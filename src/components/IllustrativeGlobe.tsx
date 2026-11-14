import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {News,Site} from '../types';
import {hosted} from '../api/client';
import {REVIEW_DATE} from '../config.js';
import {validDay} from '../selection-url.js';
import {illustrationDefaults,illustrationLegends,phaseLabel} from '../illustrative-globe.js';
import type {IllustrationLayer} from '../illustrative-globe.js';
import {setIllustration,setIllustrativeTexture,focusIllustrativePlace,flyTo} from '../world.js';
import {initLocalWindow} from '../local-window.js';
import '../illustrative-globe.css';

interface Location {name:string;lat:number;lng:number;id?:string;site?:boolean;user?:boolean;value?:number|null;category?:string;date?:string;description?:string;question?:string}
export default function IllustrativeGlobe({active,ready,sites,news,newsNotice,navigationKey,selectedSiteId}:{active:boolean;ready:boolean;sites:Site[];news?:News;newsNotice:ReactNode;navigationKey:number;selectedSiteId?:string}){
 const [state,setState]=useState({...illustrationDefaults}),[playing,setPlaying]=useState(false),[tab,setTab]=useState<'place'|'events'|'tour'>('place'),[tour,setTour]=useState(0);
 const [selected,setSelected]=useState<Location|null>(null),[rendering,setRendering]=useState(false);
 const [imageDate,setImageDate]=useState(REVIEW_DATE),[image,setImage]=useState<{image:HTMLImageElement;date:string}|null>(null),[imageStatus,setImageStatus]=useState(''),[loading,setLoading]=useState(false);
 const controller=useRef<AbortController|null>(null),imageURL=useRef('');
 useEffect(()=>{setIllustration(state);},[state]);
 useEffect(()=>{
  const select=(event:Event)=>{setSelected((event as CustomEvent<Location>).detail);setTab('place');};
  const visibility=()=>setRendering(document.getElementById('globe-stage')?.dataset.rendering==='active');
  addEventListener('globe:illustrative-select',select);addEventListener('globe:rendering',visibility);visibility();
  return()=>{removeEventListener('globe:illustrative-select',select);removeEventListener('globe:rendering',visibility);};
 },[ready]);
 useEffect(()=>{if(!active||!rendering)setPlaying(false);},[active,rendering]);
 useEffect(()=>setPlaying(false),[navigationKey]);
 useEffect(()=>{if(active&&ready&&selectedSiteId&&selected?.id!==selectedSiteId){const site=sites.find(s=>s.id===selectedSiteId);if(site)choose(site);}},[active,ready,selectedSiteId,sites]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),stop=()=>setPlaying(false);
  media.addEventListener('change',stop);return()=>media.removeEventListener('change',stop);
 },[]);
 useEffect(()=>{
  if(!active||!rendering||!playing)return;
  let frame=0,last=performance.now();
  const tick=(now:number)=>{const elapsed=now-last;if(elapsed>=90){last=now;setState(previous=>({...previous,phase:Math.min(100,previous.phase+Math.min(elapsed,250)/150)}));}frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,active,rendering]);
 useEffect(()=>{if(state.phase>=100)setPlaying(false);},[state.phase]);
 useEffect(()=>{setIllustrativeTexture(active?image?.image||null:null,image?.date||'');},[active,image,ready]);
 useEffect(()=>{if(!active){controller.current?.abort();setLoading(false);}},[active]);
 useEffect(()=>()=>{controller.current?.abort();if(imageURL.current)URL.revokeObjectURL(imageURL.current);setIllustrativeTexture(null,'');},[]);
 const seek=(phase:number)=>{setPlaying(false);setState(previous=>({...previous,phase}));};
 function toggle(){if(!playing&&state.phase>=100)setState(previous=>({...previous,phase:0}));setPlaying(value=>!value);}
 function choose(site:Site){focusIllustrativePlace({...site,site:true,lng:site.coordinates[0],lat:site.coordinates[1]});}
 const steps=[{name:'The ocean connects the story',description:'Begin over the equatorial Pacific. Moving links illustrate a climate relationship, not measured winds or flows of heat.',coordinates:[-145,0],id:''},...sites.map(site=>({...site,description:site.question+' '+site.hypothesis}))];
 function goTour(index:number){const next=(index+steps.length)%steps.length,step=steps[next];setTour(next);if(step.id){const site=sites.find(s=>s.id===step.id);if(site)choose(site);}else flyTo(step.coordinates[0],step.coordinates[1],2.4,850);setTab('tour');}
 async function loadImagery(){
  if(!hosted||!validDay(imageDate)||imageDate>REVIEW_DATE)return;
  controller.current?.abort();const request=new AbortController();controller.current=request;setLoading(true);setImageStatus('Loading dated MODIS imagery…');
  const timer=setTimeout(()=>request.abort(),12000);let url='';
  try{
   const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:'MODIS_Terra_CorrectedReflectance_TrueColor',STYLES:'',FORMAT:'image/jpeg',SRS:'EPSG:4326',BBOX:'-180,-90,180,90',WIDTH:'2048',HEIGHT:'1024',TIME:imageDate});
   const response=await fetch('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?'+params,{signal:request.signal});
   if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Image unavailable');
   url=URL.createObjectURL(await response.blob());const decoded=new Image();decoded.src=url;await decoded.decode();
   if(request.signal.aborted||controller.current!==request)return;
   if(imageURL.current)URL.revokeObjectURL(imageURL.current);imageURL.current=url;url='';setImage({image:decoded,date:imageDate});setImageStatus('NASA GIBS / MODIS true color · '+imageDate+'. Clouds and missing swaths can obscure land.');
  }catch{if(controller.current===request)setImageStatus('Imagery unavailable. The concept globe remains usable; choose another date or retry.');}
  finally{clearTimeout(timer);if(url)URL.revokeObjectURL(url);if(controller.current===request)setLoading(false);}
 }
 const legend=illustrationLegends[state.layer];
 return <aside className="illustrative-panel" hidden={!active} aria-label="Concept globe controls" data-phase={state.phase.toFixed(1)} data-playing={playing}>
  <p className="eyebrow">The original concept globe</p><h2>One ocean. Different stories.</h2>
  <p className="illustrative-note">Explore an illustrative El Niño progression. Colors, towers, rings and links show a concept, not measured temperature, rainfall or local risk.</p>
  <div className="illustrative-layers" role="group" aria-label="Concept layers">{(['heat','rain','stress','geography'] as IllustrationLayer[]).map((layer,i)=><button key={layer} data-illustrative-layer={layer} aria-pressed={state.layer===layer} onClick={()=>setState(previous=>({...previous,layer}))}>{['Heat','Rain','Combined','Places'][i]}</button>)}</div>
  <div className="illustrative-legend"><strong>{legend[0]}</strong><div style={{background:legend[3]}}/><p><span>{legend[1]}</span><span>{legend[2]}</span></p></div>
  <div className="illustrative-playback">
   <label htmlFor="illustrative-phase">Conceptual progression <output>{phaseLabel(state.phase)}</output></label>
   <input id="illustrative-phase" type="range" min="0" max="100" step="1" value={Math.round(state.phase)} aria-valuetext={Math.round(state.phase)+'% — '+phaseLabel(state.phase)} onChange={event=>seek(Number(event.target.value))}/>
   <div className="illustrative-phases">{[0,30,65,100].map(phase=><button key={phase} onClick={()=>seek(phase)}>{phaseLabel(phase)}</button>)}</div>
   <button id="illustrative-play" disabled={!ready||!rendering} aria-pressed={playing} onClick={toggle}>{playing?'Pause progression':'Play progression'}</button>
  </div>
  <div className="illustrative-toggles" role="group" aria-label="Concept overlays">{(['links','towers','labels','userData'] as const).map((key,i)=><button key={key} aria-pressed={state[key]} onClick={()=>setState(previous=>({...previous,[key]:!previous[key]}))}>{['Pacific links','Site towers','Labels','My data'][i]}</button>)}</div>
  <div className="illustrative-tabs" role="tablist" aria-label="Explore the concept globe">{(['place','events','tour'] as const).map((value,i)=><button key={value} role="tab" id={'illustrative-tab-'+value} aria-controls="illustrative-details" aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={()=>value==='tour'?goTour(tour):setTab(value)} onKeyDown={event=>{const values=['place','events','tour'] as const;let next=i;if(event.key==='ArrowRight')next=(i+1)%3;else if(event.key==='ArrowLeft')next=(i+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();setTab(values[next]);document.getElementById('illustrative-tab-'+values[next])?.focus();}}>{['Place','News','Guided tour'][i]}</button>)}</div>
  <div id="illustrative-details" role="tabpanel" aria-labelledby={'illustrative-tab-'+tab} tabIndex={0}>
   {tab==='place'&&<>{selected?<><h3>{selected.name}</h3><p className="mono">{selected.lat.toFixed(3)}°, {selected.lng.toFixed(3)}°</p>{selected.user?<p>Your observation: {selected.value??'No numeric value'} {selected.category} · {selected.date||'Undated'}. User supplied, not independently verified.</p>:<p>{selected.description||'A geographic locator. No local measurement is inferred from the concept colors.'}</p>}{selected.question&&<p>{selected.question}</p>}{selected.site&&<a className="button" href={'#sites/'+selected.id}>Open radar observations</a>} <button onClick={()=>{initLocalWindow();dispatchEvent(new CustomEvent('globe:open-local',{detail:{...selected,siteId:selected.site?selected.id:undefined}}));}}>Open satellite window</button></>:<p>Drag the globe, select a country or tower, or search for a place. Choose a study area to explore its evidence.</p>}<div className="illustrative-sites">{sites.map(site=><button key={site.id} aria-pressed={selected?.id===site.id} onClick={()=>choose(site)}>{site.name}<small>{site.country} · {site.type}</small></button>)}</div></>}
   {tab==='events'&&<>{newsNotice}<p>Source-linked reporting; headlines are separate from the illustrative climate layers.</p>{news?.items.filter(item=>item.url.startsWith('https:')).slice(0,8).map(item=><a className="illustrative-news" key={item.id} href={item.url} target="_blank" rel="noopener"><small>{item.date} · {item.source}</small>{item.title}</a>)}</>}
   {tab==='tour'&&<><p className="eyebrow">Step {tour+1} of {steps.length}</p><h3>{steps[tour].name}</h3><p>{steps[tour].description}</p><div className="illustrative-tour-actions"><button onClick={()=>goTour(tour-1)}>← Back</button><button onClick={()=>goTour(tour+1)}>Next →</button></div>{steps[tour].id&&<a className="button" href={'#sites/'+steps[tour].id}>Open radar observations</a>}</>}
  </div>
  <details className="illustrative-imagery"><summary>Optional satellite imagery</summary><p>Overlay the illustration on a dated NASA MODIS image. The imagery date does not change the conceptual progression.</p><label htmlFor="illustrative-image-date">MODIS image date</label><input id="illustrative-image-date" type="date" min="2000-02-24" max={REVIEW_DATE} value={imageDate} disabled={!hosted||loading} onChange={event=>setImageDate(event.target.value)}/><button disabled={!hosted||loading||!validDay(imageDate)||imageDate>REVIEW_DATE} onClick={()=>void loadImagery()}>{loading?'Loading image…':'Load satellite imagery'}</button>{image&&<button onClick={()=>{controller.current?.abort();setLoading(false);setImage(null);setImageStatus('Satellite imagery hidden.');}}>Hide satellite imagery</button>}<p role="status">{hosted?imageStatus:'Dated online imagery needs the hosted app. Concept layers and animations work offline.'}</p>{image&&<p>Displayed optical image: {image.date}. Concept colors remain illustrative.</p>}</details>
 </aside>;
}
