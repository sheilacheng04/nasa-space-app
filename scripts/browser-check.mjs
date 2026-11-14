import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174';
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const report={checks:[],consoleErrors:[],pageErrors:[],contrast:[],screenshots:[]};
const check=s=>{report.checks.push(s);console.log('PASS '+s);};
try{
 await mkdir('.artifacts',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.goto(base,{waitUntil:'networkidle'});
 await expect(page.locator('#story-sites .evidence-row')).toHaveCount(4);
 await expect(page.locator('.hero-observation img')).toBeVisible();
 await expect(page.locator('.hero-observation img')).toHaveJSProperty('complete',true);
 await page.screenshot({path:'.artifacts/revision-story-desktop.png',fullPage:true});report.screenshots.push('revision-story-desktop.png');
 await expect(page.locator('#page-story h1')).toContainText('what changes on land');await expect(page.locator('#reading-radar')).toContainText(/synthetic aperture radar/i);await expect(page.locator('#reading-radar')).toContainText('NISAR');
 check('Global story explains radar in plain language and retains four real study examples');
 for(const route of ['sites/angat','media','method']){
  await page.goto(base+'/#'+route,{waitUntil:'networkidle'});
  const id=route.startsWith('sites')?'sites':route==='media'?'news':'method';
  await expect(page.locator('#page-'+id)).toBeVisible();
 }
 check('Story, Sites, Media and Data and method render');
 await page.goto(base+'/#sites/angat',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Before / after',exact:true}).click();await expect(page.locator('#swipe-range')).toBeVisible();
 await page.locator('#swipe-range').fill('72');
 await expect(page.locator('.compare-after')).toHaveAttribute('style',/72%/);
 await page.getByRole('button',{name:'Regional radar views',exact:true}).click();
 await page.getByText('Radar channels and processing details',{exact:true}).click();await page.locator('[data-pol="HV"]').click();await expect(page.locator('[data-pol="HV"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-pol="ratio"]')).toBeDisabled();
 await expect(page.locator('[data-pol="VV"]')).toHaveCount(0);
 check('Real swipe and HH/HV controls work; missing computed channels are unavailable');
 await page.getByRole('button',{name:'Practice with simulated data',exact:true}).click();
 await expect(page.locator('#radar-status')).toContainText('SIMULATED');
 await page.getByRole('button',{name:'Radar images',exact:true}).click();
 await page.getByRole('button',{name:'Before / after',exact:true}).click();await page.locator('#date-slider').fill('0');
 await expect(page.locator('#radar-stage-container')).toContainText('Choose an earlier');
 await page.locator('#site-select').selectOption('dadu');
 await expect(page.locator('.method-note').first()).toContainText('La Ni');
 await page.locator('#site-select').selectOption('angat');
 await page.getByRole('button',{name:'Before / after',exact:true}).click();await expect(page.locator('#swipe-range')).toBeVisible();
 await page.screenshot({path:'.artifacts/revision-sites-desktop.png',fullPage:true});
 check('Simulated mode, missing dates, Dadu distinction and site switching work');
 await page.locator('#pending-map').click();
 await expect(page.locator('.maplibregl-canvas')).toBeVisible({timeout:20000});
 check('MapLibre detailed map loads on demand');
 await page.goto(base+'/#media',{waitUntil:'networkidle'});
 await page.locator('#news-search').fill('zzzznoresults');await expect(page.locator('#news-list')).toContainText('No headlines');
 await page.locator('#news-search').fill('');
 await page.locator('.news-item').first().getByRole('button').click();
 await expect(page.locator('.news-item').first().locator('.ai-result')).toContainText('Simulated');
 check('Media filtering and explicitly simulated Claude fallback work');
 await page.goto(base+'/#method',{waitUntil:'networkidle'});await expect(page.locator('#page-method h1')).toHaveCount(1);await expect(page.locator('#my-data')).not.toHaveAttribute('open','');await expect(page.getByText('Advanced: radar processing and quality checks',{exact:true}).locator('..')).not.toHaveAttribute('open','');check('Data and method follows a plain-language path with advanced records and optional imports collapsed');
 await page.goto(base+'/#method/my-data',{waitUntil:'networkidle'});
 await page.locator('#csv-input').fill('name,lat,lng,value,category,date\n"Rice, north",15.5,120.9,0,mm,2026-11-01');
 await page.locator('#import-csv').click();await expect(page.locator('#csv-status')).toContainText('Imported 1');
 check('CSV import preserves zero and quoted place names');
 await page.locator('#open-search').click();await page.locator('#global-search').fill('Angat');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(page.locator('#search-dialog')).not.toBeVisible();
 await expect(page.locator('#site-select')).toHaveValue('angat');
 check('Command search supports keyboard selection and focus return');
 await page.goto(base+'/#globe',{waitUntil:'networkidle'});
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:25000});
 await expect(page.locator('#globe-stage')).toHaveAttribute('data-user-point-count','1');check('Lazy globe renders and retains clearly labeled imported observation points');
 for(const route of ['story','sites/angat','media','method']){
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/#'+route,{waitUntil:'networkidle'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  if(overflow)throw new Error('Horizontal overflow at 390px on '+route);
  if(route==='story'||route==='sites/angat')await page.screenshot({path:'.artifacts/revision-'+route.replace('/','-')+'-mobile.png',fullPage:true});
 }
 check('All text/image pages fit 390px phone width');
 await page.locator('#open-search').click();await expect(page.locator('#search-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#search-dialog')).not.toBeVisible();
 check('Mobile search bottom sheet closes with Escape');
 report.contrast=await page.evaluate(()=>{
  const c=getComputedStyle(document.documentElement);
  const lum=h=>{const a=h.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];};
  const bg=lum(c.getPropertyValue('--bg').trim());
  return ['--ink','--muted','--blue','--orange'].map(v=>{const fg=lum(c.getPropertyValue(v).trim());return {foreground:v,background:'--bg',ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};});
 });
 if(report.contrast.some(c=>c.ratio<4.5))throw new Error('AA palette contrast failed');
 check('Body, muted text, blue and orange exceed 4.5:1 contrast');
 await page.locator('#toggle-theme').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload({waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 for(const route of ['story','sites/angat','media','method']){
  await page.goto(base+'/#'+route,{waitUntil:'networkidle'});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Dark theme phone overflow on '+route);
 }
 await page.goto(base+'/#story',{waitUntil:'networkidle'});
 await page.screenshot({path:'.artifacts/restored-content-dark-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'.artifacts/restored-content-dark-desktop.png',fullPage:true});
 await page.locator('#toggle-theme').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 check('Restored light/dark toggle persists and all text pages fit in dark mode');
 if(existsSync('el-nino-app.html')&&process.env.CHECK_OFFLINE==='1'){
  const offline=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});const requests=[];
  offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  offline.on('pageerror',e=>report.pageErrors.push('offline: '+e.message));
  await offline.goto(pathToFileURL(path.resolve('el-nino-app.html')).href);
  await expect(offline.locator('#story-sites .evidence-row')).toHaveCount(4);
  await expect(offline.locator('.hero-observation img')).toHaveJSProperty('naturalWidth',240);
  for(const route of ['sites/angat','media','method','globe']){
   await offline.evaluate(route=>location.hash=route,route);
   if(route==='globe')await expect(offline.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:25000});
   else if(route.startsWith('sites')){await expect(offline.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready');await offline.locator('#site-play').click();await expect(offline.locator('.site-timeline')).toHaveAttribute('data-frame-date','2026-06-23');await expect(offline.locator('.site-timeline')).toHaveAttribute('data-frame-date','2026-11-02',{timeout:7000});await expect(offline.locator('#site-play')).toHaveAttribute('aria-pressed','false');}
  }
  if(requests.length)throw new Error('Offline external requests: '+requests.join(','));
  check('Self-contained preview has real thumbnails, all pages, globe and zero external requests');
 }
 if(report.pageErrors.length||report.consoleErrors.length)throw new Error('Browser errors: '+JSON.stringify({page:report.pageErrors,console:report.consoleErrors}));
} catch(e){report.failure=e.message;console.error(e.message);process.exitCode=1;}
finally{await browser.close();await writeFile('.artifacts/revision-browser-report.json',JSON.stringify(report,null,2));}
