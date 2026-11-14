import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const resources=[],pending=[];
 page.on('response',r=>pending.push((async()=>{try{resources.push({url:r.url(),status:r.status(),bytes:(await r.body()).length});}catch{}})()));
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});await Promise.all(pending);
 const total=resources.reduce((n,r)=>n+r.bytes,0);
 const heavy=resources.filter(r=>/globe.gl.min|local-map|maplibre-gl-worker/.test(r.url));
 if(total>=3000000||heavy.length)throw new Error('Initial-load budget or lazy loading failed');
 await writeFile('.artifacts/initial-load.json',JSON.stringify({totalBytes:total,heavyInitialRequests:heavy,resources},null,2));
 console.log('Hosted initial load: '+total+' uncompressed response bytes. Globe and map deferred.');
}finally{await browser.close();}
