import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174';
const fixtures=Object.fromEntries(await Promise.all(['angat','dadu','luzon','piura'].map(async id=>[id,JSON.parse(await readFile('public/data/context/'+id+'.json','utf8'))])));
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={checks:[],pageErrors:[]};
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const json=(route,data)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 let attempts=0,evidenceRequests=0;
 const initial=deferred(),retry=deferred();
 page.on('request',r=>{if(r.url().endsWith('/sites/angat/evidence.json'))evidenceRequests++;});
 await page.route('**/data/context/angat.json',async route=>{
  attempts++;if(attempts===1){await initial.promise;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Controlled weather failure"}'});}
  await retry.promise;return json(route,fixtures.angat);
 });
 await page.goto(base+'/#sites/angat',{waitUntil:'domcontentloaded'});
 const weather=page.locator('#site-weather');
 await expect(weather).toHaveAttribute('data-weather-state','loading');await expect(weather.locator('svg')).toHaveCount(0);
 await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');
 initial.resolve();await expect(weather).toHaveAttribute('data-weather-state','error');
 await expect(weather.getByRole('alert')).toContainText('could not be loaded');
 const evidenceBefore=evidenceRequests;
 await page.locator('#retry-weather').click();await expect(weather).toHaveAttribute('data-weather-state','loading');
 await expect(weather.locator('svg')).toHaveCount(0);retry.resolve();await expect(weather).toHaveAttribute('data-weather-state','ready');
 assert.equal(attempts,2);assert.equal(evidenceRequests,evidenceBefore);
 pass('Loading, failed request and weather-only Retry preserve working radar without stale charts');
 await expect(weather.locator('.chart-svg')).toHaveCount(2);
 await expect(weather.locator('.rain-departures').first()).toContainText('-149.57 mm');
 await expect(weather.locator('.temperature-departures')).toContainText('+1.05');
 await expect(weather).toContainText('Incomplete month');await expect(weather).toContainText('Observation unavailable');
 await weather.locator('details').first().locator('summary').click();
 await expect(weather.locator('table').first()).toContainText('260.47');
 const scale=await weather.locator('.chart-svg').first().locator('text').allTextContents();
 await page.locator('#weather-year').selectOption('2025');
 await expect(weather.getByRole('heading',{name:'Rainfall each month / 2025'})).toBeVisible();
 assert.deepEqual(await weather.locator('.chart-svg').first().locator('text').allTextContents(),scale.filter(t=>t!=='I'&&t!=='—'));
 await page.locator('#weather-year').selectOption('2026');
 pass('Real monthly baselines, numerical departures, missing months and stable year scales render');
 // Switch twice while Dadu is held; a late Dadu response cannot replace Piura.
 const old=deferred(),current=deferred(),oldDone=deferred();
 await page.route('**/data/context/dadu.json',async route=>{await old.promise;await json(route,fixtures.dadu);oldDone.resolve();});
 await page.route('**/data/context/piura.json',async route=>{await current.promise;return json(route,fixtures.piura);});
 await page.locator('#site-select').selectOption('dadu');await expect(weather).toHaveAttribute('data-weather-site','dadu');
 await expect(weather).toHaveAttribute('data-weather-state','loading');await expect(weather.locator('svg')).toHaveCount(0);
 await page.locator('#site-select').selectOption('piura');await expect(weather).toHaveAttribute('data-weather-site','piura');
 await expect(weather.locator('svg')).toHaveCount(0);current.resolve();await expect(weather).toHaveAttribute('data-weather-state','ready');
 await expect(weather.locator('.rain-departures').first()).toContainText('+10.87 mm');
 old.resolve();await oldDone.promise;await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await expect(weather.locator('.rain-departures').first()).toContainText('+10.87 mm');
 await expect(weather).not.toContainText('-149.57 mm');
 pass('Switching sites clears old charts and rejects an out-of-order response');
 await page.route('**/data/context/luzon.json',route=>json(route,{monthly:[],baselineMonthly:[],status:'not available'}));
 await page.locator('#site-select').selectOption('luzon');await expect(weather).toHaveAttribute('data-weather-state','ready');
 await expect(weather).toContainText('No complete monthly weather observations');await expect(weather.getByRole('alert')).toHaveCount(0);
 await expect(page.locator('#retry-weather')).toHaveCount(0);
 pass('Successfully loaded unavailable data is distinct from a failed request');
 await page.unroute('**/data/context/luzon.json');
 await page.locator('#site-select').selectOption('angat');await expect(weather).toHaveAttribute('data-weather-state','ready');
 // Check both designs at desktop and phone width, including expanded data tables.
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toggle-theme').click();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await weather.locator('details').last().evaluate(el=>el.open=true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal document overflow');
   await weather.scrollIntoViewIfNeeded();await weather.screenshot({path:'.artifacts/weather-'+theme+'-'+width+'.png'});
  }
 }
 pass('Weather charts and expanded tables fit desktop and phone widths in both themes');
 assert.deepEqual(report.pageErrors,[]);
 await page.close();
 if(process.env.CHECK_OFFLINE==='1'){
  const offline=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),requests=[];
  offline.on('pageerror',e=>report.pageErrors.push(e.message));
  offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await offline.goto(pathToFileURL(path.resolve('el-nino-app.html')).href+'#sites/angat');
  await expect(offline.locator('#site-weather')).toHaveAttribute('data-weather-state','ready');
  await expect(offline.locator('#site-weather .chart-svg')).toHaveCount(2);
  await expect(offline.locator('#site-weather')).toContainText('-149.57 mm');
  assert.equal(await offline.locator('.weather-legend').first().evaluate(el=>getComputedStyle(el).display),'flex');
  assert.deepEqual(requests,[]);assert.deepEqual(report.pageErrors,[]);await offline.close();
  pass('Regenerated offline weather charts include styles and real baselines without external requests');
 }

}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await browser.close();await writeFile('.artifacts/weather-browser-report.json',JSON.stringify(report,null,2));}
