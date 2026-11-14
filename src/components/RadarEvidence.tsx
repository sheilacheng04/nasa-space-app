import { useEffect,useRef,useState } from 'react';
import { assetURL,formatDate } from '../core.js';
import { hosted } from '../api/client';
import { chart } from '../charts.js';
import { Markup } from './Markup';
import { demoPackage } from '../demo.js';
import type { Site } from '../types';
type Frame={id?:string;date:string;maturity:string;crid?:string;image?:string;channels?:Record<string,{image?:string;meanDb?:number;waterAreaKm2?:number}>;status?:string;reason?:string;track?:number;frame?:number;kind?:string;hdf5LayersVerified?:boolean;processingVersion?:string};
export function RadarEvidence({site,evidence,requestedDate}:{site:Site;evidence:any;requestedDate?:string}){
 const savedGibs:Frame[]=evidence.gibs?.frames||[];
 const availableGibs:Frame[]=requestedDate&&!savedGibs.some(f=>f.date.slice(0,10)===requestedDate)?[...savedGibs,{date:requestedDate,maturity:'not available',status:'not available',reason:'The exact globe date is not saved in this site sequence.'}].sort((a,b)=>a.date.localeCompare(b.date)):savedGibs;
 const browse:Frame[]=evidence.browse?.frames||[], processed:Frame[]=(evidence.processed?.acquisitions||[]).map((f:any)=>({...f,crid:f.processingVersion}));
 const [display,setDisplay]=useState('swipe');
 const [mode,setMode]=useState('gibs'),[pol,setPol]=useState('HH'),[before,setBefore]=useState(0),[after,setAfter]=useState(0),[swipe,setSwipe]=useState(50),[map,setMap]=useState(false);
 const mapRef=useRef<HTMLDivElement>(null);
 const simulated=mode==='simulated',calibrated=mode==='processed';
 const frames:Frame[]=simulated?demoPackage.acquisitions.map((a:any)=>({...a,maturity:'SIMULATED',crid:'not applicable'})):calibrated?processed:mode==='gibs'?availableGibs:browse;
 const image=(f?:Frame)=>f?(mode==='gibs'?f.image:f.channels?.[pol]?.image):undefined;
 useEffect(()=>{
  const next=availableGibs.some(f=>f.image)?'gibs':browse.some(f=>f.channels?.HH?.image)?'browse':processed.length?'processed':'gibs';
  setMode(next);setMap(false);
 },[site.id,evidence]);
 useEffect(()=>{
  const valid=frames.map((f,i)=>image(f)?i:-1).filter(i=>i>=0);
  setBefore(valid[0]??0);setAfter(mode==='gibs'&&requestedDate?Math.max(0,frames.findIndex(f=>f.date.slice(0,10)===requestedDate)):valid.at(-1)??0);setSwipe(50);
 },[mode,pol,evidence,requestedDate]);
 const a=frames[before],b=frames[after];
 const change=calibrated?evidence.processed?.comparisons?.find((c:any)=>c.before===a?.id&&c.after===b?.id&&c.channel===pol):null;
 useEffect(()=>{setDisplay('swipe');},[mode,pol,before,after]);
 const mixed=Boolean(a&&b&&(a.maturity!==b.maturity||(a.crid&&b.crid&&a.crid!==b.crid)));
 const chronological=!!a&&!!b&&a.date<b.date;
 const ready=!!image(a)&&!!image(b)&&chronological&&(!calibrated||!mixed);
 useEffect(()=>{
  if(!map||!mapRef.current||!hosted)return;
  let disposed=false,cleanup:(()=>void)|undefined;
  import('../local-map.js').then(async({mountMap})=>{
   if(disposed)return;
   cleanup=await mountMap(mapRef.current!,site,null,'HH',[]);
   if(disposed)cleanup?.();
  }).catch(()=>{if(mapRef.current)mapRef.current.textContent='Detailed map not available. The saved image comparison remains usable.';});
  return()=>{disposed=true;cleanup?.();};
 },[map,site]);
 const title=simulated?'Simulated comparison':mode==='gibs'?'NISAR at this site':mode==='browse'?'NISAR regional quicklooks':'GCOV measurements';
 const n=evidence.inventory?.n||0;
 const series=calibrated?evidence.series?.rows||[]:simulated?demoPackage.acquisitions.map((f:any)=>({date:f.date,HH:f.channels.HH.meanDb,HV:f.channels.HV.meanDb})):[]; 
 return <div className="radar-evidence">
 <div className="section-title"><div><p className="eyebrow">{site.name} / radar evidence</p><h2>{title}</h2></div><span className="mono">{simulated?'n = 0 real scenes':n+' catalog scenes'}</span></div>
 {requestedDate&&<p className="source-line">Globe date: {requestedDate}. The exact date is selected; an unsaved site image stays unavailable.</p>}
 <div className="radar-tabs" role="group" aria-label="Evidence source">{[['gibs','Site browse'],['browse','Regional HH / HV'],['processed','GCOV measurements'],['simulated','Simulated demo']].map(([id,label])=><button key={id} onClick={()=>setMode(id)} aria-pressed={mode===id} disabled={id==='processed'&&!processed.length}>{label}</button>)}</div>
 <p id="radar-status" className="source-line" role="status">{simulated?'SIMULATED: invented geometry and values. No site observations.':mode==='gibs'?'Real daily NASA GIBS browse, false color, not calibrated. The named 12-day rolling layer was absent from GetCapabilities. Mosaic lineage and pixel-level maturity are not available.':mode==='browse'?'Real same-track regional HH/HV browse. Downsampled; not calibrated. These images cover a broader area than this site. Display stretches may differ.':'Calibrated GCOV derived products; inspect masks and validation limits below.'}</p>
 <div className="radar-tabs" role="group" aria-label="Radar polarization">
 {mode==='gibs'?<button aria-pressed="true">NASA false-color browse</button>:['HH','HV','ratio','composite',...(processed.some(f=>f.channels?.VV&&f.hdf5LayersVerified)?['VV']:[])].map(p=><button key={p} data-pol={p} aria-pressed={pol===p} disabled={!frames.some(f=>f.channels?.[p]?.image)} onClick={()=>setPol(p)}>{p==='ratio'?'HH/HV ratio':p==='composite'?'Computed composite':p}</button>)}
 </div>
 <p className="pol-explanation">{mode==='gibs'?'NASA browse combines co-polarized and cross-polarized returns. Its colors are not the computed R=HH, G=HV, B=HH/HV composite.':'HH shows surface scattering; HV responds to structure within vegetation. HH/HV is a power ratio (or HH dB minus HV dB). The computed composite uses R=HH, G=HV, B=HH/HV; it requires both measured channels.'}</p>
 <div className="acquisition-controls"><label>Before<select id="before-date" value={before} onChange={e=>setBefore(Number(e.target.value))}>{frames.map((f,i)=><option key={i} value={i}>{f.date.slice(0,10)}{!image(f)?' · not available':''}</option>)}</select></label><label>After<select id="after-date" value={after} onChange={e=>setAfter(Number(e.target.value))}>{frames.map((f,i)=><option key={i} value={i}>{f.date.slice(0,10)}{!image(f)?' · not available':''}</option>)}</select></label></div>
 {mixed&&<p className="error-message">Different maturity or CRID. Quantitative comparison is blocked.</p>}
 <div className="radar-tabs" role="group" aria-label="Comparison display"><button onClick={()=>setDisplay('swipe')} aria-pressed={display==='swipe'}>Before / after</button><button disabled={!change||mixed} onClick={()=>setDisplay('change')} aria-pressed={display==='change'}>Change layer</button></div>
 <div id="radar-stage-container">
 {display==='change'&&change&&!mixed?<><div className="radar-stage"><img src={assetURL(change.image)} alt={'Measured after-minus-before '+pol+' backscatter change, '+a?.date+' to '+b?.date+', '+a?.maturity}/><span className="image-label">{a?.maturity} / CRID {a?.crid}</span></div><p className="source-line">After minus before; grayscale display from -6 dB (dark) to +6 dB (light). This is not automatically water gain or loss.</p></>:ready?<><div className={'radar-stage '+(mode==='browse'?'regional-stage':'')}><img src={assetURL(image(a))} alt={(simulated?'Simulated':mode==='gibs'?'Real false-color NISAR browse':'Real NISAR '+pol+' regional browse')+' before, '+a.date+', '+a.maturity+'; downsampled'}/><div className="compare-after" style={{clipPath:'inset(0 0 0 '+swipe+'%)'}}><img src={assetURL(image(b))} alt={(simulated?'Simulated':'Real NISAR browse')+' after, '+b.date+', '+b.maturity+'; downsampled'}/></div><span className="swipe-divider" style={{left:swipe+'%'}}/><span className="image-label">Before / {a.date.slice(0,10)}<br/>{a.maturity}</span><span className="image-label right">After / {b.date.slice(0,10)}<br/>{b.maturity}</span></div><label className="swipe-control">Move the image divider<input id="swipe-range" aria-label="Before and after image divider" type="range" min="0" max="100" value={swipe} onChange={e=>setSwipe(Number(e.target.value))}/><output>{swipe}%</output></label></>:<div className="empty-image" role="status">{frames.length===0?'Browse imagery not available.':!chronological?'Choose an earlier before date and a later after date.':'Image not available for this date. '+(b?.reason||'Missing data are not replaced with simulated imagery.')}</div>}
 </div>
 <p className="source-line">{simulated?'Source: team simulation, no satellite measurements':'Source: NASA/ISRO NISAR via'} {!simulated&&(mode==='gibs'?'NASA GIBS':'ASF DAAC')} · {simulated?'SIMULATED':a?.maturity||'maturity not available'} · CRID {a?.crid||'not available'} · downsampled · View: team. {mode==='gibs'?'TIME is a mosaic date; individual contributing acquisition times are not available.':a?.track?'Track '+a.track+', frame '+a.frame+'.':''}</p>
 <label className="timeline-control">Date sequence <output>{b?.date.slice(0,10)||'not available'}</output><input id="date-slider" aria-label="Radar date sequence" type="range" min="0" max={Math.max(0,frames.length-1)} value={after} onChange={e=>setAfter(Number(e.target.value))} disabled={!frames.length}/></label>
 <div className="acquisition-strip" aria-label="Date availability">{frames.map((f,i)=><button key={i} aria-label={f.date.slice(0,10)+(image(f)?' available':' not available')} title={f.date.slice(0,10)+(image(f)?' available':' not available')} aria-pressed={i===after} className={image(f)?'has-data':'no-data'} onClick={()=>setAfter(i)}/>)}</div>
 <p className="source-line">12-day sampling plus actual acquisition dates. Missing dates stay visible. Permanent mission gap: 27 July 22:03 UTC–10 August 00:55 UTC, 2026.</p>
 <div className="chart-grid"><section><h3>{simulated?'Simulated ':''}Backscatter · n = {series.length}{simulated?' simulated samples':' scenes'}</h3><Markup html={chart(series,{key:pol==='HV'?'HV':'HH',label:simulated?'Simulated backscatter':'Mean gamma-0 backscatter',unit:'dB',color:'var(--ink)',annotation:simulated?'Simulated values; not NISAR measurements.':'Source: NASA/ISRO NISAR via ASF DAAC · '+(a?.maturity||'not available')+' · CRID '+(a?.crid||'not available')+' · Chart: team.'})}/></section><section><h3>Candidate water area · n = {calibrated?series.filter((r:any)=>r.waterAreaKm2!=null).length:0} scenes</h3><Markup html={chart(calibrated?series:[],{key:'waterAreaKm2',label:'Candidate water area',unit:'km²',annotation:'Not available until calibrated pixels and masks are processed. A threshold needs independent OPERA validation. Area is not volume.'})}/></section></div>
 <details className="reading-notes"><summary>How to read water, crops, forest and buildings</summary><p>Typical behavior from SAR literature, not a finding at this site: smooth open water can be dark; wind and flooded vegetation can brighten it. Rice changes with flooding, growth and harvest. Forest volume scattering often raises HV. Buildings can give bright returns and dark radar shadows. Neither dark pixels nor HH/HV alone establish drought, crop health or biomass change.</p><p>VV appears only after a source HDF5 layer has been inspected. Sentinel-1 VV is C-band and must remain a separately labeled source.</p></details>
 <button className="button secondary" id="pending-map" disabled={!hosted} onClick={()=>setMap(v=>!v)}>{map?'Close detailed map':'Open detailed site map'}</button>{map&&<div ref={mapRef} id="context-map" role="region" aria-label="Detailed site map"/>}
 </div>;
}
