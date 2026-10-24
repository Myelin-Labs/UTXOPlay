// Integer prediction of the native Myelin miner. Never submit score or balance.
import {directions} from './directions.mjs';
export const SECTORS=60,MAX_TICKS=200000;
export const shop=[
 {id:'emp',name:'EMP charge',price:8,slot:0,art:'emp',desc:'Discard a catch, including a volatile mine, without its penalty. X.'},
 {id:'overdrive',name:'Overdrive',price:18,slot:1,art:'overdrive',desc:'Double winch speed for 15 seconds. E.'},
 {id:'time-cell',name:'Time cell',price:15,slot:2,art:'time-cell',desc:'Add 10 seconds. Two uses early; one in the deep sectors. T.'},
 {id:'lens',name:'Crystal lens',price:30,upgrade:'lens',art:'lens',desc:'Permanent +20% crystal value per tier. Three tiers.'},
 {id:'stasis',name:'Stasis field',price:20,slot:3,art:'lens',desc:'Freeze drifting ore and slow the claw swing for 6 seconds. F.'},
 {id:'winch',name:'Winch tuning',price:45,upgrade:'winch',art:'claw',desc:'Permanent faster retrieval, especially for heavy cargo. Three tiers.'}
];
export const districts=['Gilded undercity','Neon transit','Data catacombs','Reactor heart'];
export const oreNames=['Gold','Heavy gold','Data crystal','Heavy scrap','Power cell','Data cache','Volatile mine','Armored vault'];
export const tier=g=>Math.floor((g.level-1)/15);
export const sectorTime=level=>1800-Math.min(750,(level-1)*13);
export const timeLimit=g=>g.level>30?1:2;
export function contract(g){const type=(g.level-1)%5,t=tier(g),kind=[-1,2,3,4,7][type],need=[0,2+(t>1?1:0),2+(t>1?1:0),1+(t>0?1:0),1+(t>1?1:0)][type];return {type,kind,need,name:['Value run','Crystal survey','Salvage order','Power relay','Vault breach'][type],have:kind<0?0:g.collected[kind]};}
export function sectorGoal(level){const type=(level-1)%5,base=380+(level-1)*32+Math.floor((level-1)/15)*100;return Math.trunc(base*[100,85,65,85,85][type]/100);}
export const priceFor=(g,item)=>item.price*(item.upgrade?g[item.upgrade]+1:1+tier(g)*tier(g));
export function createGame(){const g={kind:'neon-miner',tick:0,level:1,score:0,level_score:0,goal:sectorGoal(1),coins:0,earned:0,spent:0,lives:3,mode:'mining',over:false,time:sectorTime(1),phase:0,angle:35,dir:1,length:36,cargo:-1,rng:92017,previous:0,stock:[1,0,0,0],boost:0,lens:0,winch:0,stasis:0,combo:0,collected:Array(8).fill(0),time_used:0,ores:[]};populate(g);return g;}
function rand(g){return g.rng=(g.rng*16807)%2147483647;}
function populate(g){
 g.rng=92017+g.level*104729;
 const types=[0,1,2,3,0,1,2,4,1,3,2,0,5,3,1,4,7,7,6,0];
 if(g.level>=16)types[19]=6;if(g.level>=31)types[0]=3;if(g.level>=46)types[8]=6;
 for(let n=types.length-1;n>0;n--){const j=rand(g)%(n+1);[types[n],types[j]]=[types[j],types[n]];}
 g.ores=types.map((kind,n)=>{const x=120+(n%5)*190+rand(g)%41-20,y=280+Math.trunc(n/5)*98+rand(g)%31-15;
 const [value,weight,radius]=[[80,2,24],[200,5,36],[260,1,21],[40,7,30],[110,2,24],[0,3,27],[0,4,26],[420,6,32]][kind];
 return {x,y,radius,kind,value:kind===5?90+rand(g)%151:value,weight,taken:false,anchor:x,vx:g.level>=11&&n%3===0?(n%2?-1:1)*(1+Math.trunc(tier(g)/2)):0,armor:kind===7?1+Math.trunc(tier(g)/2):0};});
}
export function tip(g){const d=directions[g.angle];return [500+Math.trunc(d[0]*g.length/1000),100+Math.trunc(d[1]*g.length/1000)];}
export function oreValue(g,o){const base=o.kind===2?Math.trunc(o.value*(100+20*g.lens)/100):o.value;return Math.trunc(base*(100+5*Math.min(g.combo,5))/100);}
function reward(g,coins){g.coins+=coins;g.earned+=coins;}
export function canDiscard(g){if(g.phase!==2||g.cargo<0||!g.stock[0])return false;const c=contract(g),o=g.ores[g.cargo];return o.kind!==c.kind||c.have+g.ores.filter(o=>!o.taken&&o.kind===c.kind).length>=c.need;}
export function step(g,input){
 if(g.mode!=='mining'||g.over)return;g.tick++;g.time=Math.max(0,g.time-1);const pressed=input&~g.previous;g.previous=input;
 if(g.boost>0)g.boost--;if(g.stasis>0)g.stasis--;
 if((pressed&2)&&canDiscard(g)){g.stock[0]--;g.cargo=-1;g.combo=0;}
 if((pressed&4)&&g.boost===0&&g.stock[1]>0){g.stock[1]--;g.boost=450;}
 if((pressed&8)&&g.time_used<timeLimit(g)&&g.stock[2]>0){g.stock[2]--;g.time_used++;g.time=Math.min(2400,g.time+300);}
 if((pressed&16)&&g.stasis===0&&g.stock[3]>0){g.stock[3]--;g.stasis=180;}
 if(!g.stasis&&g.tick%2===0)for(const o of g.ores)if(!o.taken&&o.vx){o.x+=o.vx;const range=25+tier(g)*8;if(o.x>=o.anchor+range||o.x<=o.anchor-range)o.vx=-o.vx;}
 if(g.phase===0){if(pressed&1)g.phase=1;else if(g.tick%(g.stasis?4:g.level>30?1:2)===0){g.angle+=g.dir;if(g.angle>=70)g.dir=-1;if(g.angle<=0)g.dir=1;}}
 else if(g.phase===1){g.length=Math.min(g.length+18,950);const [x,y]=tip(g);for(let n=0;n<g.ores.length;n++){const o=g.ores[n];if(!o.taken&&(x-o.x)**2+(y-o.y)**2<=(o.radius+8)**2){g.phase=2;if(o.armor>0)o.armor--;else{o.taken=true;g.cargo=n;}break;}}if(x<25||x>975||y>=650||g.length>=950)g.phase=2;}
 else if(g.phase===2){const speed=g.cargo<0?22:Math.max(3,Math.trunc((18+4*g.winch)/g.ores[g.cargo].weight));g.length=Math.max(36,g.length-speed*(g.boost>0?2:1));
  if(g.length===36){if(g.cargo>=0){const o=g.ores[g.cargo];if(o.kind===6){g.time=Math.max(0,g.time-120-tier(g)*30);g.combo=0;}else{const value=oreValue(g,o);g.score+=value;g.level_score+=value;g.collected[o.kind]++;reward(g,Math.trunc(value/10));g.combo=Math.min(5,g.combo+1);if(o.kind===4)g.time=Math.min(2400,g.time+90);}}else g.combo=0;
   g.cargo=-1;g.phase=0;const c=contract(g);if(g.level_score>=g.goal&&c.have>=c.need){reward(g,20+5*tier(g));g.mode=g.level===SECTORS?'complete':'cleared';g.over=g.level===SECTORS;}}
 }
 if(g.mode==='mining'&&g.time===0){g.mode='lost';g.over=g.lives===0;}if(g.tick>=MAX_TICKS){g.mode='lost';g.over=true;g.lives=0;}
}
export function apply(g,a){
 if(a.type==='ticks'){for(const i of a.inputs)step(g,i);return;}
 if(a.type==='next'&&g.mode==='cleared'&&g.level<SECTORS){Object.assign(g,{level:g.level+1,level_score:0,goal:sectorGoal(g.level+1),time:sectorTime(g.level+1),time_used:0,boost:0,stasis:0,combo:0,collected:Array(8).fill(0),phase:0,angle:35,dir:1,length:36,cargo:-1,previous:0,mode:'mining'});populate(g);return;}
 if(a.type==='retry'&&g.mode==='lost'&&g.lives>0&&g.tick<MAX_TICKS){g.lives--;g.time=sectorTime(g.level);g.mode='mining';g.over=false;g.previous=0;return;}
 if(a.type==='buy'){const item=shop.find(s=>s.id===a.item);if(!item||g.over)throw Error('Unavailable');const price=priceFor(g,item),owned=item.upgrade?g[item.upgrade]:g.stock[item.slot];if(g.coins<price||owned>=3)throw Error('Unavailable');g.coins-=price;g.spent+=price;if(item.upgrade)g[item.upgrade]++;else g.stock[item.slot]++;return;}
 throw Error('Invalid action');
}
export function sameState(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameState(a[k],b[k]));}
