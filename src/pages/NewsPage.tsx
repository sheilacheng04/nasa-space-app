import { useEffect, useMemo, useState } from 'react';
import { analyzeAI, errorMessage } from '../api/client';
import { finite, formatDate, localTone, safeURL } from '../core.js';
import { FigureCaption } from '../components/FigureCaption';
import { PlaceNewsPanel } from '../components/PlaceNewsPanel';
import { WhereToNext } from '../components/FirstVisitGuide';
import { GlossaryTerm } from '../components/GlossaryTerm';
import type { ReactNode } from 'react';
import type { Analysis, Headline, News, NewsByPlaceData, StudyPlace } from '../types';

function aiDescription(result: Analysis) {
  return 'AI tone: ' + result.score.toFixed(2) + '\n' + result.summary + '\n' + result.caveat;
}

function NewsItem({ item }: { item: Headline }) {
  const [result, setResult] = useState(item.ai ? aiDescription(item.ai) : 'Not scored by AI');
  const [busy, setBusy] = useState(false);
  async function analyze() {
    setBusy(true);
    setResult('Analyzing…');
    try {
      setResult(aiDescription(await analyzeAI(item.title)));
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="news-item">
      <div className="news-meta">
        <span>{formatDate(item.date)}</span>
        <span>{item.source}</span>
      </div>
      <div>
        <h3>
          <a href={safeURL(item.url)} target="_blank" rel="noopener">
            {item.title} ↗
          </a>
        </h3>
        <p className="tagline">
          {item.region || 'Unclassified'} / {item.theme || 'Climate'} ·{' '}
          {item.verification || 'Source review pending'}
        </p>
      </div>
      <div className="sentiment">
        Headline tone
        <strong>{finite(item.vader) ? item.vader.toFixed(2) : 'Pending'}</strong>
        {finite(item.vaderAdjusted) ? 'Adjusted tone: ' + item.vaderAdjusted.toFixed(2) : 'Not scored yet'}
        <br />
        <button className="text-link" data-ai-item={item.id} disabled={busy} onClick={analyze}>
          Explain headline tone
        </button>
        <p className="ai-result" role="status" aria-atomic="true">
          {result}
        </p>
      </div>
    </article>
  );
}

const SITE_FRAME_COUNTS: Record<string, number> = {
  angat: 21,
  luzon: 20,
  dadu: 8,
  piura: 8
};

export function NewsPage({
  active,
  news,
  places = [],
  newsByPlace,
  requestedPlaceId,
  notice
}: {
  active: boolean;
  news?: News;
  places?: StudyPlace[];
  newsByPlace?: NewsByPlaceData;
  requestedPlaceId?: string;
  notice: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('newest');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('angat');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (requestedPlaceId && places.some((p) => p.id === requestedPlaceId)) {
      setSelectedPlaceId(requestedPlaceId);
    }
  }, [requestedPlaceId, places]);

  const regions = useMemo(
    () => [...new Set((news?.items || []).map((n) => n.region).filter(Boolean))].sort(),
    [news]
  );

  const items = useMemo(
    () =>
      (news?.items || [])
        .filter(
          (n) =>
            (!region || n.region === region) &&
            (n.title + ' ' + n.source + ' ' + n.theme).toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) =>
          sort === 'tone'
            ? (a.vaderAdjusted ?? a.vader ?? 2) - (b.vaderAdjusted ?? b.vader ?? 2)
            : sort === 'oldest'
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date)
        ),
    [query, region, sort, news]
  );

  const toneBreakdown = useMemo(() => {
    const list = news?.items || [];
    let neg = 0,
      neu = 0,
      pos = 0;
    for (const item of list) {
      const score = item.vaderAdjusted ?? item.vader ?? 0;
      if (score <= -0.05) neg++;
      else if (score >= 0.05) pos++;
      else neu++;
    }
    const total = Math.max(1, list.length);
    return {
      neg,
      neu,
      pos,
      negPct: Math.round((neg / total) * 100),
      neuPct: Math.round((neu / total) * 100),
      posPct: Math.max(0, 100 - Math.round((neg / total) * 100) - Math.round((neu / total) * 100))
    };
  }, [news]);

  const regionalDashboard = useMemo(() => {
    const map = new Map<
      string,
      { region: string; placesCount: number; radarFrames: number; matchedHeadlines: number; countries: Set<string> }
    >();
    const countsByPlace = new Map<string, number>();
    for (const m of newsByPlace?.items || []) {
      countsByPlace.set(m.placeId, (countsByPlace.get(m.placeId) || 0) + 1);
    }
    for (const p of places) {
      const row = map.get(p.region) || {
        region: p.region,
        placesCount: 0,
        radarFrames: 0,
        matchedHeadlines: 0,
        countries: new Set<string>()
      };
      row.placesCount += 1;
      if (p.hasRadarFrames && p.siteId) {
        row.radarFrames += SITE_FRAME_COUNTS[p.siteId] || 0;
      }
      row.matchedHeadlines += countsByPlace.get(p.id) || 0;
      row.countries.add(p.country);
      map.set(p.region, row);
    }
    return [...map.values()];
  }, [places, newsByPlace]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) || places[0] || null,
    [places, selectedPlaceId]
  );

  async function analyze(ai: boolean) {
    if (!text.trim()) {
      setOutput('Enter some text first.');
      return;
    }
    if (!ai) {
      const result = localTone(text);
      setOutput(
        result.method +
          ': ' +
          result.score.toFixed(2) +
          ' (−1 to +1).\n' +
          result.negative +
          ' risk words and ' +
          result.positive +
          ' recovery words.\nThis simple count misses context, negation and irony. It is not a measure of scientific confidence.'
      );
      return;
    }
    setBusy(true);
    setOutput('Requesting an AI reading…');
    try {
      setOutput(aiDescription(await analyzeAI(text)));
    } catch (error) {
      setOutput(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="page-news" className="page" hidden={!active}>
      <div className="wrap page-intro">
        <p className="eyebrow">Step 4 · People, places and reporting · 293 saved headlines</p>
        <h1>The human side of a changing climate</h1>
        <p className="page-purpose-line">
          <strong>What this page is for:</strong> Explore how water, farming, and climate stories are reported across regions and individual study places, while separating headline wording tone from physical event severity.
        </p>

      </div>

      <div className="wrap">
        {notice}
        {news && (
          <>
            <section id="media-dashboard" className="media-dashboard" aria-label="Media and regional overview dashboard" data-testid="media-dashboard">
              <div className="media-kpi-grid">
                <div className="card media-kpi-card">
                  <p className="eyebrow">Saved Archive</p>
                  <strong className="kpi-value">{news.items.length}</strong>
                  <p className="source-line">Source-linked headlines across {regions.length} countries &amp; tags</p>
                </div>
                <div className="card media-kpi-card">
                  <p className="eyebrow">Global Study Places</p>
                  <strong className="kpi-value">{places.length || 34}</strong>
                  <p className="source-line">57 real <GlossaryTerm termKey="NISAR" /> radar frames saved across 4 sites</p>
                </div>
                <div className="card media-kpi-card">
                  <p className="eyebrow">Place-Matched Links</p>
                  <strong className="kpi-value">{newsByPlace?.items.length || 494}</strong>
                  <p className="source-line">Matched by place name, basin query, or country</p>
                </div>
                <div className="card media-kpi-card">
                  <p className="eyebrow">Wording Tone Split</p>
                  <strong className="kpi-value">
                    {toneBreakdown.negPct}% / {toneBreakdown.neuPct}% / {toneBreakdown.posPct}%
                  </strong>
                  <p className="source-line">Negative / Neutral / Positive headline phrasing</p>
                </div>
              </div>

              <div className="card media-tone-bar-card">
                <h3>Headline wording tone distribution (not physical severity)</h3>
                <div className="tone-bar-visual" role="img" aria-label={`Headline tone split: ${toneBreakdown.neg} negative, ${toneBreakdown.neu} neutral, ${toneBreakdown.pos} positive`}>
                  <div className="tone-seg tone-neg-seg" style={{ width: `${toneBreakdown.negPct}%` }} title={`Negative wording: ${toneBreakdown.neg}`} />
                  <div className="tone-seg tone-neu-seg" style={{ width: `${toneBreakdown.neuPct}%` }} title={`Neutral wording: ${toneBreakdown.neu}`} />
                  <div className="tone-seg tone-pos-seg" style={{ width: `${toneBreakdown.posPct}%` }} title={`Positive wording: ${toneBreakdown.pos}`} />
                </div>
                <div className="tone-bar-legend">
                  <span>Negative wording: <strong>{toneBreakdown.neg}</strong> ({toneBreakdown.negPct}%)</span>
                  <span>Neutral wording: <strong>{toneBreakdown.neu}</strong> ({toneBreakdown.neuPct}%)</span>
                  <span>Positive wording: <strong>{toneBreakdown.pos}</strong> ({toneBreakdown.posPct}%)</span>
                </div>
                <FigureCaption
                  whatWhere="Distribution of VADER wording tone scores across all 293 saved climate and water headlines."
                  dateSource={`Retrieved ${formatDate(news.retrievedAt)} · Source: Supplied 43-item archive + GDELT DOC 2.0 snapshot.`}
                  howToRead="Scores below -0.05 indicate alarm or risk phrasing; scores above +0.05 indicate recovery or solution phrasing; scores near zero indicate neutral phrasing."
                  limitations="Tone scores measure only the words in a headline. They do not measure flood depth, drought severity, crop loss, or whether a claim is verified."
                />
              </div>

              {regionalDashboard.length > 0 && (
                <div className="card media-regional-cards">
                  <div className="section-title">
                    <div>
                      <p className="eyebrow">Overall coverage by region</p>
                      <h3>Regional study places, saved radar frames, and headlines</h3>
                    </div>
                    {region && (
                      <button type="button" className="button secondary" onClick={() => setRegion('')}>
                        Clear country filter ({region}) ×
                      </button>
                    )}
                  </div>
                  <div className="regional-cards-grid">
                    {regionalDashboard.map((row) => (
                      <div key={row.region} className="card regional-mini-card">
                        <h4>{row.region}</h4>
                        <ul className="regional-stats-list">
                          <li><strong>{row.placesCount}</strong> study places</li>
                          <li><strong>{row.radarFrames}</strong> saved radar frames</li>
                          <li><strong>{row.matchedHeadlines}</strong> matched place headlines</li>
                        </ul>
                        <div className="regional-country-chips">
                          {[...row.countries].map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`chip-btn ${region === c ? 'is-active' : ''}`}
                              onClick={() => setRegion((prev) => (prev === c ? '' : c))}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div id="media-place-news" className="media-place-news-section">
                <div className="story-place-picker-bar">
                  <label htmlFor="media-place-select">
                    <strong>Inspect local headlines for a specific study place:</strong>
                  </label>
                  <select
                    id="media-place-select"
                    value={selectedPlace?.id || 'angat'}
                    onChange={(e) => setSelectedPlaceId(e.target.value)}
                  >
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.country} · {p.regime})
                      </option>
                    ))}
                  </select>
                  {selectedPlace && (
                    <a className="text-link" href={`#sites/${selectedPlace.siteId || selectedPlace.id}`}>
                      Open {selectedPlace.name} in Sites →
                    </a>
                  )}
                </div>
                <PlaceNewsPanel place={selectedPlace} newsByPlace={newsByPlace} maxItems={6} />
              </div>
            </section>

            <div className="news-toolbar">
              <label>
                Search headlines
                <input
                  type="search"
                  id="news-search"
                  placeholder="Rainfall, farming, water..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                Region
                <select id="news-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">All regions</option>
                  {regions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select id="news-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="tone">Most negative wording first</option>
                </select>
              </label>
            </div>
            <p id="news-status" className="source-line">
              {items.length} of {news.items.length} headlines ·{' '}
              {news.status === 'archive'
                ? 'Supplied archive; links and reported claims need review.'
                : 'GDELT headline snapshot; source claims are not independently verified.'}{' '}
              {news.retrievedAt && 'Retrieved ' + formatDate(news.retrievedAt) + '.'} VADER is a text-scoring method: -1 is more negative wording, +1 more positive. It does not measure public opinion.
            </p>
            <div id="news-list">
              {items.length ? (
                items.map((n) => <NewsItem key={n.id} item={n} />)
              ) : (
                <p className="empty-chart">No headlines match these filters.</p>
              )}
            </div>
          </>
        )}

        <section className="analysis-lab">
          <div>
            <p className="eyebrow">A closer reading</p>
            <h2>What does this headline sound like?</h2>
            <p>
              Compare a simple count of positive and negative words with an optional AI explanation. Both can miss context, irony and the difference between a warning and a confirmed event.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="analysis-text">
              Text to analyze
            </label>
            <textarea
              id="analysis-text"
              maxLength={4000}
              placeholder="Paste a short news excerpt or headline…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="button-row">
              <button className="button primary" id="analyze-local" onClick={() => void analyze(false)}>
                Count tone words
              </button>
              <button className="button secondary" id="analyze-ai" disabled={busy} onClick={() => void analyze(true)}>
                Explain the tone
              </button>
            </div>
            <p className="source-line">
              Without a connected AI service, the explanation is a clearly labeled local simulation. Treat it as a reading aid and check the original article.
            </p>
            <div id="analysis-output" role="status">
              {output}
            </div>
          </div>
        </section>

        <WhereToNext
          stepNumber="Step 5 of 5 · Data and method"
          nextHref="#method"
          nextLabel="Review Data Sources, Glossary & Scientific Method"
          whyText="See how each satellite, climate record, and news source is validated, what it can and cannot prove, and download the full source ledgers."
          secondaryLinks={[
            { href: '#sites/angat', label: 'Inspect radar in Sites →' },
            { href: '#globe', label: 'Open the 3D Globe →' }
          ]}
        />
      </div>
    </section>
  );
}
