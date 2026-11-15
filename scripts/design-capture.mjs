// Reproducible design snapshots and short, unthrottled animation measurements.
import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
const phase = process.argv[2] || 'after';
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({headless:true, executablePath:[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync)});
const out = `docs/design/${phase}`;
const report = {phase, browser:browser.version(), screenshots:[], frames:[]};
await mkdir(out,{recursive:true});
try {
  const context = await browser.newContext({reducedMotion:'reduce'});
  await context.addInitScript(() => localStorage.setItem('pacific-guide-dismissed-v1','1'));
  await context.route('https://gibs.earthdata.nasa.gov/**', r=>r.fulfill({status:503,body:'Controlled imagery outage'}));
  const page = await context.newPage();
  for (const width of [390,1280]) for (const theme of ['light','dark']) {
    await page.setViewportSize({width,height:900});
    await page.goto(base+'/#story');
    await page.evaluate(theme=>{
      localStorage.setItem('pacific-theme',theme);
      document.documentElement.dataset.theme=theme;
    },theme);
    await page.reload();
    if(await page.locator('#dismiss-guide').isVisible()) await page.locator('#dismiss-guide').click();
    for(const route of ['story','sites','globe','media','method']) {
      await page.evaluate(route=>{location.hash=route==='sites'?'sites/angat':route;},route);
      await expect(page.locator('header nav a[aria-current=page]')).toHaveAttribute('href','#'+route);
      await expect(page.locator(`#page-${route==='media'?'news':route}`)).toBeVisible();
      if(route==='globe') await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:30000});
      if(route==='story') {
        await page.getByTestId('story-preview-player').scrollIntoViewIfNeeded();
        await expect(page.getByTestId('story-preview-player').locator('img')).toHaveCount(2);
      }
      await page.waitForTimeout(450);
      await page.evaluate(()=>scrollTo(0,0));
      const file=`${route}-${theme}-${width}px.png`;
      await page.screenshot({path:out+'/'+file,fullPage:true});
      report.screenshots.push(file);
    }
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1280,height:900});
  for(const route of ['story','sites/angat','globe']) {
    await page.goto(base+'/#'+route,{waitUntil:'networkidle'});
    if(route==='globe') await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready','true',{timeout:30000});
    if(route==='sites/angat') {
      await page.locator('.site-timeline').scrollIntoViewIfNeeded();
      const play=page.locator('#site-play');
      if(await play.count()) await play.click();
    }
    const frame=await page.evaluate(()=>new Promise(resolve=>{
      const samples=[];let last=performance.now(),start=last;
      function tick(now){samples.push(now-last);last=now;if(now-start<4000)requestAnimationFrame(tick);
        else {samples.shift();samples.sort((a,b)=>a-b);const total=samples.reduce((a,b)=>a+b,0);
          resolve({fps:1000/(total/samples.length),p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),frames:samples.length,
            background:document.querySelector('#ambient-canvas')?.dataset||null});}}
      requestAnimationFrame(tick);
    }));
    report.frames.push({route,...frame});
  }
  await writeFile(`docs/design/${phase}-metrics.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
