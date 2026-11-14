import { useCallback, useEffect, useRef, useState } from 'react';
import { hosted } from './api/client';
import { loadSaved } from './core.js';
import { initLocalWindow } from './local-window.js';
import { Header } from './components/Header';
import { Search } from './components/Search';
import { StoryPage } from './pages/StoryPage';
import { GlobePage } from './pages/GlobePage';
import { SitesPage } from './pages/SitesPage';
import { NewsPage } from './pages/NewsPage';
import { DataPage } from './pages/DataPage';
import { MethodPage } from './pages/MethodPage';
import { EvidenceLead } from './components/EvidenceLead';
import {readRoute,siteHash,globeHash} from './selection-url.js';
import type {SiteSelection,GlobeSelection,HistoryMode} from './selection-url.js';
import {useStartupData} from './useStartupData';
import {DatasetNotice} from './components/DatasetNotice';
import type {DatasetKey} from './startup-data.js';
import type { Observation, Place } from './types';
const currentRoute=()=>readRoute(location.hash);
export function App(){
 const [route,setRoute]=useState(currentRoute);
 const {data,states,retry}=useStartupData(),initialized=Boolean(data);
 const optionalData={news:states.news.data,sources:states.sources.data,evidence:states.evidence.data};
 const routeReady=route.page==='media'||route.page==='method'||initialized;
 const labels={sites:'study sites',enso:'NOAA ocean context',news:'news archive',evidence:'radar preview summaries',sources:'source index'};
 const notice=(key:DatasetKey)=><DatasetNotice label={labels[key]} state={states[key]} retry={()=>retry(key)}/>;
 const [points,setPoints]=useState<Observation[]>(loadSaved),[search,setSearch]=useState(false),[place,setPlace]=useState<Place|null>(null);
 const lastHash=useRef(location.hash),[navigationKey,setNavigationKey]=useState(0);
 useEffect(()=>{const changed=()=>{if(lastHash.current===location.hash)return;lastHash.current=location.hash;setRoute(currentRoute());setNavigationKey(n=>n+1);};addEventListener('hashchange',changed);addEventListener('popstate',changed);return()=>{removeEventListener('hashchange',changed);removeEventListener('popstate',changed);};},[]);
 const writeHash=useCallback((hash:string,mode:HistoryMode='push')=>{if(location.hash===hash)return;history[mode==='replace'?'replaceState':'pushState'](null,'',hash);lastHash.current=hash;setRoute(currentRoute());},[]);
 const selectSite=useCallback((siteId:string,selection:SiteSelection,mode:HistoryMode='push')=>{if(currentRoute().page==='sites')writeHash(siteHash(siteId,selection),mode);},[writeHash]);
 const selectGlobe=useCallback((selection:GlobeSelection,mode:HistoryMode='push')=>{if(currentRoute().page==='globe')writeHash(globeHash(selection),mode);},[writeHash]);
 useEffect(()=>{if(data)initLocalWindow();},[initialized]);
 useEffect(()=>{
  document.body.dataset.view=route.page;
  document.title=({story:'From ocean to everyday life',sites:'Sites',globe:'Globe',media:'Media',method:'Data and method'}[route.page])+' | The Two-Faced Pacific';
  window.scrollTo({top:0,behavior:'instant'});document.getElementById('main')?.focus({preventScroll:true});
  if(route.sub&&route.page!=='sites')setTimeout(()=>{const target=document.getElementById(route.sub);if(target instanceof HTMLDetailsElement)target.open=true;target?.scrollIntoView();},100);
 },[route.page,route.sub,routeReady]);
 useEffect(()=>{const keys=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(x=>!x);}};addEventListener('keydown',keys);return()=>removeEventListener('keydown',keys);},[]);
 function update(rows:Observation[]){setPoints(rows);try{if(rows.length)localStorage.setItem('pacific-observations',JSON.stringify(rows));else localStorage.removeItem('pacific-observations');return true;}catch{return false;}}
 const site=data?.sites.find(s=>s.id===route.sub)||data?.sites.find(s=>s.id==='angat')||data?.sites[0];
 return <><a className="skip-link" href="#main" onClick={event=>{event.preventDefault();document.getElementById('main')?.focus();}}>Skip to content</a><Header page={route.page} openSearch={()=>setSearch(true)}/>
 {!hosted&&<div className="demo-ribbon">OFFLINE EDITION · Real browse thumbnails and saved source data. Simulated examples are labeled.</div>}
 <main id="main" tabIndex={-1}>
 {!data?<div className="wrap" hidden={route.page==='media'||route.page==='method'}>{notice('sites')}</div>:<>
 <StoryPage oceanNotice={notice('enso')} evidenceNotice={notice('evidence')} active={route.page==='story'} data={data}/>
 <SitesPage active={route.page==='sites'} site={site!} sites={data.sites} selection={route.siteSelection} onSelection={selectSite} navigationKey={navigationKey}/>
 <div hidden={route.page!=='globe'} className="globe-evidence">{notice('evidence')}<EvidenceLead evidence={data.evidence?.[0]}/></div>
 <GlobePage oceanNotice={notice('enso')} newsNotice={notice('news')} active={route.page==='globe'} sites={data.sites} points={points} place={place} enso={data.enso} news={data.news} selection={route.globeSelection} onSelection={selectGlobe} navigationKey={navigationKey}/>
 </>}
 <div hidden={route.page!=='media'} className="wrap compact">{notice('evidence')}<EvidenceLead evidence={optionalData.evidence?.[0]}/></div>
 <NewsPage notice={notice('news')} active={route.page==='media'} news={optionalData.news}/>
 <MethodPage newsNotice={notice('news')} sourcesNotice={notice('sources')} evidenceNotice={notice('evidence')} active={route.page==='method'} data={optionalData}/>
 <div hidden={route.page!=='method'} className="wrap"><details id="my-data" className="optional-data"><summary>Optional: add your own observations</summary><DataPage active={route.page==='method'} points={points} update={update}/></details></div>
 </main><footer className="site-footer wrap"><a className="footer-brand" href="#story">The Two-Faced Pacific</a><p>A changing ocean. A closer look at life on land.</p><a href="#story/local">Community perspectives</a><a href="#method">Sources and limits ↗</a><span className="mono">NASA Space Apps / 2026</span></footer>
 <Search sitesNotice={!data?notice('sites'):null} newsNotice={notice('news')} open={search} close={()=>setSearch(false)} data={{sites:data?.sites,news:optionalData.news}} locate={found=>{setPlace(found);if(currentRoute().page!=='globe')location.hash='globe';}}/>
 </>;
}
