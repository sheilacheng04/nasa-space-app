import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import {geography} from './world.js';
import {assetURL,safeURL} from './core.js';
import {mapSelection,opticalRequest} from './site-map-data.js';

const corners=b=>[[b[0],b[3]],[b[2],b[3]],[b[2],b[1]],[b[0],b[1]]];
const box=b=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]}});
export async function mountMap(element,site,acquisition,pol,contextLayers=[],options={}){
 element.innerHTML='<div class="map-selection-label"></div><p class="map-record-metadata"></p><p class="map-evidence-note"></p><div class="map-mount"></div><label class="context-layer-toggle"><input type="checkbox" data-optical><span class="map-optical-label"></span></label><p class="map-optical-status" role="status"></p><div class="map-context-controls"></div><p class="map-reference-note">Natural Earth / world-atlas outlines and the study box are geographic references. Catalog footprints describe geometric extent, not valid radar pixel coverage. Optical and radar layers are different observations, not quantitative change evidence.</p><div class="map-feedback" role="status"></div>';
 const mount=element.querySelector('.map-mount'),label=element.querySelector('.map-selection-label'),metadata=element.querySelector('.map-record-metadata'),note=element.querySelector('.map-evidence-note'),feedback=element.querySelector('.map-feedback'),optical=element.querySelector('[data-optical]'),opticalLabel=element.querySelector('.map-optical-label'),opticalStatus=element.querySelector('.map-optical-status'),contextControls=element.querySelector('.map-context-controls');
 const countries=await geography();
 let disposed=false,loaded=false,generation=0,currentSite=site,current=null,radarController,opticalController,radarURL='',opticalURL='',contextIds=[];
 const map=new maplibregl.Map({container:mount,center:site.coordinates,zoom:9,attributionControl:true,style:{version:8,sources:{land:{type:'geojson',data:countries,attribution:'Natural Earth / world-atlas geographic reference'}},layers:[{id:'background',type:'background',paint:{'background-color':'#dce5df'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#b3c3b5','fill-outline-color':'#f5f3ed'}}]}});
 map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
 map.fitBounds([[site.bbox[0],site.bbox[1]],[site.bbox[2],site.bbox[3]]],{padding:35,duration:0});
 const remove=id=>{if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);};
 const releaseRadar=()=>{radarController?.abort();if(loaded)remove('radar');if(radarURL)URL.revokeObjectURL(radarURL);radarURL='';element.dataset.radarState='unavailable';element.dataset.radarBounds='';element.dataset.renderedDate='';};
 const releaseOptical=()=>{opticalController?.abort();if(loaded)remove('optical');if(opticalURL)URL.revokeObjectURL(opticalURL);opticalURL='';element.dataset.opticalState='unavailable';element.dataset.opticalDate='';};
 async function fetchImage(url,signal){
  const response=await fetch(url,{signal});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('No image returned');
  const blob=await response.blob();if(blob.size>8000000)throw new Error('Image exceeds display budget');
  const objectURL=URL.createObjectURL(blob),image=new Image();image.src=objectURL;
  try{
   await Promise.race([image.decode(),new Promise((_,reject)=>{if(signal.aborted)reject(new Error('Cancelled'));else signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true});})]);
   if(signal.aborted)throw new Error('Cancelled');
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let coverage=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){coverage=true;break;}
   if(!coverage)throw new Error('Empty image');
   return objectURL;
  }catch(error){URL.revokeObjectURL(objectURL);throw error;}finally{image.removeAttribute('src');}
 }
 function sourceReady(id,signal){
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{map.off('sourcedata',check);map.off('error',failed);signal.removeEventListener('abort',aborted);};
   const check=()=>{if(map.getSource(id)&&map.isSourceLoaded(id)){cleanup();resolve();}};
   const failed=event=>{if(event.sourceId===id){cleanup();reject(new Error('Map source failed'));}};
   const aborted=()=>{cleanup();reject(new Error('Cancelled'));};
   if(signal.aborted){aborted();return;}
   map.on('sourcedata',check);map.on('error',failed);signal.addEventListener('abort',aborted,{once:true});check();
  });
 }
 async function loadRadar(version){
  if(!current.radar){feedback.textContent=current.reason;return;}
  const radar=current.radar;radarController=new AbortController();const controller=radarController,timer=setTimeout(()=>controller.abort(),10000);
  element.dataset.radarState='loading';feedback.textContent='Loading the selected dated radar browse...';
  try{
   const url=await fetchImage(radar.image,controller.signal);
   if(disposed||version!==generation||controller!==radarController){URL.revokeObjectURL(url);return;}
   radarURL=url;map.addSource('radar',{type:'image',url,coordinates:corners(radar.bounds)});
   map.addLayer({id:'radar',type:'raster',source:'radar',paint:{'raster-opacity':1,'raster-fade-duration':0}},'study-area');
   if(!map.getSource('radar')||!map.getLayer('radar'))throw new Error('Map source rejected');
   await sourceReady('radar',controller.signal);
   if(disposed||version!==generation||controller!==radarController)return;
   element.dataset.radarState='ready';element.dataset.radarBounds=radar.bounds.join(',');element.dataset.renderedDate=current.date;feedback.textContent=current.reason;
  }catch{if(!disposed&&version===generation&&controller===radarController){element.dataset.radarState='error';feedback.textContent='Selected radar image unavailable on the map. No previous image is retained. ';const button=document.createElement('button');button.textContent='Retry map radar';button.onclick=()=>{releaseRadar();void loadRadar(generation);};feedback.append(button);}}
  finally{clearTimeout(timer);}
 }
 async function loadOptical(version){
  releaseOptical();
  const url=current.opticalDate&&opticalRequest(currentSite,current.opticalDate);
  if(!optical.checked||!url){opticalStatus.textContent=url?'Optical context is off. No optical image is assumed available.':'Optical reference unavailable: no real selected UTC date.';return;}
  const day=current.opticalDate;opticalController=new AbortController();const controller=opticalController,timer=setTimeout(()=>controller.abort(),12000);
  element.dataset.opticalState='loading';opticalStatus.textContent='Requesting MODIS optical daily mosaic for '+day+' only...';
  try{
   const result=await fetchImage(url,controller.signal);
   if(disposed||version!==generation||controller!==opticalController||!optical.checked){URL.revokeObjectURL(result);return;}
   opticalURL=result;map.addSource('optical',{type:'image',url:result,coordinates:corners(currentSite.bbox)});
   map.addLayer({id:'optical',type:'raster',source:'optical',paint:{'raster-fade-duration':0}},map.getLayer('radar')?'radar':'study-area');
   if(!map.getSource('optical')||!map.getLayer('optical'))throw new Error('Map source rejected');
   await sourceReady('optical',controller.signal);
   if(disposed||version!==generation||controller!==opticalController||!optical.checked)return;
   element.dataset.opticalState='ready';element.dataset.opticalDate=day;opticalStatus.textContent='MODIS Terra optical daily mosaic requested for '+day+' (UTC). Contributing acquisition times are unverified; this is not necessarily simultaneous with radar. Clouds and 250 m source resolution limit detail. ';
   const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='NASA GIBS optical source';opticalStatus.append(link);
  }catch{if(!disposed&&version===generation&&controller===opticalController&&optical.checked){element.dataset.opticalState='error';opticalStatus.textContent='Optical reference unavailable for '+day+': the exact-date request failed, timed out, or returned an empty image. No other date is substituted. ';const button=document.createElement('button');button.textContent='Retry optical';button.onclick=()=>void loadOptical(generation);opticalStatus.append(button);}}
  finally{clearTimeout(timer);}
 }
 function apply(){
  if(!loaded||disposed)return;
  map.getSource('study-area').setData(box(currentSite.bbox));
  if(current.footprint){map.addSource('selected-footprint',{type:'geojson',data:{type:'Feature',properties:{},geometry:current.footprint},attribution:'ASF DAAC catalog footprint; geometric reference only'});map.addLayer({id:'selected-footprint',type:'line',source:'selected-footprint',paint:{'line-color':'#db4e00','line-width':2,'line-dasharray':[3,2]}});}
  for(const [index,layer]of current.layers.entries()){
   const id='site-context-'+index;contextIds.push(id);map.addSource(id,{type:'image',url:assetURL(layer.image),coordinates:corners(layer.bounds)});map.addLayer({id,type:'raster',source:id,layout:{visibility:'none'},paint:{'raster-opacity':.7,'raster-fade-duration':0}},'study-area');
   const control=document.createElement('label');control.className='context-layer-toggle';const input=document.createElement('input');input.type='checkbox';control.append(input,document.createTextNode(layer.name+' / '+(layer.isStatic?'static geographic reference':layer.date)+' / '+layer.attribution));input.onchange=()=>map.setLayoutProperty(id,'visibility',input.checked?'visible':'none');contextControls.append(control);
  }
  if(!current.layers.length)contextControls.textContent='No matching saved context layers for this site/date.';
  void loadRadar(generation);void loadOptical(generation);
 }
 function update(nextSite,record,channel,layers=[],nextOptions={}){
  if(disposed)return;mount.dataset.ready='false';generation++;const siteChanged=nextSite.id!==currentSite.id;
  releaseRadar();releaseOptical();if(loaded){remove('selected-footprint');contextIds.forEach(remove);}contextIds=[];contextControls.replaceChildren();feedback.replaceChildren();
  currentSite=nextSite;current=mapSelection(nextSite,record,channel,layers,nextOptions);
  element.dataset.mapError='';element.dataset.siteId=nextSite.id;element.dataset.selectedDate=current.date;element.dataset.channel=current.channel;element.dataset.evidenceMode=current.mode;element.dataset.footprint=current.footprint?'available':'unavailable';element.dataset.footprintId=current.footprintId||'';
  label.textContent=current.siteName+' / '+current.date+' / '+current.channel+' / '+current.source;
  metadata.textContent=current.metadata.map(([key,value])=>key+': '+value).join(' / ');
  note.textContent=current.reason+' '+(current.footprint?'Dashed orange outline: exact selected acquisition catalog footprint, not valid-pixel coverage.':'No exact acquisition footprint is assigned to this selection.')+' The map follows the selected image (After in a comparison); it is not the change layer.';
  if(current.footprintSource&&safeURL(current.footprintSource)!=='#'){const link=document.createElement('a');link.href=safeURL(current.footprintSource);link.target='_blank';link.rel='noopener';link.textContent=' Catalog footprint source';note.append(link);}
  if(current.footprintBounds){const fit=document.createElement('button');fit.textContent='Fit selected footprint';fit.className='map-fit-footprint';fit.onclick=()=>{const b=current.footprintBounds;map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:35,duration:0});};note.append(fit);}
  optical.disabled=!current.opticalDate;opticalLabel.textContent=current.opticalDate?'Request optical context for '+current.opticalDate+' (same UTC day only)':'Optical reference unavailable for this selection';
  opticalStatus.textContent='Optical context is off. No optical image is assumed available.';
  if(siteChanged)map.fitBounds([[nextSite.bbox[0],nextSite.bbox[1]],[nextSite.bbox[2],nextSite.bbox[3]]],{padding:35,duration:0});
  apply();
 }
 optical.onchange=()=>{if(loaded)void loadOptical(generation);};
 const timeout=setTimeout(()=>{if(!loaded&&!disposed)feedback.textContent='Map initialization timed out. The image and table views remain available.';},12000);
 map.on('load',()=>{if(disposed)return;loaded=true;clearTimeout(timeout);map.addSource('study-area',{type:'geojson',data:box(currentSite.bbox)});map.addLayer({id:'study-area',type:'line',source:'study-area',paint:{'line-color':'#226987','line-width':2}});apply();});
 map.on('error',event=>{if(!disposed){element.dataset.mapError=event.error?.message||'Map source error';feedback.textContent='Some selected map content is unavailable. The image comparison remains available above.';}});
 map.on('idle',()=>{if(!disposed)mount.dataset.ready='true';});
 update(site,acquisition,pol,contextLayers,options);
 return {update,dispose(){if(disposed)return;disposed=true;generation++;clearTimeout(timeout);releaseRadar();releaseOptical();map.remove();element.replaceChildren();}};
}
