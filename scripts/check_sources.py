"""Probe the supplied URLs. HTTP 200 is reachability, not scientific validation."""
import concurrent.futures, datetime as dt, json
from pathlib import Path
import requests
try:
 import truststore
 truststore.inject_into_ssl()
except ImportError:
 pass
ROOT=Path(__file__).resolve().parents[1]
def probe(url):
 row={"url":url,"retrievedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"maturity":"not applicable","crid":"not applicable","parameters":{"method":"GET","timeoutSeconds":18}}
 try:
  r=requests.get(url,timeout=(8,18),headers={"User-Agent":"TwoFacedPacific-SpaceApps/3.0"},stream=True)
  row.update(status=r.status_code,finalUrl=r.url,contentType=r.headers.get("Content-Type"),reachable=r.ok)
  r.close()
 except requests.RequestException as e:row.update(reachable=False,error=type(e).__name__+": "+str(e)[:250])
 print(str(row.get("status","ERROR"))+" "+url,flush=True)
 return row
def main():
 urls=json.loads((ROOT/"data/source_urls.json").read_text())
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:rows=list(pool.map(probe,urls))
 result={"retrievedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"meaning":"Reachability only. 400 may mean missing API parameters. 403 may mean authentication or bot protection.","sources":rows}
 for folder in [ROOT/"data",ROOT/"public/data"]:
  (folder/"network-status.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
 print(json.dumps({"reachable":sum(x["reachable"] for x in rows),"total":len(rows)}),flush=True)
if __name__=="__main__":main()
