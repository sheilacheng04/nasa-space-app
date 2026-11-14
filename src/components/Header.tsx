import { useEffect, useRef, useState } from 'react';
import type { Page } from '../types';

const links: [Page, string][] = [['story', 'Story'], ['sites', 'Sites'], ['globe', 'Globe'], ['media', 'Media'], ['method', 'Data and method']];
function initialTheme() {
  try { return localStorage.getItem('pacific-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { return 'light'; }
}
export function Header({ page, openSearch }: { page: Page; openSearch: () => void }) {
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
    <a className="brand" href="#story" aria-label="The Two-Faced Pacific home"><span className="brand-title"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 19C6 4 19 3 24 14c-8-4-13 2-8 7 4 4 9 1 14 0v8H2Z" fill="currentColor"/></svg>The Two-Faced Pacific</span><small>El Niño × NISAR radar · NASA Space Apps 2026</small></a>
    <nav aria-label="Main navigation">{links.map(([id, name], i) => <a key={id} href={'#' + id} aria-current={page === id ? 'page' : undefined}><span>{i + 1} · </span>{name}</a>)}</nav>
    <div className="header-actions"><button className="icon-button" id="toggle-theme" aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme'} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>◐</button><button className="search-trigger icon-button" id="open-search" aria-label="Search places, sites and news" onClick={openSearch}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg></button></div>
    <div id="reading-progress" ref={progress}/>
  </header>;
}
