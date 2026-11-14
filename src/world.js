import {geoOrthographic,geoMercator,geoPath,geoGraticule10,geoDistance,geoCentroid} from 'd3-geo';
import {feature} from 'topojson-client';
import {dataFile,geocode} from './services.js';
import './globe.css';
import {loadGlobe} from './globe-loader.js';
import {createCanvasGlobe} from './canvas-globe.js';
import {composeSatelliteSurface} from './satellite-surface.js';
import {esc,finite,assetURL} from './core.js';
let countries,world,observer,geographyPromise;
let globeMode='satellite',satelliteURL=null,satelliteImage=null,satelliteDate='',geographicContext=true,textureVersion=0;
let surfaceOwner=null,surfaceReady=null,surfaceMaterial=null,originalMaterial=null,TextureType=null,textureOptions=null,lastSurfaceTexture=null;
let lastSurface=null,lastMarkers=null,motionQuery;
let baseImage=null,basePromise=null,conceptImage=null,conceptImageDate='';
export async function geography(){if(!geographyPromise)geographyPromise=dataFile('world.topo.json').then(topo=>countries=feature(topo,topo.objects.countries)).catch(error=>{geographyPromise=null;throw error;});return geographyPromise;}
export async function drawPacific(){const data=await geography(),projection=geoOrthographic().rotate([160,-10]).translate([280,270]).scale(222),path=geoPath(projection);const g=path(geoGraticule10());const band={type:'Polygon',coordinates:[[[-175,-5],[-175,5],[-115,5],[-115,-5],[-175,-5]]]};
 document.getElementById('pacific-map').innerHTML=`<svg viewBox="0 0 560 540" role="img" aria-label="Pacific-centered globe. Orange arrows illustrate an eastward shift of warm surface water, not measured temperatures."><defs><marker id="warm-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#da8c59" stroke-width="1"/></marker></defs><circle cx="280" cy="270" r="233" fill="none" stroke="#b6c3ba" stroke-width=".7"/><circle cx="280" cy="270" r="222" fill="#17313b"/><path d="${g}" fill="none" stroke="#65848b" stroke-opacity=".35" stroke-width=".6"/><path d="${path(data)}" fill="#7d9490" stroke="#a4b8ad" stroke-width=".5"/><path d="${path(band)}" fill="#d78a52" fill-opacity=".2"/><path d="M133 282Q268 249 403 286" fill="none" stroke="#da8c59" stroke-width="2" marker-end="url(#warm-arrow)"/><path d="M150 299Q278 276 388 303" fill="none" stroke="#da8c59" stroke-width="1" stroke-opacity=".6"/><text x="280" y="248" text-anchor="middle" fill="#d9e5de" font-size="10" letter-spacing="4">PACIFIC OCEAN</text><text x="278" y="331" text-anchor="middle" fill="#e5a171" font-size="8" letter-spacing="2">EQUATORIAL WARM POOL</text><path d="M80 270H480" stroke="#b8cac0" stroke-dasharray="2 5" opacity=".3"/><text x="280" y="509" text-anchor="middle" font-size="8" fill="#5f6867" letter-spacing="3">A CONNECTED OCEAN · A CHANGING LANDSCAPE</text></svg>`;
}
export async function miniMap(site,{large=false}={}){const data=await geography(),w=large?500:360,h=large?500:170,projection=geoMercator().center(site.coordinates).scale(large?3200:1100).translate([w/2,h/2]),path=geoPath(projection);return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Locator map for ${esc(site.name)}"><rect width="${w}" height="${h}" fill="#dce5df"/><path d="${path(data)}" fill="#b3c3b5" stroke="#f5f3ed" stroke-width="1"/><path d="${path(geoGraticule10())}" fill="none" stroke="#9bac9f" stroke-width=".5"/><circle cx="${w/2}" cy="${h/2}" r="20" fill="none" stroke="#226987" stroke-opacity=".3"/><circle cx="${w/2}" cy="${h/2}" r="5" fill="#226987" stroke="#f5f3ed" stroke-width="2"/>${large?`<text x="${w/2+17}" y="${h/2+5}" font-size="14" fill="#202b2e">${esc(site.name)}</text><text x="20" y="${h-25}" font-size="11" fill="#5f6867">Philippines · locator, not a radar map</text>`:''}</svg>`;}
export function oceanDiagram(value){const t=value/100,warmEnd=220+t*285,windEnd=150+t*125;document.getElementById('phase-label').textContent=t<.35?'Typical conditions':t<.7?'Trade winds weakening':'El Niño conditions';document.getElementById('ocean-diagram').innerHTML=`<svg viewBox="0 0 600 220" role="img" aria-label="Conceptual ocean cross-section. The warm surface layer extends east as the trade winds weaken."><defs><marker id="wind-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#5f6867"/></marker></defs><rect x="25" y="85" width="550" height="110" fill="#c1d3d6"/><path d="M25 85H575V${100+t*25}Q${warmEnd} ${125+t*20} 25 175Z" fill="#d4976c"/><path d="M${420-t*30} 47H${windEnd}" stroke="#5f6867" stroke-width="${3-t*1.5}" marker-end="url(#wind-arrow)"/><text x="300" y="25" text-anchor="middle" font-size="11" fill="#5f6867">${t<.5?'Trade winds push west':'Weaker westward trade winds'}</text><text x="40" y="115" font-size="12" fill="#573b28">Warm surface water</text><text x="400" y="178" font-size="11" fill="#325763">Cooler deep water</text><text x="25" y="215" font-size="10" fill="#5f6867">Western Pacific</text><text x="575" y="215" text-anchor="end" font-size="10" fill="#5f6867">Eastern Pacific</text></svg>`;}

// Both modes share a static optical reference; observational overlays have their own dates.
let globeSites=[],globePoints=[],placeIndex=[],selectSite=()=>{},globePromise=null;
let intersector,visible=false,routeActive=false,rendering=false,cameraFrame=0,searchSequence=0;
let forceCanvas=false,recovering=false,rendererGeneration=0,rotating=false,listenersBound=false;
let conceptSnapshot={date:'',month:'',sites:[]};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const el=id=>document.getElementById(id);
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const stage=()=>el('globe-stage');
const note=text=>{if(el('globe-status'))el('globe-status').textContent=(world?.__compatibility?'Compatibility view / ':'')+text;};
const signalColor={drier:'#f6a55c',wetter:'#53bbf2',near:'#e2e8ee',unknown:'#9aa8b7'};

function announceBasemap(){
 const status=baseImage?'ready':'reference';
 if(stage())stage().dataset.basemap=status;
 dispatchEvent(new CustomEvent('globe:basemap',{detail:{status}}));
}
function loadBaseImage(){
 if(baseImage){announceBasemap();return Promise.resolve(baseImage);}
 if(basePromise)return basePromise;
 announceBasemap();
 basePromise=(async()=>{
  const image=new Image();let timer;
  try{
   image.src=assetURL('data/globe/blue-marble.jpg');
   await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Reference image timed out')),8000);})]);
   baseImage=image;
  }catch{basePromise=null;}
  finally{clearTimeout(timer);announceBasemap();drawSurface();}
  return baseImage;
 })();
 return basePromise;
}
function mountGlobeUI(){
 if(el('globe-zoom-in'))return;
 stage().insertAdjacentHTML('beforeend','<div class="globe-toolbar"><form id="globe-search" role="search"><label class="sr-only" for="globe-query">Find a place or enter latitude, longitude</label><input id="globe-query" type="search" placeholder="Search a place or lat, lng..." autocomplete="off"><button id="globe-search-submit" type="submit">Find</button><div id="globe-search-results" hidden></div></form></div><div class="globe-zoom" aria-label="Globe controls"><button id="globe-zoom-in" title="Zoom in" aria-label="Zoom in">+</button><button id="globe-zoom-out" title="Zoom out" aria-label="Zoom out">&#8722;</button><button id="globe-reset" title="Reset Earth view" aria-label="Reset Earth view">&#8962;</button><button id="globe-rotate" aria-pressed="false" title="Auto-rotate" aria-label="Auto-rotate">&#8635;</button></div>');
 el('globe-zoom-in').onclick=()=>zoom(.8);
 el('globe-zoom-out').onclick=()=>zoom(1.25);
 el('globe-reset').onclick=()=>flyTo(115,15,1.5);
 el('globe-rotate').onclick=()=>{
  if(!world)return;
  rotating=!rotating;world.controls().autoRotate=rotating;setPressed('globe-rotate',rotating);
 };
 el('globe-search').onsubmit=e=>{e.preventDefault();void searchPlaces(true);};
 el('globe-query').oninput=()=>void searchPlaces(false);
 el('globe-query').onkeydown=e=>{
  if(e.key==='Escape')el('globe-search-results').hidden=true;
  if(e.key==='ArrowDown'){e.preventDefault();el('globe-search-results').querySelector('button')?.focus();}
 };
 el('globe-search-results').onkeydown=e=>{
  if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();
  const buttons=[...el('globe-search-results').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
  buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
 };
}
function setPressed(id,value){el(id)?.setAttribute('aria-pressed',String(value));}
function recordCamera(){
 if(!world||!stage())return;
 const view=world.pointOfView();
 stage().dataset.altitude=view.altitude.toFixed(3);stage().dataset.latitude=view.lat.toFixed(3);stage().dataset.longitude=view.lng.toFixed(3);
 dispatchEvent(new Event('globe:camera'));
}
function cancelCameraMove(){cancelAnimationFrame(cameraFrame);cameraFrame=0;}
// The pinned wrapper does not advance globe.gl's camera tween; own one cancelable RAF.
function moveCamera(target,duration=0){
 if(!world)return;cancelCameraMove();
 const instance=world,from=world.pointOfView(),to={...from,...target};
 if(duration<=0){world.pointOfView(to,0);recordCamera();return;}
 const longitudeDelta=((to.lng-from.lng+540)%360)-180,start=performance.now();
 const step=now=>{
  if(instance!==world||!routeActive||!rendering){cameraFrame=0;return;}
  const progress=Math.min(1,(now-start)/duration),eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
  instance.pointOfView({lat:from.lat+(to.lat-from.lat)*eased,lng:from.lng+longitudeDelta*eased,altitude:from.altitude+(to.altitude-from.altitude)*eased},0);
  recordCamera();cameraFrame=progress<1?requestAnimationFrame(step):0;
 };cameraFrame=requestAnimationFrame(step);
}
function zoom(factor){
 if(!world)return;const current=world.pointOfView();stopRotation();
 moveCamera({...current,altitude:Math.max(.08,Math.min(5,current.altitude*factor))},reduced()?0:300);
}
function stopRotation(){rotating=false;if(world)world.controls().autoRotate=false;setPressed('globe-rotate',false);}
function conceptMarkers(){
 return (conceptSnapshot.sites||[]).filter(site=>Array.isArray(site.coordinates)&&site.coordinates.length===2&&site.coordinates.every(finite)).map(site=>{
  const rain=finite(site.rainAnomaly)?site.rainAnomaly:null;
  return {...site,site:true,siteName:site.name,lat:site.coordinates[1],lng:site.coordinates[0],
   signal:signalColor[site.signal]?site.signal:'unknown',
   name:site.name+' / '+(rain===null?'rain unavailable':(rain>0?'+':'')+Math.round(rain)+' mm rain')};
 });
}
function refreshGlobe(){
 if(!world||!routeActive||document.hidden)return;
 const inputs=[world,globeMode,globePoints,conceptSnapshot];if(lastMarkers&&inputs.every((value,i)=>value===lastMarkers[i]))return;lastMarkers=inputs;
 world.polygonsData([]).arcsData([]).ringsData([]).showAtmosphere(false);
 const userMarkers=globePoints.filter(p=>finite(p.lat)&&finite(p.lng)).map(p=>({...p,user:true,signal:'user'}));
 const markers=[...(globeMode==='concept'?conceptMarkers():[]),...userMarkers];
 world.pointsMerge(false).pointsData(markers).pointRadius(.48).pointAltitude(.003)
  .pointColor(d=>d.user?'#d2dce8':signalColor[d.signal]).labelsData([]);
 if(stage()){
  stage().dataset.conceptDate=conceptSnapshot.date||'';
  stage().dataset.conceptSignals=JSON.stringify((conceptSnapshot.sites||[]).map(s=>({id:s.id,signal:s.signal||'unknown',rainAnomaly:finite(s.rainAnomaly)?s.rainAnomaly:null})));
  stage().dataset.userPointCount=String(userMarkers.length);stage().dataset.visiblePoints=String(markers.length);stage().dataset.arcCount='0';stage().dataset.labelCount='0';
 }
}
export function setConceptSnapshot(snapshot){
 if(snapshot?.date===conceptSnapshot.date&&snapshot?.month===conceptSnapshot.month&&snapshot?.sites===conceptSnapshot.sites)return;
 conceptSnapshot={date:snapshot?.date||'',month:snapshot?.month||'',sites:Array.isArray(snapshot?.sites)?snapshot.sites:[]};
 refreshGlobe();
}
/** @param {HTMLImageElement|HTMLCanvasElement|null} image @param {string} date */
export function setConceptTexture(image=null,date=''){
 if(conceptImage===image&&conceptImageDate===(image?date:''))return;
 conceptImage=image;conceptImageDate=image?date:'';
 if(globeMode==='concept')drawSurface();
}
function selectLocation(place){
 el('globe-search-results').hidden=true;
 if(place.site){dispatchEvent(new CustomEvent('globe:select-site',{detail:{id:place.id}}));return;}
 flyTo(place.lng,place.lat,place.feature?1.1:.8);
 if(stage())stage().dataset.selected=place.siteName||place.name;
 note((place.siteName||place.name)+' / geographic locator');
}
function searchResults(matches){
 const results=el('globe-search-results');if(!results)return;results.replaceChildren();results.hidden=matches.length===0;
 matches.forEach((place,index)=>{
  const button=document.createElement('button');button.type='button';button.dataset.placeIndex=String(index);button.textContent=place.name;
  const detail=document.createElement('small');detail.textContent=place.site?'Study area':place.feature?'Country':place.user?'Your observation':place.country||'Place';
  button.append(detail);button.onclick=()=>{el('globe-query').value=place.name;selectLocation(place);};results.append(button);
 });
}
async function searchPlaces(submit){
 const query=el('globe-query').value.trim(),normalized=normalize(query),token=++searchSequence;
 if(!query){searchResults([]);return;}
 const coordinate=query.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
 if(coordinate&&submit){
  const lat=Number(coordinate[1]),lng=Number(coordinate[2]);
  if(Math.abs(lat)>90||Math.abs(lng)>180){note('Use latitude from -90 to 90 and longitude from -180 to 180.');return;}
  selectLocation({name:lat.toFixed(3)+', '+lng.toFixed(3),lat,lng});return;
 }
 const index=[...globeSites.map(s=>({...s,site:true,lat:s.coordinates[1],lng:s.coordinates[0]})),...globePoints.map(p=>({...p,user:true})),...placeIndex];
 const exact=index.find(p=>normalize(p.name)===normalized),matches=index.filter(p=>normalize(p.name).includes(normalized)).sort((a,b)=>(normalize(a.name)===normalized?-1:normalize(b.name)===normalized?1:0)).slice(0,8);
 if(submit&&exact){selectLocation(exact);return;}
 if(matches.length){searchResults(matches);if(submit)note('Choose a matching place below the search field.');return;}
 searchResults([]);if(!submit)return;
 el('globe-search-submit').disabled=true;note('Searching Photon / OpenStreetMap...');
 try{
  const found=await geocode(query);if(token!==searchSequence)return;
  const results=found.map(f=>({name:[f.properties.name,f.properties.state,f.properties.country].filter(Boolean).join(', '),lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],country:'Photon / OpenStreetMap'}));
  searchResults(results);note(results.length?'Choose a place from the results. Source: Photon / OpenStreetMap.':'No matching place found. Try a country, city or latitude, longitude.');
 }catch{if(token===searchSequence)note('Online search is unavailable. Built-in countries, places and coordinates still work.');}
 finally{if(el('globe-search-submit'))el('globe-search-submit').disabled=false;}
}
function graphicsContext(){
 const canvas=document.createElement('canvas');if(forceCanvas)return{canvas,context:null,type:'canvas'};
 for(const type of ['webgl2','webgl','experimental-webgl']){
  try{const context=canvas.getContext(type,{alpha:true,antialias:false,powerPreference:'default'});if(context)return{canvas,context,type:type==='webgl2'?'webgl2':'webgl1'};}catch{}
 }
 return{canvas,context:null,type:'canvas'};
}
function createWorld(Globe,element,graphics){
 if(Globe&&graphics.context&&!graphics.context.isContextLost()){
  try{
   const instance=Globe({rendererConfig:{canvas:graphics.canvas,context:graphics.context,antialias:false,alpha:true,powerPreference:'default'}})(element);
   stage().dataset.renderer=graphics.type;
   graphics.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(world?.renderer().domElement===graphics.canvas)void recoverGlobe(true);});
   return instance;
  }catch(error){
   console.warn('Using the compatible globe renderer.',error.message);
   try{graphics.context.getExtension('WEBGL_lose_context')?.loseContext();}catch{}element.replaceChildren();
  }
 }
 stage().dataset.renderer='canvas';return createCanvasGlobe(element);
}
async function recoverGlobe(compatibility){
 if(recovering)return;
 recovering=true;forceCanvas=compatibility;
 const previous=world?.pointOfView(),wasActive=routeActive,old=world;++rendererGeneration;
 disposeSatelliteRenderer(old);world=null;globePromise=null;rendering=false;cancelCameraMove();
 observer?.disconnect();intersector?.disconnect();
 try{old?.pauseAnimation();old?._destructor?.();old?.renderer()?.dispose();}catch{}
 el('globe-canvas')?.replaceChildren();stage().dataset.ready='false';stage().dataset.rendering='loading';
 try{
  const restored=await initGlobe(globeSites,globePoints,selectSite);
  if(restored&&previous){restored.pointOfView(previous,0);recordCamera();}
  if(!wasActive)pauseGlobe();
 }finally{recovering=false;}
}
export async function initGlobe(sites,points,onSelect){
 globeSites=sites;globePoints=points;selectSite=onSelect;routeActive=true;
 if(world&&stage()?.dataset.ready==='true'){refreshGlobe();resumeGlobe();return world;}
 if(globePromise)return globePromise;
 const generation=++rendererGeneration;mountGlobeUI();void loadBaseImage();
 stage().setAttribute('aria-busy','true');stage().dataset.ready='false';
 stage().querySelectorAll('.globe-toolbar button,.globe-toolbar input,.globe-zoom button').forEach(control=>control.disabled=true);
 note('Loading the interactive globe...');
 globePromise=(async()=>{
  let instance;
  try{
   const graphics=graphicsContext();
   const [Globe,data,placeData]=await Promise.all([graphics.context?loadGlobe().catch(()=>null):Promise.resolve(null),geography(),dataFile('places.json').catch(()=>({places:[]}))]);
   if(generation!==rendererGeneration)return globePromise;
   const element=el('globe-canvas');
   placeIndex=[...data.features.map(f=>{const center=geoCentroid(f);return{name:f.properties.name,feature:f,lng:center[0],lat:center[1]};}),...(placeData.places||[]).map(p=>({name:p[0],country:p[1],lat:p[2],lng:p[3]}))];
   instance=createWorld(Globe,element,graphics);world=instance;
   instance.width(Math.max(1,element.clientWidth)).height(Math.max(1,element.clientHeight)).backgroundColor('rgba(0,0,0,0)').showAtmosphere(false)
    .polygonsData([]).polygonsTransitionDuration(0).pointsData([]).pointLat('lat').pointLng('lng').pointRadius(.48).pointResolution(12)
    .pointLabel(d=>'<div class="globe-tooltip"><strong>'+esc(d.siteName||d.name)+'</strong><br>'+(d.user?'Your observation / '+esc(d.date||'Date not supplied')+' / '+esc(d.value??'No value')+' '+esc(d.category||''):esc(conceptSnapshot.month||conceptSnapshot.date)+' / '+esc(d.name))+'</div>')
    .onPointClick(selectLocation).labelsData([]).labelLat('lat').labelLng('lng').labelText('name').labelColor(()=>'#f2f6fb')
    .labelSize(.5).labelAltitude(.018).labelDotRadius(.22).labelResolution(2).onLabelClick(selectLocation)
    .arcsData([]).ringsData([]).onGlobeClick(({lat,lng})=>selectLocation({name:lat.toFixed(3)+', '+lng.toFixed(3),lat,lng}));
   instance.pointsTransitionDuration?.(0);instance.labelsTransitionDuration?.(0);
   rendering=true;instance.renderer().setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.5));
   await prepareSatelliteRenderer(instance);
   if(generation!==rendererGeneration)return globePromise;
   const controls=instance.controls();rotating=false;controls.autoRotate=false;controls.autoRotateSpeed=.38;
   controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=108;controls.maxDistance=600;
   controls.addEventListener('start',()=>{if(instance!==world)return;stopRotation();cancelCameraMove();});
   controls.addEventListener('change',()=>{
    if(instance!==world)return;
    const altitude=instance.pointOfView().altitude;recordCamera();controls.rotateSpeed=Math.max(.06,Math.min(.8,altitude*.55));controls.zoomSpeed=Math.max(.35,Math.min(1,altitude));
   });
   instance.pointOfView({lat:15,lng:115,altitude:1.5},0);setPressed('globe-rotate',false);
   let previousWidth=0,previousHeight=0;
   observer=new ResizeObserver(()=>{
    if(instance!==world)return;
    const w=element.clientWidth,h=element.clientHeight;
    if(w&&h&&(w!==previousWidth||h!==previousHeight)){previousWidth=w;previousHeight=h;instance.width(w).height(h);recordCamera();}
    syncRendering();
   });observer.observe(element);
   intersector=new IntersectionObserver(entries=>{if(instance!==world)return;visible=entries[0].isIntersecting;syncRendering();},{threshold:.05});intersector.observe(element);
   if(!listenersBound){
    listenersBound=true;document.addEventListener('visibilitychange',syncRendering);
    motionQuery=matchMedia('(prefers-reduced-motion: reduce)');motionQuery.addEventListener('change',motionChanged);
   }
   visible=element.getBoundingClientRect().bottom>0&&element.getBoundingClientRect().top<innerHeight;
   setGlobeMode(globeMode);
   stage().querySelectorAll('.globe-toolbar button,.globe-toolbar input,.globe-zoom button').forEach(control=>control.disabled=false);
   stage().setAttribute('aria-busy','false');stage().dataset.ready='true';
   announceBasemap();syncRendering();recordCamera();note('Drag to rotate / scroll or pinch to zoom / select a study area');
   return instance;
  }catch(error){
   if(generation!==rendererGeneration)return globePromise;
   disposeSatelliteRenderer(instance);console.error('Globe initialization failed',error);
   observer?.disconnect();intersector?.disconnect();
   try{instance?.pauseAnimation();instance?.renderer()?.dispose();instance?._destructor?.();}catch{}
   if(world===instance)world=null;
   rendering=false;el('globe-canvas')?.replaceChildren();stage().setAttribute('aria-busy','false');stage().dataset.ready='false';globePromise=null;
   note('The globe could not start. Use Retry globe to try again.');
   if(!el('globe-retry')){
    const button=document.createElement('button');button.id='globe-retry';button.className='globe-retry';button.textContent='Retry globe';
    button.onclick=()=>{button.remove();void recoverGlobe(true);};stage().append(button);
   }
   return null;
  }
 })();
 return globePromise;
}
export function setGlobePoints(sites,points){globeSites=sites;globePoints=points;refreshGlobe();}
export function flyTo(lng,lat,altitude=.8){if(!world)return;stopRotation();moveCamera({lat,lng,altitude},reduced()?0:350);}
function syncRendering(){
 if(!world||!stage())return;
 const active=routeActive&&!document.hidden&&visible&&el('globe-canvas').getClientRects().length>0;
 stage().dataset.rendering=active?'active':'paused';
 if(active){refreshGlobe();drawSurface();}
 if(active===rendering)return;rendering=active;
 if(active)world.resumeAnimation();else{world.pauseAnimation();cancelCameraMove();}
}
function motionChanged(){stopRotation();cancelCameraMove();refreshGlobe();}
export function resumeGlobe(){routeActive=true;syncRendering();}
export function pauseGlobe(){routeActive=false;syncRendering();}
export function disposeGlobe(){
 pauseGlobe();++rendererGeneration;observer?.disconnect();intersector?.disconnect();observer=intersector=null;
 document.removeEventListener('visibilitychange',syncRendering);motionQuery?.removeEventListener('change',motionChanged);listenersBound=false;
 const old=world;disposeSatelliteRenderer(old);world=null;globePromise=null;rendering=false;visible=false;lastMarkers=null;
 satelliteImage=conceptImage=null;satelliteURL=null;satelliteDate=conceptImageDate='';
 try{old?.pauseAnimation();old?._destructor?.();old?.renderer()?.dispose();}catch{}
 el('globe-canvas')?.replaceChildren();
 if(stage()){stage().dataset.ready='false';stage().dataset.rendering='paused';}
}
function disposeSatelliteRenderer(instance){
 if(!instance||surfaceOwner!==instance)return;
 if(!instance.__compatibility){
  const current=instance.globeMaterial();
  for(const texture of new Set([lastSurfaceTexture,surfaceMaterial?.map,surfaceMaterial?.emissiveMap,originalMaterial?.map,current?.map]))texture?.dispose();
  for(const material of new Set([surfaceMaterial,originalMaterial,current]))material?.dispose();
 }
 lastSurface=null;surfaceOwner=null;surfaceReady=null;surfaceMaterial=null;originalMaterial=null;TextureType=null;textureOptions=null;lastSurfaceTexture=null;
}
// Bootstrap once; pinned globeImageUrl callbacks cannot cancel stale loads.
async function prepareSatelliteRenderer(instance){
 if(surfaceOwner===instance&&surfaceReady)return surfaceReady;
 surfaceOwner=instance;originalMaterial=instance.globeMaterial();TextureType=null;lastSurfaceTexture=null;
 if(instance.__compatibility){surfaceMaterial=originalMaterial;surfaceReady=Promise.resolve();return surfaceReady;}
 const Material=originalMaterial.constructor,seedMaterial=new Material({color:0x000000});seedMaterial.visible=false;instance.globeMaterial(seedMaterial);
 const seed=document.createElement('canvas');seed.width=seed.height=1;
 const seedURL=seed.toDataURL();instance.globeImageUrl(seedURL);
 surfaceReady=(async()=>{
  try{
   await new Promise((resolve,reject)=>{
    const started=performance.now();
    function check(){
     if(instance!==world)return reject(new Error('Globe renderer changed'));
     if(seedMaterial.map?.image?.src===seedURL)return resolve();
     if(performance.now()-started>5000)return reject(new Error('Texture renderer initialization timed out'));
     setTimeout(check,20);
    }check();
   });
   if(instance!==world)return;
   const texture=seedMaterial.map;TextureType=texture.constructor;
   textureOptions={colorSpace:texture.colorSpace,flipY:texture.flipY,minFilter:texture.minFilter,magFilter:texture.magFilter};
   surfaceMaterial=new Material({color:0x000000,emissive:0xffffff,emissiveIntensity:1,specular:0x000000,shininess:0,toneMapped:false});
   instance.globeImageUrl(null);instance.globeMaterial(surfaceMaterial);
   seedMaterial.map=null;texture.dispose();
  }finally{seedMaterial.map?.dispose();seedMaterial.dispose();}
 })();
 return surfaceReady;
}
function drawSurface(){
 if(!world||surfaceOwner!==world)return;
 const radar=globeMode==='satellite'?satelliteImage:null,vegetation=globeMode==='concept'?conceptImage:null;
 const context=globeMode==='concept'||geographicContext;
 if(stage()){
  stage().dataset.geographicContext=String(context);stage().dataset.basemap=baseImage?'ready':'reference';
  stage().dataset.radarVisible=String(Boolean(radar));stage().dataset.radarDate=radar?satelliteDate:'';stage().dataset.radarWidth=String(radar?.naturalWidth||0);
  stage().dataset.vegetationVisible=String(Boolean(vegetation));stage().dataset.vegetationDate=vegetation?conceptImageDate:'';
 }
 if(!routeActive||document.hidden||!visible)return;
 if(!world.__compatibility&&(!TextureType||!surfaceMaterial))return;
 const inputs=[world,countries,globeMode,radar||vegetation,context,baseImage,radar?satelliteDate:conceptImageDate];
 if(lastSurface&&inputs.every((value,i)=>value===lastSurface[i]))return;
 const canvas=composeSatelliteSurface(countries,radar||vegetation,context,baseImage);lastSurface=inputs;
 if(stage())stage().dataset.surfaceRevision=String(Number(stage().dataset.surfaceRevision||0)+1);
 if(world.__compatibility)world.globeSurfaceImage(canvas);
 else{
  if(!TextureType||!surfaceMaterial)return;
  // clone() shares Source in this Three version; construct an independent Source.
  const texture=new TextureType(canvas);Object.assign(texture,textureOptions);texture.needsUpdate=true;
  surfaceMaterial.map=texture;surfaceMaterial.emissiveMap=texture;surfaceMaterial.needsUpdate=true;surfaceMaterial.visible=true;
  world.globeMaterial(surfaceMaterial);lastSurfaceTexture?.dispose();lastSurfaceTexture=texture;
 }

}
export function setGeographicContext(enabled){geographicContext=Boolean(enabled);drawSurface();}
export function setGlobeMode(mode){
 const next=mode==='concept'?'concept':'satellite';if(globeMode!==next)++textureVersion;globeMode=next;
 if(stage())stage().dataset.mode=next;if(!world)return;
 stopRotation();world.showAtmosphere(false);world.polygonsTransitionDuration(0);
 world.pointsTransitionDuration?.(0);world.arcsTransitionDuration?.(0);world.labelsTransitionDuration?.(0);
 refreshGlobe();drawSurface();recordCamera();
}
export function hideSatelliteTexture(){satelliteURL=null;satelliteImage=null;satelliteDate='';++textureVersion;drawSurface();}
export async function setSatelliteTexture(url,decodedImage,date=satelliteDate){
 const instance=world,version=++textureVersion;if(!instance)return;
 await prepareSatelliteRenderer(instance);
 const image=decodedImage||new Image();
 if(!decodedImage){image.src=url;await image.decode();}
 if(version!==textureVersion||instance!==world||globeMode!=='satellite')return;
 satelliteURL=url;satelliteImage=image;satelliteDate=date;drawSurface();recordCamera();
}
export function getGlobeMarkers(){
 if(!world||!stage())return[];
 const camera=world.camera?.();if(camera){camera.aspect=world.width()/world.height();camera.updateProjectionMatrix();camera.updateMatrixWorld();}
 const view=world.pointOfView(),box=el('globe-canvas').getBoundingClientRect(),parent=stage().getBoundingClientRect();
 // A perspective camera sees less than a full hemisphere; do not label occluded land.
 const horizon=world.__compatibility?Math.PI/2:Math.acos(1/(1+Math.max(0,view.altitude)));
 return globeSites.map(site=>{
  const [lng,lat]=site.coordinates,p=world.getScreenCoords?.(lat,lng,.012);
  return{id:site.id,x:(p?.x||0)+box.left-parent.left,y:(p?.y||0)+box.top-parent.top,visible:!!p&&geoDistance([view.lng,view.lat],[lng,lat])<horizon};
 });
}
