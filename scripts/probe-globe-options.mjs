// Live comparison of the pinned renderers and the real NISAR daily layer.
// Start Vite on 5174; artifacts remain ignored. Network access is required.
import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174';
const manifest=JSON.parse(await readFile('public/data/globe/manifest.json','utf8'));
const layer=manifest.layers[manifest.defaultLayer];
const frame=layer.frames.filter(f=>f.image).sort((a,b)=>b.nontransparentPixels-a.nontransparentPixels)[0];
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={date:frame.date,layer:layer.id};
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'reduce'});
 await page.goto(base+'/#globe');
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-frame-status','ready',{timeout:25000});
 report.B=await page.evaluate(()=>{
  const api=globalThis.Globe();return{tileEngine:typeof api.globeTileEngineUrl,datedTexture:typeof api.globeImageUrl,renderer:document.querySelector('#globe-stage').dataset.renderer,displayed:document.querySelector('.frame-status').textContent};
 });
 await page.screenshot({path:'.artifacts/globe-texture-probe.png'});
 const probe=await browser.newPage({viewport:{width:900,height:650}});await probe.goto(base);
 report.A=await probe.evaluate(async({date,layer})=>{
  const maplibregl=await import('/node_modules/maplibre-gl/dist/maplibre-gl.mjs');
  const worker=await import('/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url');maplibregl.setWorkerUrl(worker.default);
  const target=document.createElement('div');target.style='position:fixed;inset:0;z-index:99999;background:#0b1014';document.body.append(target);
  const url='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/'+layer+'/default/'+date+'/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png';
  const map=new maplibregl.Map({container:target,center:[121.16,14.91],zoom:1,style:{version:8,sources:{radar:{type:'raster',tiles:[url],tileSize:256,maxzoom:13}},layers:[{id:'radar',type:'raster',source:'radar',paint:{'raster-fade-duration':0}}]},attributionControl:false});
  const errors=[],loaded=[];map.on('error',e=>errors.push(e.error?.message));map.on('sourcedata',e=>{if(e.sourceId==='radar'&&e.tile?.state==='loaded')loaded.push(e.tile.tileID.canonical);});
  await new Promise((resolve,reject)=>{map.on('load',resolve);setTimeout(()=>reject(new Error('MapLibre load timeout')),20000);});
  map.setProjection({type:'globe'});await new Promise(resolve=>setTimeout(resolve,8000));
  return{version:maplibregl.getVersion(),projection:map.getProjection(),errors,loadedTiles:loaded.length};
 },{date:frame.date,layer:layer.id});
 await probe.screenshot({path:'.artifacts/maplibre-real-probe.png'});
 const files=layer.frames.filter(f=>f.image);
 report.C={frames:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),maxFrameBytes:Math.max(...files.map(f=>f.bytes)),dimensions:[...new Set(files.map(f=>f.width+'x'+f.height))]};
 console.log(JSON.stringify(report,null,2));
}finally{await writeFile('.artifacts/globe-option-probe.json',JSON.stringify(report,null,2));await browser.close();}
