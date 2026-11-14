import type { ReactNode } from 'react';

export function FigureCaption({
  whatWhere,
  dateSource,
  howToRead,
  limitations,
  extraDetails
}: {
  whatWhere: ReactNode;
  dateSource: ReactNode;
  howToRead: ReactNode;
  limitations: ReactNode;
  extraDetails?: ReactNode;
}) {
  return (
    <div className="std-figure-caption" data-testid="figure-caption">
      <p className="std-caption-line1">
        <strong>What am I looking at?</strong> {whatWhere}
      </p>
      <p className="std-caption-line2">{dateSource}</p>
      <details className="std-caption-details">
        <summary>How to read it &amp; what it can’t tell you</summary>
        <div className="std-caption-expanded">
          <p>
            <strong>How to read it:</strong> {howToRead}
          </p>
          <p>
            <strong>What it can’t tell you:</strong> {limitations}
          </p>
          {extraDetails}
        </div>
      </details>
    </div>
  );
}
