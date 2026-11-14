import {geoOrthographic,geoPath,geoDistance,geoContains,geoInterpolate} from 'd3-geo';

// A sphere projected to a 2D canvas keeps the globe usable in embedded browsers
// where hardware WebGL is unavailable. It implements the controls used by world.js.
export function createCanvasGlobe(element){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('This browser cannot create a canvas.');
 canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Interactive globe in compatibility mode. Drag to rotate, use the zoom buttons, or search for a place.');
 element.replaceChildren(canvas);
 let width=element.clientWidth||800,height=element.clientHeight||600,dpr=1,active=true,frame=0,last=0,elapsed=0,dirty=true,destroyed=false;
 const view={lat:5,lng:-160,altitude:2.3},settings={polygonsData:[],pointsData:[],labelsData:[],arcsData:[],ringsData:[],polygonCapColor:'#ffbb60',polygonStrokeColor:'#f4f8ff',pointColor:'#ffad61',pointAltitude:.075,labelColor:'#fff',showAtmosphere:true};
 const controls=new EventTarget();Object.assign(controls,{autoRotate:false,autoRotateSpeed:.38,enableDamping:true,rotateSpeed:1,zoomSpeed:1});
 let rotation=false;Object.defineProperty(controls,'autoRotate',{get(){return rotation;},set(value){rotation=Boolean(value);invalidate();}});
 let texture=null,textureReady=Promise.resolve(),textureKey='',rasterKey='',textureSequence=0;const raster=document.createElement('canvas');
 let sea='#9fc3ea',hits=[],pointerStart=null,pinch=0;const pointers=new Map();
 const projection=geoOrthographic().clipAngle(90),path=geoPath(projection,ctx);
 const value=(key,item,fallback)=>typeof settings[key]==='function'?settings[key](item):settings[key]??fallback;
 const field=(key,item,fallback)=>typeof settings[key]==='string'?item[settings[key]]??fallback:value(key,item,fallback);
 const visible=point=>geoDistance([view.lng,view.lat],[point.lng,point.lat])<Math.PI/2;
 const position=point=>projection([point.lng,point.lat]);
 const radius=()=>Math.min(width,height)*.34*3.3/(1+view.altitude);
 function resize(){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';draw();invalidate();}
 function invalidate(){dirty=true;if(active&&!frame&&!destroyed)frame=requestAnimationFrame(tick);}
 function changed(){controls.dispatchEvent(new Event('change'));invalidate();}
 function begin(){controls.dispatchEvent(new Event('start'));}
 function tick(now){frame=0;if(!active||destroyed)return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;elapsed+=dt;if(controls.autoRotate){view.lng-=dt*(controls.autoRotateSpeed||.38)*6;dirty=true;controls.dispatchEvent(new Event('change'));}
  if(dirty||settings.ringsData.length||settings.arcsData.length){draw();dirty=false;}
  if(controls.autoRotate||settings.ringsData.length||(settings.arcsData.length&&settings.arcDashAnimateTime))frame=requestAnimationFrame(next=>{frame=0;if(next-now>=30)tick(next);else frame=requestAnimationFrame(tick);});
 }

 function drawTexture(r,cx,cy){
  if(!texture||!material.visible)return;
  const size=Math.min(innerWidth<700?320:512,Math.round(r*2)),key=[textureKey,size,view.lat.toFixed(3),view.lng.toFixed(3)].join('/');
  if(key!==rasterKey){
   raster.width=raster.height=size;const c=raster.getContext('2d'),out=c.createImageData(size,size),pi=Math.PI,phi=view.lat*pi/180,lambda=view.lng*pi/180,cp=Math.cos(phi),sp=Math.sin(phi);
   for(let py=0;py<size;py++)for(let px=0;px<size;px++){
    const x=(px+.5)/size*2-1,y=1-(py+.5)/size*2,d=x*x+y*y;if(d>1)continue;
    const z=Math.sqrt(1-d),lat=Math.asin(y*cp+z*sp),lng=lambda+Math.atan2(x,z*cp-y*sp);
    const u=((lng+pi)/(2*pi)%1+1)%1,v=(pi/2-lat)/pi;
    const i=(Math.min(texture.h-1,Math.floor(v*texture.h))*texture.w+Math.floor(u*texture.w))*4,j=(py*size+px)*4;
    out.data.set(texture.data.subarray(i,i+4),j);
   }c.putImageData(out,0,0);rasterKey=key;
  }ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,cx-r,cy-r,r*2,r*2);
 }
 function draw(){
  const r=radius(),cx=width/2,cy=height/2;projection.rotate([-view.lng,-view.lat]).translate([cx,cy]).scale(r);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  if(settings.showAtmosphere){const glow=ctx.createRadialGradient(cx,cy,r*.97,cx,cy,r*1.12);glow.addColorStop(0,'rgba(80,157,255,.4)');glow.addColorStop(1,'rgba(50,120,240,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r*1.12,0,Math.PI*2);ctx.fill();}
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sea;ctx.fill();ctx.clip();
  drawTexture(r,cx,cy);
  for(const country of settings.polygonsData){ctx.beginPath();path(country);ctx.fillStyle=value('polygonCapColor',country,'#ffbc69');ctx.fill();ctx.strokeStyle=value('polygonStrokeColor',country,'#eef6ff');ctx.lineWidth=.65;ctx.stroke();}
  if(!texture){const shade=ctx.createRadialGradient(cx-r*.35,cy-r*.45,r*.05,cx,cy,r*1.1);shade.addColorStop(0,'rgba(255,255,255,.15)');shade.addColorStop(.5,'rgba(255,255,255,0)');shade.addColorStop(1,'rgba(7,20,45,.4)');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);}
  for(const arc of settings.arcsData){const interpolate=geoInterpolate([arc.startLng,arc.startLat],[arc.endLng,arc.endLat]);ctx.beginPath();path({type:'LineString',coordinates:Array.from({length:33},(_,i)=>interpolate(i/32))});ctx.strokeStyle=Array.isArray(arc.color)?arc.color[1]:arc.color||'#ffb776';ctx.lineWidth=Math.max(1,field('arcStroke',arc,.3)*4);ctx.setLineDash([11,7]);ctx.lineDashOffset=settings.arcDashAnimateTime?-elapsed*13:0;ctx.stroke();}ctx.setLineDash([]);
  for(const ring of settings.ringsData){if(!visible(ring))continue;const p=position(ring),cycle=(elapsed*1000/field('ringRepeatPeriod',ring,2000))%1;ctx.beginPath();ctx.arc(p[0],p[1],2+cycle*r*field('ringMaxRadius',ring,ring.radius||4)*Math.PI/180,0,Math.PI*2);ctx.strokeStyle=`rgba(${ring.color||'255,170,80'},${1-cycle})`;ctx.lineWidth=1;ctx.stroke();}
  hits=[];for(const point of settings.pointsData){if(!visible(point))continue;const p=position(point),h=Math.max(0,value('pointAltitude',point,.05))*r*.8;ctx.strokeStyle=value('pointColor',point,'#ffad61');ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0],p[1]-h);ctx.stroke();ctx.beginPath();ctx.arc(p[0],p[1]-h,3.5,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();hits.push({point,x:p[0],y:p[1]-h,kind:'point'});}
  for(const label of settings.labelsData){if(!visible(label))continue;const p=position(label);ctx.font='12px system-ui,sans-serif';ctx.textBaseline='middle';ctx.fillStyle=value('labelColor',label,'#f2f8ff');ctx.strokeStyle='#152643';ctx.lineWidth=2;const text=String(label.name||'');ctx.strokeText(text,p[0]+7,p[1]);ctx.fillText(text,p[0]+7,p[1]);hits.push({point:label,x:p[0]+7,y:p[1],width:ctx.measureText(text).width,kind:'label'});}
  ctx.restore();
 }
 function coords(event){const box=canvas.getBoundingClientRect();return[event.clientX-box.left,event.clientY-box.top];}
 function choose(event){const [x,y]=coords(event);const hit=hits.find(h=>h.kind==='point'?Math.hypot(x-h.x,y-h.y)<12:x>=h.x&&x<h.x+h.width&&Math.abs(y-h.y)<10);if(hit){settings[hit.kind==='point'?'onPointClick':'onLabelClick']?.(hit.point,event);return;}
  if(Math.hypot(x-width/2,y-height/2)>radius())return;const location=projection.invert([x,y]);if(!location)return;const country=settings.polygonsData.find(f=>geoContains(f,location));if(country&&settings.onPolygonClick)settings.onPolygonClick(country,event);else settings.onGlobeClick?.({lng:location[0],lat:location[1]},event);
 }
 function down(event){begin();canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,coords(event));pointerStart={x:event.clientX,y:event.clientY,moved:false};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);pointerStart.moved=true;}}
 function move(event){if(!pointers.has(event.pointerId))return;const old=pointers.get(event.pointerId),next=coords(event);pointers.set(event.pointerId,next);if(pointers.size>1){const [a,b]=[...pointers.values()],distance=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch&&distance)view.altitude=Math.max(.02,Math.min(5,(1+view.altitude)*pinch/distance-1));pinch=distance;}else{view.lng-=(next[0]-old[0])/radius()*180/Math.PI;view.lat=Math.max(-85,Math.min(85,view.lat+(next[1]-old[1])/radius()*180/Math.PI));if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>4)pointerStart.moved=true;}changed();}
 function up(event){if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);if(pointerStart&&!pointerStart.moved&&event.type==='pointerup')choose(event);if(!pointers.size){pointerStart=null;pinch=0;}}
 function wheel(event){event.preventDefault();begin();view.altitude=Math.max(.02,Math.min(5,(1+view.altitude)*Math.exp(event.deltaY*.001)-1));changed();}
 function key(event){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return;event.preventDefault();begin();if(event.key==='ArrowLeft')view.lng-=5;if(event.key==='ArrowRight')view.lng+=5;if(event.key==='ArrowUp')view.lat=Math.min(85,view.lat+5);if(event.key==='ArrowDown')view.lat=Math.max(-85,view.lat-5);if(event.key==='+'||event.key==='=')view.altitude=Math.max(.02,view.altitude*.8);if(event.key==='-')view.altitude=Math.min(5,view.altitude*1.25);changed();}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);
 const material={visible:true,color:{set(color){sea=color;invalidate();}}};
 function destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(frame);for(const [type,fn]of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['wheel',wheel],['keydown',key]])canvas.removeEventListener(type,fn);canvas.remove();}
 const api={__compatibility:true,width(next){if(next===undefined)return width;width=Math.max(1,next);resize();return api;},height(next){if(next===undefined)return height;height=Math.max(1,next);resize();return api;},pointOfView(next){if(!next)return{...view,lng:((view.lng+180)%360+360)%360-180};Object.assign(view,next);changed();draw();return api;},controls:()=>controls,globeMaterial:()=>material,renderer:()=>({domElement:canvas,setPixelRatio(value){dpr=Math.min(value,1.5);resize();},dispose:destroy}),pauseAnimation(){active=false;cancelAnimationFrame(frame);frame=0;last=0;return api;},resumeAnimation(){active=true;draw();invalidate();return api;},_destructor:destroy};
 const properties=['backgroundColor','showAtmosphere','atmosphereColor','atmosphereAltitude','polygonsData','polygonsTransitionDuration','polygonCapCurvatureResolution','polygonCapColor','polygonSideColor','polygonStrokeColor','polygonAltitude','polygonLabel','onPolygonClick','pointsData','pointLat','pointLng','pointRadius','pointResolution','pointLabel','onPointClick','pointAltitude','pointColor','pointsMerge','labelsData','labelLat','labelLng','labelText','labelColor','labelSize','labelAltitude','labelDotRadius','labelResolution','onLabelClick','arcsData','arcStartLat','arcStartLng','arcEndLat','arcEndLng','arcColor','arcAltitudeAutoScale','arcCurveResolution','arcDashLength','arcDashGap','arcDashAnimateTime','arcStroke','ringsData','ringLat','ringLng','ringMaxRadius','ringPropagationSpeed','ringRepeatPeriod','ringColor','onGlobeClick','globeImageUrl'];
 for(const key of properties)api[key]=function(next){if(!arguments.length)return settings[key];settings[key]=next;invalidate();return api;};
 api.globeImageUrl=function(url){
  if(!arguments.length)return textureKey;settings.globeImageUrl=url;textureKey=url||'';texture=null;rasterKey='';invalidate();
  const seq=++textureSequence;if(!url){textureReady=Promise.resolve();return api;}
  textureReady=(async()=>{const image=new Image();image.src=url;await image.decode();if(seq!==textureSequence)return;
   const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const g=c.getContext('2d');g.drawImage(image,0,0);
   texture={w:c.width,h:c.height,data:g.getImageData(0,0,c.width,c.height).data};draw();invalidate();
  })();textureReady.catch(()=>{});return api;
 };

 api.globeSurfaceImage=function(image){
  ++textureSequence;textureKey='surface-'+textureSequence;rasterKey='';material.visible=true;sea='#101a2a';
  texture=image?{w:image.width,h:image.height,data:image.getContext('2d').getImageData(0,0,image.width,image.height).data}:null;
  textureReady=Promise.resolve();draw();invalidate();return api;
 };
 api.whenTextureReady=()=>textureReady;
 api.getScreenCoords=(lat,lng)=>{projection.rotate([-view.lng,-view.lat]).translate([width/2,height/2]).scale(radius());const p=projection([lng,lat]);return{x:p[0],y:p[1]};};
 resize();return api;
}
