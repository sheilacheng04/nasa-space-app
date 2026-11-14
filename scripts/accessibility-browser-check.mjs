import {chromium,expect} from '@playwright/test';
import {existsSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)});
mkdirSync('.artifacts',{recursive:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5175';
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await page.goto(base+'/#sites/angat');
 await expect(page.locator('#site-date-slider')).toBeVisible();
 await page.locator('#open-search').click();
 await expect(page.getByRole('dialog',{name:'Search the Pacific'})).toBeVisible();
 await expect(page.locator('#global-search')).toBeFocused();
 await page.locator('#global-search').fill('Angat');await page.keyboard.press('ArrowDown');await expect(page.locator('.search-result').first()).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#open-search')).toBeFocused();console.log('PASS named search dialog, result keyboard navigation, Escape and return focus');
 const list=page.getByRole('combobox',{name:'All sampled radar dates'});
 const options=await list.locator('option').allTextContents();assert(options.length>10);assert(options.some(s=>s.includes('no saved image')));
 await list.selectOption('0');await expect(page.locator('#site-date-slider')).toHaveValue('0');
 await list.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 const index=await list.inputValue();await expect(page.locator('#site-date-slider')).toHaveValue(index);
 assert((await page.locator('.site-time-dates button').first().boundingBox()).height>=44);
 await page.locator('.site-time-dates button').last().focus();await page.keyboard.press('Enter');await expect(list).toHaveValue(String(options.length-1));
 console.log('PASS all sampled dates retained, unavailable labels, native date list and keyboard button selection');
 for(const width of [1280,640,320]){await page.setViewportSize({width,height:900});await expect(list).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Site document overflow at '+width);assert(await page.locator('.site-time-dates').evaluate(el=>el.scrollWidth>el.clientWidth),'Dates remain scrollable');}
 await page.locator('#open-search').click();await expect(page.getByRole('dialog',{name:'Search the Pacific'})).toBeVisible();assert(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth),'Search fits narrow viewport');await page.keyboard.press('Escape');
 await page.screenshot({path:'.artifacts/accessibility-sites-320.png'});
 console.log('PASS site and search reflow at desktop, 200% and 400% equivalent CSS viewport widths');
 await page.setViewportSize({width:1280,height:900});
 await page.getByText('See the weather values and the long-term average',{exact:true}).click();
 const table=page.locator('table').first();await expect(table.locator('caption')).not.toBeEmpty();assert(await table.locator('th[scope=col]').count()>0);assert(await table.locator('th[scope=row]').count()>0);
 await page.goto(base+'/#method');await expect(page.locator('#evidence table caption').first()).toBeVisible();assert(await page.locator('#evidence th[scope=col]').count()>0);
 console.log('PASS weather and scientific table captions and header associations');
 await page.goto(base+'/#globe?mode=concept&site=angat&month=2026-10');
 const month=page.locator('.concept-year-rows button').filter({hasText:'Oct'}).last();await expect(month).toHaveAttribute('aria-label',/October 2026/);await expect(month).toHaveAttribute('aria-pressed','true');
 await month.focus();await page.keyboard.press('Enter');await expect(month).toHaveAttribute('aria-pressed','true');
 for(const width of [640,320]){await page.setViewportSize({width,height:900});assert((await month.boundingBox()).height>=44);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Globe document overflow at '+width);}
 await page.locator('.concept-rain-history summary').click();await expect(page.locator('.concept-rain-history caption')).toContainText('1991');assert(await page.locator('.concept-rain-history th[scope=row]').count()>10);
 await page.screenshot({path:'.artifacts/accessibility-concept-320.png'});
 await page.locator('#concept-play').click();await expect(page.locator('.concept-vegetation > p')).toHaveAttribute('aria-live','off');await page.locator('#concept-play').click();await expect(page.locator('.concept-vegetation > p')).toHaveAttribute('aria-live','polite');
 console.log('PASS fully named month controls, selected state, touch sizes, rainfall data alternative and muted playback announcements');
 await page.goto(base+'/#media');await expect(page.locator('.ai-result').first()).toHaveAttribute('role','status');await expect(page.locator('.ai-result').first()).toHaveAttribute('aria-atomic','true');await page.locator('[data-ai-item]').first().click();await expect(page.locator('.ai-result').first()).toContainText('Simulated Claude-style sample');console.log('PASS headline analysis polite atomic result regions update after user action');
}finally{await browser.close();}
