import { useEffect, useState } from 'react';
import { bootstrap, errorMessage, hosted } from './api/client';
import { loadSaved } from './core.js';
import { initLocalWindow } from './local-window.js';
import { Header } from './components/Header';
import { Search } from './components/Search';
import { StoryPage } from './pages/StoryPage';
import { GlobePage } from './pages/GlobePage';
import { ObservatoryPage } from './pages/ObservatoryPage';
import { NewsPage } from './pages/NewsPage';
import { DataPage } from './pages/DataPage';
import { LocalPage } from './pages/LocalPage';
import { MethodPage } from './pages/MethodPage';
import type { Bootstrap, Observation, Page, Place } from './types';

const pages: Page[] = ['story', 'globe', 'observatory', 'local', 'news', 'data', 'method'];
function currentRoute(): {page: Page; sub: string} {
  let [page, sub = ''] = location.hash.slice(1).split('/');
  if (page === 'observatory' && sub === 'globe') { page = 'globe'; sub = ''; history.replaceState(null, '', '#globe'); }
  return {page: pages.includes(page as Page) ? page as Page : 'story', sub};
}
export function App() {
  const [route, setRoute] = useState(currentRoute);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [points, setPoints] = useState<Observation[]>(loadSaved);
  const [search, setSearch] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [lastSite, setLastSite] = useState('luzon');
  const {page, sub} = route;
  useEffect(() => { const changed = () => setRoute(currentRoute()); addEventListener('hashchange', changed); return () => removeEventListener('hashchange', changed); }, []);
  useEffect(() => {
    let active = true;
    setFailure('');
    bootstrap().then(value => { if (active) setData(value); }).catch(error => { if (active) setFailure(errorMessage(error)); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => { if (data) initLocalWindow(); }, [data]);
  useEffect(() => {
    document.body.dataset.view = page;
    const titles = {story: 'The Two-Faced Pacific', globe: 'Globe', observatory: 'Observatory', news: 'News & signals', data: 'My data', local: 'A local story', method: 'Data & method'};
    document.title = titles[page] + ' — The Two-Faced Pacific';
    window.scrollTo({top: 0, behavior: 'instant'});
    document.getElementById('main')?.focus({preventScroll: true});
  }, [page]);
  useEffect(() => {
    if (!data) return;
    if (page === 'observatory' && data.sites.some(site => site.id === sub)) setLastSite(sub);
    if (page === 'story' && sub === 'ocean') document.getElementById('ocean')?.scrollIntoView();
    if (page === 'method' && sub) document.getElementById('method-' + sub)?.scrollIntoView();
  }, [page, sub, data]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearch(value => !value); } };
    addEventListener('keydown', keyboard);
    return () => removeEventListener('keydown', keyboard);
  }, []);
  function update(rows: Observation[]) {
    setPoints(rows);
    try { if (rows.length) localStorage.setItem('pacific-observations', JSON.stringify(rows)); else localStorage.removeItem('pacific-observations'); return true; }
    catch { return false; }
  }
  const site = data?.sites.find(item => item.id === (page === 'observatory' && sub ? sub : lastSite)) || data?.sites[0];
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <Header page={page} openSearch={() => setSearch(true)}/>
    <div className="edition" hidden>NASA Space Apps 2026 · Dancing with the SARs</div>
    {!hosted && <div className="demo-ribbon">SELF-CONTAINED DEMO · Live APIs and account storage are disabled. Illustrations are labeled.</div>}
    <main id="main" tabIndex={-1}>
      {!data ? <div className="wrap" role="status">{failure ? <><h1>Unable to load the observatory</h1><p>{failure}</p><button className="button primary" onClick={() => setAttempt(value => value + 1)}>Retry</button></> : <p>Loading the observatory…</p>}</div> : <>
        <StoryPage active={page === 'story'} data={data}/>
        <GlobePage active={page === 'globe'} sites={data.sites} points={points} place={place}/>
        <ObservatoryPage active={page === 'observatory'} site={site!} sites={data.sites}/>
        <NewsPage active={page === 'news'} news={data.news}/>
        <DataPage active={page === 'data'} points={points} update={update}/>
        <LocalPage active={page === 'local'} site={data.sites.find(s => s.id === 'angat') || data.sites[0]}/>
        <MethodPage active={page === 'method'} data={data}/>
      </>}
    </main>
    <footer className="site-footer wrap"><a className="footer-brand" href="#story">The Two-Faced Pacific</a><p>A climate story. An observation tool. An open question.</p><a href="#local">Local story</a><a href="#method">Sources & methodology ↗</a><span className="mono">NASA Space Apps / 2026</span></footer>
    {data && <Search open={search} close={() => setSearch(false)} data={data} locate={found => { setPlace(found); location.hash = 'globe'; }}/>}
  </>;
}
