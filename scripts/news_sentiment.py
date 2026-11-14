"""E. Keep the 43 supplied articles; merge only GDELT's last three months."""
import datetime as dt,hashlib,json
from urllib.parse import urlsplit,urlunsplit
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from pipeline_common import *
OVERRIDES={'warm':0.0,'warming':0.0,'positive':0.0,'negative':0.0,'record':0.0,'records':0.0,'anomaly':0.0,'anomalies':0.0}
def normalized(url):
 p=urlsplit(url);return urlunsplit((p.scheme,p.netloc.lower(),p.path.rstrip('/'),p.query,''))
def merge(existing,added):
 result={normalized(x['url']):dict(x) for x in existing}
 for item in added:
  key=normalized(item['url'])
  if key not in result:result[key]=item
 return sorted(result.values(),key=lambda x:x['date'],reverse=True)
def main():
 cached=json.loads((PUBLIC/'news.json').read_text(encoding='utf-8'))
 original=cached['items'];added=[];end=dt.date.fromisoformat(AS_OF);start=dt.date(2026,8,15)
 params={'query':'("El Nino" OR "El Niño" OR NISAR) sourcelang:english','mode':'artlist','format':'json','startdatetime':start.strftime('%Y%m%d')+'000000','enddatetime':end.strftime('%Y%m%d')+'000000','maxrecords':250,'sort':'datedesc'}
 status='not available';error=None;url='https://api.gdeltproject.org/api/v2/doc/doc'
 try:
  r=get(url,params,25);url=r.url;payload=r.json()
  for a in payload.get('articles',[]):
   link=a.get('url','')
   if not link.startswith(('https://','http://')):continue
   date=dt.datetime.strptime(a['seendate'],'%Y%m%dT%H%M%SZ').date()
   if not start<=date<end:continue
   added.append({'id':hashlib.sha256(link.encode()).hexdigest()[:16],'title':a['title'],'source':a.get('domain','Source'),'url':link,'date':date.isoformat(),'theme':'Climate reporting','region':a.get('sourcecountry','Unclassified'),'verification':'GDELT discovery; date is first seen, claims not independently verified','ai':None})
  status='ready' if added else 'no records returned'
 except Exception as e:error=type(e).__name__+': '+str(e)[:200]
 raw=SentimentIntensityAnalyzer();adjusted=SentimentIntensityAnalyzer();adjusted.lexicon.update(OVERRIDES)
 items=merge(original,added)
 for item in items:
  item['vader']=raw.polarity_scores(item['title'])['compound'];item['vaderAdjusted']=adjusted.polarity_scores(item['title'])['compound']
  item.setdefault('ai',None)
 result={'status':'merged' if added else 'archive','retrievedAt':now(),'source':'Supplied 43-item archive + GDELT DOC 2.0 when available','items':items,'gdelt':{'status':status,'url':url,'parameters':params,'retrievedAt':now(),'maturity':'news discovery, unverified claims','crid':'not applicable','newRecords':len(added),'error':error},'sentimentMethod':{'package':'vaderSentiment','climateOverrides':OVERRIDES,'warning':'Tone of headlines, not public opinion, climate risk or attribution. AI scores remain null until actually scored.'}}
 save('news.json',result);print('News',len(items),'GDELT',status,flush=True)
if __name__=='__main__':main()
