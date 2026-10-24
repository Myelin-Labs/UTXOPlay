import {step} from './engine.mjs';
import {intercept} from './vendor/breakout-intercept.mjs';
// Simulate a disposable copy with the paddle held still. Nothing changes the input tape.
export function focusPath(game,horizon=96){
 if(game.kind!=='prism-breaker'||game.over||!game.bodies.length)return {points:[],landing:null};
 const copy=structuredClone(game),points=[{x:copy.bodies[0].x,y:copy.bodies[0].y}];
 for(let n=0;n<Math.min(96,Math.max(0,horizon));n++){
  const before={...copy.bodies[0]};step(copy,0);const after=copy.bodies[0];
  if(copy.lives!==game.lives||copy.level!==game.level||copy.over)break;
  if(before.vy>0&&before.y<865&&before.y+before.vy>=865){
   const hit=intercept(before.x,before.y,after.x,before.y+before.vy,0,865,1000,865,'landing');
   if(hit){points.push(hit);return {points,landing:{...hit,catchable:Math.abs(after.x-copy.x)<108}};}
  }
  if(n%4===3||before.vx!==after.vx||before.vy!==after.vy||n===horizon-1)points.push({x:after.x,y:after.y});
 }
 return {points,landing:null};
}
