import type {HistoryMode} from '../selection-url.js';
import {useEffect,useLayoutEffect,useId,useMemo,useRef,useState} from 'react';
import {dataFile} from '../api/client';
import {calendarMonths,conceptSnapshot,illustrativeRainSignal,latestCompleteMonth,monthEnd,oceanAtMonthEnd,previousMonth,readConceptMonth} from '../concept-data';
import type {ClimateContext,ClimateContexts,ConceptMonthReading,ConceptSnapshot} from '../concept-data';
import type {Enso,Site} from '../types';
import '../concept-timeline.css';

export interface ConceptPlayback {month:string;months:string[];playing:boolean;canPlay:boolean;step:(delta:number)=>void;seek:(month:string)=>void;toggle:()=>void}
interface Props {
 active:boolean;sites:Site[];enso:Enso;requestedMonth?:string;onMonthChange:(month:string,history?:HistoryMode)=>void;navigationKey:number;
 onSnapshot:(snapshot:ConceptSnapshot)=>void;onSelectSite:(site:Site)=>void;onOpenRadar:(date:string)=>void;
 selectedSiteId?:string;radarDates?:string[];waiting?:boolean;onPlaybackChange?:(state:ConceptPlayback|null)=>void;
}
const displayMonth=(month:string)=>new Date(month+'-01T00:00:00Z').toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'});
const signed=(value:number|null,unit:string)=>value===null?'Not available':(value>0?'+':'')+value.toFixed(1)+' '+unit;
const numeric=(value:number|null,unit:string)=>value===null?'Not available':value.toFixed(1)+' '+unit;
const signalLabel=(reading:ConceptMonthReading)=>reading.signal==='drier'?'Less rain than the baseline':reading.signal==='wetter'?'More rain than the baseline':reading.signal==='near'?'Rainfall matches the baseline':'Monthly context unavailable';
function LandResponse({reading,label}:{reading:ConceptMonthReading;label:string}){
 const uid=useId().replaceAll(':',''),strength=illustrativeRainSignal(reading),unknown=strength===null;
 const wetness=strength??0,waterY=123-wetness*19,leafHeight=18+wetness*6;
 const soil=unknown?'#9ca7b2':wetness<0?'#ba8f67':wetness>0?'#8a9c81':'#a3a17e';
 return <figure className={'concept-land-card '+(unknown?'is-unknown':'')} data-signal={reading.signal}>
  <figcaption><span>{label}</span><strong>{displayMonth(reading.month)}</strong><small>{signalLabel(reading)}</small></figcaption>
  <div className="concept-illustration-label">Conceptual illustration — not measured land conditions</div>
  <svg viewBox="0 0 360 194" role="img" aria-label={unknown?'No complete monthly context; land-response illustration unavailable.':signalLabel(reading)+'. Possible soil, vegetation and surface-water response, illustrated only; not measured.'}>
   <defs><clipPath id={uid+'-water'}><path d="M210 104H333L309 151H228Z"/></clipPath><pattern id={uid+'-unknown'} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 8 0" stroke="#748493" strokeWidth="1"/></pattern></defs>
   <rect width="360" height="194" rx="8" fill="var(--bg2)"/>
   <g opacity={unknown?.3:1}>
    <path d="M0 103Q53 83 113 99T212 103H360V194H0Z" fill={soil}/>
    <path d="M0 133Q66 114 132 135T210 138" stroke="#735942" fill="none" strokeWidth="1.5"/>
    <path d="M0 160Q69 144 137 163T214 161" stroke="#735942" fill="none" strokeWidth="1.5"/>
    <path d="M210 104H333L309 151H228Z" fill="#d2c1a1" stroke="#7c6b54" strokeWidth="1.5"/>
    <rect x="210" y={waterY} width="125" height="60" fill="#3b8fb6" clipPath={'url(#'+uid+'-water)'}/>
    <path d={'M218 '+(waterY+6)+'h18m8 0h18m8 0h18m8 0h18'} stroke="#d3edf2" strokeWidth="1.2" clipPath={'url(#'+uid+'-water)'}/>
    {[38,70,102,134,166].map((x,i)=><g key={x} transform={'translate('+x+' '+(98+(i%2)*2)+')'} stroke={wetness<-.3?'#7b783d':'#36744d'} strokeWidth="2.1" fill="none"><path d={'M0 0V-'+leafHeight+'m0 5q-11-10-12-2M0-'+(leafHeight-7)+'q10-11 12-4'}/></g>)}
    {[28,59,92,124,154,184].map((x,i)=><circle key={x} cx={x} cy={142+(i%2)*12} r={2.5+Math.max(0,wetness)*1.7} fill="#316f9b" opacity={.35+wetness*.2}/>)}
    <path d="M48 39c-3-14 15-22 25-13 10-12 30-7 31 8 15-2 19 20 4 22H46C33 53 34 39 48 39Z" fill="#c0cedc" stroke="#6c829b"/>
    {Array.from({length:wetness>.05?6:wetness<-.05?2:4},(_,i)=><path key={i} d={'M'+(49+i*10)+' 64l-5 10'} stroke="#2688bf" strokeWidth="2" strokeLinecap="round"/>)}
   </g>
   {unknown&&<><rect x="10" y="82" width="340" height="94" fill={'url(#'+uid+'-unknown)'} opacity=".35"/><rect x="42" y="104" width="276" height="32" rx="6" fill="var(--card)"/><text x="180" y="125" textAnchor="middle" fill="var(--ink)" fontSize="12">Complete monthly data not available</text></>}
   <text x="24" y="186" fontSize="10" fill="var(--ink)">Soil / vegetation</text><text x="228" y="186" fontSize="10" fill="var(--ink)">Surface storage</text>
  </svg>
  <p>Rainfall departure: <strong>{signed(reading.rainAnomaly,'mm')}</strong></p>
 </figure>;
}
function RainfallHistory({site,contexts,months,selected,onSeek}:{site:Site;contexts:ClimateContexts;months:string[];selected:string;onSeek:(month:string)=>void}){
 const rows=months.map(month=>readConceptMonth(site,contexts[site.id],month)),bound=Math.max(10,...rows.map(row=>Math.abs(row.rainAnomaly??0)));
 const x=(i:number)=>38+(i+.5)/Math.max(1,months.length)*884,y=(value:number)=>62-value/bound*43;
 const step=884/Math.max(1,months.length);
 return <div className="concept-rain-history"><div><strong>Rainfall departure through time</strong><span>Rainfall estimate minus the usual calendar month · mm</span></div>
  <svg viewBox="0 0 950 114" role="group" aria-label={'Monthly rainfall departures for '+site.name+'. Missing months are hatched; selected '+displayMonth(selected)+'.'}>
   <defs><pattern id={'concept-missing-'+site.id} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5 5 0" stroke="var(--muted)"/></pattern></defs>
   <line x1="38" x2="922" y1="62" y2="62" stroke="var(--line)"/>
   <text x="0" y="22">+{Math.round(bound)}</text><text x="17" y="65">0</text><text x="0" y="106">−{Math.round(bound)}</text>
   {rows.map((row,i)=><g key={row.month} role="button" tabIndex={0} aria-label={displayMonth(row.month)+': '+signed(row.rainAnomaly,'mm')} onClick={()=>onSeek(row.month)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSeek(row.month);}}}>
    <title>{displayMonth(row.month)+': '+signed(row.rainAnomaly,'mm')}</title>
    {row.rainAnomaly===null?<rect x={x(i)-step*.32} y="44" width={step*.64} height="36" fill={'url(#concept-missing-'+site.id+')'}/>:<rect x={x(i)-step*.32} y={Math.min(62,y(row.rainAnomaly))} width={step*.64} height={Math.max(1,Math.abs(62-y(row.rainAnomaly)))} rx="2" fill={row.rainAnomaly<0?'#9b632b':'#177f8b'}/>}
    {row.month===selected&&<rect x={x(i)-step*.46} y="12" width={step*.92} height="91" rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.5"/>}
   </g>)}
  </svg><div className="concept-chart-ends"><span>{months[0]&&displayMonth(months[0])}</span><span>{months.at(-1)&&displayMonth(months.at(-1)!)}</span></div>
  <details><summary>View monthly rainfall departures</summary><div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}><table><caption>{site.name}: ERA5 rainfall minus the same-month 1991–2020 average (mm)</caption><thead><tr><th scope="col">Month</th><th scope="col">Departure (mm)</th><th scope="col">Observation status</th></tr></thead><tbody>{rows.map(row=><tr key={row.month}><th scope="row">{displayMonth(row.month)}</th><td>{signed(row.rainAnomaly,'mm')}</td><td>{row.complete?'Complete month':'Incomplete or unavailable'}</td></tr>)}</tbody></table></div></details>
 </div>;
}
export default function ConceptTimeline({active,sites,enso,onSnapshot,onSelectSite,onOpenRadar,selectedSiteId,radarDates=[],waiting=false,onPlaybackChange,requestedMonth,onMonthChange,navigationKey}:Props){
 const [contexts,setContexts]=useState<ClimateContexts|null>(null),[loading,setLoading]=useState(false),[failed,setFailed]=useState<string[]>([]),[attempt,setAttempt]=useState(0);
 const [playing,setPlaying]=useState(false),[announcement,setAnnouncement]=useState('');
 const setMonth=onMonthChange;
 const callbacks=useRef({onSnapshot,onSelectSite});callbacks.current={onSnapshot,onSelectSite};
 const loadedKey=useRef('');
 const siteKey=sites.map(site=>site.id).join(',');
 useEffect(()=>{
  if(!active||loadedKey.current===siteKey+'|'+attempt)return;let live=true;setLoading(true);
  Promise.allSettled(sites.map(site=>dataFile<ClimateContext>('context/'+site.id+'.json'))).then(results=>{
   if(!live)return;
   const next:ClimateContexts={},errors:string[]=[];results.forEach((result,i)=>{next[sites[i].id]=result.status==='fulfilled'?result.value:null;if(result.status==='rejected')errors.push(sites[i].name);});
   loadedKey.current=siteKey+'|'+attempt;setContexts(next);setFailed(errors);setLoading(false);
  });
  return()=>{live=false;};
 },[active,siteKey,attempt]);
 const months=useMemo(()=>{const axis=calendarMonths(contexts||{});return requestedMonth&&!axis.includes(requestedMonth)?[...axis,requestedMonth].sort():axis;},[contexts,requestedMonth]);
 const month=requestedMonth||latestCompleteMonth(contexts||{})||months.at(-1)||'',index=months.indexOf(month);
 const site=sites.find(item=>item.id===selectedSiteId)||sites.find(item=>item.id==='angat')||sites[0];
 const playbackEnd=months.indexOf(latestCompleteMonth(contexts||{})||'');
 const snapshot=useMemo(()=>month&&contexts?conceptSnapshot(sites,contexts,month):null,[month,contexts,sites]);
 const current=useMemo(()=>site&&month?readConceptMonth(site,contexts?.[site.id],month):null,[site,month,contexts]);
 const previous=useMemo(()=>site&&month?readConceptMonth(site,contexts?.[site.id],previousMonth(month)):null,[site,month,contexts]);
 const ocean=useMemo(()=>month?oceanAtMonthEnd(enso.weekly,month):null,[enso.weekly,month]);
 useLayoutEffect(()=>{if(active&&snapshot)callbacks.current.onSnapshot(snapshot);},[active,snapshot]);
 useEffect(()=>{if(!active)setPlaying(false);},[active]);
 useEffect(()=>{
  if(!active||!playing||!months.length||loading||waiting||playbackEnd<0)return;
  const timer=setTimeout(()=>{if(index>=playbackEnd)setPlaying(false);else setMonth(months[index+1],'replace');},1800);
  return()=>clearTimeout(timer);
 },[active,playing,index,months,loading,waiting,playbackEnd]);
 useEffect(()=>{if(!playing&&month&&current)setAnnouncement(displayMonth(month)+'. '+site.name+'. '+(current.complete?'Complete month. ':'Incomplete or missing month. ')+signalLabel(current)+'.');},[month,current,site,playing]);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),stop=()=>setPlaying(false);media.addEventListener('change',stop);return()=>media.removeEventListener('change',stop);},[]);
 useEffect(()=>setPlaying(false),[navigationKey]);
 function chooseMonth(next:string,history:HistoryMode='push'){setPlaying(false);setMonth(next,history);}
 function step(delta:number){if(months.length)chooseMonth(months[Math.max(0,Math.min(months.length-1,index+delta))]);}
 function togglePlay(){if(!months.length||playbackEnd<0)return;if(!playing&&index>=playbackEnd)setMonth(months[0],'replace');setPlaying(value=>!value);}
 useEffect(()=>{onPlaybackChange?.(active&&month?{month,months,playing,canPlay:playbackEnd>=0&&!loading,step,seek:chooseMonth,toggle:togglePlay}:null);},[active,month,months,playing,playbackEnd,loading,onPlaybackChange]);
 const previousYear=(Number(month.slice(0,4))-1)+month.slice(4),nextYear=(Number(month.slice(0,4))+1)+month.slice(4);
 function pickSite(id:string){const picked=sites.find(item=>item.id===id);if(picked)callbacks.current.onSelectSite(picked);}
 function key(event:React.KeyboardEvent){
  if((event.target as HTMLElement).closest('input:not([type=range]),select,textarea,a,button:not(#concept-play),[role=button]'))return;
  if(event.key===' '){event.preventDefault();event.stopPropagation();togglePlay();}
  else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();step(event.key==='ArrowRight'?1:-1);}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();event.stopPropagation();if(months.length)chooseMonth(event.key==='Home'?months[0]:months.at(-1)!);}
 }
 const radarAxis=useMemo(()=>[...radarDates].sort(),[radarDates]),radarAvailable=!!snapshot&&radarDates.includes(snapshot.date);
 const context=site?contexts?.[site.id]:null,climateURL=context?.requests?.find(request=>request.period==='recent')?.url,baselineURL=context?.requests?.find(request=>request.period==='baseline')?.url;
 const comparisonRain=current?.rainAnomaly!==null&&previous?.rainAnomaly!==null&&current&&previous?current.rainAnomaly-previous.rainAnomaly:null;
 const comparisonTemperature=current?.temperatureAnomaly!==null&&previous?.temperatureAnomaly!==null&&current&&previous?current.temperatureAnomaly-previous.temperatureAnomaly:null;
 return <section className="concept-timeline" hidden={!active} aria-label="Land and climate through time" onKeyDownCapture={key}>
  <div className="concept-time-heading"><div><p className="eyebrow">Land through time / local context</p><h2>Choose a month. Follow the changes.</h2><p>The globe shows real monthly vegetation images. Compare the weather below to explore possible reasons for a change.</p></div><div className="concept-site-picker"><label>Study area<select id="concept-site" value={site?.id||''} onChange={event=>pickSite(event.target.value)}>{sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" onClick={()=>site&&callbacks.current.onSelectSite(site)} aria-label={'Focus '+(site?.name||'study area')+' on globe'}>Focus study area</button></div></div>
  {loading&&!contexts?<p role="status">Loading monthly weather estimates…</p>:!months.length?<div className="concept-empty" role="status"><p>Monthly climate context could not be loaded. No land response has been inferred.</p><button onClick={()=>setAttempt(value=>value+1)}>Retry monthly context</button></div>:current&&previous&&site&&<>
   <div className="concept-calendar-readout"><strong data-testid="concept-date">{displayMonth(month)}</strong><span className={current.complete?'concept-month-complete':'concept-month-incomplete'}>{current.complete?'Complete month':current.availableRainDays===null?'Monthly context unavailable':'Incomplete month · '+current.availableRainDays+' of '+current.expectedDays+' rain days'}</span><span>Monthly window ends {monthEnd(month)}</span>{waiting&&<span className="concept-month-loading" aria-live={playing?'off':'polite'}>Loading vegetation frame...</span>}</div>
   <div className="concept-time-controls"><button aria-label="Previous concept month" disabled={index<=0} onClick={()=>step(-1)}>← Previous</button><button id="concept-play" aria-pressed={playing} disabled={playbackEnd<0} onClick={togglePlay}>{playing?'Pause months':'Play months'}</button><button aria-label="Next concept month" disabled={index>=months.length-1} onClick={()=>step(1)}>Next →</button><label htmlFor="concept-month-range">Month {index+1} of {months.length}</label><input id="concept-month-range" type="range" min="0" max={Math.max(0,months.length-1)} value={Math.max(0,index)} aria-label="Concept calendar month" aria-valuetext={displayMonth(month)+(current.complete?' complete':' incomplete or unavailable')} onChange={event=>chooseMonth(months[Number(event.target.value)],'replace')}/></div>
   <div className="concept-year-rows" aria-label="Choose a calendar month">{[...new Set(months.map(value=>value.slice(0,4)))].map(year=><div key={year}><strong>{year}</strong><div>{months.filter(value=>value.startsWith(year)).map(value=>{const reading=readConceptMonth(site,contexts?.[site.id],value);return <button key={value} aria-label={displayMonth(value)+(reading.complete?', complete month':', incomplete or unavailable')} aria-pressed={month===value} className={reading.complete?'':'is-missing'} onClick={()=>chooseMonth(value)} title={displayMonth(value)+(reading.complete?'':' · incomplete or unavailable')}>{new Date(value+'-01T00:00:00Z').toLocaleDateString('en',{month:'short',timeZone:'UTC'})}{!reading.complete&&<span aria-hidden="true"> *</span>}</button>;})}</div></div>)}</div>
   <div className="concept-season-compare"><button disabled={!months.includes(previousYear)} onClick={()=>chooseMonth(previousYear)}>← Same month last year</button><button disabled={!months.includes(nextYear)} onClick={()=>chooseMonth(nextYear)}>Same month next year →</button></div>
   <p className="concept-source-note">Greening and browning follow seasonal cycles. Compare the same month across years. Weather estimates (ERA5) combine observations with a weather model; the baseline is the 1991–2020 average for that month. * Incomplete or missing months remain unknown. Playback stops at the latest complete month.</p>
   <div className="concept-evidence-values"><article><h3>Rainfall at {site.name}</h3><strong>{numeric(current.rain,'mm')}</strong><p>Baseline {numeric(current.baselineRain,'mm')}</p><p>Departure <b>{signed(current.rainAnomaly,'mm')}</b></p><small>Change in departure since {displayMonth(previous.month)}: {signed(comparisonRain,'mm')}. Calendar-month baselines account for seasonality.</small></article><article><h3>Temperature context</h3><strong>{numeric(current.temperature,'°C')}</strong><p>Baseline {numeric(current.baselineTemperature,'°C')}</p><p>Departure <b>{signed(current.temperatureAnomaly,'°C')}</b></p><small>Departure change from the previous month: {signed(comparisonTemperature,'°C')}. Monthly mean of daily (maximum + minimum) / 2.</small></article><article><h3>Pacific temperature context</h3><strong>{signed(ocean?.anomaly??null,'°C')}</strong><p>Difference from the usual ocean temperature</p><small>{ocean?'NOAA Niño 3.4 reading '+ocean.date+', the latest available on or before '+monthEnd(month)+'.':'No preceding NOAA weekly value available.'} No later readings or interpolation are used.</small><a href={enso.url} target="_blank" rel="noopener">NOAA CPC source ↗</a></article></div>
   <div className="concept-land-comparison"><LandResponse label="Previous month" reading={previous}/><LandResponse label="Selected month" reading={current}/></div>
   <p className="concept-land-limit"><strong>The drawings are conceptual.</strong> Rainfall departure changes their rain, soil-water, vegetation and surface-storage symbols. They do not measure reservoir level, soil moisture, crop condition or flood extent, and are not a calibrated response model.</p>
   <RainfallHistory site={site} contexts={contexts||{}} months={months} selected={month} onSeek={chooseMonth}/>
   <div className="concept-hypothesis"><h3>What to test at {site.name}</h3><p>{site.hypothesis}</p><p><strong>Other drivers:</strong> {site.humanDrivers}</p><p>Coinciding ocean and local weather changes support a question, not attribution. Radar and independent observations must establish whether the ground actually changed.</p><div className="concept-radar-links"><button onClick={()=>snapshot&&onOpenRadar(snapshot.date)} disabled={!radarAvailable}>View radar on {snapshot?.date}</button><a className="button" href={'#sites/'+site.id+'?date='+snapshot?.date}>Open dated site evidence</a></div><p className="concept-source-note">{radarAvailable?'The satellite link uses the exact month-end mosaic date. It is a single dated browse, not a monthly impact estimate.':radarAxis.length?'No advertised global NISAR frame on this month-end. Available record: '+radarAxis[0]+' to '+radarAxis.at(-1)+'.':'NISAR date availability is not loaded.'} Site evidence keeps the same date and shows unavailable if no saved image exists.</p></div>
   <p className="concept-source-note">Source: {context?.source||'ERA5 source unavailable'} · {climateURL?<a href={climateURL} target="_blank" rel="noopener">Exact climate request ↗</a>:null}{baselineURL&&<> / <a href={baselineURL} target="_blank" rel="noopener">Baseline request ↗</a></>} · Retrieved {context?.retrievedAt?.slice(0,10)||'not available'} · At the site center, not a measured spatial extent · Reanalysis is subject to revision · Chart and illustration: team.</p>
   {failed.length>0&&<div className="concept-empty" role="status"><p>Context unavailable for {failed.join(', ')}. Those locations remain unknown.</p><button onClick={()=>setAttempt(value=>value+1)}>Retry missing context</button></div>}
  </>}
  <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
 </section>;
}
