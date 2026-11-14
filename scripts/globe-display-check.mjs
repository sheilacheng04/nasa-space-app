import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.DISPLAY_TEST_URL||'http://127.0.0.1:5174';
const m=JSON.parse(await readFile('public/data/globe/manifest.json','utf8')),frames=m.layers[m.defaultLayer].frames,latest=frames.at(-1);
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
const report={checks:[],errors:[],pixelComparison:null};
function pass(text){report.checks.push(text);console.log('PASS '+text);}
function monitor(page){page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});}
async function radar(page){await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date',latest.date,{timeout:20000});await expect(page.locator('#globe-stage')).toHaveAttribute('data-basemap','ready');}
async function month(page,value){await page.locator('#concept-month-range').fill(String((Number(value.slice(0,4))-2025)*12+Number(value.slice(5))-1));}
async function vegetation(page,date){await expect(page.locator('#globe-stage')).toHaveAttribute('data-vegetation-date',date,{timeout:12000});}
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});monitor(page);
 // The core Earth + dated layers must work with the public imagery API unreachable.
 await page.route('https://gibs.earthdata.nasa.gov/**',r=>r.fulfill({status:200,contentType:'image/png',body:'unavailable'}));
 await page.goto(base+'/#globe');await radar(page);
 const font=await page.locator('.satellite-heading h1').evaluate(e=>getComputedStyle(e).fontFamily);
 assert.ok(font.includes('system-ui'));assert.equal(font,await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily));
 assert.ok(await page.locator('#satellite-mode').evaluate(e=>parseFloat(getComputedStyle(e).borderRadius)>=20));
 await expect(page.locator('.satellite-context-source')).toContainText('historical 2004');await expect(page.getByLabel('Satellite basemap',{exact:true})).toBeChecked();
 await page.screenshot({path:'.artifacts/globe-fixed-light.png',fullPage:true});pass('Saved optical Earth and exact dated radar work without GIBS; original font and controls retained');
 const light=await page.locator('.satellite-page').evaluate(e=>getComputedStyle(e).backgroundColor);await page.locator('#toggle-theme').click();assert.notEqual(light,await page.locator('.satellite-page').evaluate(e=>getComputedStyle(e).backgroundColor));
 await page.screenshot({path:'.artifacts/globe-fixed-dark.png',fullPage:true});pass('Original light and dark themes work with satellite imagery');
 report.pixelComparison=await page.evaluate(async frame=>{
  const {composeSatelliteSurface}=await import('/src/satellite-surface.js'),{geography}=await import('/src/world.js');
  const countries=await geography(),radar=new Image(),base=new Image();radar.src='/'+frame.image;base.src='/data/globe/blue-marble.jpg';await Promise.all([radar.decode(),base.decode()]);
  const raw=document.createElement('canvas');raw.width=radar.width;raw.height=radar.height;raw.getContext('2d').drawImage(radar,0,0);const pixels=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
  const surface=composeSatelliteSurface(countries,radar,true,base),out=surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data;let opaque=0,changed=0;const colors=new Set();
  for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]===255){opaque++;if([0,1,2].some(j=>pixels[i+j]!==out[i+j]))changed++;}else colors.add(out[i]+','+out[i+1]+','+out[i+2]);}
  return{opaque,changed,baseColors:colors.size};
 },latest);assert.equal(report.pixelComparison.changed,0);assert.ok(report.pixelComparison.opaque>0);assert.ok(report.pixelComparison.baseColors>10000);pass('Real optical texture has geographic detail; every opaque NISAR RGB pixel remains unchanged');
 await page.getByLabel('Satellite basemap',{exact:true}).uncheck();await expect(page.locator('#globe-stage')).toHaveAttribute('data-geographic-context','false');await page.getByLabel('Satellite basemap',{exact:true}).check();
 await page.getByRole('button',{name:'Show more radar coverage'}).click();const best=frames.reduce((a,f)=>(f.nontransparentPixels||0)>(a.nontransparentPixels||0)?f:a,frames[0]);await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date',best.date);assert.ok(best.nontransparentPixels>latest.nontransparentPixels*10);pass('Coverage shortcut selects a real fuller day and basemap toggle keeps the radar date');
 await page.locator('#satellite-scrubber').fill(String(frames.findIndex(f=>f.date==='2026-08-01')));await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-visible','false');await expect(page.locator('#globe-stage')).toHaveAttribute('data-basemap','ready');await expect(page.locator('.gap-overlay')).toContainText('No NISAR data');pass('Mission gap clears dated radar while leaving optical Earth visible');
 await page.getByRole('button',{name:'Latest date',exact:true}).click();await radar(page);
 await page.locator('#concept-mode').click();await vegetation(page,'2026-10-01');await expect(page.locator('#globe-stage')).toHaveAttribute('data-concept-date','2026-10-31');await expect(page.locator('#globe-phase')).toHaveCount(0);
 await expect(page.locator('[data-testid=concept-date]')).toHaveText('October 2026');await expect(page.locator('.concept-evidence-values')).toContainText('110.9 mm');await expect(page.locator('.concept-evidence-values')).toContainText('2026-10-28');
 const selected=page.locator('.concept-land-card').last();await expect(selected).toHaveAttribute('data-signal','drier');pass('Concept defaults to latest complete calendar month with exact ERA5 and preceding NOAA records');
 await page.locator('#concept-site').selectOption('angat');await page.getByRole('button',{name:/Focus .* on globe/}).click();await page.waitForTimeout(100);
 const october=await page.locator('#globe-canvas').screenshot();await month(page,'2026-09');await vegetation(page,'2026-09-01');const september=await page.locator('#globe-canvas').screenshot();assert.notDeepEqual(october,september);await expect(selected).toHaveAttribute('data-signal','wetter');
 await expect(page.locator('.concept-evidence-values')).toContainText('405.6 mm');await expect(page.locator('.concept-land-limit')).toContainText('not a calibrated response model');pass('Month changes alter actual land imagery, rainfall values and labeled land-response illustrations');
 await page.screenshot({path:'.artifacts/concept-calendar.png',fullPage:true});
 await month(page,'2025-04');await expect(page.locator('.concept-vegetation')).toHaveAttribute('data-vegetation-status','gap');await expect(page.locator('#globe-stage')).toHaveAttribute('data-vegetation-visible','false');await expect(page.locator('#globe-stage')).toHaveAttribute('data-basemap','ready');pass('Unadvertised April 2025 vegetation stays absent, without carrying another month');
 await month(page,'2026-11');await expect(page.locator('.concept-month-incomplete')).toContainText('Incomplete month');await expect(selected).toHaveAttribute('data-signal','unknown');const signals=JSON.parse(await page.locator('#globe-stage').getAttribute('data-concept-signals'));assert.ok(signals.every(s=>s.rainAnomaly===null));pass('Incomplete monthly records remain unknown for land illustrations and globe markers');
 // A delayed earlier month cannot replace a newer selection.
 let release;const blocked=new Promise(r=>release=r);await page.route('**/vegetation/2026-06-01.webp',async r=>{await blocked;await r.continue();});
 await month(page,'2026-06');await expect(page.locator('.concept-vegetation')).toHaveAttribute('data-vegetation-status','loading');await month(page,'2026-07');await vegetation(page,'2026-07-01');release();await page.waitForTimeout(350);await vegetation(page,'2026-07-01');pass('Late monthly imagery cannot overwrite the selected month');
 await month(page,'2026-10');await vegetation(page,'2026-10-01');await page.locator('#concept-play').click();await expect(page.locator('[data-testid=concept-date]')).toHaveText('January 2025');await page.locator('#concept-play').click();await expect(page.locator('#concept-play')).toHaveAttribute('aria-pressed','false');pass('Calendar playback restarts from the beginning and can be paused');
 await month(page,'2026-10');await vegetation(page,'2026-10-01');await page.locator('.concept-radar-links button').click();await expect(page.locator('#satellite-mode')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#globe-stage')).toHaveAttribute('data-radar-date','2026-10-31');await expect(page.locator('#globe-stage')).toHaveAttribute('data-vegetation-visible','false');pass('Month-end radar link carries the exact date and isolates the two observation layers');
 await page.locator('#concept-mode').click();await vegetation(page,'2026-10-01');await page.evaluate(()=>document.querySelector('#globe-canvas canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await expect(page.locator('#globe-stage')).toHaveAttribute('data-renderer','canvas');await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true');await vegetation(page,'2026-10-01');await expect(page.locator('#globe-stage')).toHaveAttribute('data-basemap','ready');pass('Graphics recovery preserves optical Earth, vegetation month and land context');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});monitor(mobile);await mobile.goto(base+'/#globe');await radar(mobile);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:'.artifacts/earth-mobile-satellite.png',fullPage:true});
 await mobile.locator('#concept-mode').click();await vegetation(mobile,'2026-10-01');assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:'.artifacts/earth-mobile-concept.png',fullPage:true});pass('Satellite and calendar land views fit a 390px touch screen');await mobile.close();
 assert.deepEqual(report.errors,[]);pass('No application or console errors across both globe modes and recovery');
}finally{await writeFile('.artifacts/globe-display-report.json',JSON.stringify(report,null,2));await browser.close();}
