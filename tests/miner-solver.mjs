import {step,createGame,apply,contract,shop,priceFor,timeLimit} from '../games/neon-miner/web/engine.mjs';
function equipment(g){return (g.phase===2&&g.cargo>=0&&g.ores[g.cargo].weight>=4&&!g.boost&&g.stock[1]?4:0)|(g.time<330&&g.time_used<timeLimit(g)&&g.stock[2]?8:0)|(g.cargo>=0&&g.ores[g.cargo].kind===6&&g.stock[0]?2:0);}
export function nextHaul(g){
 let best=null,waiting=structuredClone(g);const objective=contract(g),missing=objective.have<objective.need;
 for(let wait=0;wait<300&&waiting.mode==='mining';wait++){
  const test=structuredClone(waiting),before=test.score,armor=test.ores.reduce((n,o)=>n+o.armor,0),inputs=[1|equipment(test)];step(test,inputs[0]);
  while(test.mode==='mining'&&test.phase!==0&&inputs.length<700){const i=equipment(test)&~test.previous;inputs.push(i);step(test,i);}
  const gain=test.score-before,progress=missing?test.collected[objective.kind]-g.collected[objective.kind]:0,cracks=armor-test.ores.reduce((n,o)=>n+o.armor,0);
  const cleared=test.ores.filter(o=>o.taken).length-g.ores.filter(o=>o.taken).length;
  const useful=cleared*20+gain*.15+Math.min(gain,Math.max(0,g.goal-g.level_score))+progress*700+(missing&&objective.kind===7?cracks*200:cracks*12);
  const rate=useful/(wait+inputs.length);
  if(useful>0&&test.mode!=='lost'&&(!best||rate>best.rate))best={wait,inputs,rate,gain};
  step(waiting,0);
 }
 if(!best)throw Error(`No useful haul in sector ${g.level}: ${g.level_score}/${g.goal}, ${objective.have}/${objective.need} ${objective.name}, time=${g.time}`);
 const inputs=[...Array(best.wait).fill(0),...best.inputs];for(const i of inputs)step(g,i);return inputs;
}
export function campaign({purchases=true,stasis=false}={}){
 const g=createGame(),actions=[],metrics=[];let sectors=0;
 while(g.mode!=='complete'){
  if(purchases){for(const id of ['winch','lens','overdrive','time-cell','emp',...(stasis?['stasis']:[])]){const item=shop.find(i=>i.id===id),desired=item.upgrade?3:2;while((item.upgrade?g[item.upgrade]:g.stock[item.slot])<desired&&g.coins>=priceFor(g,item)){const a={type:'buy',item:id};apply(g,a);actions.push(a);}}}
  if(stasis&&g.level>=11&&g.stock[3]){const a={type:'ticks',inputs:[16,0]};apply(g,a);actions.push(a);}
  const start=g.tick;
  while(g.mode==='mining'){let inputs;try{inputs=nextHaul(g);}catch(error){if(!g.lives)throw error;inputs=[];while(g.mode==='mining'){step(g,0);inputs.push(0);}for(let n=0;n<inputs.length;n+=60)actions.push({type:'ticks',inputs:inputs.slice(n,n+60)});const retry={type:'retry'};apply(g,retry);actions.push(retry);continue;}for(let n=0;n<inputs.length;n+=60)actions.push({type:'ticks',inputs:inputs.slice(n,n+60)});}
  if(g.mode==='lost')throw Error(`Sector ${g.level} timed out`);sectors++;metrics.push({level:g.level,seconds:(g.tick-start)/30,timeLeft:g.time/30,score:g.level_score,coins:g.coins,contract:contract(g).name});
  if(g.mode==='complete')break;const a={type:'next'};apply(g,a);actions.push(a);
 }
 return {g,actions,sectors,metrics};
}
