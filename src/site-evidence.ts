export interface SavedSiteMosaicFrame {
  date: string;
  status: string;
  image?: string | null;
  label?: string;
  url?: string;
  nontransparentFraction?: number | null;
}

export interface SiteEvidenceManifest {
  siteId: string;
  gibs?: {
    source?: string;
    frames?: SavedSiteMosaicFrame[];
  };
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Select the newest saved site-area mosaic image, never a catalog-only date. */
export function latestSavedSiteMosaic(evidence: SiteEvidenceManifest): SavedSiteMosaicFrame | null {
  const frames = evidence?.gibs?.frames;
  if (!Array.isArray(frames)) return null;
  return frames
    .filter((frame) => frame.status === 'ready' && validDate(frame.date) && typeof frame.image === 'string' && frame.image.length > 0)
    .reduce<SavedSiteMosaicFrame | null>((latest, frame) => !latest || frame.date > latest.date ? frame : latest, null);
}
