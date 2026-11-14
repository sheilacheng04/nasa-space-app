import { useEffect, useMemo, useState } from 'react';
import { initStory, setStoryActive } from '../story.js';
import { assetURL, finite, formatDate, safeURL } from '../core.js';
import { GlossaryTerm } from '../components/GlossaryTerm';
import { FigureCaption } from '../components/FigureCaption';
import { StoryPreviewPlayer } from '../components/StoryPreviewPlayer';
import { PlaceNewsPanel } from '../components/PlaceNewsPanel';
import { WhereToNext } from '../components/FirstVisitGuide';
import type { ReactNode } from 'react';
import type { Bootstrap } from '../types';

const CHAPTERS = [
  { id: 'ocean', num: '1', label: 'Pacific shift' },
  { id: 'why-it-matters', num: '2', label: 'Daily life' },
  { id: 'reading-radar', num: '3', label: 'How radar works' },
  { id: 'site-evidence', num: '4', label: 'Global & PH places' },
  { id: 'future', num: '5', label: 'Test the cause' },
  { id: 'local', num: '6', label: 'Human stories' }
];

const SITE_FRAME_COUNTS: Record<string, number> = {
  angat: 21,
  luzon: 20,
  dadu: 8,
  piura: 8
};

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
  const [selectedStoryPlaceId, setSelectedStoryPlaceId] = useState('angat');

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
  const places = data.places || [];
  const newsByPlace = data.newsByPlace;

  const philippinesPlaces = useMemo(
    () => places.filter((p) => p.countryCode === 'PH'),
    [places]
  );

  const regionalSummary = useMemo(() => {
    const map = new Map<
      string,
      { region: string; placesCount: number; radarSitesCount: number; savedFramesCount: number; headlinesCount: number; regimes: Set<string> }
    >();
    const headlineCountsByPlace = new Map<string, number>();
    for (const item of newsByPlace?.items || []) {
      headlineCountsByPlace.set(item.placeId, (headlineCountsByPlace.get(item.placeId) || 0) + 1);
    }
    for (const p of places) {
      const existing = map.get(p.region) || {
        region: p.region,
        placesCount: 0,
        radarSitesCount: 0,
        savedFramesCount: 0,
        headlinesCount: 0,
        regimes: new Set<string>()
      };
      existing.placesCount += 1;
      if (p.hasRadarFrames && p.siteId) {
        existing.radarSitesCount += 1;
        existing.savedFramesCount += SITE_FRAME_COUNTS[p.siteId] || 0;
      }
      existing.headlinesCount += headlineCountsByPlace.get(p.id) || 0;
      existing.regimes.add(p.regime);
      map.set(p.region, existing);
    }
    return [...map.values()];
  }, [places, newsByPlace]);

  const selectedStoryPlace = useMemo(
    () => places.find((p) => p.id === selectedStoryPlaceId) || places[0] || null,
    [places, selectedStoryPlaceId]
  );

  const chapterIndex = Math.max(0, CHAPTERS.findIndex((c) => c.id === activeChapter));
  const chapterProgressPct = Math.round(((chapterIndex + 1) / CHAPTERS.length) * 100);

  return (
    <section id="page-story" className="page" hidden={!active}>
      <div className="hero">
        <div className="wrap">
          <p className="eyebrow">NASA Space Apps 2026 · Dancing with the SARs · 57 Real Observations Across 4 Places</p>
          <h1>When the Pacific warms, what changes on land?</h1>
          <p className="page-purpose-line">
            <strong>What this page is for:</strong> Understand how Pacific ocean shifts connect to local rain, farms, and reservoirs, then inspect real satellite radar images before jumping to conclusions.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#sites/angat">
              Inspect dated radar at Angat →
            </a>
            <a className="button secondary" href="#globe">
              Explore the 3D Globe
            </a>
            <details className="more-actions-dropdown">
              <summary className="button secondary">More actions ▾</summary>
              <div className="more-actions-menu">
                <a href="#story/ocean">Start Chapter 1: Ocean shift</a>
                <a href="#philippines-focus">Jump to Philippines focus (6 places)</a>
                <a href="#overall-impact-summary">View overall regional data counts</a>
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
            <span className="chapter-number">3</span>Send a radar pulse. Read the echo. Compare dates.
          </h2>
          <p className="large-copy">
            Optical cameras cannot see through storm clouds or darkness. Synthetic aperture radar (<GlossaryTerm termKey="SAR" />) sends its own microwave pulses toward Earth and records the returning echo (<GlossaryTerm termKey="backscatter" />).
          </p>
          <p>
            <GlossaryTerm termKey="NISAR" /> is a joint satellite mission from NASA and the Indian Space Research Organisation (ISRO). It observes the same land and water areas every 12 days so we can compare dates through clouds and monsoon seasons.
          </p>
          {evidenceNotice}
          <StoryPreviewPlayer evidence={data.evidence} sites={data.sites} places={places} />
          <p>
            Smooth open water reflects radar pulses away from the satellite and looks dark. Rough soil, crop canopies, and buildings scatter energy back and look bright. Comparing dates and checking local weather (<GlossaryTerm termKey="ERA5" />) and <GlossaryTerm termKey="greenness" /> is essential.
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
          <div className="section-title">
            <div>
              <p className="eyebrow">Chapter 4 · 57 real observations across 4 radar sites &amp; 34 global places</p>
              <h2>
                <span className="chapter-number">4</span>Global places and a closer look at the Philippines
              </h2>
            </div>
            <div className="section-title-links">
              <a href="#sites/angat">Explore in Sites ↗</a>
              <a href="#globe">See on the Globe ↗</a>
            </div>
          </div>
          <p>
            We pair four sites that have saved dated NISAR radar sequences with {places.length || 34} study places across every continent affected by El Niño. Pakistan’s Dadu floodplain is included and clearly labeled as a 2022 La Niña reference case.
          </p>

          <div id="story-sites" className="evidence-list">
            {data.sites.map((site) => {
              const e = data.evidence?.find((ev) => ev.siteId === site.id);
              const frameCount = SITE_FRAME_COUNTS[site.id] || 0;
              return (
                <a className="evidence-row" href={'#sites/' + site.id} key={site.id}>
                  <figure>
                    {e?.image ? (
                      <img
                        src={assetURL(e.image)}
                        alt={'Real regional radar preview covering ' + site.name + '; not a calibrated measurement'}
                      />
                    ) : (
                      <span>Image not available</span>
                    )}
                    <figcaption>
                      {formatDate(e?.date)} · {frameCount} saved radar frames
                    </figcaption>
                  </figure>
                  <div>
                    <p className="eyebrow">
                      {site.country} · {site.id === 'dadu' ? 'La Niña 2022 reference' : site.id === 'piura' ? 'Wet-side hypothesis' : 'Dry-side hypothesis'}
                    </p>
                    <h3>
                      {site.name} <span aria-hidden="true">↗</span>
                    </h3>
                    <p>{site.question}</p>
                    <p className="source-line">
                      {frameCount} saved NASA GIBS frames.{' '}
                      {site.id === 'dadu'
                        ? 'The 2022 floods occurred during a triple-dip La Niña year and serve as a radar flood-detection test case, not an El Niño impact.'
                        : site.id === 'piura'
                        ? 'Seasonal timing and local rainfall need checking alongside river management.'
                        : 'Rainfall and human water management both need checking.'}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>

          <section id="philippines-focus" className="card philippines-focus-box" aria-labelledby="ph-focus-heading">
            <div className="section-title">
              <div>
                <p className="eyebrow">Regional Case Study · One example among many</p>
                <h3 id="ph-focus-heading">Focus on the Philippines: reservoirs and rice plains</h3>
              </div>
              <a className="button secondary" href="#globe?mode=satellite&site=angat&preset=philippines">
                Open Philippines preset on Globe →
              </a>
            </div>
            <p>
              In the western tropical Pacific, El Niño often brings below-average rainfall. Across the Philippines, that dry tendency tests both mountain reservoirs supplying cities and irrigated lowland rice bowls. Only Central Luzon and Angat have saved NISAR radar frames on disk; the other four Philippine places link directly to live ASF Vertex coverage search.
            </p>
            <div className="ph-places-grid">
              {philippinesPlaces.map((place) => {
                const w = place.bounds[0],
                  s = place.bounds[1],
                  e = place.bounds[2],
                  n = place.bounds[3];
                const vertexUrl = `https://search.asf.alaska.edu/#/?dataset=NISAR&polygon=${encodeURIComponent(
                  `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`
                )}`;
                return (
                  <div className="card ph-place-card" key={place.id}>
                    <p className="eyebrow">
                      {place.kind} · {place.hasRadarFrames ? `${SITE_FRAME_COUNTS[place.siteId!] || 20} saved radar frames` : 'No saved local frames'}
                    </p>
                    <h4>{place.name}</h4>
                    <p className="source-line">
                      {place.lat.toFixed(2)}°N, {place.lng.toFixed(2)}°E · Regime: {place.regime}
                    </p>
                    {place.hasRadarFrames ? (
                      <div className="ph-card-actions">
                        <a className="button primary" href={`#sites/${place.siteId}`}>
                          Play saved radar ({SITE_FRAME_COUNTS[place.siteId!]}) →
                        </a>
                        <a className="text-link" href={`#globe?mode=satellite&site=${place.siteId}`}>
                          See on Globe
                        </a>
                      </div>
                    ) : (
                      <div className="ph-card-actions">
                        <p className="no-radar-badge">Radar frames not saved for this place</p>
                        <a className="text-link" href={`#sites/${place.id}`}>
                          Inspect place &amp; local news →
                        </a>
                        <a className="text-link" href={vertexUrl} target="_blank" rel="noopener noreferrer">
                          Check NISAR on ASF Vertex ↗
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section id="overall-impact-summary" className="card regional-summary-box" aria-labelledby="overall-impact-heading">
            <div className="section-title">
              <div>
                <p className="eyebrow">Overall coverage by region · Real counts, not modeled colors</p>
                <h3 id="overall-impact-heading">Global study places, saved radar frames, and headlines by region</h3>
              </div>
              <a className="text-link" href="#media">
                Open Media dashboard →
              </a>
            </div>
            <p>
              This table summarizes our {places.length || 34} study places across six global regions using real counts of saved places, saved NISAR radar frames (57 total), and matched headlines from our 293-item news archive.
            </p>
            <div className="table-scroll" role="region" aria-label="Overall regional summary counts" tabIndex={0}>
              <table>
                <caption>Real counts of study places, saved NISAR radar frames, and matched headlines per region</caption>
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    <th scope="col">Typical El Niño tendency</th>
                    <th scope="col">Study places</th>
                    <th scope="col">Places with saved radar</th>
                    <th scope="col">Saved radar frames</th>
                    <th scope="col">Matched headlines</th>
                  </tr>
                </thead>
                <tbody>
                  {regionalSummary.map((row) => (
                    <tr key={row.region}>
                      <th scope="row">{row.region}</th>
                      <td>{[...row.regimes].join(', ')}</td>
                      <td>{row.placesCount}</td>
                      <td>{row.radarSitesCount}</td>
                      <td>{row.savedFramesCount}</td>
                      <td>{row.headlinesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="story-local-news-preview">
            <div className="story-place-picker-bar">
              <label htmlFor="story-place-select">
                <strong>Check local headlines for any study place:</strong>
              </label>
              <select
                id="story-place-select"
                value={selectedStoryPlaceId}
                onChange={(e) => setSelectedStoryPlaceId(e.target.value)}
              >
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.country} · {p.regime})
                  </option>
                ))}
              </select>
              {selectedStoryPlace && (
                <a className="text-link" href={`#sites/${selectedStoryPlace.id}`}>
                  Open {selectedStoryPlace.name} in Sites →
                </a>
              )}
            </div>
            <PlaceNewsPanel place={selectedStoryPlace} newsByPlace={newsByPlace} maxItems={3} compact />
          </div>
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
