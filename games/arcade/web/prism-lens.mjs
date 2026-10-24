import {prismStep as step} from './prism-engine.mjs';
import {intercept} from './vendor/breakout-intercept.mjs';
// A local heading cue, never a solution: stop at the first contact, before any bounce.
export function focusPath(game,horizon=12){
 if(game.kind!=='prism-breaker'||game.over||game.draft||!game.bodies.length)return {points:[],landing:null};
 const copy=structuredClone(game),points=[{x:copy.bodies[0].x,y:copy.bodies[0].y}];
 const reach=Math.max(80,130-(game.level-1)*2);let travelled=0;
 for(let n=0;n<Math.min(12,Math.max(0,horizon));n++){
  const before={...copy.bodies[0]},cells=copy.cells.join();step(copy,0);const after=copy.bodies[0];
  if(copy.lives!==game.lives||copy.level!==game.level||copy.over||copy.draft||!after)break;
  if(before.vx!==after.vx||before.vy!==after.vy||copy.cells.join()!==cells)break;
  if(intercept(before.x,before.y,after.x,after.y,0,530,1000,530))break;
  const distance=Math.hypot(after.x-before.x,after.y-before.y);if(!distance)continue;
  const fraction=Math.min(1,(reach-travelled)/distance);travelled+=distance*fraction;
  points.push({x:before.x+(after.x-before.x)*fraction,y:before.y+(after.y-before.y)*fraction});
  if(travelled>=reach)break;
 }
 return {points,landing:null};
}
