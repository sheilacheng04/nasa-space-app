import type { SiteSelection, HistoryMode } from '../selection-url.js';
import { useEffect, useMemo, useState } from 'react';
import { dataFile } from '../api/client';
import { RadarEvidence } from '../components/RadarEvidence';
import { knownMetadata, footprintOverlap, coverageExplanation } from '../radar-data.js';
import { weatherChart } from '../charts.js';
import { weatherRows, weatherDomain } from '../weather-data.js';
import type { ClimateContext } from '../concept-data';
import '../weather.css';
import { Markup } from '../components/Markup';
import { formatDate } from '../core.js';
import { GlossaryTerm } from '../components/GlossaryTerm';
import { FigureCaption } from '../components/FigureCaption';
import { PlaceNewsPanel } from '../components/PlaceNewsPanel';
import { WhereToNext } from '../components/FirstVisitGuide';
import type { NewsByPlaceData, Site, StudyPlace } from '../types';

export function SitesPage({
  active,
  site,
  sites,
  places = [],
  newsByPlace,
  requestedPlaceId,
  selection,
  onSelection,
  navigationKey
}: {
  active: boolean;
  site: Site;
  sites: Site[];
  places?: StudyPlace[];
  newsByPlace?: NewsByPlaceData;
  requestedPlaceId?: string;
  selection: SiteSelection;
  onSelection: (siteId: string, selection: SiteSelection, mode?: HistoryMode) => void;
  navigationKey: number;
}) {
  const [evidenceRecord, setEvidence] = useState<any>(null);
  const [error, setError] = useState('');
  const [year, setYear] = useState(2026);
  const [evidenceAttempt, setEvidenceAttempt] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(site.id);

  useEffect(() => {
    if (requestedPlaceId && places.some((p) => p.id === requestedPlaceId)) {
      setSelectedPlaceId(requestedPlaceId);
    } else {
      setSelectedPlaceId(site.id);
    }
  }, [site.id, requestedPlaceId, places]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    setEvidence(null);
    setError('');
    dataFile('sites/' + site.id + '/evidence.json', { reload: evidenceAttempt > 0 })
      .then((value) => {
        if (live) setEvidence(value);
      })
      .catch(() => {
        if (live)
          setError(
            'The saved radar evidence could not load. Weather and other site information remain available.'
          );
      });
    return () => {
      live = false;
    };
  }, [active, site.id, evidenceAttempt]);

  const evidence = evidenceRecord?.siteId === site.id ? evidenceRecord : null;
  const [mapOpen, setMapOpen] = useState(false);
  const [weatherAttempt, setWeatherAttempt] = useState(0);
  const [weather, setWeather] = useState<{
    siteId: string;
    state: 'loading' | 'error' | 'ready';
    data: ClimateContext | null;
  }>({ siteId: '', state: 'loading', data: null });

  useEffect(() => {
    if (!active) return;
    let live = true;
    setWeather({ siteId: site.id, state: 'loading', data: null });
    dataFile<ClimateContext>('context/' + site.id + '.json')
      .then((value) => {
        if (!value || !Array.isArray(value.monthly) || !Array.isArray(value.baselineMonthly))
          throw new Error('Invalid weather record');
        if (live) setWeather({ siteId: site.id, state: 'ready', data: value });
      })
      .catch(() => {
        if (live) setWeather({ siteId: site.id, state: 'error', data: null });
      });
    return () => {
      live = false;
    };
  }, [active, site.id, weatherAttempt]);

  const weatherState = weather.siteId === site.id ? weather.state : 'loading';
  const climate = weatherState === 'ready' ? weather.data : null;
  const rain = weatherRows(climate, year, 'rain');
  const temperature = weatherRows(climate, year, 'temperature');
  const observedCount =
    rain.filter((r) => r.observed !== null).length +
    temperature.filter((r) => r.observed !== null).length;
  const signed = (v: number | null, unit: string) =>
    v === null ? 'Not available' : (v > 0 ? '+' : '') + v.toFixed(2) + ' ' + unit;
  const monthName = (number: number) =>
    new Date(Date.UTC(2026, number - 1, 1)).toLocaleDateString('en', {
      month: 'short',
      timeZone: 'UTC'
    });

  const activePlace: StudyPlace | null = useMemo(() => {
    return (
      places.find((p) => p.id === selectedPlaceId) ||
      places.find((p) => p.siteId === site.id || p.id === site.id) ||
      null
    );
  }, [places, selectedPlaceId, site.id]);

  const latestFrameDate =
    selection.date ||
    selection.after ||
    evidence?.gibs?.frames?.filter((f: any) => f.image).at(-1)?.date ||
    '2026-10-09';

  const vertexUrlForPlace = (p: StudyPlace) => {
    const [w, s, e, n] = p.bounds;
    const poly = `POLYGON((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
    return `https://search.asf.alaska.edu/#/?dataset=NISAR&polygon=${encodeURIComponent(poly)}`;
  };

  return (
    <section id="page-sites" className="page" hidden={!active}>
      <div className="wrap page-intro">
        <nav className="sites-breadcrumb" aria-label="Breadcrumb" data-testid="sites-breadcrumb">
          <a href="#sites">Sites</a>
          <span aria-hidden="true">›</span>
          <strong>{activePlace ? `${activePlace.name} (${activePlace.country})` : `${site.name} (${site.country})`}</strong>
          <span aria-hidden="true">›</span>
          <span className="mono">{latestFrameDate}</span>
        </nav>

        <p className="eyebrow">Step 2 · Local radar evidence · 57 saved observations across 4 radar sites</p>
        <p className="page-purpose-line">
          <strong>What this page is for:</strong> Compare real dated <GlossaryTerm termKey="NISAR" /> <GlossaryTerm termKey="SAR" /> radar images, local <GlossaryTerm termKey="ERA5" /> weather departures, and local news for a single place before drawing conclusions.
        </p>

        <div className="section-title">
          <h1>{site.question}</h1>
          <div className="site-pickers-group">
            <label className="site-picker">
              Choose a place
              <select
                id="site-select"
                value={site.id}
                onChange={(e) => {
                  setSelectedPlaceId(e.target.value);
                  onSelection(e.target.value, {});
                }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} / {s.country}
                  </option>
                ))}
              </select>
            </label>
            {places.length > 0 && (
              <label className="site-picker global-place-picker">
                All {places.length} global study places
                <select
                  id="global-place-select"
                  aria-label="Browse all 34 global study places"
                  value={activePlace?.id || site.id}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedPlaceId(pid);
                    const found = places.find((p) => p.id === pid);
                    if (found?.hasRadarFrames && found.siteId) {
                      onSelection(found.siteId, {});
                    }
                  }}
                >
                  <optgroup label="Saved NISAR radar sites (4 places)">
                    {places
                      .filter((p) => p.hasRadarFrames)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          ★ {p.name} ({p.country} · saved radar)
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Philippines focus (additional places)">
                    {places
                      .filter((p) => !p.hasRadarFrames && p.countryCode === 'PH')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Philippines · {p.kind})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Global dry-side, wet-side &amp; mixed places">
                    {places
                      .filter((p) => !p.hasRadarFrames && p.countryCode !== 'PH')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.country} · {p.regime})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="cross-page-links" role="navigation" aria-label="Cross-page links for this place">
          <a
            className="button primary"
            href={`#globe?mode=satellite&site=${site.id}&date=${encodeURIComponent(latestFrameDate.slice(0, 10))}`}
          >
            See this place on the globe →
          </a>
          <a className="button secondary" href="#method">
            See its sources
          </a>
          <a className="button secondary" href="#story">
            ← Back to the story
          </a>
        </div>

        {activePlace && !activePlace.hasRadarFrames && (
          <div className="card no-saved-radar-banner" role="status" data-testid="no-saved-radar-banner">
            <p className="eyebrow">
              Global Place Selected · {activePlace.region} · Regime: {activePlace.regime}
            </p>
            <h2>{activePlace.name}, {activePlace.country}</h2>
            <p>
              <strong>Radar frames not saved for this place.</strong> No placeholder or substitute images are shown. You can search live NISAR granules for {activePlace.name} ({activePlace.lat.toFixed(2)}°, {activePlace.lng.toFixed(2)}°) directly on NASA/ASF Vertex, or inspect its saved local news below while viewing {site.name}’s radar player as a reference.
            </p>
            <div className="button-row">
              <a
                className="button primary"
                href={vertexUrlForPlace(activePlace)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Check NISAR coverage on ASF Vertex ↗
              </a>
              <button
                type="button"
                className="button secondary"
                onClick={() => setSelectedPlaceId(site.id)}
              >
                Return to {site.name} saved radar
              </button>
            </div>
          </div>
        )}

        <p className="dek">{site.description}</p>
        <p>
          <strong>{site.name}, {site.country}.</strong> Press Play to follow real satellite images through time. Each image shows the same area on a different date.
        </p>
        <p className="source-line">
          <GlossaryTerm termKey="NISAR" /> sends microwave pulses toward Earth and records their echoes (<GlossaryTerm termKey="backscatter" />). These colors describe radar reflections, not what the landscape looks like to our eyes.{' '}
          <a href="#story/reading-radar">Meet radar in one minute</a>
        </p>
      </div>

      <div className="wrap site-body">
        {error ? (
          <div className="error-message">
            <p role="alert">{error}</p>
            <button id="retry-site-evidence" onClick={() => setEvidenceAttempt((n) => n + 1)}>
              Retry radar evidence
            </button>
          </div>
        ) : evidence ? (
          <RadarEvidence
            key={site.id}
            active={active}
            site={site}
            evidence={evidence}
            selection={selection}
            onSelection={onSelection}
            navigationKey={navigationKey}
            mapOpen={mapOpen}
            setMapOpen={setMapOpen}
          />
        ) : (
          <p role="status">Loading dated satellite images...</p>
        )}

        <section className="story-section hypothesis">
          <p className="eyebrow">Step-by-step interpretation · Separate observations from hypotheses</p>
          <h2>What could explain what we see?</h2>
          <dl>
            <dt>1. Start with the radar observation</dt>
            <dd>
              Look for a pattern that persists across multiple dates. A changing color may reflect open water, crop canopy growth, soil roughness, or viewing geometry (<GlossaryTerm termKey="polarization" label="HH/HV polarization" />). We have not measured calibrated water volume or crop loss here.
            </dd>
            <dt>2. A climate hypothesis to test</dt>
            <dd>{site.hypothesis}</dd>
            <dt>3. Human and seasonal drivers to check</dt>
            <dd>{site.humanDrivers}</dd>
            <dt>4. What would disprove the hypothesis?</dt>
            <dd>{site.disprove}</dd>
            <dt>5. Compare with independent local records</dt>
            <dd>
              Compare the radar images with local <GlossaryTerm termKey="ERA5" /> rainfall, reservoir gauges, and news reports below. One season of radar previews does not prove that El Niño caused a local change.
            </dd>
          </dl>
          {site.id === 'dadu' && (
            <p className="method-note">
              The 2022 Pakistan floods occurred during La Niña. The images here are from 2026; they are not a replay of that flood or proof of an El Niño impact.
            </p>
          )}
        </section>

        <section className="story-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Put the radar images in weather context</p>
              <h2>Was it wetter or drier than usual?</h2>
            </div>
            <label>
              Year
              <select id="weather-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </label>
          </div>
          <p>
            Weather context helps us ask why a landscape might change. Here, <strong>usual</strong> means the 1991–2020 average for the same calendar month from <GlossaryTerm termKey="ERA5" /> <GlossaryTerm termKey="reanalysis" />: compare July with July, not with January. Incomplete months stay blank.
          </p>
          <div id="site-weather" data-weather-site={site.id} data-weather-state={weatherState} aria-busy={weatherState === 'loading'}>
            {weatherState === 'loading' ? (
              <p role="status">Loading saved weather for {site.name}...</p>
            ) : weatherState === 'error' ? (
              <div className="weather-message">
                <p role="alert">
                  Saved weather for {site.name} could not be loaded. The radar images and other site information remain available.
                </p>
                <button className="button secondary" id="retry-weather" onClick={() => setWeatherAttempt((n) => n + 1)}>
                  Retry weather
                </button>
              </div>
            ) : (
              <>
                <p className="source-line">
                  Source: ERA5, which combines weather observations with a computer model to estimate past conditions. These estimates are for the site center; they are separate from the radar images. Retrieved {formatDate(climate?.retrievedAt)}.
                </p>
                {!observedCount && (
                  <p className="weather-message" role="status">
                    No complete monthly weather observations are available for {year}. Incomplete months and unavailable observations are marked below; historical averages are shown where available.
                  </p>
                )}
                <div className="chart-grid">
                  <section>
                    <h3>Rainfall each month / {year}</h3>
                    <Markup
                      html={weatherChart(rain, {
                        label: 'Rainfall',
                        unit: 'mm/month',
                        bars: true,
                        domain: weatherDomain(climate, 'rain'),
                        annotation: 'Source: Open-Meteo / ERA5. Complete months only. Chart: team.'
                      })}
                    />
                  </section>
                  <section>
                    <h3>Temperature each month / {year}</h3>
                    <Markup
                      html={weatherChart(temperature, {
                        label: 'Monthly temperature',
                        unit: '°C',
                        color: 'var(--orange)',
                        domain: weatherDomain(climate, 'temperature'),
                        annotation: 'Average of daily high/low midpoints, including the historical baseline. Source: ERA5; not a local thermometer. Chart: team.'
                      })}
                    />
                  </section>
                </div>
                <FigureCaption
                  whatWhere={<>Monthly rainfall (mm) and mean temperature (°C) at <strong>{site.name}</strong> compared with the 1991–2020 calendar-month baseline.</>}
                  dateSource={<>Year {year} · Source: ECMWF ERA5 climate reanalysis via Open-Meteo (retrieved {formatDate(climate?.retrievedAt)}).</>}
                  howToRead="Solid bars/lines show the selected year's monthly estimate; the dashed reference shows the 1991–2020 average for that same calendar month. Hatched slots mark incomplete or future months."
                  limitations="ERA5 estimates regional grid-cell weather at the site center, not a local rain gauge at a specific dam or farm field."
                />
                <div className="rain-departures">
                  <h3>Rainfall compared with usual / {year}</h3>
                  <p>
                    Departure = observed estimate minus the historical average for the same calendar month. Positive means more rain; negative means less.
                  </p>
                  {rain.map((m) => (
                    <span
                      key={m.date}
                      style={{
                        borderBottomColor:
                          m.anomaly === null ? 'var(--muted)' : m.anomaly < 0 ? '#8c510a' : '#01665e'
                      }}
                    >
                      <span>{monthName(m.month)}</span>
                      <strong>{signed(m.anomaly, 'mm')}</strong>
                      {m.anomaly === null && (
                        <small>{m.status === 'Complete month' ? 'Comparison unavailable' : m.status}</small>
                      )}
                    </span>
                  ))}
                  <p className="source-line">
                    Brown: drier. Teal: wetter. Millimeters (mm) describe the depth of rain over a flat surface. {rain.filter((m) => m.anomaly !== null).length} complete monthly comparisons. Source: ERA5.
                  </p>
                </div>
                <div className="rain-departures temperature-departures">
                  <h3>Temperature compared with usual / {year}</h3>
                  <p>
                    Positive means warmer than the historical average; negative means cooler. Departures describe differences, not statistical significance or an El Niño cause.
                  </p>
                  {temperature.map((m) => (
                    <span key={m.date}>
                      <span>{monthName(m.month)}</span>
                      <strong>{signed(m.anomaly, '°C')}</strong>
                      {m.anomaly === null && (
                        <small>{m.status === 'Complete month' ? 'Comparison unavailable' : m.status}</small>
                      )}
                    </span>
                  ))}
                </div>
                <details>
                  <summary>See the weather values and the long-term average</summary>
                  <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
                    <table>
                      <caption>
                        ERA5 monthly estimates and same-month 1991–2020 averages. Incomplete observations are not displayed.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Month</th>
                          <th scope="col">2026 rain (mm)</th>
                          <th scope="col">2025 rain (mm)</th>
                          <th scope="col">Usual rain (mm)</th>
                          <th scope="col">2026 temperature (°C)</th>
                          <th scope="col">2025 temperature (°C)</th>
                          <th scope="col">Usual temperature (°C)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 12 }, (_, i) => {
                          const r26 = weatherRows(climate, 2026, 'rain')[i];
                          const r25 = weatherRows(climate, 2025, 'rain')[i];
                          const t26 = weatherRows(climate, 2026, 'temperature')[i];
                          const t25 = weatherRows(climate, 2025, 'temperature')[i];
                          const fmt = (row: typeof r26) =>
                            row.observed === null ? row.status : row.observed.toFixed(2);
                          const base = (v: number | null) => (v === null ? 'not available' : v.toFixed(2));
                          return (
                            <tr key={i}>
                              <th scope="row">{monthName(i + 1)}</th>
                              <td>{fmt(r26)}</td>
                              <td>{fmt(r25)}</td>
                              <td>{base(r26.baseline)}</td>
                              <td>{fmt(t26)}</td>
                              <td>{fmt(t25)}</td>
                              <td>{base(t26.baseline)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </div>
        </section>

        <section className="story-section" id="site-local-news">
          <PlaceNewsPanel place={activePlace} newsByPlace={newsByPlace} maxItems={5} />
        </section>

        <section className="story-section">
          <h2>Follow the evidence further</h2>
          <p>
            Explore the broader vegetation record on the Globe, or read how we keep observations, explanations and unknowns separate.
          </p>
          <div className="hero-actions">
            <a
              className="button secondary"
              href={`#globe?mode=satellite&site=${site.id}&date=${encodeURIComponent(latestFrameDate.slice(0, 10))}`}
            >
              Explore land through time
            </a>
            <a className="button secondary" href="#method">
              How we know
            </a>
          </div>
          <details>
            <summary>Image dates and technical records</summary>
            <p>
              {Number.isFinite(evidence?.inventory?.n)
                ? 'The catalog contains ' +
                  evidence.inventory.n +
                  ' satellite scenes, including overlapping views and processing versions.'
                : 'The catalog scene count is not available.'}{' '}
              That count is not the number of independent measurements. Track/frame identifies a viewing path; <GlossaryTerm termKey="provisional" label="maturity" /> describes review status; <GlossaryTerm termKey="CRID" /> identifies the processing version.
            </p>
            <p>{coverageExplanation}</p>
            <p>
              Measured site-change series:{' '}
              {Number.isFinite(evidence?.series?.n)
                ? evidence.series.n + ' observations'
                : 'observation count not available'}
              . No quantitative water-area estimate is substituted for missing measurements.
            </p>
            <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
              <table>
                <caption>Saved radar acquisition catalog and geometric study-box overlap</caption>
                <thead>
                  <tr>
                    <th scope="col">Image date (UTC)</th>
                    <th scope="col">Track / frame</th>
                    <th scope="col">Review status</th>
                    <th scope="col">Processing version</th>
                    <th scope="col">Geometric overlap of study box</th>
                    <th scope="col">Planned path</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence?.inventory?.scenes?.map((s: any) => (
                    <tr key={s.id}>
                      <th scope="row">
                        <a href={s.sourceUrl}>{s.date.slice(0, 10)}</a>
                      </th>
                      <td className="mono">
                        {knownMetadata(s.track) || 'not available'} / {knownMetadata(s.frame) || 'not available'}
                      </td>
                      <td>{knownMetadata(s.maturity) || 'not available'}</td>
                      <td className="mono">{knownMetadata(s.crid) || 'not available'}</td>
                      <td>{footprintOverlap(s.bboxCoverageFraction)}</td>
                      <td>{s.matchesObservationPlan ? 'Track/frame match' : 'not available'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <WhereToNext
          stepNumber="Step 3 of 5 · Globe"
          nextHref={`#globe?mode=satellite&site=${site.id}&date=${encodeURIComponent(latestFrameDate.slice(0, 10))}`}
          nextLabel="See This Place and Date on the 3D Globe"
          whyText="Compare global NISAR radar swaths, monthly MODIS vegetation greenness, and the Philippines focus preset on an interactive 3D Earth."
          secondaryLinks={[
            { href: `#media?place=${activePlace?.id || site.id}`, label: 'See local news on Media →' },
            { href: '#story', label: '← Back to Story' }
          ]}
        />
      </div>
    </section>
  );
}
