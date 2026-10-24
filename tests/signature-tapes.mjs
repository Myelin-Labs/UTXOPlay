// Reach every signature mechanic from genesis, without edited game state.
import assert from 'node:assert/strict';
import {createGame,step} from '../games/arcade/web/engine.mjs';
export function signatureTape(kind){
 const game=createGame(kind),inputs=[];const tick=bits=>{inputs.push(bits);step(game,bits);};
 if(kind==='prism-breaker'){
  for(let n=0;n<420&&!game.over&&!game.draft;n++){const ball=game.bodies[0];tick((ball.x<game.x-12?1:ball.x>game.x+12?2:0)|(n===2?4:n===150?8:0));}
  assert.ok(game.refractions>=1);
 }else if(kind==='neon-coil'){
  const dirs=[[0,-1,4],[1,0,2],[0,1,8],[-1,0,1]];
  const move=(g,bit)=>{const before=g.trail[0].join();const tape=[];do{tape.push(bit);step(g,bit);}while(!g.over&&g.trail[0].join()===before);return tape;};
  while(game.trail.length<9){
   const queue=[[...game.trail[0],[]]],seen=new Set(),blocked=new Set(game.trail.slice(0,-1).map(p=>p.join()));let path;
   for(let j=0;j<queue.length;j++){const [x,y,steps]=queue[j];if(x===game.x&&y===game.y){path=steps;break;}for(const [dx,dy,bit] of dirs){const xx=x+dx,yy=y+dy,key=[xx,yy].join();if(xx<0||xx>19||yy<0||yy>19||seen.has(key)||blocked.has(key)||(!steps.length&&(dirs.findIndex(d=>d[2]===bit)+2)%4===game.dir))continue;seen.add(key);queue.push([xx,yy,[...steps,bit]]);}}
   assert.ok(path,'food route');for(const bit of path)inputs.push(...move(game,bit));assert.equal(game.over,false);
  }
  // Search short genuine turns; closing requires a non-vacating body segment.
  const search=(g,depth)=>{if(g.specials)return [];if(!depth)return null;for(const [, ,bit] of dirs){if((dirs.findIndex(d=>d[2]===bit)+2)%4===g.dir)continue;const next=structuredClone(g),tape=move(next,bit);if(next.over)continue;const suffix=search(next,depth-1);if(suffix)return [...tape,...suffix];}return null;};
  const loop=search(game,10);assert.ok(loop,'reachable closed circuit');for(const bits of loop)tick(bits);assert.equal(game.specials,1);assert.ok(game.loop_area>0);
 }else if(kind==='starfall'){
  for(let n=0;n<1200&&!game.over;n++){
   const incoming=game.bodies.filter(b=>b.tag===3&&b.y>550&&b.y<930).sort((a,b)=>b.y-a.y)[0];
   const target=incoming?.x??game.x;const move=target<game.x-12?1:target>game.x+12?2:0;
   tick(move|(incoming&&game.energy===0?4:16));if(game.specials>=2)break;
  }
  assert.ok(game.specials>=1,'capture and release from a real enemy shot');
 }else{
  for(let n=0;n<1500&&!game.over;n++){
   const hazards=game.bodies.filter(b=>b.tag===1&&b.y>620&&b.y<885),danger=hazards.find(b=>b.x===game.x);
   let lane=game.x;
   if(danger&&!game.ability_ticks)lane=[0,1,2].filter(l=>!hazards.some(b=>b.x===l)).sort((a,b)=>Math.abs(a-game.x)-Math.abs(b-game.x))[0]??game.x;
   else if(!hazards.length&&game.x!==1)lane=1;
   tick((lane<game.x?1:lane>game.x?2:0)|(game.energy>=3&&!game.ability_lock?16:0));
   if(game.specials>=2)break;
  }
  assert.ok(game.specials>=1,'earned three charges and activated overdrive');
 }
 assert.equal(game.over,false,kind+' signature is survivable');return {kind,inputs,game};
}
