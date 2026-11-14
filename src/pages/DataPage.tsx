import { useRef, useState } from 'react';
import { AccountPanel } from '../components/AccountPanel';
import { downloadText, parseCSV } from '../core.js';
import { errorMessage } from '../api/client';
import type { Observation } from '../types';

export function DataPage({active, points, update}: {active: boolean; points: Observation[]; update: (rows: Observation[]) => boolean}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  function importRows() {
    try {
      const rows = parseCSV(text);
      const persisted = update(rows);
      setSelected(undefined);
      setStatus('Imported ' + rows.length + ' observations. ' + (persisted ? 'Saved only in this browser.' : 'Browser storage unavailable; these points will last for this session.'));
    } catch (error) { setStatus(errorMessage(error)); }
  }
  return <section id="page-data" className="page" hidden={!active}>
    <div className="wrap page-intro"><p className="eyebrow">Your observations</p><h1>Bring your own evidence.</h1><p className="dek">Place field observations on the globe. Keep them in this browser, or explicitly save them to your private account.</p></div>
    <div className="wrap data-layout"><section>
      <label className="field-label" htmlFor="csv-input">Paste CSV data</label><textarea id="csv-input" className="csv-input" spellCheck={false} placeholder="name,lat,lng,value,category,date" value={text} onChange={e => setText(e.target.value)}/>
      <label className="file-label">Or choose a CSV file<input type="file" id="csv-file" accept=".csv,text/csv" ref={file} onChange={async event => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;
        if (selectedFile.size > 1000000) { setStatus('The CSV must be smaller than 1 MB.'); return; }
        try { setText(await selectedFile.text()); setStatus('Loaded ' + selectedFile.name + '. Review the text, then import.'); }
        catch { setStatus('This file could not be read.'); }
      }}/></label>
      <div className="button-row"><button className="button primary" id="import-csv" onClick={importRows}>Import observations</button><button className="button secondary" id="csv-template" onClick={() => downloadText('observations-template.csv', 'name,lat,lng,value,category,date\n', 'text/csv')}>Download template</button><button className="text-link" id="clear-csv" onClick={() => {
        const cleared = update([]); setText(''); setSelected(undefined); if (file.current) file.current.value = ''; setStatus(cleared ? 'Saved observations cleared from this browser.' : 'Observations cleared for this session. Browser storage could not be updated.');
      }}>Clear saved data</button></div><p id="csv-status" role="status">{status}</p>
    </section><aside><p className="eyebrow">A simple data contract</p><h2>A location is the starting point.</h2><p><code>lat</code> and <code>lng</code> are required. Add <code>name</code>, <code>value</code>, <code>category</code> and <code>date</code> when available.</p><p>Coordinates use decimal degrees. Up to 2,000 rows and 1 MB per upload. Invalid rows are reported before import.</p><p>Imported values keep their own units. We do not infer water stress or heat from a location.</p><a className="text-link" href="#globe">View on the globe ↗</a></aside>
    <div id="csv-preview" className="data-preview">{points.length ? <><p className="source-line">{points.length} user-supplied observations. First 50 shown below.</p><table><thead><tr>{['Place', 'Latitude', 'Longitude', 'Value', 'Category / unit', 'Date'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{points.slice(0,50).map((p,i) => <tr key={i}><td>{p.name}</td><td>{p.lat}</td><td>{p.lng}</td><td>{p.value ?? '—'}</td><td>{p.category}</td><td>{p.date}</td></tr>)}</tbody></table></> : <p className="empty-chart">No observations imported yet. Add your field data to see it here and on the globe.</p>}</div>
    <AccountPanel points={points} load={rows => { const saved = update(rows); if (!saved) setStatus('Dataset opened for this session. Browser storage is unavailable.'); }} selected={selected} select={setSelected}/>
    </div>
  </section>;
}
