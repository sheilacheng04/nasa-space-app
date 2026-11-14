export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const $ = id => document.getElementById(id);
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export function safeURL(value) {try {const u = new URL(value);return u.protocol==='https:' ? u.href : '#';}catch{return '#';}}
export function assetURL(value) {if(typeof value!=='string'||!/^data\/[a-zA-Z0-9_./-]+$/.test(value)||value.includes('..')) return '';return globalThis.__PACIFIC_ASSETS__?.[value] || './'+value;}
export function formatDate(value) {if(!value)return 'Not retrieved';const d=new Date(value);return Number.isNaN(+d)?String(value):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}
export function parseCSV(text) {
 if(typeof text!=='string'||new TextEncoder().encode(text).length>1000000)throw new Error('The CSV must be smaller than 1 MB.');
 const rows=[];let row=[],field='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'){if(field)throw new Error('Unexpected quote in CSV.');quoted=true;}else if(c===','){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw new Error('A quoted field is missing its closing quote.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw new Error('Add a header and at least one observation.');if(rows.length>2001)throw new Error('The limit is 2,000 observations. Split this file before importing.');
 const headers=rows.shift().map(h=>h.trim().toLowerCase());if(new Set(headers).size!==headers.length)throw new Error('CSV column names must be unique.');
 const latIndex=headers.findIndex(h=>['lat','latitude'].includes(h)),lngIndex=headers.findIndex(h=>['lng','lon','longitude'].includes(h));
 if(latIndex<0||lngIndex<0)throw new Error('The header needs lat and lng columns.');
 const output=[],errors=[];
 rows.forEach((r,i)=>{const la=r[latIndex]?.trim(),lo=r[lngIndex]?.trim(),lat=Number(la),lng=Number(lo);if(!la||!lo||!finite(lat)||!finite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){errors.push(`Row ${i+2}: invalid coordinates`);return;}
 const get=name=>r[headers.indexOf(name)]?.trim()||'';const v=get('value');if(v!==''&&!finite(Number(v))){errors.push(`Row ${i+2}: value must be numeric or empty`);return;}output.push({name:get('name')||`Observation ${i+1}`,lat,lng,value:v===''?null:Number(v),category:get('category'),date:get('date')});});
 if(errors.length)throw new Error(`${errors.slice(0,5).join('. ')}${errors.length>5?`. And ${errors.length-5} more errors`:''}. No rows imported.`);
 return output;
}
export function validateObservation(pkg) {
 if(!pkg||pkg.schemaVersion!==1||!['pending','ready','demo'].includes(pkg.status)||!Array.isArray(pkg.acquisitions)||!Array.isArray(pkg.comparisons))throw new Error('Unsupported observation package.');
 const ids=new Set();
 for(const a of pkg.acquisitions){if(!a.id||ids.has(a.id)||!/^\d{4}-\d{2}-\d{2}/.test(a.date)||!a.sensor||!a.channels)throw new Error('Acquisition identity or metadata is invalid.');for(const field of ['track','direction','frequency','maturity','processingVersion'])if(typeof a[field]!=='string'||!a[field])throw new Error('Acquisition comparability metadata is missing.');ids.add(a.id);
 if(!Array.isArray(a.bounds)||a.bounds.length!==4||!a.bounds.every(finite)||a.bounds[0]>=a.bounds[2]||a.bounds[1]>=a.bounds[3]||a.bounds[0]< -180||a.bounds[2]>180||a.bounds[1]< -90||a.bounds[3]>90)throw new Error('Acquisition bounds are invalid.');
 for(const [pol,ch]of Object.entries(a.channels)){if(!['HH','HV','VV','VH','ratio','composite','water'].includes(pol)||!assetURL(ch.image))throw new Error('Channel asset path is invalid.');if(ch.meanDb!=null&&!finite(ch.meanDb))throw new Error('Backscatter must be a number or null.');}}
 for(const c of pkg.comparisons){if(!ids.has(c.before)||!ids.has(c.after)||!assetURL(c.image)||!c.channel)throw new Error('Comparison references are invalid.');const a=pkg.acquisitions.find(x=>x.id===c.before),b=pkg.acquisitions.find(x=>x.id===c.after);if(!compatible(a,b,c.channel))throw new Error('Comparison mixes incompatible acquisitions.');}
 return pkg;
}
export function compatible(a,b,pol){return Boolean(a&&b&&a.id!==b.id&&a.sensor===b.sensor&&a.track===b.track&&a.direction===b.direction&&a.frequency===b.frequency&&a.maturity===b.maturity&&a.processingVersion===b.processingVersion&&JSON.stringify(a.bounds)===JSON.stringify(b.bounds)&&a.channels[pol]&&b.channels[pol]&&a.date<b.date);}
export function localTone(text){const words=text.toLowerCase().match(/[a-z]+/g)||[];const negative=new Set(['loss','losses','flood','floods','drought','deaths','damage','destroyed','crisis','risk','extreme']);const positive=new Set(['recovery','recover','relief','resilient','prepared','protect','restored']);const n=words.filter(w=>negative.has(w)).length,p=words.filter(w=>positive.has(w)).length;return {score:(p-n)/Math.sqrt((p-n)**2+15),negative:n,positive:p,method:'Local keyword heuristic (not VADER)'};}
export function downloadText(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function loadSaved(){try{const data=JSON.parse(localStorage.getItem('pacific-observations')||'[]');return Array.isArray(data)?data.filter(x=>finite(x.lat)&&finite(x.lng)&&Math.abs(x.lat)<=90&&Math.abs(x.lng)<=180).slice(0,2000):[];}catch{return [];}}
