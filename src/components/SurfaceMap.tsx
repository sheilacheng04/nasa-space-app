import {useEffect,useRef,useState} from 'react';
import {hosted} from '../api/client';

const TILE=256;
function project(lng:number,lat:number,z:number){const n=TILE*2**z,s=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return {x:(lng+180)/360*n,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n};}
function unproject(x:number,y:number,z:number){const n=TILE*2**z;return {lng:x/n*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI};}
type Place={id:string;name:string;lng:number;lat:number;status:string};
export default function SurfaceMap({places,selectedId,date,onSelect}:{places:Place[];selectedId?:string;date?:string;onSelect:(id:string)=>void}){
 const mount=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;cx:number;cy:number;id:number}|null>(null);
 const [view,setView]=useState({lng:121.15,lat:14.91,z:11}),[size,setSize]=useState({w:700,h:560}),[online,setOnline]=useState(hosted),[opacity,setOpacity]=useState(1),[retry,setRetry]=useState(0);
 const [counts,setCounts]=useState({loaded:0,failed:0});
 const [offset,setOffset]=useState({x:0,y:0});
 useEffect(()=>{const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;setSize({w:r.width,h:r.height});});if(mount.current)observer.observe(mount.current);return()=>observer.disconnect();},[]);
 const selected=places.find(place=>place.id===selectedId);
 useEffect(()=>{if(selected)setView({lng:selected.lng,lat:selected.lat,z:11});},[selected?.id]);
 const center=project(view.lng,view.lat,view.z),left=center.x-size.w/2,top=center.y-size.h/2,n=2**view.z;
 const tiles:{x:number;y:number;col:number;row:number}[]=[];
 for(let row=Math.floor(top/TILE);row<=Math.floor((top+size.h)/TILE);row++)for(let col=Math.floor(left/TILE);col<=Math.floor((left+size.w)/TILE);col++)if(row>=0&&row<n)tiles.push({x:col*TILE-left,y:row*TILE-top,col:((col%n)+n)%n,row});
 const tileKey=`${date}|${view.z}|${Math.floor(left/TILE)}|${Math.floor(top/TILE)}|${retry}`;
 useEffect(()=>setCounts({loaded:0,failed:0}),[tileKey,online]);
 const tileUrl=(row:number,col:number)=>`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/${date}/GoogleMapsCompatible_Level13/${view.z}/${row}/${col}.png`;
 function zoom(delta:number){setOffset({x:0,y:0});setView(previous=>({...previous,z:Math.min(13,Math.max(3,previous.z+delta))}));}
 function finish(event:React.PointerEvent){const start=drag.current;if(!start||event.pointerId!==start.id)return;const next=unproject(start.cx-(event.clientX-start.x),start.cy-(event.clientY-start.y),view.z);setView(previous=>({...previous,...next}));drag.current=null;setOffset({x:0,y:0});}
 return <section className="surface-map" aria-label="Detailed NISAR map" data-date={date||''} data-zoom={view.z}>
  <div className="surface-map-heading"><strong>{selected?.name||'Philippines'} · 2D map</strong><span>{date||'No saved image on this selection'} · NISAR false-color mosaic</span></div>
  <div className="surface-map-canvas" ref={mount} tabIndex={0} role="region" aria-label="Drag to pan the NISAR map. Use plus and minus to zoom. Arrow keys pan."
   onPointerDown={event=>{if((event.target as HTMLElement).closest('button,a'))return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,cx:center.x,cy:center.y,id:event.pointerId};}}
   onPointerMove={event=>{if(drag.current?.id===event.pointerId)setOffset({x:event.clientX-drag.current.x,y:event.clientY-drag.current.y});}} onPointerUp={finish} onPointerCancel={()=>{drag.current=null;setOffset({x:0,y:0});}}
   onKeyDown={event=>{if((event.target as HTMLElement).closest('button,a'))return;const move:{[key:string]:number[]}={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,-100],ArrowDown:[0,100]};if(move[event.key]){event.preventDefault();const [x,y]=move[event.key];setView({...view,...unproject(center.x+x,center.y+y,view.z)});}if(event.key==='+'||event.key==='=')zoom(1);if(event.key==='-')zoom(-1);}}>
   {online?<div className="surface-map-tiles" style={{transform:`translate(${offset.x}px,${offset.y}px)`}}>
    {tiles.map(tile=><img key={`base-${view.z}-${tile.row}-${tile.col}`} draggable={false} alt="" width="256" height="256" style={{left:tile.x,top:tile.y}} src={`https://tile.openstreetmap.org/${view.z}/${tile.col}/${tile.row}.png`} onError={event=>{event.currentTarget.style.visibility='hidden';}}/>)}
    {date&&tiles.map(tile=><img key={`${tileKey}-${tile.row}-${tile.col}`} className="nisar-map-tile" draggable={false} alt="" width="256" height="256" style={{left:tile.x,top:tile.y,opacity}} src={tileUrl(tile.row,tile.col)} onLoad={()=>setCounts(value=>({...value,loaded:value.loaded+1}))} onError={event=>{event.currentTarget.style.visibility='hidden';setCounts(value=>({...value,failed:value.failed+1}));}}/>)}
    {places.map(place=>{const p=project(place.lng,place.lat,view.z),x=p.x-left,y=p.y-top;if(x<-30||y<-30||x>size.w+30||y>size.h+30)return null;return <button className="surface-map-pin" key={place.id} style={{left:x,top:y}} aria-label={`Select ${place.name}`} title={place.name} aria-pressed={place.id===selectedId} onClick={()=>onSelect(place.id)}>●</button>;})}
   </div>:<div className="surface-map-offline"><p>The detailed map loads NASA tiles online. Saved radar comparisons remain available below.</p><button className="button" onClick={()=>setOnline(true)}>Load online NISAR map</button></div>}
   <div className="surface-map-navigation"><button aria-label="Zoom in map" disabled={view.z===13} onClick={()=>zoom(1)}>+</button><button aria-label="Zoom out map" disabled={view.z===3} onClick={()=>zoom(-1)}>−</button><button onClick={()=>setView({lng:122,lat:12,z:6})}>Philippines</button><button disabled={!selected} onClick={()=>selected&&setView({lng:selected.lng,lat:selected.lat,z:11})}>Selected place</button></div>
   <div className="surface-map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="https://nisar-docs.asf.alaska.edu/worldview/" target="_blank" rel="noopener">NASA GIBS / NASA–ISRO NISAR</a></div>
  </div>
  <label className="surface-map-opacity">Radar opacity <input aria-label="Radar opacity" type="range" min="0" max="1" step=".1" value={opacity} onChange={event=>setOpacity(Number(event.target.value))}/>{Math.round(opacity*100)}%</label>
  <p className="surface-limit" role="status">{!online?'Online map is off.':!date?'No radar date selected; only the reference street map is shown.':counts.failed?`Some NASA tiles could not load (${counts.failed}).` :counts.loaded?`${date} NASA tiles loaded. Transparent areas have no displayed radar coverage.`:'Loading selected-date NASA tiles…'}{online&&date&&<button onClick={()=>setRetry(value=>value+1)}>Retry tiles</button>}</p>
  <p className="surface-limit">Zoom loads new tiles up to NASA’s level 13; the map does not enlarge a global thumbnail. Green often indicates vegetation; blue can indicate calm water or other low returns. This composite combines radar channels; HH/HV quicklooks are shown separately. <a href="https://nisar-docs.asf.alaska.edu/worldview/" target="_blank" rel="noopener">Color guide ↗</a></p>
 </section>;
}
