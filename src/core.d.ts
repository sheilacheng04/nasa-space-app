import type { Observation } from './types';
export function esc(value: unknown): string;
export function safeURL(value: unknown): string;
export function formatDate(value: unknown): string;
export function finite(value: unknown): value is number;
export function parseCSV(text: string): Observation[];
export function loadSaved(): Observation[];
export function localTone(text: string): { score: number; negative: number; positive: number; method: string };
export function downloadText(name: string, text: string, type?: string): void;

export function assetURL(value: unknown): string;
