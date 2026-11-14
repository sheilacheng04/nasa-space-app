import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {dataFile,hosted} from '../api/client';
import {assetURL} from '../core.js';
import {setConceptTexture} from '../world.js';

type VegetationFrame={date:string;label:string;status:string;url:string|null;sourceUrl:string};
type VegetationManifest={layerId:string;title:string;legend:{url:string;pngUrl?:string;sourceUrl:string;colormapUrl:string};frames:VegetationFrame[]};
export default function ConceptVegetation({active,month,onStatus,playing=false}:{active:boolean;month:string;playing?:boolean;onStatus:(status:string)=>void}){
 const [manifest,setManifest]=useState<VegetationManifest|null>(null),[enabled,setEnabled]=useState(true),[status,setStatus]=useState('loading'),[retry,setRetry]=useState(0);
 const cache=useRef(new Map<string,HTMLImageElement>());
 useEffect(()=>{onStatus(enabled?status:'hidden');},[status,enabled,onStatus]);
 useEffect(()=>{if(!active||manifest)return;let current=true;dataFile<VegetationManifest>('globe/vegetation.json').then(m=>{if(current)setManifest(m);}).catch(()=>{if(current)setStatus('error');});return()=>{current=false;};},[active,manifest,retry]);
 const frame=manifest?.frames.find(f=>f.date.slice(0,7)===month);
 useLayoutEffect(()=>{
  let current=true;setConceptTexture(null);if(!active||!enabled)return;
  if(!manifest||!month)return;
  if(!frame||frame.status!=='available'||!frame.url){setStatus('gap');return;}
  const url=assetURL(frame.url);
  if(!hosted&&!url.startsWith('data:')){setStatus('offline');return;}
  setStatus('loading');
  const cached=cache.current.get(month),img=cached||new Image();let timer:ReturnType<typeof setTimeout>;
  const show=()=>{if(!current)return;cache.current.delete(month);cache.current.set(month,img);while(cache.current.size>4)cache.current.delete(cache.current.keys().next().value!);setConceptTexture(img,frame.date);setStatus('ready');};
  if(cached){show();return()=>{current=false;};}
  img.src=url;
  void Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timed out')),8000);})]).then(show).catch(()=>{if(current)setStatus('error');}).finally(()=>clearTimeout(timer));
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
