import type {GlobeSelection,HistoryMode} from '../selection-url.js';
import { lazy,Suspense,useEffect,useState } from 'react';
import type {ReactNode} from 'react';
import type { Enso,News,Observation,Place,Site } from '../types';
const Experience=lazy(()=>import('../components/GlobeExperience'));
export function GlobePage(props:{active:boolean;sites:Site[];points:Observation[];place:Place|null;enso?:Enso;news?:News;oceanNotice:ReactNode;newsNotice:ReactNode;selection:GlobeSelection;onSelection:(selection:GlobeSelection,mode?:HistoryMode)=>void;navigationKey:number}){
 const [visible,setVisible]=useState(()=>!document.hidden);
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 const [visited,setVisited]=useState(props.active);
 useEffect(()=>{if(props.active)setVisited(true);},[props.active]);
 return <section id="page-globe" className="page" hidden={!props.active}>
 {visited?<Suspense fallback={<div className="wrap" role="status">Loading satellite playback…</div>}><Experience {...props} active={props.active&&visible}/></Suspense>:null}
 </section>;
}
