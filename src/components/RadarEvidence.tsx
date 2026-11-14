import { useEffect,useMemo,useRef,useState } from 'react';
import { assetURL,safeURL } from '../core.js';
import { hosted } from '../api/client';
import { chart } from '../charts.js';
import { Markup } from './Markup';
import { demoPackage } from '../demo.js';
import { SiteTimeline } from './SiteTimeline';
import type { Site } from '../types';
type Frame={id?:string;date:string;url?:string;parameters?:{BBOX?:string};maturity:string;crid?:string;image?:string;channels?:Record<string,{image?:string;meanDb?:number;waterAreaKm2?:number}>;status?:string;reason?:string;track?:number;frame?:number;kind?:string;hdf5LayersVerified?:boolean;processingVersion?:string};
export function RadarEvidence({site,evidence,requestedDate,active}:{site:Site;evidence:any;requestedDate?:string;active:boolean}){
 const availableGibs:Frame[]=useMemo(()=>{
  const saved:Frame[]=evidence.gibs?.frames||[];
  if(!requestedDate||saved.some(f=>f.date.slice(0,10)===requestedDate))return saved;
  const source=saved.find(f=>f.url)?.url;
  let url:string|undefined;if(source){const u=new URL(source);u.searchParams.set('TIME',requestedDate);url=u.href;}
  return [...saved,{date:requestedDate,url,parameters:saved[0]?.parameters,maturity:'not available',status:'not available',reason:'The exact globe date is not saved in this site sequence.'}].sort((a,b)=>a.date.localeCompare(b.date));
 },[evidence,requestedDate]);
 const browse:Frame[]=evidence.browse?.frames||[], processed:Frame[]=(evidence.processed?.acquisitions||[]).map((f:any)=>({...f,crid:f.processingVersion}));
 const [display,setDisplay]=useState('timeline');
 const [mode,setMode]=useState('gibs'),[pol,setPol]=useState('HH'),[before,setBefore]=useState(0),[after,setAfter]=useState(0),[swipe,setSwipe]=useState(50),[map,setMap]=useState(false);
 const mapRef=useRef<HTMLDivElement>(null);
 const simulated=mode==='simulated',calibrated=mode==='processed';
 const frames:Frame[]=simulated?demoPackage.acquisitions.map((a:any)=>({...a,maturity:'SIMULATED',crid:'not applicable'})):calibrated?processed:mode==='gibs'?availableGibs:browse;
 const image=(f?:Frame)=>f?(mode==='gibs'?f.image:f.channels?.[pol]?.image):undefined;
 useEffect(()=>{setMode('gibs');setMap(false);},[site.id,evidence]);
 useEffect(()=>{
  const valid=frames.map((f,i)=>image(f)&&(hosted||assetURL(image(f)).startsWith('data:'))?i:-1).filter(i=>i>=0);
  setBefore(valid[0]??0);setAfter(mode==='gibs'&&requestedDate?Math.max(0,frames.findIndex(f=>f.date.slice(0,10)===requestedDate)):valid.at(-1)??0);setSwipe(50);
 },[mode,pol,evidence,requestedDate]);
 const a=frames[before],b=frames[after];
 const change=calibrated?evidence.processed?.comparisons?.find((c:any)=>c.before===a?.id&&c.after===b?.id&&c.channel===pol):null;
 useEffect(()=>{setDisplay(mode==='gibs'?'timeline':'swipe');},[mode]);
 useEffect(()=>{if(display==='change'&&!change)setDisplay('swipe');},[change,display]);
 const mixed=Boolean(a&&b&&(a.maturity!==b.maturity||(a.crid&&b.crid&&a.crid!==b.crid)));
 const chronological=!!a&&!!b&&a.date<b.date;
 const ready=!!image(a)&&!!image(b)&&chronological&&(!calibrated||!mixed);
 useEffect(()=>{
  if(!active||!map||!mapRef.current||!hosted)return;
  let disposed=false,cleanup:(()=>void)|undefined;
  import('../local-map.js').then(async({mountMap})=>{
   if(disposed)return;
   cleanup=await mountMap(mapRef.current!,site,null,'HH',[]);
   if(disposed)cleanup?.();
  }).catch(()=>{if(mapRef.current)mapRef.current.textContent='Detailed map not available. The saved image comparison remains usable.';});
  return()=>{disposed=true;cleanup?.();};
 },[map,site,active]);
 const title=simulated?'Practice with simulated images':mode==='gibs'?'Real radar images':mode==='browse'?'Regional radar views':'Measured radar change';
 const n=evidence.inventory?.n||0;
 const series=calibrated?evidence.series?.rows||[]:simulated?demoPackage.acquisitions.map((f:any)=>({date:f.date,HH:f.channels.HH.meanDb,HV:f.channels.HV.meanDb})):[]; 
 return <div className="radar-evidence">
 <div className="section-title"><div><p className="eyebrow">{site.name} / radar evidence</p><h2>{title}</h2></div><span className="mono">{simulated?'Simulated / no real observations':mode==='gibs'?availableGibs.filter(f=>f.image).length+' saved image dates':n+' catalog scenes'}</span></div>
 {requestedDate&&<p className="source-line">Globe date: {requestedDate}. The exact date is selected; an unsaved site image stays unavailable.</p>}
 <div className="radar-tabs" role="group" aria-label="Evidence source">{[['gibs','Radar images'],['browse','Regional radar views'],['processed','Measured change'],['simulated','Practice with simulated data']].map(([id,label])=><button key={id} onClick={()=>setMode(id)} aria-pressed={mode===id} disabled={id==='processed'&&!processed.length}>{label}</button>)}</div>
 <p id="radar-status" className="source-line" role="status">{simulated?'SIMULATED: invented images and values for practice.':mode==='gibs'?'Follow the same place through dated satellite radar images, or compare two dates side by side.':mode==='browse'?'These real radar images show a broader region around the site. Their display brightness can differ.':'Measured products derived from radar data. Check processing details before comparing.'}</p>
 <div className="radar-tabs" role="group" aria-label="Comparison display">
 {mode==='gibs'&&<button onClick={()=>setDisplay('timeline')} aria-pressed={display==='timeline'}>Watch through time</button>}
 <button onClick={()=>setDisplay('swipe')} aria-pressed={display==='swipe'}>Before / after</button>
 {calibrated&&<button disabled={!change||mixed} onClick={()=>setDisplay('change')} aria-pressed={display==='change'}>Measured change layer</button>}
 </div>
 {mode==='gibs'&&<div hidden={display!=='timeline'}><SiteTimeline siteName={site.name} frames={availableGibs} index={after} onIndexChange={setAfter} active={active&&display==='timeline'}/></div>}
 <details className="reading-notes"><summary>Radar channels and processing details</summary>
 <div className="radar-tabs" role="group" aria-label="Radar polarization">
 {mode==='gibs'?<button aria-pressed="true">NASA false-color browse</button>:['HH','HV','ratio','composite',...(processed.some(f=>f.channels?.VV&&f.hdf5LayersVerified)?['VV']:[])].map(p=><button key={p} data-pol={p} aria-pressed={pol===p} disabled={!frames.some(f=>f.channels?.[p]?.image)} onClick={()=>setPol(p)}>{p==='ratio'?'HH/HV ratio':p==='composite'?'Computed composite':p}</button>)}
 </div>
 <p className="pol-explanation">{mode==='gibs'?'NASA browse combines co-polarized and cross-polarized returns. Its colors are not the computed R=HH, G=HV, B=HH/HV composite.':'HH shows surface scattering; HV responds to structure within vegetation. HH/HV is a power ratio (or HH dB minus HV dB). The computed composite uses R=HH, G=HV, B=HH/HV; it requires both measured channels.'}</p>
 <p>GIBS images are daily false-color mosaics, not calibrated measurements. The displayed date identifies the mosaic; contributing acquisition times, maturity and processing version are not available for individual pixels. No 12-day rolling layer is substituted.</p>
 <p>Regional HH/HV quicklooks are downsampled and can use different display stretches. HH describes same-polarization returns; HV describes cross-polarization returns. Neither alone measures crop health or water level.</p></details>
 {display!=='timeline'&&<div>
 <div className="acquisition-controls"><label>Before<select id="before-date" value={before} onChange={e=>setBefore(Number(e.target.value))}>{frames.map((f,i)=><option key={i} value={i}>{f.date.slice(0,10)}{!image(f)?' · not available':''}</option>)}</select></label><label>After<select id="after-date" value={after} onChange={e=>setAfter(Number(e.target.value))}>{frames.map((f,i)=><option key={i} value={i}>{f.date.slice(0,10)}{!image(f)?' · not available':''}</option>)}</select></label></div>
 {mixed&&<p className="error-message">Different maturity or CRID. Quantitative comparison is blocked.</p>}
 <div id="radar-stage-container">
 {display==='change'&&change&&!mixed?<><div className="radar-stage"><img src={assetURL(change.image)} alt={'Measured after-minus-before '+pol+' backscatter change, '+a?.date+' to '+b?.date+', '+a?.maturity}/><span className="image-label">{a?.maturity} / CRID {a?.crid}</span></div><p className="source-line">After minus before; grayscale display from -6 dB (dark) to +6 dB (light). This is not automatically water gain or loss.</p></>:ready?<><div className={'radar-stage '+(mode==='browse'?'regional-stage':'')}><img src={assetURL(image(a))} alt={(simulated?'Simulated':mode==='gibs'?'Real false-color NISAR browse':'Real NISAR '+pol+' regional browse')+' before, '+a.date+', '+a.maturity+'; downsampled'}/><div className="compare-after" style={{clipPath:'inset(0 0 0 '+swipe+'%)'}}><img src={assetURL(image(b))} alt={(simulated?'Simulated':'Real NISAR browse')+' after, '+b.date+', '+b.maturity+'; downsampled'}/></div><span className="swipe-divider" style={{left:swipe+'%'}}/><span className="image-label">Before / {a.date.slice(0,10)}<br/>{a.maturity}</span><span className="image-label right">After / {b.date.slice(0,10)}<br/>{b.maturity}</span></div><label className="swipe-control">Move the image divider<input id="swipe-range" aria-label="Before and after image divider" type="range" min="0" max="100" value={swipe} onChange={e=>setSwipe(Number(e.target.value))}/><output>{swipe}%</output></label></>:<div className="empty-image" role="status">{frames.length===0?'Browse imagery not available.':!chronological?'Choose an earlier before date and a later after date.':'Image not available for this date. '+(b?.reason||'Missing data are not replaced with simulated imagery.')}</div>}
 </div>
 <p className="source-line">{simulated?'Source: team simulation, no satellite measurements':'Source: NASA / ISRO NISAR via '+(mode==='gibs'?'NASA GIBS':'ASF DAAC')}. Dates: {a?.date.slice(0,10)||'unavailable'} to {b?.date.slice(0,10)||'unavailable'}.{mode==='gibs'&&b?.url&&<> <a href={safeURL(b.url)} target="_blank" rel="noopener">Open the later image at NASA</a></>}</p>
 <details className="reading-notes"><summary>Comparison metadata</summary><p>{a?.maturity||'Maturity unavailable'} / processing version {a?.crid||'unavailable'}. {a?.track?'Track '+a.track+', frame '+a.frame+'.':''} Downsampled images. Different maturity or processing versions cannot support quantitative comparison.</p></details>
 <label className="timeline-control">Date sequence <output>{b?.date.slice(0,10)||'not available'}</output><input id="date-slider" aria-label="Radar date sequence" type="range" min="0" max={Math.max(0,frames.length-1)} value={after} onChange={e=>setAfter(Number(e.target.value))} disabled={!frames.length}/></label>
 <div className="acquisition-strip" aria-label="Date availability">{frames.map((f,i)=><button key={i} aria-label={f.date.slice(0,10)+(image(f)?' available':' not available')} title={f.date.slice(0,10)+(image(f)?' available':' not available')} aria-pressed={i===after} className={image(f)?'has-data':'no-data'} onClick={()=>setAfter(i)}/>)}</div>
 <p className="source-line">12-day sampling plus actual acquisition dates. Missing dates stay visible. Permanent mission gap: 27 July 22:03 UTC–10 August 00:55 UTC, 2026.</p>
 </div>}
 <details className="reading-notes"><summary>{series.length?'Quantitative measurements':'Quantitative measurements (not available)'}</summary>
 {series.length?<> <div className="chart-grid"><section><h3>{simulated?'Simulated ':''}Backscatter · n = {series.length}{simulated?' simulated samples':' scenes'}</h3><Markup html={chart(series,{key:pol==='HV'?'HV':'HH',label:simulated?'Simulated backscatter':'Mean gamma-0 backscatter',unit:'dB',color:'var(--ink)',annotation:simulated?'Simulated values; not NISAR measurements.':'Source: NASA/ISRO NISAR via ASF DAAC · '+(a?.maturity||'not available')+' · CRID '+(a?.crid||'not available')+' · Chart: team.'})}/></section><section><h3>Candidate water area · n = {calibrated?series.filter((r:any)=>r.waterAreaKm2!=null).length:0} scenes</h3><Markup html={chart(calibrated?series:[],{key:'waterAreaKm2',label:'Candidate water area',unit:'km²',annotation:'Not available until calibrated pixels and masks are processed. A threshold needs independent OPERA validation. Area is not volume.'})}/></section></div>
</>:<p>Calibrated backscatter and candidate water-area measurements have not been calculated for this site. The real images above remain available to explore; their colors cannot supply those numbers.</p>}
 </details>
 <details className="reading-notes"><summary>How to read water, crops, forest and buildings</summary><p>Typical behavior from SAR literature, not a finding at this site: smooth open water can be dark; wind and flooded vegetation can brighten it. Rice changes with flooding, growth and harvest. Forest volume scattering often raises HV. Buildings can give bright returns and dark radar shadows. Neither dark pixels nor HH/HV alone establish drought, crop health or biomass change.</p><p>VV appears only after a source HDF5 layer has been inspected. Sentinel-1 VV is C-band and must remain a separately labeled source.</p></details>
 <button className="button secondary" id="pending-map" disabled={!hosted} onClick={()=>setMap(v=>!v)}>{map?'Close detailed map':'Open detailed site map'}</button>{map&&<div ref={mapRef} id="context-map" role="region" aria-label="Detailed site map"/>}
 </div>;
}
