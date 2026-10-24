import {prismStep as step,paddleHalf} from './prism-engine.mjs';
import {intercept} from './vendor/breakout-intercept.mjs';
// Simulate a disposable copy with the paddle held still. Nothing changes the input tape.
export function focusPath(game,horizon=96){
 if(game.kind!=='prism-breaker'||game.over||game.draft||!game.bodies.length)return {points:[],landing:null};
 const copy=structuredClone(game),points=[{x:copy.bodies[0].x,y:copy.bodies[0].y}];
 for(let n=0;n<Math.min(96,Math.max(0,horizon));n++){
  const before={...copy.bodies[0]};step(copy,0);const after=copy.bodies[0];
  if(copy.lives!==game.lives||copy.level!==game.level||copy.over||copy.draft||!after)break;
  if(copy.slow>0&&copy.tick%2===0)continue;
  if(before.vy>0&&before.y<550&&before.y+before.vy>=550){
   const hit=intercept(before.x,before.y,after.x,before.y+before.vy,0,550,1000,550,'landing');
   if(hit){points.push(hit);return {points,landing:{...hit,catchable:Math.abs(after.x-copy.x)<paddleHalf(copy)+7}};}
  }
  if(n%4===3||before.vx!==after.vx||before.vy!==after.vy||n===horizon-1)points.push({x:after.x,y:after.y});
 }
 return {points,landing:null};
}
