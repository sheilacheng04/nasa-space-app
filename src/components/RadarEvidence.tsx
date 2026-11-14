import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { assetURL,safeURL } from '../core.js';
import { hosted } from '../api/client';
import { chart } from '../charts.js';
import { Markup } from './Markup';
import { demoPackage } from '../demo.js';
import { SiteTimeline } from './SiteTimeline';
import {knownMetadata,footprintOverlap,coverageExplanation,radarMetadata,radarUnavailable,comparisonGuidance} from '../radar-data.js';
import '../radar-evidence.css';
import type { Site } from '../types';
import {siteHash,frameIndex,includeDates} from '../selection-url.js';
import type {SiteSelection,HistoryMode} from '../selection-url.js';
import type {SiteMapController} from '../local-map.js';
type Frame={id?:string;date:string;url?:string;parameters?:{BBOX?:string};maturity:string;crid?:string;image?:string;channels?:Record<string,{image?:string;meanDb?:number;waterAreaKm2?:number;reason?:string}>;status?:string;reason?:string;track?:number|string;frame?:number|string;direction?:string;kind?:string;hdf5LayersVerified?:boolean;processingVersion?:string};
function FrameMetadata({frame,mode,pol,label}:{frame:Frame|undefined;mode:string;pol:string;label:string}){
 return <div className="radar-record"><strong>{label}: {frame?.date||'Date not available'}{mode==='gibs'?' (mosaic date)':' (UTC)'}</strong><dl>{mode!=='gibs'&&mode!=='simulated'&&<div><dt>Channel</dt><dd>{pol}</dd></div>}{radarMetadata(frame,mode).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}{mode==='browse'&&<div><dt>Catalog footprint overlap of study box</dt><dd>{footprintOverlap((frame as Frame&{bboxCoverageFraction?:number})?.bboxCoverageFraction)}</dd></div>}</dl></div>;
}
export function RadarEvidence({site,evidence,selection,onSelection,navigationKey,active,mapOpen,setMapOpen}:{site:Site;evidence:any;selection:SiteSelection;onSelection:(siteId:string,selection:SiteSelection,history?:HistoryMode)=>void;navigationKey:number;active:boolean;mapOpen:boolean;setMapOpen:(value:boolean)=>void}){
 const processed:Frame[]=(evidence.processed?.acquisitions||[]).map((f:any)=>({...f,crid:f.processingVersion}));
 const mode=selection.source==='processed'&&!processed.length?'gibs':selection.source||'gibs';
 const baseFrames:Frame[]=useMemo(()=>mode==='simulated'?demoPackage.acquisitions.map((f:any)=>({...f,maturity:'SIMULATED',crid:'not applicable'})):mode==='processed'?processed:mode==='gibs'?evidence.gibs?.frames||[]:evidence.browse?.frames||[],[mode,evidence]);
 const pol=mode==='gibs'?'HH':selection.channel&&baseFrames.some(f=>f.channels?.[selection.channel!]?.image)?selection.channel:'HH';
 const frames=useMemo(()=>includeDates(baseFrames,[selection.date,selection.before,selection.after],date=>{
  const sample=baseFrames.find(f=>f.url);let url:string|undefined;
  if(mode==='gibs'&&sample?.url){const parsed=new URL(sample.url);parsed.searchParams.set('TIME',date);url=parsed.href;}
  return {date,url,parameters:sample?.parameters,maturity:mode==='simulated'?'SIMULATED':'not available',reason:'This exact date is not saved in the selected evidence sequence.'};
 }),[baseFrames,selection.date,selection.before,selection.after,mode]);
 const availableGibs:Frame[]=mode==='gibs'?frames:evidence.gibs?.frames||[];
 const image=(f?:Frame)=>f?(mode==='gibs'?f.image:f.channels?.[pol]?.image):undefined;
 const available=frames.map((f,i)=>image(f)&&(hosted||assetURL(image(f)).startsWith('data:'))?i:-1).filter(i=>i>=0);
 const before=selection.before?Math.max(0,frameIndex(frames,selection.before)):available[0]??0;
 const after=selection.after||selection.date?Math.max(0,frameIndex(frames,selection.after||selection.date)):available.at(-1)??0;
 const a=frames[before],b=frames[after];
 const change=mode==='processed'?evidence.processed?.comparisons?.find((c:any)=>c.before===a?.id&&c.after===b?.id&&c.channel===pol):null;
 const display=selection.view==='change'&&!change?'swipe':selection.view==='timeline'&&mode!=='gibs'?'swipe':selection.view||(mode==='gibs'?'timeline':'swipe');
 const simulated=mode==='simulated',calibrated=mode==='processed',requestedDate=selection.after||selection.date;
 const [swipe,setSwipe]=useState(50);const mapRef=useRef<HTMLDivElement>(null);
 function publish(patch:SiteSelection,history:HistoryMode='push'){
  onSelection(site.id,{source:mode,channel:pol,view:display,date:b?.date,before:a?.date,after:b?.date,...patch},history);
 }
 function setMode(source:SiteSelection['source']){if(source===mode){if(selection.source&&selection.source!==source)publish({source});return;}onSelection(site.id,{source,channel:pol,view:source==='gibs'?'timeline':'swipe'});}
 const setPol=(channel:string)=>{if(channel!==pol)publish({channel});};
 const setDisplay=(view:SiteSelection['view'])=>{if(view!==display)publish({view});};
 const setBefore=(index:number)=>{if(index!==before)publish({before:frames[index]?.date});};
 const setAfter=(index:number,history:HistoryMode='push')=>{if(index!==after)publish({date:frames[index]?.date,after:frames[index]?.date},history);};
 const mixed=['maturity','crid'].some(key=>{const first=knownMetadata(a?.[key as 'maturity'|'crid']),last=knownMetadata(b?.[key as 'maturity'|'crid']);return first!==null&&last!==null&&first!==last;});
 const chronological=!!a&&!!b&&a.date<b.date;
 const ready=!!image(a)&&!!image(b)&&chronological&&(!calibrated||!mixed);
 const pairKey=[mode,pol,a?.date,b?.date,image(a),image(b)].join('|');
 const [pairLoad,setPairLoad]=useState({key:'',status:'loading'}),[pairRetry,setPairRetry]=useState(0);
 const pairStatus=pairLoad.key===pairKey?pairLoad.status:'loading';
 useLayoutEffect(()=>{
  if(!active||display!=='swipe'||!ready)return;
  let live=true;const images=[new Image(),new Image()];let timer:ReturnType<typeof setTimeout>;
  setPairLoad({key:pairKey,status:'loading'});
  images[0].src=assetURL(image(a));images[1].src=assetURL(image(b));
  void Promise.race([Promise.all(images.map(img=>img.decode())),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timed out')),10000);})])
   .then(()=>{if(live)setPairLoad({key:pairKey,status:'ready'});})
   .catch(()=>{if(live)setPairLoad({key:pairKey,status:'error'});})
   .finally(()=>clearTimeout(timer));
  return()=>{live=false;clearTimeout(timer);images.forEach(img=>img.removeAttribute('src'));};
 },[active,display,ready,pairKey,pairRetry]);
 const missingFrame=!image(b)?b:a;
 const absent=radarUnavailable(missingFrame?{...missingFrame,reason:missingFrame.channels?.[pol]?.reason||missingFrame.reason}:undefined,evidence.inventory?.scenes,mode);
 const mapController=useRef<SiteMapController|null>(null);
 const selectedMap=useRef({site,acquisition:b,pol,layers:evidence.processed?.contextLayers||[],options:{mode,catalog:evidence.inventory?.scenes||[]}});
 selectedMap.current={site,acquisition:b,pol,layers:evidence.processed?.contextLayers||[],options:{mode,catalog:evidence.inventory?.scenes||[]}};
 useLayoutEffect(()=>{
  const next=selectedMap.current;
  mapController.current?.update(next.site,next.acquisition,next.pol,next.layers,next.options);
 },[site.id,mode,pol,b?.date,b?.id,image(b),evidence]);
 useEffect(()=>{
  if(!active||!mapOpen||!mapRef.current||!hosted)return;
  let disposed=false,controller:SiteMapController|undefined;
  import('../local-map.js').then(async({mountMap})=>{
   if(disposed)return;
   const next=selectedMap.current;
   controller=await mountMap(mapRef.current!,next.site,next.acquisition,next.pol,next.layers,next.options);
   if(disposed){controller.dispose();return;}
   mapController.current=controller;
   const latest=selectedMap.current;controller.update(latest.site,latest.acquisition,latest.pol,latest.layers,latest.options);
  }).catch(()=>{if(!disposed&&mapRef.current)mapRef.current.textContent='Detailed map not available. The saved image comparison remains usable.';});
  return()=>{disposed=true;mapController.current=null;controller?.dispose();};
 },[mapOpen,active]);
 const title=simulated?'Practice with simulated images':mode==='gibs'?'Real radar images':mode==='browse'?'Regional radar views':'Measured radar change';
 const n=evidence.inventory?.n||0;
 const series=calibrated?evidence.series?.rows||[]:simulated?demoPackage.acquisitions.map((f:any)=>({date:f.date,HH:f.channels.HH.meanDb,HV:f.channels.HV.meanDb})):[]; 
 return <div className="radar-evidence">
 <div className="section-title"><div><p className="eyebrow">{site.name} / radar evidence</p><h2>{title}</h2></div><span className="mono">{simulated?'Simulated / no real observations':mode==='gibs'?availableGibs.filter(f=>f.image).length+' saved image dates':n+' catalog scenes'}</span></div>
 {selection.source==='processed'&&!processed.length&&<p role="status">Requested measured products are unavailable. Showing browse evidence with the requested dates retained.</p>}
 {selection.channel&&selection.channel!==pol&&mode!=='gibs'&&<p role="status">Requested channel is unavailable in this source. Showing HH with the requested dates retained.</p>}
 {simulated&&<p id="radar-status" role="status">SIMULATED: invented images and values for practice.</p>}
 <div className="radar-tabs" role="group" aria-label="Comparison display">
 {mode==='gibs'&&<button onClick={()=>setDisplay('timeline')} aria-pressed={display==='timeline'}>Watch through time</button>}
 <button onClick={()=>setDisplay('swipe')} aria-pressed={display==='swipe'}>Before / after</button>
 {calibrated&&<button disabled={!change||mixed} onClick={()=>setDisplay('change')} aria-pressed={display==='change'}>Measured change layer</button>}
 </div>
 {mode==='gibs'&&<div hidden={display!=='timeline'}><SiteTimeline siteName={site.name} frames={availableGibs} index={after} onIndexChange={setAfter} navigationKey={navigationKey} active={active&&display==='timeline'} scenes={evidence.inventory?.scenes}/></div>}
 {display!=='timeline'&&<div>
 <div className="acquisition-controls"><label>Before<select id="before-date" value={before} onChange={e=>setBefore(Number(e.target.value))}>{frames.map((f,i)=><option key={i} value={i}>{f.date.slice(0,10)}{!image(f)?' · not available':''}</option>)}</select></label><label>After<select id="after-date" value={after} onChange={e=>setAfter(Number(e.target.value))}>{frames.map((f,i)=><option key={i} value={i}>{f.date.slice(0,10)}{!image(f)?' · not available':''}</option>)}</select></label></div>

 <p className="radar-comparison-guidance" id="radar-comparison-guidance">{comparisonGuidance(a,b,mode)}</p>
 {mode==='browse'&&<details className="reading-notes"><summary>What footprint overlap means</summary><p>{coverageExplanation}</p></details>}
 {mixed&&<p className="error-message">Different maturity or CRID. Quantitative comparison is blocked.</p>}
 <div id="radar-stage-container">
 {display==='change'&&change&&!mixed?<><div className="radar-stage"><img src={assetURL(change.image)} alt={'Measured after-minus-before '+pol+' backscatter change, '+a?.date+' to '+b?.date+', '+a?.maturity}/><span className="image-label">{a?.maturity} / CRID {a?.crid}</span></div><p className="source-line">After minus before; grayscale display from -6 dB (dark) to +6 dB (light). This is not automatically water gain or loss.</p></>:ready&&pairStatus==='ready'?<><div className={'radar-stage '+(mode==='browse'?'regional-stage':'')}><img src={assetURL(image(a))} alt={(simulated?'Simulated':mode==='gibs'?'Real false-color NISAR browse':'Real NISAR '+pol+' regional browse')+' before, '+a.date+', '+a.maturity+'; downsampled'}/><div className="compare-after" style={{clipPath:'inset(0 0 0 '+swipe+'%)'}}><img src={assetURL(image(b))} alt={(simulated?'Simulated':'Real NISAR browse')+' after, '+b.date+', '+b.maturity+'; downsampled'}/></div><span className="swipe-divider" style={{left:swipe+'%'}}/><span className="image-label">Before / {a.date.slice(0,10)}<br/>{a.maturity}</span><span className="image-label right">After / {b.date.slice(0,10)}<br/>{b.maturity}</span></div><label className="swipe-control">Move the image divider<input id="swipe-range" aria-label="Before and after image divider" type="range" min="0" max="100" value={swipe} onChange={e=>setSwipe(Number(e.target.value))}/><output>{swipe}%</output></label></>:<div className="empty-image" role="status">{ready?<><strong>{pairStatus==='error'?'Comparison image request failed':'Loading selected comparison images...'}</strong><p>{pairStatus==='error'?'One or both images could not load. Dates are preserved; no previous images are shown.':'Waiting for both selected images; previous images are cleared.'}</p>{pairStatus==='error'&&<button onClick={()=>setPairRetry(n=>n+1)}>Retry comparison images</button>}</>:!image(a)||!image(b)?<><strong>{absent.title}</strong><p>{absent.description}</p></>:!chronological?'Choose an earlier before date and a later after date.':'Quantitative comparison is blocked; check compatibility metadata.'}</div>}
 </div>
 <p className="source-line">{simulated?'Source: team simulation, no satellite measurements':'Source: NASA / ISRO NISAR via '+(mode==='gibs'?'NASA GIBS':'ASF DAAC')}. Dates: {a?.date.slice(0,10)||'unavailable'} to {b?.date.slice(0,10)||'unavailable'}.{mode==='gibs'&&b?.url&&<> <a href={safeURL(b.url)} target="_blank" rel="noopener">Open the later image at NASA</a></>}</p>
 <details className="reading-notes"><summary>Comparison metadata</summary><p>{a?.maturity||'Maturity unavailable'} / processing version {a?.crid||'unavailable'}. {a?.track?'Track '+a.track+', frame '+a.frame+'.':''} Downsampled images. Different maturity or processing versions cannot support quantitative comparison.</p></details>
 <label className="timeline-control">Date sequence <output>{b?.date.slice(0,10)||'not available'}</output><input id="date-slider" aria-label="Radar date sequence" type="range" min="0" max={Math.max(0,frames.length-1)} value={after} onChange={e=>setAfter(Number(e.target.value),'replace')} disabled={!frames.length}/></label>
 <div className="acquisition-strip" aria-label="Date availability">{frames.map((f,i)=><button key={i} aria-label={f.date.slice(0,10)+(image(f)?' available':' not available')} title={f.date.slice(0,10)+(image(f)?' available':' not available')} aria-pressed={i===after} className={image(f)?'has-data':'no-data'} onClick={()=>setAfter(i)}/>)}</div>
 <p className="source-line">12-day sampling plus actual acquisition dates. Missing dates stay visible. Permanent mission gap: 27 July 22:03 UTC–10 August 00:55 UTC, 2026.</p>
 </div>}
 <section className="radar-about" aria-labelledby="radar-about-heading">
 <h3 id="radar-about-heading">About this view</h3>
 <p id="radar-interpretation">{simulated?'These practice images and values are invented.':calibrated?'Processed radar products; review the processing record before interpreting changes.':mode==='gibs'?'These are real, false-color radar previews of the selected area. The date identifies a daily mosaic, not a single acquisition.':'These real radar previews cover a wider region around the selected site.'}</p>
 <p>Smooth water can look dark; rough ground, plants, and buildings can look bright. Checkered areas have no displayed coverage.</p>
 <p>Colors alone cannot measure water levels, crop damage, or explain what caused a change.</p>
 {mode==='gibs'&&<p>{availableGibs.filter(f=>f.image).length} saved images across {availableGibs.length} sampled dates. Missing dates are unknown, not unchanged.</p>}
 <details className="reading-notes"><summary>Selected image and source details</summary>
 {display==='timeline'&&<div className="radar-records"><FrameMetadata frame={b} mode={mode} pol={pol} label="Selected"/></div>}
 <details className="reading-notes"><summary>Radar channels and processing details</summary>
 <div className="radar-tabs" role="group" aria-label="Radar polarization">
 {mode==='gibs'?<button aria-pressed="true">NASA false-color browse</button>:['HH','HV','ratio','composite',...(processed.some(f=>f.channels?.VV&&f.hdf5LayersVerified)?['VV']:[])].map(p=><button key={p} data-pol={p} aria-pressed={pol===p} disabled={!frames.some(f=>f.channels?.[p]?.image)} onClick={()=>setPol(p)}>{p==='ratio'?'HH/HV ratio':p==='composite'?'Computed composite':p}</button>)}
 </div>
 <p className="pol-explanation">{mode==='gibs'?'NASA browse combines co-polarized and cross-polarized returns. Its colors are not the computed R=HH, G=HV, B=HH/HV composite.':'HH shows surface scattering; HV responds to structure within vegetation. HH/HV is a power ratio (or HH dB minus HV dB). The computed composite uses R=HH, G=HV, B=HH/HV; it requires both measured channels.'}</p>
 <p>GIBS images are daily false-color mosaics, not calibrated measurements. The displayed date identifies the mosaic; contributing acquisition times, maturity and processing version are not available for individual pixels. No 12-day rolling layer is substituted.</p>
 <p>Regional HH/HV quicklooks are downsampled and can use different display stretches. HH describes same-polarization returns; HV describes cross-polarization returns. Neither alone measures crop health or water level.</p></details>
 {display!=='timeline'&&<> <div className="radar-records"><FrameMetadata frame={a} mode={mode} pol={pol} label="Before"/><FrameMetadata frame={b} mode={mode} pol={pol} label="After"/></div></>}
 </details>
 <details className="reading-notes"><summary>{series.length?'Quantitative measurements':'Quantitative measurements (not available)'}</summary>
 {series.length?<> <div className="chart-grid"><section><h3>{simulated?'Simulated ':''}Backscatter · n = {series.length}{simulated?' simulated samples':' scenes'}</h3><Markup html={chart(series,{key:pol==='HV'?'HV':'HH',label:simulated?'Simulated backscatter':'Mean gamma-0 backscatter',unit:'dB',color:'var(--ink)',annotation:simulated?'Simulated values; not NISAR measurements.':'Source: NASA/ISRO NISAR via ASF DAAC · '+(a?.maturity||'not available')+' · CRID '+(a?.crid||'not available')+' · Chart: team.'})}/></section><section><h3>Candidate water area · n = {calibrated?series.filter((r:any)=>r.waterAreaKm2!=null).length:0} scenes</h3><Markup html={chart(calibrated?series:[],{key:'waterAreaKm2',label:'Candidate water area',unit:'km²',annotation:'Not available until calibrated pixels and masks are processed. A threshold needs independent OPERA validation. Area is not volume.'})}/></section></div>
</>:<p>Calibrated backscatter and candidate water-area measurements have not been calculated for this site. The real images above remain available to explore; their colors cannot supply those numbers.</p>}
 </details>
 <details className="reading-notes"><summary>How to read water, crops, forest and buildings</summary><p>Typical behavior from SAR literature, not a finding at this site: smooth open water can be dark; wind and flooded vegetation can brighten it. Rice changes with flooding, growth and harvest. Forest volume scattering often raises HV. Buildings can give bright returns and dark radar shadows. Neither dark pixels nor HH/HV alone establish drought, crop health or biomass change.</p><p>VV appears only after a source HDF5 layer has been inspected. Sentinel-1 VV is C-band and must remain a separately labeled source.</p></details>
 </section>
 <button className="button secondary" id="pending-map" disabled={!hosted} onClick={()=>setMapOpen(!mapOpen)}>{mapOpen?'Close detailed map':'Open detailed site map'}</button>{mapOpen&&<div ref={mapRef} id="context-map" role="region" aria-label="Detailed site map"/>}
 </div>;
}
