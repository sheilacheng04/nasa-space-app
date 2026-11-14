export interface RadarRecord {id?:string;date?:string;parameters?:{BBOX?:string};url?:string;track?:number|string;frame?:number|string;direction?:string;maturity?:string;crid?:string;processingVersion?:string;frequency?:string;sensor?:string;reason?:string}
export function footprintOverlap(value:unknown):string;
export const coverageExplanation:string;
export function knownMetadata(value:unknown):string|null;
export function radarMetadata(frame:RadarRecord|undefined,mode:string):[string,string][];
export function comparisonGuidance(a:RadarRecord|undefined,b:RadarRecord|undefined,mode:string):string;
export function radarUnavailable(frame:RadarRecord|undefined,scenes?:RadarRecord[],mode?:string):{code:string;title:string;description:string};
export function requestBounds(frame:RadarRecord|undefined):string;
