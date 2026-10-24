import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {createPrism,prismStep,choosePerk} from '../games/arcade/web/prism-engine.mjs';
const bin=process.env.PRISM_BIN||'deploy/bin/myelin-prism-breaker';let samples=0;
for(let trial=0;trial<48;trial++){const g=createPrism(),actions=[];let seed=trial+1;
 for(let n=0;n<2400&&!g.over;n++){seed=seed*16807%2147483647;if(g.draft){const choice=g.offers[seed%g.offers.length];choosePerk(g,choice);actions.push({type:'perk',choice});}
 const i=trial<8?[0,1,2,16,17,18,31,3][trial]:seed%32;prismStep(g,i);if(actions.at(-1)?.type==='ticks'&&actions.at(-1).inputs.length<60)actions.at(-1).inputs.push(i);else actions.push({type:'ticks',inputs:[i]});samples++;}
 const result=spawnSync(bin,['simulate'],{input:JSON.stringify({kind:'prism-breaker',actions}),encoding:'utf8',maxBuffer:16e6});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),g,`trial ${trial}`);
}
// A legal controller reaches every sector and chooses all perk families. No state edits.
const g=createPrism(),actions=[];let draftCount=0;
for(let n=0;n<108000&&!g.over;n++){
 if(g.draft){const order=[5,1,0,2,3,4],choice=order.find(p=>g.offers.includes(p)&&g.perks[p]< (p===5?2:4))??g.offers[0];choosePerk(g,choice);actions.push({type:'perk',choice});draftCount++;}
 const remaining=g.cells.map((hp,i)=>({hp,x:71+i%12*78})).filter(b=>b.hp),aim=remaining[Math.floor(n/450)%remaining.length]?.x??500;
 const ball=[...g.bodies].filter(b=>b.vy>0).sort((a,b)=>b.y-a.y)[0]||g.bodies[0];let target=aim;
 if(ball?.vy>0){const ticks=Math.max(0,(550-ball.y)/ball.vy);let x=ball.x+ticks*ball.vx;while(x<18||x>982)x=x<18?36-x:1964-x;target=x+(aim<x?36:-36);}
 const i=(target<g.x-9?1:target>g.x+9?2:0)|(!g.cooldown&&remaining.some(b=>Math.abs(b.x-g.x)<100)?16:0);prismStep(g,i);if(actions.at(-1)?.type==='ticks'&&actions.at(-1).inputs.length<60)actions.at(-1).inputs.push(i);else actions.push({type:'ticks',inputs:[i]});
}
const result=spawnSync(bin,['simulate'],{input:JSON.stringify({kind:'prism-breaker',actions}),encoding:'utf8',maxBuffer:16e6});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),g,'full campaign');console.log({randomTapes:48,samples,sector:g.level,cleared:g.over&&!g.cells.some(Boolean),perks:g.perks,draftCount,ticks:g.tick,lives:g.lives,balls:g.bodies,remaining:g.cells.map((v,i)=>v?i:null).filter(v=>v!==null)});
assert.equal(g.level,24,'controller must reach final sector');assert.equal(g.cells.some(Boolean),false,'controller must clear campaign');
import {writeFileSync,mkdirSync} from 'node:fs';mkdirSync('artifacts/prism',{recursive:true});writeFileSync('artifacts/prism/campaign-actions.json',JSON.stringify(actions));
