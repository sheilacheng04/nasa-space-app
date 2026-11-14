import { useEffect, useRef, useState } from 'react';
import { geocode, hosted, errorMessage, dataFile } from '../api/client';
import { safeURL } from '../core.js';
import type {ReactNode} from 'react';
import type { Bootstrap, Place } from '../types';

export function Search({ open, close, data, locate, newsNotice,sitesNotice }: { sitesNotice:ReactNode;newsNotice:ReactNode; open: boolean; close: () => void; data: Pick<Bootstrap,'news'>&{sites?:Bootstrap['sites']}; locate: (place: Place) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<Place[] | null>(null);
  const [status, setStatus] = useState('Use Tab to move through results. Escape closes search.');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => {
    if (open) { dialog.current?.showModal(); document.getElementById('global-search')?.focus(); }
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  const [places,setPlaces]=useState<[string,string,number,number][]>([]);
  useEffect(()=>{if(open&&!places.length)dataFile<{places:[string,string,number,number][]}>('places.json').then(p=>setPlaces(p.places)).catch(()=>{});},[open]);
  const q = query.trim().toLowerCase();
  const matches: {title:string;detail:string;href:string;place?:Place}[] = [
    ...(data.sites||[]).filter(s => (s.name + ' ' + s.country + ' ' + s.type).toLowerCase().includes(q)).map(s => ({title: s.name, detail: s.country + ' · study area', href: '#sites/' + s.id})),
    ...places.filter(p=>q.length>1&&(p[0]+' '+p[1]).toLowerCase().includes(q)).slice(0,6).map(p=>({title:p[0],detail:p[1]+' / saved place',href:'#globe',place:{properties:{name:p[0],country:p[1]},geometry:{coordinates:[p[3],p[2]] as [number,number]}}})),
    ...(data.news?.items||[]).filter(n => q && n.title.toLowerCase().includes(q)).slice(0, 8).map(n => ({title: n.title, detail: n.source + ' · news', href: safeURL(n.url)})),
  ];
  async function worldSearch() {
    if (q.length < 3) { setStatus('Enter at least three characters.'); return; }
    const token = ++version.current;
    setBusy(true); setStatus('Searching Photon / OpenStreetMap…');
    try { const found = await geocode(query); if (token === version.current) { setRemote(found); setStatus('Select a place to locate it on the globe.'); } }
    catch (error) { if (token === version.current) setStatus(errorMessage(error)); }
    finally { if (token === version.current) setBusy(false); }
  }
  return <dialog aria-labelledby="search-title" aria-describedby="search-status" id="search-dialog" ref={dialog} onClose={() => { close(); document.getElementById('open-search')?.focus(); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.current?.close(); return; }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const buttons = Array.from(dialog.current!.querySelectorAll<HTMLElement>('.search-result'));
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
  }}>
    <form method="dialog"><div className="dialog-head"><label id="search-title" htmlFor="global-search">Search the Pacific</label><button className="icon-button" aria-label="Close search">×</button></div></form>
    <input aria-controls="search-results" id="global-search" type="search" placeholder="A study area, a place, a headline…" autoComplete="off" value={query} onChange={event => { version.current++; setBusy(false); setQuery(event.target.value); setRemote(null); }}/>
    {sitesNotice}{newsNotice}
    <div id="search-results">{remote ? remote.map((place, i) => <button key={i} className="search-result" onClick={() => { locate(place); dialog.current?.close(); }}>{[place.properties.name, place.properties.state, place.properties.country].filter(Boolean).join(', ')}</button>) : matches.map((item, i) => <a key={i} className="search-result" href={item.href} target={item.href.startsWith('https:') ? '_blank' : undefined} rel="noopener" onClick={event => {if(item.href.startsWith('#sites/')&&location.hash.startsWith('#globe')){event.preventDefault();dispatchEvent(new CustomEvent('globe:select-site',{detail:{id:item.href.slice(7)}}));}else if(item.place){event.preventDefault();locate(item.place);}dialog.current?.close();}}>{item.title}<small>{item.detail}</small></a>)}
      {(remote ? remote.length === 0 : matches.length === 0) && <p>No results. Try a study area or search world places.</p>}
    </div>
    <button id="search-world" className="text-link" hidden={!hosted} disabled={busy} onClick={worldSearch}>Search world places with Photon ↗</button>
    <p id="search-status" className="source-line" role="status">{status}</p>
  </dialog>;
}
