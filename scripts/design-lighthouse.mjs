// Audit-only packages live in ignored .artifacts/design-tools; no app dependency.
import lighthouse from '../.artifacts/design-tools/node_modules/lighthouse/core/index.js';
import {launch} from '../.artifacts/design-tools/node_modules/chrome-launcher/dist/index.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const phase=process.argv[2]||'after';
const chrome=await launch({chromePath:[
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync),chromeFlags:['--headless','--no-sandbox','--disable-gpu']});
try {
 const results=[];
 for(let run=0;run<3;run++) {
  const {lhr,report}=await lighthouse((process.env.PREVIEW_URL||'http://127.0.0.1:5175')+'/#story',{
   port:chrome.port,output:'json',onlyCategories:['performance','accessibility','best-practices','seo'],logLevel:'error'
  });
  results.push({run:run+1,scores:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)])),
    fcpMs:lhr.audits['first-contentful-paint'].numericValue,lcpMs:lhr.audits['largest-contentful-paint'].numericValue,
    cls:lhr.audits['cumulative-layout-shift'].numericValue,tbtMs:lhr.audits['total-blocking-time'].numericValue});
  await mkdir('.artifacts/design',{recursive:true});
  await writeFile(`.artifacts/design/lighthouse-${phase}-${run+1}.json`,report);
 }
 await writeFile(`docs/design/${phase}-lighthouse.json`,JSON.stringify({phase,profile:'Lighthouse default simulated mobile; cold storage; Chrome headless --disable-gpu; median of three',results},null,2));
 console.log(JSON.stringify(results));
} finally {await chrome.kill();}
