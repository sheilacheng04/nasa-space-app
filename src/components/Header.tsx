import { useEffect, useRef } from 'react';
import type { Page } from '../types';
const links: [Page,string][] = [['story','Story'],['sites','Sites'],['globe','Globe'],['media','Media'],['method','Data and method']];
export function Header({page,openSearch}: {page:Page;openSearch:()=>void}) {
 const header=useRef<HTMLElement>(null),progress=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  document.documentElement.dataset.theme='light';
  const resize=new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',header.current!.getBoundingClientRect().height+'px'));
  if(header.current)resize.observe(header.current);
  const scroll=()=>{const root=document.documentElement;if(progress.current)progress.current.style.width=(root.scrollHeight>innerHeight?100*scrollY/(root.scrollHeight-innerHeight):0)+'%';};
  addEventListener('scroll',scroll,{passive:true});return()=>{resize.disconnect();removeEventListener('scroll',scroll);};
 },[]);
 return <header className="site-header" ref={header}>
  <a className="brand" href="#story"><span className="brand-title"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 18a10 10 0 0 1 20 0M8 18a6 6 0 0 1 12 0M12 18a2 2 0 0 1 4 0M4 23h20" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>The Two-Faced Pacific</span><small>A field journal / NISAR × El Niño</small></a>
  <nav aria-label="Main navigation">{links.map(([id,label])=><a key={id} href={'#'+id} aria-current={page===id?'page':undefined}>{label}</a>)}</nav>
  <button className="search-trigger icon-button" id="open-search" aria-label="Search places, sites and news" onClick={openSearch}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg><kbd>Ctrl K</kbd></button>
  <div id="reading-progress" ref={progress}/>
 </header>;
}
