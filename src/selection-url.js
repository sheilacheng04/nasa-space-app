const pages=['story','sites','globe','media','method'];
const oneOf=(value,values)=>values.includes(value)?value:undefined;
export function validDay(value){
 if(typeof value!=='string'||!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
export function validObservation(value){return validDay(value)||(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&validDay(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z'));}
export function siteSelection(input){
 const get=key=>input instanceof URLSearchParams?input.get(key):input?.[key];
 const result={source:oneOf(get('source'),['gibs','browse','processed','simulated']),channel:oneOf(get('channel'),['HH','HV','VV','VH','ratio','composite','water']),view:oneOf(get('view'),['timeline','swipe','change'])};
 for(const key of ['date','before','after'])if(validObservation(get(key)))result[key]=get(key);
 if(result.view==='timeline'&&result.source&&result.source!=='gibs')result.view='swipe';
 if(!result.view&&(result.before||result.after))result.view='swipe';
 if(result.view==='timeline'){delete result.before;delete result.after;}
 return result;
}
export function globeSelection(input){
 const get=key=>input instanceof URLSearchParams?input.get(key):input?.[key];
 const rawSite=get('site')||get('place');
 return {mode:oneOf(get('mode'),['concept','illustrative'])||'illustrative',site:/^[a-z][a-z0-9-]{0,39}$/.test(rawSite||'')?rawSite:undefined,date:validDay(get('date'))?get('date'):undefined,month:/^\d{4}-(0[1-9]|1[0-2])$/.test(get('month')||'')&&validDay(get('month')+'-01')?get('month'):undefined};
}
export function readRoute(hash){
 const [path,query='']=hash.replace(/^#\/?/,'').split('?');let [page,sub='']=path.split('/');
 const params=new URLSearchParams(query);
 if(page==='observatory'&&sub==='globe'){page='globe';sub='';}else if(page==='observatory')page='sites';else if(page==='news')page='media';else if(page==='local'){page='story';sub='local';}else if(page==='data'){page='method';sub='my-data';}
 const qPlace=params.get('place')||params.get('site')||'';
 if(!sub&&/^[a-z][a-z0-9-]{0,39}$/.test(qPlace)&&(page==='sites'||page==='media'||page==='story'))sub=qPlace;
 return {page:pages.includes(page)?page:'story',sub,siteSelection:siteSelection(params),globeSelection:globeSelection(params)};
}
function query(values){const params=new URLSearchParams();for(const [key,value]of Object.entries(values))if(value!==undefined&&value!=='')params.set(key,value);return params.size?'?'+params.toString():'';}
export function siteHash(site,input={}){
 const s=siteSelection(input),source=s.source||'gibs',view=s.view||(source==='gibs'?'timeline':'swipe');
 const values={source,channel:source==='gibs'?undefined:s.channel||'HH',view};
 if(view==='timeline')values.date=s.date||s.after;else{values.before=s.before;values.after=s.after||s.date;}
 return '#sites/'+encodeURIComponent(site)+query(values);
}
export function globeHash(input={}){const s=globeSelection(input);return '#globe'+query({mode:s.mode||'illustrative',site:s.site,date:s.date,month:s.month});}
export function frameIndex(frames,date){if(!date)return -1;const exact=frames.findIndex(f=>f.date===date);return exact>=0?exact:validDay(date)?frames.findIndex(f=>f.date.slice(0,10)===date):-1;}
export function includeDates(frames,dates,missing){
 const result=[...frames];for(const date of dates)if(date&&frameIndex(result,date)<0)result.push(missing(date));return result.sort((a,b)=>a.date.localeCompare(b.date));
}
export function shareURL(href,hash){const url=new URL(href);if(!['https:','http:'].includes(url.protocol))return null;url.search='';url.hash=hash;return url.href;}
