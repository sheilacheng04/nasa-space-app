import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.on('pageerror',e=>console.log('ERROR',e.message));
await page.route('http://localhost:5175/**',async r=>{const f=path.resolve('dist',new URL(r.request().url()).pathname.slice(1)||'index.html');try{await r.fulfill({body:await readFile(f),contentType:({'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream'});}catch{await r.fulfill({status:404});}});
await page.route('https://gibs.earthdata.nasa.gov/**',async r=>r.fulfill({contentType:'image/jpeg',body:await readFile('public/data/globe/blue-marble.jpg')}));
await page.goto('http://localhost:5175/#globe?mode=illustrative');
await page.locator('.illustrative-sites button').first().click();
await page.getByRole('button',{name:'Open satellite window',exact:true}).click();
console.log(await page.locator('#local-window').evaluate(e=>({hidden:e.hidden,rect:e.getBoundingClientRect().toJSON(),parent:e.parentElement.id,state:e.dataset.state})));
await expect(page.locator('#local-window')).toBeVisible();
await expect(page.locator('#local-window')).toHaveAttribute('data-state','ready');
await page.locator('#local-window-close').click();
await expect(page.locator('#local-window')).toBeHidden();
await page.evaluate(()=>{location.hash='story';});
await page.evaluate(()=>{location.hash='globe?mode=illustrative';});
await page.getByRole('button',{name:'Open satellite window',exact:true}).click();
await expect(page.locator('#local-window')).toBeVisible();
await page.keyboard.press('Escape');
await expect(page.locator('#local-window')).toBeHidden();
console.log('PASS open, load, close, navigate, reopen, Escape');
}finally{await browser.close();}
