import {finite} from './core.js';

// Join only the same calendar month. Partial observations never become low totals.
export function weatherRows(context, year, key) {
 return Array.from({length:12}, (_,i) => {
  const month=i+1, date=year+'-'+String(month).padStart(2,'0')+'-01';
  const row=context?.monthly?.find(r=>r.year===year&&r.month===month);
  const base=context?.baselineMonthly?.find(r=>r.month===month);
  const expected=new Date(Date.UTC(year,month,0)).getUTCDate();
  const incomplete=Boolean(row && (row.complete!==true ||
   ['nRainDays','nTemperatureDays','expectedDays'].some(k=>row[k]!==undefined&&row[k]!==expected)));
  const observed=!incomplete&&finite(row?.[key])?row[key]:null;
  const baseline=finite(base?.[key])&&(base.nYears===undefined||base.nYears===30)?base[key]:null;
  const anomaly=observed!==null&&baseline!==null?Number((observed-baseline).toFixed(2)):null;
  return {date,month,observed,baseline,anomaly,status:incomplete?'Incomplete month':observed===null?'Observation unavailable':baseline===null?'Baseline unavailable':'Complete month'};
 });
}

// Fix the scale across the two selectable years; include baseline and observations.
export function weatherDomain(context, key) {
 const values=[2025,2026].flatMap(year=>weatherRows(context,year,key)).flatMap(r=>[r.observed,r.baseline]).filter(finite);
 if(!values.length)return [0,1];
 if(key==='rain')return [0,Math.max(1,...values)*1.1];
 const lo=Math.min(...values),hi=Math.max(...values),pad=Math.max(1,(hi-lo)*.12);
 return [lo-pad,hi+pad];
}
