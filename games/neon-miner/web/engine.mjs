// Integer prediction of the native Myelin miner. Never submit score or balance.
import {directions} from './directions.mjs';
export const shop=[{id:'emp',name:'EMP charge',price:8,desc:'Destroy a heavy catch and reel back empty. Press X.',icon:'✦'},{id:'overdrive',name:'Overdrive',price:18,desc:'Double winch speed for 15 seconds. Press E.',icon:'»'},{id:'time-cell',name:'Time cell',price:15,desc:'Add 10 seconds. Two per sector. Press T.',icon:'◷'},{id:'lens',name:'Crystal lens',price:30,desc:'Permanent +20% crystal value per tier. Three tiers.',icon:'◇'}];
export const districts=['Gilded undercity','Neon transit','Data catacombs','Reactor heart'];
export function createGame(){const g={kind:'neon-miner',tick:0,level:1,score:0,level_score:0,goal:350,coins:0,earned:0,spent:0,lives:3,mode:'mining',over:false,time:1800,phase:0,angle:35,dir:1,length:36,cargo:-1,rng:92017,previous:0,stock:[1,0,0],boost:0,lens:0,time_used:0,ores:[]};populate(g);return g;}
function rand(g){return g.rng=(g.rng*16807)%2147483647;}
function populate(g){g.rng=92017+g.level*104729;const types=[0,1,2,3,0,1,0,4,1,3,2,0,5,3,1];for(let n=types.length-1;n>0;n--){const j=rand(g)%(n+1);[types[n],types[j]]=[types[j],types[n]];}g.ores=types.map((kind,n)=>{const x=120+(n%5)*190+rand(g)%61-30,y=260+Math.trunc(n/5)*140+rand(g)%41-20;const [value,weight,radius]=[[80,2,24],[200,5,38],[260,1,21],[15,7,33],[110,2,24],[0,3,27]][kind];return {x,y,radius,kind,value:kind===5?90+rand(g)%151:value,weight,taken:false};});}
export function tip(g){const d=directions[g.angle];return [500+Math.trunc(d[0]*g.length/1000),100+Math.trunc(d[1]*g.length/1000)];}
function reward(g,coins){g.coins+=coins;g.earned+=coins;}
export function step(g,input){if(g.mode!=='mining'||g.over)return;g.tick++;g.time=Math.max(0,g.time-1);const pressed=input&~g.previous;g.previous=input;if(g.boost>0)g.boost--;
 if((pressed&2)&&g.phase===2&&g.cargo>=0&&g.stock[0]>0){g.stock[0]--;g.cargo=-1;}
 if((pressed&4)&&g.boost===0&&g.stock[1]>0){g.stock[1]--;g.boost=450;}
 if((pressed&8)&&g.time_used<2&&g.stock[2]>0){g.stock[2]--;g.time_used++;g.time=Math.min(2400,g.time+300);}
 if(g.phase===0){if(pressed&1)g.phase=1;else if(g.tick%2===0){g.angle+=g.dir;if(g.angle>=70)g.dir=-1;if(g.angle<=0)g.dir=1;}}
 else if(g.phase===1){g.length=Math.min(g.length+18,950);const [x,y]=tip(g);for(let n=0;n<g.ores.length;n++){const o=g.ores[n];if(!o.taken&&(x-o.x)**2+(y-o.y)**2<=(o.radius+8)**2){o.taken=true;g.cargo=n;g.phase=2;break;}}if(x<25||x>975||y>=650||g.length>=950)g.phase=2;}
 else if(g.phase===2){const speed=g.cargo<0?22:Math.max(3,Math.trunc(18/g.ores[g.cargo].weight));g.length=Math.max(36,g.length-speed*(g.boost>0?2:1));if(g.length===36){if(g.cargo>=0){const o=g.ores[g.cargo],value=o.kind===2?Math.trunc(o.value*(100+20*g.lens)/100):o.value;g.score+=value;g.level_score+=value;reward(g,Math.trunc(value/10));if(o.kind===4)g.time=Math.min(2400,g.time+90);}g.cargo=-1;g.phase=0;if(g.level_score>=g.goal){reward(g,15);g.mode=g.level===20?'complete':'cleared';g.over=g.level===20;}}}
 if(g.mode==='mining'&&g.time===0){g.mode='lost';g.over=g.lives===0;}if(g.tick>=90000){g.mode='lost';g.over=true;g.lives=0;}
}
export function apply(g,a){
 if(a.type==='ticks'){for(const i of a.inputs)step(g,i);return;}
 if(a.type==='next'&&g.mode==='cleared'&&g.level<20){Object.assign(g,{level:g.level+1,level_score:0,goal:350+g.level*30,time:1800,time_used:0,boost:0,phase:0,angle:35,dir:1,length:36,cargo:-1,previous:0,mode:'mining'});populate(g);return;}
 if(a.type==='retry'&&g.mode==='lost'&&g.lives>0&&g.tick<90000){g.lives--;g.time=1800;g.mode='mining';g.over=false;g.previous=0;return;}
 if(a.type==='buy'){const n=shop.findIndex(s=>s.id===a.item);if(n<0||g.over)throw Error('Unavailable');const price=shop[n].price*(n===3?g.lens+1:1);if(g.coins<price||(n===3?g.lens>=3:g.stock[n]>=3))throw Error('Unavailable');g.coins-=price;g.spent+=price;if(n===3)g.lens++;else g.stock[n]++;return;}
 throw Error('Invalid action');
}

export function sameState(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameState(a[k],b[k]));}
