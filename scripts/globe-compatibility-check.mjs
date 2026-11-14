import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const offline=process.env.OFFLINE==='true';
const url=offline?pathToFileURL(path.resolve('demo/pacific-preview.html')).href+'#globe':(process.env.TEST_URL||'http://127.0.0.1:5173')+'/#globe';
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const report={url,checks:[],errors:[],requests:[]};await mkdir('.artifacts',{recursive:true});
try{for(const mode of ['webgl2','webgl1','canvas']){
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'no-preference'}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});if(offline)page.on('request',r=>{if(r.url().startsWith('http'))report.requests.push(r.url());});
 if(mode!=='webgl2')await page.addInitScript(mode=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if((mode==='webgl1'&&type==='webgl2')||(mode==='canvas'&&/webgl/.test(type)))return null;return original.call(this,type,...args);};},mode);
 await page.goto(url,{waitUntil:'networkidle'});await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:25000});await expect(page.locator('#globe-stage')).toHaveAttribute('data-renderer',mode);await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering','active');await expect(page.locator('#globe-canvas canvas')).toBeVisible();
 if(mode==='canvas'){const painted=await page.locator('#globe-canvas canvas').evaluate(c=>{const a=c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data;return a[3]>0;});expect(painted).toBe(true);}
 const altitude=Number(await page.locator('#globe-stage').getAttribute('data-altitude'));await page.locator('#globe-zoom-in').click();await expect.poll(async()=>Number(await page.locator('#globe-stage').getAttribute('data-altitude'))).toBeLessThan(altitude-.1);
 await page.locator('#globe-query').fill('Angat reservoir');await page.locator('#globe-search-submit').click();await expect(page.locator('#globe-panel-body')).toContainText('Angat');await expect.poll(async()=>Number(await page.locator('#globe-stage').getAttribute('data-latitude'))).toBeCloseTo(14.91,1);await expect.poll(async()=>Number(await page.locator('#globe-stage').getAttribute('data-longitude'))).toBeCloseTo(121.16,1);
 await page.locator('[data-globe-layer="rain"]').click();await expect(page.locator('#globe-stage')).toHaveAttribute('data-layer','rain');
 const box=await page.locator('#globe-canvas').boundingBox();const before=Number(await page.locator('#globe-stage').getAttribute('data-longitude'));await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.45+65,box.y+box.height*.5+15,{steps:6});await page.mouse.up();await expect.poll(async()=>Math.abs(Number(await page.locator('#globe-stage').getAttribute('data-longitude'))-before)).toBeGreaterThan(.5);
 await page.locator('#globe-reset').click();await page.waitForTimeout(900);await page.screenshot({path:'.artifacts/globe-compatible-'+(offline?'offline-':'')+mode+'.png'});
 await page.locator('.site-header a[href="#news"]').click();await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering','paused');await page.locator('.site-header a[href="#globe"]').click();await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering','active');await expect(page.locator('#globe-canvas canvas')).toHaveCount(1);
 if(mode==='webgl2'){await page.locator('#globe-canvas canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await expect(page.locator('#globe-stage')).toHaveAttribute('data-renderer','canvas',{timeout:15000});await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true');await expect(page.locator('#globe-canvas canvas')).toBeVisible();const a=Number(await page.locator('#globe-stage').getAttribute('data-altitude'));await page.locator('#globe-zoom-in').click();await expect.poll(async()=>Number(await page.locator('#globe-stage').getAttribute('data-altitude'))).toBeLessThan(a-.1);}
 report.checks.push({mode,passed:true});console.log('PASS '+mode+': visible globe, zoom, flight, drag, layers and route recovery'+(mode==='webgl2'?', graphics-context recovery':''));await context.close();
 }expect(report.errors).toEqual([]);if(offline)expect(report.requests).toEqual([]);report.passed=true;
}catch(error){report.passed=false;report.failure=error.stack;throw error;}finally{await writeFile('.artifacts/globe-compatibility'+(offline?'-offline':'')+'-report.json',JSON.stringify(report,null,2));await browser.close();}
