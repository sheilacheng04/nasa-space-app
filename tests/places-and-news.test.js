import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const VALID_REGIMES = new Set(['dry', 'wet', 'mixed', 'la-nina-reference']);
const VALID_KINDS = new Set(['agriculture', 'water', 'floodplain', 'river', 'forest', 'city']);
const VALID_MATCHED_BY = new Set(['place-name', 'country', 'query']);

test('public/data/places.json satisfies the shared data contract with >= 30 global places and Philippines focus', async () => {
  const places = JSON.parse(await readFile('public/data/places.json', 'utf8'));
  assert.ok(Array.isArray(places), 'places.json must be an array');
  assert.ok(places.length >= 30, `Expected at least 30 places, got ${places.length}`);

  const ids = new Set();
  const countries = new Set();
  const regions = new Set();
  let philippinesCount = 0;
  let radarCount = 0;

  for (const p of places) {
    assert.ok(typeof p.id === 'string' && p.id.length > 0, 'id required');
    assert.ok(!ids.has(p.id), `Duplicate place id: ${p.id}`);
    ids.add(p.id);

    assert.ok(typeof p.name === 'string' && p.name.length > 0, `name required for ${p.id}`);
    assert.ok(typeof p.country === 'string' && p.country.length > 0, `country required for ${p.id}`);
    assert.ok(typeof p.countryCode === 'string' && p.countryCode.length === 2, `ISO-2 countryCode required for ${p.id}`);
    assert.ok(typeof p.region === 'string' && p.region.length > 0, `region required for ${p.id}`);
    assert.ok(Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90, `valid lat required for ${p.id}`);
    assert.ok(Number.isFinite(p.lng) && p.lng >= -180 && p.lng <= 180, `valid lng required for ${p.id}`);
    assert.ok(Array.isArray(p.bounds) && p.bounds.length === 4 && p.bounds.every(Number.isFinite), `bounds [w,s,e,n] required for ${p.id}`);
    assert.ok(p.bounds[0] < p.bounds[2] && p.bounds[1] < p.bounds[3], `ordered bounds required for ${p.id}`);
    assert.ok(VALID_REGIMES.has(p.regime), `valid regime required for ${p.id}, got ${p.regime}`);
    assert.ok(VALID_KINDS.has(p.kind), `valid kind required for ${p.id}, got ${p.kind}`);
    assert.equal(typeof p.hasRadarFrames, 'boolean', `hasRadarFrames boolean required for ${p.id}`);
    if (p.hasRadarFrames) {
      assert.ok(typeof p.siteId === 'string' && p.siteId.length > 0, `siteId required when hasRadarFrames is true (${p.id})`);
      radarCount++;
    } else {
      assert.equal(p.siteId, undefined, `siteId must be omitted when hasRadarFrames is false (${p.id})`);
    }
    assert.ok(typeof p.newsQuery === 'string' && p.newsQuery.length > 0, `newsQuery required for ${p.id}`);
    assert.ok(Array.isArray(p.aliases) && p.aliases.length > 0, `aliases array required for ${p.id}`);

    countries.add(p.country);
    regions.add(p.region);
    if (p.countryCode === 'PH') philippinesCount++;
  }

  assert.ok(philippinesCount >= 5, `Expected at least 5 Philippine places (Luzon, Angat + >=3 more), got ${philippinesCount}`);
  const sites = JSON.parse(await readFile('public/data/sites.json', 'utf8'));
  assert.equal(radarCount, sites.length, 'Radar place links must match the curated study sites');
  for (const site of sites) {
    assert.ok(places.some(p => p.siteId === site.id && p.hasRadarFrames));
    const evidence = JSON.parse(await readFile(`public/data/sites/${site.id}/evidence.json`, 'utf8'));
    assert.equal(evidence.gibs.frames.filter(f => f.status === 'ready' && f.image).length, site.savedFrameCount);
  }
  assert.ok(ids.has('luzon') && ids.has('angat') && ids.has('dadu') && ids.has('piura'), 'Must retain the 4 existing sites');
  const dadu = places.find((p) => p.id === 'dadu');
  assert.equal(dadu.regime, 'la-nina-reference', 'Dadu 2022 must be labeled as la-nina-reference');
});

test('public/data/news-by-place.json satisfies the shared data contract and links headlines accurately', async () => {
  const places = JSON.parse(await readFile('public/data/places.json', 'utf8'));
  const placeIds = new Set(places.map((p) => p.id));
  const newsByPlace = JSON.parse(await readFile('public/data/news-by-place.json', 'utf8'));

  assert.ok(typeof newsByPlace.updatedAt === 'string' && newsByPlace.updatedAt.length > 0);
  assert.ok(typeof newsByPlace.source === 'string' && newsByPlace.source.length > 0);
  assert.ok(Array.isArray(newsByPlace.items) && newsByPlace.items.length > 0);

  for (const item of newsByPlace.items) {
    assert.ok(typeof item.id === 'string' && item.id.length > 0);
    assert.ok(placeIds.has(item.placeId), `Unknown placeId ${item.placeId}`);
    assert.ok(typeof item.title === 'string' && item.title.length > 0);
    assert.ok(typeof item.source === 'string' && item.source.length > 0);
    assert.ok(typeof item.url === 'string' && item.url.startsWith('http'));
    assert.ok(typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date));
    assert.ok(VALID_MATCHED_BY.has(item.matchedBy), `Invalid matchedBy: ${item.matchedBy}`);
    assert.ok(item.tone && Number.isFinite(item.tone.vader) && Number.isFinite(item.tone.vaderAdjusted));
    assert.equal(item.tone.ai, null);
    assert.equal(item.aiAnalysis, null);
  }
});
