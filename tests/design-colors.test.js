import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const colors=text=>text.match(/#[\da-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/gi)||[];
test('CSS adds no color literals beyond the original palette; new styling uses tokens',async()=>{
 const baseline=JSON.parse(await readFile('tests/design-color-baseline.json','utf8'));
 const allowedSpace=new Set(['#0a1020','#0f182c','#e9eefc']);
 for(const name of (await readdir('src')).filter(n=>n.endsWith('.css'))){
  const css=await readFile('src/'+name,'utf8'),allowed=name==='design.css'?allowedSpace:new Set(baseline[name]||[]);
  for(const color of colors(css))assert(allowed.has(color),`${name}: unexpected literal ${color}; use an existing theme token`);
 }
});
