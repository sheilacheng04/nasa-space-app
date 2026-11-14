import type {Site} from './types';
export interface SiteMapController {update(site:Site,acquisition:unknown,pol:string,layers?:unknown[],options?:{mode:string;catalog?:unknown[]}):void;dispose():void}
export function mountMap(element:HTMLElement,site:Site,acquisition:unknown,pol:string,layers?:unknown[],options?:{mode:string;catalog?:unknown[]}):Promise<SiteMapController>;
