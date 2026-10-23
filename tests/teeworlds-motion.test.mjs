import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CharacterMotion,constrainCharacter,followCamera} from '../games/teeworlds/web/motion.mjs';
const frame=(tick,x,y=0,vx=10,vy=0)=>({tick,items:[[10,0,[tick,x,y,vx*256,vy*256]]]});
const x=(motion,time)=>motion.sample(time)[0][2][1];
test('25 Hz snapshots render continuous movement at 60 Hz without snapshot jumps',()=>{
 const motion=new CharacterMotion(10);motion.push(frame(0,0),0);
 for(let tick=2;tick<=100;tick+=2){const now=tick*20,before=x(motion,now);motion.push(frame(tick,tick*10),now);assert.ok(Math.abs(x(motion,now)-before)<1e-9);for(let t=0;t<40;t+=1000/60)assert.ok(Math.abs(x(motion,now+t)-(now+t)*.5)<1e-8);}
});
test('jittered packet arrival and direction reversals reconcile without a discontinuity',()=>{
 const motion=new CharacterMotion(10);motion.push(frame(0,0),0);
 for(const [tick,time,pos,vel]of [[2,55,20,10],[4,79,40,10],[6,132,40,-10],[8,161,20,-10],[10,218,0,0]]){const before=x(motion,time);motion.push(frame(tick,pos,0,vel),time);assert.ok(Math.abs(x(motion,time)-before)<1e-9);}
 assert.ok(Math.abs(x(motion,1000))<1e-5);
});
test('stale frames are ignored; missing characters, respawns and room resets do not smear',()=>{
 const m=new CharacterMotion(10);m.push(frame(10,50),0);assert.equal(m.push(frame(8,400),1),false);m.push({tick:12,items:[]},40);assert.equal(m.sample(41).length,0);m.push(frame(14,1000),80);assert.equal(x(m,80),1000);m.push(frame(16,50),120);assert.equal(x(m,120),50);m.reset();m.push(frame(0,4),130);assert.equal(x(m,130),4);
});
test('packet loss caps extrapolation instead of running away indefinitely',()=>{
 const m=new CharacterMotion(10);m.push(frame(0,0),0);assert.equal(x(m,40),20);assert.equal(x(m,5000),20);
});
test('visual extrapolation stops at walls and allows sliding along them',()=>{
 const map={width:8,height:8,tiles:Array(64).fill(0)};for(let y=0;y<8;y++)map.tiles[y*8+3]=1;
 const [px,py]=constrainCharacter(map,64,64,120,84);assert.ok(px+14<96);assert.ok(Math.abs(py-84)<1e-8);
});
test('camera follows the same visual position independently of render frame rate',()=>{
 const target=[0,100,30];let a={x:0,y:0},b={...a};for(let i=0;i<60;i++)a=followCamera(a,target,1000/60);for(let i=0;i<144;i++)b=followCamera(b,target,1000/144);assert.ok(Math.abs(a.x-b.x)<1e-8);assert.deepEqual(followCamera(a,[0,900,600],16,true),{x:900,y:600});
});
