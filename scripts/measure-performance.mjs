import { chromium } from '@playwright/test';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const label = process.argv[2] || 'baseline';
const base = 'http://127.0.0.1:5175';
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

async function attachLocalDistServer(context, requestLog) {
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
        requestLog.push({ path: reqPath, bytes: body.length, ts: Date.now() });
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

function getBundleMetrics() {
  const jsDir = path.join(process.cwd(), 'dist', 'js');
  const cssDir = path.join(process.cwd(), 'dist', 'css');
  const jsFiles = existsSync(jsDir)
    ? readdirSync(jsDir)
        .filter((f) => f.endsWith('.js'))
        .map((f) => ({ name: f, bytes: statSync(path.join(jsDir, f)).size }))
        .sort((a, b) => b.bytes - a.bytes)
    : [];
  const cssFiles = existsSync(cssDir)
    ? readdirSync(cssDir)
        .filter((f) => f.endsWith('.css'))
        .map((f) => ({ name: f, bytes: statSync(path.join(cssDir, f)).size }))
        .sort((a, b) => b.bytes - a.bytes)
    : [];
  const entryJs = jsFiles.find((f) => f.name.startsWith('index-')) || jsFiles[0] || { name: 'none', bytes: 0 };
  const totalJsBytes = jsFiles.reduce((s, f) => s + f.bytes, 0);
  const totalCssBytes = cssFiles.reduce((s, f) => s + f.bytes, 0);
  return { entryJs, jsFiles, cssFiles, totalJsBytes, totalCssBytes };
}

const browser = await chromium.launch({ headless: true, executablePath });
try {
  await mkdir('.artifacts', { recursive: true });
  const bundles = getBundleMetrics();

  // 1. Measure Initial Story Load
  const storyRequests = [];
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await attachLocalDistServer(ctx1, storyRequests);
  const page1 = await ctx1.newPage();
  const cdp1 = await ctx1.newCDPSession(page1);
  await cdp1.send('Performance.enable');

  const t0 = performance.now();
  await page1.goto(`${base}/#story`, { waitUntil: 'domcontentloaded' });
  await page1.locator('#page-story h1').waitFor({ state: 'visible', timeout: 15000 });
  const storyUsableMs = Math.round((performance.now() - t0) * 10) / 10;
  await page1.waitForLoadState('networkidle');
  const storyNetworkIdleMs = Math.round((performance.now() - t0) * 10) / 10;

  const storyDomInfo = await page1.evaluate(() => ({
    totalDomNodes: document.querySelectorAll('*').length,
    storyDomNodes: document.querySelector('#page-story')?.querySelectorAll('*').length || 0,
    hiddenPageDomNodes: Array.from(document.querySelectorAll('main section.page[hidden]')).reduce(
      (sum, el) => sum + el.querySelectorAll('*').length,
      0
    )
  }));
  const cdpMetrics1 = await cdp1.send('Performance.getMetrics');
  const storyHeapBytes = cdpMetrics1.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
  await ctx1.close();

  // 2. Measure Sites Interactive Time (direct navigation + transition from Story)
  const sitesRequests = [];
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await attachLocalDistServer(ctx2, sitesRequests);
  const page2 = await ctx2.newPage();
  const ts0 = performance.now();
  await page2.goto(`${base}/#sites/angat`, { waitUntil: 'domcontentloaded' });
  await page2.locator('.site-timeline').waitFor({ state: 'visible', timeout: 15000 });
  const sitesInteractiveMs = Math.round((performance.now() - ts0) * 10) / 10;
  await page2.waitForLoadState('networkidle');
  await ctx2.close();

  // 3. Measure Globe Usable Time (default Surface mode + 3D Concept mode)
  const globeRequests = [];
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await attachLocalDistServer(ctx3, globeRequests);
  await ctx3.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 204, body: '' }));
  await ctx3.route('https://gibs.earthdata.nasa.gov/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page3 = await ctx3.newPage();
  const tg0 = performance.now();
  await page3.goto(`${base}/#globe`, { waitUntil: 'domcontentloaded' });
  await page3.locator('.surface-panel').waitFor({ state: 'visible', timeout: 20000 });
  const globeSurfaceUsableMs = Math.round((performance.now() - tg0) * 10) / 10;

  const tg3d0 = performance.now();
  await page3.evaluate(() => {
    location.hash = 'globe?mode=concept&site=angat&month=2026-10';
  });
  await page3.locator('#globe-stage[data-ready="true"]').waitFor({ state: 'attached', timeout: 25000 });
  const globe3dReadyMs = Math.round((performance.now() - tg3d0) * 10) / 10;
  await ctx3.close();

  // 4. Measure Full Multi-Page Navigation & Duplicate Requests
  const navRequests = [];
  const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await attachLocalDistServer(ctx4, navRequests);
  await ctx4.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 204, body: '' }));
  await ctx4.route('https://gibs.earthdata.nasa.gov/**', (r) => r.fulfill({ status: 204, body: '' }));
  const page4 = await ctx4.newPage();
  const cdp4 = await ctx4.newCDPSession(page4);
  await cdp4.send('Performance.enable');

  await page4.goto(`${base}/#story`, { waitUntil: 'networkidle' });
  // Navigate Story -> Sites -> Globe -> Media -> Method -> Sites -> Story + open Search
  const navSteps = ['sites/angat', 'globe?mode=concept&site=angat&month=2026-10', 'media', 'method', 'sites/angat', 'story'];
  const stepTimings = {};
  for (const hash of navSteps) {
    const tStep = performance.now();
    await page4.evaluate((h) => {
      location.hash = h;
    }, hash);
    if (hash.startsWith('sites')) await page4.locator('.site-timeline').waitFor({ state: 'visible', timeout: 15000 });
    else if (hash.startsWith('globe')) await page4.locator('#globe-stage[data-ready="true"]').waitFor({ state: 'attached', timeout: 25000 });
    else if (hash === 'media') await page4.locator('#page-news h1').waitFor({ state: 'visible', timeout: 15000 });
    else if (hash === 'method') await page4.locator('#page-method h1').waitFor({ state: 'visible', timeout: 15000 });
    else if (hash === 'story') await page4.locator('#page-story h1').waitFor({ state: 'visible', timeout: 15000 });
    stepTimings[hash] = Math.round((performance.now() - tStep) * 10) / 10;
    await page4.waitForTimeout(150);
  }
  await page4.locator('#open-search').click();
  await page4.waitForTimeout(200);
  await page4.keyboard.press('Escape');

  const requestCounts = {};
  for (const req of navRequests) {
    requestCounts[req.path] = (requestCounts[req.path] || 0) + 1;
  }
  const duplicateRequests = Object.entries(requestCounts)
    .filter(([, count]) => count > 1)
    .map(([reqPath, count]) => ({ path: reqPath, count }));

  const cdpMetrics4 = await cdp4.send('Performance.getMetrics');
  const postNavHeapBytes = cdpMetrics4.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
  await ctx4.close();

  const summary = {
    label,
    measuredAt: new Date().toISOString(),
    bundles,
    storyLoad: {
      storyUsableMs,
      storyNetworkIdleMs,
      requestCount: storyRequests.length,
      totalBytes: storyRequests.reduce((s, r) => s + r.bytes, 0),
      requests: storyRequests.map((r) => ({ path: r.path, bytes: r.bytes })),
      dom: storyDomInfo,
      jsHeapUsedBytes: storyHeapBytes
    },
    sitesLoad: {
      sitesInteractiveMs,
      requestCount: sitesRequests.length,
      totalBytes: sitesRequests.reduce((s, r) => s + r.bytes, 0)
    },
    globeLoad: {
      globeSurfaceUsableMs,
      globe3dReadyMs,
      requestCount: globeRequests.length,
      totalBytes: globeRequests.reduce((s, r) => s + r.bytes, 0)
    },
    navigation: {
      stepTimings,
      totalRequests: navRequests.length,
      duplicateRequests,
      postNavHeapBytes
    }
  };

  await writeFile(`.artifacts/perf-${label}.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
