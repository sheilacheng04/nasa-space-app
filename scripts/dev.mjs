import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const mode = process.argv[2] || 'dev';
const python = process.env.PYTHON || (process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
if (!existsSync(python) && !process.env.PYTHON) {
  console.error('Create .venv, then install backend/requirements-dev.txt. See README.md.');
  process.exit(1);
}
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => { children.delete(child); if (!stopping) stop(code ?? (signal ? 1 : 0)); });
  return child;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
if (mode === 'test') run(python, ['-m', 'pytest', 'backend/tests', '-q', '-p', 'no:cacheprovider']);
else if (mode === 'start' || mode === 'preview') run(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', process.env.PORT || '4173']);
else if (mode === 'api') run(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', process.env.API_PORT || '8000']);
else {
  run(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', process.env.API_PORT || '8000']);
  const origin = 'http://127.0.0.1:' + (process.env.API_PORT || '8000');
  let ready = false;
  for (let attempt = 0; attempt < 80 && !stopping; attempt++) {
    try { const response = await fetch(origin + '/api/health'); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) { console.error('API failed to become ready. Check the backend output above.'); stop(1); }
  else run(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', ...process.argv.slice(3)]);
}
