import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataFile, hosted } from './api/client';
import { loadSaved } from './core.js';
import { Header } from './components/Header';
import { Background } from './components/Background';
import { Search } from './components/Search';
import { StoryPage } from './pages/StoryPage';
import { GlobePage } from './pages/GlobePage';
import { EvidenceLead } from './components/EvidenceLead';
import { FirstVisitGuide, GUIDE_STORAGE_KEY } from './components/FirstVisitGuide';
import { readRoute, siteHash, globeHash } from './selection-url.js';
import type { SiteSelection, GlobeSelection, HistoryMode } from './selection-url.js';
import { useStartupData } from './useStartupData';
import { DatasetNotice } from './components/DatasetNotice';
import type { DatasetKey } from './startup-data.js';
import type { NewsByPlaceData, Observation, Page, Place, PlaceEntry } from './types';

const loadSitesPage = () => import('./pages/SitesPage').then((m) => ({ default: m.SitesPage }));
const loadNewsPage = () => import('./pages/NewsPage').then((m) => ({ default: m.NewsPage }));
const loadMethodPage = () => import('./pages/MethodPage').then((m) => ({ default: m.MethodPage }));

const SitesPage = lazy(loadSitesPage);
const NewsPage = lazy(loadNewsPage);
const MethodPage = lazy(loadMethodPage);

const currentRoute = () => readRoute(location.hash);

export function App() {
  const [route, setRoute] = useState(currentRoute);
  const { data: rawData, states, retry } = useStartupData();
  const [places, setPlaces] = useState<PlaceEntry[]>([]);
  const [newsByPlace, setNewsByPlace] = useState<NewsByPlaceData | undefined>(undefined);
  const [visitedPages, setVisitedPages] = useState<Record<string, boolean>>(() => ({
    [route.page]: true
  }));

  useEffect(() => {
    setVisitedPages((prev) => (prev[route.page] ? prev : { ...prev, [route.page]: true }));
    if (route.page === 'sites') void loadSitesPage();
    else if (route.page === 'media') void loadNewsPage();
    else if (route.page === 'method') void loadMethodPage();
  }, [route.page]);

  const hasVisited = (page: Page) => route.page === page || Boolean(visitedPages[page]);

  const [points] = useState<Observation[]>(loadSaved);
  const [search, setSearch] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);

  const needsPlaceContext =
    route.page === 'sites' || route.page === 'globe' || route.page === 'media' || search;

  useEffect(() => {
    if (!needsPlaceContext) return;
    let active = true;
    if (!places.length) {
      dataFile<PlaceEntry[]>('places.json')
        .then((res) => {
          if (active && Array.isArray(res)) setPlaces(res);
        })
        .catch(() => {});
    }
    if (!newsByPlace) {
      dataFile<NewsByPlaceData>('news-by-place.json')
        .then((res) => {
          if (active && res && Array.isArray(res.items)) setNewsByPlace(res);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [needsPlaceContext, places.length, newsByPlace]);

  const data = useMemo(
    () => (rawData ? { ...rawData, places, newsByPlace: newsByPlace || undefined } : null),
    [rawData, places, newsByPlace]
  );
  const initialized = Boolean(data);
  const optionalData = {
    sites: states.sites.data || [],
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

  const [guideOpen, setGuideOpen] = useState(false);

  const dismissGuide = useCallback(() => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, '1');
    } catch {}
  }, []);

  const openGuide = useCallback(() => {
    setGuideOpen(true);
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
      <Header
        page={route.page}
        openSearch={() => setSearch(true)}
        openGuide={openGuide}
        guideOpen={guideOpen}
      />
      {!hosted && (
        <div className="demo-ribbon">
          OFFLINE EDITION · Real browse thumbnails and saved source data. Simulated examples are labeled.
        </div>
      )}
      <FirstVisitGuide open={guideOpen} onDismiss={dismissGuide} />
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
            {hasVisited('sites') ? (
              <Suspense
                fallback={
                  <section id="page-sites" className="page wrap" hidden={route.page !== 'sites'} aria-busy="true">
                    <div className="card" role="status">
                      <h2>Study Sites &amp; Radar Frames</h2>
                      <p>Loading study sites, dated NISAR radar frames, and local weather records…</p>
                    </div>
                  </section>
                }
              >
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
              </Suspense>
            ) : (
              <section id="page-sites" className="page wrap" hidden />
            )}
            <div hidden={route.page !== 'globe'} className="globe-evidence">
              {notice('evidence')}
              {hasVisited('globe') && <EvidenceLead evidence={data.evidence?.[0]} />}
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
        {hasVisited('media') ? (
          <Suspense
            fallback={
              <section id="page-news" className="page wrap" hidden={route.page !== 'media'} aria-busy="true">
                <div className="card" role="status">
                  <h2>Media &amp; Regional Overview</h2>
                  <p>Loading news archive and regional impact breakdown…</p>
                </div>
              </section>
            }
          >
            <NewsPage
              sites={optionalData.sites}
              notice={notice('news')}
              active={route.page === 'media'}
              news={optionalData.news}
              places={places}
              newsByPlace={newsByPlace}
              requestedPlaceId={route.page === 'media' ? route.sub : undefined}
            />
          </Suspense>
        ) : (
          <section id="page-news" className="page wrap" hidden />
        )}
        {hasVisited('method') ? (
          <Suspense
            fallback={
              <section id="page-method" className="page wrap" hidden={route.page !== 'method'} aria-busy="true">
                <div className="card" role="status">
                  <h2>Data and Method</h2>
                  <p>Loading source ledger, calibration notes, and scientific limits…</p>
                </div>
              </section>
            }
          >
            <MethodPage
              newsNotice={notice('news')}
              sourcesNotice={notice('sources')}
              evidenceNotice={notice('evidence')}
              active={route.page === 'method'}
              data={optionalData}
            />
          </Suspense>
        ) : (
          <section id="page-method" className="page wrap" hidden />
        )}
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
