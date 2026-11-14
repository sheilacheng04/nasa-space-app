import type { Analysis, Bootstrap, Dataset, Observation, Place, SavedDataset, Site, User, Weather } from '../types';

export const hosted = !globalThis.__PACIFIC_DEMO__;
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function request<T>(url: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
  const { timeout = 12000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') headers.set('X-Pacific-Request', '1');
  try {
    const response = await fetch(url, { ...init, headers, credentials: 'same-origin', signal: controller.signal });
    if (response.status === 204) return undefined as T;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new ApiError('The application API is unavailable. Start both servers with npm run dev.', response.status);
    const body = await response.json();
    if (!response.ok) {
      const details = body.issues?.map((item: {field: string; message: string}) => item.field + ': ' + item.message).join(' ');
      throw new ApiError(details || body.error || 'The request could not be completed.', response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new ApiError('The request timed out. Please try again.', 408);
    if (error instanceof TypeError) throw new ApiError('Cannot reach the application server. Check your connection and retry.', 0);
    throw error;
  } finally { clearTimeout(timer); }
}
export function dataFile<T = unknown>(path: string): Promise<T> {
  if (!hosted) {
    const data = globalThis.__PACIFIC_DATA__?.[path];
    return data === undefined ? Promise.reject(new Error('This file is not included in the offline demo.')) : Promise.resolve(structuredClone(data) as T);
  }
  return request<T>('/api/data/' + path);
}
export async function bootstrap(): Promise<Bootstrap> {
  if (hosted) return request<Bootstrap>('/api/bootstrap');
  const [sites, news, enso, sources] = await Promise.all([
    dataFile<Bootstrap['sites']>('sites.json'), dataFile<Bootstrap['news']>('news.json'),
    dataFile<Bootstrap['enso']>('enso.json'), dataFile<Bootstrap['sources']>('sources.json'),
  ]);
  return { sites, news, enso, sources };
}
export function weather(site: Site): Promise<Weather> {
  if (!hosted) throw new Error('Live weather is disabled in the offline demo.');
  return request<Weather>('/api/weather/' + encodeURIComponent(site.id));
}
export async function geocode(query: string): Promise<Place[]> {
  if (!hosted) throw new Error('World search is disabled in the offline demo.');
  return (await request<{ features: Place[] }>('/api/geocode?q=' + encodeURIComponent(query))).features;
}
function json<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  return request<T>('/api/' + path, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
}
export function analyzeAI(text: string) {
  if (!hosted) throw new Error('AI is unavailable in the offline demo.');
  return request<Analysis>('/api/analyze', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({text}), timeout: 28000});
}
export const account = {
  me: () => request<{ user: User | null }>('/api/auth/me'),
  authenticate: (mode: 'login' | 'register', username: string, password: string) => json<{ user: User }>('auth/' + mode, {username, password}),
  logout: () => request<void>('/api/auth/logout', {method: 'POST'}),
  list: () => request<{ datasets: Dataset[] }>('/api/datasets'),
  get: (id: string) => request<SavedDataset>('/api/datasets/' + encodeURIComponent(id)),
  save: (name: string, observations: Observation[], id?: string) => json<SavedDataset>('datasets' + (id ? '/' + encodeURIComponent(id) : ''), {name, observations}, id ? 'PUT' : 'POST'),
  remove: (id: string) => request<void>('/api/datasets/' + encodeURIComponent(id), {method: 'DELETE'}),
};
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
