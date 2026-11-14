import {finite} from './core.js';

export const coverageExplanation='Geometric overlap = catalog footprint intersection with the study-area bounding box / the entire study-area bounding box. The saved calculation uses longitude/latitude coordinates, not an equal-area ground projection. It is not valid radar pixel coverage or measured observed ground area.';
export function footprintOverlap(value){return finite(value)&&value>=0&&value<=1?(value*100).toFixed(1)+'%':'not available';}
export function knownMetadata(value){
 if(typeof value==='number')return finite(value)?String(value):null;
 return typeof value==='string'&&value.trim()&&!/^(not |unknown|unavailable|n\/a)/i.test(value.trim())?value.trim():null;
}
export function requestBounds(frame){
 let value=frame?.parameters?.BBOX;
 if(!value&&frame?.url){try{value=new URL(frame.url).searchParams.get('BBOX');}catch{}}
 const parts=typeof value==='string'?value.split(','):[];
 const bounds=parts.every(part=>part.trim()!=='')?parts.map(Number):[];
 return bounds.length===4&&bounds.every(finite)&&bounds[0]<bounds[2]&&bounds[1]<bounds[3]&&bounds[0]>=-180&&bounds[2]<=180&&bounds[1]>=-90&&bounds[3]<=90?bounds.join(', '):'not available';
}
export function radarMetadata(frame,mode){
 if(mode==='simulated')return [['Record','Simulated practice data; no acquisition metadata']];
 if(mode==='gibs')return [['Date type','Daily mosaic date; contributing acquisition times unavailable'],['Polarization','NASA false-color browse; not an isolated HH or HV channel'],['Image request bounds (W, S, E, N)',requestBounds(frame)],['Track / frame','not available for mosaic pixels'],['Maturity / CRID','not available for mosaic pixels']];
 return [['Track',knownMetadata(frame?.track)||'not available'],['Frame',knownMetadata(frame?.frame)||'not available'],['Direction',knownMetadata(frame?.direction)||'not available'],['Maturity',knownMetadata(frame?.maturity)||'not available'],['CRID',knownMetadata(frame?.crid)||knownMetadata(frame?.processingVersion)||'not available']];
}
export function comparisonGuidance(a,b,mode){
 if(mode==='simulated')return 'SIMULATED: invented images for practice, not satellite evidence.';
 if(mode==='gibs')return 'Visual comparison only. Mosaic pixel track, frame, maturity and CRID are unavailable; comparability remains unverified. Matching map bounds do not establish matching acquisitions.';
 const required=['track','frame','maturity','crid'];
 const get=(f,key)=>knownMetadata(key==='crid'?f?.crid??f?.processingVersion:f?.[key]);
 const different=[...required,'direction','frequency','sensor'].filter(key=>get(a,key)!==null&&get(b,key)!==null&&get(a,key)!==get(b,key));
 if(different.length)return 'Different '+different.join(', ')+'. Comparability is not established; do not derive quantitative change from this visual comparison.';
 if(required.some(key=>get(a,key)===null||get(b,key)===null))return 'Comparison metadata are incomplete; comparability remains unverified. Matching bounds or brightness do not establish matching acquisitions.';
 return mode==='processed'?'Listed track, frame, maturity and CRID match. Check viewing geometry, units, valid-pixel masks and calibration before interpreting a measured difference.':'Listed track, frame, maturity and CRID match. Visual comparison only: regional quicklooks may use different brightness stretches; geometry, valid-pixel overlap and calibration remain unverified.';
}
// A missing mosaic is not proof that no mission acquisition took place.
export function radarUnavailable(frame,scenes,mode='gibs'){
 const reason=frame?.reason||'';
 if(/not embedded|offline edition/i.test(reason))return {code:'offline',title:'This date is not included offline',description:'Choose an embedded date or open the hosted edition. No substitute image is shown.'};
 if(/Empty or uniform tile|No coverage resolved/i.test(reason))return {code:'unresolved',title:'No coverage resolved in the saved preview',description:'The saved preview check returned an empty or uniform image. This does not establish absence of higher-resolution coverage or of an acquisition.'};
 if(/Timeout|HTTPError|ConnectionError|WMS returned no PNG|request failed/i.test(reason))return {code:'request-failed',title:'The saved image request failed',description:'The recorded request did not return a usable image. Coverage remains unknown; no substitute image is shown.'};
 const date=frame?.date?.slice(0,10);
 const listed=Boolean(frame?.id)||(Array.isArray(scenes)&&date&&scenes.some(s=>s.date?.slice(0,10)===date));
 if(listed)return {code:'browse-missing',title:'Acquisition listed; saved browse image unavailable',description:'The saved catalog lists an acquisition on this date, but no browse image is saved for this selection. This does not establish its contribution to a mosaic.'};
 if(date&&Array.isArray(scenes))return {code:'not-listed',title:'No acquisition listed for this date in the saved site catalog',description:mode==='gibs'?'No mosaic image is saved for this selection either. This sampled archive is not a complete mission record; acquisition and mosaic availability remain unverified.':'The saved catalog is not a complete mission record. No substitute observation is shown.'};
 return {code:'browse-missing',title:'Saved browse image unavailable',description:'Acquisition availability cannot be established from this record. No substitute observation is shown.'};
}
