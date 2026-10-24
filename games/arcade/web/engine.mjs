import {createPrism,prismStep} from './prism-engine.mjs';
// Predictive rendering only. The Rust executor recomputes every accepted input tape.
export const kinds=['prism-breaker','neon-coil','starfall','drift-run'];
const body=(x,y,vx,vy,tag)=>({x,y,vx,vy,tag});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=g=>(g.rng=(g.rng*16807)%2147483647);
function food(g){for(let i=0;i<500;i++){const n=rand(g)%400,p=[n%20,Math.floor(n/20)];if(!g.trail.some(t=>t[0]===p[0]&&t[1]===p[1])){[g.x,g.y]=p;return;}}for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!g.trail.some(t=>t[0]===x&&t[1]===y)){g.x=x;g.y=y;return;}g.over=true;}
function wave(g){g.bodies=[];for(let row=0;row<4;row++)for(let col=0;col<8;col++)g.bodies.push(body(160+col*90,110+row*70,2+Math.min(g.level,5),0,1));}
export function createGame(kind){
 if(kind==='prism-breaker')return createPrism();
 if(!kinds.includes(kind))throw Error('Unknown arcade game');
 const g={kind,tick:0,score:0,lives:3,level:1,over:false,x:500,y:750,vx:7,vy:-10,dir:1,next_dir:1,cooldown:0,combo:0,rng:73129,energy:0,ability_ticks:0,ability_lock:0,specials:0,echo_lane:1,echo_ticks:0,loop_area:0,bodies:[],trail:[],cells:[]};
 if(kind==='neon-coil'){g.trail=[[10,12],[9,12],[8,12],[7,12],[6,12],[5,12]];g.lives=1;food(g);}
 if(kind==='starfall')wave(g);
 if(kind==='drift-run'){g.x=1;g.lives=1;}
 return g;
}
export function step(g,i){
 if(g.kind==='prism-breaker')return prismStep(g,i);
 if(g.over)return;g.tick++;if(g.kind==='neon-coil'&&g.ability_ticks)g.ability_ticks--;
 if(g.kind==='neon-coil')snake(g,i);
 else if(g.kind==='starfall')shooter(g,i);
 else runner(g,i);
 if(g.tick>=18000)g.over=true;
}
export function enclosedArea(boundary){
 const wall=new Set(boundary.map(([x,y])=>y*20+x)),seen=new Set(),queue=[];
 const visit=(x,y)=>{const n=y*20+x;if(x>=0&&x<20&&y>=0&&y<20&&!wall.has(n)&&!seen.has(n)){seen.add(n);queue.push([x,y]);}};
 for(let i=0;i<20;i++){visit(i,0);visit(i,19);visit(0,i);visit(19,i);}
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
 return 400-wall.size-seen.size;
}
function snake(g,i){
 const d=(i&4)?0:(i&2)?1:(i&8)?2:(i&1)?3:g.next_dir;if((d+2)%4!==g.dir)g.next_dir=d;
 const interval=Math.max(6-Math.floor(g.score/50),3);if(g.tick%interval)return;g.dir=g.next_dir;
 const p=[...g.trail[0]];p[0]+=g.dir===1?1:g.dir===3?-1:0;p[1]+=g.dir===0?-1:g.dir===2?1:0;
 const eat=p[0]===g.x&&p[1]===g.y;
 const hit=g.trail.slice(0,g.trail.length-(eat?0:1)).findIndex(t=>t[0]===p[0]&&t[1]===p[1]);
 if(hit>=7){const area=enclosedArea(g.trail.slice(0,hit+1));if(area>0){g.loop_area=area;g.specials++;g.ability_ticks=45;g.score+=40+area*10;g.level=1+Math.floor(g.score/50);g.trail=[p,g.trail[0],g.trail[1]];food(g);return;}}
 if(p[0]<0||p[0]>=20||p[1]<0||p[1]>=20||hit>=0){g.over=true;g.lives=0;return;}
 g.trail.unshift(p);if(eat){g.score+=10;g.level=1+Math.floor(g.score/50);food(g);}else g.trail.pop();
}
function shooter(g,i){
 g.x=clamp(g.x+((i&1)?-18:0)+((i&2)?18:0),35,965);
 if(g.ability_lock>0)g.ability_lock--;
 const guarding=!!(i&4)&&!g.ability_lock&&g.ability_ticks<45;
 if(guarding)g.ability_ticks++;else {if(g.ability_ticks){if(g.energy){for(let n=0;n<g.energy;n++)g.bodies.push(body(g.x,850,(2*n-g.energy+1)*3,-26,4));g.specials++;g.energy=0;}if(g.ability_ticks>=45)g.ability_lock=60;}g.ability_ticks=0;}
 if(g.cooldown>0)g.cooldown--;if((i&16)&&!guarding&&!g.cooldown){g.bodies.push(body(g.x,870,0,-24,2));g.cooldown=7;}
 if(g.vy>0)g.vy--;
 const bounce=g.bodies.some(b=>b.tag===1&&(b.x+b.vx<45||b.x+b.vx>955));for(const b of g.bodies){if(b.tag===1&&bounce){b.vx=-b.vx;b.y+=24;}b.x+=b.vx;b.y+=b.vy;}
 const period=Math.max(38-g.level*3,13);if(!(g.tick%period)){const enemies=g.bodies.filter(b=>b.tag===1);if(enemies.length){const b=enemies[rand(g)%enemies.length];g.bodies.push(body(b.x,b.y,0,9+Math.min(g.level,6),3));}}
 for(const a of g.bodies){if(a.tag!==2&&a.tag!==4)continue;for(const b of g.bodies){if(b.tag===1&&Math.abs(a.x-b.x)<35&&Math.abs(a.y-b.y)<30){g.score+=a.tag===4?40:20;a.tag=0;b.tag=0;break;}}}
 for(const b of g.bodies){if(b.tag===3&&guarding&&Math.abs(b.x-g.x)<75&&Math.abs(b.y-880)<55){b.tag=0;g.energy=Math.min(6,g.energy+1);g.score+=5;}if(b.tag===3&&!g.vy&&Math.abs(b.x-g.x)<35&&Math.abs(b.y-900)<32){b.tag=0;g.lives--;g.vy=60;if(g.lives===0)g.over=true;}if(b.tag===1&&b.y>830){g.over=true;g.lives=0;}}
 g.bodies=g.bodies.filter(b=>b.tag!==0&&b.y>-40&&b.y<1060);if(!g.bodies.some(b=>b.tag===1)){g.level++;g.score+=200;wave(g);}
}
function runner(g,i){
 if(g.ability_ticks>0)g.ability_ticks--;if(g.echo_ticks>0)g.echo_ticks--;
 if((i&16)&&!g.ability_lock&&g.energy>=3&&!g.ability_ticks){g.energy-=3;g.ability_ticks=45;g.specials++;}g.ability_lock=(i&16)?1:0;
 const oldLane=g.x;
 if(g.cooldown>0)g.cooldown--;if(!g.cooldown){if(i&1){g.x=Math.max(g.x-1,0);g.cooldown=7;}else if(i&2){g.x=Math.min(g.x+1,2);g.cooldown=7;}}
 if(g.x!==oldLane){g.echo_lane=oldLane;g.echo_ticks=20;}
 g.level=1+Math.floor(g.tick/600);const speed=9+Math.min(g.level,14)+(g.ability_ticks?7:0);
 if(g.tick%36===1){const lane=rand(g)%3;g.bodies.push(body(lane,-80,0,speed,1));const coin=(lane+1+rand(g)%2)%3;g.bodies.push(body(coin,-240,0,speed,2));}
 for(const b of g.bodies){const oldY=b.y;b.y+=speed;
  if(b.tag===1&&oldY<830&&b.y>=830&&Math.abs(b.x-g.x)===1){g.energy=Math.min(3,g.energy+1);g.score+=15;g.combo++;}
  if(Math.abs(b.y-830)<48){if(b.x===g.x&&b.tag===1){if(g.ability_ticks){g.score+=50;b.tag=0;}else{g.over=true;g.lives=0;}}
   else if(b.tag===2&&(b.x===g.x||(g.echo_ticks&&b.x===g.echo_lane))){g.score+=b.x===g.x?25:40;if(b.x!==g.x)g.energy=Math.min(3,g.energy+1);b.tag=0;}}
 }
 g.bodies=g.bodies.filter(b=>b.y<1100&&b.tag!==0);if(!(g.tick%15))g.score++;
}
