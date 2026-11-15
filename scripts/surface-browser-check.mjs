import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const base=process.env.SURFACE_TEST_URL||'http://127.0.0.1:5174';
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#globe?mode=surface&site=angat&month=2026-10&date=2026-10-09&surface=change');
 const map=page.locator('.surface-map'),panel=page.locator('.surface-panel');
 await expect(map).toHaveAttribute('data-date','2026-10-09');await expect(page.locator('#globe-stage')).toBeHidden();await expect(page.locator('#satellite-mode')).toHaveCount(0);
 await expect.poll(()=>page.locator('.nisar-map-tile').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth>0).length),{timeout:45000}).toBeGreaterThan(0);
 await page.getByLabel('Zoom in map',{exact:true}).click();await expect(map).toHaveAttribute('data-zoom','12');
 await expect.poll(()=>page.locator('.nisar-map-tile').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth>0).length),{timeout:45000}).toBeGreaterThan(0);
 await page.getByLabel('Radar opacity',{exact:true}).fill('0.5');assert.equal(await page.locator('.nisar-map-tile').first().evaluate(e=>e.style.opacity),'0.5');
 await panel.getByRole('button',{name:'Trees & crops'}).click();await expect(panel.locator('.surface-preview img')).toHaveCount(2);
 await panel.getByRole('button',{name:'Jul 26',exact:true}).click();await expect(map).toHaveAttribute('data-date','');await expect(page.locator('.nisar-map-tile')).toHaveCount(0);
 await panel.getByRole('button',{name:'Oct 26',exact:true}).click();await expect(map).toHaveAttribute('data-date','2026-10-09');
 await panel.getByRole('button',{name:/Cagayan Valley/}).click();await expect(map.locator('.surface-map-heading')).toContainText('Cagayan');
 await page.locator('#illustrative-mode').click();await expect(map).toHaveCount(0);await expect(page.locator('#globe-stage')).toBeVisible();
 await page.locator('#surface-mode').click();await expect(map).toBeVisible();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(base+'/#globe?mode=satellite');await expect(map).toBeVisible();
 await page.goto(pathToFileURL(resolve('el-nino-app.html')).href+'#globe?mode=surface&month=2026-10&site=angat');
 await expect(map).toBeVisible();await expect(page.getByRole('button',{name:'Load online NISAR map'})).toBeVisible();await expect(page.locator('.nisar-map-tile')).toHaveCount(0);
 await expect(panel.locator('.surface-preview img')).toHaveCount(2);
 assert.deepEqual(errors,[]);console.log('PASS real NASA tiles, zoom, opacity, dates, missing imagery, site selection, mode switching, mobile, legacy redirect and offline comparisons');
}finally{await browser.close();}
