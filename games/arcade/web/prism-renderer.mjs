import {lerp,clamp} from './presentation.mjs';
import {focusPath} from './prism-lens.mjs';
import {loadPrismArt} from './prism-art.mjs';
import {drawSprite,coverImage} from './premium-art.mjs';
import {brickPoint,paddleHalf,levels} from './prism-engine.mjs';
import {viewport,backingRatio} from './viewport.mjs';
const gems=['amethyst','aquamarine','ruby','emerald','citrine','diamond'];
const dropArt=['paddle','aquamarine','orb','heart','diamond','lens'];
const dropColors=['#dfb7ff','#8fe7ff','#ffe6b3','#ffb0d2','#afffe5','#f4d096'];
export class PrismRenderer {
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.art=null;this.lens=true;this.low=false;this.reduced=false;this.scenery=document.createElement('canvas');this.layerSize=0;this.layerRealm=-1;this.cssWidth=canvas.clientWidth;this.cssHeight=canvas.clientHeight||625;if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(entries=>{this.cssWidth=entries[0].contentRect.width;this.cssHeight=entries[0].contentRect.height;});this.observer.observe(canvas);}this.reset();}
 async load(cover){this.art=await loadPrismArt(cover);this.layerSize=0;this.dirty=true;}
 reset(){this.time=0;this.shards=[];this.impacts=[];this.labels=[];this.trail=[];this.flash=0;this.wave=0;this.pathTick=-1;this.lastGame=null;this.dirty=true;this.cells=null;}
 setLens(value){this.lens=value;this.dirty=true;}
 sprite(name,x,y,w,h=w,alpha=1){drawSprite(this.c,this.art,'prism-breaker',name,x,y,w,h,alpha);}
 tick(g){const b=g.bodies[0];if(b){this.trail.push({x:b.x,y:b.y});if(this.trail.length>14)this.trail.shift();}}
 event(e){this.dirty=true;this.impacts.push({...e,age:0});if(this.impacts.length>16)this.impacts.shift();if(e.type==='brick'){for(let i=0;i<(this.reduced?0:this.low?5:11);i++){const a=i*2.39996,speed=60+i%5*35;this.shards.push({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-40,age:0,life:.55+i%4*.12,size:8+i%4*3});}this.labels.push({...e,age:0});}if(e.type==='damage'){this.flash=.4;this.trail=[];}if(e.type==='wave'){this.wave=1.4;this.trail=[];}if(this.shards.length>96)this.shards.splice(0,this.shards.length-96);if(this.labels.length>12)this.labels.shift();}
 draw(g,before,alpha,delta,ratio,{running,reduced,low}){
  this.low=low;this.reduced=reduced;this.time+=running&&!reduced?Math.min(delta,80):0;const w=(this.observer?this.cssWidth:this.canvas.clientWidth)||1000,h=(this.observer?this.cssHeight:this.canvas.clientHeight)||625,r=backingRatio(w,h,ratio),pw=Math.floor(w*r),ph=Math.floor(h*r),v=viewport(w,h,'prism-breaker'),realm=Math.floor((g.level-1)/4)%6;
  const signature=[pw,ph,realm,g.level,Math.floor(g.wave_tick/900),low,reduced,this.lens].join('/');
  const settled=!this.shards.length&&!this.impacts.length&&!this.labels.length&&!this.flash&&!this.wave;
  if(!this.dirty&&!running&&!this.wasRunning&&settled&&this.lastGame===g&&this.lastTick===g.tick&&this.signature===signature)return false;
  this.lastGame=g;this.lastTick=g.tick;this.wasRunning=running;this.signature=signature;this.dirty=false;
  if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
  const c=this.c,dt=Math.min(delta,80)/1000;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle='#09091b';c.fillRect(0,0,pw,ph);if(!this.art)return true;
  if(this.layerSize!==`${pw}/${ph}/${realm}`){
   this.layerSize=`${pw}/${ph}/${realm}`;this.scenery.width=pw;this.scenery.height=ph;const bg=this.scenery.getContext('2d');
   coverImage(bg,this.art.bg,0,0,pw,ph);
   const shade=bg.createLinearGradient(0,0,0,ph);shade.addColorStop(0,'#0b102b65');shade.addColorStop(.5,'#0b102b15');shade.addColorStop(1,'#0b102b85');bg.fillStyle=shade;bg.fillRect(0,0,pw,ph);
   const tint=['#bdb1ff12','#65d3f424','#ef9ba51c','#8fe6bf25','#ffe1a51c','#bfceff21'][realm];bg.fillStyle=tint;bg.fillRect(0,0,pw,ph);
  }
  c.drawImage(this.scenery,0,0);c.setTransform(v.scale*r,0,0,v.scale*r,v.x*r,v.y*r);
  // Thin machined edge rails support the arena without a second application frame.
  for(const side of [18,982]){const rail=c.createLinearGradient(side,90,side,605);rail.addColorStop(0,'#f5ddaa00');rail.addColorStop(.3,'#f5ddaa90');rail.addColorStop(1,'#f5ddaa30');c.strokeStyle=rail;c.lineWidth=2;c.beginPath();c.moveTo(side,90);c.lineTo(side,603);c.stroke();}
  if(!low)for(let n=0;n<18;n++){const x=(n*211+50)%1000,y=(n*137+this.time*.005)%625;c.fillStyle=n%2?'#ffe9bd55':'#c9eeff44';c.fillRect(x,y,1.2,1.2);}
  c.textAlign='center';c.fillStyle='#fff2dccc';c.font='500 10px system-ui';c.fillText(`${String(g.level).padStart(2,'0')} / 24  ·  ${levels[g.level-1].name.toUpperCase()}`,500,96);
  for(let n=0;n<96;n++){if(!g.cells[n])continue;const p=brickPoint(g,n);c.fillStyle='#070e2c44';c.beginPath();c.roundRect(p.x-34,p.y-8,68,23,5);c.fill();this.sprite(gems[(Math.floor(n/12)+g.level-1)%6],p.x,p.y,72,25);c.fillStyle='#fff5d844';c.fillRect(p.x-23,p.y-9,22,1);if(g.cells[n]>1){c.strokeStyle='#f3e5ca';c.lineWidth=1;c.beginPath();c.roundRect(p.x-31,p.y-10,62,20,4);c.stroke();c.fillStyle='#fff6df';for(let i=0;i<g.cells[n];i++)c.fillRect(p.x-7+i*6,p.y-2,3,3);}if(g.types[n]){c.fillStyle=g.types[n]===1?'#ffb1a0':'#a2ffe4';c.font='bold 12px system-ui';c.fillText(g.types[n]===1?'✦':'+',p.x,p.y+4);}}
  const blend=(a,b)=>lerp(a,b,running?alpha:1),x=blend(before.x,g.x);
  if(this.lens&&!g.over&&!g.draft){
   if(this.pathTick!==g.tick){this.path=focusPath(g);this.pathTick=g.tick;}
   const points=this.path?.points||[],start=points[0],end=points.at(-1);
   if(points.length>1){const fade=c.createLinearGradient(start.x,start.y,end.x,end.y);fade.addColorStop(0,'#ddd5ff70');fade.addColorStop(.35,'#d4cbff30');fade.addColorStop(.72,'#c7bdff0e');fade.addColorStop(1,'#c7bdff00');c.strokeStyle=fade;c.lineWidth=1.2;c.setLineDash([2,7]);c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);}
  }
  if(!reduced){c.strokeStyle='#b19dff55';c.lineWidth=4;c.beginPath();this.trail.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
  for(const p of g.pickups){c.fillStyle='#090e27e8';c.strokeStyle=dropColors[p.tag];c.lineWidth=1;c.beginPath();c.roundRect(p.x-22,p.y-15,44,30,8);c.fill();c.stroke();this.sprite(dropArt[p.tag],p.x,p.y,30,23);}
  if(!low){c.fillStyle='#9fe5ff16';c.beginPath();c.ellipse(x,579,paddleHalf(g)*1.2,8,0,0,Math.PI*2);c.fill();}
  this.sprite('paddle',x,563,paddleHalf(g)*2+4,29);
  if(g.shield){c.strokeStyle='#a7fbe4';c.lineWidth=2;c.beginPath();c.moveTo(20,595);c.lineTo(980,595);c.stroke();c.fillStyle='#b6ffe7';c.font='9px system-ui';c.fillText(`SAFETY NET ×${g.shield}`,500,605);}
  for(let n=0;n<g.bodies.length;n++){const raw=g.bodies[n],old=before.bodies[n]||raw,same=before.level===g.level&&before.lives===g.lives,b=same?{x:blend(old.x,raw.x),y:blend(old.y,raw.y)}:raw;if(!low){c.save();c.globalCompositeOperation='lighter';this.sprite('impact',b.x,b.y,g.pierce?45:30,30,.35);c.restore();}this.sprite('orb',b.x,b.y,18,18);}
  if(g.combo>1){c.fillStyle='#ecddffbb';c.font='500 16px system-ui';c.fillText(`${Math.min(g.combo,8+g.perks[4]*2)}× RESONANCE`,500,440);}
  for(const p of this.shards){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;c.save();c.translate(p.x,p.y);c.rotate(p.age*4);this.sprite('shard',0,0,p.size,p.size*1.4,Math.max(0,1-p.age/p.life));c.restore();}this.shards=this.shards.filter(p=>p.age<p.life);
  for(const e of this.impacts){e.age+=dt;this.sprite('impact',e.x,e.y,40+e.age*45,40+e.age*45,Math.max(0,1-e.age/.42)*.65);}this.impacts=this.impacts.filter(e=>e.age<.42);
  c.font='600 13px system-ui';for(const l of this.labels){l.age+=dt;c.globalAlpha=clamp(1-l.age/.8,0,1);c.fillStyle='#ffe7bd';c.fillText('+'+l.value,l.x,l.y-15-(reduced?0:l.age*30));}c.globalAlpha=1;this.labels=this.labels.filter(l=>l.age<.8);
  this.flash=Math.max(0,this.flash-dt);if(this.flash){c.strokeStyle=`rgba(255,166,190,${this.flash})`;c.lineWidth=5;c.strokeRect(12,78,976,532);}this.wave=Math.max(0,this.wave-dt);
  return true;
 }
}
