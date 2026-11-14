import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.DISPLAY_TEST_URL||'http://127.0.0.1:5174';
const m=JSON.parse(await readFile('public/data/globe/manifest.json','utf8')),layer=m.layers[m.defaultLayer],latest=layer.frames.at(-1);
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={checks:[],errors:[],pixelComparison:null};
function pass(text){report.checks.push(text);console.log('PASS '+text);}
function monitor(page){page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});}
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});monitor(page);
 await page.goto(base+'/#globe');
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date',latest.date,{timeout:25000});
 const font=await page.locator('.satellite-heading h1').evaluate(el=>getComputedStyle(el).fontFamily);
 assert.ok(font.includes('system-ui'));assert.ok(!font.includes('Georgia'));
 const bodyFont=await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily);assert.equal(font,bodyFont);
 const radius=await page.locator('#satellite-mode').evaluate(el=>parseFloat(getComputedStyle(el).borderRadius));assert.ok(radius>=20);
 pass('Globe title inherits the original system font; controls use the original rounded shape');
 await expect(page.getByLabel('Geographic context',{exact:true})).toBeChecked();
 await expect(page.locator('.satellite-context-source')).toContainText('not satellite imagery');
 await page.screenshot({path:'.artifacts/globe-fixed-light.png',fullPage:true});
 const light=await page.locator('.satellite-page').evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.locator('#toggle-theme').click();
 const dark=await page.locator('.satellite-page').evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(dark,light);
 assert.equal(await page.locator('.satellite-heading h1').evaluate(el=>getComputedStyle(el).fontFamily),font);
 await page.screenshot({path:'.artifacts/globe-fixed-dark.png',fullPage:true});pass('Both original color themes are inherited without changing the typography');
 // Compare every real opaque source pixel against the composited surface.
 report.pixelComparison=await page.evaluate(async frame=>{
  const {composeSatelliteSurface}=await import('/src/satellite-surface.js');
  // Import the application's geographic loader to use its exact saved outlines.
  const {geography}=await import('/src/world.js');const countries=await geography();
  const img=new Image();img.src='/'+frame.image;await img.decode();
  const raw=document.createElement('canvas');raw.width=img.naturalWidth;raw.height=img.naturalHeight;const c=raw.getContext('2d');c.drawImage(img,0,0);
  const pixels=c.getImageData(0,0,raw.width,raw.height).data;
  const surface=composeSatelliteSurface(countries,img,true),out=surface.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
  let opaque=0,changed=0,reference=0;
  for(let i=0;i<pixels.length;i+=4){
   if(pixels[i+3]===255){opaque++;for(let j=0;j<3;j++)if(out[i+j]!==pixels[i+j]){changed++;break;}}
   else if(out[i+3]===255&&out[i]+out[i+1]+out[i+2]>0)reference++;
  }
  const hidden=composeSatelliteSurface(countries,null,false).getContext('2d').getImageData(0,0,1,1).data;
  return{opaque,changed,reference,hidden:[...hidden]};
 },latest);
 assert.ok(report.pixelComparison.opaque>0);assert.equal(report.pixelComparison.changed,0);assert.ok(report.pixelComparison.reference>0);assert.deepEqual(report.pixelComparison.hidden,[16,26,42,255]);
 pass('Every opaque radar pixel keeps its source RGB; only uncovered pixels receive geographic context');
 await page.getByLabel('Geographic context',{exact:true}).uncheck();
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-geographic-context','false');await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date',latest.date);
 await page.getByLabel('Geographic context',{exact:true}).check();pass('Reference map toggles independently of the exact dated radar frame');
 await page.getByRole('button',{name:'Find this frame',exact:true}).click();
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-latitude',latest.focus.lat.toFixed(3));await expect(page.locator('#globe-stage')).toHaveAttribute('data-longitude',latest.focus.lng.toFixed(3));
 pass('Find this frame returns the camera to actual coverage without changing the date');
 // A delayed optical request must never replace the NISAR material.
 await page.route('https://gibs.earthdata.nasa.gov/**',async route=>{
  if(new URL(route.request().url()).searchParams.get('LAYERS')!=='MODIS_Terra_CorrectedReflectance_TrueColor')return route.continue();
  await new Promise(resolve=>setTimeout(resolve,1800));
  await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><path fill="red" d="M0 0h8v4H0z"/></svg>'});
 });
 await page.locator('#concept-mode').click();await page.locator('.globe-layer-settings summary').click();await page.locator('#globe-imagery').click();
 await page.locator('#satellite-mode').click();await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date',latest.date);
 await page.waitForTimeout(100);const before=await page.locator('#globe-canvas canvas').screenshot();
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-imagery','ready',{timeout:10000});await page.waitForTimeout(100);
 const after=await page.locator('#globe-canvas canvas').screenshot();await writeFile('.artifacts/optical-race-before.png',before);await writeFile('.artifacts/optical-race-after.png',after);const python=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
 report.opticalRace=JSON.parse(execFileSync(python,['-c',"from PIL import Image;import numpy as np,json;a=np.asarray(Image.open('.artifacts/optical-race-before.png')).astype(int);b=np.asarray(Image.open('.artifacts/optical-race-after.png')).astype(int);d=np.abs(a-b);print(json.dumps({'maxChannelDelta':int(d.max()),'changedPixels':int(np.any(d>0,axis=2).sum()),'pixels':int(a.shape[0]*a.shape[1])}))"],{encoding:'utf8'}));
 assert.ok(report.opticalRace.maxChannelDelta<=1&&report.opticalRace.changedPixels/report.opticalRace.pixels<.0001,'Satellite image changed beyond one-level screenshot quantization');
 pass('Delayed Concept optical imagery cannot overwrite or recolor the Satellite surface');
 await page.locator('#globe-canvas canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-renderer','canvas',{timeout:15000});
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true');await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date',latest.date);
 await page.screenshot({path:'.artifacts/globe-fixed-recovered.png'});pass('Graphics-context loss recovers to a geographic Canvas globe with the same radar date');
 await page.close();
 // Force context loss while the initial seed image is still queued.
 const early=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});monitor(early);
 await early.addInitScript(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');let used=false;
  Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){
   if(!used&&String(value).startsWith('data:image/png;')&&String(value).length<200){
    used=true;setTimeout(()=>descriptor.set.call(this,value),400);
    setTimeout(()=>document.querySelector('#globe-canvas canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(),20);
   }else descriptor.set.call(this,value);
  }});

 });
 await early.goto(base+'/#globe');
 await expect(early.locator('#globe-stage')).toHaveAttribute('data-renderer','canvas',{timeout:30000});
 await expect(early.locator('#globe-stage')).toHaveAttribute('data-ready','true');
 await expect(early.locator('#globe-stage')).toHaveAttribute('data-radar-date',latest.date,{timeout:25000});
 pass('An interrupted initialization cannot dispose the replacement renderer');
 await early.close();assert.deepEqual(report.errors,[]);
}finally{await writeFile('.artifacts/globe-display-report.json',JSON.stringify(report,null,2));await browser.close();}
