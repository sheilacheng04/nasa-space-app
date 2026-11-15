// One decorative canvas. No data, images, network, or timeline dependencies.
export const BACKGROUND_KEY = 'pacific-background-paused';
export function createBackground(canvas, env = window) {
  const doc = env.document, ctx = canvas.getContext('2d');
  if (!ctx) return { setScene() {}, pause() {}, destroy() {} };
  const motion = env.matchMedia('(prefers-reduced-motion: reduce)');
  let host, scene = 'story', raf = 0, timer = 0, last = 0, elapsed = 0;
  let visible = false, paused = false, dead = false, width = 1, height = 1, dpr = 1;
  let palette = {}, camera = {lat:0, lng:0, altitude:1.5, radius:0, x:0, y:0};
  let detail = env.innerWidth < 700 || env.navigator.hardwareConcurrency <= 4 ? 1 : 3;
  let cost = 0, frames = 0;
  try { paused = env.localStorage.getItem(BACKGROUND_KEY) === '1'; } catch {}
  const animated = () => !dead && !paused && !motion.matches && visible && !doc.hidden && !['media','method'].includes(scene);
  const stop = () => { env.cancelAnimationFrame(raf); env.clearTimeout(timer); raf = timer = last = 0; };
  function colors() {
    const style = env.getComputedStyle(doc.documentElement);
    const value = name => style.getPropertyValue(name).trim();
    palette = { blue:value('--blue'), orange:value('--orange'), star:value('--space-star') };
  }
  function paint() {
    if (dead || !host || !visible || doc.hidden) return;
    const start = env.performance.now();
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
    if (scene === 'globe') space(); else contours();
    cost = cost * .85 + (env.performance.now() - start) * .15;
    if (cost > 4 && detail > 1) { detail--; cost = 0; }
    canvas.dataset.frames = String(++frames);
    canvas.dataset.drawMs = cost.toFixed(2); canvas.dataset.layers = String(detail);
  }
  function glow(x,y,r,color,alpha) {
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color); g.addColorStop(1,'transparent');
    ctx.globalAlpha=alpha; ctx.fillStyle=g; ctx.fillRect(0,0,width,height); ctx.globalAlpha=1;
  }
  function contours() {
    const t=elapsed*.00005, quiet=scene==='media'||scene==='method';
    glow(width*.78,height*.85,width*.6,palette.blue,quiet?.025:.045);
    if(scene==='story')glow(width*.86,height*.65,width*.4,palette.orange,.09);
    ctx.strokeStyle=palette.blue;ctx.lineWidth=.8;ctx.globalAlpha=quiet?.035:.075;
    const count=detail*4+5, gap=Math.max(11,height*.035);
    for(let j=0;j<count;j++){
      ctx.beginPath();
      for(let x=-20;x<=width+20;x+=16){
        const y=scene==='sites'
          ? height*.42+j*gap+Math.sin(x/width*4+j*.13+t)*height*.07
          : height*.44+j*gap+Math.sin(x/width*6+t+j*.18)*height*.075;
        x===-20?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }ctx.stroke();
    }ctx.globalAlpha=1;
  }
  // Neutral stars and the atmospheric ring are presentation only.
  function space() {
    const calm=Math.max(.15,Math.min(1,camera.altitude/.8));
    glow(width*.4,height*.42,width*.45,palette.blue,.08*calm);
    for(let layer=0;layer<detail;layer++){
      const count=(detail===1?16:36)-layer*5;
      ctx.fillStyle=palette.star;
      for(let i=0;i<count;i++){
        const seed=i*127.1+layer*311.7, rand=n=>{const v=Math.sin(seed+n)*43758.5453;return v-Math.floor(v);};
        const speed=layer+1, drift=elapsed*.0007*speed;
        const x=((rand(1)*width+drift-camera.lng*.035*speed)%width+width)%width;
        const y=((rand(2)*height+drift*.2+camera.lat*.045*speed)%height+height)%height;
        const twinkle=.85+.15*Math.sin(elapsed*.00035+seed);
        ctx.globalAlpha=(.18+layer*.17)*twinkle*calm;
        ctx.beginPath();ctx.arc(x,y,.45+layer*.3,0,Math.PI*2);ctx.fill();
      }
    }
    // Camera supplies the actual projected sphere radius for both renderers.
    if(camera.radius>0){
      ctx.globalAlpha=.24*calm;ctx.strokeStyle=palette.blue;ctx.lineWidth=1.3;
      ctx.shadowColor=palette.blue;ctx.shadowBlur=9;
      ctx.beginPath();ctx.arc(camera.x,camera.y,camera.radius+1.2,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    }ctx.globalAlpha=1;
  }
  function tick(now) {
    raf=0;if(!animated())return;
    if(last)elapsed+=Math.min(now-last,100);last=now;paint();
    // Sleep between draws instead of burning a display-rate RAF loop.
    timer=env.setTimeout(()=>{timer=0;if(animated())raf=env.requestAnimationFrame(tick);},1000/30);
  }
  function sync() {
    stop(); canvas.dataset.state=motion.matches?'reduced':paused?'paused':!visible||doc.hidden?'hidden':animated()?'running':'static';
    if(!visible||doc.hidden){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    paint();if(animated())timer=env.setTimeout(()=>{timer=0;raf=env.requestAnimationFrame(tick);},1000/30);
  }
  function resize() {
    if(!host)return;
    const fullBleed=scene==='sites'||scene==='media'||scene==='method';
    width=Math.max(1,fullBleed?(doc.documentElement.clientWidth||env.innerWidth):host.clientWidth);
    height=Math.max(1,host.clientHeight);
    canvas.style.width=fullBleed?`${width}px`:'100%';
    canvas.style.left=fullBleed?`${-(host.getBoundingClientRect?.().left||0)}px`:'0';
    dpr=Math.min(env.devicePixelRatio||1,env.innerWidth<700?1.25:2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.dataset.dpr=String(dpr);sync();
  }
  const io=new env.IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);sync();},{threshold:.01});
  const ro=new env.ResizeObserver(resize);
  const theme=new env.MutationObserver(()=>{colors();sync();});
  theme.observe(doc.documentElement,{attributes:true,attributeFilter:['data-theme']});
  const awaiting=new env.MutationObserver(attach);
  function attach() {
    const target=doc.querySelector(scene==='globe'?'#globe-stage':scene==='story'?'#page-story .hero':scene==='sites'?'#page-sites .page-intro':scene==='media'?'#page-news .page-intro':'#page-method .page-intro');
    if(!target||target===host)return;
    awaiting.disconnect();stop();io.disconnect();ro.disconnect();host=target;visible=false;
    host.appendChild(canvas);canvas.dataset.scene=scene;colors();ro.observe(host);io.observe(host);resize();
  }
  const cameraChanged=event=>{if(event.detail){camera={...camera,...event.detail};if(scene==='globe'&&!doc.hidden&&visible&&!paused&&!motion.matches&&!animated())paint();}};
  doc.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
  env.addEventListener('resize',resize);
  env.addEventListener('globe:camera',cameraChanged);
  return {
    setScene(next){scene=next;const previousHost=host;attach();if(host===previousHost)resize();if(!host||!host.isConnected||!host.contains(canvas)||canvas.dataset.scene!==scene)awaiting.observe(doc.getElementById('root'),{childList:true,subtree:true});sync();},
    pause(next){paused=next;try{env.localStorage.setItem(BACKGROUND_KEY,next?'1':'0');}catch{}sync();},
    destroy(){dead=true;stop();io.disconnect();ro.disconnect();theme.disconnect();awaiting.disconnect();doc.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);env.removeEventListener('resize',resize);env.removeEventListener('globe:camera',cameraChanged);canvas.remove();}
  };
}
