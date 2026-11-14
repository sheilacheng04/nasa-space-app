import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {hosted} from '../api/client';
import {globeFile} from '../globe-data';
import {assetURL} from '../core.js';
import {setConceptTexture} from '../world.js';

type VegetationFrame={date:string;label:string;status:string;url:string|null;sourceUrl:string};
type VegetationManifest={layerId:string;title:string;legend:{url:string;pngUrl?:string;sourceUrl:string;colormapUrl:string};frames:VegetationFrame[]};
export default function ConceptVegetation({active,month,onStatus,playing=false}:{active:boolean;month:string;playing?:boolean;onStatus:(status:string)=>void}){
 const [manifest,setManifest]=useState<VegetationManifest|null>(null),[enabled,setEnabled]=useState(true),[status,setStatus]=useState('loading'),[retry,setRetry]=useState(0);
 const cache=useRef(new Map<string,HTMLImageElement>()),pending=useRef(new Map<string,{image:HTMLImageElement;timer:ReturnType<typeof setTimeout>;promise:Promise<HTMLImageElement>}>()),lastAttempt=useRef(0);
 useEffect(()=>()=>{for(const value of pending.current.values()){clearTimeout(value.timer);value.image.removeAttribute('src');}pending.current.clear();cache.current.clear();},[]);
 useEffect(()=>{onStatus(enabled?status:'hidden');},[status,enabled,onStatus]);
 useEffect(()=>{if(!active||manifest)return;let current=true;const reload=retry>lastAttempt.current;lastAttempt.current=retry;globeFile<VegetationManifest>('globe/vegetation.json',reload).then(m=>{if(current)setManifest(m);}).catch(()=>{if(current)setStatus('error');});return()=>{current=false;};},[active,manifest,retry]);
 const frame=manifest?.frames.find(f=>f.date.slice(0,7)===month);
 useLayoutEffect(()=>{
  let current=true;if(!active)return;
  if(!enabled){setConceptTexture(null);return;}
  if(!manifest||!month){setConceptTexture(null);return;}
  if(!frame||frame.status!=='available'||!frame.url){setConceptTexture(null);setStatus('gap');return;}
  const url=assetURL(frame.url);
  if(!hosted&&!url.startsWith('data:')){setConceptTexture(null);setStatus('offline');return;}
  setStatus('loading');
  const cached=cache.current.get(month);
  const show=(img:HTMLImageElement)=>{if(current){setConceptTexture(img,frame.date);setStatus('ready');}};
  if(cached){cache.current.delete(month);cache.current.set(month,cached);show(cached);return()=>{current=false;};}
  setConceptTexture(null);
  let entry=pending.current.get(url);
  if(!entry){
   const image=new Image();image.src=url;let timer:ReturnType<typeof setTimeout>;
   const promise=Promise.race([image.decode().then(()=>image),new Promise<HTMLImageElement>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timed out')),8000);})]).then(img=>{
    if(pending.current.get(url)?.promise===promise){cache.current.set(month,img);while(cache.current.size>4)cache.current.delete(cache.current.keys().next().value!);}return img;
   }).finally(()=>{clearTimeout(timer);pending.current.delete(url);});
   entry={image,timer:timer!,promise};pending.current.set(url,entry);
  }
  void entry.promise.then(show).catch(()=>{if(current)setStatus('error');});
  return()=>{current=false;};
 },[active,month,frame,manifest,enabled,retry]);
 return <section className="concept-vegetation" hidden={!active} aria-label="Monthly satellite land observations" data-vegetation-status={enabled?status:'hidden'}>
  <div><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Show satellite vegetation colors</label><strong>{month||'Loading month...'}</strong></div>
  <p role={playing?undefined:'status'} aria-live={playing?'off':'polite'}>{!enabled?'Vegetation layer hidden. Showing the historical satellite basemap.':status==='ready'?'This month’s observed vegetation greenness is shown on land. Compare the colors across dates to follow seasonal changes.':status==='gap'?'No vegetation image is available for this month. The satellite basemap remains visible.':status==='offline'?'This month is not embedded in the offline edition. The basemap remains visible.':status==='error'?'The vegetation image could not load. The basemap remains visible.':'Loading the selected monthly vegetation image...'}</p>
  {manifest&&<div className="vegetation-legend"><img src={assetURL(manifest.legend.pngUrl||manifest.legend.url)} alt="NASA MODIS NDVI color legend, from sparse vegetation to greater greenness"/><span>The colors show vegetation greenness, not crop health or water levels. Seasonal cycles can explain greening and browning.</span></div>}
  <details><summary>What the colors mean · source</summary><p>NASA’s MODIS instrument observes reflected light. The normalized difference vegetation index (NDVI) summarizes greenness. Each image combines observations across a calendar month. Transparent areas can be missing data or low/nonpositive index values.</p><p className="source-line">NASA GIBS / MODIS Terra monthly NDVI{frame&&<> · <a href={frame.sourceUrl} target="_blank" rel="noopener">This month's source</a></>} · The historical Blue Marble background stays fixed. These images do not establish an El Niño impact.</p></details>
  {status==='error'&&<button onClick={()=>setRetry(n=>n+1)}>Retry vegetation</button>}
 </section>;
}
