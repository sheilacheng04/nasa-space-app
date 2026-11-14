import type { Enso,Site } from './types';

export interface ClimateMonth {
 date:string;year:number;month:number;rain:number|null;temperature:number|null;
 rainAnomaly:number|null;temperatureAnomaly:number|null;complete:boolean;
 nRainDays?:number;nTemperatureDays?:number;expectedDays?:number;
}
export interface ClimateContext {
 source?:string;retrievedAt?:string;baseline?:string;temperatureDefinition?:string;
 monthly?:ClimateMonth[];
 baselineMonthly?:{month:number;rain:number|null;temperature:number|null;nYears?:number}[];
 requests?:{period?:string;url?:string}[];
}
export type ConceptSignal='drier'|'wetter'|'near'|'unknown';
export interface ConceptSiteSnapshot {
 id:string;name:string;coordinates:[number,number];
 rainAnomaly:number|null;temperatureAnomaly:number|null;rain:number|null;baselineRain:number|null;
 signal:ConceptSignal;
}
export interface ConceptSnapshot {date:string;month:string;sites:ConceptSiteSnapshot[]}
export interface ConceptMonthReading extends ConceptSiteSnapshot {
 complete:boolean;temperature:number|null;baselineTemperature:number|null;
 availableRainDays:number|null;expectedDays:number;date:string;month:string;
}
export type ClimateContexts=Record<string,ClimateContext|null>;

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
export function monthEnd(month:string):string {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Use a calendar month in YYYY-MM format.');
 const [year,number]=month.split('-').map(Number);
 return new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);
}
export function previousMonth(month:string):string {
 monthEnd(month);const [year,number]=month.split('-').map(Number);
 return new Date(Date.UTC(year,number-2,1)).toISOString().slice(0,7);
}
export function calendarMonths(contexts:ClimateContexts):string[] {
 const known=Object.values(contexts).flatMap(context=>(context?.monthly||[]).map(row=>row.date?.slice(0,7))).filter(month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month)).sort();
 if(!known.length)return [];
 const [year,number]=known[0].split('-').map(Number),cursor=new Date(Date.UTC(year,number-1,1)),result:string[]=[];
 const last=known[known.length-1];
 while(cursor.toISOString().slice(0,7)<=last){result.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
 return result;
}
function isComplete(row?:ClimateMonth):boolean {
 if(!row?.complete)return false;
 const expected=Number(monthEnd(row.date.slice(0,7)).slice(-2));
 return (row.expectedDays===undefined||row.expectedDays===expected)
  &&(row.nRainDays===undefined||row.nRainDays===expected)
  &&(row.nTemperatureDays===undefined||row.nTemperatureDays===expected);
}
export function latestCompleteMonth(contexts:ClimateContexts):string|undefined {
 return Object.values(contexts).flatMap(context=>(context?.monthly||[]).filter(isComplete).map(row=>row.date.slice(0,7))).sort().at(-1);
}
export function readConceptMonth(site:Site,context:ClimateContext|null|undefined,month:string):ConceptMonthReading {
 const date=monthEnd(month),row=context?.monthly?.find(item=>item.date.slice(0,7)===month);
 const baseline=context?.baselineMonthly?.find(item=>item.month===Number(month.slice(5,7)));
 const complete=isComplete(row);
 const rain=complete&&finite(row?.rain)?row.rain:null;
 const temperature=complete&&finite(row?.temperature)?row.temperature:null;
 const baselineRain=finite(baseline?.rain)?baseline.rain:null;
 const baselineTemperature=finite(baseline?.temperature)?baseline.temperature:null;
 const rainAnomaly=rain!==null&&baselineRain!==null&&finite(row?.rainAnomaly)?row.rainAnomaly:null;
 const temperatureAnomaly=temperature!==null&&baselineTemperature!==null&&finite(row?.temperatureAnomaly)?row.temperatureAnomaly:null;
 return {
  id:site.id,name:site.name,coordinates:site.coordinates,date,month,complete,
  rain,temperature,baselineRain,baselineTemperature,rainAnomaly,temperatureAnomaly,
  signal:rainAnomaly===null?'unknown':rainAnomaly<0?'drier':rainAnomaly>0?'wetter':'near',
  availableRainDays:finite(row?.nRainDays)?row.nRainDays:null,expectedDays:Number(date.slice(-2))
 };
}
export function conceptSnapshot(sites:Site[],contexts:ClimateContexts,month:string):ConceptSnapshot {
 return {month,date:monthEnd(month),sites:sites.map(site=>{
  const {id,name,coordinates,rainAnomaly,temperatureAnomaly,rain,baselineRain,signal}=readConceptMonth(site,contexts[site.id],month);
  return {id,name,coordinates,rainAnomaly,temperatureAnomaly,rain,baselineRain,signal};
 })};
}
export function oceanAtMonthEnd(weekly:Enso['weekly'],month:string) {
 const end=monthEnd(month);
 return (weekly||[]).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.date<=end&&finite(row.anomaly)).slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||null;
}
/** Display geometry only, not a model of water, soil moisture or vegetation. */
export function illustrativeRainSignal(reading:ConceptMonthReading):number|null {
 if(reading.rainAnomaly===null||reading.baselineRain===null)return null;
 return Math.max(-1,Math.min(1,reading.rainAnomaly/Math.max(20,reading.baselineRain)));
}
