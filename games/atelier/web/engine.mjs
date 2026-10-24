// Integer-only prediction. Every input is independently executed by Myelin.
export const kinds=['rune-foundry','lumen-weave','orbit-courier','mosslight'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=g=>(g.rng=g.rng*16807%2147483647);
const entity=(x,y,kind,age=0)=>({x,y,kind,age});
const rotate=m=>((m<<1)&15)|(m>>3);
const delta=a=>Math.min((a%3600+3600)%3600,3600-(a%3600+3600)%3600);
export function createGame(kind){
 if(!kinds.includes(kind))throw Error('Unknown atelier game');
 const g={kind,tick:0,score:0,lives:3,level:1,over:false,won:false,rng:73129,x:0,y:0,dir:0,cooldown:0,energy:2,combo:0,progress:0,goal:0,phase:0,age:0,held:0,turn:0,invulnerable:0,cargo:0,board:[],aux:[],marks:[],bag:[],pair:[0,0],entities:[]};
 setup(g);return g;
}
function setup(g){g.phase=0;g.age=0;g.cooldown=0;g.held=0;g.progress=0;g.entities=[];
 if(g.kind==='rune-foundry'){g.board=Array(72).fill(0);g.bag=[1+rand(g)%4,1+rand(g)%4];g.goal=288;g.lives=1;spawn(g);}
 if(g.kind==='lumen-weave')weaveLevel(g);
 if(g.kind==='orbit-courier'){g.x=0;g.y=1;g.dir=1;g.cargo=0;g.goal=3+Math.floor(g.level/3);g.invulnerable=60;for(let n=0;n<3+Math.floor(g.level/2);n++)g.entities.push(entity((1800+n*417)%3600,n%3,1,(n%2?1:-1)*(5+g.level)));packets(g);}
 if(g.kind==='mosslight')gardenLevel(g);
}
function advance(g,max){g.score+=200*g.level;if(g.level>=max){g.won=true;g.over=true;}else g.phase=45;}
export function step(g,input){
 if(g.over)return;g.tick++;if(g.tick>=54000){g.over=true;return;}
 if(g.phase){g.phase--;if(!g.phase){g.level++;setup(g);}g.held=0;return;}
 if(g.kind==='lumen-weave'&&input>=64&&input<=99){g.x=(input-64)%6;g.y=Math.floor((input-64)/6);twist(g,input-64);g.turn++;power(g);if(g.progress===36)advance(g,24);g.held=0;return;}
 const edge=input&~g.held;g.held=input;if(g.cooldown)g.cooldown--;
 if(g.kind==='rune-foundry')foundry(g,input,edge);
 if(g.kind==='lumen-weave')weave(g,input,edge);
 if(g.kind==='orbit-courier')orbit(g,input,edge);
 if(g.kind==='mosslight')garden(g,input,edge);
}
const offsets=[[0,-1],[1,0],[0,1],[-1,0]];
export function pairCells(g,x=g.x,y=g.y,dir=g.dir){const[dX,dY]=offsets[dir];return[[x,y],[x+dX,y+dY]];}
function fits(g,x,y,dir){return pairCells(g,x,y,dir).every(([a,b])=>a>=0&&a<6&&b>=-1&&b<12&&(b<0||!g.board[b*6+a]));}
function spawn(g){g.x=2;g.y=0;g.dir=0;g.pair=[...g.bag];const colors=4+(g.level>=5?1:0)+(g.level>=9?1:0);g.bag=[1+rand(g)%colors,1+rand(g)%colors];if(!fits(g,g.x,g.y,g.dir)){g.over=true;g.lives=0;}}
function gravity(g){for(let x=0;x<6;x++){let dest=11;for(let y=11;y>=0;y--)if(g.board[y*6+x]){const value=g.board[y*6+x];g.board[y*6+x]=0;g.board[dest*6+x]=value;dest--;}}}
export function resolveFoundry(g){let chain=0;for(let pass=0;pass<18;pass++){const seen=new Set(),remove=[];let groups=0;for(let n=0;n<72;n++){if(!g.board[n]||seen.has(n))continue;const queue=[n];seen.add(n);for(let at=0;at<queue.length;at++){const q=queue[at],x=q%6,y=Math.floor(q/6);for(const dxdy of [[0,-1],[1,0],[0,1],[-1,0]]){const xx=x+dxdy[0],yy=y+dxdy[1],j=yy*6+xx;if(xx>=0&&xx<6&&yy>=0&&yy<12&&!seen.has(j)&&g.board[j]===g.board[n]){seen.add(j);queue.push(j);}}}if(queue.length>=4){remove.push(...queue);groups++;}}
 if(!remove.length)break;chain++;for(const n of remove)g.board[n]=0;g.score+=remove.length*10*chain;g.progress+=remove.length;g.energy=Math.min(6,g.energy+groups);gravity(g);}
 g.combo=chain;g.level=Math.min(12,1+Math.floor(g.progress/24));if(g.progress>=g.goal){g.won=true;g.over=true;}}
function lock(g){const cells=pairCells(g);if(cells.some(p=>p[1]<0)){g.over=true;g.lives=0;return;}cells.forEach(([x,y],i)=>g.board[y*6+x]=g.pair[i]);resolveFoundry(g);g.age=0;if(!g.over)spawn(g);}
function foundry(g,input,edge){
 if(!g.cooldown&&(input&3)){const dx=input&1?-1:1;if(fits(g,g.x+dx,g.y,g.dir))g.x+=dx;g.cooldown=5;}
 if(edge&4){const dir=(g.dir+1)%4;for(const dx of [0,-1,1])if(fits(g,g.x+dx,g.y,dir)){g.x+=dx;g.dir=dir;break;}}
 if((edge&16)&&g.energy>=3&&g.board.slice(66).some(Boolean)){g.energy-=3;for(let n=66;n<72;n++){if(g.board[n])g.score+=5;g.board[n]=0;}gravity(g);resolveFoundry(g);}
 if(edge&8){while(fits(g,g.x,g.y+1,g.dir))g.y++;lock(g);return;}
 g.age++;if(g.age>=Math.max(7,25-g.level)){g.age=0;if(fits(g,g.x,g.y+1,g.dir))g.y++;else lock(g);}
}
function weaveLevel(g){g.x=0;g.y=0;g.goal=36;g.board=Array(36).fill(0);g.aux=Array(36).fill(0);const seen=new Set([0]),stack=[0];
 while(stack.length){const n=stack.at(-1),x=n%6,y=Math.floor(n/6),options=[];for(let d=0;d<4;d++){const[dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][d],xx=x+dx,yy=y+dy,j=yy*6+xx;if(xx>=0&&xx<6&&yy>=0&&yy<6&&!seen.has(j))options.push([d,j]);}if(!options.length){stack.pop();continue;}const[d,j]=options[rand(g)%options.length];g.board[n]|=1<<d;g.board[j]|=1<<((d+2)%4);seen.add(j);stack.push(j);}
 for(let n=0;n<18;n++){const turns=1+rand(g)%3;for(let t=0;t<turns;t++)twist(g,n);}power(g);
 if(g.progress===36){twist(g,0);power(g);}
}
export function twist(g,n){const twin=35-n;g.board[n]=rotate(g.board[n]);g.board[twin]=rotate(rotate(rotate(g.board[twin])));g.aux[n]=(g.aux[n]+1)%4;g.aux[twin]=(g.aux[twin]+3)%4;}
export function power(g){g.marks=Array(36).fill(0);g.marks[0]=1;const queue=[0];for(let at=0;at<queue.length;at++){const n=queue[at],x=n%6,y=Math.floor(n/6);for(let d=0;d<4;d++){const[dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][d],xx=x+dx,yy=y+dy,j=yy*6+xx;if(xx>=0&&xx<6&&yy>=0&&yy<6&&!g.marks[j]&&(g.board[n]&(1<<d))&&(g.board[j]&(1<<((d+2)%4)))){g.marks[j]=1;queue.push(j);}}}g.progress=queue.length;}
function weave(g,input,edge){if(!g.cooldown&&(input&15)){g.x=clamp(g.x+(input&1?-1:input&2?1:0),0,5);g.y=clamp(g.y+(input&4?-1:input&8?1:0),0,5);g.cooldown=6;}if(edge&16){twist(g,g.y*6+g.x);g.turn++;power(g);if(g.progress===36)advance(g,24);}}
function packets(g){while(g.entities.filter(e=>e.kind===2).length<3){const x=(g.x+600+rand(g)%2400)%3600,y=1+rand(g)%2;g.entities.push(entity(x,y,2));}}
function orbit(g,input,edge){
 if(g.invulnerable)g.invulnerable--;if(!g.cooldown&&(edge&3)){g.y=clamp(g.y+(edge&1?-1:1),0,2);g.cooldown=8;}
 if((edge&16)&&g.energy>=2){g.energy-=2;g.x=(g.x+1800)%3600;g.invulnerable=20;g.combo++;}
 const speed=10+g.level*2+(input&8?6:0)-(input&4?6:0);g.x=(g.x+speed)%3600;
 for(const e of g.entities){if(e.kind===1)e.x=(e.x+e.age+3600)%3600;if(e.y!==g.y||delta(e.x-g.x)>85)continue;
  if(e.kind===1&&!g.invulnerable){g.lives--;g.cargo=Math.max(0,g.cargo-1);g.invulnerable=60;if(!g.lives)g.over=true;}
  if(e.kind===2&&g.cargo<3){g.cargo++;g.energy=Math.min(6,g.energy+1);g.score+=20;e.kind=0;}}
 g.entities=g.entities.filter(e=>e.kind);packets(g);
 if(!g.over&&g.y===0&&delta(g.x)<95&&g.cargo){g.progress+=g.cargo;g.score+=g.cargo*100;g.cargo=0;if(g.progress>=g.goal)advance(g,12);}
}
function gardenLevel(g){g.x=5;g.y=5;g.board=Array(121).fill(0);g.aux=Array(121).fill(0);g.goal=5+Math.floor(g.level/4);g.energy=Math.min(6,g.energy+2);g.invulnerable=0;if(g.level%3===1)g.lives=Math.min(3,g.lives+1);
 for(let y=1;y<10;y++)for(let x=1;x<10;x++)if(x%2===0&&y%2===0&&rand(g)%4!==0)g.board[y*11+x]=1;
 const empty=()=>{for(let i=0;i<300;i++){const n=rand(g)%121,x=n%11,y=Math.floor(n/11);if(!g.board[n]&&Math.abs(x-g.x)+Math.abs(y-g.y)>3&&!g.entities.some(e=>e.x===x&&e.y===y))return[x,y];}for(let n=0;n<121;n++)if(!g.board[n]&&!g.entities.some(e=>e.x===n%11&&e.y===Math.floor(n/11))&&(n%11!==g.x||Math.floor(n/11)!==g.y))return[n%11,Math.floor(n/11)];return[0,0];};
 for(let n=0;n<g.goal;n++){const[x,y]=empty();g.entities.push(entity(x,y,2));}for(let n=0;n<2+Math.floor(g.level/3);n++){const[x,y]=empty();g.entities.push(entity(x,y,1));}
}
export function illuminated(g,x,y){for(let n=0;n<121;n++){if(!g.aux[n])continue;const lx=n%11,ly=Math.floor(n/11);if((x!==lx&&y!==ly)||Math.abs(x-lx)+Math.abs(y-ly)>3)continue;let xx=lx,yy=ly,clear=true;while(xx!==x||yy!==y){xx+=Math.sign(x-xx);yy+=Math.sign(y-yy);if(g.board[yy*11+xx]){clear=false;break;}}if(clear)return true;}return false;}
function garden(g,input,edge){if(g.cooldown)return;let acted=false;
 if((edge&16)&&g.energy>=2){g.energy-=2;g.aux[g.y*11+g.x]=4;acted=true;}
 else if(input&15){const x=g.x+(input&1?-1:input&2?1:0),y=g.y+(input&3?0:input&4?-1:input&8?1:0);if(x>=0&&x<11&&y>=0&&y<11&&!g.board[y*11+x]){g.x=x;g.y=y;acted=true;}}
 if(!acted)return;g.cooldown=6;g.turn++;if(g.invulnerable)g.invulnerable--;
 for(const e of g.entities){if(e.kind===2&&e.x===g.x&&e.y===g.y){e.kind=0;g.score+=100;g.energy=Math.min(6,g.energy+1);g.progress++;}}
 if(g.progress>=g.goal){advance(g,12);return;}
 for(const e of g.entities){if(e.kind!==1)continue;if(illuminated(g,e.x,e.y)){e.kind=0;g.score+=75;continue;}
  let tx=g.x,ty=g.y,best=100;for(let n=0;n<121;n++)if(g.aux[n]){const d=Math.abs(n%11-e.x)+Math.abs(Math.floor(n/11)-e.y);if(d<best){best=d;tx=n%11;ty=Math.floor(n/11);}}
  const dx=Math.sign(tx-e.x),dy=Math.sign(ty-e.y),moves=g.turn%2?[[dx,0],[0,dy]]:[[0,dy],[dx,0]];
  for(const[xx,yy]of moves){if(!xx&&!yy)continue;const x=e.x+xx,y=e.y+yy;if(x>=0&&x<11&&y>=0&&y<11&&!g.board[y*11+x]&&!g.entities.some(other=>other!==e&&other.kind===1&&other.x===x&&other.y===y)){e.x=x;e.y=y;break;}}
  if(illuminated(g,e.x,e.y)){e.kind=0;g.score+=75;continue;}
  if(e.x===g.x&&e.y===g.y&&!g.invulnerable){g.lives--;g.invulnerable=3;e.kind=0;if(!g.lives)g.over=true;}}
 g.entities=g.entities.filter(e=>e.kind);for(let n=0;n<121;n++)if(g.aux[n])g.aux[n]--;
}
