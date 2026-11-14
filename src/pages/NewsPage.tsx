import { useMemo, useState } from 'react';
import { analyzeAI, errorMessage } from '../api/client';
import { finite, formatDate, localTone, safeURL } from '../core.js';
import type { Analysis, Headline, News } from '../types';

function aiDescription(result: Analysis) {
  return 'AI tone: ' + result.score.toFixed(2) + '\n' + result.summary + '\n' + result.caveat;
}
function NewsItem({item}: {item: Headline}) {
  const [result, setResult] = useState(item.ai ? aiDescription(item.ai) : 'Not scored by AI');
  const [busy, setBusy] = useState(false);
  async function analyze() {
    setBusy(true); setResult('Analyzing…');
    try { setResult(aiDescription(await analyzeAI(item.title))); }
    catch (error) { setResult(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <article className="news-item">
    <div className="news-meta"><span>{formatDate(item.date)}</span><span>{item.source}</span></div>
    <div><h3><a href={safeURL(item.url)} target="_blank" rel="noopener">{item.title} ↗</a></h3><p className="tagline">{item.region || 'Unclassified'} / {item.theme || 'Climate'} · {item.verification || 'Source review pending'}</p></div>
    <div className="sentiment">Headline tone<strong>{finite(item.vader) ? item.vader.toFixed(2) : 'Pending'}</strong>{finite(item.vaderAdjusted) ? 'Adjusted tone: ' + item.vaderAdjusted.toFixed(2) : 'Not scored yet'}<br/><button className="text-link" data-ai-item={item.id} disabled={busy} onClick={analyze}>Explain headline tone</button><p className="ai-result" role="status" aria-atomic="true">{result}</p></div>
  </article>;
}
export function NewsPage({active, news}: {active: boolean; news: News}) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('newest');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const regions = useMemo(() => [...new Set(news.items.map(n => n.region).filter(Boolean))].sort(), [news]);
  const items = useMemo(() => news.items.filter(n => (!region || n.region === region) && (n.title + ' ' + n.source + ' ' + n.theme).toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === 'tone' ? (a.vaderAdjusted ?? a.vader ?? 2) - (b.vaderAdjusted ?? b.vader ?? 2) : sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)), [query, region, sort, news]);
  async function analyze(ai: boolean) {
    if (!text.trim()) { setOutput('Enter some text first.'); return; }
    if (!ai) { const result = localTone(text); setOutput(result.method + ': ' + result.score.toFixed(2) + ' (−1 to +1).\n' + result.negative + ' risk words and ' + result.positive + ' recovery words.\nThis simple count misses context, negation and irony. It is not a measure of scientific confidence.'); return; }
    setBusy(true); setOutput('Requesting an AI reading…');
    try { setOutput(aiDescription(await analyzeAI(text))); }
    catch (error) { setOutput(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <section id="page-news" className="page" hidden={!active}>
    <div className="wrap page-intro"><p className="eyebrow">People, places and reporting</p><h1>The human side of a changing climate</h1><p className="dek">Explore how climate and water stories are reported around the world. The tone scores describe the words in a headline, not how dangerous an event is or whether a claim is true.</p></div>
    <div className="wrap"><div className="news-toolbar">
      <label>Search headlines<input type="search" id="news-search" placeholder="Rainfall, farming, water..." value={query} onChange={e => setQuery(e.target.value)}/></label>
      <label>Region<select id="news-region" value={region} onChange={e => setRegion(e.target.value)}><option value="">All regions</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
      <label>Sort<select id="news-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="tone">Most negative wording first</option></select></label>
    </div><p id="news-status" className="source-line">{items.length} of {news.items.length} headlines · {news.status === 'archive' ? 'Supplied archive; links and reported claims need review.' : 'GDELT headline snapshot; source claims are not independently verified.'} {news.retrievedAt && 'Retrieved ' + formatDate(news.retrievedAt) + '.'} VADER is a text-scoring method: -1 is more negative wording, +1 more positive. It does not measure public opinion.</p>
    <div id="news-list">{items.length ? items.map(n => <NewsItem key={n.id} item={n}/>) : <p className="empty-chart">No headlines match these filters.</p>}</div>
    <section className="analysis-lab"><div><p className="eyebrow">A closer reading</p><h2>What does this headline sound like?</h2><p>Compare a simple count of positive and negative words with an optional AI explanation. Both can miss context, irony and the difference between a warning and a confirmed event.</p></div><div>
      <label className="field-label" htmlFor="analysis-text">Text to analyze</label><textarea id="analysis-text" maxLength={4000} placeholder="Paste a short news excerpt or headline…" value={text} onChange={e => setText(e.target.value)}/>
      <div className="button-row"><button className="button primary" id="analyze-local" onClick={() => void analyze(false)}>Count tone words</button><button className="button secondary" id="analyze-ai" disabled={busy} onClick={() => void analyze(true)}>Explain the tone</button></div>
      <p className="source-line">Without a connected AI service, the explanation is a clearly labeled local simulation. Treat it as a reading aid and check the original article.</p><div id="analysis-output" role="status">{output}</div>
    </div></section></div>
  </section>;
}
