import { useEffect, useRef } from 'react';

export const GUIDE_STORAGE_KEY = 'pacific-first-visit-guide-dismissed-v1';

export function FirstVisitGuide({
  open,
  onDismiss
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeGuide = (restoreFocus = true) => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    document.body.style.overflow = '';
    onDismiss();
    if (restoreFocus) {
      requestAnimationFrame(() => {
        document.getElementById('open-guide')?.focus({ preventScroll: true });
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    const dismissBtn = document.getElementById('dismiss-guide');
    dismissBtn?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      id="help-guide-dialog"
      className="help-guide-dialog"
      ref={dialogRef}
      aria-labelledby="help-guide-title"
      aria-describedby="help-guide-intro"
      data-testid="first-visit-guide"
      onCancel={(event) => {
        event.preventDefault();
        closeGuide(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeGuide(true);
        }
      }}
      onClick={(event) => {
        if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
          closeGuide(true);
        }
      }}
    >
      <div className="help-guide-modal-panel" ref={panelRef} data-testid="help-guide-panel">
        <div className="first-visit-head help-guide-head">
          <div>
            <p className="eyebrow">Welcome · Quick 3-Step Guide</p>
            <h2 id="help-guide-title">How to explore The Two-Faced Pacific</h2>
          </div>
          <button
            type="button"
            className="icon-button help-guide-close-icon"
            id="help-guide-close-icon"
            aria-label="Close help guide"
            title="Close guide (Escape)"
            onClick={() => closeGuide(true)}
          >
            ×
          </button>
        </div>

        <p id="help-guide-intro" className="help-guide-intro">
          Connect Pacific Ocean temperature shifts, dated NASA/ISRO NISAR radar observations across Philippine and
          international study sites, and regional news coverage—without losing your place on the current page.
        </p>

        <ol className="first-visit-steps help-guide-steps">
          <li>
            <span className="help-step-badge mono">Step 01 · Story</span>
            <strong>1. Follow the Pacific shift (Story)</strong>
            <p>
              See how warming water in the tropical Pacific shifts rain away from the western Pacific (like the
              Philippines) toward South America.
            </p>
            <a href="#story" onClick={() => closeGuide(false)}>
              Start on Story →
            </a>
          </li>
          <li>
            <span className="help-step-badge mono">Step 02 · Sites</span>
            <strong>2. Inspect dated radar frames (Sites)</strong>
            <p>
              Play real NASA/ISRO NISAR radar frames across the study areas, compare HH and HV channels, and explore
              global El Niño &amp; La Niña study places.
            </p>
            <a href="#sites/angat" onClick={() => closeGuide(false)}>
              Inspect Angat radar →
            </a>
          </li>
          <li>
            <span className="help-step-badge mono">Step 03 · Globe &amp; Media</span>
            <strong>3. Compare the Globe &amp; local news (Globe &amp; Media)</strong>
            <p>
              Watch dated radar and monthly vegetation play on the 3D globe, zoom into local GIBS tiles, and check
              local headlines per place.
            </p>
            <div className="help-step-links">
              <a href="#globe" onClick={() => closeGuide(false)}>
                Open the 3D Globe →
              </a>
              <a href="#media" onClick={() => closeGuide(false)}>
                Browse Media →
              </a>
            </div>
          </li>
        </ol>

        <section className="help-guide-science" aria-label="How to read the controls and scientific views">
          <h3>How to read the controls &amp; scientific views</h3>
          <div className="help-guide-science-grid">
            <div>
              <strong>Radar vs. photographs</strong>
              <p>
                <code>HH</code> (surface/water contrast) and <code>HV</code> (canopy/vegetation structure) show radar
                backscatter, not camera images or direct water-volume gauges.
              </p>
            </div>
            <div>
              <strong>Evidence boundaries</strong>
              <p>
                Satellite observations, model estimates, and field hypotheses are labeled separately. Missing pass
                dates remain explicitly marked as unavailable.
              </p>
            </div>
            <div>
              <strong>Controls &amp; shortcuts</strong>
              <p>
                Click any dotted term (e.g., <code>ENSO ?</code>) for a plain-language definition, or press{' '}
                <kbd>Ctrl+K</kbd> to search sites, places, and headlines.
              </p>
            </div>
          </div>
        </section>

        <div className="help-guide-foot">
          <a className="text-link" href="#method" onClick={() => closeGuide(false)}>
            Sources, calibration &amp; scientific limits ↗
          </a>
          <button
            type="button"
            className="button primary"
            id="dismiss-guide"
            onClick={() => closeGuide(true)}
          >
            Got it, dismiss guide ×
          </button>
        </div>
      </div>
    </dialog>
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
