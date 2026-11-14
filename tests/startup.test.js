import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createJSONCache} from '../src/json-cache.js';
import {datasetKeys,datasetStatus} from '../src/startup-data.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('Immutable JSON requests share concurrent work and successful values across navigation',async()=>{
 const load=createJSONCache(),pending=deferred();let calls=0;
 const fetcher=()=>{calls++;return pending.promise;};
 const a=load('news',fetcher),b=load('news',fetcher);assert.equal(a,b);
 pending.resolve({items:[]});assert.deepEqual(await a,{items:[]});assert.equal(await load('news',fetcher),await b);assert.equal(calls,1);
});
test('Failures are evicted, and explicit retry bypasses an existing success',async()=>{
 const load=createJSONCache();let calls=0;
 await assert.rejects(load('enso',async()=>{calls++;throw Error('offline');}));
 assert.equal(await load('enso',async()=>{calls++;return 'saved';}),'saved');
 assert.equal(await load('enso',async()=>{calls++;return 'new';},true),'new');assert.equal(calls,3);
});
test('An older rejection or success cannot replace a newer retry in the shared cache',async()=>{
 for(const fail of [true,false]){
  const load=createJSONCache(),old=deferred();const first=load('evidence',()=>old.promise);const caught=first.catch(()=>null);
  assert.equal(await load('evidence',async()=> 'current',true),'current');
  if(fail)old.reject(Error('late failure'));else old.resolve('stale');await caught;
  assert.equal(await load('evidence',async()=> 'incorrect'),'current');
 }
});
test('Independent dataset loading has no all-or-nothing ordering dependency',async()=>{
 const load=createJSONCache(),sites=deferred(),news=deferred(),enso=deferred();
 const roots={sites:load('sites',()=>sites.promise),news:load('news',()=>news.promise),enso:load('enso',()=>enso.promise)};
 const rejected=assert.rejects(roots.news);news.reject(Error('news failed'));sites.resolve(['site']);assert.deepEqual(await roots.sites,['site']);await rejected;
 enso.resolve({nino34:null});assert.deepEqual(await roots.enso,{nino34:null});
});
test('All five saved root files validate; empty and malformed data remain distinct',async()=>{
 for(const key of datasetKeys){const value=JSON.parse(await readFile('public/data/'+key+'.json','utf8'));assert.equal(datasetStatus(key,value),'ready');assert.throws(()=>datasetStatus(key,null));assert.throws(()=>datasetStatus(key,{}));}
 for(const key of ['sites','sources','evidence'])assert.equal(datasetStatus(key,[]),'empty');
 assert.equal(datasetStatus('news',{items:[],status:'archive',retrievedAt:null}),'empty');
 assert.equal(datasetStatus('enso',{url:'https://example.org',issuedAt:'',retrievedAt:'',nino34:null,weekly:[],oni:[]}),'empty');
 assert.throws(()=>datasetStatus('enso',{url:'x',issuedAt:'',retrievedAt:'',nino34:0,weekly:[{anomaly:1}]}));
});
