import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5175';
const keys=['sites','enso','evidence','news','sources'];
const files=Object.fromEntries(await Promise.all(keys.map(async key=>[key,JSON.parse(await readFile('public/data/'+key+'.json','utf8'))])));
const labels={sites:'study sites',enso:'NOAA ocean context',news:'news archive',evidence:'radar preview summaries',sources:'source index'};
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
let checks=0;const pass=text=>{checks++;console.log('PASS '+text);};
const pages=[];const errors=[];
async function setup(handler){const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});pages.push(page);page.on('pageerror',e=>errors.push(e.message));const counts=Object.fromEntries(keys.map(k=>[k,0]));await page.route('**/data/*.json',async route=>{const key=keys.find(k=>new URL(route.request().url()).pathname.endsWith('/data/'+k+'.json'));if(!key)return route.continue();counts[key]++;await handler(route,key,counts);});return {page,counts};}
const serve=(route,key)=>route.fulfill({json:files[key]});
try{
 for(const key of ['enso','news','evidence','sources']){
  let fail=true;const {page,counts}=await setup((route,k)=>k===key&&fail?route.fulfill({status:503,json:{error:'Controlled '+k+' failure'}}):serve(route,k));
  await page.goto(base+'/#story');await expect(page.locator('#story-sites .evidence-row')).toHaveCount(4);
  const route=key==='news'?'media':key==='sources'?'method':'story';await page.evaluate(hash=>{location.hash=hash;},route);
  const section=page.locator(route==='media'?'#page-news':route==='method'?'#page-method':'#page-story');
  await expect(section.getByRole('button',{name:'Retry '+labels[key],exact:true})).toBeVisible();
  if(key==='news'){await expect(page.locator('#news-search')).toHaveCount(0);await page.locator('#analysis-text').fill('Rainfall risk');await page.locator('#analyze-local').click();await expect(page.locator('#analysis-output')).not.toBeEmpty();}
  if(key==='sources')await expect(page.getByRole('button',{name:'Download source index'})).toBeDisabled();
  const before={...counts};fail=false;await section.getByRole('button',{name:'Retry '+labels[key],exact:true}).click();
  await expect(section.getByRole('button',{name:'Retry '+labels[key],exact:true})).toHaveCount(0);
  if(key==='news')await expect(page.locator('#news-search')).toBeVisible();if(key==='evidence')await expect(page.locator('.hero-observation img')).toBeVisible();if(key==='sources')await expect(page.getByRole('button',{name:'Download source index'})).toBeEnabled();
  for(const k of keys)assert.equal(counts[k],before[k]+(k===key?1:0),'Retry must affect only '+key);
  await page.evaluate(()=>{location.hash='sites/angat';});await expect(page.locator('.site-timeline')).toBeVisible();await expect(page.locator('#site-select')).toHaveValue('angat');
  pass(key+' failure is local; scoped Retry makes a new request, restores content, and leaves other datasets and Sites usable');await page.close();
 }
 {
  const held=new Map();const {page,counts}=await setup(async(route,key)=>{if(key==='sites')return serve(route,key);await new Promise(resolve=>held.set(key,{route,resolve}));});
  await page.goto(base+'/#sites/angat?date=2026-10-31',{waitUntil:'domcontentloaded'});await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-date','2026-10-31');
  await page.getByRole('link',{name:/4.*Media/}).click();await expect(page.locator('#page-news .dataset-notice')).toHaveAttribute('data-dataset-status','loading');await expect(page.locator('#analysis-text')).toBeVisible();
  await page.locator('#analysis-text').focus();const hash=await page.evaluate(()=>location.hash);
  for(const key of ['evidence','enso','sources','news']){await expect.poll(()=>held.has(key)).toBe(true);const pending=held.get(key);await serve(pending.route,key);pending.resolve();}
  await expect(page.locator('#news-search')).toBeVisible();await expect(page.locator('#analysis-text')).toBeFocused();assert.equal(await page.evaluate(()=>location.hash),hash);
  await page.getByRole('link',{name:/2.*Sites/}).click();await expect(page.locator('.site-timeline')).toBeVisible();await page.getByRole('link',{name:/5.*Data and method/}).click();await expect(page.locator('#page-method')).toBeVisible();
  for(const key of keys)assert.equal(counts[key],1);pass('Sites starts before optional requests finish; out-of-order arrivals preserve route and focus, and navigation reuses root successes');await page.close();
 }
 {
  let fail=true;const {page,counts}=await setup((route,key)=>key==='sites'&&fail?route.fulfill({status:500,json:{error:'Controlled essential failure'}}):serve(route,key));
  await page.goto(base+'/#sites/piura');await expect(page.getByRole('button',{name:'Retry study sites'})).toBeVisible();await expect(page.locator('#site-select')).toHaveCount(0);const before={...counts};fail=false;await page.getByRole('button',{name:'Retry study sites'}).click();await expect(page.locator('#site-select')).toHaveValue('piura');for(const key of keys)assert.equal(counts[key],before[key]+(key==='sites'?1:0));pass('Essential sites failure shows a dedicated Retry, preserves the requested site URL and reuses successful optional requests');await page.close();
 }
 {
  let finishSites;const {page}=await setup(async(route,key)=>{if(key!=='sites')return serve(route,key);await new Promise(resolve=>finishSites=async()=>{await route.fulfill({status:503,json:{error:'No site catalog'}});resolve();});});
  await page.goto(base+'/#media',{waitUntil:'domcontentloaded'});await expect(page.locator('#news-search')).toBeVisible();await page.locator('#news-search').focus();await finishSites();await expect(page.locator('#news-search')).toBeFocused();
  await page.getByRole('link',{name:/5.*Data and method/}).click();await expect(page.locator('#page-method')).toBeVisible();
  await page.locator('#open-search').click();await expect(page.getByRole('dialog').getByRole('button',{name:'Retry study sites'})).toBeVisible();await page.keyboard.press('Escape');
  pass('Media, method and search remain usable while the essential site catalog is pending or failed');await page.close();
 }
 {
  const {page}=await setup((route,key)=>key==='sites'?route.fulfill({json:[]}):serve(route,key));await page.goto(base+'/#sites/angat');await expect(page.locator('main > .wrap:visible > .dataset-notice')).toHaveAttribute('data-dataset-status','empty');await expect(page.locator('#site-select')).toHaveCount(0);pass('An empty essential site catalog is explicit and never invents a default site');await page.close();
 }
 {
  let malformed=true;const {page,counts}=await setup((route,key)=>key==='news'&&malformed?route.fulfill({json:{items:'invalid'}}):serve(route,key));await page.goto(base+'/#media');await expect(page.locator('#page-news .dataset-notice')).toHaveAttribute('data-dataset-status','error');malformed=false;await page.getByRole('button',{name:'Retry news archive',exact:true}).click();await expect(page.locator('#news-search')).toBeVisible();assert.equal(counts.news,2);pass('Malformed successful JSON is a dataset failure, not fabricated empty content, and validation failures can be retried');await page.close();
 }
 {
  const {page}=await setup((route,key)=>key==='news'?route.fulfill({json:{...files.news,items:[]}}):serve(route,key));await page.goto(base+'/#media');await expect(page.locator('#page-news .dataset-notice')).toHaveAttribute('data-dataset-status','empty');await expect(page.locator('#news-search')).toBeVisible();pass('A valid empty news archive is distinct from loading or request failure');await page.close();
 }
 {
  const {page}=await setup((route,key)=>key==='sites'?serve(route,key):route.fulfill({status:503,json:{error:'Optional unavailable'}}));await page.goto(base+'/#sites/angat');await expect(page.locator('.site-timeline')).toBeVisible();await page.locator('#site-select').selectOption('dadu');await expect(page.locator('.site-timeline')).toHaveAttribute('aria-label',/Dadu/);await page.evaluate(()=>{location.hash='globe?mode=concept&site=dadu&month=2026-10';});await expect(page.locator('.concept-timeline')).toBeVisible();await expect(page.locator('.concept-evidence-values').getByRole('button',{name:'Retry NOAA ocean context'})).toBeVisible();await expect(page.locator('[data-testid=concept-date]')).toContainText('October');pass('All optional root files can fail together without blocking per-site evidence or dated vegetation and weather context');await page.close();
 }
 if(process.env.CHECK_OFFLINE==='1'){
  const page=await browser.newPage();pages.push(page);const external=[];page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});await page.goto(pathToFileURL(path.resolve('el-nino-app.html')).href+'#story');await expect(page.locator('#story-sites .evidence-row')).toHaveCount(4);await expect(page.locator('.hero-observation img')).toBeVisible();await page.evaluate(()=>{location.hash='media';});await expect(page.locator('#news-search')).toBeVisible();await expect(page.locator('#page-news .dataset-notice')).toHaveCount(0);assert.deepEqual(external,[]);pass('Embedded root data restores Story and Media offline without any external requests');
 }
 if(process.env.CHECK_OFFLINE==='1'){
  const page=await browser.newPage();const external=[];page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  const html=(await readFile('el-nino-app.html','utf8')).replace('globalThis.__PACIFIC_ASSETS__=',"delete globalThis.__PACIFIC_DATA__['news.json'];globalThis.__PACIFIC_ASSETS__=");
  await page.goto('about:blank#media');await page.setContent(html,{waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'Retry news archive',exact:true})).toBeVisible();await expect(page.locator('#analysis-text')).toBeVisible();
  await page.evaluate(news=>{globalThis.__PACIFIC_DATA__['news.json']=news;},files.news);await page.getByRole('button',{name:'Retry news archive',exact:true}).click();await expect(page.locator('#news-search')).toBeVisible();assert.deepEqual(external,[]);
  pass('Missing embedded optional data stays local and Retry rereads restored embedded data without external requests');await page.close();
 }
 assert.deepEqual(errors,[]);console.log(checks+' startup browser groups passed');
}finally{await browser.close();}
