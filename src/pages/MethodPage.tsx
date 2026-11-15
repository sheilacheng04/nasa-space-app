import { useEffect, useState } from 'react';
import { downloadText } from '../core.js';
import { dataFile } from '../api/client';
import { EvidenceLead } from '../components/EvidenceLead';
import { GlossaryTerm } from '../components/GlossaryTerm';
import { WhereToNext } from '../components/FirstVisitGuide';
import type { ReactNode } from 'react';
import type { Bootstrap } from '../types';

type SourceRecord = {
  name?: string;
  url: string;
  status: string;
  retrievedAt?: string;
  maturity?: string;
  crid?: string;
  parameters?: unknown;
};
type MethodRecord = {
  retrievedAt?: string;
  sources?: SourceRecord[];
  collections?: { shortName: string; conceptId: string; doi: string }[];
};

const glossary = [
  ['SAR', 'Synthetic aperture radar: active microwave sensor that sends radio pulses and combines echoes to build a surface image day or night and through clouds.'],
  ['NISAR', 'NASA–ISRO Synthetic Aperture Radar: joint US–Indian radar satellite tracking changes in land, water, crops, and ice every 12 days.'],
  ['Backscatter', 'Radar echo strength returned to the satellite, shaped by surface water, soil roughness, plant structure, and viewing angle.'],
  ['Polarization (HH/HV)', 'Direction of the sent and received radar wave. HH highlights surface water and structure; HV responds strongly to vegetation canopies.'],
  ['GCOV', 'Geocoded Polarimetric Covariance: NISAR Level-2 radar product mapped onto geographic coordinates so dates align over the same place.'],
  ['GIBS', 'Global Imagery Browse Services: NASA map-tile service that delivers fast visual satellite previews for web maps.'],
  ['Provisional vs. Validated', 'Release maturity stage: Beta and Provisional products are early releases whose calibration is still being refined, unlike fully Validated data.'],
  ['CRID', 'Composite Release Identifier: NASA/ISRO version code showing the exact software build used to process a radar scene.'],
  ['ERA5 / Reanalysis', 'Past weather reconstructed on a global grid by blending weather station, buoy, and satellite records with a forecast model.'],
  ['ONI / Niño 3.4', 'NOAA tropical Pacific temperature indices: weekly Niño 3.4 readings and the 3-month Oceanic Niño Index (ONI) track El Niño and La Niña phases.'],
  ['MODIS / Greenness (NDVI)', 'Normalized Difference Vegetation Index from NASA MODIS: compares red and near-infrared sunlight to map green leaf cover each month.']
];

export function MethodPage({
  active,
  data,
  newsNotice,
  sourcesNotice,
  evidenceNotice
}: {
  active: boolean;
  data: Pick<Bootstrap, 'news' | 'sources' | 'evidence' | 'sites'>;
  newsNotice: ReactNode;
  sourcesNotice: ReactNode;
  evidenceNotice: ReactNode;
}) {
  const [record, setRecord] = useState<MethodRecord | null>(null);
  const [error, setError] = useState('');
  const [recordStatus, setRecordStatus] = useState('loading');
  const [recordAttempt, setRecordAttempt] = useState(0);

  useEffect(() => {
    if (!active || record) return;
    let cancelled = false;
    setRecordStatus('loading');
    dataFile<MethodRecord>('method.json', { reload: recordAttempt > 0 })
      .then((value) => {
        if (!value || !Array.isArray(value.sources) || !Array.isArray(value.collections))
          throw new Error('Invalid source ledger');
        if (!cancelled) {
          setRecord(value);
          setRecordStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setRecordStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [active, recordAttempt]);

  const download = (path: string) => {
    setError('');
    void dataFile(path)
      .then((value) =>
        downloadText(path.split('/').at(-1)!, JSON.stringify(value, null, 2), 'application/json')
      )
      .catch(() => setError('This saved file is not available for download in this edition.'));
  };

  const sourceRows = [
    [
      'NISAR radar',
      'NASA / ISRO, via ASF and GIBS',
      `Microwave echoes returned from land and water (${data.sites.reduce((sum,site)=>sum+(site.savedFrameCount||0),0)} saved frames across ${data.sites.length} sites).`,
      'Works through clouds and at night. Smooth water looks dark; rough soil and crops look bright. Previews are not calibrated water-level gauges.'
    ],
    [
      'MODIS vegetation',
      'NASA Terra, via GIBS',
      'Monthly green leaf cover from reflected sunlight (NDVI).',
      'Planting, harvest, rain, and irrigation change greenness. Clouds and snow can block optical views.'
    ],
    [
      'Ocean temperature',
      'NOAA CPC',
      'Tropical Pacific sea-surface temperature departures (Niño 3.4 and ONI).',
      'Tracks El Niño and La Niña phases across the ocean. It does not measure local rain at a specific site.'
    ],
    [
      'Local weather',
      'ECMWF ERA5, via Open-Meteo',
      'Monthly rainfall and temperature estimates compared with 1991–2020 averages.',
      'Reanalysis blends observations with a weather model at the site center. It is not a local rain gauge.'
    ],
    [
      'News reports',
      'GDELT and supplied archive',
      data.news
        ? data.news.items.length + ' source-linked headlines matched to 34 study places.'
        : 'Headline count unavailable while the news archive is unavailable.',
      'Provides local human context. Tone scores measure headline wording only, not physical disaster severity.'
    ]
  ];

  const conclusionRows = [
    [
      'Radar browse and catalog coverage',
      'Water area and calibrated radar-change series remain unmeasured. A catalog footprint does not guarantee useful pixels throughout.'
    ],
    [
      'Monthly vegetation greenness',
      'Color changes do not directly measure crop yield, water shortage or damage. Check seasonality and independent observations.'
    ],
    [
      'Ocean, weather and reporting context',
      'Timing alone cannot attribute a local event to El Niño. One season cannot separate all possible drivers.'
    ]
  ];

  return (
    <section id="page-method" className="page" hidden={!active}>
      <div className="wrap">
        <div className="page-intro">
          <p className="eyebrow">Step 5 · Plain-language guide to our sources, rules, and limits</p>
          <h1>Data and method</h1>
          <p className="page-purpose-line">
            <strong>What this page is for:</strong> See where every map, chart, and headline comes from, how to compare dates fairly, and what satellite previews can and cannot prove.
          </p>
          <div className="hero-actions"><a className="button primary" href="#method/evidence">See the data sources →</a></div>
        </div>

        <nav className="method-links" aria-label="Method sections">
          <a href="#method/question">1. The question</a>
          <a href="#method/evidence">2. Five data sources</a>
          <a href="#method/comparison">3. Comparing dates</a>
          <a href="#method/limits">4. Scientific limits</a>
          <a href="#method/glossary">Glossary</a>
          <a href="#method/provenance">Source records</a>
          <a href="#method/citation">Credits</a>
        </nav>

        <section className="story-section" id="question">
          <h2>
            <span className="chapter-number">1</span>How we move from a picture to a fair question
          </h2>
          <p className="large-copy">
            We keep direct data, weather models, test ideas, and teaching sketches separate.
          </p>
          <p>
            One radar image shows how the ground bounced back radio waves on one day. To learn why the ground changed, we check many dates alongside local rain, dam rules, crop cycles, and news links.
          </p>
        </section>

        <section className="story-section" id="evidence">
          <h2>
            <span className="chapter-number">2</span>Five data sources work together
          </h2>
          <p>
            No single dataset tells the whole story. <GlossaryTerm termKey="NISAR" /> uses synthetic aperture radar (<GlossaryTerm termKey="SAR" />) to see through clouds, while <GlossaryTerm termKey="MODIS" />, <GlossaryTerm termKey="ERA5" />, NOAA <GlossaryTerm termKey="ONI" />, and local news add seasonal and human context.
          </p>

          <div className="method-source-cards">
            <div className="card">
              <p className="eyebrow">1 · Satellite Radar</p>
              <h3>NISAR SAR Previews</h3>
              <p>{data.sites.reduce((sum,site)=>sum+(site.savedFrameCount||0),0)} real dated frames across {data.sites.length} sites via NASA <GlossaryTerm termKey="GIBS" /> and ASF. Penetrates clouds day or night to show surface <GlossaryTerm termKey="backscatter" />.</p>
            </div>
            <div className="card">
              <p className="eyebrow">2 · Land Greenness</p>
              <h3>MODIS Monthly NDVI</h3>
              <p>21 monthly global <GlossaryTerm termKey="greenness" /> composites (Jan 2025 – Oct 2026) showing seasonal plant growth and dry-season browning.</p>
            </div>
            <div className="card">
              <p className="eyebrow">3 · Ocean Context</p>
              <h3>NOAA Niño 3.4 &amp; ONI</h3>
              <p>Weekly <GlossaryTerm termKey="Niño 3.4" /> sea-surface temperatures and three-month <GlossaryTerm termKey="ONI" /> averages tracking Pacific warm and cool phases.</p>
            </div>
            <div className="card">
              <p className="eyebrow">4 · Local Weather</p>
              <h3>ERA5 Climate Reanalysis</h3>
              <p>Daily and monthly rainfall and temperature estimates compared against the 1991–2020 average for each calendar month.</p>
            </div>
            <div className="card">
              <p className="eyebrow">5 · Local Reporting</p>
              <h3>{data.news?.items.length||0} Saved Headlines</h3>
              <p>Matched across 34 study places by place name, basin query, and country, with VADER wording tone scores.</p>
            </div>
          </div>

          <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
            <table>
              <caption>Sources, imagery types and interpretation</caption>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">What we see</th>
                  <th scope="col">How to read it</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map(([name, credit, view, meaning]) => (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                      <br />
                      {credit}
                    </td>
                    <td>{view}</td>
                    <td>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The globe’s natural-color base is NASA Blue Marble (2004 MODIS composite). It stays fixed to help you locate places and does not change with the selected date.
          </p>
          <p className="source-line">
            Learn more: <a href="https://science.nasa.gov/mission/nisar/get-to-know-sar/">NASA’s radar introduction</a> ·{' '}
            <a href="https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/">NASA’s vegetation guide</a> ·{' '}
            <a href="https://www.ecmwf.int/en/about/media-centre/focus/2023/fact-sheet-reanalysis">ECMWF’s reanalysis explanation</a>.
          </p>
          {newsNotice}
          <details className="source-row" id="glossary" open>
            <summary>Plain-language glossary</summary>
            <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
              <table>
                <caption>Scientific glossary</caption>
                <thead>
                  <tr>
                    <th scope="col">Term</th>
                    <th scope="col">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {glossary.map(([term, meaning]) => (
                    <tr key={term}>
                      <th scope="row">{term}</th>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="story-section" id="comparison">
          <h2>
            <span className="chapter-number">3</span>Four rules for comparing dates fairly
          </h2>
          <ol className="method-steps">
            <li>
              <strong>Keep the same map box.</strong> Every saved site sequence uses a fixed geographic bounding box so shorelines and fields stay in the same place across dates.
            </li>
            <li>
              <strong>Compare like with like.</strong> Match radar viewing path, <GlossaryTerm termKey="polarization" label="polarization channel (HH/HV)" />, and processing version (<GlossaryTerm termKey="CRID" />).
            </li>
            <li>
              <strong>Keep missing dates visible.</strong> Never skip or fill a gap. When a date has no saved image (such as the NISAR outage from 27 July to 10 August 2026), we show an explicit gap card.
            </li>
            <li>
              <strong>Test alternative explanations.</strong> Check local rain, irrigation schedules, dam releases, and harvest timing before linking a surface change to El Niño.
            </li>
          </ol>
          <p className="source-line">
            Sources: <a href="https://science.nasa.gov/mission/nisar/mission-overview/">NISAR repeat orbit</a> ·{' '}
            <a href="https://nisar-docs.asf.alaska.edu/worldview/">Reading NISAR imagery</a> ·{' '}
            <a href="https://www.usgs.gov/special-topics/remote-sensing-phenology/science/ndvi-foundation-remote-sensing-phenology">Vegetation and seasonal change</a>.
          </p>
        </section>

        <section className="story-section" id="limits">
          <h2>
            <span className="chapter-number">4</span>What satellite previews can and cannot prove
          </h2>
          <p>
            Visual satellite previews help us spot where to investigate. They do not replace calibrated ground gauges or prove climate causation on their own.
          </p>
          <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
            <table>
              <caption>Evidence and remaining limitations</caption>
              <thead>
                <tr>
                  <th scope="col">What this project shows</th>
                  <th scope="col">What needs more evidence</th>
                </tr>
              </thead>
              <tbody>
                {conclusionRows.map(([view, limit]) => (
                  <tr key={view}>
                    <td>{view}</td>
                    <td>{limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Smooth open water, flat dry soil, and terrain shadow can all look dark in radar images. Wind can roughen water and make it look bright. And Pakistan’s 2022 Dadu flood occurred during a La Niña year—it is included as a historical radar test case, never as evidence of El Niño.
          </p>
          <p className="source-line">
            <a href="https://hyp3-docs.asf.alaska.edu/hyp3-docs/guides/introduction_to_sar/">ASF explains radar scattering and viewing geometry</a>.
          </p>
          <details className="source-row">
            <summary>Image colors, resolution and missing dates</summary>
            <p>
              Multi-channel GIBS uses HH or VV for red and blue, and HV or VH for green. Single-channel colors differ. Display colors cannot supply water-area or decibel measurements.
            </p>
            <p>
              The 21 vegetation images span January 2025–October 2026; April 2025 is missing. Offline includes September/October 2026. The official NDVI legend spans 0–1. Transparency includes fill <em>or</em> low/nonpositive NDVI.
            </p>
            <p>Globe images are downsampled and lose source detail. Missing radar coverage remains explicit.</p>
            <p className="source-line">
              <a href="https://nisar-docs.asf.alaska.edu/worldview/">NISAR color mapping</a> ·{' '}
              <a href="https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml">Official NDVI color mapping</a> ·{' '}
              <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/">Blue Marble source</a>.
            </p>
          </details>
          <details className="source-row">
            <summary>Advanced: radar processing and quality checks</summary>
            <p>
              Inventory checks ASF’s NISAR <GlossaryTerm termKey="GCOV" /> catalog, CMR collection IDs, site footprints and the observation plan. Quantitative extraction remains untested without authenticated Earthdata access. Compare <GlossaryTerm termKey="provisional" label="PROVISIONAL" /> pairs with matching track, frame and <GlossaryTerm termKey="CRID" />; exclude BETA and mixed-stage browse. Check units and masks, preserve gamma-0, and average valid linear power before converting to dB.
            </p>
            <p>
              Candidate-water defaults (HH &lt; −17 dB; HV &lt; −24 dB) are uncalibrated demonstrations. OPERA agreement, land-cover statistics, exposure, deformation and soil-moisture estimates are not demonstrated. The saved GIBS check advertised the daily layer, but not the requested rolling 12-day layer.
            </p>
            <p>
              Permanent gap: 27 July 2026, 22:03:25 UTC–10 August 2026, 00:55:27 UTC; boundary days can be partial. VALIDATED acquisitions begin 21 October, released 6 November 2026. Reprocessing may change older results. SME2 soil moisture remains preliminary.
            </p>
            <p className="source-line">
              <a href="https://nisar-docs.asf.alaska.edu/gcov/">GCOV product guide</a> ·{' '}
              <a href="https://nisar-docs.asf.alaska.edu/availability-overview/">Availability and quality stages</a>.
            </p>
          </details>
        </section>

        <section className="story-section" id="provenance">
          <h2>Check the source record</h2>
          <p>Inspect sources, retrieval dates and the requests behind this record.</p>
          {evidenceNotice}
          <EvidenceLead evidence={data.evidence?.[0]} />
          {sourcesNotice}
          {recordStatus !== 'ready' && (
            <div className="source-line" data-method-status={recordStatus} role="status">
              <p>
                {recordStatus === 'loading'
                  ? 'Loading detailed source records...'
                  : 'Detailed source records could not be loaded. The explanations remain available.'}
              </p>
              {recordStatus === 'error' && (
                <button onClick={() => setRecordAttempt((n) => n + 1)}>Retry detailed source records</button>
              )}
            </div>
          )}
          {error && <p role="status">{error}</p>}
          <div className="button-row">
            <button
              className="text-link"
              disabled={!data.sources}
              onClick={() =>
                data.sources &&
                downloadText('sources.json', JSON.stringify(data.sources, null, 2), 'application/json')
              }
            >
              Download source index
            </button>
            <button className="text-link" onClick={() => download('inventory.json')}>
              Download scene inventory
            </button>
            <button className="text-link" onClick={() => download('network-status.json')}>
              Download URL audit
            </button>
            <button className="text-link" onClick={() => download('globe/vegetation.json')}>
              Download vegetation record
            </button>
          </div>
          <details className="source-row">
            <summary>Source ledger {record?.sources ? `(${record.sources.length} saved checks)` : ''}</summary>
            <p>Dates are UTC. Web reachability does not establish scientific usability. Maturity and CRID apply to NISAR.</p>
            <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
              <table>
                <caption>Saved source checks: dates in UTC</caption>
                <thead>
                  <tr>
                    <th scope="col">Source and URL</th>
                    <th scope="col">Status</th>
                    <th scope="col">Retrieved</th>
                    <th scope="col">Maturity / CRID</th>
                    <th scope="col">Parameters</th>
                  </tr>
                </thead>
                <tbody>
                  {record?.sources?.map((source, i) => (
                    <tr key={i}>
                      <td>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.name || source.url} ↗
                        </a>
                      </td>
                      <td>{source.status}</td>
                      <td>{source.retrievedAt?.slice(0, 10) || 'not available'}</td>
                      <td>
                        {source.maturity || 'not applicable'} / {source.crid || 'not applicable'}
                      </td>
                      <td>
                        <details>
                          <summary>Request</summary>
                          <pre>{JSON.stringify(source.parameters || {}, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="source-row">
            <summary>Local study boundaries and archive assumptions</summary>
            <p>
              Angat uses the reservoir area near 121.16°E, 14.91°N, supported by an{' '}
              <a href="https://www.napocor.gov.ph/bcsd/bid_files/Bid%20Docs_HO-FFW23-010.pdf">
                NPC dam-station specification
              </a>
              . Piura is an additional case for testing a wet-weather hypothesis. The original 43 supplied headlines are retained with unverified claims labeled.
            </p>
          </details>
        </section>

        <section className="story-section" id="citation">
          <h2>Credit and reuse</h2>
          <p>
            NASA/ISRO NISAR via ASF DAAC and NASA GIBS; MODIS Terra vegetation imagery via GIBS / ESDIS; Blue Marble: NASA Earth Observatory; NOAA CPC; Open-Meteo and ECMWF ERA5; GDELT and each linked publisher. Software is MIT-licensed. Data and imagery retain their providers’ terms.
          </p>
          <details className="source-row">
            <summary>NISAR citation guidance and collection identifiers</summary>
            <blockquote>NISAR follows NASA’s standard Data Use and Citation Guidance.</blockquote>
            <p className="source-line">
              Exact sentence from{' '}
              <a href="https://nisar-docs.asf.alaska.edu/data-use-citation-guidance/">
                ASF’s citation guidance
              </a>
              . Dataset-specific citation text was unavailable: NASA guidance and DOI pages returned 403; CMR supplied DOIs without citation text.
            </p>
            <div className="table-scroll" role="region" aria-label="Scrollable scientific data table" tabIndex={0}>
              <table>
                <caption>NISAR collection identifiers and dataset DOIs</caption>
                <thead>
                  <tr>
                    <th scope="col">Collection</th>
                    <th scope="col">CMR concept</th>
                    <th scope="col">DOI</th>
                  </tr>
                </thead>
                <tbody>
                  {record?.collections?.map((collection) => (
                    <tr key={collection.shortName}>
                      <td>{collection.shortName}</td>
                      <td>{collection.conceptId}</td>
                      <td>
                        <a href={'https://doi.org/' + collection.doi}>{collection.doi}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <WhereToNext
          stepNumber="Complete Cycle · Return to Story or Sites"
          nextHref="#sites/angat"
          nextLabel="Apply These Rules on the Sites Radar Player"
          whyText="Now that you know how radar backscatter, ERA5 weather baselines, and headline tone work, inspect the dated observations at Angat, Central Luzon, Piura, and Dadu."
          secondaryLinks={[
            { href: '#story', label: '← Back to Story' },
            { href: '#globe', label: 'Explore the 3D Globe →' }
          ]}
        />
      </div>
    </section>
  );
}
