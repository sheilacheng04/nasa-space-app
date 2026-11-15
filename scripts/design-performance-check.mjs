import {chromium,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:[
 'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync)});
const report={profile:'1280 × 900, unthrottled headless Chrome; 8-second real-image autoplay; backgrounds enabled'};
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
 await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:5175')+'/#sites/angat');
 const player=page.locator('.site-timeline');await expect(player).toHaveAttribute('data-frame-status','ready');
 await player.scrollIntoViewIfNeeded();await expect(player).toHaveAttribute('data-playing','true');
 report.measurement=await page.evaluate(()=>new Promise(resolve=>{
  const samples=[],states=[];let last=performance.now(),start=last,date='';
  function tick(now){const el=document.querySelector('.site-timeline');samples.push(now-last);last=now;
   if(el.dataset.frameDate!==date){date=el.dataset.frameDate;states.push({date,status:el.dataset.frameStatus,ms:Math.max(0,Math.round(now-start))});}
   if(now-start<8000)requestAnimationFrame(tick);else{samples.shift();samples.sort((a,b)=>a-b);
    resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),states,playing:el.dataset.playing});}
  }requestAnimationFrame(tick);
 }));
 if(report.measurement.states.length<3||report.measurement.playing!=='true')throw new Error('Autoplay did not advance through real dates');
 if(report.measurement.p95Ms>50)throw new Error('Autoplay frame timing exceeded 50ms at p95');
 // Compare reported controller work with the raw source gzip budget separately.
 report.controller=await page.locator('#ambient-canvas').evaluate(el=>({...el.dataset}));
 console.log(JSON.stringify(report,null,2));
}finally{await writeFile('docs/design/autoplay-performance.json',JSON.stringify(report,null,2));await browser.close();}
