import test from 'node:test';
import assert from 'node:assert/strict';
import {chart} from '../src/charts.js';
test('Chart alternatives expose captions, column and row headers, units and keyboard scrolling without filling missing data',()=>{
 const html=chart([{date:'2026-01-01',value:0},{date:'2026-02-01',value:null}],{key:'value',label:'Temperature estimate',unit:'degrees C'});
 assert.match(html,/<caption>Temperature estimate \(degrees C\) by date<\/caption>/);
 assert.match(html,/<th scope="col">Date<\/th>/);
 assert.match(html,/<th scope="row">2026-02-01<\/th><td>not available<\/td>/);
 assert.match(html,/<td>0.00<\/td>/);
 assert.match(html,/aria-label="Scrollable chart data" tabindex="0"/);
 assert.match(html,/role="img" aria-label="Temperature estimate/);
});
