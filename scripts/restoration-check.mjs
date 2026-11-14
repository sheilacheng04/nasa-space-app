import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against the local server or a production preview with TEST_URL.
// Example: $env:TEST_URL='http://127.0.0.1:5174'; node scripts/restoration-check.mjs
const base = (process.env.TEST_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const report = { base, checks: [], errors: [], consoleErrors: [], requestFailures: [], measurements: {} };
await mkdir('.artifacts', { recursive: true });
let expectedWeatherFailure = false;
context.on('page', attachErrors);
attachErrors(page);
function attachErrors(p) {
  p.on('pageerror', e => { report.errors.push({ page: p.url(), message: e.message }); console.error('PAGEERROR ' + e.stack); });
  p.on('console', m => {
    if (m.type() === 'error') { report.consoleErrors.push({ message: m.text(), url: m.location().url, expectedWeatherFailure }); console.error('BROWSER ' + m.text()); }
  });
  p.on('requestfailed', r => report.requestFailures.push({ url: r.url(), error: r.failure()?.errorText }));
}
async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    report.checks.push({ name, passed: true, milliseconds: Date.now() - started });
    console.log('PASS ' + name);
  } catch (error) {
    report.checks.push({ name, passed: false, milliseconds: Date.now() - started, error: error.stack || String(error) });
    console.error('FAIL ' + name + ': ' + error.message);
    try { await page.screenshot({ path: '.artifacts/restoration-failure-' + report.checks.length + '.png', fullPage: false }); } catch {}
  }
  await writeFile('.artifacts/restoration-report.json', JSON.stringify(report, null, 2));
}
async function route(name) {
  await page.evaluate(hash => { location.hash = hash; }, name);
  await expect(page.locator('#page-' + name.split('/')[0])).toBeVisible();
}
async function globe() {
  await route('globe');
  await expect(page.locator('#globe-canvas canvas')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering', 'active', { timeout: 30000 });
}
const attrNumber = (selector, name) => page.locator(selector).getAttribute(name).then(Number);
async function noOverflow(p = page) {
  const dimensions = await p.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
}
async function screenshot(file) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: '.artifacts/' + file + '.png', fullPage: false });
}

try {
  await page.goto(base + '/#story', { waitUntil: 'networkidle' });
  await check('Restored story renders; initial load remains below 3 MB', async () => {
    await expect(page.locator('#story-sites .site-entry')).toHaveCount(3);
    await expect(page.locator('#animated-ocean')).toBeAttached();
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').reduce((sum, item) => sum + (item.encodedBodySize || 0), 0));
    report.measurements.initialEncodedBytes = resources;
    // Vite development serves uncompressed modules; enforce the deployment budget only for a build.
    const isDevelopment = await page.locator('script[src*="/@vite/client"]').count();
    report.measurements.developmentServer = Boolean(isDevelopment);
    if (!isDevelopment) expect(resources).toBeLessThan(3_000_000);
    await screenshot('restored-story-desktop');
  });

  await check('Ocean stages, slider, playback and pause change the visible explanation', async () => {
    await route('story');
    await page.locator('#ocean-diagram').scrollIntoViewIfNeeded();
    await page.locator('[data-ocean-stage="0"]').click();
    await expect.poll(() => attrNumber('#animated-ocean', 'data-phase')).toBeLessThan(2);
    const initialCloud = await page.locator('#rain-cloud').getAttribute('transform');
    const initialPool = await page.locator('#warm-pool').getAttribute('d');
    await page.locator('[data-ocean-stage="100"]').click();
    await expect.poll(() => attrNumber('#animated-ocean', 'data-phase')).toBeGreaterThan(98);
    expect(await page.locator('#rain-cloud').getAttribute('transform')).not.toBe(initialCloud);
    expect(await page.locator('#warm-pool').getAttribute('d')).not.toBe(initialPool);
    await expect(page.locator('#phase-label')).toContainText('Strong');
    await expect(page.locator('#ocean-caption')).toContainText('not a forecast');
    await page.locator('#ocean-phase').fill('30');
    await expect(page.locator('#animated-ocean')).toHaveAttribute('data-phase', '30');
    await expect(page.locator('#phase-label')).toHaveText('Winds weaken');
    await page.locator('#ocean-phase').fill('0');
    await page.locator('#ocean-play').click();
    await expect(page.locator('#ocean-play')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => attrNumber('#animated-ocean', 'data-phase')).toBeGreaterThan(2);
    await page.locator('#ocean-play').click();
    const paused = await attrNumber('#animated-ocean', 'data-phase');
    await page.waitForTimeout(250);
    expect(await attrNumber('#animated-ocean', 'data-phase')).toBe(paused);
    await expect(page.locator('#ocean-play')).toHaveAttribute('aria-pressed', 'false');
  });

  await check('Ocean animation suspends offscreen and on another route; pattern map responds', async () => {
    await route('story');
    await page.locator('#ocean-diagram').scrollIntoViewIfNeeded();
    await expect(page.locator('#ocean-diagram')).toHaveAttribute('data-running', 'true');
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('#ocean-diagram')).toHaveAttribute('data-running', 'false');
    const wind = await page.locator('.wind-particle').first().getAttribute('transform');
    await page.waitForTimeout(200);
    expect(await page.locator('.wind-particle').first().getAttribute('transform')).toBe(wind);
    await page.locator('#teleconnection-map').scrollIntoViewIfNeeded();
    const dry = page.locator('.pattern-country[data-tendency="dry"]').first();
    await page.locator('[data-pattern="normal"]').click();
    const normal = await dry.evaluate(node => getComputedStyle(node).fill);
    await page.locator('[data-pattern="elnino"]').click();
    await expect.poll(() => dry.evaluate(node => getComputedStyle(node).fill)).not.toBe(normal);
    await expect(page.locator('#teleconnection-map')).toHaveClass(/is-elnino/);
    await expect(page.locator('#pattern-note')).toContainText('western tropical Pacific');
    await route('news');
    await expect(page.locator('#ocean-diagram')).toHaveAttribute('data-running', 'false');
  });

  await check('News filtering and local analysis still work', async () => {
    await route('news');
    await expect(page.locator('.news-item').first()).toBeVisible();
    await page.locator('#news-search').fill('zzzz-no-such-headline');
    await expect(page.locator('#news-list')).toContainText('No headlines');
    await page.locator('#news-search').fill('');
    await page.locator('#analysis-text').fill('Drought damage threatens rice fields');
    await page.locator('#analyze-local').click();
    await expect(page.locator('#analysis-output')).toContainText('Local keyword heuristic');
  });

  await check('CSV persistence and atomic invalid-row rejection remain intact', async () => {
    await route('data');
    await page.locator('#csv-input').fill('name,lat,lng,value,category,date\n"Rice, north",15.5,120.9,0,mm,2026-11-01\nAngat field,14.91,121.16,25,mm,2026-11-02');
    await page.locator('#import-csv').click();
    await expect(page.locator('#csv-status')).toContainText('Imported 2');
    await expect(page.locator('#csv-preview')).toContainText('Rice, north');
    await page.locator('#csv-input').fill('lat,lng\n91,121');
    await page.locator('#import-csv').click();
    await expect(page.locator('#csv-status')).toContainText('No rows imported');
    await expect(page.locator('#csv-preview')).toContainText('Angat field');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#csv-preview')).toContainText('Rice, north');
  });

  await check('Direct globe route loads a single interactive canvas and visual layers respond', async () => {
    await globe();
    await expect(page.locator('#globe-canvas canvas')).toHaveCount(1);
    await page.locator('[data-globe-layer="rain"]').click();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-layer', 'rain');
    await page.locator('[data-globe-layer="stress"]').click();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-layer', 'stress');
    await page.locator('[data-globe-layer="geography"]').click();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-layer', 'geography');
    await page.locator('[data-globe-layer="heat"]').click();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-layer', 'heat');
    await screenshot('restored-globe-desktop');
  });

  await check('Zoom changes camera altitude; links, towers, labels and uploaded points change rendered counts', async () => {
    await globe();
    const altitude = await attrNumber('#globe-stage', 'data-altitude');
    expect(altitude).toBeGreaterThan(0);
    await page.locator('#globe-zoom-in').click();
    await expect.poll(() => attrNumber('#globe-stage', 'data-altitude')).toBeLessThan(altitude * .95);
    const zoomed = await attrNumber('#globe-stage', 'data-altitude');
    await page.locator('#globe-zoom-out').click();
    await expect.poll(() => attrNumber('#globe-stage', 'data-altitude')).toBeGreaterThan(zoomed * 1.05);
    const settings = page.locator('details.globe-layer-settings');
    if (!(await settings.evaluate(node => node.open))) await settings.locator('summary').click();
    for (const [id, attribute] of [['globe-links', 'data-arc-count'], ['globe-labels', 'data-label-count']]) {
      const control = page.locator('#' + id);
      if (await control.getAttribute('aria-pressed') !== 'true') await control.click();
      await expect.poll(() => attrNumber('#globe-stage', attribute)).toBeGreaterThan(0);
      await control.click();
      await expect.poll(() => attrNumber('#globe-stage', attribute)).toBe(0);
      await control.click();
      await expect.poll(() => attrNumber('#globe-stage', attribute)).toBeGreaterThan(0);
    }
    const userControl = page.locator('#globe-user-data');
    if (await userControl.getAttribute('aria-pressed') !== 'true') await userControl.click();
    const allPoints = await attrNumber('#globe-stage', 'data-visible-points');
    expect(allPoints).toBeGreaterThanOrEqual(2);
    await userControl.click();
    await expect.poll(() => attrNumber('#globe-stage', 'data-visible-points')).toBe(allPoints - 2);
    await userControl.click();
    await expect.poll(() => attrNumber('#globe-stage', 'data-visible-points')).toBe(allPoints);
    const towers = page.locator('#globe-towers');
    if (await towers.getAttribute('aria-pressed') !== 'true') await towers.click();
    const withTowers = await attrNumber('#globe-stage', 'data-visible-points');
    await towers.click();
    await expect.poll(() => attrNumber('#globe-stage', 'data-visible-points')).toBeLessThan(withTowers);
    await towers.click();
    await expect.poll(() => attrNumber('#globe-stage', 'data-visible-points')).toBe(withTowers);
    const rotation = page.locator('#globe-rotate');
    const wasRotating = await rotation.getAttribute('aria-pressed');
    await rotation.click();
    await expect(rotation).toHaveAttribute('aria-pressed', wasRotating === 'true' ? 'false' : 'true');
    if (await rotation.getAttribute('aria-pressed') === 'true') await rotation.click();
    if (await settings.evaluate(node => node.open)) await settings.locator('summary').click();
  });

  await check('Country/coordinate search selects places; guided tour and phase playback advance', async () => {
    await globe();
    await page.locator('#globe-query').fill('Philippines');
    await page.locator('#globe-search-submit').click();
    const selectedCountry = await page.locator('#globe-stage').getAttribute('data-selected');
    if (selectedCountry !== 'Philippines') {
      const result = page.locator('[data-place-index]').filter({ hasText: 'Philippines' }).first();
      await expect(result).toBeVisible();
      await result.click();
    }
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-selected', 'Philippines');
    await expect(page.locator('#globe-panel-body')).toContainText('Country');
    await page.locator('#globe-query').fill('14.91, 121.16');
    await page.locator('#globe-search-submit').click();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-selected', /14\.910.*121\.160/);
    await expect(page.locator('#globe-panel-body')).toContainText('14.910');
    await expect.poll(() => attrNumber('#globe-stage', 'data-latitude')).toBeCloseTo(14.91, 1);
    await expect.poll(() => attrNumber('#globe-stage', 'data-longitude')).toBeCloseTo(121.16, 1);
    await page.locator('[data-globe-tab="tour"]').click();
    await expect(page.locator('#globe-panel-body')).toContainText('Step 1 of 4');
    await page.locator('#globe-tour-next').click();
    await expect(page.locator('#globe-panel-body')).toContainText('Step 2 of 4');
    await page.locator('#globe-tour-back').click();
    await expect(page.locator('#globe-panel-body')).toContainText('Step 1 of 4');
    await page.locator('#globe-phase').fill('0');
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-phase', '0');
    await page.locator('#globe-play').click();
    await expect(page.locator('#globe-play')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => attrNumber('#globe-stage', 'data-phase')).toBeGreaterThan(0);
    await page.locator('#globe-play').click();
    const phase = await attrNumber('#globe-stage', 'data-phase');
    await page.waitForTimeout(250);
    expect(await attrNumber('#globe-stage', 'data-phase')).toBe(phase);
    await page.locator('[data-globe-tab="events"]').click();
    await expect(page.locator('#globe-panel-body')).not.toHaveText('');
  });

  await check('Local satellite window handles decoded imagery, service errors, radar browse and cancelled requests', async () => {
    await globe();
    const requests = [];
    const release = [];
    let fixture = 'png';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64');
    const handler = async request => {
      requests.push(request.request().url());
      const kind = fixture;
      if (kind === 'delay') await new Promise(resolve => release.push(resolve));
      try {
        if (kind === 'xml') await request.fulfill({ status: 200, contentType: 'application/xml', body: '<ServiceExceptionReport>No imagery for this date</ServiceExceptionReport>' });
        else await request.fulfill({ status: 200, contentType: 'image/png', body: png });
      } catch (error) {
        // A closed window intentionally aborts its request while the fixture is delayed.
        if (kind !== 'delay') throw error;
      }
    };
    await page.route('https://gibs.earthdata.nasa.gov/**', handler);
    try {
      await page.locator('#globe-query').fill('Angat reservoir');
      await page.locator('#globe-search-submit').click();
      await expect(page.locator('#globe-stage')).toHaveAttribute('data-selected', /Angat/i);
      await page.locator('#globe-open-local').click();
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('#local-window-image')).toBeVisible();
      expect(await page.locator('#local-window-image').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect(page.locator('#local-window-note')).toContainText('not radar');
      const original = new URL(requests.at(-1)).searchParams.get('BBOX').split(',').map(Number);
      await page.locator('[data-local-width="100"]').click();
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('#local-window-status')).toContainText('100 km');
      const wider = new URL(requests.at(-1)).searchParams.get('BBOX').split(',').map(Number);
      expect(wider[2] - wider[0]).toBeGreaterThan(original[2] - original[0]);
      fixture = 'xml';
      await page.locator('#local-window-refresh').click();
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'error');
      await expect(page.locator('#local-window-status')).toContainText('no usable image');
      fixture = 'png';
      await page.locator('#local-window-refresh').click();
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'ready');
      await page.locator('[data-local-mode="radar"]').click();
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'ready');
      await expect(page.locator('#local-window-note')).toContainText('Processed study measurements are still pending');
      await expect(page.locator('#local-window-source')).toHaveAttribute('href', /nisar\.asf\./);
      expect(await page.locator('#local-window-image').evaluate(image => image.naturalWidth)).toBeGreaterThan(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('#local-window')).not.toBeVisible();
      await expect(page.locator('#globe-open-local')).toBeFocused();
      fixture = 'delay';
      await page.locator('#globe-open-local').click();
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'loading');
      await expect.poll(() => release.length).toBeGreaterThan(0);
      await page.locator('#local-window-close').click();
      release.splice(0).forEach(resolve => resolve());
      await page.waitForTimeout(200);
      await expect(page.locator('#local-window')).toHaveAttribute('data-state', 'closed');
      await expect(page.locator('#local-window')).not.toBeVisible();
    } finally {
      release.splice(0).forEach(resolve => resolve());
      await page.unroute('https://gibs.earthdata.nasa.gov/**', handler);
      if (await page.locator('#local-window').isVisible()) await page.locator('#local-window-close').click();
    }
  });

  await check('Radar comparison and real-data pending states remain separate', async () => {
    await route('observatory/angat');
    await expect(page.locator('#radar-status')).toHaveText('Processed radar data pending');
    await expect(page.locator('.browse-preview img')).toBeVisible();
    await page.locator('#toggle-demo').click();
    await expect(page.locator('#radar-status')).toContainText('Illustrative');
    await page.locator('#swipe-range').fill('75');
    await expect(page.locator('#swipe-value')).toHaveText('75%');
    await expect(page.locator('#compare-after')).toHaveCSS('clip-path', 'inset(0px 0px 0px 75%)');
    await page.locator('[data-mode="change"]').click();
    await expect(page.locator('.change-scale')).toBeVisible();
    await expect(page.locator('[data-pol="VV"]')).toBeDisabled();
    await page.locator('[data-pol="HV"]').click();
    await expect(page.locator('[data-pol="HV"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#before-date').selectOption('demo-2');
    await expect(page.locator('#radar-stage-container')).toContainText('Choose an earlier');
    await page.locator('#toggle-demo').click();
    await expect(page.locator('#radar-status')).toHaveText('Processed radar data pending');
  });

  await check('Rapid navigation suspends hidden rendering and the legacy globe link still opens', async () => {
    await page.evaluate(() => { location.hash = 'globe'; });
    await page.waitForTimeout(30);
    await page.evaluate(() => { location.hash = 'story'; });
    await page.waitForTimeout(30);
    await page.evaluate(() => { location.hash = 'news'; });
    await expect(page.locator('#page-news')).toBeVisible();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering', 'paused');
    await expect(page.locator('#ocean-diagram')).toHaveAttribute('data-running', 'false');
    await page.waitForTimeout(500);
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering', 'paused');
    await page.evaluate(() => { location.hash = 'observatory/globe'; });
    await expect(page.locator('#page-globe')).toBeVisible();
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-rendering', 'active');
    await expect(page.locator('#globe-canvas canvas')).toHaveCount(1);
  });

  await check('Theme choice persists and mobile globe leaves room for exploration', async () => {
    const theme = page.locator('#toggle-theme');
    const before = await page.locator('html').getAttribute('data-theme');
    await theme.click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
    await page.setViewportSize({ width: 390, height: 844 });
    await globe();
    await noOverflow();
    const canvas = await page.locator('#globe-canvas').boundingBox();
    const panel = await page.locator('#globe-panel').boundingBox();
    expect(canvas.width).toBeGreaterThan(250);
    expect(canvas.height).toBeGreaterThan(300);
    expect(panel.y - canvas.y).toBeGreaterThan(150);
    await screenshot('restored-globe-mobile');
    await route('story');
    await noOverflow();
    await screenshot('restored-story-mobile');
    await page.locator('#ocean-diagram').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.artifacts/restored-animation-mobile.png', fullPage: false });
    await page.locator('#open-search').click();
    await expect(page.locator('#search-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-dialog')).not.toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('Reduced motion stops ambient animation while manual stage controls remain usable', async () => {
    const reduced = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const quiet = await reduced.newPage();
    attachErrors(quiet);
    try {
      await quiet.goto(base + '/#story', { waitUntil: 'networkidle' });
      await quiet.locator('#ocean-diagram').scrollIntoViewIfNeeded();
      await expect(quiet.locator('#ocean-diagram')).toHaveAttribute('data-running', 'false');
      await quiet.locator('[data-ocean-stage="65"]').click();
      await expect(quiet.locator('#animated-ocean')).toHaveAttribute('data-phase', '65');
      await expect(quiet.locator('#phase-label')).toContainText('Niño');
      const wind = await quiet.locator('.wind-particle').first().getAttribute('transform');
      await quiet.waitForTimeout(250);
      expect(await quiet.locator('.wind-particle').first().getAttribute('transform')).toBe(wind);
      await quiet.evaluate(() => { location.hash = 'globe'; });
      await expect(quiet.locator('#globe-canvas canvas')).toBeVisible({ timeout: 30000 });
      await expect(quiet.locator('#globe-rotate')).toHaveAttribute('aria-pressed', 'false');
      await expect(quiet.locator('#globe-play')).toHaveAttribute('aria-pressed', 'false');
    } finally { await reduced.close(); }
  });

  await check('Weather failure retains the saved real context', async () => {
    await route('observatory/angat');
    await expect(page.locator('#weather-charts')).toContainText('ERA5');
    expectedWeatherFailure = true;
    await page.route('**/api/weather/**', request => request.abort());
    await page.locator('#refresh-weather').click();
    await expect(page.locator('#weather-status')).toContainText('Saved snapshot retained');
    await expect(page.locator('#weather-charts')).toContainText('ERA5');
    await page.unroute('**/api/weather/**');
  });

  await check('No uncaught JavaScript errors or unexpected console errors', async () => {
    expect(report.errors).toEqual([]);
    const unexpected = report.consoleErrors.filter(item => !(item.expectedWeatherFailure && item.message.includes('net::ERR_FAILED')));
    expect(unexpected).toEqual([]);
  });
} finally {
  report.passed = report.checks.every(item => item.passed) && report.errors.length === 0;
  await writeFile('.artifacts/restoration-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
if (!report.passed) {
  console.error('Restoration checks failed; inspect .artifacts/restoration-report.json and failure screenshots.');
  process.exitCode = 1;
}
