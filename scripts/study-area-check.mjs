import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const ids=['cagayan-valley','mekong-delta','guayas-babahoyo'];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-webgl']});
const report={checks:[],errors:[],offlineRequests:[]};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
try{
 await mkdir('.artifacts',{recursive:true});
 for(const offline of [false,true])for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  if(!offline)await context.route('http://localhost:5179/**',async route=>{
   const name=decodeURIComponent(new URL(route.request().url()).pathname.slice(1))||'index.html';
   if(name.includes('..'))return route.fulfill({status:400});
   try{await route.fulfill({body:await readFile(path.join('dist',name)),contentType:mime[path.extname(name)]||'application/octet-stream'});}
   catch{await route.fulfill({status:404});}
  });
  await context.route('https://**/*',route=>route.abort());
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  if(offline)page.on('request',request=>{if(/^https?:/.test(request.url()))report.offlineRequests.push(request.url());});
  const base=offline?pathToFileURL(path.resolve('el-nino-app.html')).href:'http://localhost:5179/';
  for(const id of ids){
   await page.goto(base+'#sites/'+id);
   await expect(page.locator('#site-select')).toHaveValue(id);
   await expect(page.locator('.site-timeline')).toHaveAttribute('data-frame-status','ready',{timeout:15000});
   await expect(page.locator('.site-timeline img')).toHaveJSProperty('complete',true);
   assert(await page.locator('.site-timeline img').evaluate(img=>img.naturalWidth>0));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
   assert(!overflow,`${id} ${width}px has horizontal overflow`);
  }
  await page.goto(base+'#globe?mode=illustrative&site=mekong-delta');
  await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:25000});
  const launch=page.getByRole('button',{name:'Open satellite window',exact:true});
  await expect(launch).toHaveCount(1);
  await expect(page.locator('#satellite-window-place')).toContainText('Mekong');
  const layout=await launch.evaluate(button=>({height:button.getBoundingClientRect().height,beforeControls:!!(button.compareDocumentPosition(document.querySelector('.illustrative-layers'))&Node.DOCUMENT_POSITION_FOLLOWING)}));
  assert(layout.height>=44&&layout.beforeControls);
  await launch.click();await expect(page.locator('#local-window')).toBeVisible();
  await page.getByRole('button',{name:'Study radar',exact:true}).click();
  await expect(page.locator('#local-window')).toHaveAttribute('data-state','ready',{timeout:15000});
  await expect(page.locator('#local-window-image')).toHaveAttribute('alt',/Mekong/);
  await page.locator('#local-window-close').click();await expect(launch).toBeFocused();
  await page.screenshot({path:`.artifacts/study-area-${offline?'offline':'hosted'}-${width}.png`});
  report.checks.push(`${offline?'Offline':'Hosted'} ${width}px: all three new site images, full-width layout, prominent action, actual saved radar, close and focus return`);
  console.log('PASS',report.checks.at(-1));await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.offlineRequests,[]);
}finally{await writeFile('.artifacts/study-area-check.json',JSON.stringify(report,null,2));await browser.close();}
