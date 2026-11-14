import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
const base=process.env.PERFORMANCE_TEST_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
let checks=0;const pass=message=>{checks++;console.log('PASS '+message);};
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),requests=[],errors=[];
 page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;window.__rafRuns=0;const pending=new Set();
  window.requestAnimationFrame=callback=>{let id=raf(time=>{pending.delete(id);window.__rafRuns++;callback(time);});pending.add(id);return id;};
  window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};window.__pendingFrames=()=>pending.size;
  const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document),visibility=new Set();
  document.addEventListener=(type,callback,options)=>{if(type==='visibilitychange')visibility.add(callback);return add(type,callback,options);};
  document.removeEventListener=(type,callback,options)=>{if(type==='visibilitychange')visibility.delete(callback);return remove(type,callback,options);};window.__visibilityListeners=()=>visibility.size;
 });
 await page.route('https://gibs.earthdata.nasa.gov/**',route=>route.fulfill({status:503,body:'Controlled public imagery outage'}));
 await page.goto(base+'/#story',{waitUntil:'networkidle'});
 assert.equal(requests.filter(url=>(/\/data\/globe\//.test(url)||/globe\.gl\.min/.test(url)&&!new URL(url).searchParams.has('url'))).length,0);pass('Story does not request globe engine, manifests, reference image, radar frames or MODIS assets');
 const hash='#globe?mode=concept&site=angat&month=2026-10&date=2026-10-31';await page.evaluate(hash=>{location.hash=hash;},hash);
 const stage=page.locator('#globe-stage');await expect(stage).toHaveAttribute('data-ready','true',{timeout:20000});await expect(stage).toHaveAttribute('data-vegetation-date','2026-10-01');
 assert.equal(requests.filter(url=>/\/globe\/frames\//.test(url)).length,0);assert.equal(requests.filter(url=>url.startsWith('https://gibs')).length,0);
 await stage.scrollIntoViewIfNeeded();await expect(stage).toHaveAttribute('data-rendering','active');
 await page.evaluate(()=>{window.__retainedCanvas=document.querySelector('#globe-canvas canvas');});
 const counts=()=>requests.filter(url=>/\/data\/globe\/|\/data\/context\/|\/data\/places\.json/.test(url));const before=counts().slice();
 for(let i=0;i<3;i++){
  await page.evaluate(()=>{location.hash='media';});await expect(stage).toHaveAttribute('data-rendering','paused');
  await page.waitForTimeout(200);const start=await page.evaluate(()=>window.__rafRuns);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__rafRuns),start);assert.equal(await page.evaluate(()=>window.__pendingFrames()),0);
  await page.evaluate(hash=>{location.hash=hash;},hash);await stage.scrollIntoViewIfNeeded();await expect(stage).toHaveAttribute('data-rendering','active');await expect(stage).toHaveAttribute('data-vegetation-date','2026-10-01');
 }
 assert.deepEqual(counts(),before);assert(await page.evaluate(()=>window.__retainedCanvas===document.querySelector('#globe-canvas canvas')));pass('Concept requests no radar; repeated navigation retains the renderer and successful assets with no hidden RAF callbacks or duplicate requests');
 const worldURL=await page.evaluate(()=>performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname==='/src/world.js').name);
 const revision=await stage.getAttribute('data-surface-revision');await page.evaluate(async url=>{const w=await import(url);for(let i=0;i<5;i++){w.setGeographicContext(true);w.setGlobeMode('concept');}},worldURL);assert.equal(await stage.getAttribute('data-surface-revision'),revision);pass('Unchanged surface inputs do not recompose pixels or allocate replacement textures');
 await page.locator('#vegetation-calendar-month').fill('2026-09');await expect(stage).toHaveAttribute('data-vegetation-date','2026-09-01');
 await page.locator('#land-play').click();await expect(page.locator('#land-play')).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await expect(stage).toHaveAttribute('data-rendering','paused');await expect(page.locator('#land-play')).toHaveAttribute('aria-pressed','false');
 const hiddenHash=await page.evaluate(()=>location.hash),requestCount=requests.length;await page.waitForTimeout(200);const hiddenRuns=await page.evaluate(()=>window.__rafRuns);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__rafRuns),hiddenRuns);assert.equal(requests.length,requestCount);assert.equal(await page.evaluate(()=>location.hash),hiddenHash);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await stage.scrollIntoViewIfNeeded();await expect(stage).toHaveAttribute('data-rendering','active');await expect(stage).toHaveAttribute('data-vegetation-date','2026-09-01');assert.equal(requests.length,requestCount);pass('Simulated tab visibility pauses rendering and month playback; resumption preserves selection and reuses decoded imagery');
 await page.locator('#satellite-mode').click();await expect(stage).toHaveAttribute('data-frame-status','ready');await expect(stage).toHaveAttribute('data-radar-date','2026-10-31');await expect(page.locator('.satellite-site-panel .site-crop-empty')).toContainText('No coverage');await page.waitForTimeout(500);
 const radarRequests=requests.filter(url=>/\/globe\/frames\/|gibs.*wms/.test(url)).slice();
 await page.evaluate(()=>{location.hash='media';});await expect(stage).toHaveAttribute('data-rendering','paused');await page.evaluate(()=>{location.hash='globe?mode=satellite&site=angat&date=2026-10-31&month=2026-10';});await stage.scrollIntoViewIfNeeded();await expect(stage).toHaveAttribute('data-frame-status','ready');await expect(page.locator('.satellite-site-panel .site-crop-empty')).toContainText('No coverage');await page.waitForTimeout(300);
 assert.deepEqual(requests.filter(url=>/\/globe\/frames\/|gibs.*wms/.test(url)),radarRequests);pass('Returning to the same evidence date reuses radar frames and exact-date crop results, including unresolved coarse coverage');
 const cacheResult=await page.evaluate(async()=>{
  const {FrameCache}=await import('/src/globe-data.ts');const cache=new FrameCache();let started=0,releases=[];
  cache.retrieve=frame=>new Promise(resolve=>{started++;releases.push(()=>resolve({url:URL.createObjectURL(new Blob(['cached'])),date:frame.date,image:new Image(),origin:'saved GIBS frame'}));});
  const frame=i=>({date:String(i),layer:'test'});const jobs=Array.from({length:6},(_,i)=>cache.load(frame(i)).then(()=>true,()=>false));cache.pause();releases.forEach(release=>release());await Promise.all(jobs);const paused=started;cache.resume();await cache.load(frame(0));const hit=started===paused;cache.clear();const closed=await cache.load(frame(9)).then(()=>false,()=>true);return {started,hit,closed};
 });assert.deepEqual(cacheResult,{started:3,hit:true,closed:true});pass('Pausing drops queued prefetch, retains bounded in-flight successes, and disposed caches reject further work');
 const listeners=await page.evaluate(()=>window.__visibilityListeners());await page.evaluate(async url=>{const world=await import(url);world.disposeGlobe();},worldURL);await expect(stage).toHaveAttribute('data-rendering','paused');assert.equal(await page.locator('#globe-canvas canvas').count(),0);assert.equal(await page.evaluate(()=>window.__visibilityListeners()),listeners-1);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__pendingFrames()),0);pass('Explicit renderer teardown removes its visibility listener, canvas and pending animation frames');
 const retryPage=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});let failed=true,calls=0;
 await retryPage.route('**/data/globe/vegetation.json',route=>{calls++;return failed?route.fulfill({status:503,json:{error:'Controlled failure'}}):route.continue();});await retryPage.goto(base+'/#globe?mode=concept&month=2026-10');await expect(retryPage.getByRole('button',{name:'Retry vegetation'})).toBeVisible();failed=false;await retryPage.getByRole('button',{name:'Retry vegetation'}).click();await expect(retryPage.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-10-01');assert.equal(calls,2);pass('Failed vegetation metadata is not cached permanently and Retry retrieves the same selected month');
 const delayed=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});let held,imageCalls=0;
 await delayed.route('**/data/globe/vegetation/2026-09-01.webp',route=>{imageCalls++;held=route;});
 const pendingHash='#globe?mode=concept&month=2026-09';await delayed.goto(base+'/'+pendingHash,{waitUntil:'domcontentloaded'});await expect.poll(()=>Boolean(held)).toBe(true);await expect(delayed.locator('#globe-stage')).toHaveAttribute('data-ready','true');
 await delayed.evaluate(()=>{location.hash='media';});await expect(delayed.locator('#globe-stage')).toHaveAttribute('data-rendering','paused');await delayed.evaluate(hash=>{location.hash=hash;},pendingHash);await delayed.locator('#globe-stage').scrollIntoViewIfNeeded();
 await delayed.locator('#vegetation-calendar-month').fill('2026-10');await expect(delayed.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-10-01');
 await held.fulfill({contentType:'image/webp',body:await readFile('public/data/globe/vegetation/2026-09-01.webp')});await delayed.waitForTimeout(100);await expect(delayed.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-10-01');await delayed.locator('#vegetation-calendar-month').fill('2026-09');await expect(delayed.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-09-01');assert.equal(imageCalls,1);pass('An unfinished vegetation decode is shared across navigation and cannot overwrite a different selected month');
 assert.deepEqual(errors,[]);console.log(checks+' globe performance groups passed');
}finally{await browser.close();}
