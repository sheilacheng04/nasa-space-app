import type { EvidenceSummary } from '../types';
import { assetURL, formatDate } from '../core.js';
export function EvidenceLead({evidence}: {evidence?: EvidenceSummary}) {
 if (!evidence) return <p className="evidence-lead">NISAR evidence · not available. No measurements have been substituted.</p>;
 return <a className="evidence-lead" href={'#sites/'+evidence.siteId}>
  {evidence.image && <img src={assetURL(evidence.image)} loading="lazy" decoding="async" width={90} height={60} alt={'NISAR browse of '+evidence.name+'; downsampled, not calibrated'}/>}
  <span><strong>NISAR / {evidence.name}</strong><br/>{formatDate(evidence.date)} · {evidence.maturity} · {evidence.n} catalog scenes<br/><span className="muted">Browse evidence; quantitative change not available</span></span>
 </a>;
}
