import {viewport} from './layout.mjs';import {packs} from './art.mjs';import {pairCells,illuminated} from './engine.mjs';
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function image(src){return new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>{im.src='';reject(Error('Artwork could not finish loading. Please reconnect.'));},20000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(Error('Artwork could not load. Please reconnect.'));};im.src=src;});}
function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function round(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function label(c,t,x,y,size=18,color='#d9e9ec',align='center'){c.font=`500 ${size}px Georgia,serif`;c.textAlign=align;c.fillStyle=color;c.fillText(t,x,y);}
function glow(c,x,y,r,color){const a=c.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,color);a.addColorStop(1,'transparent');c.fillStyle=a;c.fillRect(x-r,y-r,r*2,r*2);}
export class Renderer{
 constructor(canvas,kind){this.canvas=canvas;this.kind=kind;this.ctx=canvas.getContext('2d',{alpha:false});this.pack=packs[kind];this.dirty=true;this.time=0;this.flash=0;this.lastKey='';this.renders=0;this.cacheBuilds=0;this.smooth=null;}
 async load(){let done=0;const prefix='/atelier/art/'+this.pack.prefix;globalThis.UTXOPlayLoader?.assets(0,2);[this.bg,this.atlas]=await Promise.all([image(prefix+'_bg.webp').then(im=>{globalThis.UTXOPlayLoader?.assets(++done,2);return im;}),image(prefix+'_atlas.webp').then(im=>{globalThis.UTXOPlayLoader?.assets(++done,2);return im;})]);this.dirty=true;}
 reset(){this.flash=0;this.smooth=null;this.dirty=true;}
 reward(){this.flash=1;this.dirty=true;}
 sprite(c,n,x,y,size,angle=0,alpha=1){if(!this.atlas)return;const[sx,sy,w,h]=this.pack.rects[n],s=size/Math.max(w,h);c.save();c.translate(x,y);if(angle)c.rotate(angle);c.globalAlpha*=alpha;c.drawImage(this.atlas,sx,sy,w,h,-w*s/2,-h*s/2,w*s,h*s);c.restore();}
 background(w,h,ratio){const cw=Math.round(w*ratio),ch=Math.round(h*ratio);this.back=surface(cw,ch);this.cacheBuilds++;const c=this.back.getContext('2d');c.scale(ratio,ratio);c.fillStyle='#071219';c.fillRect(0,0,w,h);if(this.bg){const s=Math.max(w/this.bg.width,h/this.bg.height);c.drawImage(this.bg,(w-this.bg.width*s)/2,(h-this.bg.height*s)/2,this.bg.width*s,this.bg.height*s);}
 const veil=c.createLinearGradient(0,0,0,h);veil.addColorStop(0,'#020b13d9');veil.addColorStop(.22,'#020b1320');veil.addColorStop(.74,'#020b1320');veil.addColorStop(1,'#020b13e8');c.fillStyle=veil;c.fillRect(0,0,w,h);
 const v=viewport(w,h,this.kind);c.translate(v.x,v.y);c.scale(v.scale,v.scale);c.lineWidth=1.5;
 if(this.kind==='rune-foundry'){round(c,282,108,436,842,15,'#0b1018dd','#cba15b88');round(c,290,116,420,826,9,null,'#fde3aa33');for(let y=0;y<12;y++)for(let x=0;x<6;x++)round(c,297+x*68,121+y*68,66,66,7,(x+y)%2?'#d6a97709':'#00000022','#b69d7017');}
 if(this.kind==='lumen-weave'){round(c,155,155,690,690,24,'#061a31cc','#b5d7ee66');for(let n=0;n<36;n++)this.sprite(c,3,225+n%6*110,225+Math.floor(n/6)*110,108);}
 if(this.kind==='mosslight'){round(c,71,71,858,858,26,'#12251cee','#c7df9866');for(let y=0;y<11;y++)for(let x=0;x<11;x++)round(c,84+x*76,84+y*76,72,72,8,(x+y)%2?'#8c9f5820':'#c9d4a008','#a2bb731b');}
 if(this.kind==='orbit-courier'){for(const r of [170,270,370]){c.strokeStyle='#8bdeed40';c.lineWidth=3;c.beginPath();c.arc(500,500,r,0,TAU);c.stroke();c.setLineDash([2,15]);c.lineWidth=1;c.strokeStyle='#d9fff957';c.beginPath();c.arc(500,500,r+9,0,TAU);c.stroke();c.setLineDash([]);}label(c,'DELIVERY DOCK',500,274,15,'#ffe8b0');}
 }
 draw(g,previous,alpha,delta,ratio,options={}){const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(w<1||h<1)return;ratio=Math.min(ratio,Math.sqrt(6000000/(w*h)));const cw=Math.max(1,Math.round(w*ratio)),ch=Math.max(1,Math.round(h*ratio));if(this.canvas.width!==cw||this.canvas.height!==ch){this.canvas.width=cw;this.canvas.height=ch;this.dirty=true;this.back=null;}
 const key=g.kind==='rune-foundry'?[g.tick,g.score,g.level].join(':'):g.kind==='orbit-courier'?[g.tick,g.score].join(':'):[g.turn,g.phase,g.level,g.x,g.y,g.lives].join(':');const animate=options.running&&!options.reduced&&!options.low;
 if(!this.dirty&&key===this.lastKey&&!(animate&&(this.kind==='orbit-courier'||this.flash>.01||this.smoothMoving)))return;
 if(!this.back||this.dirty)this.background(w,h,ratio);this.dirty=false;this.lastKey=key;this.renders++;if(animate)this.time+=Math.min(delta,50)/1000;this.flash=options.reduced?0:Math.max(0,this.flash-delta/900);
 const c=this.ctx;c.setTransform(1,0,0,1,0,0);c.drawImage(this.back,0,0);c.setTransform(ratio,0,0,ratio,0,0);const v=viewport(w,h,this.kind);c.translate(v.x,v.y);c.scale(v.scale,v.scale);
 if(!this.smooth||this.smooth.level!==g.level||!options.running)this.smooth={x:g.x,y:g.y,level:g.level};const ease=animate?1-Math.exp(-delta/55):1;this.smooth.x+=(g.x-this.smooth.x)*ease;this.smooth.y+=(g.y-this.smooth.y)*ease;this.smoothMoving=Math.abs(g.x-this.smooth.x)+Math.abs(g.y-this.smooth.y)>.02;
 if(this.kind==='rune-foundry')this.foundry(c,g);if(this.kind==='lumen-weave')this.weave(c,g);if(this.kind==='orbit-courier')this.orbit(c,g,previous,alpha,options);if(this.kind==='mosslight')this.garden(c,g);
 if(this.flash>.01&&animate){for(let n=0;n<18;n++){const a=n*2.399,r=(1-this.flash)*180+24,x=500+Math.cos(a)*r,y=500+Math.sin(a)*r;c.globalAlpha=this.flash*.7;c.fillStyle=n%2?'#ffe2a4':'#aaf4f0';c.beginPath();c.arc(x,y,2+n%3,0,TAU);c.fill();}c.globalAlpha=1;}
 if(g.phase){round(c,225,425,550,150,20,'#071a29ef','#e5d5a888');label(c,'CHAPTER COMPLETE',500,485,31,'#ffedbb');label(c,'A new world is opening…',500,535,22);}
 }
 foundry(c,g){label(c,'NEXT',425,63,16,'#f1c88a');g.bag.forEach((n,i)=>this.sprite(c,n-1,492+i*55,55,49));for(let n=0;n<72;n++)if(g.board[n])this.sprite(c,g.board[n]-1,330+n%6*68,154+Math.floor(n/6)*68,66);
 if(!g.over){c.save();c.beginPath();c.rect(296,120,408,816);c.clip();for(const[p,i]of pairCells(g).map((p,i)=>[p,i]))if(p[1]>=0)this.sprite(c,g.pair[i]-1,330+p[0]*68,154+p[1]*68,67);c.restore();}label(c,g.combo>1?`${g.combo}× CHAIN`:'FOUR RUNES · ONE REACTION',500,988,17,'#ffe0ab');}
 weave(c,g){c.lineCap='round';for(let n=0;n<36;n++){const x=225+n%6*110,y=225+Math.floor(n/6)*110,lit=Boolean(g.marks[n]);for(let d=0;d<4;d++)if(g.board[n]&(1<<d)){const[dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][d];c.lineWidth=lit?12:9;c.strokeStyle=lit?'#34a9c3':'#526b83';c.beginPath();c.moveTo(x,y);c.lineTo(x+dx*55,y+dy*55);c.stroke();if(lit){c.lineWidth=4;c.strokeStyle='#bcffff';c.stroke();}}
 this.sprite(c,n===0?2:lit?0:1,x,y,n===0?70:59,0,lit?1:.6);}
 for(const n of [g.y*6+g.x,35-(g.y*6+g.x)]){const x=170+n%6*110,y=170+Math.floor(n/6)*110;c.lineWidth=3;round(c,x+5,y+5,100,100,13,null,n===g.y*6+g.x?'#fff5c8':'#ceabff');}
 label(c,'ONE TURN. TWO CONNECTIONS.',500,110,20,'#c4e9ff');label(c,`${g.progress} OF 36 AWAKENED`,500,904,20,'#c4e9ff');}
 orbit(c,g,old,alpha,opts){const radii=[170,270,370],at=(a,r)=>{const t=a/3600*TAU-Math.PI/2;return[500+Math.cos(t)*r,500+Math.sin(t)*r];};this.sprite(c,3,500,330,72);for(const e of g.entities){const[x,y]=at(e.x,radii[e.y]);if(e.kind===2){glow(c,x,y,35,'#ffd96350');this.sprite(c,2,x,y,43);}else this.sprite(c,1,x,y,53,e.x/3600*TAU);}
 const angle=opts.reduced||!opts.running?g.x:(old.x+((g.x-old.x+5400)%3600-1800)*clamp(alpha,0,1)+3600)%3600,r=radii[g.y],p=at(angle,r);if(g.invulnerable)this.sprite(c,4,p[0],p[1],85,0,.65);this.sprite(c,0,p[0],p[1],64,angle/3600*TAU+Math.PI/2);for(let n=0;n<g.cargo;n++){const[x,y]=at(angle-100-n*75,r);this.sprite(c,2,x,y,24);}label(c,`ROUTE ${String(g.level).padStart(2,'0')} / 12`,500,58,20,'#c8f4f1');label(c,g.cargo?'PRECIOUS CARGO ON BOARD':'FIND THE AMBER CAPSULES',500,944,18,'#e1f1e8');}
 garden(c,g){for(let n=0;n<121;n++){const x=120+n%11*76,y=120+Math.floor(n/11)*76;if(g.board[n])this.sprite(c,3,x,y,76);else if(g.aux.some(Boolean)&&illuminated(g,n%11,Math.floor(n/11))){round(c,x-35,y-35,70,70,9,'#e9d58929');}if(g.aux[n]){glow(c,x,y,65,'#ffce5555');this.sprite(c,4,x,y,64);label(c,g.aux[n],x+24,y-19,17,'#fff5cb');}}
 for(const e of g.entities){const x=120+e.x*76,y=120+e.y*76;if(e.kind===2){glow(c,x,y,45,'#fbd75235');this.sprite(c,2,x,y,53);}else this.sprite(c,1,x,y,69);}
 const x=120+this.smooth.x*76,y=120+this.smooth.y*76;if(g.invulnerable)glow(c,x,y,62,'#cefff36b');this.sprite(c,0,x,y,80);label(c,'THE WORLD WAITS FOR YOUR NEXT STEP',500,975,17,'#d2e5b6');}
}
