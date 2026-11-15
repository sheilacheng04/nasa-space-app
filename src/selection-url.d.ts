import type {Page} from './types';
export type HistoryMode='push'|'replace';
export interface SiteSelection {source?:'gibs'|'browse'|'processed'|'simulated';channel?:string;view?:'timeline'|'swipe'|'change';date?:string;before?:string;after?:string}
export interface GlobeSelection {mode?:'concept'|'illustrative'|'surface';surface?:'vegetation'|'soil'|'water'|'change';site?:string;date?:string;month?:string}
export function readRoute(hash:string):{page:Page;sub:string;siteSelection:SiteSelection;globeSelection:GlobeSelection};
export function siteSelection(input:unknown):SiteSelection;
export function globeSelection(input:unknown):GlobeSelection;
export function siteHash(site:string,input?:SiteSelection):string;
export function globeHash(input?:GlobeSelection):string;
export function validDay(value:unknown):boolean;
export function validObservation(value:unknown):boolean;
export function frameIndex(frames:{date:string}[],date?:string):number;
export function includeDates<T extends {date:string}>(frames:T[],dates:(string|undefined)[],missing:(date:string)=>T):T[];
export function shareURL(href:string,hash:string):string|null;
