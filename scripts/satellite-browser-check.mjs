import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5175';
const manifest=JSON.parse(await readFile('public/data/globe/manifest.json','utf8'));
const layer=manifest.layers[manifest.defaultLayer],frames=layer.frames;
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const report={checks:[],pageErrors:[],consoleErrors:[],liveStatus:'',mobile:{},firstLoadBytes:0,globeRequestsOnStory:[]};
function pass(text){report.checks.push(text);console.log('PASS '+text);}
function observe(page){page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});}
async function ready(page){await expect(page.locator('#globe-stage')).toHaveAttribute('data-frame-status','ready',{timeout:25000});}
async function seek(page,date){await page.locator('#satellite-scrubber').fill(String(frames.findIndex(f=>f.date===date)));}
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});observe(page);
 await page.goto(base,{waitUntil:'networkidle'});
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.encodedBodySize})));
 report.firstLoadBytes=resources.reduce((s,r)=>s+r.bytes,0);
 report.globeRequestsOnStory=resources.filter(r=>/globe\.gl|GlobeExperience|globe\/manifest|globe\/frames/.test(r.name)).map(r=>r.name);
 assert.equal(report.globeRequestsOnStory.length,0);assert.ok(report.firstLoadBytes<3000000);pass('Globe engine, controller, manifest and frames stay lazy on Story; first load below 3 MB');
 await page.evaluate(()=>{location.hash='globe?mode=satellite';});await ready(page);
 report.liveStatus=await page.locator('.frame-status').textContent();
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-mode','satellite');
 await expect(page.locator('#satellite-scrubber')).toHaveValue(String(frames.length-1));
 await expect(page.locator('.frame-badge')).toContainText(layer.end);
 await expect(page.locator('.sat-source')).toContainText('NASA GIBS');
 await expect(page.locator('[aria-label="NISAR mosaic layer"] option[value$="_12Day"]')).toHaveJSProperty('disabled',true);
 pass('Default daily mosaic, live-domain endpoints, dated maturity badge and source');
 const camera=()=>page.locator('#globe-stage').evaluate(el=>[el.dataset.latitude,el.dataset.longitude,el.dataset.altitude]);
 const still=await camera();
 await expect(page.locator('#sat-play')).toHaveAttribute('aria-pressed','false');pass('Reduced motion has no autoplay or rotation');
 await page.locator('#concept-mode').click();await expect(page.locator('#globe-stage')).toHaveAttribute('data-mode','concept');assert.deepEqual(await camera(),still);
 await page.evaluate(()=>{const p=new URLSearchParams(location.hash.split('?')[1]);p.set('mode','satellite');location.hash='globe?'+p;});await expect(page.locator('#globe-stage')).toHaveAttribute('data-mode','satellite');await expect(page.locator('.satellite-workspace')).toBeVisible();assert.deepEqual(await camera(),still);
 await expect(page.locator('.frame-badge')).toContainText(layer.end);await expect(page.locator('.sat-source')).toContainText('NASA GIBS');pass('Mode toggle preserves camera and date');
 await expect(page.locator('.sat-marker-layer button').first()).toBeInViewport();
 await page.screenshot({path:'.artifacts/satellite-desktop.png',fullPage:true});
 // Deterministic playback checks serve exact-date saved NASA responses, not invented imagery.
 let delayDate='',failLive=false,failSaved=false,inflight=0,maxInflight=0;
 await page.route('https://gibs.earthdata.nasa.gov/**',async route=>{
  inflight++;maxInflight=Math.max(maxInflight,inflight);
  const url=new URL(route.request().url()),date=url.searchParams.get('TIME'),f=frames.find(f=>f.date===date);
  if(date===delayDate)await new Promise(r=>setTimeout(r,1800));
  if(failLive||!f?.image)await route.fulfill({status:200,contentType:'image/png',body:'invalid image'});
  else await route.fulfill({status:200,contentType:'image/webp',body:await readFile(path.join('public',f.image))});
  inflight--;
 });
 await page.route('**/data/globe/frames/**',async route=>{if(delayDate&&route.request().url().includes(delayDate))await new Promise(r=>setTimeout(r,1800));if(failSaved)await route.fulfill({status:200,contentType:'image/webp',body:'invalid image'});else await route.continue();});
 const scrub=page.locator('#satellite-scrubber');await scrub.focus();await page.keyboard.press('Home');await ready(page);
 await expect(scrub).toHaveValue('0');await page.keyboard.press('ArrowRight');await ready(page);await expect(scrub).toHaveValue('1');
 await page.keyboard.press('ArrowLeft');await ready(page);await expect(scrub).toHaveValue('0');
 await page.keyboard.press('End');await ready(page);await expect(scrub).toHaveValue(String(frames.length-1));
 pass('Keyboard Home, End and arrows select exact frames');
 await seek(page,'2026-08-01');await expect(page.locator('#globe-stage')).toHaveAttribute('data-frame-status','gap');
 await expect(page.locator('.gap-overlay')).toContainText('No NISAR data');
 await expect(page.locator('.frame-badge')).toContainText('2026-08-01');
 await expect(page.locator('.mission-gap-label')).toContainText('No data');pass('Confirmed mission gap is empty with its date retained');
 const early=frames.find(f=>f.date>'2026-02-01'&&f.status==='ready');await seek(page,early.date);await ready(page);pass('Advertised January-June imagery is not replaced with an assumed long gap');
 const idx=frames.findIndex(f=>f.date>'2026-09-01'&&f.status==='ready');delayDate=frames[idx+1].date;
 await seek(page,frames[idx].date);await ready(page);
 await page.locator('[aria-label="Playback speed"]').selectOption('4');
 await scrub.focus();await page.keyboard.press('Space');const announcement=await page.locator('.satellite-page > .sr-only').textContent();await expect(page.locator('.frame-status')).toHaveAttribute('aria-live','off');
 await expect(scrub).toHaveValue(String(idx+1),{timeout:5000});
 await page.waitForTimeout(600);await expect(scrub).toHaveValue(String(idx+1));
 await expect(page.locator('.frame-badge')).toContainText(delayDate);
 await expect(page.locator('.frame-overlay')).toContainText('Loading');assert.equal(await page.locator('.satellite-page > .sr-only').textContent(),announcement);
 await page.keyboard.press('Space');await ready(page);delayDate='';
 pass('Space toggles playback; 4x playback waits for the next image without skipping');
 await seek(page,frames.at(-2).date);await ready(page);await page.locator('#sat-play').click();
 await expect(scrub).toHaveValue(String(frames.length-1));await expect(page.locator('#sat-play')).toHaveAttribute('aria-pressed','false',{timeout:10000});
 await expect(page.getByLabel('Loop',{exact:true})).not.toBeChecked();pass('Loop defaults off and playback stops at the latest frame');
 // Keyboard-accessible marker and command search.
 const dadu=page.locator('.site-marker-list button').filter({hasText:'Dadu'});
 await dadu.focus();await expect(dadu).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('.satellite-site-panel h2')).toContainText('Dadu');
 const openSelectedSite=page.locator('.satellite-site-panel a[href^="#sites/dadu"]');
 await expect(openSelectedSite).toHaveAccessibleName(/Open Dadu, Sindh in Sites/);
 await expect(openSelectedSite).toHaveAttribute('href','#sites/dadu?date='+layer.end);
 await expect(dadu).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.selected-site-context')).toContainText('Pakistan');
 await expect(page.locator('.selected-site-context')).toContainText('67.800\u00b0 E');
 await expect(page.locator('.selected-site-context')).toContainText('saved radar frames');
 await expect(page.locator('.selected-image-heading')).toContainText(layer.end);
 await expect(page.locator('.selected-image-heading')).toContainText('NASA GIBS');
 await expect(page.locator('.satellite-site-panel img, .satellite-site-panel .site-crop-empty')).toBeVisible();
 await openSelectedSite.click();
 await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',layer.end);await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','missing');pass('Enter selects a site; Open in Sites carries and selects the exact globe date');
 await page.evaluate(()=>{location.hash='globe?mode=satellite';});await ready(page);
 const daduPointer=page.locator('.site-marker-list button').filter({hasText:'Dadu'});await daduPointer.click();
 await expect(page.locator('.satellite-site-panel h2')).toContainText('Dadu');await expect(daduPointer).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.satellite-site-panel a[href^="#sites/dadu"]')).toHaveAttribute('href','#sites/dadu?date='+layer.end);
 await page.getByRole('button',{name:'Clear selection'}).click();await expect(page.locator('.satellite-site-panel h2')).toContainText('Explore a study site');await expect(daduPointer).toHaveAttribute('aria-pressed','false');await expect(page).toHaveURL(/#globe\?mode=satellite/);pass('Pointer selection and clear restore the overview and remove selected-site URL state');
 await page.locator('#open-search').click();await page.locator('#global-search').fill('Angat');
 await page.locator('#search-results a[href="#sites/angat"]').press('Enter');
 await expect(page.locator('.satellite-site-panel h2')).toContainText('Angat');assert.equal(new URL(page.url()).hash.split('?')[0],'#globe');assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('site'),'angat');pass('Command search flies to a study site and keeps the globe open');
 // Fresh uncached dates exercise exact-date fallbacks and terminal schematic.
 failLive=true;const fallback=frames.find(f=>f.date>'2026-05-05'&&f.status==='ready');await seek(page,fallback.date);await ready(page);
 await expect(page.locator('.frame-status')).toContainText('Saved NASA GIBS');pass('Saved exact-date radar remains available when the public API fails');
 failSaved=true;const missing=frames.find(f=>f.date>'2026-06-05'&&f.status==='ready');await seek(page,missing.date);
 await expect(page.locator('.failure-copy')).toContainText('NISAR imagery unavailable for this date. The reference Earth stays visible.');
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-basemap','ready');await expect(page.locator('.orbit-schematic')).toHaveCount(0);
 await expect(page.locator('.frame-badge')).toContainText(missing.date);
 failLive=false;failSaved=false;await page.getByRole('button',{name:'Retry imagery'}).click();await ready(page);pass('Missing saved and live radar keeps the satellite Earth visible; retry recovers');
 // One real current-date site crop response is separately verified by the live network probe.
 report.maxConcurrentImageRequests=maxInflight;assert.ok(maxInflight<=3);pass('All image requests, including site crops, share a three-request limit');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});observe(mobile);
 await mobile.goto(base+'/#globe?mode=satellite');await ready(mobile);await mobile.waitForTimeout(300);
 const mobileMetrics=await mobile.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,sheet:document.querySelector('.satellite-workspace').getBoundingClientRect().toJSON(),stage:document.querySelector('#globe-stage').getBoundingClientRect().toJSON(),canvasWidth:document.querySelector('#globe-canvas canvas').width,canvasCSS:document.querySelector('#globe-canvas canvas').clientWidth}));
 assert.ok(mobileMetrics.page<=mobileMetrics.viewport);assert.ok(mobileMetrics.sheet.width<=mobileMetrics.viewport);await mobile.locator('#sat-play').scrollIntoViewIfNeeded();await expect(mobile.locator('#sat-play')).toBeInViewport();assert.ok(mobileMetrics.canvasWidth/mobileMetrics.canvasCSS<=1.26);report.mobile=mobileMetrics;
 await mobile.screenshot({path:'.artifacts/satellite-mobile.png',fullPage:true});pass('390px touch viewport has no horizontal overflow and renderer pixel ratio is capped');
 await mobile.close();
 const offline=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});observe(offline);
 let network=0;offline.on('request',r=>{if(/^https?:/.test(r.url()))network++;});
 await offline.goto(pathToFileURL(path.resolve('el-nino-app.html')).href+'#globe');
 await expect(offline.locator('#globe-stage')).toHaveAttribute('data-mode','illustrative');
 await expect(offline.locator('.illustrative-panel')).toBeVisible();
 assert.equal(network,0);pass('Existing single-file snapshot opens its supported illustrative default without external requests');
 await offline.screenshot({path:'.artifacts/satellite-offline.png'});
 await offline.locator('#concept-mode').click();await expect(offline.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-10-01');
 await offline.locator('#concept-month-range').fill('20');await expect(offline.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-09-01');
 await offline.locator('#concept-month-range').fill('19');await expect(offline.locator('.concept-vegetation')).toHaveAttribute('data-vegetation-status','offline');await expect(offline.locator('#globe-stage')).toHaveAttribute('data-vegetation-visible','false');
 assert.equal(network,0);pass('Offline Concept displays two real monthly land images and clears unembedded months without network requests');

 await offline.close();
 // Force the existing CPU compatibility path and verify an actual dated texture loads.
 const canvas=await browser.newPage({viewport:{width:900,height:800},reducedMotion:'reduce'});observe(canvas);
 await canvas.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return get.call(this,type,...args);};});
 await canvas.goto(base+'/#globe?mode=satellite');await ready(canvas);
 await expect(canvas.locator('#globe-stage')).toHaveAttribute('data-renderer','canvas');
 await canvas.screenshot({path:'.artifacts/satellite-canvas.png'});pass('Canvas compatibility renderer displays a real dated radar texture');
 await canvas.close();
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);pass('No browser console or uncaught application errors, including controlled loading failures');
}finally{
 await writeFile('.artifacts/satellite-check-report.json',JSON.stringify(report,null,2));await browser.close();
}
