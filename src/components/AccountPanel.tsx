import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { account, ApiError, errorMessage, hosted } from '../api/client';
import type { Dataset, Observation, User } from '../types';

export function AccountPanel({points, load, selected, select}: {points: Observation[]; load: (rows: Observation[]) => void; selected: string | undefined; select: (id: string | undefined) => void}) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Field observations');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    if (!hosted) { setBusy(false); return; }
    let active = true;
    account.me().then(async result => {
      if (!active) return;
      setUser(result.user);
      if (result.user) {
        const saved = await account.list();
        if (active) setDatasets(saved.datasets);
      }
    }).catch(error => { if (active) setStatus(errorMessage(error)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setStatus('');
    try { await action(); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) { setUser(null); setDatasets([]); select(undefined); }
      setStatus(errorMessage(error));
    } finally { setBusy(false); }
  }
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      const result = await account.authenticate(mode, username, password);
      setUser(result.user); setPassword('');
      setDatasets((await account.list()).datasets);
      setStatus(mode === 'register' ? 'Account created. Choose Save to account to upload observations.' : 'Signed in. Your saved datasets are available below.');
    });
  }
  async function save(copy = false) {
    await perform(async () => {
      const result = await account.save(name.trim(), points, copy ? undefined : selected);
      setDatasets(current => [result, ...current.filter(item => item.id !== result.id)]);
      select(result.id);
      setStatus('Saved ' + result.rowCount + ' observations to your account.');
    });
  }
  if (!hosted) return <section className="account-panel"><h2>Saved datasets</h2><p>Account storage is available in the full application. This offline preview keeps observations in this browser.</p></section>;
  return <section className="account-panel" aria-labelledby="account-heading">
    <div className="section-title"><div><p className="eyebrow">Your workspace</p><h2 id="account-heading">Saved datasets</h2></div>{user && <button id="account-logout" className="text-link" disabled={busy} onClick={() => void perform(async () => {
      await account.logout(); setUser(null); setDatasets([]); select(undefined); setStatus('Signed out. Browser observations are still available.');
    })}>Sign out</button>}</div>
    <p>Your imports stay in this browser until you choose <strong>Save to account</strong>. Saved datasets are private to your account.</p>
    {!user ? <form className="account-form" onSubmit={authenticate}>
      <div className="button-row" role="group" aria-label="Account action"><button type="button" className="button secondary" aria-pressed={mode === 'login'} disabled={busy} onClick={() => setMode('login')}>Sign in</button><button type="button" className="button secondary" aria-pressed={mode === 'register'} disabled={busy} onClick={() => setMode('register')}>Create account</button></div>
      <label htmlFor="account-username">Username<input id="account-username" autoComplete="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_-]+" value={username} onChange={e => setUsername(e.target.value)}/></label>
      <label htmlFor="account-password">Password<input id="account-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)}/></label>
      <p className="source-line">Use 3–32 letters, numbers, underscores or hyphens for your username, and at least 12 characters for your password.</p>
      <button id="account-submit" className="button primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</button>
    </form> : <>
      <p id="account-user">Signed in as <strong>{user.username}</strong></p>
      <label htmlFor="dataset-name">Dataset name<input id="dataset-name" value={name} required maxLength={120} onChange={e => setName(e.target.value)}/></label>
      <div className="button-row"><button id="save-dataset" className="button primary" disabled={busy || !points.length || !name.trim()} onClick={() => void save()}>{selected ? 'Update saved dataset' : 'Save to account'}</button>{selected && <button className="button secondary" disabled={busy || !points.length || !name.trim()} onClick={() => void save(true)}>Save a copy</button>}<button className="text-link" disabled={busy} onClick={() => void perform(async () => { setDatasets((await account.list()).datasets); setStatus('Dataset list refreshed.'); })}>Refresh saved datasets</button></div>
      <div id="saved-datasets">{datasets.length ? datasets.map(item => <article className="saved-dataset" key={item.id}>
        <div><h3>{item.name}</h3><p className="source-line">{item.rowCount} observations · saved {new Date(item.updatedAt * 1000).toLocaleDateString()}</p></div>
        <div className="button-row"><button className="button secondary" disabled={busy} onClick={() => void perform(async () => {
          const result = await account.get(item.id); load(result.observations); select(item.id); setName(result.name); setStatus('Opened ' + result.name + ' in this browser and on the globe.');
        })}>Open</button><a className="text-link" href={'/api/datasets/' + item.id + '/export.csv'} download>Download CSV</a><button className="text-link" disabled={busy} onClick={() => setDeleting(item.id)}>Delete</button></div>
        {deleting === item.id && <div role="group" aria-label="Confirm dataset deletion"><p>Delete this saved dataset from your account?</p><div className="button-row"><button className="button secondary" disabled={busy} onClick={() => void perform(async () => {
          await account.remove(item.id); setDatasets(current => current.filter(d => d.id !== item.id)); if (selected === item.id) select(undefined); setDeleting(null); setStatus('Saved dataset deleted. Browser observations remain available.');
        })}>Confirm delete</button><button className="text-link" onClick={() => setDeleting(null)}>Cancel</button></div></div>}
      </article>) : <p className="empty-chart">No saved datasets yet. Import observations, give them a name, then save.</p>}</div>
    </>}
    <p id="account-status" role="status" className="source-line">{status}</p>
  </section>;
}
