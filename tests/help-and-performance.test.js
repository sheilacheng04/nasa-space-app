import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Help Guide (?) is rendered as an accessible modal dialog popup with Escape, outside-click, and focus restoration', async () => {
  const guideSrc = await readFile('src/components/FirstVisitGuide.tsx', 'utf8');
  const headerSrc = await readFile('src/components/Header.tsx', 'utf8');
  const appSrc = await readFile('src/App.tsx', 'utf8');

  // 1. Modal dialog structure & accessibility attributes
  assert.match(guideSrc, /<dialog[\s\S]*id="help-guide-dialog"/, 'Help guide must use a <dialog> modal element');
  assert.match(guideSrc, /aria-labelledby="help-guide-title"/, 'Help guide dialog must be labeled by #help-guide-title');
  assert.match(guideSrc, /aria-describedby="help-guide-intro"/, 'Help guide dialog must be described by #help-guide-intro');
  assert.match(guideSrc, /data-testid="first-visit-guide"/, 'Help guide dialog must preserve data-testid="first-visit-guide"');

  // 2. Expected guide content & scientific reading notes preserved
  assert.match(guideSrc, /How to explore The Two-Faced Pacific/, 'Help guide must include the main title');
  assert.match(guideSrc, /1\. Follow the Pacific shift \(Story\)/, 'Help guide must include Step 1 (Story)');
  assert.match(guideSrc, /2\. Inspect dated radar frames \(Sites\)/, 'Help guide must include Step 2 (Sites)');
  assert.match(guideSrc, /3\. Compare the Globe &amp; local news \(Globe &amp; Media\)/, 'Help guide must include Step 3 (Globe & Media)');
  assert.match(guideSrc, /How to read the controls &amp; scientific views/, 'Help guide must include scientific controls explanation');

  // 3. Close via close button, Escape key, and outside backdrop click, without closing on inside click
  assert.match(guideSrc, /id="dismiss-guide"/, 'Help guide must include #dismiss-guide close button');
  assert.match(guideSrc, /id="help-guide-close-icon"/, 'Help guide must include top-right close icon button');
  assert.match(guideSrc, /event\.key === 'Escape'/, 'Help guide must close when Escape is pressed');
  assert.match(guideSrc, /!panelRef\.current\.contains\(event\.target as Node\)/, 'Clicking outside the modal panel must close the dialog while inside clicks do not');

  // 4. Body scroll lock and focus restoration to #open-guide
  assert.match(guideSrc, /document\.body\.style\.overflow = 'hidden'/, 'Opening the help modal must lock background scrolling');
  assert.match(guideSrc, /document\.getElementById\('open-guide'\)\?\.focus/, 'Closing the help modal must restore focus to #open-guide');

  // 5. Header ? button accessibility & App non-intrusive startup state
  assert.match(headerSrc, /id="open-guide"[\s\S]*aria-haspopup="dialog"[\s\S]*aria-expanded=\{Boolean\(guideOpen\)\}/, 'Header ? button must expose aria-haspopup="dialog" and aria-expanded');
  assert.match(appSrc, /const \[guideOpen, setGuideOpen\] = useState\(false\)/, 'Help guide must start closed and not auto-open intrusively');
});

test('Performance architecture decouples Story from Globe, lazy-loads non-initial pages, and deduplicates JSON requests', async () => {
  const storySrc = await readFile('src/story.js', 'utf8');
  const appSrc = await readFile('src/App.tsx', 'utf8');
  const clientSrc = await readFile('src/api/client.ts', 'utf8');

  assert.doesNotMatch(storySrc, /from '\.\/world\.js'/, 'story.js must not import world.js into the initial Story bundle');
  assert.match(storySrc, /from '\.\/geography\.js'/, 'story.js must import geography from the lightweight geography.js module');

  assert.match(appSrc, /const SitesPage = lazy\(loadSitesPage\)/, 'SitesPage must be lazy-loaded');
  assert.match(appSrc, /const NewsPage = lazy\(loadNewsPage\)/, 'NewsPage must be lazy-loaded');
  assert.match(appSrc, /const MethodPage = lazy\(loadMethodPage\)/, 'MethodPage must be lazy-loaded');

  assert.match(clientSrc, /const dataCache = createJSONCache\(\)/, 'dataFile must deduplicate JSON requests with createJSONCache');
});
