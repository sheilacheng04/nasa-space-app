import {geoEquirectangular,geoPath} from 'd3-geo';

// Geographic reference only. This base never establishes radar coverage.
const referenceBases=new Map();
let referenceCountries=null;

function surface(width,height){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');
 if(!context)throw new Error('The satellite surface could not be drawn.');
 return {canvas,context};
}

function referenceBase(countries,width,height){
 if(referenceCountries!==countries){
  referenceBases.clear();
  referenceCountries=countries;
 }
 const key=width+'x'+height;
 if(referenceBases.has(key)){
  const cached=referenceBases.get(key);
  referenceBases.delete(key);referenceBases.set(key,cached);
  return cached;
 }
 const {canvas,context}=surface(width,height);
 context.fillStyle='#173653';
 context.fillRect(0,0,width,height);
 if(countries?.features?.length){
  const projection=geoEquirectangular()
   .translate([width/2,height/2])
   .scale(width/(2*Math.PI))
   .clipExtent([[0,0],[width,height]]);
  const path=geoPath(projection,context);
  context.beginPath();path(countries);
  context.fillStyle='#526d84';context.fill();
  context.strokeStyle='#71899d';
  context.lineWidth=Math.max(.45,width/2400);
  context.stroke();
 }
 referenceBases.set(key,canvas);
 while(referenceBases.size>2)referenceBases.delete(referenceBases.keys().next().value);
 return canvas;
}

/**
 * Place an unmodified, dated radar image over optional geographic context.
 * Native dimensions and nearest-neighbor drawing preserve opaque source pixels.
 * Only reference bases are cached; the caller owns each returned canvas.
 */
export function composeSatelliteSurface(countries,radarImage=null,geographicContext=true){
 const width=radarImage?(radarImage.naturalWidth||radarImage.width):1024;
 const height=radarImage?(radarImage.naturalHeight||radarImage.height):512;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0){
  throw new Error('The radar image has no usable native dimensions.');
 }
 const {canvas,context}=surface(width,height);
 context.imageSmoothingEnabled=false;
 if(geographicContext){
  context.drawImage(referenceBase(countries,width,height),0,0);
 }else{
  context.fillStyle='#101a2a';context.fillRect(0,0,width,height);
 }
 if(radarImage)context.drawImage(radarImage,0,0);
 return canvas;
}
