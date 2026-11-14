// Use the same complete browser bundle as the supplied original HTML.
// Its renderer supports WebGL 1 as well as WebGL 2. Mixing its old wrapper
// with a newer transitive Three.js renderer silently removes that support.
import browserBundleURL from '../node_modules/globe.gl/dist/globe.gl.min.js?url';

let loading;
export function loadGlobe(){
 if(typeof globalThis.Globe==='function')return Promise.resolve(globalThis.Globe);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=browserBundleURL;script.async=true;script.dataset.pacificGlobe='true';
  const timer=setTimeout(()=>finish(new Error('The globe renderer took too long to load.')),20000);
  function finish(error){clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();loading=null;reject(error);}else resolve(globalThis.Globe);}
  script.onload=()=>finish(typeof globalThis.Globe==='function'?null:new Error('The globe renderer did not initialize.'));
  script.onerror=()=>finish(new Error('The globe renderer could not be loaded.'));
  document.head.append(script);
 });
 return loading;
}
