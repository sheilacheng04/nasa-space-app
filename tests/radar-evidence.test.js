import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {footprintOverlap,coverageExplanation,knownMetadata,radarMetadata,comparisonGuidance,radarUnavailable,requestBounds} from '../src/radar-data.js';
const evidence=id=>JSON.parse(readFileSync('public/data/sites/'+id+'/evidence.json','utf8'));
test('Footprint overlap reports the saved geometric fraction without inventing missing values',()=>{
 assert.equal(footprintOverlap(.7938),'79.4%');assert.equal(footprintOverlap(0),'0.0%');assert.equal(footprintOverlap(1),'100.0%');
 for(const x of [null,undefined,NaN,Infinity,-1,1.1,'0.8'])assert.equal(footprintOverlap(x),'not available');
 assert.match(coverageExplanation,/intersection.*\/ the entire study-area bounding box/);assert.match(coverageExplanation,/longitude\/latitude/);assert.match(coverageExplanation,/not valid radar pixel coverage/);
});
test('Mosaic labels never borrow track, maturity or CRID from a same-date acquisition',()=>{
 const labels=radarMetadata({track:140,frame:9,maturity:'PROVISIONAL',crid:'P05023'},'gibs');
 assert.match(JSON.stringify(labels),/mosaic pixels/);assert.doesNotMatch(JSON.stringify(labels),/P05023|PROVISIONAL|140/);
 assert.equal(requestBounds({url:'https://example.org/?BBOX=121.08,14.84,121.24,15'}),'121.08, 14.84, 121.24, 15');
 for(const value of ['1,2,3','180,0,190,10','1,2,NaN,4',',0,1,1'])assert.equal(requestBounds({parameters:{BBOX:value}}),'not available');
 assert.equal(requestBounds({}),'not available');
});
test('Regional metadata displays only supplied values, including zero; simulation remains separate',()=>{
 assert.equal(knownMetadata(0),'0');for(const v of [undefined,null,NaN,'NOT AVAILABLE (mosaic lineage)','unknown'])assert.equal(knownMetadata(v),null);
 assert.ok(radarMetadata({},'browse').every(([,v])=>v==='not available'));
 const frame=evidence('angat').browse.frames[0];assert.ok(radarMetadata(frame,'browse').some(([k,v])=>k==='CRID'&&v===frame.crid));
 assert.match(JSON.stringify(radarMetadata(frame,'simulated')),/Simulated/);assert.doesNotMatch(JSON.stringify(radarMetadata(frame,'simulated')),/P05023/);
});
test('Comparison guidance distinguishes unknown, mismatched and matching catalog properties',()=>{
 const [a,b]=evidence('angat').browse.frames;
 assert.match(comparisonGuidance(a,b,'browse'),/Listed track, frame, maturity and CRID match/);
 assert.match(comparisonGuidance(a,b,'browse'),/Visual comparison only/);
 for(const key of ['track','frame','direction','maturity','crid'])assert.match(comparisonGuidance(a,{...b,[key]:'different'},'browse'),new RegExp('Different '+key));
 assert.match(comparisonGuidance(a,{...b,frame:undefined},'browse'),/incomplete/);
 assert.match(comparisonGuidance(a,b,'gibs'),/unavailable; comparability remains unverified/);
});
test('Missing acquisitions, unsaved browse, empty previews and recorded request failures are distinct',()=>{
 const date='2026-01-01';
 assert.equal(radarUnavailable({date},[]).code,'not-listed');
 assert.equal(radarUnavailable({date},[{date}]).code,'browse-missing');
 assert.equal(radarUnavailable({date,id:'listed'}).code,'browse-missing');
 assert.equal(radarUnavailable({date}).code,'browse-missing');
 assert.equal(radarUnavailable({reason:'ValueError: Empty or uniform tile; no usable browse coverage'}).code,'unresolved');
 assert.equal(radarUnavailable({reason:'ReadTimeout: request timed out'}).code,'request-failed');
 assert.equal(radarUnavailable({reason:'This frame is not embedded in the offline edition.'}).code,'offline');
 assert.match(radarUnavailable({date},[]).description,/not a complete mission record/);
});
test('All saved sites retain unknown mosaic lineage, explicit missing previews and zero calibrated samples',()=>{
 for(const id of ['angat','luzon','dadu','piura']){
  const e=evidence(id);assert.equal(e.series.n,0);
  const gap=e.gibs.frames.find(f=>!f.image);assert.equal(radarUnavailable(gap,e.inventory.scenes).code,'unresolved');
  assert.match(comparisonGuidance(e.browse.frames[0],e.browse.frames[1],'browse'),/match/);
 }
});
