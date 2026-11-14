import {build} from 'esbuild';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const python=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
execFileSync(existsSync(python)?python:'python',['scripts/prepare_preview_assets.py'],{stdio:'inherit'});
const root=process.cwd(),data={};
const {assets,bytes:embeddedImageBytes}=JSON.parse(await readFile('.artifacts/preview-assets.json','utf8'));
const read=async p=>JSON.parse(await readFile(path.join('public/data',p),'utf8'));
for(const name of ['sites.json','news.json','enso.json','sources.json','evidence.json','method.json','inventory.json','network-status.json','world.topo.json','places.json'])data[name]=await read(name);
const compactInventory=r=>({...r,scenes:r.scenes.map(({browseUrls,footprint,...s})=>s)});
data['inventory.json'].sites=data['inventory.json'].sites.map(compactInventory);
for(const site of data['sites.json']){
 const key='sites/'+site.id+'/evidence.json';const e=await read(key);e.inventory=compactInventory(e.inventory);
 for(const frame of e.gibs.frames)if(frame.image&&!assets[frame.image]){delete frame.image;frame.status='not available';frame.reason='This frame is not embedded in the offline edition. The hosted project contains the full saved sequence.';}
 data[key]=e;
 const climate=await read('context/'+site.id+'.json');climate.daily=climate.daily?.slice(-60)||[];climate.offlineNote='Monthly comparisons are complete. Daily data in this offline edition contain the latest 60 days only.';data['context/'+site.id+'.json']=climate;
}
for(const entry of await readdir('public/data/demo'))if(entry.endsWith('.svg'))assets['data/demo/'+entry]='data:image/svg+xml;base64,'+(await readFile('public/data/demo/'+entry)).toString('base64');
const bundled=await build({entryPoints:['src/main.tsx'],bundle:true,write:false,format:'iife',minify:true,target:'es2022',loader:{'.css':'empty'},plugins:[{name:'offline-heavy-views',setup(b){
 b.onResolve({filter:/^\.\/globe-loader\.js$/},()=>({path:'globe-loader',namespace:'inline-globe'}));
 b.onLoad({filter:/.*/,namespace:'inline-globe'},()=>({contents:'export function loadGlobe(){return Promise.resolve(globalThis.Globe)}',loader:'js'}));
 b.onResolve({filter:/local-map\.js$/},()=>({path:'local-map',namespace:'offline'}));
 b.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:'export function mountMap(){throw new Error("Detailed maps are available in the hosted edition.")}',loader:'js'}));
}}]});
const globe=await readFile('node_modules/globe.gl/dist/globe.gl.min.js','utf8');
let css=await readFile('src/styles.css','utf8');css=css.replace("@import url('./map.css');",await readFile('src/map.css','utf8'));
for(const name of ['story','globe','local-window','account','editorial'])css+='\n'+await readFile('src/'+name+'.css','utf8');
const serialize=v=>JSON.stringify(v).replaceAll('<','\\u003c');
const setup='globalThis.__PACIFIC_DEMO__=true;globalThis.__PACIFIC_DATA__='+serialize(data)+';globalThis.__PACIFIC_ASSETS__='+serialize(assets)+';';
let html=await readFile('index.html','utf8');
html=html.replace('</head>',()=>'<style>'+css+'</style></head>').replace('<script type="module" src="/src/main.tsx"></script>',()=>'<script>'+setup+(globe+';\n'+bundled.outputFiles[0].text).replaceAll('</script','<\\/script')+'</script>');
const size=Buffer.byteLength(html);
if(size>3000000)throw new Error('Offline first-load budget exceeded: '+size);
await mkdir('demo',{recursive:true});await writeFile('demo/pacific-preview.html',html);await writeFile('el-nino-app.html',html);
await writeFile('.artifacts/offline-size.json',JSON.stringify({htmlBytes:size,embeddedRealImageDataURIBytes:embeddedImageBytes,networkRequests:0},null,2));
console.log('Self-contained preview: '+size+' bytes; real image data URIs '+embeddedImageBytes+' bytes. No external scripts or data requests.');
