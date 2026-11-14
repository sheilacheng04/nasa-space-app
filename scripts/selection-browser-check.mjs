import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {siteHash,globeHash} from '../src/selection-url.js';
import {pathToFileURL} from 'node:url';import path from 'node:path';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174';
const e=JSON.parse(await readFile('public/data/sites/angat/evidence.json','utf8')),gibs=e.gibs.frames.filter(f=>f.image),[before,after]=e.browse.frames;
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={checks:[],pageErrors:[]};const pass=s=>{report.checks.push(s);console.log('PASS '+s);};
try{
 await mkdir('.artifacts',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>report.pageErrors.push(e.message));
 // Crops are contextual; prevent a live provider dependency in these URL tests.
 await page.route('https://gibs.earthdata.nasa.gov/**',route=>route.abort('failed'));
 let evidenceRequests=0,weatherRequests=0;page.on('request',r=>{if(r.url().endsWith('/sites/angat/evidence.json'))evidenceRequests++;if(r.url().endsWith('/context/angat.json'))weatherRequests++;});
 const comparison=siteHash('angat',{source:'browse',channel:'HV',view:'swipe',before:before.date,after:after.date});
 await page.goto(base+'/'+comparison);await expect(page.locator('#swipe-range')).toBeVisible();await expect(page.locator('[data-pol=HV]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.radar-record').first()).toContainText(before.date);await expect(page.locator('.radar-record').last()).toContainText(after.date);
 await page.reload();await expect(page.locator('#swipe-range')).toBeVisible();await expect(page.locator('[data-pol=HV]')).toHaveAttribute('aria-pressed','true');
 pass('Direct site comparison links and refresh restore the source, channel and exact before/after acquisitions');
 const firstLink=siteHash('angat',{date:gibs[0].date});await page.goto(base+'/'+firstLink);await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[0].date);
 const initialEvidence=evidenceRequests,initialWeather=weatherRequests;
 await page.getByRole('button',{name:'Next radar image',exact:true}).click();await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[1].date);
 assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('date'),gibs[1].date);
 await page.goBack();await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[0].date);
 await page.goForward();await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[1].date);
 assert.equal(evidenceRequests,initialEvidence);assert.equal(weatherRequests,initialWeather);
 pass('Discrete date changes update the URL; Back/Forward restore them without reloading site evidence or weather');
 const length=await page.evaluate(()=>history.length);await page.locator('#site-date-slider').fill(String(e.gibs.frames.findIndex(f=>f.date===gibs[2].date)));
 await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[2].date);assert.equal(await page.evaluate(()=>history.length),length);
 await page.locator('#site-play').click();await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[3].date);await page.locator('#site-play').click();assert.equal(await page.evaluate(()=>history.length),length);
 pass('Scrubbing and playback replace the current history entry instead of adding an entry for every frame');
 await page.goto(base+'/#sites/angat?source=browse&channel=HV&view=swipe&before=2026-01-01&after=2026-12-31');
 await expect(page.locator('#radar-stage-container img')).toHaveCount(0);await expect(page.locator('.radar-record').first()).toContainText('2026-01-01');await expect(page.locator('.radar-record').last()).toContainText('2026-12-31');
 await page.reload();await expect(page.locator('.radar-record').last()).toContainText('2026-12-31');
 await page.goto(base+'/#sites/unknown?source=invalid&channel=invalid&date=2026-02-30');await expect(page.locator('#site-select')).toHaveValue('angat');await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs.at(-1).date);
 await page.goto(base+'/#sites/angat?date=2026-11-11');await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date','2026-11-11');await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','missing');const unchangedHistory=await page.evaluate(()=>history.length);await page.getByRole('button',{name:'Radar images',exact:true}).click();await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date','2026-11-11');assert.equal(await page.evaluate(()=>history.length),unchangedHistory);
 pass('Unavailable dates remain explicit gaps across refresh; invalid values use supported defaults');
 await page.locator('#site-select').selectOption('dadu');assert.equal(new URL(page.url()).hash.split('?')[0],'#sites/dadu');await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');await page.goBack();await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date','2026-11-11');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedLink=text;}}}));
 await page.getByRole('button',{name:'Copy link',exact:true}).click();await expect(page.locator('.share-view:visible')).toContainText('Link copied.');const copied=await page.evaluate(()=>window.__copiedLink);assert.equal(new URL(copied).hash,siteHash('angat',{date:'2026-11-11'}));
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard denied');}}}));await page.getByRole('button',{name:'Copy link',exact:true}).click();await expect(page.getByLabel('Link to copy manually')).toHaveValue(copied);
 pass('Site changes create restorable routes; Copy link reports success and provides manual-copy fallback on failure');
 const rawPlaces=JSON.parse(await readFile('public/data/gazetteer.json','utf8').catch(()=>readFile('public/data/places.json','utf8')));
 const placeName=Array.isArray(rawPlaces)?rawPlaces[0].name:rawPlaces.places.find(p=>p[0].length>2)[0];
 const globeLink=globeHash({mode:'concept',site:'dadu',date:'2026-10-31',month:'2026-09'});
 await page.goto(base+'/'+globeLink);await expect(page.locator('#concept-mode')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#concept-site')).toHaveValue('dadu');await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2026-09');await expect(page.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-09-01',{timeout:25000});
 await page.reload();await expect(page.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-09-01',{timeout:25000});await expect(page.locator('#concept-site')).toHaveValue('dadu');
 await page.locator('#open-search').click();await page.locator('#global-search').fill(placeName);await page.locator('#search-results a[href="#globe"]').filter({hasText:placeName}).first().click();await expect(page.locator('#concept-mode')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2026-09');
 await page.locator('#vegetation-calendar-month').fill('2026-10');await expect(page.locator('#globe-stage')).toHaveAttribute('data-vegetation-date','2026-10-01');await page.goBack();await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2026-09');await page.goForward();await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2026-10');
 await page.locator('#satellite-mode').click();await expect(page.locator('#radar-calendar-date')).toHaveValue('2026-10-31');await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date','2026-10-31');
 await page.goBack();await expect(page.locator('#concept-mode')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2026-10');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedLink=text;}}}));await page.getByRole('button',{name:'Copy link',exact:true}).click();
 const globeCopy=new URL(await page.evaluate(()=>window.__copiedLink));const globeParams=new URLSearchParams(globeCopy.hash.split('?')[1]);assert.equal(globeParams.get('mode'),'concept');assert.equal(globeParams.get('site'),'dadu');assert.equal(globeParams.get('month'),'2026-10');assert.equal(globeParams.get('date'),'2026-10-31');
 pass('Globe links, refresh, copying and history restore independent mode, site, radar date and vegetation month');
 await page.goto(base+'/#globe?mode=concept&site=angat&month=2025-04&date=2026-08-04');await expect(page.locator('.concept-vegetation')).toHaveAttribute('data-vegetation-status','gap');await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2025-04');await page.locator('#satellite-mode').click();await expect(page.locator('#radar-calendar-date')).toHaveValue('2026-08-04');await expect(page.locator('#globe-stage')).toHaveAttribute('data-frame-status','gap');
 await page.goto(base+'/#globe?mode=concept&month=2024-06&date=2027-01-01');await expect(page.locator('#vegetation-calendar-month')).toHaveValue('2024-06');await expect(page.locator('.concept-vegetation')).toHaveAttribute('data-vegetation-status','gap');await page.locator('#satellite-mode').click();await expect(page.locator('#radar-calendar-date')).toHaveValue('2027-01-01');await expect(page.locator('#globe-stage')).toHaveAttribute('data-frame-status','gap');await expect(page.locator('.gap-overlay')).toContainText('No saved NISAR image');
 pass('Missing vegetation months and radar dates outside the saved archive remain selected without substitute imagery');
 await page.getByRole('link',{name:/Story/}).first().click();await expect(page.locator('#page-story')).toBeVisible();await page.goBack();await expect(page.locator('#radar-calendar-date')).toHaveValue('2027-01-01');
 await page.setViewportSize({width:390,height:844});const spacing=await page.evaluate(()=>document.querySelector('.globe-content').getBoundingClientRect().top-document.querySelector('.coverage-note').getBoundingClientRect().bottom);assert.ok(spacing<100,'Share controls displaced the mobile globe grid');assert.ok(await page.locator('.satellite-workspace').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1),'Share controls displaced the mobile bottom sheet');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'.artifacts/share-view-mobile.png',fullPage:true});
 pass('Existing page navigation, Back to evidence and mobile layout remain functional');
 await page.close();
 if(process.env.CHECK_OFFLINE==='1'){
  const offline=await browser.newPage(),requests=[];offline.on('pageerror',e=>report.pageErrors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await offline.goto(pathToFileURL(path.resolve('el-nino-app.html')).href+siteHash('angat',{date:gibs[0].date}));await expect(offline.locator('.site-timeline')).toHaveAttribute('data-frame-date',gibs[0].date);await expect(offline.getByRole('button',{name:'Copy link',exact:true})).toBeDisabled();await expect(offline.locator('.share-view:visible')).toContainText('cannot be shared across devices');assert.deepEqual(requests,[]);await offline.close();pass('Offline links restore embedded selections locally and never claim local file links are shareable');
 }
 assert.deepEqual(report.pageErrors,[]);
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await browser.close();await writeFile('.artifacts/selection-browser-report.json',JSON.stringify(report,null,2));}
