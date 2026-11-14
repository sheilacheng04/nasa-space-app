import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174';
const evidence=Object.fromEntries(await Promise.all(['angat','dadu','luzon','piura'].map(async id=>[id,JSON.parse(await readFile('public/data/sites/'+id+'/evidence.json','utf8'))])));
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={checks:[],pageErrors:[],opticalRequests:[]};
const pass=message=>{report.checks.push(message);console.log('PASS '+message);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>report.pageErrors.push(e.message));
 const e=evidence.angat,available=e.gibs.frames.filter(f=>f.image),latest=available.at(-1);
 // Controlled image responses test transport/empty handling, not actual optical availability.
 const fixture=await readFile('public/'+available[0].image);
 const empty=Buffer.from(await page.evaluate(()=>document.createElement('canvas').toDataURL('image/png').split(',')[1]),'base64');
 let behavior='success',held;
 await page.route('https://gibs.earthdata.nasa.gov/**',async route=>{
  const url=new URL(route.request().url());report.opticalRequests.push({date:url.searchParams.get('TIME'),bounds:url.searchParams.get('BBOX')});
  const action=behavior;if(action==='held'){const gate=held;await gate.promise;}
  try{if(action==='failure')await route.fulfill({status:503,contentType:'text/plain',body:'Controlled failure'});
  else await route.fulfill({contentType:'image/png',body:action==='empty'?empty:fixture});}catch{/* A superseded request may already be aborted. */}
 });
 await page.goto(base+'/#sites/angat');await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');
 await page.locator('#pending-map').click();const map=page.locator('#context-map');
 await expect(map).toHaveAttribute('data-radar-state','ready',{timeout:20000});
 await expect(map).toHaveAttribute('data-map-error','');await expect(map).toHaveAttribute('data-selected-date',latest.date);await expect(map).toHaveAttribute('data-radar-bounds',latest.parameters.BBOX.split(',').map(Number).join(','));
 await expect(map.locator('.map-selection-label')).toContainText('NASA GIBS');await expect(map).toHaveAttribute('data-footprint','unavailable');
 const canvas=await map.locator('canvas').elementHandle();await page.locator('#site-play').click();await expect(map).toHaveAttribute('data-rendered-date',available[0].date);await page.locator('#site-play').click();await expect(page.locator('.site-timeline')).toHaveAttribute('data-playing','false');await map.getByRole('button',{name:'Zoom in',exact:true}).click();
 await page.locator('#site-date-slider').fill(String(e.gibs.frames.indexOf(available[1])));
 await expect(map).toHaveAttribute('data-rendered-date',available[1].date);
 assert.ok(await canvas.evaluate(el=>el.isConnected&&el===document.querySelector('#context-map canvas')));
 pass('Selected GIBS browse uses exact saved bounds and dates; playback and date updates preserve the map canvas and zoom controls');
 const delayed=available[2],newer=available[3],gate=deferred(),pattern='**/'+delayed.image;
 await page.route(pattern,async route=>{await gate.promise;try{await route.continue();}catch{}});
 await page.locator('#site-date-slider').fill(String(e.gibs.frames.indexOf(delayed)));await expect(map).toHaveAttribute('data-radar-state','loading');await expect(map).toHaveAttribute('data-rendered-date','');
 await page.locator('#site-date-slider').fill(String(e.gibs.frames.indexOf(newer)));await expect(map).toHaveAttribute('data-rendered-date',newer.date);gate.resolve();await page.unroute(pattern);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await expect(map).toHaveAttribute('data-rendered-date',newer.date);
 let mapFailures=0;const failurePattern='**/'+available[4].image;
 await page.route(failurePattern,route=>route.request().resourceType()==='fetch'&&++mapFailures===1?route.abort('failed'):route.continue());
 await page.locator('#site-date-slider').fill(String(e.gibs.frames.indexOf(available[4])));await expect(map).toHaveAttribute('data-radar-state','error');await expect(map).toHaveAttribute('data-rendered-date','');
 await map.getByRole('button',{name:'Retry map radar',exact:true}).click();await expect(map).toHaveAttribute('data-rendered-date',available[4].date);await page.unroute(failurePattern);
 pass('Delayed and failed map radar requests clear old imagery; newer dates win and Retry keeps the selected date');
 await page.getByRole('button',{name:'Regional radar views',exact:true}).click();await expect(map).toHaveAttribute('data-evidence-mode','browse');
 await expect(map).toHaveAttribute('data-radar-state','unavailable');await expect(map).toHaveAttribute('data-radar-bounds','');
 await expect(map).toHaveAttribute('data-footprint-id',e.browse.frames[1].id);
 await expect(map.locator('.map-evidence-note')).toContainText('no saved image-to-ground transform');
 await expect(map.locator('.map-record-metadata')).toContainText('CRID: P05023');await map.getByRole('button',{name:'Fit selected footprint',exact:true}).click();await map.screenshot({path:'.artifacts/site-map-regional-footprint.png'});
 await page.getByText('Radar channels and processing details',{exact:true}).click();await page.locator('[data-pol="HV"]').click();await expect(map).toHaveAttribute('data-channel','HV');
 await page.locator('#after-date').selectOption('0');await expect(map).toHaveAttribute('data-footprint-id',e.browse.frames[0].id);
 assert.ok(await canvas.evaluate(el=>el.isConnected&&el===document.querySelector('#context-map canvas')));
 pass('Regional HH/HV selection changes metadata and exact-identity footprint without georeferencing the quicklook');
 const optical=map.locator('[data-optical]');await optical.check();await expect(map).toHaveAttribute('data-optical-state','ready');
 const firstDay=e.browse.frames[0].date.slice(0,10),secondDay=e.browse.frames[1].date.slice(0,10);
 assert.equal(report.opticalRequests.at(-1).date,firstDay);assert.equal(report.opticalRequests.at(-1).bounds,e.inventory.bbox.join(','));
 await expect(map).toHaveAttribute('data-optical-date',firstDay);await expect(map.locator('.map-optical-status')).toContainText('not necessarily simultaneous');
 assert.equal(new URL(await map.getByRole('link',{name:'NASA GIBS optical source'}).getAttribute('href')).searchParams.get('TIME'),firstDay);
 pass('Optical requests use only the selected acquisition UTC day and label the MODIS daily mosaic, source and timing limits');
 behavior='failure';await page.locator('#after-date').selectOption('1');await expect(map).toHaveAttribute('data-optical-state','error');
 await expect(map).toHaveAttribute('data-optical-date','');await expect(map.locator('.map-optical-status')).toContainText('No other date is substituted');assert.equal(report.opticalRequests.at(-1).date,secondDay);
 behavior='empty';await map.getByRole('button',{name:'Retry optical',exact:true}).click();await expect(map).toHaveAttribute('data-optical-state','error');assert.equal(report.opticalRequests.at(-1).date,secondDay);
 behavior='success';await map.getByRole('button',{name:'Retry optical',exact:true}).click();await expect(map).toHaveAttribute('data-optical-date',secondDay);
 pass('Failed and empty optical responses clear the old layer; Retry retains the exact selected date');
 held=deferred();behavior='held';await page.locator('#after-date').selectOption('0');await expect(map).toHaveAttribute('data-optical-state','loading');await expect(map).toHaveAttribute('data-optical-date','');
 behavior='success';await page.locator('#after-date').selectOption('1');await expect(map).toHaveAttribute('data-optical-date',secondDay);held.resolve();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await expect(map).toHaveAttribute('data-optical-date',secondDay);await expect(map.locator('.map-optical-status')).not.toContainText(firstDay);
 pass('A delayed superseded optical response cannot restore an earlier date or label');
 await page.getByRole('button',{name:'Practice with simulated data',exact:true}).click();await expect(map).toHaveAttribute('data-evidence-mode','simulated');
 await expect(map).toHaveAttribute('data-footprint-id','');await expect(map).toHaveAttribute('data-radar-bounds','');await expect(map).toHaveAttribute('data-optical-date','');await expect(optical).toBeDisabled();
 await page.getByRole('button',{name:'Radar images',exact:true}).click();await expect(map).toHaveAttribute('data-radar-state','ready');
 const gap=e.gibs.frames.find(f=>!f.image);await page.locator('#site-date-slider').fill(String(e.gibs.frames.indexOf(gap)));await expect(map).toHaveAttribute('data-selected-date',gap.date);await expect(map).toHaveAttribute('data-radar-state','unavailable');await expect(map).toHaveAttribute('data-rendered-date','');
 pass('Simulation and missing radar dates clear old imagery and footprints without substitute observations');
 await page.locator('#site-select').selectOption('dadu');await expect(map).toHaveAttribute('data-site-id','dadu',{timeout:20000});await expect(map).toHaveAttribute('data-radar-state','ready');
 await expect(map.locator('.map-selection-label')).toContainText('Dadu');await expect(map.locator('.map-selection-label')).not.toContainText('Angat');
 await expect(page.locator('#pending-map')).toHaveText('Close detailed map');
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#toggle-theme').click();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await expect(map).toHaveAttribute('data-map-error','');await map.screenshot({path:'.artifacts/site-map-'+theme+'-'+width+'.png'});}
 }
 pass('Switching sites retains the open map, loads the new site and fits desktop and phone widths in both themes');
 await page.locator('#pending-map').click();await expect(map).toHaveCount(0);await page.close();
 // Missing georeferencing and unmatched catalog IDs are exercised without changing saved data.
 const fixtureData=structuredClone(evidence.luzon);for(const f of fixtureData.gibs.frames){delete f.parameters;delete f.url;}for(const f of fixtureData.browse.frames)f.id='unmatched-'+f.id;
 const missing=await browser.newPage();missing.on('pageerror',e=>report.pageErrors.push(e.message));
 await missing.route('**/data/sites/luzon/evidence.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(fixtureData)}));
 await missing.goto(base+'/#sites/luzon');await expect(missing.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');await missing.locator('#pending-map').click();
 await expect(missing.locator('#context-map .map-mount')).toHaveAttribute('data-ready','true');await expect(missing.locator('#context-map')).toHaveAttribute('data-radar-state','unavailable');
 await expect(missing.locator('.map-evidence-note')).toContainText('georeferencing is unavailable');
 await missing.getByRole('button',{name:'Regional radar views',exact:true}).click();await expect(missing.locator('#context-map')).toHaveAttribute('data-footprint','unavailable');await missing.close();
 pass('Missing request bounds and unmatched acquisitions show unavailable rather than borrowing unrelated georeferencing or footprints');
 assert.deepEqual(report.pageErrors,[]);
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await browser.close();await writeFile('.artifacts/site-map-browser-report.json',JSON.stringify(report,null,2));}
