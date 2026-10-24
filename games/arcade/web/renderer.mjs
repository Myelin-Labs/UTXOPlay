import {clamp, lerp, roadPoint, previousBody, EffectPool} from './presentation.mjs';

// Geometry follows the collision shapes; detail, lighting and motion are visual only.
export class ArcadeRenderer {
  constructor(canvas, kind, accent) {
    this.canvas = canvas; this.c = canvas.getContext('2d',{alpha:false}); this.kind = kind; this.accent = accent;
    this.effects = new EffectPool(); this.rings = []; this.labels = []; this.trail = [];
    this.hit = 0; this.time = 0; this.reduced = false; this.low = false;
    this.backdrop = document.createElement('canvas'); this.backdrop.width = this.backdrop.height = 1000;
    this.paintBackdrop();
    this.scenery = document.createElement('canvas');
    this.bricks = null;
    this.layerSize = 0; this.brickCells = null; this.lastGame = null;
    this.cssWidth = canvas.clientWidth;
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(entries => { this.cssWidth = entries[0].contentRect.width; });
      this.observer.observe(canvas);
    }
  }
  rect(x,y,w,h,r,color) { const c=this.c; c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill(); }
  circle(x,y,r,color) { if(r<=0)return;const c=this.c;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill(); }
  line(x,y,xx,yy,color,width=1) { const c=this.c;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke(); }
  poly(points,color) { const c=this.c;c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill(); }
  glow(color,n=16) { this.c.shadowColor=color;this.c.shadowBlur=this.low||this.reduced?0:n; }
  gradient(x,y,xx,yy,colors) { const g=this.c.createLinearGradient(x,y,xx,yy);colors.forEach((v,i)=>g.addColorStop(i/(colors.length-1),v));return g; }
  paintBackdrop() {
    const original=this.c;this.c=this.backdrop.getContext('2d');const c=this.c;
    c.fillStyle=this.gradient(0,0,0,1000,this.kind==='neon-coil'?['#071e22','#071316','#050e17']:['#11172f','#090e20','#060b19']);c.fillRect(0,0,1000,1000);
    const nebula=c.createRadialGradient(680,220,10,500,300,800);nebula.addColorStop(0,this.kind==='neon-coil'?'#19664b30':'#6140a92a');nebula.addColorStop(1,'#00000000');c.fillStyle=nebula;c.fillRect(0,0,1000,1000);
    if(this.kind==='neon-coil') {
      for(let n=0;n<=20;n++){this.line(n*50,0,n*50,1000,'#5ac6a013');this.line(0,n*50,1000,n*50,'#5ac6a013');}
      for(let i=0;i<55;i++){const x=(i*7%20)*50,y=(i*13%20)*50;this.circle(x,y,2,'#71e4b43a');this.line(x,y,x+50,y,'#71e4b41a',2);}
    } else if(this.kind==='starfall') {
      const planet=c.createRadialGradient(850,80,30,850,80,210);planet.addColorStop(0,'#173c60');planet.addColorStop(.85,'#102642');planet.addColorStop(1,'#457ea1');this.circle(850,80,210,planet);
      this.circle(880,40,202,'#0b1528e8');
    }
    this.c=original;
  }
  // Static raster layers follow the backing resolution and visual settings.
  // The runner skyline/road is rebuilt only after resize or quality changes.
  prepareLayers(size) {
    if(this.layerSize===size&&this.layerLow===this.low&&this.layerReduced===this.reduced)return;
    this.layerSize=size;this.layerLow=this.low;this.layerReduced=this.reduced;
    this.scenery.width=this.scenery.height=size;
    const original=this.c;this.c=this.scenery.getContext('2d',{alpha:false});
    this.c.setTransform(size/1000,0,0,size/1000,0,0);this.c.drawImage(this.backdrop,0,0);
    if(this.kind==='drift-run')this.runnerScenery();
    this.c=original;
    if(this.bricks){this.bricks.width=size;this.bricks.height=Math.ceil(size*.43);this.brickCells=null;}
  }
  runnerScenery() {
    const c=this.c;
    c.fillStyle=this.gradient(0,0,0,400,['#221b3d','#58324b','#121526']);c.fillRect(0,0,1000,430);
    this.glow('#e9a4aa',35);this.circle(500,140,88,this.gradient(0,50,0,230,['#ffdbad','#dc82a9']));c.shadowBlur=0;
    for(let i=0;i<5;i++)this.line(400,170+i*12,600,170+i*12,'#41243e',2+i);
    for(let n=0;n<22;n++){const x=n*49,h=45+(n*67)%160;this.rect(x,270-h,42,h,1,'#0e1426');for(let row=0;row<Math.floor(h/18);row++)for(let col=0;col<3;col++)if((row+col+n)%3)this.rect(x+6+col*10,278-h+row*16,3,5,1,(n+row)%2?'#d994ab48':'#9a9ffb32');}
    this.poly([[440,180],[560,180],[1000,1000],[0,1000]],this.gradient(0,180,0,1000,['#171a2a','#101426']));
    for(let n=0;n<4;n++){const edge=n===0||n===3;this.glow(edge?'#bc7ca3':'#000',edge?8:0);this.line(500+(n-1.5)*30,180,500+(n-1.5)*340,1000,edge?'#ce8cb3':'#81729650',edge?4:2);}c.shadowBlur=0;
  }
  reset() { this.lastGame=null; this.effects.clear();this.rings=[];this.labels=[];this.trail=[];this.hit=0; }
  event(e) {
    this.effects.emit(e,this.reduced);if(e.type==='damage')this.hit=.45;
    if(e.type!=='shot')this.rings.push({...e,age:0});
    if(e.value && e.type!=='wave')this.labels.push({...e,age:0});
    if(this.rings.length>12)this.rings.shift();if(this.labels.length>12)this.labels.shift();
  }
  tick() {}
  draw(g,before,alpha,delta,ratio,{running,reduced,low}) {
    this.reduced=reduced;this.low=low;this.time+=running&&!reduced?delta:0;
    const width=this.observer?this.cssWidth:this.canvas.clientWidth;
    const c=this.c,size=Math.max(1,Math.round(width*ratio));
    const settled=!this.effects.items.length&&!this.rings.length&&!this.labels.length&&this.hit===0;
    if(!running&&!this.lastRunning&&settled&&this.lastGame===g&&this.lastTick===g.tick&&this.layerSize===size&&this.layerLow===low&&this.layerReduced===reduced)return false;
    this.lastGame=g;this.lastTick=g.tick;this.lastRunning=running;
    if(this.canvas.width!==size){this.canvas.width=this.canvas.height=size;}
    this.prepareLayers(size);
    c.setTransform(size/1000,0,0,size/1000,0,0);c.globalAlpha=1;c.shadowBlur=0;
    c.drawImage(this.scenery,0,0,1000,1000);this.effects.advance(delta/1000);this.hit=Math.max(0,this.hit-delta/1000);
    const blend=(a,b)=>lerp(a,b,running?alpha:1);
    const body=b=>{const p=before.level===g.level&&before.lives===g.lives?previousBody(b,before):null;return p?{...b,x:blend(p.x,b.x),y:blend(p.y,b.y)}:b;};
    if(this.kind==='neon-coil')this.coil(g,before,blend);
    if(this.kind==='starfall')this.starfall(g,before,blend,body);
    if(this.kind==='drift-run')this.runner(g,before,blend,body);
    c.shadowBlur=0;
    for(const p of this.effects.items){c.globalAlpha=Math.max(0,1-p.age/p.life);const color=p.type==='damage'?'#ff9baf':p.type==='collect'?'#ffe5a6':this.accent;if(p.type==='brick'){c.save();c.translate(p.x,p.y);c.rotate(p.age*5);this.poly([[-p.size,-p.size],[p.size*2,0],[0,p.size*2]],color);c.restore();}else this.circle(p.x,p.y,p.size,color);}
    c.globalAlpha=1;
    for(const r of this.rings){r.age+=delta/1000;if(reduced)continue;const a=clamp(1-r.age/.5,0,1);c.globalAlpha=a*.6;c.strokeStyle=r.type==='damage'?'#ff899f':this.accent;c.lineWidth=2;c.beginPath();c.arc(r.x,r.y,10+r.age*110,0,Math.PI*2);c.stroke();}this.rings=this.rings.filter(r=>r.age<.5);c.globalAlpha=1;
    c.textAlign='center';c.font='700 21px Inter, system-ui';
    for(const l of this.labels){l.age+=delta/1000;c.globalAlpha=clamp(1-l.age/.85,0,1);c.fillStyle=l.type==='collect'?'#ffe7a8':'#f0eaff';c.fillText('+'+l.value,l.x,l.y-24-(reduced?0:l.age*42));}this.labels=this.labels.filter(l=>l.age<.85);c.globalAlpha=1;
    if(this.hit>0){c.strokeStyle=`rgba(255,123,153,${this.hit})`;c.lineWidth=12;c.strokeRect(6,6,988,988);}
    return true;
  }
  coil(g,before,blend) {
    const c=this.c,t=this.time,fx=g.x*50+25,fy=g.y*50+25;
    this.glow('#ffce6d',24);this.circle(fx,fy,12+Math.sin(t/180)*1.5,'#ffe19a');c.shadowBlur=0;this.circle(fx-3,fy-4,4,'#fff8de');
    c.strokeStyle='#edc87555';c.lineWidth=2;c.beginPath();c.arc(fx,fy,20+Math.sin(t/300)*3,0,Math.PI*2);c.stroke();
    for(let i=g.trail.length-1;i>=0;i--){const p=g.trail[i],old=before.trail[i]||p;const x=blend(old[0],p[0])*50,y=blend(old[1],p[1])*50;
      const color=i===0?'#b4ffda':`hsl(${151+i%8*2} 65% ${Math.max(28,61-i*.65)}%)`;
      this.rect(x+4,y+9,42,42,13,'#0005');this.rect(x+3,y+3,44,44,13,this.gradient(x,y,x,y+48,[color,'#17734f']));this.rect(x+10,y+6,30,5,3,'#d5ffe665');
      this.circle(x+25,y+26,3,i===0?'#d8ffb9':'#b9ffd975');
      if(i===0){c.save();c.translate(x+25,y+25);c.rotate((g.dir-1)*Math.PI/2);for(const side of [-1,1]){this.circle(9,side*11,7,'#062f2a');this.circle(11,side*11-1,3,'#eaffd4');}c.restore();}
    }
  }
  starfall(g,before,blend,body) {
    const c=this.c,t=this.time;
    for(let i=0;i<(this.low?30:70);i++){const x=(i*173+17)%1000,y=(i*237+t*.018*(1+i%3))%1000;this.circle(x,y,i%3===0?1.8:1,'#c1defe70');}
    for(const raw of g.bodies){const b=body(raw);if(b.tag===1){
      const color=['#af98ff','#88c8ff','#61d5da','#91e4bf'][Math.max(0,Math.floor((b.y-110)/70))%4];
      c.save();c.translate(b.x,b.y);this.glow(color,8);this.poly([[0,-22],[30,-4],[20,19],[0,9],[-20,19],[-30,-4]],color);c.shadowBlur=0;
      this.poly([[0,-18],[11,0],[0,10],[-11,0]],'#25314e');this.poly([[0,-10],[6,0],[0,5],[-6,0]],'#e9f7ff');this.line(-24,-3,-14,10,'#ffffff70',2);this.line(24,-3,14,10,'#ffffff70',2);c.restore();
    }else{const friendly=b.tag===2;this.glow(friendly?'#9ee9ff':'#ff9d9d',12);this.rect(b.x-3,b.y-12,6,24,3,friendly?'#d1faff':'#ff9baf');c.shadowBlur=0;if(!this.low)this.line(b.x,b.y+12,b.x,b.y+(friendly?35:-24),friendly?'#7ce5ff38':'#ff758a38',3);}}
    c.save();c.translate(blend(before.x,g.x),900);
    if(g.vy>0){c.strokeStyle='#91e7ff80';c.lineWidth=2;c.beginPath();c.arc(0,0,43,0,Math.PI*2);c.stroke();}
    const flame=16+(this.reduced?0:Math.sin(t/45)*6);this.glow('#a68bff',18);this.poly([[-10,18],[0,38+flame],[10,18]],'#ac8bff');this.poly([[-5,20],[0,34+flame/2],[5,20]],'#d9faff');
    this.glow('#83cfff',10);this.poly([[0,-30],[28,22],[9,15],[0,21],[-9,15],[-28,22]],'#cceaff');c.shadowBlur=0;this.poly([[0,-25],[7,7],[0,13],[-7,7]],'#405579');this.poly([[-24,18],[-10,-6],[-12,17]],'#6ab4df');this.poly([[24,18],[10,-6],[12,17]],'#6ab4df');c.restore();
  }
  runner(g,before,blend,body) {
    const c=this.c,t=this.time;
    for(let n=0;n<14;n++){const p=roadPoint(1,(n*90+t*.3)%1100);this.line(500-450*p.scale,p.y,500+450*p.scale,p.y,'#c69dc21a');}
    for(let n=0;n<12;n++){const p=roadPoint(1,(n*110+t*.3)%1100);this.line(500-470*p.scale,p.y,500-510*p.scale,p.y+30*p.scale,'#9e83bf45',3);this.line(500+470*p.scale,p.y,500+510*p.scale,p.y+30*p.scale,'#9e83bf45',3);}
    for(const raw of [...g.bodies].sort((a,b)=>a.y-b.y)){const b=body(raw),p=roadPoint(b.x,b.y),s=p.scale;if(s<=0)continue;
      if(b.tag===1){this.rect(p.x-76*s,p.y-25*s,152*s,63*s,5,'#0007');this.rect(p.x-75*s,p.y-40*s,150*s,65*s,7,this.gradient(p.x,p.y-40*s,p.x,p.y+25*s,['#ffb19d','#ac486d']));this.poly([[p.x-75*s,p.y-40*s],[p.x-58*s,p.y-54*s],[p.x+60*s,p.y-54*s],[p.x+75*s,p.y-40*s]],'#ffd1b6');for(let k=-1;k<2;k++)this.poly([[p.x+(k*45-12)*s,p.y-28*s],[p.x+(k*45+2)*s,p.y-28*s],[p.x+(k*45+22)*s,p.y+12*s],[p.x+(k*45+8)*s,p.y+12*s]],'#662944aa');
      }else{this.glow('#ffd289',15);c.strokeStyle='#ffe0a3';c.lineWidth=6*s;c.beginPath();c.ellipse(p.x,p.y,22*s,28*s,0,0,Math.PI*2);c.stroke();c.shadowBlur=0;this.circle(p.x,p.y,5*s,'#fff1c9');}}
    const p=roadPoint(blend(before.x,g.x),830);this.rect(p.x-43,p.y-20,86,75,18,'#0008');
    if(!this.reduced){this.glow('#ff9ac7',16);this.poly([[p.x-25,p.y+32],[p.x-20,p.y+80],[p.x-15,p.y+32]],'#f3a0c555');this.poly([[p.x+25,p.y+32],[p.x+20,p.y+80],[p.x+15,p.y+32]],'#f3a0c555');}c.shadowBlur=0;
    this.rect(p.x-39,p.y-42,78,85,15,this.gradient(p.x-39,p.y,p.x+39,p.y,['#77629d','#d5bdff','#8b73b4']));this.rect(p.x-28,p.y-26,56,28,7,this.gradient(0,p.y-26,0,p.y+2,['#6683a2','#252e50']));this.line(p.x-23,p.y-22,p.x+23,p.y-22,'#cbe5ec60',2);
    for(let i=0;i<3;i++)this.line(p.x-29,p.y+8+i*5,p.x+29,p.y+8+i*5,'#49395b',2);
    this.glow('#ff98bc',12);this.rect(p.x-31,p.y+28,23,5,2,'#ffb5cd');this.rect(p.x+8,p.y+28,23,5,2,'#ffb5cd');c.shadowBlur=0;
  }
}
