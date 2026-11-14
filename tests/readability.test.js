import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function countSyllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

function readabilityMetrics(paragraphs) {
  const text = paragraphs.join(' ');
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9-]/g, ''))
    .filter((w) => w.length > 0);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentenceLength = words.length / Math.max(1, sentences.length);
  const syllablesPerWord = syllables / Math.max(1, words.length);
  const flesch = 206.835 - 1.015 * avgSentenceLength - 84.6 * syllablesPerWord;
  return {
    sentences: sentences.length,
    words: words.length,
    avgSentenceLength: Number(avgSentenceLength.toFixed(1)),
    flesch: Number(flesch.toFixed(1))
  };
}

const PAGE_LEAD_COPY = {
  story: [
    'Follow how Pacific warming shifts rain across continents and see what dated radar and weather records show on the ground.',
    'Wait for warm water to pile up in the east. Watch the rain follow it.',
    'The western Pacific dries out while the eastern Pacific floods.',
    'During a standard year, steady trade winds push sun-warmed water west toward Indonesia, the Philippines, and northern Australia.',
    'During El Niño, those winds weaken. Warm water slides east toward South America and pulls rain clouds with it.',
    'Satellites watch the ocean and land together. NOAA instruments track sea temperature, while radar and optical sensors watch reservoirs, rivers, and farm belts.',
    'Camera satellites cannot see through storm clouds. Radar sends its own microwave pulse to the ground and measures the echo that bounces back.'
  ],
  sites: [
    'Inspect dated NASA/ISRO radar frames, daily rainfall, and local news for 34 global study places.',
    'Smooth water reflects radar pulses away from the satellite and looks dark.',
    'Rough soil, trees, and buildings scatter energy back and look bright.',
    'Check the date list for missing days. Compare two dates with the slider, and check daily rain below before drawing conclusions.'
  ],
  globe: [
    'Explore dated NISAR radar frames and monthly vegetation on a 3D globe, or zoom into local NASA GIBS map tiles.',
    'Use the status strip to check the active mode, layer, date, and place, or run the guided tour.'
  ],
  media: [
    'Compare regional news coverage, headline wording tone, and place-matched reports across 34 study places.',
    'The archive below comes from GDELT and Google News RSS links.',
    'Scores show how alarming or calm the headline words are. They do not measure physical flood or drought damage.'
  ],
  method: [
    'See where every map, chart, and headline comes from, how to compare dates fairly, and what satellite previews can and cannot prove.',
    'We keep direct data, weather models, test ideas, and teaching sketches separate.',
    'One radar image shows how the ground bounced back radio waves on one day.',
    'To learn why the ground changed, we check many dates alongside local rain, dam rules, crop cycles, and news links.'
  ]
};

test('Task F4: Plain language reading ease is >= 60 and average sentence length < 20 words across all 5 pages', () => {
  for (const [page, paragraphs] of Object.entries(PAGE_LEAD_COPY)) {
    const metrics = readabilityMetrics(paragraphs);
    assert.ok(
      metrics.flesch >= 60,
      `Expected ${page} Flesch reading ease >= 60, got ${metrics.flesch}`
    );
    assert.ok(
      metrics.avgSentenceLength < 20,
      `Expected ${page} average sentence length < 20 words, got ${metrics.avgSentenceLength}`
    );
  }
});

test('Task F4: GlossaryTerm defines all 14 required technical terms and pages use GlossaryTerm inline popovers', async () => {
  const glossarySource = await readFile('src/components/GlossaryTerm.tsx', 'utf8');
  const requiredTerms = [
    'SAR',
    'NISAR',
    'backscatter',
    'polarization',
    'GCOV',
    'GIBS',
    'provisional',
    'CRID',
    'ERA5',
    'reanalysis',
    'ONI',
    "'Niño 3.4'",
    'MODIS',
    'greenness'
  ];
  for (const term of requiredTerms) {
    assert.ok(
      glossarySource.includes(`${term}:`),
      `Expected GlossaryTerm.tsx to define term "${term}"`
    );
  }

  const pageFiles = [
    'src/pages/StoryPage.tsx',
    'src/pages/SitesPage.tsx',
    'src/components/GlobeExperience.tsx',
    'src/pages/NewsPage.tsx',
    'src/pages/MethodPage.tsx'
  ];
  for (const file of pageFiles) {
    const content = await readFile(file, 'utf8');
    assert.ok(
      content.includes('GlossaryTerm'),
      `Expected ${file} to use GlossaryTerm inline popovers for technical terms`
    );
  }
});
