// Restored from 5c3198f:src/world.js. Phase-responsive towers and rings also
// follow the original 85a7427 prototype. These are illustrations, not measurements.
import {geoCentroid} from 'd3-geo';

export const illustrationDefaults={layer:'heat',phase:0,anomaly:0,links:true,towers:true,labels:true,userData:true};
export const illustrationLegends={
 heat:['Ocean-index illustration','Cooler','Warmer','linear-gradient(90deg,#2166ac,#f5f5f5,#db3b13)'],
 rain:['Illustrative rainfall pattern','Drier','Wetter','linear-gradient(90deg,#8c510a,#f5f5f5,#01665e)'],
 stress:['Illustrative combined pattern','Lower','Higher','linear-gradient(90deg,#636ebd,#e66a35)'],
 geography:['Geographic locations','Countries','Study sites','linear-gradient(90deg,#7798b9,#efb47c)']
};
export function phaseLabel(phase){return phase<15?'Normal conditions':phase<50?'Winds weaken':phase<85?'El Niño':'Stronger signal';}
export function pattern([lng,lat]){
 const west=lng>90&&lng<160&&lat>-25&&lat<35,peru=lng>-85&&lng<-65&&lat>-20&&lat<8,africa=lng>25&&lng<50&&lat>-10&&lat<15,south=lng>-65&&lng<-40&&lat>-38&&lat<-15;
 return {dry:west?1:.13,wet:peru||africa||south?1:.08,warm:.22+.45*Math.cos(lat*Math.PI/180)**2+(west?.24:0)};
}
const blend=(a,b,t)=>'#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
export function countryColor(p,layer,phase,selected=false,anomaly=null){
 if(selected)return '#ff7a3d';
 if(layer==='geography')return '#7798b9';
 const t=phase/100;
 if(anomaly!==null&&layer==='heat')return anomaly<0?blend('f5f5f5','2166ac',Math.min(1,Math.abs(anomaly)/3)):blend('f5f5f5','db3b13',Math.min(1,anomaly/3));
 if(layer==='rain'){const signal=(p.wet-p.dry)*t*(anomaly!==null&&anomaly<0?-1:1);return signal>0?blend('f5f5f5','01665e',Math.min(1,signal)):blend('f5f5f5','8c510a',Math.min(1,-signal));}
 if(layer==='stress')return blend('636ebd','e66a35',Math.min(1,(p.warm*.65+Math.max(p.wet,p.dry)*.35)*(.3+.7*t)));
 return blend('ffdb76','db3b13',Math.min(1,p.warm*(.25+.75*t)));
}
const patterns=new WeakMap(),renderers=new WeakMap();
const countryPattern=f=>{if(!patterns.has(f))patterns.set(f,pattern(geoCentroid(f)));return patterns.get(f);};
export function renderIllustration(world,countries,sites,points,state,selected,reduced,imagery){
 const t=state.phase/100,old=renderers.get(world);
 const values=points.map(p=>p.value).filter(Number.isFinite),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;
 const structure=[countries,sites,points,state.links,state.towers,state.labels,state.userData,selected,reduced];
 const rebuild=!old||structure.some((value,i)=>value!==old.structure[i]);
 if(rebuild){
  const markers=[...(state.towers?sites.map(s=>({...s,site:true,lat:s.coordinates[1],lng:s.coordinates[0]})):[]),...(state.userData?points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).map(p=>({...p,user:true})):[])];
  const labels=state.labels?[...sites.map(s=>({...s,site:true,lat:s.coordinates[1],lng:s.coordinates[0]})),...(selected&&!selected.site?[{...selected,pin:true}]:[])]:[];
  const arcs=state.links?sites.map(s=>({startLat:0,startLng:-145,endLat:s.coordinates[1],endLng:s.coordinates[0],color:s.id==='dadu'?['#7cc4ff','#3da9ff']:['#ffbe6e','#ff7a3d']})):[];
  const rings=reduced?[]:[{lat:0,lng:-145,pacific:true,color:'255,122,61'},...sites.map(s=>({lat:s.coordinates[1],lng:s.coordinates[0],color:s.id==='dadu'?'61,169,255':'255,170,80'})),...(selected&&!selected.site?[{lat:selected.lat,lng:selected.lng,color:'255,210,77'}]:[])];
  world.polygonsData(countries.features).pointsMerge(false).pointsData(markers).labelsData(labels).arcsData(arcs).ringsData(rings);
  renderers.set(world,{structure,counts:{points:markers.length,labels:labels.length,arcs:arcs.length,rings:rings.length}});
 }
 world.showAtmosphere(true).atmosphereColor('#5aaaff').atmosphereAltitude(.18)
  .polygonCapCurvatureResolution(5).polygonSideColor(()=>'#a9bfd7')
  .polygonCapColor(f=>{const color=countryColor(countryPattern(f),state.layer,state.phase,selected?.feature===f,state.anomaly);return imagery?color+'66':color;})
  .polygonAltitude(f=>.003+(state.layer==='geography'?0:countryPattern(f).warm*.025*t)+(selected?.feature===f?.018:0))
  .polygonStrokeColor(f=>selected?.feature===f?'#fff':'rgba(245,249,255,.78)')
  .pointRadius(d=>selected?.id&&d.id===selected.id?.58:d.user?.25:.38).pointAltitude(d=>d.user?(Number.isFinite(d.value)?.035+.18*(d.value-min)/((max-min)||1):.045):.035+.12*pattern([d.lng,d.lat]).warm*t)
  .pointColor(d=>selected?.id&&d.id===selected.id?'#ff7a3d':d.user?'#3de0d0':d.id==='dadu'?'#3da9ff':'#ffad61')
  .labelColor(d=>d.pin?'#ffe1a0':'#eaf2ff').labelSize(d=>d.pin?.65:.48)
  .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng').arcColor('color')
  .arcAltitudeAutoScale(.36).arcCurveResolution(32).arcDashLength(.4).arcDashGap(.25).arcDashAnimateTime(reduced?0:2600).arcStroke(.22+state.phase/350)
  .ringLat('lat').ringLng('lng').ringMaxRadius(d=>d.pacific?8+28*t:3+5*t).ringPropagationSpeed(2).ringRepeatPeriod(1600).ringColor(d=>u=>`rgba(${d.color},${1-u})`);
 return renderers.get(world).counts;
}
export function clearIllustration(world){if(world)renderers.delete(world);}
