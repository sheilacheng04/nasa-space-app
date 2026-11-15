import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=name=>JSON.parse(readFileSync('public/data/'+name,'utf8'));
const ids=['cagayan-valley','mekong-delta','guayas-babahoyo'];
test('additional study areas have real dated imagery, compatible regional pairs and complete weather baselines',()=>{
 const sites=read('sites.json'),places=read('places.json');
 for(const id of ids){
  const site=sites.find(s=>s.id===id),e=read(`sites/${id}/evidence.json`),climate=read(`context/${id}.json`);
  assert(site);assert(places.some(p=>p.siteId===id&&p.hasRadarFrames));
  assert(e.inventory.scenes.length>0);assert(e.inventory.scenes.some(s=>s.coversCenter));
  const frames=e.gibs.frames.filter(f=>f.status==='ready');
  assert(frames.length>=2);assert.equal(frames.length,site.savedFrameCount);
  assert(e.gibs.frames.some(f=>f.status!=='ready'),'Retain missing 12-day slots');
  for(const f of frames){
   assert(f.url.startsWith('https://gibs.earthdata.nasa.gov/'));
   assert.equal(f.parameters.TIME,f.date);assert.deepEqual(f.parameters.BBOX.split(',').map(Number),site.bbox);
   assert(f.nontransparentFraction>0);assert.match(f.maturity,/NOT AVAILABLE/);
   const bytes=readFileSync('public/'+f.image);assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
  const [a,b]=e.browse.frames;
  assert(a.date<b.date);
  for(const key of ['track','frame','direction','maturity','crid'])assert.equal(a[key],b[key]);
  for(const f of [a,b])for(const pol of ['HH','HV']){
   assert(existsSync('public/'+f.channels[pol].image));
   assert(f.channels[pol].sourceUrl.startsWith('https://nisar.asf.earthdatacloud.nasa.gov/'));
  }
  assert.equal(e.series.n,0);assert.equal(e.processed.acquisitions.length,0);
  assert.equal(climate.baselineMonthly.length,12);assert(climate.baselineMonthly.every(b=>b.nYears===30&&Number.isFinite(b.rain)&&Number.isFinite(b.temperature)));
  assert.equal(climate.monthly.filter(m=>m.complete).length,22);
  assert(climate.monthly.filter(m=>!m.complete).every(m=>m.rain===null&&m.temperature===null));
  assert(climate.requests.every(r=>r.status==='ready'&&r.parameters.models==='era5'));
 }
});
