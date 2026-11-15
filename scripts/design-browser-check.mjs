import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5175';
const browser=await chromium.launch({headless:true,executablePath:[
 'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync)});
const axe=await readFile('.artifacts/design-tools/node_modules/axe-core/axe.min.js','utf8');
const report={reflow:[],axe:[],background:[],touch:[],errors:[]};
try {
 const context=await browser.newContext();
 await context.addInitScript(()=>localStorage.setItem('pacific-first-visit-guide-dismissed-v1','1'));
 await context.route('https://gibs.earthdata.nasa.gov/**',r=>r.fulfill({status:503,body:'Controlled imagery outage'}));
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 for(const theme of ['light','dark']) {
  await page.goto(base);await page.evaluate(t=>localStorage.setItem('pacific-theme',t),theme);await page.reload();
  for(const [width,height] of [[320,900],[390,900],[768,1024],[1280,900],[1920,1080],[844,390]]) {
   await page.setViewportSize({width,height});
   for(const route of ['story','sites/angat','globe','media','method']) {
    await page.evaluate(r=>{location.hash=r;},route);
    await expect(page.locator('header nav a[aria-current=page]')).toHaveAttribute('href','#'+route.split('/')[0]);
    if(route==='globe')await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:30000});
    await page.waitForTimeout(150);
    const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+2&&getComputedStyle(el).position!=='absolute';}).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}));
    report.reflow.push({theme,route,width,height,...overflow});
    if(overflow.scroll>width+1)console.log('OVERFLOW',JSON.stringify(report.reflow.at(-1)));
    if(width===390){
     const small=await page.locator('button:not(.glossary-term-btn),select,summary,input[type=range]').evaluateAll(els=>els.filter(el=>el.checkVisibility()).map(el=>({name:(el.textContent||el.getAttribute('aria-label')||el.id).trim().slice(0,60),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})).filter(x=>x.width<43.9||x.height<43.9));
     report.touch.push({theme,route,small});
    }
    if([390,1280].includes(width)) {
     await page.addScriptTag({content:axe});
     const result=await page.evaluate(async()=>{
      const res=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
      return {violations:res.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:res.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))};
     });report.axe.push({theme,route,width,...result});
     if(result.violations.length)console.log('AXE',theme,route,width,JSON.stringify(result.violations));
    }
   }
  }
 }
 // The default Globe is illustrative; also audit both observational views.
 for(const theme of ['light','dark'])for(const width of [390,1280])for(const mode of ['satellite','concept']){
  await page.setViewportSize({width,height:900});
  await page.evaluate(t=>localStorage.setItem('pacific-theme',t),theme);
  await page.goto(base+'/#globe?mode='+mode);await page.reload();
  await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:30000});
  if(mode==='concept')await page.locator('#land-play').click();
  await page.waitForTimeout(350);
  await page.addScriptTag({content:axe});
  const result=await page.evaluate(async()=>{
   const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
   return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))};
  });report.axe.push({theme,route:'globe?mode='+mode,width,...result});
  if(result.violations.length)console.log('AXE observation',JSON.stringify(report.axe.at(-1)));
 }
 await page.setViewportSize({width:1280,height:900});await page.goto(base+'/#story');
 const canvas=page.locator('#ambient-canvas');await expect(canvas).toHaveAttribute('data-state','running');
 const before=Number(await canvas.getAttribute('data-frames'));await page.waitForTimeout(1100);
 const count=Number(await canvas.getAttribute('data-frames'))-before;assert(count>5&&count<=34,'30fps drawing cap');
 await expect(canvas).toHaveAttribute('aria-hidden','true');assert.equal(await canvas.count(),1);
 await page.locator('.background-toggle').click();await expect(canvas).toHaveAttribute('data-state','paused');
 const paused=await canvas.getAttribute('data-frames');await page.waitForTimeout(200);assert.equal(await canvas.getAttribute('data-frames'),paused);
 await page.reload();await expect(canvas).toHaveAttribute('data-state','paused');
  await page.locator('.background-toggle').click();await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await expect(canvas).toHaveAttribute('data-state','running');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(canvas).toHaveAttribute('data-state','hidden');const hidden=await canvas.getAttribute('data-frames');await page.waitForTimeout(200);assert.equal(await canvas.getAttribute('data-frames'),hidden);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await expect(canvas).toHaveAttribute('data-state','running');
 await page.locator('.site-footer').scrollIntoViewIfNeeded();await expect(canvas).toHaveAttribute('data-state','hidden');
 await page.evaluate(()=>scrollTo(0,0));await expect(canvas).toHaveAttribute('data-state','running');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(canvas).toHaveAttribute('data-state','reduced');const reduced=await canvas.getAttribute('data-frames');await page.waitForTimeout(200);assert.equal(await canvas.getAttribute('data-frames'),reduced);
 report.background.push({drawingFramesIn1100Ms:count,checks:'start, one canvas, aria-hidden, remembered pause/resume, hidden tab, offscreen, reduced motion'});
 await page.evaluate(()=>{location.hash='globe';});await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true');await expect(canvas).toHaveAttribute('data-scene','globe');
 await page.locator('#globe-stage').scrollIntoViewIfNeeded();await expect(canvas).toHaveAttribute('data-state','reduced');
 assert.equal(await canvas.count(),1);assert(await page.locator('.background-toggle').isVisible());
 assert.deepEqual(report.errors,[]);
} finally {await mkdir('docs/design',{recursive:true});await writeFile('docs/design/accessibility.json',JSON.stringify(report,null,2));await browser.close();}
assert.equal(report.reflow.filter(x=>x.scroll>x.width+1).length,0,'Reflow failures: docs/design/accessibility.json');
assert.equal(report.axe.reduce((n,x)=>n+x.violations.length,0),0,'Axe violations: docs/design/accessibility.json');
assert.equal(report.touch.reduce((n,x)=>n+x.small.length,0),0,'Small controls: docs/design/accessibility.json');
console.log(`${report.reflow.length} reflow checks, ${report.axe.length} axe scans, background lifecycle passed`);
