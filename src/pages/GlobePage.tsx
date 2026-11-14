import type {GlobeSelection,HistoryMode} from '../selection-url.js';
import { lazy,Suspense,useEffect,useState } from 'react';
import type {ReactNode} from 'react';
import type { Enso,News,NewsByPlaceData,Observation,Place,Site,StudyPlace } from '../types';
const Experience=lazy(()=>import('../components/GlobeExperience'));
export function GlobePage(props:{active:boolean;sites:Site[];places?:StudyPlace[];newsByPlace?:NewsByPlaceData;points:Observation[];place:Place|null;enso?:Enso;news?:News;oceanNotice:ReactNode;newsNotice:ReactNode;selection:GlobeSelection;onSelection:(selection:GlobeSelection,mode?:HistoryMode)=>void;navigationKey:number}){
 const [visible,setVisible]=useState(()=>!document.hidden);
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 const [visited,setVisited]=useState(props.active);
 useEffect(()=>{if(props.active)setVisited(true);},[props.active]);
 const shouldRender=visited||props.active;
 return <section id="page-globe" className="page" hidden={!props.active}>
 {shouldRender?<Suspense fallback={<div className="wrap"><div className="card" role="status"><h2>Interactive Earth &amp; Satellite Globe</h2><p>Loading the 3D satellite globe, saved NISAR radar frames (June–November 2026), and monthly vegetation layers…</p></div></div>}><Experience {...props} active={props.active&&visible}/></Suspense>:null}
 </section>;
}
