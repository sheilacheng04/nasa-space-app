import type {ClimateContext} from './concept-data';
export interface WeatherComparison {date:string;month:number;observed:number|null;baseline:number|null;anomaly:number|null;status:string}
export function weatherRows(context:ClimateContext|null|undefined,year:number,key:'rain'|'temperature'):WeatherComparison[];
export function weatherDomain(context:ClimateContext|null|undefined,key:'rain'|'temperature'):[number,number];
