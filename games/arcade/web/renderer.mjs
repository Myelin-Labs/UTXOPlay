import {viewport,backingRatio} from './viewport.mjs';
import {clamp,lerp,roadPoint,previousBody,EffectPool} from './presentation.mjs';
import {loadArtwork,drawSprite,coverImage} from './premium-art.mjs';
import {roadSegment} from './road-art.mjs';

// Every layer below is presentation only. Native world positions and hitboxes are unchanged.
export class ArcadeRenderer {
 constructor(canvas,kind,accent){
  this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.kind=kind;this.accent=accent;this.art=null;
  this.effects=new EffectPool();this.rings=[];this.labels=[];this.trail=[];this.hit=0;this.time=0;this.reduced=false;this.low=false;
  this.scenery=document.createElement('canvas');this.layerSize=0;this.lastGame=null;
  this.cssWidth=canvas.clientWidth;this.cssHeight=canvas.clientHeight||this.cssWidth;
  if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(entries=>{this.cssWidth=entries[0].contentRect.width;this.cssHeight=entries[0].contentRect.height;});this.observer.observe(canvas);}
 }
 async load(cover){this.art=await loadArtwork(this.kind,cover);this.layerSize=0;this.lastGame=null;}
 sprite(name,x,y,w,h=w,alpha=1,angle=0){drawSprite(this.c,this.art,this.kind,name,x,y,w,h,alpha,angle);}
 circle(x,y,r,color){if(r<=0)return;const c=this.c;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 line(x,y,xx,yy,color,width=1){const c=this.c;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 gradient(x,y,xx,yy,colors){const g=this.c.createLinearGradient(x,y,xx,yy);colors.forEach((v,i)=>g.addColorStop(i/(colors.length-1),v));return g;}
 glow(x,y,r,color){if(this.low)return;const c=this.c,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 prepareLayers(pw,ph,v,pixel,size){
  const key=[pw,ph,v.x,v.y,v.scale,this.low,this.reduced,Boolean(this.art)].join('/');if(this.layerKey===key)return;
  this.layerKey=key;this.layerSize=size;this.layerLow=this.low;this.layerReduced=this.reduced;
  this.scenery.width=pw;this.scenery.height=ph;const original=this.c,c=this.scenery.getContext('2d',{alpha:false});this.c=c;
  c.fillStyle='#08171c';c.fillRect(0,0,pw,ph);
  if(this.art){
   coverImage(c,this.art.bg,0,0,pw,ph);
   if(this.kind==='neon-coil'){
    c.fillStyle='#061b1c20';c.fillRect(0,0,pw,ph);c.setTransform(v.scale*pixel,0,0,v.scale*pixel,v.x*pixel,v.y*pixel);
    // Etched marks belong to the material, while the playable 20×20 grid stays square.
    for(let n=0;n<=20;n++){this.line(n*50,0,n*50,1000,'#b8e5cb13');this.line(0,n*50,1000,n*50,'#b8e5cb13');}
    c.strokeStyle='#ddb88270';c.lineWidth=3;c.strokeRect(0,0,1000,1000);
    for(const x of [0,1000])for(const y of [0,1000]){this.circle(x,y,8,'#d3ad71');this.circle(x,y,3,'#ecffcf');}
   }else if(this.kind==='drift-run'){
    c.setTransform(v.scale*pixel,0,0,v.scale*pixel,v.x*pixel,v.y*pixel);
    const worldWidth=pw/(v.scale*pixel),top=-v.y/v.scale,bottom=(ph/pixel-v.y)/v.scale;
    const iw=Math.max(2000,worldWidth,(180-top)/.38*1.5,(bottom-180)/.62*1.5),ih=iw*2/3;
    c.drawImage(this.art.bg,500-iw/2,180-ih*.38,iw,ih);
    // Fine wet asphalt and copper shoulders; lane dashes are a separate moving layer.
    roadSegment(c,180,0,1040,535,{road:'#0e27331c',edge:'#99d8e71a'});
    this.line(500,180,-35,1040,'#d9d7a660',1.5);this.line(500,180,1035,1040,'#d9d7a660',1.5);

   }else{
    const shade=c.createLinearGradient(0,0,0,ph);shade.addColorStop(0,'#0311203a');shade.addColorStop(.55,'#020d1b00');shade.addColorStop(1,'#020a1d68');c.fillStyle=shade;c.fillRect(0,0,pw,ph);
   }
  }
  c.setTransform(1,0,0,1,0,0);this.c=original;
 }
 reset(){this.lastGame=null;this.effects.clear();this.rings=[];this.labels=[];this.trail=[];this.hit=0;}
 event(e){this.effects.emit(e,this.reduced);if(e.type==='damage')this.hit=.45;if(e.type!=='shot')this.rings.push({...e,age:0});if(e.value&&e.type!=='wave')this.labels.push({...e,age:0});if(this.rings.length>12)this.rings.shift();if(this.labels.length>12)this.labels.shift();}
 tick(){}
 draw(g,before,alpha,delta,ratio,{running,reduced,low}){
  this.reduced=reduced;this.low=low;this.time+=running&&!reduced?Math.min(delta,80):0;
  const width=this.observer?this.cssWidth:this.canvas.clientWidth,height=this.observer?this.cssHeight:(this.canvas.clientHeight||width),v=viewport(width,height,this.kind,globalThis.matchMedia?.('(pointer:coarse)').matches),pixel=backingRatio(width,height,ratio);
  const c=this.c,size=Math.max(1,Math.round(1000*v.scale*pixel)),pw=Math.floor(width*pixel),ph=Math.floor(height*pixel);
  const settled=!this.effects.items.length&&!this.rings.length&&!this.labels.length&&this.hit===0;
  if(!running&&!this.lastRunning&&settled&&this.lastGame===g&&this.lastTick===g.tick&&this.canvas.width===pw&&this.canvas.height===ph&&this.layerSize===size&&this.layerLow===low&&this.layerReduced===reduced)return false;
  this.lastGame=g;this.lastTick=g.tick;this.lastRunning=running;
  if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
  this.prepareLayers(pw,ph,v,pixel,size);c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.shadowBlur=0;c.drawImage(this.scenery,0,0);
  c.setTransform(v.scale*pixel,0,0,v.scale*pixel,v.x*pixel,v.y*pixel);
  this.effects.advance(Math.min(delta,80)/1000);this.hit=Math.max(0,this.hit-delta/1000);
  const blend=(a,b)=>lerp(a,b,running?alpha:1);
  const body=b=>{const p=before.level===g.level&&before.lives===g.lives?previousBody(b,before):null;return p?{...b,x:blend(p.x,b.x),y:blend(p.y,b.y)}:b;};
  if(this.kind==='neon-coil')this.coil(g,before,blend);
  if(this.kind==='starfall')this.starfall(g,before,blend,body);
  if(this.kind==='drift-run')this.runner(g,before,blend,body);
  for(const p of this.effects.items){c.globalAlpha=Math.max(0,1-p.age/p.life);this.circle(p.x,p.y,p.size,p.type==='damage'?'#ff9baf':p.type==='collect'?'#ffe5a6':this.accent);}c.globalAlpha=1;
  for(const r of this.rings){r.age+=delta/1000;if(reduced)continue;const a=clamp(1-r.age/.5,0,1);if(this.kind==='starfall'&&(r.type==='brick'||r.type==='damage'||r.type==='enemy'))this.sprite('explosion',r.x,r.y,65+r.age*70,65+r.age*70,a);else{c.globalAlpha=a*.6;c.strokeStyle=r.type==='damage'?'#ff899f':this.accent;c.lineWidth=2;c.beginPath();c.arc(r.x,r.y,10+r.age*110,0,Math.PI*2);c.stroke();}}
  this.rings=this.rings.filter(r=>r.age<.5);c.globalAlpha=1;c.textAlign='center';c.font='600 19px Inter, system-ui';
  for(const l of this.labels){l.age+=delta/1000;c.globalAlpha=clamp(1-l.age/.85,0,1);c.fillStyle=l.type==='collect'?'#ffe7a8':'#f0eaff';c.fillText('+'+l.value,l.x,l.y-24-(reduced?0:l.age*42));}this.labels=this.labels.filter(l=>l.age<.85);c.globalAlpha=1;
  if(this.hit>0){c.strokeStyle=`rgba(255,123,153,${this.hit})`;c.lineWidth=12;c.strokeRect(6,6,988,988);}return true;
 }
 coil(g,before,blend){
  const c=this.c,t=this.time,fx=g.x*50+25,fy=g.y*50+25;
  this.glow(fx,fy,45,'#efbf543c');this.sprite('seed',fx,fy,43,43,1,this.reduced?0:Math.sin(t/900)*.08);
  for(let i=1;i<g.trail.length;i++){const p=g.trail[i],q=g.trail[i-1],old=before.trail[i]||p,prior=before.trail[i-1]||q;this.line(blend(old[0],p[0])*50+25,blend(old[1],p[1])*50+25,blend(prior[0],q[0])*50+25,blend(prior[1],q[1])*50+25,'#b69a61',9);}
  for(let i=g.trail.length-1;i>=0;i--){const p=g.trail[i],old=before.trail[i]||p,x=blend(old[0],p[0])*50+25,y=blend(old[1],p[1])*50+25;
   const connect=g.trail.length>=9&&i>=7&&i<g.trail.length-1;
   c.save();c.fillStyle='#00171580';c.beginPath();c.ellipse(x+2,y+6,23,18,0,0,Math.PI*2);c.fill();c.restore();
   if(i===0){this.glow(x,y,38,'#85f6c02a');this.sprite('head',x,y,53,49,1,(g.dir-1)*Math.PI/2);}
   else if(i===g.trail.length-1){const prev=g.trail[i-1],angle=Math.atan2(p[1]-prev[1],p[0]-prev[0]);this.sprite('tail',x,y,48,40,1,angle);}
   else{const prev=g.trail[i-1],angle=Math.atan2(p[1]-prev[1],p[0]-prev[0]);this.sprite('body',x,y,46,46,1,angle);}
   if(connect)this.sprite('node',x,y,51,51,.85);
  }
  if(g.ability_ticks){c.strokeStyle='#ffe4a4';c.lineWidth=2;c.globalAlpha=.4;for(let i=1;i<g.trail.length;i++)this.line(g.trail[i-1][0]*50+25,g.trail[i-1][1]*50+25,g.trail[i][0]*50+25,g.trail[i][1]*50+25,'#ffe4a4',2);c.globalAlpha=1;}
 }
 starfall(g,before,blend,body){
  const c=this.c,t=this.time;
  for(let i=0;i<(this.low?20:55);i++){const x=(i*173+17)%1000,y=(i*237+t*.012*(1+i%3))%1000;this.circle(x,y,i%3===0?1.3:.7,'#d0eeff85');}
  for(const raw of g.bodies){const b=body(raw);if(b.tag===1){const index=Math.abs(Math.round(raw.y))%3,name=['scarab','manta','gunship'][index];this.glow(b.x,b.y-24,25,index===0?'#ff694825':'#b49cff25');this.sprite(name,b.x,b.y,73,65,1,index===2?0:Math.PI);
   }else{const reflected=b.tag===4,friendly=b.tag===2||reflected,color=reflected?'#ffd78d':friendly?'#9eeaff':'#ff8a8e',tail=friendly?28:-24;this.line(b.x,b.y,b.x,b.y+tail,color+'55',reflected?7:4);this.line(b.x,b.y-7,b.x,b.y+7,color,reflected?4:3);this.line(b.x,b.y-5,b.x,b.y+5,'#fff7ec',1);}}
  const x=blend(before.x,g.x);
  if(g.ability_ticks&&!g.ability_lock){const heat=g.ability_ticks/45;this.glow(x,875,100,heat>.75?'#ff9d7040':'#5decdf30');this.sprite('reactor',x,880,165,132,.65);c.strokeStyle=heat>.75?'#ffac82':'#adffed';c.lineWidth=3;c.beginPath();c.ellipse(x,880,75,55,0,Math.PI,Math.PI*2);c.stroke();}
  for(let n=0;n<g.energy;n++){const angle=Math.PI+(n+.5)/6*Math.PI;this.glow(x+Math.cos(angle)*62,880+Math.sin(angle)*42,12,'#ffdc8d80');this.circle(x+Math.cos(angle)*62,880+Math.sin(angle)*42,3,'#fff4cb');}
  const flame=23+(this.reduced?0:Math.sin(t/55)*7);
  for(const side of [-1,1]){const xx=x+side*17;this.line(xx,923,xx,923+flame,'#67d8ff40',9);this.line(xx,923,xx,923+flame*.7,'#c3f4ff',3);}
  this.glow(x,920,54,'#6ad7ff30');this.sprite('player',x,900,83,82);
  if(g.vy>0){c.strokeStyle='#a6eeff80';c.lineWidth=2;c.beginPath();c.arc(x,900,46,0,Math.PI*2);c.stroke();}
 }
 runner(g,before,blend,body){
  const c=this.c,t=this.time;
  for(let n=0;n<18;n++){const y=(n*65+t*.3)%1170-100,p=roadPoint(1,y),q=roadPoint(1,y+27);if(p.scale<0)continue;const w1=435*p.scale,w2=435*q.scale;for(const side of [-1,1]){const x1=500+side*w1/3,x2=500+side*w2/3;this.line(x1,p.y,x2,q.y,'#f6e8c466',Math.max(.4,p.scale*3));}}
  for(let n=0;n<13;n++){const p=roadPoint(1,(n*96+t*.3)%1200-100);if(p.scale<0)continue;for(const side of [-1,1])this.sprite('bollard',500+side*490*p.scale,p.y-22*p.scale,15*p.scale,55*p.scale);}
  for(const raw of [...g.bodies].sort((a,b)=>a.y-b.y)){const b=body(raw),p=roadPoint(b.x,b.y),s=p.scale;if(s<=0)continue;
   if(b.tag===1){c.fillStyle='#02060b65';c.beginPath();c.ellipse(p.x,p.y+20*s,76*s,13*s,0,0,Math.PI*2);c.fill();this.sprite('barrier',p.x,p.y-3*s,160*s,70*s);}
   else{this.glow(p.x,p.y,38*s,'#e4b66030');this.sprite('ring',p.x,p.y,55*s,60*s);}
  }
  if(g.echo_ticks){const p=roadPoint(g.echo_lane,830);this.glow(p.x,p.y,75,'#f5c87b30');this.sprite('car',p.x,p.y,115,82,.18+g.echo_ticks/20*.35);}
  const p=roadPoint(blend(before.x,g.x),830),steer=g.x-before.x;
  if(!this.reduced)for(const side of [-1,1]){const color=g.ability_ticks?'#ffe6a888':'#ff8c6d50';this.line(p.x+side*35,p.y+20,p.x+side*42,p.y+(g.ability_ticks?140:80),color,g.ability_ticks?7:3);}
  c.fillStyle='#010711aa';c.beginPath();c.ellipse(p.x,p.y+33,55,17,0,0,Math.PI*2);c.fill();
  if(g.ability_ticks)this.glow(p.x,p.y,110,'#f3c27050');
  this.sprite(steer<-.03?'left':steer>.03?'right':'car',p.x,p.y,118,85);
 }
}
