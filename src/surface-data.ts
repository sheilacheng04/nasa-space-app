export type SurfaceCategory = 'vegetation' | 'soil' | 'water' | 'change';
export const surfaceCategories: Record<SurfaceCategory, {label:string;channel:'HH'|'HV'|'composite';color:string;description:string}> = {
 vegetation: {label:'Trees & crops',channel:'HV',color:'#43b99b',description:'Inspect HV radar returns through the growing season. Canopy structure, harvest and viewing geometry can all affect brightness.'},
 soil: {label:'Soil & wet ground',channel:'HH',color:'#dda457',description:'Inspect HH radar returns over exposed ground. Moisture, roughness and farming activity can all affect brightness.'},
 water: {label:'Water & shorelines',channel:'HH',color:'#62b9f3',description:'Follow water boundaries in HH previews. Dark radar returns alone do not identify water or measure reservoir volume.'},
 change: {label:'Radar comparison',channel:'composite',color:'#bd9af7',description:'Compare dated NISAR false-color mosaics for visible surface patterns. These are visual comparisons, not calibrated change maps.'}
};
export interface SurfaceFrame {
 id?:string;date:string;image?:string;status?:string;sourceUrl?:string;url?:string;
 track?:number;frame?:number;maturity?:string;crid?:string;direction?:string;
 channels?:Record<string,{image?:string;sourceUrl?:string}>;
}
export interface SurfaceEvidence {browse?:{frames:SurfaceFrame[]};gibs?:{frames:SurfaceFrame[]}}
export interface SurfaceScene {id:string;date:string;polarizations?:string[]}
export interface SurfaceInventory {asOf?:string;sites:{siteId:string;url?:string;scenes:SurfaceScene[]}[]}
export function surfaceFrames(evidence:SurfaceEvidence|undefined, category:SurfaceCategory):SurfaceFrame[] {
 const channel=surfaceCategories[category].channel;
 return (channel==='composite'?evidence?.gibs?.frames||[]:evidence?.browse?.frames||[])
  .map(frame=>channel==='composite'?frame:{...frame,image:frame.channels?.[channel]?.image,sourceUrl:frame.channels?.[channel]?.sourceUrl})
  .filter(frame=>Boolean(frame.image)&&frame.status!=='not available'&&frame.status!=='no-data')
  .sort((a,b)=>a.date.localeCompare(b.date));
}
export function surfaceMonths(inventory:SurfaceInventory|null, evidence:Record<string,SurfaceEvidence>):string[] {
 const dates=[...(inventory?.sites||[]).flatMap(site=>site.scenes.map(scene=>scene.date)),...Object.values(evidence).flatMap(item=>[...(item.browse?.frames||[]),...(item.gibs?.frames||[])].map(frame=>frame.date))].filter(date=>/^\d{4}-\d{2}-\d{2}/.test(date)).sort();
 if(!dates.length)return [];
 const cursor=new Date(dates[0].slice(0,7)+'-01T00:00:00Z'),last=dates.at(-1)!.slice(0,7),months:string[]=[];
 while(cursor.toISOString().slice(0,7)<=last){months.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
 return months;
}
export function surfaceReading(scenes:SurfaceScene[],frames:SurfaceFrame[],month:string,category:SurfaceCategory) {
 const channel=surfaceCategories[category].channel;
 const acquisitions=new Set(scenes.filter(scene=>scene.date.startsWith(month)&&(channel==='composite'||scene.polarizations?.includes(channel))).map(scene=>scene.date)).size;
 const previews=frames.filter(frame=>frame.date.startsWith(month)).length;
 return {acquisitions,previews,status:previews?'preview':acquisitions?'catalog':'missing'} as const;
}
