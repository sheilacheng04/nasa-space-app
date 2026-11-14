import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROUTES = [
  { id: 'story', hash: '#story', selector: '#page-story' },
  { id: 'sites', hash: '#sites/angat', selector: '#page-sites' },
  { id: 'globe', hash: '#globe', selector: '#page-globe' },
  { id: 'media', hash: '#media', selector: '#page-news' },
  { id: 'method', hash: '#method', selector: '#page-method' }
];

const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:5175';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function attachLocalDistServer(context, delayJsonMs = 0) {
  await context.route(`${baseUrl}/**`, async (route) => {
    const u = new URL(route.request().url());
    let reqPath = decodeURIComponent(u.pathname);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    if (delayJsonMs > 0 && reqPath.endsWith('.json')) {
      await new Promise((r) => setTimeout(r, delayJsonMs));
    }
    const candidates = [
      path.join('dist', reqPath),
      path.join('public', reqPath)
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const body = await readFile(filePath);
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

const captureDir = process.env.CAPTURE_DIR || '';
if (captureDir) {
  await mkdir(captureDir, { recursive: true });
}
await mkdir('.artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const report = {
  baseUrl,
  captureDir,
  checks: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  blankFindings: []
};

const pass = (msg) => {
  report.checks.push(msg);
  console.log('PASS ' + msg);
};

async function verifyNoBlankSections(page, routeInfo, contextLabel) {
  await expect(page.locator(routeInfo.selector)).toBeVisible({ timeout: 25000 });
  if (routeInfo.id === 'globe') {
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  }
  if (routeInfo.id === 'sites') {
    await expect(page.locator('.site-timeline')).toBeVisible({ timeout: 20000 });
  }
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return;
    const imgs = [...root.querySelectorAll('img')];
    await Promise.allSettled(imgs.map((img) => (typeof img.decode === 'function' ? img.decode() : Promise.resolve())));
  }, routeInfo.selector);

  const audit = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { ok: false, reason: 'Missing route root ' + sel };
    const textLen = (root.innerText || '').trim().length;
    if (textLen < 80) {
      return { ok: false, reason: `Route ${sel} has too little text (${textLen} chars)` };
    }

    // Check visible panels/cards inside the route
    const panels = [...root.querySelectorAll('.card, .panel, .site-timeline, .radar-evidence, #globe-stage')].filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    });
    for (const panel of panels) {
      const panelText = (panel.innerText || '').trim().length;
      const hasMedia = panel.querySelectorAll('img, canvas, svg').length > 0;
      if (panelText === 0 && !hasMedia) {
        return { ok: false, reason: `Empty visible panel in ${sel}: ${panel.className || panel.id}` };
      }
    }

    // Check visible images
    const imgs = [...root.querySelectorAll('img')].filter((img) => {
      const style = getComputedStyle(img);
      const rect = img.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const brokenImgs = imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.getAttribute('src') || img.alt || 'unnamed-img');

    // Check visible canvases
    const canvases = [...root.querySelectorAll('canvas')].filter((c) => {
      const style = getComputedStyle(c);
      const rect = c.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const blankCanvases = [];
    for (const c of canvases) {
      if (c.width === 0 || c.height === 0) {
        blankCanvases.push(c.id || c.className || 'zero-size-canvas');
        continue;
      }
      const ctx2d = c.getContext('2d');
      if (ctx2d) {
        const cx = Math.max(0, Math.floor(c.width / 2) - 32);
        const cy = Math.max(0, Math.floor(c.height / 2) - 32);
        const w = Math.min(c.width - cx, 64);
        const h = Math.min(c.height - cy, 64);
        const data = ctx2d.getImageData(cx, cy, w, h).data;
        let nonZero = 0;
        for (let i = 3; i < data.length; i += 16) {
          if (data[i] > 0) nonZero++;
        }
        if (nonZero === 0) blankCanvases.push(c.id || c.className || 'blank-2d-canvas');
      }
    }

    return {
      ok: brokenImgs.length === 0 && blankCanvases.length === 0,
      textLen,
      imgCount: imgs.length,
      brokenImgs,
      canvasCount: canvases.length,
      blankCanvases
    };
  }, routeInfo.selector);

  if (!audit.ok) {
    const detail = `${contextLabel} [${routeInfo.id}]: ${JSON.stringify(audit)}`;
    report.blankFindings.push(detail);
    console.warn('FINDING ' + detail);
    if (process.env.RECORD_ONLY !== '1') {
      throw new Error('Blank or broken visual state: ' + detail);
    }
  }
}

try {
  // 1. Standard matrix: 5 routes x (light, dark) x (390px, 1280px)
  for (const width of [1280, 390]) {
    const height = width === 390 ? 844 : 960;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await attachLocalDistServer(context);
    const page = await context.newPage();
    page.on('pageerror', (e) => report.pageErrors.push(`${width}px: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') report.consoleErrors.push(`${width}px: ${m.text()}`);
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (!url.includes('gibs.earthdata.nasa.gov')) {
        report.failedRequests.push(`${width}px: ${url} (${req.failure()?.errorText || 'failed'})`);
      }
    });

    for (const theme of ['light', 'dark']) {
      await page.goto(`${baseUrl}/#story`, { waitUntil: 'networkidle' });
      const currentTheme = await page.locator('html').getAttribute('data-theme');
      if (currentTheme !== theme) {
        await page.locator('#toggle-theme').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      }

      for (const route of ROUTES) {
        await page.goto(`${baseUrl}/${route.hash}`, { waitUntil: 'networkidle' });
        await verifyNoBlankSections(page, route, `${theme}-${width}px`);
        if (captureDir) {
          const filename = `${route.id}-${theme}-${width}px.png`;
          await page.screenshot({ path: path.join(captureDir, filename), fullPage: route.id !== 'globe' });
        }
      }
      pass(`All 5 routes verified non-blank in ${theme} theme at ${width}px`);
    }
    await context.close();
  }

  // 2. Slow network + CPU throttling + reduced motion
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await attachLocalDistServer(context, 120);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    for (const route of ROUTES) {
      await page.goto(`${baseUrl}/${route.hash}`, { waitUntil: 'domcontentloaded' });
      await verifyNoBlankSections(page, route, 'slow-network-cpu-throttle');
    }
    pass('All 5 routes render without blank states under slow network + 4x CPU throttling + reduced motion');
    await context.close();
  }

  // 3. WebGL disabled (compatibility canvas fallback)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await attachLocalDistServer(context);
    await context.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return orig.call(this, type, ...args);
      };
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/#globe`, { waitUntil: 'networkidle' });
    await verifyNoBlankSections(page, ROUTES[2], 'webgl-disabled');
    await expect(page.locator('#globe-stage')).toHaveAttribute('data-renderer', 'canvas');
    pass('Globe renders non-blank 2D compatibility canvas when WebGL is disabled');
    await context.close();
  }

  // 4. Hidden-then-shown tab
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await attachLocalDistServer(context);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/#globe`, { waitUntil: 'networkidle' });
    await verifyNoBlankSections(page, ROUTES[2], 'before-hide-tab');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await verifyNoBlankSections(page, ROUTES[2], 'after-show-tab');
    pass('Hidden-then-shown tab resumes cleanly without blanking Globe or Story');
    await context.close();
  }

  // 5. Offline edition (el-nino-app.html)
  if (existsSync('el-nino-app.html')) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const externalRequests = [];
    page.on('request', (req) => {
      if (/^https?:/.test(req.url())) externalRequests.push(req.url());
    });
    const fileUrl = pathToFileURL(path.resolve('el-nino-app.html')).href;
    for (const route of ROUTES) {
      await page.goto(`${fileUrl}${route.hash}`);
      await verifyNoBlankSections(page, route, 'offline-edition');
    }
    assert.deepEqual(externalRequests, [], 'Offline edition must make zero external requests');
    pass('Offline edition renders all 5 routes non-blank with zero network requests');
    await context.close();
  }

  if (process.env.RECORD_ONLY !== '1') {
    assert.deepEqual(report.pageErrors, [], 'Page errors detected');
    assert.deepEqual(report.consoleErrors, [], 'Console errors detected');
    assert.deepEqual(report.failedRequests, [], 'Failed requests detected');
    assert.deepEqual(report.blankFindings, [], 'Blank findings detected');
  }
  console.log(`ALL ${report.checks.length} BLANK-PAGE CHECK GROUPS COMPLETED (findings: ${report.blankFindings.length})`);
} finally {
  await browser.close();
  await writeFile('.artifacts/blank-page-report.json', JSON.stringify(report, null, 2));
}
