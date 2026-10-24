import {tip, districts, tier} from './engine.mjs';
import {loadArt, oreArt, scenes} from './art.mjs';
import {scan} from './scanner.mjs';
const colors = ['#ffc968','#ffd68a','#bc9aff','#8596ad','#73f5df','#ff87d7','#ff6073','#ffc968'];
const names = ['GOLD ORE','HEAVY GOLD','DATA CRYSTAL','INDUSTRIAL SCRAP','POWER CELL','SEALED CACHE','VOLATILE MINE','ARMORED VAULT'];
const accents = ['#6debe0','#ff89da','#85dcff','#ffad65'];

export class MinerRenderer {
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.art=null; this.cache=null;
    this.level=0; this.particles=[]; this.labels=[]; this.rings=[];
    this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
    this.quality='auto'; this.scanner=true; this.clock=0; this.prev=null; this.forecast=null;
  }
  async load() { if(!this.art) this.art=await loadArt(); this.cache=null; }
  background(g) {
    const c=document.createElement('canvas'); c.width=1000; c.height=700;
    const x=c.getContext('2d'); x.drawImage(this.art[scenes[tier(g)]],0,0,1000,700);
    const shade=x.createLinearGradient(0,0,0,700); shade.addColorStop(0,'#03071320'); shade.addColorStop(.3,'#03071300'); shade.addColorStop(1,'#03071330');
    x.fillStyle=shade; x.fillRect(0,0,1000,700);
    x.font='500 11px monospace'; x.fillStyle='#b0c7da'; x.fillText(`↓ ${180+g.level*65} M`,24,31);
    x.textAlign='right'; x.fillText(districts[tier(g)].toUpperCase(),976,31);
    this.cache=c; this.level=g.level;
  }
  sprite(name,x,y,width,height=width) {
    const img=this.art[name],scale=Math.min(width/img.width,height/img.height);
    this.ctx.drawImage(img,x-img.width*scale/2,y-img.height*scale/2,img.width*scale,img.height*scale);
  }
  ore(o,px=o.x,py=o.y,held=false) {
    const x=this.ctx,r=o.radius;
    x.save(); x.translate(px,py); if(held&&!this.reduced) x.rotate(Math.sin(this.clock*5)*.045);
    if(this.quality!=='low') {
      const light=x.createRadialGradient(0,0,r*.1,0,0,r*1.9);
      light.addColorStop(0,colors[o.kind]+'22'); light.addColorStop(1,colors[o.kind]+'00');
      x.fillStyle=light; x.fillRect(-r*2,-r*2,r*4,r*4);
    }
    this.sprite(oreArt[o.kind],0,0,r*2.25,r*2.25);if(o.armor){x.strokeStyle='#ffd075';x.lineWidth=2;for(let i=0;i<o.armor;i++){x.beginPath();x.arc(0,0,r+6+i*5,0,Math.PI*2);x.stroke();}}if(o.kind===6){x.strokeStyle='#ff566d';x.lineWidth=2;x.beginPath();x.arc(0,0,r+5,0,Math.PI*2);x.stroke();x.fillStyle='#ff9aa7';x.font='bold 18px system-ui';x.textAlign='center';x.fillText('!',0,6);}x.restore();
  }
  burst(x,y,color,count=18) {
    if(this.reduced)return;
    const cap=this.quality==='low'?28:100;
    for(let i=0;i<count&&this.particles.length<cap;i++) {
      const a=i*2.399; this.particles.push({x,y,vx:Math.cos(a)*(30+i*5),vy:Math.sin(a)*(30+i*5)-40,age:0,color});
    }
  }
  ring(x,y,color,large=false) {if(!this.reduced&&this.rings.length<5)this.rings.push({x,y,color,age:0,large});}
  targeting(g,hx,hy) {
    const x=this.ctx;
    if(!this.scanner||g.phase!==0){this.forecast=null;return;}
    if(!this.forecast||this.forecast.angle!==g.angle||this.forecast.tick!==g.tick||this.forecast.score!==g.score||this.forecast.level!==g.level||this.forecast.lens!==g.lens) {
      this.forecast={...scan(g),angle:g.angle,tick:g.tick,score:g.score,level:g.level,lens:g.lens};
    }
    const {ore,point,value}=this.forecast;
    x.setLineDash([3,10]); x.strokeStyle=ore?colors[ore.kind]+'99':'#88c5ce35'; x.lineWidth=1;
    x.beginPath(); x.moveTo(hx,hy); x.lineTo(...point); x.stroke(); x.setLineDash([]);
    if(!ore)return;
    const r=ore.radius+13;
    x.strokeStyle=colors[ore.kind]; x.lineWidth=1.5;
    // Four quiet brackets leave the generated asset fully visible.
    for(let i=0;i<4;i++){x.save();x.translate(ore.x,ore.y);x.rotate(i*Math.PI/2);x.beginPath();x.moveTo(-r,-r+9);x.lineTo(-r,-r);x.lineTo(-r+9,-r);x.stroke();x.restore();}
    const scale=Math.min(2.6,Math.max(1,1000/(this.canvas.clientWidth||1000))),half=98*scale;
    const bx=Math.min(994-half,Math.max(half+6,ore.x)),by=Math.min(700-24*scale,ore.y+r+14*scale);
    x.fillStyle='#060e1be8';x.fillRect(bx-half,by-12*scale,half*2,34*scale);
    x.textAlign='center';x.font=`600 ${10*scale}px system-ui`;x.fillStyle=colors[ore.kind];x.fillText(names[ore.kind],bx,by);
    x.font=`${10*scale}px monospace`;x.fillStyle='#b6c8d8';
    x.fillText(ore.kind===6?'DANGER · DELIVERING COSTS TIME':ore.armor?`${ore.armor} ARMOR · CRACK BEFORE COLLECTING`:`${ore.kind===5?'SEALED':value} VALUE  ·  ${ore.weight>=5?'HEAVY':ore.weight<=2?'LIGHT':'MEDIUM'}${ore.kind===4?'  +3s':''}`,bx,by+14*scale);x.textAlign='left';
  }
  draw(g,dt=16,alpha=1,previous=g) {
    const x=this.ctx,w=this.canvas.width,h=this.canvas.height;
    x.setTransform(w/1000,0,0,h/700,0,0);x.clearRect(0,0,1000,700);
    if(!this.art){x.fillStyle='#080e19';x.fillRect(0,0,1000,700);return;}
    this.clock+=dt/1000;
    if(!this.cache||g.level!==this.level) {
      this.background(g);this.particles=[];this.labels=[];this.rings=[];this.prev=null;this.forecast=null;
    }
    const cover=Math.max(w/1000,h/700);x.setTransform(1,0,0,1,0,0);x.drawImage(this.cache,(w-1000*cover)/2,(h-700*cover)/2,1000*cover,700*cover);const cssW=this.canvas.clientWidth||1000,cssH=this.canvas.clientHeight||700,pixel=w/cssW,ui=Math.max(1,Math.min(2,cssH/1080)),top=cssW<=600?198:cssH<=540?100:134*ui,bottom=cssW<=600?130:76*ui,scale=Math.min(cssW/1000,Math.max(100,cssH-top-bottom)/700);x.setTransform(scale*pixel,0,0,scale*pixel,(cssW-1000*scale)/2*pixel,(top+(cssH-top-bottom-700*scale)/2)*pixel);
    const color=accents[tier(g)], [tx,ty]=tip(g),[oldX,oldY]=tip(previous);
    const smooth=previous.level===g.level&&previous.phase===g.phase&&!this.reduced;
    const hx=smooth?oldX+(tx-oldX)*alpha:tx,hy=smooth?oldY+(ty-oldY)*alpha:ty;
    if(this.prev) {
      if(g.cargo>=0&&this.prev.cargo!==g.cargo){this.burst(hx,hy,colors[g.ores[g.cargo].kind]);this.ring(hx,hy,colors[g.ores[g.cargo].kind]);}
      if(g.score>this.prev.score){const delta=g.score-this.prev.score;this.labels.push({x:500,y:151,text:`+${delta}  /  +${Math.trunc(delta/10)} CR`,age:0});this.burst(500,113,'#ffd075',24);}
      if(g.stock[0]<this.prev.stock[0]){this.burst(oldX,oldY,'#ff80da',36);this.ring(oldX,oldY,'#ff80da',true);}
      if(g.stock[2]<this.prev.stock[2]){this.labels.push({x:500,y:190,text:'+10s · TIME CELL',age:0});this.ring(500,350,'#7eefff',true);}
    }
    this.prev={score:g.score,cargo:g.cargo,stock:[...g.stock]};if(g.stasis){x.fillStyle='#71efff';x.font='600 12px monospace';x.textAlign='center';x.fillText(`STASIS / ${(g.stasis/30).toFixed(1)}s`,500,690);x.textAlign='left';}if(g.combo){x.fillStyle='#ffd075';x.font='600 12px monospace';x.fillText(`CHAIN +${g.combo*5}%`,25,690);}
    if(!this.reduced&&this.quality!=='low') {
      // Tiny parallax motes and moving search lights, bounded independently of simulation.
      x.save();x.globalCompositeOperation='screen';
      for(let i=0;i<2;i++){const lx=120+i*760,a=Math.sin(this.clock*.22+i)*80;
        const beam=x.createLinearGradient(lx,130,lx+a,620);beam.addColorStop(0,color+'15');beam.addColorStop(1,color+'00');
        x.fillStyle=beam;x.beginPath();x.moveTo(lx-2,130);x.lineTo(lx+a+80,640);x.lineTo(lx+a-80,640);x.closePath();x.fill();}
      for(let i=0;i<18;i++){x.globalAlpha=.2+Math.sin(this.clock+i)*.12;x.fillStyle=i%3===0?'#ffcf8b':color;x.beginPath();x.arc((i*179+this.clock*(2+i%3))%1000,190+(i*59+this.clock*3)%490,i%3===0?1.5:.8,0,Math.PI*2);x.fill();}x.restore();
    }
    for(const o of g.ores)if(!o.taken)this.ore(o);
    this.targeting(g,hx,hy);
    x.save();x.strokeStyle='#07101d';x.lineWidth=6;x.beginPath();x.moveTo(500,100);x.lineTo(hx,hy);x.stroke();
    x.strokeStyle=g.boost?'#ff9ee2':'#90e7ee';x.lineWidth=2;x.stroke();
    if(g.boost&&this.quality!=='low'){x.strokeStyle='#ff87d955';x.lineWidth=7;x.stroke();}
    x.restore();
    if(g.cargo>=0)this.ore(g.ores[g.cargo],hx,hy+8,true);
    x.save();x.translate(hx,hy);x.rotate((g.angle*2-70)*-Math.PI/180);this.sprite('claw',0,-4,g.cargo>=0?46:54,62);x.restore();
    // Robot cable outlet stays anchored to the authoritative pivot even while the body tilts.
    x.save();x.translate(500,58);if(!this.reduced)x.rotate((hx-500)*.000035);this.sprite('drone',0,0,145,108);x.restore();
    if(g.boost){x.save();x.globalAlpha=this.reduced?.6:.5+Math.sin(this.clock*15)*.2;x.fillStyle='#ff83da';for(const side of [-1,1]){x.beginPath();x.ellipse(500+side*57,93,5,14,0,0,Math.PI*2);x.fill();}x.restore();}
    const sec=dt/1000;
    for(const p of this.particles){p.age+=sec;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=145*sec;x.globalAlpha=Math.max(0,1-p.age/.75);x.strokeStyle=p.color;x.lineWidth=2;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(p.x-p.vx*.025,p.y-p.vy*.025);x.stroke();}
    this.particles=this.particles.filter(p=>p.age<.75);x.globalAlpha=1;
    for(const ring of this.rings){ring.age+=sec;x.globalAlpha=Math.max(0,1-ring.age/.65);x.strokeStyle=ring.color;x.lineWidth=ring.large?3:1.5;x.beginPath();x.arc(ring.x,ring.y,12+ring.age*(ring.large?260:80),0,Math.PI*2);x.stroke();}
    this.rings=this.rings.filter(p=>p.age<.65);x.globalAlpha=1;
    for(const label of this.labels){label.age+=sec;x.globalAlpha=Math.max(0,1-label.age/1.3);x.fillStyle='#ffe3aa';x.font='600 20px monospace';x.textAlign='center';x.fillText(label.text,label.x,label.y-(this.reduced?0:label.age*28));}
    this.labels=this.labels.filter(l=>l.age<1.3);x.globalAlpha=1;x.textAlign='left';
    if(g.boost){x.fillStyle='#ffb3e4';x.font='600 11px monospace';x.textAlign='center';x.fillText(`OVERDRIVE / ${(g.boost/30).toFixed(1)}s`,500,20);x.textAlign='left';}
  }
}
