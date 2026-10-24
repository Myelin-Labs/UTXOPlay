import {lerp,clamp} from './presentation.mjs';
import {focusPath} from './prism-lens.mjs';
import {loadPrismArt} from './prism-art.mjs';
const gemstones=['amethyst','aquamarine','ruby','emerald','citrine','diamond'];
const realms=['VIOLET SANCTUM','AURORA CONSERVATORY'];
export class PrismRenderer {
 constructor(canvas){
  this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.art=null;this.time=0;this.low=false;this.reduced=false;this.lens=true;
  this.scenery=document.createElement('canvas');this.bricks=document.createElement('canvas');this.cssWidth=canvas.clientWidth;this.layerSize=0;this.layerRealm=-1;this.cells=null;this.reset();
  if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(entries=>{this.cssWidth=entries[0].contentRect.width;});this.observer.observe(canvas);}
 }
 async load(cover){this.art=await loadPrismArt(cover);this.layerSize=0;this.dirty=true;}
 reset(){this.shards=[];this.impacts=[];this.labels=[];this.trail=[];this.flash=0;this.wave=0;this.pathTick=-1;this.lastGame=null;this.dirty=true;}
 setLens(value){this.lens=value;this.dirty=true;}
 sprite(name,x,y,w,h=w,alpha=1){if(!this.art?.[name])return;const c=this.c;c.globalAlpha=alpha;c.drawImage(this.art[name],x-w/2,y-h/2,w,h);c.globalAlpha=1;}
 prepare(size,realm){
  if(this.layerSize===size&&this.layerRealm===realm)return;
  this.layerSize=size;this.layerRealm=realm;this.scenery.width=this.scenery.height=size;this.bricks.width=size;this.bricks.height=Math.ceil(size*.44);this.cells=null;
  const c=this.scenery.getContext('2d',{alpha:false});c.setTransform(size/1000,0,0,size/1000,0,0);c.fillStyle='#08091a';c.fillRect(0,0,1000,1000);
  if(this.art)c.drawImage(this.art[realm?'aurora':'sanctum'],0,0,1000,1000);
  const shade=c.createLinearGradient(0,70,0,1000);shade.addColorStop(0,'#05051d77');shade.addColorStop(.45,'#06051a05');shade.addColorStop(1,'#05051d55');c.fillStyle=shade;c.fillRect(0,0,1000,1000);
  c.strokeStyle='#d7c6ff22';c.lineWidth=1;c.strokeRect(19,25,962,924);
  c.textAlign='center';c.fillStyle='#dacbf0b0';c.font='500 12px Inter,system-ui';c.letterSpacing='4px';c.fillText(realms[realm],500,73);c.letterSpacing='0px';
 }
 paintBricks(game){
  const c=this.bricks.getContext('2d');c.setTransform(this.layerSize/1000,0,0,this.layerSize/1000,0,0);c.clearRect(0,0,1000,440);
  game.cells.forEach((alive,i)=>{if(!alive)return;const x=70+i%8*110,y=135+Math.floor(i/8)*48,name=gemstones[(Math.floor(i/8)+game.level-1)%6];c.drawImage(this.art[name],x-49,y-16,98,32);});
  this.cells=game.cells.slice();this.brickLevel=game.level;
 }
 tick(game){const b=game.bodies[0];if(b){this.trail.push({x:b.x,y:b.y});if(this.trail.length>14)this.trail.shift();}}
 event(e){
  this.dirty=true;const row=Math.max(0,Math.min(5,Math.floor((e.y-135)/48)));
  this.impacts.push({...e,age:0});if(this.impacts.length>16)this.impacts.shift();
  if(e.type==='brick'){
   for(let i=0;i<(this.reduced?0:this.low?5:11);i++){const a=i*2.39996,speed=80+i%5*42;this.shards.push({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-50,spin:(i%2?1:-1)*(2+i%4),rotation:a,age:0,life:.55+i%4*.12,size:9+i%4*4,row});}
   this.labels.push({...e,age:0});
  }
  if(e.type==='damage'){this.flash=.4;this.trail=[];}
  if(e.type==='wave'){this.wave=1.4;this.trail=[];}
  if(this.shards.length>96)this.shards.splice(0,this.shards.length-96);if(this.labels.length>12)this.labels.shift();
 }
 draw(game,before,alpha,delta,ratio,{running,reduced,low}){
  this.low=low;this.reduced=reduced;const width=this.observer?this.cssWidth:this.canvas.clientWidth,size=Math.max(1,Math.round(width*ratio)),realm=Math.floor((game.level-1)/2)%2;
  const settled=!this.shards.length&&!this.impacts.length&&!this.labels.length&&!this.flash&&!this.wave;
  if(!this.dirty&&!running&&!this.wasRunning&&settled&&this.lastGame===game&&this.lastTick===game.tick&&this.layerSize===size&&this.lastLens===this.lens&&this.lastLow===low&&this.lastReduced===reduced)return false;
  this.lastGame=game;this.lastTick=game.tick;this.wasRunning=running;this.lastLens=this.lens;this.lastLow=low;this.lastReduced=reduced;this.dirty=false;
  if(this.canvas.width!==size)this.canvas.width=this.canvas.height=size;
  this.prepare(size,realm);const c=this.c,dt=Math.min(delta,80)/1000;c.setTransform(size/1000,0,0,size/1000,0,0);c.globalAlpha=1;c.drawImage(this.scenery,0,0,1000,1000);
  if(!this.art)return true;
  if(!this.cells||this.brickLevel!==game.level||game.cells.some((v,i)=>v!==this.cells[i]))this.paintBricks(game);
  c.drawImage(this.bricks,0,0,1000,this.bricks.height/size*1000);
  const blend=(a,b)=>lerp(a,b,running?alpha:1),raw=game.bodies[0],old=before.bodies[0]||raw,same=game.level===before.level&&game.lives===before.lives,b=same?{x:blend(old.x,raw.x),y:blend(old.y,raw.y)}:raw,x=blend(before.x,game.x);
  if(running&&!reduced)this.time+=delta;
  if(this.lens&&!game.over){
   if(this.pathTick!==game.tick){this.path=focusPath(game);this.pathTick=game.tick;}
   const path=this.path?.points||[];c.strokeStyle='#d6d2ff48';c.lineWidth=2;c.setLineDash([3,11]);c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);
   const land=this.path?.landing;if(land){c.strokeStyle=land.catchable?'#a9f6dbbb':'#ffc5a7bb';c.lineWidth=2;c.beginPath();c.ellipse(land.x,883,22,6,0,0,Math.PI*2);c.stroke();}
  }
  if(!reduced){c.save();c.globalCompositeOperation='lighter';const tail=this.trail;for(let i=1;i<tail.length;i++){c.strokeStyle=`rgba(162,132,255,${i/tail.length*.23})`;c.lineWidth=2+i*.65;c.lineCap='round';c.beginPath();c.moveTo(tail[i-1].x,tail[i-1].y);c.lineTo(tail[i].x,tail[i].y);c.stroke();}c.restore();}
  this.sprite('paddle',x,889,184,39);
  if(!low){c.save();c.globalCompositeOperation='lighter';this.sprite('impact',b.x,b.y,42,42,.24);c.restore();}
  this.sprite('orb',b.x,b.y,25,25);
  if(game.combo>1){c.textAlign='center';c.fillStyle='#e3d5ff';c.font='500 30px Inter,system-ui';c.fillText(`${Math.min(game.combo,8)}× RESONANCE`,500,587);c.font='11px Inter,system-ui';c.fillStyle='#b8a9d0';c.fillText('CHAIN CRYSTALS BEFORE THE NEXT RETURN',500,610);
   for(let i=0;i<8;i++){c.fillStyle=i<Math.min(game.combo,8)?'#c3a1fa':'#b093df24';c.fillRect(432+i*18,629,12,3);}}
  for(const p of this.shards){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;c.save();c.translate(p.x,p.y);c.rotate(p.rotation+p.age*p.spin);this.sprite('shard',0,0,p.size*.6,p.size*1.3,Math.max(0,1-p.age/p.life));c.restore();}this.shards=this.shards.filter(p=>p.age<p.life);
  for(const e of this.impacts){e.age+=dt;const a=Math.max(0,1-e.age/.42);c.save();c.globalCompositeOperation='lighter';this.sprite('impact',e.x,e.y,(e.type==='bounce'?45:65)+e.age*70,45+e.age*70,a*(reduced ? .28 : .7));c.restore();}this.impacts=this.impacts.filter(e=>e.age<.42);
  c.textAlign='center';c.font='600 18px Inter,system-ui';for(const l of this.labels){l.age+=dt;c.globalAlpha=clamp(1-l.age/.8,0,1);c.fillStyle='#ffe7bd';c.fillText('+'+l.value,l.x,l.y-22-(reduced?0:l.age*36));}c.globalAlpha=1;this.labels=this.labels.filter(l=>l.age<.8);
  this.flash=Math.max(0,this.flash-dt);if(this.flash){c.strokeStyle=`rgba(255,166,190,${this.flash})`;c.lineWidth=7;c.strokeRect(16,25,968,924);}
  if(this.wave){this.wave=Math.max(0,this.wave-dt);c.globalAlpha=Math.min(1,this.wave);c.textAlign='center';c.font='500 36px Inter,system-ui';c.fillStyle='#f7eaff';c.fillText('SPECTRUM RESTORED',500,540);c.globalAlpha=1;}
  const remaining=game.cells.filter(Boolean).length;c.fillStyle='#d0bedc88';c.font='10px Inter,system-ui';c.textAlign='center';c.fillText(`${48-remaining} / 48 CRYSTALS  ·  ${this.lens?'FOCUS LENS ACTIVE':'PURE PLAY'}`,500,971);
  return true;
 }
}
