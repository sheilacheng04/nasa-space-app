import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { dataFile, hosted } from '../api/client';
import { assetURL, formatDate, safeURL } from '../core.js';
import { validDay } from '../selection-url.js';
import type { Site } from '../types';

interface PreviewFrame {
  date: string;
  image?: string;
  url?: string;
  status?: string;
  maturity?: string;
  crid?: string;
}
interface PreviewRecord { siteId: string; gibs: { frames: PreviewFrame[] } }
type ImageStatus = 'loading' | 'ready' | 'missing' | 'error';
const decodedImages = new Set<string>();
const comparisons: Record<string, { dates: string[]; text: string; interpretation: string }> = {
  luzon: { dates: ['2026-06-23', '2026-11-02'], text: 'The later image has more orange patches across the upper and middle areas. The broad green band on the right remains visible in both dates.', interpretation: 'The changed patches may reflect field moisture, crop stage, harvest, irrigation, or radar processing. They are not enough to label drought or crop damage.' },
  angat: { dates: ['2026-06-23', '2026-11-02'], text: 'The dark, branching shape near the center and upper right appears wider in the later image. Much of the surrounding area remains bright green.', interpretation: 'The wider dark shape is consistent with a possible change in open water or shoreline, but reservoir releases, rainfall, and viewing conditions must be checked before inferring a water-supply change.' },
  dadu: { dates: ['2026-06-17', '2026-10-27'], text: 'The winding dark river remains visible in both images. In the later view, more yellow and orange patches appear near the top and beside parts of the river.', interpretation: 'The persistent channel is a useful reference for the floodplain. The new colored patches could reflect wet soil, vegetation, farming, or water; they do not establish new flooding.' },
  piura: { dates: ['2026-06-21', '2026-10-31'], text: 'Several rectangular patches near the upper right shift from green to yellow and orange. The bright central band also looks more orange in the later image.', interpretation: 'The patchwork is compatible with changing field or soil conditions in a managed river plain. Rainfall, irrigation, river records, and crop timing are needed to separate those causes.' },
  'cagayan-valley': { dates: ['2026-06-28', '2026-10-26'], text: 'The later image shows more orange variation across the basin, while the main river and green corridors remain recognizable.', interpretation: 'The change may reflect crop stage, field moisture, irrigation, or soil conditions in the farming basin. It does not by itself show drought or crop loss.' },
  'mekong-delta': { dates: ['2026-06-24', '2026-11-03'], text: 'The later image has a stronger mix of orange and green across the delta, while connected dark waterways remain visible.', interpretation: 'Seasonal rice cycles, tides, canals, irrigation, and soil moisture can all change this pattern. The preview cannot measure salinity or identify one cause.' },
  'guayas-babahoyo': { dates: ['2026-06-21', '2026-10-31'], text: 'The later view shows more orange in broad lowland patches and along some waterways, while major dark and green corridors persist.', interpretation: 'The visible shift may relate to rainfall, river level, crop stage, or managed drainage in the lowlands. Independent water and rainfall records are needed before calling it flooding.' }
};

// Compare the same request geometry; offline manifests retain this in their source URL.
function viewKey(frame: PreviewFrame): string | null {
  try {
    const params = new URL(frame.url || '').searchParams;
    const bbox = params.get('BBOX')?.split(',').map(Number);
    const layer = params.get('LAYERS'), projection = params.get('SRS');
    return bbox?.length === 4 && bbox.every(Number.isFinite) && layer && projection
      ? JSON.stringify([bbox, layer, projection]) : null;
  } catch { return null; }
}

function DatedPreview({ frame, siteName, label, active }: {
  frame?: PreviewFrame; siteName: string; label: string; active: boolean;
}) {
  const url = assetURL(frame?.image);
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<{ url: string; status: ImageStatus }>({ url: '', status: 'loading' });
  const status = !url || (!hosted && !url.startsWith('data:')) ? 'missing'
    : load.url === url ? load.status : 'loading';

  useEffect(() => {
    if (!active || !url || (!hosted && !url.startsWith('data:'))) return;
    let current = true;
    const save = (status: ImageStatus) => { if (current) setLoad({ url, status }); };
    if (decodedImages.has(url)) { save('ready'); return; }
    save('loading');
    const image = new Image();
    const timer = setTimeout(() => { save('error'); current = false; }, 12000);
    image.src = url;
    void image.decode().then(() => {
      if (!current) return;
      clearTimeout(timer);
      decodedImages.add(url);
      while (decodedImages.size > 8) decodedImages.delete(decodedImages.values().next().value!);
      save('ready');
    }).catch(() => { clearTimeout(timer); save('error'); });
    return () => { current = false; clearTimeout(timer); };
  }, [active, url, retry]);

  return (
    <figure className="story-dated-preview" data-image-status={status} data-date={frame?.date || ''}>
      <figcaption><strong>{label}</strong> {frame ? <time dateTime={frame.date}>{formatDate(frame.date)}</time> : 'Unavailable'}</figcaption>
      <div className="story-preview-visual" aria-busy={status === 'loading'}>
        {status === 'ready' ? <img
          key={url} src={url}
          alt={`${siteName}, NISAR false-color radar preview for ${frame!.date}; not a calibrated measurement`}
          onError={() => { decodedImages.delete(url); setLoad({ url, status: 'error' }); }}
        /> : <div className="story-preview-gap" role="status">
          <strong>{status === 'loading' ? 'Loading this date…' : status === 'error' ? 'This image could not load.' : 'No saved image for this view.'}</strong>
          <p>No other date is substituted.</p>
          {status === 'error' && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry image</button>}
        </div>}
      </div>
      {frame?.url && <a className="story-image-source" href={safeURL(frame.url)} target="_blank" rel="noopener">NASA GIBS source · {frame.date}</a>}
    </figure>
  );
}

export function StoryPreviewPlayer({ active, sites }: { active: boolean; sites: Site[] }) {
  const mount=useRef<HTMLDivElement>(null);
  const [near,setNear]=useState(()=>typeof IntersectionObserver==='undefined');
  useEffect(()=>{
    if(!active||near||!mount.current)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();}
    },{rootMargin:'600px'});
    observer.observe(mount.current);return()=>observer.disconnect();
  },[active,near]);
  const pickerId = useId();
  const [selectedId, setSelectedId] = useState('');
  const [record, setRecord] = useState<PreviewRecord | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const site = sites.find(item => item.id === selectedId) || sites[0];

  useEffect(() => {
    if (!active || !site) return;
    let current = true;
    setRecord(null); setError('');
    void dataFile<PreviewRecord>('sites/' + site.id + '/evidence.json', { reload: retry > 0 }).then(value => {
      if (value.siteId !== site.id || !Array.isArray(value.gibs?.frames)) throw new Error('Invalid record');
      if (current) setRecord(value);
    }).catch(() => { if (current) setError('The saved dates could not load.'); });
    return () => { current = false; };
  }, [active, site?.id, retry]);

  const pair = useMemo(() => {
    if (!record || record.siteId !== site?.id) return [];
    const frames = record.gibs.frames.filter(frame => frame.image && validDay(frame.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const first = frames[0], last = frames.at(-1);
    if (!first) return [];
    if (!last || last.date === first.date || last.image === first.image || !viewKey(first) || viewKey(first) !== viewKey(last)) return [first];
    return [first, last];
  }, [record, site?.id]);
  const ready = record?.siteId === site?.id;

  if (!site) return <p role="status">No saved study areas are available.</p>;
  return (
    <div className="story-preview-player card" data-testid="story-preview-player" ref={mount}>
      <div className="story-preview-top">
        <div><p className="eyebrow">Real radar · Two saved dates</p><h3>See what changes between observations</h3></div>
        <div className="story-preview-picker">
          <label htmlFor={pickerId}>Study area</label>
          <select id={pickerId} value={site.id} onChange={event => setSelectedId(event.target.value)}>
            {sites.map(item => <option key={item.id} value={item.id}>{item.name} · {item.country}</option>)}
          </select>
        </div>
      </div>
      <p>Compare two saved dates of the same area. Look only at areas with radar coverage in both images.</p>
      {error ? <div className="story-preview-gap" role="status"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry saved dates</button></div>
        : !ready ? <p role="status">Loading saved radar dates…</p>
        : <>
          <div className="story-date-views" data-comparison="true">
            {[pair[0], pair[1]].map((frame, index) => <DatedPreview
              key={site.id + '-' + (frame?.date || 'missing-' + index)} frame={frame} siteName={site.name} active={active&&near}
              label={index === 1 ? 'Later saved date' : 'Earlier saved date'}
            />)}
          </div>
          {pair.length < 2 && <p role="status">Two distinct saved dates with matching map coverage are not available for this comparison.</p>}
        </>}
      <p className="story-reading-takeaway">The checkerboard marks missing coverage. Changes in color alone do not prove flooding, crop damage, or an El Niño impact.</p>
      <div className="story-preview-provenance">
        <h4>What looks different in {site.name}?</h4>
        {pair.length === 2 && comparisons[site.id]?.dates.every((date, index) => pair[index].date === date)
          ? <><p>{comparisons[site.id].text}</p><p><strong>Interpretation:</strong> {comparisons[site.id].interpretation}</p></>
          : <p>A description is not available for this image pair. Compare the same features only where both dates have coverage.</p>}
        <p>These are visible differences, not measured impacts. Changes in water, plants, soil, or radar processing could contribute.</p>
        <details><summary>Image source and limits</summary>
          <p>NASA / ISRO NISAR via NASA GIBS. First and last saved previews; intermediate dates are not shown.</p>
          <p>False-color browse imagery, not photographs or calibrated measurements. Pixel-level processing lineage is unavailable.</p>
          {site.id === 'dadu' && <p>These 2026 images do not depict the 2022 La Ni?a flood.</p>}
        </details>
      </div>
    </div>
  );
}
