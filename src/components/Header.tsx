import { useEffect, useRef, useState } from 'react';
import type { Page } from '../types';

const links: [Page, string][] = [['story', 'Story'], ['sites', 'Sites'], ['globe', 'Globe'], ['media', 'Media'], ['method', 'Data and method']];
export function initialTheme() {
  try { return localStorage.getItem('pacific-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { return 'light'; }
}
export function Header({ page, openSearch, openGuide }: { page: Page; openSearch: () => void; openGuide?: () => void }) {
  const [theme, setTheme] = useState(initialTheme);
  const header = useRef<HTMLElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('pacific-theme', theme); } catch {}
  }, [theme]);
  useEffect(() => {
    if (!header.current) return;
    const resize = new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', header.current!.getBoundingClientRect().height + 'px'));
    resize.observe(header.current);
    const scroll = () => { const root = document.documentElement; if (progress.current) progress.current.style.width = (root.scrollHeight > innerHeight ? 100 * scrollY / (root.scrollHeight - innerHeight) : 0) + '%'; };
    addEventListener('scroll', scroll, {passive: true});
    return () => { resize.disconnect(); removeEventListener('scroll', scroll); };
  }, []);
  return <header className="site-header" ref={header}>
    <a className="brand" href="#story" aria-label="The Two-Faced Pacific home"><span className="brand-title"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2A14 14 0 0 0 2 16c5-5 9-5 14 0S25 21 30 16A14 14 0 0 0 16 2Z" fill="var(--blue)"/><path d="M2 16a14 14 0 0 0 28 0c-5 5-9 5-14 0S7 11 2 16Z" fill="var(--orange)"/><path d="M6 10a12 12 0 0 1 10-5" fill="none" stroke="var(--card)" strokeWidth="1.5" strokeLinecap="round"/></svg>The Two-Faced Pacific</span><small>NISAR radar · NASA Space Apps 2026</small></a>
    <nav aria-label="Five-step navigation">{links.map(([id, name]) => <a key={id} href={'#' + id} aria-current={page === id ? 'page' : undefined}>{name}</a>)}</nav>
    <div className="header-actions">{openGuide && <button className="icon-button" id="open-guide" type="button" aria-label="Open 3-step guide" title="How to use this observatory (3-step guide)" onClick={openGuide}>?</button>}<button className="icon-button" id="toggle-theme" aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme'} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg></button><button className="search-trigger icon-button" id="open-search" aria-label="Search places, sites and news" onClick={openSearch}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg></button></div>
    <div id="reading-progress" ref={progress}/>
  </header>;
}
