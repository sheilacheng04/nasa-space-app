import {esc,finite} from './core.js';
export function chart(input,{key,label,unit,color='var(--blue)',bars=false,annotation=''}={}){
 const rows=[...input].filter(r=>Number.isFinite(Date.parse(r.date))).sort((a,b)=>a.date.localeCompare(b.date));
 const clean=rows.filter(r=>finite(r[key]));
 if(!clean.length)return '<div class="empty-chart"><strong>Not available · n = 0</strong><p>No '+esc(label.toLowerCase())+' measurements. Missing values are not zero.</p><p class="source-line">'+esc(annotation)+'</p></div>';
 const w=500,h=225,p={l:48,r:25,t:30,b:33},values=clean.map(r=>r[key]);let lo=bars?Math.min(0,...values):Math.min(...values),hi=Math.max(...values);
 if(hi===lo){lo-=1;hi+=1;}else if(!bars){const pad=(hi-lo)*.16;lo-=pad;hi+=pad;}
 const times=rows.map(r=>Date.parse(r.date)),t0=times[0],t1=times.at(-1),x=t=>p.l+(t1>t0?(t-t0)/(t1-t0):.5)*(w-p.l-p.r),y=v=>h-p.b-(v-lo)*(h-p.t-p.b)/(hi-lo);
 const radar=/backscatter|gamma|water area/i.test(label);let marks='';
 if(bars){const bw=Math.min(26,(w-p.l-p.r)/rows.length*.65);marks=rows.map((r,i)=>finite(r[key])?'<rect x="'+(x(times[i])-bw/2)+'" y="'+Math.min(y(0),y(r[key]))+'" width="'+bw+'" height="'+Math.abs(y(0)-y(r[key]))+'" fill="'+color+'"><title>'+esc(r.date)+': '+r[key]+' '+esc(unit)+'</title></rect>':'').join('');}
 else{let last=null;const path=rows.map((r,i)=>{if(!finite(r[key])){last=null;return '';}const start=last===null||(radar&&times[i]-last>18*86400000);last=times[i];return(start?'M':'L')+x(times[i]).toFixed(1)+','+y(r[key]).toFixed(1);}).join(' ');marks='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2"/>'+rows.map((r,i)=>finite(r[key])?'<circle cx="'+x(times[i])+'" cy="'+y(r[key])+'" r="2.5" fill="'+color+'"><title>'+esc(r.date)+': '+r[key]+' '+esc(unit)+'</title></circle>':'').join('');}
 const gap0=Date.parse('2026-07-27T22:03:25Z'),gap1=Date.parse('2026-08-10T00:55:27Z');
 const gap=radar&&t0<gap1&&t1>gap0?'<rect x="'+x(Math.max(t0,gap0))+'" y="'+p.t+'" width="'+(x(Math.min(t1,gap1))-x(Math.max(t0,gap0)))+'" height="'+(h-p.b-p.t)+'" fill="var(--neutral)"/><text x="'+x(Math.max(t0,gap0))+'" y="'+(p.t+12)+'" font-size="9" fill="var(--ink)">Mission gap</text>':'';
 const ticks=[lo,(lo+hi)/2,hi].map(v=>'<line x1="'+p.l+'" x2="'+(w-p.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(p.l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="10" fill="var(--muted)">'+v.toFixed(1)+'</text>').join('');
 const desc=label+', n = '+clean.length+' available samples, '+rows[0].date+' to '+rows.at(-1).date+'. '+annotation;
 return '<svg class="chart-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(desc)+'"><text x="'+p.l+'" y="14" font-size="10" fill="'+color+'">'+esc(label)+' · '+esc(unit)+' · n = '+clean.length+'</text>'+gap+ticks+marks+'<text x="'+p.l+'" y="'+(h-7)+'" font-size="10" fill="var(--muted)">'+esc(rows[0].date)+'</text><text x="'+(w-p.r)+'" y="'+(h-7)+'" text-anchor="end" font-size="10" fill="var(--muted)">'+esc(rows.at(-1).date)+'</text></svg><p class="source-line">'+esc(annotation)+'</p><details><summary class="source-line">View chart data · n = '+clean.length+'</summary><div class="data-preview"><table><thead><tr><th>Date</th><th>'+esc(label)+' ('+esc(unit)+')</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+(finite(r[key])?r[key].toFixed(2):'not available')+'</td></tr>').join('')+'</tbody></table></div></details>';
}

// Weather-only comparison; keep radar charts and their gap handling unchanged.
export function weatherChart(rows,{label,unit,color='var(--blue)',bars=false,domain,annotation=''}) {
 const [lo,hi]=domain,w=560,h=260,p={l:50,r:16,t:24,b:40};
 const x=i=>p.l+(i+.5)*(w-p.l-p.r)/12;
 const y=v=>h-p.b-(v-lo)*(h-p.t-p.b)/(hi-lo);
 const monthName=i=>new Date(Date.UTC(2026,i,1)).toLocaleDateString('en',{month:'short',timeZone:'UTC'});
 const value=v=>finite(v)?v.toFixed(2):'not available';
 const departure=v=>finite(v)?(v>0?'+':'')+v.toFixed(2):'not available';
 const title=r=>r.date+': observed '+value(r.observed)+' '+unit+', historical average '+value(r.baseline)+' '+unit+', departure '+departure(r.anomaly)+' '+unit+'. '+r.status;
 const ticks=Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4).map(v=>'<line x1="'+p.l+'" x2="'+(w-p.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(p.l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--muted)">'+v.toFixed(1)+'</text>').join('');
 let marks='';
 if(bars){
  marks=rows.map((r,i)=>'<g><title>'+esc(title(r))+'</title>'+(finite(r.observed)?'<rect x="'+(x(i)-12)+'" y="'+y(r.observed)+'" width="11" height="'+(y(0)-y(r.observed))+'" fill="'+color+'"/>':'')+(finite(r.baseline)?'<rect x="'+(x(i)+2)+'" y="'+y(r.baseline)+'" width="11" height="'+(y(0)-y(r.baseline))+'" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="3 2"/>':'')+'</g>').join('');
 }else{
  for(const key of ['baseline','observed']){
   let previous=false;
   const path=rows.map((r,i)=>{if(!finite(r[key])){previous=false;return '';}const command=previous?'L':'M';previous=true;return command+x(i)+','+y(r[key]);}).join(' ');
   marks+='<path d="'+path+'" fill="none" stroke="'+(key==='observed'?color:'var(--muted)')+'" stroke-width="2"'+(key==='baseline'?' stroke-dasharray="5 4"':'')+'/>';
   marks+=rows.map((r,i)=>finite(r[key])?'<circle cx="'+x(i)+'" cy="'+y(r[key])+'" r="3" fill="'+(key==='observed'?color:'var(--card)')+'" stroke="'+(key==='observed'?color:'var(--muted)')+'"><title>'+esc(title(r))+'</title></circle>':'').join('');
  }
 }
 const labels=rows.map((r,i)=>'<text x="'+x(i)+'" y="'+(h-21)+'" text-anchor="middle" font-size="11" fill="var(--muted)">'+monthName(i)+'</text>'+(r.observed===null?'<text x="'+x(i)+'" y="'+(h-5)+'" text-anchor="middle" font-size="12" fill="var(--muted)">'+(r.status==='Incomplete month'?'I':'—')+'</text>':'')).join('');
 const count=rows.filter(r=>r.observed!==null).length;
 return '<div class="weather-legend"><span style="color:'+color+'">Observed ERA5 estimate (solid)</span><span>Historical average (dashed) (1991–2020)</span></div><svg class="chart-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(label+' ('+unit+'), '+count+' complete observations. Historical average for the same calendar month. Missing observations stay blank; values and departures in the table below.')+'"><text x="'+p.l+'" y="14" font-size="11" fill="var(--muted)">'+esc(unit)+'</text>'+ticks+marks+labels+'</svg><p class="source-line">I: incomplete month; —: observation unavailable. Historical averages can remain visible when an observation is missing. Same scale for 2025 and 2026.</p><p class="source-line">'+esc(annotation)+'</p><details><summary>View '+esc(label.toLowerCase())+' values and departures</summary><div class="table-scroll"><table><caption>'+esc(label+' / '+rows[0]?.date.slice(0,4)+' / '+unit)+'</caption><thead><tr><th scope="col">Month</th><th scope="col">Observed</th><th scope="col">Historical average</th><th scope="col">Departure</th><th scope="col">Observation status</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><th scope="row">'+monthName(i)+'</th><td>'+value(r.observed)+'</td><td>'+value(r.baseline)+'</td><td>'+departure(r.anomaly)+'</td><td>'+esc(r.status)+'</td></tr>').join('')+'</tbody></table></div></details>';
}
