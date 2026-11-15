import { formatDate, safeURL } from '../core.js';
import type { NewsByPlaceData, StudyPlace } from '../types';

function toneBadge(score: number): { label: string; className: string } {
  if (score >= 0.05) return { label: `Positive wording (+${score.toFixed(2)})`, className: 'tone-pos' };
  if (score <= -0.05) return { label: `Negative wording (${score.toFixed(2)})`, className: 'tone-neg' };
  return { label: `Neutral wording (${score.toFixed(2)})`, className: 'tone-neu' };
}

function matchLabel(matchedBy: 'place-name' | 'country' | 'query'): string {
  if (matchedBy === 'place-name') return 'Matched by place name in title';
  if (matchedBy === 'query') return 'Matched by local basin/topic term';
  return 'Matched by country tag';
}

export function PlaceNewsPanel({
  place,
  newsByPlace,
  maxItems = 5,
  compact = false
}: {
  place: StudyPlace | null | undefined;
  newsByPlace?: NewsByPlaceData;
  maxItems?: number;
  compact?: boolean;
}) {
  if (!place) {
    return (
      <section className="place-news-panel card" aria-label="Local news for selected place">
        <h3>Local news</h3>
        <p className="source-line">Pick a place on the map or list to view saved headlines matched to that location.</p>
      </section>
    );
  }

  const allMatches = (newsByPlace?.items || []).filter((item) => item.placeId === place.id);
  const shown = allMatches.slice(0, maxItems);

  return (
    <section className="place-news-panel card" data-testid="place-news-panel" data-place-id={place.id} aria-label={`News about ${place.name}`}>
      <div className="place-news-head">
        <div>
          <p className="eyebrow">Local headline archive · {place.country}</p>
          <h3>News about {place.name}</h3>
        </div>
        <span className="badge">{allMatches.length} saved {allMatches.length === 1 ? 'headline' : 'headlines'}</span>
      </div>
      <p className="source-line">
        Wording tone scores measure headline phrasing only, not physical flood, drought, or crop severity. Titles and links only.
      </p>

      {shown.length > 0 ? (
        <ul className="place-news-list">
          {shown.map((item) => {
            const tone = toneBadge(item.tone?.vaderAdjusted ?? 0);
            return (
              <li key={item.id} className="place-news-item">
                <div className="place-news-meta">
                  <span>{formatDate(item.date)}</span>
                  <span>·</span>
                  <span>{item.source}</span>
                  <span>·</span>
                  <span className="match-pill">{matchLabel(item.matchedBy)}</span>
                  <span className={`tone-pill ${tone.className}`}>{tone.label}</span>
                </div>
                <a href={safeURL(item.url)} target="_blank" rel="noopener noreferrer" className="place-news-title">
                  {item.title} <span aria-hidden="true">↗</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="place-news-empty" role="status">
          <p><strong>No saved headlines for this place yet.</strong></p>
          <p className="source-line">
            Our saved headline archive has no matches for {place.name} ({place.country}) yet. Never substituting global headlines as local news.
          </p>
        </div>
      )}

      <div className="place-news-actions">
        <button
          type="button"
          className="button secondary"
          disabled
          aria-disabled="true"
          title="Live GDELT & RSS place search hook — enabled in Prompt 2"
        >
          Search live (coming next)
        </button>
        {!compact && allMatches.length > maxItems && (
          <a className="text-link" href={`#media?place=${encodeURIComponent(place.id)}`}>
            See all {allMatches.length} headlines for {place.name} on Media →
          </a>
        )}
      </div>
    </section>
  );
}
