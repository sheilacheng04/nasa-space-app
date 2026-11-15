import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const {code}=transformSync(readFileSync(new URL('../src/surface-data.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'});
const {surfaceFrames,surfaceMonths,surfaceReading}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Surface timeline retains missing months and never carries a preview into a gap',()=>{
 const inventory={sites:[{siteId:'a',scenes:[{id:'one',date:'2026-06-23',polarizations:['HH','HV']},{id:'two',date:'2026-08-23',polarizations:['HH']}]}]};
 const evidence={browse:{frames:[{date:'2026-06-23',channels:{HH:{image:'hh.png'},HV:{image:'hv.png'}}}]}};
 assert.deepEqual(surfaceMonths(inventory,{a:evidence}),['2026-06','2026-07','2026-08']);
 const frames=surfaceFrames(evidence,'vegetation');assert.equal(frames[0].image,'hv.png');
 assert.deepEqual(surfaceReading(inventory.sites[0].scenes,frames,'2026-07','vegetation'),{acquisitions:0,previews:0,status:'missing'});
 assert.equal(surfaceReading(inventory.sites[0].scenes,frames,'2026-08','vegetation').status,'missing');
 assert.equal(surfaceReading(inventory.sites[0].scenes,[],'2026-08','soil').status,'catalog');
});
test('Only actual saved images count as previews; catalog products are deduplicated by acquisition time',()=>{
 const frames=surfaceFrames({gibs:{frames:[{date:'2026-10-09',image:'a.png',status:'ready'},{date:'2026-10-10',status:'ready'},{date:'2026-10-11',image:'b.png',status:'not available'}]}},'change');
 assert.equal(frames.length,1);
 const scenes=[{id:'release1',date:'2026-10-09T00:00:00Z',polarizations:['HH']},{id:'release2',date:'2026-10-09T00:00:00Z',polarizations:['HH']}];
 assert.deepEqual(surfaceReading(scenes,frames,'2026-10','change'),{acquisitions:1,previews:1,status:'preview'});
 assert.deepEqual(surfaceMonths(null,{}),[]);
});
