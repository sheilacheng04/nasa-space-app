import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'http://127.0.0.1:5178';
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const browser = await chromium.launch({ headless: true, executablePath });

try {
  const requests = [];
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce'
  });

  await context.route(`${base}/**`, async (route) => {
    const url = new URL(route.request().url());
    let reqPath = decodeURIComponent(url.pathname);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const candidates = [
      path.join(process.cwd(), 'dist', reqPath),
      path.join(process.cwd(), 'public', reqPath)
    ];
    for (const file of candidates) {
      if (existsSync(file)) {
        const body = await readFile(file);
        const ext = path.extname(file).toLowerCase();
        requests.push(reqPath);
        await route.fulfill({
          status: 200,
          contentType: MIME_TYPES[ext] || 'application/octet-stream',
          body
        });
        return;
      }
    }
    await route.fulfill({ status: 404, body: 'Not found: ' + reqPath });
  });

  const page = await context.newPage();

  // 1. Initial #story load: verify guide is NOT auto-opened and non-active page chunks/data are deferred
  await page.goto(`${base}/#story`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('first-visit-guide')).toHaveCount(0);
  assert.ok(!requests.some((r) => r.includes('SitesPage-')), 'SitesPage chunk must not load on #story');
  assert.ok(!requests.some((r) => r.includes('GlobeExperience-')), 'GlobeExperience chunk must not load on #story');
  assert.ok(!requests.some((r) => r.includes('NewsPage-')), 'NewsPage chunk must not load on #story');
  assert.ok(!requests.some((r) => r.includes('MethodPage-')), 'MethodPage chunk must not load on #story');
  assert.ok(!requests.includes('/data/places.json'), 'places.json must be deferred on #story');
  assert.ok(!requests.includes('/data/news-by-place.json'), 'news-by-place.json must be deferred on #story');
  console.log('PASS 1: Initial #story load defers inactive page chunks and optional datasets');

  // 2. Clicking "?" opens help popup modal, locks body scroll, and displays expected content
  const openBtn = page.locator('#open-guide');
  await expect(openBtn).toHaveAttribute('aria-expanded', 'false');
  await openBtn.click();
  const dialog = page.locator('#help-guide-dialog');
  await expect(dialog).toBeVisible();
  await expect(openBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog).toContainText('How to explore The Two-Faced Pacific');
  await expect(dialog).toContainText('1. Follow the Pacific shift (Story)');
  await expect(dialog).toContainText('2. Inspect dated radar frames (Sites)');
  await expect(dialog).toContainText('3. Compare the Globe & local news (Globe & Media)');
  await expect(dialog).toContainText('How to read the controls & scientific views');
  const overflowOpen = await page.evaluate(() => document.body.style.overflow);
  assert.equal(overflowOpen, 'hidden', 'Body scroll must be locked when help popup is open');
  console.log('PASS 2: Clicking "?" opens help popup with expected content and locks background scroll');

  // 3. Clicking inside the popup panel does NOT close it
  await page.getByTestId('help-guide-panel').locator('#help-guide-title').click();
  await expect(dialog).toBeVisible();
  console.log('PASS 3: Clicking inside help popup does not close it');

  // 4. Clicking close button (#dismiss-guide) closes popup, unlocks scroll, and restores focus to #open-guide
  await page.locator('#dismiss-guide').click();
  await expect(dialog).toHaveCount(0);
  const overflowClosed = await page.evaluate(() => document.body.style.overflow);
  assert.equal(overflowClosed, '', 'Body scroll must be restored when help popup closes');
  await expect(openBtn).toBeFocused();
  console.log('PASS 4: Clicking close button dismisses popup and restores focus to #open-guide');

  // 5. Pressing Escape closes popup and restores focus to #open-guide
  await openBtn.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openBtn).toBeFocused();
  console.log('PASS 5: Pressing Escape dismisses popup and restores focus to #open-guide');

  // 6. Clicking outside the popup (on dialog backdrop) closes it
  await openBtn.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(12, 12);
  await expect(dialog).toHaveCount(0);
  await expect(openBtn).toBeFocused();
  console.log('PASS 6: Clicking outside on backdrop dismisses popup and restores focus');

  // 7. Opening and closing popup on Sites preserves route, selected site, channel, and dates
  await page.goto(`${base}/#sites/dadu?source=browse&channel=HV`, { waitUntil: 'networkidle' });
  await expect(page.locator('#site-select')).toHaveValue('dadu');
  await openBtn.click();
  await expect(dialog).toBeVisible();
  await page.locator('#help-guide-close-icon').click();
  await expect(dialog).toHaveCount(0);
  assert.ok(page.url().includes('#sites/dadu?source=browse&channel=HV'), 'Route and query parameters must be preserved');
  await expect(page.locator('#site-select')).toHaveValue('dadu');
  console.log('PASS 7: Opening and closing help popup preserves current page, site, and filter state');

  // 8. Responsive check across Desktop (1280px), Tablet (768px), and Mobile (390px & 320px) in Light and Dark themes
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await openBtn.click();
      await expect(dialog).toBeVisible();
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(hasOverflow, false, `No horizontal overflow with help modal open at ${width}px (${theme})`);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  }
  console.log('PASS 8: Help popup works cleanly across desktop, tablet, and mobile (1280px, 768px, 390px, 320px) in light & dark themes');

  // 9. Verify zero duplicate JSON requests across navigation
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/#media`, { waitUntil: 'networkidle' });
  await page.goto(`${base}/#method`, { waitUntil: 'networkidle' });
  await page.goto(`${base}/#sites/angat`, { waitUntil: 'networkidle' });
  const jsonReqs = requests.filter((r) => r.endsWith('.json'));
  const counts = {};
  for (const r of jsonReqs) counts[r] = (counts[r] || 0) + 1;
  const duplicates = Object.entries(counts).filter(([, c]) => c > 1);
  assert.deepEqual(duplicates, [], `Expected 0 duplicate JSON requests, found: ${JSON.stringify(duplicates)}`);
  console.log('PASS 9: Zero duplicate JSON requests across multi-page navigation');

  await context.close();
} finally {
  await browser.close();
}
