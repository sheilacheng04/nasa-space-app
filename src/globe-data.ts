import { assetURL } from './core.js';
import {dataFile} from './api/client';
import {createJSONCache} from './json-cache.js';
const globeJSON=createJSONCache();
export function globeFile<T>(path:string,reload=false):Promise<T>{return globeJSON(path,()=>dataFile<T>(path,{reload}),reload);}
import { hosted } from './api/client';

export interface GlobeFrame {
 date:string; layer:string; status:string; image?:string|null; sourceUrl?:string;
 maturity:string; maturityWindow:string; reason?:string; width?:number; height?:number; nontransparentPixels?:number; totalPixels?:number;
 focus?:{lng:number;lat:number}; offlineEmbedded?:boolean;
}
export interface GlobeLayer {id:string;title:string;kind:string;start:string;end:string;domain:string;domainUrl:string;frames:GlobeFrame[];advertisedDates:string[]}
export interface GlobeManifest {
 defaultLayer:string;defaultReason:string;rollingAvailable:boolean;retrievedAt:string;source:string;
 maturityNote:string;maturityWindows:{label:string;start:string;end:string|null;source:string}[];
 gap:{start:string;end:string;label:string;source:string};
 colorMapping:{status:string;text:string;source:string};limits:string[];layers:Record<string,GlobeLayer>;
}
export interface LoadedFrame {url:string;image:HTMLImageElement;origin:'live GIBS'|'saved GIBS frame'|'offline GIBS frame';date:string}
const endpoint='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
export function wmsURL(layer:string,date:string,bbox:number[]=[-180,-90,180,90],width=1024,height=512){
 return endpoint+'?'+new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:layer,STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',SRS:'EPSG:4326',BBOX:bbox.join(','),WIDTH:String(width),HEIGHT:String(height),TIME:date});
}
let imageRequests=0;
const imageQueue:{signal:AbortSignal;start:()=>void}[]=[];
function imageSlot(signal:AbortSignal):Promise<()=>void>{
 return new Promise((resolve,reject)=>{
  const abort=()=>{const at=imageQueue.indexOf(entry);if(at>=0)imageQueue.splice(at,1);reject(new Error('Image request timed out'));};
  const entry={signal,start:()=>{signal.removeEventListener('abort',abort);if(signal.aborted){reject(new Error('Image request timed out'));return;}imageRequests++;
   resolve(()=>{imageRequests--;while(imageRequests<3&&imageQueue.length)imageQueue.shift()!.start();});}};
  if(signal.aborted){reject(new Error('Image request timed out'));return;}
  signal.addEventListener('abort',abort,{once:true});
  if(imageRequests<3)entry.start();else imageQueue.push(entry);
 });
}
async function fetchImage(url:string):Promise<{url:string;image:HTMLImageElement}>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 let objectURL:string|undefined,release:(()=>void)|undefined;
 try{
  release=await imageSlot(controller.signal);
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('No usable image returned');
  const blob=await response.blob();if(blob.size>8_000_000)throw new Error('Image exceeds overview budget');
  objectURL=URL.createObjectURL(blob);const image=new Image();image.src=objectURL;
  await Promise.race([image.decode(),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Image decoding timed out')),{once:true}))]);
  return {url:objectURL,image};
 }catch(e){if(objectURL)URL.revokeObjectURL(objectURL);throw e;}finally{clearTimeout(timer);release?.();}
}
export function containsCoverage(image:HTMLImageElement){
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
 const context=c.getContext('2d',{willReadFrequently:true})!;context.drawImage(image,0,0);
 const rgba=context.getImageData(0,0,c.width,c.height).data;
 for(let i=3;i<rgba.length;i+=4)if(rgba[i])return true;
 return false;
}
/** Three in-flight requests maximum, deduplicated and bounded to eight decoded frames. */
export class FrameCache{
 private cache=new Map<string,LoadedFrame>();private pending=new Map<string,Promise<LoadedFrame>>();
 private queue:{key:string;reject:(reason:Error)=>void;run:()=>void}[]=[];private running=0;private disposed=false;private paused=false;
 pause(){this.paused=true;for(const q of this.queue){q.reject(new Error('Playback paused'));this.pending.delete(q.key);}this.queue=[];}
 resume(){this.paused=false;this.pump();}
 get activeRequests(){return this.running;}
 clear(){this.disposed=true;for(const q of this.queue){q.reject(new Error('Playback closed'));this.pending.delete(q.key);}this.queue=[];for(const frame of this.cache.values())URL.revokeObjectURL(frame.url);this.cache.clear();}
 invalidate(frame:GlobeFrame){const key=frame.layer+'/'+frame.date;const hit=this.cache.get(key);if(hit)URL.revokeObjectURL(hit.url);this.cache.delete(key);}
 has(frame:GlobeFrame){return this.cache.has(frame.layer+'/'+frame.date);}
 load(frame:GlobeFrame,priority=false):Promise<LoadedFrame>{
  if(this.disposed||this.paused)return Promise.reject(new Error(this.disposed?'Playback closed':'Playback paused'));
  const key=frame.layer+'/'+frame.date,hit=this.cache.get(key);
  if(priority){const keep=[];for(const q of this.queue){if(q.key===key)keep.push(q);else{q.reject(new Error('Frame superseded'));this.pending.delete(q.key);}}this.queue=keep;}
  if(hit){this.cache.delete(key);this.cache.set(key,hit);return Promise.resolve(hit);}
  if(this.pending.has(key))return this.pending.get(key)!;
  const promise=new Promise<LoadedFrame>((resolve,reject)=>{
   this.queue.push({key,reject,run:()=>{this.running++;void this.retrieve(frame).then(result=>{
    if(this.disposed){URL.revokeObjectURL(result.url);throw new Error('Playback closed');}
    this.cache.set(key,result);while(this.cache.size>8){const oldest=this.cache.keys().next().value!;URL.revokeObjectURL(this.cache.get(oldest)!.url);this.cache.delete(oldest);}
    resolve(result);
   }).catch(reject).finally(()=>{this.pending.delete(key);this.running--;this.pump();});}});
  });
  this.pending.set(key,promise);this.pump();return promise;
 }
 private pump(){while(!this.paused&&!this.disposed&&this.running<3&&this.queue.length)this.queue.shift()!.run();}
 private async retrieve(frame:GlobeFrame):Promise<LoadedFrame>{
  if(frame.status==='no-data'||frame.status==='empty')throw new Error('No imagery in this window');
  const path=frame.image?assetURL(frame.image):'';
  // Published exact-date snapshots start instantly and remain usable without GIBS.
  if(path&&(hosted||path.startsWith('data:'))){
   try{const result=await fetchImage(path);if(!containsCoverage(result.image)){URL.revokeObjectURL(result.url);throw new Error('Saved mosaic is empty');}return {...result,date:frame.date,origin:hosted?'saved GIBS frame':'offline GIBS frame'};}catch{/* Recover this exact date from the public API. */}
  }
  if(hosted&&!this.paused&&!this.disposed){
   try{const result=await fetchImage(wmsURL(frame.layer,frame.date));if(!containsCoverage(result.image)){URL.revokeObjectURL(result.url);throw new Error('Empty live mosaic');}return {...result,date:frame.date,origin:'live GIBS'};}catch{/* Keep the basemap visible and expose a retry. */}
  }
  throw new Error(hosted?'Saved and live NISAR imagery unavailable for this date.':'This NISAR date is not embedded in the offline edition.');
 }
}
export async function siteCrop(frame:GlobeFrame,bbox:number[],overview?:LoadedFrame){
 if(hosted){
  try{const result=await fetchImage(wmsURL(frame.layer,frame.date,bbox,512,320));if(!containsCoverage(result.image)){URL.revokeObjectURL(result.url);return {url:'',note:'No NISAR coverage in this site crop on this date.'};}
   return {url:result.url,note:'Live GIBS crop of this exact mosaic date. False color, not calibrated.'};
  }catch{/* A crop of the exact dated overview remains an honest, coarse fallback. */}
 }
 if(!overview)return {url:'',note:'Current-date site crop not available.'};
 const image=overview.image,[west,south,east,north]=bbox,c=document.createElement('canvas');c.width=512;c.height=320;const context=c.getContext('2d')!;context.imageSmoothingEnabled=false;
 context.drawImage(image,(west+180)/360*image.naturalWidth,(90-north)/180*image.naturalHeight,(east-west)/360*image.naturalWidth,(north-south)/180*image.naturalHeight,0,0,c.width,c.height);
 const rgba=context.getImageData(0,0,c.width,c.height).data;let coverage=false;for(let i=3;i<rgba.length;i+=4)if(rgba[i]){coverage=true;break;}
 return {url:coverage?c.toDataURL('image/png'):'',note:coverage?'Crop of the saved global overview, about '+Math.round(40075/image.naturalWidth)+' km per pixel. Site detail is not resolved.':'No coverage resolved in this coarse global crop. This does not establish absence of higher-resolution site data.'};
}
