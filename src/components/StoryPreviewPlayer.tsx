import { useEffect, useMemo, useRef, useState } from 'react';
import { assetURL, formatDate } from '../core.js';
import { FigureCaption } from './FigureCaption';
import type { EvidenceSummary, Site, StudyPlace } from '../types';

const storyImageCache = new Map<string, string>();

interface PreviewStep {
  id: string;
  siteId: string;
  name: string;
  country: string;
  regimeLabel: string;
  date: string;
  image?: string;
  maturity: string;
  crid: string;
  channel: string;
  sceneCount: number | string;
  caption: string;
  isGap?: boolean;
}

export function StoryPreviewPlayer({
  evidence,
  sites,
  places
}: {
  evidence?: EvidenceSummary[];
  sites: Site[];
  places?: StudyPlace[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [playing, setPlaying] = useState(false);
  const [guidedTour, setGuidedTour] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);

  const steps: PreviewStep[] = useMemo(() => {
    const list: PreviewStep[] = [];
    const orderedIds = ['angat', 'luzon', 'piura', 'dadu'];
    for (const id of orderedIds) {
      const ev = evidence?.find((e) => e.siteId === id);
      const site = sites.find((s) => s.id === id);
      const place = places?.find((p) => p.id === id);
      if (!ev && !site) continue;
      list.push({
        id: `${id}-${ev?.date || '2026-10-09'}`,
        siteId: id,
        name: site?.name || ev?.name || id,
        country: site?.country || place?.country || '',
        regimeLabel:
          id === 'dadu'
            ? 'La Niña historical reference (2022 flood test case)'
            : id === 'piura'
            ? 'Eastern Pacific · Often wetter during El Niño'
            : 'Western Pacific (Philippines) · Often drier during El Niño',
        date: ev?.date || '2026-10-09',
        image: ev?.image,
        maturity: ev?.maturity || 'Provisional',
        crid: ev?.crid || 'R04000',
        channel: ev?.channel || 'HH',
        sceneCount: ev?.n ?? 'not available',
        caption:
          site?.question ||
          'Real regional NISAR radar preview showing surface backscatter before local verification.'
      });
      if (id === 'luzon') {
        list.push({
          id: 'nisar-mission-gap-2026-08',
          siteId: 'angat',
          name: 'NISAR Mission Acquisition Gap',
          country: 'Global / All Sites',
          regimeLabel: 'Documented satellite outage window',
          date: '2026-07-27 to 2026-08-10',
          image: undefined,
          maturity: 'Gap (No acquisitions)',
          crid: 'N/A',
          channel: 'HH / HV',
          sceneCount: 0,
          caption:
            'Between 27 July 2026 (22:03 UTC) and 10 August 2026 (00:55 UTC), NISAR recorded no science radar scenes. Missing dates stay visible as explicit gaps and are never filled or interpolated.',
          isGap: true
        });
      }
    }
    return list;
  }, [evidence, sites, places]);

  const current = steps[index] || steps[0];
  const total = Math.max(1, steps.length);
  const progressPct = total > 1 ? Math.round((index / (total - 1)) * 100) : 100;

  // Prefetch next frames into decoded image cache
  useEffect(() => {
    for (const step of steps) {
      if (!step.image) continue;
      const u = assetURL(step.image);
      if (storyImageCache.has(u)) continue;
      const img = new Image();
      img.src = u;
      void img.decode().then(() => storyImageCache.set(u, u)).catch(() => {});
    }
  }, [steps]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setPlaying(false);
        setGuidedTour(false);
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Autoplay when at least 50% visible if reducedMotion is false and user has not interacted
  useEffect(() => {
    const node = containerRef.current;
    if (!node || reducedMotion || interacted || !steps.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          setPlaying(true);
        } else if (!entry.isIntersecting) {
          setPlaying(false);
        }
      },
      { threshold: [0, 0.5] }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reducedMotion, interacted, steps.length]);

  useEffect(() => {
    if (!playing && !guidedTour) return;
    const isLast = index >= steps.length - 1;
    const delay = isLast ? 2400 / speed : 2000 / speed;
    const timer = setTimeout(() => {
      if (isLast) {
        if (loop) setIndex(0);
        else {
          setPlaying(false);
          setGuidedTour(false);
        }
      } else {
        setIndex((i) => i + 1);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, guidedTour, index, steps.length, speed, loop]);

  function stopOnInteraction() {
    if (playing || guidedTour) {
      setInteracted(true);
      setPlaying(false);
      setGuidedTour(false);
    }
  }

  if (!current) return null;

  return (
    <div
      ref={containerRef}
      className="story-preview-player card"
      data-testid="story-preview-player"
      data-playing={playing || guidedTour}
      onMouseEnter={() => {
        if (!reducedMotion && (playing || guidedTour) && !interacted) stopOnInteraction();
      }}
      onTouchStart={() => {
        if ((playing || guidedTour) && !interacted) stopOnInteraction();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          stopOnInteraction();
          setIndex((i) => Math.min(steps.length - 1, i + 1));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stopOnInteraction();
          setIndex((i) => Math.max(0, i - 1));
        }
      }}
    >
      <div className="story-player-head">
        <div>
          <p className="eyebrow">57 real observations across 4 places · Regional NISAR sequence</p>
          <h3>{current.name}</h3>
          <p className="source-line">{current.country} · {current.regimeLabel}</p>
        </div>
        <div className="site-time-meta-badge">
          <strong className="site-time-date">{current.isGap ? current.date : formatDate(current.date)}</strong>
          <span className="frame-counter-badge">Frame {index + 1} of {total}</span>
          <span className="maturity-badge">Maturity: {current.maturity}</span>
        </div>
      </div>

      <div
        className="frame-progress-track"
        role="progressbar"
        aria-label="Story preview progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div className="frame-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <figure className="hero-observation">
        {current.image ? (
          <img
            src={assetURL(current.image)}
            alt={`Real regional radar preview covering ${current.name}; not a measured water-extent map`}
            fetchPriority="high"
          />
        ) : (
          <div className="empty-chart gap-card" role="status">
            <strong>Explicit Data Gap · {current.date}</strong>
            <p>{current.caption}</p>
          </div>
        )}
        <figcaption>
          <div className="caption-top">
            <strong>{current.isGap ? 'Why missing dates stay visible' : 'One observation, many possible explanations'}</strong>
          </div>
          <p>
            {current.name} · {current.isGap ? current.date : formatDate(current.date)}
          </p>
          <p>{current.caption}</p>
          <FigureCaption
            whatWhere={<>Regional NISAR radar preview over <strong>{current.name}</strong> ({current.country}).</>}
            dateSource={<>{current.isGap ? current.date : formatDate(current.date)} · Source: NASA/ISRO NISAR via ASF DAAC ({current.sceneCount} catalog scenes, CRID {current.crid}).</>}
            howToRead="Bright areas show stronger radar echoes from rough ground, crops, or towns; dark areas show smoother water or flat soil that reflects radar away."
            limitations="This preview is downsampled and uncalibrated. It helps us choose where to look closer, not prove water volume, crop loss, or El Niño causation."
          />
        </figcaption>
      </figure>

      <div className="story-player-controls" role="group" aria-label="Story radar preview playback controls">
        <button
          type="button"
          className={reducedMotion ? 'button primary prominent-play' : 'button primary'}
          aria-pressed={playing}
          onClick={() => {
            setInteracted(true);
            setGuidedTour(false);
            setPlaying((p) => !p);
          }}
        >
          {playing ? 'Pause previews' : 'Play previews'}
        </button>
        <button
          type="button"
          className="button secondary"
          aria-pressed={guidedTour}
          id="story-guided-tour"
          onClick={() => {
            setInteracted(true);
            if (guidedTour) {
              setGuidedTour(false);
              setPlaying(false);
            } else {
              setGuidedTour(true);
              setPlaying(true);
            }
          }}
        >
          {guidedTour ? 'Stop guided tour' : 'Guided tour (place by place)'}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            stopOnInteraction();
            setIndex((i) => (i - 1 + steps.length) % steps.length);
          }}
        >
          ← Prev
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            stopOnInteraction();
            setIndex((i) => (i + 1) % steps.length);
          }}
        >
          Next →
        </button>
        <label className="inline-control-label">
          Speed
          <select
            aria-label="Story preview playback speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[1, 2, 4].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
        <a className="text-link" href={`#sites/${current.siteId}`}>
          Inspect {current.name} in Sites →
        </a>
        <a className="text-link" href={`#globe?mode=satellite&site=${current.siteId}`}>
          See on 3D Globe →
        </a>
      </div>
    </div>
  );
}
