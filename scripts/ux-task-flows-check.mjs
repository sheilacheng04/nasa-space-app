import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5175';
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

async function attachLocalDistServer(context) {
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
}

const report = {
  generatedAt: new Date().toISOString(),
  flows: [],
  featureChecks: [],
  afterScreenshots: []
};

const browser = await chromium.launch({ headless: true, executablePath });

try {
  await mkdir('docs/ux/after', { recursive: true });
  await mkdir('.artifacts', { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce'
  });
  await attachLocalDistServer(context);
  const page = await context.newPage();

  // First-visit guide popup check (Task F8 / Help Guide Redesign)
  await page.goto(`${base}/#story`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('first-visit-guide')).toHaveCount(0);
  await page.locator('#open-guide').click();
  await expect(page.getByTestId('first-visit-guide')).toBeVisible();
  await page.locator('#dismiss-guide').click();
  await expect(page.getByTestId('first-visit-guide')).toHaveCount(0);
  report.featureChecks.push('Modal 3-step help guide popup (#open-guide / #dismiss-guide) works');
  console.log('PASS Help guide popup and ? button');

  // Flow 1: Understand what El Niño is and how the Pacific shifts (<= 5 clicks)
  {
    let clicks = 0;
    await page.goto(`${base}/#story`, { waitUntil: 'networkidle' });
    await expect(page.locator('#page-story h1')).toContainText('what changes on land');
    await page.locator('.story-chapter-bar a[href="#story/ocean"]').click();
    clicks++;
    await expect(page.locator('#ocean')).toBeVisible();
    await page.locator('#ocean .glossary-term-btn').first().click();
    clicks++;
    await expect(page.locator('#ocean .glossary-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    assert.ok(clicks <= 5, `Flow 1 exceeded 5 clicks: ${clicks}`);
    report.flows.push({
      id: 1,
      name: 'Understand what El Niño is and how the Pacific shifts',
      clicks,
      maxClicks: 5,
      status: 'PASS'
    });
    console.log(`PASS Flow 1 (${clicks} clicks <= 5)`);
  }

  // Flow 2: Compare a dry-side and a wet-side place (<= 5 clicks)
  {
    let clicks = 0;
    await page.goto(`${base}/#story`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /^(2.*)?Sites$/ }).click();
    clicks++;
    await expect(page.locator('#site-select')).toHaveValue('angat');
    await expect(page.locator('#page-sites')).toContainText('Angat');
    await page.locator('#site-select').selectOption('piura');
    clicks++;
    await expect(page.locator('#page-sites')).toContainText('Piura');
    assert.ok(clicks <= 5, `Flow 2 exceeded 5 clicks: ${clicks}`);
    report.flows.push({
      id: 2,
      name: 'Compare a dry-side (Angat, Philippines) and a wet-side (Piura, Peru) place',
      clicks,
      maxClicks: 5,
      status: 'PASS'
    });
    console.log(`PASS Flow 2 (${clicks} clicks <= 5)`);
  }

  // Flow 3: Play the Angat radar timeline, pause on a date, and read the maturity and coverage (<= 5 clicks)
  {
    let clicks = 0;
    await page.goto(`${base}/#sites/angat`, { waitUntil: 'networkidle' });
    await expect(page.locator('.site-timeline')).toBeVisible();
    await page.locator('#site-play').click();
    clicks++;
    await page.waitForTimeout(350);
    await page.locator('#site-play').click();
    clicks++;
    await expect(page.locator('.site-timeline .frame-counter-badge')).toContainText(/Frame \d+ of \d+/);
    await expect(page.locator('.site-timeline .maturity-badge')).toBeVisible();
    assert.ok(clicks <= 5, `Flow 3 exceeded 5 clicks: ${clicks}`);
    report.flows.push({
      id: 3,
      name: 'Play the Angat radar timeline, pause on a date, and read the maturity and coverage',
      clicks,
      maxClicks: 5,
      status: 'PASS'
    });
    console.log(`PASS Flow 3 (${clicks} clicks <= 5)`);
  }

  // Flow 4: Focus on the Philippines, pick Central Luzon, and see its radar and local news (<= 5 clicks)
  {
    let clicks = 0;
    await page.goto(`${base}/#story`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /^(2.*)?Sites$/ }).click();
    clicks++;
    await page.locator('#site-select').selectOption('luzon');
    clicks++;
    await expect(page.locator('#site-select')).toHaveValue('luzon');
    await expect(page.locator('.site-timeline')).toBeVisible();
    await expect(page.locator('#page-sites').getByTestId('place-news-panel')).toContainText('News about Central Luzon');
    assert.ok(clicks <= 5, `Flow 4 exceeded 5 clicks: ${clicks}`);
    report.flows.push({
      id: 4,
      name: 'Focus on the Philippines, pick Central Luzon, and see its radar and local news',
      clicks,
      maxClicks: 5,
      status: 'PASS'
    });
    console.log(`PASS Flow 4 (${clicks} clicks <= 5)`);
  }

  // Flow 5: Check what the site can and cannot conclude from the radar (<= 5 clicks)
  {
    let clicks = 0;
    await page.goto(`${base}/#story`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /^(5.*)?Data and method$/ }).click();
    clicks++;
    await expect(page.locator('#page-method')).toBeVisible();
    await page.locator('.method-links a[href="#method/limits"]').click();
    clicks++;
    await expect(page.locator('#limits')).toContainText('What satellite previews can and cannot prove');
    assert.ok(clicks <= 5, `Flow 5 exceeded 5 clicks: ${clicks}`);
    report.flows.push({
      id: 5,
      name: 'Check what the site can and cannot conclude from the radar',
      clicks,
      maxClicks: 5,
      status: 'PASS'
    });
    console.log(`PASS Flow 5 (${clicks} clicks <= 5)`);
  }

  // Flow 6: Use it on a 390 px phone and with keyboard only (<= 5 key presses)
  {
    let actions = 0;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/#sites/angat`, { waitUntil: 'networkidle' });
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    actions++;
    await expect(page.locator('#main')).toBeFocused();
    await page.keyboard.press('Control+k');
    actions++;
    await expect(page.locator('#search-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    actions++;
    await expect(page.locator('#search-dialog')).not.toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, 'No horizontal overflow at 390px phone width');
    assert.ok(actions <= 5, `Flow 6 exceeded 5 keyboard actions: ${actions}`);
    report.flows.push({
      id: 6,
      name: 'Use it on a 390 px phone and with keyboard only',
      clicks: actions,
      maxClicks: 5,
      status: 'PASS'
    });
    console.log(`PASS Flow 6 (${actions} keyboard actions <= 5)`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  // Additional verification of Tasks B, C, D, E, F
  // Check non-radar place on Sites ("Radar frames not saved for this place" + ASF Vertex link)
  await page.goto(`${base}/#sites`, { waitUntil: 'networkidle' });
  await page.locator('#global-place-select').selectOption('cagayan-valley');
  await expect(page.getByTestId('no-saved-radar-banner')).toContainText('Radar frames not saved for this place');
  await expect(page.getByTestId('no-saved-radar-banner').locator('a[href*="search.asf.alaska.edu"]')).toBeVisible();
  report.featureChecks.push('Task C2: Non-radar global places display "Radar frames not saved for this place" with ASF Vertex link');
  console.log('PASS Task C2 non-radar place banner');

  // Check place with 0 headlines shows "No saved headlines for this place yet" + disabled "Search live"
  const placesJson = JSON.parse(await readFile('public/data/places.json', 'utf8'));
  const nbpJson = JSON.parse(await readFile('public/data/news-by-place.json', 'utf8'));
  const zeroHeadlinePlace = placesJson.find((p) => !nbpJson.items.some((i) => i.placeId === p.id)) || placesJson.at(-1);
  await page.locator('#global-place-select').selectOption(zeroHeadlinePlace.id);
  await expect(page.locator('#page-sites').getByTestId('place-news-panel')).toContainText('No saved headlines for this place yet');
  await expect(page.locator('#page-sites').getByTestId('place-news-panel').getByRole('button', { name: /Search live/i })).toBeDisabled();
  report.featureChecks.push('Task E: Place without headlines shows "No saved headlines for this place yet" and disabled "Search live" button');
  console.log('PASS Task E empty headlines state + disabled Search live button');

  // Check Globe status strip, Philippines preset, and local GIBS map handoff
  await page.goto(`${base}/#globe`, { waitUntil: 'networkidle' });
  await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready', 'true', { timeout: 25000 });
  await expect(page.getByTestId('globe-status-strip')).toBeVisible();
  await page.locator('#globe-philippines-preset').click();
  await expect(page.locator('.ph-globe-preset-strip')).toBeVisible();
  await page.locator('#open-globe-local-map').click();
  await expect(page.locator('#globe-local-map-overlay')).toBeVisible();
  await page.locator('#back-to-globe-btn').click();
  await expect(page.locator('#globe-local-map-overlay')).toHaveCount(0);
  report.featureChecks.push('Task C3/D/F3: Globe status strip, Philippines preset, and Local GIBS Map handoff with Back to globe button work');
  console.log('PASS Task C3/D/F3 Globe features');

  // Check Media & Regional Overview Dashboard
  await page.goto(`${base}/#media`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('media-dashboard')).toBeVisible();
  await expect(page.locator('#page-news').getByTestId('place-news-panel')).toBeVisible();
  report.featureChecks.push('Task E/Media: Media & Regional Overview Dashboard and local place news filter render');
  console.log('PASS Media dashboard');

  // Capture 20 after-screenshots in docs/ux/after/
  const routes = [
    { name: 'story', hash: '#story' },
    { name: 'sites', hash: '#sites/angat' },
    { name: 'globe', hash: '#globe' },
    { name: 'media', hash: '#media' },
    { name: 'method', hash: '#method' }
  ];
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        localStorage.setItem('pacific-theme', t);
      }, theme);
      for (const r of routes) {
        await page.goto(`${base}/${r.hash}`, { waitUntil: 'networkidle' });
        if (r.name === 'globe') {
          await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready', 'true', { timeout: 25000 });
        }
        const filename = `${r.name}-${theme}-${width}px.png`;
        await page.screenshot({ path: path.join('docs/ux/after', filename), fullPage: false });
        report.afterScreenshots.push(filename);
      }
    }
  }
  console.log(`PASS Captured ${report.afterScreenshots.length} after-screenshots in docs/ux/after/`);

  await context.close();
} finally {
  await browser.close();
  await writeFile('.artifacts/ux-task-flows-report.json', JSON.stringify(report, null, 2));
}
