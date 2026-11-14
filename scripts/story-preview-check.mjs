import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const base='http://127.0.0.1:5175';
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,executablePath});
const errors=[];
const evidence=JSON.parse(await readFile('public/data/evidence.json','utf8'));
async function setup({width=1280,theme='light',offline=false}={}){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'no-preference'});
 await context.addInitScript(theme=>{localStorage.setItem('pacific-first-visit-guide-dismissed-v1','1');localStorage.setItem('pacific-theme',theme);},theme);
 if(!offline)await context.route(base+'/**',async route=>{
  const name=new URL(route.request().url()).pathname.replace(/^\//,'')||'index.html';
  const file=path.resolve('dist',name);
  if(!file.startsWith(path.resolve('dist')+path.sep)){await route.abort();return;}
  try{await route.fulfill({body:await readFile(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(name)]||'application/octet-stream'});}
  catch{await route.fulfill({status:404,body:'Not found'});}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page,url:(offline?pathToFileURL(path.resolve('el-nino-app.html')).href:base+'/')+'#story/reading-radar'};
}
const player=page=>page.getByTestId('story-preview-player');
try{
 for(const offline of [false,true])for(const width of [1280,390]){
  const {context,page,url}=await setup({width,offline});const network=[];
  page.on('request',r=>{if(offline&&/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(url);const view=player(page);
  await expect(view.getByRole('button',{name:/step|guide/i})).toHaveCount(0);
  for(const row of evidence){
   await view.getByLabel('Study area').selectOption(row.siteId);
   await expect(view.locator('[data-image-status="ready"]')).toHaveCount(2);
   const imgs=view.locator('img');await expect(imgs).toHaveCount(2);
   const urls=await imgs.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));assert.notEqual(urls[0],urls[1]);
   const dates=await view.locator('time').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('datetime')));assert.ok(dates[0]<dates[1]);
   for(const img of await imgs.all()){await expect(img).toHaveJSProperty('complete',true);assert.ok(await img.evaluate(n=>n.naturalWidth>0));}
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(network,[]);
  console.log('PASS immediate comparison and all study areas: '+width+'px '+(offline?'offline':'hosted'));await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
