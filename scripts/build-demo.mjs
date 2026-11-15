import {build,transform} from 'esbuild';
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
const python=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
execFileSync(existsSync(python)?python:'python',['scripts/prepare_preview_assets.py'],{stdio:'inherit'});
const root=process.cwd(),data={};
const {assets,bytes:previewImageBytes}=JSON.parse(await readFile('.artifacts/preview-assets.json','utf8'));
const read=async p=>JSON.parse(await readFile(path.join('public/data',p),'utf8'));
for(const name of ['sites.json','news.json','enso.json','sources.json','evidence.json','method.json','inventory.json','network-status.json','world.topo.json','places.json','gazetteer.json'])data[name]=await read(name);
const rawNewsByPlace=await read('news-by-place.json');
data['news-by-place.json']={updatedAt:rawNewsByPlace.updatedAt,source:rawNewsByPlace.source,tuples:rawNewsByPlace.items.map(i=>[i.id.slice(0,-(i.placeId.length+1)),i.placeId,i.matchedBy])};
const compactInventory=r=>({...r,scenes:r.scenes.map(({browseUrls,footprint,...s})=>s)});
data['inventory.json'].sites=data['inventory.json'].sites.map(compactInventory);
for(const site of data['sites.json']){
 const key='sites/'+site.id+'/evidence.json';const e=await read(key);delete e.inventory;
 // Each saved GIBS URL already records the complete request; avoid repeating its parameter object offline.
 for(const frame of e.gibs.frames)delete frame.parameters;
 for(const frame of e.gibs.frames)if(frame.image&&!assets[frame.image]){delete frame.image;frame.status='not available';frame.reason='This frame is not embedded in the offline edition. The hosted project contains the full saved sequence.';}
 data[key]=e;
 const climate=await read('context/'+site.id+'.json');climate.daily=climate.daily?.slice(-60)||[];climate.offlineNote='Monthly comparisons are complete. Daily data in this offline edition contain the latest 60 days only.';data['context/'+site.id+'.json']=climate;
}
// Keep the complete date axis but embed only three authentic, lossless overview frames.
const manifest=await read('globe/manifest.json');let embeddedImageBytes=previewImageBytes;
const marbleURI='data:image/jpeg;base64,'+(await readFile('public/data/globe/blue-marble-offline.jpg')).toString('base64');assets['data/globe/blue-marble.jpg']=marbleURI;embeddedImageBytes+=Buffer.byteLength(marbleURI);
for(const layer of Object.values(manifest.layers)){
 const real=layer.frames.filter(f=>f.image&&f.status==='ready');
 const picked=new Set([real[0]?.date,real[Math.floor(real.length/2)]?.date,real.at(-1)?.date]);
 layer.frames=await Promise.all(layer.frames.map(async f=>{
  const out={date:f.date,layer:f.layer,status:f.status,maturity:f.maturity,maturityWindow:f.maturityWindow,focus:f.focus,nontransparentPixels:f.nontransparentPixels,totalPixels:f.totalPixels};
  if(picked.has(f.date)&&f.image){
   const uri='data:image/webp;base64,'+(await readFile(path.join('public',f.image))).toString('base64');assets[f.image]=uri;embeddedImageBytes+=Buffer.byteLength(uri);out.image=f.image;out.offlineEmbedded=true;
  }
  return out;
 }));
}
data['globe/manifest.json']=manifest;
const vegetation=await read('globe/vegetation.json');
for(const frame of vegetation.frames){
 if(!frame.offlineUrl)continue;
 const uri='data:image/webp;base64,'+(await readFile(path.join('public',frame.offlineUrl))).toString('base64');
 assets[frame.url]=uri;embeddedImageBytes+=Buffer.byteLength(uri);frame.offlineEmbedded=true;
}
const legendPath=vegetation.legend.pngUrl;
const legendURI='data:image/png;base64,'+(await readFile(path.join('public',legendPath))).toString('base64');
assets[legendPath]=legendURI;embeddedImageBytes+=Buffer.byteLength(legendURI);
data['globe/vegetation.json']={layerId:vegetation.layerId,title:vegetation.title,legend:{url:legendPath,pngUrl:legendPath,sourceUrl:vegetation.legend.sourceUrl,colormapUrl:vegetation.legend.colormapUrl},frames:vegetation.frames.map(({date,label,status,url,sourceUrl,offlineEmbedded})=>({date,label,status,url,sourceUrl,offlineEmbedded}))};

if(embeddedImageBytes>1000000)throw new Error('Embedded image budget exceeded: '+embeddedImageBytes);
for(const entry of await readdir('public/data/demo'))if(entry.endsWith('.svg'))assets['data/demo/'+entry]='data:image/svg+xml;base64,'+(await readFile('public/data/demo/'+entry)).toString('base64');
const bundled=await build({entryPoints:['src/main.tsx'],bundle:true,write:false,format:'iife',minify:true,target:'es2022',loader:{'.css':'empty'},plugins:[{name:'offline-heavy-views',setup(b){
 b.onResolve({filter:/^\.\/globe-loader\.js$/},()=>({path:'globe-loader',namespace:'inline-globe'}));
 b.onLoad({filter:/.*/,namespace:'inline-globe'},()=>({contents:'export function loadGlobe(){return Promise.resolve(globalThis.Globe)}',loader:'js'}));
 b.onResolve({filter:/local-map\.js$/},()=>({path:'local-map',namespace:'offline'}));
 b.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:'export function mountMap(){throw new Error("Detailed maps are available in the hosted edition.")}',loader:'js'}));
}}]});
const globe=await readFile('node_modules/globe.gl/dist/globe.gl.min.js','utf8');
let css=await readFile('src/styles.css','utf8');css=css.replace("@import url('./map.css');",await readFile('src/map.css','utf8'));
for(const name of ['story','globe','local-window','account','editorial','satellite','concept-timeline','site-timeline','weather','radar-evidence','illustrative-globe','design'])css+='\n'+await readFile('src/'+name+'.css','utf8');
css=(await transform(css,{loader:'css',minify:true})).code;
const serialize=v=>JSON.stringify(v).replaceAll('<','\\u003c');
// Store repeated long provenance strings once; reconstruct the exact records offline.
const counts=new Map();
JSON.stringify(data,(_,v)=>{if(typeof v==='string'&&v.length>=4&&!v.startsWith('~'))counts.set(v,(counts.get(v)||0)+1);return v;});
// Include repeated strings when base36 references actually save bytes.
const strings=[...counts].filter(([value,n])=>(n-1)*Buffer.byteLength(serialize(value))>n*5+2).map(([value])=>value),indices=new Map(strings.map((v,i)=>[v,i]));
const packed=JSON.parse(JSON.stringify(data,(_,v)=>{
 if(typeof v==='string'&&v.startsWith('~'))throw new Error('Reserved offline encoding prefix');
 return typeof v==='string'&&indices.has(v)?'~'+indices.get(v).toString(36):v;
}));
function unpack(payload){
 const restore=value=>{
  if(typeof value==='string'&&value.charCodeAt(0)===126)return payload.strings[parseInt(value.slice(1),36)];
  if(Array.isArray(value))return value.map(restore);
  if(value&&typeof value==='object'){
   return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,restore(item)]));
  }
  return value;
 };
 return restore(payload.records);
}
assert.ok(JSON.stringify(unpack({strings,records:packed}))===JSON.stringify(data),'Offline JSON provenance must round-trip exactly');
// Lossless built-in compression keeps every saved offline record and thumbnail.
const payload=serialize({strings,records:packed,assets});
const compressed=gzipSync(payload,{level:9});
assert.equal(gunzipSync(compressed).toString('utf8'),payload,'Compressed offline payload must round-trip exactly');
async function inflate(base64){
 const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
 return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
const setup='const embedded=JSON.parse(await ('+inflate.toString()+')('+serialize(compressed.toString('base64'))+'));globalThis.__PACIFIC_DEMO__=true;globalThis.__PACIFIC_DATA__='+'('+unpack.toString()+')('+'embedded'+')'+';globalThis.__PACIFIC_ASSETS__='+'embedded.assets'+';for(const s of globalThis.__PACIFIC_DATA__["sites.json"]){globalThis.__PACIFIC_DATA__["sites/"+s.id+"/evidence.json"].inventory=globalThis.__PACIFIC_DATA__["inventory.json"].sites.find(r=>r.siteId===s.id||r.id===s.id);};{const nbp=globalThis.__PACIFIC_DATA__["news-by-place.json"],byId=new Map(globalThis.__PACIFIC_DATA__["news.json"].items.map(n=>[n.id,n]));nbp.items=nbp.tuples.map(([nid,pid,m])=>{const n=byId.get(nid)||{};return{id:nid+"-"+pid,placeId:pid,title:n.title||"",source:n.source||"",url:n.url||"",date:n.date||"",matchedBy:m,tone:{vader:n.vader??0,vaderAdjusted:n.vaderAdjusted??0,ai:null},aiAnalysis:null};});delete nbp.tuples;};';
let html=await readFile('index.html','utf8');
html=html.replace('</head>',()=>'<style>'+css+'</style></head>').replace('<script type="module" src="/src/main.tsx"></script>',()=>'<script>(async()=>{'+setup+(globe+';\n'+bundled.outputFiles[0].text).replaceAll('</script','<\\/script')+'})().catch(()=>{document.getElementById("root").textContent="This offline edition could not open. Please use a current browser with gzip decompression support.";});</script>');
const size=Buffer.byteLength(html);
if(size>3000000)throw new Error('Offline first-load budget exceeded: '+size);
await writeFile('el-nino-app.html',html);
await writeFile('.artifacts/offline-size.json',JSON.stringify({htmlBytes:size,embeddedRealImageDataURIBytes:embeddedImageBytes,networkRequests:0},null,2));
console.log('Self-contained preview: '+size+' bytes; real image data URIs '+embeddedImageBytes+' bytes. No external scripts or data requests.');
