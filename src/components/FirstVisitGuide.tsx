export const GUIDE_STORAGE_KEY = 'pacific-first-visit-guide-dismissed-v1';

export function FirstVisitGuide({
  open,
  onDismiss
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  if (!open) return null;
  return (
    <aside className="first-visit-guide" role="region" aria-label="Three-step guide to The Two-Faced Pacific" data-testid="first-visit-guide">
      <div className="wrap first-visit-guide-inner">
        <div className="first-visit-head">
          <div>
            <p className="eyebrow">Welcome · Quick 3-Step Guide</p>
            <h2>How to explore The Two-Faced Pacific</h2>
          </div>
          <button type="button" className="button secondary" id="dismiss-guide" onClick={onDismiss}>
            Got it, dismiss guide ×
          </button>
        </div>
        <ol className="first-visit-steps">
          <li>
            <strong>1. Follow the Pacific shift (Story)</strong>
            <p>See how warming water in the tropical Pacific shifts rain away from the western Pacific (like the Philippines) toward South America.</p>
            <a href="#story" onClick={onDismiss}>Start on Story →</a>
          </li>
          <li>
            <strong>2. Inspect dated radar frames (Sites)</strong>
            <p>Play 57 real NASA/ISRO NISAR radar observations across 4 sites and explore 34 global El Niño &amp; La Niña study places.</p>
            <a href="#sites/angat" onClick={onDismiss}>Inspect Angat radar →</a>
          </li>
          <li>
            <strong>3. Compare the Globe &amp; local news (Globe &amp; Media)</strong>
            <p>Watch dated radar and monthly vegetation play on the 3D globe, zoom into local GIBS tiles, and check local headlines per place.</p>
            <a href="#globe" onClick={onDismiss}>Open the 3D Globe →</a>
          </li>
        </ol>
      </div>
    </aside>
  );
}

export function WhereToNext({
  stepNumber,
  nextHref,
  nextLabel,
  whyText,
  secondaryLinks
}: {
  stepNumber: string;
  nextHref: string;
  nextLabel: string;
  whyText: string;
  secondaryLinks?: { href: string; label: string }[];
}) {
  return (
    <nav className="where-to-next card" aria-label="Where to next">
      <div>
        <p className="eyebrow">Where to next · {stepNumber}</p>
        <h3>{nextLabel}</h3>
        <p>{whyText}</p>
      </div>
      <div className="where-to-next-actions">
        <a className="button primary" href={nextHref}>
          {nextLabel} →
        </a>
        {secondaryLinks && secondaryLinks.length > 0 && (
          <div className="where-to-next-secondary">
            {secondaryLinks.map((link) => (
              <a key={link.href} className="text-link" href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
