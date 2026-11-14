import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const source=readFileSync(new URL('../src/concept-data.ts',import.meta.url),'utf8');
const {code}=transformSync(source,{loader:'ts',format:'esm',target:'es2022'});
const {monthEnd,previousMonth,calendarMonths,latestCompleteMonth,readConceptMonth,conceptSnapshot,oceanAtMonthEnd,illustrativeRainSignal}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const site={id:'angat',name:'Angat reservoir',coordinates:[121.16,14.91]};
const row=(month,values={})=>({date:month+'-01',year:Number(month.slice(0,4)),month:Number(month.slice(5)),rain:50,temperature:27,rainAnomaly:-50,temperatureAnomaly:1,complete:true,expectedDays:Number(monthEnd(month).slice(-2)),nRainDays:Number(monthEnd(month).slice(-2)),nTemperatureDays:Number(monthEnd(month).slice(-2)),...values});
const context=(rows)=>({monthly:rows,baselineMonthly:[{month:1,rain:100,temperature:26},{month:2,rain:200,temperature:25},{month:3,rain:90,temperature:26}]});

test('Concept calendar uses real month ends and retains missing calendar months',()=>{
 assert.equal(monthEnd('2024-02'),'2024-02-29');assert.equal(monthEnd('2025-02'),'2025-02-28');
 assert.equal(previousMonth('2025-01'),'2024-12');
 assert.throws(()=>monthEnd('2025-13'));
 assert.deepEqual(calendarMonths({angat:context([row('2025-01'),row('2025-03')])}),['2025-01','2025-02','2025-03']);
});
test('Partial and missing months cannot become land-response measurements',()=>{
 const partial=context([row('2025-01',{complete:false,nRainDays:8,rain:90,rainAnomaly:30})]);
 const reading=readConceptMonth(site,partial,'2025-01');
 assert.equal(reading.rain,null);assert.equal(reading.rainAnomaly,null);assert.equal(reading.temperatureAnomaly,null);assert.equal(reading.signal,'unknown');assert.equal(illustrativeRainSignal(reading),null);
 const missing=readConceptMonth(site,partial,'2025-02');
 assert.equal(missing.rain,null);assert.equal(missing.signal,'unknown');assert.equal(missing.baselineRain,200);
 assert.equal(readConceptMonth(site,context([row('2025-01',{nRainDays:30})]),'2025-01').signal,'unknown');
});
test('Selected baseline matches the calendar month; zero rainfall remains zero',()=>{
 const data=context([row('2025-02',{rain:0,rainAnomaly:-200})]);
 const reading=readConceptMonth(site,data,'2025-02');
 assert.equal(reading.rain,0);assert.equal(reading.baselineRain,200);assert.equal(reading.rainAnomaly,-200);assert.equal(reading.signal,'drier');
 assert.equal(illustrativeRainSignal(reading),-1);
});
test('Default chooses latest complete month and never the partial tail',()=>{
 const data=context([row('2025-01'),row('2025-02'),row('2025-03',{complete:false})]);
 assert.equal(latestCompleteMonth({angat:data}),'2025-02');
 assert.equal(latestCompleteMonth({angat:{monthly:[]}}),undefined);
});
test('Concept snapshot is point context with independent rainfall signs and explicit unknowns',()=>{
 const drier=context([row('2025-01')]),wetter=context([row('2025-01',{rain:140,rainAnomaly:40})]);
 const sites=[site,{...site,id:'wet',name:'Wet point'},{...site,id:'missing',name:'Missing point'}];
 const snapshot=conceptSnapshot(sites,{angat:drier,wet:wetter,missing:null},'2025-01');
 assert.equal(snapshot.date,'2025-01-31');assert.equal(snapshot.month,'2025-01');
 assert.deepEqual(snapshot.sites.map(item=>item.signal),['drier','wetter','unknown']);
 assert.deepEqual(snapshot.sites[0].coordinates,site.coordinates);
 assert.equal(snapshot.sites[2].rain,null);
 assert.equal(readConceptMonth(site,context([row('2025-01',{rain:100,rainAnomaly:0})]),'2025-01').signal,'near');
});
test('NOAA comparison cannot look ahead beyond the selected month end',()=>{
 const weekly=[{date:'2025-02-05',anomaly:3,sst:29},{date:'2025-01-01',anomaly:-.2,sst:26},{date:'2025-01-29',anomaly:.5,sst:27},{date:'2025-01-30',anomaly:NaN,sst:27}];
 assert.equal(oceanAtMonthEnd(weekly,'2025-01').date,'2025-01-29');
 assert.equal(oceanAtMonthEnd(weekly,'2024-12'),null);
 assert.equal(oceanAtMonthEnd([{date:'2025-01-20',anomaly:null}],'2025-01'),null);
});
test('Bundled October record and NOAA alignment remain auditable',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/data/context/angat.json',import.meta.url),'utf8'));
 const enso=JSON.parse(readFileSync(new URL('../public/data/enso.json',import.meta.url),'utf8'));
 assert.equal(latestCompleteMonth({angat:data}),'2026-10');
 const october=readConceptMonth(site,data,'2026-10');
 assert.equal(october.rain,110.9);assert.equal(october.rainAnomaly,-149.57);assert.equal(october.complete,true);
 assert.equal(readConceptMonth(site,data,'2026-11').signal,'unknown');
 const ocean=oceanAtMonthEnd(enso.weekly,'2026-10');assert.equal(ocean.date,'2026-10-28');assert.equal(ocean.anomaly,3.4);
});
