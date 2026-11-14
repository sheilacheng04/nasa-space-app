import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapSelection,selectionDay,opticalRequest,validBounds} from '../src/site-map-data.js';
const sites=JSON.parse(readFileSync('public/data/sites.json','utf8'));
const evidence=id=>JSON.parse(readFileSync('public/data/sites/'+id+'/evidence.json','utf8'));
test('Selected GIBS images use saved request bounds; regional quicklooks use identity-matched footprints only',()=>{
 for(const site of sites){
  const e=evidence(site.id),f=e.gibs.frames.find(f=>f.image);
  const mosaic=mapSelection(site,f,'HH',[],{mode:'gibs',catalog:e.inventory.scenes});
  assert.deepEqual(mosaic.radar.bounds,f.parameters.BBOX.split(',').map(Number));assert.equal(mosaic.radar.image,'./'+f.image);
  assert.equal(mosaic.footprint,null);assert.equal(mosaic.opticalDate,f.date);
  for(const pol of ['HH','HV']){
   const record=e.browse.frames[0],regional=mapSelection(site,record,pol,[],{mode:'browse',catalog:e.inventory.scenes});
   assert.equal(regional.radar,null);assert.equal(regional.channel,pol);
   assert.deepEqual(regional.footprint,e.inventory.scenes.find(s=>s.id===record.id).footprint);
   assert.match(regional.reason,/no saved image-to-ground transform/);
  }
 }
});
test('Dates are explicit validated UTC days, never relative to runtime',()=>{
 for(const value of [undefined,null,'','2026-02-30','2026-13-01','2026-01-01T12:00:00'])assert.equal(selectionDay(value),null);
 assert.equal(selectionDay('2024-02-29'),'2024-02-29');assert.equal(selectionDay('2026-06-23T21:30:35Z'),'2026-06-23');
 assert.equal(selectionDay('2026-06-23T23:30:00-03:00'),'2026-06-24');
 assert.equal(opticalRequest(sites[0],null),null);
 const url=new URL(opticalRequest(sites[0],'2026-06-23'));assert.equal(url.searchParams.get('TIME'),'2026-06-23');assert.equal(url.searchParams.get('BBOX'),sites[0].bbox.join(','));
});
test('Missing georeferencing, wrong CRS, invalid bounds and unknown acquisitions cannot borrow study bounds or footprints',()=>{
 const site=sites[0],e=evidence(site.id),f=e.gibs.frames.find(f=>f.image);
 for(const record of [null,{date:f.date,image:f.image},{...f,parameters:{BBOX:'0,0,1,1',SRS:'EPSG:3857'},url:undefined},{...f,parameters:{BBOX:',0,1,1',SRS:'EPSG:4326'},url:undefined}]){
  assert.equal(mapSelection(site,record,'HH',[],{mode:'gibs',catalog:e.inventory.scenes}).radar,null);
 }
 const unknown={...e.browse.frames[0],id:'not-in-catalog'};
 assert.equal(mapSelection(site,unknown,'HH',[],{mode:'browse',catalog:e.inventory.scenes}).footprint,null);
 assert.equal(validBounds([0,0,Infinity,10]),false);assert.equal(validBounds([2,0,1,10]),false);
});
test('Only spatially relevant exact-date or explicitly static attributed context layers are accepted',()=>{
 const site=sites[0],e=evidence(site.id),f=e.gibs.frames.find(f=>f.image);
 const layer={name:'Fixture reference',image:f.image,bounds:site.bbox,date:f.date,attribution:'Test fixture source',siteId:site.id};
 const layers=[layer,{...layer,isStatic:true,date:undefined},{...layer,date:'2000-01-01'},{...layer,bounds:[0,0,1,1]},{...layer,siteId:'wrong'},{...layer,attribution:undefined},{...layer,bounds:undefined}];
 assert.equal(mapSelection(site,f,'HH',layers,{mode:'gibs'}).layers.length,2);
 assert.ok(sites.every(site=>(evidence(site.id).processed.contextLayers||[]).length===0));
});
test('Missing observations and simulation never substitute another radar or optical date',()=>{
 const site=sites[0],e=evidence(site.id),gap=e.gibs.frames.find(f=>!f.image);
 const missing=mapSelection(site,gap,'HH',[],{mode:'gibs',catalog:e.inventory.scenes});assert.equal(missing.radar,null);assert.equal(missing.opticalDate,gap.date);
 const simulation=mapSelection(site,{date:'2026-10-01',bounds:site.bbox,channels:{HH:{image:'data/demo/HH-0.svg'}}},'HH',[],{mode:'simulated'});
 assert.equal(simulation.opticalDate,null);assert.equal(simulation.radar,null);assert.equal(simulation.footprint,null);assert.match(simulation.reason,/Simulation/);
 const unspecified=mapSelection(site,null,'HH');assert.equal(unspecified.opticalDate,null);assert.equal(unspecified.radar,null);
});
