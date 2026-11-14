"""D. Observed ocean indices and ERA5 context, with explicit monthly completeness."""
import calendar,concurrent.futures,datetime as dt,re,statistics
from pipeline_common import *
def monthly(daily):
 groups={}
 for row in daily:groups.setdefault(row['date'][:7],[]).append(row)
 output=[]
 for month,rows in sorted(groups.items()):
  year,mon=map(int,month.split('-'));expected=calendar.monthrange(year,mon)[1]
  rain=[r['rain'] for r in rows if r['rain'] is not None];temp=[r['temperature'] for r in rows if r['temperature'] is not None]
  output.append({'date':month+'-01','year':year,'month':mon,'rain':round(sum(rain),2) if len(rain)==expected else None,'temperature':round(statistics.mean(temp),2) if len(temp)==expected else None,'nRainDays':len(rain),'nTemperatureDays':len(temp),'expectedDays':expected,'complete':len(rain)==expected and len(temp)==expected})
 return output
def weather(site):
 meta={'source':'Open-Meteo / ECMWF ERA5 reanalysis','retrievedAt':now(),'model':'ERA5','maturity':'reanalysis; subject to revision','crid':'not applicable','baseline':'1991–2020, same calendar month','temperatureDefinition':'Daily (temperature_2m_max + temperature_2m_min) / 2; monthly mean of complete daily pairs, not daily mean temperature.','daily':[],'monthly':[],'baselineMonthly':[],'requests':[]}
 for period,start,end in [('recent','2025-01-01','2026-11-08'),('baseline','1991-01-01','2020-12-31')]:
  params={'latitude':site['coordinates'][1],'longitude':site['coordinates'][0],'start_date':start,'end_date':end,'daily':'temperature_2m_max,temperature_2m_min,precipitation_sum','models':'era5','timezone':'UTC'}
  request={'period':period,'url':'https://archive-api.open-meteo.com/v1/archive','parameters':params,'retrievedAt':now()}
  try:
   r=get(request['url'],params,45);request.update(url=r.url,status='ready');d=r.json()['daily']
   rows=[{'date':day,'temperature':round((d['temperature_2m_max'][i]+d['temperature_2m_min'][i])/2,3) if d['temperature_2m_max'][i] is not None and d['temperature_2m_min'][i] is not None else None,'rain':d['precipitation_sum'][i]} for i,day in enumerate(d['time'])]
   months=monthly(rows)
   if period=='recent':meta['daily']=[r for r in rows if r['date']>='2026-01-01'];meta['monthly']=months
   else:
    for mon in range(1,13):
     valid=[m for m in months if m['month']==mon and m['complete']]
     meta['baselineMonthly'].append({'month':mon,'rain':round(statistics.mean(m['rain'] for m in valid),2) if len(valid)==30 else None,'temperature':round(statistics.mean(m['temperature'] for m in valid),2) if len(valid)==30 else None,'nYears':len(valid)})
  except Exception as e:request.update(status='not available',reason=type(e).__name__+': '+str(e)[:150])
  meta['requests'].append(request)
 base={r['month']:r for r in meta['baselineMonthly']}
 for m in meta['monthly']:
  b=base.get(m['month'],{})
  m['rainAnomaly']=round(m['rain']-b['rain'],2) if m['rain'] is not None and b.get('rain') is not None else None
  m['temperatureAnomaly']=round(m['temperature']-b['temperature'],2) if m['temperature'] is not None and b.get('temperature') is not None else None
 meta['status']='ready' if meta['monthly'] else 'not available'
 save('context/'+site['id']+'.json',meta);print(site['id'],'weather',meta['status'],'baseline months',len(base),flush=True)
def ocean():
 result={'status':'not available','nino34':None,'label':'NOAA ocean context','measurement':'Weekly Niño 3.4 SST anomaly; ocean temperature, not a NISAR observation.','issuedAt':'','retrievedAt':now(),'outlook':'An ocean index supports a hypothesis. One season cannot establish local attribution.','url':'https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for','source':'NOAA CPC','maturity':'operational index, subject to revision','crid':'not applicable','weekly':[],'oni':[],'parameters':{'weeklyBaseline':'1991–2020','years':[2025,2026]}}
 try:
  r=get(result['url'])
  for line in r.text.splitlines():
   match=re.match(r'\s*(\d{2}[A-Z]{3}\d{4})\s+(.+)',line)
   if not match:continue
   date=dt.datetime.strptime(match[1],'%d%b%Y').date().isoformat()
   nums=[float(x) for x in re.findall(r'[+-]?\d+\.\d+',match[2])]
   if len(nums)==8 and date>='2025-01-01' and date<=AS_OF:result['weekly'].append({'date':date,'sst':nums[4],'anomaly':nums[5]})
  if result['weekly']:
   last=result['weekly'][-1];result.update(nino34=last['anomaly'],issuedAt=last['date'],status='ready')
 except Exception as e:result['weeklyError']=type(e).__name__
 result['oniSource']='https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt'
 try:
  r=get(result['oniSource'])
  for line in r.text.splitlines()[1:]:
   p=line.split()
   if len(p)==4 and 2025<=int(p[1])<=2026:result['oni'].append({'season':p[0],'year':int(p[1]),'anomaly':float(p[3])})
  result['oniRetrievedAt']=now()
 except Exception as e:result['oniError']=type(e).__name__
 save('enso.json',result);print('NOAA weekly',len(result['weekly']),'ONI',len(result['oni']),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  jobs=[pool.submit(weather,s) for s in read('sites.json')]+[pool.submit(ocean)]
  for job in jobs:job.result()
