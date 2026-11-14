import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface TermDefinition {
  term: string;
  short: string;
  detail: string;
}

export const GLOSSARY_TERMS: Record<string, TermDefinition> = {
  SAR: {
    term: 'SAR (Synthetic Aperture Radar)',
    short: 'Active microwave radar that images Earth day or night and through clouds.',
    detail: 'A radar antenna on a moving satellite sends microwave pulses to the ground and combines the returning echoes into a sharp surface image.'
  },
  NISAR: {
    term: 'NISAR (NASA–ISRO SAR Mission)',
    short: 'Joint US–Indian radar satellite tracking land, water, and ice every 12 days.',
    detail: 'Launched in 2025 by NASA and the Indian Space Research Organisation, NISAR collects L-band and S-band radar across global land and coast zones.'
  },
  backscatter: {
    term: 'Radar backscatter',
    short: 'Strength of the radar echo reflected back to the satellite from the ground.',
    detail: 'Smooth open water reflects pulses away from the sensor and looks dark. Rough soil, crops, trees, and buildings scatter energy back and look brighter.'
  },
  polarization: {
    term: 'Polarization (HH / HV)',
    short: 'Orientation of the radar wave sent and received by the satellite.',
    detail: 'HH sends and receives horizontal waves (sensitive to surface water and structure). HV sends horizontal and receives vertical waves (sensitive to plant canopies).'
  },
  GCOV: {
    term: 'GCOV (Geocoded Polarimetric Covariance)',
    short: 'NISAR radar product mapped onto standard latitude-longitude coordinates.',
    detail: 'Level-2 science product from NISAR that corrects terrain geometry so images from different dates line up over the same place.'
  },
  GIBS: {
    term: 'GIBS (Global Imagery Browse Services)',
    short: 'NASA Earthdata map-tile service that delivers visual satellite previews.',
    detail: 'Provides fast web-ready browse imagery for NISAR and MODIS. GIBS previews show visual patterns, not calibrated physical measurements.'
  },
  provisional: {
    term: 'Provisional vs. Validated maturity',
    short: 'Release stage indicating how thoroughly satellite calibration has been checked.',
    detail: 'Beta and Provisional products are early releases whose radiometric calibration is still being refined. Validated products have passed full science review.'
  },
  CRID: {
    term: 'CRID (Composite Release Identifier)',
    short: 'Version code identifying the exact software build used to process a radar file.',
    detail: 'Allows researchers to verify whether two radar scenes were processed with compatible calibration algorithms.'
  },
  ERA5: {
    term: 'ERA5 climate record',
    short: 'Global daily weather reconstruction produced by the European Centre (ECMWF).',
    detail: 'Blends historical weather station, buoy, and satellite measurements with a global weather model to estimate daily rainfall and temperature.'
  },
  reanalysis: {
    term: 'Climate reanalysis',
    short: 'Model-assisted weather map built by combining past observations on a regular grid.',
    detail: 'Reanalysis estimates regional rainfall and temperature consistently over decades, though it can miss localized storms at a single farm or dam.'
  },
  ONI: {
    term: 'ONI (Oceanic Niño Index)',
    short: 'NOAA three-month running average of tropical Pacific temperature departures.',
    detail: 'Values at or above +0.5 °C for five overlapping three-month seasons indicate El Niño; values at or below -0.5 °C indicate La Niña.'
  },
  'Niño 3.4': {
    term: 'Niño 3.4 region',
    short: 'Central-eastern equatorial Pacific box used to monitor El Niño and La Niña.',
    detail: 'Spans 5°N to 5°S and 170°W to 120°W. Ocean surface temperatures here strongly influence tropical winds and rainfall.'
  },
  MODIS: {
    term: 'MODIS satellite sensor',
    short: 'NASA optical instrument that maps global vegetation greenness every month.',
    detail: 'Flies aboard NASA Terra and Aqua satellites, measuring visible and infrared light to track cloud-free plant cover.'
  },
  greenness: {
    term: 'NDVI-style greenness',
    short: 'Satellite index of live green leaf cover based on reflected sunlight.',
    detail: 'Higher greenness means denser green leaves. It does not directly measure crop harvest yield, soil moisture, or irrigation volume.'
  }
};

export function GlossaryTerm({ termKey, label, children }: { termKey: keyof typeof GLOSSARY_TERMS; label?: string; children?: ReactNode }) {
  const entry = GLOSSARY_TERMS[termKey] || GLOSSARY_TERMS.SAR;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <span className="glossary-term-wrap" ref={wrapRef}>
      <button
        type="button"
        className="glossary-term-btn"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((v) => !v)}
        title={`${entry.term}: ${entry.short}`}
      >
        {children || label || termKey}
      </button>
      {open && (
        <span id={popId} role="region" aria-label={entry.term} className="glossary-popover">
          <strong>{entry.term}</strong>
          <span className="glossary-popover-short">{entry.short}</span>
          <span className="glossary-popover-detail">{entry.detail}</span>
          <a href="#method/glossary" className="glossary-popover-link" onClick={() => setOpen(false)}>
            See full glossary in Data &amp; method →
          </a>
        </span>
      )}
    </span>
  );
}
