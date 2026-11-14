export type IllustrationLayer='heat'|'rain'|'stress'|'geography';
export interface IllustrationState {layer:IllustrationLayer;phase:number;links:boolean;towers:boolean;labels:boolean;userData:boolean}
export const illustrationDefaults:IllustrationState;
export const illustrationLegends:Record<IllustrationLayer,[string,string,string,string]>;
export function phaseLabel(phase:number):string;
export function pattern(coordinates:number[]):{dry:number;wet:number;warm:number};
export function countryColor(data:ReturnType<typeof pattern>,layer:IllustrationLayer,phase:number,selected?:boolean):string;
export function renderIllustration(...args:any[]):{points:number;labels:number;arcs:number;rings:number};
export function clearIllustration(world:any):void;
