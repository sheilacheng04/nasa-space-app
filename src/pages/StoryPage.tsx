import { useEffect, useState } from 'react';
import { initStory, setStoryActive } from '../story.js';
import { finite, formatDate, safeURL } from '../core.js';
import { GlossaryTerm } from '../components/GlossaryTerm';
import { FigureCaption } from '../components/FigureCaption';
import { StoryPreviewPlayer } from '../components/StoryPreviewPlayer';
import { WhereToNext } from '../components/FirstVisitGuide';
import type { ReactNode } from 'react';
import type { Bootstrap } from '../types';

const CHAPTERS = [
  { id: 'ocean', num: '1', label: 'Pacific shift' },
  { id: 'why-it-matters', num: '2', label: 'Daily life' },
  { id: 'reading-radar', num: '3', label: 'How radar works' },
  { id: 'site-evidence', num: '4', label: 'Local outcomes' },
  { id: 'future', num: '5', label: 'Test the cause' },
  { id: 'local', num: '6', label: 'Human stories' }
];

export function StoryPage({
  active,
  data,
  oceanNotice,
  evidenceNotice
}: {
  active: boolean;
  data: Bootstrap;
  oceanNotice: ReactNode;
  evidenceNotice: ReactNode;
}) {
  const [activeChapter, setActiveChapter] = useState('ocean');

  useEffect(() => {
    initStory().catch(() => {});
  }, []);

  useEffect(() => {
    setStoryActive(active);
    return () => setStoryActive(false);
  }, [active]);

  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') return;
    const elements = CHAPTERS.map((c) => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
    if (!elements.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          setActiveChapter(visibleEntries[0].target.id);
        }
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: 0.05 }
    );
    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [active]);

  const enso = data.enso;
  const oni = enso?.oni?.at(-1);
  const chapterIndex = Math.max(0, CHAPTERS.findIndex((c) => c.id === activeChapter));
  const chapterProgressPct = Math.round(((chapterIndex + 1) / CHAPTERS.length) * 100);

  return (
    <section id="page-story" className="page" hidden={!active}>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">NASA Space Apps 2026 · Dancing with the SARs · 57 Real Observations Across 4 Places</p>
          <h1>When the Pacific <span className="warm-accent">warms</span>, what changes on land?</h1>
          <p className="page-purpose-line">
            Follow a changing Pacific—and discover what satellites reveal about life on land.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#sites/angat">
              Inspect dated radar at Angat →
            </a>
            <a className="hero-quiet-link" href="#globe">
              Explore the 3D Globe
            </a>
            <details className="more-actions-dropdown">
              <summary className="hero-quiet-link">More actions ▾</summary>
              <div className="more-actions-menu">
                <a href="#story/ocean">Start Chapter 1: Ocean shift</a>
                <a href="#story/site-evidence">Chapter 4: Local outcomes</a>
                <a href="#method">Read data sources &amp; method</a>
              </div>
            </details>
          </div>
        </div>
      </div>

      <nav className="story-chapter-bar" aria-label="Story chapters and reading progress">
        <div className="wrap story-chapter-bar-inner">
          <div className="story-chapter-links">
            {CHAPTERS.map((ch) => (
              <a
                key={ch.id}
                href={`#story/${ch.id}`}
                className={activeChapter === ch.id ? 'is-active' : ''}
                aria-current={activeChapter === ch.id ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveChapter(ch.id);
                  document.getElementById(ch.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="chapter-pill-num">{ch.num}</span> {ch.label}
              </a>
            ))}
          </div>
          <div className="story-chapter-progress" aria-label={`Chapter ${chapterIndex + 1} of ${CHAPTERS.length}`}>
            <span>Chapter {chapterIndex + 1} / {CHAPTERS.length}</span>
            <div className="story-chapter-track">
              <div className="story-chapter-fill" style={{ width: `${chapterProgressPct}%` }} />
            </div>
          </div>
        </div>
      </nav>

      <div className="wrap story-wrap">
        <article className="story-section" id="ocean">
          <p className="eyebrow">Chapter 1 · A connected planet</p>
          <h2>
            <span className="chapter-number">1</span>An ocean shift changes where tropical rain falls
          </h2>
          <p className="large-copy">
            During El Niño, warm surface water in the central and eastern Pacific spreads east. Trade winds weaken, and tropical rain clouds shift with that warm water.
          </p>
          <p>
            Parts of the western Pacific—such as the Philippines and Indonesia—often grow drier. Parts of coastal Peru and Ecuador often grow wetter. Move the slider to watch the mechanism.
          </p>
          <div className="ocean-control">
            <div id="ocean-diagram" />
            <div className="ocean-slider">
              <label htmlFor="ocean-phase">
                Explore the mechanism <output id="phase-label">Normal year</output>
              </label>
              <input id="ocean-phase" type="range" min="0" max="100" defaultValue="0" />
            </div>
            <FigureCaption
              whatWhere="Conceptual cross-section of the equatorial Pacific Ocean from Asia/Australia (west) to South America (east)."
              dateSource="Illustrative diagram · Based on NOAA Pacific Marine Environmental Laboratory (PMEL) ENSO schematics."
              howToRead="The orange layer shows warm surface water, white arrows show trade winds, and the cloud shows where tropical convection and rain gather."
              limitations="This animation explains the physical mechanism only. It is not a real-time ocean measurement or a local rainfall forecast."
            />
          </div>
          <div id="teleconnection-map" />
          {oceanNotice}
          {enso && (
            <>
              <p>
                Latest saved <GlossaryTerm termKey="Niño 3.4" /> ocean reading:{' '}
                <strong className="heat">
                  {finite(enso.nino34) ? (enso.nino34 >= 0 ? '+' : '') + enso.nino34.toFixed(1) + ' °C' : 'not available'}
                </strong>{' '}
                compared with the usual sea-surface temperature, for the week dated {formatDate(enso.issuedAt)}.
              </p>
              <details>
                <summary>Technical details: NOAA ocean indices and sources</summary>
                <p>
                  The weekly <GlossaryTerm termKey="Niño 3.4" /> reading tracks surface temperatures in the central equatorial Pacific. The <GlossaryTerm termKey="ONI" label="Oceanic Niño Index (ONI)" /> averages three months:{' '}
                  {oni && finite(oni.anomaly)
                    ? oni.season + ' ' + oni.year + ', ' + (oni.anomaly >= 0 ? '+' : '') + oni.anomaly.toFixed(2) + ' °C'
                    : 'not available'}
                  . Neither index measures local rainfall at a farm or reservoir.
                </p>
                <p className="source-line">
                  <a href={safeURL(enso.url)}>NOAA weekly record ↗</a> ·{' '}
                  <a href={safeURL(enso.oniSource)}>NOAA three-month record ↗</a> · Retrieved {formatDate(enso.retrievedAt)}.{' '}
                  <a href="https://oceanservice.noaa.gov/facts/ninonina.html">NOAA: how El Niño works ↗</a>
                </p>
              </details>
            </>
          )}
        </article>

        <article className="story-section" id="why-it-matters">
          <p className="eyebrow">Chapter 2 · Why it matters</p>
          <h2>
            <span className="chapter-number">2</span>Rain connects ocean shifts to water, food, and homes
          </h2>
          <p>
            Shifting rain affects daily life on both sides of the Pacific. Yet local outcomes also depend on how people store water, irrigate crops, and manage floodplains.
          </p>
          <div className="impact-grid three">
            <div className="card">
              <h3>Water to share</h3>
              <p>Less rain can lower river inflows to reservoirs like Angat. Dam releases and city water demand also control how much water remains.</p>
            </div>
            <div className="card">
              <h3>Food to grow</h3>
              <p>Delayed rain can shift rice and corn planting dates. Canal irrigation, crop choice, and harvest schedules shape what satellites see on the ground.</p>
            </div>
            <div className="card">
              <h3>Places to live</h3>
              <p>Heavy rain can swell rivers in coastal Peru. Drainage canals, embankments, and floodplain settlement patterns shape local flood risk.</p>
            </div>
          </div>
          <p className="source-line">
            These are hypotheses to test. Satellite previews help us see where the surface changed, not prove the cause on their own.
          </p>
        </article>

        <article className="story-section radar-lead" id="reading-radar">
          <p className="eyebrow">Chapter 3 · Observing the surface day or night</p>
          <h2>
            <span className="chapter-number">3</span>See how the land looks on two different dates.
          </h2>
          <p className="large-copy">
            Radar sends a signal toward Earth and listens for the echo. It can observe the ground through clouds and at night.
          </p>
          <p>
            The <GlossaryTerm termKey="NISAR" /> satellite uses radar to observe land and water. Choose a study area below to compare an earlier image with a later one.
          </p>
          {evidenceNotice}
          <StoryPreviewPlayer active={active} sites={data.sites} />
          <p>
            The colors help us spot differences, but they do not tell us the cause. Rain, crops, and water management can all change what radar sees.
          </p>
          <details>
            <summary>Technical details: radar polarization, maturity, and processing</summary>
            <p>
              NISAR collects geocoded polarimetric covariance (<GlossaryTerm termKey="GCOV" />) data in horizontal (<GlossaryTerm termKey="polarization" label="HH / HV" />) channels and serves visual browse tiles through NASA <GlossaryTerm termKey="GIBS" />. Early mission scenes carry <GlossaryTerm termKey="provisional" label="Beta or Provisional" /> maturity and a processing version code (<GlossaryTerm termKey="CRID" />).
            </p>
            <p className="source-line">
              <a href="https://science.nasa.gov/mission/nisar/get-to-know-sar/">NASA: how radar images work ↗</a> ·{' '}
              <a href="https://science.nasa.gov/mission/nisar/">About the NASA–ISRO mission ↗</a>
            </p>
          </details>
        </article>

        <article className="story-section" id="site-evidence">
          <p className="eyebrow">Chapter 4 · From global patterns to local outcomes</p>
          <h2>
            <span className="chapter-number">4</span>One climate pattern. Different local outcomes.
          </h2>
          <p className="large-copy">
            El Niño shifts rainfall patterns, but places do not respond in the same way. Season, landscape, and water management shape what happens on the ground.
          </p>
          <dl className="story-outcomes">
            <div>
              <dt>Where rain decreases</dt>
              <dd>Water supplies and crops may face stress. Stored water and irrigation can change the outcome.</dd>
            </div>
            <div>
              <dt>Where rain increases</dt>
              <dd>Rivers may rise and soils may become wetter. Drainage and flood protection can change the outcome.</dd>
            </div>
            <div>
              <dt>Where the signal is unclear</dt>
              <dd>Local changes may have other causes. Missing observations leave the outcome unknown.</dd>
            </div>
          </dl>
          <p>
            These are possibilities to investigate, not measured impacts or a forecast. The same approach applies everywhere: compare dates, check local conditions, and test other explanations.
          </p>
          <p className="source-line">
            Our saved study sites are a sample, not worldwide coverage.
          </p>
          <a className="button secondary" href="#globe">Explore the global view</a>
        </article>

        <article className="story-section" id="future">
          <p className="eyebrow">Chapter 5 · From a picture to a better question</p>
          <h2>
            <span className="chapter-number">5</span>Follow the change, then test the explanation
          </h2>
          <ol className="method-steps">
            <li>
              <strong>Choose a place and compare dates.</strong> Look for a consistent pattern across multiple radar dates. A missing image means unknown, not unchanged.
            </li>
            <li>
              <strong>Add weather and vegetation context.</strong> Compare <GlossaryTerm termKey="ERA5" /> <GlossaryTerm termKey="reanalysis" /> rainfall with the 1991–2020 seasonal baseline and follow <GlossaryTerm termKey="MODIS" /> <GlossaryTerm termKey="greenness" />.
            </li>
            <li>
              <strong>Check human explanations.</strong> Planting, harvest, canal irrigation, and dam operations all alter surface water and vegetation. An El Niño link is a hypothesis to test, not an automatic cause.
            </li>
          </ol>
          <div className="button-row">
            <a className="button primary" href="#sites/angat">
              Compare a place over time →
            </a>
            <a className="button secondary" href="#globe">
              Explore the globe by date
            </a>
            <a className="text-link" href="#method">
              See the data and method
            </a>
          </div>
        </article>

        <article className="story-section reading-layout" id="local">
          <div>
            <p className="eyebrow">Chapter 6 · Life on the ground</p>
            <h2>
              <span className="chapter-number">6</span>Every place has a human story
            </h2>
          </div>
          <div>
            <p>
              A farmer’s planting schedule, a change in reservoir releases, or a local flood report helps explain what a satellite sees from orbit. Community knowledge belongs beside satellite data.
            </p>
            <details>
              <summary>Technical details: how community observations complement radar</summary>
              <p>
                When comparing local reports with satellite frames, record the exact place, date, what was observed on the ground, and the source. Local experience adds essential context; it does not by itself prove a regional climate trend.
              </p>
            </details>
          </div>
        </article>

        <WhereToNext
          stepNumber="Step 2 of 5 · Sites"
          nextHref="#sites/angat"
          nextLabel="Inspect Dated Radar at Study Sites"
          whyText="Step through all 57 saved NISAR radar frames at Angat, Central Luzon, Piura, and Dadu, or browse 34 global places alongside local weather and news."
          secondaryLinks={[
            { href: '#globe', label: 'Or open the 3D Globe →' },
            { href: '#method', label: 'See sources & method →' }
          ]}
        />
      </div>
    </section>
  );
}
