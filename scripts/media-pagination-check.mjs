import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({
  headless: true,
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
});
const archive = JSON.parse(await readFile('public/data/news.json', 'utf8'));
const checks = [];
const pass = (message) => { checks.push(message); console.log('PASS ' + message); };
const contexts = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  contexts.push(context);
  await context.addInitScript(() => localStorage.setItem('pacific-first-visit-guide-dismissed-v1', '1'));
  const page = await context.newPage();
  const archiveRequests = [];
  page.on('request', (request) => {
    if (/\/data\/news\.json(?:\?|$)/.test(new URL(request.url()).pathname + new URL(request.url()).search)) archiveRequests.push(request.url());
  });
  await page.goto(`${base}/#media`, { waitUntil: 'networkidle' });
  const list = page.locator('#news-list');
  const firstPage = list.locator('.news-item');
  const expectedTotal = archive.items.length;
  const expectedPages = Math.ceil(expectedTotal / 10);
  await expect(firstPage).toHaveCount(10);
  await expect(page.locator('#news-pagination-status')).toContainText(`Showing 1–10 of ${expectedTotal} matching headlines`);
  await expect(page.locator('#news-pagination-status')).toContainText(`Page 1 of ${expectedPages}`);
  await expect(page.getByRole('navigation', { name: 'Headline pages' }).getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await expect(firstPage.first().getByRole('link')).toHaveAttribute('href', archive.items.slice().sort((a, b) => b.date.localeCompare(a.date))[0].url);
  await expect(firstPage.first().locator('.news-meta')).not.toBeEmpty();
  await expect(firstPage.first().locator('[data-ai-item]')).toHaveAccessibleName('Explain headline tone');
  assert.equal(archiveRequests.length, 1, `Expected one archive request, got ${archiveRequests.length}`);
  pass(`Initial page shows 10 of ${expectedTotal} matching headline records with source links, dates, and tone actions`);

  const pagination = page.getByRole('navigation', { name: 'Headline pages' });
  await pagination.getByRole('button', { name: 'Next page' }).click();
  await expect(firstPage).toHaveCount(10);
  await expect(pagination.getByRole('button', { name: 'Go to page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#news-pagination-status')).toContainText('Showing 11–20');
  assert.equal(archiveRequests.length, 1, 'Changing pages must not refetch the news archive');
  await pagination.getByRole('button', { name: 'Go to page 1', exact: true }).click();
  await pagination.getByRole('button', { name: 'Go to page 3', exact: true }).click();
  await expect(pagination.getByRole('button', { name: 'Go to page 3', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#news-pagination-status')).toContainText('Showing 21–30');
  await pagination.getByRole('button', { name: `Go to page ${expectedPages}`, exact: true }).click();
  await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await expect(page.locator('#news-pagination-status')).toContainText(`Page ${expectedPages} of ${expectedPages}`);
  await expect(firstPage).toHaveCount(expectedTotal % 10 || 10);
  await pagination.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.locator('#news-pagination-status')).toContainText(`Page ${expectedPages - 1} of ${expectedPages}`);
  pass('Next, Previous, numbered navigation, final partial page, and first/last boundaries work');

  await pagination.getByRole('button', { name: 'Go to page 1', exact: true }).click();
  await pagination.getByRole('button', { name: 'Go to page 3', exact: true }).click();
  await page.locator('#news-search').fill('zzzz-pagination-no-match');
  await expect(list).toContainText('No headlines match these filters.');
  await expect(page.locator('#news-pagination-status')).toHaveText('No matching headlines.');
  await expect(page.getByRole('navigation', { name: 'Headline pages' })).toHaveCount(0);
  await page.locator('#news-search').fill('');
  await expect(page.locator('#news-pagination-status')).toContainText('Page 1 of');

  await pagination.getByRole('button', { name: 'Go to page 3', exact: true }).click();
  await page.locator('#news-sort').selectOption('oldest');
  await expect(page.locator('#news-pagination-status')).toContainText('Page 1 of');
  await pagination.getByRole('button', { name: 'Go to page 3', exact: true }).click();
  await page.locator('#news-region').selectOption('United States');
  await expect(page.locator('#news-pagination-status')).toContainText('Page 1 of');
  await expect(list.locator('.news-item').first().locator('.tagline')).toContainText('United States');
  assert.equal(archiveRequests.length, 1, 'Search, sort, and region changes must reuse the loaded archive');
  pass('Search, region, and sort are applied before pagination and reset to page 1; empty search results are explained');

  await page.locator('#news-search').fill('');
  await page.locator('#news-region').selectOption('');
  await page.locator('#news-sort').selectOption('newest');
  await expect(page.locator('#news-pagination-status')).toContainText('Page 1 of');
  const next = pagination.getByRole('button', { name: 'Next page' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(pagination.getByRole('button', { name: 'Go to page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(pagination.getByRole('button', { name: 'Go to page 2', exact: true })).toBeFocused();
  pass('Pagination is keyboard-operable and focus moves to the announced current page');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pagination.getByRole('button', { name: 'Go to page 2', exact: true })).toBeVisible();
  await expect(pagination.getByRole('button', { name: 'Go to page 1', exact: true })).toBeHidden();
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    targets: [...document.querySelectorAll('.news-pagination button')].filter((button) => button.checkVisibility()).map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  }));
  assert.equal(mobile.overflow, false, 'Pagination should not introduce horizontal overflow at 390px');
  assert.ok(mobile.targets.every(({ width, height }) => width >= 44 && height >= 44), 'Visible mobile page controls should be at least 44px');
  pass('Narrow layout shows a compact current-page control without overflow and with 44px touch targets');
  assert.equal(archiveRequests.length, 1);
  await context.close();

  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  contexts.push(offlineContext);
  const offlinePage = await offlineContext.newPage();
  const externalRequests = [];
  offlinePage.on('request', (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });
  await offlinePage.goto(pathToFileURL(path.resolve('el-nino-app.html')).href + '#media', { waitUntil: 'domcontentloaded' });
  await expect(offlinePage.locator('#news-search')).toBeVisible();
  await expect(offlinePage.locator('#news-list .news-item')).toHaveCount(10);
  await offlinePage.getByRole('navigation', { name: 'Headline pages' }).getByRole('button', { name: 'Next page' }).click();
  await expect(offlinePage.locator('#news-pagination-status')).toContainText('Page 2 of');
  assert.deepEqual(externalRequests, [], 'Offline pagination must not make external requests');
  pass('Offline Media pagination renders and changes page with zero external HTTP requests');
  console.log(`Completed ${checks.length} Media pagination browser checks.`);
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
}
