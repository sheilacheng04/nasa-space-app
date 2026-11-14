import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weatherRows,weatherDomain} from '../src/weather-data.js';
import {weatherChart} from '../src/charts.js';
const context=JSON.parse(readFileSync('public/data/context/angat.json','utf8'));
const row=(month=1,patch={})=>({date:'2026-'+String(month).padStart(2,'0')+'-01',year:2026,month,complete:true,rain:0,temperature:25,...patch});
const data=(rows,baseline=[{month:1,rain:10,temperature:24,nYears:30}])=>({monthly:rows,baselineMonthly:baseline});
test('Weather joins same-month baselines, preserves zero, and computes signed departures',()=>{
 const rain=weatherRows(data([row(),row(2,{rain:20})]),2026,'rain');
 assert.equal(rain.length,12);assert.equal(rain[0].observed,0);assert.equal(rain[0].anomaly,-10);
 assert.equal(rain[1].baseline,null);assert.equal(rain[1].anomaly,null);assert.equal(rain[1].status,'Baseline unavailable');
 assert.equal(weatherRows(data([row()]),2026,'temperature')[0].anomaly,1);
 assert.equal(weatherRows(context,2026,'rain')[9].anomaly,-149.57);
 assert.equal(weatherRows(context,2026,'temperature')[9].anomaly,1.05);
});
test('Incomplete and inconsistent day counts never display partial weather or anomalies',()=>{
 for(const patch of [{complete:false},{nRainDays:8},{nTemperatureDays:30},{expectedDays:30}]){
  for(const key of ['rain','temperature']){
   const r=weatherRows(data([row(1,patch)]),2026,key)[0];
   assert.equal(r.observed,null);assert.equal(r.anomaly,null);assert.equal(r.status,'Incomplete month');assert.notEqual(r.baseline,null);
  }
 }
 assert.equal(weatherRows(context,2026,'rain')[10].status,'Incomplete month');
 assert.equal(weatherRows(context,2026,'rain')[11].status,'Observation unavailable');
 // Leap-year completeness is checked against the actual calendar.
 assert.equal(weatherRows(data([{...row(2),year:2024,nRainDays:29,nTemperatureDays:29,expectedDays:29}]),2024,'rain')[1].observed,0);
});
test('Missing, non-finite and insufficient baseline data remain unavailable',()=>{
 for(const value of [null,undefined,NaN,Infinity]){
  const r=weatherRows(data([row(1,{rain:value})]),2026,'rain')[0];assert.equal(r.observed,null);assert.equal(r.anomaly,null);
 }
 assert.equal(weatherRows(data([row()],[{month:1,rain:10,nYears:29}]),2026,'rain')[0].baseline,null);
 assert.ok(weatherRows(null,2026,'rain').every(r=>r.observed===null&&r.baseline===null));
});
test('Weather chart scales include both years and baselines, with a zero rainfall origin',()=>{
 const c=data([row(1,{rain:5}),{...row(1,{rain:100}),year:2025}]);
 const [lo,hi]=weatherDomain(c,'rain');assert.equal(lo,0);assert.ok(Math.abs(hi-110)<1e-10);
 for(const key of ['rain','temperature']){
  const [lo,hi]=weatherDomain(context,key);assert.ok(Number.isFinite(lo)&&hi>lo);
  for(const year of [2025,2026])for(const r of weatherRows(context,year,key))for(const value of [r.observed,r.baseline])if(value!==null)assert.ok(value>=lo&&value<=hi);
 }
});
test('Weather charts retain missing months, units, legends, values and accessible tables',()=>{
 for(const key of ['rain','temperature']){
  const html=weatherChart(weatherRows(context,2026,key),{label:key,unit:key==='rain'?'mm/month':'C',bars:key==='rain',domain:weatherDomain(context,key)});
  assert.match(html,/Historical average/);assert.match(html,/Observed ERA5 estimate/);assert.match(html,/Departure/);
  assert.match(html,/Incomplete month/);assert.match(html,/Observation unavailable/);assert.match(html,/scope="col"/);
  assert.doesNotMatch(html,/NaN|Infinity/);
 }
 const html=weatherChart(weatherRows(null,2026,'rain'),{label:'Rainfall',unit:'mm/month',bars:true,domain:[0,1]});
 assert.match(html,/0 complete observations/);assert.doesNotMatch(html,/<rect /);
});
