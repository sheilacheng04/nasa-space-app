import {useEffect,useState} from 'react';
import {hosted} from '../api/client';
import {shareURL} from '../selection-url.js';
export function ShareLink({hash}:{hash:string}){
 const [status,setStatus]=useState(''),[manual,setManual]=useState('');
 useEffect(()=>{setStatus('');setManual('');},[hash]);
 const link=hosted?shareURL(location.href,hash):null;
 async function copy(){if(!link)return;try{await navigator.clipboard.writeText(link);setManual('');setStatus('Link copied.');}catch{setStatus('Copy failed. Select and copy the link below.');setManual(link);}}
 return <div className="share-view" data-share-hosted={Boolean(link)}><button className="button secondary" onClick={()=>void copy()} disabled={!link}>Copy link</button><div className="share-feedback" data-active={Boolean(status||manual||!link)}><span role="status">{link?status:'Local offline file links cannot be shared across devices.'}</span>{manual&&<label>Link to copy manually<input readOnly value={manual} onFocus={event=>event.target.select()}/></label>}</div></div>;
}
