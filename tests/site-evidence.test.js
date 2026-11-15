import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/site-evidence.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const { latestSavedSiteMosaic } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('latest saved site mosaic is chosen by real dated image, not manifest order or catalog-only dates', () => {
  const evidence = {
    siteId: 'dadu',
    gibs: { frames: [
      { date: '2026-11-02', status: 'not available', image: null },
      { date: '2026-10-27', status: 'ready', image: 'data/sites/dadu/gibs/2026-10-27.png', label: 'browse imagery, false color, not calibrated' },
      { date: '2026-10-10', status: 'ready', image: 'data/sites/dadu/gibs/2026-10-10.png' },
      { date: '2026-12-01', status: 'ready', image: null },
      { date: '2026-02-30', status: 'ready', image: 'data/sites/dadu/gibs/invalid.png' }
    ] }
  };
  assert.deepEqual(latestSavedSiteMosaic(evidence), evidence.gibs.frames[1]);
});

test('missing, invalid, and unavailable site imagery remains explicitly unavailable', () => {
  assert.equal(latestSavedSiteMosaic({ siteId: 'dadu' }), null);
  assert.equal(latestSavedSiteMosaic({ siteId: 'dadu', gibs: { frames: [] } }), null);
  assert.equal(latestSavedSiteMosaic({ siteId: 'dadu', gibs: { frames: [
    { date: '2026-11-02', status: 'not available', image: null },
    { date: 'not-a-date', status: 'ready', image: 'data/sites/dadu/gibs/bad.png' }
  ] } }), null);
});

test('every study site helper result points to its newest actual saved GIBS image', () => {
  const sites = JSON.parse(readFileSync('public/data/sites.json', 'utf8'));
  for (const site of sites) {
    const evidence = JSON.parse(readFileSync(`public/data/sites/${site.id}/evidence.json`, 'utf8'));
    const selected = latestSavedSiteMosaic(evidence);
    const expected = evidence.gibs.frames
      .filter(frame => frame.status === 'ready' && frame.image)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    assert.equal(selected?.date, expected?.date, site.id);
    assert.equal(selected?.image, expected?.image, site.id);
    assert.ok(selected && existsSync('public/' + selected.image), site.id);
  }
});
