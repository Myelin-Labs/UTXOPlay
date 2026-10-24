import levels from './prism-levels.json' with {type:'json'};
export {levels};
export const PERKS=[
 {name:'Longboard',detail:'Permanently widen your paddle by 12%.',icon:'paddle'},
 {name:'Diamond edge',detail:'Deal +1 damage to armoured crystals per rank.',icon:'diamond'},
 {name:'Collector',detail:'Catch capsules from 35 units farther away per rank.',icon:'citrine'},
 {name:'Timekeeper',detail:'Capsule effects last 3 seconds longer per rank.',icon:'aquamarine'},
 {name:'Resonator',detail:'Increase your chain multiplier cap by 2 per rank.',icon:'amethyst'},
 {name:'Safety net',detail:'Start each sector with an extra floor rescue per rank.',icon:'heart'}
];
export const DROPS=['LONGBOARD','TIME DILATION','TRIPLE ORB','FLOOR SHIELD','PHASE ORB','PULSE READY'];
export const brickPoint=(g,n)=>({x:71+n%12*78,y:115+Math.floor(n/12)*33+Math.min(48,Math.floor(g.wave_tick/900)*12)});
export const paddleHalf=g=>58+g.perks[0]*7+(g.wide>0?30:0);
const ball=(g,vx=7)=>({x:g.x,y:510,vx,vy:-(10+Math.min(6,Math.floor(g.level/4))),tag:0});
export function loadLevel(g){const rows=levels[(g.level-1)%24].rows.join('');g.cells=[...rows].map(c=>c==='.'?0:c==='2'?2:c==='3'?3:1);g.types=[...rows].map(c=>c==='X'?1:c==='C'?2:0);g.bodies=[ball(g)];g.pickups=[];g.wave_tick=0;g.wide=g.slow=g.pierce=0;g.shield=g.perks[5];g.cooldown=0;g.refraction=4;g.refract_latch=0;g.combo=0;g.draft=false;g.offers=[];}
export function createPrism(){const g={kind:'prism-breaker',tick:0,score:0,lives:3,level:1,over:false,x:500,combo:0,cooldown:0,wave_tick:0,destroyed:0,refraction:4,refract_latch:0,refractions:0,refract_dir:0,wide:0,slow:0,pierce:0,shield:0,perks:[0,0,0,0,0,0],offers:[],draft:false,cells:[],types:[],bodies:[],pickups:[]};loadLevel(g);return g;}
export function choosePerk(g,choice){if(g.over||!g.draft||!g.offers.includes(choice))throw Error('Choose an offered perk');g.perks[choice]++;g.level++;loadLevel(g);}
function damage(g,n,power){if(!g.cells[n])return;g.cells[n]=Math.max(0,g.cells[n]-power);if(g.cells[n])return;g.combo++;g.destroyed++;g.refraction=Math.min(6,g.refraction+1);g.score+=10*Math.min(g.combo,8+g.perks[4]*2);const p=brickPoint(g,n);if((g.destroyed%5===0||g.types[n]===2)&&g.pickups.length<24)g.pickups.push({...p,vx:0,vy:3,tag:(g.destroyed+g.level)%6});if(g.types[n]===1){for(const j of [n-12,n+12,n%12>0?n-1:-1,n%12<11?n+1:-1])if(j>=0&&j<96)damage(g,j,1);}}
export function prismStep(g,input){
 if(g.over||g.draft)return;g.tick++;g.wave_tick++;for(const key of ['wide','slow','pierce','cooldown'])if(g[key]>0)g[key]--;
 const bend=input&12;
 if(bend&&!g.refract_latch&&g.refraction>=4&&g.bodies.length){const direction=(bend&4)?-1:1;g.refraction-=4;g.refractions++;g.refract_dir=direction;for(const b of g.bodies){b.vx=direction*(6+Math.min(6,Math.abs(b.vx)));b.vy=-Math.max(8,Math.abs(b.vy));}}g.refract_latch=bend;
 const half=paddleHalf(g);g.x=Math.max(half+15,Math.min(985-half,g.x+((input&1)?-19:0)+((input&2)?19:0)));
 if((input&16)&&!g.cooldown){const targets=g.cells.map((hp,n)=>({hp,n,...brickPoint(g,n)})).filter(p=>p.hp&&Math.abs(p.x-g.x)<115).sort((a,b)=>b.y-a.y||a.n-b.n).slice(0,3);for(const p of targets)damage(g,p.n,2+g.perks[1]);g.cooldown=360;}
 for(const b of g.bodies){
  if(g.slow>0&&g.tick%2===0)continue;
  const oldX=b.x,oldY=b.y;b.x+=b.vx;b.y+=b.vy;
  if(b.x<18){b.x=18;b.vx=Math.abs(b.vx);}if(b.x>982){b.x=982;b.vx=-Math.abs(b.vx);}if(b.y<82){b.y=82;b.vy=Math.abs(b.vy);}
  if(b.vy>0&&oldY<550&&b.y>=550&&Math.abs(b.x-g.x)<half+7){b.y=549;b.vy=-(10+Math.min(6,Math.floor(g.level/4)));b.vx=Math.max(-12,Math.min(12,Math.trunc((b.x-g.x)/6)))||3;g.combo=0;}
  for(let n=0;n<96;n++){if(!g.cells[n])continue;const p=brickPoint(g,n);if(Math.abs(b.x-p.x)<41&&Math.abs(b.y-p.y)<18){damage(g,n,1+g.perks[1]);if(!g.pierce){if(Math.abs(oldX-p.x)>=41){b.vx=-b.vx;b.x=oldX;}else{b.vy=-b.vy;b.y=oldY;}}break;}}
  if(b.y>590&&b.vy>0&&g.shield>0){g.shield--;b.y=589;b.vy=-Math.abs(b.vy);}
 }
 g.bodies=g.bodies.filter(b=>b.y<640);
 for(const p of g.pickups){p.y+=p.vy;if(p.y>=530&&p.y<=575&&Math.abs(p.x-g.x)<half+18+g.perks[2]*35){const duration=360+g.perks[3]*90;switch(p.tag){case 0:g.wide=duration;break;case 1:g.slow=duration;break;case 2:for(const vx of [-9,9])if(g.bodies.length<3)g.bodies.push(ball(g,vx));break;case 3:g.shield=Math.min(5,g.shield+1);break;case 4:g.pierce=duration;break;case 5:g.cooldown=0;break;}p.tag=-1;}}
 g.pickups=g.pickups.filter(p=>p.tag>=0&&p.y<630);
 if(!g.cells.some(Boolean)){g.score+=500+g.level*100;if(g.level===24){g.over=true;}else{g.draft=true;g.offers=[];for(let i=0;i<6;i++){const p=(g.level+i*5)%6;if(g.perks[p]<4&&g.offers.length<3)g.offers.push(p);}}}
 else if(!g.bodies.length){g.lives--;g.combo=0;g.wide=g.slow=g.pierce=0;if(g.lives===0)g.over=true;else g.bodies=[ball(g)];}
 if(g.tick>=108000){g.over=true;g.draft=false;g.offers=[];}
}
