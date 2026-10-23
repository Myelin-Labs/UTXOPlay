// Predictive rendering only. The Rust executor recomputes every accepted input tape.
export const kinds=['prism-breaker','neon-coil','starfall','drift-run'];
const body=(x,y,vx,vy,tag)=>({x,y,vx,vy,tag});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=g=>(g.rng=(g.rng*16807)%2147483647);
function food(g){for(let i=0;i<500;i++){const n=rand(g)%400,p=[n%20,Math.floor(n/20)];if(!g.trail.some(t=>t[0]===p[0]&&t[1]===p[1])){[g.x,g.y]=p;return;}}for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!g.trail.some(t=>t[0]===x&&t[1]===y)){g.x=x;g.y=y;return;}g.over=true;}
function wave(g){g.bodies=[];for(let row=0;row<4;row++)for(let col=0;col<8;col++)g.bodies.push(body(160+col*90,110+row*70,2+Math.min(g.level,5),0,1));}
export function createGame(kind){
 if(!kinds.includes(kind))throw Error('Unknown arcade game');
 const g={kind,tick:0,score:0,lives:3,level:1,over:false,x:500,y:750,vx:7,vy:-10,dir:1,next_dir:1,cooldown:0,combo:0,rng:73129,bodies:[],trail:[],cells:[]};
 if(kind==='prism-breaker'){g.y=700;g.cells=Array(48).fill(1);g.bodies=[body(500,700,7,-10,0)];}
 if(kind==='neon-coil'){g.trail=[[10,12],[9,12],[8,12]];g.lives=1;food(g);}
 if(kind==='starfall')wave(g);
 if(kind==='drift-run'){g.x=1;g.lives=1;}
 return g;
}
export function step(g,i){
 if(g.over)return;g.tick++;
 if(g.kind==='prism-breaker')breaker(g,i);
 else if(g.kind==='neon-coil')snake(g,i);
 else if(g.kind==='starfall')shooter(g,i);
 else runner(g,i);
 if(g.tick>=18000)g.over=true;
}
function breaker(g,i){
 g.x=clamp(g.x+((i&1)?-24:0)+((i&2)?24:0),90,910);
 let b={...g.bodies[0]},oldY=b.y;b.x+=b.vx;b.y+=b.vy;
 if(b.x<20){b.x=20;b.vx=Math.abs(b.vx);}if(b.x>980){b.x=980;b.vx=-Math.abs(b.vx);}if(b.y<25){b.y=25;b.vy=Math.abs(b.vy);}
 if(b.vy>0&&oldY<865&&b.y>=865&&Math.abs(b.x-g.x)<108){b.y=864;b.vy=-(11+Math.min(g.level,8));b.vx=clamp(Math.trunc((b.x-g.x)/10),-10,10);if(b.vx===0)b.vx=3;g.combo=0;}
 for(let n=0;n<48;n++){if(!g.cells[n])continue;const x=70+(n%8)*110,y=135+Math.floor(n/8)*48;if(Math.abs(b.x-x)<57&&Math.abs(b.y-y)<30){g.cells[n]=0;b.vy=-b.vy;g.combo++;g.score+=10*Math.min(g.combo,8);break;}}
 if(b.y>1020){g.lives--;g.combo=0;if(g.lives===0)g.over=true;b=body(g.x,700,7,-10,0);}
 if(g.cells.every(v=>v===0)){g.level++;g.cells.fill(1);g.score+=500;b=body(g.x,700,7,-(10+Math.min(g.level,8)),0);}g.bodies[0]=b;
}
function snake(g,i){
 const d=(i&4)?0:(i&2)?1:(i&8)?2:(i&1)?3:g.next_dir;if((d+2)%4!==g.dir)g.next_dir=d;
 const interval=Math.max(6-Math.floor(g.score/50),3);if(g.tick%interval)return;g.dir=g.next_dir;
 const p=[...g.trail[0]];p[0]+=g.dir===1?1:g.dir===3?-1:0;p[1]+=g.dir===0?-1:g.dir===2?1:0;
 const eat=p[0]===g.x&&p[1]===g.y;
 if(p[0]<0||p[0]>=20||p[1]<0||p[1]>=20||g.trail.slice(0,g.trail.length-(eat?0:1)).some(t=>t[0]===p[0]&&t[1]===p[1])){g.over=true;g.lives=0;return;}
 g.trail.unshift(p);if(eat){g.score+=10;g.level=1+Math.floor(g.score/50);food(g);}else g.trail.pop();
}
function shooter(g,i){
 g.x=clamp(g.x+((i&1)?-18:0)+((i&2)?18:0),35,965);
 if(g.cooldown>0)g.cooldown--;if((i&16)&&!g.cooldown){g.bodies.push(body(g.x,870,0,-24,2));g.cooldown=7;}
 if(g.vy>0)g.vy--;
 const bounce=g.bodies.some(b=>b.tag===1&&(b.x+b.vx<45||b.x+b.vx>955));for(const b of g.bodies){if(b.tag===1&&bounce){b.vx=-b.vx;b.y+=24;}b.x+=b.vx;b.y+=b.vy;}
 const period=Math.max(38-g.level*3,13);if(!(g.tick%period)){const enemies=g.bodies.filter(b=>b.tag===1);if(enemies.length){const b=enemies[rand(g)%enemies.length];g.bodies.push(body(b.x,b.y,0,9+Math.min(g.level,6),3));}}
 for(const a of g.bodies){if(a.tag!==2)continue;for(const b of g.bodies){if(b.tag===1&&Math.abs(a.x-b.x)<35&&Math.abs(a.y-b.y)<30){a.tag=0;b.tag=0;g.score+=20;break;}}}
 for(const b of g.bodies){if(b.tag===3&&!g.vy&&Math.abs(b.x-g.x)<35&&Math.abs(b.y-900)<32){b.tag=0;g.lives--;g.vy=60;if(g.lives===0)g.over=true;}if(b.tag===1&&b.y>830){g.over=true;g.lives=0;}}
 g.bodies=g.bodies.filter(b=>b.tag!==0&&b.y>-40&&b.y<1060);if(!g.bodies.some(b=>b.tag===1)){g.level++;g.score+=200;wave(g);}
}
function runner(g,i){
 if(g.cooldown>0)g.cooldown--;if(!g.cooldown){if(i&1){g.x=Math.max(g.x-1,0);g.cooldown=7;}else if(i&2){g.x=Math.min(g.x+1,2);g.cooldown=7;}}
 g.level=1+Math.floor(g.tick/600);const speed=9+Math.min(g.level,14);
 if(g.tick%36===1){const lane=rand(g)%3;g.bodies.push(body(lane,-80,0,speed,1));const coin=(lane+1+rand(g)%2)%3;g.bodies.push(body(coin,-240,0,speed,2));}
 for(const b of g.bodies){b.y+=speed;if(b.x===g.x&&Math.abs(b.y-830)<48){if(b.tag===1){g.over=true;g.lives=0;}else if(b.tag===2){g.score+=25;b.tag=0;}}}
 g.bodies=g.bodies.filter(b=>b.y<1100&&b.tag!==0);if(!(g.tick%15))g.score++;
}
