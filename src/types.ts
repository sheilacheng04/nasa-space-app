export type Page = 'story' | 'globe' | 'observatory' | 'local' | 'news' | 'data' | 'method';
export interface Observation { name: string; lat: number; lng: number; value: number | null; category: string; date: string }
export interface Site { id: string; name: string; subtitle: string; country: string; coordinates: [number, number]; bbox: [number, number, number, number]; type: string; description: string; question: string; hypothesis: string; evidence: string; disprove: string; humanDrivers: string }
export interface Analysis { score: number; summary: string; caveat: string; model?: string; scoredAt?: string }
export interface Headline { id: string; title: string; source: string; url: string; date: string; theme: string; region: string; verification: string; vader: number | null; vaderAdjusted: number | null; ai: Analysis | null }
export interface News { items: Headline[]; status: string; retrievedAt: string | null }
export interface Enso { nino34: number | null; label: string; measurement: string; issuedAt: string; retrievedAt: string; outlook: string; url: string }
export interface Source { name: string; url: string; note: string; status: string; reviewedAt: string }
export interface Bootstrap { sites: Site[]; news: News; enso: Enso; sources: Source[] }
export interface Weather { status: string; source: string; retrievedAt: string; warning?: string; daily: { date: string; temperature: number | null; rain: number | null }[] }
export interface Place { properties: { name?: string; state?: string; country?: string }; geometry: { coordinates: [number, number] } }
export interface User { id: string; username: string }
export interface Dataset { id: string; name: string; rowCount: number; createdAt: number; updatedAt: number }
export interface SavedDataset extends Dataset { observations: Observation[] }
declare global {
  var __PACIFIC_DEMO__: boolean | undefined;
  var __PACIFIC_DATA__: Record<string, unknown> | undefined;
  var __PACIFIC_ASSETS__: Record<string, string> | undefined;
}
