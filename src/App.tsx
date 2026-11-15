import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataFile, hosted } from './api/client';
import { loadSaved } from './core.js';
import { initLocalWindow } from './local-window.js';
import { Header } from './components/Header';
import { Background } from './components/Background';
import { Search } from './components/Search';
import { StoryPage } from './pages/StoryPage';
import { GlobePage } from './pages/GlobePage';
import { SitesPage } from './pages/SitesPage';
import { NewsPage } from './pages/NewsPage';
import { MethodPage } from './pages/MethodPage';
import { EvidenceLead } from './components/EvidenceLead';
import { FirstVisitGuide, GUIDE_STORAGE_KEY } from './components/FirstVisitGuide';
import { readRoute, siteHash, globeHash } from './selection-url.js';
import type { SiteSelection, GlobeSelection, HistoryMode } from './selection-url.js';
import { useStartupData } from './useStartupData';
import { DatasetNotice } from './components/DatasetNotice';
import type { DatasetKey } from './startup-data.js';
import type { NewsByPlaceData, Observation, Place, PlaceEntry } from './types';

const currentRoute = () => readRoute(location.hash);

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const { data: rawData, states, retry } = useStartupData();
  const [places, setPlaces] = useState<PlaceEntry[]>([]);
  const [newsByPlace, setNewsByPlace] = useState<NewsByPlaceData | undefined>(undefined);

  useEffect(() => {
    let active = true;
    dataFile<PlaceEntry[]>('places.json')
      .then((res) => {
        if (active && Array.isArray(res)) setPlaces(res);
      })
      .catch(() => {});
    dataFile<NewsByPlaceData>('news-by-place.json')
      .then((res) => {
        if (active && res && Array.isArray(res.items)) setNewsByPlace(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const data = useMemo(
    () => (rawData ? { ...rawData, places, newsByPlace: newsByPlace || undefined } : null),
    [rawData, places, newsByPlace]
  );
  const initialized = Boolean(data);
  const optionalData = {
    news: states.news.data,
    sources: states.sources.data,
    evidence: states.evidence.data
  };
  const routeReady = route.page === 'media' || route.page === 'method' || initialized;
  const labels = {
    sites: 'study sites',
    enso: 'NOAA ocean context',
    news: 'news archive',
    evidence: 'radar preview summaries',
    sources: 'source index'
  };
  const notice = (key: DatasetKey) => (
    <DatasetNotice label={labels[key]} state={states[key]} retry={() => retry(key)} />
  );
  const [points] = useState<Observation[]>(loadSaved);
  const [search, setSearch] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideManual, setGuideManual] = useState(false);

  const dismissGuide = useCallback(() => {
    setGuideOpen(false);
    setGuideManual(false);
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, '1');
    } catch {}
  }, []);

  const openGuide = useCallback(() => {
    setGuideOpen(true);
    setGuideManual(true);
  }, []);

  const lastHash = useRef(location.hash);
  const [navigationKey, setNavigationKey] = useState(0);

  useEffect(() => {
    const changed = () => {
      if (lastHash.current === location.hash) return;
      lastHash.current = location.hash;
      setRoute(currentRoute());
      setNavigationKey((n) => n + 1);
    };
    addEventListener('hashchange', changed);
    addEventListener('popstate', changed);
    return () => {
      removeEventListener('hashchange', changed);
      removeEventListener('popstate', changed);
    };
  }, []);

  const writeHash = useCallback((hash: string, mode: HistoryMode = 'push') => {
    if (location.hash === hash) return;
    history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', hash);
    lastHash.current = hash;
    setRoute(currentRoute());
  }, []);

  const selectSite = useCallback(
    (siteId: string, selection: SiteSelection, mode: HistoryMode = 'push') => {
      if (currentRoute().page === 'sites') writeHash(siteHash(siteId, selection), mode);
    },
    [writeHash]
  );

  const selectGlobe = useCallback(
    (selection: GlobeSelection, mode: HistoryMode = 'push') => {
      if (currentRoute().page === 'globe') writeHash(globeHash(selection), mode);
    },
    [writeHash]
  );

  useEffect(() => {
    if (data) initLocalWindow();
  }, [initialized]);

  useEffect(() => {
    document.body.dataset.view = route.page;
    document.title =
      {
        story: 'From ocean to everyday life',
        sites: 'Sites',
        globe: 'Globe',
        media: 'Media',
        method: 'Data and method'
      }[route.page] + ' | The Two-Faced Pacific';
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('main')?.focus({ preventScroll: true });
    if (route.sub && route.page !== 'sites' && route.page !== 'globe' && route.page !== 'media') {
      setTimeout(() => {
        const target = document.getElementById(route.sub);
        if (target instanceof HTMLDetailsElement) target.open = true;
        target?.scrollIntoView();
      }, 100);
    }
  }, [route.page, route.sub, routeReady]);

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((x) => !x);
      }
    };
    addEventListener('keydown', keys);
    return () => removeEventListener('keydown', keys);
  }, []);

  const site =
    data?.sites.find((s) => s.id === route.sub) ||
    data?.sites.find((s) => s.id === 'angat') ||
    data?.sites[0];

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <Header page={route.page} openSearch={() => setSearch(true)} openGuide={openGuide} />
      {!hosted && (
        <div className="demo-ribbon">
          OFFLINE EDITION · Real browse thumbnails and saved source data. Simulated examples are labeled.
        </div>
      )}
      <FirstVisitGuide open={guideOpen && (route.page === 'story' || guideManual)} onDismiss={dismissGuide} />
      <main id="main" tabIndex={-1}>
        {!data ? (
          <div className="wrap" hidden={route.page === 'media' || route.page === 'method'}>
            {notice('sites')}
          </div>
        ) : (
          <>
            <StoryPage
              oceanNotice={notice('enso')}
              evidenceNotice={notice('evidence')}
              active={route.page === 'story'}
              data={data}
            />
            <SitesPage
              active={route.page === 'sites'}
              site={site!}
              sites={data.sites}
              places={places}
              newsByPlace={newsByPlace}
              requestedPlaceId={route.sub}
              selection={route.siteSelection}
              onSelection={selectSite}
              navigationKey={navigationKey}
            />
            <div hidden={route.page !== 'globe'} className="globe-evidence">
              {notice('evidence')}
              <EvidenceLead evidence={data.evidence?.[0]} />
            </div>
            <GlobePage
              oceanNotice={notice('enso')}
              newsNotice={notice('news')}
              active={route.page === 'globe'}
              sites={data.sites}
              places={places}
              newsByPlace={newsByPlace}
              points={points}
              place={place}
              enso={data.enso}
              news={data.news}
              selection={route.globeSelection}
              onSelection={selectGlobe}
              navigationKey={navigationKey}
            />
          </>
        )}
        <div hidden={route.page !== 'media'} className="wrap compact">
          {notice('evidence')}
        </div>
        <NewsPage
          sites={optionalData.sites}
          notice={notice('news')}
          active={route.page === 'media'}
          news={optionalData.news}
          places={places}
          newsByPlace={newsByPlace}
          requestedPlaceId={route.page === 'media' ? route.sub : undefined}
        />
        <MethodPage
          newsNotice={notice('news')}
          sourcesNotice={notice('sources')}
          evidenceNotice={notice('evidence')}
          active={route.page === 'method'}
          data={optionalData}
        />
      </main>
      <footer className="site-footer wrap">
        <a className="footer-brand" href="#story">
          The Two-Faced Pacific
        </a>
        <p>A changing ocean. A closer look at life on land.</p>
        <a href="#story/local">Community perspectives</a>
        <a href="#method">Sources and limits ↗</a>
        <span className="mono">NASA Space Apps / 2026</span>
        <Background page={route.page} />
      </footer>
      <Search
        sitesNotice={!data ? notice('sites') : null}
        newsNotice={notice('news')}
        open={search}
        close={() => setSearch(false)}
        data={{ sites: data?.sites, places, news: optionalData.news }}
        locate={(found) => {
          setPlace(found);
          if (currentRoute().page !== 'globe') location.hash = 'globe';
        }}
      />
    </>
  );
}
