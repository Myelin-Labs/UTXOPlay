import {tip,districts} from './engine.mjs';
const palettes=[['#11222e','#39e7cf','#ffc56e'],['#201b35','#ff71ce','#f7b96b'],['#151e35','#819eff','#88efd2'],['#281b26','#ff7862','#fbd078']];
const colors=['#f6b94d','#ffc96b','#ae8eff','#606c85','#61eedb','#fb86cf'];
export class MinerRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cache=null;this.level=0;this.particles=[];this.labels=[];this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;this.quality='auto';this.lastScore=0;this.lastCargo=-1;this.shake=0;this.clock=0;this.prev=null;}
 background(g){const c=document.createElement('canvas');c.width=1000;c.height=700;const x=c.getContext('2d'),p=palettes[Math.floor((g.level-1)/5)];const grad=x.createLinearGradient(0,0,0,700);grad.addColorStop(0,p[0]);grad.addColorStop(1,'#070b13');x.fillStyle=grad;x.fillRect(0,0,1000,700);
  // Underground metropolis: structural silhouettes, cables, rock strata, ore seams.
  for(let i=0;i<18;i++){const xx=(i*163+g.level*29)%1000,h=35+(i*47)%110;x.fillStyle=i%2?'#182335':'#101b2a';x.fillRect(xx,170-h,45+(i%3)*22,h);x.fillStyle=p[1]+'55';for(let y=165-h;y<160;y+=14)x.fillRect(xx+7,y,4,4);}
  for(let row=0;row<7;row++){x.beginPath();x.moveTo(0,210+row*75);for(let i=0;i<=12;i++)x.lineTo(i*85,210+row*75+Math.sin(i*3+row+g.level)*20);x.strokeStyle='#1b2939';x.lineWidth=row%2?2:1;x.stroke();}
  x.strokeStyle=p[1]+'22';x.lineWidth=2;for(let i=0;i<8;i++){let xx=(i*173)%1000;x.beginPath();x.moveTo(xx,200);x.lineTo(xx+40,320);x.lineTo(xx+10,440);x.lineTo(xx+90,660);x.stroke();}
  for(let i=0;i<160;i++){x.fillStyle=i%4===0?p[1]+'35':'#263544';x.fillRect((i*137+g.level*23)%1000,210+(i*71)%470,1+(i%3),1+(i%2));}
  const fog=x.createRadialGradient(500,200,10,500,200,500);fog.addColorStop(0,p[1]+'15');fog.addColorStop(1,'#00000000');x.fillStyle=fog;x.fillRect(0,150,1000,550);
  x.fillStyle='#162235';x.fillRect(0,172,1000,18);x.fillStyle=p[1];x.fillRect(0,172,1000,2);x.fillStyle='#455069';for(let i=0;i<25;i++)x.fillRect(i*43,181,22,3);
  // Gantry suspends a small mining drone directly over the pivot.
  x.fillStyle='#2b3950';x.fillRect(0,55,1000,10);x.strokeStyle='#43536c';x.lineWidth=2;for(let i=0;i<25;i++){x.beginPath();x.moveTo(i*45,55);x.lineTo(i*45+30,65);x.stroke();}
  x.font='600 10px monospace';x.fillStyle='#6d8096';x.fillText(`DEPTH ${180+g.level*65} M`,28,144);x.textAlign='right';x.fillText(districts[Math.floor((g.level-1)/5)].toUpperCase(),970,144);x.textAlign='left';this.cache=c;this.level=g.level;
 }
 ore(x,o,px=o.x,py=o.y,held=false){const r=o.radius,c=colors[o.kind];x.save();x.translate(px,py);if(held)x.rotate(.13);if(this.quality!=='low'){x.shadowColor=c;x.shadowBlur=o.kind===2||o.kind===4?15:5;}x.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-.4,rr=r*(i%2?.86:1);const xx=Math.cos(a)*rr,yy=Math.sin(a)*rr;i?x.lineTo(xx,yy):x.moveTo(xx,yy);}x.closePath();const grad=x.createLinearGradient(-r,-r,r,r);grad.addColorStop(0,c);grad.addColorStop(1,o.kind===3?'#242d40':'#6c422f');x.fillStyle=grad;x.fill();x.shadowBlur=0;x.strokeStyle=c;x.lineWidth=2;x.stroke();x.beginPath();x.moveTo(-r*.6,-r*.35);x.lineTo(0,-r*.75);x.lineTo(r*.65,-r*.2);x.lineTo(0,r*.65);x.closePath();x.fillStyle=o.kind===2?'#e5d2ff77':'#ffffff22';x.fill();x.strokeStyle='#ffffff55';x.lineWidth=1;x.stroke();if(o.kind===4){x.fillStyle='#0d504f';x.fillRect(-r*.3,-r*.6,r*.6,r*1.2);x.fillStyle='#aaffeb';x.fillRect(-5,-10,10,20);}if(o.kind===5){x.fillStyle='#411e49';x.fillRect(-12,-10,24,20);x.fillStyle='#ffd2f7';x.font='bold 20px monospace';x.textAlign='center';x.fillText('?',0,7);}x.restore();}
 burst(x,y,color,count=14){if(this.reduced)return;for(let i=0;i<count&&this.particles.length<90;i++){const a=i*2.399;this.particles.push({x,y,vx:Math.cos(a)*(30+i*6),vy:Math.sin(a)*(30+i*6)-40,age:0,color});}}
 draw(g,dt=16,alpha=1,previous=g){this.clock+=dt/1000;if(!this.cache||g.level!==this.level){this.background(g);this.particles=[];this.labels=[];this.prev=g;this.lastScore=g.score;this.lastCargo=g.cargo;}
 const x=this.ctx,w=this.canvas.width,h=this.canvas.height;x.setTransform(w/1000,0,0,h/700,0,0);x.clearRect(0,0,1000,700);x.drawImage(this.cache,0,0);
 const [tx,ty]=tip(g),[oldX,oldY]=tip(previous);const smooth=previous.level===g.level&&previous.phase===g.phase&&!this.reduced;const hx=smooth?oldX+(tx-oldX)*alpha:tx,hy=smooth?oldY+(ty-oldY)*alpha:ty;
 if(g.cargo>=0&&this.lastCargo!==g.cargo){this.burst(hx,hy,colors[g.ores[g.cargo].kind]);}
 if(g.score>this.lastScore){const delta=g.score-this.lastScore;this.labels.push({x:500,y:105,text:`+${delta}`,age:0});this.burst(500,120,'#ffd075',22);}
 if(this.prev&&g.stock[0]<this.prev.stock[0])this.burst(oldX,oldY,'#fa7dba',28);
 this.lastScore=g.score;this.lastCargo=g.cargo;this.prev={stock:[...g.stock]};
 for(const o of g.ores)if(!o.taken)this.ore(x,o);
 if(!this.reduced&&this.quality!=='low'){for(let i=0;i<12;i++){const xx=(i*181+this.clock*6)%1000,yy=225+(i*53+Math.sin(this.clock+i)*5)%450;x.fillStyle=i%2?'#6ff5e544':'#ffc57355';x.fillRect(xx,yy,2,2);}}
 // Aim reticle is quiet, while cable and jaw follow exact collision positions.
 if(g.phase===0){const [dx,dy]=tip({...g,length:750});x.setLineDash([4,12]);x.strokeStyle='#65e6dc22';x.lineWidth=1;x.beginPath();x.moveTo(hx,hy);x.lineTo(dx,dy);x.stroke();x.setLineDash([]);}
 x.strokeStyle='#07101c';x.lineWidth=7;x.beginPath();x.moveTo(500,100);x.lineTo(hx,hy);x.stroke();x.strokeStyle=g.boost?'#ffb1e7':'#64e7e3';x.lineWidth=2.5;x.stroke();
 if(g.cargo>=0)this.ore(x,g.ores[g.cargo],hx,hy+18,true);
 x.save();x.translate(hx,hy);x.rotate((g.angle*2-70)*-Math.PI/180);x.fillStyle='#d2dfef';x.fillRect(-9,-13,18,16);x.strokeStyle='#fbd083';x.lineWidth=5;x.lineJoin='round';for(const sign of [-1,1]){x.beginPath();x.moveTo(sign*8,-3);x.lineTo(sign*20,12);x.lineTo(sign*(g.cargo>=0?8:16),26);x.stroke();}x.fillStyle='#72f8ec';x.fillRect(-4,-9,8,5);x.restore();
 // Robot, winch and amber optic: code-native assets with no external requests.
 x.fillStyle='#131d2b';x.fillRect(463,68,74,35);x.fillStyle='#32455d';x.fillRect(468,60,64,35);x.fillStyle='#627187';x.fillRect(475,55,50,9);x.fillStyle='#ffcb73';x.fillRect(478,70,44,10);x.fillStyle='#122235';x.fillRect(490,71,7,8);x.fillRect(504,71,7,8);x.strokeStyle='#7193a6';x.lineWidth=3;x.beginPath();x.arc(500,103,12,0,Math.PI*2);x.stroke();x.fillStyle=g.boost?'#ff76c8':'#63e8db';x.beginPath();x.arc(500,103,5,0,Math.PI*2);x.fill();
 const sec=dt/1000;for(const p of this.particles){p.age+=sec;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=180*sec;x.globalAlpha=Math.max(0,1-p.age/.7);x.fillStyle=p.color;x.fillRect(p.x,p.y,3,3);}this.particles=this.particles.filter(p=>p.age<.7);x.globalAlpha=1;
 for(const label of this.labels){label.age+=sec;x.globalAlpha=Math.max(0,1-label.age/1.2);x.fillStyle='#ffe2a6';x.font='bold 25px monospace';x.textAlign='center';x.fillText(label.text,label.x,label.y-label.age*48);}this.labels=this.labels.filter(l=>l.age<1.2);x.globalAlpha=1;x.textAlign='left';
 if(g.boost){x.fillStyle='#f590d8';x.font='12px monospace';x.textAlign='center';x.fillText(`OVERDRIVE ${(g.boost/30).toFixed(1)}s`,500,24);x.textAlign='left';}
 }
}
