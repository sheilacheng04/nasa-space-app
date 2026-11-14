import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const base=process.env.DISPLAY_TEST_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const errors=[];
const monitor=page=>page.on('pageerror',error=>errors.push(error.message));
const ready=page=>expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:25000});
const pass=message=>console.log('PASS '+message);
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});monitor(page);
 await page.goto(base+'/#globe?mode=illustrative&month=2026-10&date=2026-10-31');await ready(page);
 const stage=page.locator('#globe-stage'),panel=page.locator('.illustrative-panel');
 await expect(page.locator('#illustrative-mode')).toHaveAttribute('aria-pressed','true');
 await expect(stage).toHaveAttribute('data-arc-count',/^[1-9]/);await expect(stage).toHaveAttribute('data-ring-count',/^[1-9]/);
 await expect(page.locator('#globe-rotate')).toHaveAttribute('aria-pressed','true');
 const longitude=await stage.getAttribute('data-longitude');await expect.poll(()=>stage.getAttribute('data-longitude')).not.toBe(longitude);
 await page.locator('#globe-rotate').click();
 await expect(page.locator('#illustrative-play')).toBeEnabled();
 // With a stationary camera and no phase playback, a changed image exercises arc/ring motion.
 const first=await page.locator('#globe-canvas').screenshot();await page.waitForTimeout(400);const second=await page.locator('#globe-canvas').screenshot();
 assert.notDeepEqual(first,second,'Arcs and rings should animate while the camera is stationary');
 await page.locator('#illustrative-phase').fill('0');await page.locator('#illustrative-play').click();
 await expect.poll(async()=>Number(await stage.getAttribute('data-phase'))).toBeGreaterThan(1);
 await page.locator('#illustrative-play').click();await expect(panel).toHaveAttribute('data-playing','false');
 for(const layer of ['rain','stress','geography','heat']){await page.locator('[data-illustrative-layer='+layer+']').click();await expect(stage).toHaveAttribute('data-layer',layer);}
 await panel.getByRole('button',{name:'Pacific links',exact:true}).click();await expect(stage).toHaveAttribute('data-arc-count','0');await panel.getByRole('button',{name:'Pacific links',exact:true}).click();
 await panel.getByRole('button',{name:'Labels',exact:true}).click();await expect(stage).toHaveAttribute('data-label-count','0');await panel.getByRole('button',{name:'Labels',exact:true}).click();
 await page.locator('#globe-query').fill('Peru');await page.locator('#globe-search-submit').click();await expect(panel.getByRole('heading',{name:'Peru',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Open satellite window'}).click();await expect(page.locator('#local-window')).toBeVisible();await page.locator('#local-window-close').click();
 await panel.getByRole('tab',{name:'Guided tour'}).click();await expect(panel).toContainText('Step 1 of');await panel.getByRole('button',{name:'Next →',exact:true}).click();await expect(panel).toContainText('Step 2 of');
 await expect(panel.getByRole('link',{name:'Open radar observations'})).toHaveAttribute('href',/^#sites\//);
 await page.screenshot({path:'.artifacts/concept-globe-desktop.png',fullPage:true});
 pass('Concept layers, rotating Earth, animated links/rings, phase playback, search, satellite window and guided camera tour');
 await page.locator('#illustrative-play').click();
 await page.locator('#concept-mode').click();await expect(panel).toHaveAttribute('data-playing','false');await expect(stage).toHaveAttribute('data-vegetation-date','2026-10-01',{timeout:20000});
 await expect(stage).toHaveAttribute('data-arc-count','0');await expect(stage).toHaveAttribute('data-ring-count','0');
 await page.locator('#satellite-mode').click();await expect(stage).toHaveAttribute('data-radar-date','2026-10-31',{timeout:20000});await expect(stage).toHaveAttribute('data-vegetation-visible','false');
 await page.locator('#illustrative-mode').click();await expect(stage).toHaveAttribute('data-arc-count',/^[1-9]/);await expect(stage).toHaveAttribute('data-radar-visible','false');
 await page.goBack();await expect(page.locator('#satellite-mode')).toHaveAttribute('aria-pressed','true');await page.goForward();await expect(page.locator('#illustrative-mode')).toHaveAttribute('aria-pressed','true');
 await page.reload();await ready(page);await expect(panel).toBeVisible();
 pass('All three modes, exact radar date and vegetation month, URL history and refresh remain usable');
 // Exercise optional imagery and failure recovery with deterministic responses.
 await panel.locator('summary').click();await page.route('https://gibs.earthdata.nasa.gov/**',async route=>route.fulfill({contentType:'image/jpeg',body:await readFile('public/data/globe/blue-marble.jpg')}));
 await panel.getByRole('button',{name:'Load satellite imagery',exact:true}).click();await expect(stage).toHaveAttribute('data-illustrative-image-date','2026-11-14',{timeout:20000});
 await page.route('https://gibs.earthdata.nasa.gov/**',route=>route.fulfill({status:503,body:'Controlled imagery outage'}));await panel.locator('#illustrative-image-date').fill('2026-11-13');await panel.getByRole('button',{name:'Load satellite imagery',exact:true}).click();await expect(panel.locator('.illustrative-imagery [role=status]')).toContainText('Imagery unavailable');await expect(stage).toHaveAttribute('data-illustrative-image-date','2026-11-14');
 await panel.getByRole('button',{name:'Hide satellite imagery'}).click();await expect(stage).toHaveAttribute('data-illustrative-image-date','');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(stage).toHaveAttribute('data-ring-count','0');await expect(page.locator('#globe-rotate')).toHaveAttribute('aria-pressed','false');
 await page.locator('#illustrative-phase').fill('30');await expect(stage).toHaveAttribute('data-phase','30');
 await page.evaluate(()=>{const canvas=document.querySelector('#globe-canvas canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');gl?.getExtension('WEBGL_lose_context')?.loseContext();});
 await ready(page);await expect(stage).toHaveAttribute('data-renderer','canvas');await expect(stage).toHaveAttribute('data-layer','heat');await expect(stage).toHaveAttribute('data-phase','30');
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(stage).toHaveAttribute('data-ring-count',/^[1-9]/);
 const canvasFirst=await page.locator('#globe-canvas').screenshot();await page.waitForTimeout(400);assert.notDeepEqual(canvasFirst,await page.locator('#globe-canvas').screenshot(),'Canvas rings and arcs animate');
 await page.locator('#illustrative-play').click();await page.evaluate(()=>{location.hash='media';});await expect(stage).toHaveAttribute('data-rendering','paused');await expect(panel).toHaveAttribute('data-playing','false');
 pass('Optional imagery, reduced motion, canvas graphics recovery, fallback animation and navigation pause');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});monitor(mobile);
 await mobile.goto(base+'/#globe?mode=illustrative');await ready(mobile);assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mobile.locator('[data-illustrative-layer=rain]').click();await expect(mobile.locator('#globe-stage')).toHaveAttribute('data-layer','rain');
 await mobile.locator('#illustrative-phase').fill('0');await mobile.locator('#illustrative-play').scrollIntoViewIfNeeded();await expect(mobile.locator('#illustrative-play')).toBeEnabled();await mobile.locator('#illustrative-play').click();await expect.poll(async()=>Number(await mobile.locator('#globe-stage').getAttribute('data-phase'))).toBeGreaterThan(1);await mobile.locator('#illustrative-play').click();
 await mobile.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});await mobile.screenshot({path:'.artifacts/concept-globe-mobile.png',fullPage:true});
 await mobile.locator('#toggle-theme').click();await mobile.screenshot({path:'.artifacts/concept-globe-mobile-dark.png',fullPage:true});await mobile.close();pass('Touch-sized controls, responsive layout, light and dark themes');
 if(process.env.CHECK_OFFLINE){
  const offline=await browser.newPage({viewport:{width:1280,height:1000}});monitor(offline);let requests=0;await offline.route(/^https?:/,route=>{requests++;return route.abort();});
  await offline.goto(pathToFileURL(path.resolve('el-nino-app.html')).href+'#globe?mode=illustrative');await ready(offline);await expect(offline.locator('#globe-stage')).toHaveAttribute('data-arc-count',/^[1-9]/);await expect(offline.locator('.illustrative-panel')).toBeVisible();assert.equal(requests,0);await offline.close();pass('Standalone offline edition includes the concept globe without network requests');
 }
 assert.deepEqual(errors,[]);pass('No application errors');
}finally{await browser.close();}
