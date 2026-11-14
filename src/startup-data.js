export const datasetKeys=['sites','enso','evidence','news','sources'];
export function datasetStatus(key,value) {
 const array=Array.isArray;
 const strings=(row,keys)=>row&&keys.every(k=>typeof row[k]==='string');
 let valid=false;
 if(key==='sites')valid=array(value)&&value.every(s=>strings(s,['id','name','country','question','description'])&&s.id&&array(s.coordinates)&&s.coordinates.length===2&&s.coordinates.every(Number.isFinite)&&array(s.bbox)&&s.bbox.length===4&&s.bbox.every(Number.isFinite));
 if(key==='news')valid=strings(value,['status'])&&(value.retrievedAt===null||typeof value.retrievedAt==='string')&&array(value.items)&&value.items.every(n=>strings(n,['id','title','source','url','date']));
 if(key==='sources')valid=array(value)&&value.every(s=>strings(s,['name','url']));
 if(key==='evidence')valid=array(value)&&value.every(e=>strings(e,['siteId','name','date']));
 if(key==='enso')valid=strings(value,['url','issuedAt','retrievedAt'])&&(value.nino34===null||Number.isFinite(value.nino34))&&['weekly','oni'].every(k=>value[k]===undefined||array(value[k])&&value[k].every(r=>strings(r,k==='weekly'?['date']:['season'])&&Number.isFinite(r.anomaly)));
 if(!valid)throw new Error('The saved '+key+' file has an unsupported data structure.');
 const empty=key==='news'?!value.items.length:key==='enso'?!Number.isFinite(value.nino34)&&!value.weekly?.length&&!value.oni?.length:!value.length;
 return empty?'empty':'ready';
}
