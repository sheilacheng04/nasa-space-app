import { useEffect, useState } from 'react';
import { bootstrap, errorMessage, hosted } from './api/client';
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
import type { Bootstrap, Observation, Page, Place } from './types';
const pages:Page[]=['story','sites','globe','media','method'];
function currentRoute():{page:Page;sub:string;date?:string}{
 const [path,query='']=location.hash.slice(1).split('?');const requested=new URLSearchParams(query).get('date')||'';
 let [page,sub='']=path.split('/');
 if(page==='observatory'&&sub==='globe'){page='globe';sub='';}
 else if(page==='observatory')page='sites';
 else if(page==='news')page='media';
 else if(page==='local'){page='story';sub='local';}
 else if(page==='data'){page='method';sub='my-data';}
 return {page:pages.includes(page as Page)?page as Page:'story',sub,date:/^\d{4}-\d{2}-\d{2}$/.test(requested)?requested:undefined};
}
export function App(){
 const [route,setRoute]=useState(currentRoute),[data,setData]=useState<Bootstrap|null>(null),[failure,setFailure]=useState(''),[attempt,setAttempt]=useState(0);
 const [points,setPoints]=useState<Observation[]>(loadSaved),[search,setSearch]=useState(false),[place,setPlace]=useState<Place|null>(null);
 useEffect(()=>{const changed=()=>setRoute(currentRoute());addEventListener('hashchange',changed);return()=>removeEventListener('hashchange',changed);},[]);
 useEffect(()=>{let live=true;bootstrap().then(d=>{if(live)setData(d);}).catch(e=>{if(live)setFailure(errorMessage(e));});return()=>{live=false;};},[attempt]);
 useEffect(()=>{if(data)initLocalWindow();},[data]);
 useEffect(()=>{
  document.body.dataset.view=route.page;
  document.title=({story:'A question for radar',sites:'Sites',globe:'Globe',media:'Media',method:'Data and method'}[route.page])+' | The Two-Faced Pacific';
  window.scrollTo({top:0,behavior:'instant'});document.getElementById('main')?.focus({preventScroll:true});
  if(route.sub&&route.page!=='sites')setTimeout(()=>document.getElementById(route.sub)?.scrollIntoView(),100);
 },[route.page,route.sub,data]);
 useEffect(()=>{const keys=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(x=>!x);}};addEventListener('keydown',keys);return()=>removeEventListener('keydown',keys);},[]);
 function update(rows:Observation[]){setPoints(rows);try{if(rows.length)localStorage.setItem('pacific-observations',JSON.stringify(rows));else localStorage.removeItem('pacific-observations');return true;}catch{return false;}}
 const site=data?.sites.find(s=>s.id===route.sub)||data?.sites.find(s=>s.id==='angat')||data?.sites[0];
 return <><a className="skip-link" href="#main">Skip to content</a><Header page={route.page} openSearch={()=>setSearch(true)}/>
 {!hosted&&<div className="demo-ribbon">OFFLINE EDITION · Real browse thumbnails and saved source data. Simulated examples are labeled.</div>}
 <main id="main" tabIndex={-1}>
 {!data?<div className="wrap" role="status"><p>{failure||'Loading the field journal…'}</p>{failure&&<button onClick={()=>setAttempt(n=>n+1)}>Retry</button>}</div>:<>
 <StoryPage active={route.page==='story'} data={data}/>
 <SitesPage active={route.page==='sites'} site={site!} sites={data.sites} requestedDate={route.date}/>
 <div hidden={route.page!=='globe'} className="globe-evidence"><EvidenceLead evidence={data.evidence?.[0]}/></div>
 <GlobePage active={route.page==='globe'} sites={data.sites} points={points} place={place} enso={data.enso} news={data.news}/>
 <div hidden={route.page!=='media'} className="wrap compact"><EvidenceLead evidence={data.evidence?.[0]}/></div>
 <NewsPage active={route.page==='media'} news={data.news}/>
 <MethodPage active={route.page==='method'} data={data}/>
 <div hidden={route.page!=='method'} id="my-data"><DataPage active={route.page==='method'} points={points} update={update}/></div>
 </>}
 </main><footer className="site-footer wrap"><a className="footer-brand" href="#story">The Two-Faced Pacific</a><p>Land and water, observed. Climate links, tested.</p><a href="#story/local">Our Philippine story</a><a href="#method">Sources and limits ↗</a><span className="mono">NASA Space Apps / 2026</span></footer>
 {data&&<Search open={search} close={()=>setSearch(false)} data={data} locate={found=>{setPlace(found);location.hash='globe';}}/>}
 </>;
}
