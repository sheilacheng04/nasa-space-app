import {assetURL,finite} from './core.js';
import {radarMetadata} from './radar-data.js';

export function validBounds(value){
 return Array.isArray(value)&&value.length===4&&value.every(finite)&&value[0]>=-180&&value[2]<=180&&value[1]>=-90&&value[3]<=90&&value[0]<value[2]&&value[1]<value[3];
}
export function selectionDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value))return null;
 const day=value.slice(0,10),parsed=new Date(day+'T00:00:00Z');
 if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==day)return null;
 if(value.length===10)return day;
 if(!/(Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const timestamp=new Date(value);return Number.isFinite(+timestamp)?timestamp.toISOString().slice(0,10):null;
}
function mosaicBounds(record){
 let bbox=record?.parameters?.BBOX,srs=record?.parameters?.SRS;
 try{const params=new URL(record?.url).searchParams;bbox??=params.get('BBOX');srs??=params.get('SRS');}catch{}
 const parts=typeof bbox==='string'?bbox.split(','):[];
 const bounds=parts.length===4&&parts.every(p=>p.trim())?parts.map(Number):null;
 return srs==='EPSG:4326'&&validBounds(bounds)?bounds:null;
}
function validFootprint(value){
 if(!value||!['Polygon','MultiPolygon'].includes(value.type)||!Array.isArray(value.coordinates))return false;
 const polygons=value.type==='Polygon'?[value.coordinates]:value.coordinates;
 return polygons.length>0&&polygons.every(p=>Array.isArray(p)&&p.length>0&&p.every(r=>Array.isArray(r)&&r.length>=4&&r.every(pt=>Array.isArray(pt)&&pt.length>=2&&finite(pt[0])&&finite(pt[1])&&Math.abs(pt[0])<=180&&Math.abs(pt[1])<=90)&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]));
}
export function mapSelection(site,record,pol,contextLayers=[],{mode='gibs',catalog=[]}={}){
 const day=selectionDay(record?.date),simulation=mode==='simulated';
 const bounds=mode==='gibs'?mosaicBounds(record):mode==='processed'&&validBounds(record?.bounds)?record.bounds:null;
 const image=mode==='gibs'?record?.image:record?.channels?.[pol]?.image;
 const source=mode==='gibs'?'NASA / ISRO NISAR via NASA GIBS':mode==='browse'?'NASA / ISRO NISAR via ASF DAAC':simulation?'Team simulation':'Processed NISAR evidence';
 // Identity match only. Same-date catalog entries do not establish mosaic pixel lineage.
 const scene=!simulation&&mode!=='gibs'&&record?.id?(Array.isArray(catalog)?catalog:[]).find(s=>s.id===record.id):null;
 const footprint=validFootprint(scene?.footprint)?scene.footprint:null;
 const points=footprint?(footprint.type==='Polygon'?[footprint.coordinates]:footprint.coordinates).flat(2):[];
 const footprintBounds=points.length?[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]:null;
 const intersects=b=>validBounds(site.bbox)&&b[0]<site.bbox[2]&&b[2]>site.bbox[0]&&b[1]<site.bbox[3]&&b[3]>site.bbox[1];
 const layers=simulation?[]:contextLayers.filter(layer=>layer&&assetURL(layer.image)&&validBounds(layer.bounds)&&intersects(layer.bounds)&&(!layer.siteId||layer.siteId===site.id)&&typeof layer.name==='string'&&typeof layer.attribution==='string'&&layer.attribution.trim()&&(layer.isStatic===true||(day&&selectionDay(layer.date)===day)));
 return {siteId:site.id,siteName:site.name,day,date:day?record.date:'Date unavailable',mode,channel:mode==='gibs'?'NASA false-color browse':pol,source,
  radar:!simulation&&day&&bounds&&assetURL(image)?{image:assetURL(image),bounds}:null,
  metadata:radarMetadata(record,mode),footprintBounds,footprintId:footprint?record.id:null,footprint,footprintSource:scene?.sourceUrl||'',layers,opticalDate:simulation?null:day,
  reason:simulation?'Simulation selected: no real radar or optical observation is assigned.':!day?'A valid selected date is unavailable; no radar overlay or optical date is assigned.':!image?'No saved radar image for this selection; geographic references remain visible.':!bounds?(mode==='browse'?'The regional quicklook has no saved image-to-ground transform; it is not draped on the map.':'Image georeferencing is unavailable; no radar image is draped on the map.'):'Dated radar browse, not calibrated backscatter. Transparent pixels are not classified water.'};
}
export function opticalRequest(site,day){
 const date=selectionDay(day);if(!date||!validBounds(site?.bbox))return null;
 return 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?'+new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:'MODIS_Terra_CorrectedReflectance_TrueColor',STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',SRS:'EPSG:4326',BBOX:site.bbox.join(','),WIDTH:'1024',HEIGHT:'768',TIME:date});
}
