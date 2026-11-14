import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174';
const evidence=Object.fromEntries(await Promise.all(['angat','luzon','dadu','piura'].map(async id=>[id,JSON.parse(await readFile('public/data/sites/'+id+'/evidence.json','utf8'))])));
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={checks:[],pageErrors:[]};
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const open=async(id='angat',fixture)=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>report.pageErrors.push(e.message));
 if(fixture)await page.route('**/data/sites/'+id+'/evidence.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(fixture)}));
 await page.goto(base+'/#sites/'+id);await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');return page;
};
const regional=page=>page.getByRole('button',{name:'Regional radar views',exact:true}).click();
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await open('luzon');
 await expect(page.locator('#radar-interpretation')).toContainText('NASA GIBS daily false-color browse');
 await expect(page.locator('.radar-record')).toContainText('not available for mosaic pixels');
 await expect(page.locator('.radar-record')).not.toContainText('P05023');
 await expect(page.locator('.radar-record')).toContainText('120.4, 15, 121.4, 16');
 await expect(page.locator('#radar-measurement-status')).toContainText('Calibrated measurements unavailable');
 pass('Mosaic date, request bounds and browse type are visible; pixel lineage and calibrated measurements stay unavailable');
 await regional(page);await expect(page.locator('#swipe-range')).toBeVisible();
 await expect(page.locator('.radar-record')).toHaveCount(2);await expect(page.locator('.radar-record').first()).toContainText('79.4%');
 await expect(page.locator('.radar-record').last()).toContainText('79.1%');
 await expect(page.locator('#radar-comparison-guidance')).toContainText('Listed track, frame, maturity and CRID match');
 await expect(page.locator('#radar-comparison-guidance')).toContainText('Visual comparison only');
 await page.getByText('Radar channels and processing details',{exact:true}).click();await page.locator('[data-pol="HV"]').click();
 await expect(page.locator('#swipe-range')).toBeVisible();await expect(page.locator('#radar-interpretation')).toContainText('ASF regional HV quicklooks');
 await page.getByText('What footprint overlap means',{exact:true}).click();
 await expect(page.locator('.radar-evidence')).toContainText('not valid radar pixel coverage');
 await page.getByText('Image dates and technical records',{exact:true}).click();
 await expect(page.locator('th').filter({hasText:'Geometric overlap of study box'})).toBeVisible();
 pass('Both regional acquisitions expose known metadata and channel; geometric overlap has an explicit study-box denominator');
 const unknown=structuredClone(evidence.angat);
 for(const f of unknown.browse.frames){for(const key of ['track','frame','maturity','crid','direction'])delete f[key];f.bboxCoverageFraction=null;}
 unknown.inventory.scenes[0].bboxCoverageFraction=null;
 const missing=await open('angat',unknown);await regional(missing);await expect(missing.locator('#swipe-range')).toBeVisible();
 await expect(missing.locator('#radar-comparison-guidance')).toContainText('metadata are incomplete');
 await expect(missing.locator('.radar-record').first()).toContainText('not available');
 await expect(missing.locator('.radar-record').first()).not.toContainText('P05023');
 await expect(missing.locator('.radar-record').first()).not.toContainText('100.0%');
 pass('Absent acquisition metadata and overlap values produce honest unavailable labels');await missing.close();
 const different=structuredClone(evidence.dadu);Object.assign(different.browse.frames[1],{track:999,frame:999,maturity:'BETA',crid:'different'});
 const mismatch=await open('dadu',different);await regional(mismatch);
 await expect(mismatch.locator('#radar-comparison-guidance')).toContainText('Different track, frame, maturity, crid');
 await expect(mismatch.locator('#radar-comparison-guidance')).toContainText('do not derive quantitative change');
 pass('Known metadata mismatches are identified without implying calibrated comparability');await mismatch.close();
 const gap=evidence.luzon.gibs.frames.find(f=>!f.image);
 await page.getByRole('button',{name:'Radar images',exact:true}).click();
 await page.getByRole('button',{name:'Select '+gap.date+', no image available',exact:true}).click();
 await expect(page.locator('.site-time-placeholder')).toContainText('No coverage resolved in the saved preview');
 await expect(page.locator('.site-time-placeholder')).toContainText('does not establish absence');
 await page.goto(base+'/#sites/luzon?date=2026-02-01');
 await expect(page.locator('#radar-interpretation')).toContainText(evidence.luzon.gibs.frames.length+' sampled dates');
 await expect(page.locator('.site-time-placeholder')).toContainText('No acquisition listed for this date in the saved site catalog');
 const listed=structuredClone(evidence.angat),date=listed.gibs.frames.find(f=>f.image).date;
 const f=listed.gibs.frames.find(f=>f.date===date);delete f.image;delete f.reason;
 const noBrowse=await open('angat',listed);await noBrowse.goto(base+'/#sites/angat?date='+date);
 await expect(noBrowse.locator('.site-time-placeholder')).toContainText('Acquisition listed; saved browse image unavailable');
 pass('Empty preview, no catalog listing and listed acquisition without browse have distinct explanations');await noBrowse.close();
 const recovery=await open();let failures=0;
 const image=evidence.angat.browse.frames[1].channels.HH.image;
 await recovery.route('**/'+image,route=>++failures===1?route.abort('failed'):route.continue());
 await regional(recovery);await expect(recovery.locator('#radar-stage-container')).toContainText('Comparison image request failed');
 await expect(recovery.locator('#radar-stage-container img')).toHaveCount(0);
 await recovery.getByRole('button',{name:'Retry comparison images',exact:true}).click();await expect(recovery.locator('#swipe-range')).toBeVisible();
 await recovery.locator('#swipe-range').fill('72');await expect(recovery.locator('.compare-after')).toHaveAttribute('style',/72%/);
 pass('Comparison image failures clear stale imagery, preserve dates and recover through Retry');await recovery.close();
 await page.goto(base+'/#sites/luzon');await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toggle-theme').click();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await regional(page);await expect(page.locator('#swipe-range')).toBeVisible();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Radar page overflow');
   await page.locator('.radar-records').screenshot({path:'.artifacts/radar-metadata-'+theme+'-'+width+'.png'});
  }
 }
 pass('Evidence metadata and comparison controls fit desktop and phone widths in both themes');await page.close();
 if(process.env.CHECK_OFFLINE==='1'){
  const offline=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),requests=[];
  offline.on('pageerror',e=>report.pageErrors.push(e.message));offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await offline.goto(pathToFileURL(path.resolve('el-nino-app.html')).href+'#sites/luzon');await expect(offline.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');
  await expect(offline.locator('.radar-record')).toContainText('not available for mosaic pixels');
  const omitted=evidence.luzon.gibs.frames.filter(f=>f.image)[1];await offline.getByRole('button',{name:'Select '+omitted.date+', no image available',exact:true}).click();
  await expect(offline.locator('.site-time-placeholder')).toContainText('This date is not included offline');
  await regional(offline);await expect(offline.locator('#swipe-range')).toBeVisible();await expect(offline.locator('.radar-record').first()).toContainText('79.4%');
  assert.equal(await offline.locator('.radar-record').first().evaluate(el=>getComputedStyle(el).borderRadius),'10px');
  assert.deepEqual(requests,[]);await offline.close();pass('Offline metadata and comparisons work with exact reconstructed provenance and no external requests');
 }
 assert.deepEqual(report.pageErrors,[]);
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await browser.close();await writeFile('.artifacts/radar-evidence-browser-report.json',JSON.stringify(report,null,2));}
