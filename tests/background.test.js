import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackground} from '../src/background.js';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

test('procedural controller stays below the 10 KB gzipped budget',()=>{
 assert(gzipSync(readFileSync('src/background.js')).length<10000);
});

function setup({reduced=false,stored=false,drawCost=0}={}) {
 const listeners=new Map(), timers=new Map(), rafs=new Map(), storage=new Map();let id=0,time=0;
 const listen=(name,fn)=>listeners.set(name,fn),unlisten=name=>listeners.delete(name);
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={dataset:{},width:0,height:0,getContext:()=>ctx,remove(){this.removed=true;}};
 const host={clientWidth:1280,clientHeight:500,isConnected:true,appendChild(c){this.canvas=c;},contains:c=>c===canvas};
 const doc={hidden:false,documentElement:{},querySelector:()=>host,getElementById:()=>host,addEventListener:listen,removeEventListener:unlisten};
 const motion={matches:reduced,addEventListener:(_,fn)=>listen('motion',fn),removeEventListener:()=>unlisten('motion')};
 if(stored)storage.set('pacific-background-paused','1');
 const env={document:doc,innerWidth:1280,devicePixelRatio:3,navigator:{hardwareConcurrency:8},matchMedia:()=>motion,
  performance:{now:()=>{time+=drawCost;return time;}},getComputedStyle:()=>({getPropertyValue:()=> '#146db8'}),
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i),
  requestAnimationFrame:fn=>{rafs.set(++id,fn);return id;},cancelAnimationFrame:i=>rafs.delete(i),
  addEventListener:listen,removeEventListener:unlisten,
  IntersectionObserver:class {constructor(fn){env.intersect=fn;}observe(){}disconnect(){}},
  ResizeObserver:class {observe(){}disconnect(){}},MutationObserver:class {observe(){}disconnect(){}}
 };
 const controller=createBackground(canvas,env);controller.setScene('story');
 const visible=value=>env.intersect([{isIntersecting:value}]);
 const step=()=>{const queued=[...timers.values()];timers.clear();queued.forEach(fn=>fn());const queuedRaf=[...rafs.values()];rafs.clear();time+=40;queuedRaf.forEach(fn=>fn(time));};
 return {controller,canvas,doc,motion,visible,step,timers,rafs,storage,listeners};
}
test('background starts only when visible, caps DPR, and renders without changing layout',()=>{
 const s=setup();assert.equal(s.timers.size,0);s.visible(true);assert.equal(s.canvas.dataset.state,'running');
 assert.equal(s.canvas.dataset.dpr,'2');const frames=+s.canvas.dataset.frames;s.step();assert(+s.canvas.dataset.frames>frames);s.controller.destroy();
 assert.equal(s.timers.size+s.rafs.size,0);assert.equal(s.listeners.size,0);assert(s.canvas.removed);
});
test('pause cancels work, persists locally, and resumes without touching timelines',()=>{
 const s=setup();s.visible(true);s.controller.pause(true);const frames=s.canvas.dataset.frames;s.step();
 assert.equal(s.canvas.dataset.state,'paused');assert.equal(s.canvas.dataset.frames,frames);assert.equal(s.storage.get('pacific-background-paused'),'1');
 s.controller.pause(false);assert.equal(s.canvas.dataset.state,'running');s.step();assert(+s.canvas.dataset.frames>+frames);s.controller.destroy();
});
test('reduced motion and restored pause preference schedule no animation',()=>{
 for(const options of [{reduced:true},{stored:true}]){const s=setup(options);s.visible(true);const frames=s.canvas.dataset.frames;s.step();assert.equal(s.canvas.dataset.frames,frames);assert.equal(s.timers.size+s.rafs.size,0);s.controller.destroy();}
});
test('hidden tab and offscreen host stop and restart animation safely',()=>{
 const s=setup();s.visible(true);s.doc.hidden=true;s.listeners.get('visibilitychange')();assert.equal(s.canvas.dataset.state,'hidden');
 const frames=s.canvas.dataset.frames;s.step();assert.equal(s.canvas.dataset.frames,frames);assert.equal(s.timers.size+s.rafs.size,0);
 s.doc.hidden=false;s.listeners.get('visibilitychange')();assert.equal(s.canvas.dataset.state,'running');
 s.visible(false);assert.equal(s.timers.size+s.rafs.size,0);s.visible(true);assert.equal(s.canvas.dataset.state,'running');s.controller.destroy();
});
test('text-heavy pages stay static; scene changes reuse the same canvas',()=>{
 const s=setup();s.visible(true);s.controller.setScene('media');assert.equal(s.canvas.dataset.state,'static');assert.equal(s.timers.size+s.rafs.size,0);
 s.controller.setScene('method');assert.equal(s.canvas.dataset.state,'static');s.controller.destroy();
});
test('slow draw measurements drop actual detail tiers',()=>{
 const s=setup({drawCost:30});s.visible(true);s.step();s.step();assert.equal(s.canvas.dataset.layers,'1');s.controller.destroy();
});
