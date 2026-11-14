"""Shared provenance, bounded HTTP and atomic JSON helpers."""
import datetime as dt, json
from pathlib import Path
import requests
try:
 import truststore
 truststore.inject_into_ssl()
except ImportError:
 pass
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
PUBLIC=ROOT/'public/data'
AS_OF='2026-11-14'
def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def get(url,params=None,timeout=35):
 r=requests.get(url,params=params,timeout=(10,timeout),headers={'User-Agent':'TwoFacedPacific-SpaceApps/3.0'})
 r.raise_for_status()
 return r
def save(relative,value):
 for folder in (DATA,PUBLIC):
  path=folder/relative
  path.parent.mkdir(parents=True,exist_ok=True)
  temp=path.with_suffix(path.suffix+'.tmp')
  temp.write_text(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False),encoding='utf-8')
  temp.replace(path)
def read(relative): return json.loads((DATA/relative).read_text(encoding='utf-8'))
