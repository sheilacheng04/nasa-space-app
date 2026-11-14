// Keep immutable JSON successes and shared in-flight work; rejection is never sticky.
export function createJSONCache() {
 const entries=new Map();
 return function load(key,fetcher,reload=false) {
  if(!reload&&entries.has(key))return entries.get(key);
  const pending=Promise.resolve().then(fetcher);
  entries.set(key,pending);
  pending.catch(()=>{if(entries.get(key)===pending)entries.delete(key);});
  return pending;
 };
}
