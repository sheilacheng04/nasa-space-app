import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoute,siteSelection,globeSelection,siteHash,globeHash,frameIndex,includeDates,shareURL,validDay,validObservation} from '../src/selection-url.js';
test('Hash routes retain legacy aliases and parse fragment queries without treating them as path segments',()=>{
 for(const [hash,page,sub]of [['#observatory/globe','globe',''],['#observatory/angat?date=2026-11-11','sites','angat'],['#news','media',''],['#data','method','my-data'],['#local','story','local'],['#method/citation','method','citation'],['#unknown','story','']]){
  const route=readRoute(hash);assert.equal(route.page,page);assert.equal(route.sub,sub);
 }
 assert.equal(readRoute('#sites/angat?date=2026-11-11').siteSelection.date,'2026-11-11');
 const slashRoute=readRoute('#/sites?place=angat&date=2026-10-09');
 assert.equal(slashRoute.page,'sites');assert.equal(slashRoute.sub,'angat');assert.equal(slashRoute.siteSelection.date,'2026-10-09');
});
test('Site links round-trip source, channel, comparison view and exact acquisition timestamps',()=>{
 const selection={source:'browse',channel:'HV',view:'swipe',before:'2026-06-23T21:30:35Z',after:'2026-10-09T21:30:31Z'};
 const route=readRoute(siteHash('angat',selection));assert.equal(route.sub,'angat');
 for(const [key,value]of Object.entries(selection))assert.equal(route.siteSelection[key],value);
 const timeline=readRoute(siteHash('dadu',{date:'2026-01-01',view:'timeline',before:'2025-01-01',channel:'HV'}));
 assert.equal(timeline.siteSelection.date,'2026-01-01');assert.equal(timeline.siteSelection.before,undefined);assert.equal(timeline.siteSelection.channel,undefined);
});
test('Invalid dates, months, channels and modes fall back without accepting normalized dates',()=>{
 for(const value of ['2026-02-30','0000-01-01','2025-02-29','2026-01-01T24:00:00Z','2026-01-01T10:00:00','not-a-date'])assert.equal(validObservation(value),false);
 assert.equal(validDay('2024-02-29'),true);assert.equal(validObservation('2026-01-01T10:00:00.123Z'),true);
 const site=siteSelection(new URLSearchParams('source=bad&channel=bad&view=bad&date=2026-02-30'));
 assert.ok(Object.values(site).every(v=>v===undefined));
 const globe=globeSelection(new URLSearchParams('mode=bad&month=2026-13&site=<script>&date=invalid'));
 assert.equal(globe.mode,'illustrative');
 assert.equal(globe.site,undefined);assert.equal(globe.date,undefined);assert.equal(globe.month,undefined);
 assert.equal(readRoute('#globe').globeSelection.mode,'illustrative');
 assert.equal(readRoute('#globe').globeSelection.month,undefined);
 const unsupported=readRoute('#sites/angat?source=browse&view=timeline&before=2026-01-01&after=2026-12-31').siteSelection;assert.equal(unsupported.view,'swipe');assert.equal(unsupported.after,'2026-12-31');
});
test('Globe links retain independent radar date, vegetation month, mode and selected site',()=>{
 const selection={mode:'concept',site:'piura',date:'2026-10-31',month:'2025-04'};
 assert.deepEqual(readRoute(globeHash(selection)).globeSelection,selection);
 assert.equal(globeHash({...selection,playing:true,dialog:'search',speed:4}),globeHash(selection));
 for(const mode of ['satellite','concept','illustrative'])assert.deepEqual(readRoute(globeHash({...selection,mode})).globeSelection,{...selection,mode});
});
test('Unavailable dates remain exact placeholders rather than selecting a different saved frame',()=>{
 const frames=[{date:'2026-10-01',image:'first'},{date:'2026-10-09T21:30:31Z',image:'second'}];
 assert.equal(frameIndex(frames,'2026-10-09'),1);assert.equal(frameIndex(frames,'2026-10-09T10:00:00Z'),-1);
 const result=includeDates(frames,['2026-11-11','2026-11-11'],date=>({date,status:'missing'}));
 assert.equal(result.length,3);assert.deepEqual(result[frameIndex(result,'2026-11-11')],{date:'2026-11-11',status:'missing'});
 assert.equal(frames.length,2);
});
test('Share links preserve deployment paths, omit top-level and temporary parameters, and refuse file URLs',()=>{
 const hash=siteHash('angat',{source:'gibs',date:'2026-11-11',dialog:'search'});
 const link=shareURL('https://example.org/project/?tracking=1#story',hash);
 assert.equal(new URL(link).pathname,'/project/');assert.equal(new URL(link).search,'');assert.equal(new URL(link).hash,hash);
 assert.equal(shareURL('file:///C:/demo.html',hash),null);
});
